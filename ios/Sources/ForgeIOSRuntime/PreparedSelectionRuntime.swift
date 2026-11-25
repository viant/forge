import Foundation

public struct SelectionPreparationDef: Codable, Sendable {
    public let dataSourceRef: String
    public let idsParameter: String
    public let identityField: String
    public let scopeFields: [String: String]?
    public let mappingRef: String?
    public let prepare: String
    public let pendingField: String?
    public let errorField: String?

    public init(
        dataSourceRef: String, idsParameter: String, identityField: String, scopeFields: [String: String]? = nil,
        mappingRef: String? = nil, prepare: String, pendingField: String? = nil, errorField: String? = nil
    ) {
        self.dataSourceRef = dataSourceRef
        self.idsParameter = idsParameter
        self.identityField = identityField
        self.scopeFields = scopeFields
        self.mappingRef = mappingRef
        self.prepare = prepare
        self.pendingField = pendingField
        self.errorField = errorField
    }
}

struct SelectionPreparationError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

private typealias SelectionRecord = [String: JSONValue]
private struct SupersededSelection: Error {}

private func selectionKey(_ value: JSONValue?) throws -> String {
    let invalid = SelectionPreparationError("A selected record has an invalid identity or scope value.")
    switch value {
    case .number(let n):
        guard n.isFinite, n.rounded() == n, abs(n) <= 9_007_199_254_740_991 else { throw invalid }
        return String(Int64(n))
    case .string(let text):
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw invalid }
        let negative = text.first == "-"
        let digits = negative ? text.dropFirst() : text[...]
        if !digits.isEmpty, digits.utf8.allSatisfy({ (48...57).contains($0) }) {
            let significant = digits.drop(while: { $0 == "0" })
            return significant.isEmpty ? "0" : (negative ? "-" : "") + significant
        }
        return text
    default: throw invalid
    }
}

private func rowsInSelectionOrder(_ records: [SelectionRecord], keys: [String], identity: String, scope: [String: String]) throws
    -> [SelectionRecord]
{
    guard records.count == keys.count else { throw SelectionPreparationError("The reader did not return exactly the selected records.") }
    var remaining = Dictionary(uniqueKeysWithValues: keys.enumerated().map { ($1, $0) })
    var result = Array(repeating: SelectionRecord(), count: keys.count)
    for row in records {
        let key = try selectionKey(resourceResolveValue(.object(row), path: identity))
        guard let position = remaining.removeValue(forKey: key) else {
            throw SelectionPreparationError("The reader returned an extra or duplicate record.")
        }
        for (selector, expected) in scope where try selectionKey(resourceResolveValue(.object(row), path: selector)) != expected {
            throw SelectionPreparationError("The reader returned a record outside the requested scope.")
        }
        result[position] = row
    }
    return result
}

private func encodedResource<T: Encodable>(_ value: T) throws -> JSONValue {
    try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(value))
}

private func projectedCases(_ rows: [SelectionRecord], mappingRef: String?, draftRef: String?, metadata: WindowMetadata) throws
    -> SelectionRecord
{
    let raw = metadata.runtimeAuthoring?.objectValue
    func model(_ ref: String) throws -> JSONValue {
        guard let definition = metadata.resourceModels[ref] else { throw SelectionPreparationError("Missing resource model: " + ref) }
        return try raw?["resourceModels"]?.objectValue?[ref] ?? encodedResource(definition)
    }
    var result: SelectionRecord = [
        "mapping": .null, "descriptors": .array([]), "rowCases": .array([]), "draftModel": try draftRef.map(model) ?? .null,
    ]
    guard let ref = mappingRef, !ref.isEmpty else { return result }
    guard let mapping = metadata.resourceMappings?[ref] else { throw SelectionPreparationError("Unknown resource mapping: " + ref) }
    result["mapping"] = .object([
        "fieldOrder": .array((mapping.fieldOrder ?? []).map(JSONValue.string)), "uploads": try encodedResource(mapping.uploads ?? [:]),
    ])
    var seen: [String?: Int] = [:]
    var descriptors: [JSONValue] = []
    var rowCases: [JSONValue] = []
    for row in rows {
        let (key, entry) = try ResourceModelRuntime.indexedMappedCase(ref, row: row, metadata: metadata)
        if let index = seen[key] {
            rowCases.append(.number(Double(index)))
            continue
        }
        guard let definition = metadata.resourceModels[entry.modelRef], let schema = metadata.schemas[definition.schemaRef] else {
            throw SelectionPreparationError("Mapped resource model is unavailable.")
        }
        let schemaValue = try raw?["schemas"]?.objectValue?[definition.schemaRef] ?? encodedResource(schema)
        seen[key] = descriptors.count
        rowCases.append(.number(Double(descriptors.count)))
        descriptors.append(
            .object([
                "modelRef": .string(entry.modelRef), "model": try model(entry.modelRef), "schema": schemaValue,
                "values": .object(entry.values ?? [:]),
            ]))
    }
    result["descriptors"] = .array(descriptors)
    result["rowCases"] = .array(rowCases)
    return result
}

extension ForgeRuntime {
    public func prepareEditableSelection(
        windowID: String, sourceDataSourceRef source: String, collection: EditableCollectionSpec,
        operation: EditableCollectionOperationSpec, boundary: PermissionBoundarySpec? = nil
    ) async -> MutationCommandResult {
        guard let spec = operation.prepareSelection, let dialogID = operation.dialogId, !dialogID.isEmpty,
            let metadata = await windowMetadata(id: windowID), let dialog = metadata.dialogs.first(where: { $0.id == dialogID }),
            let draft = dialog.content?.dataSourceRef ?? dialog.dataSourceRef, let destination = metadata.dataSources[draft],
            metadata.dataSources[source] != nil, metadata.dataSources[spec.dataSourceRef] != nil
        else {
            return .init(accepted: false, status: "failed", error: "The selection reader, draft or dialog is unavailable.")
        }
        let key = "\(windowID)Dialog\(dialogID)"
        guard selectionPreparationOwners[key] == nil else { return .init(accepted: false, status: "suppressed") }
        let invocation = UUID()
        selectionPreparationOwners[key] = invocation
        defer { selectionPreparationOwners.removeValue(forKey: key) }
        let dialogSignal = await signals.dialog(dialogID: key)
        let originalDialog = await dialogSignal.peek()
        guard !originalDialog.open else { return .init(accepted: false, status: "invalid") }
        let policy = operation.selection ?? collection.selection
        let actor = metadata.authorizationSnapshot
        let originalPending =
            if let field = spec.pendingField { await windowFormJSONValue(windowID: windowID)[field] } else { nil as JSONValue? }
        var admittedKeys: [String]?
        var admittedInput: SelectionRecord?
        var attempted = false
        var pendingPublished = false
        func admission() async throws -> (keys: [String], ids: [JSONValue], parameters: SelectionRecord, scope: MutationScope)? {
            guard let state = await mutationScope(windowID: windowID, source: source), state.metadata.authorizationSnapshot == actor,
                windowState(id: windowID) != nil, await dialogSignal.peek() == originalDialog
            else { return nil }
            var live = state
            if attempted, let field = spec.pendingField, live.windowForm[field] == .bool(true) { live.windowForm[field] = originalPending }
            let selected = state.snapshot(source)?.selection ?? SelectionState()
            let rows = selected.selection.isEmpty ? selected.selected.map { [$0] } ?? [] : selected.selection
            guard !rows.isEmpty, rows.count >= (policy?.min ?? 0), policy?.max.map({ $0 <= 0 || rows.count <= $0 }) ?? true,
                live.allows(operation.visibleWhen), !(operation.disabledWhen.map { live.allows($0) } ?? false),
                !(policy?.disabledWhen.map { live.allows($0) } ?? false)
            else { return nil }
            if let boundary {
                guard live.allows(boundary.visibleWhen) else { return nil }
                var grants: [SelectionRecord] = []
                if let ref = boundary.dataSourceRef, !ref.isEmpty {
                    guard metadata.dataSources[ref] != nil else { return nil }
                    grants = state.snapshot(ref)?.collection ?? []
                }
                guard WorkflowPrimitiveRuntime.permissionAllows(spec: boundary, authorization: actor, rows: rows, grants: grants) else {
                    return nil
                }
            }
            if let condition = policy?.every, !rows.allSatisfy({ live.allows(condition, row: $0) }) { return nil }
            if let condition = policy?.any, !rows.contains(where: { live.allows(condition, row: $0) }) { return nil }
            if let condition = policy?.none, rows.contains(where: { live.allows(condition, row: $0) }) { return nil }
            let ids = rows.map { resourceResolveValue(.object($0), path: spec.identityField) ?? .null }
            let keys = try ids.map(selectionKey)
            guard Set(keys).count == rows.count else { throw SelectionPreparationError("Select one or more distinct records.") }
            let parameters = state.resolvedParameters(operation.parameters ?? [], target: spec.dataSourceRef)
            guard admittedKeys == nil || keys == admittedKeys, admittedInput == nil || parameters == admittedInput else { return nil }
            return (keys, ids, parameters, live)
        }
        let result: MutationCommandResult
        do {
            guard let first = try await admission() else { return .init(accepted: false, status: "invalid") }
            admittedKeys = first.keys
            admittedInput = first.parameters
            var parameters = first.parameters
            guard parameters[spec.idsParameter] == nil else { throw SelectionPreparationError("The selected ID parameter is already bound.") }
            var scope: [String: String] = [:]
            for (field, name) in spec.scopeFields ?? [:] {
                let parameter = parameters[name]
                scope[field] = try selectionKey(parameter?.arrayValue?.count == 1 ? parameter?.arrayValue?.first : parameter)
            }
            parameters[spec.idsParameter] = .array(first.ids)
            var patch: SelectionRecord = [:]
            if let field = spec.errorField { patch[field] = .string("") }
            if let field = spec.pendingField {
                patch[field] = .bool(true)
                pendingPublished = true
            }
            if !patch.isEmpty { await setWindowFormValue(windowID: windowID, values: patch, bumpPrefillRevision: false) }
            attempted = true
            guard try await admission() != nil else { throw SupersededSelection() }
            let records = try await readPreparedSelection(
                windowID: windowID, metadata: metadata, ref: spec.dataSourceRef, parameters: parameters)
            guard let current = try await admission() else { throw SupersededSelection() }
            let ordered = try rowsInSelectionOrder(records, keys: first.keys, identity: spec.identityField, scope: scope)
            var props = try projectedCases(ordered, mappingRef: spec.mappingRef, draftRef: destination.resourceModelRef, metadata: metadata)
            props["rows"] = .array(ordered.map(JSONValue.object))
            props["parameters"] = .object(parameters)
            props["invocationId"] = .string(invocation.uuidString)
            guard let values = try current.scope.invoke(spec.prepare, props: props, selectionPreparation: true)?.objectValue else {
                throw SelectionPreparationError("Selection preparation must synchronously return a draft record.")
            }
            guard try await admission() != nil else { throw SupersededSelection() }
            let previous = await dataSourceForm(windowID: windowID, dataSourceRef: draft)
            await setDataSourceForm(windowID: windowID, dataSourceRef: draft, values: values)
            guard (try? await admission()) != nil,
                await openDialog(windowID: windowID, dialogID: dialogID, parameters: [:], expected: originalDialog) != nil
            else {
                if await dialogSignal.peek() == originalDialog {
                    await restorePreparedForm(windowID: windowID, draft: draft, submitted: values, previous: previous)
                }
                throw SupersededSelection()
            }
            result = .init(accepted: true, status: "opened", invocationId: invocation.uuidString)
        } catch {
            let current: Bool
            if error is SupersededSelection {
                current = false
            } else if attempted {
                current = (try? await admission()) != nil
            } else {
                let currentActor = await windowMetadata(id: windowID)?.authorizationSnapshot
                let presentation = await dialogSignal.peek()
                current = windowState(id: windowID) != nil && currentActor == actor && presentation == originalDialog
            }
            let cancelled = Task.isCancelled || error is CancellationError || isForgeCancellationError(error)
            if current, !cancelled, let field = spec.errorField {
                await setWindowFormValue(windowID: windowID, values: [field: .string(error.localizedDescription)], bumpPrefillRevision: false)
            }
            result = .init(
                accepted: attempted, status: !current && attempted ? "superseded" : cancelled ? "cancelled" : "failed",
                invocationId: invocation.uuidString,
                error: current || !attempted ? error.localizedDescription : nil)
        }
        if pendingPublished, let field = spec.pendingField, windowState(id: windowID) != nil,
            await windowFormJSONValue(windowID: windowID)[field] == .bool(true)
        {
            await setWindowFormValue(windowID: windowID, values: [field: .bool(false)], bumpPrefillRevision: false)
        }
        return result
    }
}

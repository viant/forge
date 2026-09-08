import Foundation

public enum MutationCommandPhase: String, Codable, Sendable {
    case idle
    case validating
    case confirming
    case pending
    case succeeded
    case failed
    case indeterminate
}

public enum MutationWriterStatus: String, Codable, Sendable {
    case idle
    case notInvoked = "not_invoked"
    case pending
    case succeeded
    case failed
    case indeterminate
}

public enum MutationSyncStatus: String, Codable, Sendable {
    case notStarted = "not_started"
    case succeeded
    case partialFailure = "partial_failure"
}

public struct MutationCommandWarning: Codable, Sendable, Equatable {
    public let stage: String
    public let dataSourceRef: String?
    public let message: String

    public init(stage: String, dataSourceRef: String? = nil, message: String) {
        self.stage = stage
        self.dataSourceRef = dataSourceRef
        self.message = message
    }
}

public struct MutationCommandState: Codable, Sendable, Equatable {
    public let phase: MutationCommandPhase
    public let guarded: Bool
    public let pending: Bool
    public let retryAllowed: Bool
    public let error: String?
    public let message: String
    public let invocationId: String
    public let writerStatus: MutationWriterStatus
    public let syncStatus: MutationSyncStatus
    public let warnings: [MutationCommandWarning]

    public init(
        phase: MutationCommandPhase = .idle,
        guarded: Bool = false,
        pending: Bool = false,
        retryAllowed: Bool = true,
        error: String? = nil,
        message: String = "",
        invocationId: String = "",
        writerStatus: MutationWriterStatus = .idle,
        syncStatus: MutationSyncStatus = .notStarted,
        warnings: [MutationCommandWarning] = []
    ) {
        self.phase = phase
        self.guarded = guarded
        self.pending = pending
        self.retryAllowed = retryAllowed
        self.error = error
        self.message = message
        self.invocationId = invocationId
        self.writerStatus = writerStatus
        self.syncStatus = syncStatus
        self.warnings = warnings
    }
}

public struct MutationCommandResult: Sendable, Equatable {
    public let accepted: Bool
    public let status: String
    public let invocationId: String
    public let error: String?
    public let warnings: [MutationCommandWarning]

    public init(accepted: Bool, status: String, invocationId: String = "", error: String? = nil, warnings: [MutationCommandWarning] = []) {
        self.accepted = accepted
        self.status = status
        self.invocationId = invocationId
        self.error = error
        self.warnings = warnings
    }
}

private enum MutationWriterOutcome: Sendable {
    case succeeded
    case failed(String)
    case indeterminate
}

private actor MutationWriterRace {
    private var outcome: MutationWriterOutcome?
    private var continuation: CheckedContinuation<MutationWriterOutcome, Never>?

    func wait() async -> MutationWriterOutcome {
        if let outcome { return outcome }
        return await withCheckedContinuation { continuation = $0 }
    }

    func resolve(_ next: MutationWriterOutcome) {
        guard outcome == nil else { return }
        outcome = next
        continuation?.resume(returning: next)
        continuation = nil
    }
}

extension ForgeRuntime {
    public func mutationCommandState(windowID: String, command: MutationCommandDef) -> MutationCommandState {
        mutationCommandStates[mutationCommandKey(windowID: windowID, command: command)] ?? MutationCommandState()
    }

    public func resolveIndeterminateMutationCommand(
        windowID: String,
        command: MutationCommandDef,
        message: String = ""
    ) -> Bool {
        let key = mutationCommandKey(windowID: windowID, command: command)
        guard mutationCommandStates[key]?.phase == .indeterminate else { return false }
        guardedMutationCommands.remove(key)
        guardedMutationTransports.remove(mutationTransportKey(windowID: windowID, dataSourceRef: command.dataSourceRef))
        mutationCommandStates[key] = MutationCommandState(message: message)
        return true
    }

    public func executeMutationCommand(
        windowID: String,
        sourceDataSourceRef: String,
        command: MutationCommandDef,
        extras: [String: JSONValue] = [:],
        confirm: (@Sendable (String) async -> Bool)? = nil
    ) async -> MutationCommandResult {
        let targetRef = command.dataSourceRef.trimmingCharacters(in: .whitespacesAndNewlines)
        let key = mutationCommandKey(windowID: windowID, command: command)
        guard !targetRef.isEmpty, !guardedMutationCommands.contains(key) else {
            return MutationCommandResult(accepted: false, status: "suppressed")
        }
        guardedMutationCommands.insert(key)
        publishMutationState(key, MutationCommandState(
            phase: .validating, guarded: true, retryAllowed: false,
            message: "Validating…", writerStatus: .notInvoked
        ))

        guard await mutationPredicateAllows(windowID: windowID, dataSourceRef: sourceDataSourceRef, condition: command.validateWhen) else {
            let message = command.invalidMessage ?? "This action is not currently valid."
            guardedMutationCommands.remove(key)
            await applyMutationWindowState(windowID: windowID, patch: command.errorState)
            publishMutationState(key, MutationCommandState(
                phase: .failed, error: message, message: message, writerStatus: .notInvoked
            ))
            return MutationCommandResult(accepted: false, status: "invalid", error: message)
        }

        let resolvedConfirmation = resolveMutationConfirmation(command: command, extras: extras)
        if !resolvedConfirmation.isEmpty {
            let confirmation = resolvedConfirmation
            guard let confirm else {
                let message = "Confirmation is required but no confirmation service is available."
                guardedMutationCommands.remove(key)
                publishMutationState(key, MutationCommandState(
                    phase: .failed, error: message, message: message, writerStatus: .notInvoked
                ))
                return MutationCommandResult(accepted: false, status: "confirmation_unavailable", error: message)
            }
            publishMutationState(key, MutationCommandState(
                phase: .confirming, guarded: true, retryAllowed: false,
                message: confirmation, writerStatus: .notInvoked
            ))
            guard await confirm(confirmation) else {
                guardedMutationCommands.remove(key)
                publishMutationState(key, MutationCommandState(writerStatus: .notInvoked))
                return MutationCommandResult(accepted: false, status: "cancelled")
            }
        }

        guard await mutationDataSourceExists(windowID: windowID, dataSourceRef: targetRef) else {
            let message = "Command datasource is unavailable: \(targetRef)"
            guardedMutationCommands.remove(key)
            publishMutationState(key, MutationCommandState(
                phase: .failed, error: message, message: message, writerStatus: .notInvoked
            ))
            return MutationCommandResult(accepted: false, status: "failed", error: message)
        }

        let transportKey = mutationTransportKey(windowID: windowID, dataSourceRef: targetRef)
        guard !guardedMutationTransports.contains(transportKey) else {
            guardedMutationCommands.remove(key)
            let message = "Another command is using this datasource."
            publishMutationState(key, MutationCommandState(message: message, writerStatus: .notInvoked))
            return MutationCommandResult(accepted: false, status: "transport_busy", error: message)
        }
        guardedMutationTransports.insert(transportKey)

        let invocationId = UUID().uuidString
        var parameters = await resolvedMutationParameters(
            windowID: windowID,
            sourceDataSourceRef: sourceDataSourceRef,
            targetDataSourceRef: targetRef,
            parameters: command.parameters
        )
        do {
            let prepared = try await preparedMutationPayload(
                windowID: windowID,
                sourceDataSourceRef: sourceDataSourceRef,
                payload: command.payload,
                extras: extras
            )
            parameters = deepMergeMutationValues(parameters, prepared)
        } catch {
            guardedMutationTransports.remove(transportKey)
            guardedMutationCommands.remove(key)
            let message = error.localizedDescription
            await applyMutationWindowState(windowID: windowID, patch: command.errorState)
            publishMutationState(key, MutationCommandState(phase: .failed, error: message, message: message, writerStatus: .notInvoked))
            return MutationCommandResult(accepted: false, status: "invalid_payload", error: message)
        }
        if let invocationParameter = command.invocationParameter?.trimmingCharacters(in: .whitespacesAndNewlines), !invocationParameter.isEmpty {
            parameters[invocationParameter] = .string(invocationId)
        }
        await applyMutationWindowState(windowID: windowID, patch: command.pendingState)
        publishMutationState(key, MutationCommandState(
            phase: .pending, guarded: true, pending: true, retryAllowed: false,
            message: "Saving…", invocationId: invocationId, writerStatus: .pending
        ))
        await setDataSourceInputParameters(windowID: windowID, dataSourceRef: targetRef, parameters: parameters)

        let writer = await awaitMutationWriter(
            windowID: windowID,
            dataSourceRef: targetRef,
            timeoutMs: max(1_000, command.timeoutMs ?? 30_000)
        )
        switch writer {
        case .failed(let error):
            guardedMutationTransports.remove(transportKey)
            guardedMutationCommands.remove(key)
            await applyMutationWindowState(windowID: windowID, patch: command.errorState)
            publishMutationState(key, MutationCommandState(
                phase: .failed, error: error, message: error,
                invocationId: invocationId, writerStatus: .failed
            ))
            return MutationCommandResult(accepted: true, status: "failed", invocationId: invocationId, error: error)
        case .indeterminate:
            let message = "The writer outcome is unknown because the client stopped waiting."
            await applyMutationWindowState(windowID: windowID, patch: command.indeterminateState)
            publishMutationState(key, MutationCommandState(
                phase: .indeterminate, guarded: true, retryAllowed: false,
                message: message, invocationId: invocationId, writerStatus: .indeterminate
            ))
            return MutationCommandResult(accepted: true, status: "indeterminate", invocationId: invocationId)
        case .succeeded:
            let warnings = await synchronizeMutationUI(windowID: windowID, targetDataSourceRef: targetRef, command: command)
            await applyMutationWindowState(windowID: windowID, patch: command.successState)
            guardedMutationTransports.remove(transportKey)
            guardedMutationCommands.remove(key)
            let syncStatus: MutationSyncStatus = warnings.isEmpty ? .succeeded : .partialFailure
            let message = warnings.isEmpty ? "Completed" : "Saved. Some related data could not be refreshed."
            publishMutationState(key, MutationCommandState(
                phase: .succeeded, message: message, invocationId: invocationId,
                writerStatus: .succeeded, syncStatus: syncStatus, warnings: warnings
            ))
            return MutationCommandResult(accepted: true, status: "succeeded", invocationId: invocationId, warnings: warnings)
        }
    }

    private func awaitMutationWriter(windowID: String, dataSourceRef: String, timeoutMs: Int) async -> MutationWriterOutcome {
        let race = MutationWriterRace()
        let writer = Task {
            await self.refreshDataSourceCollection(windowID: windowID, dataSourceRef: dataSourceRef)
            let control = await self.dataSourceControl(windowID: windowID, dataSourceRef: dataSourceRef)
            if let error = control.error, !error.isEmpty {
                await race.resolve(.failed(error))
            } else {
                await race.resolve(.succeeded)
            }
        }
        let timeout = Task {
            try? await Task.sleep(for: .milliseconds(timeoutMs))
            if !Task.isCancelled { await race.resolve(.indeterminate) }
        }
        let outcome = await race.wait()
        writer.cancel()
        timeout.cancel()
        return outcome
    }

    private func synchronizeMutationUI(windowID: String, targetDataSourceRef: String, command: MutationCommandDef) async -> [MutationCommandWarning] {
        var warnings: [MutationCommandWarning] = []
        if let reconcile = command.reconcile {
            do {
                let destinationRef = reconcile.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines)
                let ref = destinationRef?.isEmpty == false ? destinationRef! : targetDataSourceRef
                if reconcile.mode?.lowercased() == "refetch" {
                    await refreshDataSourceCollection(windowID: windowID, dataSourceRef: ref)
                    if let error = await dataSourceControl(windowID: windowID, dataSourceRef: ref).error {
                        throw MutationRuntimeError.message(error)
                    }
                } else {
                    let current = await dataSourceCollection(windowID: windowID, dataSourceRef: ref)
                    let writerRows = await dataSourceCollection(windowID: windowID, dataSourceRef: targetDataSourceRef)
                    let incoming = try mutationResultRows(writerRows, path: reconcile.resultPath ?? reconcile.rowsPath)
                    let reconciled = try reconcileMutationRows(current: current, incoming: incoming, spec: reconcile)
                    await setDataSourceCollection(windowID: windowID, dataSourceRef: ref, rows: reconciled)
                }
            } catch {
                warnings.append(MutationCommandWarning(stage: "reconcile", dataSourceRef: reconcile.dataSourceRef, message: error.localizedDescription))
            }
        }
        for refresh in command.refresh {
            if refresh.clearSelection {
                await setDataSourceSelection(windowID: windowID, dataSourceRef: refresh.dataSourceRef, selected: nil)
            }
            await refreshDataSourceCollection(windowID: windowID, dataSourceRef: refresh.dataSourceRef)
            if let error = await dataSourceControl(windowID: windowID, dataSourceRef: refresh.dataSourceRef).error, !error.isEmpty {
                warnings.append(MutationCommandWarning(stage: "refresh", dataSourceRef: refresh.dataSourceRef, message: error))
            }
        }
        return warnings
    }

    private func mutationPredicateAllows(windowID: String, dataSourceRef: String, condition: DashboardConditionDef?) async -> Bool {
        guard condition != nil else { return true }
        let form = await formJSONValue(windowID: windowID, dataSourceRef: dataSourceRef)
        let collection = await dataSourceCollection(windowID: windowID, dataSourceRef: dataSourceRef)
        let metrics = await dataSourceMetrics(windowID: windowID, dataSourceRef: dataSourceRef)
        let selection = await dataSourceSelectionState(windowID: windowID, dataSourceRef: dataSourceRef)
        let input = await dataSourceInputState(windowID: windowID, dataSourceRef: dataSourceRef)
        let windowForm = await windowFormJSONValue(windowID: windowID)
        return DashboardRuntime.evaluateDashboardCondition(
            condition,
            metrics: metrics.compactMapValues(\.anyValue),
            filters: input.filter.compactMapValues(\.anyValue),
            form: form.compactMapValues(\.anyValue),
            windowForm: windowForm.compactMapValues(\.anyValue),
            collection: collection.map { $0.compactMapValues(\.anyValue) },
            selectionValues: [
                "selected": selection.selected?.compactMapValues(\.anyValue) as Any,
                "selection": selection.selection.map { $0.compactMapValues(\.anyValue) },
                "rowIndex": selection.rowIndex
            ]
        )
    }

    private func resolvedMutationParameters(
        windowID: String,
        sourceDataSourceRef: String,
        targetDataSourceRef: String,
        parameters: [ParameterDef]
    ) async -> [String: JSONValue] {
        let windowMetadata = await windowMetadata(id: windowID)
        var snapshots: [String: ParameterResolver.DataSourceSnapshot] = [:]
        for ref in windowMetadata?.dataSources.keys ?? Dictionary<String, DataSourceDef>().keys {
            let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: ref)
            snapshots[ref] = ParameterResolver.DataSourceSnapshot(
                selectionMode: windowMetadata?.dataSources[ref]?.selectionMode,
                form: await dataSourceRuntime.form(dataSourceID: dataSourceID),
                metrics: await dataSourceRuntime.metrics(dataSourceID: dataSourceID),
                selection: await dataSourceRuntime.selection(dataSourceID: dataSourceID),
                input: await dataSourceRuntime.input(dataSourceID: dataSourceID)
            )
        }
        let resolved = ParameterResolver.resolve(
            parameters: parameters,
            context: ParameterResolver.ResolutionContext(
                identityDataSourceRef: sourceDataSourceRef,
                dataSources: snapshots,
                windowForm: await windowFormJSONValue(windowID: windowID),
                metadata: windowMetadata
            )
        )
        let scoped = resolved[targetDataSourceRef]?.objectValue ?? resolved
        if let input = scoped["input"]?.objectValue,
           let values = input["parameters"]?.objectValue { return values }
        if let values = scoped["parameters"]?.objectValue { return values }
        return scoped
    }

    private func preparedMutationPayload(windowID: String, sourceDataSourceRef: String, payload: ResourcePayloadPreparationDef?, extras: [String: JSONValue]) async throws -> [String: JSONValue] {
        guard let payload else { return extras }
        guard let metadata = await windowMetadata(id: windowID) else { throw MutationRuntimeError.message("Window metadata is unavailable") }
        var snapshots: [String: ResourceDataSnapshot] = [:]
        for ref in metadata.dataSources.keys {
            let id = WindowIdentity(windowID: windowID).dataSourceID(ref: ref)
            snapshots[ref] = ResourceDataSnapshot(
                form: await dataSourceRuntime.form(dataSourceID: id),
                collection: await dataSourceRuntime.collection(dataSourceID: id),
                selection: await dataSourceRuntime.selection(dataSourceID: id),
                metrics: await dataSourceRuntime.metrics(dataSourceID: id),
                input: await dataSourceRuntime.input(dataSourceID: id)
            )
        }
        let code = metadata.actions?.code?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let hook: ResourceModelHook?
        if code.isEmpty {
            hook = nil
        } else {
            hook = { (name: String, value: JSONValue) throws -> JSONValue? in
                try ActionHookRuntime.invoke(code: code, functionName: name, props: value) ?? value
            }
        }
        return try ResourceModelRuntime.prepare(
            payload: payload,
            environment: ResourceValueEnvironment(
                identityDataSourceRef: sourceDataSourceRef,
                dataSources: snapshots,
                windowForm: await windowFormJSONValue(windowID: windowID),
                extras: extras
            ),
            schemas: metadata.schemas,
            models: metadata.resourceModels,
            hook: hook
        )
    }

    private func mutationDataSourceExists(windowID: String, dataSourceRef: String) async -> Bool {
        await windowMetadata(id: windowID)?.dataSources[dataSourceRef] != nil
    }

    private func applyMutationWindowState(windowID: String, patch: [String: JSONValue]) async {
        guard !patch.isEmpty else { return }
        await setWindowFormValue(windowID: windowID, values: patch, bumpPrefillRevision: false)
    }

    private func publishMutationState(_ key: String, _ state: MutationCommandState) {
        mutationCommandStates[key] = state
    }
}

public func resolveMutationConfirmation(command: MutationCommandDef, extras: [String: JSONValue]) -> String {
    guard let spec = command.confirmSelection,
          let values = extras["selectedRows"]?.arrayValue else {
        return command.confirm ?? ""
    }
    let rows = values.compactMap(\.objectValue)
    guard !rows.isEmpty else { return command.confirm ?? "" }
    let count = rows.count
    let maxItems = min(20, max(1, spec.maxItems ?? 5))
    let labelField = spec.labelField ?? "name"
    let identityField = spec.identityField ?? "id"
    var items = rows.prefix(maxItems).map { row -> String in
        let label = resolveMutationSelectionValue(row, selector: labelField)
        let identity = resolveMutationSelectionValue(row, selector: identityField)
        if !label.isEmpty && !identity.isEmpty { return "\(label) (\(identity))" }
        if !label.isEmpty { return label }
        if !identity.isEmpty { return identity }
        return "Unnamed item"
    }
    if count > maxItems { items.append("+\(count - maxItems) more") }
    let action = spec.action?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? spec.action!.trimmingCharacters(in: .whitespacesAndNewlines) : "Confirm"
    let singular = spec.singularLabel?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? spec.singularLabel! : "item"
    let entity = count == 1 ? singular : (spec.pluralLabel?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? spec.pluralLabel! : "\(singular)s")
    let suffix = spec.suffix?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return "\(action) \(count) \(entity): \(items.joined(separator: ", "))?\(suffix.isEmpty ? "" : " \(suffix)")"
}

private func resolveMutationSelectionValue(_ row: [String: JSONValue], selector: String) -> String {
    guard let value = JSONValue(any: SelectorUtil.resolve(row.compactMapValues(\.anyValue), selector: selector)) else { return "" }
    switch value {
    case .string(let value): return value.trimmingCharacters(in: .whitespacesAndNewlines)
    case .number(let value): return value.rounded() == value ? String(Int(value)) : String(value)
    case .bool(let value): return value ? "true" : "false"
    default: return ""
    }
}

private enum MutationRuntimeError: LocalizedError {
    case message(String)
    var errorDescription: String? {
        switch self { case .message(let message): return message }
    }
}

private func mutationCommandKey(windowID: String, command: MutationCommandDef) -> String {
    let id = command.commandId?.trimmingCharacters(in: .whitespacesAndNewlines)
    return "\(windowID)::\((id?.isEmpty == false ? id! : command.dataSourceRef))"
}

private func mutationTransportKey(windowID: String, dataSourceRef: String) -> String {
    "\(windowID)::\(dataSourceRef)"
}

private func deepMergeMutationValues(_ base: [String: JSONValue], _ override: [String: JSONValue]) -> [String: JSONValue] {
    var result = base
    for (key, value) in override {
        if case .object(let left)? = result[key], case .object(let right) = value {
            result[key] = .object(deepMergeMutationValues(left, right))
        } else {
            result[key] = value
        }
    }
    return result
}

private func mutationResultRows(_ rows: [[String: JSONValue]], path: String?) throws -> [[String: JSONValue]] {
    guard let path = path?.trimmingCharacters(in: .whitespacesAndNewlines), !path.isEmpty else { return rows }
    let holder: [String: Any] = ["rows": rows.map { $0.compactMapValues(\.anyValue) }]
    let selected = SelectorUtil.resolve(holder, selector: path)
    if let result = selected as? [[String: Any]] {
        return result.map { $0.compactMapValues(JSONValue.init(any:)) }
    }
    if let result = selected as? [String: Any] {
        return [result.compactMapValues(JSONValue.init(any:))]
    }
    throw MutationRuntimeError.message("Reconciliation result path did not resolve to rows: \(path)")
}

private func reconcileMutationRows(current: [[String: JSONValue]], incoming: [[String: JSONValue]], spec: ReconcileSpec) throws -> [[String: JSONValue]] {
    let mode = spec.mode?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? "merge"
    if mode == "replace" { return incoming }
    guard mode == "merge" || mode == "remove" else {
        throw MutationRuntimeError.message("Unsupported reconciliation mode: \(mode)")
    }
    let identities = spec.identityFields.isEmpty ? [spec.identityField ?? "id"] : spec.identityFields
    func key(_ row: [String: JSONValue]) throws -> String {
        try identities.map { field in
            guard let value = row[field], value != .null else {
                throw MutationRuntimeError.message("Reconciliation row is missing identity field: \(field)")
            }
            if case .string(let text) = value, text.isEmpty {
                throw MutationRuntimeError.message("Reconciliation row is missing identity field: \(field)")
            }
            return value.stringValue ?? String(describing: value.anyValue ?? "")
        }.joined(separator: "\u{001f}")
    }
    let incomingKeys = try Set(incoming.map(key))
    if mode == "remove" { return try current.filter { !incomingKeys.contains(try key($0)) } }
    var result = current
    var indexes: [String: Int] = [:]
    for (index, row) in current.enumerated() { indexes[try key(row)] = index }
    for row in incoming {
        let identity = try key(row)
        if let index = indexes[identity] {
            result[index] = deepMergeMutationValues(result[index], row)
        } else {
            indexes[identity] = result.count
            result.append(row)
        }
    }
    return result
}

import Foundation

public struct ResourceDataSnapshot: Sendable {
    public let form: [String: JSONValue]
    public let collection: [[String: JSONValue]]
    public let selection: SelectionState
    public let metrics: [String: JSONValue]
    public let input: InputState

    public init(form: [String: JSONValue] = [:], collection: [[String: JSONValue]] = [], selection: SelectionState = SelectionState(), metrics: [String: JSONValue] = [:], input: InputState = InputState()) {
        self.form = form; self.collection = collection; self.selection = selection; self.metrics = metrics; self.input = input
    }
}

public struct ResourceValueEnvironment: Sendable {
    var lookup: (@Sendable (String) -> ResourceDataSnapshot?)?
    public let identityDataSourceRef: String
    public let dataSources: [String: ResourceDataSnapshot]
    public let windowForm: [String: JSONValue]
    public let extras: [String: JSONValue]

    public init(identityDataSourceRef: String, dataSources: [String: ResourceDataSnapshot], windowForm: [String: JSONValue] = [:], extras: [String: JSONValue] = [:]) {
        self.identityDataSourceRef = identityDataSourceRef; self.dataSources = dataSources; self.windowForm = windowForm; self.extras = extras
    }
}

public typealias ResourceModelHook = @Sendable (_ name: String, _ value: JSONValue) throws -> JSONValue?

typealias ScopedResourceModelHook = @Sendable (_ name: String, _ phase: String, _ modelRef: String, _ value: JSONValue, _ baseline: JSONValue?) throws -> JSONValue

public enum ResourceModelRuntime {
    public static func mappedCase(_ name: String, row: [String: JSONValue], metadata: WindowMetadata) throws -> ResourceMappingCase {
        try indexedMappedCase(name, row: row, metadata: metadata).1
    }

    static func indexedMappedCase(_ name: String, row: [String: JSONValue], metadata: WindowMetadata) throws -> (String?, ResourceMappingCase) {
        guard let mapping = metadata.resourceMappings?[name] else { throw ResourceModelError.message("Unknown resource mapping: \(name)") }
        let key = mapping.selectors.lazy.compactMap { SelectorUtil.resolve(JSONValue.object(row), selector: $0) as? String }.first { !$0.isEmpty }
        guard let entry = key.flatMap({ mapping.cases[$0] }) ?? mapping.default else { throw ResourceModelError.message("No matching case for resource mapping: \(name)") }
        guard let model = metadata.resourceModels[entry.modelRef], metadata.schemas[model.schemaRef] != nil else { throw ResourceModelError.message("Invalid resource mapping model: \(entry.modelRef)") }
        return (key.flatMap { mapping.cases[$0] == nil ? nil : $0 }, entry)
    }

    public static func unmarshal(value: JSONValue, modelRef: String, schemas: [String: ResourceSchemaDef], models: [String: ResourceModelDef], hook: ResourceModelHook? = nil) throws -> JSONValue {
        guard let model = models[modelRef] else { throw ResourceModelError.message("Unknown resource model: \(modelRef)") }
        let prepared = try applyResourceHook(model.hooks?.beforeUnmarshal, value: value, hook: hook)
        let decoded: JSONValue
        if case .array(let values) = prepared {
            decoded = .array(try values.map { try unmarshalObject(value: $0, model: model, schemas: schemas, models: models, hook: hook) })
        } else {
            decoded = try unmarshalObject(value: prepared, model: model, schemas: schemas, models: models, hook: hook)
        }
        return try applyResourceHook(model.hooks?.afterUnmarshal, value: decoded, hook: hook)
    }

    public static func marshal(draft: JSONValue, baseline: JSONValue?, modelRef: String, mode requestedMode: String? = nil, target requestedTarget: String? = nil, schemas: [String: ResourceSchemaDef], models: [String: ResourceModelDef], hook: ResourceModelHook? = nil) throws -> [String: JSONValue] {
        try marshal(draft: draft, baseline: baseline, modelRef: modelRef, mode: requestedMode, target: requestedTarget, schemas: schemas, models: models, hook: hook, scoped: nil)
    }

    static func marshal(draft: JSONValue, baseline: JSONValue?, modelRef: String, mode requestedMode: String? = nil, target requestedTarget: String? = nil, schemas: [String: ResourceSchemaDef], models: [String: ResourceModelDef], hook: ResourceModelHook? = nil, scoped: ScopedResourceModelHook?) throws -> [String: JSONValue] {
        guard let model = models[modelRef], let write = model.write else { throw ResourceModelError.message("Resource model \(modelRef) requires a write binding") }
        let mode = normalizeResourceMode(requestedMode ?? write.mode ?? "changed")
        let associationModels = associationCollectionModels(from: modelRef, models: models)
        let associationFields = model.fields.filter { $0.value.associationDelta != nil }.keys
        var overlayBase = baseline ?? .object([:])
        if !associationFields.isEmpty {
            guard draft.objectValue != nil else { throw ResourceModelError.message("Association delta requires one canonical resource object") }
            if let object = overlayBase.objectValue {
                overlayBase = .object(object.filter { !associationFields.contains($0.key) })
            }
        }
        var preparedBaseline = baseline
        if let scoped, mode == "changed", let baseline, let name = model.hooks?.beforeMarshal, !name.isEmpty {
            preparedBaseline = try scoped(name, "beforeMarshalBaseline", modelRef, baseline, baseline)
        }
        var canonical = mode == "overlaybaseline" ? overlayResource(base: overlayBase, patch: draft) : draft
        canonical = try writeHook(model.hooks?.beforeMarshal, "beforeMarshal", modelRef, canonical, preparedBaseline, hook, scoped)
        try validate(value: canonical, schemaRef: model.schemaRef, schemas: schemas)
        if associationFields.isEmpty || baseline != nil {
            try validateImmutableIdentity(draft: canonical, baseline: baseline, schema: schemas[model.schemaRef])
        }
        var wire = try marshalValue(canonical, baseline: preparedBaseline, model: model, mode: mode, schemas: schemas, models: models, associationModels: associationModels, hook: hook, scoped: scoped)
        wire = try writeHook(model.hooks?.afterMarshal, "afterMarshal", modelRef, wire, preparedBaseline, hook, scoped)
        let target = requestedTarget?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? requestedTarget! : (write.inputPath ?? "")
        if target == "$" || target.isEmpty {
            guard let object = wire.objectValue else { throw ResourceModelError.message("Root resource payload must be an object") }
            return object
        }
        var result: [String: JSONValue] = [:]
        let payload = (scoped != nil || !associationFields.isEmpty) && write.collection == true ? JSONValue.array([wire]) : wire
        setResourcePath(&result, path: target, value: payload)
        return result
    }

    public static func prepare(payload: ResourcePayloadPreparationDef, environment: ResourceValueEnvironment, schemas: [String: ResourceSchemaDef], models: [String: ResourceModelDef], hook: ResourceModelHook? = nil) throws -> [String: JSONValue] {
        try prepare(payload: payload, environment: environment, schemas: schemas, models: models, hook: hook, scoped: nil)
    }

    static func prepare(payload: ResourcePayloadPreparationDef, environment: ResourceValueEnvironment, schemas: [String: ResourceSchemaDef], models: [String: ResourceModelDef], hook: ResourceModelHook? = nil, scoped: ScopedResourceModelHook?) throws -> [String: JSONValue] {
        let draft: JSONValue
        if let fields = payload.fields, !fields.isEmpty {
            var object: [String: JSONValue] = [:]
            for (path, source) in fields {
                if let value = try resolve(source: source, environment: environment) { setResourcePath(&object, path: path, value: value) }
            }
            draft = .object(object)
        } else if let source = payload.source {
            draft = try resolve(source: source, environment: environment) ?? .object([:])
        } else {
            draft = .object(environment.extras)
        }
        let baseline = try payload.baseline.flatMap { try resolve(source: $0, environment: environment) }
        return try marshal(draft: draft, baseline: baseline, modelRef: payload.modelRef, mode: payload.mode, target: payload.target, schemas: schemas, models: models, hook: hook, scoped: scoped)
    }

    public static func validate(value: JSONValue, schemaRef: String, schemas: [String: ResourceSchemaDef]) throws {
        guard let schema = schemas[schemaRef] else { throw ResourceModelError.message("Unknown resource schema: \(schemaRef)") }
        try validateObject(value, schema: schema, schemas: schemas, path: "$" )
    }

    private static func unmarshalObject(value: JSONValue, model: ResourceModelDef, schemas: [String: ResourceSchemaDef], models: [String: ResourceModelDef], hook: ResourceModelHook?) throws -> JSONValue {
        guard let input = value.objectValue else { throw ResourceModelError.message("Resource reader value must be an object") }
        var output = model.read?.preserveUnbound == true ? input : [:]
        for (field, binding) in model.fields {
            if binding.associationDelta?.mode == "explicit" { output.removeValue(forKey: field); continue }
            let raw = resourceResolve(input, path: binding.read ?? field) ?? binding.defaultValue
            guard let raw else { continue }
            output[field] = try transformRead(raw, binding: binding, schemas: schemas, models: models, hook: hook)
        }
        try validate(value: .object(output), schemaRef: model.schemaRef, schemas: schemas)
        return .object(output)
    }

    private static func transformRead(_ value: JSONValue, binding: ResourceFieldBindingDef, schemas: [String: ResourceSchemaDef], models: [String: ResourceModelDef], hook: ResourceModelHook?) throws -> JSONValue {
        if let modelRef = binding.modelRef { return try unmarshal(value: value, modelRef: modelRef, schemas: schemas, models: models, hook: hook) }
        if let collection = binding.collection, let modelRef = collection.modelRef, case .array(let values) = value {
            return .array(try values.map { try unmarshal(value: $0, modelRef: modelRef, schemas: schemas, models: models, hook: hook) })
        }
        return try applyResourceCodec(value, codec: binding.codec, trim: binding.trim == true, empty: binding.empty)
    }

    private static func marshalValue(_ value: JSONValue, baseline: JSONValue?, model: ResourceModelDef, mode: String, schemas: [String: ResourceSchemaDef], models: [String: ResourceModelDef], associationModels: Set<String>, hook: ResourceModelHook?, scoped: ScopedResourceModelHook?) throws -> JSONValue {
        if case .array(let values) = value {
            let baselineValues = baseline?.arrayValue ?? []
            return .array(try values.enumerated().map { index, item in try marshalValue(item, baseline: baselineValues.indices.contains(index) ? baselineValues[index] : nil, model: model, mode: mode, schemas: schemas, models: models, associationModels: associationModels, hook: hook, scoped: scoped) })
        }
        guard let object = value.objectValue else { throw ResourceModelError.message("Canonical resource must be an object") }
        let baselineObject = baseline?.objectValue ?? [:]
        let schema = schemas[model.schemaRef]
        var output: [String: JSONValue] = [:]
        for (field, binding) in model.fields {
            if let delta = binding.associationDelta {
                if let current = object[field] {
                    guard let fieldSchema = schema?.properties[field] else { throw ResourceModelError.message("Missing association schema for \(field)") }
                    try validateImmutableIdentity(draft: value, baseline: baseline, schema: schema)
                    try projectAssociationDelta(current, prior: baselineObject, field: field, schema: fieldSchema, delta: delta, output: &output)
                }
                continue
            }
            guard binding.write != "-" else { continue }
            let current = object[field] ?? binding.defaultValue
            let previous = baselineObject[field]
            let identity = schema?.identity.contains(field) == true
            let include = mode != "changed" || identity || binding.alwaysWrite == true || (binding.omitIfUnchanged != true && current != previous)
            guard include, let current else { continue }
            if binding.empty?.lowercased() == "omit", current == .null || current == .string("") { continue }
            let transformed: JSONValue
            if let modelRef = binding.modelRef, let nested = models[modelRef] {
                let prepared = try writeHook(nested.hooks?.beforeMarshal, "beforeMarshal", modelRef, current, previous, hook, scoped)
                transformed = try writeHook(nested.hooks?.afterMarshal, "afterMarshal", modelRef, marshalValue(prepared, baseline: previous, model: nested, mode: mode, schemas: schemas, models: models, associationModels: associationModels, hook: hook, scoped: scoped), previous, hook, scoped)
            } else if let collection = binding.collection, let modelRef = collection.modelRef, let nested = models[modelRef] {
                let pairByIdentity = associationModels.contains(modelRef)
                let associationFields = pairByIdentity ? Set(nested.fields.filter { $0.value.associationDelta != nil }.keys) : []
                let merged = try mergeResourceCollection(draft: current, baseline: previous, binding: collection, nestedSchema: schemas[nested.schemaRef], associationFields: associationFields, pairByIdentity: pairByIdentity)
                if let marker = collection.deleteMarker {
                    let identities = collection.identity?.isEmpty == false ? collection.identity! : (schemas[nested.schemaRef]?.identity ?? [])
                    guard let markerSchema = schemas[nested.schemaRef]?.properties[marker], markerSchema.type == "boolean", !markerSchema.readOnly, markerSchema.defaultValue == nil,
                          nested.fields[marker]?.defaultValue == nil, nested.fields[marker]?.write != "-" else {
                        throw ResourceModelError.message("Collection deleteMarker must be a writable boolean")
                    }
                    var rows: [JSONValue] = []
                    for (row, prior) in merged {
                        let markerValue = row.objectValue?[marker]
                        if let markerValue {
                            guard case .bool = markerValue else {
                                throw ResourceModelError.message("Collection removal requires an explicit boolean marker")
                            }
                        }
                        if markerValue == .bool(true) {
                            var removed: [String: JSONValue] = [:]
                            for identity in identities {
                                guard let value = row.objectValue?[identity], persistedResourceIdentity(value),
                                      identity != marker, nested.fields[identity]?.write != "-" else {
                                    throw ResourceModelError.message("Collection removal requires a writable persisted identity")
                                }
                                let binding = nested.fields[identity]
                                setResourcePath(&removed, path: binding?.write ?? identity, value: try applyResourceCodec(
                                    value, codec: binding?.codec, trim: binding?.trim == true, empty: binding?.empty))
                            }
                            setResourcePath(&removed, path: nested.fields[marker]?.write ?? marker, value: .bool(true))
                            rows.append(.object(removed))
                            continue
                        }
                        if mode == "changed", let prior {
                            let comparison: JSONValue
                            if !associationFields.isEmpty, let object = prior.objectValue {
                                comparison = .object(object.filter { !associationFields.contains($0.key) || row.objectValue?[$0.key] != nil })
                            } else {
                                comparison = prior
                            }
                            if row == comparison { continue }
                        }
                        let prepared = try writeHook(nested.hooks?.beforeMarshal, "beforeMarshal", modelRef, row, prior, hook, scoped)
                        let wire = try marshalValue(prepared, baseline: prior, model: nested, mode: mode == "changed" ? "overlaybaseline" : mode, schemas: schemas, models: models, associationModels: associationModels, hook: hook, scoped: scoped)
                        rows.append(try writeHook(nested.hooks?.afterMarshal, "afterMarshal", modelRef, wire, prior, hook, scoped))
                    }
                    if mode == "changed", rows.isEmpty { continue }
                    transformed = .array(rows)
                } else {
                    let draftRows = JSONValue.array(merged.map { $0.0 })
                    let prepared = try writeHook(nested.hooks?.beforeMarshal, "beforeMarshal", modelRef, draftRows, previous, hook, scoped)
                    if pairByIdentity, prepared != draftRows {
                        throw ResourceModelError.message("Collection hooks cannot replace association draft rows before identity pairing")
                    }
                    let priorRows = pairByIdentity ? JSONValue.array(merged.map { $0.1 ?? .null }) : previous
                    transformed = try writeHook(nested.hooks?.afterMarshal, "afterMarshal", modelRef, marshalValue(prepared, baseline: priorRows, model: nested, mode: mode, schemas: schemas, models: models, associationModels: associationModels, hook: hook, scoped: scoped), priorRows, hook, scoped)
                }
            } else {
                transformed = try applyResourceCodec(current, codec: binding.codec, trim: binding.trim == true, empty: binding.empty)
            }
            if transformed == .null && binding.empty?.lowercased() == "omit" { continue }
            setResourcePath(&output, path: binding.write ?? field, value: transformed)
        }
        return .object(output)
    }

    private static func associationCollectionModels(from root: String, models: [String: ResourceModelDef]) -> Set<String> {
        var reachable: Set<String> = []
        var pending = [root]
        var parents: [String: Set<String>] = [:]
        var affected: Set<String> = []
        while let ref = pending.popLast() {
            guard reachable.insert(ref).inserted, let model = models[ref] else { continue }
            for binding in model.fields.values {
                if binding.associationDelta != nil { affected.insert(ref) }
                if let child = binding.modelRef ?? binding.collection?.modelRef {
                    parents[child, default: []].insert(ref)
                    pending.append(child)
                }
            }
        }
        pending = Array(affected)
        while let child = pending.popLast() {
            for parent in parents[child] ?? [] where affected.insert(parent).inserted { pending.append(parent) }
        }
        return affected
    }

    private static func projectAssociationDelta(_ current: JSONValue, prior: [String: JSONValue], field: String, schema: ResourceFieldSchemaDef, delta: ResourceAssociationDeltaBindingDef, output: inout [String: JSONValue]) throws {
        // JSONValue is not Hashable. Use the exact typed ID as the membership key,
        // preserving the first occurrence of each ID on each source list.
        func ids(_ value: JSONValue?, type: String?, path: String) throws -> [(key: [UInt8], value: JSONValue)] {
            guard let values = value?.arrayValue else { throw ResourceModelError.message("\(path) must be an ID array") }
            var seen = Set<[UInt8]>()
            return try values.compactMap { id in
                let key: [UInt8]
                switch (type, id) {
                case ("string", .string(let item)): key = Array(item.utf8)
                case ("integer", .number(let item)) where item.rounded(.towardZero) == item && abs(item) < 9_007_199_254_740_992:
                    key = Array(String(Int64(item)).utf8)
                default: throw ResourceModelError.message("\(path) contains an invalid association ID")
                }
                return seen.insert(key).inserted ? (key, id) : nil
            }
        }
        let additions: [JSONValue]
        let removals: [JSONValue]
        switch delta.mode {
        case "diff":
            guard let marker = delta.baselineComplete, resourceResolve(prior, path: marker) == .bool(true) else {
                throw ResourceModelError.message("\(field) requires a complete association baseline")
            }
            let before = try ids(prior[field], type: schema.items?.type, path: "\(field).baseline")
            let after = try ids(current, type: schema.items?.type, path: field)
            let beforeKeys = Set(before.map(\.key))
            let afterKeys = Set(after.map(\.key))
            additions = after.filter { !beforeKeys.contains($0.key) }.map(\.value)
            removals = before.filter { !afterKeys.contains($0.key) }.map(\.value)
        case "explicit":
            guard let intent = current.objectValue, intent.keys.allSatisfy({ $0 == "added" || $0 == "deleted" }) else {
                throw ResourceModelError.message("\(field) must contain explicit added or deleted ID lists")
            }
            let added = try ids(intent["added"] ?? .array([]), type: schema.properties["added"]?.items?.type, path: "\(field).added")
            let deleted = try ids(intent["deleted"] ?? .array([]), type: schema.properties["deleted"]?.items?.type, path: "\(field).deleted")
            let addedKeys = Set(added.map(\.key))
            guard !deleted.contains(where: { addedKeys.contains($0.key) }) else { throw ResourceModelError.message("\(field) cannot add and delete the same ID") }
            additions = added.map(\.value)
            removals = deleted.map(\.value)
        default: throw ResourceModelError.message("Unknown association delta mode: \(delta.mode)")
        }
        if !additions.isEmpty { setResourcePath(&output, path: delta.added, value: .array(additions)) }
        if !removals.isEmpty { setResourcePath(&output, path: delta.deleted, value: .array(removals)) }
    }

    private static func resolve(source: ResourceValueSourceDef, environment: ResourceValueEnvironment) throws -> JSONValue? {
        let scope = source.scope?.lowercased() ?? "extras"
        let ref = source.dataSourceRef ?? environment.identityDataSourceRef
        let snapshot = environment.lookup?(ref) ?? environment.dataSources[ref] ?? ResourceDataSnapshot()
        var value: JSONValue?
        switch scope {
        case "constant": value = source.value
        case "extras": value = .object(environment.extras)
        case "form": value = .object(snapshot.form)
        case "collection": value = .array(snapshot.collection.map(JSONValue.object))
        case "selection": value = snapshot.selection.selection.isEmpty ? snapshot.selection.selected.map(JSONValue.object) : .array(snapshot.selection.selection.map(JSONValue.object))
        case "metrics": value = .object(snapshot.metrics)
        case "input": value = .object(["filter": .object(snapshot.input.filter), "parameters": .object(snapshot.input.parameters)])
        case "windowform": value = .object(environment.windowForm)
        default: throw ResourceModelError.message("Unsupported resource value scope: \(scope)")
        }
        if let selector = source.selector, !selector.isEmpty { value = value.flatMap { resourceResolveValue($0, path: selector) } }
        if let filter = source.where, case .array(let values)? = value { value = .array(values.filter { resourceFilterMatches($0, filter: filter) }) }
        if let selector = source.mapSelector, case .array(let values)? = value { value = .array(values.compactMap { resourceResolveValue($0, path: selector) }) }
        if let value, let codec = source.codec { return try applyResourceCodec(value, codec: codec, trim: false, empty: nil) }
        return value
    }
}

extension ForgeRuntime {
    func unmarshalResourceRows(_ rows: [[String: JSONValue]], dataSource: DataSourceDef, metadata: WindowMetadata) throws -> [[String: JSONValue]] {
        guard let modelRef = dataSource.resourceModelRef else { return rows }
        let code = metadata.actions?.code?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let hook: ResourceModelHook?
        if code.isEmpty {
            hook = nil
        } else {
            hook = { (name: String, value: JSONValue) throws -> JSONValue? in
                try ActionHookRuntime.invoke(code: code, functionName: name, props: value) ?? value
            }
        }
        return try rows.map { row in
            guard let object = try ResourceModelRuntime.unmarshal(value: .object(row), modelRef: modelRef, schemas: metadata.schemas, models: metadata.resourceModels, hook: hook).objectValue else {
                throw ResourceModelError.message("Resource model \(modelRef) did not produce an object")
            }
            return object
        }
    }
}

private func writeHook(_ name: String?, _ phase: String, _ modelRef: String, _ value: JSONValue, _ baseline: JSONValue?, _ legacy: ResourceModelHook?, _ scoped: ScopedResourceModelHook?) throws -> JSONValue {
    guard let name, !name.isEmpty else { return value }
    if let scoped { return try scoped(name, phase, modelRef, value, baseline) }
    return try applyResourceHook(name, value: value, hook: legacy)
}

private func applyResourceHook(_ name: String?, value: JSONValue, hook: ResourceModelHook?) throws -> JSONValue {
    guard let name = name?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty, let hook else { return value }
    return try hook(name, value) ?? value
}

private enum ResourceModelError: LocalizedError { case message(String); var errorDescription: String? { if case .message(let value) = self { return value }; return nil } }

private func normalizeResourceMode(_ value: String) -> String { value.lowercased().replacingOccurrences(of: "-", with: "").replacingOccurrences(of: "_", with: "") }
private func overlayResource(base: JSONValue, patch: JSONValue) -> JSONValue {
    guard let left = base.objectValue, let right = patch.objectValue else { return patch }
    var result = left
    for (key, value) in right { result[key] = result[key].map { overlayResource(base: $0, patch: value) } ?? value }
    return .object(result)
}

private func validateImmutableIdentity(draft: JSONValue, baseline: JSONValue?, schema: ResourceSchemaDef?) throws {
    guard let schema, let draft = draft.objectValue, let baseline = baseline?.objectValue else { return }
    for field in schema.identity where draft[field] != nil && draft[field] != baseline[field] { throw ResourceModelError.message("Resource identity field is immutable: \(field)") }
}

private func validateObject(_ value: JSONValue, schema: ResourceSchemaDef, schemas: [String: ResourceSchemaDef], path: String) throws {
    guard let object = value.objectValue else { throw ResourceModelError.message("\(path) must be an object") }
    for required in schema.required where object[required] == nil || object[required] == .null { throw ResourceModelError.message("\(path).\(required) is required") }
    if schema.additionalProperties == false {
        for key in object.keys where schema.properties[key] == nil { throw ResourceModelError.message("\(path).\(key) is not declared") }
    }
    for (field, fieldSchema) in schema.properties where object[field] != nil { try validateField(object[field]!, schema: fieldSchema, schemas: schemas, path: "\(path).\(field)") }
    for rule in schema.invariants ?? [] where rule.when?.allows(value) != false {
        if !rule.assertion.allows(value) {
            let base = path.replacingOccurrences(of: #"\[([0-9]+)\]"#, with: ".$1", options: .regularExpression)
            let target = rule.path.map { $0.isEmpty ? base : "\(base).\($0)" } ?? base
            throw ResourceModelError.message("\(target): \(rule.message)")
        }
    }
}

private func validateField(_ value: JSONValue, schema: ResourceFieldSchemaDef, schemas: [String: ResourceSchemaDef], path: String) throws {
    if value == .null { if !schema.nullable { throw ResourceModelError.message("\(path) cannot be null") }; return }
    if let ref = schema.ref, let target = schemas[ref] { try validateObject(value, schema: target, schemas: schemas, path: path); return }
    switch schema.type?.lowercased() {
    case "string": guard case .string(let text) = value else { throw ResourceModelError.message("\(path) must be a string") }; if let min = schema.minLength, text.count < min { throw ResourceModelError.message("\(path) is too short") }; if let max = schema.maxLength, text.count > max { throw ResourceModelError.message("\(path) is too long") }
    case "integer": guard case .number(let number) = value, number.rounded() == number else { throw ResourceModelError.message("\(path) must be an integer") }
    case "number": guard case .number = value else { throw ResourceModelError.message("\(path) must be a number") }
    case "boolean": guard case .bool = value else { throw ResourceModelError.message("\(path) must be a boolean") }
    case "array": guard case .array(let values) = value else { throw ResourceModelError.message("\(path) must be an array") }; if let min = schema.minItems, values.count < min { throw ResourceModelError.message("\(path) has too few items") }; if let max = schema.maxItems, values.count > max { throw ResourceModelError.message("\(path) has too many items") }; if let itemSchema = schema.items { for (index, item) in values.enumerated() { try validateField(item, schema: itemSchema, schemas: schemas, path: "\(path)[\(index)]") } }
    case "object": try validateObject(value, schema: ResourceSchemaDef(type: "object", identity: [], required: schema.required, properties: schema.properties, additionalProperties: nil, invariants: schema.invariants), schemas: schemas, path: path)
    default: break
    }
    if !schema.enumValues.isEmpty && !schema.enumValues.contains(value) { throw ResourceModelError.message("\(path) is not an allowed value") }
    if let number = resourceNumber(value) { if let min = schema.minimum, number < min { throw ResourceModelError.message("\(path) is below minimum") }; if let max = schema.maximum, number > max { throw ResourceModelError.message("\(path) is above maximum") } }
}

private func applyResourceCodec(_ value: JSONValue, codec: String?, trim: Bool, empty: String?) throws -> JSONValue {
    if value == .null { return .null }
    var value = value
    if trim, case .string(let text) = value { value = .string(text.trimmingCharacters(in: .whitespacesAndNewlines)) }
    if case .string(let text) = value, text.isEmpty { if empty?.lowercased() == "null" || empty?.lowercased() == "omit" { return .null } }
    switch codec?.lowercased() {
    case "int", "integer": guard let number = resourceNumber(value), number.isFinite, number.rounded() == number else { throw ResourceModelError.message("Cannot coerce value to integer") }; return .number(number)
    case "float", "number": guard let number = resourceNumber(value) else { throw ResourceModelError.message("Cannot coerce value to number") }; return .number(number)
    case "bool", "boolean": if case .bool = value { return value }; if case .string(let text) = value, let bool = Bool(text) { return .bool(bool) }; throw ResourceModelError.message("Cannot coerce value to boolean")
    case "string": return .string(value.stringValue ?? String(describing: value.anyValue ?? ""))
    default: return value
    }
}

private func resourceNumber(_ value: JSONValue) -> Double? { switch value { case .number(let value): return value; case .string(let value): return Double(value); default: return nil } }
private func resourceResolve(_ object: [String: JSONValue], path: String) -> JSONValue? { resourceResolveValue(.object(object), path: path) }
package func resourceResolveValue(_ value: JSONValue, path: String) -> JSONValue? {
    if path.isEmpty { return value }
    return resourceResolveValue(value, components: path.split(separator: "."))
}

func resourceResolveValue<Components: Sequence>(_ value: JSONValue, components: Components) -> JSONValue? where Components.Element: StringProtocol {
    components.reduce(Optional(value)) { current, part in
        guard let current else { return nil }
        if let object = current.objectValue { return object[String(part)] }
        if let array = current.arrayValue, let index = Int(part), array.indices.contains(index) { return array[index] }
        return nil
    }
}

private func setResourcePath(_ object: inout [String: JSONValue], path: String, value: JSONValue) {
    let parts = path.split(separator: ".").map(String.init); guard let first = parts.first else { return }
    if parts.count == 1 { object[first] = value; return }
    var child = object[first]?.objectValue ?? [:]
    setResourcePath(&child, path: parts.dropFirst().joined(separator: "."), value: value)
    object[first] = .object(child)
}

private func resourceFilterMatches(_ value: JSONValue, filter: ResourceValueFilterDef) -> Bool {
    let actual = resourceResolveValue(value, path: filter.field)
    if let expected = filter.equals { return actual == expected }
    if let expected = filter.notEquals { return actual != expected }
    if let values = filter.inValues, !values.isEmpty { return actual.map(values.contains) == true }
    return false
}

private func persistedResourceIdentity(_ value: JSONValue) -> Bool {
    if let number = resourceNumber(value) {
        return number.isFinite && number > 0 && number.rounded() == number && number <= 9_007_199_254_740_991
    }
    return value.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
}

private func mergeResourceCollection(draft: JSONValue, baseline: JSONValue?, binding: ResourceCollectionBindingDef, nestedSchema: ResourceSchemaDef?, associationFields: Set<String>, pairByIdentity: Bool) throws -> [(JSONValue, JSONValue?)] {
    guard let draftRows = draft.arrayValue else { throw ResourceModelError.message("Nested resource collection must be an array") }
    let baselineRows = (baseline?.arrayValue ?? []).map { row -> JSONValue in
        guard let marker = binding.deleteMarker, var original = row.objectValue else { return row }
        original.removeValue(forKey: marker)
        return .object(original)
    }
    let identities = binding.identity?.isEmpty == false ? binding.identity! : (nestedSchema?.identity ?? [])
    guard !identities.isEmpty else { throw ResourceModelError.message("Nested resource collection requires identity fields") }
    func key(_ value: JSONValue, index: Int) throws -> String? {
        guard let row = value.objectValue else { throw ResourceModelError.message("Nested resource row must be an object") }
        let isNewIdentity = identities.allSatisfy { field in
            guard let value = row[field] else { return true }
            if value == .null || value.stringValue == "" { return true }
            return resourceNumber(value) == 0
        }
        if isNewIdentity, let clientKey = binding.clientKey, let value = row[clientKey]?.stringValue, !value.isEmpty {
            return pairByIdentity ? "client:" + Data(value.utf8).base64EncodedString() : "client:\(value)"
        }
        if isNewIdentity, binding.clientKey == nil, binding.deleteMarker != nil { return nil }
        if pairByIdentity {
            let parts = identities.compactMap { field -> String? in
                switch row[field] {
                case .string(let value) where !value.isEmpty: return "s:" + Data(value.utf8).base64EncodedString()
                case .number(let value) where value.isFinite: return "n:" + String(value == 0 ? 0 : value)
                case .bool(let value): return "b:" + String(value)
                default: return nil
                }
            }
            if parts.count == identities.count { return parts.joined(separator: "|") }
        } else {
            let identity = identities.compactMap { field -> String? in
                if let text = row[field]?.stringValue { return text }
                if let number = resourceNumber(row[field] ?? .null) { return number.rounded() == number ? String(Int(number)) : String(number) }
                return nil
            }
            if identity.count == identities.count, !identity.contains("") { return identity.joined(separator: "\u{001f}") }
        }
        throw ResourceModelError.message("Nested resource row \(index) is missing identity fields")
    }
    func overlayBase(_ value: JSONValue?) -> JSONValue {
        guard let value else { return .object([:]) }
        guard !associationFields.isEmpty, let object = value.objectValue else { return value }
        return .object(object.filter { !associationFields.contains($0.key) })
    }
    var baselineByKey: [String: JSONValue] = [:]
    var baselineEntries: [(String, JSONValue)] = []
    for (index, row) in baselineRows.enumerated() {
        guard let id = try key(row, index: index) else { continue }
        if pairByIdentity, baselineByKey[id] != nil {
            throw ResourceModelError.message("Duplicate nested baseline resource identity: \(id)")
        }
        baselineEntries.append((id, row))
        baselineByKey[id] = row
    }
    var seen: Set<String> = []
    var result: [(row: JSONValue, prior: JSONValue?, id: String?)] = []
    for (index, row) in draftRows.enumerated() {
        let id = try key(row, index: index)
        if let id, !seen.insert(id).inserted { throw ResourceModelError.message("Duplicate nested resource identity: \(id)") }
        let prior = id.flatMap { baselineByKey[$0] }
        result.append((overlayResource(base: overlayBase(prior), patch: row), prior, id))
    }
    if binding.mode?.lowercased() == "merge" {
        if binding.preserveOrder == false {
            var draftByKey: [String: (JSONValue, JSONValue?)] = [:]
            for entry in result { if let id = entry.id { draftByKey[id] = (entry.row, entry.prior) } }
            let ordered: [(JSONValue, JSONValue?)] = baselineEntries.map { id, row in
                draftByKey[id] ?? (overlayBase(row), row)
            }
            return ordered + result.filter { entry in entry.id.flatMap { baselineByKey[$0] } == nil }.map { ($0.row, $0.prior) }
        }
        for (id, row) in baselineEntries where !seen.contains(id) {
            result.append((overlayBase(row), row, id))
        }
    }
    return result.map { ($0.row, $0.prior) }
}

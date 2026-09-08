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
    public let identityDataSourceRef: String
    public let dataSources: [String: ResourceDataSnapshot]
    public let windowForm: [String: JSONValue]
    public let extras: [String: JSONValue]

    public init(identityDataSourceRef: String, dataSources: [String: ResourceDataSnapshot], windowForm: [String: JSONValue] = [:], extras: [String: JSONValue] = [:]) {
        self.identityDataSourceRef = identityDataSourceRef; self.dataSources = dataSources; self.windowForm = windowForm; self.extras = extras
    }
}

public typealias ResourceModelHook = @Sendable (_ name: String, _ value: JSONValue) throws -> JSONValue?

public enum ResourceModelRuntime {
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
        guard let model = models[modelRef], let write = model.write else { throw ResourceModelError.message("Resource model \(modelRef) requires a write binding") }
        let mode = normalizeResourceMode(requestedMode ?? write.mode ?? "changed")
        var canonical: JSONValue
        if mode == "overlaybaseline" { canonical = overlayResource(base: baseline ?? .object([:]), patch: draft) } else { canonical = draft }
        canonical = try applyResourceHook(model.hooks?.beforeMarshal, value: canonical, hook: hook)
        try validate(value: canonical, schemaRef: model.schemaRef, schemas: schemas)
        try validateImmutableIdentity(draft: canonical, baseline: baseline, schema: schemas[model.schemaRef])
        var wire = try marshalValue(canonical, baseline: baseline, model: model, mode: mode, schemas: schemas, models: models, hook: hook)
        wire = try applyResourceHook(model.hooks?.afterMarshal, value: wire, hook: hook)
        let target = requestedTarget?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? requestedTarget! : (write.inputPath ?? "")
        if target == "$" || target.isEmpty {
            guard let object = wire.objectValue else { throw ResourceModelError.message("Root resource payload must be an object") }
            return object
        }
        var result: [String: JSONValue] = [:]
        setResourcePath(&result, path: target, value: wire)
        return result
    }

    public static func prepare(payload: ResourcePayloadPreparationDef, environment: ResourceValueEnvironment, schemas: [String: ResourceSchemaDef], models: [String: ResourceModelDef], hook: ResourceModelHook? = nil) throws -> [String: JSONValue] {
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
        return try marshal(draft: draft, baseline: baseline, modelRef: payload.modelRef, mode: payload.mode, target: payload.target, schemas: schemas, models: models, hook: hook)
    }

    public static func validate(value: JSONValue, schemaRef: String, schemas: [String: ResourceSchemaDef]) throws {
        guard let schema = schemas[schemaRef] else { throw ResourceModelError.message("Unknown resource schema: \(schemaRef)") }
        try validateObject(value, schema: schema, schemas: schemas, path: "$" )
    }

    private static func unmarshalObject(value: JSONValue, model: ResourceModelDef, schemas: [String: ResourceSchemaDef], models: [String: ResourceModelDef], hook: ResourceModelHook?) throws -> JSONValue {
        guard let input = value.objectValue else { throw ResourceModelError.message("Resource reader value must be an object") }
        var output = model.read?.preserveUnbound == true ? input : [:]
        for (field, binding) in model.fields {
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

    private static func marshalValue(_ value: JSONValue, baseline: JSONValue?, model: ResourceModelDef, mode: String, schemas: [String: ResourceSchemaDef], models: [String: ResourceModelDef], hook: ResourceModelHook?) throws -> JSONValue {
        if case .array(let values) = value {
            let baselineValues = baseline?.arrayValue ?? []
            return .array(try values.enumerated().map { index, item in try marshalValue(item, baseline: baselineValues.indices.contains(index) ? baselineValues[index] : nil, model: model, mode: mode, schemas: schemas, models: models, hook: hook) })
        }
        guard let object = value.objectValue else { throw ResourceModelError.message("Canonical resource must be an object") }
        let baselineObject = baseline?.objectValue ?? [:]
        let schema = schemas[model.schemaRef]
        var output: [String: JSONValue] = [:]
        for (field, binding) in model.fields {
            guard binding.write != "-" else { continue }
            let current = object[field] ?? binding.defaultValue
            let previous = baselineObject[field]
            let identity = schema?.identity.contains(field) == true
            let include = mode != "changed" || identity || binding.alwaysWrite == true || (binding.omitIfUnchanged != true && current != previous)
            guard include, let current else { continue }
            let transformed: JSONValue
            if let modelRef = binding.modelRef, let nested = models[modelRef] {
                let prepared = try applyResourceHook(nested.hooks?.beforeMarshal, value: current, hook: hook)
                transformed = try applyResourceHook(nested.hooks?.afterMarshal, value: marshalValue(prepared, baseline: previous, model: nested, mode: mode, schemas: schemas, models: models, hook: hook), hook: hook)
            } else if let collection = binding.collection, let modelRef = collection.modelRef, let nested = models[modelRef] {
                let merged = try mergeResourceCollection(draft: current, baseline: previous, binding: collection, nestedSchema: schemas[nested.schemaRef])
                let prepared = try applyResourceHook(nested.hooks?.beforeMarshal, value: merged, hook: hook)
                transformed = try applyResourceHook(nested.hooks?.afterMarshal, value: marshalValue(prepared, baseline: previous, model: nested, mode: mode, schemas: schemas, models: models, hook: hook), hook: hook)
            } else {
                transformed = try applyResourceCodec(current, codec: binding.codec, trim: binding.trim == true, empty: binding.empty)
            }
            if transformed == .null && binding.empty?.lowercased() == "omit" { continue }
            setResourcePath(&output, path: binding.write ?? field, value: transformed)
        }
        return .object(output)
    }

    private static func resolve(source: ResourceValueSourceDef, environment: ResourceValueEnvironment) throws -> JSONValue? {
        let scope = source.scope?.lowercased() ?? "extras"
        let ref = source.dataSourceRef ?? environment.identityDataSourceRef
        let snapshot = environment.dataSources[ref] ?? ResourceDataSnapshot()
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
    case "object": try validateObject(value, schema: ResourceSchemaDef(type: "object", identity: [], required: schema.required, properties: schema.properties, additionalProperties: nil), schemas: schemas, path: path)
    default: break
    }
    if !schema.enumValues.isEmpty && !schema.enumValues.contains(value) { throw ResourceModelError.message("\(path) is not an allowed value") }
    if let number = resourceNumber(value) { if let min = schema.minimum, number < min { throw ResourceModelError.message("\(path) is below minimum") }; if let max = schema.maximum, number > max { throw ResourceModelError.message("\(path) is above maximum") } }
}

private func applyResourceCodec(_ value: JSONValue, codec: String?, trim: Bool, empty: String?) throws -> JSONValue {
    var value = value
    if trim, case .string(let text) = value { value = .string(text.trimmingCharacters(in: .whitespacesAndNewlines)) }
    if case .string(let text) = value, text.isEmpty { if empty?.lowercased() == "null" || empty?.lowercased() == "omit" { return .null } }
    switch codec?.lowercased() {
    case "int", "integer": guard let number = resourceNumber(value) else { throw ResourceModelError.message("Cannot coerce value to integer") }; return .number(Double(Int(number)))
    case "float", "number": guard let number = resourceNumber(value) else { throw ResourceModelError.message("Cannot coerce value to number") }; return .number(number)
    case "bool", "boolean": if case .bool = value { return value }; if case .string(let text) = value, let bool = Bool(text) { return .bool(bool) }; throw ResourceModelError.message("Cannot coerce value to boolean")
    case "string": return .string(value.stringValue ?? String(describing: value.anyValue ?? ""))
    default: return value
    }
}

private func resourceNumber(_ value: JSONValue) -> Double? { switch value { case .number(let value): return value; case .string(let value): return Double(value); default: return nil } }
private func resourceResolve(_ object: [String: JSONValue], path: String) -> JSONValue? { resourceResolveValue(.object(object), path: path) }
private func resourceResolveValue(_ value: JSONValue, path: String) -> JSONValue? {
    if path.isEmpty { return value }
    return path.split(separator: ".").reduce(Optional(value)) { current, part in
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

private func mergeResourceCollection(draft: JSONValue, baseline: JSONValue?, binding: ResourceCollectionBindingDef, nestedSchema: ResourceSchemaDef?) throws -> JSONValue {
    guard let draftRows = draft.arrayValue else { throw ResourceModelError.message("Nested resource collection must be an array") }
    let baselineRows = baseline?.arrayValue ?? []
    let identities = binding.identity?.isEmpty == false ? binding.identity! : (nestedSchema?.identity ?? [])
    guard !identities.isEmpty else { throw ResourceModelError.message("Nested resource collection requires identity fields") }
    func key(_ value: JSONValue, index: Int) throws -> String {
        guard let row = value.objectValue else { throw ResourceModelError.message("Nested resource row must be an object") }
        let identity = identities.compactMap { field -> String? in
            if let text = row[field]?.stringValue { return text }
            if let number = resourceNumber(row[field] ?? .null) { return number.rounded() == number ? String(Int(number)) : String(number) }
            return nil
        }
        let isNewIdentity = identities.allSatisfy { field in
            guard let value = row[field] else { return true }
            if value == .null || value.stringValue == "" { return true }
            return resourceNumber(value) == 0
        }
        if isNewIdentity, let clientKey = binding.clientKey, let value = row[clientKey]?.stringValue, !value.isEmpty { return "client:\(value)" }
        if identity.count == identities.count, !identity.contains("") { return identity.joined(separator: "\u{001f}") }
        throw ResourceModelError.message("Nested resource row \(index) is missing identity fields")
    }
    var baselineByKey: [String: JSONValue] = [:]
    for (index, row) in baselineRows.enumerated() { baselineByKey[try key(row, index: index)] = row }
    var seen: Set<String> = []; var result: [JSONValue] = []
    for (index, row) in draftRows.enumerated() {
        let identity = try key(row, index: index); guard seen.insert(identity).inserted else { throw ResourceModelError.message("Duplicate nested resource identity: \(identity)") }
        result.append(overlayResource(base: baselineByKey[identity] ?? .object([:]), patch: row))
    }
    if binding.mode?.lowercased() == "merge" {
        if binding.preserveOrder == false {
            let draftByKey = Dictionary(uniqueKeysWithValues: try result.enumerated().map { index, row in (try key(row, index: index), row) })
            var baselineKeys: Set<String> = []
            var ordered: [JSONValue] = []
            for (index, row) in baselineRows.enumerated() {
                let identity = try key(row, index: index)
                baselineKeys.insert(identity)
                ordered.append(draftByKey[identity] ?? row)
            }
            for (index, row) in result.enumerated() where !baselineKeys.contains(try key(row, index: index)) { ordered.append(row) }
            result = ordered
        } else {
            for (index, row) in baselineRows.enumerated() where !seen.contains(try key(row, index: index)) { result.append(row) }
        }
    }
    return .array(result)
}

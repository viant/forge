import Foundation

public enum ParameterResolver {
    public struct DataSourceSnapshot: Sendable {
        public let selectionMode: String?
        public let form: [String: JSONValue]
        public let metrics: [String: JSONValue]
        public let selection: SelectionState
        public let input: InputState

        public init(
            selectionMode: String? = nil,
            form: [String: JSONValue] = [:],
            metrics: [String: JSONValue] = [:],
            selection: SelectionState = SelectionState(),
            input: InputState = InputState()
        ) {
            self.selectionMode = selectionMode
            self.form = form
            self.metrics = metrics
            self.selection = selection
            self.input = input
        }
    }

    public struct ResolutionContext: Sendable {
        public let identityDataSourceRef: String
        public let dataSources: [String: DataSourceSnapshot]
        public let windowForm: [String: JSONValue]
        public let metadata: WindowMetadata?

        public init(
            identityDataSourceRef: String,
            dataSources: [String: DataSourceSnapshot] = [:],
            windowForm: [String: JSONValue] = [:],
            metadata: WindowMetadata? = nil
        ) {
            self.identityDataSourceRef = identityDataSourceRef
            self.dataSources = dataSources
            self.windowForm = windowForm
            self.metadata = metadata
        }
    }

    public static func resolve(
        parameters: [ParameterDef],
        context: ResolutionContext
    ) -> [String: JSONValue] {
        var resolved: [String: JSONValue] = [:]
        for parameter in parameters where parameter.direction?.lowercased() != "out" {
            let name = parameter.name.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !name.isEmpty else { continue }
            guard let value = resolve(parameter: parameter, context: context) else { continue }
            applyResolvedValue(&resolved, name: name, value: value)
        }
        return resolved
    }

    public static func resolve(
        parameters: [String: String],
        values: [String: String]
    ) -> [String: String] {
        var resolved: [String: String] = [:]
        for (key, value) in parameters {
            if value.hasPrefix("$"), let replacement = values[String(value.dropFirst())] {
                resolved[key] = replacement
            } else {
                resolved[key] = value
            }
        }
        return resolved
    }

    private static func resolve(
        parameter: ParameterDef,
        context: ResolutionContext
    ) -> JSONValue? {
        let input = (parameter.input ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        switch input {
        case "selection":
            return resolveFromSelection(context: context, location: parameter.location?.stringValue)
        case "form":
            return resolveFromForm(context: context, location: parameter.location?.stringValue)
        case "windowForm":
            return resolveFromWindowForm(context: context, location: parameter.location?.stringValue)
        case "metadata":
            return resolveFromMetadata(context: context, location: parameter.location?.stringValue)
        case "filterSet":
            return resolveFromFilterSet(context: context, location: parameter.location?.stringValue)
        case "metrics":
            return resolveFromMetrics(context: context, location: parameter.location?.stringValue)
        case "const":
            return parameter.location ?? parameter.value
        default:
            if let explicit = parameter.value {
                return explicit
            }
            if let selector = parameter.selector,
               let resolved = jsonValue(any: SelectorUtil.resolve(jsonObjectAny(context.windowForm), selector: selector)) {
                return resolved
            }
            return parameter.location
        }
    }

    private static func resolveFromSelection(
        context: ResolutionContext,
        location: String?
    ) -> JSONValue? {
        let (dataSourceRef, fieldPath) = resolveDataSourceRef(location: location, context: context)
        guard let snapshot = context.dataSources[dataSourceRef] else { return nil }
        let selectionMode = (snapshot.selectionMode ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if selectionMode == "multi" {
            let selectedRows = snapshot.selection.selection
            if fieldPath.isEmpty {
                return .array(selectedRows.map(JSONValue.object))
            }
            let values = selectedRows.compactMap { row in
                jsonValue(any: SelectorUtil.resolve(jsonObjectAny(row), selector: fieldPath))
            }
            return .array(values)
        }
        guard let selected = snapshot.selection.selected else {
            return nil
        }
        if fieldPath.isEmpty {
            return .object(selected)
        }
        return jsonValue(any: SelectorUtil.resolve(jsonObjectAny(selected), selector: fieldPath))
    }

    private static func resolveFromForm(
        context: ResolutionContext,
        location: String?
    ) -> JSONValue? {
        let (dataSourceRef, fieldPath) = resolveDataSourceRef(location: location, context: context)
        guard let snapshot = context.dataSources[dataSourceRef] else { return nil }
        if fieldPath.isEmpty {
            return .object(snapshot.form)
        }
        return jsonValue(any: SelectorUtil.resolve(jsonObjectAny(snapshot.form), selector: fieldPath))
    }

    private static func resolveFromWindowForm(
        context: ResolutionContext,
        location: String?
    ) -> JSONValue? {
        let fieldPath = location?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if fieldPath.isEmpty {
            return .object(context.windowForm)
        }
        return jsonValue(any: SelectorUtil.resolve(jsonObjectAny(context.windowForm), selector: fieldPath))
    }

    private static func resolveFromMetadata(
        context: ResolutionContext,
        location: String?
    ) -> JSONValue? {
        guard let metadata = context.metadata else { return nil }
        let fieldPath = location?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if fieldPath.isEmpty {
            return jsonValue(from: metadata)
        }
        return jsonValue(any: SelectorUtil.resolve(metadata, selector: fieldPath))
    }

    private static func resolveFromFilterSet(
        context: ResolutionContext,
        location: String?
    ) -> JSONValue? {
        let (dataSourceRef, fieldPath) = resolveDataSourceRef(location: location, context: context)
        guard let snapshot = context.dataSources[dataSourceRef] else { return nil }
        if fieldPath.isEmpty {
            return .object(snapshot.input.filter)
        }
        return jsonValue(any: SelectorUtil.resolve(jsonObjectAny(snapshot.input.filter), selector: fieldPath))
    }

    private static func resolveFromMetrics(
        context: ResolutionContext,
        location: String?
    ) -> JSONValue? {
        let (dataSourceRef, fieldPath) = resolveDataSourceRef(location: location, context: context)
        guard let snapshot = context.dataSources[dataSourceRef] else { return nil }
        if fieldPath.isEmpty {
            return .object(snapshot.metrics)
        }
        return jsonValue(any: SelectorUtil.resolve(jsonObjectAny(snapshot.metrics), selector: fieldPath))
    }

    private static func resolveDataSourceRef(
        location: String?,
        context: ResolutionContext
    ) -> (String, String) {
        let trimmed = location?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !trimmed.isEmpty else {
            return (context.identityDataSourceRef, "")
        }
        guard let dotIndex = trimmed.firstIndex(of: ".") else {
            if context.dataSources[trimmed] != nil {
                return (trimmed, "")
            }
            return (context.identityDataSourceRef, trimmed)
        }
        let possibleDataSourceRef = String(trimmed[..<dotIndex])
        let remainder = String(trimmed[trimmed.index(after: dotIndex)...])
        if context.dataSources[possibleDataSourceRef] != nil {
            return (possibleDataSourceRef, remainder)
        }
        return (context.identityDataSourceRef, trimmed)
    }

    private static func applyResolvedValue(
        _ target: inout [String: JSONValue],
        name: String,
        value: JSONValue
    ) {
        if name == "..." {
            if let object = value.objectValue {
                target.merge(object) { _, new in new }
            }
            return
        }
        if name.hasPrefix("[]") {
            let key = String(name.dropFirst(2))
            if key.isEmpty { return }
            if case .array = value {
                target[key] = value
            } else {
                target[key] = .array([value])
            }
            return
        }
        setNestedValue(&target, path: name, value: value)
    }

    private static func setNestedValue(
        _ target: inout [String: JSONValue],
        path: String,
        value: JSONValue
    ) {
        let parts = path
            .split(separator: ".")
            .map(String.init)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard let first = parts.first else { return }
        if parts.count == 1 {
            target[first] = value
            return
        }
        var child = target[first]?.objectValue ?? [:]
        let remaining = parts.dropFirst().joined(separator: ".")
        setNestedValue(&child, path: remaining, value: value)
        target[first] = .object(child)
    }

    private static func jsonValue<T: Encodable>(from value: T) -> JSONValue? {
        guard let data = try? JSONEncoder().encode(value) else { return nil }
        return try? JSONDecoder().decode(JSONValue.self, from: data)
    }

    private static func jsonObjectAny(_ value: [String: JSONValue]) -> [String: Any] {
        value.mapValues(anyValue)
    }

    private static func anyValue(_ value: JSONValue) -> Any {
        switch value {
        case .string(let string):
            return string
        case .number(let number):
            return number
        case .bool(let bool):
            return bool
        case .array(let values):
            return values.map(anyValue)
        case .object(let object):
            return object.mapValues(anyValue)
        case .null:
            return NSNull()
        }
    }

    private static func jsonValue(any value: Any?) -> JSONValue? {
        guard let value else {
            return .null
        }
        switch value {
        case let value as JSONValue:
            return value
        case let value as String:
            return .string(value)
        case let value as Bool:
            return .bool(value)
        case let value as Int:
            return .number(Double(value))
        case let value as Int64:
            return .number(Double(value))
        case let value as Double:
            return .number(value)
        case let value as Float:
            return .number(Double(value))
        case let value as NSNumber:
            return .number(value.doubleValue)
        case _ as NSNull:
            return .null
        case let value as [String: JSONValue]:
            return .object(value)
        case let value as [String: Any]:
            var object: [String: JSONValue] = [:]
            for (key, child) in value {
                guard let jsonValue = jsonValue(any: child) else { return nil }
                object[key] = jsonValue
            }
            return .object(object)
        case let value as [Any]:
            let items = value.compactMap(jsonValue(any:))
            guard items.count == value.count else { return nil }
            return .array(items)
        default:
            return nil
        }
    }
}

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
        for parameter in parameters where isCompact(parameter) {
            guard !isOutbound(parameter) else { continue }
            guard let from = parameter.from, let to = parameter.to else { continue }
            let sourceParts = splitStoreReference(from)
            let destinationParts = splitStoreReference(to)
            let sourceDataSourceRef = sourceParts.dataSourceRef.isEmpty ? context.identityDataSourceRef : sourceParts.dataSourceRef
            let destinationDataSourceRef = destinationParts.dataSourceRef.isEmpty ? context.identityDataSourceRef : destinationParts.dataSourceRef
            guard !sourceDataSourceRef.isEmpty, !destinationDataSourceRef.isEmpty else { continue }
            let sourcePath = parameter.name == "..."
                ? parameter.location?.stringValue
                : parameter.location?.stringValue ?? parameter.name
            guard let value = readCompactValue(
                context: context,
                dataSourceRef: sourceDataSourceRef,
                store: expandStore(sourceParts.store),
                path: sourcePath
            ) else {
                continue
            }
            var dataSourceResult = resolved[destinationDataSourceRef]?.objectValue ?? [:]
            writeCompactValue(
                &dataSourceResult,
                store: expandStore(destinationParts.store),
                path: parameter.name,
                value: value
            )
            resolved[destinationDataSourceRef] = .object(dataSourceResult)
        }

        for parameter in parameters where !isCompact(parameter) && !isOutbound(parameter) {
            let name = parameter.name.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !name.isEmpty else { continue }
            guard let value = resolve(parameter: parameter, context: context) else { continue }
            let toDataSource = (parameter.to ?? parameter.kind ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if !toDataSource.isEmpty {
                var dataSourceResult = resolved[toDataSource]?.objectValue ?? [:]
                applyResolvedValue(&dataSourceResult, name: name, value: value)
                resolved[toDataSource] = .object(dataSourceResult)
            } else {
                applyResolvedValue(&resolved, name: name, value: value)
            }
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
        case "dataSource":
            return resolveFromLegacyDataSource(context: context, location: parameter.location?.stringValue)
        case "windowForm":
            return resolveFromWindowForm(context: context, location: parameter.location?.stringValue)
        case "metadata":
            return resolveFromMetadata(context: context, location: parameter.location?.stringValue)
        case "input":
            return resolveFromInput(context: context, location: parameter.location?.stringValue)
        case "filter":
            return resolveFromFilter(context: context, location: parameter.location?.stringValue)
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

    private static func isCompact(_ parameter: ParameterDef) -> Bool {
        guard let from = parameter.from,
              let to = parameter.to else {
            return false
        }
        return from.contains(":") && to.contains(":")
    }

    private static func isOutbound(_ parameter: ParameterDef) -> Bool {
        if parameter.output == true {
            return true
        }
        if parameter.direction?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "out" {
            return true
        }
        return parameter.from?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased().hasSuffix(":output") == true
    }

    private static func splitStoreReference(_ reference: String) -> (dataSourceRef: String, store: String) {
        let parts = reference.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
        let dataSourceRef = parts.first.map(String.init)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let store = parts.count > 1
            ? String(parts[1]).trimmingCharacters(in: .whitespacesAndNewlines)
            : ""
        return (dataSourceRef, store)
    }

    private static func expandStore(_ rawStore: String) -> String {
        switch rawStore.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "query":
            return "input.query"
        case "path":
            return "input.path"
        case "headers":
            return "input.headers"
        case "body":
            return "input.body"
        default:
            return rawStore.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        }
    }

    private static func readCompactValue(
        context: ResolutionContext,
        dataSourceRef: String,
        store: String,
        path: String?
    ) -> JSONValue? {
        let sourcePath = path?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        switch store {
        case "form":
            return readDataSourceObject(context: context, dataSourceRef: dataSourceRef, object: \.form, path: sourcePath)
        case "selection":
            return readSelection(context: context, dataSourceRef: dataSourceRef, path: sourcePath)
        case "filter":
            return readDataSourceObject(context: context, dataSourceRef: dataSourceRef, object: { $0.input.filter }, path: sourcePath)
        case "metrics":
            return readDataSourceObject(context: context, dataSourceRef: dataSourceRef, object: \.metrics, path: sourcePath)
        case "windowform":
            return sourcePath.isEmpty
                ? .object(context.windowForm)
                : jsonValue(any: SelectorUtil.resolve(jsonObjectAny(context.windowForm), selector: sourcePath))
        case "input":
            guard let snapshot = context.dataSources[dataSourceRef] else { return nil }
            let input = inputObject(snapshot.input)
            return sourcePath.isEmpty
                ? .object(input)
                : jsonValue(any: SelectorUtil.resolve(jsonObjectAny(input), selector: sourcePath))
        default:
            return nil
        }
    }

    private static func readDataSourceObject(
        context: ResolutionContext,
        dataSourceRef: String,
        object: (DataSourceSnapshot) -> [String: JSONValue],
        path: String
    ) -> JSONValue? {
        guard let snapshot = context.dataSources[dataSourceRef] else { return nil }
        let value = object(snapshot)
        return path.isEmpty
            ? .object(value)
            : jsonValue(any: SelectorUtil.resolve(jsonObjectAny(value), selector: path))
    }

    private static func readSelection(
        context: ResolutionContext,
        dataSourceRef: String,
        path: String
    ) -> JSONValue? {
        guard let snapshot = context.dataSources[dataSourceRef] else { return nil }
        let selectionMode = (snapshot.selectionMode ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if selectionMode == "multi" {
            if path.isEmpty {
                return .array(snapshot.selection.selection.map(JSONValue.object))
            }
            return .array(snapshot.selection.selection.compactMap { row in
                jsonValue(any: SelectorUtil.resolve(jsonObjectAny(row), selector: path))
            })
        }
        guard let selected = snapshot.selection.selected else { return nil }
        return path.isEmpty
            ? .object(selected)
            : jsonValue(any: SelectorUtil.resolve(jsonObjectAny(selected), selector: path))
    }

    private static func inputObject(_ input: InputState) -> [String: JSONValue] {
        var object: [String: JSONValue] = [
            "filter": .object(input.filter),
            "parameters": .object(input.parameters),
            "fetch": .bool(input.fetch),
            "refresh": .bool(input.refresh)
        ]
        if let page = input.page {
            object["page"] = .number(Double(page))
        }
        return object
    }

    private static func writeCompactValue(
        _ dataSourceResult: inout [String: JSONValue],
        store: String,
        path: String,
        value: JSONValue
    ) {
        let trimmedPath = path.trimmingCharacters(in: .whitespacesAndNewlines)
        if store == "input" {
            var input = dataSourceResult["input"]?.objectValue ?? [:]
            applyResolvedValue(&input, name: trimmedPath, value: value)
            dataSourceResult["input"] = .object(input)
            return
        }
        if store.hasPrefix("input.") {
            let childStore = String(store.dropFirst("input.".count))
            guard !childStore.isEmpty else { return }
            var input = dataSourceResult["input"]?.objectValue ?? [:]
            var child = input[childStore]?.objectValue ?? [:]
            applyResolvedValue(&child, name: trimmedPath, value: value)
            input[childStore] = .object(child)
            dataSourceResult["input"] = .object(input)
            return
        }
        var destination = dataSourceResult[store]?.objectValue ?? [:]
        applyResolvedValue(&destination, name: trimmedPath, value: value)
        dataSourceResult[store] = .object(destination)
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

    private static func resolveFromLegacyDataSource(
        context: ResolutionContext,
        location: String?
    ) -> JSONValue? {
        let (dataSourceRef, fieldPath) = resolveDataSourceRef(location: location, context: context)
        guard let snapshot = context.dataSources[dataSourceRef] else { return nil }
        let candidates: [[String: JSONValue]?] = [
            snapshot.selection.selected,
            snapshot.form,
            snapshot.input.filter,
            inputObject(snapshot.input)
        ]
        for candidate in candidates {
            guard let candidate,
                  let value = readObjectValue(candidate, path: fieldPath) else {
                continue
            }
            return value
        }
        return nil
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

    private static func resolveFromInput(
        context: ResolutionContext,
        location: String?
    ) -> JSONValue? {
        let (dataSourceRef, fieldPath) = resolveDataSourceRef(location: location, context: context)
        guard let snapshot = context.dataSources[dataSourceRef] else { return nil }
        return readObjectValue(inputObject(snapshot.input), path: fieldPath)
    }

    private static func resolveFromFilter(
        context: ResolutionContext,
        location: String?
    ) -> JSONValue? {
        let (dataSourceRef, fieldPath) = resolveDataSourceRef(location: location, context: context)
        guard let snapshot = context.dataSources[dataSourceRef] else { return nil }
        return readObjectValue(snapshot.input.filter, path: fieldPath)
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

    private static func readObjectValue(_ object: [String: JSONValue], path: String) -> JSONValue? {
        if path.isEmpty {
            return .object(object)
        }
        guard let value = SelectorUtil.resolve(jsonObjectAny(object), selector: path) else {
            return nil
        }
        return jsonValue(any: value)
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

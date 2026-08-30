import Foundation

public struct FeedDataSourceSnapshot: Sendable, Equatable {
    public let form: [String: JSONValue]
    public let collection: [[String: JSONValue]]
    public let selection: [String: JSONValue]

    public init(
        form: [String: JSONValue] = [:],
        collection: [[String: JSONValue]] = [],
        selection: [String: JSONValue] = [:]
    ) {
        self.form = form
        self.collection = collection
        self.selection = selection
    }
}

public struct FeedPatchOperation: Sendable, Equatable {
    public let dataSourceRef: String
    public let op: String
    public let path: String
    public let value: JSONValue?

    public init(dataSourceRef: String, op: String, path: String, value: JSONValue? = nil) {
        self.dataSourceRef = dataSourceRef
        self.op = op
        self.path = path
        self.value = value
    }
}

public enum FeedDraftRuntimeError: LocalizedError, Equatable {
    case windowNotFound(String)
    case unknownDataSource(String)
    case invalidPointer(String)
    case unsupportedView(String)
    case unsupportedOperation(String)
    case missingPath(String)
    case invalidArrayIndex(String)
    case invalidViewShape(String)

    public var errorDescription: String? {
        switch self {
        case .windowNotFound(let id): return "feed window not found: \(id)"
        case .unknownDataSource(let ref): return "unknown dataSourceRef: \(ref)"
        case .invalidPointer(let path): return "feed patch path must be an absolute JSON Pointer: \(path)"
        case .unsupportedView(let view): return "unsupported feed patch view: \(view)"
        case .unsupportedOperation(let op): return "unsupported feed patch op: \(op)"
        case .missingPath(let token): return "feed patch path does not exist: \(token)"
        case .invalidArrayIndex(let token): return "invalid or out-of-bounds feed array index: \(token)"
        case .invalidViewShape(let view): return "patched \(view) has an invalid shape"
        }
    }
}

public extension ForgeRuntime {
    func snapshotFeedDataSources(
        windowID: String,
        dataSourceRefs: [String]
    ) async throws -> [String: FeedDataSourceSnapshot] {
        guard windowState(id: windowID) != nil else {
            throw FeedDraftRuntimeError.windowNotFound(windowID)
        }
        let metadata = await windowMetadata(id: windowID)
        var result: [String: FeedDataSourceSnapshot] = [:]
        for ref in Array(Set(dataSourceRefs)).sorted() {
            guard metadata?.dataSources[ref] != nil else {
                throw FeedDraftRuntimeError.unknownDataSource(ref)
            }
            let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: ref)
            let selection = await dataSourceRuntime.selection(dataSourceID: dataSourceID)
            var selectionView: [String: JSONValue] = [:]
            if let selected = selection.selected { selectionView["selected"] = .object(selected) }
            if !selection.selection.isEmpty {
                selectionView["selection"] = .array(selection.selection.map(JSONValue.object))
            }
            if selection.rowIndex >= 0 { selectionView["rowIndex"] = .number(Double(selection.rowIndex)) }
            result[ref] = FeedDataSourceSnapshot(
                form: await dataSourceRuntime.form(dataSourceID: dataSourceID),
                collection: await dataSourceRuntime.collection(dataSourceID: dataSourceID),
                selection: selectionView
            )
        }
        return result
    }

    @discardableResult
    func applyFeedPatchOperations(
        windowID: String,
        operations: [FeedPatchOperation]
    ) async throws -> Set<String> {
        guard windowState(id: windowID) != nil else {
            throw FeedDraftRuntimeError.windowNotFound(windowID)
        }
        let metadata = await windowMetadata(id: windowID)
        var changed = Set<String>()
        for operation in operations {
            guard metadata?.dataSources[operation.dataSourceRef] != nil else {
                throw FeedDraftRuntimeError.unknownDataSource(operation.dataSourceRef)
            }
            let tokens = try feedPointerTokens(operation.path)
            guard let view = tokens.first else {
                throw FeedDraftRuntimeError.invalidPointer(operation.path)
            }
            let relative = Array(tokens.dropFirst())
            let dataSourceID = WindowIdentity(windowID: windowID).dataSourceID(ref: operation.dataSourceRef)
            switch view {
            case "form":
                var root = JSONValue.object(await dataSourceRuntime.form(dataSourceID: dataSourceID))
                try patchFeedValue(&root, tokens: relative, operation: operation)
                guard let form = root.objectValue else { throw FeedDraftRuntimeError.invalidViewShape(view) }
                await dataSourceRuntime.setForm(dataSourceID: dataSourceID, values: form)
                await (await signals.form(dataSourceID: dataSourceID)).set(form)
            case "collection":
                var root = JSONValue.array(
                    await dataSourceRuntime.collection(dataSourceID: dataSourceID).map(JSONValue.object)
                )
                try patchFeedValue(&root, tokens: relative, operation: operation)
                guard let values = root.arrayValue else { throw FeedDraftRuntimeError.invalidViewShape(view) }
                let rows = try values.map { value -> [String: JSONValue] in
                    guard let row = value.objectValue else { throw FeedDraftRuntimeError.invalidViewShape(view) }
                    return row
                }
                await dataSourceRuntime.setCollection(dataSourceID: dataSourceID, rows: rows)
                await (await signals.collection(dataSourceID: dataSourceID)).set(rows)
            case "selection":
                let current = await dataSourceRuntime.selection(dataSourceID: dataSourceID)
                var selectionView: [String: JSONValue] = [
                    "selection": .array(current.selection.map(JSONValue.object)),
                    "rowIndex": .number(Double(current.rowIndex))
                ]
                selectionView["selected"] = current.selected.map(JSONValue.object) ?? .null
                var root = JSONValue.object(selectionView)
                try patchFeedValue(&root, tokens: relative, operation: operation)
                guard let patched = root.objectValue else { throw FeedDraftRuntimeError.invalidViewShape(view) }
                let selected = patched["selected"]?.objectValue
                let selection = try (patched["selection"]?.arrayValue ?? []).map { value -> [String: JSONValue] in
                    guard let row = value.objectValue else { throw FeedDraftRuntimeError.invalidViewShape(view) }
                    return row
                }
                let rowIndex = patched["rowIndex"]?.intValue ?? -1
                let next = SelectionState(selected: selected, selection: selection, rowIndex: rowIndex)
                await dataSourceRuntime.setSelection(dataSourceID: dataSourceID, selection: next)
                await (await signals.selection(dataSourceID: dataSourceID)).set(next)
            default:
                throw FeedDraftRuntimeError.unsupportedView(view)
            }
            changed.insert(operation.dataSourceRef)
        }
        return changed
    }
}

private func feedPointerTokens(_ path: String) throws -> [String] {
    guard path.hasPrefix("/") else { throw FeedDraftRuntimeError.invalidPointer(path) }
    return path.split(separator: "/", omittingEmptySubsequences: false).dropFirst().map { token in
        token.replacingOccurrences(of: "~1", with: "/").replacingOccurrences(of: "~0", with: "~")
    }
}

private func patchFeedValue(
    _ current: inout JSONValue,
    tokens: [String],
    operation: FeedPatchOperation
) throws {
    guard let token = tokens.first else {
        guard operation.op != "remove" else { throw FeedDraftRuntimeError.missingPath("view root") }
        guard operation.op == "add" || operation.op == "replace" else {
            throw FeedDraftRuntimeError.unsupportedOperation(operation.op)
        }
        current = operation.value ?? .null
        return
    }
    let remaining = Array(tokens.dropFirst())
    switch current {
    case .object(var object):
        if remaining.isEmpty {
            switch operation.op {
            case "add": object[token] = operation.value ?? .null
            case "replace":
                guard object[token] != nil else { throw FeedDraftRuntimeError.missingPath(token) }
                object[token] = operation.value ?? .null
            case "remove":
                guard object.removeValue(forKey: token) != nil else { throw FeedDraftRuntimeError.missingPath(token) }
            default: throw FeedDraftRuntimeError.unsupportedOperation(operation.op)
            }
        } else {
            guard var child = object[token] else { throw FeedDraftRuntimeError.missingPath(token) }
            try patchFeedValue(&child, tokens: remaining, operation: operation)
            object[token] = child
        }
        current = .object(object)
    case .array(var array):
        if remaining.isEmpty {
            switch operation.op {
            case "add":
                let index = try feedArrayIndex(token, count: array.count, allowEnd: true)
                array.insert(operation.value ?? .null, at: index)
            case "replace":
                let index = try feedArrayIndex(token, count: array.count, allowEnd: false)
                array[index] = operation.value ?? .null
            case "remove":
                array.remove(at: try feedArrayIndex(token, count: array.count, allowEnd: false))
            default: throw FeedDraftRuntimeError.unsupportedOperation(operation.op)
            }
        } else {
            let index = try feedArrayIndex(token, count: array.count, allowEnd: false)
            var child = array[index]
            try patchFeedValue(&child, tokens: remaining, operation: operation)
            array[index] = child
        }
        current = .array(array)
    default:
        throw FeedDraftRuntimeError.missingPath(token)
    }
}

private func feedArrayIndex(_ token: String, count: Int, allowEnd: Bool) throws -> Int {
    if allowEnd && token == "-" { return count }
    guard let index = Int(token), index >= 0, (allowEnd ? index <= count : index < count) else {
        throw FeedDraftRuntimeError.invalidArrayIndex(token)
    }
    return index
}

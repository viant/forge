import Foundation

public extension DataSourceDef {
    var selectedFilterFields: [[String: JSONValue]] {
        let sets = filterSet.compactMap(\.objectValue)
        let selected = quickFilterSet.flatMap { name in sets.first { $0["name"]?.stringValue == name } }
            ?? sets.first { $0["default"] == .bool(true) } ?? sets.first
        return selected?["template"]?.arrayValue?.compactMap(\.objectValue) ?? []
    }
    func filterField(for identifier: String) -> String {
        let definition = selectedFilterFields.first { $0["id"]?.stringValue?.caseInsensitiveCompare(identifier) == .orderedSame }
        return definition?["field"]?.stringValue ?? identifier
    }
}

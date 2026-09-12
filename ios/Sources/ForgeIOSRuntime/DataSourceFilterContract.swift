import Foundation

public extension DataSourceDef {
    func filterField(for identifier: String) -> String {
        let sets = filterSet.compactMap(\.objectValue)
        let selected = quickFilterSet.flatMap { name in sets.first { $0["name"]?.stringValue == name } }
            ?? sets.first { $0["default"] == .bool(true) } ?? sets.first
        let fields = selected?["template"]?.arrayValue?.compactMap(\.objectValue) ?? []
        let definition = fields.first { $0["id"]?.stringValue?.caseInsensitiveCompare(identifier) == .orderedSame }
        return definition?["field"]?.stringValue ?? identifier
    }
}

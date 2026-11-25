import Foundation

/// Evaluates display-only column hooks without changing datasource records.
/// Callers retain the raw row for selection, navigation, and mutations.
public enum TableValueProjection {
    public static func value(
        row: [String: JSONValue],
        column: ColumnDef,
        code: String,
        namespace: String? = nil,
        actionNamespace: ((String) -> String?)? = nil
    ) throws -> JSONValue? {
        try override(row: row, column: column, code: code, namespace: namespace, actionNamespace: actionNamespace)
            ?? row[column.id ?? column.name ?? ""]
    }

    // An absent hook result leaves static display metadata in control.
    package static func override(row: [String: JSONValue], column: ColumnDef, code: String, namespace: String? = nil,
                                 actionNamespace: ((String) -> String?)? = nil) throws -> JSONValue? {
        let key = column.id ?? column.name ?? ""
        var value: JSONValue?
        for hook in column.on where hook.event?.lowercased() == "onvalue" {
            var name = hook.action
            if let namespace = actionNamespace?(name) ?? namespace, name.hasPrefix(namespace + ".") {
                name.removeFirst(namespace.count + 1)
            }
            if let projected = try ActionHookRuntime.invoke(
                code: code,
                functionName: name,
                props: .object(["row": .object(row), "value": value ?? row[key] ?? .null])
            ) {
                value = projected
            }
        }
        return value
    }
}

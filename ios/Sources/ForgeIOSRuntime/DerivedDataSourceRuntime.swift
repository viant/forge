import Foundation

public enum DerivedDataSourceRuntime {
    public static func run(
        sources: [String: [[String: JSONValue]]],
        spec: DerivedDataSourceSpec
    ) throws -> [[String: JSONValue]] {
        let limit = max(spec.maxRows ?? 10_000, 1)
        for ref in spec.sources where (sources[ref]?.count ?? 0) > limit {
            throw DerivedDataSourceError.message("Derived datasource source \(ref) exceeds maxRows \(limit); use a server datasource.")
        }
        var rows = sources[spec.sources.first ?? ""] ?? []
        for step in spec.pipeline {
            let operation = step.operation.lowercased()
            guard ["filter", "select", "map", "union", "join", "group", "sort"].contains(operation) else {
                throw DerivedDataSourceError.message("Unsupported derived operation: \(step.operation)")
            }
            if operation == "filter" {
                rows = rows.filter { row in
                    DashboardRuntime.evaluateDashboardCondition(step.when, form: row.compactMapValues(\.anyValue))
                }
            } else if operation == "select" || operation == "map" {
                rows = rows.map { deepMergeDerived($0, projectDerived(row: $0, step: step)) }
            } else if operation == "union" {
                let ref = try declaredDerivedSource(step.source, operation: operation, spec: spec)
                rows.append(contentsOf: sources[ref] ?? [])
            } else if operation == "join" {
                let ref = try declaredDerivedSource(step.source, operation: operation, spec: spec)
                rows = try joinDerived(left: rows, right: sources[ref] ?? [], step: step, limit: limit)
            } else if operation == "group" {
                rows = try groupDerived(rows: rows, step: step)
            } else if operation == "sort" {
                rows.sort { left, right in compareDerived(left, right, orderBy: step.orderBy ?? []) < 0 }
            }
            guard rows.count <= limit else {
                throw DerivedDataSourceError.message("Derived datasource output exceeds maxRows \(limit); use a server datasource.")
            }
        }
        return rows
    }

    private static func declaredDerivedSource(_ raw: String?, operation: String, spec: DerivedDataSourceSpec) throws -> String {
        let ref = raw?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !ref.isEmpty, spec.sources.contains(ref) else {
            throw DerivedDataSourceError.message("Derived \(operation) source \(ref.isEmpty ? "<empty>" : ref) must be declared in sources.")
        }
        return ref
    }

    private static func joinDerived(left: [[String: JSONValue]], right: [[String: JSONValue]], step: DerivedDataStepSpec, limit: Int) throws -> [[String: JSONValue]] {
        let fields = step.on?.isEmpty == false ? step.on! : ["id"]
        var rightByKey: [String: [[String: JSONValue]]] = [:]
        for row in right {
            let key = derivedIdentity(row, fields: fields)
            if step.joinCardinality?.lowercased() != "many", rightByKey[key]?.isEmpty == false {
                throw DerivedDataSourceError.message("Derived join expected one right row for key \(key).")
            }
            rightByKey[key, default: []].append(row)
        }
        var result: [[String: JSONValue]] = []
        for row in left {
            let matches = rightByKey[derivedIdentity(row, fields: fields)] ?? []
            if matches.isEmpty && step.joinType?.lowercased() == "inner" { continue }
            let selected = step.joinCardinality?.lowercased() == "many" ? (matches.isEmpty ? [[:]] : matches) : [matches.first ?? [:]]
            for match in selected {
                result.append(deepMergeDerived(row, projectDerived(row: match, step: step)))
                if result.count > limit { throw DerivedDataSourceError.message("Derived datasource output exceeds maxRows \(limit); use a server datasource.") }
            }
        }
        return result
    }

    private static func groupDerived(rows: [[String: JSONValue]], step: DerivedDataStepSpec) throws -> [[String: JSONValue]] {
        let groupFields = step.groupBy ?? []
        let grouped = Dictionary(grouping: rows) { derivedIdentity($0, fields: groupFields) }
        return try grouped.keys.sorted().map { key in
            let members = grouped[key] ?? []
            var result: [String: JSONValue] = [:]
            for field in groupFields { result[field] = resolveDerived(members.first ?? [:], field) ?? .null }
            for measure in step.measures ?? [] {
                let values = members.compactMap { row in measure.source.flatMap { resolveDerived(row, $0) } }.filter { $0 != .null }
                switch measure.operation.lowercased() {
                case "count": result[measure.target] = .number(Double(measure.source == nil ? members.count : values.count))
                case "sum": result[measure.target] = .number(values.compactMap(derivedNumber).reduce(0, +))
                case "min": result[measure.target] = values.min(by: { derivedComparable($0) < derivedComparable($1) }) ?? .null
                case "max": result[measure.target] = values.max(by: { derivedComparable($0) < derivedComparable($1) }) ?? .null
                case "first": result[measure.target] = values.first ?? .null
                case "list": result[measure.target] = .array(values)
                default: throw DerivedDataSourceError.message("Unsupported derived measure: \(measure.operation)")
                }
            }
            return result
        }
    }

    private static func projectDerived(row: [String: JSONValue], step: DerivedDataStepSpec) -> [String: JSONValue] {
        var result: [String: JSONValue] = [:]
        for (target, source) in step.fields ?? [:] {
            if case .string(let selector) = source { result[target] = resolveDerived(row, selector) ?? .null }
            else { result[target] = source }
        }
        for projection in step.projections ?? [] {
            result[projection.target] = projection.source.flatMap { resolveDerived(row, $0) } ?? projection.value ?? .null
        }
        return result
    }

    private static func compareDerived(_ left: [String: JSONValue], _ right: [String: JSONValue], orderBy: [JSONValue]) -> Int {
        for item in orderBy {
            guard let object = item.objectValue else { continue }
            let field = object["columnId"]?.stringValue ?? object["field"]?.stringValue ?? ""
            let direction = object["direction"]?.stringValue?.lowercased() ?? "asc"
            let a = resolveDerived(left, field) ?? .null
            let b = resolveDerived(right, field) ?? .null
            let comparison = derivedComparable(a).localizedStandardCompare(derivedComparable(b))
            if comparison != .orderedSame { return (comparison == .orderedAscending ? -1 : 1) * (direction == "desc" ? -1 : 1) }
        }
        return 0
    }
}

private enum DerivedDataSourceError: LocalizedError {
    case message(String)
    var errorDescription: String? { if case .message(let value) = self { return value }; return nil }
}

private func resolveDerived(_ row: [String: JSONValue], _ selector: String) -> JSONValue? {
    JSONValue(any: SelectorUtil.resolve(row.compactMapValues(\.anyValue), selector: selector))
}

private func derivedIdentity(_ row: [String: JSONValue], fields: [String]) -> String {
    fields.map { derivedComparable(resolveDerived(row, $0) ?? .null) }.joined(separator: "\u{001f}")
}

private func derivedNumber(_ value: JSONValue) -> Double? {
    switch value { case .number(let value): return value; case .string(let value): return Double(value); default: return nil }
}

private func derivedComparable(_ value: JSONValue) -> String {
    switch value {
    case .string(let value): return value
    case .number(let value): return String(format: "%020.8f", value)
    case .bool(let value): return value ? "1" : "0"
    case .null: return ""
    case .array(let values): return values.map(derivedComparable).joined(separator: ",")
    case .object(let values): return values.keys.sorted().map { "\($0)=\(derivedComparable(values[$0] ?? .null))" }.joined(separator: ",")
    }
}

private func deepMergeDerived(_ left: [String: JSONValue], _ right: [String: JSONValue]) -> [String: JSONValue] {
    var result = left
    for (key, value) in right { result[key] = value }
    return result
}

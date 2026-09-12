import Foundation

public enum ClientFilterError: Error, Equatable {
    case unsupportedOperator(String)
    case invalidOperand
}

public enum ClientFilterRuntime {
    public static func matches(_ value: JSONValue?, expected: JSONValue, operation: String) throws -> Bool {
        let actual = value ?? .null
        func text(_ value: JSONValue) -> String {
            switch value {
            case .string(let value): return value
            case .number(let value): return String(value)
            case .bool(let value): return value ? "true" : "false"
            default: return ""
            }
        }
        func equal(_ left: JSONValue, _ right: JSONValue) -> Bool {
            if left == right { return true }
            switch (left, right) {
            case (.number(let n), .string(let s)), (.string(let s), .number(let n)): return Double(s) == n
            case (.string(let a), .string(let b)): return a.caseInsensitiveCompare(b) == .orderedSame
            default: return false
            }
        }
        switch operation.lowercased() {
        case "contains":
            if case .array(let values) = actual { return values.contains { equal($0, expected) } }
            guard actual != .null else { return false }
            switch (actual, expected) {
            case (.object, _), (_, .object), (_, .array), (_, .null):
                throw ClientFilterError.invalidOperand
            default: break
            }
            return text(actual).localizedCaseInsensitiveContains(text(expected))
        case "equal", "equals", "eq", "=": return equal(actual, expected)
        case "notequal", "neq", "!=": return !equal(actual, expected)
        case "in", "notin":
            guard case .array(let candidates) = expected else { throw ClientFilterError.invalidOperand }
            let values = actual.arrayValue ?? [actual]
            let matched = values.contains { value in candidates.contains { equal(value, $0) } }
            return operation.lowercased() == "in" ? matched : !matched
        case "greaterthan", "gt", ">", "greaterorequal", "gte", ">=", "lessthan", "lt", "<", "lessorequal", "lte", "<=":
            guard let left = Double(text(actual)), let right = Double(text(expected)), left.isFinite, right.isFinite else { throw ClientFilterError.invalidOperand }
            switch operation.lowercased() {
            case "greaterthan", "gt", ">": return left > right
            case "greaterorequal", "gte", ">=": return left >= right
            case "lessthan", "lt", "<": return left < right
            default: return left <= right
            }
        default: throw ClientFilterError.unsupportedOperator(operation)
        }
    }
}

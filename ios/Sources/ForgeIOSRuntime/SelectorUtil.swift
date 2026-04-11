import Foundation

public enum SelectorUtil {
    public static func resolve(_ values: [String: JSONPrimitive], selector: String?) -> JSONPrimitive? {
        resolve(values as [String: Any], selector: selector).flatMap(JSONPrimitive.init(any:))
    }

    public static func resolve(_ value: Any?, selector: String?) -> Any? {
        guard let selector, !selector.isEmpty else {
            return value
        }

        let parts = selector
            .split(separator: ".")
            .map { String($0) }
            .filter { !$0.isEmpty }

        guard !parts.isEmpty else {
            return value
        }
        return parts.reduce(value) { partial, key in
            resolveComponent(partial, key: key)
        }
    }

    private static func resolveComponent(_ value: Any?, key: String) -> Any? {
        guard let value = unwrapOptional(value) else { return nil }

        if let primitive = value as? JSONPrimitive {
            return primitive.anyValue
        }
        if let object = value as? [String: Any] {
            return object[key]
        }
        if let object = value as? [String: JSONPrimitive] {
            return object[key]?.anyValue
        }
        if let object = value as? [String: Any?] {
            return object[key] ?? nil
        }
        if let array = value as? [Any], let index = Int(key), array.indices.contains(index) {
            return array[index]
        }
        if let array = value as? [JSONPrimitive], let index = Int(key), array.indices.contains(index) {
            return array[index].anyValue
        }

        let mirror = Mirror(reflecting: value)
        for child in mirror.children where child.label == key {
            return child.value
        }
        return nil
    }

    private static func unwrapOptional(_ value: Any?) -> Any? {
        guard let value else { return nil }
        let mirror = Mirror(reflecting: value)
        guard mirror.displayStyle == .optional else { return value }
        return mirror.children.first?.value
    }
}

extension JSONPrimitive {
    init?(any: Any?) {
        guard let any else {
            self = .null
            return
        }
        switch any {
        case let value as JSONPrimitive:
            self = value
        case let value as String:
            self = .string(value)
        case let value as Bool:
            self = .bool(value)
        case let value as Int:
            self = .number(Double(value))
        case let value as Int64:
            self = .number(Double(value))
        case let value as Double:
            self = .number(value)
        case let value as Float:
            self = .number(Double(value))
        case let value as NSNumber:
            self = .number(value.doubleValue)
        case Optional<Any>.none:
            self = .null
        default:
            return nil
        }
    }

    var anyValue: Any? {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            return value
        case .bool(let value):
            return value
        case .null:
            return nil
        }
    }
}

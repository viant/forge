import Foundation

/// Presentation is advisory; native phone controls always remain in the filter panel.
public struct ReportBuilderOption: Sendable, Identifiable {
    public let name: String
    public let label: String
    public let description: String
    public let type: String
    public let values: [(value: JSONValue, label: String)]
    public let defaultValue: JSONValue?
    public let anchorBlockId: String?
    public var id: String { name }
}

public enum ReportBuilderOptions {
    public static func text(_ value: JSONValue) -> String {
        switch value {
        case .string(let value): return value
        case .bool(let value): return value ? "true" : "false"
        case .number(let value): return value.rounded() == value ? String(format: "%.0f", value) : String(value)
        case .null: return "null"
        case .array(let values): return values.map { $0 == .null ? "" : text($0) }.joined(separator: ",")
        case .object: return "[object Object]"
        }
    }

    private static func normalizedString(_ value: JSONValue?) -> String {
        guard let value, value != .null, value != .bool(false), value != .number(0) else { return "" }
        return text(value).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public static func coerce(_ value: JSONValue?, type: String) -> JSONValue? {
        guard let value else { return nil }
        if type == "boolean" {
            if case .bool = value { return value }
            if value == .string("true") || value == .string("1") || value == .number(1) { return .bool(true) }
            if value == .string("false") || value == .string("0") || value == .number(0) { return .bool(false) }
            return nil
        }
        if type == "integer" || type == "number" {
            let numeric: Double?
            switch value {
            case .null: numeric = 0
            case .bool(let value): numeric = value ? 1 : 0
            case .number(let value): numeric = value
            default:
                let raw = text(value).trimmingCharacters(in: .whitespacesAndNewlines)
                if raw.isEmpty { numeric = 0 }
                else if raw.lowercased().hasPrefix("0x") { numeric = UInt64(raw.dropFirst(2), radix: 16).map(Double.init) }
                else if raw.lowercased().hasPrefix("0o") { numeric = UInt64(raw.dropFirst(2), radix: 8).map(Double.init) }
                else if raw.lowercased().hasPrefix("0b") { numeric = UInt64(raw.dropFirst(2), radix: 2).map(Double.init) }
                else { numeric = Double(raw) }
            }
            guard let numeric, numeric.isFinite, type != "integer" || numeric.rounded() == numeric else { return nil }
            return .number(numeric)
        }
        return value == .null ? nil : .string(text(value))
    }

    public static func normalize(_ definitions: [JSONValue]) -> [ReportBuilderOption] {
        var seen = Set<String>()
        return definitions.compactMap { entry in
            guard let source = entry.objectValue else { return nil }
            let name = normalizedString(source["name"])
            let entityName = name.replacingOccurrences(of: "[^a-zA-Z0-9]", with: "", options: .regularExpression)
            guard !name.isEmpty, !seen.contains(name), entityName.range(of: "^(account|agency|advertiser|campaign|order|line(item)?|audience|creative|pixel)(id|ids)?$", options: [.regularExpression, .caseInsensitive]) == nil else { return nil }
            seen.insert(name)
            let rawType = normalizedString(source["type"]).lowercased()
            let type = ["bool", "boolean"].contains(rawType) ? "boolean" : ["int", "integer"].contains(rawType) ? "integer" : ["number", "float", "double"].contains(rawType) ? "number" : "string"
            let values: [(value: JSONValue, label: String)] = (source["values"]?.arrayValue ?? []).compactMap { item in
                let object = item.objectValue
                guard let value = coerce(object == nil ? item : object?["value"], type: type) else { return nil }
                let label = normalizedString(object?["label"])
                return (value, label.isEmpty ? text(value) : label)
            }
            let candidate = coerce(source["default"], type: type)
            let defaultValue = candidate.flatMap { value in values.isEmpty || values.contains(where: { $0.value == value }) ? value : nil }
            let presentation = source["presentation"]?.objectValue
            let anchor = presentation?["anchorBlockId"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let label = normalizedString(source["label"])
            return ReportBuilderOption(name: name, label: label.isEmpty ? name : label, description: normalizedString(source["description"]), type: type, values: values, defaultValue: defaultValue, anchorBlockId: presentation?["placement"] == .string("header") && !anchor.isEmpty ? anchor : nil)
        }
    }

    public static func effective(_ definitions: [JSONValue], selected: [String: JSONValue]) -> [String: JSONValue] {
        var result: [String: JSONValue] = [:]
        for option in normalize(definitions) {
            if let value = coerce(selected[option.name], type: option.type), option.values.isEmpty || option.values.contains(where: { $0.value == value }) {
                result[option.name] = value
            } else { result[option.name] = option.defaultValue }
        }
        return result
    }
}

import Foundation

public enum NativeWidgetContract {
    public static let kinds: Set<String> = ["text","password","file","object","number","textarea","schema","checkbox","toggle","switch","booleanpill","chiplist","select","multiselect","link","currency","mediapreview","percentfraction2input","daterange","daterangepreset","radio","treemultiselect","progressbar","button","label","math","keyvaluepairs","markdown","document","date","datetime"]
    public static func kind(_ item: ItemDef) -> String {
        if let widget = item.widget, !widget.isEmpty { return widget.lowercased() == "input" ? "text" : widget.lowercased() }
        let type = (item.type ?? "").lowercased()
        if type == "label" { return type }
        if let format = item.format?.lowercased(), ["password","date","datetime","date-time","markdown","json"].contains(format) {
            return format == "date-time" ? "datetime" : format == "json" ? "object" : format
        }
        if item.properties["enum"]?.arrayValue?.isEmpty == false { return "select" }
        switch type {
        case "string", "input": return "text"
        case "numeric", "integer": return "number"
        case "boolean": return "checkbox"
        case "dropdown": return "select"
        default: return type.isEmpty ? (item.options.isEmpty ? "label" : "select") : type
        }
    }
    public static func truthy(_ value: JSONValue?) -> Bool {
        guard let value else { return false }
        switch value { case .null: return false; case .bool(let value): return value; case .number(let value): return value != 0; case .string(let value): return !value.isEmpty; case .array, .object: return true }
    }
    public static func initialValue(_ item: ItemDef) -> JSONValue? {
        if let value = item.value ?? item.properties["default"] { return value }
        let defaults = item.options.filter { $0.default == true }.compactMap(\.rawValue)
        return ["multiselect", "treemultiselect", "chiplist"].contains(kind(item)) ? (defaults.isEmpty ? nil : .array(defaults)) : defaults.first
    }
    public static func presentationDisabled(_ item: ItemDef) -> Bool {
        if ["link", "mediapreview", "schema", "markdown", "label", "progressbar", "treemultiselect"].contains(kind(item)) {
            return item.disabled == true || item.properties["disabled"] == .bool(true)
        }
        return disabled(item)
    }
    public static func disabled(_ item: ItemDef) -> Bool { item.disabled == true || item.readOnly == true || item.properties["disabled"] == .bool(true) || item.properties["readOnly"] == .bool(true) }
    public static func text(_ value: JSONValue?) -> String {
        guard let value, value != .null else { return "" }
        if case .string(let text) = value { return text }
        if case .number = value { return ReportBuilderOptions.text(value) }
        if case .bool = value { return ReportBuilderOptions.text(value) }
        return (try? JSONEncoder().encode(value)).flatMap { String(data: $0, encoding: .utf8) } ?? ""
    }
    public static func input(_ text: String, kind: String, properties: [String: JSONValue] = [:]) -> JSONValue? {
        if ["number","currency","percentfraction2input"].contains(kind) {
            if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return .null }
            guard let number = Double(text), number.isFinite else { return nil }
            if let minimum = properties["min"]?.widgetNumber, number < minimum { return nil }
            if let maximum = properties["max"]?.widgetNumber, number > maximum { return nil }
            return .number(kind == "percentfraction2input" ? number / 100 : number)
        }
        if kind == "object" || kind == "keyvaluepairs" {
            return try? JSONDecoder().decode(JSONValue.self, from: Data(text.utf8))
        }
        return .string(text)
    }
    public static func options(_ item: ItemDef) -> [(JSONValue, String)] {
        if let values = item.properties["enum"]?.arrayValue { return values.map { ($0, text($0)) } }
        return item.options.compactMap { option in
            guard let value = option.rawValue else { return nil }
            return (value, option.label ?? text(value))
        }
    }
}

struct NativeWidgetCodingKey: CodingKey {
    let stringValue: String
    var intValue: Int? { nil }
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
}

public extension JSONValue {
    var widgetNumber: Double? {
        if case .number(let value) = self { return value }
        if case .string(let value) = self { return Double(value) }
        return nil
    }
}

import Foundation

public enum SchemaFormRuntime {
    public static func resolvedFields(for form: SchemaBasedFormDef) -> [ResolvedSchemaField] {
        if !form.fields.isEmpty {
            return form.fields.compactMap { field in
                guard let key = field.name ?? field.label, !key.isEmpty else { return nil }
                return ResolvedSchemaField(
                    key: key,
                    label: field.label ?? key,
                    type: widgetToFieldType(widget: field.widget, schemaType: field.type, enumValues: field.enumValues),
                    required: field.required ?? false,
                    options: field.enumValues,
                    placeholder: field.placeholder,
                    defaultValue: field.defaultValue
                )
            }
        }

        guard
            let schema = form.schema?.objectValue,
            let properties = schema["properties"]?.objectValue
        else {
            return []
        }

        let requiredSet = Set(schema["required"]?.arrayValue?.compactMap(\.stringValue) ?? [])
        return properties.compactMap { name, propertyValue in
            guard let property = propertyValue.objectValue else { return nil }
            let enumValues = property["enum"]?.arrayValue?.compactMap(\.stringValue) ?? []
            let widget = property["x-ui-widget"]?.stringValue
            let schemaType = property["type"]?.stringValue
            return ResolvedSchemaField(
                key: name,
                label: property["title"]?.stringValue ?? name,
                type: widgetToFieldType(widget: widget, schemaType: schemaType, enumValues: enumValues),
                required: requiredSet.contains(name),
                options: enumValues,
                placeholder: property["description"]?.stringValue,
                defaultValue: property["default"]
            )
        }
        .sorted { $0.key < $1.key }
    }

    public static func displayValue(for value: JSONValue?) -> String {
        guard let value else { return "" }
        switch value {
        case .string(let text):
            return text
        case .number(let number):
            if number.rounded() == number {
                return String(Int(number))
            }
            return String(number)
        case .bool(let flag):
            return flag ? "true" : "false"
        case .array(let values):
            return values.compactMap(\.stringValue).joined(separator: ", ")
        case .object, .null:
            return prettyJSONString(for: value) ?? ""
        }
    }

    public static func prettyJSONString(for value: JSONValue) -> String? {
        guard let data = try? JSONEncoder().encode(value) else { return nil }
        guard
            let object = try? JSONSerialization.jsonObject(with: data),
            let pretty = try? JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted]),
            let string = String(data: pretty, encoding: .utf8)
        else {
            return nil
        }
        return string
    }

    private static func widgetToFieldType(widget: String?, schemaType: String?, enumValues: [String]) -> SchemaFieldType {
        switch (widget ?? schemaType ?? "").lowercased() {
        case "radio":
            return .radio
        case "multiselect":
            return .multiSelect
        case "textarea":
            return .textarea
        case "array":
            return enumValues.isEmpty ? .json : .multiSelect
        case "object", "schema":
            return .json
        default:
            return enumValues.isEmpty ? .text : .picker
        }
    }
}

public struct ResolvedSchemaField: Sendable, Equatable, Identifiable {
    public let key: String
    public let label: String
    public let type: SchemaFieldType
    public let required: Bool
    public let options: [String]
    public let placeholder: String?
    public let defaultValue: JSONValue?

    public var id: String { key }
}

public enum SchemaFieldType: String, Sendable, Equatable {
    case text
    case textarea
    case radio
    case picker
    case multiSelect
    case json
}

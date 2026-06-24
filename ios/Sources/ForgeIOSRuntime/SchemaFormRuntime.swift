import Foundation

public enum SchemaFormRuntime {
    public static func resolvedFields(
        for form: SchemaBasedFormDef,
        formState: [String: JSONValue] = [:]
    ) -> [ResolvedSchemaField] {
        if !form.fields.isEmpty {
            return form.fields.compactMap { field in
                let key = nonBlank(field.name) ?? nonBlank(field.label)
                guard let key else { return nil }
                return ResolvedSchemaField(
                    key: key,
                    label: nonBlank(field.label) ?? key,
                    type: widgetToFieldType(
                        widget: field.widget,
                        schemaType: field.type,
                        enumValues: field.enumValues,
                        lookup: field.lookup
                    ),
                    required: field.required ?? false,
                    options: field.enumValues,
                    placeholder: field.placeholder,
                    defaultValue: field.defaultValue,
                    widget: field.widget,
                    lookup: field.lookup
                )
            }
        }

        guard
            let schema = effectiveSchema(for: form, formState: formState)?.objectValue,
            let properties = schema["properties"]?.objectValue
        else {
            return []
        }

        let requiredSet = Set(schema["required"]?.arrayValue?.compactMap(\.stringValue) ?? [])
        return sortedSchemaProperties(properties).compactMap { name, propertyValue in
            guard let property = propertyValue.objectValue else { return nil }
            let enumValues = property["enum"]?.arrayValue?.compactMap(\.stringValue) ?? []
            let widget = property["x-ui-widget"]?.stringValue
            let schemaType = property["type"]?.stringValue
            let lookup = property["lookup"]
            return ResolvedSchemaField(
                key: name,
                label: property["title"]?.stringValue ?? name,
                type: widgetToFieldType(
                    widget: widget,
                    schemaType: schemaType,
                    enumValues: enumValues,
                    lookup: lookup
                ),
                required: requiredSet.contains(name),
                options: enumValues,
                placeholder: property["description"]?.stringValue,
                defaultValue: property["default"],
                widget: widget,
                lookup: lookup
            )
        }
    }

    private static func nonBlank(_ value: String?) -> String? {
        let text = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return text.isEmpty ? nil : text
    }

    public static func effectiveSchema(
        for form: SchemaBasedFormDef,
        formState: [String: JSONValue] = [:]
    ) -> JSONValue? {
        if let schema = form.schema {
            return schema
        }
        let trimmedSelector = form.dataBinding?.trimmingCharacters(in: .whitespacesAndNewlines)
        let selector: String
        if let trimmedSelector, !trimmedSelector.isEmpty {
            selector = trimmedSelector
        } else {
            selector = "schema"
        }
        return jsonValue(any: SelectorUtil.resolve(jsonObjectAny(formState), selector: selector))
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

    public static func validationErrors(
        fields: [ResolvedSchemaField],
        payload: [String: JSONValue]
    ) -> [String: String] {
        fields.reduce(into: [:]) { errors, field in
            let value = payload[field.key]
            if field.required && isMissing(value) {
                errors[field.key] = "Required"
                return
            }
            guard !field.options.isEmpty, let value, !isMissing(value) else {
                return
            }
            let invalid = invalidEnumValue(value, options: field.options)
            if invalid {
                errors[field.key] = "Invalid value"
            }
        }
    }

    public static func lookupDisplayValue(
        for field: ResolvedSchemaField,
        formState: [String: JSONValue],
        fallback: String = ""
    ) -> String? {
        lookupDisplayValue(lookup: field.lookup, formState: formState, fallback: fallback)
    }

    public static func lookupDisplayValue(
        lookup: JSONValue?,
        formState: [String: JSONValue],
        fallback: String = ""
    ) -> String? {
        guard let display = lookup?.objectValue?["display"]?.stringValue?
            .trimmingCharacters(in: .whitespacesAndNewlines),
              !display.isEmpty
        else {
            return nil
        }
        var resolvedAnyPlaceholder = false
        let rendered = interpolateLookupPlaceholders(display) { selector in
            guard let value = jsonValue(any: SelectorUtil.resolve(jsonObjectAny(formState), selector: selector)) else {
                return ""
            }
            let text = displayValue(for: value)
            if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                resolvedAnyPlaceholder = true
            }
            return text
        }.trimmingCharacters(in: .whitespacesAndNewlines)
        if !rendered.isEmpty, resolvedAnyPlaceholder {
            return rendered
        }
        let trimmedFallback = fallback.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmedFallback.isEmpty ? nil : trimmedFallback
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

    private static func widgetToFieldType(
        widget: String?,
        schemaType: String?,
        enumValues: [String],
        lookup: JSONValue?
    ) -> SchemaFieldType {
        switch (widget ?? schemaType ?? "").lowercased() {
        case "lookup", "treelookup":
            return .lookup
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
            if lookup?.objectValue != nil {
                return .lookup
            }
            return enumValues.isEmpty ? .text : .picker
        }
    }

    private static func sortedSchemaProperties(
        _ properties: [String: JSONValue]
    ) -> [(key: String, value: JSONValue)] {
        properties.sorted { left, right in
            let leftOrder = schemaFieldOrder(left.value)
            let rightOrder = schemaFieldOrder(right.value)
            if leftOrder != rightOrder {
                return leftOrder < rightOrder
            }
            return left.key < right.key
        }
    }

    private static func schemaFieldOrder(_ value: JSONValue) -> Double {
        guard let property = value.objectValue,
              let order = property["x-ui-order"]
        else {
            return 0
        }
        switch order {
        case .number(let number):
            return number
        case .string(let text):
            return Double(text.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0
        default:
            return 0
        }
    }

    private static func isMissing(_ value: JSONValue?) -> Bool {
        guard let value else { return true }
        switch value {
        case .string(let text):
            return text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case .array(let values):
            return values.isEmpty
        case .null:
            return true
        case .number, .bool, .object:
            return false
        }
    }

    private static func invalidEnumValue(_ value: JSONValue, options: [String]) -> Bool {
        switch value {
        case .string(let text):
            return !options.contains(text)
        case .array(let values):
            return values.compactMap(\.stringValue).contains { !options.contains($0) }
        default:
            let display = displayValue(for: value)
            return !display.isEmpty && !options.contains(display)
        }
    }

    private static func jsonValue(any value: Any?) -> JSONValue? {
        guard let value else { return nil }
        if let json = value as? JSONValue {
            return json
        }
        if let string = value as? String {
            if let data = string.data(using: .utf8),
               let decoded = try? JSONDecoder().decode(JSONValue.self, from: data),
               decoded.objectValue != nil {
                return decoded
            }
            return .string(string)
        }
        if let bool = value as? Bool {
            return .bool(bool)
        }
        if let int = value as? Int {
            return .number(Double(int))
        }
        if let int64 = value as? Int64 {
            return .number(Double(int64))
        }
        if let double = value as? Double {
            return .number(double)
        }
        if let float = value as? Float {
            return .number(Double(float))
        }
        if let number = value as? NSNumber {
            return .number(number.doubleValue)
        }
        if let object = value as? [String: JSONValue] {
            return .object(object)
        }
        if let object = value as? [String: Any] {
            return .object(object.compactMapValues { jsonValue(any: $0) })
        }
        if let array = value as? [JSONValue] {
            return .array(array)
        }
        if let array = value as? [Any] {
            return .array(array.compactMap { jsonValue(any: $0) })
        }
        return nil
    }

    private static func jsonObjectAny(_ value: [String: JSONValue]) -> [String: Any] {
        value.mapValues(jsonAnyValue)
    }

    private static func jsonAnyValue(_ value: JSONValue) -> Any {
        switch value {
        case .string(let string):
            return string
        case .number(let number):
            return number
        case .bool(let bool):
            return bool
        case .array(let values):
            return values.map(jsonAnyValue)
        case .object(let object):
            return jsonObjectAny(object)
        case .null:
            return NSNull()
        }
    }
}

private func interpolateLookupPlaceholders(
    _ template: String,
    resolve: (String) -> String
) -> String {
    var result = ""
    var index = template.startIndex
    while index < template.endIndex {
        if template[index...].hasPrefix("${"),
           let close = template[index...].firstIndex(of: "}") {
            let selectorStart = template.index(index, offsetBy: 2)
            let selector = template[selectorStart..<close].trimmingCharacters(in: .whitespacesAndNewlines)
            result += resolve(selector)
            index = template.index(after: close)
            continue
        }
        if template[index...].hasPrefix("{{"),
           let close = template[index...].range(of: "}}")?.lowerBound {
            let selectorStart = template.index(index, offsetBy: 2)
            let selector = template[selectorStart..<close].trimmingCharacters(in: .whitespacesAndNewlines)
            result += resolve(selector)
            index = template.index(close, offsetBy: 2)
            continue
        }
        result.append(template[index])
        index = template.index(after: index)
    }
    return result
}

public struct ResolvedSchemaField: Sendable, Equatable, Identifiable {
    public let key: String
    public let label: String
    public let type: SchemaFieldType
    public let required: Bool
    public let options: [String]
    public let placeholder: String?
    public let defaultValue: JSONValue?
    public let widget: String?
    public let lookup: JSONValue?

    public init(
        key: String,
        label: String,
        type: SchemaFieldType,
        required: Bool,
        options: [String],
        placeholder: String?,
        defaultValue: JSONValue?,
        widget: String? = nil,
        lookup: JSONValue? = nil
    ) {
        self.key = key
        self.label = label
        self.type = type
        self.required = required
        self.options = options
        self.placeholder = placeholder
        self.defaultValue = defaultValue
        self.widget = widget
        self.lookup = lookup
    }

    public var id: String { key }
}

public enum SchemaFieldType: String, Sendable, Equatable {
    case text
    case textarea
    case radio
    case picker
    case multiSelect
    case json
    case lookup
}

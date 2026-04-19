import Foundation

public struct DashboardSelectionState: Sendable, Equatable {
    public let dimension: String?
    public let entityKey: String?
    public let pointKey: String?
    public let selected: [String: JSONPrimitive]
    public let sourceBlockID: String?

    public init(
        dimension: String? = nil,
        entityKey: String? = nil,
        pointKey: String? = nil,
        selected: [String: JSONPrimitive] = [:],
        sourceBlockID: String? = nil
    ) {
        self.dimension = dimension
        self.entityKey = entityKey
        self.pointKey = pointKey
        self.selected = selected
        self.sourceBlockID = sourceBlockID
    }
}

public enum DashboardRuntime {
    public static func evaluate(
        _ condition: DashboardConditionDef?,
        value: JSONPrimitive?
    ) -> Bool {
        evaluateDashboardCondition(
            condition,
            metrics: ["value": value?.anyValue as Any],
            filters: [:],
            selection: DashboardSelectionState()
        )
    }

    public static func evaluateDashboardCondition(
        _ condition: DashboardConditionDef?,
        metrics: [String: Any] = [:],
        filters: [String: Any] = [:],
        selection: DashboardSelectionState = DashboardSelectionState()
    ) -> Bool {
        guard let condition else { return true }
        let selector = condition.selector ?? condition.field ?? condition.key
        let actual = resolveDashboardValue(
            source: condition.source,
            selector: selector,
            metrics: metrics,
            filters: filters,
            selection: selection
        )

        if let expected = condition.whenValue, !dashboardValuesEqual(actual: actual, expected: expected) {
            return false
        }

        if let equals = condition.equals, !dashboardValuesEqual(actual: actual, expected: equals) {
            return false
        }
        if let notEquals = condition.notEquals, dashboardValuesEqual(actual: actual, expected: notEquals) {
            return false
        }
        if !condition.inValues.isEmpty && !condition.inValues.contains(where: { dashboardValuesEqual(actual: actual, expected: $0) }) {
            return false
        }

        if let number = numericValue(actual) {
            if let gt = condition.gt, !(number > gt) { return false }
            if let gte = condition.gte, !(number >= gte) { return false }
            if let lt = condition.lt, !(number < lt) { return false }
            if let lte = condition.lte, !(number <= lte) { return false }
        }

        if let empty = condition.empty, isEmpty(actual) != empty {
            return false
        }

        if let notEmpty = condition.notEmpty {
            if isPresent(actual) != notEmpty {
                return false
            }
        }

        return true
    }

    public static func resolveDashboardValue(
        source: String?,
        selector: String?,
        metrics: [String: Any] = [:],
        filters: [String: Any] = [:],
        selection: DashboardSelectionState = DashboardSelectionState()
    ) -> Any? {
        let selectionPayload = selectionDictionary(selection)

        guard let selector, !selector.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            switch source?.lowercased() {
            case "selection":
                return selectionPayload
            case "filters", "filter":
                return filters
            default:
                return metrics
            }
        }

        switch source?.lowercased() {
        case "selection":
            return SelectorUtil.resolve(selectionPayload, selector: selector)
        case "filters", "filter":
            return SelectorUtil.resolve(filters, selector: selector)
        default:
            if selector.hasPrefix("filters.") {
                return SelectorUtil.resolve(filters, selector: String(selector.dropFirst("filters.".count)))
            }
            if selector.hasPrefix("selection.") {
                return SelectorUtil.resolve(selectionPayload, selector: String(selector.dropFirst("selection.".count)))
            }
            return SelectorUtil.resolve(metrics, selector: selector)
        }
    }

    public static func interpolateDashboardTemplate(
        _ template: String,
        metrics: [String: Any] = [:],
        filters: [String: Any] = [:],
        selection: DashboardSelectionState = DashboardSelectionState()
    ) -> String {
        let patterns = [#"\$\{\s*([^}]+)\s*\}"#, #"\{\{\s*([^}]+)\s*\}\}"#]
        return patterns.reduce(template) { (partial: String, pattern: String) -> String in
            partial.replacingMatches(
                of: pattern,
                with: { selector in
                    let value = resolveDashboardValue(
                        source: nil,
                        selector: selector,
                        metrics: metrics,
                        filters: filters,
                        selection: selection
                    )
                    return unwrapOptional(value).map { String(describing: $0) } ?? ""
                }
            )
        }
    }

    public static func formatDashboardValue(_ value: Any?, format: String?) -> String {
        guard let value = unwrapOptional(value) else { return "n/a" }
        let normalized = format?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let locale = Locale(identifier: "en_US")
        switch normalized {
        case "currency":
            if let number = numericValue(value) {
                let formatter = NumberFormatter()
                formatter.locale = locale
                formatter.numberStyle = .currency
                return formatter.string(from: NSNumber(value: number)) ?? String(describing: value)
            }
        case "percent":
            if let number = numericValue(value) {
                let formatter = NumberFormatter()
                formatter.locale = locale
                formatter.numberStyle = .decimal
                formatter.maximumFractionDigits = 1
                return "\(formatter.string(from: NSNumber(value: number)) ?? String(number))%"
            }
        case "integer":
            if let number = numericValue(value) {
                let formatter = NumberFormatter()
                formatter.locale = locale
                formatter.numberStyle = .decimal
                formatter.maximumFractionDigits = 0
                return formatter.string(from: NSNumber(value: number)) ?? String(Int(number))
            }
        case "compactnumber":
            if let number = numericValue(value) {
                return formatCompactNumber(number, locale: locale)
            }
        case "number":
            if let number = numericValue(value) {
                let formatter = NumberFormatter()
                formatter.locale = locale
                formatter.numberStyle = .decimal
                return formatter.string(from: NSNumber(value: number)) ?? String(number)
            }
        default:
            break
        }
        return String(describing: value)
    }

    private static func selectionDictionary(_ selection: DashboardSelectionState) -> [String: Any] {
        [
            "dimension": selection.dimension as Any,
            "entityKey": selection.entityKey as Any,
            "pointKey": selection.pointKey as Any,
            "selected": Dictionary(uniqueKeysWithValues: selection.selected.map { ($0.key, $0.value.anyValue as Any) }),
            "sourceBlockId": selection.sourceBlockID as Any
        ]
    }

    private static func dashboardValuesEqual(actual: Any?, expected: JSONPrimitive) -> Bool {
        let actual = unwrapOptional(actual)
        guard expected.anyValue != nil else { return actual == nil }
        switch expected {
        case .string(let string):
            return String(describing: actual ?? "") == string
        case .bool(let bool):
            if let actualBool = actual as? Bool {
                return actualBool == bool
            }
            return false
        case .number(let number):
            return numericValue(actual) == number
        case .null:
            return actual == nil
        }
    }

    private static func numericValue(_ value: Any?) -> Double? {
        let value = unwrapOptional(value)
        switch value {
        case let number as Double:
            return number
        case let number as Float:
            return Double(number)
        case let number as Int:
            return Double(number)
        case let number as Int64:
            return Double(number)
        case let number as NSNumber:
            return number.doubleValue
        case let primitive as JSONPrimitive:
            if case .number(let number) = primitive { return number }
            return nil
        default:
            return nil
        }
    }

    private static func isEmpty(_ value: Any?) -> Bool {
        let value = unwrapOptional(value)
        switch value {
        case nil:
            return true
        case let string as String:
            return string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case let array as [Any]:
            return array.isEmpty
        case let object as [String: Any]:
            return object.isEmpty
        case let object as [String: JSONPrimitive]:
            return object.isEmpty
        case let primitive as JSONPrimitive:
            switch primitive {
            case .string(let string):
                return string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            case .null:
                return true
            default:
                return false
            }
        default:
            return false
        }
    }

    private static func isPresent(_ value: Any?) -> Bool {
        !isEmpty(value)
    }

    private static func formatCompactNumber(_ value: Double, locale: Locale) -> String {
        let absolute = abs(value)
        let scaled: Double
        let suffix: String
        switch absolute {
        case 1_000_000_000...:
            scaled = value / 1_000_000_000
            suffix = "B"
        case 1_000_000...:
            scaled = value / 1_000_000
            suffix = "M"
        case 1_000...:
            scaled = value / 1_000
            suffix = "K"
        default:
            scaled = value
            suffix = ""
        }
        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = suffix.isEmpty ? 0 : 1
        formatter.minimumFractionDigits = 0
        return (formatter.string(from: NSNumber(value: scaled)) ?? String(scaled)) + suffix
    }

    private static func unwrapOptional(_ value: Any?) -> Any? {
        guard let value else { return nil }
        let mirror = Mirror(reflecting: value)
        guard mirror.displayStyle == .optional else { return value }
        return mirror.children.first?.value
    }
}

private extension String {
    func replacingMatches(
        of pattern: String,
        with transform: (String) -> String
    ) -> String {
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return self
        }
        let nsRange = NSRange(startIndex..<endIndex, in: self)
        var result = self
        let matches = regex.matches(in: self, range: nsRange).reversed()
        for match in matches {
            guard match.numberOfRanges > 1,
                  let fullRange = Range(match.range(at: 0), in: result),
                  let captureRange = Range(match.range(at: 1), in: result) else {
                continue
            }
            let replacement = transform(String(result[captureRange]).trimmingCharacters(in: .whitespacesAndNewlines))
            result.replaceSubrange(fullRange, with: replacement)
        }
        return result
    }
}

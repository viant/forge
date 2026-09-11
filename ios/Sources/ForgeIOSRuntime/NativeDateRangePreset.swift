import Foundation

public enum NativeDateRangePreset {
    public static func patch(item: ItemDef, value: JSONValue, metrics: [String: JSONValue] = [:], now: Date = Date()) -> [String: JSONValue]? {
        func setting(_ key: String, fallback: String) -> String {
            if let selector = item.properties[key + "Selector"]?.stringValue {
                let resolved = SelectorUtil.resolve(metrics, selector: selector)
                if let text = resolved as? String { return text }
                if let json = resolved as? JSONValue, let text = json.stringValue { return text }
            }
            return item.properties[key]?.stringValue ?? fallback
        }
        guard let range = resolve(NativeWidgetContract.text(value), now: now, timeZone: setting("timeZone", fallback: "UTC"), lifetimeStart: setting("lifetimeStart", fallback: "2026-01-01")) else { return nil }
        return [item.properties["startField"]?.stringValue ?? "customDateStart": range["start"]!, item.properties["endField"]?.stringValue ?? "customDateEnd": range["end"]!, item.properties["granularityField"]?.stringValue ?? "granularity": range["granularity"]!]
    }
    public static func resolve(_ value: String, now: Date = Date(), timeZone: String = "UTC", lifetimeStart: String = "2026-01-01") -> [String: JSONValue]? {
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(identifier: timeZone) ?? TimeZone(secondsFromGMT: 0)!
        let today = calendar.startOfDay(for: now)
        let components = calendar.dateComponents([.year, .month, .day], from: today)
        func date(_ year: Int, _ month: Int, _ day: Int) -> Date { calendar.date(from: DateComponents(year: year, month: month, day: day))! }
        let year = components.year!, month = components.month!, day = components.day!
        var start = today, end = today
        switch value.lowercased() {
        case "today": break
        case "yesterday": start = calendar.date(byAdding: .day, value: -1, to: today)!; end = start
        case "week": start = calendar.date(byAdding: .day, value: -6, to: today)!
        case "month": start = calendar.date(byAdding: .month, value: -1, to: today)!
        case "month_to_date": start = date(year,month,1)
        case "last_month": start = date(year,month-1,1); end = calendar.date(byAdding: .day, value: -1, to: date(year,month,1))!
        case "quarter_to_date": start = date(year,((month-1)/3)*3+1,1)
        case "year_to_date": start = date(year,1,1)
        case "year": start = date(year-1,month,day)
        case "last_year": start = date(year-1,1,1); end = date(year-1,12,31)
        case "lifetime": break
        default: return nil
        }
        let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.timeZone = calendar.timeZone; formatter.dateFormat = "yyyy-MM-dd"
        let days = (calendar.dateComponents([.day], from: start, to: end).day ?? 0) + 1
        return ["start": .string(value.lowercased() == "lifetime" ? lifetimeStart : formatter.string(from: start)), "end": .string(formatter.string(from: end)), "granularity": .string(value.lowercased() != "lifetime" && days <= 2 ? "hour" : "day")]
    }
}

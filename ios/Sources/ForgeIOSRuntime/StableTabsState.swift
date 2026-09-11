import Foundation

public enum StableTabsState {
    public static func selected(ids: [String], requested: String?, fallback: String?) -> String? {
        if let requested, ids.contains(requested) { return requested }
        if let fallback, ids.contains(fallback) { return fallback }
        return ids.first
    }
    public static func mounted(ids: [String], selected: String?, visited: Set<String>, keepVisited: Bool, activeOnly: Bool) -> [String] {
        if !activeOnly && !keepVisited { return ids }
        return ids.filter { $0 == selected || (keepVisited && visited.contains($0)) }
    }
}

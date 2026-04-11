import Foundation

public enum FenceDescriptorKind: String, Sendable, CaseIterable {
    case mermaid
    case flowchart
    case sequence
    case classDiagram
    case stateDiagram
    case erDiagram
    case pie
    case timeline
    case gantt
}

public enum FenceDescriptors {
    public static func detect(_ source: String) -> FenceDescriptorKind? {
        let trimmed = source.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if trimmed.hasPrefix("flowchart") { return .flowchart }
        if trimmed.hasPrefix("sequenceDiagram".lowercased()) { return .sequence }
        if trimmed.hasPrefix("classDiagram".lowercased()) { return .classDiagram }
        if trimmed.hasPrefix("stateDiagram".lowercased()) { return .stateDiagram }
        if trimmed.hasPrefix("erDiagram".lowercased()) { return .erDiagram }
        if trimmed.hasPrefix("pie") { return .pie }
        if trimmed.hasPrefix("timeline") { return .timeline }
        if trimmed.hasPrefix("gantt") { return .gantt }
        if trimmed.hasPrefix("graph") || trimmed.hasPrefix("mermaid") { return .mermaid }
        return nil
    }
}

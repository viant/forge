import Foundation

public enum ReportRuntimeStructure {
    public static func composites(_ blocks: [DashboardReportRuntimeBlockSummary]) -> [DashboardReportRuntimeBlockSummary] {
        let index = Dictionary(blocks.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        var parents: [String: String] = [:]
        var children: [String: [String]] = [:]
        for block in blocks where block.kind == "compositeBlock" {
            for value in block.content["childBlockIds"]?.arrayValue ?? [] {
                guard let child = value.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines), !child.isEmpty, index[child] != nil, parents[child] == nil else { continue }
                var ancestor: String? = block.id
                while let current = ancestor, current != child { ancestor = parents[current] }
                guard ancestor != child else { continue }
                parents[child] = block.id
                children[block.id, default: []].append(child)
            }
        }
        func attach(_ block: DashboardReportRuntimeBlockSummary) -> DashboardReportRuntimeBlockSummary {
            var result = block
            result.compositeParentID = parents[block.id]
            result.children = (children[block.id] ?? []).compactMap { index[$0] }.map(attach)
            return result
        }
        return blocks.map(attach)
    }
}

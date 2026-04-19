import SwiftUI

public struct MarkdownRenderer: View {
    private let markdown: String

    public init(markdown: String) {
        self.markdown = markdown
    }

    public var body: some View {
        let blocks = parseMarkdownBlocks(markdown)
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                switch block {
                case .markdown(let text):
                    if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Text(.init(text))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                case .mermaid(let source):
                    MermaidRenderer(source: source)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

enum MarkdownBlock: Equatable {
    case markdown(String)
    case mermaid(String)
}

struct MermaidFlowchart: Equatable {
    let nodes: [String]
}

struct MermaidPieSlice: Equatable {
    let label: String
    let value: Double
}

enum MermaidDiagram: Equatable {
    case flowchart(MermaidFlowchart)
    case pie([MermaidPieSlice])
}

private struct MermaidRenderer: View {
    let source: String

    var body: some View {
        let diagram = parseMermaidDiagram(source)
        VStack(alignment: .leading, spacing: 10) {
            Text("MERMAID")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            switch diagram {
            case .flowchart(let chart):
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(chart.nodes.enumerated()), id: \.offset) { index, node in
                        Text(node)
                            .font(.body.weight(.semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                        if index != chart.nodes.indices.last {
                            Text("↓")
                                .font(.headline)
                                .foregroundStyle(.secondary)
                                .padding(.leading, 10)
                        }
                    }
                }
            case .pie(let slices):
                MermaidPieChart(slices: slices)
            case nil:
                Text(source)
                    .font(.body)
            }
        }
        .padding(12)
        .background(Color.secondary.opacity(0.04), in: RoundedRectangle(cornerRadius: 16))
    }
}

private struct MermaidPieChart: View {
    let slices: [MermaidPieSlice]

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            GeometryReader { geometry in
                let frame = min(geometry.size.width, geometry.size.height)
                let radius = frame / 2
                let total = max(slices.reduce(0.0) { $0 + $1.value }, 0.001)
                ZStack {
                    ForEach(Array(slices.enumerated()), id: \.offset) { index, slice in
                        let start = angleStart(at: index, total: total)
                        let end = angleEnd(at: index, total: total)
                        PieSliceShape(startAngle: .degrees(start), endAngle: .degrees(end))
                            .fill(pieColor(index))
                    }
                    Circle()
                        .fill(Color.white)
                        .frame(width: radius * 0.7, height: radius * 0.7)
                }
                .frame(width: frame, height: frame)
            }
            .frame(width: 180, height: 180)

            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(slices.enumerated()), id: \.offset) { index, slice in
                    HStack(spacing: 8) {
                        Circle()
                            .fill(pieColor(index))
                            .frame(width: 10, height: 10)
                        Text(slice.label)
                            .font(.body.weight(.semibold))
                        Spacer()
                        Text(formatPieValue(slice.value))
                            .font(.body.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    private func angleStart(at index: Int, total: Double) -> Double {
        guard index > 0 else { return -90 }
        let previous = slices.prefix(index).reduce(0.0) { $0 + $1.value }
        return (previous / total) * 360.0 - 90.0
    }

    private func angleEnd(at index: Int, total: Double) -> Double {
        let current = slices.prefix(index + 1).reduce(0.0) { $0 + $1.value }
        return (current / total) * 360.0 - 90.0
    }

    private func pieColor(_ index: Int) -> Color {
        let palette: [Color] = [.blue, .green, .orange, .purple, .pink, .teal]
        return palette[index % palette.count]
    }

    private func formatPieValue(_ value: Double) -> String {
        if value.rounded(.towardZero) == value {
            return String(Int(value))
        }
        return String(format: "%.2f", value)
    }
}

private struct PieSliceShape: Shape {
    let startAngle: Angle
    let endAngle: Angle

    func path(in rect: CGRect) -> Path {
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let radius = min(rect.width, rect.height) / 2
        var path = Path()
        path.move(to: center)
        path.addArc(
            center: center,
            radius: radius,
            startAngle: startAngle,
            endAngle: endAngle,
            clockwise: false
        )
        path.closeSubpath()
        return path
    }
}

internal func parseMarkdownBlocks(_ source: String) -> [MarkdownBlock] {
    guard !source.isEmpty else { return [.markdown("(empty response)")] }
    let lines = source.split(separator: "\n", omittingEmptySubsequences: false)
    var blocks: [MarkdownBlock] = []
    var markdownBuffer: [String] = []
    var fenceLanguage: String?
    var fenceBuffer: [String] = []

    func flushMarkdown() {
        let text = markdownBuffer.joined(separator: "\n")
        if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            blocks.append(.markdown(text))
        }
        markdownBuffer.removeAll()
    }

    func flushFence() {
        let body = fenceBuffer.joined(separator: "\n")
        let language = fenceLanguage?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        if language == "mermaid" || FenceDescriptors.detect(body) != nil {
            blocks.append(.mermaid(body))
        } else {
            blocks.append(.markdown("```\(fenceLanguage ?? "")\n\(body)\n```"))
        }
        fenceLanguage = nil
        fenceBuffer.removeAll()
    }

    for line in lines {
        let value = String(line)
        if let language = fenceLanguage {
            if value.trimmingCharacters(in: .whitespacesAndNewlines) == "```" {
                flushFence()
            } else {
                fenceBuffer.append(value)
            }
            _ = language
            continue
        }

        if value.hasPrefix("```") {
            flushMarkdown()
            fenceLanguage = String(value.dropFirst(3))
            continue
        }
        markdownBuffer.append(value)
    }

    if fenceLanguage != nil {
        flushFence()
    } else {
        flushMarkdown()
    }

    return blocks.isEmpty ? [.markdown(source)] : blocks
}

internal func parseMermaidDiagram(_ source: String) -> MermaidDiagram? {
    parseMermaidFlowchart(source) ?? parseMermaidPie(source)
}

private func parseMermaidFlowchart(_ source: String) -> MermaidDiagram? {
    let lines = source.lines.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    guard let header = lines.first?.lowercased(), header.hasPrefix("flowchart") || header.hasPrefix("graph") else {
        return nil
    }
    let pattern = try! NSRegularExpression(pattern: #"([A-Za-z0-9_]+)\[([^\]]+)\]"#)
    var ordered: [String] = []
    var seen = Set<String>()
    for line in lines.dropFirst() {
        let matches = pattern.matches(in: line, range: NSRange(line.startIndex..., in: line))
        for match in matches {
            guard let labelRange = Range(match.range(at: 2), in: line) else { continue }
            let label = String(line[labelRange]).trimmingCharacters(in: .whitespacesAndNewlines)
            if !label.isEmpty && !seen.contains(label) {
                seen.insert(label)
                ordered.append(label)
            }
        }
    }
    guard !ordered.isEmpty else { return nil }
    return .flowchart(MermaidFlowchart(nodes: ordered))
}

private func parseMermaidPie(_ source: String) -> MermaidDiagram? {
    let lines = source.lines.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    guard let header = lines.first?.lowercased(), header.hasPrefix("pie") else {
        return nil
    }
    let slicePattern = try! NSRegularExpression(pattern: #"^"?([^":]+)"?\s*:\s*(.+)$"#)
    var slices: [MermaidPieSlice] = []
    for line in lines.dropFirst() {
        if line.lowercased().hasPrefix("title ") || line.lowercased() == "showdata" {
            continue
        }
        guard let match = slicePattern.firstMatch(in: line, range: NSRange(line.startIndex..., in: line)),
              let labelRange = Range(match.range(at: 1), in: line),
              let valueRange = Range(match.range(at: 2), in: line),
              let value = Double(String(line[valueRange]).trimmingCharacters(in: .whitespacesAndNewlines))
        else {
            continue
        }
        slices.append(
            MermaidPieSlice(
                label: String(line[labelRange]).trimmingCharacters(in: .whitespacesAndNewlines),
                value: value
            )
        )
    }
    guard !slices.isEmpty else { return nil }
    return .pie(slices)
}

private extension String {
    var lines: [String] {
        components(separatedBy: .newlines)
    }
}

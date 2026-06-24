import SwiftUI
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

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
                case .code(let language, let body):
                    MarkdownCodeBlock(language: language, code: body)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

enum MarkdownBlock: Equatable {
    case markdown(String)
    case mermaid(String)
    case code(language: String, body: String)
}

internal enum MarkdownCodeHighlightKind: Equatable {
    case plain
    case keyword
    case literal
    case string
    case number
    case comment
    case punctuation
}

internal struct MarkdownCodeHighlightRun: Equatable {
    let text: String
    let kind: MarkdownCodeHighlightKind
}

struct MermaidFlowchart: Equatable {
    let nodes: [String]
}

struct MermaidPieSlice: Equatable {
    let label: String
    let value: Double
}

struct MermaidSequenceMessage: Equatable {
    let from: String
    let to: String
    let text: String
}

struct MermaidClass: Equatable {
    let name: String
    let members: [String]
}

struct MermaidRelation: Equatable {
    let from: String
    let to: String
    let label: String?
}

struct MermaidTimelineEvent: Equatable {
    let time: String
    let label: String
}

struct MermaidGanttTask: Equatable {
    let section: String?
    let name: String
    let start: String?
    let end: String?
    let tags: [String]
}

enum MermaidDiagram: Equatable {
    case flowchart(MermaidFlowchart)
    case sequence(actors: [String], messages: [MermaidSequenceMessage])
    case classDiagram(classes: [MermaidClass], relations: [MermaidRelation])
    case state(states: [String], transitions: [MermaidRelation])
    case entityRelationship(entities: [String], relations: [MermaidRelation])
    case pie([MermaidPieSlice])
    case timeline([MermaidTimelineEvent])
    case gantt([MermaidGanttTask])
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
            case .sequence(let actors, let messages):
                MermaidSection(title: "Actors", values: actors)
                MermaidRelations(
                    rows: messages.map { MermaidRelation(from: $0.from, to: $0.to, label: $0.text) }
                )
            case .classDiagram(let classes, let relations):
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(classes, id: \.name) { item in
                        MermaidCard(title: item.name, lines: item.members)
                    }
                    MermaidRelations(rows: relations)
                }
            case .state(let states, let transitions):
                MermaidSection(title: "States", values: states)
                MermaidRelations(rows: transitions)
            case .entityRelationship(let entities, let relations):
                MermaidSection(title: "Entities", values: entities)
                MermaidRelations(rows: relations)
            case .pie(let slices):
                MermaidPieChart(slices: slices)
            case .timeline(let events):
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(events.enumerated()), id: \.offset) { _, event in
                        MermaidMetricRow(label: event.time, value: event.label)
                    }
                }
            case .gantt(let tasks):
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(tasks.enumerated()), id: \.offset) { _, task in
                        MermaidCard(
                            title: task.name,
                            lines: ganttTaskLines(task)
                        )
                    }
                }
            case nil:
                Text(source)
                    .font(.body)
            }
        }
        .padding(12)
        .background(Color.secondary.opacity(0.04), in: RoundedRectangle(cornerRadius: 16))
    }
}

private struct MarkdownCodeBlock: View {
    let language: String
    let code: String
    @State private var copied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                if !language.isEmpty {
                    Text(language.uppercased())
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 8)
                Button {
                    writeMarkdownCodeToPasteboard(code)
                    copied = true
                } label: {
                    Label(copied ? "Copied" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc")
                }
                .buttonStyle(.borderless)
                .font(.caption.weight(.semibold))
                .accessibilityLabel(markdownCodeCopyAccessibilityLabel(language: language))
            }
            ScrollView(.horizontal, showsIndicators: true) {
                Text(markdownCodeHighlightedAttributedString(language: language, body: code.isEmpty ? " " : code))
                    .font(.system(.caption, design: .monospaced))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityLabel(markdownCodeAccessibilityLabel(language: language, body: code))
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .contain)
    }
}

private struct MermaidSection: View {
    let title: String
    let values: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            FlowLayout(values: values) { value in
                Text(value)
                    .font(.subheadline.weight(.medium))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.secondary.opacity(0.08), in: Capsule())
            }
        }
    }
}

private struct MermaidRelations: View {
    let rows: [MermaidRelation]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                MermaidMetricRow(
                    label: "\(row.from) -> \(row.to)",
                    value: row.label ?? ""
                )
            }
        }
    }
}

private struct MermaidCard: View {
    let title: String
    let lines: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title)
                .font(.body.weight(.semibold))
            ForEach(lines, id: \.self) { line in
                Text(line)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }
}

private struct MermaidMetricRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Text(label)
                .font(.subheadline.weight(.semibold))
            Spacer(minLength: 8)
            if !value.isEmpty {
                Text(value)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.trailing)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
    }
}

private struct FlowLayout<Content: View>: View {
    let values: [String]
    let content: (String) -> Content

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 8)], alignment: .leading, spacing: 8) {
            ForEach(values, id: \.self) { value in
                content(value)
            }
        }
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
        let language = normalizedMarkdownFenceLanguage(fenceLanguage)
        if language == "mermaid" || FenceDescriptors.detect(body) != nil {
            blocks.append(.mermaid(body))
        } else {
            blocks.append(.code(language: language, body: body))
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

internal func normalizedMarkdownFenceLanguage(_ rawValue: String?) -> String {
    (rawValue ?? "")
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
}

internal func markdownCodeAccessibilityLabel(language: String, body: String) -> String {
    let cleanLanguage = normalizedMarkdownFenceLanguage(language)
    let lineCount = body.isEmpty ? 0 : body.split(separator: "\n", omittingEmptySubsequences: false).count
    let lineLabel = lineCount == 1 ? "1 line" : "\(lineCount) lines"
    if cleanLanguage.isEmpty {
        return "Code block, \(lineLabel)"
    }
    return "\(cleanLanguage) code block, \(lineLabel)"
}

internal func markdownCodeCopyAccessibilityLabel(language: String) -> String {
    let cleanLanguage = normalizedMarkdownFenceLanguage(language)
    if cleanLanguage.isEmpty {
        return "Copy code block"
    }
    return "Copy \(cleanLanguage) code block"
}

internal func markdownCodeHighlightRuns(language: String, body: String) -> [MarkdownCodeHighlightRun] {
    guard !body.isEmpty else { return [] }
    let cleanLanguage = normalizedMarkdownFenceLanguage(language)
    let keywordSet = markdownCodeKeywords(for: cleanLanguage)
    let literalSet: Set<String> = ["true", "false", "null", "nil", "none"]
    let characters = Array(body)
    var runs: [MarkdownCodeHighlightRun] = []
    var index = 0

    func append(_ text: String, _ kind: MarkdownCodeHighlightKind) {
        guard !text.isEmpty else { return }
        if let last = runs.last, last.kind == kind {
            runs[runs.count - 1] = MarkdownCodeHighlightRun(text: last.text + text, kind: kind)
        } else {
            runs.append(MarkdownCodeHighlightRun(text: text, kind: kind))
        }
    }

    func string(from start: Int, to end: Int) -> String {
        guard start < end else { return "" }
        return String(characters[start..<end])
    }

    while index < characters.count {
        let current = characters[index]
        if current.isWhitespaceOrNewline {
            let start = index
            while index < characters.count, characters[index].isWhitespaceOrNewline {
                index += 1
            }
            append(string(from: start, to: index), .plain)
            continue
        }
        if current == "/" && index + 1 < characters.count && characters[index + 1] == "/" {
            let start = index
            index += 2
            while index < characters.count, characters[index] != "\n" {
                index += 1
            }
            append(string(from: start, to: index), .comment)
            continue
        }
        if current == "-" && index + 1 < characters.count && characters[index + 1] == "-" {
            let start = index
            index += 2
            while index < characters.count, characters[index] != "\n" {
                index += 1
            }
            append(string(from: start, to: index), .comment)
            continue
        }
        if current == "#" && cleanLanguage != "json" {
            let start = index
            index += 1
            while index < characters.count, characters[index] != "\n" {
                index += 1
            }
            append(string(from: start, to: index), .comment)
            continue
        }
        if current == "\"" || current == "'" {
            let quote = current
            let start = index
            index += 1
            var escaped = false
            while index < characters.count {
                let value = characters[index]
                index += 1
                if escaped {
                    escaped = false
                    continue
                }
                if value == "\\" {
                    escaped = true
                    continue
                }
                if value == quote {
                    break
                }
            }
            append(string(from: start, to: index), .string)
            continue
        }
        if current.isNumberStart(next: index + 1 < characters.count ? characters[index + 1] : nil) {
            let start = index
            index += 1
            while index < characters.count, characters[index].isNumberContinuation {
                index += 1
            }
            append(string(from: start, to: index), .number)
            continue
        }
        if current.isIdentifierStart {
            let start = index
            index += 1
            while index < characters.count, characters[index].isIdentifierContinuation {
                index += 1
            }
            let value = string(from: start, to: index)
            let lowercased = value.lowercased()
            if literalSet.contains(lowercased) {
                append(value, .literal)
            } else if keywordSet.contains(lowercased) {
                append(value, .keyword)
            } else {
                append(value, .plain)
            }
            continue
        }
        if current.isCodePunctuation {
            append(String(current), .punctuation)
        } else {
            append(String(current), .plain)
        }
        index += 1
    }

    return runs
}

private func markdownCodeHighlightedAttributedString(language: String, body: String) -> AttributedString {
    var attributed = AttributedString()
    for run in markdownCodeHighlightRuns(language: language, body: body) {
        var chunk = AttributedString(run.text)
        chunk.foregroundColor = markdownCodeHighlightColor(run.kind)
        attributed += chunk
    }
    return attributed
}

private func markdownCodeHighlightColor(_ kind: MarkdownCodeHighlightKind) -> Color {
    switch kind {
    case .plain:
        return .primary
    case .keyword:
        return .blue
    case .literal:
        return .purple
    case .string:
        return .green
    case .number:
        return .orange
    case .comment:
        return .secondary
    case .punctuation:
        return .secondary
    }
}

private func markdownCodeKeywords(for language: String) -> Set<String> {
    switch language {
    case "swift":
        return [
            "actor", "as", "associatedtype", "await", "case", "catch", "class", "continue", "default", "defer",
            "do", "else", "enum", "extension", "for", "func", "guard", "if", "import", "in", "init", "let",
            "private", "public", "return", "self", "static", "struct", "switch", "throw", "throws", "try",
            "var", "while"
        ]
    case "kotlin", "kt", "java":
        return [
            "as", "break", "catch", "class", "continue", "data", "else", "false", "for", "fun", "if", "import",
            "in", "interface", "is", "null", "object", "override", "package", "private", "public", "return",
            "sealed", "suspend", "true", "try", "val", "var", "when", "while"
        ]
    case "javascript", "js", "typescript", "ts", "jsx", "tsx":
        return [
            "async", "await", "break", "case", "catch", "class", "const", "continue", "default", "else",
            "export", "extends", "finally", "for", "from", "function", "if", "import", "let", "new", "return",
            "switch", "throw", "try", "typeof", "var", "while", "yield"
        ]
    case "sql":
        return [
            "and", "as", "asc", "by", "case", "desc", "else", "end", "from", "group", "having", "in", "inner",
            "insert", "join", "left", "limit", "not", "null", "on", "or", "order", "outer", "right", "select",
            "then", "union", "update", "when", "where", "with"
        ]
    case "json":
        return []
    default:
        return [
            "and", "async", "await", "case", "class", "const", "else", "enum", "false", "for", "func",
            "function", "if", "import", "let", "null", "return", "select", "struct", "true", "var", "where"
        ]
    }
}

private func writeMarkdownCodeToPasteboard(_ value: String) {
    #if os(iOS)
    UIPasteboard.general.string = value
    #elseif os(macOS)
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(value, forType: .string)
    #else
    _ = value
    #endif
}

private extension Character {
    var isWhitespaceOrNewline: Bool {
        unicodeScalars.allSatisfy { CharacterSet.whitespacesAndNewlines.contains($0) }
    }

    var isIdentifierStart: Bool {
        guard let scalar = unicodeScalars.first else { return false }
        return scalar == "_" || CharacterSet.letters.contains(scalar)
    }

    var isIdentifierContinuation: Bool {
        guard let scalar = unicodeScalars.first else { return false }
        return scalar == "_" || CharacterSet.letters.contains(scalar) || CharacterSet.decimalDigits.contains(scalar)
    }

    var isNumberContinuation: Bool {
        guard let scalar = unicodeScalars.first else { return false }
        return CharacterSet.decimalDigits.contains(scalar) || self == "." || self == "_" || self == "e" || self == "E" || self == "-"
    }

    var isCodePunctuation: Bool {
        "{}[]():,.;=+-*/<>!&|?".contains(self)
    }

    func isNumberStart(next: Character?) -> Bool {
        guard let scalar = unicodeScalars.first else { return false }
        if CharacterSet.decimalDigits.contains(scalar) {
            return true
        }
        if self == "-", let nextScalar = next?.unicodeScalars.first {
            return CharacterSet.decimalDigits.contains(nextScalar)
        }
        return false
    }
}

internal func parseMermaidDiagram(_ source: String) -> MermaidDiagram? {
    parseMermaidFlowchart(source)
        ?? parseMermaidSequence(source)
        ?? parseMermaidClassDiagram(source)
        ?? parseMermaidState(source)
        ?? parseMermaidEntityRelationship(source)
        ?? parseMermaidPie(source)
        ?? parseMermaidTimeline(source)
        ?? parseMermaidGantt(source)
}

private func parseMermaidFlowchart(_ source: String) -> MermaidDiagram? {
    let lines = source.lines.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    guard let header = lines.first?.lowercased(), header.hasPrefix("flowchart") || header.hasPrefix("graph") else {
        return nil
    }
    let pattern = #"^([A-Za-z0-9_]+)(?:\[(.+?)])?\s*-->\s*([A-Za-z0-9_]+)(?:\[(.+?)])?$"#
    var orderedIDs: [String] = []
    var labels: [String: String] = [:]
    for line in lines.dropFirst() {
        guard let match = regexGroups(pattern, line) else { continue }
        putOrderedLabel(id: match[1], label: match[2], ids: &orderedIDs, labels: &labels)
        putOrderedLabel(id: match[3], label: match[4], ids: &orderedIDs, labels: &labels)
    }
    let ordered = orderedIDs.compactMap { labels[$0] }
    guard !ordered.isEmpty else { return nil }
    return .flowchart(MermaidFlowchart(nodes: ordered))
}

private func parseMermaidSequence(_ source: String) -> MermaidDiagram? {
    let lines = source.lines.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    guard let header = lines.first?.lowercased(), header.hasPrefix("sequencediagram") else {
        return nil
    }
    var actorIDs: [String] = []
    var actorLabels: [String: String] = [:]
    var messages: [MermaidSequenceMessage] = []
    for line in lines.dropFirst() {
        if let match = regexGroups(#"^(participant|actor)\s+([A-Za-z0-9_]+)(?:\s+as\s+(.+))?$"#, line, options: [.caseInsensitive]) {
            putOrderedLabel(id: match[2], label: match[3], ids: &actorIDs, labels: &actorLabels)
            continue
        }
        if let match = regexGroups(#"^([A-Za-z0-9_]+)\s*[-.=x]+>{1,2}\s*([A-Za-z0-9_]+)\s*:\s*(.+)$"#, line) {
            putOrderedLabel(id: match[1], label: match[1], ids: &actorIDs, labels: &actorLabels)
            putOrderedLabel(id: match[2], label: match[2], ids: &actorIDs, labels: &actorLabels)
            messages.append(
                MermaidSequenceMessage(
                    from: actorLabels[match[1]] ?? match[1],
                    to: actorLabels[match[2]] ?? match[2],
                    text: match[3].trimmingCharacters(in: .whitespacesAndNewlines)
                )
            )
        }
    }
    guard !messages.isEmpty else { return nil }
    return .sequence(actors: actorIDs.compactMap { actorLabels[$0] }, messages: messages)
}

private func parseMermaidClassDiagram(_ source: String) -> MermaidDiagram? {
    let lines = source.lines.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    guard let header = lines.first?.lowercased(), header.hasPrefix("classdiagram") else {
        return nil
    }
    var classIDs: [String] = []
    var members: [String: [String]] = [:]
    var relations: [MermaidRelation] = []
    for line in lines.dropFirst() {
        if let match = regexGroups(#"^class\s+([A-Za-z0-9_]+)$"#, line) {
            putOrderedClass(match[1], ids: &classIDs, members: &members)
            continue
        }
        if let match = regexGroups(#"^([A-Za-z0-9_]+)\s*:\s*(.+)$"#, line) {
            putOrderedClass(match[1], ids: &classIDs, members: &members)
            let value = match[2].trimmingCharacters(in: .whitespacesAndNewlines)
            if !value.isEmpty {
                members[match[1], default: []].append(value)
            }
            continue
        }
        if let match = regexGroups(#"^([A-Za-z0-9_]+)\s+[^A-Za-z0-9\s]*--[^A-Za-z0-9\s]*\s+([A-Za-z0-9_]+)(?:\s*:\s*(.+))?$"#, line) {
            putOrderedClass(match[1], ids: &classIDs, members: &members)
            putOrderedClass(match[2], ids: &classIDs, members: &members)
            relations.append(
                MermaidRelation(
                    from: match[1],
                    to: match[2],
                    label: blankToNil(match[3])
                )
            )
        }
    }
    guard !classIDs.isEmpty || !relations.isEmpty else { return nil }
    return .classDiagram(
        classes: classIDs.map { MermaidClass(name: $0, members: members[$0] ?? []) },
        relations: relations
    )
}

private func parseMermaidState(_ source: String) -> MermaidDiagram? {
    let lines = source.lines.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    guard let header = lines.first?.lowercased(), header.hasPrefix("statediagram") else {
        return nil
    }
    var states: [String] = []
    var seen = Set<String>()
    var transitions: [MermaidRelation] = []
    for line in lines.dropFirst() {
        guard let match = regexGroups(#"^([A-Za-z0-9_\[\]\*]+)\s*-->\s*([A-Za-z0-9_\[\]\*]+)(?:\s*:\s*(.+))?$"#, line) else {
            continue
        }
        let from = normalizeStateName(match[1])
        let to = normalizeStateName(match[2])
        appendUnique(from, values: &states, seen: &seen)
        appendUnique(to, values: &states, seen: &seen)
        transitions.append(MermaidRelation(from: from, to: to, label: blankToNil(match[3])))
    }
    guard !states.isEmpty else { return nil }
    return .state(states: states, transitions: transitions)
}

private func parseMermaidEntityRelationship(_ source: String) -> MermaidDiagram? {
    let lines = source.lines.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    guard let header = lines.first?.lowercased(), header.hasPrefix("erdiagram") else {
        return nil
    }
    var entities: [String] = []
    var seen = Set<String>()
    var relations: [MermaidRelation] = []
    for line in lines.dropFirst() {
        guard let match = regexGroups(#"^([A-Za-z0-9_]+)\s+[|}o{.\-]+?\s+([A-Za-z0-9_]+)(?:\s*:\s*(.+))?$"#, line) else {
            continue
        }
        appendUnique(match[1], values: &entities, seen: &seen)
        appendUnique(match[2], values: &entities, seen: &seen)
        relations.append(MermaidRelation(from: match[1], to: match[2], label: blankToNil(match[3])))
    }
    guard !entities.isEmpty else { return nil }
    return .entityRelationship(entities: entities, relations: relations)
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

private func parseMermaidTimeline(_ source: String) -> MermaidDiagram? {
    let lines = source.lines.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    guard let header = lines.first?.lowercased(), header.hasPrefix("timeline") else {
        return nil
    }
    var events: [MermaidTimelineEvent] = []
    var currentTime: String?
    for line in lines.dropFirst() {
        if line.lowercased().hasPrefix("title ") {
            continue
        }
        guard line.contains(":") else {
            currentTime = line
            continue
        }
        let parts = line.split(separator: ":", maxSplits: 1).map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
        let time = parts.first?.nilIfBlank ?? currentTime
        let label = parts.dropFirst().first?.nilIfBlank
        if let time, let label {
            events.append(MermaidTimelineEvent(time: time, label: label))
            currentTime = time
        }
    }
    guard !events.isEmpty else { return nil }
    return .timeline(events)
}

private func parseMermaidGantt(_ source: String) -> MermaidDiagram? {
    let lines = source.lines.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    guard let header = lines.first?.lowercased(), header.hasPrefix("gantt") else {
        return nil
    }
    var tasks: [MermaidGanttTask] = []
    var currentSection: String?
    for line in lines.dropFirst() {
        let lower = line.lowercased()
        if lower.hasPrefix("title ") || lower.hasPrefix("dateformat ") || lower.hasPrefix("axisformat ") {
            continue
        }
        if lower.hasPrefix("section ") {
            currentSection = String(line.dropFirst("section".count)).trimmingCharacters(in: .whitespacesAndNewlines)
            continue
        }
        let parts = line.split(separator: ":", maxSplits: 1).map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
        guard parts.count == 2, let name = parts.first?.nilIfBlank else { continue }
        let fields = parts[1].split(separator: ",")
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard !fields.isEmpty else { continue }
        let scheduleFields = fields.filter { field in
            field.contains(where: { $0.isNumber }) || field.lowercased() == "after"
        }
        tasks.append(
            MermaidGanttTask(
                section: currentSection,
                name: name,
                start: scheduleFields.first,
                end: scheduleFields.dropFirst().first,
                tags: fields.filter { !scheduleFields.contains($0) }
            )
        )
    }
    guard !tasks.isEmpty else { return nil }
    return .gantt(tasks)
}

private func putOrderedLabel(id rawID: String, label rawLabel: String, ids: inout [String], labels: inout [String: String]) {
    let id = rawID.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !id.isEmpty else { return }
    if labels[id] == nil {
        ids.append(id)
        labels[id] = rawLabel.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank ?? id
    }
}

private func putOrderedClass(_ rawID: String, ids: inout [String], members: inout [String: [String]]) {
    let id = rawID.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !id.isEmpty else { return }
    if members[id] == nil {
        ids.append(id)
        members[id] = []
    }
}

private func appendUnique(_ value: String, values: inout [String], seen: inout Set<String>) {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, !seen.contains(trimmed) else { return }
    seen.insert(trimmed)
    values.append(trimmed)
}

private func normalizeStateName(_ value: String) -> String {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed == "[*]" {
        return "Start/End"
    }
    return trimmed.trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
}

private func regexGroups(_ pattern: String, _ line: String, options: NSRegularExpression.Options = []) -> [String]? {
    guard let regex = try? NSRegularExpression(pattern: pattern, options: options),
          let match = regex.firstMatch(in: line, range: NSRange(line.startIndex..., in: line))
    else {
        return nil
    }
    return (0..<match.numberOfRanges).map { index in
        let range = match.range(at: index)
        guard range.location != NSNotFound, let swiftRange = Range(range, in: line) else {
            return ""
        }
        return String(line[swiftRange])
    }
}

private func blankToNil(_ value: String) -> String? {
    value.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank
}

private func ganttTaskLines(_ task: MermaidGanttTask) -> [String] {
    var lines: [String] = []
    if let section = task.section?.nilIfBlank {
        lines.append("Section: \(section)")
    }
    if let start = task.start?.nilIfBlank {
        if let end = task.end?.nilIfBlank {
            lines.append("\(start) to \(end)")
        } else {
            lines.append(start)
        }
    }
    if !task.tags.isEmpty {
        lines.append("Tags: \(task.tags.joined(separator: ", "))")
    }
    return lines
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

private extension String {
    var lines: [String] {
        components(separatedBy: .newlines)
    }
}

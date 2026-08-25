import SwiftUI
import ForgeIOSRuntime

public struct FilePreviewContent: Sendable, Equatable {
    public let current: String
    public let previous: String
    public let diff: String

    public init(current: String = "", previous: String = "", diff: String = "") {
        self.current = current
        self.previous = previous
        self.diff = diff
    }
}

struct FilePreviewRow: Identifiable {
    let id: String
    let uri: String
    let name: String
    let parent: String
    let source: [String: JSONValue]
}

func filePreviewRows(_ rows: [[String: JSONValue]], config: FileBrowserDef) -> [FilePreviewRow] {
    let pathField = config.pathField?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty ?? "url"
    let dedupeField = config.dedupeBy?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty
    var selectedRows = rows
    if let dedupeField {
        var latest: [String: (Int, [String: JSONValue])] = [:]
        for (index, row) in rows.enumerated() {
            let key = previewString(row[dedupeField]).trimmingCharacters(in: .whitespacesAndNewlines)
            if !key.isEmpty { latest[key] = (index, row) }
        }
        selectedRows = latest.values.sorted { $0.0 < $1.0 }.map(\.1)
    }
    return selectedRows.enumerated().compactMap { index, row in
        let uri = firstPreviewString(row, keys: [pathField, "url", "uri", "path"])
        guard !uri.isEmpty else { return nil }
        let parts = uri.split(separator: "/").map(String.init)
        let name = firstPreviewString(row, keys: ["name", "label", "filename", "fileName"])
            .nonEmpty ?? parts.last ?? "Changed file"
        let parent = parts.dropLast().suffix(3).joined(separator: "/")
        return FilePreviewRow(id: "\(uri)#\(index)", uri: uri, name: name, parent: parent, source: row)
    }
}

func previousTextFromUnifiedDiff(current: String, diff: String) -> String {
    let hasTrailingNewline = current.hasSuffix("\n")
    var currentLines = current.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
    if hasTrailingNewline, currentLines.last == "" { currentLines.removeLast() }
    let diffLines = diff.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
    var previous: [String] = []
    var currentIndex = 0
    var foundHunk = false
    var index = 0
    while index < diffLines.count {
        let line = diffLines[index]
        guard line.hasPrefix("@@ "),
              let newToken = line.split(separator: " ").first(where: { $0.hasPrefix("+") }),
              let newStart = Int(newToken.dropFirst().split(separator: ",").first ?? "") else {
            index += 1
            continue
        }
        foundHunk = true
        let targetIndex = max(0, newStart - 1)
        while currentIndex < targetIndex, currentIndex < currentLines.count {
            previous.append(currentLines[currentIndex])
            currentIndex += 1
        }
        index += 1
        while index < diffLines.count, !diffLines[index].hasPrefix("@@ ") {
            let hunkLine = diffLines[index]
            if hunkLine.hasPrefix("+") && !hunkLine.hasPrefix("+++") {
                currentIndex += 1
            } else if hunkLine.hasPrefix("-") && !hunkLine.hasPrefix("---") {
                previous.append(String(hunkLine.dropFirst()))
            } else if hunkLine.hasPrefix(" ") {
                previous.append(currentIndex < currentLines.count ? currentLines[currentIndex] : String(hunkLine.dropFirst()))
                currentIndex += 1
            }
            index += 1
        }
    }
    guard foundHunk else { return "" }
    while currentIndex < currentLines.count {
        previous.append(currentLines[currentIndex])
        currentIndex += 1
    }
    let result = previous.joined(separator: "\n")
    return hasTrailingNewline && !result.isEmpty ? result + "\n" : result
}

public struct FilePreviewBrowser: View {
    private let rows: [[String: JSONValue]]
    private let config: FileBrowserDef
    private let loadText: (String) async throws -> String
    private let loadPreview: (String) async throws -> FilePreviewContent
    @State private var selectedRow: FilePreviewRow?

    public init(
        rows: [[String: JSONValue]],
        config: FileBrowserDef,
        loadText: @escaping (String) async throws -> String,
        loadPreview: @escaping (String) async throws -> FilePreviewContent
    ) {
        self.rows = rows
        self.config = config
        self.loadText = loadText
        self.loadPreview = loadPreview
    }

    public var body: some View {
        let visibleRows = filePreviewRows(rows, config: config)
        VStack(alignment: .leading, spacing: 6) {
            if visibleRows.isEmpty {
                Text("No changed files")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 8)
            } else {
                ForEach(visibleRows) { row in
                    Button { selectedRow = row } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "doc.text")
                                .foregroundStyle(.secondary)
                                .frame(width: 22)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(row.name)
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(.primary)
                                    .lineLimit(1)
                                if !row.parent.isEmpty {
                                    Text(row.parent)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                        .truncationMode(.head)
                                }
                            }
                            Spacer(minLength: 4)
                            Image(systemName: "chevron.right")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(.tertiary)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 9)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.secondary.opacity(0.055), in: RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Open \(row.name), \(row.parent)")
                }
            }
        }
        .sheet(item: $selectedRow) { row in
            FilePreviewSheet(
                row: row,
                config: config.preview ?? FilePreviewDef(),
                loadText: loadText,
                loadPreview: loadPreview
            )
        }
    }
}

private struct FilePreviewSheet: View {
    let row: FilePreviewRow
    let config: FilePreviewDef
    let loadText: (String) async throws -> String
    let loadPreview: (String) async throws -> FilePreviewContent
    @Environment(\.dismiss) private var dismiss
    @State private var content = FilePreviewContent()
    @State private var mode = ""
    @State private var isLoading = true
    @State private var errorMessage: String?

    private var modes: [String] {
        let declared = config.modes.isEmpty ? ["current"] : config.modes
        return declared.filter { $0 != "prev" || !content.previous.isEmpty }
    }
    private var effectiveMode: String {
        modes.contains(mode) ? mode : (modes.first ?? "current")
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Picker("File version", selection: Binding(
                    get: { effectiveMode },
                    set: { mode = $0 }
                )) {
                    ForEach(modes, id: \.self) { item in
                        Text(item == "prev" ? "Previous" : item.capitalized).tag(item)
                    }
                }
                .pickerStyle(.segmented)

                if isLoading {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let errorMessage {
                    ContentUnavailableView("Unable to load file", systemImage: "exclamationmark.triangle", description: Text(errorMessage))
                } else {
                    ScrollView([.horizontal, .vertical]) {
                        if effectiveMode == "diff" {
                            diffContent
                        } else {
                            Text(effectiveMode == "prev" ? content.previous : content.current)
                                .font(.system(.caption, design: .monospaced))
                                .textSelection(.enabled)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(12)
                        }
                    }
                    .background(Color.secondary.opacity(0.07), in: RoundedRectangle(cornerRadius: 14))
                }
            }
            .padding()
            .navigationTitle(row.name)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .task(id: row.uri) { await load() }
    }

    private var diffContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(content.diff.split(separator: "\n", omittingEmptySubsequences: false).enumerated()), id: \.offset) { _, rawLine in
                let line = String(rawLine)
                Text(line.isEmpty ? " " : line)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(diffForeground(line))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(diffBackground(line))
            }
        }
        .textSelection(.enabled)
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            if !(config.tool?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true) {
                content = try await loadPreview(row.uri)
            } else {
                let currentField = config.currentField?.nonEmpty ?? "url"
                let previousField = config.previousField?.nonEmpty ?? "origUrl"
                let diffField = config.diffField?.nonEmpty ?? "diff"
                let currentURI = firstPreviewString(row.source, keys: [currentField, "url", "uri"])
                let previousURI = firstPreviewString(row.source, keys: [previousField, "origUrl", "origUri"])
                let current = try await loadText(currentURI)
                let diff = previewString(row.source[diffField])
                let previous = !previousURI.isEmpty && previousURI != currentURI
                    ? (try await loadText(previousURI))
                    : previousTextFromUnifiedDiff(current: current, diff: diff)
                content = FilePreviewContent(current: current, previous: previous, diff: diff)
            }
            mode = config.defaultMode?.nonEmpty ?? modes.first ?? "current"
        } catch {
            errorMessage = "The selected file preview is unavailable."
        }
        isLoading = false
    }
}

private func diffForeground(_ line: String) -> Color {
    if line.hasPrefix("+") && !line.hasPrefix("+++") { return .green }
    if line.hasPrefix("-") && !line.hasPrefix("---") { return .red }
    return .primary
}

private func diffBackground(_ line: String) -> Color {
    if line.hasPrefix("+") && !line.hasPrefix("+++") { return Color.green.opacity(0.10) }
    if line.hasPrefix("-") && !line.hasPrefix("---") { return Color.red.opacity(0.10) }
    if line.hasPrefix("@@") { return Color.secondary.opacity(0.10) }
    return .clear
}

private func firstPreviewString(_ row: [String: JSONValue], keys: [String]) -> String {
    for key in keys {
        let value = previewString(row[key]).trimmingCharacters(in: .whitespacesAndNewlines)
        if !value.isEmpty { return value }
    }
    return ""
}

private func previewString(_ value: JSONValue?) -> String {
    guard let value else { return "" }
    switch value {
    case .string(let text): return text
    case .number(let number): return String(format: "%g", number)
    case .bool(let flag): return flag ? "true" : "false"
    case .null: return ""
    case .array, .object: return ""
    }
}

private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}

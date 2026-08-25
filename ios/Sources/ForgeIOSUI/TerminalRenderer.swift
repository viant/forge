import SwiftUI
import ForgeIOSRuntime

func terminalCommandText(_ row: [String: JSONValue], prompt: String = "$") -> String {
    let command = row["input"]?.stringValue
        ?? row["command"]?.stringValue
        ?? row["cmd"]?.stringValue
        ?? ""
    let trimmed = command.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? "" : "\(prompt) \(trimmed)"
}

func terminalOutputText(_ row: [String: JSONValue]) -> String {
    ["output", "stdout", "stderr", "error"]
        .compactMap { row[$0]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
        .joined(separator: "\n")
}

func terminalPreview(_ text: String, truncate: Bool, limit: Int) -> String {
    guard truncate, limit > 0, text.count > limit else { return text }
    return String(text.prefix(limit)) + "…"
}

public struct TerminalRenderer: View {
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    private let terminal: TerminalDef
    private let providedRows: [[String: JSONValue]]?
    @State private var rows: [[String: JSONValue]] = []

    public init(
        runtime: ForgeRuntime? = nil,
        window: WindowContext? = nil,
        container: ContainerDef,
        terminal: TerminalDef,
        rows: [[String: JSONValue]]? = nil
    ) {
        self.runtime = runtime
        self.window = window
        self.container = container
        self.terminal = terminal
        self.providedRows = rows
    }

    public var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    if rows.isEmpty {
                        Text("No terminal output.")
                            .foregroundStyle(Color.white.opacity(0.58))
                            .padding(14)
                    } else {
                        ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                            terminalRow(row, index: index)
                                .id(index)
                            if terminal.showDividers == true, index < rows.count - 1 {
                                Divider().overlay(Color.white.opacity(0.12))
                            }
                        }
                    }
                }
            }
            .frame(height: resolvedHeight)
            .background(Color(red: 0.055, green: 0.075, blue: 0.105), in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.08), lineWidth: 1))
            .onChange(of: rows.count) { _, count in
                guard terminal.autoScroll == true, count > 0 else { return }
                withAnimation(.easeOut(duration: 0.16)) { proxy.scrollTo(count - 1, anchor: .bottom) }
            }
        }
        .task(id: taskKey) { await loadRows() }
        .task(id: subscriptionKey) { await observeRows() }
    }

    @ViewBuilder
    private func terminalRow(_ row: [String: JSONValue], index: Int) -> some View {
        let prompt = terminal.prompt?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty ?? "$"
        let command = terminalCommandText(row, prompt: prompt)
        let output = terminalPreview(
            terminalOutputText(row),
            truncate: terminal.truncateLongOutput == true,
            limit: terminal.truncateLength ?? 4_000
        )
        let hasError: Bool = {
            if case .string(let stderr) = row["stderr"], !stderr.isEmpty { return true }
            if case .number(let status) = row["status"], status != 0 { return true }
            if case .number(let code) = row["code"], code != 0 { return true }
            return false
        }()
        VStack(alignment: .leading, spacing: 7) {
            if !command.isEmpty {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(command)
                        .font(.system(.caption, design: .monospaced).weight(.semibold))
                        .foregroundStyle(Color(red: 0.55, green: 0.78, blue: 1.0))
                        .textSelection(.enabled)
                    Spacer(minLength: 8)
                    if let status = row["status"]?.stringValue?.nilIfEmpty {
                        Text(status.lowercased())
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(status.lowercased() == "failed" ? Color.red : Color.green)
                    }
                }
            }
            if !output.isEmpty {
                Text(output)
                    .font(.system(.caption2, design: .monospaced))
                    .foregroundStyle(hasError ? Color.red.opacity(0.86) : Color.green.opacity(0.86))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .accessibilityElement(children: .combine)
        .accessibilityLabel([command, output].filter { !$0.isEmpty }.joined(separator: ", "))
    }

    private var resolvedDataSourceRef: String {
        terminal.dataSourceRef?.nilIfEmpty ?? container.dataSourceRef?.nilIfEmpty ?? ""
    }

    private var resolvedHeight: CGFloat {
        guard let raw = terminal.height?.lowercased() else { return 240 }
        let numeric = raw.replacingOccurrences(of: "px", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return min(max(CGFloat(Double(numeric) ?? 240), 120), 520)
    }

    private var taskKey: String {
        [window?.windowID ?? "", container.id ?? "", resolvedDataSourceRef, String(providedRows?.count ?? -1)].joined(separator: ":")
    }

    private var subscriptionKey: String {
        [window?.windowID ?? "", resolvedDataSourceRef, providedRows == nil ? "live" : "provided"].joined(separator: ":")
    }

    private func loadRows() async {
        if let providedRows { rows = providedRows; return }
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else { rows = []; return }
        rows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
    }

    private func observeRows() async {
        guard providedRows == nil, let runtime, let window, !resolvedDataSourceRef.isEmpty else { return }
        let stream = await runtime.dataSourceCollectionUpdates(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
        for await next in stream { await MainActor.run { rows = next } }
    }
}

private extension String {
    var nilIfEmpty: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}

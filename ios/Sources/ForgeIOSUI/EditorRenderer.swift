import SwiftUI
import ForgeIOSRuntime

public struct EditorRenderer: View {
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef?
    private let editor: EditorDef
    @State private var form: [String: JSONValue] = [:]
    @State private var sourceText: String = ""

    public init(
        runtime: ForgeRuntime? = nil,
        window: WindowContext? = nil,
        container: ContainerDef? = nil,
        editor: EditorDef
    ) {
        self.runtime = runtime
        self.window = window
        self.container = container
        self.editor = editor
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center) {
                if let location = editorLocation(form: form, selector: editor.selector) {
                    Text(location)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                if let label = editorLanguageLabel(editor: editor, form: form) {
                    Text(label)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            }
            if editorIsDiff(sourceText, extensionValue: editorExtension(form: form, selector: editor.selector)) {
                EditorDiffView(text: sourceText)
            } else {
                TextEditor(text: Binding(
                    get: { sourceText },
                    set: { updateSource($0) }
                ))
                .font(.system(.body, design: .monospaced))
                .frame(minHeight: editorHeight(style: editor.style))
                .scrollContentBackground(.hidden)
                .disabled(editorReadOnly(editor.style))
            }
        }
        .padding()
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .task(id: editorTaskKey) {
            await loadForm()
        }
        .task(id: editorSubscriptionTaskKey) {
            await observeForm()
        }
    }

    private var dataSourceRef: String {
        container?.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank ?? ""
    }

    private var sourceKey: String {
        editor.selector?.source?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank ?? "source"
    }

    private var editorTaskKey: String {
        [window?.windowID ?? "", dataSourceRef, sourceKey, editor.value ?? ""].joined(separator: ":")
    }

    private var editorSubscriptionTaskKey: String {
        [window?.windowID ?? "", dataSourceRef, "form"].joined(separator: ":")
    }

    private func loadForm() async {
        guard let runtime, let window, !dataSourceRef.isEmpty else {
            await MainActor.run {
                sourceText = editor.value ?? ""
            }
            return
        }
        let next = await runtime.formJSONValue(windowID: window.windowID, dataSourceRef: dataSourceRef)
        await MainActor.run {
            applyForm(next)
        }
    }

    private func observeForm() async {
        guard let runtime, let window, !dataSourceRef.isEmpty else {
            return
        }
        let stream = await runtime.dataSourceFormUpdates(windowID: window.windowID, dataSourceRef: dataSourceRef)
        for await next in stream {
            await MainActor.run {
                applyForm(next)
            }
        }
    }

    private func applyForm(_ next: [String: JSONValue]) {
        form = next
        sourceText = editorSource(form: next, selector: editor.selector, fallback: editor.value)
    }

    private func updateSource(_ value: String) {
        sourceText = value
        guard !editorReadOnly(editor.style), let runtime, let window, !dataSourceRef.isEmpty else {
            return
        }
        var next = form
        next[sourceKey] = .string(value)
        form = next
        Task {
            await runtime.setDataSourceForm(windowID: window.windowID, dataSourceRef: dataSourceRef, values: next)
        }
    }
}

private struct EditorDiffView: View {
    let text: String

    var body: some View {
        ScrollView(.horizontal) {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(text.lines.enumerated()), id: \.offset) { index, line in
                    HStack(spacing: 10) {
                        Text(String(index + 1).leftPadded(to: 4))
                            .foregroundStyle(.secondary)
                        Text(line)
                            .foregroundStyle(.primary)
                    }
                    .font(.system(.caption, design: .monospaced))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(editorDiffLineBackground(line))
                }
            }
        }
    }
}

func editorSource(form: [String: JSONValue], selector: EditorSelectorDef?, fallback: String?) -> String {
    let key = selector?.source?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank ?? "source"
    return form[key]?.stringLike ?? fallback ?? ""
}

func editorLocation(form: [String: JSONValue], selector: EditorSelectorDef?) -> String? {
    let key = selector?.location?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank ?? "location"
    return form[key]?.stringLike?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank
}

func editorExtension(form: [String: JSONValue], selector: EditorSelectorDef?) -> String? {
    let key = selector?.extension?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank ?? "extension"
    return form[key]?.stringLike?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank
}

func editorLanguageLabel(editor: EditorDef, form: [String: JSONValue]) -> String? {
    let value = editor.language?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank
        ?? editorExtension(form: form, selector: editor.selector)
    guard let value else { return nil }
    let readOnly = editorReadOnly(editor.style)
    return readOnly ? "\(value.uppercased()) • READ ONLY" : value.uppercased()
}

func editorReadOnly(_ style: [String: String]) -> Bool {
    for key in ["readonly", "readOnly"] {
        if style[key]?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "true" {
            return true
        }
    }
    return false
}

func editorIsDiff(_ source: String, extensionValue: String?) -> Bool {
    extensionValue?.caseInsensitiveCompare("diff") == .orderedSame
        || source.hasPrefix("---")
        || source.hasPrefix("@@")
}

private func editorHeight(style: [String: String]) -> CGFloat {
    let raw = style["height"]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    let numeric = raw.replacingOccurrences(of: "px", with: "").replacingOccurrences(of: "vh", with: "")
    guard let value = Double(numeric), value > 0 else {
        return 220
    }
    return raw.hasSuffix("vh") ? CGFloat(max(180, min(value * 8, 720))) : CGFloat(value)
}

private func editorDiffLineBackground(_ line: String) -> Color {
    if line.hasPrefix("+") {
        return Color.green.opacity(0.12)
    }
    if line.hasPrefix("-") {
        return Color.red.opacity(0.12)
    }
    if line.hasPrefix("@@") {
        return Color.secondary.opacity(0.12)
    }
    return Color.clear
}

private extension JSONValue {
    var stringLike: String? {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            return String(format: "%g", value)
        case .bool(let value):
            return value ? "true" : "false"
        case .null:
            return nil
        case .array, .object:
            return displayString
        }
    }

    var displayString: String {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            return String(format: "%g", value)
        case .bool(let value):
            return value ? "true" : "false"
        case .null:
            return ""
        case .array(let values):
            return values.map(\.displayString).joined(separator: ", ")
        case .object(let value):
            return value.map { "\($0.key): \($0.value.displayString)" }.joined(separator: ", ")
        }
    }
}

private extension String {
    var nilIfBlank: String? {
        isEmpty ? nil : self
    }

    var lines: [String] {
        split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
    }

    func leftPadded(to count: Int) -> String {
        guard self.count < count else { return self }
        return String(repeating: " ", count: count - self.count) + self
    }
}

import SwiftUI
import ForgeIOSRuntime

public struct MenuListRenderer: View {
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    private let items: [ItemDef]
    @State private var formValues: [String: JSONValue] = [:]

    public init(runtime: ForgeRuntime? = nil, window: WindowContext? = nil, container: ContainerDef, items: [ItemDef]) {
        self.runtime = runtime
        self.window = window
        self.container = container
        self.items = items
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(visibleItems) { item in
                renderedItem(item)
            }
        }
        .task(id: taskKey) {
            await loadFormValues()
        }
    }

    private var taskKey: String {
        [
            window?.windowID ?? "",
            container.id ?? "",
            container.dataSourceRef ?? "",
            items.map { $0.id ?? $0.label ?? "" }.joined(separator: "|")
        ].joined(separator: ":")
    }

    private var visibleItems: [ItemDef] {
        items.filter(isVisible(_:))
    }

    @ViewBuilder
    private func renderedItem(_ item: ItemDef) -> some View {
        switch (item.type ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "markdown":
            markdownItem(item)
        case "button":
            buttonItem(item)
        default:
            labelItem(item)
        }
    }

    @ViewBuilder
    private func labelItem(_ item: ItemDef) -> some View {
        let key = item.field ?? item.dataField ?? item.bindingPath ?? item.id
        let title = item.label ?? item.title ?? item.id ?? "Item"
        let value = key.flatMap { formValues[$0] }?.displayString ?? "—"
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.body)
                .foregroundStyle(.primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }

    @ViewBuilder
    private func markdownItem(_ item: ItemDef) -> some View {
        let key = item.field ?? item.dataField ?? item.bindingPath ?? item.id
        let markdown = key.flatMap { formValues[$0] }?.displayString ?? ""
        if markdown.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            RoundedRectangle(cornerRadius: 10)
                .fill(Color.secondary.opacity(0.08))
                .frame(maxWidth: .infinity, minHeight: 96, alignment: .leading)
        } else {
            MarkdownRenderer(markdown: markdown)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
        }
    }

    @ViewBuilder
    private func buttonItem(_ item: ItemDef) -> some View {
        let title = item.properties["text"]?.displayString ?? item.label ?? item.title ?? item.id ?? "Action"
        Button(title) {
            guard let runtime, let window, let execution = item.on.first else { return }
            Task {
                _ = await runtime.execute(
                    execution,
                    context: ExecutionContext(windowID: window.windowID, dataSourceRef: container.dataSourceRef ?? "")
                )
            }
        }
        .buttonStyle(.borderedProminent)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func loadFormValues() async {
        guard let runtime, let window, let dataSourceRef = container.dataSourceRef, !dataSourceRef.isEmpty else {
            formValues = [:]
            return
        }
        formValues = await runtime.formJSONValue(windowID: window.windowID, dataSourceRef: dataSourceRef)
    }

    private func isVisible(_ item: ItemDef) -> Bool {
        guard let visibleWhen = item.visibleWhen else {
            return true
        }
        let source = visibleWhen.source?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        let field = visibleWhen.field?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if source == "form", !field.isEmpty {
            let value = formValues[field]
            if let equals = visibleWhen.equals?.displayString {
                return value?.displayString == equals
            }
            return value != nil && value?.displayString != "—"
        }
        return true
    }
}

private extension JSONValue {
    var displayString: String {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            if value.rounded(.towardZero) == value {
                return String(Int(value))
            }
            return String(value)
        case .bool(let value):
            return value ? "true" : "false"
        case .array(let value):
            return value.map(\.displayString).joined(separator: ", ")
        case .object(let value):
            return value.map { "\($0.key): \($0.value.displayString)" }.joined(separator: ", ")
        case .null:
            return "—"
        }
    }
}

private extension JSONPrimitive {
    var displayString: String {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            if value.rounded(.towardZero) == value {
                return String(Int(value))
            }
            return String(value)
        case .bool(let value):
            return value ? "true" : "false"
        case .null:
            return "—"
        }
    }
}

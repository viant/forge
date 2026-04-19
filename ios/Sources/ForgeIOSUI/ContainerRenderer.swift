import SwiftUI
import ForgeIOSRuntime

public struct ContainerRenderer: View {
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef

    public init(runtime: ForgeRuntime? = nil, window: WindowContext? = nil, container: ContainerDef) {
        self.runtime = runtime
        self.window = window
        self.container = container
    }

    public var body: some View {
        renderedBody
    }

    @ViewBuilder
    private var titleBlock: some View {
        if container.title != nil || container.subtitle != nil {
            VStack(alignment: .leading, spacing: 4) {
                if let title = container.title, !title.isEmpty {
                    Text(title).font(.headline)
                }
                if let subtitle = container.subtitle, !subtitle.isEmpty {
                    Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
                }
            }
        }
    }

    @ViewBuilder
    private var renderedBody: some View {
        if container.kind == "dashboard" || container.kind?.starts(with: "dashboard.") == true {
            DashboardRenderer(runtime: runtime, window: window, container: container)
        } else if container.schemaBasedForm != nil {
            SchemaBasedFormRenderer(container: container)
        } else if let table = container.table {
            TableRenderer(runtime: runtime, window: window, container: container, table: table)
        } else if let chart = container.chart {
            ChartRenderer(runtime: runtime, window: window, container: container, chart: chart)
        } else if container.tabs != nil, !container.containers.isEmpty {
            TabsRenderer(runtime: runtime, window: window, container: container)
        } else if let editor = container.editor {
            EditorRenderer(runtime: runtime, window: window, editor: editor)
        } else if container.kind == "chat" {
            ChatRenderer(runtime: runtime, window: window, container: container)
        } else if !container.items.isEmpty {
            MenuListRenderer(runtime: runtime, window: window, items: container.items)
        } else if !container.containers.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                titleBlock
                ForEach(container.containers) { child in
                    ContainerRenderer(runtime: runtime, window: window, container: child)
                }
            }
        } else {
            PlaceholderContainerView(container: container)
        }
    }
}

private struct PlaceholderContainerView: View {
    let container: ContainerDef

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let title = container.title {
                Text(title).font(.headline)
            }
            Text(container.kind ?? "container")
                .font(.footnote.monospaced())
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(.quaternary)
        )
    }
}

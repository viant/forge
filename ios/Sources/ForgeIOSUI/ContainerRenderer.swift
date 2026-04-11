import SwiftUI
import ForgeIOSRuntime

public struct ContainerRenderer: View {
    private let container: ContainerDef

    public init(container: ContainerDef) {
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
            DashboardRenderer(container: container)
        } else if container.schemaBasedForm != nil {
            SchemaBasedFormRenderer(container: container)
        } else if let table = container.table {
            TableRenderer(table: table)
        } else if let chart = container.chart {
            ChartRenderer(chart: chart)
        } else if container.tabs != nil, !container.containers.isEmpty {
            TabsRenderer(container: container)
        } else if let editor = container.editor {
            EditorRenderer(editor: editor)
        } else if !container.items.isEmpty {
            MenuListRenderer(items: container.items)
        } else if !container.containers.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                titleBlock
                ForEach(container.containers) { child in
                    ContainerRenderer(container: child)
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

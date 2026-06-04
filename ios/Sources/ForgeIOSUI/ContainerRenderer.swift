import SwiftUI
import ForgeIOSRuntime

public struct ContainerRenderer: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

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
            VStack(alignment: .leading, spacing: 12) {
                titleBlock
                SchemaBasedFormRenderer(container: container)
            }
        } else if let table = container.table {
            VStack(alignment: .leading, spacing: 12) {
                titleBlock
                TableRenderer(runtime: runtime, window: window, container: container, table: table)
            }
        } else if let chart = container.chart {
            VStack(alignment: .leading, spacing: 12) {
                titleBlock
                if !container.items.isEmpty {
                    MenuListRenderer(runtime: runtime, window: window, container: container, items: container.items)
                }
                ChartRenderer(runtime: runtime, window: window, container: container, chart: chart)
            }
        } else if let treeBrowser = container.treeBrowser {
            VStack(alignment: .leading, spacing: 12) {
                titleBlock
                TreeBrowserRenderer(runtime: runtime, window: window, container: container, treeBrowser: treeBrowser)
            }
        } else if container.tabs != nil, !container.containers.isEmpty {
            TabsRenderer(runtime: runtime, window: window, container: container)
        } else if let editor = container.editor {
            VStack(alignment: .leading, spacing: 12) {
                titleBlock
                EditorRenderer(runtime: runtime, window: window, editor: editor)
            }
        } else if container.kind == "chat" {
            VStack(alignment: .leading, spacing: 12) {
                titleBlock
                ChatRenderer(runtime: runtime, window: window, container: container)
            }
        } else if !container.items.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                titleBlock
                MenuListRenderer(runtime: runtime, window: window, container: container, items: container.items)
            }
        } else if !container.containers.isEmpty {
            VStack(alignment: .leading, spacing: resolvedSpacing(from: container.layout?.gap, fallback: 12)) {
                titleBlock
                if container.layout?.kind?.lowercased() == "grid" {
                    LazyVGrid(columns: nestedGridColumns, spacing: resolvedSpacing(from: container.layout?.rowGap ?? container.layout?.gap, fallback: 12)) {
                        ForEach(container.containers) { child in
                            ContainerRenderer(runtime: runtime, window: window, container: child)
                        }
                    }
                } else if container.layout?.kind?.lowercased() == "split",
                          container.layout?.orientation?.lowercased() == "horizontal",
                          horizontalSizeClass == .regular {
                    HStack(alignment: .top, spacing: resolvedSpacing(from: container.layout?.gap, fallback: 12)) {
                        ForEach(container.containers) { child in
                            ContainerRenderer(runtime: runtime, window: window, container: child)
                                .frame(maxWidth: .infinity, alignment: .topLeading)
                        }
                    }
                } else {
                    ForEach(container.containers) { child in
                        ContainerRenderer(runtime: runtime, window: window, container: child)
                    }
                }
            }
        } else {
            PlaceholderContainerView(container: container)
        }
    }

    private var nestedGridColumns: [GridItem] {
        let layoutColumns = container.layout?.columns ?? 0
        if layoutColumns >= 12 && horizontalSizeClass == .regular {
            return [GridItem(.adaptive(minimum: 220), spacing: 12, alignment: .top)]
        }
        let count = max(1, min(layoutColumns, horizontalSizeClass == .regular ? 4 : 2))
        return Array(repeating: GridItem(.flexible(), spacing: 12, alignment: .top), count: count)
    }

    private func resolvedSpacing(from raw: String?, fallback: CGFloat) -> CGFloat {
        guard let raw else {
            return fallback
        }
        let numeric = raw
            .replacingOccurrences(of: "px", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if let value = Double(numeric) {
            return CGFloat(value)
        }
        return fallback
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

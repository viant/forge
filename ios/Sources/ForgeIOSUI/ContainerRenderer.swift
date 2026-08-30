import SwiftUI
import ForgeIOSRuntime

public struct ContainerRenderer: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.forgePresentationDensity) private var presentationDensity
    @Environment(\.forgeContainerRendererRegistry) private var rendererRegistry
    @State private var visibilityWindowForm: [String: JSONValue] = [:]
    @State private var visibilityForm: [String: JSONValue] = [:]
    @State private var visibilityMetrics: [String: JSONValue] = [:]
    @State private var visibilityCollection: [[String: JSONValue]] = []
    @State private var visibilityInput = InputState()
    @State private var visibilitySelection = SelectionState()

    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    private let inheritedDataSourceRef: String?
    private let suppressTitle: Bool

    public init(
        runtime: ForgeRuntime? = nil,
        window: WindowContext? = nil,
        container: ContainerDef,
        inheritedDataSourceRef: String? = nil,
        suppressTitle: Bool = false
    ) {
        self.runtime = runtime
        self.window = window
        self.container = container
        self.inheritedDataSourceRef = inheritedDataSourceRef
        self.suppressTitle = suppressTitle
    }

    public var body: some View {
        Group {
            if containerIsVisible {
                renderedBody
            }
        }
        .task(id: visibilityWindowTaskKey) {
            await observeVisibilityWindowForm()
        }
        .task(id: visibilityDataTaskKey) {
            await observeVisibilityDataSource()
        }
    }

    private var visibilityWindowTaskKey: String {
        guard container.visibleWhen != nil else { return "" }
        return window?.windowID ?? ""
    }

    private var visibilityDataSourceRef: String {
        normalizedContainerVisibilityRef(container.visibleWhen?.dataSourceRef)
            ?? normalizedContainerVisibilityRef(container.dataSourceRef)
            ?? normalizedContainerVisibilityRef(inheritedDataSourceRef)
            ?? ""
    }

    private var visibilityDataTaskKey: String {
        guard container.visibleWhen != nil else { return "" }
        return "\(window?.windowID ?? "")#\(visibilityDataSourceRef)"
    }

    private var containerIsVisible: Bool {
        let kind = container.kind?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        if kind == "dashboard" || kind.hasPrefix("dashboard.") { return true }
        return DashboardRuntime.evaluateDashboardCondition(
            container.visibleWhen,
            metrics: visibilityMetrics.mapValues(containerVisibilityAnyValue),
            filters: visibilityInput.filter.mapValues(containerVisibilityAnyValue),
            form: visibilityForm.mapValues(containerVisibilityAnyValue),
            windowForm: visibilityWindowForm.mapValues(containerVisibilityAnyValue),
            collection: visibilityCollection.map { $0.mapValues(containerVisibilityAnyValue) },
            input: [
                "filter": visibilityInput.filter.mapValues(containerVisibilityAnyValue),
                "parameters": visibilityInput.parameters.mapValues(containerVisibilityAnyValue),
                "page": visibilityInput.page as Any,
                "fetch": visibilityInput.fetch,
                "refresh": visibilityInput.refresh
            ],
            selectionValues: [
                "selected": visibilitySelection.selected?.mapValues(containerVisibilityAnyValue) as Any,
                "selection": visibilitySelection.selection.map { $0.mapValues(containerVisibilityAnyValue) },
                "rowIndex": visibilitySelection.rowIndex
            ]
        )
    }

    @MainActor
    private func observeVisibilityWindowForm() async {
        guard container.visibleWhen != nil, let runtime, let window else { return }
        visibilityWindowForm = await runtime.windowFormJSONValue(windowID: window.windowID)
        let stream = await runtime.windowFormUpdates(windowID: window.windowID)
        for await next in stream { visibilityWindowForm = next }
    }

    @MainActor
    private func observeVisibilityDataSource() async {
        guard container.visibleWhen != nil,
              let runtime,
              let window,
              !visibilityDataSourceRef.isEmpty else { return }
        let ref = visibilityDataSourceRef
        visibilityCollection = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: ref)
        visibilityForm = await runtime.formJSONValue(windowID: window.windowID, dataSourceRef: ref)
        visibilityMetrics = await runtime.dataSourceMetrics(windowID: window.windowID, dataSourceRef: ref)
        visibilityInput = await runtime.dataSourceInputState(windowID: window.windowID, dataSourceRef: ref)
        visibilitySelection = await runtime.dataSourceSelectionState(windowID: window.windowID, dataSourceRef: ref)
        await withTaskGroup(of: Void.self) { group in
            group.addTask {
                let stream = await runtime.dataSourceCollectionUpdates(windowID: window.windowID, dataSourceRef: ref)
                for await next in stream { await MainActor.run { visibilityCollection = next } }
            }
            group.addTask {
                let stream = await runtime.dataSourceFormUpdates(windowID: window.windowID, dataSourceRef: ref)
                for await next in stream { await MainActor.run { visibilityForm = next } }
            }
            group.addTask {
                let stream = await runtime.dataSourceMetricsUpdates(windowID: window.windowID, dataSourceRef: ref)
                for await next in stream { await MainActor.run { visibilityMetrics = next } }
            }
            group.addTask {
                let stream = await runtime.dataSourceInputUpdates(windowID: window.windowID, dataSourceRef: ref)
                for await next in stream { await MainActor.run { visibilityInput = next } }
            }
            group.addTask {
                let stream = await runtime.dataSourceSelectionUpdates(windowID: window.windowID, dataSourceRef: ref)
                for await next in stream { await MainActor.run { visibilitySelection = next } }
            }
        }
    }

    @ViewBuilder
    private var titleBlock: some View {
        if !suppressTitle, container.title != nil || container.subtitle != nil {
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
        let effectiveContainer = resolvedContainer()
        if let renderer = rendererRegistry.renderer(for: effectiveContainer.kind) {
            customRendererBody(renderer, container: effectiveContainer)
        } else if effectiveContainer.kind?.lowercased() == "mobile.controlsheet" {
            MobileControlSheetRenderer(runtime: runtime, window: window, container: effectiveContainer)
        } else if effectiveContainer.kind == "dashboard" || effectiveContainer.kind?.starts(with: "dashboard.") == true {
            DashboardRenderer(runtime: runtime, window: window, container: effectiveContainer)
        } else if effectiveContainer.schemaBasedForm != nil {
            VStack(alignment: .leading, spacing: 12) {
                titleBlock
                SchemaBasedFormRenderer(
                    runtime: runtime,
                    window: window,
                    container: effectiveContainer,
                    onSubmit: schemaFormSubmitHandler(for: effectiveContainer)
                )
            }
        } else if let table = effectiveContainer.table {
            VStack(alignment: .leading, spacing: 12) {
                titleBlock
                TableRenderer(runtime: runtime, window: window, container: effectiveContainer, table: table)
            }
        } else if let chart = effectiveContainer.chart {
            VStack(alignment: .leading, spacing: 12) {
                titleBlock
                if !effectiveContainer.items.isEmpty {
                    MenuListRenderer(runtime: runtime, window: window, container: effectiveContainer, items: effectiveContainer.items)
                }
                ChartTableModeRenderer(runtime: runtime, window: window, container: effectiveContainer, chart: chart)
            }
        } else if let treeBrowser = effectiveContainer.treeBrowser {
            VStack(alignment: .leading, spacing: 12) {
                titleBlock
                TreeBrowserRenderer(runtime: runtime, window: window, container: effectiveContainer, treeBrowser: treeBrowser)
            }
        } else if let fileBrowser = effectiveContainer.fileBrowser {
            VStack(alignment: .leading, spacing: 12) {
                titleBlock
                FileBrowserRenderer(runtime: runtime, window: window, container: effectiveContainer, fileBrowser: fileBrowser)
            }
        } else if effectiveContainer.tabs != nil, !effectiveContainer.containers.isEmpty {
            TabsRenderer(runtime: runtime, window: window, container: effectiveContainer)
        } else if let editor = effectiveContainer.editor {
            VStack(alignment: .leading, spacing: 12) {
                titleBlock
                EditorRenderer(runtime: runtime, window: window, container: effectiveContainer, editor: editor)
            }
        } else if effectiveContainer.kind == "chat" || effectiveContainer.chat != nil {
            ChatRenderer(runtime: runtime, window: window, container: effectiveContainer)
        } else if let terminal = effectiveContainer.terminal {
            VStack(alignment: .leading, spacing: 12) {
                titleBlock
                TerminalRenderer(runtime: runtime, window: window, container: effectiveContainer, terminal: terminal)
            }
        } else if !effectiveContainer.items.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                titleBlock
                MenuListRenderer(runtime: runtime, window: window, container: effectiveContainer, items: effectiveContainer.items)
            }
        } else if !effectiveContainer.containers.isEmpty {
            VStack(alignment: .leading, spacing: resolvedSpacing(from: effectiveContainer.layout?.gap, fallback: 12)) {
                titleBlock
                if effectiveContainer.layout?.kind?.lowercased() == "grid" {
                    LazyVGrid(columns: nestedGridColumns, spacing: resolvedSpacing(from: effectiveContainer.layout?.rowGap ?? effectiveContainer.layout?.gap, fallback: 12)) {
                        ForEach(effectiveContainer.containers) { child in
                            ContainerRenderer(runtime: runtime, window: window, container: child, inheritedDataSourceRef: effectiveContainer.dataSourceRef)
                        }
                    }
                } else if effectiveContainer.layout?.kind?.lowercased() == "split",
                          effectiveContainer.layout?.orientation?.lowercased() == "horizontal",
                          horizontalSizeClass == .regular {
                    HStack(alignment: .top, spacing: resolvedSpacing(from: effectiveContainer.layout?.gap, fallback: 12)) {
                        ForEach(effectiveContainer.containers) { child in
                            ContainerRenderer(runtime: runtime, window: window, container: child, inheritedDataSourceRef: effectiveContainer.dataSourceRef)
                                .frame(maxWidth: .infinity, alignment: .topLeading)
                        }
                    }
                } else {
                    ForEach(effectiveContainer.containers) { child in
                        ContainerRenderer(runtime: runtime, window: window, container: child, inheritedDataSourceRef: effectiveContainer.dataSourceRef)
                    }
                }
            }
        } else {
            PlaceholderContainerView(container: effectiveContainer)
        }
    }

    private func customRendererBody(
        _ renderer: any ForgeContainerRendererExtension,
        container: ContainerDef
    ) -> AnyView {
        do {
            return try renderer.render(context: ForgeContainerRendererContext(
                runtime: runtime,
                window: window,
                container: container,
                inheritedDataSourceRef: inheritedDataSourceRef,
                suppressTitle: suppressTitle,
                presentationDensity: presentationDensity,
                targetContext: runtime?.targetContext
            ))
        } catch {
            return AnyView(
                VStack(alignment: .leading, spacing: 4) {
                    Text("Unsupported content").font(.headline)
                    Text("This content could not be displayed.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Unsupported content")
            )
        }
    }

    private func resolvedContainer() -> ContainerDef {
        guard container.dataSourceRef == nil,
              let inheritedDataSourceRef,
              !inheritedDataSourceRef.isEmpty else {
            return container
        }
        return ContainerDef(
            id: container.id,
            title: container.title,
            subtitle: container.subtitle,
            kind: container.kind,
            scrollMode: container.scrollMode,
            role: container.role,
            dataSourceRef: inheritedDataSourceRef,
            card: container.card,
            section: container.section,
            toolbar: container.toolbar,
            columnSpan: container.columnSpan,
            rowSpan: container.rowSpan,
            filterBindings: container.filterBindings,
            selectionBindings: container.selectionBindings,
            visibleWhen: container.visibleWhen,
            metrics: container.metrics,
            checks: container.checks,
            rows: container.rows,
            sections: container.sections,
            fields: container.fields,
            dimension: container.dimension,
            metric: container.metric,
            viewModes: container.viewModes,
            limit: container.limit,
            orderBy: container.orderBy,
            categoryKey: container.categoryKey,
            valueKey: container.valueKey,
            nameKey: container.nameKey,
            format: container.format,
            legendLimit: container.legendLimit,
            dateField: container.dateField,
            timeKey: container.timeKey,
            chartType: container.chartType,
            series: container.series,
            containers: container.containers,
            selectFirst: container.selectFirst,
            layout: container.layout,
            stateKey: container.stateKey,
            schemaBasedForm: container.schemaBasedForm,
            dashboard: container.dashboard,
            reportRuntime: container.reportRuntime,
            tabs: container.tabs,
            items: container.items,
            chart: container.chart,
            table: container.table,
            columns: container.columns,
            geo: container.geo,
            treeBrowser: container.treeBrowser,
            fileBrowser: container.fileBrowser,
            editor: container.editor,
            chat: container.chat,
            terminal: container.terminal,
            actions: container.actions,
            on: container.on,
            fetchData: container.fetchData,
            target: container.target,
            targetOverrides: container.targetOverrides
        )
    }

    private func schemaFormSubmitHandler(for container: ContainerDef) -> (([String: JSONValue]) -> Void)? {
        guard let runtime, let window, let form = container.schemaBasedForm else {
            return nil
        }
        let executions = form.on.compactMap { eventExecution -> ExecutionDef? in
            guard eventExecution.event?.trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased() == "submit" else {
                return nil
            }
            return eventExecution.executionDef
        }
        guard !executions.isEmpty else {
            return nil
        }
        let dataSourceRef = form.dataSourceRef ?? container.dataSourceRef ?? ""
        return { payload in
            Task {
                let args: [String: JSONValue] = [
                    "data": .object(payload),
                    "payload": .object(payload),
                    "form": .object(payload)
                ]
                for execution in executions {
                    _ = await runtime.execute(
                        execution,
                        context: ExecutionContext(windowID: window.windowID, dataSourceRef: dataSourceRef),
                        args: args
                    )
                }
            }
        }
    }

    private var nestedGridColumns: [GridItem] {
        let layoutColumns = resolvedContainer().layout?.columns ?? 0
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

private func normalizedContainerVisibilityRef(_ value: String?) -> String? {
    let normalized = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return normalized.isEmpty ? nil : normalized
}

private func containerVisibilityAnyValue(_ value: JSONValue) -> Any {
    switch value {
    case .string(let value): return value
    case .number(let value): return value
    case .bool(let value): return value
    case .array(let values): return values.map(containerVisibilityAnyValue)
    case .object(let values): return values.mapValues(containerVisibilityAnyValue)
    case .null: return NSNull()
    }
}

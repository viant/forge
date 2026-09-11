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
    @State private var visibilityControl = ControlState()
    @State private var boundaryControls: [String: ControlState] = [:]
    @State private var boundaryCollections: [String: [[String: JSONValue]]] = [:]
    @State private var boundaryForms: [String: [String: JSONValue]] = [:]
    @State private var boundaryMetrics: [String: [String: JSONValue]] = [:]
    @State private var authorizationSnapshot: [String: JSONValue] = [:]
    @State private var permissionGrants: [[String: JSONValue]] = []

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
                permissionAwareBody
            } else {
                // Keep the observation tasks mounted while the container is
                // hidden. A true EmptyView is removed from the SwiftUI tree and
                // can never observe the state transition that makes it visible.
                Color.clear.frame(width: 0, height: 0)
            }
        }
        .task(id: visibilityWindowTaskKey) {
            await observeVisibilityWindowForm()
        }
        .task(id: visibilityDataTaskKey) {
            await observeVisibilityDataSource()
        }
        .task(id: boundaryDataTaskKey) {
            await observeBoundaryDataSources()
        }
        .task(id: permissionTaskKey) {
            await observePermissionState()
        }
        .onChange(of: permissionAllowed) { _, allowed in
            guard !allowed,
                  let spec = container.permissionBoundary,
                  spec.mode?.lowercased() == "selection",
                  let runtime,
                  let window,
                  !visibilityDataSourceRef.isEmpty else { return }
            Task { await runtime.setDataSourceSelection(windowID: window.windowID, dataSourceRef: visibilityDataSourceRef, selected: nil) }
        }
    }

    @ViewBuilder
    private var permissionAwareBody: some View {
        if let spec = container.permissionBoundary,
           (spec.mode?.lowercased() ?? "resource") == "resource",
           !permissionAllowed {
            Label(spec.deniedMessage ?? "You do not have permission to view this content.", systemImage: "lock.fill")
                .foregroundStyle(.orange)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
                .background(.orange.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
                .accessibilityIdentifier("forge-permission-boundary")
        } else {
            VStack(alignment: .leading, spacing: 8) {
                if let spec = container.permissionBoundary, !permissionAllowed {
                    Label(spec.deniedMessage ?? "The current selection is not permitted.", systemImage: "lock.fill")
                        .font(.caption)
                        .foregroundStyle(.orange)
                        .accessibilityIdentifier("forge-permission-boundary")
                }
                primitiveAwareBody
            }
        }
    }

    @ViewBuilder
    private var primitiveAwareBody: some View {
        let boundary = container.dataStateBoundary
        let boundaryKind = WorkflowPrimitiveRuntime.dataStateBoundaryKind(
            controls: boundaryStateControls,
            collections: boundaryStateCollections,
            allowPartial: boundary?.allowPartial == true
        )
        if boundary != nil && boundaryKind == .loading {
            ProgressView(boundary?.loadingMessage ?? "Loading…")
                .frame(maxWidth: .infinity, alignment: .leading)
        } else if boundary != nil && boundaryKind == .error {
            if boundaryErrorSuppressed {
                EmptyView()
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    Label(boundary?.errorMessage ?? visibilityControl.error ?? "Unable to load data.", systemImage: "exclamationmark.octagon.fill")
                        .foregroundStyle(.red)
                    if let action = boundary?.errorAction {
                        Button(action.label ?? "Retry") { retryBoundaryError(action) }
                            .accessibilityIdentifier("forge-data-state-retry")
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier("forge-data-state-error")
            }
        } else if boundary != nil && boundaryKind == .empty && boundary?.renderEmptyContent != true {
            ContentUnavailableView(boundary?.emptyMessage ?? "No data", systemImage: "tray")
        } else {
            VStack(alignment: .leading, spacing: 8) {
                if boundaryKind == .partial {
                    Label(boundary?.staleMessage ?? "Some data is unavailable.", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
                if let toolbar = container.toolbar, !toolbar.items.isEmpty {
                    containerActionToolbar(toolbar)
                }
                ScopedWorkflowPrimitives(runtime: runtime, window: window, container: resolvedContainer())
                renderedBody
            }
        }
    }

    private func containerActionToolbar(_ toolbar: ToolbarDef) -> some View {
        HStack(spacing: 8) {
            ForEach(toolbar.items) { item in
                if item.align == "right" { Spacer(minLength: 0) }
                Button {
                    guard let runtime, let window else { return }
                    Task {
                        for execution in item.on where execution.event == "onClick" {
                            _ = await runtime.execute(
                                execution,
                                context: ExecutionContext(
                                    windowID: window.windowID,
                                    dataSourceRef: container.dataSourceRef ?? inheritedDataSourceRef ?? ""
                                )
                            )
                        }
                    }
                } label: {
                    if let label = item.label, !label.isEmpty {
                        Label(label, systemImage: containerToolbarSymbol(item.icon))
                    } else {
                        Image(systemName: containerToolbarSymbol(item.icon))
                            .font(.system(size: 16, weight: .semibold))
                            .frame(width: 34, height: 34)
                            .background(containerToolbarColor(item).opacity(0.12), in: Circle())
                            .foregroundStyle(containerToolbarColor(item))
                    }
                }
                .buttonStyle(.plain)
                .disabled(item.enabled == false)
                .accessibilityLabel(item.ariaLabel ?? item.tooltip ?? item.label ?? item.id ?? "Action")
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var visibilityWindowTaskKey: String {
        guard observesPrimitiveState else { return "" }
        return window?.windowID ?? ""
    }

    private var visibilityDataSourceRef: String {
        container.dataStateBoundary?.dataSourceRefs.compactMap(normalizedContainerVisibilityRef).first
            ?? normalizedContainerVisibilityRef(container.metricSummary?.dataSourceRef)
            ?? normalizedContainerVisibilityRef(container.detailView?.dataSourceRef)
            ?? normalizedContainerVisibilityRef(container.relationDrill?.dataSourceRef)
            ?? normalizedContainerVisibilityRef(container.visibleWhen?.dataSourceRef)
            ?? normalizedContainerVisibilityRef(container.dataSourceRef)
            ?? normalizedContainerVisibilityRef(inheritedDataSourceRef)
            ?? ""
    }

    private var visibilityDataTaskKey: String {
        guard observesPrimitiveState else { return "" }
        return "\(window?.windowID ?? "")#\(visibilityDataSourceRef)"
    }

    private var observesPrimitiveState: Bool {
        container.visibleWhen != nil
            || container.stableTabs != nil
            || container.dataStateBoundary != nil
            || container.relationDrill != nil
            || container.notificationRules != nil
            || container.metricSummary != nil
            || container.detailView != nil
            || container.mutationCommand != nil
            || container.permissionBoundary != nil
            || container.draftForm != nil
            || container.resourceHeader != nil
            || container.editableCollection != nil
            || container.statusWorkflow != nil
            || container.historyDiff != nil
            || container.queryToolbar != nil
            || container.wizard != nil
    }

    private var permissionTaskKey: String {
        guard let spec = container.permissionBoundary else { return "" }
        return "\(window?.windowID ?? "")#\(spec.dataSourceRef ?? "")#\(spec.capability ?? "")"
    }

    private var permissionRows: [[String: JSONValue]] {
        guard let spec = container.permissionBoundary else { return [] }
        switch spec.mode?.lowercased() ?? "resource" {
        case "selection":
            if !visibilitySelection.selection.isEmpty { return visibilitySelection.selection }
            return visibilitySelection.selected.map { [$0] } ?? []
        case "row": return visibilityCollection
        default: return []
        }
    }

    private var permissionAllowed: Bool {
        guard let spec = container.permissionBoundary else { return true }
        if spec.visibleWhen != nil && !DashboardRuntime.evaluateDashboardCondition(
            spec.visibleWhen,
            metrics: visibilityMetrics.mapValues(containerVisibilityAnyValue),
            form: visibilityForm.mapValues(containerVisibilityAnyValue),
            windowForm: visibilityWindowForm.mapValues(containerVisibilityAnyValue),
            collection: visibilityCollection.map { $0.mapValues(containerVisibilityAnyValue) }
        ) { return false }
        return WorkflowPrimitiveRuntime.permissionAllows(
            spec: spec,
            authorization: authorizationSnapshot,
            rows: permissionRows,
            grants: permissionGrants
        )
    }

    private var boundaryDataSourceRefs: [String] {
        let declared = container.dataStateBoundary?.dataSourceRefs.compactMap(normalizedContainerVisibilityRef) ?? []
        if !declared.isEmpty { return Array(Set(declared)).sorted() }
        return visibilityDataSourceRef.isEmpty ? [] : [visibilityDataSourceRef]
    }

    private var boundaryDataTaskKey: String {
        guard container.dataStateBoundary != nil else { return "" }
        return "\(window?.windowID ?? "")#\(boundaryDataSourceRefs.joined(separator: ","))"
    }

    private var boundaryStateControls: [ControlState] {
        guard container.dataStateBoundary != nil else { return [visibilityControl] }
        return boundaryDataSourceRefs.map { boundaryControls[$0] ?? ControlState(loading: true) }
    }

    private var boundaryStateCollections: [[[String: JSONValue]]] {
        guard container.dataStateBoundary != nil else {
            return [effectiveBoundaryRows(collection: visibilityCollection, form: visibilityForm, metrics: visibilityMetrics)]
        }
        return boundaryDataSourceRefs.map { ref in
            effectiveBoundaryRows(
                collection: boundaryCollections[ref] ?? [],
                form: boundaryForms[ref] ?? [:],
                metrics: boundaryMetrics[ref] ?? [:]
            )
        }
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

    private var boundaryErrorSuppressed: Bool {
        guard let condition = container.dataStateBoundary?.suppressErrorWhen else { return false }
        return DashboardRuntime.evaluateDashboardCondition(
            condition,
            metrics: visibilityMetrics.mapValues(containerVisibilityAnyValue),
            filters: visibilityInput.filter.mapValues(containerVisibilityAnyValue),
            form: visibilityForm.mapValues(containerVisibilityAnyValue),
            windowForm: visibilityWindowForm.mapValues(containerVisibilityAnyValue),
            collection: visibilityCollection.map { $0.mapValues(containerVisibilityAnyValue) }
        )
    }

    private func retryBoundaryError(_ action: DataStateErrorActionSpec) {
        guard let runtime, let window else { return }
        let ref = action.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? action.dataSourceRef!
            : (container.dataStateBoundary?.dataSourceRefs.first ?? container.dataSourceRef ?? inheritedDataSourceRef ?? "")
        guard !ref.isEmpty else { return }
        Task { await runtime.refreshDataSourceCollection(windowID: window.windowID, dataSourceRef: ref) }
    }

    @MainActor
    private func observeVisibilityWindowForm() async {
        guard observesPrimitiveState, let runtime, let window else { return }
        visibilityWindowForm = await runtime.windowFormJSONValue(windowID: window.windowID)
        let stream = await runtime.windowFormUpdates(windowID: window.windowID)
        for await next in stream { visibilityWindowForm = next }
    }

    @MainActor
    private func observeVisibilityDataSource() async {
        guard observesPrimitiveState,
              let runtime,
              let window,
              !visibilityDataSourceRef.isEmpty else { return }
        let ref = visibilityDataSourceRef
        visibilityCollection = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: ref)
        visibilityForm = await runtime.formJSONValue(windowID: window.windowID, dataSourceRef: ref)
        visibilityMetrics = await runtime.dataSourceMetrics(windowID: window.windowID, dataSourceRef: ref)
        visibilityInput = await runtime.dataSourceInputState(windowID: window.windowID, dataSourceRef: ref)
        visibilitySelection = await runtime.dataSourceSelectionState(windowID: window.windowID, dataSourceRef: ref)
        visibilityControl = await runtime.dataSourceControl(windowID: window.windowID, dataSourceRef: ref)
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
            group.addTask {
                let stream = await runtime.dataSourceControlUpdates(windowID: window.windowID, dataSourceRef: ref)
                for await next in stream { await MainActor.run { visibilityControl = next } }
            }
        }
    }

    @MainActor
    private func observeBoundaryDataSources() async {
        guard container.dataStateBoundary != nil,
              let runtime,
              let window,
              !boundaryDataSourceRefs.isEmpty else { return }
        let refs = boundaryDataSourceRefs
        for ref in refs {
            boundaryCollections[ref] = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: ref)
            boundaryForms[ref] = await runtime.formJSONValue(windowID: window.windowID, dataSourceRef: ref)
            boundaryMetrics[ref] = await runtime.dataSourceMetrics(windowID: window.windowID, dataSourceRef: ref)
            boundaryControls[ref] = await runtime.dataSourceControl(windowID: window.windowID, dataSourceRef: ref)
            if container.fetchData != false,
               boundaryCollections[ref]?.isEmpty != false,
               boundaryForms[ref]?.isEmpty != false,
               boundaryMetrics[ref]?.isEmpty != false,
               boundaryControls[ref]?.loading != true {
                await runtime.refreshDataSourceCollection(windowID: window.windowID, dataSourceRef: ref)
                boundaryCollections[ref] = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: ref)
                boundaryForms[ref] = await runtime.formJSONValue(windowID: window.windowID, dataSourceRef: ref)
                boundaryMetrics[ref] = await runtime.dataSourceMetrics(windowID: window.windowID, dataSourceRef: ref)
                boundaryControls[ref] = await runtime.dataSourceControl(windowID: window.windowID, dataSourceRef: ref)
            }
        }
        await withTaskGroup(of: Void.self) { group in
            for ref in refs {
                group.addTask {
                    let stream = await runtime.dataSourceCollectionUpdates(windowID: window.windowID, dataSourceRef: ref)
                    for await next in stream { await MainActor.run { boundaryCollections[ref] = next } }
                }
                group.addTask {
                    let stream = await runtime.dataSourceFormUpdates(windowID: window.windowID, dataSourceRef: ref)
                    for await next in stream { await MainActor.run { boundaryForms[ref] = next } }
                }
                group.addTask {
                    let stream = await runtime.dataSourceMetricsUpdates(windowID: window.windowID, dataSourceRef: ref)
                    for await next in stream { await MainActor.run { boundaryMetrics[ref] = next } }
                }
                group.addTask {
                    let stream = await runtime.dataSourceControlUpdates(windowID: window.windowID, dataSourceRef: ref)
                    for await next in stream { await MainActor.run { boundaryControls[ref] = next } }
                }
            }
        }
    }

    @MainActor
    private func observePermissionState() async {
        guard let spec = container.permissionBoundary, let runtime, let window else { return }
        authorizationSnapshot = await runtime.windowMetadata(id: window.windowID)?.authorizationSnapshot ?? [:]
        guard let ref = normalizedContainerVisibilityRef(spec.dataSourceRef) else { return }
        permissionGrants = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: ref)
        let stream = await runtime.dataSourceCollectionUpdates(windowID: window.windowID, dataSourceRef: ref)
        for await next in stream { permissionGrants = next }
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
        } else if effectiveContainer.wizard != nil {
            WorkflowWizardRenderer(
                runtime: runtime,
                window: window,
                container: effectiveContainer,
                form: visibilityForm,
                collection: visibilityCollection,
                metrics: visibilityMetrics,
                windowForm: visibilityWindowForm
            )
        } else if effectiveContainer.assignmentPicker != nil,
                  let runtime,
                  let window {
            AssignmentPickerRenderer(runtime: runtime, window: window, container: effectiveContainer)
        } else if effectiveContainer.scheduleEditor != nil,
                  let runtime,
                  let window {
            ScheduleEditorRenderer(runtime: runtime, window: window, container: effectiveContainer)
        } else if effectiveContainer.treeEditor != nil,
                  let runtime,
                  let window {
            TreeEditorRenderer(runtime: runtime, window: window, container: effectiveContainer)
        } else if effectiveContainer.uploadCollection != nil,
                  let runtime,
                  let window {
            UploadCollectionRenderer(runtime: runtime, window: window, container: effectiveContainer)
        } else if effectiveContainer.masterDetail != nil,
                  let runtime,
                  let window {
            MasterDetailRenderer(runtime: runtime, window: window, container: effectiveContainer)
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
                TableRenderer(runtime: runtime, window: window, container: effectiveContainer, table: responsiveTable(table, container: effectiveContainer))
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
        } else if effectiveContainer.stableTabs != nil {
            StableTabsRenderer(runtime: runtime, window: window, container: effectiveContainer, form: visibilityForm, collection: visibilityCollection, metrics: visibilityMetrics, windowForm: visibilityWindowForm, selection: visibilitySelection)
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
        let inheritedRef = inheritedDataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let effectiveDataSourceRef = container.dataSourceRef ?? (inheritedRef.isEmpty ? nil : inheritedRef)
        let effectiveTabs = container.tabs ?? container.stableTabs.map {
            TabsDef(defaultSelectedTabId: $0.defaultSelectedTabId, style: $0.appearance)
        }
        return ContainerDef(
            id: container.id,
            title: container.title,
            subtitle: container.subtitle,
            kind: container.kind,
            scrollMode: container.scrollMode,
            role: container.role,
            dataSourceRef: effectiveDataSourceRef,
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
            tabs: effectiveTabs,
            dataStateBoundary: container.dataStateBoundary,
            relationDrill: container.relationDrill,
            notificationRules: container.notificationRules,
            metricSummary: container.metricSummary,
            detailView: container.detailView,
            masterDetail: container.masterDetail,
            mutationCommand: container.mutationCommand,
            editableCollection: container.editableCollection,
            assignmentPicker: container.assignmentPicker,
            statusWorkflow: container.statusWorkflow,
            treeEditor: container.treeEditor,
            wizard: container.wizard,
            uploadCollection: container.uploadCollection,
            derivedDataSource: container.derivedDataSource,
            permissionBoundary: container.permissionBoundary,
            responsiveDataGrid: container.responsiveDataGrid,
            historyDiff: container.historyDiff,
            scheduleEditor: container.scheduleEditor,
            draftForm: container.draftForm,
            queryToolbar: container.queryToolbar,
            stableTabs: container.stableTabs,
            resourceHeader: container.resourceHeader,
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

    private func responsiveTable(_ table: TableDef, container: ContainerDef) -> TableDef {
        guard let spec = container.responsiveDataGrid else { return table }
        let target = horizontalSizeClass == .compact ? "phone" : "desktop"
        guard let state = WorkflowPrimitiveRuntime.responsiveDataGridState(spec: spec, target: target) else { return table }
        let requested = state.columns ?? []
        let projected = requested.isEmpty ? table.columns : requested.compactMap { requestedID in
            table.columns.first { [ $0.id, $0.key, $0.name ].compactMap { $0 }.contains(requestedID) }
        }
        let sticky = Set(state.stickyColumns ?? [])
        let columns = projected.map { column in
            let id = column.id ?? column.key ?? column.name ?? ""
            var override = state.columnOverrides?[id] ?? [:]
            if state.stickyColumns != nil { override["frozen"] = .bool(sticky.contains(id)) }
            guard !override.isEmpty,
                  let baseData = try? JSONEncoder().encode(column),
                  var base = try? JSONDecoder().decode([String: JSONValue].self, from: baseData) else { return column }
            override.forEach { base[$0.key] = $0.value }
            guard let mergedData = try? JSONEncoder().encode(base),
                  let merged = try? JSONDecoder().decode(ColumnDef.self, from: mergedData) else { return column }
            return merged
        }
        let presentation = state.rowLayout?.lowercased() == "table" ? "tabular" : table.presentation
        return TableDef(
            title: table.title,
            presentation: presentation,
            columns: columns,
            toolbar: table.toolbar,
            on: table.on,
            selectionField: table.selectionField,
            disabledField: table.disabledField,
            callback: table.callback,
            emptyState: table.emptyState,
            target: table.target,
            targetOverrides: table.targetOverrides
        )
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

private func effectiveBoundaryRows(
    collection: [[String: JSONValue]],
    form: [String: JSONValue],
    metrics: [String: JSONValue]
) -> [[String: JSONValue]] {
    if !collection.isEmpty { return collection }
    if !form.isEmpty { return [form] }
    if !metrics.isEmpty { return [metrics] }
    return []
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

private func containerToolbarSymbol(_ icon: String?) -> String {
    switch icon?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
    case "floppy-disk", "save": return "tray.and.arrow.down.fill"
    case "arrow-left", "back": return "chevron.left"
    case "plus", "add", "new-object": return "plus"
    case "refresh": return "arrow.clockwise"
    case "history", "time": return "clock.arrow.circlepath"
    case "edit": return "pencil"
    case "play", "run": return "play.fill"
    case "trash", "delete": return "trash"
    case "pdf", "document-pdf": return "doc.richtext"
    default: return "circle"
    }
}

private func containerToolbarColor(_ item: ToolbarItemDef) -> Color {
    guard let raw = item.style["color"]?.stringValue,
          let color = Color(containerHex: raw) else {
        return .accentColor
    }
    return color
}

private extension Color {
    init?(containerHex rawValue: String) {
        var value = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let rgb = UInt64(value, radix: 16) else { return nil }
        self.init(
            red: Double((rgb >> 16) & 0xff) / 255,
            green: Double((rgb >> 8) & 0xff) / 255,
            blue: Double(rgb & 0xff) / 255
        )
    }
}

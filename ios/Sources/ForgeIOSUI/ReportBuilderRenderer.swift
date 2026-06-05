import SwiftUI
import Charts
import ForgeIOSRuntime

public struct ReportBuilderRenderer: View {
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    private let config: DashboardReportBuilderDef

    @State private var rows: [[String: JSONValue]] = []
    @State private var selectedMeasures: [String] = []
    @State private var selectedDimensions: [String] = []
    @State private var chartSpec: ReportBuilderChartSpecDef? = nil
    @State private var viewMode: String = "table"
    @State private var selectedPreviousTitle: String = ""
    @State private var storedPresets: [StoredReportBuilderChartPreset] = []
    @State private var staticFilters: [String: ReportBuilderStaticFilterValue] = [:]
    @State private var dynamicGroups: [String: [ReportBuilderDynamicRowState]] = [:]
    @State private var dynamicFilterDrafts: [String: String] = [:]
    @State private var availableDialogIDs: Set<String> = []
    @State private var windowActionsCode: String? = nil
    @State private var windowNamespace: String = ""
    @State private var restoredStoredState = false
    @State private var windowFormValues: [String: JSONValue] = [:]
    @State private var appliedPrefillSignature = ""
    @State private var requestBridgeGeneration = 0

    public init(runtime: ForgeRuntime? = nil, window: WindowContext? = nil, container: ContainerDef, config: DashboardReportBuilderDef) {
        self.runtime = runtime
        self.window = window
        self.container = container
        self.config = config
    }

    public var body: some View {
        layoutView
        .task(id: taskKey) {
            await loadRows()
        }
        .task(id: hydrationTaskKey) {
            await hydrateInitialStateIfNeeded()
        }
        .task(id: windowFormTaskKey) {
            await observeWindowFormUpdates()
        }
        .task(id: currentPrefillSignature) {
            await applyWindowFormPrefillIfNeeded()
        }
        .onChange(of: persistenceSignature) {
            guard restoredStoredState else { return }
            Task {
                await persistStoredState()
            }
        }
        .onChange(of: requestSignature) {
            guard restoredStoredState else { return }
            requestBridgeGeneration += 1
        }
        .onChange(of: settingsHash) {
            refreshStoredPresets()
        }
        .task(id: requestBridgeGeneration) {
            guard restoredStoredState else { return }
            await bridgeRequestToDataSource()
        }
    }

    private var layoutView: ReportBuilderLayoutView {
        ReportBuilderLayoutView(
            measuresSection: measuresSection,
            dimensionsSection: dimensionsSection,
            staticFiltersSection: staticFiltersSectionView,
            dynamicFiltersSection: dynamicFiltersSectionView,
            chartCreationSection: chartCreationSectionView,
            chartModeSection: chartModeSectionView,
            resultSection: resultSectionView
        )
    }

    private var taskKey: String {
        [window?.windowID ?? "", container.id ?? "", container.dataSourceRef ?? ""].joined(separator: ":")
    }

    private var hydrationTaskKey: String {
        [window?.windowID ?? "", builderStateKey ?? "", container.dataSourceRef ?? ""].joined(separator: ":")
    }

    private var windowFormTaskKey: String {
        window?.windowID ?? ""
    }

    private var currentPrefillSignature: String {
        Self.reportBuilderPrefillSignature(windowFormValues)
    }

    private var explicitChartMode: Bool {
        (config.result?.chartCreationMode ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "explicit"
    }

    private var measureItems: [(String, String)] {
        visibleMeasures.map { ($0.label ?? $0.identityKey, $0.identityKey) }
    }

    private var dimensionItems: [(String, String)] {
        visibleDimensions.map { ($0.label ?? $0.identityKey, $0.identityKey) }
    }

    private var visibleMeasures: [ReportBuilderMeasureDef] {
        config.measures.filter { $0.hidden != true }
    }

    private var visibleDimensions: [ReportBuilderDimensionDef] {
        config.dimensions.filter { $0.hidden != true }
    }

    private var settingsHash: String {
        Self.buildSettingsHash(dimensions: selectedDimensions, measures: selectedMeasures)
    }

    private var persistenceSignature: String {
        [
            selectedMeasures.joined(separator: "|"),
            selectedDimensions.joined(separator: "|"),
            staticFiltersSignature,
            dynamicGroupsSignature,
            dictionarySignature(dynamicFilterDrafts),
            chartSpecSignature,
            viewMode
        ].joined(separator: "::")
    }

    private var requestSignature: String {
        [
            selectedMeasures.joined(separator: "|"),
            selectedDimensions.joined(separator: "|"),
            staticFiltersSignature,
            dynamicGroupsSignature
        ].joined(separator: "::")
    }

    private var chartSpecSignature: String {
        guard let chartSpec else { return "" }
        return [
            chartSpec.title ?? "",
            chartSpec.type ?? "",
            chartSpec.xField ?? "",
            chartSpec.yFields.joined(separator: "|"),
            chartSpec.seriesField ?? ""
        ].joined(separator: "|")
    }

    private var staticFiltersSignature: String {
        staticFilters
            .keys
            .sorted()
            .map { key in
                let value = staticFilters[key]
                return "\(key)=\(Self.staticFilterSignature(value))"
            }
            .joined(separator: "|")
    }

    private var dynamicGroupsSignature: String {
        dynamicGroups
            .keys
            .sorted()
            .map { key in
                let rows = (dynamicGroups[key] ?? []).map { row in
                    let selections = row.selections.map { selection in
                        "\(selection.value.jsonSignature)|\(selection.label)|\(selection.group)"
                    }.joined(separator: ",")
                    return "\(row.id)|\(row.filterId)|\(row.enabled)|\(selections)"
                }.joined(separator: ";")
                return "\(key)=\(rows)"
            }
            .joined(separator: "::")
    }

    private var aggregatedRows: [[String: JSONValue]] {
        Self.aggregateRows(rows: filteredRows, dimensions: selectedDimensions, measures: selectedMeasures)
    }

    private var filteredRows: [[String: JSONValue]] {
        Self.applyStaticFilters(rows: rows, filters: config.staticFilters, state: staticFilters)
    }

    private var requestPayload: [String: JSONValue] {
        let base = Self.buildRequestPayload(
            config: config,
            selectedMeasures: selectedMeasures,
            selectedDimensions: selectedDimensions,
            staticFilters: staticFilters,
            dynamicGroups: dynamicGroups
        )
        return applyBuildRequestHook(base)
    }

    private var measuresSection: AnyView {
        AnyView(chipSection(title: "Measures", items: measureItems, selection: $selectedMeasures))
    }

    private var dimensionsSection: AnyView {
        AnyView(breakdownSection(title: "Breakdowns", items: dimensionItems, selection: $selectedDimensions))
    }

    private var staticFiltersSectionView: AnyView {
        AnyView(staticFilterSection)
    }

    private var dynamicFiltersSectionView: AnyView {
        AnyView(
            ReportBuilderDynamicFiltersView(
                groups: config.dynamicFilterGroups,
                families: config.dynamicFilterFamilies,
                unifiedFamilyRows: config.unifiedFamilyRows,
                rowsByGroupID: dynamicGroups,
                drafts: dynamicFilterDrafts,
                isLookupAvailable: { groupID, filter in
                    lookupDescriptor(for: groupID, rowID: nil, filter: filter) != nil
                },
                onAddRow: { groupID, filterID in
                    dynamicGroups[groupID, default: []].append(
                        ReportBuilderDynamicRowState(
                            filterId: filterID,
                            enabled: true,
                            selections: []
                        )
                    )
                },
                onChangeFilter: { groupID, rowID, filterID in
                    dynamicGroups[groupID] = dynamicGroups[groupID, default: []].map { row in
                        guard row.id == rowID else { return row }
                        return ReportBuilderDynamicRowState(
                            id: row.id,
                            filterId: filterID,
                            enabled: row.enabled,
                            selections: []
                        )
                    }
                },
                onMoveRow: { fromGroupID, rowID, toGroupID, filterID, resetSelections in
                    guard let row = dynamicGroups[fromGroupID, default: []].first(where: { $0.id == rowID }) else {
                        return
                    }
                    dynamicGroups[fromGroupID] = dynamicGroups[fromGroupID, default: []].filter { $0.id != rowID }
                    dynamicGroups[toGroupID, default: []].append(
                        ReportBuilderDynamicRowState(
                            id: row.id,
                            filterId: filterID,
                            enabled: row.enabled,
                            selections: resetSelections ? [] : row.selections
                        )
                    )
                    if resetSelections {
                        dynamicFilterDrafts[rowID] = nil
                    }
                },
                onToggleEnabled: { groupID, rowID in
                    dynamicGroups[groupID] = dynamicGroups[groupID, default: []].map { row in
                        guard row.id == rowID else { return row }
                        return ReportBuilderDynamicRowState(
                            id: row.id,
                            filterId: row.filterId,
                            enabled: !row.enabled,
                            selections: row.selections
                        )
                    }
                },
                onRemoveRow: { groupID, rowID in
                    dynamicGroups[groupID] = dynamicGroups[groupID, default: []].filter { $0.id != rowID }
                    dynamicFilterDrafts[rowID] = nil
                },
                onDraftChange: { rowID, value in
                    dynamicFilterDrafts[rowID] = value
                },
                onAddManualSelection: { groupID, rowID, filter, rawValue in
                    guard let selection = Self.projectManualSelection(filter: filter, rawValue: rawValue) else {
                        return false
                    }
                    dynamicGroups[groupID] = dynamicGroups[groupID, default: []].map { row in
                        guard row.id == rowID else { return row }
                        let nextSelections = filter.multiple == true || filter.emitArray == true
                            ? Self.upsertDynamicSelections(row.selections, incoming: [selection])
                            : [selection]
                        return ReportBuilderDynamicRowState(
                            id: row.id,
                            filterId: row.filterId,
                            enabled: row.enabled,
                            selections: nextSelections
                        )
                    }
                    dynamicFilterDrafts[rowID] = ""
                    return true
                },
                onRemoveSelection: { groupID, rowID, selectionIndex in
                    dynamicGroups[groupID] = dynamicGroups[groupID, default: []].map { row in
                        guard row.id == rowID else { return row }
                        let nextSelections = row.selections.enumerated()
                            .filter { $0.offset != selectionIndex }
                            .map(\.element)
                        return ReportBuilderDynamicRowState(
                            id: row.id,
                            filterId: row.filterId,
                            enabled: row.enabled,
                            selections: nextSelections
                        )
                    }
                },
                onPickSelection: { groupID, rowID, filter in
                    Task {
                        await pickLookupSelection(groupID: groupID, rowID: rowID, filter: filter)
                    }
                }
            )
        )
    }

    private var chartCreationSectionView: AnyView {
        AnyView(chartCreationSection)
    }

    private var chartModeSectionView: AnyView {
        AnyView(chartModeSection)
    }

    private var resultSectionView: AnyView {
        AnyView(resultSection)
    }

    @ViewBuilder
    private var chartCreationSection: some View {
        if explicitChartMode && chartSpec == nil {
            chartTile
        }
    }

    @ViewBuilder
    private var chartModeSection: some View {
        if chartSpec != nil {
            HStack(spacing: 8) {
                Button("Table") { viewMode = "table" }
                    .buttonStyle(.bordered)
                Button("Chart") { viewMode = "chart" }
                    .buttonStyle(.bordered)
                Button(role: .destructive) {
                    chartSpec = nil
                    viewMode = "table"
                } label: {
                    Text("Remove Chart")
                }
                .buttonStyle(.bordered)
            }
        }
    }

    @ViewBuilder
    private var resultSection: some View {
        if viewMode == "chart", let spec = chartSpec {
            chartView(spec: spec)
        } else {
            tableView
        }
    }

    @ViewBuilder
    private var chartTile: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Chart")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            Text("Create a chart from this table")
                .font(.headline)
            Text("Choose a default chart, reuse a previous one, or build a quick chart from the visible dimensions and measures.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            HStack(spacing: 8) {
                Button {
                    if let spec = quickChartSpec() {
                        applyChart(spec)
                    }
                } label: {
                    Label("Create Chart", systemImage: "plus")
                }
                .buttonStyle(.borderedProminent)
                Menu {
                    if storedPresets.isEmpty {
                        Text("No matching saved charts")
                    } else {
                        ForEach(storedPresets, id: \.title) { preset in
                            Button(preset.title) {
                                selectedPreviousTitle = preset.title
                                applyChart(preset.chartSpec, persist: false)
                            }
                        }
                    }
                } label: {
                    Label("Previous", systemImage: "clock.arrow.circlepath")
                }
                .buttonStyle(.bordered)
            }
            if let result = config.result, !result.defaultChartSpecs.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(result.defaultChartSpecs) { spec in
                            Button {
                                applyChart(spec)
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(spec.title ?? generatedTitle(for: spec))
                                        .font(.footnote.weight(.semibold))
                                    Text((spec.type ?? "line").uppercased())
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                .padding(.horizontal, 10)
                                .padding(.vertical, 8)
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
            }
        }
        .padding()
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 16))
    }

    @ViewBuilder
    private var staticFilterSection: some View {
        if !config.staticFilters.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Filters").font(.subheadline.weight(.semibold))
                ForEach(config.staticFilters) { filter in
                    let key = filter.identityKey
                    VStack(alignment: .leading, spacing: 6) {
                        Text(filter.label ?? key)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.secondary)
                        if (filter.type ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "daterange" {
                            let current = staticFilters[key] ?? .dateRange(start: "", end: "")
                            HStack(spacing: 8) {
                                dateRangeTextField(
                                    "Start",
                                    text: Binding(
                                        get: { current.startValue },
                                        set: { next in staticFilters[key] = .dateRange(start: next, end: current.endValue) }
                                    )
                                )
                                dateRangeTextField(
                                    "End",
                                    text: Binding(
                                        get: { current.endValue },
                                        set: { next in staticFilters[key] = .dateRange(start: current.startValue, end: next) }
                                    )
                                )
                            }
                        } else {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(filter.options) { option in
                                        let optionValue = option.value?.stringValue ?? option.label ?? option.id
                                        Button {
                                            let current = staticFilters[key]?.listValue ?? []
                                            let next = current.contains(optionValue)
                                                ? current.filter { $0 != optionValue }
                                                : current + [optionValue]
                                            staticFilters[key] = .list(next)
                                        } label: {
                                            Text(option.label ?? optionValue)
                                                .font(.caption.weight(.medium))
                                                .padding(.horizontal, 10)
                                                .padding(.vertical, 6)
                                                .background((staticFilters[key]?.listValue ?? []).contains(optionValue) ? Color.accentColor.opacity(0.14) : Color.secondary.opacity(0.08), in: Capsule())
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func chipSection(title: String, items: [(String, String)], selection: Binding<[String]>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.subheadline.weight(.semibold))
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(items, id: \.1) { label, key in
                        Button {
                            selection.wrappedValue = Self.toggle(selection.wrappedValue, key: key)
                            if selection.wrappedValue.isEmpty { selection.wrappedValue = [key] }
                        } label: {
                            Text(label)
                                .font(.caption.weight(.medium))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(selection.wrappedValue.contains(key) ? Color.accentColor.opacity(0.14) : Color.secondary.opacity(0.08), in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func dateRangeTextField(_ placeholder: String, text: Binding<String>) -> some View {
        TextField(placeholder, text: text)
            .font(.footnote.monospacedDigit().weight(.medium))
            .textFieldStyle(.plain)
            .foregroundStyle(Color(red: 0.12, green: 0.23, blue: 0.17))
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .frame(width: 118, alignment: .leading)
            .background(Color(red: 0.93, green: 0.98, blue: 0.95), in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(red: 0.78, green: 0.88, blue: 0.82), lineWidth: 1))
    }

    @ViewBuilder
    private func breakdownSection(title: String, items: [(String, String)], selection: Binding<[String]>) -> some View {
        let availableItems = items.filter { item in !selection.wrappedValue.contains(item.1) }
        let selectedItems = selection.wrappedValue.compactMap { key in
            items.first(where: { $0.1 == key })
        }

        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.subheadline.weight(.semibold))
            Menu {
                if availableItems.isEmpty {
                    Text("All breakdowns added")
                } else {
                    ForEach(availableItems, id: \.1) { label, key in
                        Button(label) {
                            selection.wrappedValue = selection.wrappedValue + [key]
                        }
                    }
                }
            } label: {
                HStack(spacing: 8) {
                    Text(availableItems.isEmpty ? "All breakdowns added" : "Add breakdown...")
                        .font(.caption.weight(.medium))
                    Image(systemName: "chevron.down")
                        .font(.caption.weight(.semibold))
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.secondary.opacity(0.08), in: Capsule())
            }
            .disabled(availableItems.isEmpty)

            if !selectedItems.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(selectedItems, id: \.1) { label, key in
                            let removable = selectedItems.count > 1
                            Button {
                                guard removable else { return }
                                selection.wrappedValue = selection.wrappedValue.filter { $0 != key }
                            } label: {
                                HStack(spacing: 5) {
                                    Text(label)
                                    if removable {
                                        Image(systemName: "xmark")
                                            .font(.caption2.weight(.bold))
                                    }
                                }
                                .font(.caption.weight(.medium))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Color.accentColor.opacity(0.14), in: Capsule())
                            }
                            .buttonStyle(.plain)
                            .disabled(!removable)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var tableView: some View {
        if aggregatedRows.isEmpty {
            Text("No rows")
                .font(.footnote)
                .foregroundStyle(.secondary)
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 0) {
                        ForEach(selectedDimensions + selectedMeasures, id: \.self) { key in
                            Text(label(for: key))
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                                .frame(width: 120, alignment: .leading)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 8)
                        }
                    }
                    .background(Color.secondary.opacity(0.06))
                    ForEach(Array(aggregatedRows.enumerated()), id: \.offset) { _, row in
                        HStack(spacing: 0) {
                            ForEach(selectedDimensions + selectedMeasures, id: \.self) { key in
                                Text(displayValue(row[key]))
                                    .font(.footnote)
                                    .frame(width: 120, alignment: .leading)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 8)
                            }
                        }
                        Divider()
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func chartView(spec: ReportBuilderChartSpecDef) -> some View {
        let points = Self.chartPoints(from: aggregatedRows, spec: spec)
        if points.isEmpty {
            Text("No chart data")
                .font(.footnote)
                .foregroundStyle(.secondary)
        } else {
            Chart(points) { point in
                switch (spec.type ?? "line").lowercased() {
                case "bar":
                    BarMark(
                        x: .value("X", point.x),
                        y: .value("Value", point.value)
                    )
                    .foregroundStyle(by: .value("Series", point.series))
                case "area":
                    AreaMark(
                        x: .value("X", point.x),
                        y: .value("Value", point.value)
                    )
                    .foregroundStyle(by: .value("Series", point.series))
                default:
                    LineMark(
                        x: .value("X", point.x),
                        y: .value("Value", point.value)
                    )
                    .foregroundStyle(by: .value("Series", point.series))
                }
            }
            .frame(height: 220)
        }
    }

    private func loadRows() async {
        guard let runtime, let window, let dataSourceRef = container.dataSourceRef, !dataSourceRef.isEmpty else {
            rows = []
            return
        }
        rows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: dataSourceRef)
    }

    @MainActor
    private func hydrateInitialStateIfNeeded() async {
        guard !restoredStoredState else { return }
        defer {
            refreshStoredPresets()
            restoredStoredState = true
            requestBridgeGeneration += 1
        }

        await refreshAvailableDialogs()
        await refreshWindowFormValues()

        if let restored = await loadPersistedState() {
            apply(restored: restored)
            await applyInitializeStateHookIfNeeded(windowForm: windowFormValues)
            appliedPrefillSignature = currentPrefillSignature
            return
        }

        if selectedMeasures.isEmpty { selectedMeasures = defaultMeasureKeys() }
        if selectedDimensions.isEmpty { selectedDimensions = defaultDimensionKeys() }
        if staticFilters.isEmpty { staticFilters = defaultStaticFilters() }
        if explicitChartMode {
            viewMode = "table"
        } else {
            viewMode = config.result?.defaultMode ?? "table"
        }
        await applyInitializeStateHookIfNeeded(windowForm: windowFormValues)
        appliedPrefillSignature = currentPrefillSignature
    }

    @MainActor
    private func refreshWindowFormValues() async {
        guard let runtime, let window else {
            windowFormValues = [:]
            return
        }
        windowFormValues = await runtime.windowFormJSONValue(windowID: window.windowID)
    }

    @MainActor
    private func observeWindowFormUpdates() async {
        guard let runtime, let window else {
            windowFormValues = [:]
            return
        }
        windowFormValues = await runtime.windowFormJSONValue(windowID: window.windowID)
        let stream = await runtime.windowFormUpdates(windowID: window.windowID)
        for await next in stream {
            if Task.isCancelled { return }
            windowFormValues = next
        }
    }

    @MainActor
    private func refreshAvailableDialogs() async {
        guard let runtime, let window else {
            availableDialogIDs = []
            windowActionsCode = nil
            windowNamespace = ""
            return
        }
        let metadata = await runtime.windowMetadata(id: window.windowID)
        availableDialogIDs = Set(metadata?.dialogs.compactMap { $0.id?.trimmingCharacters(in: .whitespacesAndNewlines) } ?? [])
        windowActionsCode = metadata?.actions?.code
        windowNamespace = metadata?.namespace?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    @MainActor
    private func applyInitializeStateHookIfNeeded(windowForm: [String: JSONValue]? = nil) async {
        guard let hookName = config.hooks?.initializeState?.trimmingCharacters(in: .whitespacesAndNewlines),
              !hookName.isEmpty,
              let runtime,
              let window else {
            return
        }
        let formValue: [String: JSONValue]
        if let windowForm {
            formValue = windowForm
        } else {
            formValue = await runtime.windowFormJSONValue(windowID: window.windowID)
        }
        guard let stateValue = Self.jsonValue(from: currentStoredState()) else { return }
        let props = Self.objectValue([
            "state": stateValue,
            "windowForm": .object(formValue),
            "config": Self.jsonValue(from: config)
        ])
        guard let result = invokeHook(functionName: hookName, props: props),
              let data = try? JSONEncoder().encode(result),
              let next = try? JSONDecoder().decode(StoredReportBuilderState.self, from: data) else {
            return
        }
        apply(restored: next)
    }

    @MainActor
    private func applyWindowFormPrefillIfNeeded() async {
        let signature = currentPrefillSignature
        guard restoredStoredState,
              !signature.isEmpty,
              signature != appliedPrefillSignature else {
            return
        }
        await applyInitializeStateHookIfNeeded(windowForm: windowFormValues)
        appliedPrefillSignature = signature
        requestBridgeGeneration += 1
    }

    private func applyBuildRequestHook(_ request: [String: JSONValue]) -> [String: JSONValue] {
        guard let hookName = config.hooks?.buildRequest?.trimmingCharacters(in: .whitespacesAndNewlines),
              !hookName.isEmpty,
              let requestValue = Self.jsonValue(from: request) else {
            return request
        }
        let props = Self.objectValue([
            "request": requestValue,
            "state": Self.jsonValue(from: currentStoredState()),
            "config": Self.jsonValue(from: config)
        ])
        return invokeHook(functionName: hookName, props: props)?.objectValue ?? request
    }

    private func lookupDescriptor(
        for groupID: String,
        rowID: String?,
        filter: ReportBuilderDynamicFilterDef
    ) -> ReportBuilderLookupDescriptor? {
        let directDialogID = filter.dialogId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let baseDialogID = directDialogID.isEmpty ? nil : directDialogID
        var descriptor = ReportBuilderLookupDescriptor(
            dialogID: baseDialogID,
            parameters: [:],
            selectionMode: filter.multiple == false ? "single" : "multi"
        )

        if let hookName = config.hooks?.resolveLookup?.trimmingCharacters(in: .whitespacesAndNewlines),
           !hookName.isEmpty {
            let props = Self.objectValue([
                "state": Self.jsonValue(from: currentStoredState()),
                "group": .object(["id": .string(groupID)]),
                "filterDef": Self.jsonValue(from: filter),
                "rowId": rowID.map(JSONValue.string)
            ])
            if let result = invokeHook(functionName: hookName, props: props)?.objectValue {
                if let dialogID = result["dialogId"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines), !dialogID.isEmpty {
                    descriptor.dialogID = dialogID
                }
                if let parameters = result["parameters"]?.objectValue, !parameters.isEmpty {
                    descriptor.parameters = parameters
                }
                if let multiple = result["multiple"]?.boolValue {
                    descriptor.selectionMode = multiple ? "multi" : "single"
                }
            }
        }

        guard let dialogID = descriptor.dialogID, availableDialogIDs.contains(dialogID) else {
            return nil
        }
        return descriptor
    }

    private func invokeHook(functionName: String, props: JSONValue) -> JSONValue? {
        guard let code = windowActionsCode?.trimmingCharacters(in: .whitespacesAndNewlines),
              !code.isEmpty else {
            return nil
        }
        for candidate in resolveHookFunctionCandidates(functionName) {
            if let result = try? ActionHookRuntime.invoke(
                code: code,
                functionName: candidate,
                props: props
            ) {
                return result
            }
        }
        return nil
    }

    private func resolveHookFunctionCandidates(_ functionName: String) -> [String] {
        let trimmed = functionName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }
        var candidates = [trimmed]
        if !windowNamespace.isEmpty {
            let prefix = windowNamespace + "."
            if trimmed.hasPrefix(prefix) {
                candidates.append(String(trimmed.dropFirst(prefix.count)))
            } else {
                candidates.append(prefix + trimmed)
            }
        }
        return Array(NSOrderedSet(array: candidates)) as? [String] ?? candidates
    }

    private func bridgeRequestToDataSource() async {
        guard let runtime else { return }
        guard let window else { return }
        let resolvedDataSourceRef = container.dataSourceRef ?? ""
        if resolvedDataSourceRef.isEmpty { return }
        await runtime.setDataSourceInputParameters(
            windowID: window.windowID,
            dataSourceRef: resolvedDataSourceRef,
            parameters: requestPayload,
            fetch: true
        )
        await runtime.refreshDataSourceCollection(
            windowID: window.windowID,
            dataSourceRef: resolvedDataSourceRef
        )
        rows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
    }

    @MainActor
    private func pickLookupSelection(
        groupID: String,
        rowID: String,
        filter: ReportBuilderDynamicFilterDef
    ) async {
        guard let runtime, let window else { return }
        guard let descriptor = lookupDescriptor(for: groupID, rowID: rowID, filter: filter) else { return }
        guard let dialogID = descriptor.dialogID else { return }
        let selectionMode = descriptor.selectionMode
        let opened = await runtime.presentDialog(
            windowID: window.windowID,
            dialogID: dialogID,
            parameters: descriptor.parameters,
            selectionMode: selectionMode
        )
        guard opened else {
            return
        }
        guard let payload = await runtime.awaitDialogResult(
            windowID: window.windowID,
            dialogID: dialogID
        ) else {
            return
        }
        let selections = Self.projectLookupSelections(filter: filter, payload: payload)
        guard !selections.isEmpty else { return }
        dynamicGroups[groupID] = dynamicGroups[groupID, default: []].map { row in
            guard row.id == rowID else { return row }
            let nextSelections = filter.multiple == false
                ? [selections[0]]
                : Self.upsertDynamicSelections(row.selections, incoming: selections)
            return ReportBuilderDynamicRowState(
                id: row.id,
                filterId: row.filterId,
                enabled: row.enabled,
                selections: nextSelections
            )
        }
    }

    private func defaultMeasureKeys() -> [String] {
        let explicit = visibleMeasures.filter { $0.defaultValue == true }.map(\.identityKey)
        return explicit.isEmpty ? visibleMeasures.first.map { [$0.identityKey] } ?? [] : explicit
    }

    private func defaultDimensionKeys() -> [String] {
        let explicit = visibleDimensions.filter { $0.defaultValue == true || $0.chartAxis == true }.map(\.identityKey)
        return explicit.isEmpty ? visibleDimensions.first.map { [$0.identityKey] } ?? [] : explicit
    }

    private func defaultStaticFilters() -> [String: ReportBuilderStaticFilterValue] {
        var result: [String: ReportBuilderStaticFilterValue] = [:]
        for filter in config.staticFilters {
            let key = filter.identityKey
            if (filter.type ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "daterange" {
                let object = filter.defaultValue?.objectValue ?? [:]
                result[key] = .dateRange(
                    start: object["start"]?.stringValue ?? "",
                    end: object["end"]?.stringValue ?? ""
                )
            } else {
                let defaults = filter.options.compactMap { option -> String? in
                    guard option.defaultValue == true else { return nil }
                    return option.value?.stringValue ?? option.label
                }
                if !defaults.isEmpty {
                    result[key] = .list(defaults)
                }
            }
        }
        return result
    }

    private func quickChartSpec() -> ReportBuilderChartSpecDef? {
        guard let xField = selectedDimensions.first, let yField = selectedMeasures.first else {
            return nil
        }
        let seriesField = selectedDimensions.dropFirst().first
        return ReportBuilderChartSpecDef(
            title: "\(label(for: yField)) by \(label(for: xField))",
            type: "line",
            xField: xField,
            yFields: [yField],
            seriesField: seriesField
        )
    }

    private func applyChart(_ spec: ReportBuilderChartSpecDef, persist: Bool = true) {
        chartSpec = Self.normalize(spec)
        viewMode = "chart"
        if persist {
            let preset = StoredReportBuilderChartPreset(
                title: spec.title ?? generatedTitle(for: spec),
                settingsHash: settingsHash,
                chartSpec: Self.normalize(spec),
                updatedAt: Date().timeIntervalSince1970
            )
            let next = Self.upsert(loadStoredPresets(), preset: preset)
            saveStoredPresets(next)
            storedPresets = next.filter { $0.settingsHash == settingsHash }
        }
    }

    private func label(for key: String) -> String {
        visibleMeasures.first(where: { $0.identityKey == key })?.label
        ?? visibleDimensions.first(where: { $0.identityKey == key })?.label
        ?? key
    }

    private func generatedTitle(for spec: ReportBuilderChartSpecDef) -> String {
        guard let x = spec.xField, let y = spec.yFields.first else { return spec.title ?? "Chart" }
        return "\(label(for: y)) by \(label(for: x))"
    }

    private func loadStoredPresets() -> [StoredReportBuilderChartPreset] {
        guard let key = storageKey else { return [] }
        guard let data = UserDefaults.standard.data(forKey: key) else { return [] }
        return (try? JSONDecoder().decode([StoredReportBuilderChartPreset].self, from: data)) ?? []
    }

    private func refreshStoredPresets() {
        let matching = loadStoredPresets().filter { $0.settingsHash == settingsHash }
        storedPresets = matching
        if !matching.contains(where: { $0.title == selectedPreviousTitle }) {
            selectedPreviousTitle = ""
        }
    }

    private func saveStoredPresets(_ presets: [StoredReportBuilderChartPreset]) {
        guard let key = storageKey else { return }
        let data = try? JSONEncoder().encode(presets)
        UserDefaults.standard.set(data, forKey: key)
    }

    private func currentStoredState() -> StoredReportBuilderState {
        StoredReportBuilderState(
            selectedMeasures: selectedMeasures,
            selectedDimensions: selectedDimensions,
            chartSpec: chartSpec,
            viewMode: viewMode,
            staticFilters: staticFilters.mapValues { StoredStaticFilterValue(runtimeValue: $0) },
            dynamicGroups: dynamicGroups,
            dynamicFilterDrafts: dynamicFilterDrafts
        )
    }

    private func loadPersistedState() async -> StoredReportBuilderState? {
        guard let runtime, let window, let stateKey = builderStateKey else {
            return nil
        }
        let windowForm = await runtime.windowFormJSONValue(windowID: window.windowID)
        guard let storedValue = Self.resolveNestedValue(windowForm, path: stateKey) else {
            return nil
        }
        guard let data = try? JSONEncoder().encode(storedValue),
              let state = try? JSONDecoder().decode(StoredReportBuilderState.self, from: data) else {
            return nil
        }
        return state
    }

    private func persistStoredState() async {
        guard let runtime, let window, let stateKey = builderStateKey else { return }
        guard let encoded = Self.jsonValue(from: currentStoredState()) else { return }
        var payload: [String: JSONValue] = [:]
        Self.setNestedValue(&payload, path: stateKey, value: encoded)
        await runtime.setWindowFormValue(windowID: window.windowID, values: payload)
    }

    @MainActor
    private func apply(restored state: StoredReportBuilderState) {
        selectedMeasures = state.selectedMeasures
        selectedDimensions = state.selectedDimensions
        chartSpec = state.chartSpec
        viewMode = state.viewMode
        staticFilters = Dictionary(uniqueKeysWithValues: state.staticFilters.map { ($0.key, $0.value.runtimeValue) })
        dynamicGroups = state.dynamicGroups
        dynamicFilterDrafts = state.dynamicFilterDrafts
    }

    private var storageKey: String? {
        guard let id = container.id, !id.isEmpty else { return nil }
        return "reportBuilder.chartPresets.\(id)"
    }

    private var builderStateKey: String? {
        let key = (container.stateKey ?? container.id ?? "reportBuilder")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return key.isEmpty ? nil : key
    }

    private static func toggle(_ current: [String], key: String) -> [String] {
        current.contains(key) ? current.filter { $0 != key } : current + [key]
    }

    private static func buildSettingsHash(dimensions: [String], measures: [String]) -> String {
        let signature = dimensions.joined(separator: "|") + "::" + measures.joined(separator: "|")
        let hash = signature.utf8.reduce(5381) { (($0 << 5) &+ $0) &+ Int($1) }
        return "rb_\(String(hash, radix: 16))"
    }

    private static func reportBuilderPrefillSignature(_ windowForm: [String: JSONValue]) -> String {
        guard let prefill = windowForm["prefill"]?.objectValue, !prefill.isEmpty else {
            return ""
        }
        let meta = windowForm["__forge"]?.objectValue ?? [:]
        let revision = meta["prefillRevision"]?.intValue
            ?? meta["prefillRevision"]?.stringValue.flatMap { Int($0.trimmingCharacters(in: .whitespacesAndNewlines)) }
            ?? 0
        return JSONValue.object([
            "revision": .number(Double(revision)),
            "prefill": .object(prefill)
        ]).signature
    }

    private func dictionarySignature(_ values: [String: String]) -> String {
        values
            .keys
            .sorted()
            .map { "\($0)=\(values[$0] ?? "")" }
            .joined(separator: "|")
    }

    private static func objectValue(_ pairs: [String: JSONValue?]) -> JSONValue {
        .object(pairs.reduce(into: [String: JSONValue]()) { result, entry in
            if let value = entry.value {
                result[entry.key] = value
            }
        })
    }

    private static func staticFilterSignature(_ value: ReportBuilderStaticFilterValue?) -> String {
        guard let value else { return "" }
        switch value {
        case .list(let values):
            return values.joined(separator: ",")
        case .dateRange(let start, let end):
            return "\(start)|\(end)"
        }
    }

    private static func normalize(_ spec: ReportBuilderChartSpecDef) -> ReportBuilderChartSpecDef {
        ReportBuilderChartSpecDef(
            title: spec.title,
            type: (spec.type ?? "line").lowercased(),
            xField: spec.xField,
            yFields: spec.yFields.filter { !$0.isEmpty },
            seriesField: spec.seriesField?.isEmpty == false ? spec.seriesField : nil
        )
    }

    private static func aggregateRows(rows: [[String: JSONValue]], dimensions: [String], measures: [String]) -> [[String: JSONValue]] {
        var grouped: [String: [String: JSONValue]] = [:]
        for row in rows {
            let bucket = dimensions.map { row[$0]?.stringLike ?? "" }.joined(separator: "||")
            var existing = grouped[bucket] ?? [:]
            for key in dimensions {
                if let value = row[key] { existing[key] = value }
            }
            for key in measures {
                let current = existing[key]?.doubleLike ?? 0
                let next = row[key]?.doubleLike ?? 0
                existing[key] = .number(current + next)
            }
            grouped[bucket] = existing
        }
        return grouped.values.sorted {
            ($0[dimensions.first ?? ""]?.stringLike ?? "") < ($1[dimensions.first ?? ""]?.stringLike ?? "")
        }
    }

    private static func buildRequestPayload(
        config: DashboardReportBuilderDef,
        selectedMeasures: [String],
        selectedDimensions: [String],
        staticFilters: [String: ReportBuilderStaticFilterValue],
        dynamicGroups: [String: [ReportBuilderDynamicRowState]]
    ) -> [String: JSONValue] {
        var request: [String: JSONValue] = [:]
        for key in selectedMeasures {
            guard let measure = config.measures.first(where: { $0.identityKey == key }) else { continue }
            setNestedValue(&request, path: measure.paramPath ?? "measures.\(key)", value: .bool(true))
        }
        for key in selectedDimensions {
            guard let dimension = config.dimensions.first(where: { $0.identityKey == key }) else { continue }
            setNestedValue(&request, path: dimension.paramPath ?? "dimensions.\(key)", value: .bool(true))
        }
        for filter in config.staticFilters {
            let key = filter.identityKey
            guard let current = staticFilters[key] else { continue }
            if (filter.type ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "daterange" {
                let start = current.startValue
                let end = current.endValue
                if !start.isEmpty {
                    setNestedValue(&request, path: filter.startParamPath ?? "\(filter.paramPath ?? "filters.\(key)").start", value: .string(start))
                }
                if !end.isEmpty {
                    setNestedValue(&request, path: filter.endParamPath ?? "\(filter.paramPath ?? "filters.\(key)").end", value: .string(end))
                }
            } else {
                let values = current.listValue.map(JSONValue.string)
                if !values.isEmpty {
                    setNestedValue(&request, path: filter.paramPath ?? "filters.\(key)", value: .array(values))
                }
            }
        }
        var dynamicAggregates: [String: [JSONValue]] = [:]
        for group in config.dynamicFilterGroups {
            let rows = dynamicGroups[group.identityKey] ?? []
            for row in rows where row.enabled {
                guard let filter = group.filters.first(where: { $0.identityKey == row.filterId }) else {
                    continue
                }
                let requestMapping = (filter.requestMapping ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                if requestMapping == "hook" {
                    continue
                }
                let paramPath = filter.paramPath ?? "filters.\(filter.identityKey)"
                let values = row.selections.map(\.value)
                if values.isEmpty {
                    continue
                }
                let emitArray = filter.emitArray == true
                if filter.multiple == true || emitArray {
                    dynamicAggregates[paramPath, default: []].append(contentsOf: values)
                } else if let first = values.first {
                    setNestedValue(&request, path: paramPath, value: first)
                }
            }
        }
        for (path, values) in dynamicAggregates {
            setNestedValue(&request, path: path, value: .array(uniqueDynamicValues(values)))
        }
        return request.isEmpty ? [:] : ["input": .object(["query": .object(request)])]
    }

    private static func coerceDynamicFilterValue(
        filter: ReportBuilderDynamicFilterDef,
        rawValue: String
    ) -> JSONValue? {
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let valueType = (filter.manualValueType ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        switch valueType {
        case "int", "integer":
            guard let value = Int(trimmed) else { return nil }
            return .number(Double(value))
        default:
            return .string(trimmed)
        }
    }

    private static func projectManualSelection(
        filter: ReportBuilderDynamicFilterDef,
        rawValue: String
    ) -> ReportBuilderDynamicSelectionState? {
        guard let value = coerceDynamicFilterValue(filter: filter, rawValue: rawValue) else {
            return nil
        }
        let label = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let valueSelector = (filter.valueSelector ?? "value").trimmingCharacters(in: .whitespacesAndNewlines)
        let labelSelector = (filter.labelSelector ?? "label").trimmingCharacters(in: .whitespacesAndNewlines)
        return ReportBuilderDynamicSelectionState(
            value: value,
            label: label,
            group: "",
            record: [
                valueSelector.isEmpty ? "value" : valueSelector: value,
                labelSelector.isEmpty ? "label" : labelSelector: .string(label)
            ]
        )
    }

    private static func projectLookupSelections(
        filter: ReportBuilderDynamicFilterDef,
        payload: [String: JSONValue]
    ) -> [ReportBuilderDynamicSelectionState] {
        let records: [[String: JSONValue]]
        if let array = payload["selection"]?.arrayValue {
            records = array.compactMap(\.objectValue)
        } else if let selected = payload["selected"]?.objectValue {
            records = [selected]
        } else {
            records = [payload]
        }

        return records.compactMap { record in
            let valueSelector = (filter.valueSelector ?? "value").trimmingCharacters(in: .whitespacesAndNewlines)
            let labelSelector = (filter.labelSelector ?? "label").trimmingCharacters(in: .whitespacesAndNewlines)
            let groupSelector = (filter.groupSelector ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

            let rawValue = resolveRecordValue(record, selectors: lookupValueFallbackSelectors(valueSelector))
            guard let value = coerceSelectionValue(filter: filter, rawValue: rawValue) else {
                return nil
            }

            let labelValue = resolveRecordValue(record, selectors: lookupLabelFallbackSelectors(labelSelector, valueSelector))
            let label = labelValue?.stringValue
                ?? labelValue?.intValue.map(String.init)
                ?? value.stringValue
                ?? value.intValue.map(String.init)
                ?? ""
            let group = resolveRecordValue(record, selectors: [groupSelector])?.stringValue ?? ""
            let recordSelectors = filter.recordSelectors ?? []
            let compactRecord = compactLookupRecord(
                filter: filter,
                record: record,
                selectors: [valueSelector, labelSelector, groupSelector] + recordSelectors
            )

            return ReportBuilderDynamicSelectionState(
                value: value,
                label: label,
                group: group,
                record: compactRecord
            )
        }
    }

    private static func upsertDynamicSelections(
        _ current: [ReportBuilderDynamicSelectionState],
        incoming: [ReportBuilderDynamicSelectionState]
    ) -> [ReportBuilderDynamicSelectionState] {
        var result = current
        for selection in incoming {
            result.removeAll { $0.value == selection.value }
            result.append(selection)
        }
        return result
    }

    private static func uniqueDynamicValues(_ values: [JSONValue]) -> [JSONValue] {
        var seen = Set<String>()
        var result: [JSONValue] = []
        for value in values {
            if seen.insert(value.jsonSignature).inserted {
                result.append(value)
            }
        }
        return result
    }

    private static func compactLookupRecord(
        filter: ReportBuilderDynamicFilterDef,
        record: [String: JSONValue],
        selectors: [String]
    ) -> [String: JSONValue]? {
        var compact: [String: JSONValue] = [:]
        for selector in selectors.map({ $0.trimmingCharacters(in: .whitespacesAndNewlines) }).filter({ !$0.isEmpty }) {
            if let value = resolveRecordValue(record, selectors: [selector]) {
                compact[selector] = value
            }
        }
        return compact.isEmpty ? nil : compact
    }

    private static func lookupValueFallbackSelectors(_ selector: String) -> [String] {
        let trimmed = selector.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return ["value", "id"]
        }
        return [trimmed, selectorLeaf(trimmed), "value", "id"]
    }

    private static func lookupLabelFallbackSelectors(_ selector: String, _ valueSelector: String) -> [String] {
        let trimmed = selector.trimmingCharacters(in: .whitespacesAndNewlines)
        let valueLeaf = selectorLeaf(valueSelector)
        var selectors: [String] = []
        if !trimmed.isEmpty {
            selectors.append(trimmed)
            selectors.append(selectorLeaf(trimmed))
        }
        selectors.append("label")
        selectors.append("name")
        if !valueLeaf.isEmpty {
            selectors.append(valueLeaf)
        }
        return selectors
    }

    private static func selectorLeaf(_ selector: String) -> String {
        selector
            .split(separator: ".")
            .last
            .map(String.init)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            ?? ""
    }

    private static func resolveRecordValue(
        _ record: [String: JSONValue],
        selectors: [String]
    ) -> JSONValue? {
        for selector in selectors.map({ $0.trimmingCharacters(in: .whitespacesAndNewlines) }).filter({ !$0.isEmpty }) {
            if let value = resolveJSONSelector(record, selector: selector) {
                return value
            }
        }
        return nil
    }

    private static func resolveJSONSelector(
        _ record: [String: JSONValue],
        selector: String
    ) -> JSONValue? {
        guard let resolved = SelectorUtil.resolve(record.mapValues(jsonAnyValue), selector: selector) else {
            return nil
        }
        return jsonValueFromAny(resolved)
    }

    private static func coerceSelectionValue(
        filter: ReportBuilderDynamicFilterDef,
        rawValue: JSONValue?
    ) -> JSONValue? {
        guard let rawValue else { return nil }
        let valueType = (filter.manualValueType ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        switch valueType {
        case "int", "integer":
            if let intValue = rawValue.intValue {
                return .number(Double(intValue))
            }
            if let stringValue = rawValue.stringValue, let intValue = Int(stringValue.trimmingCharacters(in: .whitespacesAndNewlines)) {
                return .number(Double(intValue))
            }
            return nil
        default:
            if let stringValue = rawValue.stringValue {
                return .string(stringValue)
            }
            if let intValue = rawValue.intValue {
                return .number(Double(intValue))
            }
            return rawValue
        }
    }

    private static func jsonAnyValue(_ value: JSONValue) -> Any? {
        switch value {
        case .string(let string):
            return string
        case .number(let number):
            return number
        case .bool(let bool):
            return bool
        case .array(let values):
            return values.map(jsonAnyValue)
        case .object(let values):
            return values.mapValues(jsonAnyValue)
        case .null:
            return nil
        }
    }

    private static func jsonValueFromAny(_ value: Any?) -> JSONValue? {
        guard let value else {
            return .null
        }
        switch value {
        case let value as JSONValue:
            return value
        case let value as String:
            return .string(value)
        case let value as Bool:
            return .bool(value)
        case let value as Int:
            return .number(Double(value))
        case let value as Int64:
            return .number(Double(value))
        case let value as Double:
            return .number(value)
        case let value as Float:
            return .number(Double(value))
        case let value as NSNumber:
            return .number(value.doubleValue)
        case let value as [String: JSONValue]:
            return .object(value)
        case let value as [String: Any]:
            var object: [String: JSONValue] = [:]
            for (key, child) in value {
                guard let jsonValue = jsonValueFromAny(child) else { return nil }
                object[key] = jsonValue
            }
            return .object(object)
        case let value as [Any]:
            let values = value.compactMap(jsonValueFromAny)
            guard values.count == value.count else { return nil }
            return .array(values)
        default:
            return nil
        }
    }

    private static func setNestedValue(_ target: inout [String: JSONValue], path: String, value: JSONValue) {
        let parts = path
            .split(separator: ".")
            .map(String.init)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard let first = parts.first else { return }
        if parts.count == 1 {
            target[first] = value
            return
        }
        var child = target[first]?.objectValue ?? [:]
        let remaining = parts.dropFirst().joined(separator: ".")
        setNestedValue(&child, path: remaining, value: value)
        target[first] = .object(child)
    }

    private static func resolveNestedValue(_ values: [String: JSONValue], path: String) -> JSONValue? {
        let parts = path
            .split(separator: ".")
            .map(String.init)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard let first = parts.first else { return nil }
        guard let value = values[first] else { return nil }
        if parts.count == 1 {
            return value
        }
        guard let object = value.objectValue else { return nil }
        let remaining = parts.dropFirst().joined(separator: ".")
        return resolveNestedValue(object, path: remaining)
    }

    private static func jsonValue<T: Encodable>(from value: T) -> JSONValue? {
        guard let data = try? JSONEncoder().encode(value) else { return nil }
        return try? JSONDecoder().decode(JSONValue.self, from: data)
    }

    private static func chartPoints(from rows: [[String: JSONValue]], spec: ReportBuilderChartSpecDef) -> [ChartPoint] {
        guard let xField = spec.xField, let yField = spec.yFields.first else { return [] }
        if let seriesField = spec.seriesField, !seriesField.isEmpty {
            return rows.compactMap { row in
                guard let x = row[xField]?.stringLike,
                      let series = row[seriesField]?.stringLike,
                      let value = row[yField]?.doubleLike else { return nil }
                return ChartPoint(x: x, series: series, value: value)
            }
        }
        let seriesName = yField
        return rows.compactMap { row in
            guard let x = row[xField]?.stringLike,
                  let value = row[yField]?.doubleLike else { return nil }
            return ChartPoint(x: x, series: seriesName, value: value)
        }
    }

    private static func applyStaticFilters(
        rows: [[String: JSONValue]],
        filters: [ReportBuilderStaticFilterDef],
        state: [String: ReportBuilderStaticFilterValue]
    ) -> [[String: JSONValue]] {
        rows.filter { row in
            filters.allSatisfy { filter in
                let key = filter.identityKey
                if (filter.type ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "daterange" {
                    guard case .dateRange(let start, let end)? = state[key], !start.isEmpty, !end.isEmpty else {
                        return true
                    }
                    let eventDate = row["eventDate"]?.stringLike ?? ""
                    if eventDate.isEmpty { return true }
                    return eventDate >= start && eventDate <= end
                }
                guard case .list(let selected)? = state[key], !selected.isEmpty else {
                    return true
                }
                let value = row[key]?.stringLike ?? ""
                return selected.contains(value)
            }
        }
    }

    private static func upsert(_ presets: [StoredReportBuilderChartPreset], preset: StoredReportBuilderChartPreset) -> [StoredReportBuilderChartPreset] {
        [preset] + presets.filter { !($0.title == preset.title && $0.settingsHash == preset.settingsHash) }
    }

    private func displayValue(_ value: JSONValue?) -> String {
        if let double = value?.doubleLike {
            return double >= 1000 ? String(format: "%.1fK", double / 1000) : String(format: "%.0f", double)
        }
        return value?.stringLike ?? "-"
    }
}

private enum ReportBuilderStaticFilterValue: Equatable {
    case list([String])
    case dateRange(start: String, end: String)

    var listValue: [String] {
        if case .list(let values) = self { return values }
        return []
    }

    var startValue: String {
        if case .dateRange(let start, _) = self { return start }
        return ""
    }

    var endValue: String {
        if case .dateRange(_, let end) = self { return end }
        return ""
    }
}

private struct ChartPoint: Identifiable {
    let id = UUID()
    let x: String
    let series: String
    let value: Double
}

private struct StoredReportBuilderChartPreset: Codable, Sendable {
    let title: String
    let settingsHash: String
    let chartSpec: ReportBuilderChartSpecDef
    let updatedAt: TimeInterval
}

private struct StoredReportBuilderState: Codable, Sendable {
    let selectedMeasures: [String]
    let selectedDimensions: [String]
    let chartSpec: ReportBuilderChartSpecDef?
    let viewMode: String
    let staticFilters: [String: StoredStaticFilterValue]
    let dynamicGroups: [String: [ReportBuilderDynamicRowState]]
    let dynamicFilterDrafts: [String: String]
}

struct ReportBuilderDynamicRowState: Codable, Sendable, Identifiable, Equatable {
    let id: String
    let filterId: String
    let enabled: Bool
    let selections: [ReportBuilderDynamicSelectionState]

    init(
        id: String = UUID().uuidString,
        filterId: String,
        enabled: Bool = true,
        selections: [ReportBuilderDynamicSelectionState] = []
    ) {
        self.id = id
        self.filterId = filterId
        self.enabled = enabled
        self.selections = selections
    }
}

struct ReportBuilderDynamicSelectionState: Codable, Sendable, Equatable {
    let value: JSONValue
    let label: String
    let group: String
    let record: [String: JSONValue]?
}

private struct ReportBuilderLookupDescriptor {
    var dialogID: String?
    var parameters: [String: JSONValue]
    var selectionMode: String
}

private extension JSONValue {
    var jsonSignature: String {
        switch self {
        case .string(let value):
            return "s:\(value)"
        case .number(let value):
            return "n:\(value)"
        case .bool(let value):
            return "b:\(value)"
        case .null:
            return "null"
        case .array(let values):
            return "a:[\(values.map(\.jsonSignature).joined(separator: ","))]"
        case .object(let values):
            return "o:{\(values.keys.sorted().map { "\($0)=\(values[$0]?.jsonSignature ?? "null")" }.joined(separator: ","))}"
        }
    }
}

private enum StoredStaticFilterValue: Codable, Sendable {
    case list([String])
    case dateRange(start: String, end: String)

    init(runtimeValue: ReportBuilderStaticFilterValue) {
        switch runtimeValue {
        case .list(let values):
            self = .list(values)
        case .dateRange(let start, let end):
            self = .dateRange(start: start, end: end)
        }
    }

    var runtimeValue: ReportBuilderStaticFilterValue {
        switch self {
        case .list(let values):
            return .list(values)
        case .dateRange(let start, let end):
            return .dateRange(start: start, end: end)
        }
    }

    enum CodingKeys: String, CodingKey {
        case kind
        case values
        case start
        case end
    }

    enum Kind: String, Codable {
        case list
        case dateRange
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let kind = try container.decode(Kind.self, forKey: .kind)
        switch kind {
        case .list:
            self = .list(try container.decode([String].self, forKey: .values))
        case .dateRange:
            self = .dateRange(
                start: try container.decode(String.self, forKey: .start),
                end: try container.decode(String.self, forKey: .end)
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .list(let values):
            try container.encode(Kind.list, forKey: .kind)
            try container.encode(values, forKey: .values)
        case .dateRange(let start, let end):
            try container.encode(Kind.dateRange, forKey: .kind)
            try container.encode(start, forKey: .start)
            try container.encode(end, forKey: .end)
        }
    }
}

private extension ReportBuilderMeasureDef {
    var identityKey: String { key ?? id ?? UUID().uuidString }
}

private extension ReportBuilderDimensionDef {
    var identityKey: String { key ?? id ?? UUID().uuidString }
}

private extension ReportBuilderStaticFilterDef {
    var identityKey: String { id ?? label ?? UUID().uuidString }
}

private extension JSONValue {
    var stringLike: String? {
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
        default:
            return nil
        }
    }

    var doubleLike: Double? {
        switch self {
        case .number(let value):
            return value
        case .string(let value):
            return Double(value)
        default:
            return nil
        }
    }

    var signature: String {
        switch self {
        case .string(let value):
            return "s:\(value)"
        case .number(let value):
            return "n:\(value)"
        case .bool(let value):
            return "b:\(value)"
        case .array(let values):
            return "a:[\(values.map(\.signature).joined(separator: ","))]"
        case .object(let values):
            return "o:{\(values.keys.sorted().map { "\($0)=\(values[$0]?.signature ?? "null")" }.joined(separator: ","))}"
        case .null:
            return "null"
        }
    }
}

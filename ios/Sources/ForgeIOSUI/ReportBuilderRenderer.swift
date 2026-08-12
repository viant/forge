import SwiftUI
import Charts
import ForgeIOSRuntime

public struct ReportBuilderRenderer: View {
    @Environment(\.forgePresentationDensity) private var presentationDensity
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    private let baseConfig: DashboardReportBuilderDef?

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
    @State private var restoredStateKey = ""
    @State private var windowFormValues: [String: JSONValue] = [:]
    @State private var appliedPrefillSignature = ""
    @State private var requestBridgeGeneration = 0
    @State private var completedRequestSignature = ""
    @State private var lastAutoAppliedRequestSignature = ""
    @State private var filtersExpanded = true
    @State private var lastAutoCollapsedRequestSignature = ""
    @State private var hasResolvedRows = false
    @State private var dataSourceControlState = ControlState()

    public init(runtime: ForgeRuntime? = nil, window: WindowContext? = nil, container: ContainerDef, config: DashboardReportBuilderDef? = nil) {
        self.runtime = runtime
        self.window = window
        self.container = container
        self.baseConfig = config
    }

    public var body: some View {
        Group {
            if resolvedVariant.missing {
                Text("Report builder variant not found: \(resolvedVariant.builderRef)")
                    .foregroundStyle(.secondary)
            } else if resolvedVariant.config == nil {
                Text("Missing report builder config")
                    .foregroundStyle(.secondary)
            } else {
                layoutView
            }
        }
        .task(id: taskKey) {
            await loadRows()
        }
        .task(id: taskKey) {
            await observeDataSourceRows()
        }
        .task(id: taskKey) {
            await observeDataSourceControl()
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
            guard hydratedForCurrentVariant else { return }
            Task {
                await persistStoredState()
            }
        }
        .onChange(of: requestSignature) {
            guard hydratedForCurrentVariant else { return }
            requestBridgeGeneration += 1
        }
        .onChange(of: settingsHash) {
            refreshStoredPresets()
        }
        .onChange(of: completedRequestSignature) {
            autoCollapseFiltersAfterCompletedResult()
            guard explicitChartMode,
                  config.result?.autoApplyDefaultChartOnResult == true,
                  chartSpec == nil,
                  !aggregatedRows.isEmpty,
                  !completedRequestSignature.isEmpty,
                  completedRequestSignature != lastAutoAppliedRequestSignature,
                  let autoChart = Self.resolveAutoAppliedReportBuilderChartSpec(
                    config: config,
                    selectedMeasures: selectedMeasures,
                    selectedDimensions: selectedDimensions
                  ) else {
                return
            }
            applyChart(autoChart, persist: false)
            lastAutoAppliedRequestSignature = completedRequestSignature
        }
        .task(id: requestBridgeGeneration) {
            guard hydratedForCurrentVariant else { return }
            await bridgeRequestToDataSource()
        }
    }

    private var resolvedVariant: ResolvedReportBuilderVariant {
        Self.resolveReportBuilderVariant(
            container: container,
            windowForm: windowFormValues,
            fallbackConfig: baseConfig
        )
    }

    private var config: DashboardReportBuilderDef {
        lowerReportBuilderPredicates(resolvedVariant.config ?? DashboardReportBuilderDef())
    }

    private var effectiveDataSourceRef: String? {
        resolvedVariant.dataSourceRef ?? container.dataSourceRef
    }

    private var layoutView: ReportBuilderLayoutView {
        ReportBuilderLayoutView(
            // The native client is a report viewer. Measure and breakdown
            // authoring remains available in the web builder; omitting it here
            // preserves the report's full width on both iPhone and iPad.
            measuresSection: AnyView(EmptyView()),
            dimensionsSection: AnyView(EmptyView()),
            filterSummarySection: filterSummarySectionView,
            staticFiltersSection: filtersExpanded ? staticFiltersSectionView : AnyView(EmptyView()),
            dynamicFiltersSection: filtersExpanded ? dynamicFiltersSectionView : AnyView(EmptyView()),
            chartCreationSection: chartCreationSectionView,
            chartModeSection: chartModeSectionView,
            resultSection: resultSectionView
        )
    }

    private var taskKey: String {
        [window?.windowID ?? "", container.id ?? "", effectiveDataSourceRef ?? ""].joined(separator: ":")
    }

    private var hydrationTaskKey: String {
        [window?.windowID ?? "", builderStateKey ?? "", effectiveDataSourceRef ?? ""].joined(separator: ":")
    }

    private var hydratedForCurrentVariant: Bool {
        restoredStoredState && restoredStateKey == hydrationTaskKey
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
        allMeasures.filter { $0.hidden != true }
    }

    private var allMeasures: [ReportBuilderMeasureDef] {
        config.measures + config.computedMeasures
    }

    private var visibleDimensions: [ReportBuilderDimensionDef] {
        config.dimensions.filter { $0.hidden != true }
    }

    private var visibleDynamicFilterGroups: [ReportBuilderDynamicFilterGroupDef] {
        let hidden = Set(config.hiddenDynamicGroupIds.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) })
        guard !hidden.isEmpty else { return config.dynamicFilterGroups }
        return config.dynamicFilterGroups.filter { !hidden.contains($0.identityKey) }
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
        Self.aggregateRows(rows: filteredRows, dimensions: selectedDimensions, measures: selectedMeasures, config: config)
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
        return Self.applyChartDataPolicy(
            config: config,
            request: applyBuildRequestHook(base)
        )
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
                groups: visibleDynamicFilterGroups,
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

    private var filterSummarySectionView: AnyView {
        AnyView(filterSummarySection)
    }

    @ViewBuilder
    private var filterSummarySection: some View {
        if hasFilterControls {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Filters")
                        .font(.subheadline.weight(.semibold))
                        .accessibilityIdentifier("forge-report-builder-filter-summary")
                    Text(filterSummaryText)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button {
                    filtersExpanded.toggle()
                } label: {
                    Label(filtersExpanded ? "Hide Body" : "Show Body", systemImage: filtersExpanded ? "chevron.up" : "slider.horizontal.3")
                }
                .buttonStyle(.bordered)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
        }
    }

    private var hasFilterControls: Bool {
        !config.staticFilters.isEmpty
            || !config.dynamicFilterGroups.isEmpty
            || !config.dynamicFilterFamilies.isEmpty
    }

    private var filterSummaryText: String {
        let count = activeFilterCount
        if count == 0 {
            return filtersExpanded ? "No active filters" : "No active filters hidden"
        }
        return "\(count) active\(filtersExpanded ? "" : " hidden")"
    }

    private var activeFilterCount: Int {
        let staticCount = config.staticFilters.reduce(0) { total, filter in
            total + Self.countConfiguredStaticFilter(filter: filter, value: staticFilters[filter.identityKey])
        }
        let dynamicCount = dynamicGroups.values
            .flatMap { $0 }
            .filter { $0.enabled }
            .reduce(0) { total, row in
                total + max(1, row.selections.count)
            }
        return staticCount + dynamicCount
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
            Picker("Report view", selection: $viewMode) {
                Text("Table").tag("table")
                Text("Chart").tag("chart")
            }
            .pickerStyle(.segmented)
            .accessibilityLabel("Report view")
            .accessibilityIdentifier("forge-report-builder-view-mode")
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
                            .accessibilityIdentifier("forge-report-builder-static-filter-\(key)")
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
            .accessibilityIdentifier("forge-report-builder-table")
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
        if let feedback = reportBuilderChartStateFeedback(
            control: dataSourceControlState,
            hasResolvedRows: hasResolvedRows,
            hasChartValues: !points.isEmpty
        ) {
            VStack(spacing: 8) {
                Image(systemName: "chart.xyaxis.line")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(feedback.isError ? Color.red.opacity(0.75) : Color.secondary.opacity(0.7))
                Text(feedback.message)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(feedback.isError ? .red : .secondary)
                if feedback.isError {
                    Button {
                        requestBridgeGeneration += 1
                    } label: {
                        Label("Retry", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("forge-report-builder-retry")
                }
            }
            .frame(maxWidth: .infinity, minHeight: 220)
            .background(Color.forgeSystemBackground, in: RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.black.opacity(0.06), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
            )
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
                    .interpolationMethod(.monotone)
                    .foregroundStyle(by: .value("Series", point.series))
                default:
                    LineMark(
                        x: .value("X", point.x),
                        y: .value("Value", point.value)
                    )
                    .interpolationMethod(.monotone)
                    .foregroundStyle(by: .value("Series", point.series))
                }
            }
            .chartXAxis {
                AxisMarks(values: sampledChartAxisLabels(
                    points.map(\.x),
                    maximum: isCompactPresentation ? 4 : 6
                )) { value in
                    AxisGridLine()
                    AxisTick()
                    if let raw = value.as(String.self) {
                        AxisValueLabel { Text(compactChartAxisLabel(raw)) }
                    }
                }
            }
            .frame(height: 220)
            .accessibilityIdentifier("forge-report-builder-chart")
        }
    }

    private var isCompactPresentation: Bool {
        presentationDensity == .compact
    }

    private func loadRows() async {
        guard let runtime, let window, let dataSourceRef = effectiveDataSourceRef, !dataSourceRef.isEmpty else {
            rows = []
            hasResolvedRows = true
            dataSourceControlState = ControlState()
            return
        }
        rows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: dataSourceRef)
        dataSourceControlState = await runtime.dataSourceControl(windowID: window.windowID, dataSourceRef: dataSourceRef)
        hasResolvedRows = true
    }

    private func observeDataSourceRows() async {
        guard let runtime, let window, let dataSourceRef = effectiveDataSourceRef, !dataSourceRef.isEmpty else {
            await MainActor.run {
                rows = []
                hasResolvedRows = true
            }
            return
        }
        let stream = await runtime.dataSourceCollectionUpdates(windowID: window.windowID, dataSourceRef: dataSourceRef)
        for await next in stream {
            await MainActor.run {
                rows = next
                hasResolvedRows = true
            }
        }
    }

    private func observeDataSourceControl() async {
        guard let runtime, let window, let dataSourceRef = effectiveDataSourceRef, !dataSourceRef.isEmpty else {
            await MainActor.run {
                dataSourceControlState = ControlState()
            }
            return
        }
        let initialControl = await runtime.dataSourceControl(windowID: window.windowID, dataSourceRef: dataSourceRef)
        await MainActor.run {
            dataSourceControlState = initialControl
        }
        let stream = await runtime.dataSourceControlUpdates(windowID: window.windowID, dataSourceRef: dataSourceRef)
        for await next in stream {
            await MainActor.run {
                dataSourceControlState = next
            }
        }
    }

    @MainActor
    private func hydrateInitialStateIfNeeded() async {
        let stateKey = hydrationTaskKey
        guard restoredStateKey != stateKey else { return }
        resetReportBuilderStateForHydration()
        defer {
            refreshStoredPresets()
            restoredStoredState = true
            restoredStateKey = stateKey
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
        await refreshAvailableDialogs()
        let fallbackState = currentStoredState()
        guard let stateValue = Self.reportBuilderHookStateValue(from: fallbackState) else { return }
        let props = Self.objectValue([
            "state": stateValue,
            "windowForm": .object(formValue),
            "config": Self.jsonValue(from: config)
        ])
        guard let result = invokeHook(functionName: hookName, props: props) else {
            return
        }
        let next = Self.reportBuilderState(fromHookResult: result, fallback: fallbackState)
        apply(restored: next)
    }

    @MainActor
    private func applyWindowFormPrefillIfNeeded() async {
        let signature = currentPrefillSignature
        guard hydratedForCurrentVariant,
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
        let resolvedDataSourceRef = effectiveDataSourceRef ?? ""
        if resolvedDataSourceRef.isEmpty { return }
        let windowID = window.windowID
        let payload = requestPayload
        let signature = requestSignature
        // SwiftUI legitimately restarts the surrounding task while hydration and
        // prefill settle. The datasource request must finish independently of that
        // view-task lifecycle; otherwise URLSession cancels a valid long report.
        let result = await Task.detached(priority: .userInitiated) {
            await runtime.setDataSourceInputParameters(
                windowID: windowID,
                dataSourceRef: resolvedDataSourceRef,
                parameters: payload,
                fetch: true
            )
            let fetchedRows = await runtime.dataSourceCollection(
                windowID: windowID,
                dataSourceRef: resolvedDataSourceRef
            )
            let fetchedControl = await runtime.dataSourceControl(
                windowID: windowID,
                dataSourceRef: resolvedDataSourceRef
            )
            return (fetchedRows, fetchedControl)
        }.value
        guard !Task.isCancelled, signature == requestSignature else { return }
        rows = result.0
        let control = result.1
        dataSourceControlState = control
        hasResolvedRows = true
        if control.error == nil {
            completedRequestSignature = signature
        }
    }

    private func autoCollapseFiltersAfterCompletedResult() {
        guard shouldAutoCollapseReportBuilderFilters(
            hasRows: !rows.isEmpty,
            completedRequestSignature: completedRequestSignature,
            lastCollapsedRequestSignature: lastAutoCollapsedRequestSignature
        ) else {
            return
        }
        lastAutoCollapsedRequestSignature = completedRequestSignature
        filtersExpanded = false
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
        if !explicit.isEmpty { return explicit }
        let primary = (config.primaryMeasure ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !primary.isEmpty, visibleMeasures.contains(where: { $0.identityKey == primary }) {
            return [primary]
        }
        return visibleMeasures.first.map { [$0.identityKey] } ?? []
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
    private func resetReportBuilderStateForHydration() {
        restoredStoredState = false
        rows = []
        selectedMeasures = []
        selectedDimensions = []
        chartSpec = nil
        viewMode = "table"
        selectedPreviousTitle = ""
        storedPresets = []
        staticFilters = [:]
        dynamicGroups = [:]
        dynamicFilterDrafts = [:]
        appliedPrefillSignature = ""
        completedRequestSignature = ""
        lastAutoAppliedRequestSignature = ""
        filtersExpanded = true
        lastAutoCollapsedRequestSignature = ""
        hasResolvedRows = false
        dataSourceControlState = ControlState()
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
        return "reportBuilder.chartPresets.\(Self.reportBuilderVariantStateKey(baseKey: id, builderRef: resolvedVariant.builderRef))"
    }

    private var builderStateKey: String? {
        let key = (container.stateKey ?? container.id ?? "reportBuilder")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return key.isEmpty ? nil : Self.reportBuilderVariantStateKey(baseKey: key, builderRef: resolvedVariant.builderRef)
    }

    internal static func reportBuilderVariantStateKey(baseKey: String, builderRef: String) -> String {
        let base = baseKey.trimmingCharacters(in: .whitespacesAndNewlines)
        let ref = builderRef.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !base.isEmpty, !ref.isEmpty else { return base }
        // Conversation snapshots are authored by the web runtime with this
        // exact colon-delimited key. Native clients must read and write the
        // same key so restored filters, measures, and chart settings survive.
        return "\(base):\(ref)"
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

    static func reportBuilderHookStateValue(from state: StoredReportBuilderState) -> JSONValue? {
        var object: [String: JSONValue] = [
            "selectedMeasures": .array(state.selectedMeasures.map(JSONValue.string)),
            "selectedDimensions": .array(state.selectedDimensions.map(JSONValue.string)),
            "viewMode": .string(state.viewMode),
            "staticFilters": .object(state.staticFilters.mapValues { staticFilterJSONValue($0.runtimeValue) }),
            "dynamicFilterValues": .object(legacyDynamicFilterValues(state.dynamicGroups).mapValues(JSONValue.string)),
            "activeDynamicFilterKeys": .array(legacyActiveDynamicFilterKeys(state.dynamicGroups).map(JSONValue.string)),
            "dynamicGroups": synthesizeDynamicGroups(state.dynamicGroups)
        ]
        if let chartSpec = state.chartSpec, let chartValue = jsonValue(from: chartSpec) {
            object["chartSpec"] = chartValue
        }
        return .object(object)
    }

    static func reportBuilderState(
        fromHookResult result: JSONValue,
        fallback: StoredReportBuilderState
    ) -> StoredReportBuilderState {
        guard let object = result.objectValue else { return fallback }
        return StoredReportBuilderState(
            selectedMeasures: stringArray(object["selectedMeasures"]) ?? fallback.selectedMeasures,
            selectedDimensions: stringArray(object["selectedDimensions"]) ?? fallback.selectedDimensions,
            chartSpec: object.keys.contains("chartSpec")
                ? (decodeJSONValue(object["chartSpec"], as: ReportBuilderChartSpecDef.self) ?? fallback.chartSpec)
                : fallback.chartSpec,
            viewMode: object["viewMode"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
                ? object["viewMode"]?.stringValue ?? fallback.viewMode
                : fallback.viewMode,
            staticFilters: object.keys.contains("staticFilters")
                ? (staticFilters(fromHookValue: object["staticFilters"]) ?? fallback.staticFilters)
                : fallback.staticFilters,
            dynamicGroups: object.keys.contains("dynamicGroups")
                ? (decodeJSONValue(object["dynamicGroups"], as: [String: [ReportBuilderDynamicRowState]].self) ?? fallback.dynamicGroups)
                : fallback.dynamicGroups,
            dynamicFilterDrafts: object.keys.contains("dynamicFilterDrafts")
                ? (stringMap(from: object["dynamicFilterDrafts"]) ?? fallback.dynamicFilterDrafts)
                : fallback.dynamicFilterDrafts
        )
    }

    private static func decodeJSONValue<T: Decodable>(_ value: JSONValue?, as type: T.Type) -> T? {
        guard let value, let data = try? JSONEncoder().encode(value) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    private static func stringArray(_ value: JSONValue?) -> [String]? {
        guard let array = value?.arrayValue else { return nil }
        return array.compactMap { entry in
            entry.stringValue
            ?? entry.intValue.map { String($0) }
            ?? entry.doubleLike.map { String($0) }
        }
    }

    private static func staticFilterJSONValue(_ value: ReportBuilderStaticFilterValue) -> JSONValue {
        switch value {
        case .list(let values):
            return .array(values.map(JSONValue.string))
        case .dateRange(let start, let end):
            return .object([
                "start": .string(start),
                "end": .string(end)
            ])
        }
    }

    private static func staticFilters(fromHookValue value: JSONValue?) -> [String: StoredStaticFilterValue]? {
        guard let object = value?.objectValue else { return nil }
        var result: [String: StoredStaticFilterValue] = [:]
        for (key, rawValue) in object {
            if let stored = decodeJSONValue(rawValue, as: StoredStaticFilterValue.self) {
                result[key] = stored
            } else if let list = stringArray(rawValue) {
                result[key] = .list(list)
            } else if let range = rawValue.objectValue,
                      range.keys.contains("start") || range.keys.contains("end") {
                result[key] = .dateRange(
                    start: range["start"]?.stringValue ?? range["start"]?.intValue.map { String($0) } ?? "",
                    end: range["end"]?.stringValue ?? range["end"]?.intValue.map { String($0) } ?? ""
                )
            } else if let scalar = rawValue.stringValue ?? rawValue.intValue.map({ String($0) }) ?? rawValue.doubleLike.map({ String($0) }) {
                result[key] = .list([scalar])
            }
        }
        return result
    }

    private static func stringMap(from value: JSONValue?) -> [String: String]? {
        guard let object = value?.objectValue else { return nil }
        var result: [String: String] = [:]
        for (key, rawValue) in object {
            if let string = rawValue.stringValue {
                result[key] = string
            } else if let int = rawValue.intValue {
                result[key] = String(int)
            } else if let double = rawValue.doubleLike {
                result[key] = String(double)
            } else if rawValue != .null {
                result[key] = rawValue.signature
            }
        }
        return result
    }

    private static func synthesizeDynamicGroups(
        _ dynamicGroups: [String: [ReportBuilderDynamicRowState]]
    ) -> JSONValue {
        .object(dynamicGroups.mapValues { rows in
            .array(rows.map { row in
                .object([
                    "id": .string(row.id),
                    "filterId": .string(row.filterId),
                    "enabled": .bool(row.enabled),
                    "selections": .array(row.selections.map { selection in
                        var record: [String: JSONValue] = [
                            "value": selection.value,
                            "label": .string(selection.label),
                            "group": .string(selection.group)
                        ]
                        if let compactRecord = selection.record {
                            record["record"] = .object(compactRecord)
                        }
                        return .object(record)
                    })
                ])
            })
        })
    }

    private static func legacyDynamicFilterValues(
        _ dynamicGroups: [String: [ReportBuilderDynamicRowState]]
    ) -> [String: String] {
        var result: [String: String] = [:]
        for row in dynamicGroups.values.flatMap({ $0 }) {
            result[row.filterId] = row.selections
                .map { dynamicSelectionValueText($0.value) }
                .joined(separator: ",")
        }
        return result
    }

    private static func legacyActiveDynamicFilterKeys(
        _ dynamicGroups: [String: [ReportBuilderDynamicRowState]]
    ) -> [String] {
        let keys = dynamicGroups.values.reduce(into: [String]()) { result, rows in
            result.append(contentsOf: rows.map(\.filterId))
        }
        return Array(NSOrderedSet(array: keys)) as? [String] ?? []
    }

    private static func dynamicSelectionValueText(_ value: JSONValue) -> String {
        value.stringValue
        ?? value.intValue.map { String($0) }
        ?? value.doubleLike.map { String($0) }
        ?? value.signature
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

    private static func countConfiguredStaticFilter(filter: ReportBuilderStaticFilterDef, value: ReportBuilderStaticFilterValue?) -> Int {
        guard let value else { return 0 }
        let type = (filter.type ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if type == "daterange" {
            return value.startValue.isEmpty && value.endValue.isEmpty ? 0 : 1
        }
        return value.listValue.count
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

    internal static func resolveAutoAppliedReportBuilderChartSpec(
        config: DashboardReportBuilderDef,
        selectedMeasures: [String],
        selectedDimensions: [String]
    ) -> ReportBuilderChartSpecDef? {
        guard config.result?.autoApplyDefaultChartOnResult == true else {
            return nil
        }
        let supportedTypes: Set<String> = ["line", "bar", "area"]
        let selectedMeasureSet = Set(
            selectedMeasures
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
        )
        let selectedDimensionSet = Set(
            selectedDimensions
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
        )
        for candidate in config.result?.defaultChartSpecs ?? [] {
            let normalized = normalize(candidate)
            let type = (normalized.type ?? "line").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard supportedTypes.contains(type) else { continue }
            guard let xField = normalized.xField?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !xField.isEmpty,
                  selectedDimensionSet.contains(xField) else {
                continue
            }
            let yFields = normalized.yFields
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            guard yFields.count == 1, yFields.allSatisfy(selectedMeasureSet.contains) else {
                continue
            }
            if let seriesField = normalized.seriesField?.trimmingCharacters(in: .whitespacesAndNewlines),
               !seriesField.isEmpty,
               !selectedDimensionSet.contains(seriesField) {
                continue
            }
            return normalized
        }
        return nil
    }

    internal static func applyChartDataPolicy(
        config: DashboardReportBuilderDef,
        request: [String: JSONValue]
    ) -> [String: JSONValue] {
        let mode = (config.result?.chartDataMode ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        guard mode == "fullquery" else {
            return request
        }
        var next = request
        let rawLimit = config.result?.chartRowLimit ?? config.result?.chartDataLimit ?? 1000
        let rowLimit = max(1, rawLimit)
        next["limit"] = .number(Double(rowLimit))
        next["offset"] = .number(0)
        return next
    }

    private static func aggregateRows(
        rows: [[String: JSONValue]],
        dimensions: [String],
        measures: [String],
        config: DashboardReportBuilderDef
    ) -> [[String: JSONValue]] {
        var grouped: [String: [String: JSONValue]] = [:]
        let dimensionByKey = Dictionary(uniqueKeysWithValues: config.dimensions.map { ($0.identityKey, $0) })
        let measureByKey = Dictionary(uniqueKeysWithValues: (config.measures + config.computedMeasures).map { ($0.identityKey, $0) })
        for row in rows {
            let bucket = dimensions.map { key in
                let dimension = dimensionByKey[key]
                return displayValue(row: row, dimension: dimension, key: key)?.stringLike ?? ""
            }.joined(separator: "||")
            var existing = grouped[bucket] ?? [:]
            for key in dimensions {
                let dimension = dimensionByKey[key]
                if let value = displayValue(row: row, dimension: dimension, key: key) {
                    existing[key] = value
                }
            }
            for key in measures {
                if measureByKey[key]?.compute != nil {
                    continue
                }
                let current = existing[key]?.doubleLike ?? 0
                let next = value(at: key, in: row)?.doubleLike ?? 0
                existing[key] = .number(current + next)
            }
            grouped[bucket] = existing
        }
        let withComputed = grouped.values.map { row in
            applyComputedMeasures(row: row, measures: measures, config: config)
        }
        return withComputed.sorted {
            ($0[dimensions.first ?? ""]?.stringLike ?? "") < ($1[dimensions.first ?? ""]?.stringLike ?? "")
        }
    }

    private static func displayValue(row: [String: JSONValue], dimension: ReportBuilderDimensionDef?, key: String) -> JSONValue? {
        if let displayKey = dimension?.displayKey?.trimmingCharacters(in: .whitespacesAndNewlines),
           !displayKey.isEmpty,
           let value = value(at: displayKey, in: row) {
            return value
        }
        return value(at: key, in: row)
    }

    private static func applyComputedMeasures(
        row: [String: JSONValue],
        measures: [String],
        config: DashboardReportBuilderDef
    ) -> [String: JSONValue] {
        var next = row
        for measure in config.computedMeasures where measures.contains(measure.identityKey) {
            guard let compute = measure.compute,
                  (compute.type ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "ratio",
                  let numerator = compute.numerator,
                  let denominator = compute.denominator else {
                continue
            }
            let denom = next[denominator]?.doubleLike ?? 0
            guard denom != 0 else { continue }
            let scale = compute.scale ?? 1
            var value = ((next[numerator]?.doubleLike ?? 0) / denom) * scale
            if let decimals = compute.decimals {
                let factor = pow(10.0, Double(max(0, decimals)))
                value = (value * factor).rounded() / factor
            }
            next[measure.identityKey] = .number(value)
        }
        return next
    }

    private static func value(at path: String, in row: [String: JSONValue]) -> JSONValue? {
        let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if let direct = row[trimmed] {
            return direct
        }
        let parts = trimmed.split(separator: ".").map(String.init)
        guard parts.count > 1 else { return nil }
        var current: JSONValue? = .object(row)
        for part in parts {
            current = current?.objectValue?[part]
            if current == nil { return nil }
        }
        return current
    }

    private static func buildRequestPayload(
        config: DashboardReportBuilderDef,
        selectedMeasures: [String],
        selectedDimensions: [String],
        staticFilters: [String: ReportBuilderStaticFilterValue],
        dynamicGroups: [String: [ReportBuilderDynamicRowState]]
    ) -> [String: JSONValue] {
        var request: [String: JSONValue] = [:]
        let allMeasures = config.measures + config.computedMeasures
        for key in selectedMeasures {
            guard let measure = allMeasures.first(where: { $0.identityKey == key }) else { continue }
            let paramPath = measure.paramPath?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !paramPath.isEmpty {
                setNestedValue(&request, path: paramPath, value: .bool(true))
                continue
            }
            if measure.compute != nil {
                for dependency in measure.dependencies where !dependency.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    if let dep = config.measures.first(where: { $0.identityKey == dependency }),
                       let depPath = dep.paramPath?.trimmingCharacters(in: .whitespacesAndNewlines),
                       !depPath.isEmpty {
                        setNestedValue(&request, path: depPath, value: .bool(true))
                    } else {
                        setNestedValue(&request, path: "measures.\(dependency)", value: .bool(true))
                    }
                }
            } else {
                setNestedValue(&request, path: "measures.\(key)", value: .bool(true))
            }
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
        return request
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

        var selections: [ReportBuilderDynamicSelectionState] = []
        selections.reserveCapacity(records.count)
        for record in records {
            let valueSelector = (filter.valueSelector ?? "value").trimmingCharacters(in: .whitespacesAndNewlines)
            let labelSelector = (filter.labelSelector ?? "label").trimmingCharacters(in: .whitespacesAndNewlines)
            let groupSelector = (filter.groupSelector ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

            let rawValue = resolveRecordValue(record, selectors: lookupValueFallbackSelectors(valueSelector))
            guard let value = coerceSelectionValue(filter: filter, rawValue: rawValue) else {
                continue
            }

            let labelValue = resolveRecordValue(record, selectors: lookupLabelFallbackSelectors(labelSelector, valueSelector))
            let labelString = labelValue?.stringValue
            let labelInteger = labelValue?.intValue.map { String($0) }
            let valueString = value.stringValue
            let valueInteger = value.intValue.map { String($0) }
            let label = labelString ?? labelInteger ?? valueString ?? valueInteger ?? ""
            let group = resolveRecordValue(record, selectors: [groupSelector])?.stringValue ?? ""
            let recordSelectors = filter.recordSelectors ?? []
            let compactRecord = compactLookupRecord(
                filter: filter,
                record: record,
                selectors: [valueSelector, labelSelector, groupSelector] + recordSelectors
            )

            selections.append(ReportBuilderDynamicSelectionState(
                value: value,
                label: label,
                group: group,
                record: compactRecord
            ))
        }
        return selections
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

internal func shouldAutoCollapseReportBuilderFilters(
    hasRows: Bool,
    completedRequestSignature: String,
    lastCollapsedRequestSignature: String
) -> Bool {
    let completed = completedRequestSignature.trimmingCharacters(in: .whitespacesAndNewlines)
    guard hasRows, !completed.isEmpty else {
        return false
    }
    return completed != lastCollapsedRequestSignature.trimmingCharacters(in: .whitespacesAndNewlines)
}

internal func reportBuilderChartStateFeedback(
    control: ControlState,
    hasResolvedRows: Bool,
    hasChartValues: Bool
) -> ChartDataStateFeedback? {
    let feedback = chartDataStateFeedback(
        loading: control.loading,
        error: control.error,
        hasResolvedRows: hasResolvedRows,
        hasChartValues: hasChartValues
    )
    guard feedback?.isError == true else { return feedback }
    return ChartDataStateFeedback(
        message: "Report data is temporarily unavailable",
        isError: true
    )
}

struct StoredReportBuilderState: Codable, Sendable {
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

    private enum CodingKeys: String, CodingKey {
        case id
        case filterId
        case enabled
        case selections
    }

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

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        self.filterId = try container.decode(String.self, forKey: .filterId)
        self.enabled = try container.decodeIfPresent(Bool.self, forKey: .enabled) ?? true
        self.selections = try container.decodeIfPresent([ReportBuilderDynamicSelectionState].self, forKey: .selections) ?? []
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(filterId, forKey: .filterId)
        try container.encode(enabled, forKey: .enabled)
        try container.encode(selections, forKey: .selections)
    }
}

struct ReportBuilderDynamicSelectionState: Codable, Sendable, Equatable {
    let value: JSONValue
    let label: String
    let group: String
    let record: [String: JSONValue]?

    private enum CodingKeys: String, CodingKey {
        case value
        case label
        case group
        case record
    }

    init(
        value: JSONValue,
        label: String,
        group: String = "",
        record: [String: JSONValue]? = nil
    ) {
        self.value = value
        self.label = label
        self.group = group
        self.record = record
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.value = try container.decode(JSONValue.self, forKey: .value)
        self.label = try container.decode(String.self, forKey: .label)
        self.group = try container.decodeIfPresent(String.self, forKey: .group) ?? ""
        self.record = try container.decodeIfPresent([String: JSONValue].self, forKey: .record)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(value, forKey: .value)
        try container.encode(label, forKey: .label)
        try container.encode(group, forKey: .group)
        try container.encodeIfPresent(record, forKey: .record)
    }
}

private struct ReportBuilderLookupDescriptor {
    var dialogID: String?
    var parameters: [String: JSONValue]
    var selectionMode: String
}

struct ResolvedReportBuilderVariant {
    let builderRef: String
    let dataSourceRef: String?
    let config: DashboardReportBuilderDef?
    let missing: Bool
}

extension ReportBuilderRenderer {
    static func resolveReportBuilderVariant(
        container: ContainerDef,
        windowForm: [String: JSONValue],
        fallbackConfig: DashboardReportBuilderDef?
    ) -> ResolvedReportBuilderVariant {
        let requestedRef = windowForm["reportBuilderRef"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let containerDefaultRef = container.reportBuilderRef?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let dashboardDefaultRef = container.dashboard?.reportBuilderRef?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let defaultRef = containerDefaultRef.isEmpty ? dashboardDefaultRef : containerDefaultRef
        let builderRef = requestedRef.isEmpty ? defaultRef : requestedRef
        let variants = container.reportBuilders.isEmpty ? (container.dashboard?.reportBuilders ?? [:]) : container.reportBuilders
        let variant = builderRef.isEmpty ? nil : variants[builderRef]

        if !requestedRef.isEmpty, requestedRef != defaultRef, variant == nil, !variants.isEmpty {
            return ResolvedReportBuilderVariant(
                builderRef: requestedRef,
                dataSourceRef: nil,
                config: nil,
                missing: true
            )
        }

        let variantDataSourceRef = variant?.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines)
        return ResolvedReportBuilderVariant(
            builderRef: builderRef,
            dataSourceRef: variantDataSourceRef?.isEmpty == false ? variantDataSourceRef : container.dataSourceRef,
            config: variant?.reportBuilder ?? fallbackConfig,
            missing: false
        )
    }
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

enum StoredStaticFilterValue: Codable, Sendable {
    case list([String])
    case dateRange(start: String, end: String)

    fileprivate init(runtimeValue: ReportBuilderStaticFilterValue) {
        switch runtimeValue {
        case .list(let values):
            self = .list(values)
        case .dateRange(let start, let end):
            self = .dateRange(start: start, end: end)
        }
    }

    fileprivate var runtimeValue: ReportBuilderStaticFilterValue {
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

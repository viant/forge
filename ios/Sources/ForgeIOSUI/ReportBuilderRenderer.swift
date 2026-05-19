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
    @State private var restoredStoredState = false
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
        .onAppear {
            handleOnAppear()
        }
        .onChange(of: selectedMeasures) { persistStoredState() }
        .onChange(of: selectedDimensions) { persistStoredState() }
        .onChange(of: staticFilters) { persistStoredState() }
        .onChange(of: chartSpec?.id ?? "") { persistStoredState() }
        .onChange(of: viewMode) { persistStoredState() }
        .onChange(of: selectedMeasures) { requestBridgeGeneration += 1 }
        .onChange(of: selectedDimensions) { requestBridgeGeneration += 1 }
        .onChange(of: staticFilters) { requestBridgeGeneration += 1 }
        .onChange(of: settingsHash) {
            refreshStoredPresets()
        }
        .task(id: requestBridgeGeneration) {
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

    private var aggregatedRows: [[String: JSONValue]] {
        Self.aggregateRows(rows: filteredRows, dimensions: selectedDimensions, measures: selectedMeasures)
    }

    private var filteredRows: [[String: JSONValue]] {
        Self.applyStaticFilters(rows: rows, filters: config.staticFilters, state: staticFilters)
    }

    private var requestPayload: [String: JSONValue] {
        Self.buildRequestPayload(
            config: config,
            selectedMeasures: selectedMeasures,
            selectedDimensions: selectedDimensions,
            staticFilters: staticFilters
        )
    }

    private var measuresSection: AnyView {
        AnyView(chipSection(title: "Measures", items: measureItems, selection: $selectedMeasures))
    }

    private var dimensionsSection: AnyView {
        AnyView(chipSection(title: "Breakdowns", items: dimensionItems, selection: $selectedDimensions))
    }

    private var staticFiltersSectionView: AnyView {
        AnyView(staticFilterSection)
    }

    private var dynamicFiltersSectionView: AnyView {
        AnyView(
            ReportBuilderDynamicFiltersView(
                groups: config.dynamicFilterGroups,
                families: config.dynamicFilterFamilies
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
                                TextField("Start", text: Binding(
                                    get: { current.startValue },
                                    set: { next in staticFilters[key] = .dateRange(start: next, end: current.endValue) }
                                ))
                                .textFieldStyle(.roundedBorder)
                                TextField("End", text: Binding(
                                    get: { current.endValue },
                                    set: { next in staticFilters[key] = .dateRange(start: current.startValue, end: next) }
                                ))
                                .textFieldStyle(.roundedBorder)
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

    private func handleOnAppear() {
        if !restoredStoredState {
            restoreStoredState()
            restoredStoredState = true
        }
        if selectedMeasures.isEmpty { selectedMeasures = defaultMeasureKeys() }
        if selectedDimensions.isEmpty { selectedDimensions = defaultDimensionKeys() }
        if staticFilters.isEmpty { staticFilters = defaultStaticFilters() }
        if explicitChartMode {
            viewMode = "table"
        } else {
            viewMode = config.result?.defaultMode ?? "table"
        }
        refreshStoredPresets()
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

    private func restoreStoredState() {
        guard let key = stateStorageKey else { return }
        guard let data = UserDefaults.standard.data(forKey: key),
              let state = try? JSONDecoder().decode(StoredReportBuilderState.self, from: data) else {
            return
        }
        selectedMeasures = state.selectedMeasures
        selectedDimensions = state.selectedDimensions
        chartSpec = state.chartSpec
        viewMode = state.viewMode
        staticFilters = Dictionary(uniqueKeysWithValues: state.staticFilters.map { ($0.key, $0.value.runtimeValue) })
    }

    private func persistStoredState() {
        guard let key = stateStorageKey else { return }
        let state = StoredReportBuilderState(
            selectedMeasures: selectedMeasures,
            selectedDimensions: selectedDimensions,
            chartSpec: chartSpec,
            viewMode: viewMode,
            staticFilters: staticFilters.mapValues { StoredStaticFilterValue(runtimeValue: $0) }
        )
        let data = try? JSONEncoder().encode(state)
        UserDefaults.standard.set(data, forKey: key)
    }

    private var storageKey: String? {
        guard let id = container.id, !id.isEmpty else { return nil }
        return "reportBuilder.chartPresets.\(id)"
    }

    private var stateStorageKey: String? {
        guard let id = container.id, !id.isEmpty else { return nil }
        return "reportBuilder.state.\(id)"
    }

    private static func toggle(_ current: [String], key: String) -> [String] {
        current.contains(key) ? current.filter { $0 != key } : current + [key]
    }

    private static func buildSettingsHash(dimensions: [String], measures: [String]) -> String {
        let signature = dimensions.joined(separator: "|") + "::" + measures.joined(separator: "|")
        let hash = signature.utf8.reduce(5381) { (($0 << 5) &+ $0) &+ Int($1) }
        return "rb_\(String(hash, radix: 16))"
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
        staticFilters: [String: ReportBuilderStaticFilterValue]
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
        return request.isEmpty ? [:] : ["input": .object(["query": .object(request)])]
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
}

import SwiftUI
import Charts
import ForgeIOSRuntime

public struct ChartRenderer: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.forgePresentationDensity) private var presentationDensity

    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    private let chart: ChartDef
    @State private var rows: [[String: JSONValue]] = []
    @State private var hasResolvedRows = false
    @State private var chartWindowForm: [String: JSONValue] = [:]
    @State private var selectedSeriesKeys: Set<String> = []
    @State private var appliedSeriesKeys: [String] = []

    public init(runtime: ForgeRuntime? = nil, window: WindowContext? = nil, container: ContainerDef, chart: ChartDef) {
        self.runtime = runtime
        self.window = window
        self.container = container
        self.chart = chart
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title = resolvedChartTitle {
                Text(title)
                    .font((isCompactPresentation ? Font.footnote : .subheadline).weight(.semibold))
                    .foregroundStyle(.primary.opacity(0.9))
            }
            let showsEmptyChartState = hasResolvedRows && rows.isEmpty
            if supportsSeriesSelection && !showsEmptyChartState {
                chartSeriesSelector
            }
            if supportsSeriesSelection && !showsEmptyChartState && filteredSeriesKeys.isEmpty {
                Text("Select at least one measure")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else if rows.isEmpty {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.forgeSystemBackground)
                    .frame(height: compactChartHeight)
                    .overlay(
                        VStack(spacing: 10) {
                            Image(systemName: "chart.xyaxis.line")
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(.secondary.opacity(0.7))
                            Text(showsEmptyChartState ? "No data for the selected period." : "Loading chart")
                                .font(.footnote.weight(.medium))
                                .foregroundStyle(.secondary)
                        }
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.black.opacity(0.06), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                    )
            } else {
                chartBody
                    .frame(height: compactChartHeight)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 2)
            }
        }
        .padding(isCompactPresentation ? 10 : 12)
        .background(Color.forgeSystemBackground, in: RoundedRectangle(cornerRadius: isCompactPresentation ? 14 : 18))
        .overlay(
            RoundedRectangle(cornerRadius: isCompactPresentation ? 14 : 18)
                .stroke(Color.black.opacity(0.06), lineWidth: 1)
        )
        .onAppear {
            reconcileSeriesSelectionIfNeeded()
        }
        .onChange(of: seriesKeys) {
            reconcileSeriesSelectionIfNeeded(force: true)
        }
        .task(id: chartTaskKey) {
            await loadRows()
        }
        .task(id: rowSubscriptionKey) {
            await observeRows()
        }
        .task(id: window?.windowID ?? "") {
            await observeWindowForm()
        }
    }

    private var resolvedChartTitle: String? {
        let chartTitle = chart.title?.trimmingCharacters(in: .whitespacesAndNewlines)
        let containerTitle = container.title?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let chartTitle, !chartTitle.isEmpty {
            if let containerTitle, !containerTitle.isEmpty,
               chartTitle.compare(containerTitle, options: [.caseInsensitive, .diacriticInsensitive]) == .orderedSame {
                return nil
            }
            return chartTitle
        }
        if let containerTitle, !containerTitle.isEmpty {
            return nil
        }
        return nil
    }

    @ViewBuilder
    private var chartBody: some View {
        let type = normalizedChartType
        let singleCategory = Set(chartSeriesData.map(\.category)).count <= 1
        if type == "pie" || type == "donut" {
            if pieDataUsesSeriesStyle {
                Chart(pieData) { item in
                    SectorMark(
                        angle: .value("Value", item.value),
                        innerRadius: type == "donut" ? .ratio(0.45) : .ratio(0)
                    )
                    .foregroundStyle(by: .value("Series", item.seriesKey))
                }
                .chartForegroundStyleScale(domain: seriesKeys, range: seriesColors)
                .chartLegend(position: .bottom)
            } else {
                Chart(pieData) { item in
                    SectorMark(
                        angle: .value("Value", item.value),
                        innerRadius: type == "donut" ? .ratio(0.45) : .ratio(0)
                    )
                    .foregroundStyle(by: .value("Category", item.label))
                }
                .chartLegend(position: .bottom)
            }
        } else {
            Chart(chartSeriesData) { item in
                switch type {
                case "line", "composed", "area":
                    if singleCategory {
                        BarMark(
                            x: .value("Category", item.category),
                            y: .value("Value", item.value)
                        )
                        .foregroundStyle(by: .value("Series", item.seriesKey))
                        .position(by: .value("Series", item.seriesKey))
                    } else {
                        LineMark(
                            x: .value("Category", item.category),
                            y: .value("Value", item.value),
                            series: .value("Series", item.seriesKey)
                        )
                        .foregroundStyle(by: .value("Series", item.seriesKey))
                    }
                case "bar":
                    BarMark(
                        x: .value("Category", item.category),
                        y: .value("Value", item.value)
                    )
                    .foregroundStyle(by: .value("Series", item.seriesKey))
                    .position(by: .value("Series", item.seriesKey))
                case "stacked_bar":
                    BarMark(
                        x: .value("Category", item.category),
                        y: .value("Value", item.value)
                    )
                    .foregroundStyle(by: .value("Series", item.seriesKey))
                default:
                    LineMark(
                        x: .value("Category", item.category),
                        y: .value("Value", item.value),
                        series: .value("Series", item.seriesKey)
                    )
                    .foregroundStyle(by: .value("Series", item.seriesKey))
                }
            }
            .chartForegroundStyleScale(domain: seriesKeys, range: seriesColors)
            .chartXAxis {
                AxisMarks(values: .automatic) { value in
                    AxisGridLine()
                    AxisTick()
                    AxisValueLabel()
                }
            }
        }
    }

    private var chartTaskKey: String {
        [
            window?.windowID ?? "",
            container.id ?? "",
            resolvedDataSourceRef,
            chart.type ?? chart.kind ?? "",
            chart.xKey ?? "",
            chart.valueKey ?? ""
        ].joined(separator: ":")
    }

    private var rowSubscriptionKey: String {
        [window?.windowID ?? "", resolvedDataSourceRef, "rows"].joined(separator: ":")
    }

    private var compactChartHeight: CGFloat {
        if isCompactPresentation {
            return horizontalSizeClass == .regular ? 156 : 188
        }
        return horizontalSizeClass == .regular ? 176 : 220
    }

    private var normalizedChartType: String {
        (chart.type ?? chart.kind ?? "bar").lowercased()
    }

    private var seriesKeys: [String] {
        seriesDisplays.map(\.key)
    }

    private var supportsSeriesSelection: Bool {
        let type = (chart.type ?? chart.kind ?? "bar").lowercased()
        return seriesKeys.count > 1 && type != "pie" && type != "donut"
    }

    private var filteredSeriesKeys: [String] {
        supportsSeriesSelection ? seriesKeys.filter { selectedSeriesKeys.contains($0) } : seriesKeys
    }

    private var seriesColors: [Color] {
        seriesDisplays.map(\.color)
    }

    private var pieDataUsesSeriesStyle: Bool {
        seriesKeys.count > 1
    }

    private var seriesDisplays: [ChartSeriesDisplay] {
        let options = resolvedChartSeriesOptions
        let palette = chart.seriesDef?.palette.compactMap(chartColor(from:)) ?? []
        let fallbackPalette = [Color.blue, Color.green, Color.orange, Color.purple, Color.pink]
        var seen: Set<String> = []
        return options.enumerated().compactMap { index, option in
            guard let key = nonEmptyChartString(option.value), seen.insert(key).inserted else {
                return nil
            }
            let color = palette[safe: index] ?? fallbackPalette[index % fallbackPalette.count]
            return ChartSeriesDisplay(
                key: key,
                label: nonEmptyChartString(option.name) ?? titleizedSeriesKey(key),
                color: color
            )
        }
    }

    private var resolvedChartSeriesOptions: [ChartValueOption] {
        let structured = chart.seriesDef?.values ?? []
        if !structured.isEmpty {
            return structured
        }
        let keys = chart.series.isEmpty ? [chart.valueKey ?? "value"] : chart.series
        return keys.map { ChartValueOption(value: $0) }
    }

    @ViewBuilder
    private var chartSeriesSelector: some View {
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: isCompactPresentation ? 104 : 120), spacing: 8)],
            alignment: .leading,
            spacing: 8
        ) {
            ForEach(Array(seriesDisplays.enumerated()), id: \.element.key) { _, series in
                let checked = selectedSeriesKeys.contains(series.key)
                Button {
                    selectedSeriesKeys = toggledChartSeriesSelection(current: selectedSeriesKeys, key: series.key)
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: checked ? "checkmark.square.fill" : "square")
                            .foregroundStyle(checked ? Color.accentColor : Color.secondary)
                        Circle()
                            .fill(series.color)
                            .frame(width: 8, height: 8)
                        Text(series.label)
                            .font(isCompactPresentation ? .caption : .footnote)
                            .foregroundStyle(checked ? .primary : .secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var isCompactPresentation: Bool {
        presentationDensity == .compact
    }

    private func loadRows() async {
        guard let runtime, let window else {
            rows = []
            hasResolvedRows = true
            return
        }
        guard !resolvedDataSourceRef.isEmpty else {
            rows = []
            hasResolvedRows = true
            return
        }
        rows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
        hasResolvedRows = true
        guard rows.isEmpty else {
            return
        }
        let shouldFetch = container.fetchData != false
        guard shouldFetch else {
            return
        }
        Task {
            await runtime.refreshDataSourceCollection(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
        }
    }

    private func observeRows() async {
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else {
            return
        }
        let stream = await runtime.dataSourceCollectionUpdates(
            windowID: window.windowID,
            dataSourceRef: resolvedDataSourceRef
        )
        for await next in stream {
            await MainActor.run {
                rows = next
                hasResolvedRows = true
            }
        }
    }

    private func observeWindowForm() async {
        guard let runtime, let window else {
            return
        }
        chartWindowForm = await runtime.windowFormJSONValue(windowID: window.windowID)
        let stream = await runtime.windowFormUpdates(windowID: window.windowID)
        for await next in stream {
            await MainActor.run {
                chartWindowForm = next
            }
            Task(priority: .userInitiated) {
                await refreshWindowFormDrivenDataSource(windowFormValues: next)
            }
        }
    }

    private func refreshWindowFormDrivenDataSource(windowFormValues: [String: JSONValue]) async {
        guard let runtime, let window else {
            return
        }
        guard container.fetchData != false else {
            return
        }
        let resolvedDataSourceRef = resolvedDataSourceRef(for: windowFormValues)
        guard !resolvedDataSourceRef.isEmpty else {
            return
        }
        guard let metadata = await runtime.windowMetadata(id: window.windowID) else {
            return
        }
        guard chartDataSourceDependsOnWindowForm(metadata.dataSources[resolvedDataSourceRef]) else {
            return
        }
        Task(priority: .userInitiated) {
            await runtime.refreshDataSourceCollection(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
        }
    }

    private var resolvedDataSourceRef: String {
        resolvedDataSourceRef(for: chartWindowForm)
    }

    private func resolvedDataSourceRef(for windowFormValues: [String: JSONValue]) -> String {
        if let direct = container.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines), !direct.isEmpty {
            return direct
        }
        let selector = chart.dataSourceRefSelector?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let source = chart.dataSourceRefSource?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? "windowform"
        guard !selector.isEmpty, !chart.dataSourceRefs.isEmpty else {
            return chart.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        }
        let key: String?
        switch source {
        case "windowform":
            key = chartSelectorStringValue(from: SelectorUtil.resolve(windowFormValues, selector: selector))
        default:
            key = nil
        }
        if let key, let mapped = chart.dataSourceRefs[key] {
            return mapped
        }
        return chart.dataSourceRefs.values.first ?? ""
    }

    private var pieData: [PieDatum] {
        let nameKey = chart.nameKey ?? chart.xKey ?? seriesKeys.first ?? "label"
        let valueKeys = filteredSeriesKeys
        let displayByKey = Dictionary(uniqueKeysWithValues: seriesDisplays.map { ($0.key, $0) })
        return rows.enumerated().flatMap { rowIndex, row in
            let rowLabel = row[nameKey]?.displayStringValue
            return valueKeys.compactMap { key -> PieDatum? in
                guard let value = row[key]?.doubleValueValue else { return nil }
                let display = displayByKey[key]
                let seriesLabel = display?.label ?? titleizedSeriesKey(key)
                let label = rowLabel ?? seriesLabel
                return PieDatum(
                    id: "\(rowIndex)|\(key)|\(label)",
                    label: label,
                    seriesKey: key,
                    seriesLabel: seriesLabel,
                    value: value
                )
            }
        }
    }

    private var chartSeriesData: [SeriesDatum] {
        let categoryKey = chart.xKey ?? chart.nameKey ?? seriesKeys.first ?? "label"
        let valueKeys = filteredSeriesKeys
        let displayByKey = Dictionary(uniqueKeysWithValues: seriesDisplays.map { ($0.key, $0) })
        return rows.flatMap { row in
            let category = row[categoryKey]?.displayStringValue ?? "—"
            return valueKeys.compactMap { key -> SeriesDatum? in
                guard let value = row[key]?.doubleValueValue else { return nil }
                let display = displayByKey[key]
                return SeriesDatum(
                    category: category,
                    seriesKey: key,
                    seriesLabel: display?.label ?? titleizedSeriesKey(key),
                    value: value
                )
            }
        }
    }

    private func reconcileSeriesSelectionIfNeeded(force: Bool = false) {
        guard force || appliedSeriesKeys != seriesKeys else {
            return
        }
        selectedSeriesKeys = reconciledChartSeriesSelection(current: selectedSeriesKeys, available: seriesKeys)
        appliedSeriesKeys = seriesKeys
    }
}

internal func reconciledChartSeriesSelection(current: Set<String>, available: [String]) -> Set<String> {
    let availableSet = Set(available)
    guard !availableSet.isEmpty else {
        return []
    }
    let retained = current.intersection(availableSet)
    return retained.isEmpty ? availableSet : retained
}

internal func toggledChartSeriesSelection(current: Set<String>, key: String) -> Set<String> {
    var next = current
    if !next.insert(key).inserted {
        next.remove(key)
    }
    return next
}

private func chartDataSourceDependsOnWindowForm(_ dataSource: DataSourceDef?) -> Bool {
    guard let dataSource else {
        return false
    }
    return dataSource.parameters.contains { parameter in
        let source = (parameter.input ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        return source == "windowform"
    }
}

private func chartSelectorStringValue(from value: Any?) -> String? {
    switch value {
    case let string as String:
        return string
    case let json as JSONValue:
        return json.displayStringValue
    default:
        return nil
    }
}

private struct PieDatum: Identifiable {
    let id: String
    let label: String
    let seriesKey: String
    let seriesLabel: String
    let value: Double
}

private struct SeriesDatum: Identifiable {
    let id = UUID()
    let category: String
    let seriesKey: String
    let seriesLabel: String
    let value: Double
}

private struct ChartSeriesDisplay: Identifiable {
    var id: String { key }
    let key: String
    let label: String
    let color: Color
}

private func nonEmptyChartString(_ value: String?) -> String? {
    let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return trimmed.isEmpty ? nil : trimmed
}

private func chartColor(from raw: String) -> Color? {
    var hex = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    if hex.hasPrefix("#") {
        hex.removeFirst()
    }
    guard hex.count == 6 || hex.count == 8,
          let value = UInt64(hex, radix: 16) else {
        return nil
    }
    let red: Double
    let green: Double
    let blue: Double
    let alpha: Double
    if hex.count == 8 {
        red = Double((value >> 24) & 0xFF) / 255
        green = Double((value >> 16) & 0xFF) / 255
        blue = Double((value >> 8) & 0xFF) / 255
        alpha = Double(value & 0xFF) / 255
    } else {
        red = Double((value >> 16) & 0xFF) / 255
        green = Double((value >> 8) & 0xFF) / 255
        blue = Double(value & 0xFF) / 255
        alpha = 1
    }
    return Color(red: red, green: green, blue: blue, opacity: alpha)
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

private func titleizedSeriesKey(_ key: String) -> String {
    let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
        return key
    }
    let spaced = trimmed
        .replacingOccurrences(of: "_", with: " ")
        .replacingOccurrences(of: "-", with: " ")
    return spaced.prefix(1).uppercased() + spaced.dropFirst()
}

private extension JSONValue {
    var displayStringValue: String? {
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

    var doubleValueValue: Double? {
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

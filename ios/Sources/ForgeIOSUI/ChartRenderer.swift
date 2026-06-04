import SwiftUI
import Charts
import ForgeIOSRuntime

public struct ChartRenderer: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    private let chart: ChartDef
    @State private var rows: [[String: JSONValue]] = []
    @State private var chartWindowForm: [String: JSONValue] = [:]
    @State private var selectedSeriesKeys: Set<String> = []

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
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary.opacity(0.9))
            }
            if supportsSeriesSelection {
                chartSeriesSelector
            }
            if supportsSeriesSelection && filteredSeriesKeys.isEmpty {
                Text("Select at least one measure")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else if rows.isEmpty {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(.systemBackground))
                    .frame(height: compactChartHeight)
                    .overlay(
                        VStack(spacing: 10) {
                            Image(systemName: "chart.xyaxis.line")
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(.secondary.opacity(0.7))
                            Text("Loading chart")
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
        .padding(12)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 18))
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(Color.black.opacity(0.06), lineWidth: 1)
        )
        .onAppear {
            if selectedSeriesKeys.isEmpty {
                selectedSeriesKeys = Set(seriesKeys)
            }
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
        .task(id: windowFormRefreshKey) {
            await refreshWindowFormDrivenDataSource()
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
        if type == "pie" {
            Chart(pieData) { item in
                SectorMark(
                    angle: .value("Value", item.value),
                    innerRadius: .ratio(0.45)
                )
                .foregroundStyle(by: .value("Category", item.label))
            }
            .chartLegend(position: .bottom)
        } else {
            Chart(chartSeriesData) { item in
                switch type {
                case "line", "composed", "area":
                    if singleCategory {
                        BarMark(
                            x: .value("Category", item.category),
                            y: .value("Value", item.value)
                        )
                        .foregroundStyle(by: .value("Series", item.series))
                        .position(by: .value("Series", item.series))
                    } else {
                        LineMark(
                            x: .value("Category", item.category),
                            y: .value("Value", item.value),
                            series: .value("Series", item.series)
                        )
                        .foregroundStyle(by: .value("Series", item.series))
                    }
                case "bar", "stacked_bar":
                    BarMark(
                        x: .value("Category", item.category),
                        y: .value("Value", item.value)
                    )
                    .foregroundStyle(by: .value("Series", item.series))
                    .position(by: .value("Series", item.series))
                default:
                    LineMark(
                        x: .value("Category", item.category),
                        y: .value("Value", item.value),
                        series: .value("Series", item.series)
                    )
                    .foregroundStyle(by: .value("Series", item.series))
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
        horizontalSizeClass == .regular ? 176 : 220
    }

    private var windowFormSignature: String {
        chartWindowForm.signature
    }

    private var windowFormRefreshKey: String {
        [
            window?.windowID ?? "",
            resolvedDataSourceRef,
            windowFormSignature,
            "windowFormRefresh"
        ].joined(separator: ":")
    }

    private var normalizedChartType: String {
        (chart.type ?? chart.kind ?? "bar").lowercased()
    }

    private var seriesKeys: [String] {
        chart.series.isEmpty ? [chart.valueKey ?? "value"] : chart.series
    }

    private var supportsSeriesSelection: Bool {
        let type = (chart.type ?? chart.kind ?? "bar").lowercased()
        return seriesKeys.count > 1 && type != "pie" && type != "donut"
    }

    private var filteredSeriesKeys: [String] {
        supportsSeriesSelection ? seriesKeys.filter { selectedSeriesKeys.contains($0) } : seriesKeys
    }

    private var seriesColors: [Color] {
        let palette = [Color.blue, Color.green, Color.orange, Color.purple, Color.pink]
        return seriesKeys.enumerated().map { index, _ in palette[index % palette.count] }
    }

    @ViewBuilder
    private var chartSeriesSelector: some View {
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 120), spacing: 8)],
            alignment: .leading,
            spacing: 8
        ) {
            ForEach(Array(seriesKeys.enumerated()), id: \.element) { index, key in
                let checked = selectedSeriesKeys.contains(key)
                Button {
                    if checked {
                        selectedSeriesKeys.remove(key)
                    } else {
                        selectedSeriesKeys.insert(key)
                    }
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: checked ? "checkmark.square.fill" : "square")
                            .foregroundStyle(checked ? Color.accentColor : Color.secondary)
                        Circle()
                            .fill(seriesColors[index])
                            .frame(width: 8, height: 8)
                        Text(titleizedSeriesKey(key))
                            .font(.footnote)
                            .foregroundStyle(checked ? .primary : .secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func loadRows() async {
        guard let runtime, let window else {
            rows = []
            return
        }
        guard !resolvedDataSourceRef.isEmpty else {
            rows = []
            return
        }
        rows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
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
        }
    }

    private func refreshWindowFormDrivenDataSource() async {
        guard let runtime, let window else {
            return
        }
        guard container.fetchData != false else {
            return
        }
        guard !resolvedDataSourceRef.isEmpty else {
            return
        }
        guard let metadata = await runtime.windowMetadata(id: window.windowID) else {
            return
        }
        guard chartDataSourceDependsOnWindowForm(metadata.dataSources[resolvedDataSourceRef]) else {
            return
        }
        await runtime.refreshDataSourceCollection(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
    }

    private var resolvedDataSourceRef: String {
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
            key = SelectorUtil.resolve(chartWindowForm, selector: selector) as? String
        default:
            key = nil
        }
        if let key, let mapped = chart.dataSourceRefs[key] {
            return mapped
        }
        return chart.dataSourceRefs.values.first ?? ""
    }

    private var pieData: [PieDatum] {
        let nameKey = chart.nameKey ?? chart.xKey ?? chart.series.first ?? "label"
        let valueKey = filteredSeriesKeys.first ?? chart.valueKey ?? chart.series.first ?? "value"
        return rows.compactMap { row in
            guard let label = row[nameKey]?.displayStringValue,
                  let value = row[valueKey]?.doubleValueValue else {
                return nil
            }
            return PieDatum(label: label, value: value)
        }
    }

    private var chartSeriesData: [SeriesDatum] {
        let categoryKey = chart.xKey ?? chart.nameKey ?? chart.series.first ?? "label"
        let valueKeys = filteredSeriesKeys
        return rows.flatMap { row in
            let category = row[categoryKey]?.displayStringValue ?? "—"
            return valueKeys.compactMap { key -> SeriesDatum? in
                guard let value = row[key]?.doubleValueValue else { return nil }
                return SeriesDatum(category: category, series: key, value: value)
            }
        }
    }
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

private struct PieDatum: Identifiable {
    let id = UUID()
    let label: String
    let value: Double
}

private struct SeriesDatum: Identifiable {
    let id = UUID()
    let category: String
    let series: String
    let value: Double
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

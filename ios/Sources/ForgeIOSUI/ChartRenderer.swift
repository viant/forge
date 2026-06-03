import SwiftUI
import Charts
import ForgeIOSRuntime

public struct ChartRenderer: View {
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    private let chart: ChartDef
    @State private var rows: [[String: JSONValue]] = []
    @State private var chartWindowForm: [String: JSONValue] = [:]

    public init(runtime: ForgeRuntime? = nil, window: WindowContext? = nil, container: ContainerDef, chart: ChartDef) {
        self.runtime = runtime
        self.window = window
        self.container = container
        self.chart = chart
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title = resolvedChartTitle {
                Text(title).font(.headline)
            }
            if rows.isEmpty {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.secondary.opacity(0.08))
                    .frame(height: 160)
                    .overlay(
                        Text(chart.type ?? chart.kind ?? "chart")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    )
            } else {
                chartBody
                    .frame(height: 180)
            }
        }
        .padding()
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
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
        let type = (chart.type ?? chart.kind ?? "bar").lowercased()
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
            Chart(barData) { item in
                if type == "line" {
                    LineMark(
                        x: .value("Category", item.category),
                        y: .value("Value", item.value)
                    )
                } else {
                    BarMark(
                        x: .value("Category", item.category),
                        y: .value("Value", item.value)
                    )
                }
            }
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
        await runtime.refreshDataSourceCollection(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
        rows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
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

    private var resolvedDataSourceRef: String {
        if let direct = container.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines), !direct.isEmpty {
            return direct
        }
        let selector = chart.dataSourceRefSelector?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let source = chart.dataSourceRefSource?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? "windowform"
        guard !selector.isEmpty, !chart.dataSourceRefs.isEmpty else {
            return chart.dataSourceRef?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        }
        let key: String? = switch source {
        case "windowform":
            SelectorUtil.resolve(chartWindowForm, selector: selector) as? String
        default:
            nil
        }
        if let key, let mapped = chart.dataSourceRefs[key] {
            return mapped
        }
        return chart.dataSourceRefs.values.first ?? ""
    }

    private var pieData: [PieDatum] {
        let nameKey = chart.nameKey ?? chart.xKey ?? chart.series.first ?? "label"
        let valueKey = chart.valueKey ?? chart.series.first ?? "value"
        return rows.compactMap { row in
            guard let label = row[nameKey]?.displayStringValue,
                  let value = row[valueKey]?.doubleValueValue else {
                return nil
            }
            return PieDatum(label: label, value: value)
        }
    }

    private var barData: [SeriesDatum] {
        let categoryKey = chart.xKey ?? chart.nameKey ?? chart.series.first ?? "label"
        let valueKeys = chart.series.isEmpty ? [chart.valueKey ?? "value"] : chart.series
        return rows.flatMap { row in
            let category = row[categoryKey]?.displayStringValue ?? "—"
            return valueKeys.compactMap { key -> SeriesDatum? in
                guard let value = row[key]?.doubleValueValue else { return nil }
                return SeriesDatum(category: category, series: key, value: value)
            }
        }
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

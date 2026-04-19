import SwiftUI
import Charts
import ForgeIOSRuntime

public struct ChartRenderer: View {
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    private let chart: ChartDef
    @State private var rows: [[String: JSONValue]] = []

    public init(runtime: ForgeRuntime? = nil, window: WindowContext? = nil, container: ContainerDef, chart: ChartDef) {
        self.runtime = runtime
        self.window = window
        self.container = container
        self.chart = chart
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title = chart.title ?? container.title {
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
            container.dataSourceRef ?? "",
            chart.type ?? chart.kind ?? "",
            chart.xKey ?? "",
            chart.valueKey ?? ""
        ].joined(separator: ":")
    }

    private func loadRows() async {
        guard let runtime, let window, let dataSourceRef = container.dataSourceRef, !dataSourceRef.isEmpty else {
            rows = []
            return
        }
        rows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: dataSourceRef)
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

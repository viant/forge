import SwiftUI
import ForgeIOSRuntime

struct ChartTableModeRenderer: View {
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    private let chart: ChartDef
    private let rows: [[String: JSONValue]]?
    @State private var selectedMode: String?

    init(
        runtime: ForgeRuntime? = nil,
        window: WindowContext? = nil,
        container: ContainerDef,
        chart: ChartDef,
        rows: [[String: JSONValue]]? = nil
    ) {
        self.runtime = runtime
        self.window = window
        self.container = container
        self.chart = chart
        self.rows = rows
    }

    var body: some View {
        let table = chartTableModeTable(for: container)
        let modes = normalizedChartTableViewModes(container.viewModes, hasChart: true, hasTable: table != nil)
        let mode = resolvedChartTableViewMode(selectedMode, modes: modes)

        VStack(alignment: .leading, spacing: 10) {
            if modes.count > 1 {
                Picker("", selection: Binding(
                    get: { mode },
                    set: { selectedMode = $0 }
                )) {
                    ForEach(modes, id: \.self) { mode in
                        Text(chartTableModeLabel(mode)).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
            }

            if mode == "table", let table {
                TableRenderer(runtime: runtime, window: window, container: container, table: table, rows: rows)
            } else {
                ChartRenderer(runtime: runtime, window: window, container: container, chart: chart, rows: rows)
            }
        }
        .onChange(of: modes) {
            selectedMode = resolvedChartTableViewMode(selectedMode, modes: modes)
        }
    }
}

internal func chartTableModeTable(for container: ContainerDef) -> TableDef? {
    if let table = container.table {
        return table
    }
    guard !container.columns.isEmpty else {
        return nil
    }
    return TableDef(title: container.title, columns: container.columns)
}

internal func normalizedChartTableViewModes(_ rawModes: [String], hasChart: Bool, hasTable: Bool) -> [String] {
    let available: Set<String> = Set([
        hasChart ? "chart" : nil,
        hasTable ? "table" : nil
    ].compactMap { $0 })
    var seen: Set<String> = []
    let requested = rawModes.compactMap { raw -> String? in
        let mode = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard available.contains(mode), seen.insert(mode).inserted else {
            return nil
        }
        return mode
    }
    if !requested.isEmpty {
        return requested
    }
    if hasChart {
        return ["chart"]
    }
    if hasTable {
        return ["table"]
    }
    return []
}

internal func dashboardDimensionsViewModes(for container: ContainerDef) -> [String] {
    let dimensionsModes = container.dashboard?.dimensions?.viewModes ?? []
    let rawModes = dimensionsModes.isEmpty ? container.viewModes : dimensionsModes
    return normalizedChartTableViewModes(rawModes, hasChart: true, hasTable: true)
}

internal func resolvedChartTableViewMode(_ selectedMode: String?, modes: [String]) -> String {
    let selected = selectedMode?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
    if modes.contains(selected) {
        return selected
    }
    return modes.first ?? "chart"
}

internal func chartTableModeLabel(_ mode: String) -> String {
    switch mode {
    case "chart":
        return "Chart"
    case "table":
        return "Table"
    default:
        let trimmed = mode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return mode
        }
        return trimmed.prefix(1).uppercased() + trimmed.dropFirst()
    }
}

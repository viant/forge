import Foundation
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
    private let providedRows: [[String: JSONValue]]?
    private let showDataFallback: Bool
    private let reportRuntimeBlockID: String?
    private let reportRuntimeActionFields: [DashboardReportRuntimeActionField]
    private let reportRuntimeActionDescriptors: [DashboardReportRuntimeActionDescriptor]
    private let onReportRuntimeAction: ((DashboardReportRuntimeActionExecution) -> Void)?
    @State private var rows: [[String: JSONValue]] = []
    @State private var hasResolvedRows = false
    @State private var chartWindowForm: [String: JSONValue] = [:]
    @State private var controlState = ControlState()
    @State private var selectedSeriesKeys: Set<String> = []
    @State private var appliedSeriesKeys: [String] = []
    @State private var selectedCategory: String?
    @State private var selectedPieID: String?
    @State private var showsChartDataTable = false

    public init(
        runtime: ForgeRuntime? = nil,
        window: WindowContext? = nil,
        container: ContainerDef,
        chart: ChartDef,
        rows: [[String: JSONValue]]? = nil,
        showDataFallback: Bool = true,
        reportRuntimeBlockID: String? = nil,
        reportRuntimeActionFields: [DashboardReportRuntimeActionField] = [],
        reportRuntimeActionDescriptors: [DashboardReportRuntimeActionDescriptor] = [],
        onReportRuntimeAction: ((DashboardReportRuntimeActionExecution) -> Void)? = nil
    ) {
        self.runtime = runtime
        self.window = window
        self.container = container
        self.chart = chart
        self.providedRows = rows
        self.showDataFallback = showDataFallback
        self.reportRuntimeBlockID = reportRuntimeBlockID
        self.reportRuntimeActionFields = reportRuntimeActionFields
        self.reportRuntimeActionDescriptors = reportRuntimeActionDescriptors
        self.onReportRuntimeAction = onReportRuntimeAction
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title = resolvedChartTitle {
                Text(title)
                    .font((isCompactPresentation ? Font.footnote : .subheadline).weight(.semibold))
                    .foregroundStyle(.primary.opacity(0.9))
            }
            if let axisLabel = nonEmptyChartString(chart.yAxis?.label) {
                Text(axisLabel)
                    .font((isCompactPresentation ? Font.caption : .footnote).weight(.medium))
                    .foregroundStyle(.secondary)
            }
            let chartStateFeedback = chartDataStateFeedback(
                loading: controlState.loading,
                error: controlState.error,
                hasResolvedRows: hasResolvedRows,
                hasChartValues: chartHasValues
            )
            if supportsSeriesSelection && chartStateFeedback == nil {
                chartSeriesSelector
            }
            if supportsSeriesSelection && chartStateFeedback == nil && filteredSeriesKeys.isEmpty {
                Text("Select at least one measure")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else if let chartStateFeedback {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.forgeSystemBackground)
                    .frame(height: compactChartHeight)
                    .overlay(
                        VStack(spacing: 10) {
                            Image(systemName: "chart.xyaxis.line")
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(chartStateFeedback.isError ? Color.red.opacity(0.75) : Color.secondary.opacity(0.7))
                            Text(chartStateFeedback.message)
                                .font(.footnote.weight(.medium))
                                .foregroundStyle(chartStateFeedback.isError ? .red : .secondary)
                        }
                        .padding(.horizontal, 12)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.black.opacity(0.06), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                    )
            } else {
                if let selectedChartSummary {
                    chartSelectionSummaryCard(selectedChartSummary)
                }
                reportRuntimeSelectedChartActions
                chartBody
                    .frame(height: compactChartHeight)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 2)
                if showDataFallback {
                    chartDataFallback
                }
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
        .task(id: controlSubscriptionKey) {
            await observeControl()
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
            VStack(alignment: .leading, spacing: 10) {
                if pieDataUsesSeriesStyle {
                    Chart(pieData) { item in
                        SectorMark(
                            angle: .value("Value", item.value),
                            innerRadius: type == "donut" ? .ratio(0.45) : .ratio(0),
                            angularInset: selectedPieID == item.id ? 2 : 0
                        )
                        .foregroundStyle(by: .value("Series", item.seriesKey))
                        .opacity(selectedPieID == nil || selectedPieID == item.id ? 1 : 0.42)
                    }
                    .chartForegroundStyleScale(domain: seriesKeys, range: seriesColors)
                    .chartLegend(position: .bottom)
                } else {
                    Chart(pieData) { item in
                        SectorMark(
                            angle: .value("Value", item.value),
                            innerRadius: type == "donut" ? .ratio(0.45) : .ratio(0),
                            angularInset: selectedPieID == item.id ? 2 : 0
                        )
                        .foregroundStyle(by: .value("Category", item.label))
                        .opacity(selectedPieID == nil || selectedPieID == item.id ? 1 : 0.42)
                    }
                    .chartLegend(position: .bottom)
                }
                if let selectedPieSummary {
                    pieSelectionSummaryCard(selectedPieSummary)
                }
                pieSliceSelector
            }
        } else {
            let displayByKey = Dictionary(uniqueKeysWithValues: seriesDisplays.map { ($0.key, $0) })
            Chart(displayChartSeriesData) { item in
                let series = displayByKey[item.seriesKey]
                let seriesType = series?.type ?? type
                if singleCategory && seriesType != "bar" && seriesType != "stacked_bar" {
                    BarMark(
                        x: .value("Category", item.category),
                        y: .value("Value", item.chartValue)
                    )
                    .foregroundStyle(by: .value("Series", item.seriesKey))
                    .position(by: .value("Series", item.seriesKey))
                } else {
                    switch seriesType {
                    case "area":
                        AreaMark(
                            x: .value("Category", item.category),
                            y: .value("Value", item.chartValue),
                            series: .value("Series", item.seriesKey)
                        )
                        .interpolationMethod(.monotone)
                        .foregroundStyle((series?.color ?? Color.accentColor).opacity(0.14))
                        LineMark(
                            x: .value("Category", item.category),
                            y: .value("Value", item.chartValue),
                            series: .value("Series", item.seriesKey)
                        )
                        .interpolationMethod(.monotone)
                        .foregroundStyle(by: .value("Series", item.seriesKey))
                    case "line", "composed":
                        LineMark(
                            x: .value("Category", item.category),
                            y: .value("Value", item.chartValue),
                            series: .value("Series", item.seriesKey)
                        )
                        .interpolationMethod(.monotone)
                        .foregroundStyle(by: .value("Series", item.seriesKey))
                    case "bar":
                        BarMark(
                            x: .value("Category", item.category),
                            y: .value("Value", item.chartValue)
                        )
                        .foregroundStyle(by: .value("Series", item.seriesKey))
                        .position(by: .value("Series", item.seriesKey))
                    case "stacked_bar":
                        BarMark(
                            x: .value("Category", item.category),
                            y: .value("Value", item.chartValue)
                        )
                        .foregroundStyle(by: .value("Series", item.seriesKey))
                    default:
                        LineMark(
                            x: .value("Category", item.category),
                            y: .value("Value", item.chartValue),
                            series: .value("Series", item.seriesKey)
                        )
                        .interpolationMethod(.monotone)
                        .foregroundStyle(by: .value("Series", item.seriesKey))
                    }
                }
                if item.category == selectedCategory, type != "bar", type != "stacked_bar" {
                    PointMark(
                        x: .value("Category", item.category),
                        y: .value("Value", item.chartValue)
                    )
                    .foregroundStyle(by: .value("Series", item.seriesKey))
                    .symbolSize(72)
                }
            }
            .chartForegroundStyleScale(domain: seriesKeys, range: seriesColors)
            .chartXAxis {
                AxisMarks(values: sampledChartAxisLabels(
                    displayChartSeriesData.map(\.category),
                    maximum: isCompactPresentation ? 4 : 6
                )) { value in
                    AxisGridLine()
                    AxisTick()
                    if let raw = value.as(String.self) {
                        AxisValueLabel { Text(formatChartAxisLabel(raw, tickFormat: resolvedXTickFormat)) }
                    }
                }
            }
            .chartYAxis {
                if chartAxisOrder.count > 1 {
                    if let axis = chartAxisOrder.first {
                        AxisMarks(position: .leading, values: [0.0, 0.5, 1.0]) { value in
                            AxisGridLine()
                            AxisTick()
                            if let normalized = value.as(Double.self) {
                                AxisValueLabel {
                                    Text(formattedChartAxisValue(normalized, axis: axis))
                                }
                            }
                        }
                    }
                    if let axis = chartAxisOrder.dropFirst().first {
                        AxisMarks(position: .trailing, values: [0.0, 0.5, 1.0]) { value in
                            AxisTick()
                            if let normalized = value.as(Double.self) {
                                AxisValueLabel {
                                    Text(formattedChartAxisValue(normalized, axis: axis))
                                }
                            }
                        }
                    }
                } else {
                    AxisMarks(position: .leading) { value in
                        AxisGridLine()
                        AxisTick()
                        if let raw = value.as(Double.self) {
                            AxisValueLabel {
                                Text(formatChartValue(raw, format: seriesDisplays.first?.format))
                            }
                        }
                    }
                }
            }
            .chartXSelection(value: $selectedCategory)
        }
    }

    private var chartTaskKey: String {
        [
            window?.windowID ?? "",
            container.id ?? "",
            resolvedDataSourceRef,
            chart.type ?? chart.kind ?? "",
            chart.xKey ?? "",
            chart.valueKey ?? "",
            providedRows.map { "provided:\(String(describing: $0).hashValue)" } ?? "runtime"
        ].joined(separator: ":")
    }

    private var rowSubscriptionKey: String {
        [window?.windowID ?? "", resolvedDataSourceRef, "rows"].joined(separator: ":")
    }

    private var controlSubscriptionKey: String {
        [window?.windowID ?? "", resolvedDataSourceRef, "control"].joined(separator: ":")
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

    private var selectedChartSummary: ChartSelectionSummary? {
        chartSelectionSummary(category: selectedCategory, data: chartSeriesData)
    }

    private var selectedPieSummary: PieSelectionSummary? {
        pieSelectionSummary(selectedID: selectedPieID, data: pieData)
    }

    private var chartHasValues: Bool {
        if normalizedChartType == "pie" || normalizedChartType == "donut" {
            return !pieData.isEmpty
        }
        return !chartSeriesData.isEmpty
    }

    private var accessibleDataRows: [ChartAccessibleDataRow] {
        chartAccessibleDataRows(
            chartType: normalizedChartType,
            seriesData: chartSeriesData,
            pieData: pieData,
            limit: 8
        )
    }

    private var accessibleDataTotalCount: Int {
        chartAccessibleDataValueCount(
            chartType: normalizedChartType,
            seriesData: chartSeriesData,
            pieData: pieData
        )
    }

    private var selectedReportRuntimeChartSelection: DashboardReportRuntimeChartSelection? {
        if let selectedPieID,
           let datum = pieData.first(where: { $0.id == selectedPieID }),
           rows.indices.contains(datum.rowIndex) {
            let row = rows[datum.rowIndex]
            return DashboardReportRuntimeChartSelection(
                xValue: .string(datum.label),
                seriesKey: .string(datum.seriesKey),
                row: row,
                selectionRows: [row]
            )
        }
        guard let selectedCategory, !selectedCategory.isEmpty else {
            return nil
        }
        let selectedRows = uniqueChartSelectionRows(category: selectedCategory, data: rawChartSeriesData, rows: rows)
        guard let row = selectedRows.first else {
            return nil
        }
        return DashboardReportRuntimeChartSelection(
            xValue: .string(selectedCategory),
            row: row,
            selectionRows: selectedRows
        )
    }

    private var reportRuntimeChartActionExecutions: [DashboardReportRuntimeActionExecution] {
        guard let selection = selectedReportRuntimeChartSelection,
              !reportRuntimeActionFields.isEmpty,
              !reportRuntimeActionDescriptors.isEmpty else {
            return []
        }
        return DashboardRuntime.dashboardReportRuntimeChartActionExecutions(
            blockID: reportRuntimeBlockID ?? container.id,
            descriptors: reportRuntimeActionDescriptors,
            fields: reportRuntimeActionFields,
            selection: selection
        )
    }

    @ViewBuilder
    private var chartDataFallback: some View {
        let dataRows = accessibleDataRows
        if !dataRows.isEmpty {
            DisclosureGroup(isExpanded: $showsChartDataTable) {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(dataRows) { row in
                        HStack(spacing: 8) {
                            Text(row.category)
                                .lineLimit(1)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            Text(row.seriesLabel)
                                .lineLimit(1)
                                .foregroundStyle(.secondary)
                            Text(row.valueLabel)
                                .fontWeight(.semibold)
                                .frame(minWidth: 48, alignment: .trailing)
                        }
                        .font(isCompactPresentation ? .caption2 : .caption)
                    }
                    let remaining = accessibleDataTotalCount - dataRows.count
                    if remaining > 0 {
                        Text("+\(remaining) more")
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.top, 6)
            } label: {
                Label("Chart data", systemImage: "tablecells")
                    .font((isCompactPresentation ? Font.caption : .footnote).weight(.semibold))
            }
            .accessibilityLabel(chartAccessibleDataSummary(rows: dataRows, totalCount: accessibleDataTotalCount))
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(Color.primary.opacity(0.035), in: RoundedRectangle(cornerRadius: 10))
        }
    }

    private var seriesDisplays: [ChartSeriesDisplay] {
        let options = resolvedChartSeriesOptions
        let palette = chart.seriesDef?.palette.compactMap(chartColor(from:)) ?? []
        let fallbackPalette = [Color.blue, Color.green, Color.orange, Color.purple, Color.pink]
        let composed = normalizedChartType == "composed"
        var seen: Set<String> = []
        return options.enumerated().compactMap { index, option in
            guard let key = nonEmptyChartString(option.value), seen.insert(key).inserted else {
                return nil
            }
            let color = nonEmptyChartString(option.color).flatMap(chartColor(from:))
                ?? palette[safe: index]
                ?? fallbackPalette[index % fallbackPalette.count]
            let axis = nonEmptyChartString(option.axis)?.lowercased()
                ?? (composed && options.count > 1 ? "series:\(key)" : "default")
            return ChartSeriesDisplay(
                key: key,
                label: nonEmptyChartString(option.label)
                    ?? nonEmptyChartString(option.name)
                    ?? titleizedSeriesKey(key),
                color: color,
                type: nonEmptyChartString(option.type)?.lowercased()
                    ?? (composed && index == 0 ? "area" : "line"),
                axis: axis,
                format: nonEmptyChartString(option.format)
                    ?? nonEmptyChartString(chart.axes[axis]?.format)
                    ?? (axis == "default" || axis == "left" ? nonEmptyChartString(chart.yAxis?.format) : nil)
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
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(seriesDisplays) { series in
                    let checked = selectedSeriesKeys.contains(series.key)
                    Button {
                        selectedSeriesKeys = toggledChartSeriesSelection(current: selectedSeriesKeys, key: series.key)
                    } label: {
                        HStack(spacing: 6) {
                            if checked {
                                Image(systemName: "checkmark")
                                    .font(.caption2.weight(.bold))
                            }
                            Circle()
                                .fill(series.color)
                                .frame(width: 8, height: 8)
                            Text(series.label)
                                .font((isCompactPresentation ? Font.caption : .footnote).weight(checked ? .semibold : .medium))
                                .lineLimit(1)
                        }
                        .foregroundStyle(checked ? Color.primary : Color.secondary)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 6)
                        .background(
                            Capsule()
                                .fill(checked ? series.color.opacity(0.12) : Color.forgeSecondarySystemBackground)
                        )
                        .overlay(
                            Capsule()
                                .stroke(checked ? series.color.opacity(0.45) : Color.black.opacity(0.06), lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder
    private var reportRuntimeSelectedChartActions: some View {
        let executions = reportRuntimeChartActionExecutions
        if let onReportRuntimeAction, !executions.isEmpty {
            HStack(spacing: 8) {
                Text("Selection actions")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                Spacer(minLength: 8)
                Menu {
                    ForEach(executions) { execution in
                        Button(execution.label) {
                            onReportRuntimeAction(execution)
                        }
                    }
                } label: {
                    Label("Actions", systemImage: "ellipsis.circle")
                        .font(.caption.weight(.semibold))
                }
                .menuStyle(.button)
                .controlSize(.small)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(Color.forgeSecondarySystemBackground, in: RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.black.opacity(0.05), lineWidth: 1)
            )
        }
    }

    @ViewBuilder
    private var pieSliceSelector: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(pieData) { slice in
                    let checked = selectedPieID == slice.id
                    Button {
                        selectedPieID = checked ? nil : slice.id
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: checked ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(checked ? Color.accentColor : Color.secondary)
                            Text(slice.displayLabel)
                                .lineLimit(1)
                                .foregroundStyle(checked ? .primary : .secondary)
                            Text(slice.valueLabel)
                                .fontWeight(.semibold)
                                .foregroundStyle(.primary)
                        }
                        .font(isCompactPresentation ? .caption2 : .caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 6)
                        .background(
                            Capsule().fill(checked ? Color.accentColor.opacity(0.12) : Color.secondary.opacity(0.08))
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder
    private func chartSelectionSummaryCard(_ summary: ChartSelectionSummary) -> some View {
        let colorByKey = Dictionary(uniqueKeysWithValues: seriesDisplays.map { ($0.key, $0.color) })
        VStack(alignment: .leading, spacing: 6) {
            Text(summary.category)
                .font((isCompactPresentation ? Font.caption : .footnote).weight(.semibold))
                .foregroundStyle(.primary)
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: isCompactPresentation ? 112 : 132), spacing: 8)],
                alignment: .leading,
                spacing: 6
            ) {
                ForEach(summary.values) { value in
                    HStack(spacing: 6) {
                        Circle()
                            .fill(colorByKey[value.seriesKey] ?? .accentColor)
                            .frame(width: 7, height: 7)
                        Text(value.seriesLabel)
                            .lineLimit(1)
                            .foregroundStyle(.secondary)
                        Spacer(minLength: 4)
                        Text(value.valueLabel)
                            .fontWeight(.semibold)
                            .foregroundStyle(.primary)
                    }
                    .font(isCompactPresentation ? .caption2 : .caption)
                }
            }
        }
        .padding(8)
        .background(Color.primary.opacity(0.04), in: RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.black.opacity(0.05), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func pieSelectionSummaryCard(_ summary: PieSelectionSummary) -> some View {
        HStack(spacing: 8) {
            Text(summary.displayLabel)
                .font((isCompactPresentation ? Font.caption2 : .caption).weight(.semibold))
                .lineLimit(1)
                .foregroundStyle(.primary)
            Text(summary.seriesLabel)
                .font(isCompactPresentation ? .caption2 : .caption)
                .lineLimit(1)
                .foregroundStyle(.secondary)
            Spacer(minLength: 8)
            Text(summary.valueLabel)
                .font((isCompactPresentation ? Font.caption2 : .caption).weight(.bold))
                .foregroundStyle(.primary)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(Color.primary.opacity(0.04), in: RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.black.opacity(0.05), lineWidth: 1)
        )
    }

    private var isCompactPresentation: Bool {
        presentationDensity == .compact
    }

    private func loadRows() async {
        if let providedRows {
            rows = providedRows
            hasResolvedRows = true
            return
        }
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
        guard providedRows == nil else {
            return
        }
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

    private func observeControl() async {
        guard providedRows == nil else {
            await MainActor.run {
                controlState = ControlState()
            }
            return
        }
        guard let runtime, let window, !resolvedDataSourceRef.isEmpty else {
            await MainActor.run {
                controlState = ControlState()
            }
            return
        }
        let initialControl = await runtime.dataSourceControl(windowID: window.windowID, dataSourceRef: resolvedDataSourceRef)
        await MainActor.run {
            controlState = initialControl
        }
        let stream = await runtime.dataSourceControlUpdates(
            windowID: window.windowID,
            dataSourceRef: resolvedDataSourceRef
        )
        for await next in stream {
            await MainActor.run {
                controlState = next
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
                let displayLabel = pieDataUsesSeriesStyle && rowLabel != nil ? "\(label) - \(seriesLabel)" : label
                return PieDatum(
                    id: "\(rowIndex)|\(key)|\(label)",
                    rowIndex: rowIndex,
                    label: label,
                    displayLabel: displayLabel,
                    seriesKey: key,
                    seriesLabel: seriesLabel,
                    value: value,
                    valueLabel: formatChartValue(value, format: display?.format)
                )
            }
        }
    }

    private var rawChartSeriesData: [SeriesDatum] {
        let categoryKey = chart.xKey ?? chart.nameKey ?? seriesKeys.first ?? "label"
        let valueKeys = filteredSeriesKeys
        let displayByKey = Dictionary(uniqueKeysWithValues: seriesDisplays.map { ($0.key, $0) })
        return rows.enumerated().flatMap { rowIndex, row in
            let category = row[categoryKey]?.displayStringValue ?? "—"
            return valueKeys.compactMap { key -> SeriesDatum? in
                guard let value = row[key]?.doubleValueValue else { return nil }
                let display = displayByKey[key]
                return SeriesDatum(
                    rowIndex: rowIndex,
                    category: category,
                    seriesKey: key,
                    seriesLabel: display?.label ?? titleizedSeriesKey(key),
                    value: value,
                    format: display?.format
                )
            }
        }
    }

    private var chartSeriesData: [SeriesDatum] {
        chronologicallySortedChartSeriesData(
            aggregateDirectChartSeriesData(rawChartSeriesData)
        )
    }

    private var chartAxisBySeries: [String: String] {
        Dictionary(uniqueKeysWithValues: seriesDisplays.map { ($0.key, $0.axis) })
    }

    private var chartAxisOrder: [String] {
        seriesDisplays.reduce(into: [String]()) { result, series in
            if !result.contains(series.axis) {
                result.append(series.axis)
            }
        }
    }

    private var chartAxisMaxima: [String: Double] {
        chartAxisMaximums(data: chartSeriesData, axisBySeries: chartAxisBySeries)
    }

    private var plottedChartSeriesData: [SeriesDatum] {
        normalizedChartSeriesDataByAxis(data: chartSeriesData, axisBySeries: chartAxisBySeries)
    }

    private var displayChartSeriesData: [SeriesDatum] {
        downsampleChartSeriesData(
            plottedChartSeriesData,
            maximumPerSeries: isCompactPresentation ? 72 : 140
        )
    }

    private var resolvedXTickFormat: String? {
        guard let axis = chart.xAxis else {
            return nil
        }
        let selector = axis.tickFormatSelector?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let source = axis.tickFormatSource?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        guard !selector.isEmpty, !axis.tickFormats.isEmpty, source.isEmpty || source == "windowform" else {
            return axis.tickFormat
        }
        let selected = chartSelectorStringValue(from: SelectorUtil.resolve(chartWindowForm, selector: selector)) ?? ""
        return axis.tickFormats[selected] ?? axis.tickFormat
    }

    private func formattedChartAxisValue(_ normalized: Double, axis: String) -> String {
        let maximum = chartAxisMaxima[axis] ?? 1
        let format = seriesDisplays.first(where: { $0.axis == axis })?.format
        return formatChartValue(normalized * maximum, format: format)
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

internal func sampledChartAxisLabels(_ labels: [String], maximum: Int) -> [String] {
    let orderedLabels = labels.reduce(into: [String]()) { result, label in
        guard !label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !result.contains(label) else { return }
        result.append(label)
    }
    guard maximum > 0, orderedLabels.count > maximum else { return orderedLabels }
    guard maximum > 1 else { return [orderedLabels[0]] }

    let lastIndex = orderedLabels.count - 1
    return (0..<maximum).map { position in
        let index = Int((Double(position) * Double(lastIndex) / Double(maximum - 1)).rounded())
        return orderedLabels[index]
    }
}

internal func downsampleChartSeriesData(
    _ data: [SeriesDatum],
    maximumPerSeries: Int
) -> [SeriesDatum] {
    guard maximumPerSeries > 1 else { return data }
    let seriesOrder = data.reduce(into: [String]()) { result, item in
        if !result.contains(item.seriesKey) { result.append(item.seriesKey) }
    }
    let selectedIDs = Set(seriesOrder.flatMap { key -> [String] in
        let values = data.filter { $0.seriesKey == key }
        guard values.count > maximumPerSeries else { return values.map(\.id) }
        let lastIndex = values.count - 1
        return (0..<maximumPerSeries).map { position in
            let index = Int((Double(position) * Double(lastIndex) / Double(maximumPerSeries - 1)).rounded())
            return values[index].id
        }
    })
    return data.filter { selectedIDs.contains($0.id) }
}

/// Matches the web/PDF direct-series preparation contract: rows that share an
/// x-axis category are one plotted point per series and numeric measures sum.
/// The original rows remain available to selection/action handling.
internal func aggregateDirectChartSeriesData(_ data: [SeriesDatum]) -> [SeriesDatum] {
    var orderedKeys: [String] = []
    var aggregated: [String: SeriesDatum] = [:]
    for item in data {
        let key = "\(item.category)\u{1F}\(item.seriesKey)"
        if let existing = aggregated[key] {
            aggregated[key] = SeriesDatum(
                rowIndex: existing.rowIndex,
                category: existing.category,
                seriesKey: existing.seriesKey,
                seriesLabel: existing.seriesLabel,
                value: existing.value + item.value,
                format: existing.format
            )
        } else {
            orderedKeys.append(key)
            aggregated[key] = item
        }
    }
    return orderedKeys.compactMap { aggregated[$0] }
}

/// Date-backed categories are semantic time axes even when the portable chart
/// model represents them as strings. Sort only when every category is a date;
/// ordinary categorical charts retain their authored/source order.
internal func chronologicallySortedChartSeriesData(_ data: [SeriesDatum]) -> [SeriesDatum] {
    var seenCategories: Set<String> = []
    let categories = data.reduce(into: [String]()) { result, item in
        if seenCategories.insert(item.category).inserted { result.append(item.category) }
    }
    let datedCategories = categories.compactMap { category -> (String, Date)? in
        chartCategoryDate(category).map { (category, $0) }
    }
    guard !categories.isEmpty, datedCategories.count == categories.count else {
        return data
    }
    let dates = Dictionary(uniqueKeysWithValues: datedCategories)
    return data.enumerated().sorted { lhs, rhs in
        let left = dates[lhs.element.category] ?? .distantPast
        let right = dates[rhs.element.category] ?? .distantPast
        if left != right { return left < right }
        return lhs.offset < rhs.offset
    }.map(\.element)
}

internal func chartCategoryDate(_ raw: String) -> Date? {
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }
    let iso = ISO8601DateFormatter()
    iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = iso.date(from: trimmed) { return date }
    iso.formatOptions = [.withInternetDateTime]
    if let date = iso.date(from: trimmed) { return date }
    guard trimmed.count >= 10 else { return nil }
    let input = DateFormatter()
    input.locale = Locale(identifier: "en_US_POSIX")
    input.calendar = Calendar(identifier: .gregorian)
    input.timeZone = TimeZone(secondsFromGMT: 0)
    input.dateFormat = "yyyy-MM-dd"
    return input.date(from: String(trimmed.prefix(10)))
}

internal func compactChartAxisLabel(_ raw: String) -> String {
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return trimmed }
    if let date = chartCategoryDate(trimmed) {
        let display = DateFormatter()
        display.locale = Locale(identifier: "en_US_POSIX")
        display.timeZone = TimeZone(secondsFromGMT: 0)
        display.dateFormat = "MMM d"
        return display.string(from: date)
    }
    return trimmed.count > 14 ? String(trimmed.prefix(12)) + "…" : trimmed
}

internal func formatChartAxisLabel(_ raw: String, tickFormat: String?) -> String {
    guard let date = chartCategoryDate(raw) else {
        return compactChartAxisLabel(raw)
    }
    let normalized = tickFormat?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
    let pattern: String
    switch normalized {
    case "", "shortdate", "short_date":
        pattern = "MM/dd"
    case "hour", "hour12", "ha":
        pattern = "ha"
    default:
        pattern = tickFormat ?? "MM/dd"
    }
    let display = DateFormatter()
    display.locale = Locale(identifier: "en_US_POSIX")
    display.calendar = Calendar(identifier: .gregorian)
    display.timeZone = TimeZone(secondsFromGMT: 0)
    display.dateFormat = pattern
    return display.string(from: date)
}

internal func chartAxisMaximums(
    data: [SeriesDatum],
    axisBySeries: [String: String]
) -> [String: Double] {
    data.reduce(into: [String: Double]()) { result, item in
        let axis = axisBySeries[item.seriesKey] ?? "default"
        result[axis] = max(result[axis] ?? 1, item.value, 1)
    }
}

internal func normalizedChartSeriesDataByAxis(
    data: [SeriesDatum],
    axisBySeries: [String: String]
) -> [SeriesDatum] {
    let axes = Set(data.map { axisBySeries[$0.seriesKey] ?? "default" })
    guard axes.count > 1 else {
        return data
    }
    let maxima = chartAxisMaximums(data: data, axisBySeries: axisBySeries)
    return data.map { item in
        let axis = axisBySeries[item.seriesKey] ?? "default"
        let maximum = maxima[axis] ?? 1
        return SeriesDatum(
            rowIndex: item.rowIndex,
            category: item.category,
            seriesKey: item.seriesKey,
            seriesLabel: item.seriesLabel,
            value: item.value,
            format: item.format,
            plottedValue: item.value / maximum
        )
    }
}

internal func chartSelectionSummary(category: String?, data: [SeriesDatum]) -> ChartSelectionSummary? {
    guard let category, !category.isEmpty else {
        return nil
    }
    let values = data
        .filter { $0.category == category }
        .map {
            ChartSelectionValue(
                seriesKey: $0.seriesKey,
                seriesLabel: $0.seriesLabel,
                value: $0.value,
                valueLabel: formatChartValue($0.value, format: $0.format)
            )
        }
    guard !values.isEmpty else {
        return nil
    }
    return ChartSelectionSummary(category: category, values: values)
}

internal func uniqueChartSelectionRows(
    category: String?,
    data: [SeriesDatum],
    rows: [[String: JSONValue]]
) -> [[String: JSONValue]] {
    guard let category, !category.isEmpty else {
        return []
    }
    var seen: Set<Int> = []
    return data.compactMap { datum in
        guard datum.category == category,
              rows.indices.contains(datum.rowIndex),
              seen.insert(datum.rowIndex).inserted else {
            return nil
        }
        return rows[datum.rowIndex]
    }
}

internal func pieSelectionSummary(selectedID: String?, data: [PieDatum]) -> PieSelectionSummary? {
    guard let selectedID, !selectedID.isEmpty else {
        return nil
    }
    guard let slice = data.first(where: { $0.id == selectedID }) else {
        return nil
    }
    return PieSelectionSummary(
        id: slice.id,
        label: slice.label,
        displayLabel: slice.displayLabel,
        seriesKey: slice.seriesKey,
        seriesLabel: slice.seriesLabel,
        value: slice.value,
        valueLabel: slice.valueLabel
    )
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

internal struct PieDatum: Identifiable {
    let id: String
    let rowIndex: Int
    let label: String
    let displayLabel: String
    let seriesKey: String
    let seriesLabel: String
    let value: Double
    let valueLabel: String
}

internal struct SeriesDatum: Identifiable {
    let rowIndex: Int
    let category: String
    let seriesKey: String
    let seriesLabel: String
    let value: Double
    let format: String?
    let plottedValue: Double?

    init(
        rowIndex: Int,
        category: String,
        seriesKey: String,
        seriesLabel: String,
        value: Double,
        format: String? = nil,
        plottedValue: Double? = nil
    ) {
        self.rowIndex = rowIndex
        self.category = category
        self.seriesKey = seriesKey
        self.seriesLabel = seriesLabel
        self.value = value
        self.format = format
        self.plottedValue = plottedValue
    }

    var chartValue: Double { plottedValue ?? value }

    var id: String {
        "\(rowIndex)|\(category)|\(seriesKey)"
    }
}

internal struct ChartSelectionSummary {
    let category: String
    let values: [ChartSelectionValue]
}

internal struct ChartSelectionValue: Identifiable {
    var id: String { seriesKey }
    let seriesKey: String
    let seriesLabel: String
    let value: Double
    let valueLabel: String
}

internal struct PieSelectionSummary: Identifiable {
    let id: String
    let label: String
    let displayLabel: String
    let seriesKey: String
    let seriesLabel: String
    let value: Double
    let valueLabel: String
}

internal struct ChartAccessibleDataRow: Identifiable, Equatable {
    let id: String
    let category: String
    let seriesLabel: String
    let valueLabel: String
}

internal struct ChartDataStateFeedback: Equatable {
    let message: String
    let isError: Bool

    init(message: String, isError: Bool = false) {
        self.message = message
        self.isError = isError
    }
}

internal func chartAccessibleDataRows(
    chartType: String,
    seriesData: [SeriesDatum],
    pieData: [PieDatum],
    limit: Int = 12
) -> [ChartAccessibleDataRow] {
    let normalizedType = chartType.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    let rows: [ChartAccessibleDataRow]
    if normalizedType == "pie" || normalizedType == "donut" {
        rows = pieData.enumerated().map { index, slice in
            ChartAccessibleDataRow(
                id: "pie-\(index)-\(slice.id)",
                category: slice.displayLabel,
                seriesLabel: slice.seriesLabel,
                valueLabel: slice.valueLabel
            )
        }
    } else {
        rows = seriesData.enumerated().map { index, datum in
            ChartAccessibleDataRow(
                id: "series-\(index)-\(datum.id)",
                category: datum.category,
                seriesLabel: datum.seriesLabel,
                valueLabel: formatChartValue(datum.value, format: datum.format)
            )
        }
    }
    return Array(rows.prefix(max(limit, 0)))
}

internal func chartAccessibleDataValueCount(
    chartType: String,
    seriesData: [SeriesDatum],
    pieData: [PieDatum]
) -> Int {
    let normalizedType = chartType.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return (normalizedType == "pie" || normalizedType == "donut") ? pieData.count : seriesData.count
}

internal func chartDataStateFeedback(
    loading: Bool,
    error: String?,
    hasResolvedRows: Bool,
    hasChartValues: Bool
) -> ChartDataStateFeedback? {
    if hasChartValues {
        return nil
    }
    if loading || !hasResolvedRows {
        return ChartDataStateFeedback(message: "Loading chart")
    }
    if let error, !error.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        return ChartDataStateFeedback(
            message: "Unable to load chart data",
            isError: true
        )
    }
    return ChartDataStateFeedback(message: "No chart data")
}

internal func chartAccessibleDataSummary(rows: [ChartAccessibleDataRow], totalCount: Int) -> String {
    guard !rows.isEmpty else {
        return "Chart data table, no values"
    }
    let preview = rows.prefix(3).map { row in
        "\(row.category), \(row.seriesLabel), \(row.valueLabel)"
    }.joined(separator: "; ")
    let remaining = max(totalCount - rows.count, 0)
    if remaining > 0 {
        return "Chart data table, \(totalCount) values. \(preview). \(remaining) more values."
    }
    return "Chart data table, \(totalCount) values. \(preview)."
}

private struct ChartSeriesDisplay: Identifiable {
    var id: String { key }
    let key: String
    let label: String
    let color: Color
    let type: String
    let axis: String
    let format: String?
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

internal func formatChartValue(_ value: Double, format: String? = nil) -> String {
    if let format = nonEmptyChartString(format) {
        return DashboardRuntime.formatDashboardValue(value, format: format)
    }
    if value.rounded(.towardZero) == value {
        return String(Int(value))
    }
    return String(format: "%.2f", value)
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

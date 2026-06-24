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
                            if let detail = chartStateFeedback.detail {
                                Text(detail)
                                    .font(.caption2)
                                    .foregroundStyle(chartStateFeedback.isError ? .red.opacity(0.85) : .secondary)
                                    .lineLimit(2)
                                    .multilineTextAlignment(.center)
                            }
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
                chartDataFallback
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
                if item.category == selectedCategory, type != "bar", type != "stacked_bar" {
                    PointMark(
                        x: .value("Category", item.category),
                        y: .value("Value", item.value)
                    )
                    .foregroundStyle(by: .value("Series", item.seriesKey))
                    .symbolSize(72)
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
        let selectedRows = uniqueChartSelectionRows(category: selectedCategory, data: chartSeriesData, rows: rows)
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
                    valueLabel: formatChartValue(value)
                )
            }
        }
    }

    private var chartSeriesData: [SeriesDatum] {
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
                valueLabel: formatChartValue($0.value)
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
    let detail: String?
    let isError: Bool

    init(message: String, detail: String? = nil, isError: Bool = false) {
        self.message = message
        self.detail = detail
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
                valueLabel: formatChartValue(datum.value)
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
    let detail = error?.trimmingCharacters(in: .whitespacesAndNewlines)
    if let detail, !detail.isEmpty {
        return ChartDataStateFeedback(
            message: "Unable to load chart data",
            detail: detail,
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

internal func formatChartValue(_ value: Double) -> String {
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

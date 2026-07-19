import SwiftUI
import ForgeIOSRuntime

public struct DashboardRenderer: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.forgePresentationDensity) private var presentationDensity
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    @State private var runtimeMetrics: [String: Any] = [:]
    @State private var dashboardFilters: [String: JSONValue] = [:]
    @State private var dashboardSelection = DashboardSelectionState()
    @State private var dashboardCollections: [String: [[String: JSONValue]]] = [:]
    @State private var dashboardDimensionsModes: [String: String] = [:]

    public init(runtime: ForgeRuntime? = nil, window: WindowContext? = nil, container: ContainerDef) {
        self.runtime = runtime
        self.window = window
        self.container = container
    }

    public var body: some View {
        dashboardBody(container, dashboardRoot: container)
            .task(id: runtimeMetricsTaskKey) {
                await subscribeRuntimeMetrics()
            }
            .task(id: dashboardFiltersTaskKey) {
                await subscribeDashboardFilters()
            }
            .task(id: dashboardSelectionTaskKey) {
                await subscribeDashboardSelection()
            }
            .task(id: dashboardCollectionsTaskKey) {
                await subscribeDashboardCollections()
            }
    }

    private func dashboardBody(_ container: ContainerDef, dashboardRoot: ContainerDef) -> AnyView {
        let metrics = dashboardMetrics(container)
        if !DashboardRuntime.evaluateDashboardCondition(
            container.dashboard?.visibleWhen ?? container.visibleWhen,
            metrics: metrics,
            filters: dashboardFilters.mapValues(dashboardJSONAny),
            selection: dashboardSelection
        ) {
            return AnyView(EmptyView())
        } else {
            switch container.kind?.trimmingCharacters(in: .whitespacesAndNewlines) {
            case "dashboard":
                return dashboardRootBlock(container, metrics: metrics, dashboardRoot: dashboardRoot)
            case "dashboard.summary":
                return AnyView(dashboardPanel(container) {
                    summaryBlock(container, metrics: metrics, dashboardRoot: dashboardRoot)
                })
            case "dashboard.compare":
                return AnyView(dashboardPanel(container) {
                    compareBlock(container, metrics: metrics)
                })
            case "dashboard.kpiTable":
                if let table = dashboardKPITable(container) {
                    let effectiveContainer = dashboardContainerInheritingDataSource(container, dashboardRoot: dashboardRoot)
                    return AnyView(dashboardPanel(container) {
                        TableRenderer(runtime: runtime, window: window, container: effectiveContainer, table: table)
                    })
                }
                return AnyView(dashboardPanel(container) {
                    kpiTableBlock(container, metrics: metrics)
                })
            case "dashboard.filters":
                return AnyView(dashboardPanel(container) {
                    filtersBlock(container, filters: dashboardFilters, dashboardRoot: dashboardRoot)
                })
            case "dashboard.timeline":
                return AnyView(dashboardPanel(container) {
                    timelineBlock(
                        container,
                        filters: dashboardFilters,
                        selection: dashboardSelection,
                        dashboardRoot: dashboardRoot
                    )
                })
            case "dashboard.geoMap":
                return AnyView(dashboardPanel(container) {
                    geoMapBlock(
                        container,
                        metrics: metrics,
                        filters: dashboardFilters,
                        selection: dashboardSelection,
                        dashboardRoot: dashboardRoot
                    )
                })
            case "dashboard.chart":
                if let chart = container.chart {
                    let effectiveContainer = dashboardContainerInheritingDataSource(container, dashboardRoot: dashboardRoot)
                    let rows = dashboardChartRows(
                        container,
                        filters: dashboardFilters,
                        selection: dashboardSelection,
                        dashboardRoot: dashboardRoot
                    )
                    return AnyView(dashboardPanel(container) {
                        ChartTableModeRenderer(
                            runtime: runtime,
                            window: window,
                            container: effectiveContainer,
                            chart: chart,
                            rows: rows
                        )
                    })
                }
                return AnyView(dashboardPanel(container) {
                    unsupportedBlock("dashboard chart block has no chart config")
                })
            case "dashboard.composition":
                if let chart = DashboardRuntime.dashboardCompositionChart(container) {
                    let effectiveContainer = dashboardContainerInheritingDataSource(container, dashboardRoot: dashboardRoot)
                    let rows = dashboardChartRows(
                        container,
                        filters: dashboardFilters,
                        selection: dashboardSelection,
                        dashboardRoot: dashboardRoot
                    )
                    return AnyView(dashboardPanel(container) {
                        ChartTableModeRenderer(
                            runtime: runtime,
                            window: window,
                            container: effectiveContainer,
                            chart: chart,
                            rows: rows
                        )
                    })
                }
                return AnyView(dashboardPanel(container) {
                    unsupportedBlock("dashboard composition block has no chart config")
                })
            case "dashboard.dimensions":
                return AnyView(dashboardPanel(container) {
                    dimensionsBlock(
                        container,
                        filters: dashboardFilters,
                        selection: dashboardSelection,
                        dashboardRoot: dashboardRoot
                    )
                })
            case "dashboard.status":
                return AnyView(dashboardPanel(container) {
                    statusBlock(container, metrics: metrics)
                })
            case "dashboard.messages":
                return AnyView(dashboardPanel(container) {
                    messagesBlock(
                        container,
                        metrics: metrics,
                        filters: dashboardFilters,
                        selection: dashboardSelection,
                        dashboardRoot: dashboardRoot
                    )
                })
            case "dashboard.badges":
                return AnyView(dashboardPanel(container) {
                    badgesBlock(container, metrics: metrics, filters: dashboardFilters, selection: dashboardSelection)
                })
            case "dashboard.report":
                return AnyView(dashboardPanel(container) {
                    reportBlock(container, metrics: metrics, filters: dashboardFilters, selection: dashboardSelection)
                })
            case "dashboard.reportRuntime":
                return AnyView(dashboardPanel(container) {
                    reportRuntimeBlock(container)
                })
            case "dashboard.table", "planner.table":
                let table = container.table ?? (container.columns.isEmpty ? nil : TableDef(title: container.title, columns: container.columns))
                if let table {
                    let effectiveContainer = dashboardContainerInheritingDataSource(container, dashboardRoot: dashboardRoot)
                    return AnyView(dashboardPanel(container) {
                        TableRenderer(runtime: runtime, window: window, container: effectiveContainer, table: table)
                    })
                }
                return AnyView(dashboardPanel(container) {
                    unsupportedBlock("dashboard table has no columns")
                })
            case "dashboard.reportBuilder":
                if let reportBuilder = container.dashboard?.reportBuilder {
                    let effectiveContainer = dashboardContainerInheritingDataSource(container, dashboardRoot: dashboardRoot)
                    return AnyView(dashboardPanel(container) {
                        ReportBuilderRenderer(runtime: runtime, window: window, container: effectiveContainer, config: reportBuilder)
                    })
                }
                return AnyView(dashboardPanel(container) {
                    unsupportedBlock("dashboard report builder has no config")
                })
            case "dashboard.feed":
                return AnyView(dashboardPanel(container) {
                    feedBlock(
                        container,
                        metrics: metrics,
                        filters: dashboardFilters,
                        selection: dashboardSelection,
                        dashboardRoot: dashboardRoot
                    )
                })
            case "dashboard.detail":
                return AnyView(dashboardPanel(container) {
                    detailBlock(
                        container,
                        metrics: metrics,
                        filters: dashboardFilters,
                        selection: dashboardSelection,
                        dashboardRoot: dashboardRoot
                    )
                })
            default:
                return AnyView(dashboardPanel(container) {
                    unsupportedBlock(dashboardUnsupportedBlockMessage(container.kind))
                })
            }
        }
    }

    private func dashboardRootBlock(_ container: ContainerDef, metrics: [String: Any], dashboardRoot: ContainerDef) -> AnyView {
        AnyView(VStack(alignment: .leading, spacing: 12) {
            if let title = container.title, !title.isEmpty {
                Text(title)
                    .font((isCompactPresentation ? Font.headline : .title3).weight(.semibold))
            }
            if let subtitle = container.subtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .font(isCompactPresentation ? .footnote : .subheadline)
                    .foregroundStyle(.secondary)
            }
            ForEach(container.containers) { child in
                dashboardBody(child, dashboardRoot: dashboardRoot)
            }
            if container.containers.isEmpty {
                unsupportedBlock("dashboard root has no child blocks")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, isCompactPresentation ? 4 : (horizontalSizeClass == .regular ? 8 : 12))
        .padding(.vertical, isCompactPresentation ? 4 : (horizontalSizeClass == .regular ? 6 : 8)))
    }

    @ViewBuilder
    private func dashboardPanel<Content: View>(_ container: ContainerDef, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if !isBlank(container.title) || !isBlank(container.subtitle) {
                VStack(alignment: .leading, spacing: 4) {
                    if let title = container.title, !title.isEmpty {
                        Text(title)
                            .font(isCompactPresentation ? .subheadline.weight(.semibold) : .headline)
                    }
                    if let subtitle = container.subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(isCompactPresentation ? .footnote : .subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, isCompactPresentation ? 10 : (horizontalSizeClass == .regular ? 12 : 14))
        .padding(.vertical, isCompactPresentation ? 10 : (horizontalSizeClass == .regular ? 12 : 14))
        .background(
            RoundedRectangle(cornerRadius: isCompactPresentation ? 14 : (horizontalSizeClass == .regular ? 18 : 16))
                .fill(Color.forgeSystemBackground)
        )
        .overlay(
            RoundedRectangle(cornerRadius: isCompactPresentation ? 14 : (horizontalSizeClass == .regular ? 18 : 16))
                .stroke(Color.black.opacity(0.05), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func summaryBlock(_ container: ContainerDef, metrics: [String: Any], dashboardRoot: ContainerDef) -> some View {
        let summaryMetrics = DashboardRuntime.dashboardSummaryMetrics(container)
        if summaryMetrics.isEmpty {
            unsupportedBlock("dashboard summary has no metrics")
        } else {
            let cards = DashboardRuntime.resolvedDashboardSummaryCards(
                container,
                metrics: metrics,
                source: dashboardSummarySource(container, dashboardRoot: dashboardRoot)
            )
            VStack(alignment: .leading, spacing: 10) {
                if cards.isEmpty {
                    emptyDashboardState("No summary data available for this view.")
                } else {
                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: isCompactPresentation ? 136 : (horizontalSizeClass == .regular ? 156 : 160)), spacing: 10, alignment: .top)],
                        alignment: .leading,
                        spacing: 10
                    ) {
                        ForEach(Array(cards.enumerated()), id: \.offset) { _, card in
                            let tone = toneStyle(card.tone)
                            VStack(alignment: .leading, spacing: 6) {
                                Text(card.label)
                                    .font((isCompactPresentation ? Font.caption2 : .caption).weight(.medium))
                                    .foregroundStyle(tone.text.opacity(0.8))
                                Text(card.displayValue)
                                    .font(summaryValueFont(for: card.displayValue).weight(.semibold))
                                    .foregroundStyle(tone.text)
                                    .lineLimit(3)
                                    .minimumScaleFactor(0.62)
                                    .allowsTightening(true)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .frame(maxWidth: .infinity, minHeight: isCompactPresentation ? 52 : (horizontalSizeClass == .regular ? 60 : 72), alignment: .leading)
                            .padding(.horizontal, isCompactPresentation ? 10 : 12)
                            .padding(.vertical, isCompactPresentation ? 9 : (horizontalSizeClass == .regular ? 10 : 11))
                            .background(
                                RoundedRectangle(cornerRadius: 14)
                                    .fill(tone.background)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 14)
                                    .stroke(tone.border, lineWidth: 1)
                            )
                        }
                    }
                }
                if !cards.isEmpty && cards.count < summaryMetrics.count {
                    Text("Some values are unavailable for this view.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var isCompactPresentation: Bool {
        presentationDensity == .compact
    }

    @ViewBuilder
    private func compareBlock(_ container: ContainerDef, metrics: [String: Any]) -> some View {
        let compareItems = dashboardCompareItems(container)
        if compareItems.isEmpty {
            unsupportedBlock("dashboard compare has no items")
        } else {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(Array(compareItems.enumerated()), id: \.offset) { _, item in
                    let current = DashboardRuntime.resolveDashboardValue(source: nil, selector: item.current, metrics: metrics)
                    let previous = DashboardRuntime.resolveDashboardValue(source: nil, selector: item.previous, metrics: metrics)
                    let delta = numericValue(current) - numericValue(previous)
                    let positiveIsUp = item.positiveIsUp != false
                    let tone = delta == 0 ? "neutral" : (((delta > 0) == positiveIsUp) ? "success" : "danger")
                    VStack(alignment: .leading, spacing: 6) {
                        Text(item.label ?? item.id ?? "Comparison")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.secondary)
                        HStack(alignment: .firstTextBaseline) {
                            Text(DashboardRuntime.formatDashboardValue(current, format: item.format))
                                .font(.title3.weight(.semibold))
                            Spacer()
                            if delta != 0 {
                                Text("\(delta >= 0 ? "+" : "")\(DashboardRuntime.formatDashboardValue(delta, format: item.deltaFormat ?? item.format))")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(toneColor(tone))
                            }
                        }
                        if hasCompareContextLabels(item) {
                            VStack(alignment: .leading, spacing: 6) {
                                if let currentLabel = item.currentLabel, !currentLabel.isEmpty {
                                    Text(currentLabel)
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(
                                            Capsule()
                                                .fill(Color.secondary.opacity(0.10))
                                        )
                                }
                                if let previousLabel = item.previousLabel, !previousLabel.isEmpty {
                                    Text(previousLabel)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        if let label = item.deltaLabel, !label.isEmpty {
                            Text(label)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.secondary.opacity(0.08))
                    )
                }
            }
        }
    }

    @ViewBuilder
    private func kpiTableBlock(_ container: ContainerDef, metrics: [String: Any]) -> some View {
        let rows = container.dashboard?.kpiTable?.rows ?? container.rows
        if rows.isEmpty {
            unsupportedBlock("dashboard KPI table has no rows")
        } else {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(rows) { row in
                    let value = DashboardRuntime.resolveDashboardValue(source: nil, selector: row.value, metrics: metrics)
                    HStack(alignment: .top, spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(row.label ?? row.id ?? "KPI")
                                .font(.body.weight(.medium))
                            if let context = row.context, !context.isEmpty {
                                Text(context)
                                    .font(.caption)
                                    .foregroundStyle(toneColor(row.contextTone))
                            }
                        }
                        Spacer()
                        Text(DashboardRuntime.formatDashboardValue(value, format: row.format))
                            .font(.body.monospacedDigit().weight(.semibold))
                    }
                    if row.id != rows.last?.id {
                        Divider()
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func filtersBlock(
        _ container: ContainerDef,
        filters: [String: JSONValue],
        dashboardRoot: ContainerDef
    ) -> some View {
        let filterItems = DashboardRuntime.dashboardFilterItems(container)
        if filterItems.isEmpty {
            unsupportedBlock("dashboard filters have no items")
        } else {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(Array(filterItems.enumerated()), id: \.offset) { _, filter in
                    let field = DashboardRuntime.dashboardFilterKey(filter)
                    VStack(alignment: .leading, spacing: 8) {
                        Text(filter.label ?? field ?? "Filter")
                            .font(.body.weight(.medium))
                        if filter.type == "dateRange" {
                            HStack(spacing: 8) {
                                TextField(
                                    "Start",
                                    text: Binding(
                                        get: { dashboardDateRangeValue(filters: filters, field: field, edge: "start") },
                                        set: { value in
                                            updateDashboardFilters(
                                                DashboardRuntime.setDashboardDateRangeFilter(
                                                    filters,
                                                    item: filter,
                                                    edge: "start",
                                                    value: value
                                                ),
                                                dashboardRoot: dashboardRoot
                                            )
                                        }
                                    )
                                )
                                .textFieldStyle(.roundedBorder)
                                Text("to")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                TextField(
                                    "End",
                                    text: Binding(
                                        get: { dashboardDateRangeValue(filters: filters, field: field, edge: "end") },
                                        set: { value in
                                            updateDashboardFilters(
                                                DashboardRuntime.setDashboardDateRangeFilter(
                                                    filters,
                                                    item: filter,
                                                    edge: "end",
                                                    value: value
                                                ),
                                                dashboardRoot: dashboardRoot
                                            )
                                        }
                                    )
                                )
                                .textFieldStyle(.roundedBorder)
                            }
                        } else {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(Array(filter.options.enumerated()), id: \.offset) { _, option in
                                        let active = dashboardFilterOptionActive(
                                            filters: filters,
                                            field: field,
                                            item: filter,
                                            option: option
                                        )
                                        Button {
                                            updateDashboardFilters(
                                                DashboardRuntime.toggleDashboardFilter(
                                                    filters,
                                                    item: filter,
                                                    optionValue: option.value
                                                ),
                                                dashboardRoot: dashboardRoot
                                            )
                                        } label: {
                                            Text(option.label ?? option.value ?? "Option")
                                                .font(.caption.weight(.medium))
                                                .padding(.horizontal, 10)
                                                .padding(.vertical, 6)
                                                .foregroundStyle(active ? Color.accentColor : Color.primary)
                                                .background(
                                                    Capsule()
                                                        .fill(active ? Color.accentColor.opacity(0.16) : Color.secondary.opacity(0.08))
                                                )
                                        }
                                        .buttonStyle(.plain)
                                        .disabled(option.value?.isEmpty ?? true)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private func dashboardDateRangeValue(filters: [String: JSONValue], field: String?, edge: String) -> String {
        guard let field,
              case .object(let range)? = filters[field],
              case .string(let value)? = range[edge] else {
            return ""
        }
        return value
    }

    private func timelineBlock(
        _ container: ContainerDef,
        filters: [String: JSONValue],
        selection: DashboardSelectionState,
        dashboardRoot: ContainerDef
    ) -> AnyView {
        guard let chart = DashboardRuntime.dashboardTimelineChart(container) else {
            return AnyView(unsupportedBlock("dashboard timeline has no chart config"))
        }
        guard let dataSourceRef = dashboardDataSourceRef(container, dashboardRoot: dashboardRoot) else {
            return AnyView(ChartRenderer(runtime: runtime, window: window, container: container, chart: chart))
        }
        let rows = dashboardCollections[dataSourceRef] ?? []
        let filtered = DashboardRuntime.applyDashboardFiltersToCollection(
            rows,
            filterBindings: container.filterBindings,
            filters: filters
        )
        let selectedRows = DashboardRuntime.applyDashboardSelectionToCollection(
            filtered,
            selectionBindings: container.selectionBindings,
            selection: selection
        )
        return AnyView(ChartRenderer(runtime: runtime, window: window, container: container, chart: chart, rows: selectedRows))
    }

    private func dashboardChartRows(
        _ container: ContainerDef,
        filters: [String: JSONValue],
        selection: DashboardSelectionState,
        dashboardRoot: ContainerDef
    ) -> [[String: JSONValue]]? {
        guard let dataSourceRef = dashboardDataSourceRef(container, dashboardRoot: dashboardRoot) else {
            return nil
        }
        let rows = dashboardCollections[dataSourceRef] ?? []
        let filtered = DashboardRuntime.applyDashboardFiltersToCollection(
            rows,
            filterBindings: container.filterBindings,
            filters: filters
        )
        return DashboardRuntime.applyDashboardSelectionToCollection(
            filtered,
            selectionBindings: container.selectionBindings,
            selection: selection
        )
    }

    @ViewBuilder
    private func geoMapBlock(
        _ container: ContainerDef,
        metrics: [String: Any],
        filters: [String: JSONValue],
        selection: DashboardSelectionState,
        dashboardRoot: ContainerDef
    ) -> some View {
        let metricLabel = container.metric?.label ?? container.metric?.key ?? "Metric"
        let metricValue = container.metric?.key.flatMap { DashboardRuntime.resolveDashboardValue(source: nil, selector: $0, metrics: metrics) }
        let rows = rankedGeoMapRows(container, filters: filters, selection: selection, dashboardRoot: dashboardRoot)
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "map")
                    .foregroundStyle(.secondary)
                Text("Geo map")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                if let metricValue {
                    Text(DashboardRuntime.formatDashboardValue(metricValue, format: container.metric?.format))
                        .font(.subheadline.monospacedDigit().weight(.semibold))
                }
            }
            Text(metricLabel)
                .font(.footnote)
                .foregroundStyle(.secondary)
            if let geo = container.geo?.objectValue,
               let shape = geo["shape"]?.stringValue,
               !shape.isEmpty {
                Text(shape.replacingOccurrences(of: "-", with: " ").capitalized)
                    .font(.caption.weight(.medium))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Capsule().fill(Color.secondary.opacity(0.08)))
            }
            if rows.isEmpty {
                Text("No regional rows available. Mobile renders geo maps as a compact summary until map geometry is available.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(rows) { row in
                        HStack(spacing: 10) {
                            Text(row.rank.map { "#\($0)" } ?? row.regionCode)
                                .font(.caption.monospacedDigit().weight(.semibold))
                                .foregroundStyle(.secondary)
                                .frame(width: 42, alignment: .leading)
                            VStack(alignment: .leading, spacing: 2) {
                                geoMapRowLabel(row)
                                if row.label != row.regionCode {
                                    Text(row.regionCode)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            Text(DashboardRuntime.formatDashboardValue(row.value, format: container.metric?.format))
                                .font(.subheadline.monospacedDigit().weight(.semibold))
                                .foregroundStyle(toneColor(row.tone))
                        }
                        .padding(.vertical, 7)
                        .padding(.horizontal, 10)
                        .background(RoundedRectangle(cornerRadius: 10).fill(toneBackground(row.tone)))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(toneBorder(row.tone), lineWidth: 1))
                    }
                    Text("Map geometry is not available in this native renderer; showing ranked regional fallback rows.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private func rankedGeoMapRows(
        _ container: ContainerDef,
        filters: [String: JSONValue],
        selection: DashboardSelectionState,
        dashboardRoot: ContainerDef
    ) -> [DashboardGeoMapRow] {
        guard let dataSourceRef = dashboardDataSourceRef(container, dashboardRoot: dashboardRoot) else {
            return []
        }
        let rows = dashboardCollections[dataSourceRef] ?? []
        let filtered = DashboardRuntime.applyDashboardFiltersToCollection(
            rows,
            filterBindings: container.filterBindings,
            filters: filters
        )
        let selectedRows = DashboardRuntime.applyDashboardSelectionToCollection(
            filtered,
            selectionBindings: container.selectionBindings,
            selection: selection
        )
        return DashboardRuntime.rankedDashboardGeoMapRows(
            selectedRows,
            metricKey: container.metric?.key,
            limit: container.limit
        )
    }

    @ViewBuilder
    private func geoMapRowLabel(_ row: DashboardGeoMapRow) -> some View {
        if let url = geoMapURL(row.href) {
            Link(destination: url) {
                Text(row.label)
                    .font(.subheadline.weight(.medium))
                    .underline()
            }
        } else {
            Text(row.label)
                .font(.subheadline.weight(.medium))
        }
    }

    private func geoMapURL(_ href: String?) -> URL? {
        let trimmed = href?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !trimmed.isEmpty else {
            return nil
        }
        return URL(string: trimmed)
    }

    private func dimensionsBlock(
        _ container: ContainerDef,
        filters: [String: JSONValue],
        selection: DashboardSelectionState,
        dashboardRoot: ContainerDef
    ) -> AnyView {
        let dimensions = container.dashboard?.dimensions
        let dimension = dimensions?.dimension ?? container.dimension
        let metric = dimensions?.metric ?? container.metric
        guard let dimensionKey = nonBlank(dimension?.key),
              let metricKey = nonBlank(metric?.key) else {
            return AnyView(unsupportedBlock("dashboard dimensions requires dimension and metric"))
        }
        let dataSourceRef = dashboardDataSourceRef(container, dashboardRoot: dashboardRoot)
        let rows = dataSourceRef.flatMap { dashboardCollections[$0] } ?? []
        let filtered = DashboardRuntime.applyDashboardFiltersToCollection(
            rows,
            filterBindings: container.filterBindings,
            filters: filters
        )
        let selectedRows = DashboardRuntime.applyDashboardSelectionToCollection(
            filtered,
            selectionBindings: container.selectionBindings,
            selection: selection
        )
        let ranked = DashboardRuntime.rankedDashboardDimensionRows(
            selectedRows,
            dimensionKey: dimensionKey,
            metricKey: metricKey,
            limit: dimensions?.limit ?? container.limit
        )
        if ranked.isEmpty {
            return AnyView(emptyDashboardState("No dimension rows."))
        }
        let maxValue = max(ranked.map { $0.value }.max() ?? 1, 1)
        let modes = dashboardDimensionsViewModes(for: container)
        let modeKey = container.id ?? "\(dimensionKey):\(metricKey)"
        let activeMode = resolvedChartTableViewMode(dashboardDimensionsModes[modeKey], modes: modes)
        return AnyView(
            VStack(alignment: .leading, spacing: 10) {
                if modes.count > 1 {
                    Picker("", selection: Binding(
                        get: { activeMode },
                        set: { dashboardDimensionsModes[modeKey] = $0 }
                    )) {
                        ForEach(modes, id: \.self) { mode in
                            Text(chartTableModeLabel(mode)).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                if activeMode == "table" {
                    dimensionsTable(
                        ranked,
                        dimensionKey: dimensionKey,
                        metricKey: metricKey,
                        metric: metric,
                        container: container,
                        dashboardRoot: dashboardRoot
                    )
                } else {
                    dimensionsChart(
                        ranked,
                        dimension: dimension,
                        dimensionKey: dimensionKey,
                        metric: metric,
                        container: container,
                        maxValue: maxValue,
                        dashboardRoot: dashboardRoot
                    )
                }
            }
            .onChange(of: modes) {
                dashboardDimensionsModes[modeKey] = resolvedChartTableViewMode(dashboardDimensionsModes[modeKey], modes: modes)
            }
        )
    }

    @ViewBuilder
    private func dimensionsTable(
        _ ranked: [DashboardDimensionRow],
        dimensionKey: String,
        metricKey: String,
        metric: DashboardFieldDef?,
        container: ContainerDef,
        dashboardRoot: ContainerDef
    ) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text("Dimension")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text(metric?.label ?? metricKey)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)

            ForEach(Array(ranked.enumerated()), id: \.offset) { index, row in
                let entity = row.entityKey ?? "-"
                let selected = dashboardSelection.entityKey == row.entityKey
                Button {
                    let selection = DashboardSelectionState(
                        dimension: dimensionKey,
                        entityKey: row.entityKey,
                        selected: DashboardRuntime.dashboardSelectionPayload(from: row.row),
                        sourceBlockID: container.id
                    )
                    updateDashboardSelection(selection, dashboardRoot: dashboardRoot)
                } label: {
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        Text(entity)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(.primary)
                            .lineLimit(2)
                        Spacer()
                        Text(DashboardRuntime.formatDashboardValue(row.value, format: metric?.format))
                            .font(.subheadline.monospacedDigit().weight(.semibold))
                            .foregroundStyle(selected ? Color.accentColor : Color.primary)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 9)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(selected ? Color.accentColor.opacity(0.1) : Color.clear)
                }
                .buttonStyle(.plain)

                if index < ranked.count - 1 {
                    Divider()
                        .padding(.leading, 10)
                }
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.secondary.opacity(0.05))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.black.opacity(0.06), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func dimensionsChart(
        _ ranked: [DashboardDimensionRow],
        dimension: DashboardFieldDef?,
        dimensionKey: String,
        metric: DashboardFieldDef?,
        container: ContainerDef,
        maxValue: Double,
        dashboardRoot: ContainerDef
    ) -> some View {
        ForEach(Array(ranked.enumerated()), id: \.offset) { _, row in
            let entity = row.entityKey ?? "-"
            let selected = dashboardSelection.entityKey == row.entityKey
            let fillColor = selected ? Color.accentColor : Color.accentColor.opacity(0.72)
            Button {
                let selection = DashboardSelectionState(
                    dimension: dimensionKey,
                    entityKey: row.entityKey,
                    selected: DashboardRuntime.dashboardSelectionPayload(from: row.row),
                    sourceBlockID: container.id
                )
                updateDashboardSelection(selection, dashboardRoot: dashboardRoot)
            } label: {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(entity)
                                .font(.body.weight(.semibold))
                                .foregroundStyle(.primary)
                            if let label = dimension?.label, label != entity {
                                Text(label)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        Text(DashboardRuntime.formatDashboardValue(row.value, format: metric?.format))
                            .font(.subheadline.monospacedDigit().weight(.semibold))
                            .foregroundStyle(selected ? Color.accentColor : Color.primary)
                    }
                    GeometryReader { proxy in
                        let progressWidth = max(proxy.size.width * CGFloat(row.value / maxValue), 3)
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.secondary.opacity(0.14))
                            Capsule()
                                .fill(fillColor)
                                .frame(width: progressWidth)
                        }
                    }
                    .frame(height: 7)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(selected ? Color.accentColor.opacity(0.12) : Color.secondary.opacity(0.06))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(selected ? Color.accentColor.opacity(0.45) : Color.black.opacity(0.06), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private func statusBlock(_ container: ContainerDef, metrics: [String: Any]) -> some View {
        let checks = container.dashboard?.status?.checks ?? container.checks
        if checks.isEmpty {
            unsupportedBlock("dashboard status has no checks")
        } else {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(checks) { check in
                    let value = DashboardRuntime.resolveDashboardValue(source: nil, selector: check.selector, metrics: metrics)
                    let tone = DashboardRuntime.dashboardToneName(value: value, tone: check.tone)
                    HStack(spacing: 12) {
                        Circle()
                            .fill(toneColor(tone))
                            .frame(width: 10, height: 10)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(check.label ?? check.id ?? "Status")
                                .font(.body.weight(.medium))
                            Text(DashboardRuntime.formatDashboardValue(value, format: check.format))
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(tone.capitalized)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(toneColor(tone))
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func messagesBlock(
        _ container: ContainerDef,
        metrics: [String: Any],
        filters: [String: JSONValue],
        selection: DashboardSelectionState,
        dashboardRoot: ContainerDef
    ) -> some View {
        let filterValues = filters.mapValues(dashboardJSONAny)
        let messageRows = dashboardDataSourceRef(container, dashboardRoot: dashboardRoot)
            .flatMap { dashboardCollections[$0] } ?? []
        let messages = container.dashboard?.messages?.items ?? container.items.map {
            DashboardMessageDef(
                severity: $0.severity,
                title: $0.title ?? $0.label,
                body: $0.body,
                visibleWhen: $0.visibleWhen
            )
        }
        let visibleMessages = messages.filter {
            DashboardRuntime.evaluateDashboardCondition($0.visibleWhen, metrics: metrics, filters: filterValues, selection: selection)
        }
        if visibleMessages.isEmpty {
            unsupportedBlock("dashboard messages have no visible items")
        } else {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(visibleMessages) { message in
                    VStack(alignment: .leading, spacing: 6) {
                        if let title = message.title, !title.isEmpty {
                            Text(DashboardRuntime.interpolateDashboardTemplate(title, metrics: metrics, filters: filterValues, selection: selection))
                                .font(.body.weight(.semibold))
                        }
                        if let body = dashboardMessageBody(message, rows: messageRows),
                           !body.isEmpty {
                            Text(DashboardRuntime.interpolateDashboardTemplate(body, metrics: metrics, filters: filterValues, selection: selection))
                                .font(.subheadline)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(toneBackground(message.severity))
                    )
                }
            }
        }
    }

    private func dashboardMessageBody(_ message: DashboardMessageDef, rows: [[String: JSONValue]]) -> String? {
        if let body = message.body, !body.isEmpty { return body }
        if let text = message.text, !text.isEmpty { return text }
        guard !rows.isEmpty else { return nil }
        let rowIndex = max(message.rowIndex ?? 0, 0)
        let row = rows.indices.contains(rowIndex) ? rows[rowIndex] : rows[0]
        if let fieldValue = dashboardFeedText(row, selector: message.field) {
            return fieldValue
        }
        if let bodyFieldValue = dashboardFeedText(row, selector: message.bodyField) {
            return bodyFieldValue
        }
        return nil
    }

    @ViewBuilder
    private func badgesBlock(
        _ container: ContainerDef,
        metrics: [String: Any],
        filters: [String: JSONValue],
        selection: DashboardSelectionState
    ) -> some View {
        let filterValues = filters.mapValues(dashboardJSONAny)
        let badgeItems = container.dashboard?.badges?.items.map {
            DashboardBadgeDef(
                id: $0.id,
                label: $0.label,
                value: $0.value,
                tone: $0.tone,
                severity: $0.severity,
                visibleWhen: $0.visibleWhen
            )
        } ?? container.items.map {
            DashboardBadgeDef(
                id: $0.id,
                label: $0.label ?? $0.title,
                value: $0.value?.stringValue ?? $0.value?.intValue.map(String.init),
                tone: $0.appearance,
                severity: $0.severity,
                visibleWhen: $0.visibleWhen
            )
        }
        let visible = badgeItems.filter {
            DashboardRuntime.evaluateDashboardCondition($0.visibleWhen, metrics: metrics, filters: filterValues, selection: selection)
        }
        if visible.isEmpty {
            emptyDashboardState("No active badges.")
        } else {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 120), spacing: 8, alignment: .leading)], alignment: .leading, spacing: 8) {
                ForEach(visible) { badge in
                    let tone = badge.tone ?? badge.severity ?? "info"
                    let label = DashboardRuntime.interpolateDashboardTemplate(
                        badge.label ?? badge.id ?? "Badge",
                        metrics: metrics,
                        filters: filterValues,
                        selection: selection
                    )
                    let value = DashboardRuntime.interpolateDashboardTemplate(
                        badge.value ?? "",
                        metrics: metrics,
                        filters: filterValues,
                        selection: selection
                    )
                    Text(value.isEmpty ? label : "\(label): \(value)")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(toneColor(tone))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Capsule().fill(toneBackground(tone)))
                        .overlay(Capsule().stroke(toneBorder(tone), lineWidth: 1))
                }
            }
        }
    }

    @ViewBuilder
    private func reportBlock(
        _ container: ContainerDef,
        metrics: [String: Any],
        filters: [String: JSONValue],
        selection: DashboardSelectionState
    ) -> some View {
        let filterValues = filters.mapValues(dashboardJSONAny)
        let sections = container.dashboard?.report?.sections ?? container.sections
        let visibleSections = sections.filter {
            DashboardRuntime.evaluateDashboardCondition($0.visibleWhen, metrics: metrics, filters: filterValues, selection: selection)
        }
        if visibleSections.isEmpty {
            unsupportedBlock("dashboard report has no visible sections")
        } else {
            VStack(alignment: .leading, spacing: 14) {
                ForEach(visibleSections) { section in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(DashboardRuntime.interpolateDashboardTemplate(
                            section.title ?? section.id ?? "Section",
                            metrics: metrics,
                            filters: filterValues,
                            selection: selection
                        ))
                            .font(.body.weight(.semibold))
                        ForEach(Array(section.body.enumerated()), id: \.offset) { _, paragraph in
                            MarkdownRenderer(markdown: DashboardRuntime.interpolateDashboardTemplate(
                                paragraph,
                                metrics: metrics,
                                filters: filterValues,
                                selection: selection
                            ))
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(toneBackground(section.tone))
                    )
                }
            }
        }
    }

    @ViewBuilder
    private func reportRuntimeBlock(_ container: ContainerDef) -> some View {
        let summary = DashboardRuntime.dashboardReportRuntimeSummary(container)
        VStack(alignment: .leading, spacing: 8) {
            Text(summary.title ?? container.title ?? "Report runtime")
                .font(.body.weight(.semibold))
            if let subtitle = summary.subtitle {
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Text(summary.blockCount == 1 ? "1 report block" : "\(summary.blockCount) report blocks")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
            let summaryDiagnostics = summary.diagnostics.filter { $0.blockID == nil }
            if !summaryDiagnostics.isEmpty {
                reportRuntimeDiagnosticsPreview(summaryDiagnostics)
            }
            ForEach(summary.blocks) { block in
                if DashboardRuntime.dashboardReportRuntimeBlockVisible(
                    block,
                    metrics: reportRuntimeBlockMetrics(block),
                    filters: dashboardFilters.mapValues(dashboardJSONAny),
                    selection: dashboardSelection
                ) {
                    reportRuntimeAuthoredBlock(block)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.secondary.opacity(0.06))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.black.opacity(0.06), lineWidth: 1)
        )
    }

    private func reportRuntimeBlockMetrics(_ block: DashboardReportRuntimeBlockSummary) -> [String: Any] {
        let row = block.table?.rows.first ?? block.chart?.rows.first ?? [:]
        return row.mapValues(dashboardJSONAny)
    }

    @ViewBuilder
    private func reportRuntimeAuthoredBlock(_ block: DashboardReportRuntimeBlockSummary) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if !block.diagnostics.isEmpty {
                reportRuntimeDiagnosticsPreview(block.diagnostics)
            }
            reportRuntimeAuthoredBlockBody(block)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func reportRuntimeAuthoredBlockBody(_ block: DashboardReportRuntimeBlockSummary) -> some View {
        if block.kind == "markdownBlock", let markdown = block.markdown {
            VStack(alignment: .leading, spacing: 6) {
                if !block.title.isEmpty {
                    Text(block.title)
                        .font(.caption.weight(.semibold))
                }
                MarkdownRenderer(markdown: markdown)
                    .font(.caption)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else if block.kind == "kpiBlock", let kpi = block.kpi {
            VStack(alignment: .leading, spacing: 6) {
                Text(block.title)
                    .font(.caption.weight(.semibold))
                if let description = kpi.description {
                    Text(description)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                if kpi.rowCount == 0 || kpi.valueText == nil {
                    Text(kpi.emptyLabel)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    Text(kpi.valueLabel)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(kpi.valueText ?? "")
                        .font(.title3.monospacedDigit().weight(.semibold))
                    if let secondaryLabel = kpi.secondaryLabel,
                       let secondaryValueText = kpi.secondaryValueText {
                        Text("\(secondaryLabel): \(secondaryValueText)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else if block.kind == "filterBarBlock", let filterBar = block.filterBar {
            reportRuntimeFilterBarPreview(filterBar)
        } else if block.kind == "refinementBarBlock", let refinementBar = block.refinementBar {
            reportRuntimeRefinementBarPreview(refinementBar)
        } else if block.kind == "tableBlock", let table = block.table {
            reportRuntimeTablePreview(block: block, table: table)
        } else if block.kind == "chartBlock", let chart = block.chart {
            ChartRenderer(
                runtime: runtime,
                window: window,
                container: ContainerDef(
                    id: block.id,
                    title: block.title,
                    kind: "dashboard.chart",
                    dataSourceRef: chart.dataSourceRef
                ),
                chart: chart.chart,
                rows: chart.rows,
                reportRuntimeBlockID: block.id,
                reportRuntimeActionFields: chart.actionFields,
                reportRuntimeActionDescriptors: chart.actionDescriptors,
                onReportRuntimeAction: executeReportRuntimeAction
            )
        } else if block.kind == "geoMapBlock", let geoMap = block.geoMap {
            reportRuntimeGeoMapPreview(block: block, geoMap: geoMap)
        } else if Self.reportRuntimePresentationKinds.contains(block.kind) {
            reportRuntimePresentationBlock(block)
        } else {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(block.kind)
                    .font(.caption2.monospaced())
                    .foregroundStyle(.secondary)
                Text(block.title)
                    .font(.caption)
                    .lineLimit(1)
                    .foregroundStyle(.primary)
            }
        }
    }

    private static let reportRuntimePresentationKinds: Set<String> = [
        "badgesBlock", "collectionBlock", "sectionBlock", "tabGroupBlock", "compositeBlock",
        "stepperBlock", "infoPanelBlock", "calloutBlock", "kanbanBlock", "timelineBlock"
    ]

    private func reportRuntimePresentationBlock(_ block: DashboardReportRuntimeBlockSummary) -> some View {
        let entries = reportRuntimePresentationEntries(kind: block.kind, content: block.content)
        return VStack(alignment: .leading, spacing: 7) {
            if let eyebrow = block.content["eyebrow"]?.stringValue, !eyebrow.isEmpty {
                Text(eyebrow.uppercased())
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            Text(block.title)
                .font(.caption.weight(.semibold))
            if let subtitle = block.content["subtitle"]?.stringValue, !subtitle.isEmpty {
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }
            if let description = block.content["description"]?.stringValue, !description.isEmpty {
                Text(description).font(.caption).foregroundStyle(.secondary)
            }
            if let body = block.content["body"]?.stringValue, !body.isEmpty {
                MarkdownRenderer(markdown: body).font(.caption)
            }
            ForEach(Array(entries.enumerated()), id: \.offset) { _, entry in
                VStack(alignment: .leading, spacing: 3) {
                    Text(entry.title).font(.caption.weight(.semibold))
                    if let body = entry.body, !body.isEmpty {
                        MarkdownRenderer(markdown: body).font(.caption)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(8)
                .background(Color.forgeSystemBackground, in: RoundedRectangle(cornerRadius: 9))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color.secondary.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.black.opacity(0.06), lineWidth: 1))
    }

    private func reportRuntimePresentationEntries(
        kind: String,
        content: [String: JSONValue]
    ) -> [(title: String, body: String?)] {
        func objects(_ key: String) -> [[String: JSONValue]] {
            content[key]?.arrayValue?.compactMap(\.objectValue) ?? []
        }
        switch kind {
        case "badgesBlock":
            return objects("items").map { item in
                (
                    item["label"]?.stringValue ?? item["id"]?.stringValue ?? "Value",
                    item["displayValue"]?.stringValue ?? DashboardRuntime.dashboardReportRuntimeValueText(item["value"])
                )
            }
        case "collectionBlock":
            return objects("items").map { ($0["title"]?.stringValue ?? "Item", $0["bodyMarkdown"]?.stringValue) }
        case "stepperBlock":
            return objects("steps").enumerated().map { index, step in
                (step["title"]?.stringValue ?? "Step \(index + 1)", step["body"]?.stringValue)
            }
        case "kanbanBlock":
            return objects("columns").flatMap { column in
                let columnTitle = column["title"]?.stringValue ?? "Column"
                return (column["cards"]?.arrayValue?.compactMap(\.objectValue) ?? []).map { card in
                    ("\(columnTitle) · \(card["title"]?.stringValue ?? "Card")", card["body"]?.stringValue)
                }
            }
        case "timelineBlock":
            return objects("events").map { event in
                let title = [event["date"]?.stringValue, event["title"]?.stringValue]
                    .compactMap { $0 }
                    .filter { !$0.isEmpty }
                    .joined(separator: " · ")
                return (title, event["body"]?.stringValue)
            }
        default:
            return []
        }
    }

    @ViewBuilder
    private func reportRuntimeTablePreview(
        block: DashboardReportRuntimeBlockSummary,
        table: DashboardReportRuntimeTableValue
    ) -> some View {
        if table.columns.isEmpty {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(block.kind)
                    .font(.caption2.monospaced())
                    .foregroundStyle(.secondary)
                Text(block.title)
                    .font(.caption)
                    .lineLimit(1)
                    .foregroundStyle(.primary)
            }
        } else {
            VStack(alignment: .leading, spacing: 8) {
                TableRenderer(
                    runtime: runtime,
                    window: window,
                    container: ContainerDef(
                        id: block.id,
                        title: block.title,
                        kind: "dashboard.table",
                        dataSourceRef: table.dataSourceRef
                    ),
                    table: TableDef(title: block.title, columns: table.columns),
                    rows: table.rows
                )
                reportRuntimeTableActionStrip(block: block, table: table)
            }
        }
    }

    @ViewBuilder
    private func reportRuntimeTableActionStrip(
        block: DashboardReportRuntimeBlockSummary,
        table: DashboardReportRuntimeTableValue
    ) -> some View {
        let rows = table.rows.prefix(6).enumerated().map { ($0.offset, $0.element) }
        let rowActions = rows.compactMap { index, row -> (Int, String, [DashboardReportRuntimeActionExecution])? in
            let executions = reportRuntimeTableActionExecutions(block: block, table: table, row: row)
            guard !executions.isEmpty else { return nil }
            return (index, reportRuntimeTableRowLabel(row: row, columns: table.columns), executions)
        }
        if !rowActions.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text("Row actions")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                ForEach(rowActions, id: \.0) { _, label, executions in
                    HStack(spacing: 8) {
                        Text(label)
                            .font(.caption)
                            .foregroundStyle(.primary)
                            .lineLimit(1)
                        Spacer(minLength: 8)
                        Menu {
                            ForEach(executions) { execution in
                                Button(execution.label) {
                                    executeReportRuntimeAction(execution)
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
        }
    }

    private func reportRuntimeTableActionExecutions(
        block: DashboardReportRuntimeBlockSummary,
        table: DashboardReportRuntimeTableValue,
        row: [String: JSONValue]
    ) -> [DashboardReportRuntimeActionExecution] {
        table.actionFields.flatMap { field in
            let descriptors = table.actionDescriptors.filter { $0.fieldValueKey == field.valueKey }
            return DashboardRuntime.dashboardReportRuntimeTableActionExecutions(
                blockID: block.id,
                descriptors: descriptors,
                field: field,
                item: row
            )
        }
    }

    private func reportRuntimeTableRowLabel(row: [String: JSONValue], columns: [ColumnDef]) -> String {
        guard let column = columns.first else {
            return "Row"
        }
        let key = column.id ?? column.name ?? column.key ?? column.label ?? ""
        return DashboardRuntime.dashboardReportRuntimeValueText(row[key]) ?? column.label ?? column.name ?? column.id ?? "Row"
    }

    private func executeReportRuntimeAction(_ execution: DashboardReportRuntimeActionExecution) {
        guard let runtime else { return }
        if let selection = execution.selection, let window {
            Task {
                await runtime.setDashboardSelection(windowID: window.windowID, container: container, selection: selection)
            }
            return
        }
        let context = window.map {
            ExecutionContext(windowID: $0.windowID, dataSourceRef: "")
        }
        let payload = DashboardRuntime.dashboardReportRuntimeActionExecutionPayload(execution)
        Task {
            _ = await runtime.execute(
                ExecutionDef(action: "reportRuntime.executeAction"),
                context: context,
                args: ["execution": payload]
            )
        }
    }

    @ViewBuilder
    private func reportRuntimeDiagnosticsPreview(_ diagnostics: [DashboardReportRuntimeDiagnostic]) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            ForEach(diagnostics) { diagnostic in
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(diagnostic.severity.uppercased())
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(toneColor(diagnostic.severity))
                        Text(diagnostic.message)
                            .font(.caption)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if let suggestedFix = diagnostic.suggestedFix {
                        Text(suggestedFix)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    let details = [diagnostic.code, diagnostic.path].compactMap { $0 }.joined(separator: " · ")
                    if !details.isEmpty {
                        Text(details)
                            .font(.caption2.monospaced())
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 6)
                .padding(.horizontal, 8)
                .background(RoundedRectangle(cornerRadius: 8).fill(toneBackground(diagnostic.severity)))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(toneBorder(diagnostic.severity), lineWidth: 1))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func reportRuntimeFilterBarPreview(_ filterBar: DashboardReportRuntimeFilterBarValue) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(filterBar.title)
                .font(.caption.weight(.semibold))
            if filterBar.params.isEmpty {
                Text("No shared scope parameters.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(filterBar.params) { param in
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text(param.id)
                                .font(.caption2.weight(.semibold))
                            Text(param.valueText)
                                .font(.caption.monospacedDigit())
                        }
                        if let description = param.description {
                            Text(description)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 6)
                    .padding(.horizontal, 8)
                    .background(RoundedRectangle(cornerRadius: 9).fill(Color.secondary.opacity(0.07)))
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func reportRuntimeRefinementBarPreview(_ refinementBar: DashboardReportRuntimeRefinementBarValue) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if let title = refinementBar.title {
                Text(title)
                    .font(.caption.weight(.semibold))
            }
            if refinementBar.refinements.isEmpty {
                Text(refinementBar.emptyLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(refinementBar.refinements) { refinement in
                    Text(refinement.label)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.accentColor)
                        .padding(.vertical, 5)
                        .padding(.horizontal, 9)
                        .background(Capsule().fill(Color.accentColor.opacity(0.12)))
                        .overlay(Capsule().stroke(Color.accentColor.opacity(0.18), lineWidth: 1))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func reportRuntimeGeoMapPreview(
        block: DashboardReportRuntimeBlockSummary,
        geoMap: DashboardReportRuntimeGeoMapValue
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: "map")
                    .foregroundStyle(.secondary)
                Text(block.title)
                    .font(.caption.weight(.semibold))
                Spacer()
                Text(geoMap.shape.replacingOccurrences(of: "-", with: " ").capitalized)
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.secondary)
            }
            Text(geoMap.metricLabel)
                .font(.caption2)
                .foregroundStyle(.secondary)
            if geoMap.rows.isEmpty {
                Text("No regional rows available.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(geoMap.rows.prefix(5)) { row in
                    HStack(spacing: 8) {
                        Text(row.rank.map { "#\($0)" } ?? row.regionCode)
                            .font(.caption2.monospacedDigit().weight(.semibold))
                            .foregroundStyle(.secondary)
                            .frame(width: 36, alignment: .leading)
                        Text(row.label)
                            .font(.caption.weight(.medium))
                            .lineLimit(1)
                        Spacer()
                        Text(DashboardRuntime.formatDashboardValue(row.value, format: geoMap.metricFormat))
                            .font(.caption.monospacedDigit().weight(.semibold))
                    }
                    .padding(.vertical, 5)
                    .padding(.horizontal, 8)
                    .background(RoundedRectangle(cornerRadius: 8).fill(toneBackground(row.tone)))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(toneBorder(row.tone), lineWidth: 1))
                }
                Text("Map geometry is not available in this native renderer; showing ranked regional fallback rows.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func feedBlock(
        _ container: ContainerDef,
        metrics: [String: Any],
        filters: [String: JSONValue],
        selection: DashboardSelectionState,
        dashboardRoot: ContainerDef
    ) -> some View {
        let fields = container.dashboard?.feed?.fields ?? container.fields
        if let dataSourceRef = dashboardDataSourceRef(container, dashboardRoot: dashboardRoot) {
            let rows = dashboardCollections[dataSourceRef] ?? []
            let filteredRows = DashboardRuntime.applyDashboardFiltersToCollection(
                rows,
                filterBindings: container.filterBindings,
                filters: filters
            )
            let items = DashboardRuntime.applyDashboardSelectionToCollection(
                filteredRows,
                selectionBindings: container.selectionBindings,
                selection: selection
            )
            if items.isEmpty {
                emptyDashboardState("No feed entries.")
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                        VStack(alignment: .leading, spacing: 6) {
                            if let timestamp = dashboardFeedText(item, selector: fields?.timestamp) {
                                Text(timestamp)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            if let title = dashboardFeedText(item, selector: fields?.title) {
                                Text(title)
                                    .font(.body.weight(.medium))
                            }
                            if let body = dashboardFeedText(item, selector: fields?.body) {
                                Text(body)
                                    .font(.subheadline)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color.secondary.opacity(0.08))
                        )
                    }
                }
            }
        } else if container.items.isEmpty {
            unsupportedBlock("dashboard feed has no items")
        } else {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(container.items) { item in
                    let feedTitle = item.title ?? fields?.title ?? item.id ?? "Feed item"
                    VStack(alignment: .leading, spacing: 6) {
                        Text(feedTitle)
                            .font(.body.weight(.medium))
                        if let subtitle = item.subtitle, !subtitle.isEmpty {
                            Text(subtitle)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        } else if let body = fields?.body, !body.isEmpty {
                            Text(DashboardRuntime.interpolateDashboardTemplate(
                                body,
                                metrics: metrics,
                                filters: filters.mapValues(dashboardJSONAny),
                                selection: dashboardSelection
                            ))
                                .font(.subheadline)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.secondary.opacity(0.08))
                    )
                }
            }
        }
    }

    private func detailBlock(
        _ container: ContainerDef,
        metrics: [String: Any],
        filters: [String: JSONValue],
        selection: DashboardSelectionState,
        dashboardRoot: ContainerDef
    ) -> AnyView {
        let visibleChildren = DashboardRuntime.visibleDashboardDetailChildren(
            container,
            metrics: metrics,
            filters: filters.mapValues(dashboardJSONAny),
            selection: selection
        )
        if visibleChildren.isEmpty {
            let message = container.containers.isEmpty
                ? "dashboard detail has no child blocks"
                : "dashboard detail has no visible child blocks"
            return AnyView(unsupportedBlock(message))
        } else {
            return AnyView(VStack(alignment: .leading, spacing: 12) {
                ForEach(visibleChildren) { child in
                    dashboardBody(child, dashboardRoot: dashboardRoot)
                }
            })
        }
    }

    private func unsupportedBlock(_ label: String?) -> some View {
        Text(label ?? "Unsupported dashboard block")
            .font(.caption)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(.quaternary)
            )
    }

    private func emptyDashboardState(_ message: String) -> some View {
        Text(message)
            .font(.footnote)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.secondary.opacity(0.06))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.black.opacity(0.05), lineWidth: 1)
            )
    }

    private func dashboardMetrics(_ container: ContainerDef) -> [String: Any] {
        var metrics = runtimeMetrics
        for item in container.items {
            if let id = item.id {
                metrics[id] = [
                    "title": item.title as Any,
                    "subtitle": item.subtitle as Any
                ]
            }
        }
        return metrics
    }

    private func dashboardSummarySource(_ container: ContainerDef, dashboardRoot: ContainerDef) -> [String: Any]? {
        guard let dataSourceRef = dashboardDataSourceRef(container, dashboardRoot: dashboardRoot),
              let row = dashboardCollections[dataSourceRef]?.first else {
            return nil
        }
        return row.mapValues(dashboardJSONAny)
    }

    private func dashboardCompareItems(_ container: ContainerDef) -> [DashboardCompareItemDef] {
        if let items = container.dashboard?.compare?.items, !items.isEmpty {
            return items
        }
        return container.items.compactMap { item -> DashboardCompareItemDef? in
            guard item.current != nil || item.previous != nil else {
                return nil
            }
            return DashboardCompareItemDef(
                id: item.id,
                label: item.label,
                current: item.current,
                previous: item.previous,
                format: item.format,
                deltaFormat: item.deltaFormat,
                positiveIsUp: item.positiveIsUp,
                deltaLabel: item.deltaLabel,
                currentLabel: item.currentLabel,
                previousLabel: item.previousLabel
            )
        }
    }

    private func hasCompareContextLabels(_ item: DashboardCompareItemDef) -> Bool {
        let current = item.currentLabel?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let previous = item.previousLabel?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return !current.isEmpty || !previous.isEmpty
    }

    private func dashboardKPITable(_ container: ContainerDef) -> TableDef? {
        let columns = nonEmptyColumns(container.dashboard?.kpiTable?.columns) ?? nonEmptyColumns(container.columns)
        guard let columns else {
            return nil
        }
        return TableDef(title: container.title, columns: columns)
    }

    private func nonEmptyColumns(_ columns: [ColumnDef]?) -> [ColumnDef]? {
        guard let columns, !columns.isEmpty else {
            return nil
        }
        return columns
    }

    private var runtimeMetricsTaskKey: String {
        [
            window?.windowID ?? "",
            container.id ?? "",
            container.dataSourceRef ?? ""
        ].joined(separator: ":")
    }

    private var dashboardFiltersTaskKey: String {
        [
            "dashboardFilters",
            window?.windowID ?? "",
            container.id ?? "",
            container.dashboard?.key ?? ""
        ].joined(separator: ":")
    }

    private var dashboardSelectionTaskKey: String {
        [
            "dashboardSelection",
            window?.windowID ?? "",
            container.id ?? "",
            container.dashboard?.key ?? ""
        ].joined(separator: ":")
    }

    private var dashboardCollectionsTaskKey: String {
        [
            "dashboardCollections",
            window?.windowID ?? "",
            dashboardDataSourceRefs(in: container).joined(separator: "|")
        ].joined(separator: ":")
    }

    private func subscribeRuntimeMetrics() async {
        guard let runtime, let window, let dataSourceRef = nonBlank(container.dataSourceRef) else {
            await MainActor.run {
                runtimeMetrics = [:]
            }
            return
        }

        let initial = await dashboardRuntimeMetricsSnapshot(runtime: runtime, window: window, dataSourceRef: dataSourceRef)
        await MainActor.run {
            runtimeMetrics = initial
        }

        await withTaskGroup(of: Void.self) { group in
            group.addTask {
                let stream = await runtime.dataSourceMetricsUpdates(windowID: window.windowID, dataSourceRef: dataSourceRef)
                for await next in stream {
                    await MainActor.run {
                        runtimeMetrics = dashboardMetricsFromJSON(next)
                    }
                }
            }
            group.addTask {
                let stream = await runtime.dataSourceCollectionUpdates(windowID: window.windowID, dataSourceRef: dataSourceRef)
                for await next in stream {
                    let currentMetrics = await runtime.dataSourceMetrics(windowID: window.windowID, dataSourceRef: dataSourceRef)
                    guard currentMetrics.isEmpty else { continue }
                    await MainActor.run {
                        runtimeMetrics = next.first.map(dashboardMetricsFromJSON) ?? [:]
                    }
                }
            }
            await group.waitForAll()
        }
    }

    private func dashboardRuntimeMetricsSnapshot(
        runtime: ForgeRuntime,
        window: WindowContext,
        dataSourceRef: String
    ) async -> [String: Any] {
        let rawMetrics = await runtime.dataSourceMetrics(windowID: window.windowID, dataSourceRef: dataSourceRef)
        if !rawMetrics.isEmpty {
            return dashboardMetricsFromJSON(rawMetrics)
        }
        let rows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: dataSourceRef)
        if let first = rows.first {
            return dashboardMetricsFromJSON(first)
        }
        return [:]
    }

    private func dashboardMetricsFromJSON(_ values: [String: JSONValue]) -> [String: Any] {
        values.mapValues { $0.anyValueValue as Any }
    }

    private func subscribeDashboardFilters() async {
        let defaults = DashboardRuntime.buildDashboardDefaultFilters(container)
        guard let runtime, let window else {
            await MainActor.run {
                if dashboardFilters.isEmpty && !defaults.isEmpty {
                    dashboardFilters = defaults
                }
            }
            return
        }

        let current = await runtime.dashboardFilterState(windowID: window.windowID, container: container)
        if current.isEmpty && !defaults.isEmpty {
            await runtime.setDashboardFilters(windowID: window.windowID, container: container, filters: defaults)
        }
        let stream = await runtime.dashboardFilterUpdates(windowID: window.windowID, container: container)
        for await next in stream {
            await MainActor.run {
                dashboardFilters = next
            }
        }
    }

    private func subscribeDashboardSelection() async {
        guard let runtime, let window else {
            await MainActor.run {
                dashboardSelection = DashboardSelectionState()
            }
            return
        }
        let current = await runtime.dashboardSelectionState(windowID: window.windowID, container: container)
        await MainActor.run {
            dashboardSelection = current
        }
        let stream = await runtime.dashboardSelectionUpdates(windowID: window.windowID, container: container)
        for await next in stream {
            await MainActor.run {
                dashboardSelection = next
            }
        }
    }

    private func updateDashboardSelection(_ selection: DashboardSelectionState, dashboardRoot: ContainerDef) {
        dashboardSelection = selection
        guard let runtime, let window else {
            return
        }
        Task {
            await runtime.setDashboardSelection(windowID: window.windowID, container: dashboardRoot, selection: selection)
        }
    }

    private func subscribeDashboardCollections() async {
        let refs = dashboardDataSourceRefs(in: container)
        guard let runtime, let window, !refs.isEmpty else {
            await MainActor.run {
                dashboardCollections = [:]
            }
            return
        }

        var loaded: [String: [[String: JSONValue]]] = [:]
        for ref in refs {
            loaded[ref] = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: ref)
        }
        await MainActor.run {
            dashboardCollections = loaded
        }

        await withTaskGroup(of: Void.self) { group in
            for ref in refs {
                group.addTask {
                    let stream = await runtime.dataSourceCollectionUpdates(windowID: window.windowID, dataSourceRef: ref)
                    for await next in stream {
                        await MainActor.run {
                            dashboardCollections[ref] = next
                        }
                    }
                }
            }
            await group.waitForAll()
        }
    }

    private func updateDashboardFilters(_ next: [String: JSONValue], dashboardRoot: ContainerDef) {
        dashboardFilters = next
        guard let runtime, let window else { return }
        Task {
            await runtime.setDashboardFilters(windowID: window.windowID, container: dashboardRoot, filters: next)
        }
    }

    private func dashboardFilterOptionActive(
        filters: [String: JSONValue],
        field: String?,
        item: DashboardFilterItemDef,
        option: DashboardFilterOptionDef
    ) -> Bool {
        guard let field, let optionValue = option.value else { return false }
        if item.multiple == true {
            return filters[field]?.arrayValue?.compactMap(\.stringValue).contains(optionValue) == true
        }
        return filters[field]?.stringValue == optionValue
    }

    private func dashboardJSONAny(_ value: JSONValue) -> Any {
        value.anyValueValue as Any
    }

    private func toneColor(_ tone: String?) -> Color {
        toneStyle(tone).text
    }

    private func toneBackground(_ tone: String?) -> Color {
        toneStyle(tone).background
    }

    private func toneBorder(_ tone: String?) -> Color {
        toneStyle(tone).border
    }

    private func summaryCardTone(for metric: DashboardMetricDef, index: Int) -> DashboardCardTone {
        if let tone = metric.tone?.trimmingCharacters(in: .whitespacesAndNewlines), !tone.isEmpty {
            return toneStyle(tone)
        }
        return toneStyle("neutral")
    }

    private func summaryValueFont(for text: String) -> Font {
        let normalized = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let longestToken = normalized
            .split(whereSeparator: { $0 == " " || $0 == "_" || $0 == "-" || $0 == "/" })
            .map(\.count)
            .max() ?? normalized.count
        if longestToken >= 18 || normalized.count >= 30 {
            return isCompactPresentation ? .footnote : .subheadline
        }
        if longestToken >= 12 || normalized.count >= 20 {
            return isCompactPresentation ? .callout : .headline
        }
        return isCompactPresentation ? .headline : .title3
    }

    private func toneStyle(_ tone: String?) -> DashboardCardTone {
        switch tone?.lowercased() {
        case "success", "good":
            return DashboardCardTone(
                background: Color(red: 0.93, green: 0.98, blue: 0.94),
                border: Color(red: 0.72, green: 0.89, blue: 0.76),
                text: Color(red: 0.10, green: 0.39, blue: 0.18)
            )
        case "warning", "caution":
            return DashboardCardTone(
                background: Color(red: 1.00, green: 0.97, blue: 0.89),
                border: Color(red: 0.96, green: 0.86, blue: 0.55),
                text: Color(red: 0.57, green: 0.38, blue: 0.03)
            )
        case "danger", "error":
            return DashboardCardTone(
                background: Color(red: 0.99, green: 0.93, blue: 0.93),
                border: Color(red: 0.94, green: 0.73, blue: 0.73),
                text: Color(red: 0.60, green: 0.16, blue: 0.20)
            )
        case "info", "setup", "restriction", "accent":
            return DashboardCardTone(
                background: Color(red: 0.94, green: 0.94, blue: 1.00),
                border: Color(red: 0.78, green: 0.79, blue: 0.96),
                text: Color(red: 0.29, green: 0.27, blue: 0.65)
            )
        default:
            return DashboardCardTone(
                background: Color(red: 0.95, green: 0.96, blue: 0.98),
                border: Color(red: 0.84, green: 0.87, blue: 0.91),
                text: Color(red: 0.29, green: 0.33, blue: 0.39)
            )
        }
    }

    private func resolvedSummaryCards(_ definitions: [DashboardMetricDef], metrics: [String: Any]) -> [DashboardSummaryCard] {
        definitions.enumerated().compactMap { index, metric in
            let value = DashboardRuntime.resolveDashboardValue(
                source: nil,
                selector: metric.selector,
                metrics: metrics
            )
            let displayValue = DashboardRuntime.formatDashboardValue(value, format: metric.format)
            guard isMeaningfulSummaryValue(displayValue) else {
                return nil
            }
            return DashboardSummaryCard(
                label: metric.label ?? metric.selector ?? "Metric",
                displayValue: displayValue,
                tone: summaryCardTone(for: metric, index: index)
            )
        }
    }

    private func numericValue(_ value: Any?) -> Double {
        switch value {
        case let number as Double:
            return number
        case let number as Float:
            return Double(number)
        case let number as Int:
            return Double(number)
        case let number as NSNumber:
            return number.doubleValue
        case let primitive as JSONPrimitive:
            if case .number(let number) = primitive {
                return number
            }
            return 0
        default:
            return 0
        }
    }

    private func isBlank(_ value: String?) -> Bool {
        value?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true
    }

    private func isMeaningfulSummaryValue(_ value: String) -> Bool {
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return false }
        let lowered = normalized.lowercased()
        return !["-", "—", "/", "n/a", "na", "null"].contains(lowered)
    }

    private func dashboardDataSourceRef(_ container: ContainerDef, dashboardRoot: ContainerDef) -> String? {
        nonBlank(container.dataSourceRef) ?? nonBlank(dashboardRoot.dataSourceRef)
    }

    private func dashboardDataSourceRefs(in root: ContainerDef) -> [String] {
        var refs: [String] = []

        func append(_ ref: String?) {
            guard let ref = nonBlank(ref), !refs.contains(ref) else { return }
            refs.append(ref)
        }

        append(root.dataSourceRef)

        func collect(_ node: ContainerDef) {
            append(node.dataSourceRef)
            node.containers.forEach(collect)
        }

        collect(root)
        return refs
    }

    private func dashboardFeedText(_ row: [String: JSONValue], selector: String?) -> String? {
        guard let selector = nonBlank(selector),
              let resolved = SelectorUtil.resolve(row.mapValues(dashboardFeedJSONAny), selector: selector) else {
            return nil
        }
        let value: Any?
        if let json = resolved as? JSONValue {
            value = json.anyValueValue
        } else {
            value = resolved
        }
        guard let value else { return nil }
        let text = String(describing: value).trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? nil : text
    }

    private func dashboardFeedJSONAny(_ value: JSONValue) -> Any {
        switch value {
        case .string(let string):
            return string
        case .number(let number):
            return number
        case .bool(let bool):
            return bool
        case .array(let values):
            return values.map(dashboardFeedJSONAny)
        case .object(let object):
            return object.mapValues(dashboardFeedJSONAny)
        case .null:
            return NSNull()
        }
    }

    private func nonBlank(_ value: String?) -> String? {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
    }
}

internal func dashboardContainerInheritingDataSource(
    _ container: ContainerDef,
    dashboardRoot: ContainerDef
) -> ContainerDef {
    guard dashboardNonBlank(container.dataSourceRef) == nil,
          let inheritedDataSourceRef = dashboardNonBlank(dashboardRoot.dataSourceRef) else {
        return container
    }
    return ContainerDef(
        id: container.id,
        title: container.title,
        subtitle: container.subtitle,
        kind: container.kind,
        scrollMode: container.scrollMode,
        dataSourceRef: inheritedDataSourceRef,
        columnSpan: container.columnSpan,
        rowSpan: container.rowSpan,
        filterBindings: container.filterBindings,
        visibleWhen: container.visibleWhen,
        metrics: container.metrics,
        checks: container.checks,
        rows: container.rows,
        sections: container.sections,
        fields: container.fields,
        dimension: container.dimension,
        metric: container.metric,
        viewModes: container.viewModes,
        limit: container.limit,
        orderBy: container.orderBy,
        containers: container.containers,
        selectFirst: container.selectFirst,
        layout: container.layout,
        stateKey: container.stateKey,
        schemaBasedForm: container.schemaBasedForm,
        dashboard: container.dashboard,
        tabs: container.tabs,
        items: container.items,
        chart: container.chart,
        table: container.table,
        columns: container.columns,
        geo: container.geo,
        treeBrowser: container.treeBrowser,
        fileBrowser: container.fileBrowser,
        editor: container.editor,
        fetchData: container.fetchData,
        target: container.target,
        targetOverrides: container.targetOverrides
    )
}

private func dashboardNonBlank(_ value: String?) -> String? {
    guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
        return nil
    }
    return trimmed
}

func dashboardUnsupportedBlockMessage(_ kind: String?) -> String {
    guard let normalized = dashboardNonBlank(kind) else {
        return "Unsupported dashboard block"
    }
    return "Unsupported dashboard block: \(normalized)"
}

private struct DashboardCardTone {
    let background: Color
    let border: Color
    let text: Color
}

private struct DashboardSummaryCard {
    let label: String
    let displayValue: String
    let tone: DashboardCardTone
}

private extension JSONValue {
    var anyValueValue: Any? {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            return value
        case .bool(let value):
            return value
        case .array(let value):
            return value.map(\.anyValueValue)
        case .object(let value):
            return value.mapValues(\.anyValueValue)
        case .null:
            return nil
        }
    }
}

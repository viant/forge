import SwiftUI
import ForgeIOSRuntime

public struct DashboardRenderer: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.forgePresentationDensity) private var presentationDensity
    private let runtime: ForgeRuntime?
    private let window: WindowContext?
    private let container: ContainerDef
    @State private var runtimeMetrics: [String: Any] = [:]

    public init(runtime: ForgeRuntime? = nil, window: WindowContext? = nil, container: ContainerDef) {
        self.runtime = runtime
        self.window = window
        self.container = container
    }

    public var body: some View {
        dashboardBody(container)
            .task(id: runtimeMetricsTaskKey) {
                await loadRuntimeMetrics()
            }
    }

    private func dashboardBody(_ container: ContainerDef) -> AnyView {
        let metrics = dashboardMetrics(container)
        if !DashboardRuntime.evaluateDashboardCondition(container.dashboard?.visibleWhen ?? container.visibleWhen, metrics: metrics) {
            return AnyView(EmptyView())
        } else {
            switch container.kind?.trimmingCharacters(in: .whitespacesAndNewlines) {
            case "dashboard":
                return dashboardRoot(container, metrics: metrics)
            case "dashboard.summary":
                return AnyView(dashboardPanel(container) {
                    summaryBlock(container, metrics: metrics)
                })
            case "dashboard.compare":
                return AnyView(dashboardPanel(container) {
                    compareBlock(container, metrics: metrics)
                })
            case "dashboard.kpiTable":
                return AnyView(dashboardPanel(container) {
                    kpiTableBlock(container, metrics: metrics)
                })
            case "dashboard.filters":
                return AnyView(dashboardPanel(container) {
                    filtersBlock(container)
                })
            case "dashboard.timeline":
                return AnyView(dashboardPanel(container) {
                    timelineBlock(container)
                })
            case "dashboard.dimensions":
                return AnyView(dashboardPanel(container) {
                    dimensionsBlock(container)
                })
            case "dashboard.status":
                return AnyView(dashboardPanel(container) {
                    statusBlock(container, metrics: metrics)
                })
            case "dashboard.messages":
                return AnyView(dashboardPanel(container) {
                    messagesBlock(container, metrics: metrics)
                })
            case "dashboard.report":
                return AnyView(dashboardPanel(container) {
                    reportBlock(container, metrics: metrics)
                })
            case "dashboard.reportBuilder":
                if let reportBuilder = container.dashboard?.reportBuilder {
                    return AnyView(dashboardPanel(container) {
                        ReportBuilderRenderer(runtime: runtime, window: window, container: container, config: reportBuilder)
                    })
                }
                return AnyView(dashboardPanel(container) {
                    unsupportedBlock("dashboard report builder has no config")
                })
            case "dashboard.feed":
                return AnyView(dashboardPanel(container) {
                    feedBlock(container, metrics: metrics)
                })
            case "dashboard.detail":
                return AnyView(dashboardPanel(container) {
                    detailBlock(container)
                })
            default:
                return AnyView(dashboardPanel(container) {
                    unsupportedBlock(container.kind)
                })
            }
        }
    }

    private func dashboardRoot(_ container: ContainerDef, metrics: [String: Any]) -> AnyView {
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
                dashboardBody(child)
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
    private func summaryBlock(_ container: ContainerDef, metrics: [String: Any]) -> some View {
        let summaryMetrics = container.dashboard?.summary?.metrics ?? container.metrics
        if summaryMetrics.isEmpty {
            unsupportedBlock("dashboard summary has no metrics")
        } else {
            let cards = resolvedSummaryCards(summaryMetrics, metrics: metrics)
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
                            VStack(alignment: .leading, spacing: 6) {
                                Text(card.label)
                                    .font((isCompactPresentation ? Font.caption2 : .caption).weight(.medium))
                                    .foregroundStyle(card.tone.text.opacity(0.8))
                                Text(card.displayValue)
                                    .font(summaryValueFont(for: card.displayValue).weight(.semibold))
                                    .foregroundStyle(card.tone.text)
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
                                    .fill(card.tone.background)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 14)
                                    .stroke(card.tone.border, lineWidth: 1)
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
        let compareItems = container.dashboard?.compare?.items ?? []
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
    private func filtersBlock(_ container: ContainerDef) -> some View {
        let filters = container.dashboard?.filters?.items ?? []
        if filters.isEmpty {
            unsupportedBlock("dashboard filters have no items")
        } else {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(Array(filters.enumerated()), id: \.offset) { _, filter in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(filter.label ?? filter.field ?? filter.id ?? "Filter")
                            .font(.body.weight(.medium))
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(Array(filter.options.enumerated()), id: \.offset) { _, option in
                                    Text(option.label ?? option.value ?? "Option")
                                        .font(.caption.weight(.medium))
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(
                                            Capsule()
                                                .fill((option.defaultValue ?? false) ? Color.accentColor.opacity(0.16) : Color.secondary.opacity(0.08))
                                        )
                                }
                            }
                        }
                    }
                }
                Text("Filter state wiring still belongs in Forge signal/runtime plumbing.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func timelineBlock(_ container: ContainerDef) -> some View {
        let timeline = container.dashboard?.timeline
        let modes = timeline?.viewModes ?? container.viewModes
        VStack(alignment: .leading, spacing: 8) {
            if !modes.isEmpty {
                LabeledContent("View modes") {
                    Text(modes.joined(separator: ", "))
                }
            }
            if let selector = timeline?.annotations?.selector, !selector.isEmpty {
                LabeledContent("Annotations") {
                    Text(selector).foregroundStyle(.secondary)
                }
            }
            Text("Timeline data rendering still depends on data-source and selection plumbing in Forge runtime.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private func dimensionsBlock(_ container: ContainerDef) -> some View {
        let dimensions = container.dashboard?.dimensions
        let dimension = dimensions?.dimension ?? container.dimension
        let metric = dimensions?.metric ?? container.metric
        VStack(alignment: .leading, spacing: 8) {
            if let dimension {
                LabeledContent("Dimension") {
                    Text(dimension.label ?? dimension.key ?? "Unnamed")
                }
            }
            if let metric {
                LabeledContent("Metric") {
                    Text(metric.label ?? metric.key ?? "Unnamed")
                }
            }
            if let limit = dimensions?.limit ?? container.limit {
                LabeledContent("Limit") {
                    Text(String(limit))
                }
            }
            if let orderBy = dimensions?.orderBy ?? container.orderBy, !orderBy.isEmpty {
                LabeledContent("Order by") {
                    Text(orderBy)
                }
            }
            let modes = dimensions?.viewModes ?? container.viewModes
            if !modes.isEmpty {
                LabeledContent("View modes") {
                    Text(modes.joined(separator: ", "))
                }
            }
            Text("Selection and chart/table synchronization still belongs in Forge signals.")
                .font(.caption)
                .foregroundStyle(.secondary)
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
                    let tone = tone(for: numericValue(value), config: check.tone)
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
    private func messagesBlock(_ container: ContainerDef, metrics: [String: Any]) -> some View {
        let messages = container.dashboard?.messages?.items ?? container.items.map {
            DashboardMessageDef(
                severity: $0.severity,
                title: $0.title ?? $0.label,
                body: $0.body,
                visibleWhen: $0.visibleWhen
            )
        }
        let visibleMessages = messages.filter {
            DashboardRuntime.evaluateDashboardCondition($0.visibleWhen, metrics: metrics)
        }
        if visibleMessages.isEmpty {
            unsupportedBlock("dashboard messages have no visible items")
        } else {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(visibleMessages) { message in
                    VStack(alignment: .leading, spacing: 6) {
                        if let title = message.title, !title.isEmpty {
                            Text(DashboardRuntime.interpolateDashboardTemplate(title, metrics: metrics))
                                .font(.body.weight(.semibold))
                        }
                        if let body = message.body, !body.isEmpty {
                            Text(DashboardRuntime.interpolateDashboardTemplate(body, metrics: metrics))
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

    @ViewBuilder
    private func reportBlock(_ container: ContainerDef, metrics: [String: Any]) -> some View {
        let sections = container.dashboard?.report?.sections ?? container.sections
        let visibleSections = sections.filter {
            DashboardRuntime.evaluateDashboardCondition($0.visibleWhen, metrics: metrics)
        }
        if visibleSections.isEmpty {
            unsupportedBlock("dashboard report has no visible sections")
        } else {
            VStack(alignment: .leading, spacing: 14) {
                ForEach(visibleSections) { section in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(section.title ?? section.id ?? "Section")
                            .font(.body.weight(.semibold))
                        ForEach(Array(section.body.enumerated()), id: \.offset) { _, paragraph in
                            Text(DashboardRuntime.interpolateDashboardTemplate(paragraph, metrics: metrics))
                                .font(.subheadline)
                                .foregroundStyle(.primary)
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
    private func feedBlock(_ container: ContainerDef, metrics: [String: Any]) -> some View {
        let fields = container.dashboard?.feed?.fields ?? container.fields
        if container.items.isEmpty {
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
                            Text(DashboardRuntime.interpolateDashboardTemplate(body, metrics: metrics))
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

    private func detailBlock(_ container: ContainerDef) -> AnyView {
        if container.containers.isEmpty {
            return AnyView(unsupportedBlock("dashboard detail has no child blocks"))
        } else {
            return AnyView(VStack(alignment: .leading, spacing: 12) {
                ForEach(container.containers) { child in
                    dashboardBody(child)
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

    private var runtimeMetricsTaskKey: String {
        [
            window?.windowID ?? "",
            container.id ?? "",
            container.dataSourceRef ?? ""
        ].joined(separator: ":")
    }

    private func loadRuntimeMetrics() async {
        guard let runtime, let window, let dataSourceRef = container.dataSourceRef, !dataSourceRef.isEmpty else {
            runtimeMetrics = [:]
            return
        }
        let rawMetrics = await runtime.dataSourceMetrics(windowID: window.windowID, dataSourceRef: dataSourceRef)
        if !rawMetrics.isEmpty {
            runtimeMetrics = rawMetrics.mapValues { $0.anyValueValue as Any }
            return
        }
        let rows = await runtime.dataSourceCollection(windowID: window.windowID, dataSourceRef: dataSourceRef)
        if let first = rows.first {
            runtimeMetrics = first.mapValues { $0.anyValueValue as Any }
        } else {
            runtimeMetrics = [:]
        }
    }

    private func tone(for value: Double, config: DashboardToneDef?) -> String {
        guard let config else { return "neutral" }
        if let threshold = config.dangerAbove, value >= threshold { return "danger" }
        if let threshold = config.warningAbove, value >= threshold { return "warning" }
        if let threshold = config.successAbove, value >= threshold { return "success" }
        if let threshold = config.dangerBelow, value <= threshold { return "danger" }
        if let threshold = config.warningBelow, value <= threshold { return "warning" }
        if let threshold = config.successBelow, value <= threshold { return "success" }
        return "neutral"
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

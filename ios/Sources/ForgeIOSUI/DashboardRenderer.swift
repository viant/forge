import SwiftUI
import ForgeIOSRuntime

public struct DashboardRenderer: View {
    private let container: ContainerDef

    public init(container: ContainerDef) {
        self.container = container
    }

    public var body: some View {
        dashboardBody(container)
    }

    private func dashboardBody(_ container: ContainerDef) -> AnyView {
        let metrics = dashboardMetrics(container)
        if !DashboardRuntime.evaluateDashboardCondition(container.visibleWhen, metrics: metrics) {
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
                    .font(.title3.weight(.semibold))
            }
            if let subtitle = container.subtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .font(.subheadline)
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
        .padding(.horizontal, 12)
        .padding(.vertical, 8))
    }

    @ViewBuilder
    private func dashboardPanel<Content: View>(_ container: ContainerDef, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if !isBlank(container.title) || !isBlank(container.subtitle) {
                VStack(alignment: .leading, spacing: 4) {
                    if let title = container.title, !title.isEmpty {
                        Text(title)
                            .font(.headline)
                    }
                    if let subtitle = container.subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(.thinMaterial)
        )
    }

    @ViewBuilder
    private func summaryBlock(_ container: ContainerDef, metrics: [String: Any]) -> some View {
        let summaryMetrics = container.dashboard?.summary?.metrics ?? container.metrics
        if summaryMetrics.isEmpty {
            unsupportedBlock("dashboard summary has no metrics")
        } else {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(Array(summaryMetrics.enumerated()), id: \.offset) { _, metric in
                    let value = DashboardRuntime.resolveDashboardValue(
                        source: nil,
                        selector: metric.selector,
                        metrics: metrics
                    )
                    VStack(alignment: .leading, spacing: 6) {
                        Text(metric.label ?? metric.selector ?? "Metric")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.secondary)
                        Text(DashboardRuntime.formatDashboardValue(value, format: metric.format))
                            .font(.title3.weight(.semibold))
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
        let messages = container.dashboard?.messages?.items ?? []
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

    private func dashboardMetrics(_ container: ContainerDef) -> [String: Any] {
        var metrics: [String: Any] = [:]
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
        switch tone?.lowercased() {
        case "success":
            return .green
        case "warning":
            return .orange
        case "danger", "error":
            return .red
        case "info":
            return .blue
        default:
            return .secondary
        }
    }

    private func toneBackground(_ tone: String?) -> Color {
        toneColor(tone).opacity(0.12)
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
}

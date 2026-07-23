import Foundation

public struct DashboardSelectionState: Sendable, Equatable {
    public let dimension: String?
    public let entityKey: String?
    public let pointKey: String?
    public let selected: [String: JSONPrimitive]
    public let sourceBlockID: String?

    public init(
        dimension: String? = nil,
        entityKey: String? = nil,
        pointKey: String? = nil,
        selected: [String: JSONPrimitive] = [:],
        sourceBlockID: String? = nil
    ) {
        self.dimension = dimension
        self.entityKey = entityKey
        self.pointKey = pointKey
        self.selected = selected
        self.sourceBlockID = sourceBlockID
    }
}

public struct DashboardDimensionRow: Sendable, Equatable {
    public let entityKey: String?
    public let value: Double
    public let row: [String: JSONValue]

    public init(entityKey: String?, value: Double, row: [String: JSONValue]) {
        self.entityKey = entityKey
        self.value = value
        self.row = row
    }
}

public struct DashboardGeoMapRow: Sendable, Equatable, Identifiable {
    public let regionCode: String
    public let label: String
    public let value: Double
    public let tone: String?
    public let rank: Int?
    public let href: String?

    public init(
        regionCode: String,
        label: String,
        value: Double,
        tone: String? = nil,
        rank: Int? = nil,
        href: String? = nil
    ) {
        self.regionCode = regionCode
        self.label = label
        self.value = value
        self.tone = tone
        self.rank = rank
        self.href = href
    }

    public var id: String {
        regionCode
    }
}

public struct DashboardGeoStateTile: Sendable, Equatable, Identifiable {
    public let key: String
    public let label: String
    public let column: Int
    public let row: Int

    public init(key: String, label: String, column: Int, row: Int) {
        self.key = key
        self.label = label
        self.column = column
        self.row = row
    }

    public var id: String { key }
}

public struct DashboardGeoTileRegion: Sendable, Equatable, Identifiable {
    public let tile: DashboardGeoStateTile
    public let value: DashboardGeoMapRow?
    public let paletteIndex: Int?

    public init(tile: DashboardGeoStateTile, value: DashboardGeoMapRow?, paletteIndex: Int?) {
        self.tile = tile
        self.value = value
        self.paletteIndex = paletteIndex
    }

    public var id: String { tile.key }
}

public let dashboardUSStateTiles: [DashboardGeoStateTile] = [
    .init(key: "AK", label: "Alaska", column: 1, row: 1),
    .init(key: "ME", label: "Maine", column: 12, row: 1),
    .init(key: "VT", label: "Vermont", column: 10, row: 2),
    .init(key: "NH", label: "New Hampshire", column: 11, row: 2),
    .init(key: "MA", label: "Massachusetts", column: 12, row: 2),
    .init(key: "WA", label: "Washington", column: 1, row: 3),
    .init(key: "ID", label: "Idaho", column: 2, row: 3),
    .init(key: "MT", label: "Montana", column: 3, row: 3),
    .init(key: "ND", label: "North Dakota", column: 4, row: 3),
    .init(key: "MN", label: "Minnesota", column: 5, row: 3),
    .init(key: "IL", label: "Illinois", column: 6, row: 3),
    .init(key: "WI", label: "Wisconsin", column: 7, row: 3),
    .init(key: "MI", label: "Michigan", column: 8, row: 3),
    .init(key: "NY", label: "New York", column: 10, row: 3),
    .init(key: "RI", label: "Rhode Island", column: 11, row: 3),
    .init(key: "CT", label: "Connecticut", column: 12, row: 3),
    .init(key: "OR", label: "Oregon", column: 1, row: 4),
    .init(key: "NV", label: "Nevada", column: 2, row: 4),
    .init(key: "WY", label: "Wyoming", column: 3, row: 4),
    .init(key: "SD", label: "South Dakota", column: 4, row: 4),
    .init(key: "IA", label: "Iowa", column: 5, row: 4),
    .init(key: "IN", label: "Indiana", column: 6, row: 4),
    .init(key: "OH", label: "Ohio", column: 7, row: 4),
    .init(key: "PA", label: "Pennsylvania", column: 8, row: 4),
    .init(key: "NJ", label: "New Jersey", column: 10, row: 4),
    .init(key: "CA", label: "California", column: 1, row: 5),
    .init(key: "UT", label: "Utah", column: 2, row: 5),
    .init(key: "CO", label: "Colorado", column: 3, row: 5),
    .init(key: "NE", label: "Nebraska", column: 4, row: 5),
    .init(key: "MO", label: "Missouri", column: 5, row: 5),
    .init(key: "KY", label: "Kentucky", column: 6, row: 5),
    .init(key: "WV", label: "West Virginia", column: 7, row: 5),
    .init(key: "VA", label: "Virginia", column: 8, row: 5),
    .init(key: "MD", label: "Maryland", column: 9, row: 5),
    .init(key: "DE", label: "Delaware", column: 10, row: 5),
    .init(key: "AZ", label: "Arizona", column: 2, row: 6),
    .init(key: "NM", label: "New Mexico", column: 3, row: 6),
    .init(key: "KS", label: "Kansas", column: 4, row: 6),
    .init(key: "AR", label: "Arkansas", column: 5, row: 6),
    .init(key: "TN", label: "Tennessee", column: 6, row: 6),
    .init(key: "NC", label: "North Carolina", column: 7, row: 6),
    .init(key: "SC", label: "South Carolina", column: 8, row: 6),
    .init(key: "DC", label: "District of Columbia", column: 9, row: 6),
    .init(key: "HI", label: "Hawaii", column: 1, row: 7),
    .init(key: "OK", label: "Oklahoma", column: 4, row: 7),
    .init(key: "LA", label: "Louisiana", column: 5, row: 7),
    .init(key: "MS", label: "Mississippi", column: 6, row: 7),
    .init(key: "AL", label: "Alabama", column: 7, row: 7),
    .init(key: "GA", label: "Georgia", column: 8, row: 7),
    .init(key: "TX", label: "Texas", column: 4, row: 8),
    .init(key: "FL", label: "Florida", column: 9, row: 8)
]

public let dashboardDefaultGeoPalette = [
    "#d9f0ea",
    "#9fd8ce",
    "#55b9aa",
    "#187f78",
    "#0c4d52"
]

public func dashboardSupportsGeoShape(_ shape: String?) -> Bool {
    guard let normalized = shape?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() else {
        return false
    }
    return normalized == "us-states" || normalized == "us-state-tiles"
}

public func dashboardGeoPaletteIndex(
    value: Double,
    minimum: Double,
    maximum: Double,
    paletteSize: Int
) -> Int {
    guard paletteSize > 1, maximum > minimum else {
        return max(paletteSize - 1, 0)
    }
    let ratio = min(max((value - minimum) / (maximum - minimum), 0), 1)
    return min(max(Int(floor(ratio * Double(paletteSize))), 0), paletteSize - 1)
}

public func dashboardGeoTileRegions(
    rows: [DashboardGeoMapRow],
    paletteSize: Int = dashboardDefaultGeoPalette.count
) -> [DashboardGeoTileRegion] {
    let rowsByKey = Dictionary(
        rows.sorted { $0.value > $1.value }
            .map { ($0.regionCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(), $0) },
        uniquingKeysWith: { first, _ in first }
    )
    let values = rowsByKey.values.map(\.value).filter(\.isFinite)
    let minimum = values.min() ?? 0
    let maximum = values.max() ?? 0
    return dashboardUSStateTiles.map { tile in
        let value = rowsByKey[tile.key]
        return DashboardGeoTileRegion(
            tile: tile,
            value: value,
            paletteIndex: value.map {
                dashboardGeoPaletteIndex(
                    value: $0.value,
                    minimum: minimum,
                    maximum: maximum,
                    paletteSize: paletteSize
                )
            }
        )
    }
}

public struct DashboardSummaryResolvedCard: Sendable, Equatable {
    public let id: String?
    public let label: String
    public let displayValue: String
    public let tone: String?

    public init(id: String?, label: String, displayValue: String, tone: String?) {
        self.id = id
        self.label = label
        self.displayValue = displayValue
        self.tone = tone
    }
}

public struct DashboardReportRuntimeKPIValue: Sendable, Equatable {
    public let description: String?
    public let valueLabel: String
    public let valueText: String?
    public let secondaryLabel: String?
    public let secondaryValueText: String?
    public let emptyLabel: String
    public let rowCount: Int

    public init(
        description: String?,
        valueLabel: String,
        valueText: String?,
        secondaryLabel: String?,
        secondaryValueText: String?,
        emptyLabel: String,
        rowCount: Int
    ) {
        self.description = description
        self.valueLabel = valueLabel
        self.valueText = valueText
        self.secondaryLabel = secondaryLabel
        self.secondaryValueText = secondaryValueText
        self.emptyLabel = emptyLabel
        self.rowCount = rowCount
    }
}

public struct DashboardReportRuntimeFilterParamValue: Sendable, Equatable, Identifiable {
    public let id: String
    public let description: String?
    public let valueText: String

    public init(id: String, description: String?, valueText: String) {
        self.id = id
        self.description = description
        self.valueText = valueText
    }
}

public struct DashboardReportRuntimeFilterBarValue: Sendable, Equatable {
    public let title: String
    public let params: [DashboardReportRuntimeFilterParamValue]

    public init(title: String, params: [DashboardReportRuntimeFilterParamValue]) {
        self.title = title
        self.params = params
    }
}

public struct DashboardReportRuntimeRefinementValue: Sendable, Equatable, Identifiable {
    public let id: String
    public let label: String

    public init(id: String, label: String) {
        self.id = id
        self.label = label
    }
}

public struct DashboardReportRuntimeRefinementBarValue: Sendable, Equatable {
    public let title: String?
    public let emptyLabel: String
    public let refinements: [DashboardReportRuntimeRefinementValue]

    public init(title: String?, emptyLabel: String, refinements: [DashboardReportRuntimeRefinementValue]) {
        self.title = title
        self.emptyLabel = emptyLabel
        self.refinements = refinements
    }
}

public struct DashboardReportRuntimeDiagnostic: Sendable, Equatable, Identifiable {
    public let id: String
    public let severity: String
    public let code: String?
    public let blockID: String?
    public let path: String?
    public let message: String
    public let suggestedFix: String?

    public init(
        id: String,
        severity: String,
        code: String?,
        blockID: String?,
        path: String?,
        message: String,
        suggestedFix: String?
    ) {
        self.id = id
        self.severity = severity
        self.code = code
        self.blockID = blockID
        self.path = path
        self.message = message
        self.suggestedFix = suggestedFix
    }

    public var isError: Bool {
        severity.caseInsensitiveCompare("error") == .orderedSame
    }
}

public struct DashboardReportRuntimeActionField: Sendable, Equatable, Identifiable {
    public let id: String
    public let kind: String?
    public let valueKey: String
    public let displayValueKey: String
    public let label: String
    public let selectionSource: String?
    public let runtimeFilterable: Bool

    public init(
        id: String,
        kind: String? = nil,
        valueKey: String,
        displayValueKey: String,
        label: String,
        selectionSource: String? = nil,
        runtimeFilterable: Bool
    ) {
        self.id = id
        self.kind = kind
        self.valueKey = valueKey
        self.displayValueKey = displayValueKey
        self.label = label
        self.selectionSource = selectionSource
        self.runtimeFilterable = runtimeFilterable
    }
}

public struct DashboardReportRuntimeActionDescriptor: Sendable, Equatable, Identifiable {
    public let id: String
    public let kind: String
    public let fieldValueKey: String
    public let label: String
    public let nextFieldRef: String?
    public let targetRef: String?
    public let selectionDimension: String?

    public init(
        id: String,
        kind: String,
        fieldValueKey: String,
        label: String,
        nextFieldRef: String? = nil,
        targetRef: String? = nil,
        selectionDimension: String? = nil
    ) {
        self.id = id
        self.kind = kind
        self.fieldValueKey = fieldValueKey
        self.label = label
        self.nextFieldRef = nextFieldRef
        self.targetRef = targetRef
        self.selectionDimension = selectionDimension
    }
}

public struct DashboardReportRuntimeActionRefinement: Sendable, Equatable {
    public let op: String
    public let field: String
    public let value: JSONValue
    public let sourceBlockID: String?
    public let fieldLabel: String?
    public let label: String

    public init(
        op: String,
        field: String,
        value: JSONValue,
        sourceBlockID: String?,
        fieldLabel: String?,
        label: String
    ) {
        self.op = op
        self.field = field
        self.value = value
        self.sourceBlockID = sourceBlockID
        self.fieldLabel = fieldLabel
        self.label = label
    }
}

public struct DashboardReportRuntimeActionTransition: Sendable, Equatable {
    public let sourceField: String
    public let nextFieldRef: String
    public let sourceBlockID: String?

    public init(sourceField: String, nextFieldRef: String, sourceBlockID: String?) {
        self.sourceField = sourceField
        self.nextFieldRef = nextFieldRef
        self.sourceBlockID = sourceBlockID
    }
}

public struct DashboardReportRuntimeDetailAction: Sendable, Equatable {
    public let id: String
    public let kind: String
    public let label: String
    public let targetRef: String

    public init(id: String, kind: String, label: String, targetRef: String) {
        self.id = id
        self.kind = kind
        self.label = label
        self.targetRef = targetRef
    }
}

public struct DashboardReportRuntimeDetailRequest: Sendable, Equatable {
    public let action: DashboardReportRuntimeDetailAction
    public let item: [String: JSONValue]
    public let value: JSONValue
    public let field: DashboardReportRuntimeActionField
    public let sourceBlockID: String?

    public init(
        action: DashboardReportRuntimeDetailAction,
        item: [String: JSONValue],
        value: JSONValue,
        field: DashboardReportRuntimeActionField,
        sourceBlockID: String?
    ) {
        self.action = action
        self.item = item
        self.value = value
        self.field = field
        self.sourceBlockID = sourceBlockID
    }
}

public struct DashboardReportRuntimeActionExecution: Sendable, Equatable, Identifiable {
    public let id: String
    public let label: String
    public let kind: String
    public let refinement: DashboardReportRuntimeActionRefinement?
    public let transition: DashboardReportRuntimeActionTransition?
    public let detailRequest: DashboardReportRuntimeDetailRequest?
    public let selection: DashboardSelectionState?

    public init(
        id: String,
        label: String,
        kind: String,
        refinement: DashboardReportRuntimeActionRefinement? = nil,
        transition: DashboardReportRuntimeActionTransition? = nil,
        detailRequest: DashboardReportRuntimeDetailRequest? = nil,
        selection: DashboardSelectionState? = nil
    ) {
        self.id = id
        self.label = label
        self.kind = kind
        self.refinement = refinement
        self.transition = transition
        self.detailRequest = detailRequest
        self.selection = selection
    }
}

public struct DashboardReportRuntimeChartSelection: Sendable, Equatable {
    public let xValue: JSONValue?
    public let seriesKey: JSONValue?
    public let row: [String: JSONValue]
    public let selectionRows: [[String: JSONValue]]

    public init(
        xValue: JSONValue? = nil,
        seriesKey: JSONValue? = nil,
        row: [String: JSONValue] = [:],
        selectionRows: [[String: JSONValue]] = []
    ) {
        self.xValue = xValue
        self.seriesKey = seriesKey
        self.row = row
        self.selectionRows = selectionRows
    }
}

public struct DashboardReportRuntimeTableValue: Sendable, Equatable {
    public let dataSourceRef: String?
    public let columns: [ColumnDef]
    public let rows: [[String: JSONValue]]
    public let limit: Int
    public let actionFields: [DashboardReportRuntimeActionField]
    public let actionDescriptors: [DashboardReportRuntimeActionDescriptor]

    public init(
        dataSourceRef: String?,
        columns: [ColumnDef],
        rows: [[String: JSONValue]],
        limit: Int,
        actionFields: [DashboardReportRuntimeActionField] = [],
        actionDescriptors: [DashboardReportRuntimeActionDescriptor] = []
    ) {
        self.dataSourceRef = dataSourceRef
        self.columns = columns
        self.rows = rows
        self.limit = limit
        self.actionFields = actionFields
        self.actionDescriptors = actionDescriptors
    }

    public static func == (lhs: DashboardReportRuntimeTableValue, rhs: DashboardReportRuntimeTableValue) -> Bool {
        lhs.dataSourceRef == rhs.dataSourceRef
            && lhs.columns.map(DashboardReportRuntimeTableValue.columnSignature)
                == rhs.columns.map(DashboardReportRuntimeTableValue.columnSignature)
            && lhs.rows == rhs.rows
            && lhs.limit == rhs.limit
            && lhs.actionFields == rhs.actionFields
            && lhs.actionDescriptors == rhs.actionDescriptors
    }

    private static func columnSignature(_ column: ColumnDef) -> [String?] {
        [
            column.id,
            column.name,
            column.key,
            column.label,
            column.type,
            column.format,
            column.emptyText
        ]
    }
}

public struct DashboardReportRuntimeChartValue: Sendable, Equatable {
    public let dataSourceRef: String?
    public let chart: ChartDef
    public let rows: [[String: JSONValue]]
    public let actionFields: [DashboardReportRuntimeActionField]
    public let actionDescriptors: [DashboardReportRuntimeActionDescriptor]

    public init(
        dataSourceRef: String?,
        chart: ChartDef,
        rows: [[String: JSONValue]],
        actionFields: [DashboardReportRuntimeActionField] = [],
        actionDescriptors: [DashboardReportRuntimeActionDescriptor] = []
    ) {
        self.dataSourceRef = dataSourceRef
        self.chart = chart
        self.rows = rows
        self.actionFields = actionFields
        self.actionDescriptors = actionDescriptors
    }

    public static func == (lhs: DashboardReportRuntimeChartValue, rhs: DashboardReportRuntimeChartValue) -> Bool {
        lhs.dataSourceRef == rhs.dataSourceRef
            && chartSignature(lhs.chart) == chartSignature(rhs.chart)
            && lhs.rows == rhs.rows
            && lhs.actionFields == rhs.actionFields
            && lhs.actionDescriptors == rhs.actionDescriptors
    }

    private static func chartSignature(_ chart: ChartDef) -> [String] {
        [
            chart.kind ?? "",
            chart.title ?? "",
            chart.type ?? "",
            chart.dataSourceRef ?? "",
            chart.xKey ?? "",
            chart.valueKey ?? "",
            chart.nameKey ?? "",
            chart.series.joined(separator: "|")
        ]
    }
}

public struct DashboardReportRuntimeGeoMapValue: Sendable, Equatable {
    public let dataSourceRef: String?
    public let shape: String
    public let metricLabel: String
    public let metricFormat: String?
    public let rows: [DashboardGeoMapRow]

    public init(
        dataSourceRef: String?,
        shape: String,
        metricLabel: String,
        metricFormat: String?,
        rows: [DashboardGeoMapRow]
    ) {
        self.dataSourceRef = dataSourceRef
        self.shape = shape
        self.metricLabel = metricLabel
        self.metricFormat = metricFormat
        self.rows = rows
    }
}

public struct DashboardReportRuntimeBlockSummary: Sendable, Equatable, Identifiable {
    public let id: String
    public let kind: String
    public let title: String
    public let diagnostics: [DashboardReportRuntimeDiagnostic]
    public let content: [String: JSONValue]
    public let runtime: [String: JSONValue]
    public let markdown: String?
    public let kpi: DashboardReportRuntimeKPIValue?
    public let filterBar: DashboardReportRuntimeFilterBarValue?
    public let refinementBar: DashboardReportRuntimeRefinementBarValue?
    public let table: DashboardReportRuntimeTableValue?
    public let chart: DashboardReportRuntimeChartValue?
    public let geoMap: DashboardReportRuntimeGeoMapValue?

    public init(
        id: String,
        kind: String,
        title: String,
        diagnostics: [DashboardReportRuntimeDiagnostic] = [],
        content: [String: JSONValue] = [:],
        runtime: [String: JSONValue] = [:],
        markdown: String? = nil,
        kpi: DashboardReportRuntimeKPIValue? = nil,
        filterBar: DashboardReportRuntimeFilterBarValue? = nil,
        refinementBar: DashboardReportRuntimeRefinementBarValue? = nil,
        table: DashboardReportRuntimeTableValue? = nil,
        chart: DashboardReportRuntimeChartValue? = nil,
        geoMap: DashboardReportRuntimeGeoMapValue? = nil
    ) {
        self.id = id
        self.kind = kind
        self.title = title
        self.diagnostics = diagnostics
        self.content = content
        self.runtime = runtime
        self.markdown = markdown
        self.kpi = kpi
        self.filterBar = filterBar
        self.refinementBar = refinementBar
        self.table = table
        self.chart = chart
        self.geoMap = geoMap
    }
}

public struct DashboardReportRuntimeSummary: Sendable, Equatable {
    public let title: String?
    public let subtitle: String?
    public let blockCount: Int
    public let blocks: [DashboardReportRuntimeBlockSummary]
    public let diagnostics: [DashboardReportRuntimeDiagnostic]

    public init(
        title: String?,
        subtitle: String?,
        blockCount: Int,
        blocks: [DashboardReportRuntimeBlockSummary] = [],
        diagnostics: [DashboardReportRuntimeDiagnostic] = []
    ) {
        self.title = title
        self.subtitle = subtitle
        self.blockCount = blockCount
        self.blocks = blocks
        self.diagnostics = diagnostics
    }
}

public enum DashboardRuntime {
    public static func dashboardKey(window: WindowContext, container: ContainerDef) -> String {
        if let key = container.dashboard?.key?.trimmingCharacters(in: .whitespacesAndNewlines), !key.isEmpty {
            return key
        }
        let containerID: String
        if let id = container.id?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty {
            containerID = id
        } else {
            containerID = "dashboard"
        }
        return "\(window.windowID):\(containerID)"
    }

    public static func dashboardFilterKey(_ item: DashboardFilterItemDef) -> String? {
        if let field = item.field?.trimmingCharacters(in: .whitespacesAndNewlines), !field.isEmpty {
            return field
        }
        if let id = item.id?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty {
            return id
        }
        return nil
    }

    public static func dashboardSummaryMetrics(_ container: ContainerDef) -> [DashboardMetricDef] {
        if let items = container.dashboard?.summary?.items, !items.isEmpty {
            return items
        }
        if !container.items.isEmpty {
            return container.items.map(dashboardSummaryMetric)
        }
        if let metrics = container.dashboard?.summary?.metrics, !metrics.isEmpty {
            return metrics
        }
        return container.metrics
    }

    public static func resolvedDashboardSummaryCards(
        _ container: ContainerDef,
        metrics: [String: Any],
        source: [String: Any]? = nil
    ) -> [DashboardSummaryResolvedCard] {
        dashboardSummaryMetrics(container).enumerated().compactMap { _, metric in
            let value = dashboardSummaryValue(metric, metrics: metrics, source: source)
            let displayValue = formatDashboardValue(value, format: metric.format)
            guard isMeaningfulDashboardSummaryDisplay(displayValue) else {
                return nil
            }
            return DashboardSummaryResolvedCard(
                id: metric.id ?? metric.resolvedSelector,
                label: metric.label ?? metric.resolvedSelector ?? "Metric",
                displayValue: displayValue,
                tone: metric.tone
            )
        }
    }

    public static func dashboardReportRuntimeConfig(_ container: ContainerDef) -> JSONValue? {
        if let direct = container.reportRuntime?.objectValue, !direct.isEmpty {
            return .object(direct)
        }
        if let nested = container.dashboard?.reportRuntime?.objectValue, !nested.isEmpty {
            return .object(nested)
        }
        return nil
    }

    public static func dashboardReportRuntimeSummary(_ container: ContainerDef) -> DashboardReportRuntimeSummary {
        let config = dashboardReportRuntimeConfig(container)?.objectValue ?? [:]
        let reportSpec = config["reportSpec"]?.objectValue ?? [:]
        let reportFill = config["reportFill"]?.objectValue ?? [:]
        let title = nonBlank(config["title"]?.stringValue)
            ?? nonBlank(reportSpec["title"]?.stringValue)
            ?? nonBlank(container.title)
        let subtitle = nonBlank(config["subtitle"]?.stringValue)
            ?? nonBlank(reportSpec["subtitle"]?.stringValue)
            ?? nonBlank(container.subtitle)
        let blockOrder = reportSpec["layoutIntent"]?.objectValue?["blockOrder"]?.arrayValue?
            .compactMap { nonBlank($0.stringValue) }
            ?? []
        let datasets = dashboardReportRuntimeDatasets(reportFill["datasets"]?.arrayValue ?? [])
        let datasetDiagnostics = dashboardReportRuntimeDatasetDiagnostics(datasets)
        let diagnostics = dashboardReportRuntimeDiagnostics(reportFill["diagnostics"]?.arrayValue ?? [])
        let pageSize = dashboardReportRuntimeInt(reportSpec["parameters"]?.objectValue?["pageSize"]) ?? 50
        let blocks = dashboardReportRuntimeBlocks(
            reportFill["blocks"]?.arrayValue ?? reportSpec["blocks"]?.arrayValue ?? [],
            reportSpec: reportSpec,
            blockOrder: blockOrder,
            datasets: datasets,
            pageSize: pageSize,
            diagnostics: diagnostics,
            datasetDiagnostics: datasetDiagnostics
        )
        return DashboardReportRuntimeSummary(
            title: title,
            subtitle: subtitle,
            blockCount: blocks.count,
            blocks: blocks,
            diagnostics: diagnostics
        )
    }

    public static func dashboardReportRuntimeBlocks(
        _ values: [JSONValue],
        reportSpec: [String: JSONValue] = [:],
        blockOrder: [String] = [],
        datasets: [String: [String: JSONValue]] = [:],
        pageSize: Int = 50,
        diagnostics: [DashboardReportRuntimeDiagnostic] = [],
        datasetDiagnostics: [String: [DashboardReportRuntimeDiagnostic]] = [:]
    ) -> [DashboardReportRuntimeBlockSummary] {
        let blocks: [DashboardReportRuntimeBlockSummary] = values.enumerated().compactMap { index, value in
            guard let block = value.objectValue else { return nil }
            let defaultID = "block-\(index + 1)"
            let id = nonBlank(block["id"]?.stringValue)
                ?? nonBlank(block["key"]?.stringValue)
                ?? defaultID
            let kind = nonBlank(block["kind"]?.stringValue)
                ?? nonBlank(block["type"]?.stringValue)
                ?? "block"
            let title = nonBlank(block["title"]?.stringValue)
                ?? nonBlank(block["label"]?.stringValue)
                ?? nonBlank(block["content"]?.objectValue?["title"]?.stringValue)
                ?? id
            let content = block["content"]?.objectValue ?? [:]
            let markdown = kind == "markdownBlock"
                ? nonBlank(content["markdown"]?.stringValue) ?? nonBlank(block["markdown"]?.stringValue)
                : nil
            let kpi = kind == "kpiBlock" ? dashboardReportRuntimeKPI(content: content) : nil
            let filterBar = kind == "filterBarBlock" ? dashboardReportRuntimeFilterBar(block: block, content: content, reportSpec: reportSpec) : nil
            let refinementBar = kind == "refinementBarBlock" ? dashboardReportRuntimeRefinementBar(block: block, content: content, reportSpec: reportSpec) : nil
            let table = kind == "tableBlock"
                ? dashboardReportRuntimeTable(block: block, content: content, reportSpec: reportSpec, datasets: datasets, pageSize: pageSize)
                : nil
            let chart = kind == "chartBlock"
                ? dashboardReportRuntimeChart(block: block, content: content, reportSpec: reportSpec, datasets: datasets)
                : nil
            let geoMap = kind == "geoMapBlock"
                ? dashboardReportRuntimeGeoMap(block: block, content: content, datasets: datasets)
                : nil
            let datasetRef = nonBlank(block["datasetRef"]?.stringValue)
            let blockDiagnostics = diagnostics.filter { $0.blockID == id }
                + (datasetRef.flatMap { datasetDiagnostics[$0] } ?? [])
            let presentationKinds: Set<String> = [
                "badgesBlock", "collectionBlock", "sectionBlock", "tabGroupBlock", "compositeBlock",
                "stepperBlock", "infoPanelBlock", "calloutBlock", "kanbanBlock", "timelineBlock"
            ]
            return DashboardReportRuntimeBlockSummary(
                id: id,
                kind: kind,
                title: title,
                diagnostics: blockDiagnostics,
                content: presentationKinds.contains(kind) ? content : [:],
                runtime: block["runtime"]?.objectValue ?? [:],
                markdown: markdown,
                kpi: kpi,
                filterBar: filterBar,
                refinementBar: refinementBar,
                table: table,
                chart: chart,
                geoMap: geoMap
            )
        }
        guard !blockOrder.isEmpty else { return blocks }
        let blockByID: [String: DashboardReportRuntimeBlockSummary] = Dictionary(
            uniqueKeysWithValues: blocks.map { ($0.id, $0) }
        )
        var seen = Set<String>()
        var ordered: [DashboardReportRuntimeBlockSummary] = []
        for id in blockOrder {
            guard let block = blockByID[id], !seen.contains(id) else { continue }
            seen.insert(id)
            ordered.append(block)
        }
        ordered.append(contentsOf: blocks.filter { !seen.contains($0.id) })
        return ordered
    }

    public static func dashboardReportRuntimeBlockVisible(
        _ block: DashboardReportRuntimeBlockSummary,
        metrics: [String: Any] = [:],
        filters: [String: Any] = [:],
        selection: DashboardSelectionState = DashboardSelectionState()
    ) -> Bool {
        guard let conditionValue = block.runtime["visibleWhen"],
              let data = try? JSONEncoder().encode(conditionValue),
              var condition = try? JSONDecoder().decode(DashboardConditionDef.self, from: data) else {
            return true
        }
        if let selector = condition.selector?.trimmingCharacters(in: .whitespacesAndNewlines) {
            if selector.hasPrefix("dashboard.selection.") {
                condition = DashboardConditionDef(
                    source: "selection",
                    dataSourceRef: condition.dataSourceRef,
                    field: String(selector.dropFirst("dashboard.selection.".count)),
                    key: condition.key,
                    whenValue: condition.whenValue,
                    equals: condition.equals,
                    notEquals: condition.notEquals,
                    inValues: condition.inValues,
                    gt: condition.gt,
                    gte: condition.gte,
                    lt: condition.lt,
                    lte: condition.lte,
                    empty: condition.empty,
                    notEmpty: condition.notEmpty
                )
            } else if selector.hasPrefix("filters.") {
                condition = DashboardConditionDef(
                    source: "filters",
                    dataSourceRef: condition.dataSourceRef,
                    field: String(selector.dropFirst("filters.".count)),
                    key: condition.key,
                    whenValue: condition.whenValue,
                    equals: condition.equals,
                    notEquals: condition.notEquals,
                    inValues: condition.inValues,
                    gt: condition.gt,
                    gte: condition.gte,
                    lt: condition.lt,
                    lte: condition.lte,
                    empty: condition.empty,
                    notEmpty: condition.notEmpty
                )
            }
        }
        return evaluateDashboardCondition(condition, metrics: metrics, filters: filters, selection: selection)
    }

    public static func dashboardReportRuntimeDatasets(_ values: [JSONValue]) -> [String: [String: JSONValue]] {
        Dictionary(uniqueKeysWithValues: values.compactMap { value in
            guard let dataset = value.objectValue,
                  let id = nonBlank(dataset["id"]?.stringValue) else {
                return nil
            }
            return (id, dataset)
        })
    }

    public static func dashboardReportRuntimeDatasetDiagnostics(
        _ datasets: [String: [String: JSONValue]]
    ) -> [String: [DashboardReportRuntimeDiagnostic]] {
        datasets.reduce(into: [:]) { result, entry in
            let diagnostics = dashboardReportRuntimeDiagnostics(
                entry.value["provenance"]?.objectValue?["diagnostics"]?.arrayValue ?? []
            ).map { diagnostic in
                DashboardReportRuntimeDiagnostic(
                    id: "dataset:\(entry.key):\(diagnostic.id)",
                    severity: diagnostic.severity,
                    code: diagnostic.code,
                    blockID: diagnostic.blockID,
                    path: diagnostic.path,
                    message: diagnostic.message,
                    suggestedFix: diagnostic.suggestedFix
                )
            }
            if !diagnostics.isEmpty {
                result[entry.key] = diagnostics
            }
        }
    }

    public static func dashboardReportRuntimeTable(
        block: [String: JSONValue],
        content: [String: JSONValue],
        reportSpec: [String: JSONValue],
        datasets: [String: [String: JSONValue]],
        pageSize: Int
    ) -> DashboardReportRuntimeTableValue {
        let datasetRef = nonBlank(block["datasetRef"]?.stringValue)
        let dataset = datasetRef.flatMap { datasets[$0] } ?? [:]
        let rows = (dataset["rows"]?.arrayValue ?? [])
            .compactMap { $0.objectValue }
        let columns = dashboardReportRuntimeColumns(
            content["columns"]?.arrayValue ?? block["columns"]?.arrayValue ?? []
        )
        let actionFields = dashboardReportRuntimeTableActionFields(reportSpec: reportSpec, block: block, content: content)
        let actionDescriptors = actionFields.flatMap {
            dashboardReportRuntimeActionDescriptors(reportSpec: reportSpec, blockID: nonBlank(block["id"]?.stringValue), field: $0, includeBlockIDInGeneratedID: false)
        } + dashboardReportRuntimeAuthoredSelectionDescriptors(block: block, fields: actionFields)
        let rowCount = dashboardReportRuntimeInt(dataset["provenance"]?.objectValue?["rowCount"])
        let limit = max(1, rowCount ?? pageSize)
        return DashboardReportRuntimeTableValue(
            dataSourceRef: nonBlank(dataset["dataSourceRef"]?.stringValue) ?? datasetRef,
            columns: columns,
            rows: Array(rows.prefix(limit)),
            limit: limit,
            actionFields: actionFields,
            actionDescriptors: actionDescriptors
        )
    }

    public static func dashboardReportRuntimeDiagnostics(_ values: [JSONValue]) -> [DashboardReportRuntimeDiagnostic] {
        values.enumerated().compactMap { index, value in
            guard let object = value.objectValue else {
                return nil
            }
            let message = nonBlank(object["message"]?.stringValue)
                ?? nonBlank(object["detail"]?.stringValue)
                ?? nonBlank(object["description"]?.stringValue)
                ?? "Runtime diagnostic"
            let code = nonBlank(object["code"]?.stringValue)
            let path = nonBlank(object["path"]?.stringValue)
            let blockID = nonBlank(object["blockId"]?.stringValue)
                ?? nonBlank(object["blockID"]?.stringValue)
            let id = [
                code,
                blockID,
                path,
                String(index + 1)
            ].compactMap { $0 }.joined(separator: ":")
            return DashboardReportRuntimeDiagnostic(
                id: id,
                severity: nonBlank(object["severity"]?.stringValue) ?? "info",
                code: code,
                blockID: blockID,
                path: path,
                message: message,
                suggestedFix: nonBlank(object["suggestedFix"]?.stringValue)
            )
        }
    }

    public static func dashboardReportRuntimeFilterBar(
        block: [String: JSONValue],
        content: [String: JSONValue],
        reportSpec: [String: JSONValue] = [:]
    ) -> DashboardReportRuntimeFilterBarValue {
        let title = nonBlank(content["title"]?.stringValue)
            ?? nonBlank(block["title"]?.stringValue)
            ?? "Report Scope"
        let paramValues = dashboardReportRuntimeFilterParamValues(block: block, content: content, reportSpec: reportSpec)
        let params = paramValues.compactMap { value -> DashboardReportRuntimeFilterParamValue? in
            guard let object = value.objectValue,
                  let id = nonBlank(object["id"]?.stringValue) else {
                return nil
            }
            return DashboardReportRuntimeFilterParamValue(
                id: id,
                description: nonBlank(object["description"]?.stringValue),
                valueText: dashboardReportRuntimeScopeValueText(object["value"])
            )
        }
        return DashboardReportRuntimeFilterBarValue(title: title, params: params)
    }

    public static func dashboardReportRuntimeRefinementBar(
        block: [String: JSONValue] = [:],
        content: [String: JSONValue],
        reportSpec: [String: JSONValue] = [:]
    ) -> DashboardReportRuntimeRefinementBarValue {
        let refinementValues = content.keys.contains("refinements")
            ? content["refinements"]?.arrayValue ?? []
            : reportSpec["refinements"]?.arrayValue ?? []
        let refinements = refinementValues.enumerated().compactMap { index, value -> DashboardReportRuntimeRefinementValue? in
            guard let object = value.objectValue else {
                return nil
            }
            let label = dashboardReportRuntimeRefinementLabel(object)
            return DashboardReportRuntimeRefinementValue(
                id: nonBlank(object["id"]?.stringValue) ?? "refinement-\(index + 1)",
                label: label
            )
        }
        return DashboardReportRuntimeRefinementBarValue(
            title: nonBlank(content["title"]?.stringValue) ?? nonBlank(block["title"]?.stringValue),
            emptyLabel: nonBlank(content["emptyLabel"]?.stringValue) ?? nonBlank(block["emptyLabel"]?.stringValue) ?? "No active refinements",
            refinements: refinements
        )
    }

    private static func dashboardReportRuntimeFilterParamValues(
        block: [String: JSONValue],
        content: [String: JSONValue],
        reportSpec: [String: JSONValue]
    ) -> [JSONValue] {
        if let params = content["params"]?.arrayValue {
            return params
        }
        let scopeParams = reportSpec["scope"]?.objectValue?["params"]?.arrayValue ?? []
        let paramIds = Set((block["paramIds"]?.arrayValue ?? []).compactMap { nonBlank($0.stringValue) })
        guard !paramIds.isEmpty else {
            return scopeParams
        }
        return scopeParams.filter { value in
            guard let id = nonBlank(value.objectValue?["id"]?.stringValue) else {
                return false
            }
            return paramIds.contains(id)
        }
    }

    public static func dashboardReportRuntimeChart(
        block: [String: JSONValue],
        content: [String: JSONValue],
        reportSpec: [String: JSONValue],
        datasets: [String: [String: JSONValue]]
    ) -> DashboardReportRuntimeChartValue? {
        let chartValue = content["chartModel"] ?? block["chartModel"]
        guard let chartValue,
              let chartData = try? JSONEncoder().encode(chartValue),
              let chart = try? JSONDecoder().decode(ChartDef.self, from: chartData) else {
            return nil
        }
        let datasetRef = nonBlank(block["datasetRef"]?.stringValue)
        let dataset = datasetRef.flatMap { datasets[$0] } ?? [:]
        let rows = (dataset["rows"]?.arrayValue ?? [])
            .compactMap { $0.objectValue }
        let actionFields = dashboardReportRuntimeChartActionFields(reportSpec: reportSpec, block: block, content: content)
        let actionDescriptors = actionFields.flatMap {
            dashboardReportRuntimeActionDescriptors(reportSpec: reportSpec, blockID: nonBlank(block["id"]?.stringValue), field: $0, includeBlockIDInGeneratedID: true)
        } + dashboardReportRuntimeAuthoredSelectionDescriptors(block: block, fields: actionFields)
        return DashboardReportRuntimeChartValue(
            dataSourceRef: nonBlank(dataset["dataSourceRef"]?.stringValue) ?? datasetRef,
            chart: chart,
            rows: rows,
            actionFields: actionFields,
            actionDescriptors: actionDescriptors
        )
    }

    public static func dashboardReportRuntimeGeoMap(
        block: [String: JSONValue],
        content: [String: JSONValue],
        datasets: [String: [String: JSONValue]]
    ) -> DashboardReportRuntimeGeoMapValue {
        let geo = content["geo"]?.objectValue ?? block["geo"]?.objectValue ?? [:]
        let metric = geo["metric"]?.objectValue ?? [:]
        let datasetRef = nonBlank(block["datasetRef"]?.stringValue)
        let dataset = datasetRef.flatMap { datasets[$0] } ?? [:]
        let rows = (dataset["rows"]?.arrayValue ?? [])
            .compactMap { $0.objectValue }
        let metricKey = nonBlank(metric["key"]?.stringValue)
        let ranked = rankedDashboardGeoMapRows(
            rows,
            metricKey: metricKey,
            limit: .max,
            regionKey: nonBlank(geo["key"]?.stringValue),
            labelKey: nonBlank(geo["labelKey"]?.stringValue)
        )
        return DashboardReportRuntimeGeoMapValue(
            dataSourceRef: nonBlank(dataset["dataSourceRef"]?.stringValue) ?? datasetRef,
            shape: nonBlank(geo["shape"]?.stringValue) ?? "us-states",
            metricLabel: nonBlank(metric["label"]?.stringValue) ?? metricKey ?? "Metric",
            metricFormat: nonBlank(metric["format"]?.stringValue),
            rows: ranked
        )
    }

    public static func dashboardReportRuntimeTableActionFields(
        reportSpec: [String: JSONValue],
        block: [String: JSONValue],
        content: [String: JSONValue]
    ) -> [DashboardReportRuntimeActionField] {
        let datasetRef = nonBlank(block["datasetRef"]?.stringValue)
        let requestedDimensions = dashboardReportRuntimeDatasetDimensions(reportSpec: reportSpec, datasetRef: datasetRef)
        let columnValues = content["columns"]?.arrayValue ?? block["columns"]?.arrayValue ?? []
        return columnValues.compactMap { value in
            guard let column = value.objectValue else { return nil }
            let valueKey = nonBlank(column["sourceKey"]?.stringValue)
                ?? nonBlank(column["displayKey"]?.stringValue)
                ?? nonBlank(column["key"]?.stringValue)
            guard let valueKey = valueKey else { return nil }
            if !requestedDimensions.isEmpty && !requestedDimensions.contains(valueKey) {
                return nil
            }
            let displayValueKey = nonBlank(column["displayKey"]?.stringValue)
                ?? nonBlank(column["key"]?.stringValue)
                ?? valueKey
            return DashboardReportRuntimeActionField(
                id: nonBlank(column["key"]?.stringValue) ?? valueKey,
                valueKey: valueKey,
                displayValueKey: displayValueKey,
                label: nonBlank(column["label"]?.stringValue) ?? valueKey,
                runtimeFilterable: column["runtimeFilterable"]?.boolValue == true
            )
        }
    }

    public static func dashboardReportRuntimeChartActionFields(
        reportSpec: [String: JSONValue],
        block: [String: JSONValue],
        content: [String: JSONValue]
    ) -> [DashboardReportRuntimeActionField] {
        let chartSpec = content["chartSpec"]?.objectValue ?? block["chartSpec"]?.objectValue ?? [:]
        let datasetRef = nonBlank(block["datasetRef"]?.stringValue)
        let xField = nonBlank(chartSpec["xField"]?.stringValue)
        let seriesField = nonBlank(chartSpec["seriesField"]?.stringValue)
        return [
            xField.flatMap { field in
                let column = dashboardReportRuntimeFieldColumn(reportSpec: reportSpec, datasetRef: datasetRef, fieldKey: field)
                return DashboardReportRuntimeActionField(
                    id: field,
                    kind: "xField",
                    valueKey: field,
                    displayValueKey: nonBlank(column?["displayKey"]?.stringValue)
                        ?? nonBlank(column?["key"]?.stringValue)
                        ?? field,
                    label: nonBlank(column?["label"]?.stringValue) ?? field,
                    selectionSource: "xValue",
                    runtimeFilterable: column?["runtimeFilterable"]?.boolValue == true
                )
            },
            seriesField.flatMap { field in
                let column = dashboardReportRuntimeFieldColumn(reportSpec: reportSpec, datasetRef: datasetRef, fieldKey: field)
                return DashboardReportRuntimeActionField(
                    id: field,
                    kind: "seriesField",
                    valueKey: field,
                    displayValueKey: nonBlank(column?["displayKey"]?.stringValue)
                        ?? nonBlank(column?["key"]?.stringValue)
                        ?? field,
                    label: nonBlank(column?["label"]?.stringValue) ?? field,
                    selectionSource: "seriesKey",
                    runtimeFilterable: column?["runtimeFilterable"]?.boolValue == true
                )
            }
        ].compactMap { $0 }
    }

    public static func dashboardReportRuntimeActionDescriptors(
        reportSpec: [String: JSONValue],
        blockID: String?,
        field: DashboardReportRuntimeActionField,
        includeBlockIDInGeneratedID: Bool
    ) -> [DashboardReportRuntimeActionDescriptor] {
        var descriptors: [DashboardReportRuntimeActionDescriptor] = []
        if field.runtimeFilterable {
            descriptors.append(DashboardReportRuntimeActionDescriptor(
                id: dashboardReportRuntimeGeneratedActionID(kind: "keep", blockID: blockID, fieldValueKey: field.valueKey, includeBlockID: includeBlockIDInGeneratedID),
                kind: "keep",
                fieldValueKey: field.valueKey,
                label: "Keep \(field.label)"
            ))
            descriptors.append(DashboardReportRuntimeActionDescriptor(
                id: dashboardReportRuntimeGeneratedActionID(kind: "exclude", blockID: blockID, fieldValueKey: field.valueKey, includeBlockID: includeBlockIDInGeneratedID),
                kind: "exclude",
                fieldValueKey: field.valueKey,
                label: "Exclude \(field.label)"
            ))
        }
        descriptors.append(contentsOf: dashboardReportRuntimeFieldActions(reportSpec: reportSpec, fieldValueKey: field.valueKey).compactMap { action in
            guard let kind = nonBlank(action["kind"]?.stringValue)?.lowercased() else { return nil }
            if ["keep", "exclude", "drill"].contains(kind), !field.runtimeFilterable {
                return nil
            }
            if kind == "drill" {
                guard let nextFieldRef = nonBlank(action["nextFieldRef"]?.stringValue) else { return nil }
                return DashboardReportRuntimeActionDescriptor(
                    id: nonBlank(action["id"]?.stringValue) ?? dashboardReportRuntimeGeneratedActionID(kind: "drill", blockID: blockID, fieldValueKey: field.valueKey, includeBlockID: includeBlockIDInGeneratedID),
                    kind: "drill",
                    fieldValueKey: field.valueKey,
                    label: nonBlank(action["label"]?.stringValue) ?? "Drill \(field.label)",
                    nextFieldRef: nextFieldRef
                )
            }
            if kind == "detail" {
                guard let targetRef = nonBlank(action["targetRef"]?.stringValue) else { return nil }
                return DashboardReportRuntimeActionDescriptor(
                    id: nonBlank(action["id"]?.stringValue) ?? dashboardReportRuntimeGeneratedActionID(kind: "detail", blockID: blockID, fieldValueKey: field.valueKey, includeBlockID: includeBlockIDInGeneratedID),
                    kind: "detail",
                    fieldValueKey: field.valueKey,
                    label: nonBlank(action["label"]?.stringValue) ?? "Detail \(field.label)",
                    targetRef: targetRef
                )
            }
            if ["keep", "exclude"].contains(kind) {
                return DashboardReportRuntimeActionDescriptor(
                    id: dashboardReportRuntimeGeneratedActionID(kind: kind, blockID: blockID, fieldValueKey: field.valueKey, includeBlockID: includeBlockIDInGeneratedID),
                    kind: kind,
                    fieldValueKey: field.valueKey,
                    label: nonBlank(action["label"]?.stringValue) ?? "\(kind.capitalized) \(field.label)"
                )
            }
            return nil
        })
        return descriptors
    }

    public static func dashboardReportRuntimeAuthoredSelectionDescriptors(
        block: [String: JSONValue],
        fields: [DashboardReportRuntimeActionField]
    ) -> [DashboardReportRuntimeActionDescriptor] {
        let actions = block["runtime"]?.objectValue?["actions"]?.arrayValue ?? []
        return actions.compactMap { value in
            guard let action = value.objectValue,
                  nonBlank(action["kind"]?.stringValue)?.lowercased() == "select",
                  let dimension = nonBlank(action["dimension"]?.stringValue),
                  let field = fields.first(where: { $0.valueKey == dimension }) else {
                return nil
            }
            return DashboardReportRuntimeActionDescriptor(
                id: nonBlank(action["id"]?.stringValue) ?? "select_\(dimension)",
                kind: "select",
                fieldValueKey: field.valueKey,
                label: nonBlank(action["label"]?.stringValue) ?? "Select \(field.label)",
                selectionDimension: dimension
            )
        }
    }

    public static func dashboardReportRuntimeTableActionExecutions(
        blockID: String?,
        descriptors: [DashboardReportRuntimeActionDescriptor],
        field: DashboardReportRuntimeActionField,
        item: [String: JSONValue]
    ) -> [DashboardReportRuntimeActionExecution] {
        guard let value = dashboardReportRuntimeResolvedJSONValue(item, selector: field.valueKey),
              !dashboardReportRuntimeIsBlankValue(value) else {
            return []
        }
        let displayValue = dashboardReportRuntimeResolvedJSONValue(item, selector: field.displayValueKey)
            .flatMap { dashboardReportRuntimeIsBlankValue($0) ? nil : $0 }
            ?? value
        return descriptors.compactMap { descriptor in
            dashboardReportRuntimeActionExecution(
                descriptor: descriptor,
                field: field,
                value: value,
                displayValue: displayValue,
                sourceBlockID: nonBlank(blockID),
                item: item
            )
        }
    }

    public static func dashboardReportRuntimeChartActionExecutions(
        blockID: String?,
        descriptors: [DashboardReportRuntimeActionDescriptor],
        fields: [DashboardReportRuntimeActionField],
        selection: DashboardReportRuntimeChartSelection
    ) -> [DashboardReportRuntimeActionExecution] {
        let fieldsByValueKey = Dictionary(uniqueKeysWithValues: fields.map { ($0.valueKey, $0) })
        var item = selection.row
        if !selection.selectionRows.isEmpty {
            item["selectionRows"] = .array(selection.selectionRows.map { .object($0) })
        }
        return descriptors.compactMap { descriptor in
            guard let field = fieldsByValueKey[descriptor.fieldValueKey],
                  let value = dashboardReportRuntimeChartSelectionValue(field: field, selection: selection),
                  !dashboardReportRuntimeIsBlankValue(value) else {
                return nil
            }
            let displayValue = dashboardReportRuntimeResolvedJSONValue(selection.row, selector: field.displayValueKey)
                .flatMap { dashboardReportRuntimeIsBlankValue($0) ? nil : $0 }
                ?? value
            return dashboardReportRuntimeActionExecution(
                descriptor: descriptor,
                field: field,
                value: value,
                displayValue: displayValue,
                sourceBlockID: nonBlank(blockID),
                item: item
            )
        }
    }

    public static func dashboardReportRuntimeActionExecutionPayload(
        _ execution: DashboardReportRuntimeActionExecution
    ) -> JSONValue {
        var object: [String: JSONValue] = [
            "id": .string(execution.id),
            "label": .string(execution.label),
            "kind": .string(execution.kind)
        ]
        if let refinement = execution.refinement {
            object["refinement"] = .object([
                "op": .string(refinement.op),
                "field": .string(refinement.field),
                "value": refinement.value,
                "sourceBlockId": refinement.sourceBlockID.map(JSONValue.string) ?? .null,
                "fieldLabel": refinement.fieldLabel.map(JSONValue.string) ?? .null,
                "label": .string(refinement.label)
            ])
        }
        if let selection = execution.selection {
            object["selection"] = .object([
                "dimension": selection.dimension.map(JSONValue.string) ?? .null,
                "entityKey": selection.entityKey.map(JSONValue.string) ?? .null,
                "selected": .object(selection.selected.mapValues { primitive in
                    switch primitive {
                    case .string(let value): return .string(value)
                    case .number(let value): return .number(value)
                    case .bool(let value): return .bool(value)
                    case .null: return .null
                    }
                }),
                "sourceBlockId": selection.sourceBlockID.map(JSONValue.string) ?? .null
            ])
        }
        if let transition = execution.transition {
            object["transition"] = .object([
                "sourceField": .string(transition.sourceField),
                "nextFieldRef": .string(transition.nextFieldRef),
                "sourceBlockId": transition.sourceBlockID.map(JSONValue.string) ?? .null
            ])
        }
        if let detailRequest = execution.detailRequest {
            object["detailRequest"] = .object([
                "action": .object([
                    "id": .string(detailRequest.action.id),
                    "kind": .string(detailRequest.action.kind),
                    "label": .string(detailRequest.action.label),
                    "targetRef": .string(detailRequest.action.targetRef)
                ]),
                "item": .object(detailRequest.item),
                "value": detailRequest.value,
                "field": dashboardReportRuntimeActionFieldPayload(detailRequest.field),
                "sourceBlockId": detailRequest.sourceBlockID.map(JSONValue.string) ?? .null
            ])
        }
        return .object(object)
    }

    private static func dashboardReportRuntimeActionFieldPayload(
        _ field: DashboardReportRuntimeActionField
    ) -> JSONValue {
        .object([
            "id": .string(field.id),
            "kind": field.kind.map(JSONValue.string) ?? .null,
            "valueKey": .string(field.valueKey),
            "displayValueKey": .string(field.displayValueKey),
            "label": .string(field.label),
            "selectionSource": field.selectionSource.map(JSONValue.string) ?? .null,
            "runtimeFilterable": .bool(field.runtimeFilterable)
        ])
    }

    private static func dashboardReportRuntimeActionExecution(
        descriptor: DashboardReportRuntimeActionDescriptor,
        field: DashboardReportRuntimeActionField,
        value: JSONValue,
        displayValue: JSONValue,
        sourceBlockID: String?,
        item: [String: JSONValue]
    ) -> DashboardReportRuntimeActionExecution? {
        let label = "\(descriptor.label) = \(dashboardReportRuntimeExecutionValueText(displayValue))"
        switch descriptor.kind {
        case "keep", "exclude":
            return DashboardReportRuntimeActionExecution(
                id: descriptor.id,
                label: descriptor.label,
                kind: descriptor.kind,
                refinement: DashboardReportRuntimeActionRefinement(
                    op: descriptor.kind,
                    field: descriptor.fieldValueKey,
                    value: value,
                    sourceBlockID: sourceBlockID,
                    fieldLabel: field.label,
                    label: label
                )
            )
        case "drill":
            guard let nextFieldRef = descriptor.nextFieldRef else { return nil }
            return DashboardReportRuntimeActionExecution(
                id: descriptor.id,
                label: descriptor.label,
                kind: "drill",
                refinement: DashboardReportRuntimeActionRefinement(
                    op: "drill",
                    field: descriptor.fieldValueKey,
                    value: value,
                    sourceBlockID: sourceBlockID,
                    fieldLabel: field.label,
                    label: label
                ),
                transition: DashboardReportRuntimeActionTransition(
                    sourceField: descriptor.fieldValueKey,
                    nextFieldRef: nextFieldRef,
                    sourceBlockID: sourceBlockID
                )
            )
        case "detail":
            guard let targetRef = descriptor.targetRef else { return nil }
            return DashboardReportRuntimeActionExecution(
                id: descriptor.id,
                label: descriptor.label,
                kind: "detail",
                detailRequest: DashboardReportRuntimeDetailRequest(
                    action: DashboardReportRuntimeDetailAction(
                        id: descriptor.id,
                        kind: "detail",
                        label: descriptor.label,
                        targetRef: targetRef
                    ),
                    item: item,
                    value: value,
                    field: field,
                    sourceBlockID: sourceBlockID
                )
            )
        case "select":
            return DashboardReportRuntimeActionExecution(
                id: descriptor.id,
                label: descriptor.label,
                kind: "select",
                selection: DashboardSelectionState(
                    dimension: descriptor.selectionDimension ?? descriptor.fieldValueKey,
                    entityKey: dashboardReportRuntimeExecutionValueText(value),
                    selected: dashboardSelectionPayload(from: item),
                    sourceBlockID: sourceBlockID
                )
            )
        default:
            return nil
        }
    }

    private static func dashboardReportRuntimeChartSelectionValue(
        field: DashboardReportRuntimeActionField,
        selection: DashboardReportRuntimeChartSelection
    ) -> JSONValue? {
        switch field.selectionSource {
        case "xValue":
            return selection.xValue ?? dashboardReportRuntimeResolvedJSONValue(selection.row, selector: field.valueKey)
        case "seriesKey":
            return selection.seriesKey ?? dashboardReportRuntimeResolvedJSONValue(selection.row, selector: field.valueKey)
        default:
            return dashboardReportRuntimeResolvedJSONValue(selection.row, selector: field.valueKey)
        }
    }

    private static func dashboardReportRuntimeResolvedJSONValue(
        _ item: [String: JSONValue],
        selector: String
    ) -> JSONValue? {
        JSONValue(any: SelectorUtil.resolve(item, selector: selector))
    }

    private static func dashboardReportRuntimeIsBlankValue(_ value: JSONValue) -> Bool {
        if case .null = value { return true }
        return value.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == true
    }

    private static func dashboardReportRuntimeExecutionValueText(_ value: JSONValue) -> String {
        let text = dashboardReportRuntimeValueText(value) ?? ""
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? text : trimmed
    }

    private static func dashboardReportRuntimeGeneratedActionID(
        kind: String,
        blockID: String?,
        fieldValueKey: String,
        includeBlockID: Bool
    ) -> String {
        if includeBlockID, let blockID = nonBlank(blockID) {
            return "\(kind):\(blockID):\(fieldValueKey)"
        }
        return "\(kind):\(fieldValueKey)"
    }

    private static func dashboardReportRuntimeDatasetDimensions(
        reportSpec: [String: JSONValue],
        datasetRef: String?
    ) -> Set<String> {
        guard let datasetRef else { return [] }
        let dataset = (reportSpec["datasets"]?.arrayValue ?? []).compactMap { $0.objectValue }
            .first { nonBlank($0["id"]?.stringValue) == datasetRef }
        let dimensions = dataset?["request"]?.objectValue?["dimensions"]?.objectValue ?? [:]
        return Set(dimensions.compactMap { key, value in
            value.boolValue == true ? key : nil
        })
    }

    private static func dashboardReportRuntimeFieldColumn(
        reportSpec: [String: JSONValue],
        datasetRef: String?,
        fieldKey: String
    ) -> [String: JSONValue]? {
        guard let datasetRef = nonBlank(datasetRef) else { return nil }
        for block in (reportSpec["blocks"]?.arrayValue ?? []).compactMap({ $0.objectValue }) {
            guard nonBlank(block["kind"]?.stringValue) == "tableBlock",
                  nonBlank(block["datasetRef"]?.stringValue) == datasetRef else {
                continue
            }
            let columns = block["columns"]?.arrayValue ?? []
            if let match = columns.compactMap({ $0.objectValue }).first(where: { column in
                nonBlank(column["key"]?.stringValue) == fieldKey
                    || nonBlank(column["sourceKey"]?.stringValue) == fieldKey
                    || nonBlank(column["displayKey"]?.stringValue) == fieldKey
            }) {
                return match
            }
        }
        return nil
    }

    private static func dashboardReportRuntimeFieldActions(
        reportSpec: [String: JSONValue],
        fieldValueKey: String
    ) -> [[String: JSONValue]] {
        let entries = reportSpec["drillMetadata"]?.objectValue?["fieldActions"]?.arrayValue ?? []
        return entries.compactMap { $0.objectValue }.first(where: { entry in
            nonBlank(entry["fieldRef"]?.stringValue) == fieldValueKey
                || nonBlank(entry["field"]?.stringValue) == fieldValueKey
                || nonBlank(entry["id"]?.stringValue) == fieldValueKey
        })?["actions"]?.arrayValue?.compactMap { $0.objectValue } ?? []
    }

    public static func dashboardReportRuntimeColumns(_ values: [JSONValue]) -> [ColumnDef] {
        values.compactMap { value in
            switch value {
            case .string(let raw):
                let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmed.isEmpty else { return nil }
                return ColumnDef(id: trimmed, name: trimmed, label: trimmed)
            case .object(let object):
                let id = nonBlank(object["id"]?.stringValue)
                    ?? nonBlank(object["key"]?.stringValue)
                    ?? nonBlank(object["sourceKey"]?.stringValue)
                    ?? nonBlank(object["displayKey"]?.stringValue)
                guard let id else { return nil }
                return ColumnDef(
                    id: id,
                    name: nonBlank(object["name"]?.stringValue) ?? id,
                    key: nonBlank(object["key"]?.stringValue),
                    label: nonBlank(object["label"]?.stringValue) ?? id,
                    type: nonBlank(object["type"]?.stringValue),
                    format: nonBlank(object["format"]?.stringValue),
                    emptyText: nonBlank(object["emptyText"]?.stringValue)
                )
            default:
                return nil
            }
        }
    }

    public static func dashboardReportRuntimeKPI(content: [String: JSONValue]) -> DashboardReportRuntimeKPIValue {
        let valueText = dashboardReportRuntimeFormattedValueText(
            content["value"],
            format: nonBlank(content["valueFormat"]?.stringValue)
        )
        let secondaryField = nonBlank(content["secondaryField"]?.stringValue)
        let secondaryValue = dashboardReportRuntimeFormattedValueText(
            content["secondaryValue"],
            format: nonBlank(content["secondaryFormat"]?.stringValue)
        )
        return DashboardReportRuntimeKPIValue(
            description: nonBlank(content["description"]?.stringValue),
            valueLabel: nonBlank(content["valueLabel"]?.stringValue)
                ?? nonBlank(content["valueField"]?.stringValue)
                ?? "Value",
            valueText: valueText,
            secondaryLabel: secondaryValue == nil ? nil : (nonBlank(content["secondaryLabel"]?.stringValue) ?? secondaryField),
            secondaryValueText: secondaryField == nil ? nil : secondaryValue,
            emptyLabel: nonBlank(content["emptyLabel"]?.stringValue) ?? "No KPI value available.",
            rowCount: dashboardReportRuntimeInt(content["rowCount"]) ?? 0
        )
    }

    private static func dashboardReportRuntimeScopeValueText(_ value: JSONValue?) -> String {
        guard let value else { return "Not set" }
        if let object = value.objectValue,
           object["start"] != nil || object["end"] != nil {
            let start = nonBlank(object["start"]?.stringValue) ?? "open"
            let end = nonBlank(object["end"]?.stringValue) ?? "open"
            return "\(start) to \(end)"
        }
        if let array = value.arrayValue {
            let text = array.compactMap { dashboardReportRuntimeValueText($0) }
                .filter { !$0.isEmpty }
                .joined(separator: ", ")
            return text.isEmpty ? "None" : text
        }
        if let text = dashboardReportRuntimeValueText(value),
           !text.isEmpty {
            return text
        }
        return value == .null ? "Not set" : String(describing: value)
    }

    private static func dashboardReportRuntimeRefinementLabel(_ refinement: [String: JSONValue]) -> String {
        if let label = nonBlank(refinement["label"]?.stringValue) {
            return label
        }
        let op = nonBlank(refinement["op"]?.stringValue)
        let opLabel: String
        switch op {
        case "keep":
            opLabel = "Keep"
        case "exclude":
            opLabel = "Exclude"
        case "drill":
            opLabel = "Drill"
        case "detail":
            opLabel = "Detail"
        case let value?:
            opLabel = value
        default:
            opLabel = "Refinement"
        }
        let fieldText = nonBlank(refinement["fieldLabel"]?.stringValue)
            ?? nonBlank(refinement["field"]?.stringValue)
            ?? "field"
        let values = refinement["values"]?.arrayValue?
            .compactMap { dashboardReportRuntimeValueText($0) }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
        guard let values, !values.isEmpty else {
            return "\(opLabel): \(fieldText)"
        }
        return "\(opLabel): \(fieldText) = \(values)"
    }

    private static func dashboardReportRuntimeInt(_ value: JSONValue?) -> Int? {
        guard let value else { return nil }
        if let intValue = value.intValue {
            return intValue
        }
        if case .number(let number) = value {
            return Int(number)
        }
        if case .string(let string) = value {
            return Int(string.trimmingCharacters(in: .whitespacesAndNewlines))
        }
        return nil
    }

    public static func dashboardReportRuntimeValueText(_ value: JSONValue?) -> String? {
        guard let value else { return nil }
        switch value {
        case .null:
            return nil
        case .string(let string):
            return string
        case .number(let number):
            return formatDashboardValue(number, format: "number")
        case .bool(let bool):
            return bool ? "true" : "false"
        case .array(let values):
            return values.compactMap(dashboardReportRuntimeValueText).joined(separator: ", ")
        case .object:
            guard let data = try? JSONEncoder().encode(value),
                  let text = String(data: data, encoding: .utf8) else {
                return String(describing: value)
            }
            return text
        }
    }

    private static func dashboardReportRuntimeFormattedValueText(
        _ value: JSONValue?,
        format: String?
    ) -> String? {
        guard let value else { return nil }
        guard let format else {
            return dashboardReportRuntimeValueText(value)
        }
        switch value {
        case .null:
            return nil
        case .string(let string):
            return formatDashboardValue(string, format: format)
        case .number(let number):
            return formatDashboardValue(number, format: format)
        case .bool, .array, .object:
            return dashboardReportRuntimeValueText(value)
        }
    }

    public static func toggleDashboardFilter(
        _ current: [String: JSONValue],
        item: DashboardFilterItemDef,
        optionValue: String?
    ) -> [String: JSONValue] {
        guard let field = dashboardFilterKey(item),
              let optionValue,
              !optionValue.isEmpty else {
            return current
        }
        if item.multiple == true {
            let selected = current[field]?.arrayValue?.compactMap(\.stringValue) ?? []
            let next = selected.contains(optionValue)
                ? selected.filter { $0 != optionValue }
                : selected + [optionValue]
            return current.merging([field: .array(next.map(JSONValue.string))]) { _, next in next }
        }
        return current.merging([field: .string(optionValue)]) { _, next in next }
    }

    public static func setDashboardDateRangeFilter(
        _ current: [String: JSONValue],
        item: DashboardFilterItemDef,
        edge: String,
        value: String?
    ) -> [String: JSONValue] {
        guard let field = dashboardFilterKey(item) else {
            return current
        }
        var range: [String: JSONValue]
        if case .object(let object)? = current[field] {
            range = object
        } else {
            range = [:]
        }
        let normalizedEdge = edge.trimmingCharacters(in: .whitespacesAndNewlines)
        guard normalizedEdge == "start" || normalizedEdge == "end" else {
            return current
        }
        let normalizedValue = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if normalizedValue.isEmpty {
            range.removeValue(forKey: normalizedEdge)
        } else {
            range[normalizedEdge] = .string(normalizedValue)
        }
        return current.merging([field: .object(range)]) { _, next in next }
    }

    public static func buildDashboardDefaultFilters(_ container: ContainerDef) -> [String: JSONValue] {
        var defaults: [String: JSONValue] = [:]

        func collectFilters(_ node: ContainerDef) {
            if node.kind?.trimmingCharacters(in: .whitespacesAndNewlines) == "dashboard.filters" {
                dashboardFilterItems(node).forEach { item in
                    guard let field = dashboardFilterKey(item), defaults[field] == nil else { return }
                    let selected = item.options.compactMap { option -> String? in
                        option.defaultValue == true ? option.value : nil
                    }
                    guard !selected.isEmpty else { return }
                    defaults[field] = item.multiple == true
                        ? .array(selected.map(JSONValue.string))
                        : .string(selected[0])
                }
            }
            node.containers.forEach(collectFilters)
        }

        collectFilters(container)
        return defaults
    }

    public static func dashboardFilterItems(_ container: ContainerDef) -> [DashboardFilterItemDef] {
        if let items = container.dashboard?.filters?.items, !items.isEmpty {
            return items
        }
        return container.items.map { item in
            DashboardFilterItemDef(
                id: item.id,
                label: item.label,
                field: item.field,
                type: item.type,
                multiple: item.multiple,
                options: item.options.map { option in
                    DashboardFilterOptionDef(
                        label: option.label,
                        value: option.value,
                        defaultValue: option.default
                    )
                }
            )
        }
    }

    public static func applyDashboardFiltersToCollection(
        _ rows: [[String: JSONValue]],
        filterBindings: [String: String],
        filters: [String: JSONValue]
    ) -> [[String: JSONValue]] {
        guard !filterBindings.isEmpty, !filters.isEmpty else {
            return rows
        }
        return rows.filter { row in
            filterBindings.allSatisfy { filterKey, rowField in
                guard let filterValue = filters[filterKey] else { return true }
                let rowValue = SelectorUtil.resolve(row.mapValues(dashboardFilterJSONAny), selector: rowField)
                switch filterValue {
                case .array(let values):
                    return values.isEmpty || values.contains { dashboardFilterValueEquals(filterValue: $0.anyValue, rowValue: rowValue) }
                default:
                    return dashboardFilterValueEquals(filterValue: filterValue.anyValue, rowValue: rowValue)
                }
            }
        }
    }

    public static func applyDashboardSelectionToCollection(
        _ rows: [[String: JSONValue]],
        selectionBindings: [String: String],
        selection: DashboardSelectionState
    ) -> [[String: JSONValue]] {
        let entries = selectionBindings.compactMap { selectionField, rowField -> (String, String)? in
            let trimmedRowField = rowField.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmedRowField.isEmpty else { return nil }
            return (selectionField, trimmedRowField)
        }
        guard !entries.isEmpty else {
            return rows
        }
        let activeEntries = entries.compactMap { selectionField, rowField -> (String, Any)? in
            guard let value = dashboardSelectionValue(selector: selectionField, selection: selection),
                  let unwrapped = unwrapOptional(value),
                  isPresent(unwrapped) else {
                return nil
            }
            return (rowField, unwrapped)
        }
        guard !activeEntries.isEmpty else {
            return rows
        }
        return rows.filter { row in
            let rowValues = row.mapValues(dashboardFilterJSONAny)
            return activeEntries.allSatisfy { rowField, selectionValue in
                let rowValue = SelectorUtil.resolve(rowValues, selector: rowField)
                if let values = unwrapOptional(selectionValue) as? [Any] {
                    return values.contains { dashboardFilterValueEquals(filterValue: $0, rowValue: rowValue) }
                }
                return dashboardFilterValueEquals(filterValue: selectionValue, rowValue: rowValue)
            }
        }
    }

    public static func rankedDashboardDimensionRows(
        _ rows: [[String: JSONValue]],
        dimensionKey: String?,
        metricKey: String?,
        limit: Int?
    ) -> [DashboardDimensionRow] {
        guard let dimensionKey = nonBlank(dimensionKey),
              let metricKey = nonBlank(metricKey) else {
            return []
        }
        let rowLimit = max(limit ?? 10, 0)
        guard rowLimit > 0 else {
            return []
        }
        return rows
            .sorted {
                dashboardDimensionMetricValue($0, metricKey: metricKey) > dashboardDimensionMetricValue($1, metricKey: metricKey)
            }
            .prefix(rowLimit)
            .map { row in
                let rowValues = row.mapValues(dashboardFilterJSONAny)
                let entity = SelectorUtil.resolve(rowValues, selector: dimensionKey)
                    .map(String.init(describing:))?
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                return DashboardDimensionRow(
                    entityKey: entity?.isEmpty == false ? entity : nil,
                    value: dashboardDimensionMetricValue(row, metricKey: metricKey),
                    row: row
                )
            }
    }

    public static func rankedDashboardGeoMapRows(
        _ rows: [[String: JSONValue]],
        metricKey: String?,
        limit: Int?,
        regionKey: String? = nil,
        labelKey: String? = nil
    ) -> [DashboardGeoMapRow] {
        let rowLimit = max(limit ?? 8, 0)
        guard rowLimit > 0 else {
            return []
        }
        let valueKey = nonBlank(metricKey) ?? "value"
        let regionSelectors = [nonBlank(regionKey), "regionCode", "stateCode"].compactMap { $0 }
        let labelSelectors = [nonBlank(labelKey), "label", "name", "regionName", "stateName"].compactMap { $0 }
        return rows.compactMap { row -> DashboardGeoMapRow? in
            let rowValues = row.mapValues(dashboardFilterJSONAny)
            guard let regionCode = dashboardGeoMapText(rowValues, selectors: regionSelectors),
                  let value = dashboardGeoMapNumber(rowValues, selector: valueKey)
                    ?? dashboardGeoMapNumber(rowValues, selector: "value") else {
                return nil
            }
            return DashboardGeoMapRow(
                regionCode: regionCode,
                label: dashboardGeoMapText(rowValues, selectors: labelSelectors) ?? regionCode,
                value: value,
                tone: dashboardGeoMapText(rowValues, selectors: ["tone", "statusTone"]),
                rank: dashboardGeoMapNumber(rowValues, selector: "rank").map(Int.init),
                href: dashboardGeoMapText(rowValues, selectors: ["href", "url", "link"])
            )
        }
        .sorted { $0.value > $1.value }
        .prefix(rowLimit)
        .map { $0 }
    }

    public static func dashboardSelectionPayload(from row: [String: JSONValue]) -> [String: JSONPrimitive] {
        row.compactMapValues(jsonPrimitiveValue)
    }

    public static func evaluate(
        _ condition: DashboardConditionDef?,
        value: JSONPrimitive?
    ) -> Bool {
        evaluateDashboardCondition(
            condition,
            metrics: ["value": value?.anyValue as Any],
            filters: [:],
            selection: DashboardSelectionState()
        )
    }

    public static func visibleDashboardDetailChildren(
        _ container: ContainerDef,
        metrics: [String: Any] = [:],
        filters: [String: Any] = [:],
        selection: DashboardSelectionState = DashboardSelectionState()
    ) -> [ContainerDef] {
        container.containers.filter { child in
            evaluateDashboardCondition(
                child.dashboard?.visibleWhen ?? child.visibleWhen,
                metrics: metrics,
                filters: filters,
                selection: selection
            )
        }
    }

    public static func dashboardTimelineChart(_ container: ContainerDef) -> ChartDef? {
        if let chart = container.chart {
            return chart
        }
        return ChartDef.timelineShorthand(
            dateKey: container.dateField ?? container.timeKey,
            chartType: container.chartType,
            series: container.series
        )
    }

    public static func dashboardCompositionChart(_ container: ContainerDef) -> ChartDef? {
        let chart = container.chart
        let categoryKey = nonBlank(chart?.xKey)
            ?? nonBlank(chart?.nameKey)
            ?? nonBlank(chart?.seriesDef?.nameKey)
            ?? nonBlank(container.categoryKey)
            ?? nonBlank(container.nameKey)
            ?? "name"
        let valueKey = nonBlank(chart?.valueKey)
            ?? nonBlank(chart?.seriesDef?.valueKey)
            ?? chart?.series.compactMap(nonBlank).first
            ?? nonBlank(container.valueKey)
            ?? "value"
        let chartType = nonBlank(chart?.type) ?? nonBlank(container.chartType) ?? "donut"
        let existingOptions = chart?.seriesDef?.values ?? []
        let values = existingOptions.isEmpty ? [ChartValueOption(value: valueKey)] : existingOptions
        let seriesDef = ChartSeriesDef(
            nameKey: categoryKey,
            valueKey: valueKey,
            palette: chart?.seriesDef?.palette ?? [],
            values: values
        )
        let series = chart?.series.isEmpty == false ? chart?.series ?? [] : values.compactMap(\.value)
        return ChartDef(
            kind: chart?.kind,
            title: chart?.title,
            type: chartType,
            dataSourceRef: chart?.dataSourceRef,
            dataSourceRefSource: chart?.dataSourceRefSource,
            dataSourceRefSelector: chart?.dataSourceRefSelector,
            dataSourceRefs: chart?.dataSourceRefs ?? [:],
            xKey: categoryKey,
            valueKey: valueKey,
            nameKey: categoryKey,
            series: series,
            seriesDef: seriesDef
        )
    }

    public static func evaluateDashboardCondition(
        _ condition: DashboardConditionDef?,
        metrics: [String: Any] = [:],
        filters: [String: Any] = [:],
        selection: DashboardSelectionState = DashboardSelectionState()
    ) -> Bool {
        guard let condition else { return true }
        let selector = condition.selector ?? condition.field ?? condition.key
        let actual = resolveDashboardValue(
            source: condition.source,
            selector: selector,
            metrics: metrics,
            filters: filters,
            selection: selection
        )

        if let expected = condition.whenValue, !dashboardValuesEqual(actual: actual, expected: expected) {
            return false
        }

        if let equals = condition.equals, !dashboardValuesEqual(actual: actual, expected: equals) {
            return false
        }
        if let notEquals = condition.notEquals, dashboardValuesEqual(actual: actual, expected: notEquals) {
            return false
        }
        if !condition.inValues.isEmpty && !condition.inValues.contains(where: { dashboardValuesEqual(actual: actual, expected: $0) }) {
            return false
        }

        if let number = numericValue(actual) {
            if let gt = condition.gt, !(number > gt) { return false }
            if let gte = condition.gte, !(number >= gte) { return false }
            if let lt = condition.lt, !(number < lt) { return false }
            if let lte = condition.lte, !(number <= lte) { return false }
        }

        if let empty = condition.empty, isEmpty(actual) != empty {
            return false
        }

        if let notEmpty = condition.notEmpty {
            if isPresent(actual) != notEmpty {
                return false
            }
        }

        return true
    }

    public static func resolveDashboardValue(
        source: String?,
        selector: String?,
        metrics: [String: Any] = [:],
        filters: [String: Any] = [:],
        selection: DashboardSelectionState = DashboardSelectionState()
    ) -> Any? {
        let selectionPayload = selectionDictionary(selection)

        guard let selector, !selector.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            switch source?.lowercased() {
            case "selection":
                return selectionPayload
            case "filters", "filter":
                return filters
            default:
                return metrics
            }
        }

        switch source?.lowercased() {
        case "selection":
            return SelectorUtil.resolve(selectionPayload, selector: selector)
        case "filters", "filter":
            return SelectorUtil.resolve(filters, selector: selector)
        default:
            if selector.hasPrefix("filters.") {
                return SelectorUtil.resolve(filters, selector: String(selector.dropFirst("filters.".count)))
            }
            if selector.hasPrefix("selection.") {
                return SelectorUtil.resolve(selectionPayload, selector: String(selector.dropFirst("selection.".count)))
            }
            return SelectorUtil.resolve(metrics, selector: selector)
        }
    }

    private static func dashboardSummaryMetric(_ item: ItemDef) -> DashboardMetricDef {
        DashboardMetricDef(
            id: item.id,
            label: item.label ?? item.title,
            selector: item.field ?? item.dataField ?? item.bindingPath ?? item.id,
            field: item.field,
            format: item.format,
            tone: item.severity,
            value: item.value
        )
    }

    private static func dashboardSummaryValue(
        _ metric: DashboardMetricDef,
        metrics: [String: Any],
        source: [String: Any]?
    ) -> Any? {
        if let selector = metric.resolvedSelector {
            if let source, let value = SelectorUtil.resolve(source, selector: selector) {
                return value
            }
            if let value = SelectorUtil.resolve(metrics, selector: selector) {
                return value
            }
        }
        return metric.value?.anyValue
    }

    private static func isMeaningfulDashboardSummaryDisplay(_ value: String) -> Bool {
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return false }
        return !["-", "—", "/", "n/a", "na", "null"].contains(normalized.lowercased())
    }

    public static func interpolateDashboardTemplate(
        _ template: String,
        metrics: [String: Any] = [:],
        filters: [String: Any] = [:],
        selection: DashboardSelectionState = DashboardSelectionState()
    ) -> String {
        interpolateDashboardPlaceholders(template) { selector in
            let value = resolveDashboardValue(
                source: nil,
                selector: selector,
                metrics: metrics,
                filters: filters,
                selection: selection
            )
            return unwrapOptional(value).map { String(describing: $0) } ?? ""
        }
    }

    public static func formatDashboardValue(_ value: Any?, format: String?) -> String {
        guard let value = unwrapOptional(value) else { return "n/a" }
        let normalized = format?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let locale = Locale(identifier: "en_US")
        switch normalized {
        case "date":
            if let date = dashboardDateValue(value) {
                return formatDashboardDateValue(date, pattern: "MMM d, yyyy", locale: locale)
            }
        case "datetime":
            if let date = dashboardDateValue(value) {
                return formatDashboardDateValue(date, pattern: "MMM d, yyyy, h:mm a", locale: locale)
            }
        case "wallclockdate":
            if let date = dashboardDateValue(value) {
                return formatDashboardDateValue(date, pattern: "MMM d, yyyy", locale: locale)
            }
        case "wallclockhour":
            if let date = dashboardDateValue(value) {
                return formatDashboardDateValue(date, pattern: "h a", locale: locale)
            }
        case "currency":
            if let number = numericValue(value) {
                let formatter = NumberFormatter()
                formatter.locale = locale
                formatter.numberStyle = .currency
                formatter.minimumFractionDigits = 0
                formatter.maximumFractionDigits = 0
                return formatter.string(from: NSNumber(value: number)) ?? String(describing: value)
            }
        case "percent":
            if let number = numericValue(value) {
                let formatter = NumberFormatter()
                formatter.locale = locale
                formatter.numberStyle = .decimal
                formatter.minimumFractionDigits = 1
                formatter.maximumFractionDigits = 1
                return "\(formatter.string(from: NSNumber(value: number)) ?? String(number))%"
            }
        case "percentfraction":
            if let number = numericValue(value) {
                let formatter = NumberFormatter()
                formatter.locale = locale
                formatter.numberStyle = .decimal
                formatter.minimumFractionDigits = 1
                formatter.maximumFractionDigits = 1
                let scaled = number * 100
                return "\(formatter.string(from: NSNumber(value: scaled)) ?? String(scaled))%"
            }
        case "integer":
            if let number = numericValue(value) {
                let formatter = NumberFormatter()
                formatter.locale = locale
                formatter.numberStyle = .decimal
                formatter.maximumFractionDigits = 0
                return formatter.string(from: NSNumber(value: number)) ?? String(Int(number))
            }
        case "compact", "compactnumber":
            if let number = numericValue(value) {
                return formatCompactNumber(number, locale: locale)
            }
        case "number":
            if let number = numericValue(value) {
                let formatter = NumberFormatter()
                formatter.locale = locale
                formatter.numberStyle = .decimal
                formatter.groupingSeparator = " "
                formatter.usesGroupingSeparator = true
                formatter.minimumFractionDigits = 0
                formatter.maximumFractionDigits = 5
                return formatter.string(from: NSNumber(value: number)) ?? String(number)
            }
        case "number5":
            if let number = numericValue(value) {
                let formatter = NumberFormatter()
                formatter.locale = locale
                formatter.numberStyle = .decimal
                formatter.groupingSeparator = " "
                formatter.usesGroupingSeparator = true
                formatter.minimumFractionDigits = 5
                formatter.maximumFractionDigits = 5
                return formatter.string(from: NSNumber(value: number)) ?? String(number)
            }
        default:
            break
        }
        return String(describing: value)
    }

    private static func formatDashboardDateValue(_ date: Date, pattern: String, locale: Locale) -> String {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = pattern
        return formatter.string(from: date)
    }

    public static func dashboardToneName(value: Any?, tone: DashboardToneDef?) -> String {
        guard let number = dashboardToneNumber(value) else {
            return "info"
        }
        var warningAbove = tone?.warningAbove
        var dangerAbove = tone?.dangerAbove
        if let warning = warningAbove, let danger = dangerAbove {
            warningAbove = min(warning, danger)
            dangerAbove = max(warning, danger)
        }
        var warningBelow = tone?.warningBelow
        var dangerBelow = tone?.dangerBelow
        if let warning = warningBelow, let danger = dangerBelow {
            warningBelow = max(warning, danger)
            dangerBelow = min(warning, danger)
        }

        if let threshold = dangerAbove, number >= threshold { return "danger" }
        if let threshold = warningAbove, number >= threshold { return "warning" }
        if let threshold = tone?.successAbove, number >= threshold { return "success" }
        if let threshold = dangerBelow, number <= threshold { return "danger" }
        if let threshold = warningBelow, number <= threshold { return "warning" }
        if let threshold = tone?.successBelow, number <= threshold { return "success" }
        return "info"
    }

    private static func selectionDictionary(_ selection: DashboardSelectionState) -> [String: Any] {
        [
            "dimension": selection.dimension as Any,
            "entityKey": selection.entityKey as Any,
            "pointKey": selection.pointKey as Any,
            "selected": Dictionary(uniqueKeysWithValues: selection.selected.map { ($0.key, $0.value.anyValue as Any) }),
            "sourceBlockId": selection.sourceBlockID as Any
        ]
    }

    private static func dashboardSelectionValue(selector: String, selection: DashboardSelectionState) -> Any? {
        let normalized = selector.trimmingCharacters(in: .whitespacesAndNewlines)
        switch normalized {
        case "dimension":
            return selection.dimension
        case "entityKey":
            return selection.entityKey
        case "pointKey":
            return selection.pointKey
        case "sourceBlockId", "sourceBlockID":
            return selection.sourceBlockID
        default:
            if normalized.hasPrefix("selected.") {
                let key = String(normalized.dropFirst("selected.".count))
                return selection.selected[key]?.anyValue
            }
            return unwrapOptional(
                SelectorUtil.resolve(selectionDictionary(selection), selector: normalized)
            )
        }
    }

    private static func dashboardValuesEqual(actual: Any?, expected: JSONValue) -> Bool {
        if let primitive = jsonPrimitiveValue(expected) {
            return dashboardPrimitiveValuesEqual(actual: actual, expected: primitive)
        }
        guard let actualJSON = JSONValue(any: unwrapOptional(actual)) else {
            return false
        }
        return actualJSON == expected
    }

    private static func dashboardPrimitiveValuesEqual(actual: Any?, expected: JSONPrimitive) -> Bool {
        let actual = unwrapOptional(actual)
        guard expected.anyValue != nil else { return actual == nil }
        switch expected {
        case .string(let string):
            return String(describing: actual ?? "") == string
        case .bool(let bool):
            if let actualBool = actual as? Bool {
                return actualBool == bool
            }
            return false
        case .number(let number):
            return numericValue(actual) == number
        case .null:
            return actual == nil
        }
    }

    private static func numericValue(_ value: Any?) -> Double? {
        let value = unwrapOptional(value)
        switch value {
        case let number as Double:
            return number
        case let number as Float:
            return Double(number)
        case let number as Int:
            return Double(number)
        case let number as Int64:
            return Double(number)
        case let number as NSNumber:
            return number.doubleValue
        case let string as String:
            return Double(string.trimmingCharacters(in: .whitespacesAndNewlines))
        case let primitive as JSONPrimitive:
            if case .number(let number) = primitive { return number }
            if case .string(let string) = primitive {
                return Double(string.trimmingCharacters(in: .whitespacesAndNewlines))
            }
            return nil
        default:
            return nil
        }
    }

    private static func dashboardDateValue(_ value: Any?) -> Date? {
        let value = unwrapOptional(value)
        if let date = value as? Date {
            return date
        }
        if let number = numericValue(value) {
            return Date(timeIntervalSince1970: number / 1000)
        }
        if let primitive = value as? JSONPrimitive,
           case .string(let string) = primitive {
            return dashboardDateValue(string)
        }
        guard let string = value as? String else {
            return nil
        }
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return nil
        }
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = isoFormatter.date(from: trimmed) {
            return date
        }
        isoFormatter.formatOptions = [.withInternetDateTime]
        if let date = isoFormatter.date(from: trimmed) {
            return date
        }
        let dateOnlyFormatter = DateFormatter()
        dateOnlyFormatter.locale = Locale(identifier: "en_US_POSIX")
        dateOnlyFormatter.timeZone = TimeZone(secondsFromGMT: 0)
        dateOnlyFormatter.dateFormat = "yyyy-MM-dd"
        return dateOnlyFormatter.date(from: trimmed)
    }

    private static func dashboardToneNumber(_ value: Any?) -> Double? {
        if let number = numericValue(value) {
            return number
        }
        let unwrapped = unwrapOptional(value)
        if let string = unwrapped as? String {
            return Double(string.trimmingCharacters(in: .whitespacesAndNewlines))
        }
        if let primitive = unwrapped as? JSONPrimitive,
           case .string(let string) = primitive {
            return Double(string.trimmingCharacters(in: .whitespacesAndNewlines))
        }
        return nil
    }

    private static func dashboardDimensionMetricValue(_ row: [String: JSONValue], metricKey: String) -> Double {
        numericValue(SelectorUtil.resolve(row.mapValues(dashboardFilterJSONAny), selector: metricKey)) ?? 0
    }

    private static func dashboardGeoMapText(_ row: [String: Any], selectors: [String]) -> String? {
        for selector in selectors {
            guard let resolved = SelectorUtil.resolve(row, selector: selector) else { continue }
            let text = String(describing: resolved).trimmingCharacters(in: .whitespacesAndNewlines)
            if !text.isEmpty {
                return text
            }
        }
        return nil
    }

    private static func dashboardGeoMapNumber(_ row: [String: Any], selector: String) -> Double? {
        guard let resolved = SelectorUtil.resolve(row, selector: selector) else {
            return nil
        }
        if let number = numericValue(resolved) {
            return number
        }
        if let text = resolved as? String {
            return Double(text.trimmingCharacters(in: .whitespacesAndNewlines))
        }
        return nil
    }

    private static func jsonPrimitiveValue(_ value: JSONValue) -> JSONPrimitive? {
        switch value {
        case .string(let string):
            return .string(string)
        case .number(let number):
            return .number(number)
        case .bool(let bool):
            return .bool(bool)
        case .null:
            return .null
        case .array, .object:
            return nil
        }
    }

    private static func nonBlank(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
            return nil
        }
        return trimmed
    }

    private static func isEmpty(_ value: Any?) -> Bool {
        let value = unwrapOptional(value)
        switch value {
        case nil:
            return true
        case let string as String:
            return string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case let array as [Any]:
            return array.isEmpty
        case let object as [String: Any]:
            return object.isEmpty
        case let object as [String: JSONPrimitive]:
            return object.isEmpty
        case let primitive as JSONPrimitive:
            switch primitive {
            case .string(let string):
                return string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            case .null:
                return true
            default:
                return false
            }
        default:
            return false
        }
    }

    private static func isPresent(_ value: Any?) -> Bool {
        !isEmpty(value)
    }

    private static func formatCompactNumber(_ value: Double, locale: Locale) -> String {
        let absolute = abs(value)
        let scaled: Double
        let suffix: String
        switch absolute {
        case 1_000_000_000...:
            scaled = value / 1_000_000_000
            suffix = "B"
        case 1_000_000...:
            scaled = value / 1_000_000
            suffix = "M"
        case 1_000...:
            scaled = value / 1_000
            suffix = "K"
        default:
            scaled = value
            suffix = ""
        }
        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = suffix.isEmpty ? 0 : 1
        formatter.minimumFractionDigits = 0
        return (formatter.string(from: NSNumber(value: scaled)) ?? String(scaled)) + suffix
    }

    private static func unwrapOptional(_ value: Any?) -> Any? {
        guard let value else { return nil }
        let mirror = Mirror(reflecting: value)
        guard mirror.displayStyle == .optional else { return value }
        return mirror.children.first?.value
    }
}

private func dashboardFilterValueEquals(filterValue: Any?, rowValue: Any?) -> Bool {
    guard let filterValue, let rowValue else { return false }
    return String(describing: filterValue).caseInsensitiveCompare(String(describing: rowValue)) == .orderedSame
}

private func dashboardFilterJSONAny(_ value: JSONValue) -> Any {
    switch value {
    case .string(let string):
        return string
    case .number(let number):
        return number
    case .bool(let bool):
        return bool
    case .array(let values):
        return values.map(dashboardFilterJSONAny)
    case .object(let object):
        return object.mapValues(dashboardFilterJSONAny)
    case .null:
        return NSNull()
    }
}

public extension ForgeRuntime {
    func dashboardFilterState(windowID: String, container: ContainerDef) async -> [String: JSONValue] {
        let signal = await signals.dashboardFilters(
            key: DashboardRuntime.dashboardKey(window: WindowContext(windowID: windowID), container: container)
        )
        return await signal.peek()
    }

    func dashboardFilterUpdates(windowID: String, container: ContainerDef) async -> AsyncStream<[String: JSONValue]> {
        let signal = await signals.dashboardFilters(
            key: DashboardRuntime.dashboardKey(window: WindowContext(windowID: windowID), container: container)
        )
        return await signal.stream()
    }

    func setDashboardFilters(windowID: String, container: ContainerDef, filters: [String: JSONValue]) async {
        let signal = await signals.dashboardFilters(
            key: DashboardRuntime.dashboardKey(window: WindowContext(windowID: windowID), container: container)
        )
        await signal.set(filters)
    }

    func dashboardSelectionState(windowID: String, container: ContainerDef) async -> DashboardSelectionState {
        let signal = await signals.dashboardSelection(
            key: DashboardRuntime.dashboardKey(window: WindowContext(windowID: windowID), container: container)
        )
        return await signal.peek()
    }

    func dashboardSelectionUpdates(windowID: String, container: ContainerDef) async -> AsyncStream<DashboardSelectionState> {
        let signal = await signals.dashboardSelection(
            key: DashboardRuntime.dashboardKey(window: WindowContext(windowID: windowID), container: container)
        )
        return await signal.stream()
    }

    func setDashboardSelection(windowID: String, container: ContainerDef, selection: DashboardSelectionState) async {
        let signal = await signals.dashboardSelection(
            key: DashboardRuntime.dashboardKey(window: WindowContext(windowID: windowID), container: container)
        )
        await signal.set(selection)
    }
}

private func interpolateDashboardPlaceholders(
    _ template: String,
    resolver: (String) -> String
) -> String {
    var result = ""
    var index = template.startIndex
    while index < template.endIndex {
        if template[index...].hasPrefix("${"),
           let close = template[index...].firstIndex(of: "}") {
            let selectorStart = template.index(index, offsetBy: 2)
            let selector = template[selectorStart..<close].trimmingCharacters(in: .whitespacesAndNewlines)
            result += resolver(selector)
            index = template.index(after: close)
            continue
        }
        if template[index...].hasPrefix("{{"),
           let close = template[index...].range(of: "}}")?.lowerBound {
            let selectorStart = template.index(index, offsetBy: 2)
            let selector = template[selectorStart..<close].trimmingCharacters(in: .whitespacesAndNewlines)
            result += resolver(selector)
            index = template.index(close, offsetBy: 2)
            continue
        }
        result.append(template[index])
        index = template.index(after: index)
    }
    return result
}

private extension String {
    func replacingMatches(
        of pattern: String,
        with transform: (String) -> String
    ) -> String {
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return self
        }
        let nsRange = NSRange(startIndex..<endIndex, in: self)
        var result = self
        let matches = regex.matches(in: self, range: nsRange).reversed()
        for match in matches {
            guard match.numberOfRanges > 1,
                  let fullRange = Range(match.range(at: 0), in: result),
                  let captureRange = Range(match.range(at: 1), in: result) else {
                continue
            }
            let replacement = transform(String(result[captureRange]).trimmingCharacters(in: .whitespacesAndNewlines))
            result.replaceSubrange(fullRange, with: replacement)
        }
        return result
    }
}

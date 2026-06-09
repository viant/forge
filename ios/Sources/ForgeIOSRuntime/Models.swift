import Foundation

public struct WindowMetadata: Codable, Sendable {
    public let namespace: String?
    public let view: ViewDef?
    public let dialogs: [DialogDef]
    public let dataSources: [String: DataSourceDef]
    public let actions: ActionsDef?
    public let on: [EventExecutionDef]
    public let target: JSONValue?
    public let targetOverrides: [String: JSONValue]

    enum CodingKeys: String, CodingKey {
        case namespace
        case view
        case dialogs
        case dataSources
        case actions
        case on
        case target
        case targetOverrides
    }

    enum LegacyCodingKeys: String, CodingKey {
        case dataSource
    }

    public init(
        namespace: String? = nil,
        view: ViewDef? = nil,
        dialogs: [DialogDef] = [],
        dataSources: [String: DataSourceDef] = [:],
        actions: ActionsDef? = nil,
        on: [EventExecutionDef] = [],
        target: JSONValue? = nil,
        targetOverrides: [String: JSONValue] = [:]
    ) {
        self.namespace = namespace
        self.view = view
        self.dialogs = dialogs
        self.dataSources = dataSources
        self.actions = actions
        self.on = on
        self.target = target
        self.targetOverrides = targetOverrides
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let legacyContainer = try decoder.container(keyedBy: LegacyCodingKeys.self)
        namespace = try container.decodeIfPresent(String.self, forKey: .namespace)
        let decodedView = try container.decodeIfPresent(ViewDef.self, forKey: .view)
        dialogs = try container.decodeIfPresent([DialogDef].self, forKey: .dialogs) ?? []
        dataSources = try container.decodeIfPresent([String: DataSourceDef].self, forKey: .dataSources)
            ?? legacyContainer.decodeIfPresent([String: DataSourceDef].self, forKey: .dataSource)
            ?? [:]
        actions = try container.decodeIfPresent(ActionsDef.self, forKey: .actions)
        on = try container.decodeIfPresent([EventExecutionDef].self, forKey: .on) ?? []
        target = try container.decodeIfPresent(JSONValue.self, forKey: .target)
        targetOverrides = try container.decodeIfPresent([String: JSONValue].self, forKey: .targetOverrides) ?? [:]
        if let decodedView,
           Self.isMeaningfulView(decodedView) {
            view = decodedView
        } else if let topLevelContainer = try? ContainerDef(from: decoder),
                  Self.isMeaningfulTopLevelContainer(topLevelContainer) {
            view = ViewDef(
                content: ContentDef(
                    containers: [topLevelContainer]
                )
            )
        } else {
            view = nil
        }
    }

    private static func isMeaningfulTopLevelContainer(_ container: ContainerDef) -> Bool {
        container.kind?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            || container.title?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            || container.dashboard != nil
            || container.chart != nil
            || container.table != nil
            || container.schemaBasedForm != nil
            || container.tabs != nil
            || !container.items.isEmpty
            || !container.containers.isEmpty
    }

    private static func isMeaningfulView(_ view: ViewDef) -> Bool {
        !(view.content?.containers.isEmpty ?? true)
    }
}

public struct ActionsDef: Codable, Sendable {
    public let code: String?

    public init(code: String? = nil) {
        self.code = code
    }
}

public struct DialogDef: Codable, Sendable, Identifiable {
    public let id: String?
    public let title: String?
    public let dataSourceRef: String?
    public let selectionMode: String?
    public let content: ContainerDef?
    public let on: [ExecutionDef]
    public let actions: [ActionDef]
    public let properties: [String: JSONValue]
    public let style: [String: String]
    public let target: JSONValue?
    public let targetOverrides: [String: JSONValue]

    public init(
        id: String? = nil,
        title: String? = nil,
        dataSourceRef: String? = nil,
        selectionMode: String? = nil,
        content: ContainerDef? = nil,
        on: [ExecutionDef] = [],
        actions: [ActionDef] = [],
        properties: [String: JSONValue] = [:],
        style: [String: String] = [:],
        target: JSONValue? = nil,
        targetOverrides: [String: JSONValue] = [:]
    ) {
        self.id = id
        self.title = title
        self.dataSourceRef = dataSourceRef
        self.selectionMode = selectionMode
        self.content = content
        self.on = on
        self.actions = actions
        self.properties = properties
        self.style = style
        self.target = target
        self.targetOverrides = targetOverrides
    }

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case dataSourceRef
        case selectionMode
        case content
        case on
        case actions
        case properties
        case style
        case target
        case targetOverrides
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        dataSourceRef = try container.decodeIfPresent(String.self, forKey: .dataSourceRef)
        selectionMode = try container.decodeIfPresent(String.self, forKey: .selectionMode)
        content = try container.decodeIfPresent(ContainerDef.self, forKey: .content)
        on = try container.decodeIfPresent([ExecutionDef].self, forKey: .on) ?? []
        actions = try container.decodeIfPresent([ActionDef].self, forKey: .actions) ?? []
        properties = try container.decodeIfPresent([String: JSONValue].self, forKey: .properties) ?? [:]
        style = try container.decodeIfPresent([String: String].self, forKey: .style) ?? [:]
        target = try container.decodeIfPresent(JSONValue.self, forKey: .target)
        targetOverrides = try container.decodeIfPresent([String: JSONValue].self, forKey: .targetOverrides) ?? [:]
    }
}

public struct ActionDef: Codable, Sendable, Identifiable {
    public let id: String?
    public let label: String?
    public let icon: String?
    public let on: [ExecutionDef]
    public let target: JSONValue?
    public let targetOverrides: [String: JSONValue]

    public init(
        id: String? = nil,
        label: String? = nil,
        icon: String? = nil,
        on: [ExecutionDef] = [],
        target: JSONValue? = nil,
        targetOverrides: [String: JSONValue] = [:]
    ) {
        self.id = id
        self.label = label
        self.icon = icon
        self.on = on
        self.target = target
        self.targetOverrides = targetOverrides
    }

    enum CodingKeys: String, CodingKey {
        case id
        case label
        case icon
        case on
        case target
        case targetOverrides
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
        label = try container.decodeIfPresent(String.self, forKey: .label)
        icon = try container.decodeIfPresent(String.self, forKey: .icon)
        on = try container.decodeIfPresent([ExecutionDef].self, forKey: .on) ?? []
        target = try container.decodeIfPresent(JSONValue.self, forKey: .target)
        targetOverrides = try container.decodeIfPresent([String: JSONValue].self, forKey: .targetOverrides) ?? [:]
    }
}

public struct EventExecutionDef: Codable, Sendable {
    public let event: String?
    public let handler: String?
    public let args: [String]
    public let parameters: [ParameterDef]

    enum CodingKeys: String, CodingKey {
        case event
        case handler
        case action
        case args
        case parameters
    }

    public init(
        event: String? = nil,
        handler: String? = nil,
        args: [String] = [],
        parameters: [ParameterDef] = []
    ) {
        self.event = event
        self.handler = handler
        self.args = args
        self.parameters = parameters
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        event = try container.decodeIfPresent(String.self, forKey: .event)
        handler = try container.decodeIfPresent(String.self, forKey: .handler)
            ?? container.decodeIfPresent(String.self, forKey: .action)
        args = try container.decodeIfPresent([String].self, forKey: .args) ?? []
        parameters = try container.decodeIfPresent([ParameterDef].self, forKey: .parameters) ?? []
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(event, forKey: .event)
        try container.encodeIfPresent(handler, forKey: .handler)
        try container.encode(args, forKey: .args)
        try container.encode(parameters, forKey: .parameters)
    }

    public var executionDef: ExecutionDef? {
        guard let handler, !handler.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return nil
        }
        return ExecutionDef(action: handler, args: args, parameters: parameters)
    }
}

public struct ViewDef: Codable, Sendable {
    public let content: ContentDef?
    public let target: JSONValue?
    public let targetOverrides: [String: JSONValue]

    enum CodingKeys: String, CodingKey {
        case content
        case target
        case targetOverrides
    }

    public init(content: ContentDef? = nil, target: JSONValue? = nil, targetOverrides: [String: JSONValue] = [:]) {
        self.content = content
        self.target = target
        self.targetOverrides = targetOverrides
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        content = try container.decodeIfPresent(ContentDef.self, forKey: .content)
        target = try container.decodeIfPresent(JSONValue.self, forKey: .target)
        targetOverrides = try container.decodeIfPresent([String: JSONValue].self, forKey: .targetOverrides) ?? [:]
    }
}

public struct ContentDef: Codable, Sendable {
    public let id: String?
    public let layout: LayoutDef?
    public let containers: [ContainerDef]
    public let target: JSONValue?
    public let targetOverrides: [String: JSONValue]

    enum CodingKeys: String, CodingKey {
        case id
        case layout
        case containers
        case target
        case targetOverrides
    }

    public init(
        id: String? = nil,
        layout: LayoutDef? = nil,
        containers: [ContainerDef] = [],
        target: JSONValue? = nil,
        targetOverrides: [String: JSONValue] = [:]
    ) {
        self.id = id
        self.layout = layout
        self.containers = containers
        self.target = target
        self.targetOverrides = targetOverrides
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let decodedContainers = try container.decodeIfPresent([ContainerDef].self, forKey: .containers) ?? []
        id = try container.decodeIfPresent(String.self, forKey: .id)
        layout = try container.decodeIfPresent(LayoutDef.self, forKey: .layout)
        target = try container.decodeIfPresent(JSONValue.self, forKey: .target)
        targetOverrides = try container.decodeIfPresent([String: JSONValue].self, forKey: .targetOverrides) ?? [:]
        if !decodedContainers.isEmpty {
            containers = decodedContainers
        } else if let topLevelContainer = try? ContainerDef(from: decoder),
                  Self.isMeaningfulTopLevelContainer(topLevelContainer) {
            containers = [topLevelContainer]
        } else {
            containers = []
        }
    }

    private static func isMeaningfulTopLevelContainer(_ container: ContainerDef) -> Bool {
        container.kind?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            || container.title?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            || container.dashboard != nil
            || container.chart != nil
            || container.table != nil
            || container.schemaBasedForm != nil
            || container.tabs != nil
            || !container.items.isEmpty
            || !container.containers.isEmpty
    }
}

public struct ContainerDef: Codable, Sendable, Identifiable {
    public let id: String?
    public let title: String?
    public let subtitle: String?
    public let kind: String?
    public let scrollMode: String?
    public let dataSourceRef: String?
    public let columnSpan: Int?
    public let rowSpan: Int?
    public let filterBindings: [String: String]
    public let visibleWhen: DashboardConditionDef?
    public let metrics: [DashboardMetricDef]
    public let checks: [DashboardStatusCheckDef]
    public let rows: [DashboardKPIRowDef]
    public let sections: [DashboardReportSectionDef]
    public let fields: DashboardFeedFieldsDef?
    public let dimension: DashboardFieldDef?
    public let metric: DashboardFieldDef?
    public let viewModes: [String]
    public let limit: Int?
    public let orderBy: String?
    public let containers: [ContainerDef]
    public let selectFirst: Bool?
    public let layout: LayoutDef?
    public let stateKey: String?
    public let schemaBasedForm: SchemaBasedFormDef?
    public let dashboard: DashboardDef?
    public let tabs: TabsDef?
    public let items: [ItemDef]
    public let chart: ChartDef?
    public let table: TableDef?
    public let treeBrowser: TreeBrowserDef?
    public let editor: EditorDef?
    public let fetchData: Bool?
    public let target: JSONValue?
    public let targetOverrides: [String: JSONValue]

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case subtitle
        case kind
        case scrollMode
        case dataSourceRef
        case columnSpan
        case rowSpan
        case filterBindings
        case visibleWhen
        case metrics
        case checks
        case rows
        case sections
        case fields
        case dimension
        case metric
        case viewModes
        case limit
        case orderBy
        case containers
        case selectFirst
        case layout
        case stateKey
        case schemaBasedForm
        case dashboard
        case summary
        case compare
        case kpiTable
        case filters
        case timeline
        case dimensions
        case messages
        case status
        case feed
        case report
        case reportBuilder
        case detail
        case tabs
        case items
        case chart
        case table
        case treeBrowser
        case editor
        case fetchData
        case target
        case targetOverrides
    }

    public init(
        id: String? = nil,
        title: String? = nil,
        subtitle: String? = nil,
        kind: String? = nil,
        scrollMode: String? = nil,
        dataSourceRef: String? = nil,
        columnSpan: Int? = nil,
        rowSpan: Int? = nil,
        filterBindings: [String: String] = [:],
        visibleWhen: DashboardConditionDef? = nil,
        metrics: [DashboardMetricDef] = [],
        checks: [DashboardStatusCheckDef] = [],
        rows: [DashboardKPIRowDef] = [],
        sections: [DashboardReportSectionDef] = [],
        fields: DashboardFeedFieldsDef? = nil,
        dimension: DashboardFieldDef? = nil,
        metric: DashboardFieldDef? = nil,
        viewModes: [String] = [],
        limit: Int? = nil,
        orderBy: String? = nil,
        containers: [ContainerDef] = [],
        selectFirst: Bool? = nil,
        layout: LayoutDef? = nil,
        stateKey: String? = nil,
        schemaBasedForm: SchemaBasedFormDef? = nil,
        dashboard: DashboardDef? = nil,
        tabs: TabsDef? = nil,
        items: [ItemDef] = [],
        chart: ChartDef? = nil,
        table: TableDef? = nil,
        treeBrowser: TreeBrowserDef? = nil,
        editor: EditorDef? = nil,
        fetchData: Bool? = nil,
        target: JSONValue? = nil,
        targetOverrides: [String: JSONValue] = [:]
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.kind = kind
        self.scrollMode = scrollMode
        self.dataSourceRef = dataSourceRef
        self.columnSpan = columnSpan
        self.rowSpan = rowSpan
        self.filterBindings = filterBindings
        self.visibleWhen = visibleWhen
        self.metrics = metrics
        self.checks = checks
        self.rows = rows
        self.sections = sections
        self.fields = fields
        self.dimension = dimension
        self.metric = metric
        self.viewModes = viewModes
        self.limit = limit
        self.orderBy = orderBy
        self.containers = containers
        self.selectFirst = selectFirst
        self.layout = layout
        self.stateKey = stateKey
        self.schemaBasedForm = schemaBasedForm
        self.dashboard = dashboard
        self.tabs = tabs
        self.items = items
        self.chart = chart
        self.table = table
        self.treeBrowser = treeBrowser
        self.editor = editor
        self.fetchData = fetchData
        self.target = target
        self.targetOverrides = targetOverrides
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        subtitle = try container.decodeIfPresent(String.self, forKey: .subtitle)
        kind = try container.decodeIfPresent(String.self, forKey: .kind)
        scrollMode = try container.decodeIfPresent(String.self, forKey: .scrollMode)
        dataSourceRef = try container.decodeIfPresent(String.self, forKey: .dataSourceRef)
        columnSpan = try container.decodeIfPresent(Int.self, forKey: .columnSpan)
        rowSpan = try container.decodeIfPresent(Int.self, forKey: .rowSpan)
        filterBindings = try container.decodeIfPresent([String: String].self, forKey: .filterBindings) ?? [:]
        visibleWhen = try container.decodeIfPresent(DashboardConditionDef.self, forKey: .visibleWhen)
        metrics = try container.decodeIfPresent([DashboardMetricDef].self, forKey: .metrics) ?? []
        checks = try container.decodeIfPresent([DashboardStatusCheckDef].self, forKey: .checks) ?? []
        rows = try container.decodeIfPresent([DashboardKPIRowDef].self, forKey: .rows) ?? []
        sections = try container.decodeIfPresent([DashboardReportSectionDef].self, forKey: .sections) ?? []
        fields = try container.decodeIfPresent(DashboardFeedFieldsDef.self, forKey: .fields)
        dimension = try container.decodeIfPresent(DashboardFieldDef.self, forKey: .dimension)
        metric = try container.decodeIfPresent(DashboardFieldDef.self, forKey: .metric)
        viewModes = try container.decodeIfPresent([String].self, forKey: .viewModes) ?? []
        limit = try container.decodeIfPresent(Int.self, forKey: .limit)
        orderBy = try container.decodeIfPresent(String.self, forKey: .orderBy)
        containers = try container.decodeIfPresent([ContainerDef].self, forKey: .containers) ?? []
        selectFirst = try container.decodeIfPresent(Bool.self, forKey: .selectFirst)
        layout = try container.decodeIfPresent(LayoutDef.self, forKey: .layout)
        stateKey = try container.decodeIfPresent(String.self, forKey: .stateKey)
        schemaBasedForm = try container.decodeIfPresent(SchemaBasedFormDef.self, forKey: .schemaBasedForm)
        dashboard = try container.decodeIfPresent(DashboardDef.self, forKey: .dashboard)
            ?? Self.synthesizedDashboard(from: container)
        tabs = try container.decodeIfPresent(TabsDef.self, forKey: .tabs)
        items = try container.decodeIfPresent([ItemDef].self, forKey: .items) ?? []
        chart = try container.decodeIfPresent(ChartDef.self, forKey: .chart)
        table = try container.decodeIfPresent(TableDef.self, forKey: .table)
        treeBrowser = try container.decodeIfPresent(TreeBrowserDef.self, forKey: .treeBrowser)
        editor = try container.decodeIfPresent(EditorDef.self, forKey: .editor)
        fetchData = try container.decodeIfPresent(Bool.self, forKey: .fetchData)
        target = try container.decodeIfPresent(JSONValue.self, forKey: .target)
        targetOverrides = try container.decodeIfPresent([String: JSONValue].self, forKey: .targetOverrides) ?? [:]
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(id, forKey: .id)
        try container.encodeIfPresent(title, forKey: .title)
        try container.encodeIfPresent(subtitle, forKey: .subtitle)
        try container.encodeIfPresent(kind, forKey: .kind)
        try container.encodeIfPresent(scrollMode, forKey: .scrollMode)
        try container.encodeIfPresent(dataSourceRef, forKey: .dataSourceRef)
        try container.encodeIfPresent(columnSpan, forKey: .columnSpan)
        try container.encodeIfPresent(rowSpan, forKey: .rowSpan)
        try container.encode(filterBindings, forKey: .filterBindings)
        try container.encodeIfPresent(visibleWhen, forKey: .visibleWhen)
        try container.encode(metrics, forKey: .metrics)
        try container.encode(checks, forKey: .checks)
        try container.encode(rows, forKey: .rows)
        try container.encode(sections, forKey: .sections)
        try container.encodeIfPresent(fields, forKey: .fields)
        try container.encodeIfPresent(dimension, forKey: .dimension)
        try container.encodeIfPresent(metric, forKey: .metric)
        try container.encode(viewModes, forKey: .viewModes)
        try container.encodeIfPresent(limit, forKey: .limit)
        try container.encodeIfPresent(orderBy, forKey: .orderBy)
        try container.encode(containers, forKey: .containers)
        try container.encodeIfPresent(selectFirst, forKey: .selectFirst)
        try container.encodeIfPresent(layout, forKey: .layout)
        try container.encodeIfPresent(stateKey, forKey: .stateKey)
        try container.encodeIfPresent(schemaBasedForm, forKey: .schemaBasedForm)
        try container.encodeIfPresent(dashboard, forKey: .dashboard)
        try container.encodeIfPresent(tabs, forKey: .tabs)
        try container.encode(items, forKey: .items)
        try container.encodeIfPresent(chart, forKey: .chart)
        try container.encodeIfPresent(table, forKey: .table)
        try container.encodeIfPresent(treeBrowser, forKey: .treeBrowser)
        try container.encodeIfPresent(editor, forKey: .editor)
        try container.encodeIfPresent(fetchData, forKey: .fetchData)
        try container.encodeIfPresent(target, forKey: .target)
        try container.encode(targetOverrides, forKey: .targetOverrides)
    }

    private static func synthesizedDashboard(
        from container: KeyedDecodingContainer<CodingKeys>
    ) -> DashboardDef? {
        let summary = try? container.decodeIfPresent(DashboardSummaryDef.self, forKey: .summary)
        let compare = try? container.decodeIfPresent(DashboardCompareDef.self, forKey: .compare)
        let kpiTable = try? container.decodeIfPresent(DashboardKPITableDef.self, forKey: .kpiTable)
        let filters = try? container.decodeIfPresent(DashboardFiltersDef.self, forKey: .filters)
        let timeline = try? container.decodeIfPresent(DashboardTimelineDef.self, forKey: .timeline)
        let dimensions = try? container.decodeIfPresent(DashboardDimensionsDef.self, forKey: .dimensions)
        let messages = try? container.decodeIfPresent(DashboardMessagesDef.self, forKey: .messages)
        let status = try? container.decodeIfPresent(DashboardStatusDef.self, forKey: .status)
        let feed = try? container.decodeIfPresent(DashboardFeedDef.self, forKey: .feed)
        let report = try? container.decodeIfPresent(DashboardReportDef.self, forKey: .report)
        let reportBuilder = try? container.decodeIfPresent(DashboardReportBuilderDef.self, forKey: .reportBuilder)
        let detail = try? container.decodeIfPresent(DashboardDetailDef.self, forKey: .detail)

        guard summary != nil
            || compare != nil
            || kpiTable != nil
            || filters != nil
            || timeline != nil
            || dimensions != nil
            || messages != nil
            || status != nil
            || feed != nil
            || report != nil
            || reportBuilder != nil
            || detail != nil else {
            return nil
        }

        return DashboardDef(
            summary: summary,
            compare: compare,
            kpiTable: kpiTable,
            filters: filters,
            timeline: timeline,
            dimensions: dimensions,
            messages: messages,
            status: status,
            feed: feed,
            report: report,
            reportBuilder: reportBuilder,
            detail: detail
        )
    }
}

public struct DataSourceDef: Codable, Sendable {
    public let service: DataSourceServiceDef?
    public let selectionMode: String?
    public let autoSelect: Bool?
    public let autoFetch: Bool?
    public let selectors: DataSourceSelectorDef?
    public let paging: DataSourcePagingDef?
    public let params: [String: String]
    public let parameters: [ParameterDef]
    public let uri: String?
    public let method: String?
    public let target: JSONValue?
    public let targetOverrides: [String: JSONValue]

    enum CodingKeys: String, CodingKey {
        case service
        case selectionMode
        case autoSelect
        case autoFetch
        case selectors
        case paging
        case params
        case parameters
        case uri
        case method
        case target
        case targetOverrides
    }

    public init(
        service: DataSourceServiceDef? = nil,
        selectionMode: String? = nil,
        autoSelect: Bool? = nil,
        autoFetch: Bool? = nil,
        selectors: DataSourceSelectorDef? = nil,
        paging: DataSourcePagingDef? = nil,
        params: [String: String] = [:],
        parameters: [ParameterDef] = [],
        uri: String? = nil,
        method: String? = nil,
        target: JSONValue? = nil,
        targetOverrides: [String: JSONValue] = [:]
    ) {
        self.service = service
        self.selectionMode = selectionMode
        self.autoSelect = autoSelect
        self.autoFetch = autoFetch
        self.selectors = selectors
        self.paging = paging
        self.params = params
        self.parameters = parameters
        self.uri = uri
        self.method = method
        self.target = target
        self.targetOverrides = targetOverrides
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        service = try container.decodeIfPresent(DataSourceServiceDef.self, forKey: .service)
        selectionMode = try container.decodeIfPresent(String.self, forKey: .selectionMode)
        autoSelect = try container.decodeIfPresent(Bool.self, forKey: .autoSelect)
        autoFetch = try container.decodeIfPresent(Bool.self, forKey: .autoFetch)
        selectors = try container.decodeIfPresent(DataSourceSelectorDef.self, forKey: .selectors)
        paging = try container.decodeIfPresent(DataSourcePagingDef.self, forKey: .paging)
        params = try container.decodeIfPresent([String: String].self, forKey: .params) ?? [:]
        parameters = try container.decodeIfPresent([ParameterDef].self, forKey: .parameters) ?? []
        uri = try container.decodeIfPresent(String.self, forKey: .uri)
        method = try container.decodeIfPresent(String.self, forKey: .method)
        target = try container.decodeIfPresent(JSONValue.self, forKey: .target)
        targetOverrides = try container.decodeIfPresent([String: JSONValue].self, forKey: .targetOverrides) ?? [:]
    }
}

public struct DataSourceServiceDef: Codable, Sendable {
    public let endpoint: String?
    public let uri: String?
    public let method: String?

    public init(
        endpoint: String? = nil,
        uri: String? = nil,
        method: String? = nil
    ) {
        self.endpoint = endpoint
        self.uri = uri
        self.method = method
    }
}

public struct DataSourceSelectorDef: Codable, Sendable {
    public let data: String?
    public let dataInfo: String?
    public let metrics: String?
}

public struct DataSourcePagingDef: Codable, Sendable {
    public let size: Int?
    public let enabled: Bool?
    public let parameters: [String: String]
    public let dataInfoSelectors: [String: String]

    public init(
        size: Int? = nil,
        enabled: Bool? = nil,
        parameters: [String: String] = [:],
        dataInfoSelectors: [String: String] = [:]
    ) {
        self.size = size
        self.enabled = enabled
        self.parameters = parameters
        self.dataInfoSelectors = dataInfoSelectors
    }
}

public struct SchemaBasedFormDef: Codable, Sendable {
    public let id: String?
    public let dataBinding: String?
    public let dataSourceRef: String?
    public let fields: [FormFieldDef]
    public let schema: JSONValue?
    public let showSubmit: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case dataBinding
        case dataSourceRef
        case fields
        case schema
        case showSubmit
    }

    enum LegacyCodingKeys: String, CodingKey {
        case datasourceRef
    }

    public init(
        id: String? = nil,
        dataBinding: String? = nil,
        dataSourceRef: String? = nil,
        fields: [FormFieldDef] = [],
        schema: JSONValue? = nil,
        showSubmit: Bool? = nil
    ) {
        self.id = id
        self.dataBinding = dataBinding
        self.dataSourceRef = dataSourceRef
        self.fields = fields
        self.schema = schema
        self.showSubmit = showSubmit
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let legacyContainer = try decoder.container(keyedBy: LegacyCodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
        dataBinding = try container.decodeIfPresent(String.self, forKey: .dataBinding)
        dataSourceRef = try container.decodeIfPresent(String.self, forKey: .dataSourceRef)
            ?? legacyContainer.decodeIfPresent(String.self, forKey: .datasourceRef)
        fields = try container.decodeIfPresent([FormFieldDef].self, forKey: .fields) ?? []
        schema = try container.decodeIfPresent(JSONValue.self, forKey: .schema)
        showSubmit = try container.decodeIfPresent(Bool.self, forKey: .showSubmit)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(id, forKey: .id)
        try container.encodeIfPresent(dataBinding, forKey: .dataBinding)
        try container.encodeIfPresent(dataSourceRef, forKey: .dataSourceRef)
        try container.encode(fields, forKey: .fields)
        try container.encodeIfPresent(schema, forKey: .schema)
        try container.encodeIfPresent(showSubmit, forKey: .showSubmit)
    }
}

public struct FormFieldDef: Codable, Sendable, Identifiable {
    public let name: String?
    public let label: String?
    public let type: String?
    public let required: Bool?
    public let enumValues: [String]
    public let defaultValue: JSONValue?
    public let widget: String?
    public let placeholder: String?

    enum CodingKeys: String, CodingKey {
        case name
        case label
        case type
        case required
        case enumValues = "enum"
        case defaultValue = "default"
        case widget
        case placeholder
    }

    public var id: String { name ?? label ?? UUID().uuidString }
}

public struct DashboardDef: Codable, Sendable {
    public let key: String?
    public let visibleWhen: DashboardConditionDef?
    public let summary: DashboardSummaryDef?
    public let compare: DashboardCompareDef?
    public let kpiTable: DashboardKPITableDef?
    public let filters: DashboardFiltersDef?
    public let timeline: DashboardTimelineDef?
    public let dimensions: DashboardDimensionsDef?
    public let messages: DashboardMessagesDef?
    public let status: DashboardStatusDef?
    public let feed: DashboardFeedDef?
    public let report: DashboardReportDef?
    public let reportBuilder: DashboardReportBuilderDef?
    public let detail: DashboardDetailDef?

    public init(
        key: String? = nil,
        visibleWhen: DashboardConditionDef? = nil,
        summary: DashboardSummaryDef? = nil,
        compare: DashboardCompareDef? = nil,
        kpiTable: DashboardKPITableDef? = nil,
        filters: DashboardFiltersDef? = nil,
        timeline: DashboardTimelineDef? = nil,
        dimensions: DashboardDimensionsDef? = nil,
        messages: DashboardMessagesDef? = nil,
        status: DashboardStatusDef? = nil,
        feed: DashboardFeedDef? = nil,
        report: DashboardReportDef? = nil,
        reportBuilder: DashboardReportBuilderDef? = nil,
        detail: DashboardDetailDef? = nil
    ) {
        self.key = key
        self.visibleWhen = visibleWhen
        self.summary = summary
        self.compare = compare
        self.kpiTable = kpiTable
        self.filters = filters
        self.timeline = timeline
        self.dimensions = dimensions
        self.messages = messages
        self.status = status
        self.feed = feed
        self.report = report
        self.reportBuilder = reportBuilder
        self.detail = detail
    }
}

public struct DashboardReportBuilderDef: Codable, Sendable {
    public let hooks: ReportBuilderHooksDef?
    public let measures: [ReportBuilderMeasureDef]
    public let dimensions: [ReportBuilderDimensionDef]
    public let staticFilters: [ReportBuilderStaticFilterDef]
    public let dynamicFilterGroups: [ReportBuilderDynamicFilterGroupDef]
    public let dynamicFilterFamilies: [ReportBuilderDynamicFilterFamilyDef]
    public let unifiedFamilyRows: Bool
    public let showResultHeader: Bool?
    public let result: ReportBuilderResultDef?

    enum CodingKeys: String, CodingKey {
        case hooks
        case measures
        case dimensions
        case staticFilters
        case dynamicFilterGroups
        case dynamicFilterFamilies
        case unifiedFamilyRows
        case showResultHeader
        case result
    }

    public init(
        hooks: ReportBuilderHooksDef? = nil,
        measures: [ReportBuilderMeasureDef] = [],
        dimensions: [ReportBuilderDimensionDef] = [],
        staticFilters: [ReportBuilderStaticFilterDef] = [],
        dynamicFilterGroups: [ReportBuilderDynamicFilterGroupDef] = [],
        dynamicFilterFamilies: [ReportBuilderDynamicFilterFamilyDef] = [],
        unifiedFamilyRows: Bool = false,
        showResultHeader: Bool? = nil,
        result: ReportBuilderResultDef? = nil
    ) {
        self.hooks = hooks
        self.measures = measures
        self.dimensions = dimensions
        self.staticFilters = staticFilters
        self.dynamicFilterGroups = dynamicFilterGroups
        self.dynamicFilterFamilies = dynamicFilterFamilies
        self.unifiedFamilyRows = unifiedFamilyRows
        self.showResultHeader = showResultHeader
        self.result = result
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        hooks = try container.decodeIfPresent(ReportBuilderHooksDef.self, forKey: .hooks)
        measures = try container.decodeIfPresent([ReportBuilderMeasureDef].self, forKey: .measures) ?? []
        dimensions = try container.decodeIfPresent([ReportBuilderDimensionDef].self, forKey: .dimensions) ?? []
        staticFilters = try container.decodeIfPresent([ReportBuilderStaticFilterDef].self, forKey: .staticFilters) ?? []
        dynamicFilterGroups = try container.decodeIfPresent([ReportBuilderDynamicFilterGroupDef].self, forKey: .dynamicFilterGroups) ?? []
        dynamicFilterFamilies = try container.decodeIfPresent([ReportBuilderDynamicFilterFamilyDef].self, forKey: .dynamicFilterFamilies) ?? []
        unifiedFamilyRows = try container.decodeIfPresent(Bool.self, forKey: .unifiedFamilyRows) ?? false
        showResultHeader = try container.decodeIfPresent(Bool.self, forKey: .showResultHeader)
        result = try container.decodeIfPresent(ReportBuilderResultDef.self, forKey: .result)
    }
}

public struct ReportBuilderHooksDef: Codable, Sendable {
    public let initializeState: String?
    public let buildRequest: String?
    public let resolveLookup: String?

    public init(
        initializeState: String? = nil,
        buildRequest: String? = nil,
        resolveLookup: String? = nil
    ) {
        self.initializeState = initializeState
        self.buildRequest = buildRequest
        self.resolveLookup = resolveLookup
    }
}

public struct ReportBuilderMeasureDef: Codable, Sendable, Identifiable {
    public let id: String?
    public let key: String?
    public let label: String?
    public let format: String?
    public let paramPath: String?
    public let defaultValue: Bool?
    public let color: String?
    public let hidden: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case key
        case label
        case format
        case paramPath
        case defaultValue = "default"
        case color
        case hidden
    }

    public var identityKey: String { key ?? id ?? UUID().uuidString }
}

public struct ReportBuilderDimensionDef: Codable, Sendable, Identifiable {
    public let id: String?
    public let key: String?
    public let label: String?
    public let format: String?
    public let paramPath: String?
    public let defaultValue: Bool?
    public let chartAxis: Bool?
    public let hidden: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case key
        case label
        case format
        case paramPath
        case defaultValue = "default"
        case chartAxis
        case hidden
    }

    public var identityKey: String { key ?? id ?? UUID().uuidString }
}

public struct ReportBuilderResultDef: Codable, Sendable {
    public let chartCreationMode: String?
    public let defaultMode: String?
    public let viewModes: [String]
    public let chartType: String?
    public let chartWizard: ReportBuilderChartWizardDef?
    public let defaultChartSpecs: [ReportBuilderChartSpecDef]

    enum CodingKeys: String, CodingKey {
        case chartCreationMode
        case defaultMode
        case viewModes
        case chartType
        case chartWizard
        case defaultChartSpecs
    }

    public init(
        chartCreationMode: String? = nil,
        defaultMode: String? = nil,
        viewModes: [String] = [],
        chartType: String? = nil,
        chartWizard: ReportBuilderChartWizardDef? = nil,
        defaultChartSpecs: [ReportBuilderChartSpecDef] = []
    ) {
        self.chartCreationMode = chartCreationMode
        self.defaultMode = defaultMode
        self.viewModes = viewModes
        self.chartType = chartType
        self.chartWizard = chartWizard
        self.defaultChartSpecs = defaultChartSpecs
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        chartCreationMode = try container.decodeIfPresent(String.self, forKey: .chartCreationMode)
        defaultMode = try container.decodeIfPresent(String.self, forKey: .defaultMode)
        viewModes = try container.decodeIfPresent([String].self, forKey: .viewModes) ?? []
        chartType = try container.decodeIfPresent(String.self, forKey: .chartType)
        chartWizard = try container.decodeIfPresent(ReportBuilderChartWizardDef.self, forKey: .chartWizard)
        defaultChartSpecs = try container.decodeIfPresent([ReportBuilderChartSpecDef].self, forKey: .defaultChartSpecs) ?? []
    }
}

public struct ReportBuilderStaticFilterDef: Codable, Sendable, Identifiable {
    public let id: String?
    public let label: String?
    public let type: String?
    public let required: Bool?
    public let multiple: Bool?
    public let paramPath: String?
    public let startParamPath: String?
    public let endParamPath: String?
    public let options: [ReportBuilderStaticFilterOptionDef]
    public let defaultValue: JSONValue?

    enum CodingKeys: String, CodingKey {
        case id
        case label
        case type
        case required
        case multiple
        case paramPath
        case startParamPath
        case endParamPath
        case options
        case defaultValue = "default"
    }

    public var identityKey: String { id ?? label ?? UUID().uuidString }

    public init(
        id: String? = nil,
        label: String? = nil,
        type: String? = nil,
        required: Bool? = nil,
        multiple: Bool? = nil,
        paramPath: String? = nil,
        startParamPath: String? = nil,
        endParamPath: String? = nil,
        options: [ReportBuilderStaticFilterOptionDef] = [],
        defaultValue: JSONValue? = nil
    ) {
        self.id = id
        self.label = label
        self.type = type
        self.required = required
        self.multiple = multiple
        self.paramPath = paramPath
        self.startParamPath = startParamPath
        self.endParamPath = endParamPath
        self.options = options
        self.defaultValue = defaultValue
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
        label = try container.decodeIfPresent(String.self, forKey: .label)
        type = try container.decodeIfPresent(String.self, forKey: .type)
        required = try container.decodeIfPresent(Bool.self, forKey: .required)
        multiple = try container.decodeIfPresent(Bool.self, forKey: .multiple)
        paramPath = try container.decodeIfPresent(String.self, forKey: .paramPath)
        startParamPath = try container.decodeIfPresent(String.self, forKey: .startParamPath)
        endParamPath = try container.decodeIfPresent(String.self, forKey: .endParamPath)
        options = try container.decodeIfPresent([ReportBuilderStaticFilterOptionDef].self, forKey: .options) ?? []
        defaultValue = try container.decodeIfPresent(JSONValue.self, forKey: .defaultValue)
    }
}

public struct ReportBuilderStaticFilterOptionDef: Codable, Sendable, Identifiable {
    public let value: JSONValue?
    public let label: String?
    public let icon: String?
    public let defaultValue: Bool?

    enum CodingKeys: String, CodingKey {
        case value
        case label
        case icon
        case defaultValue = "default"
    }

    public var id: String { value?.stringValue ?? label ?? UUID().uuidString }
}

public struct ReportBuilderDynamicFilterGroupDef: Codable, Sendable, Identifiable {
    public let id: String?
    public let label: String?
    public let description: String?
    public let filters: [ReportBuilderDynamicFilterDef]

    enum CodingKeys: String, CodingKey {
        case id
        case label
        case description
        case filters
    }

    public init(
        id: String? = nil,
        label: String? = nil,
        description: String? = nil,
        filters: [ReportBuilderDynamicFilterDef] = []
    ) {
        self.id = id
        self.label = label
        self.description = description
        self.filters = filters
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
        label = try container.decodeIfPresent(String.self, forKey: .label)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        filters = try container.decodeIfPresent([ReportBuilderDynamicFilterDef].self, forKey: .filters) ?? []
    }

    public var identityKey: String { id ?? label ?? UUID().uuidString }
}

public struct ReportBuilderDynamicFilterDef: Codable, Sendable, Identifiable {
    public let id: String?
    public let label: String?
    public let paramPath: String?
    public let multiple: Bool?
    public let emitArray: Bool?
    public let manualEntry: Bool?
    public let manualValueType: String?
    public let manualPlaceholder: String?
    public let dialogId: String?
    public let valueSelector: String?
    public let labelSelector: String?
    public let groupSelector: String?
    public let recordSelectors: [String]?
    public let requestMapping: String?
    public let targetingFeatureKey: String?

    public var identityKey: String { id ?? label ?? UUID().uuidString }
}

public struct ReportBuilderDynamicFilterFamilyDef: Codable, Sendable, Identifiable {
    public let id: String?
    public let label: String?
    public let description: String?
    public let includeFilterIds: [String]
    public let excludeFilterIds: [String]

    enum CodingKeys: String, CodingKey {
        case id
        case label
        case description
        case includeFilterIds
        case excludeFilterIds
    }

    public init(
        id: String? = nil,
        label: String? = nil,
        description: String? = nil,
        includeFilterIds: [String] = [],
        excludeFilterIds: [String] = []
    ) {
        self.id = id
        self.label = label
        self.description = description
        self.includeFilterIds = includeFilterIds
        self.excludeFilterIds = excludeFilterIds
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
        label = try container.decodeIfPresent(String.self, forKey: .label)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        includeFilterIds = try container.decodeIfPresent([String].self, forKey: .includeFilterIds) ?? []
        excludeFilterIds = try container.decodeIfPresent([String].self, forKey: .excludeFilterIds) ?? []
    }

    public var identityKey: String { id ?? label ?? UUID().uuidString }
}

public struct ReportBuilderChartWizardDef: Codable, Sendable {
    public let supportedTypes: [String]

    public init(supportedTypes: [String] = []) {
        self.supportedTypes = supportedTypes
    }

    enum CodingKeys: String, CodingKey {
        case supportedTypes
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        supportedTypes = try container.decodeIfPresent([String].self, forKey: .supportedTypes) ?? []
    }
}

public struct ReportBuilderChartSpecDef: Codable, Sendable, Identifiable {
    public let title: String?
    public let type: String?
    public let xField: String?
    public let yFields: [String]
    public let seriesField: String?

    enum CodingKeys: String, CodingKey {
        case title
        case type
        case xField
        case yFields
        case seriesField
    }

    public init(
        title: String? = nil,
        type: String? = nil,
        xField: String? = nil,
        yFields: [String] = [],
        seriesField: String? = nil
    ) {
        self.title = title
        self.type = type
        self.xField = xField
        self.yFields = yFields
        self.seriesField = seriesField
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        type = try container.decodeIfPresent(String.self, forKey: .type)
        xField = try container.decodeIfPresent(String.self, forKey: .xField)
        yFields = try container.decodeIfPresent([String].self, forKey: .yFields) ?? []
        seriesField = try container.decodeIfPresent(String.self, forKey: .seriesField)
    }

    public var id: String { title ?? xField ?? UUID().uuidString }
}

public struct DashboardSummaryDef: Codable, Sendable {
    public let metrics: [DashboardMetricDef]

    public init(metrics: [DashboardMetricDef] = []) {
        self.metrics = metrics
    }
}

public struct DashboardMetricDef: Codable, Sendable {
    public let id: String?
    public let label: String?
    public let selector: String?
    public let format: String?
    public let tone: String?

    public init(
        id: String? = nil,
        label: String? = nil,
        selector: String? = nil,
        format: String? = nil,
        tone: String? = nil
    ) {
        self.id = id
        self.label = label
        self.selector = selector
        self.format = format
        self.tone = tone
    }
}

public struct DashboardCompareDef: Codable, Sendable {
    public let items: [DashboardCompareItemDef]
}

public struct DashboardCompareItemDef: Codable, Sendable, Identifiable {
    public let id: String?
    public let label: String?
    public let current: String?
    public let previous: String?
    public let format: String?
    public let deltaFormat: String?
    public let positiveIsUp: Bool?
    public let deltaLabel: String?
}

public struct DashboardKPITableDef: Codable, Sendable {
    public let rows: [DashboardKPIRowDef]
}

public struct DashboardKPIRowDef: Codable, Sendable, Identifiable {
    public let id: String?
    public let label: String?
    public let value: String?
    public let format: String?
    public let context: String?
    public let contextTone: String?
}

public struct DashboardFiltersDef: Codable, Sendable {
    public let items: [DashboardFilterItemDef]

    public init(items: [DashboardFilterItemDef] = []) {
        self.items = items
    }
}

public struct DashboardFilterItemDef: Codable, Sendable, Identifiable {
    public let id: String?
    public let label: String?
    public let field: String?
    public let multiple: Bool?
    public let options: [DashboardFilterOptionDef]

    public init(
        id: String? = nil,
        label: String? = nil,
        field: String? = nil,
        multiple: Bool? = nil,
        options: [DashboardFilterOptionDef] = []
    ) {
        self.id = id
        self.label = label
        self.field = field
        self.multiple = multiple
        self.options = options
    }
}

public struct DashboardFilterOptionDef: Codable, Sendable, Identifiable {
    public let label: String?
    public let value: String?
    public let defaultValue: Bool?

    enum CodingKeys: String, CodingKey {
        case label
        case value
        case defaultValue = "default"
    }

    public init(
        label: String? = nil,
        value: String? = nil,
        defaultValue: Bool? = nil
    ) {
        self.label = label
        self.value = value
        self.defaultValue = defaultValue
    }

    public var id: String { value ?? label ?? UUID().uuidString }
}

public struct DashboardTimelineDef: Codable, Sendable {
    public let viewModes: [String]
    public let annotations: DashboardAnnotationDef?

    public init(viewModes: [String] = [], annotations: DashboardAnnotationDef? = nil) {
        self.viewModes = viewModes
        self.annotations = annotations
    }
}

public struct DashboardAnnotationDef: Codable, Sendable {
    public let selector: String?
}

public struct DashboardDimensionsDef: Codable, Sendable {
    public let dimension: DashboardFieldDef?
    public let metric: DashboardFieldDef?
    public let viewModes: [String]
    public let limit: Int?
    public let orderBy: String?

    public init(
        dimension: DashboardFieldDef? = nil,
        metric: DashboardFieldDef? = nil,
        viewModes: [String] = [],
        limit: Int? = nil,
        orderBy: String? = nil
    ) {
        self.dimension = dimension
        self.metric = metric
        self.viewModes = viewModes
        self.limit = limit
        self.orderBy = orderBy
    }
}

public struct DashboardFieldDef: Codable, Sendable {
    public let key: String?
    public let label: String?
    public let format: String?

    public init(key: String? = nil, label: String? = nil, format: String? = nil) {
        self.key = key
        self.label = label
        self.format = format
    }
}

public struct DashboardMessagesDef: Codable, Sendable {
    public let items: [DashboardMessageDef]

    public init(items: [DashboardMessageDef] = []) {
        self.items = items
    }
}

public struct DashboardMessageDef: Codable, Sendable, Identifiable {
    public let severity: String?
    public let title: String?
    public let body: String?
    public let visibleWhen: DashboardConditionDef?

    public init(
        severity: String? = nil,
        title: String? = nil,
        body: String? = nil,
        visibleWhen: DashboardConditionDef? = nil
    ) {
        self.severity = severity
        self.title = title
        self.body = body
        self.visibleWhen = visibleWhen
    }

    public var id: String { title ?? body ?? UUID().uuidString }
}

public struct DashboardStatusDef: Codable, Sendable {
    public let checks: [DashboardStatusCheckDef]
}

public struct DashboardStatusCheckDef: Codable, Sendable, Identifiable {
    public let id: String?
    public let label: String?
    public let selector: String?
    public let format: String?
    public let tone: DashboardToneDef?
}

public struct DashboardToneDef: Codable, Sendable {
    public let warningAbove: Double?
    public let dangerAbove: Double?
    public let successAbove: Double?
    public let warningBelow: Double?
    public let dangerBelow: Double?
    public let successBelow: Double?
}

public struct DashboardFeedDef: Codable, Sendable {
    public let fields: DashboardFeedFieldsDef?
}

public struct DashboardFeedFieldsDef: Codable, Sendable {
    public let title: String?
    public let body: String?
    public let timestamp: String?
    public let severity: String?
}

public struct DashboardReportDef: Codable, Sendable {
    public let sections: [DashboardReportSectionDef]
}

public struct DashboardReportSectionDef: Codable, Sendable, Identifiable {
    public let id: String?
    public let title: String?
    public let body: [String]
    public let tone: String?
    public let visibleWhen: DashboardConditionDef?
}

public struct DashboardDetailDef: Codable, Sendable {
    public let reserved: String?
}

public struct DashboardConditionDef: Codable, Sendable {
    public let source: String?
    public let dataSourceRef: String?
    public let selector: String?
    public let field: String?
    public let key: String?
    public let whenValue: JSONPrimitive?
    public let equals: JSONPrimitive?
    public let notEquals: JSONPrimitive?
    public let inValues: [JSONPrimitive]
    public let gt: Double?
    public let gte: Double?
    public let lt: Double?
    public let lte: Double?
    public let empty: Bool?
    public let notEmpty: Bool?

    enum CodingKeys: String, CodingKey {
        case source
        case dataSourceRef
        case selector
        case field
        case key
        case whenValue = "when"
        case equals
        case notEquals
        case inValues = "in"
        case gt
        case gte
        case lt
        case lte
        case empty
        case notEmpty
    }

    public init(
        source: String? = nil,
        dataSourceRef: String? = nil,
        selector: String? = nil,
        field: String? = nil,
        key: String? = nil,
        whenValue: JSONPrimitive? = nil,
        equals: JSONPrimitive? = nil,
        notEquals: JSONPrimitive? = nil,
        inValues: [JSONPrimitive] = [],
        gt: Double? = nil,
        gte: Double? = nil,
        lt: Double? = nil,
        lte: Double? = nil,
        empty: Bool? = nil,
        notEmpty: Bool? = nil
    ) {
        self.source = source
        self.dataSourceRef = dataSourceRef
        self.selector = selector
        self.field = field
        self.key = key
        self.whenValue = whenValue
        self.equals = equals
        self.notEquals = notEquals
        self.inValues = inValues
        self.gt = gt
        self.gte = gte
        self.lt = lt
        self.lte = lte
        self.empty = empty
        self.notEmpty = notEmpty
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        source = try container.decodeIfPresent(String.self, forKey: .source)
        dataSourceRef = try container.decodeIfPresent(String.self, forKey: .dataSourceRef)
        selector = try container.decodeIfPresent(String.self, forKey: .selector)
        field = try container.decodeIfPresent(String.self, forKey: .field)
        key = try container.decodeIfPresent(String.self, forKey: .key)
        whenValue = try container.decodeIfPresent(JSONPrimitive.self, forKey: .whenValue)
        equals = try container.decodeIfPresent(JSONPrimitive.self, forKey: .equals)
        notEquals = try container.decodeIfPresent(JSONPrimitive.self, forKey: .notEquals)
        inValues = try container.decodeIfPresent([JSONPrimitive].self, forKey: .inValues) ?? []
        gt = try container.decodeIfPresent(Double.self, forKey: .gt)
        gte = try container.decodeIfPresent(Double.self, forKey: .gte)
        lt = try container.decodeIfPresent(Double.self, forKey: .lt)
        lte = try container.decodeIfPresent(Double.self, forKey: .lte)
        empty = try container.decodeIfPresent(Bool.self, forKey: .empty)
        notEmpty = try container.decodeIfPresent(Bool.self, forKey: .notEmpty)
    }
}

public struct TabsDef: Codable, Sendable {
    public let defaultSelectedTabId: String?
    public let selectedTabId: String?
    public let style: String?
    public let vertical: Bool?

    public init(
        defaultSelectedTabId: String? = nil,
        selectedTabId: String? = nil,
        style: String? = nil,
        vertical: Bool? = nil
    ) {
        self.defaultSelectedTabId = defaultSelectedTabId
        self.selectedTabId = selectedTabId
        self.style = style
        self.vertical = vertical
    }
}

public struct LayoutDef: Codable, Sendable {
    public let kind: String?
    public let orientation: String?
    public let rows: Int?
    public let columns: Int?
    public let gap: String?
    public let rowGap: String?

    public init(
        kind: String? = nil,
        orientation: String? = nil,
        rows: Int? = nil,
        columns: Int? = nil,
        gap: String? = nil,
        rowGap: String? = nil
    ) {
        self.kind = kind
        self.orientation = orientation
        self.rows = rows
        self.columns = columns
        self.gap = gap
        self.rowGap = rowGap
    }
}

public struct ItemDef: Codable, Sendable, Identifiable {
    public let id: String?
    public let label: String?
    public let appearance: String?
    public let title: String?
    public let subtitle: String?
    public let body: String?
    public let severity: String?
    public let current: String?
    public let previous: String?
    public let format: String?
    public let deltaFormat: String?
    public let positiveIsUp: Bool?
    public let deltaLabel: String?
    public let type: String?
    public let field: String?
    public let multiple: Bool?
    public let dataSourceRef: String?
    public let dataSourceRefSource: String?
    public let dataSourceRefSelector: String?
    public let dataSourceRefs: [String: String]
    public let dataField: String?
    public let bindingPath: String?
    public let scope: String?
    public let value: JSONValue?
    public let link: LinkDef?
    public let visibleWhen: DashboardConditionDef?
    public let options: [OptionDef]
    public let properties: [String: JSONValue]
    public let on: [ExecutionDef]
    public let target: JSONValue?
    public let targetOverrides: [String: JSONValue]

    enum CodingKeys: String, CodingKey {
        case id
        case label
        case appearance
        case title
        case subtitle
        case body
        case severity
        case current
        case previous
        case format
        case deltaFormat
        case positiveIsUp
        case deltaLabel
        case type
        case field
        case multiple
        case dataSourceRef
        case dataSourceRefSource
        case dataSourceRefSelector
        case dataSourceRefs
        case dataField
        case bindingPath
        case scope
        case value
        case link
        case visibleWhen
        case options
        case properties
        case on
        case target
        case targetOverrides
    }

    public init(
        id: String? = nil,
        label: String? = nil,
        appearance: String? = nil,
        title: String? = nil,
        subtitle: String? = nil,
        body: String? = nil,
        severity: String? = nil,
        current: String? = nil,
        previous: String? = nil,
        format: String? = nil,
        deltaFormat: String? = nil,
        positiveIsUp: Bool? = nil,
        deltaLabel: String? = nil,
        type: String? = nil,
        field: String? = nil,
        multiple: Bool? = nil,
        dataSourceRef: String? = nil,
        dataSourceRefSource: String? = nil,
        dataSourceRefSelector: String? = nil,
        dataSourceRefs: [String: String] = [:],
        dataField: String? = nil,
        bindingPath: String? = nil,
        scope: String? = nil,
        value: JSONValue? = nil,
        link: LinkDef? = nil,
        visibleWhen: DashboardConditionDef? = nil,
        options: [OptionDef] = [],
        properties: [String: JSONValue] = [:],
        on: [ExecutionDef] = [],
        target: JSONValue? = nil,
        targetOverrides: [String: JSONValue] = [:]
    ) {
        self.id = id
        self.label = label
        self.appearance = appearance
        self.title = title
        self.subtitle = subtitle
        self.body = body
        self.severity = severity
        self.current = current
        self.previous = previous
        self.format = format
        self.deltaFormat = deltaFormat
        self.positiveIsUp = positiveIsUp
        self.deltaLabel = deltaLabel
        self.type = type
        self.field = field
        self.multiple = multiple
        self.dataSourceRef = dataSourceRef
        self.dataSourceRefSource = dataSourceRefSource
        self.dataSourceRefSelector = dataSourceRefSelector
        self.dataSourceRefs = dataSourceRefs
        self.dataField = dataField
        self.bindingPath = bindingPath
        self.scope = scope
        self.value = value
        self.link = link
        self.visibleWhen = visibleWhen
        self.options = options
        self.properties = properties
        self.on = on
        self.target = target
        self.targetOverrides = targetOverrides
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
        label = try container.decodeIfPresent(String.self, forKey: .label)
        appearance = try container.decodeIfPresent(String.self, forKey: .appearance)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        subtitle = try container.decodeIfPresent(String.self, forKey: .subtitle)
        body = try container.decodeIfPresent(String.self, forKey: .body)
        severity = try container.decodeIfPresent(String.self, forKey: .severity)
        current = try container.decodeIfPresent(String.self, forKey: .current)
        previous = try container.decodeIfPresent(String.self, forKey: .previous)
        format = try container.decodeIfPresent(String.self, forKey: .format)
        deltaFormat = try container.decodeIfPresent(String.self, forKey: .deltaFormat)
        positiveIsUp = try container.decodeIfPresent(Bool.self, forKey: .positiveIsUp)
        deltaLabel = try container.decodeIfPresent(String.self, forKey: .deltaLabel)
        type = try container.decodeIfPresent(String.self, forKey: .type)
        field = try container.decodeIfPresent(String.self, forKey: .field)
        multiple = try container.decodeIfPresent(Bool.self, forKey: .multiple)
        dataSourceRef = try container.decodeIfPresent(String.self, forKey: .dataSourceRef)
        dataSourceRefSource = try container.decodeIfPresent(String.self, forKey: .dataSourceRefSource)
        dataSourceRefSelector = try container.decodeIfPresent(String.self, forKey: .dataSourceRefSelector)
        dataSourceRefs = try container.decodeIfPresent([String: String].self, forKey: .dataSourceRefs) ?? [:]
        dataField = try container.decodeIfPresent(String.self, forKey: .dataField)
        bindingPath = try container.decodeIfPresent(String.self, forKey: .bindingPath)
        scope = try container.decodeIfPresent(String.self, forKey: .scope)
        value = try container.decodeIfPresent(JSONValue.self, forKey: .value)
        link = try container.decodeIfPresent(LinkDef.self, forKey: .link)
        visibleWhen = try container.decodeIfPresent(DashboardConditionDef.self, forKey: .visibleWhen)
        options = try container.decodeIfPresent([OptionDef].self, forKey: .options) ?? []
        properties = try container.decodeIfPresent([String: JSONValue].self, forKey: .properties) ?? [:]
        on = try container.decodeIfPresent([ExecutionDef].self, forKey: .on) ?? []
        target = try container.decodeIfPresent(JSONValue.self, forKey: .target)
        targetOverrides = try container.decodeIfPresent([String: JSONValue].self, forKey: .targetOverrides) ?? [:]
    }
}

public struct OptionDef: Codable, Sendable {
    public let value: String?
    public let label: String?
    public let `default`: Bool?

    enum CodingKeys: String, CodingKey {
        case value
        case label
        case `default`
    }

    public init(value: String? = nil, label: String? = nil, default: Bool? = nil) {
        self.value = value
        self.label = label
        self.default = `default`
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        value = try container.decodeIfPresent(String.self, forKey: .value)
        label = try container.decodeIfPresent(String.self, forKey: .label)
        `default` = try container.decodeIfPresent(Bool.self, forKey: .default)
    }
}

public struct ChartDef: Codable, Sendable {
    public let kind: String?
    public let title: String?
    public let type: String?
    public let dataSourceRef: String?
    public let dataSourceRefSource: String?
    public let dataSourceRefSelector: String?
    public let dataSourceRefs: [String: String]
    public let xKey: String?
    public let valueKey: String?
    public let nameKey: String?
    public let series: [String]
    public let seriesDef: ChartSeriesDef?

    enum CodingKeys: String, CodingKey {
        case kind
        case title
        case type
        case dataSourceRef
        case dataSourceRefSource
        case dataSourceRefSelector
        case dataSourceRefs
        case xKey
        case valueKey
        case nameKey
        case series
        case xAxis
    }

    public init(
        kind: String? = nil,
        title: String? = nil,
        type: String? = nil,
        dataSourceRef: String? = nil,
        dataSourceRefSource: String? = nil,
        dataSourceRefSelector: String? = nil,
        dataSourceRefs: [String: String] = [:],
        xKey: String? = nil,
        valueKey: String? = nil,
        nameKey: String? = nil,
        series: [String] = [],
        seriesDef: ChartSeriesDef? = nil
    ) {
        self.kind = kind
        self.title = title
        self.type = type
        self.dataSourceRef = dataSourceRef
        self.dataSourceRefSource = dataSourceRefSource
        self.dataSourceRefSelector = dataSourceRefSelector
        self.dataSourceRefs = dataSourceRefs
        self.xKey = xKey
        self.valueKey = valueKey
        self.nameKey = nameKey
        self.seriesDef = seriesDef
        self.series = series.isEmpty ? seriesDef?.valueKeys ?? [] : series
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        kind = try container.decodeIfPresent(String.self, forKey: .kind)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        type = try container.decodeIfPresent(String.self, forKey: .type)
        dataSourceRef = try container.decodeIfPresent(String.self, forKey: .dataSourceRef)
        dataSourceRefSource = try container.decodeIfPresent(String.self, forKey: .dataSourceRefSource)
        dataSourceRefSelector = try container.decodeIfPresent(String.self, forKey: .dataSourceRefSelector)
        dataSourceRefs = try container.decodeIfPresent([String: String].self, forKey: .dataSourceRefs) ?? [:]

        let nestedXAxis = try container.decodeIfPresent(JSONValue.self, forKey: .xAxis)?.objectValue
        xKey = Self.nonEmpty(try container.decodeIfPresent(String.self, forKey: .xKey))
            ?? Self.nonEmpty(nestedXAxis?["dataKey"]?.stringValue)

        let legacyValueKey = Self.nonEmpty(try container.decodeIfPresent(String.self, forKey: .valueKey))
        let legacyNameKey = Self.nonEmpty(try container.decodeIfPresent(String.self, forKey: .nameKey))
        let normalizedSeries = Self.normalizeSeries(
            from: try container.decodeIfPresent(JSONValue.self, forKey: .series)
        )

        valueKey = legacyValueKey ?? normalizedSeries.valueKey ?? normalizedSeries.values.first
        nameKey = legacyNameKey ?? normalizedSeries.nameKey
        series = normalizedSeries.values
        seriesDef = normalizedSeries.definition
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(kind, forKey: .kind)
        try container.encodeIfPresent(title, forKey: .title)
        try container.encodeIfPresent(type, forKey: .type)
        try container.encodeIfPresent(dataSourceRef, forKey: .dataSourceRef)
        try container.encodeIfPresent(dataSourceRefSource, forKey: .dataSourceRefSource)
        try container.encodeIfPresent(dataSourceRefSelector, forKey: .dataSourceRefSelector)
        try container.encode(dataSourceRefs, forKey: .dataSourceRefs)
        try container.encodeIfPresent(xKey, forKey: .xKey)
        try container.encodeIfPresent(valueKey, forKey: .valueKey)
        try container.encodeIfPresent(nameKey, forKey: .nameKey)
        if let seriesDef {
            try container.encode(seriesDef, forKey: .series)
        } else {
            try container.encode(series, forKey: .series)
        }
    }

    private static func normalizeSeries(from value: JSONValue?) -> (
        values: [String],
        valueKey: String?,
        nameKey: String?,
        definition: ChartSeriesDef?
    ) {
        switch value {
        case .array(let items):
            let values = items.compactMap(seriesKey(from:))
            return (values, values.first, nil, nil)
        case .object(let object):
            let nameKey = nonEmpty(object["nameKey"]?.stringValue) ?? nonEmpty(object["key"]?.stringValue)
            let valueKey = nonEmpty(object["valueKey"]?.stringValue) ?? nonEmpty(object["value"]?.stringValue)
            let palette = object["palette"]?.arrayValue?.compactMap { nonEmpty($0.stringValue) } ?? []
            let options = object["values"]?.arrayValue?.compactMap(chartValueOption(from:))
                ?? valueKey.map { [ChartValueOption(value: $0)] }
                ?? []
            let values = options.compactMap(\.value)
            let definition = ChartSeriesDef(
                nameKey: nameKey,
                valueKey: valueKey,
                palette: palette,
                values: options
            )
            return (values, valueKey ?? values.first, nameKey, definition)
        default:
            return ([], nil, nil, nil)
        }
    }

    private static func seriesKey(from value: JSONValue) -> String? {
        if let raw = nonEmpty(value.stringValue) {
            return raw
        }
        guard let object = value.objectValue else {
            return nil
        }
        return nonEmpty(object["value"]?.stringValue)
            ?? nonEmpty(object["key"]?.stringValue)
            ?? nonEmpty(object["id"]?.stringValue)
            ?? nonEmpty(object["name"]?.stringValue)
    }

    private static func chartValueOption(from value: JSONValue) -> ChartValueOption? {
        if let raw = nonEmpty(value.stringValue) {
            return ChartValueOption(value: raw)
        }
        guard let object = value.objectValue else {
            return nil
        }
        guard let key = seriesKey(from: value) else {
            return nil
        }
        return ChartValueOption(
            name: nonEmpty(object["name"]?.stringValue) ?? nonEmpty(object["label"]?.stringValue),
            value: key
        )
    }

    private static func nonEmpty(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty else {
            return nil
        }
        return trimmed
    }
}

public struct ChartSeriesDef: Codable, Sendable, Equatable {
    public let nameKey: String?
    public let valueKey: String?
    public let palette: [String]
    public let values: [ChartValueOption]

    public var valueKeys: [String] {
        values.compactMap(\.value)
    }

    public init(
        nameKey: String? = nil,
        valueKey: String? = nil,
        palette: [String] = [],
        values: [ChartValueOption] = []
    ) {
        self.nameKey = nameKey
        self.valueKey = valueKey
        self.palette = palette
        self.values = values
    }
}

public struct ChartValueOption: Codable, Sendable, Equatable {
    public let name: String?
    public let value: String?

    public init(name: String? = nil, value: String? = nil) {
        self.name = name
        self.value = value
    }
}

public struct TableDef: Codable, Sendable {
    public let title: String?
    public let columns: [ColumnDef]
    public let toolbar: ToolbarDef?
    public let on: [ExecutionDef]
    public let target: JSONValue?
    public let targetOverrides: [String: JSONValue]

    enum CodingKeys: String, CodingKey {
        case title
        case columns
        case toolbar
        case on
        case target
        case targetOverrides
    }

    public init(
        title: String? = nil,
        columns: [String] = [],
        toolbar: ToolbarDef? = nil,
        on: [ExecutionDef] = [],
        target: JSONValue? = nil,
        targetOverrides: [String: JSONValue] = [:]
    ) {
        self.title = title
        self.columns = columns.map { ColumnDef(id: $0, name: $0, label: $0) }
        self.toolbar = toolbar
        self.on = on
        self.target = target
        self.targetOverrides = targetOverrides
    }

    public init(
        title: String? = nil,
        columns: [ColumnDef] = [],
        toolbar: ToolbarDef? = nil,
        on: [ExecutionDef] = [],
        target: JSONValue? = nil,
        targetOverrides: [String: JSONValue] = [:]
    ) {
        self.title = title
        self.columns = columns
        self.toolbar = toolbar
        self.on = on
        self.target = target
        self.targetOverrides = targetOverrides
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        columns = try container.decodeIfPresent([ColumnDef].self, forKey: .columns) ?? []
        toolbar = try container.decodeIfPresent(ToolbarDef.self, forKey: .toolbar)
        on = try container.decodeIfPresent([ExecutionDef].self, forKey: .on) ?? []
        target = try container.decodeIfPresent(JSONValue.self, forKey: .target)
        targetOverrides = try container.decodeIfPresent([String: JSONValue].self, forKey: .targetOverrides) ?? [:]
    }
}

public struct TreeBrowserDef: Codable, Sendable {
    public let title: String?
    public let dataSourceRef: String?
    public let pathField: String?
    public let labelField: String?
    public let valueField: String?
    public let subtitleField: String?
    public let childrenField: String?
    public let separator: String?
    public let lazyExpand: Bool?
    public let className: String?
    public let style: [String: String]
    public let on: [ExecutionDef]

    enum CodingKeys: String, CodingKey {
        case title
        case dataSourceRef
        case pathField
        case labelField
        case valueField
        case subtitleField
        case childrenField
        case separator
        case lazyExpand
        case className
        case style
        case on
    }

    public init(
        title: String? = nil,
        dataSourceRef: String? = nil,
        pathField: String? = nil,
        labelField: String? = nil,
        valueField: String? = nil,
        subtitleField: String? = nil,
        childrenField: String? = nil,
        separator: String? = nil,
        lazyExpand: Bool? = nil,
        className: String? = nil,
        style: [String: String] = [:],
        on: [ExecutionDef] = []
    ) {
        self.title = title
        self.dataSourceRef = dataSourceRef
        self.pathField = pathField
        self.labelField = labelField
        self.valueField = valueField
        self.subtitleField = subtitleField
        self.childrenField = childrenField
        self.separator = separator
        self.lazyExpand = lazyExpand
        self.className = className
        self.style = style
        self.on = on
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        dataSourceRef = try container.decodeIfPresent(String.self, forKey: .dataSourceRef)
        pathField = try container.decodeIfPresent(String.self, forKey: .pathField)
        labelField = try container.decodeIfPresent(String.self, forKey: .labelField)
        valueField = try container.decodeIfPresent(String.self, forKey: .valueField)
        subtitleField = try container.decodeIfPresent(String.self, forKey: .subtitleField)
        childrenField = try container.decodeIfPresent(String.self, forKey: .childrenField)
        separator = try container.decodeIfPresent(String.self, forKey: .separator)
        lazyExpand = try container.decodeIfPresent(Bool.self, forKey: .lazyExpand)
        className = try container.decodeIfPresent(String.self, forKey: .className)
        style = try container.decodeIfPresent([String: String].self, forKey: .style) ?? [:]
        on = try container.decodeIfPresent([ExecutionDef].self, forKey: .on) ?? []
    }
}

public struct ToolbarDef: Codable, Sendable {
    public let items: [ToolbarItemDef]
    public let target: JSONValue?
    public let targetOverrides: [String: JSONValue]

    enum CodingKeys: String, CodingKey {
        case items
        case target
        case targetOverrides
    }

    public init(
        items: [ToolbarItemDef] = [],
        target: JSONValue? = nil,
        targetOverrides: [String: JSONValue] = [:]
    ) {
        self.items = items
        self.target = target
        self.targetOverrides = targetOverrides
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        items = try container.decodeIfPresent([ToolbarItemDef].self, forKey: .items) ?? []
        target = try container.decodeIfPresent(JSONValue.self, forKey: .target)
        targetOverrides = try container.decodeIfPresent([String: JSONValue].self, forKey: .targetOverrides) ?? [:]
    }
}

public struct ToolbarItemDef: Codable, Sendable, Identifiable {
    public let id: String?
    public let label: String?
    public let icon: String?
    public let align: String?
    public let on: [ExecutionDef]
    public let target: JSONValue?
    public let targetOverrides: [String: JSONValue]

    enum CodingKeys: String, CodingKey {
        case id
        case label
        case icon
        case align
        case on
        case target
        case targetOverrides
    }

    public init(
        id: String? = nil,
        label: String? = nil,
        icon: String? = nil,
        align: String? = nil,
        on: [ExecutionDef] = [],
        target: JSONValue? = nil,
        targetOverrides: [String: JSONValue] = [:]
    ) {
        self.id = id
        self.label = label
        self.icon = icon
        self.align = align
        self.on = on
        self.target = target
        self.targetOverrides = targetOverrides
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
        label = try container.decodeIfPresent(String.self, forKey: .label)
        icon = try container.decodeIfPresent(String.self, forKey: .icon)
        align = try container.decodeIfPresent(String.self, forKey: .align)
        on = try container.decodeIfPresent([ExecutionDef].self, forKey: .on) ?? []
        target = try container.decodeIfPresent(JSONValue.self, forKey: .target)
        targetOverrides = try container.decodeIfPresent([String: JSONValue].self, forKey: .targetOverrides) ?? [:]
    }
}

public struct ColumnDef: Codable, Sendable, Identifiable {
    public let id: String?
    public let name: String?
    public let label: String?
    public let type: String?
    public let format: String?
    public let emptyText: String?
    public let link: LinkDef?
    public let width: Int?
    public let icon: String?
    public let on: [ExecutionDef]
    public let target: JSONValue?
    public let targetOverrides: [String: JSONValue]

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case label
        case type
        case format
        case emptyText
        case link
        case width
        case icon
        case on
        case target
        case targetOverrides
    }

    public init(
        id: String? = nil,
        name: String? = nil,
        label: String? = nil,
        type: String? = nil,
        format: String? = nil,
        emptyText: String? = nil,
        link: LinkDef? = nil,
        width: Int? = nil,
        icon: String? = nil,
        on: [ExecutionDef] = [],
        target: JSONValue? = nil,
        targetOverrides: [String: JSONValue] = [:]
    ) {
        self.id = id
        self.name = name
        self.label = label
        self.type = type
        self.format = format
        self.emptyText = emptyText
        self.link = link
        self.width = width
        self.icon = icon
        self.on = on
        self.target = target
        self.targetOverrides = targetOverrides
    }

    public init(from decoder: Decoder) throws {
        if let single = try? decoder.singleValueContainer(),
           let raw = try? single.decode(String.self) {
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            self.id = trimmed
            self.name = trimmed
            self.label = trimmed
            self.type = nil
            self.format = nil
            self.emptyText = nil
            self.link = nil
            self.width = nil
            self.icon = nil
            self.on = []
            self.target = nil
            self.targetOverrides = [:]
            return
        }

        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
        name = try container.decodeIfPresent(String.self, forKey: .name)
        label = try container.decodeIfPresent(String.self, forKey: .label)
        type = try container.decodeIfPresent(String.self, forKey: .type)
        format = try container.decodeIfPresent(String.self, forKey: .format)
        emptyText = try container.decodeIfPresent(String.self, forKey: .emptyText)
        link = try container.decodeIfPresent(LinkDef.self, forKey: .link)
        width = try container.decodeIfPresent(Int.self, forKey: .width)
        icon = try container.decodeIfPresent(String.self, forKey: .icon)
        on = try container.decodeIfPresent([ExecutionDef].self, forKey: .on) ?? []
        target = try container.decodeIfPresent(JSONValue.self, forKey: .target)
        targetOverrides = try container.decodeIfPresent([String: JSONValue].self, forKey: .targetOverrides) ?? [:]
    }
}

public struct LinkDef: Codable, Sendable {
    public let href: String?
    public let kind: String?
    public let windowKey: String?
    public let windowTitle: String?
    public let windowTitleSource: String?
    public let windowTitleSelector: String?
    public let windowTitleTemplate: String?
    public let text: String?
    public let textSource: String?
    public let textSelector: String?
    public let title: String?
    public let inTab: Bool?
    public let newInstance: Bool?
    public let autoIndexTitle: Bool?
    public let awaitResult: Bool?
    public let modal: Bool?
    public let parameters: [String: JSONValue]

    public init(
        href: String? = nil,
        kind: String? = nil,
        windowKey: String? = nil,
        windowTitle: String? = nil,
        windowTitleSource: String? = nil,
        windowTitleSelector: String? = nil,
        windowTitleTemplate: String? = nil,
        text: String? = nil,
        textSource: String? = nil,
        textSelector: String? = nil,
        title: String? = nil,
        inTab: Bool? = nil,
        newInstance: Bool? = nil,
        autoIndexTitle: Bool? = nil,
        awaitResult: Bool? = nil,
        modal: Bool? = nil,
        parameters: [String: JSONValue] = [:]
    ) {
        self.href = href
        self.kind = kind
        self.windowKey = windowKey
        self.windowTitle = windowTitle
        self.windowTitleSource = windowTitleSource
        self.windowTitleSelector = windowTitleSelector
        self.windowTitleTemplate = windowTitleTemplate
        self.text = text
        self.textSource = textSource
        self.textSelector = textSelector
        self.title = title
        self.inTab = inTab
        self.newInstance = newInstance
        self.autoIndexTitle = autoIndexTitle
        self.awaitResult = awaitResult
        self.modal = modal
        self.parameters = parameters
    }
}

public struct EditorDef: Codable, Sendable {
    public let language: String?
    public let value: String?

    public init(language: String? = nil, value: String? = nil) {
        self.language = language
        self.value = value
    }
}

public enum JSONPrimitive: Codable, Sendable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported primitive")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value):
            try container.encode(value)
        case .number(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        case .null:
            try container.encodeNil()
        }
    }
}

public indirect enum JSONValue: Codable, Sendable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case array([JSONValue])
    case object([String: JSONValue])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value):
            try container.encode(value)
        case .number(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        case .array(let value):
            try container.encode(value)
        case .object(let value):
            try container.encode(value)
        case .null:
            try container.encodeNil()
        }
    }

    public var stringValue: String? {
        if case .string(let value) = self { return value }
        return nil
    }

    public var objectValue: [String: JSONValue]? {
        if case .object(let value) = self { return value }
        return nil
    }

    public var arrayValue: [JSONValue]? {
        if case .array(let value) = self { return value }
        return nil
    }

    public var intValue: Int? {
        if case .number(let n) = self { return Int(exactly: n) }
        return nil
    }

    public var boolValue: Bool? {
        if case .bool(let b) = self { return b }
        return nil
    }
}

// MARK: - Execution model

public struct ExecutionDef: Codable, Sendable {
    public let action: String
    public let args: [String]
    public let parameters: [ParameterDef]

    enum CodingKeys: String, CodingKey {
        case action
        case handler
        case args
        case parameters
    }

    public init(action: String, args: [String] = [], parameters: [ParameterDef] = []) {
        self.action = action
        self.args = args
        self.parameters = parameters
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.action = try container.decodeIfPresent(String.self, forKey: .action)
            ?? container.decode(String.self, forKey: .handler)
        self.args = try container.decodeIfPresent([String].self, forKey: .args) ?? []
        self.parameters = try container.decodeIfPresent([ParameterDef].self, forKey: .parameters) ?? []
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(action, forKey: .action)
        try container.encode(args, forKey: .args)
        try container.encode(parameters, forKey: .parameters)
    }
}

public struct ParameterDef: Codable, Sendable {
    public let name: String
    public let input: String?
    public let direction: String?   // "in", "out", "inout"
    public let value: JSONValue?
    public let location: JSONValue?
    public let selector: String?

    enum CodingKeys: String, CodingKey {
        case name
        case input = "in"
        case direction
        case value
        case location
        case selector
    }

    public init(name: String, input: String? = nil, direction: String? = nil,
                value: JSONValue? = nil, location: JSONValue? = nil, selector: String? = nil) {
        self.name = name
        self.input = input
        self.direction = direction
        self.value = value
        self.location = location
        self.selector = selector
    }
}

public struct ExecutionContext: Sendable {
    public let windowID: String
    public let dataSourceRef: String

    public init(windowID: String, dataSourceRef: String = "") {
        self.windowID = windowID
        self.dataSourceRef = dataSourceRef
    }
}

public struct ExecutionArgs: Sendable {
    public let execution: ExecutionDef
    public let context: ExecutionContext?
    public let args: [String: JSONValue]

    public init(execution: ExecutionDef, context: ExecutionContext? = nil,
                args: [String: JSONValue] = [:]) {
        self.execution = execution
        self.context = context
        self.args = args
    }
}

public typealias ForgeHandler = @Sendable (ExecutionArgs) async -> JSONValue?

struct PendingDialog: Sendable {
    let callerWindowID: String
    let callerDataSourceRef: String
    let outbound: [ParameterDef]
}

struct PendingWindow: Sendable {
    let callerWindowID: String
    let callerDataSourceRef: String
    let outbound: [ParameterDef]
}

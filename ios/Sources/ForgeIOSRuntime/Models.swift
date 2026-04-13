import Foundation

public struct WindowMetadata: Codable, Sendable {
    public let namespace: String?
    public let view: ViewDef?
    public let dataSources: [String: DataSourceDef]
    public let target: JSONValue?
    public let targetOverrides: [String: JSONValue]

    enum CodingKeys: String, CodingKey {
        case namespace
        case view
        case dataSources
        case target
        case targetOverrides
    }

    enum LegacyCodingKeys: String, CodingKey {
        case dataSource
    }

    public init(
        namespace: String? = nil,
        view: ViewDef? = nil,
        dataSources: [String: DataSourceDef] = [:],
        target: JSONValue? = nil,
        targetOverrides: [String: JSONValue] = [:]
    ) {
        self.namespace = namespace
        self.view = view
        self.dataSources = dataSources
        self.target = target
        self.targetOverrides = targetOverrides
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let legacyContainer = try decoder.container(keyedBy: LegacyCodingKeys.self)
        namespace = try container.decodeIfPresent(String.self, forKey: .namespace)
        view = try container.decodeIfPresent(ViewDef.self, forKey: .view)
        dataSources = try container.decodeIfPresent([String: DataSourceDef].self, forKey: .dataSources)
            ?? legacyContainer.decodeIfPresent([String: DataSourceDef].self, forKey: .dataSource)
            ?? [:]
        target = try container.decodeIfPresent(JSONValue.self, forKey: .target)
        targetOverrides = try container.decodeIfPresent([String: JSONValue].self, forKey: .targetOverrides) ?? [:]
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
    public let containers: [ContainerDef]
    public let target: JSONValue?
    public let targetOverrides: [String: JSONValue]

    enum CodingKeys: String, CodingKey {
        case containers
        case target
        case targetOverrides
    }

    public init(
        containers: [ContainerDef] = [],
        target: JSONValue? = nil,
        targetOverrides: [String: JSONValue] = [:]
    ) {
        self.containers = containers
        self.target = target
        self.targetOverrides = targetOverrides
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        containers = try container.decodeIfPresent([ContainerDef].self, forKey: .containers) ?? []
        target = try container.decodeIfPresent(JSONValue.self, forKey: .target)
        targetOverrides = try container.decodeIfPresent([String: JSONValue].self, forKey: .targetOverrides) ?? [:]
    }
}

public struct ContainerDef: Codable, Sendable, Identifiable {
    public let id: String?
    public let title: String?
    public let subtitle: String?
    public let kind: String?
    public let dataSourceRef: String?
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
    public let schemaBasedForm: SchemaBasedFormDef?
    public let dashboard: DashboardDef?
    public let tabs: TabsDef?
    public let items: [ItemDef]
    public let chart: ChartDef?
    public let table: TableDef?
    public let editor: EditorDef?
    public let target: JSONValue?
    public let targetOverrides: [String: JSONValue]

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case subtitle
        case kind
        case dataSourceRef
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
        case schemaBasedForm
        case dashboard
        case tabs
        case items
        case chart
        case table
        case editor
        case target
        case targetOverrides
    }

    public init(
        id: String? = nil,
        title: String? = nil,
        subtitle: String? = nil,
        kind: String? = nil,
        dataSourceRef: String? = nil,
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
        schemaBasedForm: SchemaBasedFormDef? = nil,
        dashboard: DashboardDef? = nil,
        tabs: TabsDef? = nil,
        items: [ItemDef] = [],
        chart: ChartDef? = nil,
        table: TableDef? = nil,
        editor: EditorDef? = nil,
        target: JSONValue? = nil,
        targetOverrides: [String: JSONValue] = [:]
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.kind = kind
        self.dataSourceRef = dataSourceRef
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
        self.schemaBasedForm = schemaBasedForm
        self.dashboard = dashboard
        self.tabs = tabs
        self.items = items
        self.chart = chart
        self.table = table
        self.editor = editor
        self.target = target
        self.targetOverrides = targetOverrides
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        subtitle = try container.decodeIfPresent(String.self, forKey: .subtitle)
        kind = try container.decodeIfPresent(String.self, forKey: .kind)
        dataSourceRef = try container.decodeIfPresent(String.self, forKey: .dataSourceRef)
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
        schemaBasedForm = try container.decodeIfPresent(SchemaBasedFormDef.self, forKey: .schemaBasedForm)
        dashboard = try container.decodeIfPresent(DashboardDef.self, forKey: .dashboard)
        tabs = try container.decodeIfPresent(TabsDef.self, forKey: .tabs)
        items = try container.decodeIfPresent([ItemDef].self, forKey: .items) ?? []
        chart = try container.decodeIfPresent(ChartDef.self, forKey: .chart)
        table = try container.decodeIfPresent(TableDef.self, forKey: .table)
        editor = try container.decodeIfPresent(EditorDef.self, forKey: .editor)
        target = try container.decodeIfPresent(JSONValue.self, forKey: .target)
        targetOverrides = try container.decodeIfPresent([String: JSONValue].self, forKey: .targetOverrides) ?? [:]
    }
}

public struct DataSourceDef: Codable, Sendable {
    public let uri: String?
    public let method: String?
    public let target: JSONValue?
    public let targetOverrides: [String: JSONValue]

    enum CodingKeys: String, CodingKey {
        case uri
        case method
        case target
        case targetOverrides
    }

    public init(
        uri: String? = nil,
        method: String? = nil,
        target: JSONValue? = nil,
        targetOverrides: [String: JSONValue] = [:]
    ) {
        self.uri = uri
        self.method = method
        self.target = target
        self.targetOverrides = targetOverrides
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        uri = try container.decodeIfPresent(String.self, forKey: .uri)
        method = try container.decodeIfPresent(String.self, forKey: .method)
        target = try container.decodeIfPresent(JSONValue.self, forKey: .target)
        targetOverrides = try container.decodeIfPresent([String: JSONValue].self, forKey: .targetOverrides) ?? [:]
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
    public let detail: DashboardDetailDef?

    public init(
        key: String? = nil,
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
        detail: DashboardDetailDef? = nil
    ) {
        self.key = key
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
        self.detail = detail
    }
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
}

public struct DashboardFilterItemDef: Codable, Sendable, Identifiable {
    public let id: String?
    public let label: String?
    public let field: String?
    public let multiple: Bool?
    public let options: [DashboardFilterOptionDef]
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

    public var id: String { value ?? label ?? UUID().uuidString }
}

public struct DashboardTimelineDef: Codable, Sendable {
    public let viewModes: [String]
    public let annotations: DashboardAnnotationDef?
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
}

public struct DashboardFieldDef: Codable, Sendable {
    public let key: String?
    public let label: String?
    public let format: String?
}

public struct DashboardMessagesDef: Codable, Sendable {
    public let items: [DashboardMessageDef]
}

public struct DashboardMessageDef: Codable, Sendable, Identifiable {
    public let severity: String?
    public let title: String?
    public let body: String?
    public let visibleWhen: DashboardConditionDef?

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
}

public struct TabsDef: Codable, Sendable {
    public let vertical: Bool?
}

public struct ItemDef: Codable, Sendable, Identifiable {
    public let id: String?
    public let title: String?
    public let subtitle: String?

    public init(id: String? = nil, title: String? = nil, subtitle: String? = nil) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
    }
}

public struct ChartDef: Codable, Sendable {
    public let kind: String?
    public let title: String?

    public init(kind: String? = nil, title: String? = nil) {
        self.kind = kind
        self.title = title
    }
}

public struct TableDef: Codable, Sendable {
    public let title: String?
    public let columns: [String]

    public init(title: String? = nil, columns: [String] = []) {
        self.title = title
        self.columns = columns
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

    public init(action: String, args: [String] = [], parameters: [ParameterDef] = []) {
        self.action = action
        self.args = args
        self.parameters = parameters
    }
}

public struct ParameterDef: Codable, Sendable {
    public let name: String
    public let direction: String?   // "in", "out", "inout"
    public let value: JSONValue?
    public let selector: String?

    public init(name: String, direction: String? = nil,
                value: JSONValue? = nil, selector: String? = nil) {
        self.name = name
        self.direction = direction
        self.value = value
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

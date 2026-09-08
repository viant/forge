import Foundation

// Platform-neutral metadata contracts from doc/workflow-primitives.md.
// Rendering and authoritative datasource behavior remain owned by the runtime.

public final class MutationCommandDef: Codable, @unchecked Sendable {
    public let commandId: String?
    public let label: String?
    public let icon: String?
    public let hideLabel: Bool
    public let intent: String?
    public let confirm: String?
    public let confirmSelection: SelectionConfirmationDef?
    public let invalidMessage: String?
    public let timeoutMs: Int?
    public let invocationParameter: String?
    public let dataSourceRef: String
    public let parameters: [ParameterDef]
    public let payload: ResourcePayloadPreparationDef?
    public let validateWhen: DashboardConditionDef?
    public let pendingState: [String: JSONValue]
    public let successState: [String: JSONValue]
    public let errorState: [String: JSONValue]
    public let indeterminateState: [String: JSONValue]
    public let reconcile: ReconcileSpec?
    public let refresh: [RefreshSpec]

    public init(
        commandId: String? = nil,
        label: String? = nil,
        icon: String? = nil,
        hideLabel: Bool = false,
        intent: String? = nil,
        confirm: String? = nil,
        confirmSelection: SelectionConfirmationDef? = nil,
        invalidMessage: String? = nil,
        timeoutMs: Int? = nil,
        invocationParameter: String? = nil,
        dataSourceRef: String,
        parameters: [ParameterDef] = [],
        payload: ResourcePayloadPreparationDef? = nil,
        validateWhen: DashboardConditionDef? = nil,
        pendingState: [String: JSONValue] = [:],
        successState: [String: JSONValue] = [:],
        errorState: [String: JSONValue] = [:],
        indeterminateState: [String: JSONValue] = [:],
        reconcile: ReconcileSpec? = nil,
        refresh: [RefreshSpec] = []
    ) {
        self.commandId = commandId
        self.label = label
        self.icon = icon
        self.hideLabel = hideLabel
        self.intent = intent
        self.confirm = confirm
        self.confirmSelection = confirmSelection
        self.invalidMessage = invalidMessage
        self.timeoutMs = timeoutMs
        self.invocationParameter = invocationParameter
        self.dataSourceRef = dataSourceRef
        self.parameters = parameters
        self.payload = payload
        self.validateWhen = validateWhen
        self.pendingState = pendingState
        self.successState = successState
        self.errorState = errorState
        self.indeterminateState = indeterminateState
        self.reconcile = reconcile
        self.refresh = refresh
    }

    private enum CodingKeys: String, CodingKey {
        case commandId, label, icon, hideLabel, intent, confirm, confirmSelection, invalidMessage, timeoutMs
        case invocationParameter, dataSourceRef, parameters, payload, validateWhen
        case pendingState, successState, errorState, indeterminateState, reconcile, refresh
    }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        commandId = try values.decodeIfPresent(String.self, forKey: .commandId)
        label = try values.decodeIfPresent(String.self, forKey: .label)
        icon = try values.decodeIfPresent(String.self, forKey: .icon)
        hideLabel = try values.decodeIfPresent(Bool.self, forKey: .hideLabel) ?? false
        intent = try values.decodeIfPresent(String.self, forKey: .intent)
        confirm = try values.decodeIfPresent(String.self, forKey: .confirm)
        confirmSelection = try values.decodeIfPresent(SelectionConfirmationDef.self, forKey: .confirmSelection)
        invalidMessage = try values.decodeIfPresent(String.self, forKey: .invalidMessage)
        timeoutMs = try values.decodeIfPresent(Int.self, forKey: .timeoutMs)
        invocationParameter = try values.decodeIfPresent(String.self, forKey: .invocationParameter)
        dataSourceRef = try values.decode(String.self, forKey: .dataSourceRef)
        parameters = try values.decodeIfPresent([ParameterDef].self, forKey: .parameters) ?? []
        payload = try values.decodeIfPresent(ResourcePayloadPreparationDef.self, forKey: .payload)
        validateWhen = try values.decodeIfPresent(DashboardConditionDef.self, forKey: .validateWhen)
        pendingState = try values.decodeIfPresent([String: JSONValue].self, forKey: .pendingState) ?? [:]
        successState = try values.decodeIfPresent([String: JSONValue].self, forKey: .successState) ?? [:]
        errorState = try values.decodeIfPresent([String: JSONValue].self, forKey: .errorState) ?? [:]
        indeterminateState = try values.decodeIfPresent([String: JSONValue].self, forKey: .indeterminateState) ?? [:]
        reconcile = try values.decodeIfPresent(ReconcileSpec.self, forKey: .reconcile)
        refresh = try values.decodeIfPresent([RefreshSpec].self, forKey: .refresh) ?? []
    }
}

public struct SelectionConfirmationDef: Codable, Sendable {
    public let action: String?
    public let singularLabel: String?
    public let pluralLabel: String?
    public let labelField: String?
    public let identityField: String?
    public let maxItems: Int?
    public let suffix: String?

    public init(action: String? = nil, singularLabel: String? = nil, pluralLabel: String? = nil, labelField: String? = nil, identityField: String? = nil, maxItems: Int? = nil, suffix: String? = nil) {
        self.action = action
        self.singularLabel = singularLabel
        self.pluralLabel = pluralLabel
        self.labelField = labelField
        self.identityField = identityField
        self.maxItems = maxItems
        self.suffix = suffix
    }
}

public struct ReconcileSpec: Codable, Sendable {
    public let mode: String?
    public let dataSourceRef: String?
    public let identityField: String?
    public let identityFields: [String]
    public let resultPath: String?
    public let rowsPath: String?

    public init(mode: String? = nil, dataSourceRef: String? = nil, identityField: String? = nil, identityFields: [String] = [], resultPath: String? = nil, rowsPath: String? = nil) {
        self.mode = mode
        self.dataSourceRef = dataSourceRef
        self.identityField = identityField
        self.identityFields = identityFields
        self.resultPath = resultPath
        self.rowsPath = rowsPath
    }

    private enum CodingKeys: String, CodingKey { case mode, dataSourceRef, identityField, identityFields, resultPath, rowsPath }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        mode = try values.decodeIfPresent(String.self, forKey: .mode)
        dataSourceRef = try values.decodeIfPresent(String.self, forKey: .dataSourceRef)
        identityField = try values.decodeIfPresent(String.self, forKey: .identityField)
        identityFields = try values.decodeIfPresent([String].self, forKey: .identityFields) ?? []
        resultPath = try values.decodeIfPresent(String.self, forKey: .resultPath)
        rowsPath = try values.decodeIfPresent(String.self, forKey: .rowsPath)
    }
}

public struct RefreshSpec: Codable, Sendable {
    public let dataSourceRef: String
    public let bypassCache: Bool
    public let clearSelection: Bool

    public init(dataSourceRef: String, bypassCache: Bool = false, clearSelection: Bool = false) {
        self.dataSourceRef = dataSourceRef
        self.bypassCache = bypassCache
        self.clearSelection = clearSelection
    }

    private enum CodingKeys: String, CodingKey { case dataSourceRef, bypassCache, clearSelection }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        dataSourceRef = try values.decode(String.self, forKey: .dataSourceRef)
        bypassCache = try values.decodeIfPresent(Bool.self, forKey: .bypassCache) ?? false
        clearSelection = try values.decodeIfPresent(Bool.self, forKey: .clearSelection) ?? false
    }
}

public struct PrimitiveSelectionSpec: Codable, Sendable {
    public let mode: String?
    public let min: Int?
    public let max: Int?
    public let disabledWhen: DashboardConditionDef?
    public let every: DashboardConditionDef?
    public let any: DashboardConditionDef?
    public let none: DashboardConditionDef?

    public init(mode: String? = nil, min: Int? = nil, max: Int? = nil, disabledWhen: DashboardConditionDef? = nil, every: DashboardConditionDef? = nil, any: DashboardConditionDef? = nil, none: DashboardConditionDef? = nil) {
        self.mode = mode
        self.min = min
        self.max = max
        self.disabledWhen = disabledWhen
        self.every = every
        self.any = any
        self.none = none
    }
}

public final class EditableCollectionSpec: Codable, @unchecked Sendable {
    public let dataSourceRef: String?
    public let identityFields: [String]?
    public let selection: PrimitiveSelectionSpec?
    public let selectionStatus: Bool?
    public let selectionPrompt: String?
    public let operations: [EditableCollectionOperationSpec]?
    public let mutation: MutationCommandDef?

    public init(dataSourceRef: String? = nil, identityFields: [String]? = nil, selection: PrimitiveSelectionSpec? = nil, selectionStatus: Bool? = nil, selectionPrompt: String? = nil, operations: [EditableCollectionOperationSpec]? = nil, mutation: MutationCommandDef? = nil) {
        self.dataSourceRef = dataSourceRef
        self.identityFields = identityFields
        self.selection = selection
        self.selectionStatus = selectionStatus
        self.selectionPrompt = selectionPrompt
        self.operations = operations
        self.mutation = mutation
    }
}

public struct EditableCollectionOperationSpec: Codable, Sendable, Identifiable {
    public let id: String
    public let label: String
    public let intent: String?
    public let dialogId: String?
    public let handler: String?
    public let requiresSelection: Bool?
    public let selection: PrimitiveSelectionSpec?
    public let visibleWhen: DashboardConditionDef?
    public let disabledWhen: DashboardConditionDef?
    public let parameters: [ParameterDef]?
    public let mutation: MutationCommandDef?

    public init(id: String, label: String, intent: String? = nil, dialogId: String? = nil, handler: String? = nil, requiresSelection: Bool? = nil, selection: PrimitiveSelectionSpec? = nil, visibleWhen: DashboardConditionDef? = nil, disabledWhen: DashboardConditionDef? = nil, parameters: [ParameterDef]? = nil, mutation: MutationCommandDef? = nil) {
        self.id = id
        self.label = label
        self.intent = intent
        self.dialogId = dialogId
        self.handler = handler
        self.requiresSelection = requiresSelection
        self.selection = selection
        self.visibleWhen = visibleWhen
        self.disabledWhen = disabledWhen
        self.parameters = parameters
        self.mutation = mutation
    }
}

public final class AssignmentPickerSpec: Codable, @unchecked Sendable {
    public let availableDataSourceRef: String
    public let assignedDataSourceRef: String
    public let identityFields: [String]?
    public let labelField: String?
    public let assign: MutationCommandDef?
    public let unassign: MutationCommandDef?
    public let allowMultiple: Bool?
}

public final class StatusWorkflowSpec: Codable, @unchecked Sendable {
    public let stateField: String
    public let transitions: [StatusWorkflowTransitionSpec]
}

public struct StatusWorkflowTransitionSpec: Codable, Sendable, Identifiable {
    public let id: String
    public let from: [JSONValue]?
    public let to: JSONValue
    public let label: String
    public let confirm: String?
    public let availableWhen: DashboardConditionDef?
    public let command: MutationCommandDef
}

public final class TreeEditorSpec: Codable, @unchecked Sendable {
    public let dataSourceRef: String?
    public let childrenField: String?
    public let identityField: String?
    public let labelField: String?
    public let selectionMode: String?
    public let selectedField: String?
    public let excludedField: String?
    public let searchable: Bool?
    public let collapsible: Bool?
    public let defaultExpandedDepth: Int?
    public let cascade: String?
    public let emptyMessage: String?
    public let mutation: MutationCommandDef?

    public init(dataSourceRef: String? = nil, childrenField: String? = nil, identityField: String? = nil, labelField: String? = nil, selectionMode: String? = nil, selectedField: String? = nil, excludedField: String? = nil, searchable: Bool? = nil, collapsible: Bool? = nil, defaultExpandedDepth: Int? = nil, cascade: String? = nil, emptyMessage: String? = nil, mutation: MutationCommandDef? = nil) {
        self.dataSourceRef = dataSourceRef
        self.childrenField = childrenField
        self.identityField = identityField
        self.labelField = labelField
        self.selectionMode = selectionMode
        self.selectedField = selectedField
        self.excludedField = excludedField
        self.searchable = searchable
        self.collapsible = collapsible
        self.defaultExpandedDepth = defaultExpandedDepth
        self.cascade = cascade
        self.emptyMessage = emptyMessage
        self.mutation = mutation
    }
}

public final class WizardSpec: Codable, @unchecked Sendable {
    public let stateKey: String?
    public let steps: [WizardStepSpec]
    public let submit: MutationCommandDef?
}

public struct WizardStepSpec: Codable, Sendable, Identifiable {
    public let id: String
    public let label: String
    public let containerId: String?
    public let visibleWhen: DashboardConditionDef?
    public let validWhen: DashboardConditionDef?
}

public final class UploadCollectionSpec: Codable, @unchecked Sendable {
    public let accept: [String]?
    public let multiple: Bool?
    public let maxFiles: Int?
    public let maxBytes: Int64?
    public let transport: String?
    public let blobField: String?
    public let metadataField: String?
    public let emptyMessage: String?
    public let upload: MutationCommandDef

    public init(accept: [String]? = nil, multiple: Bool? = nil, maxFiles: Int? = nil, maxBytes: Int64? = nil, transport: String? = nil, blobField: String? = nil, metadataField: String? = nil, emptyMessage: String? = nil, upload: MutationCommandDef) {
        self.accept = accept
        self.multiple = multiple
        self.maxFiles = maxFiles
        self.maxBytes = maxBytes
        self.transport = transport
        self.blobField = blobField
        self.metadataField = metadataField
        self.emptyMessage = emptyMessage
        self.upload = upload
    }
}

public final class DerivedDataSourceSpec: Codable, @unchecked Sendable {
    public let version: String?
    public let maxRows: Int?
    public let sources: [String]
    public let optionalSources: [String]?
    public let pipeline: [DerivedDataStepSpec]
}

public struct DerivedDataStepSpec: Codable, Sendable {
    public let operation: String
    public let source: String?
    public let on: [String]?
    public let fields: [String: JSONValue]?
    public let projections: [DerivedProjectionSpec]?
    public let groupBy: [String]?
    public let measures: [DerivedMeasureSpec]?
    public let joinType: String?
    public let joinCardinality: String?
    public let when: DashboardConditionDef?
    public let orderBy: [JSONValue]?
}

public struct DerivedProjectionSpec: Codable, Sendable {
    public let target: String
    public let source: String?
    public let value: JSONValue?
}

public struct DerivedMeasureSpec: Codable, Sendable {
    public let target: String
    public let source: String?
    public let operation: String
}

public final class PermissionBoundarySpec: Codable, @unchecked Sendable {
    public let mode: String?
    public let dataSourceRef: String?
    public let identityField: String?
    public let capability: String?
    public let visibleWhen: DashboardConditionDef?
    public let deniedMessage: String?

    public init(mode: String? = nil, dataSourceRef: String? = nil, identityField: String? = nil, capability: String? = nil, visibleWhen: DashboardConditionDef? = nil, deniedMessage: String? = nil) {
        self.mode = mode
        self.dataSourceRef = dataSourceRef
        self.identityField = identityField
        self.capability = capability
        self.visibleWhen = visibleWhen
        self.deniedMessage = deniedMessage
    }
}

public final class ResponsiveDataGridSpec: Codable, @unchecked Sendable {
    public let identityColumns: [String]?
    public let breakpoints: [String: ResponsiveDataGridStateSpec]?
}

public struct ResponsiveDataGridStateSpec: Codable, Sendable {
    public let columns: [String]?
    public let stickyColumns: [String]?
    public let density: String?
    public let rowLayout: String?
    public let readOnlyCards: Bool?
    public let style: [String: JSONValue]?
}

public final class HistoryDiffSpec: Codable, @unchecked Sendable {
    public let dataSourceRef: String?
    public let identityField: String?
    public let beforeField: String?
    public let afterField: String?
    public let ignoreFields: [String]?
    public let fieldLabels: [String: String]?
    public let redactFields: [String]?
    public let arrayStrategy: String?
    public let recordLabelField: String?

    public init(dataSourceRef: String? = nil, identityField: String? = nil, beforeField: String? = nil, afterField: String? = nil, ignoreFields: [String]? = nil, fieldLabels: [String: String]? = nil, redactFields: [String]? = nil, arrayStrategy: String? = nil, recordLabelField: String? = nil) {
        self.dataSourceRef = dataSourceRef
        self.identityField = identityField
        self.beforeField = beforeField
        self.afterField = afterField
        self.ignoreFields = ignoreFields
        self.fieldLabels = fieldLabels
        self.redactFields = redactFields
        self.arrayStrategy = arrayStrategy
        self.recordLabelField = recordLabelField
    }
}

public final class ScheduleEditorSpec: Codable, @unchecked Sendable {
    public let dataSourceRef: String?
    public let startField: String?
    public let endField: String?
    public let timeZoneField: String?
    public let allowOverlap: Bool?
    public let minDuration: String?
    public let allowAdd: Bool?
    public let allowRemove: Bool?
    public let ambiguousTimePolicy: String?
    public let mutation: MutationCommandDef?

    public init(dataSourceRef: String? = nil, startField: String? = nil, endField: String? = nil, timeZoneField: String? = nil, allowOverlap: Bool? = nil, minDuration: String? = nil, allowAdd: Bool? = nil, allowRemove: Bool? = nil, ambiguousTimePolicy: String? = nil, mutation: MutationCommandDef? = nil) {
        self.dataSourceRef = dataSourceRef
        self.startField = startField
        self.endField = endField
        self.timeZoneField = timeZoneField
        self.allowOverlap = allowOverlap
        self.minDuration = minDuration
        self.allowAdd = allowAdd
        self.allowRemove = allowRemove
        self.ambiguousTimePolicy = ambiguousTimePolicy
        self.mutation = mutation
    }
}

public final class DraftFormSpec: Codable, @unchecked Sendable {
    public let dataSourceRef: String?
    public let saveLabel: String?
    public let resetLabel: String?
    public let validWhen: DashboardConditionDef?
    public let dirtyWhen: DashboardConditionDef?
    public let confirmDiscard: String?
    public let onReset: String?
    public let submit: MutationCommandDef?
}

public final class QueryToolbarSpec: Codable, @unchecked Sendable {
    public let dataSourceRef: String?
    public let items: [ItemDef]?
    public let density: String?
    public let layout: String?
}

public final class StableTabsSpec: Codable, @unchecked Sendable {
    public let defaultSelectedTabId: String?
    public let dataSourceFetchMode: String?
    public let appearance: String?
    public let compact: Bool?
    public let keepVisitedTabPanelsMounted: Bool?
    public let renderActiveTabPanelOnly: Bool?
}

public final class ResourceHeaderSpec: Codable, @unchecked Sendable {
    public let dataSourceRef: String?
    public let titleField: String?
    public let subtitleField: String?
    public let fields: [ResourceHeaderFieldSpec]?
    public let actions: [ResourceHeaderActionSpec]?
}

public struct ResourceHeaderFieldSpec: Codable, Sendable {
    public let label: String
    public let field: String
    public let format: String?
}

public struct ResourceHeaderActionSpec: Codable, Sendable, Identifiable {
    public let id: String
    public let label: String?
    public let icon: String?
    public let hideLabel: Bool?
    public let intent: String?
    public let handler: String?
    public let visibleWhen: DashboardConditionDef?
    public let disabledWhen: DashboardConditionDef?
    public let mutation: MutationCommandDef?
}

public final class DataStateBoundarySpec: Codable, @unchecked Sendable {
    public let dataSourceRefs: [String]
    public let allowPartial: Bool
    public let renderEmptyContent: Bool
    public let loadingMessage: String?
    public let emptyMessage: String?
    public let errorMessage: String?
    public let staleMessage: String?

    public init(
        dataSourceRefs: [String] = [],
        allowPartial: Bool = false,
        renderEmptyContent: Bool = false,
        loadingMessage: String? = nil,
        emptyMessage: String? = nil,
        errorMessage: String? = nil,
        staleMessage: String? = nil
    ) {
        self.dataSourceRefs = dataSourceRefs
        self.allowPartial = allowPartial
        self.renderEmptyContent = renderEmptyContent
        self.loadingMessage = loadingMessage
        self.emptyMessage = emptyMessage
        self.errorMessage = errorMessage
        self.staleMessage = staleMessage
    }

    private enum CodingKeys: String, CodingKey { case dataSourceRefs, allowPartial, renderEmptyContent, loadingMessage, emptyMessage, errorMessage, staleMessage }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        dataSourceRefs = try values.decodeIfPresent([String].self, forKey: .dataSourceRefs) ?? []
        allowPartial = try values.decodeIfPresent(Bool.self, forKey: .allowPartial) ?? false
        renderEmptyContent = try values.decodeIfPresent(Bool.self, forKey: .renderEmptyContent) ?? false
        loadingMessage = try values.decodeIfPresent(String.self, forKey: .loadingMessage)
        emptyMessage = try values.decodeIfPresent(String.self, forKey: .emptyMessage)
        errorMessage = try values.decodeIfPresent(String.self, forKey: .errorMessage)
        staleMessage = try values.decodeIfPresent(String.self, forKey: .staleMessage)
    }
}

public final class RelationDrillSpec: Codable, @unchecked Sendable {
    public let dataSourceRef: String?
    public let labelField: String?
    public let countField: String?
    public let singularLabel: String?
    public let pluralLabel: String?
    public let emptyText: String?
    public let link: LinkDef?

    public init(
        dataSourceRef: String? = nil,
        labelField: String? = nil,
        countField: String? = nil,
        singularLabel: String? = nil,
        pluralLabel: String? = nil,
        emptyText: String? = nil,
        link: LinkDef? = nil
    ) {
        self.dataSourceRef = dataSourceRef
        self.labelField = labelField
        self.countField = countField
        self.singularLabel = singularLabel
        self.pluralLabel = pluralLabel
        self.emptyText = emptyText
        self.link = link
    }
}

public final class NotificationRulesSpec: Codable, @unchecked Sendable {
    public let rules: [NotificationRuleSpec]

    public init(rules: [NotificationRuleSpec] = []) {
        self.rules = rules
    }

    private enum CodingKeys: String, CodingKey { case rules }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        rules = try values.decodeIfPresent([NotificationRuleSpec].self, forKey: .rules) ?? []
    }
}

public struct NotificationRuleSpec: Codable, Sendable, Identifiable {
    public let id: String
    public let intent: String?
    public let icon: String?
    public let message: String
    public let visibleWhen: DashboardConditionDef?
    public let action: ResourceHeaderActionSpec?

    public init(
        id: String,
        intent: String? = nil,
        icon: String? = nil,
        message: String,
        visibleWhen: DashboardConditionDef? = nil,
        action: ResourceHeaderActionSpec? = nil
    ) {
        self.id = id
        self.intent = intent
        self.icon = icon
        self.message = message
        self.visibleWhen = visibleWhen
        self.action = action
    }
}

public final class MetricSummarySpec: Codable, @unchecked Sendable {
    public let dataSourceRef: String?
    public let columns: Int?
    public let metrics: [MetricSummaryItemSpec]

    public init(dataSourceRef: String? = nil, columns: Int? = nil, metrics: [MetricSummaryItemSpec] = []) {
        self.dataSourceRef = dataSourceRef
        self.columns = columns
        self.metrics = metrics
    }

    private enum CodingKeys: String, CodingKey { case dataSourceRef, columns, metrics }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        dataSourceRef = try values.decodeIfPresent(String.self, forKey: .dataSourceRef)
        columns = try values.decodeIfPresent(Int.self, forKey: .columns)
        metrics = try values.decodeIfPresent([MetricSummaryItemSpec].self, forKey: .metrics) ?? []
    }
}

public struct MetricSummaryItemSpec: Codable, Sendable, Identifiable {
    public let id: String
    public let label: String
    public let field: String
    public let format: String?
    public let currencyField: String?
    public let comparisonField: String?
    public let comparisonFormat: String?
    public let betterWhen: String?
    public let emptyText: String?

    public init(
        id: String,
        label: String,
        field: String,
        format: String? = nil,
        currencyField: String? = nil,
        comparisonField: String? = nil,
        comparisonFormat: String? = nil,
        betterWhen: String? = nil,
        emptyText: String? = nil
    ) {
        self.id = id
        self.label = label
        self.field = field
        self.format = format
        self.currencyField = currencyField
        self.comparisonField = comparisonField
        self.comparisonFormat = comparisonFormat
        self.betterWhen = betterWhen
        self.emptyText = emptyText
    }
}

public final class DetailViewSpec: Codable, @unchecked Sendable {
    public let dataSourceRef: String?
    public let source: String?
    public let columns: Int?
    public let responsiveColumns: [String: Int]
    public let emptyText: String?
    public let sections: [DetailViewSectionSpec]
    public let fields: [DetailViewFieldSpec]

    public init(
        dataSourceRef: String? = nil,
        source: String? = nil,
        columns: Int? = nil,
        responsiveColumns: [String: Int] = [:],
        emptyText: String? = nil,
        sections: [DetailViewSectionSpec] = [],
        fields: [DetailViewFieldSpec] = []
    ) {
        self.dataSourceRef = dataSourceRef
        self.source = source
        self.columns = columns
        self.responsiveColumns = responsiveColumns
        self.emptyText = emptyText
        self.sections = sections
        self.fields = fields
    }

    private enum CodingKeys: String, CodingKey { case dataSourceRef, source, columns, responsiveColumns, emptyText, sections, fields }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        dataSourceRef = try values.decodeIfPresent(String.self, forKey: .dataSourceRef)
        source = try values.decodeIfPresent(String.self, forKey: .source)
        columns = try values.decodeIfPresent(Int.self, forKey: .columns)
        responsiveColumns = try values.decodeIfPresent([String: Int].self, forKey: .responsiveColumns) ?? [:]
        emptyText = try values.decodeIfPresent(String.self, forKey: .emptyText)
        sections = try values.decodeIfPresent([DetailViewSectionSpec].self, forKey: .sections) ?? []
        fields = try values.decodeIfPresent([DetailViewFieldSpec].self, forKey: .fields) ?? []
    }
}

public struct DetailViewSectionSpec: Codable, Sendable, Identifiable {
    public let id: String
    public let label: String?
    public let description: String?
    public let visibleWhen: DashboardConditionDef?
    public let fields: [DetailViewFieldSpec]

    public init(
        id: String,
        label: String? = nil,
        description: String? = nil,
        visibleWhen: DashboardConditionDef? = nil,
        fields: [DetailViewFieldSpec] = []
    ) {
        self.id = id
        self.label = label
        self.description = description
        self.visibleWhen = visibleWhen
        self.fields = fields
    }

    private enum CodingKeys: String, CodingKey { case id, label, description, visibleWhen, fields }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        label = try values.decodeIfPresent(String.self, forKey: .label)
        description = try values.decodeIfPresent(String.self, forKey: .description)
        visibleWhen = try values.decodeIfPresent(DashboardConditionDef.self, forKey: .visibleWhen)
        fields = try values.decodeIfPresent([DetailViewFieldSpec].self, forKey: .fields) ?? []
    }
}

public struct DetailViewFieldSpec: Codable, Sendable, Identifiable {
    public let id: String
    public let label: String
    public let field: String
    public let format: String?
    public let currencyField: String?
    public let timeZoneField: String?
    public let timeZone: String?
    public let timeZoneSelector: String?
    public let emptyText: String?
    public let span: Int?
    public let copyable: Bool
    public let visibleWhen: DashboardConditionDef?
    public let link: LinkDef?

    public init(
        id: String,
        label: String,
        field: String,
        format: String? = nil,
        currencyField: String? = nil,
        timeZoneField: String? = nil,
        timeZone: String? = nil,
        timeZoneSelector: String? = nil,
        emptyText: String? = nil,
        span: Int? = nil,
        copyable: Bool = false,
        visibleWhen: DashboardConditionDef? = nil,
        link: LinkDef? = nil
    ) {
        self.id = id
        self.label = label
        self.field = field
        self.format = format
        self.currencyField = currencyField
        self.timeZoneField = timeZoneField
        self.timeZone = timeZone
        self.timeZoneSelector = timeZoneSelector
        self.emptyText = emptyText
        self.span = span
        self.copyable = copyable
        self.visibleWhen = visibleWhen
        self.link = link
    }

    private enum CodingKeys: String, CodingKey { case id, label, field, format, currencyField, timeZoneField, timeZone, timeZoneSelector, emptyText, span, copyable, visibleWhen, link }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        label = try values.decode(String.self, forKey: .label)
        field = try values.decode(String.self, forKey: .field)
        format = try values.decodeIfPresent(String.self, forKey: .format)
        currencyField = try values.decodeIfPresent(String.self, forKey: .currencyField)
        timeZoneField = try values.decodeIfPresent(String.self, forKey: .timeZoneField)
        timeZone = try values.decodeIfPresent(String.self, forKey: .timeZone)
        timeZoneSelector = try values.decodeIfPresent(String.self, forKey: .timeZoneSelector)
        emptyText = try values.decodeIfPresent(String.self, forKey: .emptyText)
        span = try values.decodeIfPresent(Int.self, forKey: .span)
        copyable = try values.decodeIfPresent(Bool.self, forKey: .copyable) ?? false
        visibleWhen = try values.decodeIfPresent(DashboardConditionDef.self, forKey: .visibleWhen)
        link = try values.decodeIfPresent(LinkDef.self, forKey: .link)
    }
}

public final class MasterDetailSpec: Codable, @unchecked Sendable {
    public let stateKey: String?
    public let identityFields: [String]
    public let master: MasterDetailRegionSpec
    public let detail: MasterDetailRegionSpec
    public let emptyDetail: MasterDetailEmptySpec?
    public let selectionInvalidation: String?
    public let responsive: [String: String]

    public init(
        stateKey: String? = nil,
        identityFields: [String] = [],
        master: MasterDetailRegionSpec,
        detail: MasterDetailRegionSpec,
        emptyDetail: MasterDetailEmptySpec? = nil,
        selectionInvalidation: String? = nil,
        responsive: [String: String] = [:]
    ) {
        self.stateKey = stateKey
        self.identityFields = identityFields
        self.master = master
        self.detail = detail
        self.emptyDetail = emptyDetail
        self.selectionInvalidation = selectionInvalidation
        self.responsive = responsive
    }

    private enum CodingKeys: String, CodingKey { case stateKey, identityFields, master, detail, emptyDetail, selectionInvalidation, responsive }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        stateKey = try values.decodeIfPresent(String.self, forKey: .stateKey)
        identityFields = try values.decodeIfPresent([String].self, forKey: .identityFields) ?? []
        master = try values.decode(MasterDetailRegionSpec.self, forKey: .master)
        detail = try values.decode(MasterDetailRegionSpec.self, forKey: .detail)
        emptyDetail = try values.decodeIfPresent(MasterDetailEmptySpec.self, forKey: .emptyDetail)
        selectionInvalidation = try values.decodeIfPresent(String.self, forKey: .selectionInvalidation)
        responsive = try values.decodeIfPresent([String: String].self, forKey: .responsive) ?? [:]
    }
}

public struct MasterDetailRegionSpec: Codable, Sendable {
    public let containerId: String
    public let parameters: [String: JSONValue]
    public let allowedWhen: DashboardConditionDef?

    public init(containerId: String, parameters: [String: JSONValue] = [:], allowedWhen: DashboardConditionDef? = nil) {
        self.containerId = containerId
        self.parameters = parameters
        self.allowedWhen = allowedWhen
    }

    private enum CodingKeys: String, CodingKey { case containerId, parameters, allowedWhen }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        containerId = try values.decode(String.self, forKey: .containerId)
        parameters = try values.decodeIfPresent([String: JSONValue].self, forKey: .parameters) ?? [:]
        allowedWhen = try values.decodeIfPresent(DashboardConditionDef.self, forKey: .allowedWhen)
    }
}

public struct MasterDetailEmptySpec: Codable, Sendable {
    public let message: String?

    public init(message: String? = nil) {
        self.message = message
    }
}

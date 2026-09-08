package com.viant.forgeandroid.runtime

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

// Platform-neutral metadata contracts from doc/workflow-primitives.md.

@Serializable
data class MutationCommandDef(
    val commandId: String? = null,
    val label: String? = null,
    val icon: String? = null,
    val hideLabel: Boolean = false,
    val intent: String? = null,
    val confirm: String? = null,
    val confirmSelection: SelectionConfirmationDef? = null,
    val invalidMessage: String? = null,
    val timeoutMs: Int? = null,
    val invocationParameter: String? = null,
    val dataSourceRef: String,
    val parameters: List<ParameterDef> = emptyList(),
    val payload: ResourcePayloadPreparationDef? = null,
    val validateWhen: DashboardConditionDef? = null,
    val pendingState: JsonObject = JsonObject(emptyMap()),
    val successState: JsonObject = JsonObject(emptyMap()),
    val errorState: JsonObject = JsonObject(emptyMap()),
    val indeterminateState: JsonObject = JsonObject(emptyMap()),
    val reconcile: ReconcileSpec? = null,
    val refresh: List<RefreshSpec> = emptyList()
)

@Serializable
data class SelectionConfirmationDef(
    val action: String? = null,
    val singularLabel: String? = null,
    val pluralLabel: String? = null,
    val labelField: String? = null,
    val identityField: String? = null,
    val maxItems: Int? = null,
    val suffix: String? = null
)

@Serializable
data class ReconcileSpec(
    val mode: String? = null,
    val dataSourceRef: String? = null,
    val identityField: String? = null,
    val identityFields: List<String> = emptyList(),
    val resultPath: String? = null,
    val rowsPath: String? = null
)

@Serializable
data class RefreshSpec(
    val dataSourceRef: String,
    val bypassCache: Boolean = false,
    val clearSelection: Boolean = false
)

@Serializable data class PrimitiveSelectionSpec(val mode: String? = null, val min: Int? = null, val max: Int? = null, val disabledWhen: DashboardConditionDef? = null, val every: DashboardConditionDef? = null, val any: DashboardConditionDef? = null, val none: DashboardConditionDef? = null)
@Serializable data class EditableCollectionSpec(val dataSourceRef: String? = null, val identityFields: List<String> = emptyList(), val selection: PrimitiveSelectionSpec? = null, val selectionStatus: Boolean = false, val selectionPrompt: String? = null, val operations: List<EditableCollectionOperationSpec> = emptyList(), val mutation: MutationCommandDef? = null)
@Serializable data class EditableCollectionOperationSpec(val id: String, val label: String, val intent: String? = null, val dialogId: String? = null, val handler: String? = null, val requiresSelection: Boolean = false, val selection: PrimitiveSelectionSpec? = null, val visibleWhen: DashboardConditionDef? = null, val disabledWhen: DashboardConditionDef? = null, val parameters: List<ParameterDef> = emptyList(), val mutation: MutationCommandDef? = null)
@Serializable data class AssignmentPickerSpec(val availableDataSourceRef: String, val assignedDataSourceRef: String, val identityFields: List<String> = emptyList(), val labelField: String? = null, val assign: MutationCommandDef? = null, val unassign: MutationCommandDef? = null, val allowMultiple: Boolean? = null)
@Serializable data class StatusWorkflowSpec(val stateField: String, val transitions: List<StatusWorkflowTransitionSpec>)
@Serializable data class StatusWorkflowTransitionSpec(val id: String, val from: List<JsonElement> = emptyList(), val to: JsonElement, val label: String, val confirm: String? = null, val availableWhen: DashboardConditionDef? = null, val command: MutationCommandDef)
@Serializable data class TreeEditorSpec(val dataSourceRef: String? = null, val childrenField: String? = null, val identityField: String? = null, val labelField: String? = null, val selectionMode: String? = null, val selectedField: String? = null, val excludedField: String? = null, val searchable: Boolean? = null, val collapsible: Boolean? = null, val defaultExpandedDepth: Int? = null, val cascade: String? = null, val emptyMessage: String? = null, val mutation: MutationCommandDef? = null)
@Serializable data class WizardSpec(val stateKey: String? = null, val steps: List<WizardStepSpec>, val submit: MutationCommandDef? = null)
@Serializable data class WizardStepSpec(val id: String, val label: String, val containerId: String? = null, val visibleWhen: DashboardConditionDef? = null, val validWhen: DashboardConditionDef? = null)
@Serializable data class UploadCollectionSpec(val accept: List<String> = emptyList(), val multiple: Boolean? = null, val maxFiles: Int? = null, val maxBytes: Long? = null, val transport: String? = null, val blobField: String? = null, val metadataField: String? = null, val emptyMessage: String? = null, val upload: MutationCommandDef)
@Serializable data class DerivedDataSourceSpec(val version: String? = null, val maxRows: Int? = null, val sources: List<String>, val optionalSources: List<String> = emptyList(), val pipeline: List<DerivedDataStepSpec>)
@Serializable data class DerivedDataStepSpec(val operation: String, val source: String? = null, val on: List<String> = emptyList(), val fields: Map<String, JsonElement> = emptyMap(), val projections: List<DerivedProjectionSpec> = emptyList(), val groupBy: List<String> = emptyList(), val measures: List<DerivedMeasureSpec> = emptyList(), val joinType: String? = null, val joinCardinality: String? = null, @SerialName("when") val whenCondition: DashboardConditionDef? = null, val orderBy: List<JsonElement> = emptyList())
@Serializable data class DerivedProjectionSpec(val target: String, val source: String? = null, val value: JsonElement? = null)
@Serializable data class DerivedMeasureSpec(val target: String, val source: String? = null, val operation: String)
@Serializable data class PermissionBoundarySpec(val mode: String? = null, val dataSourceRef: String? = null, val identityField: String? = null, val capability: String? = null, val visibleWhen: DashboardConditionDef? = null, val deniedMessage: String? = null)
@Serializable data class ResponsiveDataGridSpec(val identityColumns: List<String> = emptyList(), val breakpoints: Map<String, ResponsiveDataGridStateSpec> = emptyMap())
@Serializable data class ResponsiveDataGridStateSpec(val columns: List<String> = emptyList(), val stickyColumns: List<String> = emptyList(), val density: String? = null, val rowLayout: String? = null, val readOnlyCards: Boolean = false, val style: Map<String, JsonElement> = emptyMap())
@Serializable data class HistoryDiffSpec(val dataSourceRef: String? = null, val identityField: String? = null, val beforeField: String? = null, val afterField: String? = null, val ignoreFields: List<String> = emptyList(), val fieldLabels: Map<String, String> = emptyMap(), val redactFields: List<String> = emptyList(), val arrayStrategy: String? = null, val recordLabelField: String? = null)
@Serializable data class ScheduleEditorSpec(val dataSourceRef: String? = null, val startField: String? = null, val endField: String? = null, val timeZoneField: String? = null, val allowOverlap: Boolean? = null, val minDuration: String? = null, val allowAdd: Boolean? = null, val allowRemove: Boolean? = null, val ambiguousTimePolicy: String? = null, val mutation: MutationCommandDef? = null)
@Serializable data class DraftFormSpec(val dataSourceRef: String? = null, val saveLabel: String? = null, val resetLabel: String? = null, val validWhen: DashboardConditionDef? = null, val dirtyWhen: DashboardConditionDef? = null, val confirmDiscard: String? = null, val onReset: String? = null, val submit: MutationCommandDef? = null)
@Serializable data class QueryToolbarSpec(val dataSourceRef: String? = null, val items: List<ItemDef> = emptyList(), val density: String? = null, val layout: String? = null)
@Serializable data class StableTabsSpec(val defaultSelectedTabId: String? = null, val dataSourceFetchMode: String? = null, val appearance: String? = null, val compact: Boolean = false, val keepVisitedTabPanelsMounted: Boolean = false, val renderActiveTabPanelOnly: Boolean? = null)
@Serializable data class ResourceHeaderSpec(val dataSourceRef: String? = null, val titleField: String? = null, val subtitleField: String? = null, val fields: List<ResourceHeaderFieldSpec> = emptyList(), val actions: List<ResourceHeaderActionSpec> = emptyList())
@Serializable data class ResourceHeaderFieldSpec(val label: String, val field: String, val format: String? = null)
@Serializable data class ResourceHeaderActionSpec(val id: String, val label: String? = null, val icon: String? = null, val hideLabel: Boolean = false, val intent: String? = null, val handler: String? = null, val visibleWhen: DashboardConditionDef? = null, val disabledWhen: DashboardConditionDef? = null, val mutation: MutationCommandDef? = null)

@Serializable
data class DataStateBoundarySpec(
    val dataSourceRefs: List<String> = emptyList(),
    val allowPartial: Boolean = false,
    val renderEmptyContent: Boolean = false,
    val loadingMessage: String? = null,
    val emptyMessage: String? = null,
    val errorMessage: String? = null,
    val staleMessage: String? = null
)

@Serializable
data class RelationDrillSpec(
    val dataSourceRef: String? = null,
    val labelField: String? = null,
    val countField: String? = null,
    val singularLabel: String? = null,
    val pluralLabel: String? = null,
    val emptyText: String? = null,
    val link: LinkDef? = null
)

@Serializable
data class NotificationRulesSpec(
    val rules: List<NotificationRuleSpec> = emptyList()
)

@Serializable
data class NotificationRuleSpec(
    val id: String,
    val intent: String? = null,
    val icon: String? = null,
    val message: String,
    val visibleWhen: DashboardConditionDef? = null,
    val action: ResourceHeaderActionSpec? = null
)

@Serializable
data class MetricSummarySpec(
    val dataSourceRef: String? = null,
    val columns: Int? = null,
    val metrics: List<MetricSummaryItemSpec> = emptyList()
)

@Serializable
data class MetricSummaryItemSpec(
    val id: String,
    val label: String,
    val field: String,
    val format: String? = null,
    val currencyField: String? = null,
    val comparisonField: String? = null,
    val comparisonFormat: String? = null,
    val betterWhen: String? = null,
    val emptyText: String? = null
)

@Serializable
data class DetailViewSpec(
    val dataSourceRef: String? = null,
    val source: String? = null,
    val columns: Int? = null,
    val responsiveColumns: Map<String, Int> = emptyMap(),
    val emptyText: String? = null,
    val sections: List<DetailViewSectionSpec> = emptyList(),
    val fields: List<DetailViewFieldSpec> = emptyList()
)

@Serializable
data class DetailViewSectionSpec(
    val id: String,
    val label: String? = null,
    val description: String? = null,
    val visibleWhen: DashboardConditionDef? = null,
    val fields: List<DetailViewFieldSpec> = emptyList()
)

@Serializable
data class DetailViewFieldSpec(
    val id: String,
    val label: String,
    val field: String,
    val format: String? = null,
    val currencyField: String? = null,
    val timeZoneField: String? = null,
    val timeZone: String? = null,
    val timeZoneSelector: String? = null,
    val emptyText: String? = null,
    val span: Int? = null,
    val copyable: Boolean = false,
    val visibleWhen: DashboardConditionDef? = null,
    val link: LinkDef? = null
)

@Serializable
data class MasterDetailSpec(
    val stateKey: String? = null,
    val identityFields: List<String> = emptyList(),
    val master: MasterDetailRegionSpec,
    val detail: MasterDetailRegionSpec,
    val emptyDetail: MasterDetailEmptySpec? = null,
    val selectionInvalidation: String? = null,
    val responsive: Map<String, String> = emptyMap()
)

@Serializable
data class MasterDetailRegionSpec(
    val containerId: String,
    val parameters: Map<String, JsonElement> = emptyMap(),
    val allowedWhen: DashboardConditionDef? = null
)

@Serializable
data class MasterDetailEmptySpec(
    val message: String? = null
)

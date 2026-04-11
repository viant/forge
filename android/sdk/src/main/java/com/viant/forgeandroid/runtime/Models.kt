package com.viant.forgeandroid.runtime

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class WindowMetadata(
    val namespace: String? = null,
    val view: ViewDef? = null,
    @SerialName("dataSource")
    val dataSources: Map<String, DataSourceDef> = emptyMap(),
    val dialogs: List<DialogDef> = emptyList(),
    val window: WindowDef? = null,
    val actions: ActionsDef? = null,
    val on: List<ExecutionDef> = emptyList(),
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class ActionsDef(
    val code: String? = null
)

@Serializable
data class WindowDef(
    val on: List<ExecutionDef> = emptyList(),
    val footer: FooterDef? = null,
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class FooterDef(
    val hide: Boolean? = null
)

@Serializable
data class ViewDef(
    val content: ContentDef? = null,
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class ContentDef(
    val containers: List<ContainerDef> = emptyList(),
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class ContainerDef(
    val id: String? = null,
    val title: String? = null,
    val subtitle: String? = null,
    val kind: String? = null,
    val role: String? = null,
    val dataSourceRef: String? = null,
    val toolbar: ToolbarDef? = null,
    val filterBindings: Map<String, String> = emptyMap(),
    val columnSpan: Int? = null,
    val rowSpan: Int? = null,
    val visibleWhen: DashboardConditionDef? = null,
    val metrics: List<DashboardMetricDef> = emptyList(),
    val checks: List<DashboardStatusCheckDef> = emptyList(),
    val rows: List<DashboardKPIRowDef> = emptyList(),
    val sections: List<DashboardReportSectionDef> = emptyList(),
    val fields: DashboardFeedFieldsDef? = null,
    val dimension: DashboardFieldDef? = null,
    val metric: DashboardFieldDef? = null,
    val viewModes: List<String> = emptyList(),
    val limit: Int? = null,
    val orderBy: String? = null,
    val table: TableDef? = null,
    val fileBrowser: FileBrowserDef? = null,
    val chart: ChartDef? = null,
    val editor: EditorDef? = null,
    val terminal: TerminalDef? = null,
    val items: List<ItemDef> = emptyList(),
    val containers: List<ContainerDef> = emptyList(),
    val tabs: TabsDef? = null,
    val layout: LayoutDef? = null,
    val chat: ChatDef? = null,
    val schemaBasedForm: SchemaBasedFormDef? = null,
    val dashboard: DashboardDef? = null,
    val actions: List<ActionDef> = emptyList(),
    val on: List<ExecutionDef> = emptyList(),
    val selectFirst: Boolean? = null,
    val fetchData: Boolean? = null,
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class SchemaBasedFormDef(
    val id: String? = null,
    val dataBinding: String? = null,
    @SerialName("datasourceRef")
    val datasourceRef: String? = null,
    val dataSourceRef: String? = null,
    val fields: List<FormFieldDef> = emptyList(),
    val schema: JsonElement? = null,
    val showSubmit: Boolean? = null
)

@Serializable
data class FormFieldDef(
    val name: String? = null,
    val label: String? = null,
    val type: String? = null,
    val required: Boolean? = null,
    val enum: List<String> = emptyList(),
    val default: JsonElement? = null,
    val widget: String? = null,
    val placeholder: String? = null
)

@Serializable
data class TabsDef(
    val vertical: Boolean? = null
)

@Serializable
data class LayoutDef(
    val kind: String? = null,
    val orientation: String? = null,
    val rows: Int? = null,
    val columns: Int? = null,
    val labelPosition: String? = null
)

@Serializable
data class DashboardConditionDef(
    val source: String? = null,
    val dataSourceRef: String? = null,
    val selector: String? = null,
    val field: String? = null,
    val key: String? = null,
    @SerialName("when")
    val whenValue: JsonElement? = null,
    val equals: JsonElement? = null,
    val notEquals: JsonElement? = null,
    @SerialName("in")
    val inValues: List<JsonElement> = emptyList(),
    val gt: Double? = null,
    val gte: Double? = null,
    val lt: Double? = null,
    val lte: Double? = null,
    val empty: Boolean? = null,
    val notEmpty: Boolean? = null
)

@Serializable
data class DashboardDef(
    val key: String? = null,
    val summary: DashboardSummaryDef? = null,
    val compare: DashboardCompareDef? = null,
    val kpiTable: DashboardKPITableDef? = null,
    val filters: DashboardFiltersDef? = null,
    val timeline: DashboardTimelineDef? = null,
    val dimensions: DashboardDimensionsDef? = null,
    val messages: DashboardMessagesDef? = null,
    val status: DashboardStatusDef? = null,
    val feed: DashboardFeedDef? = null,
    val report: DashboardReportDef? = null,
    val detail: DashboardDetailDef? = null
)

@Serializable
data class DashboardSummaryDef(
    val metrics: List<DashboardMetricDef> = emptyList()
)

@Serializable
data class DashboardMetricDef(
    val id: String? = null,
    val label: String? = null,
    val selector: String? = null,
    val format: String? = null
)

@Serializable
data class DashboardCompareDef(
    val items: List<DashboardCompareItemDef> = emptyList()
)

@Serializable
data class DashboardCompareItemDef(
    val id: String? = null,
    val label: String? = null,
    val current: String? = null,
    val previous: String? = null,
    val format: String? = null,
    val deltaFormat: String? = null,
    val positiveIsUp: Boolean? = null,
    val deltaLabel: String? = null
)

@Serializable
data class DashboardKPITableDef(
    val rows: List<DashboardKPIRowDef> = emptyList()
)

@Serializable
data class DashboardKPIRowDef(
    val id: String? = null,
    val label: String? = null,
    val value: String? = null,
    val format: String? = null,
    val context: String? = null,
    val contextTone: String? = null
)

@Serializable
data class DashboardFiltersDef(
    val items: List<DashboardFilterItemDef> = emptyList()
)

@Serializable
data class DashboardFilterItemDef(
    val id: String? = null,
    val label: String? = null,
    val field: String? = null,
    val multiple: Boolean? = null,
    val options: List<DashboardFilterOptionDef> = emptyList()
)

@Serializable
data class DashboardFilterOptionDef(
    val label: String? = null,
    val value: String? = null,
    val default: Boolean? = null
)

@Serializable
data class DashboardTimelineDef(
    val viewModes: List<String> = emptyList(),
    val annotations: DashboardAnnotationDef? = null
)

@Serializable
data class DashboardAnnotationDef(
    val selector: String? = null
)

@Serializable
data class DashboardDimensionsDef(
    val dimension: DashboardFieldDef? = null,
    val metric: DashboardFieldDef? = null,
    val viewModes: List<String> = emptyList(),
    val limit: Int? = null,
    val orderBy: String? = null
)

@Serializable
data class DashboardFieldDef(
    val key: String? = null,
    val label: String? = null,
    val format: String? = null
)

@Serializable
data class DashboardMessagesDef(
    val items: List<DashboardMessageDef> = emptyList()
)

@Serializable
data class DashboardMessageDef(
    val severity: String? = null,
    val title: String? = null,
    val body: String? = null,
    val visibleWhen: DashboardConditionDef? = null
)

@Serializable
data class DashboardStatusDef(
    val checks: List<DashboardStatusCheckDef> = emptyList()
)

@Serializable
data class DashboardStatusCheckDef(
    val id: String? = null,
    val label: String? = null,
    val selector: String? = null,
    val format: String? = null,
    val tone: DashboardToneDef? = null
)

@Serializable
data class DashboardToneDef(
    val warningAbove: Double? = null,
    val dangerAbove: Double? = null,
    val successAbove: Double? = null,
    val warningBelow: Double? = null,
    val dangerBelow: Double? = null,
    val successBelow: Double? = null
)

@Serializable
data class DashboardFeedDef(
    val fields: DashboardFeedFieldsDef? = null
)

@Serializable
data class DashboardFeedFieldsDef(
    val title: String? = null,
    val body: String? = null,
    val timestamp: String? = null,
    val severity: String? = null
)

@Serializable
data class DashboardReportDef(
    val sections: List<DashboardReportSectionDef> = emptyList()
)

@Serializable
data class DashboardReportSectionDef(
    val id: String? = null,
    val title: String? = null,
    val body: List<String> = emptyList(),
    val tone: String? = null,
    val visibleWhen: DashboardConditionDef? = null
)

@Serializable
data class DashboardDetailDef(
    val reserved: String? = null
)

@Serializable
data class TableDef(
    val columns: List<ColumnDef> = emptyList(),
    val toolbar: ToolbarDef? = null,
    val on: List<ExecutionDef> = emptyList(),
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class ChartDef(
    val xAxis: ChartAxisDef? = null,
    val yAxis: ChartAxisDef? = null,
    val series: ChartSeriesDef? = null,
    val width: Int? = null,
    val height: Int? = null,
    val type: String? = null,
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class ChartAxisDef(
    val dataKey: String? = null,
    val label: String? = null,
    val tickFormat: String? = null
)

@Serializable
data class ChartSeriesDef(
    val nameKey: String? = null,
    val valueKey: String? = null,
    val palette: List<String> = emptyList(),
    val values: List<ChartValueOption> = emptyList()
)

@Serializable
data class ChartValueOption(
    val name: String? = null,
    val value: String? = null
)

@Serializable
data class FileBrowserDef(
    val title: String? = null,
    val folderOnly: Boolean? = null,
    val on: List<ExecutionDef> = emptyList(),
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class EditorDef(
    val selector: EditorSelectorDef? = null,
    val style: Map<String, String> = emptyMap(),
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class TerminalDef(
    val dataSourceRef: String? = null,
    val toolbar: ToolbarDef? = null,
    val height: String? = null,
    val prompt: String? = null,
    val autoScroll: Boolean? = null,
    val showDividers: Boolean? = null,
    val truncateLongOutput: Boolean? = null,
    val truncateLength: Int? = null,
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class EditorSelectorDef(
    val source: String? = null,
    val location: String? = null,
    val extension: String? = null
)

@Serializable
data class ToolbarDef(
    val items: List<ToolbarItemDef> = emptyList(),
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class ToolbarItemDef(
    val id: String? = null,
    val label: String? = null,
    val icon: String? = null,
    val align: String? = null,
    val on: List<ExecutionDef> = emptyList(),
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class ColumnDef(
    val id: String? = null,
    val name: String? = null,
    val label: String? = null,
    val type: String? = null,
    val width: Int? = null,
    val icon: String? = null,
    val on: List<ExecutionDef> = emptyList(),
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class ItemDef(
    val id: String? = null,
    val label: String? = null,
    val title: String? = null,
    val body: String? = null,
    val severity: String? = null,
    val current: String? = null,
    val previous: String? = null,
    val format: String? = null,
    val deltaFormat: String? = null,
    val positiveIsUp: Boolean? = null,
    val deltaLabel: String? = null,
    val type: String? = null,
    val field: String? = null,
    val multiple: Boolean? = null,
    val dataField: String? = null,
    val bindingPath: String? = null,
    val scope: String? = null,
    val visibleWhen: DashboardConditionDef? = null,
    val options: List<OptionDef> = emptyList(),
    val properties: Map<String, JsonElement> = emptyMap(),
    val on: List<ExecutionDef> = emptyList(),
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class OptionDef(
    val value: String? = null,
    val label: String? = null,
    val default: Boolean? = null
)

@Serializable
data class DialogDef(
    val id: String? = null,
    val title: String? = null,
    val content: ContainerDef? = null,
    val on: List<ExecutionDef> = emptyList(),
    val actions: List<ActionDef> = emptyList(),
    val style: Map<String, String> = emptyMap(),
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class ActionDef(
    val id: String? = null,
    val label: String? = null,
    val icon: String? = null,
    val on: List<ExecutionDef> = emptyList(),
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class DataSourceDef(
    val service: ServiceDef? = null,
    val selectionMode: String? = null,
    val autoSelect: Boolean? = null,
    val uniqueKey: List<UniqueKeyDef> = emptyList(),
    val selectors: SelectorDef? = null,
    val paging: PagingDef? = null,
    val params: Map<String, String> = emptyMap(),
    val parameters: List<ParameterDef> = emptyList(),
    val on: List<ExecutionDef> = emptyList(),
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class ServiceDef(
    val endpoint: String? = null,
    val uri: String? = null,
    val method: String? = null
)

@Serializable
data class UniqueKeyDef(
    val field: String? = null,
    val parameter: String? = null
)

@Serializable
data class SelectorDef(
    val data: String? = null,
    val dataInfo: String? = null,
    val metrics: String? = null
)

@Serializable
data class PagingDef(
    val size: Int? = null,
    val enabled: Boolean? = null,
    val parameters: Map<String, String> = emptyMap(),
    val dataInfoSelectors: Map<String, String> = emptyMap()
)

@Serializable
data class ExecutionDef(
    val event: String? = null,
    val handler: String? = null,
    val args: List<String> = emptyList(),
    val parameters: List<ParameterDef> = emptyList(),
    val init: String? = null,
    val onError: String? = null,
    val onDone: String? = null,
    val onSuccess: String? = null,
    val async: Boolean? = null,
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class ParameterDef(
    val name: String? = null,
    val kind: String? = null,
    @SerialName("in") val input: String? = null,
    val location: String? = null,
    val from: String? = null,
    val to: String? = null,
    val direction: String? = null,
    val output: Boolean? = null
)

@Serializable
data class ChatDef(
    val on: List<ExecutionDef> = emptyList(),
    val header: ChatHeaderDef? = null,
    val showUpload: Boolean? = null,
    val uploadField: String? = null,
    val showMic: Boolean? = null,
    val showSettings: Boolean? = null,
    val showAbort: Boolean? = null,
    val showTools: Boolean? = null,
    val commandCenter: Boolean? = null,
    val abortVisible: JsonElement? = null,
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class ChatHeaderDef(
    val title: String? = null,
    val left: List<ChatHeaderButtonDef> = emptyList(),
    val right: List<ChatHeaderButtonDef> = emptyList()
)

@Serializable
data class ChatHeaderButtonDef(
    val icon: String? = null,
    val label: String? = null,
    val on: List<ExecutionDef> = emptyList(),
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

// Runtime state containers

data class WindowState(
    val windowId: String,
    val windowKey: String,
    val windowTitle: String,
    val inTab: Boolean = true,
    val parameters: Map<String, Any?> = emptyMap(),
    val inlineMetadata: WindowMetadata? = null,
    val isModal: Boolean = false
)

data class SelectionState(
    val selected: Map<String, Any?>? = null,
    val selection: List<Map<String, Any?>> = emptyList(),
    val rowIndex: Int = -1
)

data class InputState(
    val filter: Map<String, Any?> = emptyMap(),
    val parameters: Map<String, Any?> = emptyMap(),
    val page: Int? = null,
    val fetch: Boolean = false,
    val refresh: Boolean = false
)

data class ControlState(
    val loading: Boolean = false,
    val error: String? = null,
    val inactive: Boolean = false
)

data class DialogState(
    val open: Boolean = false,
    val props: Map<String, Any?> = emptyMap(),
    val args: Map<String, Any?> = emptyMap()
)

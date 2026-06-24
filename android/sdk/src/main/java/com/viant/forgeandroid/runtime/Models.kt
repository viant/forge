package com.viant.forgeandroid.runtime

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonEncoder
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonNames
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull

@Serializable
data class WindowMetadata(
    val namespace: String? = null,
    val view: ViewDef? = null,
    @OptIn(ExperimentalSerializationApi::class)
    @JsonNames("dataSource", "dataSources")
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
    val id: String? = null,
    val layout: LayoutDef? = null,
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
    val scrollMode: String? = null,
    val role: String? = null,
    val dataSourceRef: String? = null,
    val card: CardDef? = null,
    val section: SectionDef? = null,
    val toolbar: ToolbarDef? = null,
    val filterBindings: Map<String, String> = emptyMap(),
    val selectionBindings: Map<String, String> = emptyMap(),
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
    val categoryKey: String? = null,
    val valueKey: String? = null,
    val nameKey: String? = null,
    val format: String? = null,
    val legendLimit: Int? = null,
    val dateField: String? = null,
    val timeKey: String? = null,
    val chartType: String? = null,
    val series: JsonElement? = null,
    val columns: List<ColumnDef> = emptyList(),
    val geo: JsonElement? = null,
    val table: TableDef? = null,
    val treeBrowser: TreeBrowserDef? = null,
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
    val reportRuntime: JsonElement? = null,
    val stateKey: String? = null,
    val actions: List<ActionDef> = emptyList(),
    val on: List<ExecutionDef> = emptyList(),
    val selectFirst: Boolean? = null,
    val fetchData: Boolean? = null,
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class CardDef(
    val elevation: Int? = null,
    val className: String? = null,
    val style: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class SectionDef(
    val properties: Map<String, JsonElement> = emptyMap()
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
    val showSubmit: Boolean? = null,
    val on: List<ExecutionDef> = emptyList()
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
    val placeholder: String? = null,
    val lookup: JsonElement? = null
)

@Serializable
data class TabsDef(
    val defaultSelectedTabId: String? = null,
    val selectedTabId: String? = null,
    val style: String? = null,
    val vertical: Boolean? = null
)

@Serializable
data class LayoutDef(
    val kind: String? = null,
    val orientation: String? = null,
    val rows: Int? = null,
    val columns: Int? = null,
    val labelPosition: String? = null,
    val gap: String? = null,
    val rowGap: String? = null
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
    val visibleWhen: DashboardConditionDef? = null,
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
    val reportBuilder: DashboardReportBuilderDef? = null,
    val reportRuntime: JsonElement? = null,
    val badges: DashboardBadgesDef? = null,
    val detail: DashboardDetailDef? = null
)

@Serializable
data class DashboardReportBuilderDef(
    val hooks: ReportBuilderHooksDef? = null,
    val filterPresentation: String? = null,
    val showFilterCategoryBar: Boolean? = null,
    val hiddenDynamicGroupIds: List<String> = emptyList(),
    val notices: List<ReportBuilderNoticeDef> = emptyList(),
    val primaryMeasure: String? = null,
    val measureSections: List<ReportBuilderMeasureSectionDef> = emptyList(),
    val measures: List<ReportBuilderMeasureDef> = emptyList(),
    val computedMeasures: List<ReportBuilderMeasureDef> = emptyList(),
    val dimensions: List<ReportBuilderDimensionDef> = emptyList(),
    val staticFilters: List<ReportBuilderStaticFilterDef> = emptyList(),
    val dynamicFilterGroups: List<ReportBuilderDynamicFilterGroupDef> = emptyList(),
    val dynamicFilterFamilies: List<ReportBuilderDynamicFilterFamilyDef> = emptyList(),
    @OptIn(ExperimentalSerializationApi::class)
    @JsonNames("forecastCategories")
    val resultCategories: List<String> = emptyList(),
    val groupBy: ReportBuilderGroupByDef? = null,
    val unifiedFamilyRows: Boolean = false,
    val showResultHeader: Boolean? = null,
    val result: ReportBuilderResultDef? = null
)

@Serializable
data class ReportBuilderHooksDef(
    val initializeState: String? = null,
    val buildRequest: String? = null,
    val resolveLookup: String? = null
)

@Serializable
data class ReportBuilderNoticeDef(
    val id: String? = null,
    val level: String? = null,
    val title: String? = null,
    val description: String? = null,
    val sourcePath: String? = null
)

@Serializable
data class ReportBuilderMeasureSectionDef(
    val id: String? = null,
    val label: String? = null
)

@Serializable
data class ReportBuilderGroupByDef(
    @SerialName("default")
    val defaultValue: String? = null,
    val options: List<ReportBuilderGroupByOptionDef> = emptyList()
)

@Serializable
data class ReportBuilderGroupByOptionDef(
    val id: String? = null,
    val value: String? = null,
    val label: String? = null,
    val dimensionId: String? = null,
    val paramPath: String? = null,
    val paramValue: JsonElement? = null
)

@Serializable
data class ReportBuilderMeasureDef(
    val id: String? = null,
    val key: String? = null,
    val label: String? = null,
    val section: String? = null,
    val format: String? = null,
    val paramPath: String? = null,
    @SerialName("default")
    val defaultValue: Boolean? = null,
    val color: String? = null,
    val hidden: Boolean? = null,
    val dependencies: List<String> = emptyList(),
    val compute: ReportBuilderComputeDef? = null
)

@Serializable
data class ReportBuilderComputeDef(
    val type: String? = null,
    val numerator: String? = null,
    val denominator: String? = null,
    val scale: Double? = null,
    val decimals: Int? = null
)

@Serializable
data class ReportBuilderDimensionDef(
    val id: String? = null,
    val key: String? = null,
    val displayKey: String? = null,
    val label: String? = null,
    val format: String? = null,
    val paramPath: String? = null,
    @SerialName("default")
    val defaultValue: Boolean? = null,
    val chartAxis: Boolean? = null,
    val hidden: Boolean? = null,
    val runtimeFilter: ReportBuilderRuntimeFilterDef? = null
)

@Serializable
data class ReportBuilderRuntimeFilterDef(
    val includeParamPath: String? = null,
    val excludeParamPath: String? = null,
    val format: String? = null,
    val parentField: String? = null
)

@Serializable
data class ReportBuilderResultDef(
    val chartCreationMode: String? = null,
    val defaultMode: String? = null,
    val viewModes: List<String> = emptyList(),
    val chartType: String? = null,
    val chartDataMode: String? = null,
    val chartRowLimit: Int? = null,
    val chartDataLimit: Int? = null,
    val chartWizard: ReportBuilderChartWizardDef? = null,
    val autoApplyDefaultChartOnResult: Boolean? = null,
    val defaultChartSpecs: List<ReportBuilderChartSpecDef> = emptyList()
)

@Serializable
data class ReportBuilderChartWizardDef(
    val supportedTypes: List<String> = emptyList()
)

@Serializable
data class ReportBuilderChartSpecDef(
    val title: String? = null,
    val type: String? = null,
    val xField: String? = null,
    val yFields: List<String> = emptyList(),
    val seriesField: String? = null
)

@Serializable
data class ReportBuilderStaticFilterDef(
    val id: String? = null,
    val label: String? = null,
    val type: String? = null,
    val required: Boolean? = null,
    val multiple: Boolean? = null,
    val paramPath: String? = null,
    val startParamPath: String? = null,
    val endParamPath: String? = null,
    val options: List<ReportBuilderStaticFilterOptionDef> = emptyList(),
    @SerialName("default")
    val defaultValue: JsonElement? = null
)

@Serializable
data class ReportBuilderStaticFilterOptionDef(
    val value: JsonElement? = null,
    val label: String? = null,
    val icon: String? = null,
    @SerialName("default")
    val defaultValue: Boolean? = null
)

@Serializable
data class ReportBuilderDynamicFilterGroupDef(
    val id: String? = null,
    val label: String? = null,
    val icon: String? = null,
    val description: String? = null,
    val filters: List<ReportBuilderDynamicFilterDef> = emptyList()
)

@Serializable
data class ReportBuilderDynamicFilterDef(
    val id: String? = null,
    val label: String? = null,
    val paramPath: String? = null,
    val multiple: Boolean? = null,
    val emitArray: Boolean? = null,
    val manualEntry: Boolean? = null,
    val manualValueType: String? = null,
    val manualPlaceholder: String? = null,
    val dialogId: String? = null,
    val valueSelector: String? = null,
    val labelSelector: String? = null,
    val groupSelector: String? = null,
    val recordSelectors: List<String> = emptyList(),
    val requestMapping: String? = null,
    val targetingFeatureKey: String? = null
)

@Serializable
data class ReportBuilderDynamicFilterFamilyDef(
    val id: String? = null,
    val label: String? = null,
    val icon: String? = null,
    val description: String? = null,
    val includeFilterIds: List<String> = emptyList(),
    val excludeFilterIds: List<String> = emptyList()
)

@Serializable
data class DashboardSummaryDef(
    val metrics: List<DashboardMetricDef> = emptyList(),
    val items: List<DashboardMetricDef> = emptyList()
)

@Serializable
data class DashboardMetricDef(
    val id: String? = null,
    val label: String? = null,
    val selector: String? = null,
    val field: String? = null,
    val key: String? = null,
    val valueField: String? = null,
    val format: String? = null,
    val tone: String? = null,
    val value: JsonElement? = null
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
    val deltaLabel: String? = null,
    val currentLabel: String? = null,
    val previousLabel: String? = null
)

@Serializable
data class DashboardKPITableDef(
    val rows: List<DashboardKPIRowDef> = emptyList(),
    val columns: List<ColumnDef> = emptyList()
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
    val type: String? = null,
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
data class DashboardBadgesDef(
    val items: List<DashboardBadgeDef> = emptyList()
)

@Serializable
data class DashboardBadgeDef(
    val id: String? = null,
    val label: String? = null,
    val value: String? = null,
    val tone: String? = null,
    val severity: String? = null,
    val visibleWhen: DashboardConditionDef? = null
)

@Serializable
data class DashboardMessageDef(
    val severity: String? = null,
    val title: String? = null,
    val body: String? = null,
    val text: String? = null,
    val field: String? = null,
    val bodyField: String? = null,
    val rowIndex: Int? = null,
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
    @Serializable(with = DashboardReportBodySerializer::class)
    val body: List<String> = emptyList(),
    val tone: String? = null,
    val visibleWhen: DashboardConditionDef? = null
)

object DashboardReportBodySerializer : KSerializer<List<String>> {
    private val delegate = ListSerializer(String.serializer())
    override val descriptor: SerialDescriptor = delegate.descriptor

    override fun deserialize(decoder: Decoder): List<String> {
        val jsonDecoder = decoder as? JsonDecoder ?: return delegate.deserialize(decoder)
        return when (val element = jsonDecoder.decodeJsonElement()) {
            is JsonArray -> element.mapNotNull { item ->
                (item as? JsonPrimitive)?.contentOrNull
            }
            is JsonPrimitive -> element.contentOrNull?.takeIf { it.isNotEmpty() }?.let { listOf(it) }.orEmpty()
            else -> emptyList()
        }
    }

    override fun serialize(encoder: Encoder, value: List<String>) {
        delegate.serialize(encoder, value)
    }
}

@Serializable
data class DashboardDetailDef(
    val reserved: String? = null
)

@Serializable
data class TableDef(
    val title: String? = null,
    val columns: List<ColumnDef> = emptyList(),
    val toolbar: ToolbarDef? = null,
    val on: List<ExecutionDef> = emptyList(),
    val selectionField: String? = null,
    val disabledField: String? = null,
    val callback: JsonElement? = null,
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class TreeBrowserDef(
    val title: String? = null,
    val dataSourceRef: String? = null,
    val pathField: String? = null,
    val labelField: String? = null,
    val valueField: String? = null,
    val subtitleField: String? = null,
    val childrenField: String? = null,
    val separator: String? = null,
    val lazyExpand: Boolean? = null,
    val className: String? = null,
    val style: Map<String, String> = emptyMap(),
    val on: List<ExecutionDef> = emptyList(),
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class ChartDef(
    val title: String? = null,
    val dataSourceRef: String? = null,
    val xAxis: ChartAxisDef? = null,
    val yAxis: ChartAxisDef? = null,
    val series: ChartSeriesDef? = null,
    val dataSourceRefSource: String? = null,
    val dataSourceRefSelector: String? = null,
    val dataSourceRefs: Map<String, String> = emptyMap(),
    val width: JsonElement? = null,
    val height: JsonElement? = null,
    val type: String? = null,
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap(),
    val kind: String? = null,
    val xKey: String? = null,
    val valueKey: String? = null,
    val nameKey: String? = null
)

@Serializable
data class ChartAxisDef(
    val dataKey: String? = null,
    val label: String? = null,
    val tickFormat: String? = null
)

@Serializable(with = ChartSeriesDefSerializer::class)
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

object ChartSeriesDefSerializer : KSerializer<ChartSeriesDef> {
    override val descriptor: SerialDescriptor = JsonElement.serializer().descriptor

    override fun deserialize(decoder: Decoder): ChartSeriesDef {
        val jsonDecoder = decoder as? JsonDecoder
            ?: throw SerializationException("ChartSeriesDef can only be decoded from JSON")
        return when (val element = jsonDecoder.decodeJsonElement()) {
            is JsonArray -> ChartSeriesDef(
                values = element.mapNotNull { item ->
                    (item as? JsonPrimitive)?.contentOrNull?.takeIf { it.isNotBlank() }?.let { value ->
                        ChartValueOption(value = value)
                    }
                }
            )
            is JsonPrimitive -> element.contentOrNull?.takeIf { it.isNotBlank() }?.let { value ->
                ChartSeriesDef(valueKey = value, values = listOf(ChartValueOption(value = value)))
            } ?: ChartSeriesDef()
            is JsonObject -> {
                val values = (element["values"] as? JsonArray)?.mapNotNull { item ->
                    when (item) {
                        is JsonPrimitive -> item.contentOrNull?.takeIf { it.isNotBlank() }?.let { value ->
                            ChartValueOption(value = value)
                        }
                        is JsonObject -> ChartValueOption(
                            name = (item["name"] as? JsonPrimitive)?.contentOrNull,
                            value = (item["value"] as? JsonPrimitive)?.contentOrNull
                        ).takeIf { !it.value.isNullOrBlank() }
                        else -> null
                    }
                }.orEmpty()
                val valueKey = (element["valueKey"] as? JsonPrimitive)?.contentOrNull
                ChartSeriesDef(
                    nameKey = (element["nameKey"] as? JsonPrimitive)?.contentOrNull,
                    valueKey = valueKey,
                    palette = (element["palette"] as? JsonArray)?.mapNotNull {
                        (it as? JsonPrimitive)?.contentOrNull
                    }.orEmpty(),
                    values = if (values.isNotEmpty()) {
                        values
                    } else {
                        valueKey?.takeIf { it.isNotBlank() }?.let { listOf(ChartValueOption(value = it)) }.orEmpty()
                    }
                )
            }
            else -> ChartSeriesDef()
        }
    }

    override fun serialize(encoder: Encoder, value: ChartSeriesDef) {
        val jsonEncoder = encoder as? JsonEncoder
            ?: throw SerializationException("ChartSeriesDef can only be encoded as JSON")
        val obj = linkedMapOf<String, JsonElement>()
        value.nameKey?.let { obj["nameKey"] = JsonPrimitive(it) }
        value.valueKey?.let { obj["valueKey"] = JsonPrimitive(it) }
        if (value.palette.isNotEmpty()) {
            obj["palette"] = JsonArray(value.palette.map { JsonPrimitive(it) })
        }
        if (value.values.isNotEmpty()) {
            obj["values"] = JsonArray(value.values.map { item ->
                val entry = linkedMapOf<String, JsonElement>()
                item.name?.let { entry["name"] = JsonPrimitive(it) }
                item.value?.let { entry["value"] = JsonPrimitive(it) }
                JsonObject(entry)
            })
        }
        jsonEncoder.encodeJsonElement(JsonObject(obj))
    }
}

@Serializable
data class FileBrowserDef(
    val title: String? = null,
    val dataSourceRef: String? = null,
    val folderOnly: Boolean? = null,
    val on: List<ExecutionDef> = emptyList(),
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class EditorDef(
    val selector: EditorSelectorDef? = null,
    val style: Map<String, String> = emptyMap(),
    val language: String? = null,
    val value: String? = null,
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
    val key: String? = null,
    val label: String? = null,
    val type: String? = null,
    val format: String? = null,
    val emptyText: String? = null,
    val sortable: Boolean? = null,
    val link: LinkDef? = null,
    val width: Int? = null,
    val icon: String? = null,
    val on: List<ExecutionDef> = emptyList(),
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class LinkDef(
    val href: String? = null,
    val kind: String? = null,
    val windowKey: String? = null,
    val windowTitle: String? = null,
    val windowTitleSource: String? = null,
    val windowTitleSelector: String? = null,
    val windowTitleTemplate: String? = null,
    val text: String? = null,
    val textSource: String? = null,
    val textSelector: String? = null,
    val title: String? = null,
    val inTab: Boolean? = null,
    val newInstance: Boolean? = null,
    val autoIndexTitle: Boolean? = null,
    val awaitResult: Boolean? = null,
    val modal: Boolean? = null,
    val parameters: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class ItemDef(
    val id: String? = null,
    val label: String? = null,
    val appearance: String? = null,
    val title: String? = null,
    val body: String? = null,
    val severity: String? = null,
    val current: String? = null,
    val previous: String? = null,
    val format: String? = null,
    val deltaFormat: String? = null,
    val positiveIsUp: Boolean? = null,
    val deltaLabel: String? = null,
    val currentLabel: String? = null,
    val previousLabel: String? = null,
    val type: String? = null,
    val field: String? = null,
    val required: Boolean? = null,
    val multiple: Boolean? = null,
    val dataSourceRef: String? = null,
    val dataSourceRefSource: String? = null,
    val dataSourceRefSelector: String? = null,
    val dataSourceRefs: Map<String, String> = emptyMap(),
    val dataField: String? = null,
    val bindingPath: String? = null,
    val scope: String? = null,
    val value: JsonElement? = null,
    val link: LinkDef? = null,
    val visibleWhen: DashboardConditionDef? = null,
    val options: List<OptionDef> = emptyList(),
    val properties: Map<String, JsonElement> = emptyMap(),
    val on: List<ExecutionDef> = emptyList(),
    val target: JsonElement? = null,
    val targetOverrides: Map<String, JsonElement> = emptyMap(),
    val subtitle: String? = null
)

fun ItemDef.valueKey(): String? {
    return dataField?.trim()?.takeIf { it.isNotEmpty() }
        ?: bindingPath?.trim()?.takeIf { it.isNotEmpty() }
        ?: field?.trim()?.takeIf { it.isNotEmpty() }
        ?: id?.trim()?.takeIf { it.isNotEmpty() }
}

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
    val dataSourceRef: String? = null,
    val selectionMode: String? = null,
    val content: ContainerDef? = null,
    val on: List<ExecutionDef> = emptyList(),
    val actions: List<ActionDef> = emptyList(),
    val properties: Map<String, JsonElement> = emptyMap(),
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
    val autoFetch: Boolean? = null,
    val uniqueKey: List<UniqueKeyDef> = emptyList(),
    val selectors: SelectorDef? = null,
    val paging: PagingDef? = null,
    val params: Map<String, String> = emptyMap(),
    val parameters: List<ParameterDef> = emptyList(),
    val uri: String? = null,
    val method: String? = null,
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

@Serializable(with = ParameterDefSerializer::class)
data class ParameterDef(
    val name: String? = null,
    val kind: String? = null,
    @SerialName("in") val input: String? = null,
    val location: String? = null,
    val locationValue: JsonElement? = null,
    val from: String? = null,
    val to: String? = null,
    val direction: String? = null,
    val output: Boolean? = null,
    val value: JsonElement? = null,
    val selector: String? = null
)

object ParameterDefSerializer : KSerializer<ParameterDef> {
    override val descriptor: SerialDescriptor = JsonElement.serializer().descriptor

    override fun deserialize(decoder: Decoder): ParameterDef {
        val jsonDecoder = decoder as? JsonDecoder
            ?: throw SerializationException("ParameterDef can only be decoded from JSON")
        val obj = jsonDecoder.decodeJsonElement() as? JsonObject
            ?: throw SerializationException("ParameterDef must be a JSON object")
        val locationElement = obj["location"]
        return ParameterDef(
            name = stringField(obj, "name"),
            kind = stringField(obj, "kind"),
            input = stringField(obj, "in"),
            location = (locationElement as? JsonPrimitive)?.contentOrNull,
            locationValue = locationElement,
            from = stringField(obj, "from"),
            to = stringField(obj, "to"),
            direction = stringField(obj, "direction"),
            output = boolField(obj, "output"),
            value = obj["value"],
            selector = stringField(obj, "selector")
        )
    }

    override fun serialize(encoder: Encoder, value: ParameterDef) {
        val jsonEncoder = encoder as? JsonEncoder
            ?: throw SerializationException("ParameterDef can only be encoded as JSON")
        val obj = linkedMapOf<String, JsonElement>()
        putString(obj, "name", value.name)
        putString(obj, "kind", value.kind)
        putString(obj, "in", value.input)
        value.locationValue?.let { obj["location"] = it }
            ?: value.location?.let { obj["location"] = JsonPrimitive(it) }
        putString(obj, "from", value.from)
        putString(obj, "to", value.to)
        putString(obj, "direction", value.direction)
        value.output?.let { obj["output"] = JsonPrimitive(it) }
        value.value?.let { obj["value"] = it }
        putString(obj, "selector", value.selector)
        jsonEncoder.encodeJsonElement(JsonObject(obj))
    }

    private fun stringField(obj: JsonObject, key: String): String? =
        (obj[key] as? JsonPrimitive)?.contentOrNull

    private fun boolField(obj: JsonObject, key: String): Boolean? =
        (obj[key] as? JsonPrimitive)?.booleanOrNull

    private fun putString(obj: MutableMap<String, JsonElement>, key: String, value: String?) {
        if (value != null) {
            obj[key] = JsonPrimitive(value)
        }
    }
}

fun ParameterDef.locationElement(): JsonElement? =
    locationValue ?: location?.let { JsonPrimitive(it) }

fun ParameterDef.locationAny(): Any? =
    locationElement()?.takeUnless { it is JsonNull }?.let(JsonUtil::elementToAny)

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
    val isModal: Boolean = false,
    val conversationId: String? = null,
    val presentation: String? = null,
    val region: String? = null,
    val workspaceSharePct: Int? = null,
    val workspaceMinHeight: Int? = null,
    val parentKey: String? = null
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
    val inactive: Boolean = false,
    val resolved: Boolean = false
)

data class DialogState(
    val open: Boolean = false,
    val selectionMode: String? = null,
    val props: Map<String, Any?> = emptyMap(),
    val args: Map<String, Any?> = emptyMap()
)

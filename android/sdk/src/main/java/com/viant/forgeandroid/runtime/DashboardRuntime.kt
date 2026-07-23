package com.viant.forgeandroid.runtime

import java.text.NumberFormat
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonPrimitive

data class DashboardSelectionState(
    val dimension: String? = null,
    val entityKey: String? = null,
    val pointKey: String? = null,
    val selected: Map<String, Any?>? = null,
    val sourceBlockId: String? = null
)

data class DashboardGeoMapRow(
    val regionCode: String,
    val label: String,
    val value: Double,
    val tone: String? = null,
    val rank: Int? = null,
    val href: String? = null
)

data class DashboardGeoStateTile(
    val key: String,
    val label: String,
    val column: Int,
    val row: Int
)

data class DashboardGeoTileRegion(
    val tile: DashboardGeoStateTile,
    val value: DashboardGeoMapRow?,
    val paletteIndex: Int?
)

val dashboardUSStateTiles = listOf(
    DashboardGeoStateTile("AK", "Alaska", 1, 1),
    DashboardGeoStateTile("ME", "Maine", 12, 1),
    DashboardGeoStateTile("VT", "Vermont", 10, 2),
    DashboardGeoStateTile("NH", "New Hampshire", 11, 2),
    DashboardGeoStateTile("MA", "Massachusetts", 12, 2),
    DashboardGeoStateTile("WA", "Washington", 1, 3),
    DashboardGeoStateTile("ID", "Idaho", 2, 3),
    DashboardGeoStateTile("MT", "Montana", 3, 3),
    DashboardGeoStateTile("ND", "North Dakota", 4, 3),
    DashboardGeoStateTile("MN", "Minnesota", 5, 3),
    DashboardGeoStateTile("IL", "Illinois", 6, 3),
    DashboardGeoStateTile("WI", "Wisconsin", 7, 3),
    DashboardGeoStateTile("MI", "Michigan", 8, 3),
    DashboardGeoStateTile("NY", "New York", 10, 3),
    DashboardGeoStateTile("RI", "Rhode Island", 11, 3),
    DashboardGeoStateTile("CT", "Connecticut", 12, 3),
    DashboardGeoStateTile("OR", "Oregon", 1, 4),
    DashboardGeoStateTile("NV", "Nevada", 2, 4),
    DashboardGeoStateTile("WY", "Wyoming", 3, 4),
    DashboardGeoStateTile("SD", "South Dakota", 4, 4),
    DashboardGeoStateTile("IA", "Iowa", 5, 4),
    DashboardGeoStateTile("IN", "Indiana", 6, 4),
    DashboardGeoStateTile("OH", "Ohio", 7, 4),
    DashboardGeoStateTile("PA", "Pennsylvania", 8, 4),
    DashboardGeoStateTile("NJ", "New Jersey", 10, 4),
    DashboardGeoStateTile("CA", "California", 1, 5),
    DashboardGeoStateTile("UT", "Utah", 2, 5),
    DashboardGeoStateTile("CO", "Colorado", 3, 5),
    DashboardGeoStateTile("NE", "Nebraska", 4, 5),
    DashboardGeoStateTile("MO", "Missouri", 5, 5),
    DashboardGeoStateTile("KY", "Kentucky", 6, 5),
    DashboardGeoStateTile("WV", "West Virginia", 7, 5),
    DashboardGeoStateTile("VA", "Virginia", 8, 5),
    DashboardGeoStateTile("MD", "Maryland", 9, 5),
    DashboardGeoStateTile("DE", "Delaware", 10, 5),
    DashboardGeoStateTile("AZ", "Arizona", 2, 6),
    DashboardGeoStateTile("NM", "New Mexico", 3, 6),
    DashboardGeoStateTile("KS", "Kansas", 4, 6),
    DashboardGeoStateTile("AR", "Arkansas", 5, 6),
    DashboardGeoStateTile("TN", "Tennessee", 6, 6),
    DashboardGeoStateTile("NC", "North Carolina", 7, 6),
    DashboardGeoStateTile("SC", "South Carolina", 8, 6),
    DashboardGeoStateTile("DC", "District of Columbia", 9, 6),
    DashboardGeoStateTile("HI", "Hawaii", 1, 7),
    DashboardGeoStateTile("OK", "Oklahoma", 4, 7),
    DashboardGeoStateTile("LA", "Louisiana", 5, 7),
    DashboardGeoStateTile("MS", "Mississippi", 6, 7),
    DashboardGeoStateTile("AL", "Alabama", 7, 7),
    DashboardGeoStateTile("GA", "Georgia", 8, 7),
    DashboardGeoStateTile("TX", "Texas", 4, 8),
    DashboardGeoStateTile("FL", "Florida", 9, 8)
)

val dashboardDefaultGeoPalette = listOf(
    "#d9f0ea",
    "#9fd8ce",
    "#55b9aa",
    "#187f78",
    "#0c4d52"
)

fun dashboardSupportsGeoShape(shape: String?): Boolean {
    return shape?.trim()?.lowercase() in setOf("us-states", "us-state-tiles")
}

fun dashboardGeoPaletteIndex(
    value: Double,
    minimum: Double,
    maximum: Double,
    paletteSize: Int
): Int {
    if (paletteSize <= 1 || maximum <= minimum) {
        return (paletteSize - 1).coerceAtLeast(0)
    }
    val ratio = ((value - minimum) / (maximum - minimum)).coerceIn(0.0, 1.0)
    return kotlin.math.floor(ratio * paletteSize)
        .toInt()
        .coerceIn(0, paletteSize - 1)
}

fun dashboardGeoTileRegions(
    rows: List<DashboardGeoMapRow>,
    paletteSize: Int = dashboardDefaultGeoPalette.size
): List<DashboardGeoTileRegion> {
    val rowsByKey = rows
        .sortedByDescending { it.value }
        .associateBy { it.regionCode.trim().uppercase() }
    val values = rowsByKey.values.map { it.value }.filter { it.isFinite() }
    val minimum = values.minOrNull() ?: 0.0
    val maximum = values.maxOrNull() ?: 0.0
    return dashboardUSStateTiles.map { tile ->
        val value = rowsByKey[tile.key]
        DashboardGeoTileRegion(
            tile = tile,
            value = value,
            paletteIndex = value?.takeIf { it.value.isFinite() }?.let {
                dashboardGeoPaletteIndex(it.value, minimum, maximum, paletteSize)
            }
        )
    }
}

data class DashboardDimensionRow(
    val entityKey: String?,
    val value: Double,
    val row: Map<String, Any?>
)

data class DashboardSummaryResolvedCard(
    val id: String?,
    val label: String,
    val displayValue: String,
    val tone: String?
)

data class DashboardReportRuntimeKpiValue(
    val description: String?,
    val valueLabel: String,
    val valueText: String?,
    val secondaryLabel: String?,
    val secondaryValueText: String?,
    val emptyLabel: String,
    val rowCount: Int
)

data class DashboardReportRuntimeFilterParamValue(
    val id: String,
    val description: String?,
    val valueText: String
)

data class DashboardReportRuntimeFilterBarValue(
    val title: String,
    val params: List<DashboardReportRuntimeFilterParamValue>
)

data class DashboardReportRuntimeRefinementValue(
    val id: String,
    val label: String
)

data class DashboardReportRuntimeRefinementBarValue(
    val title: String?,
    val emptyLabel: String,
    val refinements: List<DashboardReportRuntimeRefinementValue>
)

data class DashboardReportRuntimeDiagnostic(
    val id: String,
    val severity: String,
    val code: String?,
    val blockId: String?,
    val path: String?,
    val message: String,
    val suggestedFix: String?
) {
    val isError: Boolean
        get() = severity.equals("error", ignoreCase = true)
}

data class DashboardReportRuntimeActionField(
    val id: String,
    val kind: String? = null,
    val valueKey: String,
    val displayValueKey: String,
    val label: String,
    val selectionSource: String? = null,
    val runtimeFilterable: Boolean
)

data class DashboardReportRuntimeActionDescriptor(
    val id: String,
    val kind: String,
    val fieldValueKey: String,
    val label: String,
    val nextFieldRef: String? = null,
    val targetRef: String? = null,
    val selectionDimension: String? = null
)

data class DashboardReportRuntimeActionRefinement(
    val op: String,
    val field: String,
    val value: Any?,
    val sourceBlockId: String?,
    val fieldLabel: String?,
    val label: String
)

data class DashboardReportRuntimeActionTransition(
    val sourceField: String,
    val nextFieldRef: String,
    val sourceBlockId: String?
)

data class DashboardReportRuntimeDetailAction(
    val id: String,
    val kind: String,
    val label: String,
    val targetRef: String
)

data class DashboardReportRuntimeDetailRequest(
    val action: DashboardReportRuntimeDetailAction,
    val item: Map<String, Any?>,
    val value: Any?,
    val field: DashboardReportRuntimeActionField,
    val sourceBlockId: String?
)

data class DashboardReportRuntimeActionExecution(
    val id: String,
    val label: String,
    val kind: String,
    val refinement: DashboardReportRuntimeActionRefinement? = null,
    val transition: DashboardReportRuntimeActionTransition? = null,
    val detailRequest: DashboardReportRuntimeDetailRequest? = null,
    val selection: DashboardSelectionState? = null
)

data class DashboardReportRuntimeChartSelection(
    val xValue: Any? = null,
    val seriesKey: Any? = null,
    val row: Map<String, Any?> = emptyMap(),
    val selectionRows: List<Map<String, Any?>> = emptyList()
)

data class DashboardReportRuntimeTableValue(
    val dataSourceRef: String?,
    val columns: List<ColumnDef>,
    val rows: List<Map<String, Any?>>,
    val limit: Int,
    val actionFields: List<DashboardReportRuntimeActionField> = emptyList(),
    val actionDescriptors: List<DashboardReportRuntimeActionDescriptor> = emptyList()
)

data class DashboardReportRuntimeChartValue(
    val dataSourceRef: String?,
    val chart: ChartDef,
    val rows: List<Map<String, Any?>>,
    val actionFields: List<DashboardReportRuntimeActionField> = emptyList(),
    val actionDescriptors: List<DashboardReportRuntimeActionDescriptor> = emptyList()
)

data class DashboardReportRuntimeGeoMapValue(
    val dataSourceRef: String?,
    val shape: String,
    val metricLabel: String,
    val metricFormat: String?,
    val rows: List<DashboardGeoMapRow>
)

data class DashboardReportRuntimeBlockSummary(
    val id: String,
    val kind: String,
    val title: String,
    val diagnostics: List<DashboardReportRuntimeDiagnostic> = emptyList(),
    val content: Map<String, JsonElement> = emptyMap(),
    val runtime: JsonObject = JsonObject(emptyMap()),
    val markdown: String? = null,
    val kpi: DashboardReportRuntimeKpiValue? = null,
    val filterBar: DashboardReportRuntimeFilterBarValue? = null,
    val refinementBar: DashboardReportRuntimeRefinementBarValue? = null,
    val table: DashboardReportRuntimeTableValue? = null,
    val chart: DashboardReportRuntimeChartValue? = null,
    val geoMap: DashboardReportRuntimeGeoMapValue? = null
)

data class DashboardReportRuntimeSummary(
    val title: String?,
    val subtitle: String?,
    val blockCount: Int,
    val blocks: List<DashboardReportRuntimeBlockSummary> = emptyList(),
    val diagnostics: List<DashboardReportRuntimeDiagnostic> = emptyList()
)

fun WindowContext.dashboardKey(container: ContainerDef): String {
    return container.dashboard?.key ?: "${windowId}:${container.id ?: "dashboard"}"
}

fun WindowContext.dashboardFilterSignal(container: ContainerDef): Signal<Map<String, Any?>> {
    return signals.dashboardFilters(dashboardKey(container))
}

fun WindowContext.dashboardSelectionSignal(container: ContainerDef): Signal<DashboardSelectionState> {
    return signals.dashboardSelection(dashboardKey(container))
}

fun WindowContext.evaluateDashboardVisibility(
    container: ContainerDef,
    metrics: Map<String, Any?> = emptyMap(),
    filters: Map<String, Any?> = emptyMap(),
    selection: DashboardSelectionState = DashboardSelectionState()
): Boolean {
    return evaluateDashboardCondition(container.dashboard?.visibleWhen ?: container.visibleWhen, metrics, filters, selection)
}

fun visibleDashboardDetailChildren(
    container: ContainerDef,
    metrics: Map<String, Any?> = emptyMap(),
    filters: Map<String, Any?> = emptyMap(),
    selection: DashboardSelectionState = DashboardSelectionState()
): List<ContainerDef> {
    return container.containers.filter { child ->
        evaluateDashboardCondition(child.dashboard?.visibleWhen ?: child.visibleWhen, metrics, filters, selection)
    }
}

fun dashboardReportRuntimeConfig(container: ContainerDef): JsonObject? {
    (container.reportRuntime as? JsonObject)?.takeIf { it.isNotEmpty() }?.let { return it }
    (container.dashboard?.reportRuntime as? JsonObject)?.takeIf { it.isNotEmpty() }?.let { return it }
    return null
}

fun dashboardReportRuntimeSummary(container: ContainerDef): DashboardReportRuntimeSummary {
    val config = dashboardReportRuntimeConfig(container)
    val reportSpec = config?.get("reportSpec") as? JsonObject
    val reportFill = config?.get("reportFill") as? JsonObject
    val blockOrder = (((reportSpec?.get("layoutIntent") as? JsonObject)?.get("blockOrder") as? JsonArray).orEmpty())
        .mapNotNull { jsonString(it) }
    val datasets = dashboardReportRuntimeDatasets((reportFill?.get("datasets") as? JsonArray).orEmpty())
    val datasetDiagnostics = dashboardReportRuntimeDatasetDiagnostics(datasets)
    val diagnostics = dashboardReportRuntimeDiagnostics((reportFill?.get("diagnostics") as? JsonArray).orEmpty())
    val pageSize = dashboardReportRuntimeInt((reportSpec?.get("parameters") as? JsonObject)?.get("pageSize")) ?: 50
    val blocks = dashboardReportRuntimeBlocks(
        values = (reportFill?.get("blocks") as? JsonArray) ?: (reportSpec?.get("blocks") as? JsonArray).orEmpty(),
        reportSpec = reportSpec ?: JsonObject(emptyMap()),
        blockOrder = blockOrder,
        datasets = datasets,
        pageSize = pageSize,
        diagnostics = diagnostics,
        datasetDiagnostics = datasetDiagnostics
    )
    return DashboardReportRuntimeSummary(
        title = firstNonBlank(
            jsonString(config?.get("title")),
            jsonString(reportSpec?.get("title")),
            container.title
        ),
        subtitle = firstNonBlank(
            jsonString(config?.get("subtitle")),
            jsonString(reportSpec?.get("subtitle")),
            container.subtitle
        ),
        blockCount = blocks.size,
        blocks = blocks,
        diagnostics = diagnostics
    )
}

fun dashboardReportRuntimeBlocks(
    values: List<JsonElement>,
    reportSpec: JsonObject = JsonObject(emptyMap()),
    blockOrder: List<String> = emptyList(),
    datasets: Map<String, JsonObject> = emptyMap(),
    pageSize: Int = 50,
    diagnostics: List<DashboardReportRuntimeDiagnostic> = emptyList(),
    datasetDiagnostics: Map<String, List<DashboardReportRuntimeDiagnostic>> = emptyMap()
): List<DashboardReportRuntimeBlockSummary> {
    val blocks = values.mapIndexedNotNull { index, value ->
        val block = value as? JsonObject ?: return@mapIndexedNotNull null
        val id = firstNonBlank(
            jsonString(block["id"]),
            jsonString(block["key"]),
            "block-${index + 1}"
        ) ?: return@mapIndexedNotNull null
        val kind = firstNonBlank(
            jsonString(block["kind"]),
            jsonString(block["type"]),
            "block"
        ) ?: "block"
        val content = block["content"] as? JsonObject
        val title = firstNonBlank(
            jsonString(block["title"]),
            jsonString(block["label"]),
            jsonString(content?.get("title")),
            id
        ) ?: id
        val markdown = if (kind == "markdownBlock") {
            firstNonBlank(jsonString(content?.get("markdown")), jsonString(block["markdown"]))
        } else {
            null
        }
        val kpi = if (kind == "kpiBlock") dashboardReportRuntimeKpi(content.orEmpty()) else null
        val filterBar = if (kind == "filterBarBlock") {
            dashboardReportRuntimeFilterBar(block = block, content = content.orEmpty(), reportSpec = reportSpec)
        } else {
            null
        }
        val refinementBar = if (kind == "refinementBarBlock") {
            dashboardReportRuntimeRefinementBar(block = block, content = content.orEmpty(), reportSpec = reportSpec)
        } else {
            null
        }
        val table = if (kind == "tableBlock") {
            dashboardReportRuntimeTable(block = block, content = content.orEmpty(), reportSpec = reportSpec, datasets = datasets, pageSize = pageSize)
        } else {
            null
        }
        val chart = if (kind == "chartBlock") {
            dashboardReportRuntimeChart(block = block, content = content.orEmpty(), reportSpec = reportSpec, datasets = datasets)
        } else {
            null
        }
        val geoMap = if (kind == "geoMapBlock") {
            dashboardReportRuntimeGeoMap(block = block, content = content.orEmpty(), datasets = datasets)
        } else {
            null
        }
        DashboardReportRuntimeBlockSummary(
            id = id,
            kind = kind,
            title = title,
            diagnostics = diagnostics.filter { it.blockId == id } + datasetDiagnostics[jsonString(block["datasetRef"])].orEmpty(),
            content = if (kind in setOf(
                    "badgesBlock", "collectionBlock", "sectionBlock", "tabGroupBlock", "compositeBlock",
                    "stepperBlock", "infoPanelBlock", "calloutBlock", "kanbanBlock", "timelineBlock"
                )) content.orEmpty() else emptyMap(),
            runtime = block["runtime"] as? JsonObject ?: JsonObject(emptyMap()),
            markdown = markdown,
            kpi = kpi,
            filterBar = filterBar,
            refinementBar = refinementBar,
            table = table,
            chart = chart,
            geoMap = geoMap
        )
    }
    if (blockOrder.isEmpty()) {
        return blocks
    }
    val blockById = blocks.associateBy { it.id }
    val seen = mutableSetOf<String>()
    val ordered = mutableListOf<DashboardReportRuntimeBlockSummary>()
    blockOrder.forEach { id ->
        val block = blockById[id] ?: return@forEach
        if (seen.add(id)) {
            ordered += block
        }
    }
    ordered += blocks.filter { it.id !in seen }
    return ordered
}

fun dashboardReportRuntimeBlockVisible(
    block: DashboardReportRuntimeBlockSummary,
    metrics: Map<String, Any?> = emptyMap(),
    filters: Map<String, Any?> = emptyMap(),
    selection: DashboardSelectionState = DashboardSelectionState()
): Boolean {
    val conditionValue = block.runtime["visibleWhen"] ?: return true
    val decoded = runCatching {
        Json { ignoreUnknownKeys = true }.decodeFromJsonElement<DashboardConditionDef>(conditionValue)
    }.getOrNull() ?: return true
    val selector = decoded.selector?.trim().orEmpty()
    val condition = when {
        selector.startsWith("dashboard.selection.") -> decoded.copy(
            source = "selection",
            selector = null,
            field = selector.removePrefix("dashboard.selection.")
        )
        selector.startsWith("filters.") -> decoded.copy(
            source = "filters",
            selector = null,
            field = selector.removePrefix("filters.")
        )
        else -> decoded
    }
    return evaluateDashboardCondition(condition, metrics, filters, selection)
}

fun dashboardReportRuntimeDiagnostics(values: List<JsonElement>): List<DashboardReportRuntimeDiagnostic> {
    return values.mapIndexedNotNull { index, value ->
        val obj = value as? JsonObject ?: return@mapIndexedNotNull null
        val message = firstNonBlank(
            jsonString(obj["message"]),
            jsonString(obj["detail"]),
            jsonString(obj["description"]),
            "Runtime diagnostic"
        ) ?: "Runtime diagnostic"
        val code = jsonString(obj["code"])
        val blockId = firstNonBlank(jsonString(obj["blockId"]), jsonString(obj["blockID"]))
        val path = jsonString(obj["path"])
        DashboardReportRuntimeDiagnostic(
            id = listOfNotNull(code, blockId, path, "${index + 1}").joinToString(":"),
            severity = jsonString(obj["severity"]) ?: "info",
            code = code,
            blockId = blockId,
            path = path,
            message = message,
            suggestedFix = jsonString(obj["suggestedFix"])
        )
    }
}

fun dashboardReportRuntimeDatasets(values: List<JsonElement>): Map<String, JsonObject> {
    return values.mapNotNull { value ->
        val dataset = value as? JsonObject ?: return@mapNotNull null
        val id = jsonString(dataset["id"]) ?: return@mapNotNull null
        id to dataset
    }.toMap()
}

fun dashboardReportRuntimeDatasetDiagnostics(
    datasets: Map<String, JsonObject>
): Map<String, List<DashboardReportRuntimeDiagnostic>> {
    return datasets.mapValues { (datasetId, dataset) ->
        dashboardReportRuntimeDiagnostics(
            (((dataset["provenance"] as? JsonObject)?.get("diagnostics")) as? JsonArray).orEmpty()
        ).map { diagnostic ->
            diagnostic.copy(id = "dataset:$datasetId:${diagnostic.id}")
        }
    }.filterValues { it.isNotEmpty() }
}

fun dashboardReportRuntimeTable(
    block: JsonObject,
    content: Map<String, JsonElement>,
    reportSpec: JsonObject,
    datasets: Map<String, JsonObject>,
    pageSize: Int
): DashboardReportRuntimeTableValue {
    val datasetRef = jsonString(block["datasetRef"])
    val dataset = datasetRef?.let { datasets[it] }
    val rows = ((dataset?.get("rows") as? JsonArray).orEmpty())
        .mapNotNull { row -> (JsonUtil.elementToAny(row) as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value } }
    val columns = dashboardReportRuntimeColumns((content["columns"] as? JsonArray) ?: (block["columns"] as? JsonArray).orEmpty())
    val actionFields = dashboardReportRuntimeTableActionFields(reportSpec = reportSpec, block = block, content = content)
    val actionDescriptors = actionFields.flatMap {
        dashboardReportRuntimeActionDescriptors(
            reportSpec = reportSpec,
            blockId = jsonString(block["id"]),
            field = it,
            includeBlockIdInGeneratedId = false
        )
    } + dashboardReportRuntimeAuthoredSelectionDescriptors(block, actionFields)
    val rowCount = dashboardReportRuntimeInt((dataset?.get("provenance") as? JsonObject)?.get("rowCount"))
    val limit = maxOf(1, rowCount ?: pageSize)
    return DashboardReportRuntimeTableValue(
        dataSourceRef = jsonString(dataset?.get("dataSourceRef")) ?: datasetRef,
        columns = columns,
        rows = rows.take(limit),
        limit = limit,
        actionFields = actionFields,
        actionDescriptors = actionDescriptors
    )
}

fun dashboardReportRuntimeFilterBar(
    block: JsonObject,
    content: Map<String, JsonElement>,
    reportSpec: JsonObject = JsonObject(emptyMap())
): DashboardReportRuntimeFilterBarValue {
    val params = dashboardReportRuntimeFilterParamValues(block = block, content = content, reportSpec = reportSpec).mapNotNull { value ->
        val obj = value as? JsonObject ?: return@mapNotNull null
        val id = jsonString(obj["id"]) ?: return@mapNotNull null
        DashboardReportRuntimeFilterParamValue(
            id = id,
            description = jsonString(obj["description"]),
            valueText = dashboardReportRuntimeScopeValueText(obj["value"])
        )
    }
    return DashboardReportRuntimeFilterBarValue(
        title = firstNonBlank(jsonString(content["title"]), jsonString(block["title"]), "Report Scope") ?: "Report Scope",
        params = params
    )
}

fun dashboardReportRuntimeRefinementBar(
    block: JsonObject = JsonObject(emptyMap()),
    content: Map<String, JsonElement>,
    reportSpec: JsonObject = JsonObject(emptyMap())
): DashboardReportRuntimeRefinementBarValue {
    val refinementValues = if (content.containsKey("refinements")) {
        (content["refinements"] as? JsonArray).orEmpty()
    } else {
        (reportSpec["refinements"] as? JsonArray).orEmpty()
    }
    val refinements = refinementValues.mapIndexedNotNull { index, value ->
        val obj = value as? JsonObject ?: return@mapIndexedNotNull null
        DashboardReportRuntimeRefinementValue(
            id = jsonString(obj["id"]) ?: "refinement-${index + 1}",
            label = dashboardReportRuntimeRefinementLabel(obj)
        )
    }
    return DashboardReportRuntimeRefinementBarValue(
        title = firstNonBlank(jsonString(content["title"]), jsonString(block["title"])),
        emptyLabel = firstNonBlank(jsonString(content["emptyLabel"]), jsonString(block["emptyLabel"]), "No active refinements") ?: "No active refinements",
        refinements = refinements
    )
}

private fun dashboardReportRuntimeFilterParamValues(
    block: JsonObject,
    content: Map<String, JsonElement>,
    reportSpec: JsonObject
): List<JsonElement> {
    (content["params"] as? JsonArray)?.let { return it }
    val scopeParams = (((reportSpec["scope"] as? JsonObject)?.get("params")) as? JsonArray).orEmpty()
    val paramIds = ((block["paramIds"] as? JsonArray).orEmpty())
        .mapNotNull { jsonString(it) }
        .toSet()
    if (paramIds.isEmpty()) {
        return scopeParams
    }
    return scopeParams.filter { value ->
        val obj = value as? JsonObject ?: return@filter false
        val id = jsonString(obj["id"]) ?: return@filter false
        id in paramIds
    }
}

fun dashboardReportRuntimeChart(
    block: JsonObject,
    content: Map<String, JsonElement>,
    reportSpec: JsonObject,
    datasets: Map<String, JsonObject>
): DashboardReportRuntimeChartValue? {
    val chartElement = content["chartModel"] ?: block["chartModel"] ?: return null
    val chart = runCatching { JsonUtil.json.decodeFromJsonElement<ChartDef>(chartElement) }.getOrNull() ?: return null
    val datasetRef = jsonString(block["datasetRef"])
    val dataset = datasetRef?.let { datasets[it] }
    val rows = ((dataset?.get("rows") as? JsonArray).orEmpty())
        .mapNotNull { row -> (JsonUtil.elementToAny(row) as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value } }
    val actionFields = dashboardReportRuntimeChartActionFields(reportSpec = reportSpec, block = block, content = content)
    val actionDescriptors = actionFields.flatMap {
        dashboardReportRuntimeActionDescriptors(
            reportSpec = reportSpec,
            blockId = jsonString(block["id"]),
            field = it,
            includeBlockIdInGeneratedId = true
        )
    } + dashboardReportRuntimeAuthoredSelectionDescriptors(block, actionFields)
    return DashboardReportRuntimeChartValue(
        dataSourceRef = jsonString(dataset?.get("dataSourceRef")) ?: datasetRef,
        chart = chart,
        rows = rows,
        actionFields = actionFields,
        actionDescriptors = actionDescriptors
    )
}

fun dashboardReportRuntimeGeoMap(
    block: JsonObject,
    content: Map<String, JsonElement>,
    datasets: Map<String, JsonObject>
): DashboardReportRuntimeGeoMapValue {
    val geo = (content["geo"] as? JsonObject) ?: (block["geo"] as? JsonObject).orEmpty()
    val metric = (geo["metric"] as? JsonObject).orEmpty()
    val datasetRef = jsonString(block["datasetRef"])
    val dataset = datasetRef?.let { datasets[it] }
    val rows = ((dataset?.get("rows") as? JsonArray).orEmpty())
        .mapNotNull { row -> (JsonUtil.elementToAny(row) as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value } }
    val metricKey = jsonString(metric["key"])
    return DashboardReportRuntimeGeoMapValue(
        dataSourceRef = jsonString(dataset?.get("dataSourceRef")) ?: datasetRef,
        shape = jsonString(geo["shape"]) ?: "us-states",
        metricLabel = firstNonBlank(jsonString(metric["label"]), metricKey, "Metric") ?: "Metric",
        metricFormat = jsonString(metric["format"]),
        rows = rankedDashboardGeoMapRows(
            rows = rows,
            metricKey = metricKey,
            limit = Int.MAX_VALUE,
            regionKey = jsonString(geo["key"]),
            labelKey = jsonString(geo["labelKey"])
        )
    )
}

fun dashboardReportRuntimeTableActionFields(
    reportSpec: JsonObject,
    block: JsonObject,
    content: Map<String, JsonElement>
): List<DashboardReportRuntimeActionField> {
    val datasetRef = jsonString(block["datasetRef"])
    val requestedDimensions = dashboardReportRuntimeDatasetDimensions(reportSpec = reportSpec, datasetRef = datasetRef)
    val columns = ((content["columns"] as? JsonArray) ?: (block["columns"] as? JsonArray)).orEmpty()
    return columns.mapNotNull { value ->
        val column = value as? JsonObject ?: return@mapNotNull null
        val valueKey = firstNonBlank(
            jsonString(column["sourceKey"]),
            jsonString(column["displayKey"]),
            jsonString(column["key"])
        ) ?: return@mapNotNull null
        if (requestedDimensions.isNotEmpty() && valueKey !in requestedDimensions) {
            return@mapNotNull null
        }
        DashboardReportRuntimeActionField(
            id = jsonString(column["key"]) ?: valueKey,
            valueKey = valueKey,
            displayValueKey = firstNonBlank(jsonString(column["displayKey"]), jsonString(column["key"]), valueKey) ?: valueKey,
            label = jsonString(column["label"]) ?: valueKey,
            runtimeFilterable = jsonBoolean(column["runtimeFilterable"]) == true
        )
    }
}

fun dashboardReportRuntimeChartActionFields(
    reportSpec: JsonObject,
    block: JsonObject,
    content: Map<String, JsonElement>
): List<DashboardReportRuntimeActionField> {
    val chartSpec = (content["chartSpec"] as? JsonObject) ?: (block["chartSpec"] as? JsonObject).orEmpty()
    val datasetRef = jsonString(block["datasetRef"])
    return listOfNotNull(
        jsonString(chartSpec["xField"])?.let { field ->
            val column = dashboardReportRuntimeFieldColumn(reportSpec = reportSpec, datasetRef = datasetRef, fieldKey = field)
            DashboardReportRuntimeActionField(
                id = field,
                kind = "xField",
                valueKey = field,
                displayValueKey = firstNonBlank(jsonString(column?.get("displayKey")), jsonString(column?.get("key")), field) ?: field,
                label = jsonString(column?.get("label")) ?: field,
                selectionSource = "xValue",
                runtimeFilterable = jsonBoolean(column?.get("runtimeFilterable")) == true
            )
        },
        jsonString(chartSpec["seriesField"])?.let { field ->
            val column = dashboardReportRuntimeFieldColumn(reportSpec = reportSpec, datasetRef = datasetRef, fieldKey = field)
            DashboardReportRuntimeActionField(
                id = field,
                kind = "seriesField",
                valueKey = field,
                displayValueKey = firstNonBlank(jsonString(column?.get("displayKey")), jsonString(column?.get("key")), field) ?: field,
                label = jsonString(column?.get("label")) ?: field,
                selectionSource = "seriesKey",
                runtimeFilterable = jsonBoolean(column?.get("runtimeFilterable")) == true
            )
        }
    )
}

fun dashboardReportRuntimeActionDescriptors(
    reportSpec: JsonObject,
    blockId: String?,
    field: DashboardReportRuntimeActionField,
    includeBlockIdInGeneratedId: Boolean
): List<DashboardReportRuntimeActionDescriptor> {
    val descriptors = mutableListOf<DashboardReportRuntimeActionDescriptor>()
    if (field.runtimeFilterable) {
        descriptors += DashboardReportRuntimeActionDescriptor(
            id = dashboardReportRuntimeGeneratedActionId("keep", blockId, field.valueKey, includeBlockIdInGeneratedId),
            kind = "keep",
            fieldValueKey = field.valueKey,
            label = "Keep ${field.label}"
        )
        descriptors += DashboardReportRuntimeActionDescriptor(
            id = dashboardReportRuntimeGeneratedActionId("exclude", blockId, field.valueKey, includeBlockIdInGeneratedId),
            kind = "exclude",
            fieldValueKey = field.valueKey,
            label = "Exclude ${field.label}"
        )
    }
    dashboardReportRuntimeFieldActions(reportSpec = reportSpec, fieldValueKey = field.valueKey).forEach { action ->
        val kind = jsonString(action["kind"])?.lowercase() ?: return@forEach
        if (kind in setOf("keep", "exclude", "drill") && !field.runtimeFilterable) {
            return@forEach
        }
        when (kind) {
            "drill" -> {
                val nextFieldRef = jsonString(action["nextFieldRef"]) ?: return@forEach
                descriptors += DashboardReportRuntimeActionDescriptor(
                    id = jsonString(action["id"]) ?: dashboardReportRuntimeGeneratedActionId("drill", blockId, field.valueKey, includeBlockIdInGeneratedId),
                    kind = "drill",
                    fieldValueKey = field.valueKey,
                    label = jsonString(action["label"]) ?: "Drill ${field.label}",
                    nextFieldRef = nextFieldRef
                )
            }
            "detail" -> {
                val targetRef = jsonString(action["targetRef"]) ?: return@forEach
                descriptors += DashboardReportRuntimeActionDescriptor(
                    id = jsonString(action["id"]) ?: dashboardReportRuntimeGeneratedActionId("detail", blockId, field.valueKey, includeBlockIdInGeneratedId),
                    kind = "detail",
                    fieldValueKey = field.valueKey,
                    label = jsonString(action["label"]) ?: "Detail ${field.label}",
                    targetRef = targetRef
                )
            }
            "keep", "exclude" -> {
                descriptors += DashboardReportRuntimeActionDescriptor(
                    id = dashboardReportRuntimeGeneratedActionId(kind, blockId, field.valueKey, includeBlockIdInGeneratedId),
                    kind = kind,
                    fieldValueKey = field.valueKey,
                    label = jsonString(action["label"]) ?: "${kind.take(1).uppercase()}${kind.drop(1)} ${field.label}"
                )
            }
        }
    }
    return descriptors
}

fun dashboardReportRuntimeAuthoredSelectionDescriptors(
    block: JsonObject,
    fields: List<DashboardReportRuntimeActionField>
): List<DashboardReportRuntimeActionDescriptor> {
    val actions = (((block["runtime"] as? JsonObject)?.get("actions")) as? JsonArray).orEmpty()
    return actions.mapNotNull { value ->
        val action = value as? JsonObject ?: return@mapNotNull null
        if (!jsonString(action["kind"]).equals("select", ignoreCase = true)) return@mapNotNull null
        val dimension = jsonString(action["dimension"]) ?: return@mapNotNull null
        val field = fields.firstOrNull { it.valueKey == dimension } ?: return@mapNotNull null
        DashboardReportRuntimeActionDescriptor(
            id = jsonString(action["id"]) ?: "select_$dimension",
            kind = "select",
            fieldValueKey = field.valueKey,
            label = jsonString(action["label"]) ?: "Select ${field.label}",
            selectionDimension = dimension
        )
    }
}

fun dashboardReportRuntimeTableActionExecutions(
    blockId: String?,
    descriptors: List<DashboardReportRuntimeActionDescriptor>,
    field: DashboardReportRuntimeActionField,
    item: Map<String, Any?>
): List<DashboardReportRuntimeActionExecution> {
    val value = SelectorUtil.resolve(item, field.valueKey)
    if (dashboardReportRuntimeIsBlankValue(value)) {
        return emptyList()
    }
    val displayValue = SelectorUtil.resolve(item, field.displayValueKey)
        .takeUnless { dashboardReportRuntimeIsBlankValue(it) }
        ?: value
    return descriptors.mapNotNull { descriptor ->
        dashboardReportRuntimeActionExecution(
            descriptor = descriptor,
            field = field,
            value = value,
            displayValue = displayValue,
            sourceBlockId = blockId?.trim()?.takeIf { it.isNotEmpty() },
            item = item
        )
    }
}

fun dashboardReportRuntimeChartActionExecutions(
    blockId: String?,
    descriptors: List<DashboardReportRuntimeActionDescriptor>,
    fields: List<DashboardReportRuntimeActionField>,
    selection: DashboardReportRuntimeChartSelection
): List<DashboardReportRuntimeActionExecution> {
    val fieldsByValueKey = fields.associateBy { it.valueKey }
    val item = selection.row.toMutableMap()
    if (selection.selectionRows.isNotEmpty()) {
        item["selectionRows"] = selection.selectionRows
    }
    return descriptors.mapNotNull { descriptor ->
        val field = fieldsByValueKey[descriptor.fieldValueKey] ?: return@mapNotNull null
        val value = dashboardReportRuntimeChartSelectionValue(field, selection)
        if (dashboardReportRuntimeIsBlankValue(value)) {
            return@mapNotNull null
        }
        val displayValue = SelectorUtil.resolve(selection.row, field.displayValueKey)
            .takeUnless { dashboardReportRuntimeIsBlankValue(it) }
            ?: value
        dashboardReportRuntimeActionExecution(
            descriptor = descriptor,
            field = field,
            value = value,
            displayValue = displayValue,
            sourceBlockId = blockId?.trim()?.takeIf { it.isNotEmpty() },
            item = item
        )
    }
}

fun dashboardReportRuntimeActionExecutionPayload(
    execution: DashboardReportRuntimeActionExecution
): Map<String, Any?> {
    return buildMap {
        put("id", execution.id)
        put("label", execution.label)
        put("kind", execution.kind)
        execution.refinement?.let { refinement ->
            put(
                "refinement",
                mapOf(
                    "op" to refinement.op,
                    "field" to refinement.field,
                    "value" to refinement.value,
                    "sourceBlockId" to refinement.sourceBlockId,
                    "fieldLabel" to refinement.fieldLabel,
                    "label" to refinement.label
                )
            )
        }
        execution.selection?.let { selection -> put("selection", mapOf(
            "dimension" to selection.dimension,
            "entityKey" to selection.entityKey,
            "selected" to selection.selected,
            "sourceBlockId" to selection.sourceBlockId
        )) }
        execution.transition?.let { transition ->
            put(
                "transition",
                mapOf(
                    "sourceField" to transition.sourceField,
                    "nextFieldRef" to transition.nextFieldRef,
                    "sourceBlockId" to transition.sourceBlockId
                )
            )
        }
        execution.detailRequest?.let { detailRequest ->
            put(
                "detailRequest",
                mapOf(
                    "action" to mapOf(
                        "id" to detailRequest.action.id,
                        "kind" to detailRequest.action.kind,
                        "label" to detailRequest.action.label,
                        "targetRef" to detailRequest.action.targetRef
                    ),
                    "item" to detailRequest.item,
                    "value" to detailRequest.value,
                    "field" to dashboardReportRuntimeActionFieldPayload(detailRequest.field),
                    "sourceBlockId" to detailRequest.sourceBlockId
                )
            )
        }
    }
}

private fun dashboardReportRuntimeActionFieldPayload(
    field: DashboardReportRuntimeActionField
): Map<String, Any?> {
    return mapOf(
        "id" to field.id,
        "kind" to field.kind,
        "valueKey" to field.valueKey,
        "displayValueKey" to field.displayValueKey,
        "label" to field.label,
        "selectionSource" to field.selectionSource,
        "runtimeFilterable" to field.runtimeFilterable
    )
}

private fun dashboardReportRuntimeActionExecution(
    descriptor: DashboardReportRuntimeActionDescriptor,
    field: DashboardReportRuntimeActionField,
    value: Any?,
    displayValue: Any?,
    sourceBlockId: String?,
    item: Map<String, Any?>
): DashboardReportRuntimeActionExecution? {
    val label = "${descriptor.label} = ${dashboardReportRuntimeExecutionValueText(displayValue)}"
    return when (descriptor.kind) {
        "keep", "exclude" -> DashboardReportRuntimeActionExecution(
            id = descriptor.id,
            label = descriptor.label,
            kind = descriptor.kind,
            refinement = DashboardReportRuntimeActionRefinement(
                op = descriptor.kind,
                field = descriptor.fieldValueKey,
                value = value,
                sourceBlockId = sourceBlockId,
                fieldLabel = field.label,
                label = label
            )
        )
        "drill" -> {
            val nextFieldRef = descriptor.nextFieldRef ?: return null
            DashboardReportRuntimeActionExecution(
                id = descriptor.id,
                label = descriptor.label,
                kind = "drill",
                refinement = DashboardReportRuntimeActionRefinement(
                    op = "drill",
                    field = descriptor.fieldValueKey,
                    value = value,
                    sourceBlockId = sourceBlockId,
                    fieldLabel = field.label,
                    label = label
                ),
                transition = DashboardReportRuntimeActionTransition(
                    sourceField = descriptor.fieldValueKey,
                    nextFieldRef = nextFieldRef,
                    sourceBlockId = sourceBlockId
                )
            )
        }
        "detail" -> {
            val targetRef = descriptor.targetRef ?: return null
            DashboardReportRuntimeActionExecution(
                id = descriptor.id,
                label = descriptor.label,
                kind = "detail",
                detailRequest = DashboardReportRuntimeDetailRequest(
                    action = DashboardReportRuntimeDetailAction(
                        id = descriptor.id,
                        kind = "detail",
                        label = descriptor.label,
                        targetRef = targetRef
                    ),
                    item = item,
                    value = value,
                    field = field,
                    sourceBlockId = sourceBlockId
                )
            )
        }
        "select" -> DashboardReportRuntimeActionExecution(
            id = descriptor.id,
            label = descriptor.label,
            kind = "select",
            selection = DashboardSelectionState(
                dimension = descriptor.selectionDimension ?: descriptor.fieldValueKey,
                entityKey = value?.toString(),
                selected = item,
                sourceBlockId = sourceBlockId
            )
        )
        else -> null
    }
}

private fun dashboardReportRuntimeChartSelectionValue(
    field: DashboardReportRuntimeActionField,
    selection: DashboardReportRuntimeChartSelection
): Any? {
    return when (field.selectionSource) {
        "xValue" -> selection.xValue ?: SelectorUtil.resolve(selection.row, field.valueKey)
        "seriesKey" -> selection.seriesKey ?: SelectorUtil.resolve(selection.row, field.valueKey)
        else -> SelectorUtil.resolve(selection.row, field.valueKey)
    }
}

private fun dashboardReportRuntimeIsBlankValue(value: Any?): Boolean {
    return value == null || (value is String && value.trim().isEmpty())
}

private fun dashboardReportRuntimeExecutionValueText(value: Any?): String {
    return value?.toString()?.trim().orEmpty()
}

private fun dashboardReportRuntimeGeneratedActionId(
    kind: String,
    blockId: String?,
    fieldValueKey: String,
    includeBlockId: Boolean
): String {
    return if (includeBlockId && !blockId.isNullOrBlank()) {
        "$kind:$blockId:$fieldValueKey"
    } else {
        "$kind:$fieldValueKey"
    }
}

private fun dashboardReportRuntimeDatasetDimensions(reportSpec: JsonObject, datasetRef: String?): Set<String> {
    if (datasetRef.isNullOrBlank()) {
        return emptySet()
    }
    val dataset = ((reportSpec["datasets"] as? JsonArray).orEmpty())
        .mapNotNull { it as? JsonObject }
        .firstOrNull { jsonString(it["id"]) == datasetRef }
    val dimensions = ((dataset?.get("request") as? JsonObject)?.get("dimensions")) as? JsonObject
    return dimensions.orEmpty().mapNotNull { (key, value) ->
        if (jsonBoolean(value) == true) key else null
    }.toSet()
}

private fun dashboardReportRuntimeFieldColumn(
    reportSpec: JsonObject,
    datasetRef: String?,
    fieldKey: String
): JsonObject? {
    if (datasetRef.isNullOrBlank()) {
        return null
    }
    ((reportSpec["blocks"] as? JsonArray).orEmpty()).mapNotNull { it as? JsonObject }.forEach { block ->
        if (jsonString(block["kind"]) != "tableBlock" || jsonString(block["datasetRef"]) != datasetRef) {
            return@forEach
        }
        val match = ((block["columns"] as? JsonArray).orEmpty())
            .mapNotNull { it as? JsonObject }
            .firstOrNull { column ->
                jsonString(column["key"]) == fieldKey
                    || jsonString(column["sourceKey"]) == fieldKey
                    || jsonString(column["displayKey"]) == fieldKey
            }
        if (match != null) {
            return match
        }
    }
    return null
}

private fun dashboardReportRuntimeFieldActions(reportSpec: JsonObject, fieldValueKey: String): List<JsonObject> {
    val entries = ((reportSpec["drillMetadata"] as? JsonObject)?.get("fieldActions") as? JsonArray).orEmpty()
    return entries.mapNotNull { it as? JsonObject }.firstOrNull { entry ->
        jsonString(entry["fieldRef"]) == fieldValueKey
            || jsonString(entry["field"]) == fieldValueKey
            || jsonString(entry["id"]) == fieldValueKey
    }?.get("actions").let { it as? JsonArray }
        .orEmpty()
        .mapNotNull { it as? JsonObject }
}

private fun jsonBoolean(value: JsonElement?): Boolean? {
    return (value as? JsonPrimitive)?.booleanOrNull
}

fun dashboardReportRuntimeColumns(values: List<JsonElement>): List<ColumnDef> {
    return values.mapNotNull { value ->
        when (value) {
            is JsonPrimitive -> jsonString(value)?.let { ColumnDef(id = it, name = it, label = it) }
            is JsonObject -> {
                val id = firstNonBlank(
                    jsonString(value["id"]),
                    jsonString(value["key"]),
                    jsonString(value["sourceKey"]),
                    jsonString(value["displayKey"])
                ) ?: return@mapNotNull null
                ColumnDef(
                    id = id,
                    name = jsonString(value["name"]) ?: id,
                    label = jsonString(value["label"]) ?: id,
                    type = jsonString(value["type"]),
                    format = jsonString(value["format"]),
                    emptyText = jsonString(value["emptyText"])
                )
            }
            else -> null
        }
    }
}

fun dashboardReportRuntimeKpi(content: Map<String, JsonElement>): DashboardReportRuntimeKpiValue {
    val valueText = dashboardReportRuntimeFormattedValueText(
        content["value"],
        jsonString(content["valueFormat"])
    )
    val secondaryField = jsonString(content["secondaryField"])
    val secondaryValueText = dashboardReportRuntimeFormattedValueText(
        content["secondaryValue"],
        jsonString(content["secondaryFormat"])
    )
    return DashboardReportRuntimeKpiValue(
        description = jsonString(content["description"]),
        valueLabel = firstNonBlank(jsonString(content["valueLabel"]), jsonString(content["valueField"]), "Value") ?: "Value",
        valueText = valueText,
        secondaryLabel = if (secondaryValueText == null) null else firstNonBlank(jsonString(content["secondaryLabel"]), secondaryField),
        secondaryValueText = if (secondaryField == null) null else secondaryValueText,
        emptyLabel = jsonString(content["emptyLabel"]) ?: "No KPI value available.",
        rowCount = dashboardReportRuntimeInt(content["rowCount"]) ?: 0
    )
}

fun dashboardReportRuntimeValueText(value: JsonElement?): String? {
    return when (value) {
        null, JsonNull -> null
        is JsonArray -> value.mapNotNull { dashboardReportRuntimeValueText(it) }.joinToString(", ")
        is JsonObject -> value.toString()
        is JsonPrimitive -> JsonUtil.elementToAny(value)?.toString()
        else -> null
    }
}

private fun dashboardReportRuntimeFormattedValueText(value: JsonElement?, format: String?): String? {
    if (value == null || value == JsonNull) {
        return null
    }
    if (format.isNullOrBlank()) {
        return dashboardReportRuntimeValueText(value)
    }
    return when (value) {
        is JsonPrimitive -> formatDashboardValue(JsonUtil.elementToAny(value), format)
        else -> dashboardReportRuntimeValueText(value)
    }
}

private fun dashboardReportRuntimeScopeValueText(value: JsonElement?): String {
    if (value == null || value == JsonNull) {
        return "Not set"
    }
    val obj = value as? JsonObject
    if (obj != null && (obj.containsKey("start") || obj.containsKey("end"))) {
        val start = jsonString(obj["start"]) ?: "open"
        val end = jsonString(obj["end"]) ?: "open"
        return "$start to $end"
    }
    val array = value as? JsonArray
    if (array != null) {
        val text = array.mapNotNull { dashboardReportRuntimeValueText(it) }
            .filter { it.isNotBlank() }
            .joinToString(", ")
        return text.ifBlank { "None" }
    }
    return dashboardReportRuntimeValueText(value)?.takeIf { it.isNotBlank() } ?: value.toString()
}

private fun dashboardReportRuntimeRefinementLabel(refinement: JsonObject): String {
    jsonString(refinement["label"])?.let { return it }
    val op = jsonString(refinement["op"])
    val opLabel = when (op) {
        "keep" -> "Keep"
        "exclude" -> "Exclude"
        "drill" -> "Drill"
        "detail" -> "Detail"
        null -> "Refinement"
        else -> op
    }
    val fieldText = firstNonBlank(jsonString(refinement["fieldLabel"]), jsonString(refinement["field"]), "field") ?: "field"
    val values = ((refinement["values"] as? JsonArray).orEmpty())
        .mapNotNull { dashboardReportRuntimeValueText(it) }
        .filter { it.isNotBlank() }
        .joinToString(", ")
    return if (values.isBlank()) "$opLabel: $fieldText" else "$opLabel: $fieldText = $values"
}

private fun dashboardReportRuntimeInt(value: JsonElement?): Int? {
    return when (val unwrapped = value?.let(JsonUtil::elementToAny)) {
        is Number -> unwrapped.toInt()
        is String -> unwrapped.trim().toIntOrNull()
        else -> null
    }
}

fun dashboardTimelineChart(container: ContainerDef): ChartDef? {
    container.chart?.let { return it }
    val dateKey = firstNonBlank(container.dateField, container.timeKey) ?: return null
    val series = chartSeriesDef(container.series) ?: return null
    return ChartDef(
        xAxis = ChartAxisDef(dataKey = dateKey),
        series = series,
        type = firstNonBlank(container.chartType) ?: "line"
    )
}

fun dashboardCompositionChart(container: ContainerDef): ChartDef {
    val chart = container.chart
    val categoryKey = firstNonBlank(
        chart?.xAxis?.dataKey,
        chart?.series?.nameKey,
        container.categoryKey,
        container.nameKey
    ) ?: "name"
    val valueKey = firstNonBlank(
        chart?.series?.valueKey,
        chart?.series?.values?.firstOrNull()?.value,
        container.valueKey
    ) ?: "value"
    val chartType = firstNonBlank(chart?.type, container.chartType) ?: "donut"
    val existingSeries = chart?.series
    val seriesValues = existingSeries?.values?.takeIf { it.isNotEmpty() }
        ?: listOf(ChartValueOption(value = valueKey))
    val series = ChartSeriesDef(
        nameKey = firstNonBlank(existingSeries?.nameKey, categoryKey),
        valueKey = firstNonBlank(existingSeries?.valueKey, valueKey),
        palette = existingSeries?.palette.orEmpty(),
        values = seriesValues
    )
    return (chart ?: ChartDef()).copy(
        xAxis = chart?.xAxis ?: ChartAxisDef(dataKey = categoryKey),
        series = series,
        type = chartType
    )
}

fun evaluateDashboardCondition(
    condition: DashboardConditionDef?,
    metrics: Map<String, Any?> = emptyMap(),
    filters: Map<String, Any?> = emptyMap(),
    selection: DashboardSelectionState = DashboardSelectionState()
): Boolean {
    if (condition == null) {
        return true
    }
    val selector = condition.selector ?: condition.field ?: condition.key
    val actual = resolveDashboardValue(condition.source, selector, metrics, filters, selection)

    condition.whenValue?.let { expected ->
        if (!dashboardValuesEqual(actual, expected)) {
            return false
        }
    }
    condition.equals?.let { expected ->
        if (!dashboardValuesEqual(actual, expected)) {
            return false
        }
    }
    condition.notEquals?.let { expected ->
        if (dashboardValuesEqual(actual, expected)) {
            return false
        }
    }
    if (condition.inValues.isNotEmpty() && condition.inValues.none { dashboardValuesEqual(actual, it) }) {
        return false
    }
    condition.gt?.let { if ((actual as? Number)?.toDouble()?.let { value -> value > it } != true) return false }
    condition.gte?.let { if ((actual as? Number)?.toDouble()?.let { value -> value >= it } != true) return false }
    condition.lt?.let { if ((actual as? Number)?.toDouble()?.let { value -> value < it } != true) return false }
    condition.lte?.let { if ((actual as? Number)?.toDouble()?.let { value -> value <= it } != true) return false }
    condition.empty?.let { required ->
        val empty = when (actual) {
            null -> true
            is String -> actual.isBlank()
            is Collection<*> -> actual.isEmpty()
            is Map<*, *> -> actual.isEmpty()
            else -> false
        }
        if (empty != required) {
            return false
        }
    }
    condition.notEmpty?.let { required ->
        val present = when (actual) {
            null -> false
            is String -> actual.isNotBlank()
            is Collection<*> -> actual.isNotEmpty()
            is Map<*, *> -> actual.isNotEmpty()
            else -> true
        }
        if (present != required) {
            return false
        }
    }
    return true
}

private fun chartSeriesDef(element: JsonElement?): ChartSeriesDef? {
    return when (element) {
        is JsonArray -> {
            val values = element.mapNotNull(::chartValueOption)
            if (values.isEmpty()) {
                null
            } else {
                ChartSeriesDef(valueKey = values.firstOrNull()?.value, values = values)
            }
        }
        is JsonObject -> {
            val nameKey = firstNonBlank(jsonString(element["nameKey"]), jsonString(element["key"]))
            val valueKey = firstNonBlank(jsonString(element["valueKey"]), jsonString(element["value"]))
            val values = (element["values"] as? JsonArray)?.mapNotNull(::chartValueOption)
                ?: valueKey?.let { listOf(ChartValueOption(value = it)) }
                ?: emptyList()
            if (values.isEmpty() && valueKey == null) {
                null
            } else {
                val palette = (element["palette"] as? JsonArray)?.mapNotNull { jsonString(it) }.orEmpty()
                ChartSeriesDef(nameKey = nameKey, valueKey = valueKey, palette = palette, values = values)
            }
        }
        else -> null
    }
}

private fun chartValueOption(element: JsonElement): ChartValueOption? {
    jsonString(element)?.let { return ChartValueOption(value = it) }
    val obj = element as? JsonObject ?: return null
    val value = firstNonBlank(
        jsonString(obj["value"]),
        jsonString(obj["key"]),
        jsonString(obj["id"]),
        jsonString(obj["name"])
    ) ?: return null
    return ChartValueOption(name = firstNonBlank(jsonString(obj["name"]), jsonString(obj["label"])), value = value)
}

private fun jsonString(element: JsonElement?): String? {
    return (element as? JsonPrimitive)?.contentOrNull?.trim()?.takeIf { it.isNotEmpty() }
}

private fun firstNonBlank(vararg values: String?): String? {
    return values.firstNotNullOfOrNull { it?.trim()?.takeIf { value -> value.isNotEmpty() } }
}

fun rankedDashboardGeoMapRows(
    rows: List<Map<String, Any?>>,
    metricKey: String?,
    limit: Int?,
    regionKey: String? = null,
    labelKey: String? = null
): List<DashboardGeoMapRow> {
    val rowLimit = (limit ?: 8).coerceAtLeast(0)
    if (rowLimit == 0) {
        return emptyList()
    }
    val valueKey = metricKey?.trim()?.takeIf { it.isNotEmpty() } ?: "value"
    val regionKeys = listOfNotNull(regionKey?.trim()?.takeIf { it.isNotEmpty() }, "regionCode", "stateCode")
    val labelKeys = listOfNotNull(labelKey?.trim()?.takeIf { it.isNotEmpty() }, "label", "name", "regionName", "stateName")
    return rows.mapNotNull { row ->
        val regionCode = dashboardGeoMapText(row, *regionKeys.toTypedArray()) ?: return@mapNotNull null
        val value = dashboardGeoMapNumber(row, valueKey) ?: dashboardGeoMapNumber(row, "value") ?: return@mapNotNull null
        DashboardGeoMapRow(
            regionCode = regionCode,
            label = dashboardGeoMapText(row, *labelKeys.toTypedArray()) ?: regionCode,
            value = value,
            tone = dashboardGeoMapText(row, "tone", "statusTone"),
            rank = dashboardGeoMapNumber(row, "rank")?.toInt(),
            href = dashboardGeoMapText(row, "href", "url", "link")
        )
    }
        .sortedByDescending { it.value }
        .take(rowLimit)
}

fun rankedDashboardDimensionRows(
    rows: List<Map<String, Any?>>,
    dimensionKey: String?,
    metricKey: String?,
    limit: Int?
): List<DashboardDimensionRow> {
    val normalizedDimensionKey = dimensionKey?.trim()?.takeIf { it.isNotEmpty() } ?: return emptyList()
    val normalizedMetricKey = metricKey?.trim()?.takeIf { it.isNotEmpty() } ?: return emptyList()
    val rowLimit = (limit ?: 10).coerceAtLeast(0)
    if (rowLimit == 0) {
        return emptyList()
    }
    return rows
        .sortedByDescending { dashboardGeoMapNumber(it, normalizedMetricKey) ?: 0.0 }
        .take(rowLimit)
        .map { row ->
            DashboardDimensionRow(
                entityKey = SelectorUtil.resolve(row, normalizedDimensionKey)?.toString()?.trim()?.takeIf { it.isNotEmpty() },
                value = dashboardGeoMapNumber(row, normalizedMetricKey) ?: 0.0,
                row = row
            )
        }
}

fun applyDashboardSelectionToCollection(
    rows: List<Map<String, Any?>>,
    selectionBindings: Map<String, String>,
    selection: DashboardSelectionState
): List<Map<String, Any?>> {
    val entries = selectionBindings.mapNotNull { (selectionField, rowField) ->
        val normalizedRowField = rowField.trim().takeIf { it.isNotEmpty() } ?: return@mapNotNull null
        selectionField to normalizedRowField
    }
    if (entries.isEmpty()) {
        return rows
    }
    val activeEntries = entries.mapNotNull { (selectionField, rowField) ->
        val value = resolveDashboardValue("selection", selectionField, emptyMap(), emptyMap(), selection)
            ?.takeIf { dashboardSelectionValuePresent(it) }
            ?: return@mapNotNull null
        rowField to value
    }
    if (activeEntries.isEmpty()) {
        return rows
    }
    return rows.filter { row ->
        activeEntries.all { (rowField, selectionValue) ->
            val rowValue = SelectorUtil.resolve(row, rowField)
            when (selectionValue) {
                is Collection<*> -> selectionValue.any { dashboardSelectionValueEquals(it, rowValue) }
                else -> dashboardSelectionValueEquals(selectionValue, rowValue)
            }
        }
    }
}

fun dashboardFilterKey(item: DashboardFilterItemDef): String? {
    return item.field?.trim()?.takeIf { it.isNotEmpty() }
        ?: item.id?.trim()?.takeIf { it.isNotEmpty() }
}

fun dashboardSummaryMetrics(container: ContainerDef): List<DashboardMetricDef> {
    val summaryItems = container.dashboard?.summary?.items.orEmpty()
    if (summaryItems.isNotEmpty()) {
        return summaryItems
    }
    if (container.items.isNotEmpty()) {
        return container.items.map { dashboardSummaryMetric(it) }
    }
    val summaryMetrics = container.dashboard?.summary?.metrics.orEmpty()
    if (summaryMetrics.isNotEmpty()) {
        return summaryMetrics
    }
    return container.metrics
}

fun resolvedDashboardSummaryCards(
    container: ContainerDef,
    metrics: Map<String, Any?>,
    source: Map<String, Any?>? = null
): List<DashboardSummaryResolvedCard> {
    return dashboardSummaryMetrics(container).mapNotNull { metric ->
        val value = dashboardSummaryValue(metric, metrics, source)
        val displayValue = formatDashboardValue(value, metric.format)
        if (!isMeaningfulDashboardSummaryDisplay(displayValue)) {
            return@mapNotNull null
        }
        DashboardSummaryResolvedCard(
            id = metric.id ?: dashboardSummarySelector(metric),
            label = metric.label ?: dashboardSummarySelector(metric) ?: "Metric",
            displayValue = displayValue,
            tone = metric.tone
        )
    }
}

fun formatDashboardValue(value: Any?, format: String?): String {
    if (value == null) {
        return "n/a"
    }
    val locale = Locale.US
    return when (format?.trim()?.lowercase()) {
        "date" -> formatDashboardDateValue(value, "MMM d, yyyy", locale)
        "datetime" -> formatDashboardDateValue(value, "MMM d, yyyy, h:mm a", locale)
        "wallclockdate" -> formatDashboardDateValue(value, "MMM d, yyyy", locale)
        "wallclockhour" -> formatDashboardDateValue(value, "h a", locale)
        "currency" -> dashboardNumberValue(value)?.let {
            NumberFormat.getCurrencyInstance(locale).apply {
                minimumFractionDigits = 0
                maximumFractionDigits = 0
            }.format(it)
        } ?: value.toString()
        "percent" -> dashboardNumberValue(value)?.let {
            "${NumberFormat.getNumberInstance(locale).apply { minimumFractionDigits = 1; maximumFractionDigits = 1 }.format(it)}%"
        } ?: value.toString()
        "percentfraction" -> dashboardNumberValue(value)?.let {
            "${NumberFormat.getNumberInstance(locale).apply { minimumFractionDigits = 1; maximumFractionDigits = 1 }.format(it * 100)}%"
        } ?: value.toString()
        "integer" -> dashboardNumberValue(value)?.let { NumberFormat.getIntegerInstance(locale).format(it.toLong()) } ?: value.toString()
        "compact", "compactnumber" -> dashboardNumberValue(value)?.let { formatCompactDashboardNumber(it, locale) } ?: value.toString()
        "number" -> dashboardNumberValue(value)?.let { formatDashboardGroupedNumber(it, 0, 5) } ?: value.toString()
        "number5" -> dashboardNumberValue(value)?.let { formatDashboardGroupedNumber(it, 5, 5) } ?: value.toString()
        else -> value.toString()
    }
}

private fun formatDashboardGroupedNumber(
    value: Double,
    minimumFractionDigits: Int,
    maximumFractionDigits: Int
): String {
    val symbols = DecimalFormatSymbols(Locale.US).apply {
        groupingSeparator = ' '
        decimalSeparator = '.'
    }
    return DecimalFormat("#,##0.#####", symbols).apply {
        isGroupingUsed = true
        this.minimumFractionDigits = minimumFractionDigits
        this.maximumFractionDigits = maximumFractionDigits
    }.format(value)
}

private fun formatDashboardDateValue(value: Any?, pattern: String, locale: Locale): String {
    val instant = dashboardInstantValue(value) ?: return dashboardStringValue(value).ifBlank { "n/a" }
    return DateTimeFormatter.ofPattern(pattern, locale)
        .withZone(ZoneOffset.UTC)
        .format(instant)
}

private fun dashboardInstantValue(value: Any?): Instant? {
    val normalized = when (value) {
        is JsonPrimitive -> value.contentOrNull ?: return null
        is Number -> return Instant.ofEpochMilli(value.toLong())
        else -> value?.toString()
    }?.trim()
    if (normalized.isNullOrEmpty()) {
        return null
    }
    runCatching { return Instant.parse(normalized) }
    runCatching { return OffsetDateTime.parse(normalized).toInstant() }
    runCatching { return LocalDate.parse(normalized).atStartOfDay().toInstant(ZoneOffset.UTC) }
    return null
}

private fun dashboardStringValue(value: Any?): String {
    return when (value) {
        is JsonPrimitive -> value.contentOrNull ?: value.toString()
        else -> value?.toString().orEmpty()
    }
}

private fun dashboardNumberValue(value: Any?): Double? {
    return when (value) {
        is Number -> value.toDouble()
        is JsonPrimitive -> value.contentOrNull?.trim()?.toDoubleOrNull()
        else -> value?.toString()?.trim()?.toDoubleOrNull()
    }
}

private fun formatCompactDashboardNumber(value: Double, locale: Locale): String {
    val absValue = kotlin.math.abs(value)
    val (scaled, suffix) = when {
        absValue >= 1_000_000_000 -> value / 1_000_000_000 to "B"
        absValue >= 1_000_000 -> value / 1_000_000 to "M"
        absValue >= 1_000 -> value / 1_000 to "K"
        else -> value to ""
    }
    val formatter = NumberFormat.getNumberInstance(locale).apply {
        maximumFractionDigits = if (suffix.isEmpty()) 0 else 1
        minimumFractionDigits = 0
    }
    return formatter.format(scaled) + suffix
}

fun setDashboardDateRangeFilter(
    current: Map<String, Any?>,
    item: DashboardFilterItemDef,
    edge: String,
    value: String?
): Map<String, Any?> {
    val field = dashboardFilterKey(item) ?: return current
    val normalizedEdge = edge.trim()
    if (normalizedEdge != "start" && normalizedEdge != "end") {
        return current
    }
    val previous = (current[field] as? Map<*, *>)
        ?.mapNotNull { (key, currentValue) ->
            val name = key?.toString() ?: return@mapNotNull null
            name to currentValue
        }
        ?.toMap()
        .orEmpty()
        .toMutableMap()
    val normalizedValue = value?.trim().orEmpty()
    if (normalizedValue.isEmpty()) {
        previous.remove(normalizedEdge)
    } else {
        previous[normalizedEdge] = normalizedValue
    }
    return current + (field to previous.toMap())
}

fun dashboardToneName(value: Any?, tone: DashboardToneDef?): String {
    val number = dashboardToneNumber(value) ?: return "info"
    var warningAbove = tone?.warningAbove
    var dangerAbove = tone?.dangerAbove
    if (warningAbove != null && dangerAbove != null) {
        val warning = warningAbove
        val danger = dangerAbove
        warningAbove = minOf(warning, danger)
        dangerAbove = maxOf(warning, danger)
    }
    var warningBelow = tone?.warningBelow
    var dangerBelow = tone?.dangerBelow
    if (warningBelow != null && dangerBelow != null) {
        val warning = warningBelow
        val danger = dangerBelow
        warningBelow = maxOf(warning, danger)
        dangerBelow = minOf(warning, danger)
    }

    return when {
        dangerAbove != null && number >= dangerAbove -> "danger"
        warningAbove != null && number >= warningAbove -> "warning"
        tone?.successAbove != null && number >= tone.successAbove -> "success"
        dangerBelow != null && number <= dangerBelow -> "danger"
        warningBelow != null && number <= warningBelow -> "warning"
        tone?.successBelow != null && number <= tone.successBelow -> "success"
        else -> "info"
    }
}

private fun resolveDashboardValue(
    source: String?,
    selector: String?,
    metrics: Map<String, Any?>,
    filters: Map<String, Any?>,
    selection: DashboardSelectionState
): Any? {
    if (selector.isNullOrBlank()) {
        return when (source?.lowercase()) {
            "selection" -> mapOf(
                "dimension" to selection.dimension,
                "entityKey" to selection.entityKey,
                "pointKey" to selection.pointKey,
                "selected" to selection.selected,
                "sourceBlockId" to selection.sourceBlockId
            )
            "filters", "filter" -> filters
            else -> metrics
        }
    }
    return when (source?.lowercase()) {
        "selection" -> SelectorUtil.resolve(
            mapOf(
                "dimension" to selection.dimension,
                "entityKey" to selection.entityKey,
                "pointKey" to selection.pointKey,
                "selected" to selection.selected,
                "sourceBlockId" to selection.sourceBlockId
            ),
            selector
        )
        "filters", "filter" -> SelectorUtil.resolve(filters, selector)
        else -> when {
            selector.startsWith("filters.") -> SelectorUtil.resolve(filters, selector.removePrefix("filters."))
            selector.startsWith("selection.") -> SelectorUtil.resolve(
                mapOf(
                    "dimension" to selection.dimension,
                    "entityKey" to selection.entityKey,
                    "pointKey" to selection.pointKey,
                    "selected" to selection.selected,
                    "sourceBlockId" to selection.sourceBlockId
                ),
                selector.removePrefix("selection.")
            )
            else -> SelectorUtil.resolve(metrics, selector)
        }
    }
}

private fun dashboardSummaryMetric(item: ItemDef): DashboardMetricDef {
    return DashboardMetricDef(
        id = item.id,
        label = item.label ?: item.title,
        selector = item.field ?: item.dataField ?: item.bindingPath ?: item.id,
        field = item.field,
        format = item.format,
        tone = item.severity,
        value = item.value
    )
}

private fun dashboardSummarySelector(metric: DashboardMetricDef): String? {
    return metric.selector?.trim()?.takeIf { it.isNotEmpty() }
        ?: metric.field?.trim()?.takeIf { it.isNotEmpty() }
        ?: metric.key?.trim()?.takeIf { it.isNotEmpty() }
        ?: metric.valueField?.trim()?.takeIf { it.isNotEmpty() }
}

private fun dashboardSummaryValue(
    metric: DashboardMetricDef,
    metrics: Map<String, Any?>,
    source: Map<String, Any?>?
): Any? {
    val selector = dashboardSummarySelector(metric)
    if (selector != null) {
        source?.let { row ->
            SelectorUtil.resolve(row, selector)?.let { return it }
        }
        SelectorUtil.resolve(metrics, selector)?.let { return it }
    }
    return metric.value?.let(JsonUtil::elementToAny)
}

private fun isMeaningfulDashboardSummaryDisplay(value: String): Boolean {
    val normalized = value.trim()
    if (normalized.isEmpty()) {
        return false
    }
    return normalized.lowercase() !in setOf("-", "—", "/", "n/a", "na", "null")
}

private fun dashboardGeoMapText(row: Map<String, Any?>, vararg selectors: String): String? {
    selectors.forEach { selector ->
        val text = SelectorUtil.resolve(row, selector)?.toString()?.trim().orEmpty()
        if (text.isNotEmpty()) {
            return text
        }
    }
    return null
}

private fun dashboardSelectionValuePresent(value: Any?): Boolean {
    return when (value) {
        null -> false
        is String -> value.isNotBlank()
        is Collection<*> -> value.isNotEmpty()
        is Map<*, *> -> value.isNotEmpty()
        else -> true
    }
}

private fun dashboardSelectionValueEquals(selectionValue: Any?, rowValue: Any?): Boolean {
    if (selectionValue == null || rowValue == null) {
        return false
    }
    return selectionValue.toString().equals(rowValue.toString(), ignoreCase = true)
}

private fun dashboardToneNumber(value: Any?): Double? {
    return when (value) {
        is Number -> value.toDouble()
        is String -> value.trim().toDoubleOrNull()
        is JsonPrimitive -> when {
            value.isString -> value.content.trim().toDoubleOrNull()
            else -> value.doubleOrNull()
        }
        else -> null
    }
}

private fun dashboardGeoMapNumber(row: Map<String, Any?>, selector: String): Double? {
    return when (val value = SelectorUtil.resolve(row, selector)) {
        is Number -> value.toDouble()
        is String -> value.trim().toDoubleOrNull()
        else -> null
    }
}

private fun dashboardValuesEqual(actual: Any?, expected: JsonElement): Boolean {
    return when (expected) {
        is JsonPrimitive -> {
            when {
                expected.isString -> actual?.toString() == expected.content
                expected.booleanOrNull() != null -> actual == expected.booleanOrNull()
                expected.longOrNull() != null -> (actual as? Number)?.toLong() == expected.longOrNull()
                expected.doubleOrNull() != null -> (actual as? Number)?.toDouble() == expected.doubleOrNull()
                else -> actual?.toString() == expected.content
            }
        }
        else -> anyToJsonElement(actual) == expected
    }
}

private fun anyToJsonElement(value: Any?): JsonElement? {
    return when (value) {
        null -> JsonNull
        is JsonElement -> value
        is String -> JsonPrimitive(value)
        is Boolean -> JsonPrimitive(value)
        is Number -> JsonPrimitive(value)
        is Map<*, *> -> {
            val content = linkedMapOf<String, JsonElement>()
            for ((key, child) in value) {
                val name = key as? String ?: return null
                content[name] = anyToJsonElement(child) ?: return null
            }
            JsonObject(content)
        }
        is Iterable<*> -> {
            val content = mutableListOf<JsonElement>()
            for (child in value) {
                content += anyToJsonElement(child) ?: return null
            }
            JsonArray(content)
        }
        is Array<*> -> JsonArray(value.map { anyToJsonElement(it) ?: return null })
        else -> null
    }
}

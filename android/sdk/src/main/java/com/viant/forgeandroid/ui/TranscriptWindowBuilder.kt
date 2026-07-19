package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.ChartAxisDef
import com.viant.forgeandroid.runtime.ChartDef
import com.viant.forgeandroid.runtime.ChartSeriesDef
import com.viant.forgeandroid.runtime.ChartValueOption
import com.viant.forgeandroid.runtime.ColumnDef
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.DashboardFieldDef
import com.viant.forgeandroid.runtime.DashboardMetricDef
import com.viant.forgeandroid.runtime.DashboardReportSectionDef
import com.viant.forgeandroid.runtime.DataSourceDef
import com.viant.forgeandroid.runtime.ItemDef
import com.viant.forgeandroid.runtime.JsonUtil
import com.viant.forgeandroid.runtime.LinkDef
import com.viant.forgeandroid.runtime.SelectorDef
import com.viant.forgeandroid.runtime.TableDef
import com.viant.forgeandroid.runtime.ViewDef
import com.viant.forgeandroid.runtime.WindowMetadata
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull

private val transcriptWindowJson = Json { ignoreUnknownKeys = true }

data class TranscriptWindowPresentation(
    val metadata: WindowMetadata,
    val dataStore: Map<String, TranscriptForgeDataStore>
)

fun buildTranscriptWindowMetadata(
    payload: TranscriptForgeUiPayload,
    dataStore: Map<String, TranscriptForgeDataStore>
): WindowMetadata = buildTranscriptWindowPresentation(payload, dataStore).metadata

fun buildTranscriptWindowPresentation(
    payload: TranscriptForgeUiPayload,
    dataStore: Map<String, TranscriptForgeDataStore>
): TranscriptWindowPresentation {
    val normalizedDataStore = buildNormalizedTranscriptDataStore(payload, dataStore)
    val hydratedDataStore = referencedTranscriptDataSources(payload, normalizedDataStore).associateWith { ref ->
        normalizedDataStore[ref] ?: TranscriptForgeDataStore(ref, emptyList<Any?>())
    }
    val dataSources = buildTranscriptForgeDataSources(payload, hydratedDataStore)
    val containers = payload.blocks.mapIndexedNotNull { index, block ->
        adaptTranscriptForgeBlock(block, index)
    }
    require(containers.isNotEmpty()) { "forge-ui block does not contain any renderable blocks" }
    return TranscriptWindowPresentation(
        dataStore = hydratedDataStore,
        metadata = WindowMetadata(
            namespace = "forge.transcript",
            dataSources = dataSources,
            view = ViewDef(
                content = com.viant.forgeandroid.runtime.ContentDef(
                    containers = listOf(
                        ContainerDef(
                            id = "forge-root",
                            title = payload.title?.takeIf { it.isNotBlank() },
                            subtitle = payload.subtitle?.takeIf { it.isNotBlank() },
                            containers = containers
                        )
                    )
                )
            )
        )
    )
}

private fun buildTranscriptForgeDataSources(
    payload: TranscriptForgeUiPayload,
    dataStore: Map<String, TranscriptForgeDataStore>
): Map<String, DataSourceDef> {
    return referencedTranscriptDataSources(payload, dataStore).associateWith { ref ->
        val selectionMode = when {
            payload.blocks.any { block ->
                jsonString(block["kind"]) == "planner.table" &&
                    resolveTranscriptDataSourceRef(block) == ref
            } -> "single"

            else -> "none"
        }
        DataSourceDef(
            selectionMode = selectionMode,
            selectors = SelectorDef(data = "output")
        )
    }
}

private fun referencedTranscriptDataSources(
    payload: TranscriptForgeUiPayload,
    dataStore: Map<String, TranscriptForgeDataStore>
): Set<String> = linkedSetOf<String>().apply {
        addAll(dataStore.keys)
        payload.blocks.map(::resolveTranscriptDataSourceRef)
            .filterTo(this) { it.isNotBlank() }
    }

private fun adaptTranscriptForgeBlock(block: JsonObject, index: Int): ContainerDef? {
    return when (jsonString(block["kind"])) {
        "planner.table" -> adaptPlannerTableBlock(block, index)
        "dashboard.table" -> adaptDashboardTableBlock(block, index)
        "dashboard.summary" -> adaptDashboardSummaryBlock(block, index)
        "dashboard.report" -> adaptDashboardReportBlock(block, index)
        "dashboard.kpiTable" -> adaptDashboardKpiTableBlock(block, index)
        "dashboard.dimensions" -> adaptDashboardDimensionsBlock(block, index)
        "dashboard.messages" -> adaptDashboardMessagesBlock(block, index)
        "dashboard.timeline" -> adaptDashboardTimelineBlock(block, index)
        else -> runCatching {
            transcriptWindowJson.decodeFromString(ContainerDef.serializer(), block.toString())
        }.getOrNull()
    }
}

private fun adaptPlannerTableBlock(block: JsonObject, index: Int): ContainerDef {
    val dataSourceRef = resolveTranscriptDataSourceRef(block)
    val selectionField = jsonString((block["selection"] as? JsonObject)?.get("field"))
    val columns = mutableListOf<ColumnDef>()
    if (selectionField.isNotBlank()) {
        columns += ColumnDef(
            id = selectionField,
            name = selectionField,
            label = titleizeKey(selectionField)
        )
    }
    val declaredColumns = (block["columns"] as? JsonArray).orEmpty().mapNotNull { entry ->
        val value = entry as? JsonObject ?: return@mapNotNull null
        val key = jsonString(value["key"]).ifBlank { jsonString(value["id"]) }
        if (key.isBlank()) {
            return@mapNotNull null
        }
        ColumnDef(
            id = key,
            name = key,
            label = jsonString(value["label"]).ifBlank { titleizeKey(key) },
            format = jsonString(value["format"]).takeIf { it.isNotBlank() },
            type = jsonString(value["type"]).takeIf { it.isNotBlank() },
            link = (value["link"] as? JsonObject)?.let { linkObject ->
                LinkDef(href = jsonString(linkObject["href"]).takeIf { it.isNotBlank() })
            }
        )
    }
    declaredColumns.forEach { column ->
        if (columns.none { it.id == column.id }) {
            columns += column
        }
    }
    return ContainerDef(
        id = jsonString(block["id"]).ifBlank { "planner-table-$index" },
        title = jsonString(block["title"]).takeIf { it.isNotBlank() } ?: "Planner table",
        subtitle = jsonString(block["subtitle"]).takeIf { it.isNotBlank() },
        dataSourceRef = dataSourceRef,
        table = TableDef(columns = columns)
    )
}

private fun adaptDashboardSummaryBlock(block: JsonObject, index: Int): ContainerDef {
    val metrics = summaryMetrics(block)
    return ContainerDef(
        id = jsonString(block["id"]).ifBlank { "dashboard-summary-$index" },
        kind = "dashboard.summary",
        title = jsonString(block["title"]).takeIf { it.isNotBlank() },
        subtitle = jsonString(block["subtitle"]).takeIf { it.isNotBlank() },
        dataSourceRef = resolveTranscriptDataSourceRef(block),
        metrics = metrics
    )
}

private fun summaryMetrics(block: JsonObject): List<DashboardMetricDef> {
    val declared = (block["metrics"] as? JsonArray).orEmpty().mapNotNull { entry ->
        when (entry) {
            is JsonPrimitive -> {
                val selector = entry.content.trim()
                selector.takeIf { it.isNotBlank() }?.let {
                    DashboardMetricDef(
                        id = it,
                        label = titleizeKey(it),
                        selector = it
                    )
                }
            }

            is JsonObject -> {
                val selector = jsonString(entry["selector"]).ifBlank { jsonString(entry["key"]) }
                DashboardMetricDef(
                    id = jsonString(entry["id"]).ifBlank { selector },
                    label = jsonString(entry["label"]).ifBlank { titleizeKey(selector) },
                    selector = selector,
                    format = jsonString(entry["format"]).takeIf { it.isNotBlank() }
                )
            }

            else -> null
        }
    }
    if (declared.isNotEmpty()) {
        return declared
    }
    return (block["items"] as? JsonArray).orEmpty().mapNotNull { entry ->
        val item = entry as? JsonObject ?: return@mapNotNull null
        val rawKey = jsonString(item["key"]).ifBlank {
            jsonString(item["label"]).ifBlank { jsonString(item["id"]).ifBlank { "value" } }
        }
        val key = transcriptFieldKey(rawKey)
        DashboardMetricDef(
            id = key,
            label = jsonString(item["label"]).ifBlank { titleizeKey(key) },
            selector = key,
            format = jsonString(item["format"]).takeIf { it.isNotBlank() }
        )
    }
}

private fun adaptDashboardReportBlock(block: JsonObject, index: Int): ContainerDef {
    val sections = (block["sections"] as? JsonArray).orEmpty().mapNotNull { entry ->
        val section = entry as? JsonObject ?: return@mapNotNull null
        DashboardReportSectionDef(
            id = jsonString(section["id"]).ifBlank { null },
            title = jsonString(section["title"]).ifBlank { null },
            body = (section["body"] as? JsonArray).orEmpty()
                .mapNotNull { (it as? JsonPrimitive)?.contentOrNull?.trim()?.takeIf(String::isNotBlank) },
            tone = jsonString(section["tone"]).ifBlank { null }
        )
    }
    return ContainerDef(
        id = jsonString(block["id"]).ifBlank { "dashboard-report-$index" },
        kind = "dashboard.report",
        title = jsonString(block["title"]).takeIf { it.isNotBlank() },
        subtitle = jsonString(block["subtitle"]).takeIf { it.isNotBlank() },
        sections = sections
    )
}

private fun adaptDashboardKpiTableBlock(block: JsonObject, index: Int): ContainerDef {
    val columns = (block["columns"] as? JsonArray).orEmpty().mapNotNull { entry ->
        val value = entry as? JsonObject ?: return@mapNotNull null
        val key = jsonString(value["key"]).ifBlank { jsonString(value["id"]) }
        if (key.isBlank()) return@mapNotNull null
        ColumnDef(
            id = key,
            name = key,
            label = jsonString(value["label"]).ifBlank { titleizeKey(key) },
            format = jsonString(value["format"]).takeIf { it.isNotBlank() },
            type = jsonString(value["type"]).takeIf { it.isNotBlank() },
            link = (value["link"] as? JsonObject)?.let { linkObject ->
                LinkDef(href = jsonString(linkObject["href"]).takeIf { it.isNotBlank() })
            }
        )
    }
    return ContainerDef(
        id = jsonString(block["id"]).ifBlank { "dashboard-kpi-table-$index" },
        title = jsonString(block["title"]).takeIf { it.isNotBlank() } ?: "KPI table",
        subtitle = jsonString(block["subtitle"]).takeIf { it.isNotBlank() },
        dataSourceRef = resolveTranscriptDataSourceRef(block),
        table = TableDef(columns = columns)
    )
}

private fun adaptDashboardTableBlock(block: JsonObject, index: Int): ContainerDef {
    val columns = (block["columns"] as? JsonArray).orEmpty().mapNotNull { entry ->
        val value = entry as? JsonObject ?: return@mapNotNull null
        val key = jsonString(value["key"]).ifBlank { jsonString(value["id"]) }
        if (key.isBlank()) return@mapNotNull null
        ColumnDef(
            id = key,
            name = key,
            label = jsonString(value["label"]).ifBlank { titleizeKey(key) },
            format = jsonString(value["format"]).takeIf { it.isNotBlank() },
            type = jsonString(value["type"]).takeIf { it.isNotBlank() },
            link = (value["link"] as? JsonObject)?.let { linkObject ->
                LinkDef(href = jsonString(linkObject["href"]).takeIf { it.isNotBlank() })
            }
        )
    }
    return ContainerDef(
        id = jsonString(block["id"]).ifBlank { "dashboard-table-$index" },
        title = jsonString(block["title"]).takeIf { it.isNotBlank() } ?: "Table",
        subtitle = jsonString(block["subtitle"]).takeIf { it.isNotBlank() },
        dataSourceRef = resolveTranscriptDataSourceRef(block),
        table = TableDef(columns = columns)
    )
}

private fun adaptDashboardDimensionsBlock(block: JsonObject, index: Int): ContainerDef {
    val dimension = (block["dimension"] as? JsonObject)?.let { field ->
        DashboardFieldDef(
            key = jsonString(field["key"]).takeIf { it.isNotBlank() },
            label = jsonString(field["label"]).takeIf { it.isNotBlank() },
            format = jsonString(field["format"]).takeIf { it.isNotBlank() }
        )
    }
    val metric = (block["metric"] as? JsonObject)?.let { field ->
        DashboardFieldDef(
            key = jsonString(field["key"]).takeIf { it.isNotBlank() },
            label = jsonString(field["label"]).takeIf { it.isNotBlank() },
            format = jsonString(field["format"]).takeIf { it.isNotBlank() }
        )
    }
    return ContainerDef(
        id = jsonString(block["id"]).ifBlank { "dashboard-dimensions-$index" },
        kind = "dashboard.dimensions",
        title = jsonString(block["title"]).takeIf { it.isNotBlank() },
        subtitle = jsonString(block["subtitle"]).takeIf { it.isNotBlank() },
        dataSourceRef = resolveTranscriptDataSourceRef(block),
        dimension = dimension,
        metric = metric,
        viewModes = (block["viewModes"] as? JsonArray).orEmpty().mapNotNull { (it as? JsonPrimitive)?.contentOrNull?.trim()?.takeIf(String::isNotBlank) },
        limit = (block["limit"] as? JsonPrimitive)?.intOrNull,
        orderBy = jsonString(block["orderBy"]).takeIf { it.isNotBlank() }
    )
}

private fun adaptDashboardMessagesBlock(block: JsonObject, index: Int): ContainerDef {
    val items = (block["items"] as? JsonArray).orEmpty().mapNotNull { entry ->
        val item = entry as? JsonObject ?: return@mapNotNull null
        ItemDef(
            id = jsonString(item["id"]).takeIf { it.isNotBlank() },
            label = jsonString(item["label"]).takeIf { it.isNotBlank() },
            title = jsonString(item["title"]).takeIf { it.isNotBlank() },
            body = jsonString(item["body"]).takeIf { it.isNotBlank() },
            severity = jsonString(item["severity"]).takeIf { it.isNotBlank() }
        )
    }
    return ContainerDef(
        id = jsonString(block["id"]).ifBlank { "dashboard-messages-$index" },
        kind = "dashboard.messages",
        title = jsonString(block["title"]).takeIf { it.isNotBlank() },
        subtitle = jsonString(block["subtitle"]).takeIf { it.isNotBlank() },
        items = items
    )
}

private fun adaptDashboardTimelineBlock(block: JsonObject, index: Int): ContainerDef {
    val dataSourceRef = resolveTranscriptDataSourceRef(block)
    val chartType = jsonString(block["chartType"]).ifBlank { "bar" }
    val categoryKey = jsonString(block["dateField"])
        .ifBlank { jsonString(block["timeColumn"]) }
        .ifBlank { jsonString(block["groupBy"]) }
        .ifBlank { jsonString(block["seriesColumn"]) }
        .ifBlank { "label" }
    val seriesKeys = (block["series"] as? JsonArray).orEmpty()
        .mapNotNull { entry ->
            when (entry) {
                is JsonPrimitive -> entry.content.trim().takeIf(String::isNotBlank)
                is JsonObject -> jsonString(entry["key"]).ifBlank {
                    jsonString(entry["id"]).ifBlank { jsonString(entry["value"]) }
                }.takeIf { it.isNotBlank() }
                else -> null
            }
        }
    val valueKey = seriesKeys.firstOrNull()
        ?: jsonString(block["valueColumn"]).takeIf { it.isNotBlank() }
        ?: "value"

    return ContainerDef(
        id = jsonString(block["id"]).ifBlank { "dashboard-timeline-$index" },
        kind = "dashboard.timeline",
        title = jsonString(block["title"]).takeIf { it.isNotBlank() },
        subtitle = jsonString(block["subtitle"]).takeIf { it.isNotBlank() },
        dataSourceRef = dataSourceRef,
        chart = ChartDef(
            type = chartType,
            xAxis = ChartAxisDef(
                dataKey = categoryKey,
                label = titleizeKey(categoryKey)
            ),
            yAxis = ChartAxisDef(
                dataKey = valueKey,
                label = titleizeKey(valueKey)
            ),
            series = ChartSeriesDef(
                nameKey = categoryKey,
                valueKey = valueKey,
                values = listOf(
                    ChartValueOption(
                        name = titleizeKey(valueKey),
                        value = valueKey
                    )
                )
            )
        )
    )
}

private fun resolveTranscriptDataSourceRef(block: JsonObject): String {
    return jsonString(block["dataSourceRef"]).ifBlank {
        jsonString(block["dataSource"]).ifBlank {
            if (jsonString(block["kind"]) == "dashboard.summary") {
                syntheticTranscriptDataSourceRef(block)
            } else {
                ""
            }
        }
    }
}

private fun buildNormalizedTranscriptDataStore(
    payload: TranscriptForgeUiPayload,
    dataStore: Map<String, TranscriptForgeDataStore>
): Map<String, TranscriptForgeDataStore> {
    val normalized = linkedMapOf<String, TranscriptForgeDataStore>()
    normalized.putAll(dataStore)
    payload.blocks.forEach { block ->
        synthesizeTranscriptDataBlock(block)?.let { normalized[it.id] = it }
    }
    return normalized
}

private fun synthesizeTranscriptDataBlock(block: JsonObject): TranscriptForgeDataStore? {
    if (jsonString(block["kind"]) != "dashboard.summary") {
        return null
    }
    val dataSourceRef = syntheticTranscriptDataSourceRef(block)
    val row = linkedMapOf<String, Any?>()
    (block["items"] as? JsonArray).orEmpty().forEach { entry ->
        val item = entry as? JsonObject ?: return@forEach
        val rawKey = jsonString(item["key"]).ifBlank {
            jsonString(item["label"]).ifBlank { jsonString(item["id"]).ifBlank { "value" } }
        }
        row[transcriptFieldKey(rawKey)] = item["value"]?.let(JsonUtil::elementToAny)
    }
    if (row.isEmpty()) {
        return null
    }
    return TranscriptForgeDataStore(
        id = dataSourceRef,
        rows = listOf(row)
    )
}

private fun syntheticTranscriptDataSourceRef(block: JsonObject): String {
    val base = jsonString(block["id"]).ifBlank {
        jsonString(block["title"]).ifBlank { "transcript-block" }
    }
    return "inline_${transcriptFieldKey(base)}"
}

private fun transcriptFieldKey(value: String): String {
    val words = mutableListOf<String>()
    val current = StringBuilder()
    var previous: Char? = null
    fun flush() {
        if (current.isNotEmpty()) {
            words += current.toString().lowercase()
            current.clear()
        }
    }
    value.trim().forEach { character ->
        if (!character.isLetterOrDigit()) {
            flush()
        } else {
            if (character.isUpperCase() && previous?.isLowerCase() == true) flush()
            current.append(character)
        }
        previous = character
    }
    flush()
    if (words.isEmpty()) return "value"
    return words.first() + words.drop(1).joinToString("") { it.replaceFirstChar(Char::titlecase) }
}

private fun titleizeKey(value: String): String {
    val words = mutableListOf<String>()
    val current = StringBuilder()
    var previous: Char? = null
    fun flush() {
        if (current.isNotEmpty()) {
            words += current.toString().lowercase()
            current.clear()
        }
    }
    value.trim().forEach { character ->
        if (!character.isLetterOrDigit()) {
            flush()
        } else {
            if (character.isUpperCase() && previous?.isLowerCase() == true) flush()
            current.append(character)
        }
        previous = character
    }
    flush()
    return words.joinToString(" ") { it.replaceFirstChar(Char::titlecase) }
}

private fun jsonString(element: JsonElement?): String =
    (element as? JsonPrimitive)?.content?.trim().orEmpty()

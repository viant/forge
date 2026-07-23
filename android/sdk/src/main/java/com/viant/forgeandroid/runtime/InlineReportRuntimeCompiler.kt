package com.viant.forgeandroid.runtime

import com.viant.forgeandroid.ui.TranscriptCanonicalData
import com.viant.forgeandroid.ui.TranscriptCanonicalReport
import com.viant.forgeandroid.ui.TranscriptEnvelope
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

data class InlineReportWorkspaceDatasetRequest(
    val id: String,
    val dataSourceRef: String,
    val inputs: Map<String, JsonElement> = emptyMap()
)

data class InlineReportRuntimeArtifact(
    val reportSpec: JsonObject,
    val reportFill: JsonObject,
    val metadata: WindowMetadata
)

/**
 * Compiles portable inline reports into Forge's existing native report runtime.
 * Agently hosts placement and datasource transport; report semantics stay here.
 */
object InlineReportRuntimeCompiler {
    fun workspaceDatasetRequests(report: TranscriptCanonicalReport): List<InlineReportWorkspaceDatasetRequest> {
        val source = report.source as? JsonObject ?: return emptyList()
        val materialized = report.dataSources.keys
        return sourceDeclarations(source).mapNotNull { declaration ->
            if (string(declaration["kind"])?.lowercase() != "workspaceref") return@mapNotNull null
            val id = string(declaration["id"]) ?: return@mapNotNull null
            if (id in materialized) return@mapNotNull null
            InlineReportWorkspaceDatasetRequest(
                id = id,
                dataSourceRef = string(declaration["dataSourceRef"])
                    ?: string(declaration["sourceRef"])
                    ?: id,
                inputs = (declaration["request"] as? JsonObject)
                    ?: (declaration["inputs"] as? JsonObject)
                    ?: emptyMap()
            )
        }
    }

    fun compile(report: TranscriptCanonicalReport): InlineReportRuntimeArtifact {
        val status = report.status.trim().lowercase()
        require(status.isEmpty() || status == "committed" || status == "ready") {
            "Inline report is $status and cannot be rendered."
        }
        val source = report.source as? JsonObject
            ?: error("Inline report source must be a JSON object.")
        val grammar = report.grammar.trim().lowercase()
        require(grammar == "report-document-v1" || grammar == "dashboard-v1") {
            "Unsupported inline report grammar '$grammar'."
        }

        val sourceBlocks = (source["blocks"] as? JsonArray).orEmpty()
        val blocks = if (grammar == "dashboard-v1") adaptDashboardBlocks(sourceBlocks) else sourceBlocks
        val title = string(source["title"]) ?: humanize(report.id)
        val subtitle = string(source["subtitle"])
        val declarations = sourceDeclarations(source)
        val blockOrder = layoutBlockOrder(source, blocks)
        val reportSpec = JsonObject(source.toMutableMap().apply {
            put("kind", JsonPrimitive("reportSpec"))
            put("id", JsonPrimitive(report.id))
            put("title", JsonPrimitive(title))
            put("blocks", JsonArray(blocks))
            put("datasets", JsonArray(declarations))
            put("layoutIntent", JsonObject(mapOf("blockOrder" to JsonArray(blockOrder.map(::JsonPrimitive)))))
        })

        val datasetRows = normalizedDatasetRows(report.dataSources)
        val fillDatasets = datasetRows.toSortedMap().map { (id, rows) ->
            JsonObject(
                mapOf(
                    "id" to JsonPrimitive(id),
                    "rows" to JsonArray(rows),
                    "provenance" to JsonObject(mapOf("rowCount" to JsonPrimitive(rows.size)))
                )
            )
        }
        val fillBlocks = blocks.map { materializeBlock(it, datasetRows) }
        val reportFill = JsonObject(
            mapOf(
                "kind" to JsonPrimitive("reportFill"),
                "reportId" to JsonPrimitive(report.id),
                "datasets" to JsonArray(fillDatasets),
                "blocks" to JsonArray(fillBlocks),
                "diagnostics" to JsonArray(emptyList())
            )
        )
        val runtime = JsonObject(buildMap {
            put("title", JsonPrimitive(title))
            subtitle?.let { put("subtitle", JsonPrimitive(it)) }
            put("reportSpec", reportSpec)
            put("reportFill", reportFill)
        })
        val metadata = WindowMetadata(
            namespace = "forge.inline-report",
            view = ViewDef(
                content = ContentDef(
                    containers = listOf(
                        ContainerDef(
                            id = "inline-report-runtime",
                            title = title,
                            subtitle = subtitle,
                            kind = "dashboard.reportRuntime",
                            reportRuntime = runtime
                        )
                    )
                )
            )
        )
        return InlineReportRuntimeArtifact(reportSpec, reportFill, metadata)
    }

    private fun normalizedDatasetRows(
        dataSources: Map<String, TranscriptCanonicalData>
    ): Map<String, List<JsonElement>> = dataSources.map { (key, source) ->
        val id = source.id.trim().ifEmpty { key }
        val rows = when (val payload = TranscriptEnvelope.materializeCanonicalPayload(source.format, source.payload)) {
            is JsonArray -> payload.toList()
            is JsonObject -> listOf(payload)
            else -> emptyList()
        }
        id to rows
    }.toMap()

    private fun materializeBlock(
        block: JsonElement,
        datasets: Map<String, List<JsonElement>>
    ): JsonElement {
        val source = block as? JsonObject ?: return block
        val objectValue = source.toMutableMap()
        val content = ((source["content"] as? JsonObject)?.toMutableMap() ?: source.toMutableMap())
        when (string(source["kind"])) {
            "markdownBlock" -> content.putIfAbsent("markdown", source["markdown"] ?: JsonPrimitive(""))
            "kpiBlock" -> {
                val datasetRef = string(source["datasetRef"]).orEmpty()
                val row = datasets[datasetRef]?.firstOrNull() as? JsonObject
                val valueField = string(source["valueField"])
                val secondaryField = string(source["secondaryField"])
                content["value"] = valueField?.let { row?.get(it) } ?: JsonNull
                content["secondaryValue"] = secondaryField?.let { row?.get(it) } ?: JsonNull
                content["rowCount"] = JsonPrimitive(datasets[datasetRef]?.size ?: 0)
            }
        }
        objectValue["content"] = JsonObject(content)
        return JsonObject(objectValue)
    }

    private fun adaptDashboardBlocks(blocks: List<JsonElement>): List<JsonElement> = blocks.flatMap { block ->
        val source = block as? JsonObject ?: return@flatMap emptyList()
        val value = source.toMutableMap()
        when (string(source["kind"])) {
            "dashboard.table", "dashboard.kpiTable" -> value["kind"] = JsonPrimitive("tableBlock")
            "dashboard.timeline", "dashboard.dimensions", "dashboard.composition" -> {
                value["kind"] = JsonPrimitive("chartBlock")
                value.putIfAbsent("xField", source["dateField"] ?: source["categoryKey"] ?: source["timeKey"] ?: JsonNull)
                value.putIfAbsent("measures", source["series"] ?: source["valueKey"]?.let { JsonArray(listOf(it)) } ?: JsonArray(emptyList()))
            }
            "dashboard.filters" -> value["kind"] = JsonPrimitive("filterBarBlock")
            "dashboard.summary" -> {
                return@flatMap (source["metrics"] as? JsonArray).orEmpty().mapIndexedNotNull { index, metric ->
                    val item = metric as? JsonObject ?: return@mapIndexedNotNull null
                    val selector = string(item["selector"])?.removePrefix("0.")
                    JsonObject(
                        mapOf(
                            "id" to (item["id"] ?: JsonPrimitive("${string(source["id"]) ?: "summary"}-${index + 1}")),
                            "kind" to JsonPrimitive("kpiBlock"),
                            "title" to (item["label"] ?: source["title"] ?: JsonPrimitive("KPI")),
                            "datasetRef" to (source["dataSourceRef"] ?: JsonNull),
                            "valueField" to (selector?.let(::JsonPrimitive) ?: JsonNull),
                            "valueLabel" to (item["label"] ?: JsonPrimitive("Value")),
                            "valueFormat" to (item["format"] ?: JsonNull)
                        )
                    )
                }
            }
            "dashboard.report" -> value["kind"] = JsonPrimitive("sectionBlock")
            "dashboard.messages" -> value["kind"] = JsonPrimitive("collectionBlock")
        }
        listOf(JsonObject(value))
    }

    private fun sourceDeclarations(source: JsonObject): List<JsonObject> {
        val result = mutableListOf<JsonObject>()
        listOf("datasets", "dataSources").forEach { key ->
            when (val value = source[key]) {
                is JsonArray -> result += value.mapNotNull { it as? JsonObject }
                is JsonObject -> result += value.map { (id, declaration) ->
                    JsonObject((declaration as? JsonObject).orEmpty() + ("id" to ((declaration as? JsonObject)?.get("id") ?: JsonPrimitive(id))))
                }
                else -> Unit
            }
        }
        val seen = mutableSetOf<String>()
        return result.filter { declaration -> string(declaration["id"])?.let(seen::add) == true }
    }

    private fun layoutBlockOrder(source: JsonObject, blocks: List<JsonElement>): List<String> {
        val ordered = ((((source["layout"] as? JsonObject)?.get("items")) as? JsonArray).orEmpty())
            .mapNotNull { string((it as? JsonObject)?.get("blockId")) }
        return ordered.ifEmpty { blocks.mapNotNull { string((it as? JsonObject)?.get("id")) } }
    }

    private fun string(value: JsonElement?): String? = runCatching {
        value?.jsonPrimitive?.contentOrNull?.trim()?.takeIf(String::isNotEmpty)
    }.getOrNull()

    private fun humanize(value: String): String = value
        .replace('_', ' ')
        .replace('-', ' ')
        .split(' ')
        .filter(String::isNotBlank)
        .joinToString(" ") { it.replaceFirstChar(Char::uppercase) }
}

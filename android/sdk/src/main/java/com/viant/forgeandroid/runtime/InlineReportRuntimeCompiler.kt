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
 * The host application owns placement and datasource transport; report semantics stay here.
 */
object InlineReportRuntimeCompiler {
    fun exportFences(report: TranscriptCanonicalReport): List<JsonElement> {
        val source = report.source as? JsonObject ?: error("Inline report source must be a JSON object.")
        val exportSource = if (report.grammar.trim().lowercase() == "dashboard-v1") {
            source.toMutableMap().apply { put("blocks", compile(report).reportSpec["blocks"] ?: JsonArray(emptyList())) }
        } else source.toMutableMap()
        val exportGrammar = if (report.grammar.trim().lowercase() == "dashboard-v1") "report-document-v1" else report.grammar
        val exportScope = safeFenceSegment(string(source["scope"]) ?: report.scope, "message")
        var sequence = 1
        val start = exportSource.apply {
            put("version", JsonPrimitive(1))
            put("scope", JsonPrimitive(exportScope))
            put("id", JsonPrimitive(report.id))
            put("sequence", JsonPrimitive(sequence++))
            put("mode", JsonPrimitive("start"))
            put("grammar", JsonPrimitive(exportGrammar))
        }
        val fences = mutableListOf<JsonElement>(exportFence("forge-report", 0, JsonObject(start)))
        val emitted = mutableSetOf<String>()
        report.dataSources.toSortedMap().forEach { (key, dataSource) ->
            val payload = dataSource.payload ?: return@forEach
            val datasetId = key.trim().ifEmpty { dataSource.id.trim() }
            val materialized = TranscriptEnvelope.materializeCanonicalPayload(dataSource.format, payload)
            fences += exportFence(
                "forge-data",
                fences.size,
                JsonObject(
                    mapOf(
                        "version" to JsonPrimitive(dataSource.version ?: 2),
                        "scope" to JsonPrimitive(dataSource.scope?.trim()?.takeIf(String::isNotEmpty) ?: exportScope),
                        "reportRef" to JsonPrimitive(dataSource.reportRef?.trim()?.takeIf(String::isNotEmpty) ?: report.id),
                        "sequence" to JsonPrimitive(sequence++),
                        "id" to JsonPrimitive(datasetId),
                        "format" to JsonPrimitive(if (materialized == null) dataSource.format?.trim()?.ifEmpty { "json" } ?: "json" else "json"),
                        "mode" to JsonPrimitive("replace"),
                        "data" to pdfDatasetPayload(materialized ?: payload)
                    )
                )
            )
            emitted += datasetId
        }
        val referenced = (start["blocks"] as? JsonArray).orEmpty().mapNotNull { block ->
            string((block as? JsonObject)?.get("dataSourceRef"))
                ?: string((block as? JsonObject)?.get("datasetRef"))
        }.toSet()
        referenced.subtract(emitted).sorted().forEach { datasetId ->
            fences += exportFence(
                "forge-data",
                fences.size,
                JsonObject(
                    mapOf(
                        "version" to JsonPrimitive(2),
                        "scope" to JsonPrimitive(exportScope),
                        "reportRef" to JsonPrimitive(report.id),
                        "sequence" to JsonPrimitive(sequence++),
                        "id" to JsonPrimitive(datasetId),
                        "format" to JsonPrimitive("json"),
                        "mode" to JsonPrimitive("replace"),
                        "data" to JsonArray(emptyList())
                    )
                )
            )
        }
        fences += exportFence(
            "forge-report",
            fences.size,
            JsonObject(
                mapOf(
                    "version" to JsonPrimitive(1),
                    "scope" to JsonPrimitive(exportScope),
                    "id" to JsonPrimitive(report.id),
                    "sequence" to JsonPrimitive(sequence),
                    "mode" to JsonPrimitive("commit")
                )
            )
        )
        return fences
    }

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
                    ?: error("Workspace dataset '$id' must declare dataSourceRef."),
                inputs = (declaration["request"] as? JsonObject)
                    ?: (declaration["inputs"] as? JsonObject)
                    ?: emptyMap()
            )
        }
    }

    fun compile(report: TranscriptCanonicalReport): InlineReportRuntimeArtifact {
        val status = report.status.trim().lowercase()
        require(status == "committed" || status == "ready") {
            "Inline report status '$status' cannot be rendered."
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
            put("version", JsonPrimitive(1))
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
                "version" to JsonPrimitive(1),
                "kind" to JsonPrimitive("reportFill"),
                "specVersion" to JsonPrimitive(1),
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
        // The canonical map key is the report's dataset identity. source.id is
        // transport metadata and may name the backing datasource instead.
        val id = key.trim().ifEmpty { source.id.trim() }
        val rows = when (val payload = TranscriptEnvelope.materializeCanonicalPayload(source.format, source.payload)) {
            is JsonArray -> payload.toList()
            is JsonObject -> listOf(payload)
            else -> emptyList()
        }
        id to rows
    }.toMap()

    private fun exportFence(kind: String, index: Int, payload: JsonObject): JsonObject = JsonObject(
        mapOf(
            "kind" to JsonPrimitive(kind),
            "index" to JsonPrimitive(index),
            "payload" to payload
        )
    )

    private fun safeFenceSegment(value: String, fallback: String): String = value.trim()
        .replace(Regex("[^A-Za-z0-9._-]+"), "_")
        .trim('_')
        .ifEmpty { fallback }

    private fun pdfDatasetPayload(value: JsonElement): JsonElement = when (value) {
        is JsonArray -> JsonArray(value.map(::pdfDatasetPayload))
        is JsonObject -> JsonObject(value.mapValues { pdfDatasetPayload(it.value) })
        is JsonPrimitive -> if (value.isString && value.content.isBlank()) JsonPrimitive("—") else value
        else -> value
    }

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
            "badgesBlock" -> {
                val datasetRef = string(source["datasetRef"]).orEmpty()
                val rows = datasets[datasetRef].orEmpty()
                val row = rows.firstOrNull() as? JsonObject
                val items = ((source["items"] as? JsonArray) ?: (content["items"] as? JsonArray)).orEmpty()
                content["items"] = JsonArray(items.mapNotNull { value ->
                    materializeBadgeItem(value as? JsonObject ?: return@mapNotNull null, row)
                })
                content["rowCount"] = JsonPrimitive(rows.size)
            }
            "timelineBlock" -> {
                val datasetRef = string(source["datasetRef"]).orEmpty()
                val rows = datasets[datasetRef].orEmpty().mapNotNull { it as? JsonObject }
                val timeField = string(source["timeField"]) ?: "timestamp"
                val titleField = string(source["titleField"]) ?: "title"
                val descriptionField = string(source["descriptionField"]) ?: "description"
                val columns = (source["columns"] as? JsonArray).orEmpty().mapNotNull { it as? JsonObject }
                content["events"] = JsonArray(rows.map { row ->
                    val details = buildList {
                        string(row[descriptionField])?.takeIf { it.isNotBlank() }?.let(::add)
                        columns.forEach { column ->
                            val key = string(column["key"]) ?: return@forEach
                            val value = row[key]?.let(JsonUtil::elementToAny)?.toString()
                                ?.takeIf { it.isNotBlank() } ?: return@forEach
                            val label = string(column["label"]) ?: key
                            add("$label: $value")
                        }
                    }
                    JsonObject(mapOf(
                        "date" to (row[timeField] ?: JsonPrimitive("")),
                        "title" to (row[titleField] ?: JsonPrimitive("Event")),
                        "body" to JsonPrimitive(details.joinToString("\n\n"))
                    ))
                })
                content["rowCount"] = JsonPrimitive(rows.size)
            }
            "collectionBlock" -> {
                val datasetRef = string(source["datasetRef"]).orEmpty()
                val rows = datasets[datasetRef].orEmpty().mapNotNull { it as? JsonObject }
                val titleField = string(source["itemTitleField"]) ?: "title"
                val bodyField = string(source["bodyField"])
                val bodyTemplate = string(source["bodyTemplate"])
                val toneField = string(source["toneField"])
                val toneRules = (source["toneRules"] as? JsonArray).orEmpty()
                    .mapNotNull { it as? JsonObject }
                val rowLimit = string(source["rowLimit"])?.toIntOrNull()
                    ?: (source["rowLimit"] as? JsonPrimitive)?.content?.toIntOrNull()
                    ?: rows.size
                content["items"] = JsonArray(rows.take(rowLimit.coerceAtLeast(0)).map { row ->
                    val rawTone = toneField?.let(row::get)
                    val toneRule = toneRules.firstOrNull { rule ->
                        JsonUtil.elementToAny(rule["value"] ?: JsonNull) ==
                            JsonUtil.elementToAny(rawTone ?: JsonNull)
                    }
                    JsonObject(buildMap {
                        put("title", row[titleField] ?: JsonPrimitive("Item"))
                        val body = when {
                            !bodyTemplate.isNullOrBlank() -> interpolateCollectionTemplate(bodyTemplate, row)
                            !bodyField.isNullOrBlank() -> string(row[bodyField]).orEmpty()
                            else -> ""
                        }
                        put("bodyMarkdown", JsonPrimitive(body))
                        rawTone?.let { put("value", it) }
                        (toneRule?.get("tone") ?: source["tone"])?.let { put("tone", it) }
                        toneRule?.get("label")?.let { put("toneLabel", it) }
                        toneRule?.get("color")?.let { put("color", it) }
                        toneRule?.get("background")?.let { put("background", it) }
                    })
                })
                content["rowCount"] = JsonPrimitive(rows.size)
            }
        }
        val datasetRef = string(source["datasetRef"])
            ?: string(content["datasetRef"])
            ?: ""
        val materializedContent = materializeReportTemplates(
            JsonObject(content),
            datasetRef = datasetRef,
            datasets = datasets
        ) as JsonObject
        objectValue["content"] = materializedContent
        return JsonObject(objectValue)
    }

    private fun materializeReportTemplates(
        value: JsonElement,
        datasetRef: String,
        datasets: Map<String, List<JsonElement>>
    ): JsonElement = when (value) {
        is JsonObject -> JsonObject(value.mapValues { (_, child) ->
            materializeReportTemplates(child, datasetRef, datasets)
        })
        is JsonArray -> JsonArray(value.map { child ->
            materializeReportTemplates(child, datasetRef, datasets)
        })
        is JsonPrimitive -> if (value.isString) {
            JsonPrimitive(resolveReportTemplate(value.content, datasetRef, datasets))
        } else value
        else -> value
    }

    private fun resolveReportTemplate(
        template: String,
        datasetRef: String,
        datasets: Map<String, List<JsonElement>>
    ): String {
        if (!template.contains("${'$'}{") && !template.contains("{{")) return template
        fun replaceToken(match: MatchResult): String = resolveReportTemplateToken(
            match.groupValues[1],
            datasetRef,
            datasets
        )
        return HANDLEBARS_TEMPLATE.replace(
            DOLLAR_TEMPLATE.replace(template, ::replaceToken),
            ::replaceToken
        )
    }

    private fun resolveReportTemplateToken(
        rawToken: String,
        datasetRef: String,
        datasets: Map<String, List<JsonElement>>
    ): String {
        val token = rawToken.trim()
        if (token.isEmpty()) return "—"
        val functionHelper = FORMAT_FUNCTION.matchEntire(token)
        val spaceHelper = FORMAT_SPACE.matchEntire(token)
        val helper = functionHelper?.groupValues?.get(1) ?: spaceHelper?.groupValues?.get(1)
        val valueToken = functionHelper?.groupValues?.get(2) ?: spaceHelper?.groupValues?.get(2) ?: token
        val value = resolveReportTemplateValue(valueToken.trim(), datasetRef, datasets)
            ?: return "—"
        if (helper != null) {
            val format = when (helper.lowercase()) {
                "compact" -> "compactNumber"
                "percentfraction" -> "percentFraction"
                else -> helper
            }
            return formatDashboardValue(JsonUtil.elementToAny(value), format)
        }
        return when (value) {
            is JsonPrimitive -> value.contentOrNull ?: value.toString()
            else -> JsonUtil.elementToAny(value)?.toString() ?: "—"
        }
    }

    private fun resolveReportTemplateValue(
        rawPath: String,
        datasetRef: String,
        datasets: Map<String, List<JsonElement>>
    ): JsonElement? {
        var path = rawPath.trim()
        if (path.startsWith("row.")) path = path.removePrefix("row.")
        val absolute = path.split('.', limit = 2)
        if (absolute.size == 2 && datasets.containsKey(absolute[0])) {
            val nestedPath = absolute[1].removePrefix("row.")
            return resolveReportTemplatePath(datasets[absolute[0]]?.firstOrNull(), nestedPath)
        }
        val preferredRows = datasets[datasetRef].orEmpty()
        return resolveReportTemplatePath(preferredRows.firstOrNull(), path)
    }

    private fun resolveReportTemplatePath(root: JsonElement?, path: String): JsonElement? {
        var current = root ?: return null
        for (segment in path.split('.').filter(String::isNotBlank)) {
            current = (current as? JsonObject)?.get(segment) ?: return null
        }
        return current.takeUnless { it == JsonNull }
    }

    private fun materializeBadgeItem(item: JsonObject, row: JsonObject?): JsonObject? {
        val label = string(item["label"])
        val valueField = string(item["valueField"])
        val rawValue = valueField?.let { row?.get(it) } ?: item["value"]
        if (label == null && rawValue == null && valueField == null) return null
        val matchedRule = (item["rules"] as? JsonArray).orEmpty()
            .mapNotNull { it as? JsonObject }
            .firstOrNull { rule ->
                JsonUtil.elementToAny(rule["value"] ?: JsonNull) == JsonUtil.elementToAny(rawValue ?: JsonNull)
            }
        val displayKey = string(item["displayKey"])
        val mappedDisplay = (item["displayValueMap"] as? JsonObject)
            ?.get(JsonUtil.elementToAny(rawValue ?: JsonNull)?.toString().orEmpty())
        val format = string(item["format"])
        val displayValue = matchedRule?.get("label")
            ?: displayKey?.let { row?.get(it) }
            ?: mappedDisplay
            ?: rawValue?.let { value ->
                format?.let { JsonPrimitive(formatDashboardValue(JsonUtil.elementToAny(value), it)) } ?: value
            }
        return JsonObject(item.toMutableMap().apply {
            rawValue?.let { put("value", it) }
            displayValue?.let { put("displayValue", it) }
            (matchedRule?.get("tone") ?: item["tone"])?.let { put("tone", it) }
        })
    }

    private fun interpolateCollectionTemplate(template: String, row: JsonObject): String {
        val prefix = "${'$'}{row."
        val result = StringBuilder(template.length)
        var cursor = 0
        while (cursor < template.length) {
            val start = template.indexOf(prefix, cursor)
            if (start < 0) {
                result.append(template, cursor, template.length)
                break
            }
            result.append(template, cursor, start)
            val end = template.indexOf('}', start + prefix.length)
            if (end < 0) {
                result.append(template, start, template.length)
                break
            }
            val path = template.substring(start + prefix.length, end).split('.')
            var value: JsonElement? = row
            path.forEach { key -> value = (value as? JsonObject)?.get(key) }
            result.append(when (value) {
                null, JsonNull -> ""
                is JsonPrimitive -> (value as JsonPrimitive).contentOrNull.orEmpty()
                else -> JsonUtil.elementToAny(value!!)?.toString().orEmpty()
            })
            cursor = end + 1
        }
        return result.toString()
    }

    // Android's ICU regex engine requires closing braces to be escaped even
    // when they cannot form a valid quantifier. Keep these patterns portable
    // between the JVM test runtime and Android devices.
    private val DOLLAR_TEMPLATE = Regex("""\$\{\s*([^}]+?)\s*\}""")
    private val HANDLEBARS_TEMPLATE = Regex("""\{\{\s*(.+?)\s*\}\}""")
    private val FORMAT_FUNCTION = Regex(
        """(?i)^fmt\.(compact|compactNumber|currency|currency2|percent|percentFraction|number|number2|number5)\((.+)\)$"""
    )
    private val FORMAT_SPACE = Regex(
        """(?i)^fmt\.(compact|compactNumber|currency|currency2|percent|percentFraction|number|number2|number5)\s+(.+)$"""
    )

    private fun adaptDashboardBlocks(blocks: List<JsonElement>): List<JsonElement> = blocks.flatMap { block ->
        val source = block as? JsonObject ?: return@flatMap emptyList()
        when (string(source["kind"])) {
            "dashboard.table", "dashboard.kpiTable", "dashboard.timeline", "dashboard.dimensions",
            "dashboard.composition", "dashboard.messages", "dashboard.status", "dashboard.badges",
            "dashboard.compare", "dashboard.feed" -> listOf(canonicalTableBlock(source))
            "dashboard.filters" -> emptyList()
            "dashboard.summary" -> (source["metrics"] as? JsonArray).orEmpty().mapIndexedNotNull { index, metric ->
                val item = metric as? JsonObject ?: return@mapIndexedNotNull null
                val selector = string(item["selector"])?.removePrefix("0.") ?: "value"
                JsonObject(mapOf(
                    "id" to (item["id"] ?: JsonPrimitive("${string(source["id"]) ?: "summary"}-${index + 1}")),
                    "kind" to JsonPrimitive("kpiBlock"),
                    "title" to (item["label"] ?: source["title"] ?: JsonPrimitive("KPI")),
                    "datasetRef" to JsonPrimitive(string(source["dataSourceRef"]) ?: "data"),
                    "valueField" to JsonPrimitive(selector),
                    "valueLabel" to (item["label"] ?: JsonPrimitive("Value"))
                ) + string(item["format"])?.let { mapOf("valueFormat" to JsonPrimitive(it)) }.orEmpty())
            }
            "dashboard.detail", "dashboard.report" -> {
                val children = adaptDashboardBlocks((source["containers"] as? JsonArray).orEmpty())
                if (children.isEmpty()) listOf(canonicalMarkdownBlock(source)) else {
                    val id = string(source["id"]) ?: "section"
                    listOf(JsonObject(mapOf(
                        "id" to JsonPrimitive(id),
                        "kind" to JsonPrimitive("compositeBlock"),
                        "title" to JsonPrimitive(string(source["title"]) ?: humanize(id)),
                        "childBlockIds" to JsonArray(children.mapNotNull { (it as? JsonObject)?.get("id") })
                    ))) + children
                }
            }
            else -> if (string(source["kind"])?.startsWith("dashboard.") == true) {
                if (string(source["dataSourceRef"]) != null) listOf(canonicalTableBlock(source))
                else listOf(canonicalMarkdownBlock(source))
            } else listOf(source)
        }
    }

    private fun canonicalTableBlock(source: JsonObject): JsonObject {
        val id = string(source["id"]) ?: "table"
        return JsonObject(mapOf(
            "id" to JsonPrimitive(id),
            "kind" to JsonPrimitive("tableBlock"),
            "title" to JsonPrimitive(string(source["title"]) ?: humanize(id)),
            "datasetRef" to JsonPrimitive(string(source["dataSourceRef"]) ?: string(source["datasetRef"]) ?: "data"),
            "columns" to JsonArray(canonicalTableColumns(source))
        ))
    }

    private fun canonicalTableColumns(source: JsonObject): List<JsonElement> {
        val authored = (source["columns"] as? JsonArray).orEmpty().mapNotNull { value ->
            val column = value as? JsonObject ?: return@mapNotNull null
            val key = string(column["key"]) ?: string(column["id"]) ?: string(column["name"]) ?: return@mapNotNull null
            JsonObject(buildMap {
                put("key", JsonPrimitive(key))
                put("label", JsonPrimitive(string(column["label"]) ?: string(column["name"]) ?: humanize(key)))
                string(column["format"])?.let { put("format", JsonPrimitive(it)) }
                column["cellVisual"]?.let { put("cellVisual", it) }
            })
        }
        if (authored.isNotEmpty()) return authored
        val keys = listOf("categoryKey", "nameKey", "dateField", "timeKey", "valueKey")
            .mapNotNull { string(source[it]) }.distinct().ifEmpty { listOf("value") }
        return keys.map { key -> JsonObject(mapOf("key" to JsonPrimitive(key), "label" to JsonPrimitive(humanize(key)))) }
    }

    private fun canonicalMarkdownBlock(source: JsonObject): JsonObject {
        val id = string(source["id"]) ?: "section"
        val title = string(source["title"]) ?: humanize(id)
        return JsonObject(mapOf(
            "id" to JsonPrimitive(id),
            "kind" to JsonPrimitive("markdownBlock"),
            "title" to JsonPrimitive(title),
            "markdown" to JsonPrimitive(string(source["subtitle"]) ?: title)
        ))
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
        return result.filter { declaration ->
            val id = string(declaration["id"])
            if (id == null) {
                if (string(declaration["kind"])?.lowercase() == "workspaceref") {
                    error("Workspace dataset must declare id.")
                }
                false
            } else {
                seen.add(id)
            }
        }
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

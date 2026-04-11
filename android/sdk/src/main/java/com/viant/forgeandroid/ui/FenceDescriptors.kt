package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.ChartAxisDef
import com.viant.forgeandroid.runtime.ChartDef
import com.viant.forgeandroid.runtime.ChartSeriesDef
import com.viant.forgeandroid.runtime.ChartValueOption
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull

internal enum class FenceRendererType {
    Code,
    Mermaid,
    Chart,
    PipeTable,
    Markdown
}

internal data class FenceDescriptor(
    val renderer: FenceRendererType,
    val lang: String,
    val body: String,
    val chart: FenceChartSpec? = null,
    val table: ParsedFenceTable? = null
)

internal data class FenceChartSpec(
    val chart: ChartDef,
    val rows: List<Map<String, Any?>>
)

internal data class ParsedFenceTable(
    val headers: List<String>,
    val rows: List<List<String>>
)

internal fun describeFence(rawLang: String, body: String): FenceDescriptor {
    val lang = normalizeFenceLanguage(rawLang)
    parseChartFence(lang, body)?.let {
        return FenceDescriptor(FenceRendererType.Chart, lang, body, chart = it)
    }
    if ((lang == "markdown" || lang == "md" || lang == "plaintext") && looksLikeFenceTable(body)) {
        return FenceDescriptor(
            renderer = FenceRendererType.PipeTable,
            lang = lang,
            body = body,
            table = parseFenceTable(body)
        )
    }
    if (lang == "mermaid" || Regex("^\\s*(sequenceDiagram|flowchart|graph|classDiagram|stateDiagram|erDiagram|pie|timeline|gantt)").containsMatchIn(body)) {
        return FenceDescriptor(FenceRendererType.Mermaid, lang, body)
    }
    if (lang == "markdown" || lang == "md") {
        return FenceDescriptor(FenceRendererType.Markdown, lang, body)
    }
    return FenceDescriptor(FenceRendererType.Code, lang, body)
}

private fun normalizeFenceLanguage(value: String): String {
    return when (value.trim().lowercase()) {
        "" -> "plaintext"
        "js" -> "javascript"
        "ts" -> "typescript"
        "yml" -> "yaml"
        "sequence", "sequencediagram" -> "mermaid"
        else -> value.trim().lowercase()
    }
}

private fun looksLikeFenceTable(body: String): Boolean {
    val lines = body.lines().map { it.trim() }.filter { it.isNotEmpty() }
    if (lines.size < 2) return false
    if (!lines[0].contains('|')) return false
    return Regex("^\\|?\\s*[:\\-]+(\\s*\\|\\s*[:\\-]+)+\\s*\\|?$").matches(lines[1])
}

private fun parseFenceTable(body: String): ParsedFenceTable {
    val lines = body.lines().map { it.trim() }.filter { it.isNotEmpty() }
    val headers = tableCells(lines.firstOrNull().orEmpty())
    val rows = lines.drop(2).map { row ->
        val cells = tableCells(row)
        when {
            cells.size < headers.size -> cells + List(headers.size - cells.size) { "" }
            cells.size > headers.size -> cells.take(headers.size)
            else -> cells
        }
    }
    return ParsedFenceTable(headers = headers, rows = rows)
}

private fun tableCells(line: String): List<String> {
    return line.trim().trim('|').split('|').map { stripInlineMarkdown(it.trim()) }
}

private fun parseChartFence(lang: String, body: String): FenceChartSpec? {
    if (lang !in setOf("json", "javascript", "js", "plaintext", "md", "markdown", "chart")) return null
    val normalized = body
        .replace(Regex("[\\u00A0\\u1680\\u2000-\\u200B\\u202F\\u205F\\u3000]"), " ")
        .trim()
    if (!normalized.startsWith("{") && !normalized.startsWith("[")) return null
    return try {
        val root = Json.parseToJsonElement(normalized)
        parseExplicitChart(root) ?: parseTopLevelChart(root)
    } catch (_: Exception) {
        null
    }
}

private fun parseExplicitChart(root: JsonElement): FenceChartSpec? {
    val obj = root as? JsonObject ?: return null
    val chart = obj["chart"] as? JsonObject ?: return null
    val data = obj["data"] as? JsonArray ?: return null
    val type = chart["type"]?.jsonPrimitive?.contentOrNull?.trim()?.lowercase().orEmpty().ifBlank { "line" }
    val xKey = chart["x"]?.jsonObject?.get("key")?.jsonPrimitive?.contentOrNull ?: "x"
    val yKeys = chart["y"]?.jsonArray?.mapNotNull { it.jsonObject["key"]?.jsonPrimitive?.contentOrNull }.orEmpty()
    val valueKey = chart["valueKey"]?.jsonPrimitive?.contentOrNull ?: yKeys.firstOrNull().orEmpty()
    val nameKey = chart["series"]?.jsonObject?.get("key")?.jsonPrimitive?.contentOrNull
    val palette = obj["options"]?.jsonObject?.get("palette")?.jsonArray?.mapNotNull { it.jsonPrimitive.contentOrNull }.orEmpty()
    val rows = data.mapNotNull { jsonRow(it) }
    if (rows.isEmpty()) return null
    return FenceChartSpec(
        chart = ChartDef(
            type = type,
            xAxis = ChartAxisDef(dataKey = xKey),
            yAxis = null,
            series = ChartSeriesDef(
                nameKey = nameKey,
                valueKey = valueKey.ifBlank { null },
                palette = palette,
                values = yKeys.map { ChartValueOption(value = it) }
            )
        ),
        rows = rows
    )
}

private fun parseTopLevelChart(root: JsonElement): FenceChartSpec? {
    val obj = root as? JsonObject ?: return null
    val type = obj["type"]?.jsonPrimitive?.contentOrNull?.trim()?.lowercase().orEmpty()
    val data = obj["data"] as? JsonArray ?: return null
    if (type.isBlank()) return null
    val rows = data.mapNotNull { jsonRow(it) }
    if (rows.isEmpty()) return null
    val first = rows.firstOrNull().orEmpty()
    val xKey = obj["x"]?.jsonObject?.get("field")?.jsonPrimitive?.contentOrNull
        ?: obj["xKey"]?.jsonPrimitive?.contentOrNull
        ?: first.keys.firstOrNull { first[it] is String }
        ?: first.keys.firstOrNull()
        ?: "x"
    val yKey = obj["y"]?.jsonObject?.get("field")?.jsonPrimitive?.contentOrNull
        ?: obj["valueKey"]?.jsonPrimitive?.contentOrNull
        ?: first.keys.firstOrNull { it != xKey && first[it] is Number }
        ?: first.keys.firstOrNull { it != xKey }
        ?: "value"
    return FenceChartSpec(
        chart = ChartDef(
            type = type,
            xAxis = ChartAxisDef(dataKey = xKey),
            series = ChartSeriesDef(valueKey = yKey, values = listOf(ChartValueOption(value = yKey)))
        ),
        rows = rows
    )
}

private fun jsonRow(element: JsonElement): Map<String, Any?>? {
    val obj = element as? JsonObject ?: return null
    return obj.mapValues { (_, value) -> jsonValue(value) }
}

private fun jsonValue(value: JsonElement): Any? = when (value) {
    is JsonPrimitive -> when {
        value.isString -> value.content
        value.booleanOrNull != null -> value.boolean
        value.longOrNull != null -> value.longOrNull
        value.doubleOrNull != null -> value.doubleOrNull
        else -> value.content
    }
    is JsonObject -> value.mapValues { (_, nested) -> jsonValue(nested) }
    is JsonArray -> value.map { jsonValue(it) }
}

private fun stripInlineMarkdown(text: String): String {
    return text
        .replace(Regex("\\*\\*(.+?)\\*\\*"), "$1")
        .replace(Regex("`(.+?)`"), "$1")
        .replace(Regex("\\[(.+?)]\\((.+?)\\)"), "$1")
}

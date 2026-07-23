package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.JsonUtil
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

@Serializable
data class TranscriptForgeDataBlock(
    val version: Int? = 1,
    val id: String? = null,
    val format: String? = null,
    val mode: String? = null,
    val data: JsonElement? = null
)

@Serializable
data class TranscriptForgeUiPayload(
    val version: Int? = 1,
    val title: String? = null,
    val subtitle: String? = null,
    val blocks: List<JsonObject> = emptyList()
)

data class TranscriptForgeDataStore(val id: String, val rows: Any?)

/**
 * Platform-neutral transcript parts emitted by a conversation SDK. Forge owns
 * their data/UI pairing so native hosts do not re-parse completed messages.
 */
data class TranscriptCanonicalData(
    val version: Int? = null,
    val scope: String? = null,
    val reportRef: String? = null,
    val sequence: Int? = null,
    val id: String,
    val format: String? = null,
    val mode: String? = null,
    val payload: JsonElement? = null
)

data class TranscriptCanonicalPart(
    val kind: String,
    val text: String? = null,
    val source: String? = null,
    val payload: JsonElement? = null,
    val data: TranscriptCanonicalData? = null
)

data class TranscriptCanonicalReport(
    val scope: String,
    val id: String,
    val grammar: String,
    val status: String,
    val sequence: Int? = null,
    val resetVersion: Int = 0,
    val source: JsonElement,
    val dataSources: Map<String, TranscriptCanonicalData> = emptyMap()
)

sealed interface TranscriptEnvelopePart {
    data class Markdown(val text: String) : TranscriptEnvelopePart
    data class ForgeUi(val payload: TranscriptForgeUiPayload, val dataStore: Map<String, TranscriptForgeDataStore>) : TranscriptEnvelopePart
}

/** Generic Forge transcript decoding. Hosts own placement, not this envelope protocol. */
object TranscriptEnvelope {
    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Removes progressive report transport fences from text that accompanies
     * an already-assembled canonical report. Ordinary markdown and legacy
     * Forge UI payloads remain visible.
     */
    fun suppressProgressiveTransport(markdown: String): String =
        MarkdownFenceParser.parse(markdown).joinToString(separator = "") { part ->
            when (part) {
                is MarkdownFencePart.Text -> part.value
                is MarkdownFencePart.Fence -> when {
                    !part.closed -> part.raw
                    part.language == "forge-report" -> ""
                    part.language == "forge-data" && isProgressiveDataBody(part.body) -> ""
                    else -> part.raw
                }
            }
        }

    fun parse(markdown: String): List<TranscriptEnvelopePart> {
        if (markdown.isEmpty()) return emptyList()
        val result = mutableListOf<TranscriptEnvelopePart>()
        val dataBlocks = mutableListOf<TranscriptForgeDataBlock>()
        val dataRaw = mutableListOf<String>()
        var renderedUi = false
        MarkdownFenceParser.parse(markdown).forEach { part ->
            when (part) {
                is MarkdownFencePart.Text -> {
                    if (dataBlocks.isNotEmpty() && part.value.isBlank()) {
                        dataRaw += part.value
                    } else {
                        flushPendingData(result, dataBlocks, dataRaw)
                        appendMarkdown(result, part.value)
                    }
                }
                is MarkdownFencePart.Fence -> when {
                    !part.closed -> {
                        flushPendingData(result, dataBlocks, dataRaw)
                        appendMarkdown(result, part.raw)
                    }
                    part.language == "forge-data" -> parseData(part.header, part.body)?.let {
                        dataBlocks += it
                        dataRaw += part.raw
                    } ?: run {
                        flushPendingData(result, dataBlocks, dataRaw)
                        appendMarkdown(result, part.raw)
                    }
                    part.language == "forge-ui" -> parseUi(part.body)?.let { payload ->
                        result += TranscriptEnvelopePart.ForgeUi(payload, materialize(dataBlocks))
                        // A data snapshot must be immediately adjacent to one UI block.
                        dataBlocks.clear()
                        dataRaw.clear()
                        renderedUi = true
                    } ?: run {
                        flushPendingData(result, dataBlocks, dataRaw)
                        appendMarkdown(result, part.raw)
                    }
                    else -> {
                        flushPendingData(result, dataBlocks, dataRaw)
                        appendMarkdown(result, part.raw)
                    }
                }
            }
        }
        flushPendingData(result, dataBlocks, dataRaw)
        return if (renderedUi) result else listOf(TranscriptEnvelopePart.Markdown(markdown))
    }

    /**
     * Builds the same envelope from the canonical SDK representation. Raw
     * parsing is reserved for streaming or legacy messages where that additive
     * representation is not available.
     */
    fun fromCanonical(parts: List<TranscriptCanonicalPart>): List<TranscriptEnvelopePart> {
        if (parts.isEmpty()) return emptyList()
        val result = mutableListOf<TranscriptEnvelopePart>()
        val dataBlocks = mutableListOf<TranscriptForgeDataBlock>()
        val dataRaw = mutableListOf<String>()
        var renderedUi = false
        var renderedReport = false
        parts.forEach { part ->
            when (part.kind.trim().lowercase()) {
                "markdown" -> {
                    val text = part.text.orEmpty()
                    if (dataBlocks.isNotEmpty() && text.isBlank()) {
                        dataRaw += text
                    } else {
                        flushPendingData(result, dataBlocks, dataRaw)
                        appendMarkdown(result, text)
                    }
                }

                "forgedata" -> if (isProgressiveData(part)) {
                    renderedReport = true
                } else canonicalData(part)?.let { block ->
                    dataBlocks += block
                    dataRaw += part.source.orEmpty()
                } ?: run {
                    flushPendingData(result, dataBlocks, dataRaw)
                    appendMarkdown(result, part.source.orEmpty())
                }

                "forgeui" -> canonicalUi(part)?.let { payload ->
                    result += TranscriptEnvelopePart.ForgeUi(payload, materialize(dataBlocks))
                    dataBlocks.clear()
                    dataRaw.clear()
                    renderedUi = true
                } ?: run {
                    flushPendingData(result, dataBlocks, dataRaw)
                    appendMarkdown(result, part.source.orEmpty())
                }

                "forgereport" -> renderedReport = true

                else -> {
                    flushPendingData(result, dataBlocks, dataRaw)
                    appendMarkdown(result, part.source.orEmpty())
                }
            }
        }
        flushPendingData(result, dataBlocks, dataRaw)
        return if (renderedUi || renderedReport) result else listOf(
            TranscriptEnvelopePart.Markdown(parts.joinToString(separator = "") { it.text ?: it.source.orEmpty() })
        )
    }

    fun rows(value: Any?): List<Map<String, Any?>> = when (value) {
        is List<*> -> value.filterIsInstance<Map<String, Any?>>()
        is Map<*, *> -> listOf(value.entries.associate { it.key.toString() to it.value })
        else -> emptyList()
    }

    private fun parseData(header: String, body: String): TranscriptForgeDataBlock? {
        val attributes = MarkdownFenceHeader.attributes(header)
        val headerID = attributes["id"]?.trim().orEmpty()
        if (headerID.isNotEmpty()) {
            val format = attributes["format"]?.trim()?.lowercase()
            val data = if (format == "csv") JsonPrimitive(body) else runCatching { json.parseToJsonElement(body) }.getOrNull() ?: return null
            return TranscriptForgeDataBlock(id = headerID, format = format, mode = attributes["mode"], data = data)
        }
        val dataObject = runCatching { json.parseToJsonElement(body) as? JsonObject }.getOrNull()
        if (dataObject != null && dataObject["id"] != null) {
            return runCatching {
                json.decodeFromJsonElement(TranscriptForgeDataBlock.serializer(), dataObject)
            }.getOrNull()?.takeIf { !it.id.isNullOrBlank() }
        }
        return null
    }

    private fun parseUi(body: String): TranscriptForgeUiPayload? = runCatching {
        json.decodeFromString(TranscriptForgeUiPayload.serializer(), body)
    }.getOrNull()

    private fun canonicalData(part: TranscriptCanonicalPart): TranscriptForgeDataBlock? {
        val data = part.data ?: return null
        val id = data.id.trim()
        if (id.isBlank() || data.payload == null) return null
        return TranscriptForgeDataBlock(
            version = data.version ?: 1,
            id = id,
            format = data.format?.trim()?.lowercase(),
            mode = data.mode,
            data = data.payload
        )
    }

    private fun isProgressiveData(part: TranscriptCanonicalPart): Boolean {
        val data = part.data ?: return false
        return data.version == 2 || !data.reportRef.isNullOrBlank()
    }

    private fun isProgressiveDataBody(body: String): Boolean {
        val data = runCatching { json.parseToJsonElement(body) as? JsonObject }.getOrNull() ?: return false
        val version = (data["version"] as? JsonPrimitive)?.content?.toIntOrNull()
        return version == 2 || !(data["reportRef"] as? JsonPrimitive)?.content.isNullOrBlank()
    }

    private fun canonicalUi(part: TranscriptCanonicalPart): TranscriptForgeUiPayload? {
        val payload = part.payload ?: return null
        return runCatching {
            json.decodeFromJsonElement(TranscriptForgeUiPayload.serializer(), payload)
        }.getOrNull()
    }

    private fun materialize(blocks: List<TranscriptForgeDataBlock>): Map<String, TranscriptForgeDataStore> {
        val store = linkedMapOf<String, TranscriptForgeDataStore>()
        blocks.forEach { block ->
            val id = block.id?.trim().orEmpty()
            if (id.isEmpty()) return@forEach
            val next = materialize(block)
            val current = store[id]?.rows
            val rows = when (block.mode?.trim()?.lowercase()) {
                "append" -> if (current is List<*> && next is List<*>) current + next else next
                "patch" -> if (current is Map<*, *> && next is Map<*, *>) current + next else next
                else -> next
            }
            store[id] = TranscriptForgeDataStore(id, rows)
        }
        return store
    }

    private fun materialize(block: TranscriptForgeDataBlock): Any? {
        val format = block.format?.trim()?.lowercase().orEmpty().ifBlank { if (block.data is JsonPrimitive) "csv" else "json" }
        if (format != "csv") return block.data?.let(JsonUtil::elementToAny)
        val text = (block.data as? JsonPrimitive)?.content.orEmpty()
        return parseCsv(text) ?: text
    }

    internal fun materializeCanonicalPayload(format: String?, payload: JsonElement?): JsonElement? {
        payload ?: return null
        if (format?.trim()?.lowercase() != "csv") return payload
        val text = (payload as? JsonPrimitive)?.content ?: return payload
        return parseCsv(text)?.let(JsonUtil::anyToElement) ?: payload
    }

    private fun parseCsv(text: String): List<Map<String, Any?>>? {
        val records = mutableListOf<List<String>>()
        val row = mutableListOf<String>()
        val current = StringBuilder()
        var quoted = false
        var index = 0
        while (index < text.length) {
            val char = text[index]
            val next = text.getOrNull(index + 1)
            when {
                char == '\"' && quoted && next == '\"' -> { current.append(char); index += 2 }
                char == '\"' -> { quoted = !quoted; index++ }
                char == ',' && !quoted -> { row += current.toString().trim(); current.clear(); index++ }
                (char == '\n' || char == '\r') && !quoted -> {
                    row += current.toString().trim()
                    if (row.any(String::isNotBlank)) records += row.toList()
                    row.clear(); current.clear()
                    index += if (char == '\r' && next == '\n') 2 else 1
                }
                else -> { current.append(char); index++ }
            }
        }
        if (quoted) return null
        row += current.toString().trim()
        if (row.any(String::isNotBlank)) records += row
        if (records.isEmpty()) return emptyList()
        val headers = records.first()
        if (headers.isEmpty() || headers.size != headers.toSet().size) return null
        return records.drop(1).map { cells ->
            headers.mapIndexed { position, header -> header to csvValue(cells.getOrElse(position) { "" }) }.toMap()
        }
    }

    private fun csvValue(value: String): Any = when {
        value.equals("true", true) -> true
        value.equals("false", true) -> false
        value.toLongOrNull() != null -> value.toLong()
        value.toDoubleOrNull() != null -> value.toDouble()
        else -> value
    }

    private fun appendMarkdown(parts: MutableList<TranscriptEnvelopePart>, text: String) {
        if (text.isBlank()) return
        val previous = parts.lastOrNull()
        if (previous is TranscriptEnvelopePart.Markdown) parts[parts.lastIndex] = previous.copy(text = previous.text + text) else parts += TranscriptEnvelopePart.Markdown(text)
    }

    private fun flushPendingData(
        parts: MutableList<TranscriptEnvelopePart>,
        blocks: MutableList<TranscriptForgeDataBlock>,
        raw: MutableList<String>
    ) {
        raw.forEach { appendMarkdown(parts, it) }
        blocks.clear()
        raw.clear()
    }
}

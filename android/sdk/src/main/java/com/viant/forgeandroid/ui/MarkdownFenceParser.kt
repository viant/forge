package com.viant.forgeandroid.ui

import kotlinx.serialization.json.Json

/**
 * Framework-neutral markdown fence segmentation used by hosts before they
 * decide which Forge surface, if any, owns a fenced payload.
 */
sealed interface MarkdownFencePart {
    data class Text(val value: String) : MarkdownFencePart

    data class Fence(
        val raw: String,
        val language: String,
        val header: String,
        val body: String,
        val closed: Boolean
    ) : MarkdownFencePart
}

/**
 * A small scanner instead of a regular expression so streamed, malformed, and
 * adjacent fences retain their original text without backtracking ambiguity.
 */
object MarkdownFenceParser {
    private const val marker = "```"
    private val json = Json { ignoreUnknownKeys = true }

    fun parse(content: String): List<MarkdownFencePart> {
        if (content.isEmpty()) {
            return emptyList()
        }
        val parts = mutableListOf<MarkdownFencePart>()
        var cursor = 0
        while (cursor < content.length) {
            val opening = content.indexOf(marker, cursor)
            if (opening < 0) {
                appendText(parts, content.substring(cursor))
                break
            }
            if (opening > cursor) {
                appendText(parts, content.substring(cursor, opening))
            }
            val languageStart = opening + marker.length
            var languageEnd = languageStart
            while (languageEnd < content.length && isLanguageCharacter(content[languageEnd])) {
                languageEnd++
            }
            val headerAndBody = headerAndBodyStart(content, languageEnd)
            if (headerAndBody == null) {
                // This marker is not a valid fence opener. Keep it verbatim.
                appendText(parts, marker)
                cursor = languageStart
                continue
            }
            val closing = closingMarker(content, headerAndBody.bodyStart)
            if (closing < 0) {
                parts += MarkdownFencePart.Fence(
                    raw = content.substring(opening),
                    language = content.substring(languageStart, languageEnd).lowercase(),
                    header = headerAndBody.header,
                    body = content.substring(headerAndBody.bodyStart),
                    closed = false
                )
                break
            }
            parts += MarkdownFencePart.Fence(
                raw = content.substring(opening, closing + marker.length),
                language = content.substring(languageStart, languageEnd).lowercase(),
                header = headerAndBody.header,
                body = content.substring(headerAndBody.bodyStart, closing),
                closed = true
            )
            cursor = closing + marker.length
        }
        return parts
    }

    private data class HeaderAndBodyStart(val header: String, val bodyStart: Int)

    private fun closingMarker(content: String, bodyStart: Int): Int {
        var searchStart = bodyStart
        while (searchStart < content.length) {
            val candidate = content.indexOf(marker, searchStart)
            if (candidate < 0) {
                return -1
            }
            val atLineStart = candidate == 0 || content[candidate - 1] == '\n' || content[candidate - 1] == '\r'
            val body = content.substring(bodyStart, candidate).trim()
            if (atLineStart || isValidJson(body)) {
                return candidate
            }
            searchStart = candidate + marker.length
        }
        return -1
    }

    private fun isValidJson(value: String): Boolean {
        if (value.isEmpty()) {
            return false
        }
        return runCatching { json.parseToJsonElement(value) }.isSuccess
    }

    private fun headerAndBodyStart(content: String, languageEnd: Int): HeaderAndBodyStart? {
        if (languageEnd >= content.length) {
            return null
        }
        return when (content[languageEnd]) {
            '\n' -> HeaderAndBodyStart("", languageEnd + 1)
            '\r' -> if (languageEnd + 1 < content.length && content[languageEnd + 1] == '\n') HeaderAndBodyStart("", languageEnd + 2) else null
            '{', '[' -> HeaderAndBodyStart("", languageEnd)
            ' ', '\t' -> headerLine(content, languageEnd)
            else -> null
        }
    }

    private fun headerLine(content: String, start: Int): HeaderAndBodyStart? {
        var newline = start
        while (newline < content.length && content[newline] != '\n' && content[newline] != '\r') {
            newline++
        }
        if (newline == content.length) {
            return null
        }
        val bodyStart = when (content[newline]) {
            '\n' -> newline + 1
            '\r' -> if (newline + 1 < content.length && content[newline + 1] == '\n') newline + 2 else return null
            else -> return null
        }
        return HeaderAndBodyStart(content.substring(start, newline).trim(), bodyStart)
    }

    private fun isLanguageCharacter(value: Char): Boolean {
        return value.isLetterOrDigit() || value == '_' || value == '+' || value == '-'
    }

    private fun appendText(parts: MutableList<MarkdownFencePart>, value: String) {
        if (value.isEmpty()) {
            return
        }
        val previous = parts.lastOrNull()
        if (previous is MarkdownFencePart.Text) {
            parts[parts.lastIndex] = previous.copy(value = previous.value + value)
        } else {
            parts += MarkdownFencePart.Text(value)
        }
    }
}

/** Parses standard key=value attributes from a fence header without regexes. */
object MarkdownFenceHeader {
    fun attributes(header: String): Map<String, String> {
        val attributes = linkedMapOf<String, String>()
        var cursor = 0
        while (cursor < header.length) {
            while (cursor < header.length && header[cursor].isWhitespace()) cursor++
            val keyStart = cursor
            while (cursor < header.length && (header[cursor].isLetterOrDigit() || header[cursor] == '_' || header[cursor] == '-')) cursor++
            if (keyStart == cursor || cursor >= header.length || header[cursor] != '=') {
                return attributes
            }
            val key = header.substring(keyStart, cursor).lowercase()
            cursor++
            val valueStart = cursor
            val value = if (cursor < header.length && (header[cursor] == '\"' || header[cursor] == '\'')) {
                val quote = header[cursor++]
                val quotedStart = cursor
                while (cursor < header.length && header[cursor] != quote) cursor++
                if (cursor >= header.length) return attributes
                header.substring(quotedStart, cursor++)
            } else {
                while (cursor < header.length && !header[cursor].isWhitespace()) cursor++
                header.substring(valueStart, cursor)
            }
            attributes[key] = value
        }
        return attributes
    }
}

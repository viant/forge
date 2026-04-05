package com.viant.forgeandroid.agently.stream

import com.viant.forgeandroid.agently.Message
import com.viant.forgeandroid.agently.TurnState
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

internal fun firstString(vararg values: Any?): String {
    values.forEach { value ->
        val text = value?.toString()?.trim().orEmpty()
        if (text.isNotEmpty()) {
            return text
        }
    }
    return ""
}

internal fun firstNumber(vararg values: Any?): Int {
    values.forEach { value ->
        val num = when (value) {
            is Int -> value
            is Long -> value.toInt()
            is Number -> value.toInt()
            is String -> value.toIntOrNull()
            else -> null
        }
        if (num != null) {
            return num
        }
    }
    return 0
}

internal fun firstPositiveNumber(vararg values: Any?): Int {
    values.forEach { value ->
        val num = when (value) {
            is Int -> value
            is Long -> value.toInt()
            is Number -> value.toInt()
            is String -> value.toIntOrNull()
            else -> null
        }
        if (num != null && num > 0) {
            return num
        }
    }
    return 0
}

internal fun resolveEventConversationId(event: SSEEvent): String =
    firstString(event.conversationId, event.streamId)

internal fun resolveEventTurnId(event: SSEEvent): String =
    firstString(event.turnId)

internal fun resolveEventMessageId(event: SSEEvent): String =
    firstString(
        event.messageId,
        event.id,
        event.assistantMessageId,
        event.modelCallId,
        event.toolMessageId,
        event.streamId
    )

internal fun normalizeStreamEventIdentity(raw: SSEEvent, subscribedConversationId: String = ""): SSEEvent? {
    val subscribedId = subscribedConversationId.trim()
    val normalizedConversationId = resolveEventConversationId(raw).ifBlank { subscribedId }
    if (normalizedConversationId.isBlank()) {
        return null
    }
    if (subscribedId.isNotBlank() && normalizedConversationId != subscribedId) {
        return null
    }
    val normalizedTurnId = resolveEventTurnId(raw).ifBlank { null }
    val normalizedMessageId = resolveEventMessageId(raw).ifBlank { null }
    return raw.copy(
        conversationId = normalizedConversationId,
        streamId = raw.streamId ?: normalizedConversationId,
        turnId = normalizedTurnId,
        messageId = normalizedMessageId
    )
}

internal fun eventSequenceValue(event: SSEEvent, fallback: Int = 1): Int =
    firstPositiveNumber(event.pageIndex, event.iteration, event.eventSeq, fallback)

internal fun eventIterationValue(event: SSEEvent, fallback: Int = 0): Int =
    firstPositiveNumber(event.iteration, event.pageIndex, fallback)

internal fun terminalStatusForType(type: String): String {
    return when (type.trim().lowercase()) {
        "turn_failed" -> "failed"
        "turn_canceled" -> "canceled"
        else -> "completed"
    }
}

internal fun modelStepStatusForEvent(event: SSEEvent, existingStatus: String = "", fallbackStatus: String = "running"): String {
    val explicit = firstString(event.status)
    if (explicit.isNotEmpty()) return explicit
    return if (event.type.trim().lowercase() == "text_delta") "streaming" else firstString(fallbackStatus, existingStatus, "running")
}

internal fun executionGroupStatusForEvent(event: SSEEvent, existingStatus: String = "", fallbackStatus: String = "running"): String {
    val explicit = firstString(event.status)
    if (explicit.isNotEmpty()) return explicit
    if (event.type.trim().lowercase() == "text_delta") {
        val normalized = firstString(existingStatus).lowercase()
        if (normalized in setOf("completed", "done", "success", "succeeded", "failed", "error", "canceled", "cancelled", "terminated")) {
            return existingStatus
        }
        return "streaming"
    }
    return firstString(fallbackStatus, existingStatus, "running")
}

internal fun temporalSequenceValue(
    sequence: Int? = null,
    eventSeq: Int? = null,
    iteration: Int? = null,
): Int = firstNumber(sequence, eventSeq, iteration)

internal fun temporalTimeValue(createdAt: String?, updatedAt: String?): Long {
    val raw = firstString(createdAt, updatedAt)
    if (raw.isEmpty()) return 0L
    return kotlin.runCatching { java.time.Instant.parse(raw).toEpochMilli() }.getOrDefault(0L)
}

internal fun compareBufferedMessages(left: BufferedMessage, right: BufferedMessage): Int {
    val sameTurn = firstString(left.turnId).isNotEmpty() && firstString(left.turnId) == firstString(right.turnId)
    if (sameTurn) {
        val leftIsUser = firstString(left.role).lowercase() == "user"
        val rightIsUser = firstString(right.role).lowercase() == "user"
        if (leftIsUser != rightIsUser) return if (leftIsUser) -1 else 1
    }
    val leftTime = temporalTimeValue(left.createdAt, null)
    val rightTime = temporalTimeValue(right.createdAt, null)
    if (leftTime != rightTime) return leftTime.compareTo(rightTime)
    val leftSeq = temporalSequenceValue(left.sequence, null, null)
    val rightSeq = temporalSequenceValue(right.sequence, null, null)
    if (leftSeq != rightSeq) return leftSeq.compareTo(rightSeq)
    return left.id.compareTo(right.id)
}

internal fun compareExecutionGroups(left: LiveExecutionGroup, right: LiveExecutionGroup): Int {
    val leftSeq = temporalSequenceValue(left.sequence, null, left.iteration)
    val rightSeq = temporalSequenceValue(right.sequence, null, right.iteration)
    if (leftSeq != rightSeq) return leftSeq.compareTo(rightSeq)
    return firstString(left.assistantMessageId, left.pageId, left.parentMessageId)
        .compareTo(firstString(right.assistantMessageId, right.pageId, right.parentMessageId))
}

internal fun patchMessage(existing: BufferedMessage, patch: JsonObject?): BufferedMessage {
    if (patch == null) return existing
    val map = patch
    val patchedContent = map.stringValue("content")
    val normalizedContent = normalizePatchedAssistantContent(existing.content, patchedContent)
    return existing.copy(
        linkedConversationId = map.stringValue("linkedConversationId") ?: existing.linkedConversationId,
        status = map.stringValue("status") ?: existing.status,
        toolName = map.stringValue("toolName") ?: existing.toolName,
        preamble = map.stringValue("preamble") ?: existing.preamble,
        interim = map.stringValue("interim")?.toIntOrNull() ?: existing.interim,
        content = normalizedContent ?: existing.content
    )
}

internal fun normalizePatchedAssistantContent(existing: String?, incoming: String?): String? {
    val next = incoming?.trim()?.takeIf { it.isNotBlank() } ?: return incoming
    val current = existing?.trim()?.takeIf { it.isNotBlank() } ?: return collapseRepeatedContent(next)
    if (next == current) return current
    if (next.startsWith(current) && next.endsWith(current)) {
        return current
    }
    val collapsed = collapseRepeatedContent(next)
    return if (collapsed.length < next.length) collapsed else next
}

internal fun collapseRepeatedContent(text: String): String {
    val trimmed = text.trim()
    if (trimmed.length < 80) return trimmed
    val probe = trimmed.lineSequence()
        .map { it.trim() }
        .firstOrNull { it.isNotBlank() && !it.startsWith("```") }
        ?.take(72)
        ?: return trimmed
    val repeatAt = trimmed.indexOf(probe, startIndex = probe.length)
    if (repeatAt <= 0) return trimmed
    val suffix = trimmed.substring(repeatAt).trim()
    if (suffix.length < trimmed.length / 3) return trimmed
    return suffix
}

internal fun JsonObject.stringValue(key: String): String? = get(key)?.stringValue()

internal fun JsonElement.stringValue(): String? = runCatching { jsonPrimitive.content }.getOrNull()

internal fun bufferedFromMessage(message: Message): BufferedMessage {
    return BufferedMessage(
        id = message.id,
        conversationId = message.conversationId,
        turnId = message.turnId,
        role = firstString(message.role, "assistant"),
        type = firstString(message.type, "text"),
        content = message.content,
        status = message.status,
        createdAt = message.createdAt,
        linkedConversationId = message.linkedConversationId,
        toolName = message.toolName
    )
}

internal fun assistantMessagesFromTurns(turns: List<TurnState>): List<BufferedMessage> {
    val output = mutableListOf<BufferedMessage>()
    turns.forEach { turn ->
        val final = turn.assistant?.final
        if (final != null && final.messageId.isNotBlank()) {
            output.add(
                BufferedMessage(
                    id = final.messageId,
                    conversationId = null,
                    turnId = turn.turnId,
                    role = "assistant",
                    type = "text",
                    content = final.content,
                    preamble = turn.assistant.preamble?.content,
                    status = turn.status,
                    interim = if (turn.status.equals("completed", true)) 0 else 1,
                    createdAt = turn.createdAt
                )
            )
        }
    }
    return output
}

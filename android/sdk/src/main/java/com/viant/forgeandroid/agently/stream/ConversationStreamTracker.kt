package com.viant.forgeandroid.agently.stream

import com.viant.forgeandroid.agently.ActiveFeedState
import com.viant.forgeandroid.agently.ConversationStateResponse
import com.viant.forgeandroid.agently.Message
import com.viant.forgeandroid.agently.TurnState
import kotlinx.serialization.json.JsonObject

class FeedTracker {
    private val feedsById = linkedMapOf<String, ActiveFeed>()

    val feeds: List<ActiveFeed>
        get() = feedsById.values.toList()

    fun clear() {
        feedsById.clear()
    }

    fun applyEvent(event: SSEEvent) {
        when {
            event.type == "tool_feed_active" && !event.feedId.isNullOrBlank() -> {
                val feedId = event.feedId.trim()
                feedsById[feedId] = ActiveFeed(
                    feedId = feedId,
                    title = firstString(event.feedTitle, feedId),
                    itemCount = event.feedItemCount ?: 0,
                    conversationId = resolveEventConversationId(event).ifBlank { null },
                    turnId = resolveEventTurnId(event).ifBlank { null },
                    updatedAt = System.currentTimeMillis(),
                    data = event.feedData
                )
            }
            event.type == "tool_feed_inactive" && !event.feedId.isNullOrBlank() -> {
                feedsById.remove(event.feedId.trim())
            }
        }
    }
}

class ElicitationTracker {
    var pending: PendingElicitation? = null
        private set

    fun clear() {
        pending = null
    }

    fun applyEvent(event: SSEEvent) {
        when {
            event.type == "elicitation_requested" && !event.elicitationId.isNullOrBlank() -> {
                val data = event.elicitationData
                val requestedSchema = resolveRequestedSchema(data)
                pending = PendingElicitation(
                    elicitationId = event.elicitationId.trim(),
                    conversationId = resolveEventConversationId(event),
                    turnId = resolveEventTurnId(event).ifBlank { null },
                    message = event.content.orEmpty(),
                    requestedSchema = requestedSchema,
                    callbackURL = event.callbackUrl,
                    url = data?.get("url")?.toString()?.trim('"'),
                    mode = data?.get("mode")?.toString()?.trim('"')
                )
            }
            event.type == "elicitation_resolved" -> clear()
        }
    }

    private fun resolveRequestedSchema(data: JsonObject?): JsonObject? {
        if (data == null) return null
        val explicit = data["requestedSchema"]
        if (explicit is JsonObject) return explicit
        val schema = data["schema"]
        if (schema is JsonObject) return schema
        return data
    }
}

class ConversationStreamTracker(conversationId: String = "") {
    private val messages = MessageBuffer()
    private var executionGroupsById: MutableMap<String, LiveExecutionGroup> = linkedMapOf()
    private val feeds = FeedTracker()
    private val elicitation = ElicitationTracker()
    private var currentConversationId: String = conversationId.trim()

    val state: ConversationStreamSnapshot
        get() = snapshot()

    fun snapshot(): ConversationStreamSnapshot {
        return ConversationStreamSnapshot(
            conversationId = currentConversationId,
            activeTurnId = messages.activeTurnId,
            feeds = feeds.feeds,
            pendingElicitation = elicitation.pending,
            bufferedMessages = messages.byId.values.toList(),
            liveExecutionGroupsById = executionGroupsById.toMap()
        )
    }

    fun clear() {
        messages.byId.clear()
        messages.activeTurnId = null
        executionGroupsById = linkedMapOf()
        feeds.clear()
        elicitation.clear()
        currentConversationId = ""
    }

    fun applyEvent(event: SSEEvent): MessageUpdate? {
        val conversationId = resolveEventConversationId(event)
        if (conversationId.isNotBlank()) {
            currentConversationId = conversationId
        }
        executionGroupsById = applyExecutionStreamEventToGroups(executionGroupsById, event).toMutableMap()
        feeds.applyEvent(event)
        elicitation.applyEvent(event)
        return applyMessageEvent(messages, event)
    }

    fun reconcileTranscript(turns: List<TurnState>) {
        reconcileFromTranscript(messages, turns)
    }

    fun reconcile(serverMessages: List<Message>): List<BufferedMessage> {
        return reconcileMessages(messages, serverMessages)
    }

    fun hydrate(response: ConversationStateResponse) {
        response.conversation?.conversationId?.trim()?.takeIf { it.isNotEmpty() }?.let {
            currentConversationId = it
        }
        reconcileTranscript(response.conversation?.turns ?: emptyList())
        hydrateFeeds(response.feeds)
    }

    private fun hydrateFeeds(items: List<ActiveFeedState>) {
        feeds.clear()
        items.forEach { feed ->
            feeds.applyEvent(
                SSEEvent(
                    type = "tool_feed_active",
                    conversationId = currentConversationId,
                    feedId = feed.feedId,
                    feedTitle = feed.title,
                    feedItemCount = feed.itemCount,
                    feedData = feed.data
                )
            )
        }
    }
}

fun applyMessageEvent(buffer: MessageBuffer, event: SSEEvent): MessageUpdate? {
    val conversationId = resolveEventConversationId(event)
    val turnId = resolveEventTurnId(event)
    val normalizedType = event.type.trim().lowercase()

    if (normalizedType == "turn_started") {
        if (turnId.isNotBlank()) {
            buffer.activeTurnId = turnId
        }
        return null
    }
    if (normalizedType in setOf("turn_completed", "turn_failed", "turn_canceled")) {
        markTurnTerminal(buffer, turnId, terminalStatusForType(normalizedType))
        buffer.activeTurnId = null
    }
    if (normalizedType == "error") {
        buffer.activeTurnId = null
    }

    val key = resolveEventMessageId(event)
    if (key.isBlank()) return null

    return when (normalizedType) {
        "text_delta" -> {
            val existing = ensureMessageEntry(buffer, key, event, conversationId, turnId)
            val updated = existing.copy(content = (existing.content ?: "") + (event.content ?: ""))
            storeEntry(buffer, key, updated)
            if (turnId.isNotBlank()) buffer.activeTurnId = turnId
            MessageUpdate(key, updated.content.orEmpty(), final = false)
        }
        "reasoning_delta" -> {
            val existing = ensureMessageEntry(buffer, key, event, conversationId, turnId)
            storeEntry(buffer, key, existing.copy(preamble = (existing.preamble ?: "") + (event.content ?: "")))
            if (turnId.isNotBlank()) buffer.activeTurnId = turnId
            null
        }
        "model_started" -> {
            val existing = ensureMessageEntry(buffer, key, event, conversationId, turnId)
            storeEntry(buffer, key, existing.copy(status = firstString(event.status, existing.status, "running")))
            if (turnId.isNotBlank()) buffer.activeTurnId = turnId
            null
        }
        "model_completed" -> {
            val existing = ensureMessageEntry(buffer, key, event, conversationId, turnId)
            storeEntry(buffer, key, existing.copy(status = firstString(event.status, existing.status, "completed")))
            if (turnId.isNotBlank()) buffer.activeTurnId = turnId
            null
        }
        "assistant_preamble" -> {
            val existing = ensureMessageEntry(buffer, key, event, conversationId, turnId)
            val updated = existing.copy(
                preamble = firstString(event.content, event.preamble, existing.preamble),
                status = firstString(event.status, existing.status, "running")
            )
            storeEntry(buffer, key, updated)
            if (turnId.isNotBlank()) buffer.activeTurnId = turnId
            null
        }
        "assistant_final" -> {
            val existing = ensureMessageEntry(buffer, key, event, conversationId, turnId)
            val updated = existing.copy(
                content = firstString(event.content, existing.content),
                preamble = firstString(event.preamble, existing.preamble),
                status = firstString(event.status, existing.status, "completed"),
                interim = 0
            )
            storeEntry(buffer, key, updated)
            if (turnId.isNotBlank()) buffer.activeTurnId = turnId
            MessageUpdate(key, updated.content.orEmpty(), final = true)
        }
        "control" -> {
            if (event.op != "message_patch") return null
            val existing = ensureMessageEntry(buffer, key, event, conversationId, turnId)
            storeEntry(buffer, key, patchMessage(existing, event.patch))
            null
        }
        "turn_completed", "turn_failed", "turn_canceled" -> {
            val existing = buffer.byId[key] ?: return null
            val updated = existing.copy(interim = 0, status = terminalStatusForType(normalizedType))
            storeEntry(buffer, key, updated)
            MessageUpdate(key, updated.content.orEmpty(), final = true)
        }
        else -> null
    }
}

fun reconcileMessages(buffer: MessageBuffer, serverMessages: List<Message>): List<BufferedMessage> {
    val merged = linkedMapOf<String, BufferedMessage>()
    serverMessages.forEach { merged[it.id] = bufferedFromMessage(it) }
    buffer.byId.forEach { (id, partial) ->
        if (!merged.containsKey(id)) {
            merged[id] = partial
        }
    }
    return merged.values.sortedWith(Comparator(::compareBufferedMessages))
}

fun reconcileFromTranscript(buffer: MessageBuffer, turns: List<TurnState>) {
    assistantMessagesFromTurns(turns).forEach { buffer.byId[it.id] = it }
}

fun applyExecutionStreamEventToGroups(
    groupsById: LiveExecutionGroupsById = emptyMap(),
    event: SSEEvent
): LiveExecutionGroupsById {
    val next = groupsById.toMutableMap()
    val type = firstString(event.type).lowercase()
    val assistantMessageId = firstString(event.assistantMessageId, event.id)

    if (type == "model_started" && assistantMessageId.isNotBlank()) {
        next[assistantMessageId] = mergeExecutionGroup(next[assistantMessageId], createLiveExecutionGroup(event))
        return next
    }
    if ((type == "assistant_preamble" || type == "reasoning_delta") && assistantMessageId.isNotBlank()) {
        val current = ensureLiveExecutionGroup(next, assistantMessageId, event) ?: return next
        val preamble = if (type == "reasoning_delta") {
            "${firstString(current.preamble)}${firstString(event.content)}"
        } else {
            firstString(event.content, event.preamble, current.preamble)
        }
        next[assistantMessageId] = mergePrimaryModelStep(
            current.copy(
                turnId = firstString(event.turnId, current.turnId).ifBlank { null },
                sequence = eventSequenceValue(event, current.sequence ?: 1),
                iteration = eventIterationValue(event, current.iteration ?: 1),
                preamble = preamble,
                status = firstString(event.status, current.status, "running")
            ),
            event,
            firstString(event.status, current.status, "running")
        )
        return next
    }
    if ((type == "model_completed" || type == "text_delta") && assistantMessageId.isNotBlank()) {
        val current = ensureLiveExecutionGroup(next, assistantMessageId, event) ?: return next
        val content = if (type == "text_delta") {
            "${firstString(current.content)}${firstString(event.content)}"
        } else {
            firstString(event.content, current.content)
        }
        next[assistantMessageId] = mergePrimaryModelStep(
            current.copy(
                turnId = firstString(event.turnId, current.turnId).ifBlank { null },
                sequence = eventSequenceValue(event, current.sequence ?: 1),
                iteration = eventIterationValue(event, current.iteration ?: 1),
                content = content,
                preamble = firstString(event.preamble, current.preamble),
                errorMessage = firstString(event.error, current.errorMessage).ifBlank { null },
                status = executionGroupStatusForEvent(event, current.status.orEmpty(), current.status ?: "running"),
                finalResponse = event.finalResponse ?: current.finalResponse
            ),
            event,
            current.status ?: "running"
        )
        return next
    }
    if ((type == "tool_call_started" || type == "tool_call_completed" || type == "linked_conversation_attached") && assistantMessageId.isNotBlank()) {
        val current = ensureLiveExecutionGroup(next, assistantMessageId, event) ?: return next
        val updated = upsertToolStep(
            current.copy(
                turnId = firstString(event.turnId, current.turnId).ifBlank { null },
                status = firstString(event.status, current.status).ifBlank { current.status }
            ),
            event
        )
        next[assistantMessageId] = updated
        return next
    }
    if (type == "assistant_final" && assistantMessageId.isNotBlank()) {
        val current = ensureLiveExecutionGroup(next, assistantMessageId, event) ?: return next
        next[assistantMessageId] = mergePrimaryModelStep(
            current.copy(
                turnId = firstString(event.turnId, current.turnId).ifBlank { null },
                content = firstString(event.content, current.content),
                preamble = firstString(event.preamble, current.preamble),
                errorMessage = firstString(event.error, current.errorMessage).ifBlank { null },
                status = firstString(event.status, current.status, "completed"),
                finalResponse = true
            ),
            event,
            "completed"
        )
        return next
    }
    if (type in setOf("turn_completed", "turn_failed", "turn_canceled")) {
        val targetTurnId = firstString(event.turnId)
        val terminalStatus = firstString(event.status, terminalStatusForType(type))
        val terminalError = firstString(event.error)
        if (assistantMessageId.isNotBlank() && next[assistantMessageId] != null) {
            next[assistantMessageId] = applyTerminalState(next[assistantMessageId]!!, terminalStatus, terminalError)
            return next
        }
        if (targetTurnId.isNotBlank()) {
            next.replaceAll { _, value ->
                if (firstString(value.turnId) == targetTurnId) applyTerminalState(value, terminalStatus, terminalError) else value
            }
        }
    }
    return next
}

private fun ensureMessageEntry(
    buffer: MessageBuffer,
    key: String,
    event: SSEEvent,
    conversationId: String,
    turnId: String
): BufferedMessage {
    val existing = buffer.byId[key]
    if (existing != null) {
        return existing.copy(
            turnId = existing.turnId ?: turnId.ifBlank { null },
            conversationId = existing.conversationId ?: conversationId.ifBlank { null },
            createdAt = existing.createdAt ?: event.createdAt,
            sequence = maxOf(existing.sequence ?: 0, event.eventSeq ?: existing.sequence ?: 0).takeIf { it > 0 }
        )
    }
    return BufferedMessage(
        id = key,
        conversationId = conversationId.ifBlank { null },
        turnId = turnId.ifBlank { null },
        role = "assistant",
        type = "text",
        content = "",
        interim = 1,
        createdAt = event.createdAt,
        sequence = (event.eventSeq ?: 0).takeIf { it > 0 }
    )
}

private fun storeEntry(buffer: MessageBuffer, key: String, entry: BufferedMessage) {
    buffer.byId[key] = entry
}

private fun markTurnTerminal(buffer: MessageBuffer, turnId: String, terminalStatus: String) {
    if (turnId.isBlank()) return
    buffer.byId.replaceAll { _, entry ->
        if (firstString(entry.turnId) == turnId) entry.copy(interim = 0, status = terminalStatus) else entry
    }
}

private fun createLiveExecutionGroup(event: SSEEvent): LiveExecutionGroup {
    val assistantMessageId = firstString(event.assistantMessageId, event.id)
    return LiveExecutionGroup(
        pageId = assistantMessageId,
        assistantMessageId = assistantMessageId,
        turnId = firstString(event.turnId).ifBlank { null },
        parentMessageId = firstString(event.parentMessageId).ifBlank { null },
        sequence = eventSequenceValue(event, 1),
        iteration = eventIterationValue(event, 1),
        preamble = firstString(event.preamble).ifBlank { null },
        content = firstString(event.content).ifBlank { null },
        errorMessage = firstString(event.error).ifBlank { null },
        status = firstString(event.status, "running"),
        finalResponse = event.finalResponse ?: false,
        modelSteps = if (event.model != null) listOf(
            LiveModelStepState(
                modelCallId = assistantMessageId,
                provider = event.model.provider,
                model = event.model.model,
                status = firstString(event.status, "running"),
                requestPayloadId = event.requestPayloadId,
                responsePayloadId = event.responsePayloadId,
                providerRequestPayloadId = event.providerRequestPayloadId,
                providerResponsePayloadId = event.providerResponsePayloadId,
                streamPayloadId = event.streamPayloadId
            )
        ) else emptyList(),
        toolCallsPlanned = event.toolCallsPlanned,
        createdAt = event.createdAt,
        startedAt = event.startedAt,
        completedAt = event.completedAt
    )
}

private fun ensureLiveExecutionGroup(
    groupsById: MutableMap<String, LiveExecutionGroup>,
    assistantMessageId: String,
    event: SSEEvent
): LiveExecutionGroup? {
    return groupsById[assistantMessageId] ?: assistantMessageId.takeIf { it.isNotBlank() }?.let { createLiveExecutionGroup(event) }
}

private fun mergePrimaryModelStep(current: LiveExecutionGroup, event: SSEEvent, fallbackStatus: String): LiveExecutionGroup {
    val assistantMessageId = firstString(event.assistantMessageId, event.id)
    val existing = current.modelSteps.firstOrNull()
    return current.copy(
        modelSteps = listOf(
            LiveModelStepState(
                modelCallId = firstString(assistantMessageId, existing?.modelCallId),
                assistantMessageId = firstString(event.assistantMessageId, existing?.assistantMessageId).ifBlank { null },
                provider = firstString(event.model?.provider, existing?.provider).ifBlank { null },
                model = firstString(event.model?.model, existing?.model).ifBlank { null },
                status = modelStepStatusForEvent(event, existing?.status.orEmpty(), fallbackStatus),
                errorMessage = firstString(event.error, existing?.errorMessage).ifBlank { null },
                requestPayloadId = firstString(event.requestPayloadId, existing?.requestPayloadId).ifBlank { null },
                responsePayloadId = firstString(event.responsePayloadId, existing?.responsePayloadId).ifBlank { null },
                providerRequestPayloadId = firstString(event.providerRequestPayloadId, existing?.providerRequestPayloadId).ifBlank { null },
                providerResponsePayloadId = firstString(event.providerResponsePayloadId, existing?.providerResponsePayloadId).ifBlank { null },
                streamPayloadId = firstString(event.streamPayloadId, existing?.streamPayloadId).ifBlank { null }
            )
        )
    )
}

private fun upsertToolStep(current: LiveExecutionGroup, event: SSEEvent): LiveExecutionGroup {
    val key = firstString(event.toolCallId, event.toolMessageId, event.id, event.toolName)
    val toolSteps = current.toolSteps.toMutableList()
    val index = toolSteps.indexOfFirst { firstString(it.toolCallId, it.toolMessageId, it.toolName) == key }
    val newStep = LiveToolStepState(
        toolCallId = event.toolCallId,
        toolMessageId = firstString(event.toolMessageId, event.id).ifBlank { null },
        toolName = event.toolName,
        status = event.status,
        errorMessage = event.error,
        requestPayloadId = event.requestPayloadId,
        responsePayloadId = event.responsePayloadId,
        linkedConversationId = event.linkedConversationId,
        linkedConversationAgentId = event.linkedConversationAgentId,
        linkedConversationTitle = event.linkedConversationTitle
    )
    if (index >= 0) {
        toolSteps[index] = toolSteps[index].copy(
            toolCallId = firstString(newStep.toolCallId, toolSteps[index].toolCallId).ifBlank { null },
            toolMessageId = firstString(newStep.toolMessageId, toolSteps[index].toolMessageId).ifBlank { null },
            toolName = firstString(newStep.toolName, toolSteps[index].toolName).ifBlank { null },
            status = firstString(newStep.status, toolSteps[index].status).ifBlank { null },
            errorMessage = firstString(newStep.errorMessage, toolSteps[index].errorMessage).ifBlank { null },
            requestPayloadId = firstString(newStep.requestPayloadId, toolSteps[index].requestPayloadId).ifBlank { null },
            responsePayloadId = firstString(newStep.responsePayloadId, toolSteps[index].responsePayloadId).ifBlank { null },
            linkedConversationId = firstString(newStep.linkedConversationId, toolSteps[index].linkedConversationId).ifBlank { null },
            linkedConversationAgentId = firstString(newStep.linkedConversationAgentId, toolSteps[index].linkedConversationAgentId).ifBlank { null },
            linkedConversationTitle = firstString(newStep.linkedConversationTitle, toolSteps[index].linkedConversationTitle).ifBlank { null }
        )
    } else {
        toolSteps += newStep
    }
    return current.copy(toolSteps = toolSteps)
}

private fun mergeExecutionGroup(existing: LiveExecutionGroup?, incoming: LiveExecutionGroup): LiveExecutionGroup {
    if (existing == null) return incoming
    val toolStepsByKey = linkedMapOf<String, LiveToolStepState>()
    (existing.toolSteps + incoming.toolSteps).forEach { step ->
        val key = firstString(step.toolCallId, step.toolMessageId, step.toolName)
        if (key.isNotBlank()) {
            val prior = toolStepsByKey[key]
            toolStepsByKey[key] = if (prior == null) step else prior.copy(
                toolCallId = firstString(step.toolCallId, prior.toolCallId).ifBlank { null },
                toolMessageId = firstString(step.toolMessageId, prior.toolMessageId).ifBlank { null },
                toolName = firstString(step.toolName, prior.toolName).ifBlank { null },
                status = firstString(step.status, prior.status).ifBlank { null },
                errorMessage = firstString(step.errorMessage, prior.errorMessage).ifBlank { null },
                requestPayloadId = firstString(step.requestPayloadId, prior.requestPayloadId).ifBlank { null },
                responsePayloadId = firstString(step.responsePayloadId, prior.responsePayloadId).ifBlank { null },
                linkedConversationId = firstString(step.linkedConversationId, prior.linkedConversationId).ifBlank { null },
                linkedConversationAgentId = firstString(step.linkedConversationAgentId, prior.linkedConversationAgentId).ifBlank { null },
                linkedConversationTitle = firstString(step.linkedConversationTitle, prior.linkedConversationTitle).ifBlank { null }
            )
        }
    }
    return existing.copy(
        turnId = firstString(incoming.turnId, existing.turnId).ifBlank { null },
        parentMessageId = firstString(incoming.parentMessageId, existing.parentMessageId).ifBlank { null },
        sequence = firstNumber(incoming.sequence, existing.sequence).takeIf { it > 0 },
        iteration = firstNumber(incoming.iteration, existing.iteration).takeIf { it > 0 },
        preamble = firstString(incoming.preamble, existing.preamble).ifBlank { null },
        content = firstString(incoming.content, existing.content).ifBlank { null },
        errorMessage = firstString(incoming.errorMessage, existing.errorMessage).ifBlank { null },
        status = firstString(incoming.status, existing.status).ifBlank { null },
        finalResponse = incoming.finalResponse ?: existing.finalResponse,
        modelSteps = if (incoming.modelSteps.isNotEmpty()) incoming.modelSteps else existing.modelSteps,
        toolSteps = toolStepsByKey.values.toList(),
        toolCallsPlanned = if (incoming.toolCallsPlanned.isNotEmpty()) incoming.toolCallsPlanned else existing.toolCallsPlanned,
        createdAt = firstString(incoming.createdAt, existing.createdAt).ifBlank { null },
        startedAt = firstString(incoming.startedAt, existing.startedAt).ifBlank { null },
        completedAt = firstString(incoming.completedAt, existing.completedAt).ifBlank { null }
    )
}

private fun applyTerminalState(current: LiveExecutionGroup, terminalStatus: String, terminalError: String): LiveExecutionGroup {
    return current.copy(
        status = firstString(terminalStatus, current.status).ifBlank { null },
        errorMessage = firstString(terminalError, current.errorMessage).ifBlank { null },
        modelSteps = current.modelSteps.map { step ->
            step.copy(
                status = firstString(terminalStatus, step.status).ifBlank { null },
                errorMessage = firstString(terminalError, step.errorMessage).ifBlank { null }
            )
        },
        toolSteps = current.toolSteps.map { step ->
            step.copy(
                status = firstString(terminalStatus, step.status).ifBlank { null },
                errorMessage = firstString(terminalError, step.errorMessage).ifBlank { null }
            )
        }
    )
}

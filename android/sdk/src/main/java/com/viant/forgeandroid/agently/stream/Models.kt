package com.viant.forgeandroid.agently.stream

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

@Serializable
data class EventModel(
    val provider: String? = null,
    val model: String? = null,
    val kind: String? = null
)

@Serializable
data class PlannedToolCall(
    val toolCallId: String? = null,
    val toolName: String? = null
)

@Serializable
data class SSEEvent(
    val id: String? = null,
    val streamId: String? = null,
    val conversationId: String? = null,
    val turnId: String? = null,
    val messageId: String? = null,
    val eventSeq: Int? = null,
    val mode: String? = null,
    val agentIdUsed: String? = null,
    val agentName: String? = null,
    val assistantMessageId: String? = null,
    val parentMessageId: String? = null,
    val requestId: String? = null,
    val responseId: String? = null,
    val toolCallId: String? = null,
    val toolMessageId: String? = null,
    val requestPayloadId: String? = null,
    val responsePayloadId: String? = null,
    val providerRequestPayloadId: String? = null,
    val providerResponsePayloadId: String? = null,
    val streamPayloadId: String? = null,
    val linkedConversationId: String? = null,
    val linkedConversationAgentId: String? = null,
    val linkedConversationTitle: String? = null,
    val type: String,
    val op: String? = null,
    val patch: JsonObject? = null,
    val content: String? = null,
    val preamble: String? = null,
    val toolName: String? = null,
    val arguments: JsonObject? = null,
    val error: String? = null,
    val status: String? = null,
    val iteration: Int? = null,
    val pageIndex: Int? = null,
    val pageCount: Int? = null,
    val latestPage: Boolean? = null,
    val finalResponse: Boolean? = null,
    val model: EventModel? = null,
    val toolCallsPlanned: List<PlannedToolCall> = emptyList(),
    val createdAt: String? = null,
    val completedAt: String? = null,
    val startedAt: String? = null,
    val userMessageId: String? = null,
    val modelCallId: String? = null,
    val provider: String? = null,
    val modelName: String? = null,
    val elicitationId: String? = null,
    val elicitationData: JsonObject? = null,
    val callbackUrl: String? = null,
    val responsePayload: JsonObject? = null,
    val feedId: String? = null,
    val feedTitle: String? = null,
    val feedItemCount: Int? = null,
    val feedData: JsonElement? = null
)

data class ActiveFeed(
    val feedId: String,
    val title: String,
    val itemCount: Int,
    val conversationId: String? = null,
    val turnId: String? = null,
    val updatedAt: Long = System.currentTimeMillis(),
    val data: JsonElement? = null
)

data class PendingElicitation(
    val elicitationId: String,
    val conversationId: String,
    val turnId: String? = null,
    val message: String? = null,
    val requestedSchema: JsonObject? = null,
    val callbackURL: String? = null,
    val url: String? = null,
    val mode: String? = null
)

data class BufferedMessage(
    val id: String,
    val conversationId: String? = null,
    val turnId: String? = null,
    val role: String = "assistant",
    val type: String = "text",
    val content: String? = null,
    val preamble: String? = null,
    val status: String? = null,
    val interim: Int = 1,
    val createdAt: String? = null,
    val sequence: Int? = null,
    val linkedConversationId: String? = null,
    val toolName: String? = null
)

data class MessageBuffer(
    val byId: MutableMap<String, BufferedMessage> = linkedMapOf(),
    var activeTurnId: String? = null
)

data class LiveModelStepState(
    val modelCallId: String,
    val assistantMessageId: String? = null,
    val provider: String? = null,
    val model: String? = null,
    val status: String? = null,
    val errorMessage: String? = null,
    val requestPayloadId: String? = null,
    val responsePayloadId: String? = null,
    val providerRequestPayloadId: String? = null,
    val providerResponsePayloadId: String? = null,
    val streamPayloadId: String? = null
)

data class LiveToolStepState(
    val toolCallId: String? = null,
    val toolMessageId: String? = null,
    val toolName: String? = null,
    val status: String? = null,
    val errorMessage: String? = null,
    val requestPayloadId: String? = null,
    val responsePayloadId: String? = null,
    val linkedConversationId: String? = null,
    val linkedConversationAgentId: String? = null,
    val linkedConversationTitle: String? = null
)

data class LiveExecutionGroup(
    val pageId: String,
    val assistantMessageId: String,
    val turnId: String? = null,
    val parentMessageId: String? = null,
    val sequence: Int? = null,
    val iteration: Int? = null,
    val preamble: String? = null,
    val content: String? = null,
    val errorMessage: String? = null,
    val status: String? = null,
    val finalResponse: Boolean? = null,
    val modelSteps: List<LiveModelStepState> = emptyList(),
    val toolSteps: List<LiveToolStepState> = emptyList(),
    val toolCallsPlanned: List<PlannedToolCall> = emptyList(),
    val createdAt: String? = null,
    val startedAt: String? = null,
    val completedAt: String? = null
)

typealias LiveExecutionGroupsById = Map<String, LiveExecutionGroup>

data class ConversationStreamSnapshot(
    val conversationId: String,
    val activeTurnId: String?,
    val feeds: List<ActiveFeed>,
    val pendingElicitation: PendingElicitation?,
    val bufferedMessages: List<BufferedMessage>,
    val liveExecutionGroupsById: LiveExecutionGroupsById
)

data class MessageUpdate(
    val id: String,
    val content: String,
    val final: Boolean
)

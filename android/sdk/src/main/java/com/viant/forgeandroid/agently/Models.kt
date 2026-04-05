package com.viant.forgeandroid.agently

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class AuthProvider(
    val name: String,
    val label: String? = null,
    val type: String,
    val defaultUsername: String? = null,
    val clientID: String? = null,
    val discoveryURL: String? = null,
    val redirectURI: String? = null,
    val scopes: List<String> = emptyList(),
    val mode: String? = null
)

@Serializable
data class AuthUser(
    val subject: String? = null,
    val username: String? = null,
    val email: String? = null,
    val displayName: String? = null,
    val provider: String? = null,
    val preferences: JsonElement? = null
)

@Serializable
data class LocalLoginInput(
    val username: String
)

@Serializable
data class LocalLoginOutput(
    val sessionId: String,
    val username: String? = null,
    val provider: String? = null
)

@Serializable
data class OAuthInitiateOutput(
    val authURL: String? = null,
    val authUrl: String? = null,
    val state: String? = null,
    val provider: String? = null,
    val delegated: Boolean? = null,
    val status: String? = null,
    val message: String? = null
)

@Serializable
data class OAuthCallbackInput(
    val code: String,
    val state: String
)

@Serializable
data class OAuthCallbackOutput(
    val status: String,
    val username: String? = null,
    val provider: String? = null
)

@Serializable
data class OAuthConfigOutput(
    val status: String? = null,
    val message: String? = null,
    val mode: String? = null,
    val configURL: String? = null,
    val configUrl: String? = null,
    val clientId: String? = null,
    val discoveryUrl: String? = null,
    val redirectUri: String? = null,
    val scopes: List<String> = emptyList()
)

@Serializable
data class CreateSessionInput(
    val username: String? = null,
    val accessToken: String? = null,
    val idToken: String? = null,
    val refreshToken: String? = null
)

@Serializable
data class CreateSessionOutput(
    val sessionId: String,
    val username: String? = null
)

@Serializable
data class OOBLoginInput(
    val accessToken: String,
    val idToken: String? = null,
    val refreshToken: String? = null,
    val username: String? = null
)

@Serializable
data class OOBLoginOutput(
    val sessionId: String? = null,
    val status: String? = null,
    val username: String? = null,
    val provider: String? = null
)

@Serializable
data class IDPDelegateOutput(
    val mode: String? = null,
    val idpLogin: String? = null,
    val provider: String? = null,
    val authURL: String? = null,
    val state: String? = null,
    val expiresIn: Int? = null,
    val status: String? = null,
    val message: String? = null
)

@Serializable
data class WorkspaceMetadata(
    val workspaceRoot: String? = null,
    val defaultAgent: String? = null,
    val defaultModel: String? = null,
    val defaultEmbedder: String? = null,
    val defaults: WorkspaceDefaults? = null,
    val capabilities: WorkspaceCapabilities = WorkspaceCapabilities(),
    val agents: List<String> = emptyList(),
    val models: List<String> = emptyList(),
    val agentInfos: List<WorkspaceAgentInfo> = emptyList(),
    val modelInfos: List<WorkspaceModelInfo> = emptyList(),
    val version: String? = null
)

@Serializable
data class GetPayloadOptions(
    val raw: Boolean? = null,
    val meta: Boolean? = null,
    val inline: Boolean? = null
)

@Serializable
data class PayloadView(
    val id: String,
    val tenantId: String? = null,
    val kind: String? = null,
    val subtype: String? = null,
    val mimeType: String? = null,
    val sizeBytes: Long? = null,
    val digest: String? = null,
    val storage: String? = null,
    val inlineBody: String? = null,
    val uri: String? = null,
    val compression: String? = null,
    val encryptionKmsKeyId: String? = null,
    val redactionPolicyVersion: String? = null,
    val redacted: Int? = null,
    val createdAt: String? = null,
    val schemaRef: String? = null
)

@Serializable
data class WorkspaceFileEntry(
    val uri: String? = null,
    val url: String? = null,
    val name: String? = null,
    @SerialName("isDir")
    val isFolder: Boolean? = null,
    val size: Long? = null,
    @SerialName("modTime")
    val modifiedAt: String? = null,
    val childNodes: List<WorkspaceFileEntry> = emptyList()
)

@Serializable
data class GeneratedFileEntry(
    @SerialName("ID")
    val id: String,
    @SerialName("ConversationID")
    val conversationId: String? = null,
    @SerialName("TurnID")
    val turnId: String? = null,
    @SerialName("MessageID")
    val messageId: String? = null,
    @SerialName("Provider")
    val provider: String? = null,
    @SerialName("Mode")
    val mode: String? = null,
    @SerialName("CopyMode")
    val copyMode: String? = null,
    @SerialName("Status")
    val status: String? = null,
    @SerialName("PayloadID")
    val payloadId: String? = null,
    @SerialName("ContainerID")
    val containerId: String? = null,
    @SerialName("ProviderFileID")
    val providerFileId: String? = null,
    @SerialName("Filename")
    val filename: String? = null,
    @SerialName("MimeType")
    val mimeType: String? = null,
    @SerialName("SizeBytes")
    val sizeBytes: Int? = null,
    @SerialName("Checksum")
    val checksum: String? = null,
    @SerialName("ErrorMessage")
    val errorMessage: String? = null,
    @SerialName("ExpiresAt")
    val expiresAt: String? = null,
    @SerialName("CreatedAt")
    val createdAt: String? = null,
    @SerialName("UpdatedAt")
    val updatedAt: String? = null
)

@Serializable
data class WorkspaceDefaults(
    val agent: String? = null,
    val model: String? = null,
    val embedder: String? = null,
    val autoSelectTools: Boolean? = null
)

@Serializable
data class WorkspaceCapabilities(
    val agentAutoSelection: Boolean? = null,
    val modelAutoSelection: Boolean? = null,
    val toolAutoSelection: Boolean? = null,
    val compactConversation: Boolean? = null,
    val pruneConversation: Boolean? = null,
    val anonymousSession: Boolean? = null,
    val messageCursor: Boolean? = null,
    val structuredElicitation: Boolean? = null,
    val turnStartedEvent: Boolean? = null
)

@Serializable
data class WorkspaceAgentInfo(
    val id: String? = null,
    val name: String? = null,
    val modelRef: String? = null,
    val starterTasks: List<StarterTask> = emptyList()
)

@Serializable
data class StarterTask(
    val id: String? = null,
    val title: String? = null,
    val prompt: String? = null,
    val description: String? = null,
    val icon: String? = null
)

@Serializable
data class WorkspaceModelInfo(
    val id: String? = null,
    val name: String? = null
)

@Serializable
data class QueryInput(
    val conversationId: String? = null,
    val parentConversationId: String? = null,
    val conversationTitle: String? = null,
    val messageId: String? = null,
    val agentId: String? = null,
    val userId: String? = null,
    val query: String,
    val attachments: List<QueryAttachment> = emptyList(),
    val model: String? = null,
    val tools: List<String> = emptyList(),
    val toolBundles: List<String> = emptyList(),
    val autoSelectTools: Boolean? = null,
    val context: Map<String, JsonElement> = emptyMap(),
    val reasoningEffort: String? = null,
    val elicitationMode: String? = null,
    val autoSummarize: Boolean? = null,
    val disableChains: Boolean? = null,
    val allowedChains: List<String> = emptyList(),
    val toolCallExposure: String? = null
)

@Serializable
data class QueryAttachment(
    val name: String,
    val uri: String,
    val size: Long? = null,
    val mime: String? = null,
    val stagingFolder: String? = null
)

@Serializable
data class QueryOutput(
    val conversationId: String? = null,
    val content: String = "",
    val model: String? = null,
    val messageId: String? = null,
    val elicitation: JsonElement? = null,
    val plan: JsonElement? = null,
    val usage: UsageInfo? = null,
    val warnings: List<String> = emptyList()
)

@Serializable
data class UsageInfo(
    val promptTokens: Int? = null,
    val completionTokens: Int? = null,
    val totalTokens: Int? = null,
    val cost: Double? = null
)

@Serializable
data class Conversation(
    @SerialName("Id")
    val id: String,
    @SerialName("LastTurnId")
    val lastTurnId: String? = null,
    @SerialName("AgentId")
    val agentId: String? = null,
    @SerialName("Title")
    val title: String? = null,
    @SerialName("Summary")
    val summary: String? = null,
    @SerialName("Stage")
    val stage: String? = null,
    @SerialName("Visibility")
    val visibility: String? = null,
    @SerialName("Shareable")
    val shareable: Int? = null,
    @SerialName("ConversationParentId")
    val conversationParentId: String? = null,
    @SerialName("ConversationParentTurnId")
    val conversationParentTurnId: String? = null,
    @SerialName("CreatedAt")
    val createdAt: String? = null,
    @SerialName("LastActivity")
    val lastActivity: String? = null,
    @SerialName("CreatedByUserId")
    val createdByUserId: String? = null,
    @SerialName("UsageInputTokens")
    val promptTokens: Int? = null,
    @SerialName("UsageOutputTokens")
    val completionTokens: Int? = null,
    @SerialName("UsageEmbeddingTokens")
    val totalTokens: Int? = null,
    val cost: Double? = null
)

@Serializable
data class CreateConversationInput(
    val agentId: String? = null,
    val title: String? = null,
    val metadata: Map<String, JsonElement> = emptyMap(),
    val parentConversationId: String? = null,
    val parentTurnId: String? = null
)

@Serializable
data class UpdateConversationInput(
    val title: String? = null,
    val visibility: String? = null,
    val shareable: Boolean? = null
)

@Serializable
data class PageInput(
    val limit: Int? = null,
    val cursor: String? = null,
    val direction: String? = null
)

@Serializable
data class ConversationPage(
    val rows: List<Conversation> = emptyList(),
    val nextCursor: String? = null,
    val prevCursor: String? = null,
    val hasMore: Boolean = false
)

@Serializable
data class ListConversationsInput(
    val agentId: String? = null,
    val parentId: String? = null,
    val parentTurnId: String? = null,
    val excludeScheduled: Boolean? = null,
    @SerialName("q")
    val query: String? = null,
    val status: String? = null,
    val page: PageInput? = null
)

@Serializable
data class ListLinkedConversationsInput(
    val parentConversationId: String? = null,
    val parentTurnId: String? = null,
    val page: PageInput? = null
)

@Serializable
data class LinkedConversationEntry(
    val conversationId: String,
    val parentConversationId: String? = null,
    val parentTurnId: String? = null,
    val agentId: String? = null,
    val title: String? = null,
    val status: String? = null,
    val response: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

@Serializable
data class LinkedConversationPage(
    val rows: List<LinkedConversationEntry> = emptyList(),
    val nextCursor: String? = null,
    val prevCursor: String? = null,
    val hasMore: Boolean = false
)

@Serializable
data class Message(
    val id: String,
    val conversationId: String? = null,
    val turnId: String? = null,
    val role: String? = null,
    val type: String? = null,
    val content: String? = null,
    val rawContent: String? = null,
    val status: String? = null,
    val interim: Int? = null,
    val iteration: Int? = null,
    val preamble: String? = null,
    val phase: String? = null,
    val mode: String? = null,
    val sequence: Int? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val parentMessageId: String? = null,
    val linkedConversationId: String? = null,
    val toolName: String? = null
)

@Serializable
data class MessagePage(
    val rows: List<Message> = emptyList(),
    val nextCursor: String? = null,
    val prevCursor: String? = null,
    val hasMore: Boolean = false
)

@Serializable
data class GetMessagesInput(
    val conversationId: String,
    val turnId: String? = null,
    val roles: List<String> = emptyList(),
    val types: List<String> = emptyList(),
    val page: PageInput? = null
)

@Serializable
data class GetTranscriptInput(
    val conversationId: String,
    val since: String? = null,
    val includeModelCalls: Boolean? = null,
    val includeToolCalls: Boolean? = null,
    val includeFeeds: Boolean? = null
)

@Serializable
data class ListPendingElicitationsInput(
    val conversationId: String
)

@Serializable
data class PendingElicitationRecord(
    val conversationId: String,
    val elicitationId: String,
    val messageId: String,
    val status: String,
    val role: String,
    val type: String,
    val createdAt: String? = null,
    val content: String? = null,
    val elicitation: JsonElement? = null
)

@Serializable
data class ResolveElicitationInput(
    val conversationId: String,
    val elicitationId: String,
    val action: String,
    val payload: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class ListPendingToolApprovalsInput(
    val userId: String? = null,
    val conversationId: String? = null,
    val status: String? = null
)

@Serializable
data class PendingToolApproval(
    val id: String,
    val userId: String? = null,
    val conversationId: String? = null,
    val turnId: String? = null,
    val messageId: String? = null,
    val toolName: String,
    val title: String? = null,
    val arguments: JsonElement? = null,
    val metadata: JsonElement? = null,
    val status: String,
    val decision: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val errorMessage: String? = null
)

@Serializable
data class DecideToolApprovalInput(
    val id: String,
    val action: String,
    val userId: String? = null,
    val reason: String? = null,
    val note: String? = null,
    val editedFields: Map<String, JsonElement> = emptyMap(),
    val payload: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class DecideToolApprovalOutput(
    val status: String? = null
)

@Serializable
data class ResourceRef(
    val kind: String,
    val name: String
)

@Serializable
data class ListResourcesInput(
    val kind: String
)

@Serializable
data class ListResourcesOutput(
    val names: List<String> = emptyList()
)

@Serializable
data class ResourcePayload(
    val kind: String,
    val name: String,
    val data: String? = null
)

@Serializable
data class SaveResourceInput(
    val kind: String,
    val name: String,
    val data: String
)

@Serializable
data class ExportResourcesInput(
    val kinds: List<String> = emptyList()
)

@Serializable
data class ExportResourcesOutput(
    val resources: List<ResourcePayload> = emptyList()
)

@Serializable
data class ImportResourcesInput(
    val resources: List<ResourcePayload> = emptyList(),
    val replace: Boolean = false
)

@Serializable
data class ImportResourcesOutput(
    val imported: Int = 0,
    val skipped: Int = 0
)

@Serializable
data class Schedule(
    val id: String,
    val name: String,
    val description: String? = null,
    val createdByUserId: String? = null,
    val visibility: String? = null,
    val agentRef: String,
    val modelOverride: String? = null,
    val userCredUrl: String? = null,
    val enabled: Boolean = false,
    val startAt: String? = null,
    val endAt: String? = null,
    val scheduleType: String,
    val cronExpr: String? = null,
    val intervalSeconds: Int? = null,
    val timezone: String? = null,
    val timeoutSeconds: Int? = null,
    val taskPromptUri: String? = null,
    val taskPrompt: String? = null,
    val nextRunAt: String? = null,
    val lastRunAt: String? = null,
    val lastStatus: String? = null,
    val lastError: String? = null,
    val leaseOwner: String? = null,
    val leaseUntil: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

@Serializable
data class FileEntry(
    @SerialName("ID")
    val id: String,
    @SerialName("Name")
    val name: String? = null,
    @SerialName("ContentType")
    val contentType: String? = null,
    @SerialName("Size")
    val size: Long? = null
)

@Serializable
data class ListFilesInput(
    val conversationId: String
)

@Serializable
data class ListFilesOutput(
    @SerialName("Files")
    val files: List<FileEntry> = emptyList()
)

data class UploadFileInput(
    val conversationId: String,
    val name: String,
    val contentType: String? = null,
    val data: ByteArray
)

@Serializable
data class UploadFileOutput(
    @SerialName("ID")
    val id: String,
    @SerialName("URI")
    val uri: String
)

data class DownloadFileOutput(
    val name: String? = null,
    val contentType: String? = null,
    val data: ByteArray = byteArrayOf()
)

@Serializable
data class ToolDefinitionInfo(
    val name: String,
    val description: String? = null,
    val parameters: JsonElement? = null,
    val required: List<String> = emptyList(),
    @SerialName("output_schema")
    val outputSchema: JsonElement? = null
)

@Serializable
data class ExecuteToolInput(
    val name: String,
    val args: Map<String, JsonElement> = emptyMap()
)

@Serializable
data class AgentCard(
    val name: String,
    val title: String? = null,
    val version: String? = null,
    val description: String? = null,
    val endpoints: Map<String, String> = emptyMap(),
    val authentication: JsonElement? = null,
    val capabilities: AgentCapabilities? = null
)

@Serializable
data class AgentCapabilities(
    val streaming: Boolean? = null,
    val pushNotifications: Boolean? = null,
    val stateTransitionHistory: Boolean? = null
)

@Serializable
data class A2APart(
    val type: String,
    val text: String? = null,
    val uri: String? = null,
    val mimeType: String? = null,
    val data: JsonElement? = null
)

@Serializable
data class A2AMessage(
    val role: String,
    val parts: List<A2APart> = emptyList()
)

@Serializable
data class SendA2AMessageRequest(
    val messages: List<A2AMessage> = emptyList(),
    val message: A2AMessage? = null,
    val taskId: String? = null,
    val contextId: String? = null
)

@Serializable
data class A2ATaskStatus(
    val state: String,
    val message: A2APart? = null,
    val error: String? = null,
    val updatedAt: String? = null
)

@Serializable
data class A2AArtifact(
    val id: String,
    val createdAt: String? = null,
    val parts: List<A2APart> = emptyList()
)

@Serializable
data class A2ATask(
    val id: String,
    val contextId: String? = null,
    val status: A2ATaskStatus,
    val artifacts: List<A2AArtifact> = emptyList()
)

@Serializable
data class SendA2AMessageResponse(
    val task: A2ATask
)

@Serializable
data class ConversationStateResponse(
    val schemaVersion: String? = null,
    val conversation: ConversationState? = null,
    val feeds: List<ActiveFeedState> = emptyList(),
    val usage: UsageSummary? = null,
    val eventCursor: String? = null
)

@Serializable
data class ConversationState(
    val conversationId: String,
    val turns: List<TurnState> = emptyList(),
    val feeds: List<ActiveFeedState> = emptyList()
)

@Serializable
data class ActiveFeedState(
    val feedId: String,
    val title: String,
    val itemCount: Int,
    val data: JsonElement? = null
)

@Serializable
data class TurnState(
    val turnId: String,
    val status: String? = null,
    val user: UserMessageState? = null,
    val execution: ExecutionState? = null,
    val assistant: AssistantState? = null,
    val elicitation: ElicitationState? = null,
    val linkedConversations: List<LinkedConversationState> = emptyList(),
    val createdAt: String? = null,
    val queueSeq: Int? = null,
    val startedByMessageId: String? = null
)

@Serializable
data class UserMessageState(
    val messageId: String,
    val content: String? = null
)

@Serializable
data class AssistantState(
    val preamble: AssistantMessageState? = null,
    val final: AssistantMessageState? = null
)

@Serializable
data class AssistantMessageState(
    val messageId: String,
    val content: String? = null
)

@Serializable
data class ExecutionState(
    val pages: List<ExecutionPageState> = emptyList(),
    val activePageIndex: Int? = null,
    val totalElapsedMs: Long? = null
)

@Serializable
data class ExecutionPageState(
    val pageId: String,
    val assistantMessageId: String? = null,
    val parentMessageId: String? = null,
    val turnId: String? = null,
    val iteration: Int? = null,
    val mode: String? = null,
    val status: String? = null,
    val modelSteps: List<ModelStepState> = emptyList(),
    val toolSteps: List<ToolStepState> = emptyList(),
    val preambleMessageId: String? = null,
    val finalAssistantMessageId: String? = null,
    val preamble: String? = null,
    val content: String? = null,
    val finalResponse: Boolean? = null
)

@Serializable
data class ModelStepState(
    val modelCallId: String,
    val assistantMessageId: String? = null,
    val provider: String? = null,
    val model: String? = null,
    val status: String? = null,
    val requestPayloadId: String? = null,
    val responsePayloadId: String? = null,
    val providerRequestPayloadId: String? = null,
    val providerResponsePayloadId: String? = null,
    val streamPayloadId: String? = null,
    val requestPayload: JsonElement? = null,
    val responsePayload: JsonElement? = null,
    val providerRequestPayload: JsonElement? = null,
    val providerResponsePayload: JsonElement? = null,
    val streamPayload: JsonElement? = null,
    val startedAt: String? = null,
    val completedAt: String? = null
)

@Serializable
data class ToolStepState(
    val toolCallId: String,
    val toolMessageId: String? = null,
    val toolName: String,
    val status: String? = null,
    val requestPayloadId: String? = null,
    val responsePayloadId: String? = null,
    val requestPayload: JsonElement? = null,
    val responsePayload: JsonElement? = null,
    val linkedConversationId: String? = null,
    val linkedConversationAgentId: String? = null,
    val linkedConversationTitle: String? = null,
    val startedAt: String? = null,
    val completedAt: String? = null
)

@Serializable
data class ElicitationState(
    val elicitationId: String,
    val status: String? = null,
    val message: String? = null,
    val requestedSchema: JsonElement? = null,
    val callbackUrl: String? = null,
    val responsePayload: JsonElement? = null
)

@Serializable
data class LinkedConversationState(
    val conversationId: String,
    val parentConversationId: String? = null,
    val parentTurnId: String? = null,
    val toolCallId: String? = null,
    val agentId: String? = null,
    val title: String? = null,
    val status: String? = null,
    val response: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

@Serializable
data class UsageSummary(
    val totalInputTokens: Int? = null,
    val totalOutputTokens: Int? = null
)

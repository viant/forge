package com.viant.forgeandroid.runtime

import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.*
import java.util.concurrent.ConcurrentHashMap

/** Immutable authored document and admitted physical dataset requests, before report IO. */
data class NativeReportAdmission(
    val preparation: PreparedReportRequest,
    val conversationId: String,
    val stateKey: String,
    val document: JsonObject,
    val datasets: List<NativeReportDatasetAdmission>,
    val authoredConfiguration: JsonObject = JsonObject(emptyMap()),
    val authorState: JsonObject = preparation.state,
    val prefillIdentity:JsonObject=preparation.capturedPrefillIdentity ?: nativeReportPrefillIdentity(JsonObject(emptyMap()))
)
data class NativeReportAdmissionStatus(val identity: ReportPreparationIdentity, val status: String, val reason: String? = null)
data class NativeReportReadPermit(val uiRunRequestId: String, val datasetId: String)
data class PreparedReportFetchResult(val rows: JsonArray, val metrics: JsonObject, val error: String? = null)
data class NativeReportDatasetAdmission(val id: String, val dataSourceRef: String, val request: JsonObject)
data class NativeReportRunHandle(val reportRunId: String, val revision: Long, val uiRunRequestId: String, val admission: NativeReportAdmission, val contextRevision: Long = 0, val ownerId: String? = null)
data class NativeReportCompletedRun(val reportRunId: String, val revision: Long, val contextStatus: String = "active", val active: Boolean? = true, val activationError: String? = null,val verifiedDatasets:JsonArray?=null)
interface NativeReportLifecycleHandler {
    suspend fun begin(admission: NativeReportAdmission, uiRunRequestId: String, origin: String): NativeReportRunHandle
    suspend fun complete(handle: NativeReportRunHandle, rows: JsonObject, current: () -> Boolean): NativeReportCompletedRun
    suspend fun fail(handle: NativeReportRunHandle, code: String, text: String)
}

/** Host persistence is required for explicit runs; preview hydration does not create a run. */
class NativeReportLifecycle {
    private val preparationStatuses = ConcurrentHashMap<String, NativeReportAdmissionStatus>()
    private val admissions = ConcurrentHashMap<String, NativeReportAdmission>()
    private val runs = ConcurrentHashMap<String, CompletableDeferred<NativeReportRunHandle>>()
    private val runWindows = ConcurrentHashMap<String, String>()
    private val issued = ConcurrentHashMap<String, NativeReportRunHandle>()
    private val completed = ConcurrentHashMap<String, NativeReportCompletedRun>()
    private val completedDatasets = ConcurrentHashMap<String,JsonArray>()
    private val materializations = ConcurrentHashMap<String, Job>()
    private val mutex = Mutex()
    private var handler: NativeReportLifecycleHandler? = null
    fun closeWindow(windowId: String) {
        preparationStatuses.remove(windowId)
        admissions.remove(windowId)
        runWindows.entries.filter { it.value == windowId }.forEach { (requestId, _) ->
            materializations.remove(requestId)?.cancel()
            runWindows.remove(requestId); runs.remove(requestId); issued.remove(requestId); completed.remove(requestId);completedDatasets.remove(requestId)
        }
    }
    fun register(handler: NativeReportLifecycleHandler) { this.handler = handler }
    fun publish(admission: NativeReportAdmission) {
        admissions[admission.preparation.identity.windowId] = admission
        preparationStatuses[admission.preparation.identity.windowId] = NativeReportAdmissionStatus(admission.preparation.identity, "ready")
    }
    fun publishStatus(prepared: PreparedReportRequest, status: String, reason: String?) {
        preparationStatuses[prepared.identity.windowId] = NativeReportAdmissionStatus(prepared.identity, status, reason)
    }
    fun status(prepared: PreparedReportRequest?): NativeReportAdmissionStatus? = prepared?.let { packet ->
        preparationStatuses[packet.identity.windowId]?.takeIf { it.identity == packet.identity }
    }
    fun admission(windowId: String) = admissions[windowId]
    fun handle(uiRunRequestId: String) = issued[uiRunRequestId]
    fun completed(uiRunRequestId: String) = completed[uiRunRequestId]
    fun completedDatasets(uiRunRequestId:String)=completedDatasets[uiRunRequestId]
    suspend fun begin(windowId: String, uiRunRequestId: String, origin: String, expected: PreparedReportRequest, current: (PreparedReportRequest) -> Boolean): NativeReportRunHandle {
        val host = checkNotNull(handler) { "Durable native report persistence is unavailable." }
        val admission = checkNotNull(admission(windowId)) { status(expected)?.reason ?: "The authored report admission is not ready." }
        check(admission.preparation == expected && current(admission.preparation)) { "The authored report admission is stale." }
        validateNativeReportAdmission(admission)
        val (result, owner) = mutex.withLock {
            runs[uiRunRequestId]?.let { it to false } ?: CompletableDeferred<NativeReportRunHandle>().also { runs[uiRunRequestId] = it }.let { it to true }
        }
        if (owner) try {
            runWindows[uiRunRequestId] = windowId
            val handle = host.begin(admission, uiRunRequestId, origin)
            if (!current(admission.preparation)) {
                host.fail(handle, "stale_preparation", "Report preparation changed before data loading.")
                error("The authored report admission became stale.")
            }
            issued[uiRunRequestId] = handle
            result.complete(handle)
        } catch (error: Throwable) { result.completeExceptionally(error) }
        return result.await().also { check(it.admission == admission && current(it.admission.preparation)) { "The admitted report request no longer matches the current report." } }
    }
    suspend fun complete(handle: NativeReportRunHandle, rows: JsonObject, current: (PreparedReportRequest) -> Boolean): NativeReportCompletedRun {
        check(current(handle.admission.preparation)) { "The admitted report request is stale." }
        completed[handle.uiRunRequestId]?.let { return it }
        check(rows.keys == handle.admission.datasets.map { it.id }.toSet()) { "The completed report dataset identities do not match admission." }
        val result = checkNotNull(handler).complete(handle, rows) { current(handle.admission.preparation) }
        val saved=result.verifiedDatasets ?: JsonArray(handle.admission.datasets.map { dataset -> buildJsonObject { put("id",dataset.id);put("dataSourceRef",dataset.dataSourceRef);put("request",dataset.request);put("rows",rows.getValue(dataset.id)) } })
        completedDatasets[handle.uiRunRequestId]=nativeReportImmutableJson(saved) as JsonArray
        completed[handle.uiRunRequestId] = result
        check(current(handle.admission.preparation)) { "The admitted report request changed during persistence." }
        return result
    }
    fun canPreview(window: WindowContext): Boolean {
        val form = window.peekWindowForm()
        return JsonUtil.asStringMap(form["reportRunRequest"])["id"]?.toString().isNullOrBlank() &&
            JsonUtil.anyToElement(form["executeOnOpen"]) != JsonPrimitive(false) &&
            JsonUtil.asStringMap(form["reportMaterialization"])["status"]?.toString() != "completed"
    }
    fun canRead(context: DataSourceContext, input: InputState, current: (PreparedReportRequest) -> Boolean): Boolean {
        val form = context.window.peekWindowForm()
        val uiId = JsonUtil.asStringMap(form["reportRunRequest"])["id"]?.toString().orEmpty()
        val permit = input.preparedReadPermit
        if (uiId.isBlank()) return canPreview(context.window) && permit == null && context.instanceRef == context.dataSourceRef
        if (permit == null || permit.uiRunRequestId != uiId || completed[uiId] != null) return false
        val handle = issued[uiId] ?: return false
        if (!current(handle.admission.preparation)) return false
        val dataset = handle.admission.datasets.singleOrNull { it.id == permit.datasetId } ?: return false
        val instance = if (dataset.id == "primary") dataset.dataSourceRef else "reportDocument:${dataset.id}"
        return context.instanceRef == instance && context.dataSourceRef == dataset.dataSourceRef && JsonUtil.anyToElement(input.parameters) == dataset.request
    }
    fun start(scope: CoroutineScope, handle: NativeReportRunHandle, current: (PreparedReportRequest) -> Boolean,
        load: suspend (NativeReportDatasetAdmission) -> JsonArray,
        onRunning: () -> Unit, onCompleted: (NativeReportCompletedRun, JsonObject) -> Unit, onFailure: (String) -> Unit) {
        check(issued[handle.uiRunRequestId] == handle) { "The native report run is not admitted." }
        val task = scope.launch(start = CoroutineStart.LAZY) {
            try {
                check(current(handle.admission.preparation)) { "The admitted report is stale." }
                onRunning()
                val (result, rows) = loadAndComplete(handle, current, load)
                if (current(handle.admission.preparation)) onCompleted(result, rows)
            } catch (cancelled: CancellationException) {
                withContext(NonCancellable) { runCatching { fail(handle, "cancelled_or_stale", "Native report loading was cancelled or superseded.") } }
                if (current(handle.admission.preparation)) onFailure("Native report loading was cancelled.")
                throw cancelled
            } catch (error: Exception) {
                val message = error.message?.takeIf(String::isNotBlank) ?: "Native report persistence failed."
                runCatching { fail(handle, "native_report_failed", message) }
                if (current(handle.admission.preparation)) onFailure(message)
            }
        }
        if (materializations.putIfAbsent(handle.uiRunRequestId, task) == null) task.start() else task.cancel()
    }
    suspend fun loadAndComplete(handle: NativeReportRunHandle, current: (PreparedReportRequest) -> Boolean,
        load: suspend (NativeReportDatasetAdmission) -> JsonArray): Pair<NativeReportCompletedRun, JsonObject> {
        validateNativeReportAdmission(handle.admission)
        val rows = linkedMapOf<String, JsonElement>()
        for (dataset in handle.admission.datasets) {
            check(current(handle.admission.preparation)) { "The admitted report changed before data loading." }
            val actual = load(dataset)
            check(current(handle.admission.preparation)) { "The admitted report changed while loading data." }
            rows[dataset.id] = actual
        }
        val filled = JsonObject(rows)
        return complete(handle, filled, current) to filled
    }
    suspend fun fail(handle: NativeReportRunHandle, code: String, text: String) { if (completed[handle.uiRunRequestId] == null) checkNotNull(handler).fail(handle, code, text) }
}

fun validateNativeReportAdmission(admission: NativeReportAdmission) {
    val prepared = admission.preparation
    check(prepared.capturedAuthorState==null || prepared.capturedAuthorState==admission.authorState) { "The raw author state differs from the captured preparation." }
    check(prepared.capturedPrefillIdentity==null || prepared.capturedPrefillIdentity==admission.prefillIdentity) { "The prefill identity differs from the captured preparation." }
    val gate = preparedReportPrimaryGate(prepared.identity, prepared)
    check(gate.status == "ready") { "The authored report request is not ready: ${gate.reason ?: gate.status}" }
    val refs = linkedSetOf<String>()
    fun referenced(value: JsonElement) {
        when (value) {
            is JsonObject -> { (value["datasetRef"] as? JsonPrimitive)?.content?.trim()?.takeIf(String::isNotEmpty)?.let(refs::add); value.values.forEach(::referenced) }
            is JsonArray -> value.forEach(::referenced)
            else -> Unit
        }
    }
    referenced(admission.document)
    check(admission.datasets.size == admission.datasets.map { it.id }.toSet().size && refs == admission.datasets.map { it.id }.toSet()) { "The report dataset identities do not match its authored document." }
    val scoped = (prepared.state["reportDatasetScopeParams"] ?: prepared.state["datasetScopeParams"]) as? JsonObject
    admission.datasets.forEach { dataset ->
        if (dataset.id == "primary") check(dataset.dataSourceRef == prepared.dataSourceRef && dataset.request == prepared.primaryRequest) { "The primary dataset differs from admission." }
        else {
            val source = prepared.publishedSources.singleOrNull { it.id == dataset.id } ?: error("The published report dataset is unavailable or ambiguous.")
            val plan = preparePublishedReportRequest(prepared.identity, prepared, source, scoped)
            check(plan.status == "ready" && source.dataSourceRef == dataset.dataSourceRef && plan.request == dataset.request) { "The published dataset differs from its prepared request." }
        }
    }
}

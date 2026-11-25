package com.viant.forgeandroid.runtime

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.dropWhile
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import java.util.UUID

enum class MutationCommandPhase { Idle, Validating, Confirming, Pending, Succeeded, Failed, Indeterminate }
enum class MutationWriterStatus { Idle, NotInvoked, Pending, Succeeded, Failed, Indeterminate }
enum class MutationSyncStatus { NotStarted, Succeeded, PartialFailure }

data class MutationCommandWarning(
    val stage: String,
    val dataSourceRef: String? = null,
    val message: String
)

data class MutationCommandState(
    val phase: MutationCommandPhase = MutationCommandPhase.Idle,
    val guarded: Boolean = false,
    val pending: Boolean = false,
    val retryAllowed: Boolean = true,
    val error: String? = null,
    val message: String = "",
    val invocationId: String = "",
    val writerStatus: MutationWriterStatus = MutationWriterStatus.Idle,
    val syncStatus: MutationSyncStatus = MutationSyncStatus.NotStarted,
    val warnings: List<MutationCommandWarning> = emptyList()
)

data class MutationCommandResult(
    val accepted: Boolean,
    val status: String,
    val invocationId: String = "",
    val error: String? = null,
    val warnings: List<MutationCommandWarning> = emptyList(),
    val cause: Throwable? = null
)

private sealed interface MutationWriterOutcome {
    data class Succeeded(val records: JsonArray? = null) : MutationWriterOutcome
    data class Indeterminate(val cause: Throwable? = null) : MutationWriterOutcome
    data class Failed(val message: String, val cause: Throwable? = null) : MutationWriterOutcome
}

class MutationCommandRuntime {
    private val mutex = Mutex()
    private val states = mutableMapOf<String, MutationCommandState>()
    private val commandGuards = mutableMapOf<String, String?>()
    private val activeGroups = mutableSetOf<String>()
    private val transportGuards = mutableSetOf<String>()

    suspend fun state(windowId: String, command: MutationCommandDef): MutationCommandState =
        mutex.withLock { states[commandKey(windowId, command)] ?: MutationCommandState() }

    suspend fun resolveIndeterminate(windowId: String, command: MutationCommandDef, message: String = ""): Boolean {
        val key = commandKey(windowId, command)
        return mutex.withLock {
            if (states[key]?.phase != MutationCommandPhase.Indeterminate) return@withLock false
            commandGuards.remove(key)?.let(activeGroups::remove)
            transportGuards.remove(transportKey(windowId, command.dataSourceRef))
            states[key] = MutationCommandState(message = message)
            true
        }
    }

    suspend fun execute(
        runtime: ForgeRuntime,
        window: WindowContext,
        source: DataSourceContext,
        command: MutationCommandDef,
        extras: Map<String, Any?> = emptyMap(),
        confirm: (suspend (String) -> Boolean)? = null
    ): MutationCommandResult {
        val targetRef = command.dataSourceRef.trim()
        val key = commandKey(window.windowId, command)
        val group = command.serializationGroup?.trim()?.takeIf(String::isNotEmpty)?.let { "${window.windowId}::$it" }
        val acquired = mutex.withLock {
            if (targetRef.isEmpty() || key in commandGuards || group in activeGroups) false
            else {
                commandGuards[key] = group
                group?.let(activeGroups::add)
                states[key] = MutationCommandState(
                    phase = MutationCommandPhase.Validating,
                    guarded = true,
                    retryAllowed = false,
                    message = "Validating…",
                    writerStatus = MutationWriterStatus.NotInvoked
                )
                true
            }
        }
        if (!acquired) return MutationCommandResult(false, "suppressed")

        val admitted = window.metadata.peek()?.authorizationSnapshot.orEmpty()
        fun authorized() = window.metadata.peek()?.authorizationSnapshot == admitted && predicateAllows(source, command.validateWhen)
        if (!authorized()) {
            val message = command.invalidMessage ?: "This action is not currently valid."
            applyWindowState(runtime, window.windowId, command.errorState)
            releaseCommand(key, MutationCommandState(
                phase = MutationCommandPhase.Failed,
                error = message,
                message = message,
                writerStatus = MutationWriterStatus.NotInvoked
            ))
            return MutationCommandResult(false, "invalid", error = message)
        }
        val timeout = (command.timeoutMs ?: 30_000).coerceAtLeast(1_000).toLong()
        val parameters = try {
            val resolved = ParameterResolver().resolve(command.parameters, source)
            val envelope = resolved.inbound[targetRef] ?: resolved.inbound[""] ?: emptyMap()
            val base = mutationTargetParameters(envelope)
            // The isolated script engine has no synchronous callback into Kotlin. Capture only
            // this window's attached contexts, and share the capture across hooks in this phase.
            fun capture() = runtime.actionSnapshots(runtime.registeredWindowDataSources(window.windowId) + (source.dataSourceRef to source))
            val initialSources by lazy { capture() }
            val prepared = withTimeoutOrNull(timeout) {
                deepMerge(base, preparePayload(window, source, command.payload, extras) { initialSources })
            } ?: error("Command payload preparation timed out. The writer was not invoked.")
            val confirmation = resolveConfirmation(command, extras)
            if (confirmation.isNotBlank()) {
                if (confirm == null) {
                    val message = "Confirmation is required but no confirmation service is available."
                    releaseCommand(key, MutationCommandState(
                        phase = MutationCommandPhase.Failed,
                        error = message,
                        message = message,
                        writerStatus = MutationWriterStatus.NotInvoked
                    ))
                    return MutationCommandResult(false, "confirmation_unavailable", error = message)
                }
                publish(key, MutationCommandState(
                    phase = MutationCommandPhase.Confirming,
                    guarded = true,
                    retryAllowed = false,
                    message = confirmation,
                    writerStatus = MutationWriterStatus.NotInvoked
                ))
                if (!confirm(confirmation)) {
                    releaseCommand(key, MutationCommandState(writerStatus = MutationWriterStatus.NotInvoked))
                    return MutationCommandResult(false, "cancelled")
                }
            }

            check(authorized()) { "Authorization or command eligibility changed before dispatch." }
            val hook = command.prepare
            if (hook.isNullOrBlank()) prepared.toMutableMap() else {
                val preparedByHook = withTimeoutOrNull(timeout) {
                    val result = invokePreparation(window, source, hook, JsonObject(mapOf(
                        "parameters" to JsonUtil.anyToElement(prepared), "extras" to JsonUtil.anyToElement(extras)
                    )), if (confirmation.isBlank()) initialSources else capture())
                    require(result is JsonObject) { "Command preparation must return a parameter map." }
                    JsonUtil.asStringMap(JsonUtil.elementToAny(result)).toMutableMap()
                } ?: error("Command preparation timed out. The writer was not invoked.")
                check(authorized()) { "Authorization or command eligibility changed before dispatch." }
                preparedByHook
            }
        } catch (cancelled: CancellationException) {
            withContext(NonCancellable) { releaseCommand(key, MutationCommandState(writerStatus = MutationWriterStatus.NotInvoked)) }
            throw cancelled
        } catch (error: Exception) {
            val message = error.message ?: "Invalid command preparation."
            if (window.metadata.peek()?.authorizationSnapshot == admitted) applyWindowState(runtime, window.windowId, command.errorState)
            releaseCommand(key, MutationCommandState(phase = MutationCommandPhase.Failed, error = message, message = message, writerStatus = MutationWriterStatus.NotInvoked))
            return MutationCommandResult(false, "invalid_payload", error = message, cause = error)
        }
        val target = window.contextOrNull(targetRef)
        if (target == null) {
            val message = "Command datasource is unavailable: $targetRef"
            releaseCommand(key, MutationCommandState(
                phase = MutationCommandPhase.Failed,
                error = message,
                message = message,
                writerStatus = MutationWriterStatus.NotInvoked
            ))
            return MutationCommandResult(false, "failed", error = message)
        }
        val transport = transportKey(window.windowId, targetRef)
        val transportAcquired = mutex.withLock {
            if (transport in transportGuards) false else {
                transportGuards += transport
                true
            }
        }
        if (!transportAcquired) {
            val message = "Another command is using this datasource."
            releaseCommand(key, MutationCommandState(message = message, writerStatus = MutationWriterStatus.NotInvoked))
            return MutationCommandResult(false, "transport_busy", error = message)
        }

        if (!authorized()) {
            val message = "Authorization or command eligibility changed before dispatch."
            finishTransport(transport, key, MutationCommandState(phase = MutationCommandPhase.Failed, message = message,
                error = message, writerStatus = MutationWriterStatus.NotInvoked))
            return MutationCommandResult(false, "invalid", error = message)
        }
        val invocationId = UUID.randomUUID().toString()
        command.invocationParameter?.trim()?.takeIf(String::isNotEmpty)?.let { parameters[it] = invocationId }
        applyWindowState(runtime, window.windowId, command.pendingState)
        publish(key, MutationCommandState(
            phase = MutationCommandPhase.Pending,
            guarded = true,
            pending = true,
            retryAllowed = false,
            message = "Saving…",
            invocationId = invocationId,
            writerStatus = MutationWriterStatus.Pending
        ))
        val writer = try {
            val receipt = withTimeoutOrNull(timeout) { target.fetchCommandResult(parameters) }
            when {
                receipt == null -> MutationWriterOutcome.Indeterminate()
                receipt.cause is java.net.SocketTimeoutException || receipt.cause is java.util.concurrent.TimeoutException ->
                    MutationWriterOutcome.Indeterminate(receipt.cause)
                receipt.error != null -> MutationWriterOutcome.Failed(receipt.error, receipt.cause)
                else -> MutationWriterOutcome.Succeeded(receipt.rows)
            }
        } catch (cancelled: CancellationException) {
            withContext(NonCancellable) {
                publish(key, MutationCommandState(phase = MutationCommandPhase.Indeterminate, guarded = true,
                    retryAllowed = false, invocationId = invocationId, writerStatus = MutationWriterStatus.Indeterminate,
                    message = "Command was cancelled after dispatch. Verify its outcome."))
                if (window.metadata.peek()?.authorizationSnapshot == admitted) applyWindowState(runtime, window.windowId, command.indeterminateState)
            }
            throw cancelled
        } catch (error: Exception) {
            // Dispatch has started and its completion receipt is unavailable.
            MutationWriterOutcome.Indeterminate(error)
        }
        if (window.metadata.peek()?.authorizationSnapshot != admitted) {
            val message = "Authorization context changed after dispatch. Verify the outcome."
            publish(key, MutationCommandState(phase = MutationCommandPhase.Indeterminate, guarded = true, retryAllowed = false,
                message = message, invocationId = invocationId, writerStatus = MutationWriterStatus.Indeterminate))
            return MutationCommandResult(true, "indeterminate", invocationId, message)
        }
        return when (writer) {
            is MutationWriterOutcome.Failed -> {
                applyWindowState(runtime, window.windowId, command.errorState)
                finishTransport(transport, key, MutationCommandState(
                    phase = MutationCommandPhase.Failed,
                    error = writer.message,
                    message = writer.message,
                    invocationId = invocationId,
                    writerStatus = MutationWriterStatus.Failed
                ))
                MutationCommandResult(true, "failed", invocationId, writer.message, cause = writer.cause)
            }
            is MutationWriterOutcome.Indeterminate -> {
                applyWindowState(runtime, window.windowId, command.indeterminateState)
                val message = "The writer outcome is unknown because the client stopped waiting."
                publish(key, MutationCommandState(
                    phase = MutationCommandPhase.Indeterminate,
                    guarded = true,
                    retryAllowed = false,
                    message = message,
                    invocationId = invocationId,
                    writerStatus = MutationWriterStatus.Indeterminate
                ))
                MutationCommandResult(true, "indeterminate", invocationId, cause = writer.cause)
            }
            is MutationWriterOutcome.Succeeded -> {
                val warnings = mutableListOf<MutationCommandWarning>()
                val patch = command.successState.toMutableMap()
                for ((field, selectors) in command.resultState) {
                    val value = selectors.firstNotNullOfOrNull { SelectorUtil.resolve(writer.records, it) as? JsonElement }
                    if (value == null) warnings += MutationCommandWarning("resultState", message = "Writer receipt omitted the value for $field.")
                    patch[field] = value ?: JsonNull
                }
                applyWindowState(runtime, window.windowId, JsonObject(patch))
                try {
                    warnings += synchronize(window, target, command) { window.metadata.peek()?.authorizationSnapshot == admitted }
                } catch (cancelled: CancellationException) {
                    withContext(NonCancellable) { finishTransport(transport, key, MutationCommandState(
                        phase = MutationCommandPhase.Succeeded, invocationId = invocationId, writerStatus = MutationWriterStatus.Succeeded,
                        syncStatus = MutationSyncStatus.PartialFailure, message = "Saved. Refresh was cancelled.")) }
                    throw cancelled
                }
                val sync = if (warnings.isEmpty()) MutationSyncStatus.Succeeded else MutationSyncStatus.PartialFailure
                val message = if (warnings.isEmpty()) "Completed" else "Saved. Some related data could not be refreshed."
                finishTransport(transport, key, MutationCommandState(
                    phase = MutationCommandPhase.Succeeded,
                    message = message,
                    invocationId = invocationId,
                    writerStatus = MutationWriterStatus.Succeeded,
                    syncStatus = sync,
                    warnings = warnings
                ))
                MutationCommandResult(true, "succeeded", invocationId, warnings = warnings)
            }
        }
    }

    fun resolveConfirmation(command: MutationCommandDef, extras: Map<String, Any?>): String {
        val spec = command.confirmSelection ?: return command.confirm.orEmpty()
        val rows = (extras["selectedRows"] as? List<*>)?.map(JsonUtil::asStringMap).orEmpty()
        if (rows.isEmpty()) return command.confirm.orEmpty()
        val count = rows.size
        val maxItems = (spec.maxItems ?: 5).coerceIn(1, 20)
        val labelField = spec.labelField ?: "name"
        val identityField = spec.identityField ?: "id"
        val items = rows.take(maxItems).map { row ->
            val label = SelectorUtil.resolve(row, labelField)?.toString()?.trim().orEmpty()
            val identity = SelectorUtil.resolve(row, identityField)?.toString()?.trim().orEmpty()
            when { label.isNotEmpty() && identity.isNotEmpty() -> "$label ($identity)"; label.isNotEmpty() -> label; identity.isNotEmpty() -> identity; else -> "Unnamed item" }
        }.toMutableList()
        if (count > maxItems) items += "+${count - maxItems} more"
        val action = spec.action?.trim().orEmpty().ifBlank { "Confirm" }
        val singular = spec.singularLabel?.trim().orEmpty().ifBlank { "item" }
        val entity = if (count == 1) singular else spec.pluralLabel?.trim().orEmpty().ifBlank { "${singular}s" }
        val suffix = spec.suffix?.trim().orEmpty()
        return "$action $count $entity: ${items.joinToString(", ")}?${if (suffix.isEmpty()) "" else " $suffix"}"
    }

    private suspend fun awaitWriter(target: DataSourceContext, timeoutMs: Int): MutationWriterOutcome = coroutineScope {
        val terminal = async(start = CoroutineStart.UNDISPATCHED) {
            target.control.flow
                .dropWhile { !it.loading }
                .first { !it.loading }
        }
        target.fetchCollection()
        val control = withTimeoutOrNull(timeoutMs.toLong()) { terminal.await() }
        if (control == null) {
            terminal.cancel()
            MutationWriterOutcome.Indeterminate()
        } else if (!control.error.isNullOrBlank()) {
            MutationWriterOutcome.Failed(control.error)
        } else {
            MutationWriterOutcome.Succeeded()
        }
    }

    private suspend fun invokePreparation(window: WindowContext, source: DataSourceContext,
        handler: String, props: JsonObject, snapshots: JsonObject): JsonElement? {
        val metadata = window.metadata.peek() ?: error("Window metadata is unavailable.")
        val code = metadata.actions?.code?.takeIf { it.isNotBlank() } ?: error("Command preparation handler is unavailable: $handler")
        return UIActionProjection.invoke(code, handler, metadata.actionNamespace(handler), source.dataSourceRef, snapshots,
            JsonUtil.anyToElement(window.peekWindowForm()) as JsonObject, props, JsonObject(metadata.authorizationSnapshot), readOnly = true, windowKey = metadata.windowKey).result
    }

    private suspend fun preparePayload(window: WindowContext, source: DataSourceContext,
        payload: ResourcePayloadPreparationDef?, extras: Map<String, Any?>, hookSources: () -> JsonObject): Map<String, Any?> {
        if (payload == null) return extras
        val metadata = window.metadata.peek() ?: error("Window metadata is unavailable")
        val refs = (payload.fields.values + listOfNotNull(payload.source, payload.baseline)).mapNotNull { it.dataSourceRef }.toSet() + source.dataSourceRef
        val snapshots = refs.associateWith { ref ->
            val ctx = if (ref == source.dataSourceRef) source else window.contextOrNull(ref)
            ResourceDataSnapshot(ctx?.form?.peek().orEmpty(), ctx?.collection?.peek().orEmpty(), ctx?.selection?.peek() ?: SelectionState(),
                ctx?.metrics?.peek().orEmpty(), ctx?.input?.peek() ?: InputState())
        }
        return ResourceModelRuntime.prepareScoped(payload, ResourceValueEnvironment(source.dataSourceRef, snapshots, window.peekWindowForm(), extras),
            metadata.schemas, metadata.resourceModels, null) { name, phase, ref, value, baseline ->
            val model = metadata.resourceModels.getValue(ref)
            val props = JsonObject(mapOf("value" to JsonUtil.anyToElement(value), "baseline" to JsonUtil.anyToElement(baseline),
                "phase" to JsonUtil.anyToElement(phase), "modelRef" to JsonUtil.anyToElement(ref),
                "model" to JsonUtil.json.encodeToJsonElement(ResourceModelDef.serializer(), model),
                "schema" to JsonUtil.json.encodeToJsonElement(ResourceSchemaDef.serializer(), metadata.schemas.getValue(model.schemaRef))))
            invokePreparation(window, source, name, props, hookSources())?.let(JsonUtil::elementToAny)
        }
    }

    private suspend fun synchronize(
        window: WindowContext,
        target: DataSourceContext,
        command: MutationCommandDef,
        current: () -> Boolean
    ): List<MutationCommandWarning> {
        val warnings = mutableListOf<MutationCommandWarning>()
        if (!current()) return listOf(MutationCommandWarning("authorization", message = "Authorization changed before synchronization."))
        command.reconcile?.let { spec ->
            runCatching {
                val destinationRef = spec.dataSourceRef?.trim().orEmpty().ifBlank { target.dataSourceRef }
                val destination = window.contextOrNull(destinationRef)
                    ?: error("Reconciliation datasource is unavailable: $destinationRef")
                if (spec.mode.equals("refetch", ignoreCase = true)) {
                    awaitRefresh(destination)
                } else {
                    val incoming = mutationResultRows(target.collection.peek(), spec.resultPath ?: spec.rowsPath)
                    destination.collection.set(reconcileRows(destination.collection.peek(), incoming, spec))
                }
            }.onFailure {
                if (it is CancellationException) throw it
                warnings += MutationCommandWarning("reconcile", spec.dataSourceRef, it.message ?: "Reconciliation failed")
            }
        }
        command.refresh.forEach { refresh ->
            if (!current()) return warnings + MutationCommandWarning("refresh", message = "Authorization context changed before refresh.")
            runCatching {
                val context = window.contextOrNull(refresh.dataSourceRef)
                    ?: error("Refresh datasource is unavailable: ${refresh.dataSourceRef}")
                if (refresh.clearSelection) context.resetSelection()
                awaitRefresh(context)
            }.onFailure {
                if (it is CancellationException) throw it
                warnings += MutationCommandWarning("refresh", refresh.dataSourceRef, it.message ?: "Refresh failed")
            }
        }
        return warnings
    }

    private suspend fun awaitRefresh(context: DataSourceContext) {
        when (val outcome = awaitWriter(context, 30_000)) {
            is MutationWriterOutcome.Failed -> error(outcome.message)
            is MutationWriterOutcome.Indeterminate -> error("Refresh outcome is unknown")
            is MutationWriterOutcome.Succeeded -> Unit
        }
    }

    internal fun predicateAllows(context: DataSourceContext, condition: DashboardConditionDef?): Boolean {
        if (condition == null) return true
        val input = context.input.peek()
        val selection = context.selection.peek()
        return evaluateDashboardCondition(
            condition,
            metrics = context.metrics.peek(),
            filters = input.filter,
            form = context.form.peek(),
            windowForm = context.window.peekWindowForm(),
            collection = context.collection.peek(),
            input = mapOf("filter" to input.filter, "parameters" to input.parameters, "page" to input.page),
            selectionValues = mapOf("selected" to selection.selected, "selection" to selection.selection, "rowIndex" to selection.rowIndex),
            authorization = context.window.metadata.peek()?.authorizationSnapshot.orEmpty().mapValues { JsonUtil.elementToAny(it.value) }
        )
    }

    private fun applyWindowState(runtime: ForgeRuntime, windowId: String, patch: kotlinx.serialization.json.JsonObject) {
        if (patch.isEmpty()) return
        runtime.setWindowFormValue(windowId, patch.mapValues { JsonUtil.elementToAny(it.value) }, bumpPrefillRevision = false)
    }

    private suspend fun publish(key: String, state: MutationCommandState) {
        mutex.withLock { states[key] = state }
    }

    private suspend fun releaseCommand(key: String, state: MutationCommandState) {
        mutex.withLock {
            commandGuards.remove(key)?.let(activeGroups::remove)
            states[key] = state
        }
    }

    private suspend fun finishTransport(transport: String, key: String, state: MutationCommandState) {
        mutex.withLock {
            transportGuards.remove(transport)
            commandGuards.remove(key)?.let(activeGroups::remove)
            states[key] = state
        }
    }
}

private fun commandKey(windowId: String, command: MutationCommandDef): String =
    "$windowId::${command.commandId?.trim().takeUnless { it.isNullOrEmpty() } ?: command.dataSourceRef}"

private fun transportKey(windowId: String, dataSourceRef: String): String = "$windowId::$dataSourceRef"

private fun mutationTargetParameters(envelope: Map<String, Any?>): Map<String, Any?> {
    val input = JsonUtil.asStringMap(envelope["input"])
    val inputParameters = JsonUtil.asStringMap(input["parameters"])
    if (inputParameters.isNotEmpty()) return inputParameters
    val parameters = JsonUtil.asStringMap(envelope["parameters"])
    return if (parameters.isNotEmpty()) parameters else envelope
}

private fun deepMerge(base: Map<String, Any?>, override: Map<String, Any?>): Map<String, Any?> {
    val result = base.toMutableMap()
    override.forEach { (key, value) ->
        val left = result[key] as? Map<*, *>
        val right = value as? Map<*, *>
        result[key] = if (left != null && right != null) {
            @Suppress("UNCHECKED_CAST")
            deepMerge(left as Map<String, Any?>, right as Map<String, Any?>)
        } else value
    }
    return result
}

private fun mutationResultRows(rows: List<Map<String, Any?>>, path: String?): List<Map<String, Any?>> {
    val normalized = path?.trim().orEmpty()
    if (normalized.isEmpty()) return rows
    val selected = SelectorUtil.resolve(mapOf("rows" to rows), normalized)
    return when (selected) {
        is List<*> -> selected.map { JsonUtil.asStringMap(it) }
        is Map<*, *> -> listOf(JsonUtil.asStringMap(selected))
        else -> error("Reconciliation result path did not resolve to rows: $normalized")
    }
}

private fun reconcileRows(
    current: List<Map<String, Any?>>,
    incoming: List<Map<String, Any?>>,
    spec: ReconcileSpec
): List<Map<String, Any?>> {
    val mode = spec.mode?.trim()?.lowercase() ?: "merge"
    if (mode == "replace") return incoming.map { it.toMap() }
    require(mode == "merge" || mode == "remove") { "Unsupported reconciliation mode: $mode" }
    val identities = spec.identityFields.ifEmpty { listOf(spec.identityField ?: "id") }
    fun key(row: Map<String, Any?>): String = identities.joinToString("\u001f") { field ->
        row[field]?.toString()?.takeIf(String::isNotBlank)
            ?: error("Reconciliation row is missing identity field: $field")
    }
    val incomingKeys = incoming.map(::key).toSet()
    if (mode == "remove") return current.filterNot { key(it) in incomingKeys }
    val result = current.map { it.toMutableMap() }.toMutableList()
    val indexes = result.mapIndexed { index, row -> key(row) to index }.toMap().toMutableMap()
    incoming.forEach { row ->
        val identity = key(row)
        val index = indexes[identity]
        if (index == null) {
            indexes[identity] = result.size
            result += row.toMutableMap()
        } else {
            result[index].putAll(row)
        }
    }
    return result
}

package com.viant.forgeandroid.runtime

import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.dropWhile
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
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
    val warnings: List<MutationCommandWarning> = emptyList()
)

private sealed interface MutationWriterOutcome {
    data object Succeeded : MutationWriterOutcome
    data object Indeterminate : MutationWriterOutcome
    data class Failed(val message: String) : MutationWriterOutcome
}

class MutationCommandRuntime {
    private val mutex = Mutex()
    private val states = mutableMapOf<String, MutationCommandState>()
    private val commandGuards = mutableSetOf<String>()
    private val transportGuards = mutableSetOf<String>()

    suspend fun state(windowId: String, command: MutationCommandDef): MutationCommandState =
        mutex.withLock { states[commandKey(windowId, command)] ?: MutationCommandState() }

    suspend fun resolveIndeterminate(windowId: String, command: MutationCommandDef, message: String = ""): Boolean {
        val key = commandKey(windowId, command)
        return mutex.withLock {
            if (states[key]?.phase != MutationCommandPhase.Indeterminate) return@withLock false
            commandGuards.remove(key)
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
        val acquired = mutex.withLock {
            if (targetRef.isEmpty() || key in commandGuards) false
            else {
                commandGuards += key
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

        if (!predicateAllows(source, command.validateWhen)) {
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
        resolveConfirmation(command, extras).takeIf(String::isNotBlank)?.let { confirmation ->
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

        val invocationId = UUID.randomUUID().toString()
        val resolution = ParameterResolver().resolve(command.parameters, source)
        val envelope = resolution.inbound[targetRef] ?: resolution.inbound[""] ?: emptyMap()
        val base = mutationTargetParameters(envelope)
        val prepared = runCatching { preparePayload(window, source, command.payload, extras) }.getOrElse { error ->
            releaseTransportAndCommand(transport, key)
            applyWindowState(runtime, window.windowId, command.errorState)
            val message = error.message ?: "Invalid resource payload"
            publish(key, MutationCommandState(phase = MutationCommandPhase.Failed, error = message, message = message, writerStatus = MutationWriterStatus.NotInvoked))
            return MutationCommandResult(false, "invalid_payload", error = message)
        }
        val parameters = deepMerge(base, prepared).toMutableMap()
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
        target.setInputParameters(parameters)

        return when (val writer = awaitWriter(target, (command.timeoutMs ?: 30_000).coerceAtLeast(1_000))) {
            is MutationWriterOutcome.Failed -> {
                releaseTransportAndCommand(transport, key)
                applyWindowState(runtime, window.windowId, command.errorState)
                publish(key, MutationCommandState(
                    phase = MutationCommandPhase.Failed,
                    error = writer.message,
                    message = writer.message,
                    invocationId = invocationId,
                    writerStatus = MutationWriterStatus.Failed
                ))
                MutationCommandResult(true, "failed", invocationId, writer.message)
            }
            MutationWriterOutcome.Indeterminate -> {
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
                MutationCommandResult(true, "indeterminate", invocationId)
            }
            MutationWriterOutcome.Succeeded -> {
                val warnings = synchronize(window, target, command)
                applyWindowState(runtime, window.windowId, command.successState)
                releaseTransportAndCommand(transport, key)
                val sync = if (warnings.isEmpty()) MutationSyncStatus.Succeeded else MutationSyncStatus.PartialFailure
                val message = if (warnings.isEmpty()) "Completed" else "Saved. Some related data could not be refreshed."
                publish(key, MutationCommandState(
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
            MutationWriterOutcome.Indeterminate
        } else if (!control.error.isNullOrBlank()) {
            MutationWriterOutcome.Failed(control.error)
        } else {
            MutationWriterOutcome.Succeeded
        }
    }

    private suspend fun preparePayload(window: WindowContext, source: DataSourceContext, payload: ResourcePayloadPreparationDef?, extras: Map<String, Any?>): Map<String, Any?> {
        if (payload == null) return extras
        val metadata = window.metadata.peek() ?: error("Window metadata is unavailable")
        val snapshots = metadata.dataSources.keys.associateWith { ref ->
            val context = window.contextOrNull(ref)
            ResourceDataSnapshot(
                form = context?.form?.peek().orEmpty(),
                collection = context?.collection?.peek().orEmpty(),
                selection = context?.selection?.peek() ?: SelectionState(),
                metrics = context?.metrics?.peek().orEmpty(),
                input = context?.input?.peek() ?: InputState()
            )
        }
        val code = metadata.actions?.code?.trim().orEmpty()
        val hook: ResourceModelHook? = if (code.isBlank()) null else { name, value ->
            val result = ActionHookRuntime.invoke(code, name, JsonUtil.anyToElement(value))
            result?.let(JsonUtil::elementToAny) ?: value
        }
        return ResourceModelRuntime.prepare(
            payload,
            ResourceValueEnvironment(source.dataSourceRef, snapshots, window.peekWindowForm(), extras),
            metadata.schemas,
            metadata.resourceModels,
            hook
        )
    }

    private suspend fun synchronize(
        window: WindowContext,
        target: DataSourceContext,
        command: MutationCommandDef
    ): List<MutationCommandWarning> {
        val warnings = mutableListOf<MutationCommandWarning>()
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
                warnings += MutationCommandWarning("reconcile", spec.dataSourceRef, it.message ?: "Reconciliation failed")
            }
        }
        command.refresh.forEach { refresh ->
            runCatching {
                val context = window.contextOrNull(refresh.dataSourceRef)
                    ?: error("Refresh datasource is unavailable: ${refresh.dataSourceRef}")
                if (refresh.clearSelection) context.resetSelection()
                awaitRefresh(context)
            }.onFailure {
                warnings += MutationCommandWarning("refresh", refresh.dataSourceRef, it.message ?: "Refresh failed")
            }
        }
        return warnings
    }

    private suspend fun awaitRefresh(context: DataSourceContext) {
        when (val outcome = awaitWriter(context, 30_000)) {
            is MutationWriterOutcome.Failed -> error(outcome.message)
            MutationWriterOutcome.Indeterminate -> error("Refresh outcome is unknown")
            MutationWriterOutcome.Succeeded -> Unit
        }
    }

    private fun predicateAllows(context: DataSourceContext, condition: DashboardConditionDef?): Boolean {
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
            selectionValues = mapOf("selected" to selection.selected, "selection" to selection.selection, "rowIndex" to selection.rowIndex)
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
            commandGuards.remove(key)
            states[key] = state
        }
    }

    private suspend fun releaseTransportAndCommand(transport: String, key: String) {
        mutex.withLock {
            transportGuards.remove(transport)
            commandGuards.remove(key)
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

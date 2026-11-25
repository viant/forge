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

enum class MutationCommandPhase { Idle, Validating, Confirming, Pending, CleaningUp, Succeeded, Failed, Indeterminate }
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
    val warnings: List<MutationCommandWarning> = emptyList(),
    val failedStepId: String? = null,
    internal val presentation: java.lang.ref.WeakReference<DialogState>? = null
)

data class MutationCommandResult(
    val accepted: Boolean,
    val status: String,
    val invocationId: String = "",
    val error: String? = null,
    val warnings: List<MutationCommandWarning> = emptyList(),
    val cause: Throwable? = null,
    val failedStepId: String? = null
)

private sealed interface MutationWriterOutcome {
    data class Succeeded(val records: JsonArray? = null) : MutationWriterOutcome
    data class Indeterminate(val cause: Throwable? = null) : MutationWriterOutcome
    data class Failed(val message: String, val cause: Throwable? = null) : MutationWriterOutcome
}

class MutationCommandRuntime {
    private val mutex = Mutex()
    private val states = java.util.concurrent.ConcurrentHashMap<String, Signal<MutationCommandState>>()
    private val commandGuards = mutableMapOf<String, String?>()
    private val activeGroups = mutableSetOf<String>()
    private val transportGuards = mutableMapOf<String, String>()

    private fun stateSignal(key: String) = states.computeIfAbsent(key) { Signal(MutationCommandState()) }

    internal fun stateUpdates(windowId: String, command: MutationCommandDef) = stateSignal(commandKey(windowId, command)).flow

    suspend fun state(windowId: String, command: MutationCommandDef): MutationCommandState =
        states[commandKey(windowId, command)]?.peek() ?: MutationCommandState()

    suspend fun resolveIndeterminate(windowId: String, command: MutationCommandDef, message: String = ""): Boolean {
        val key = commandKey(windowId, command)
        return mutex.withLock {
            if (states[key]?.peek()?.phase != MutationCommandPhase.Indeterminate) return@withLock false
            commandGuards.remove(key)?.let(activeGroups::remove)
            transportGuards.entries.removeAll { it.value == key }
            stateSignal(key).set(MutationCommandState(message = message))
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
    ): MutationCommandResult = executePresented(runtime, window, source, command, extras, null, { true }, confirm)

    internal suspend fun executePresented(runtime: ForgeRuntime, window: WindowContext, source: DataSourceContext,
        command: MutationCommandDef, extras: Map<String, Any?>, presentation: DialogState?, presentationCurrent: () -> Boolean,
        confirm: (suspend (String) -> Boolean)?, closeDialogId: String? = null): MutationCommandResult {
        val targetRef = command.dataSourceRef.trim()
        if (command.invalidClearFields) return MutationCommandResult(false, "invalid", error = "clearFormFields requires distinct top-level form fields.")
        if (command.receiptWhen != null) return MutationCommandResult(false, "invalid", error = "receiptWhen is supported only on a cleanup command.")
        val key = commandKey(window.windowId, command)
        val group = command.serializationGroup?.trim()?.takeIf(String::isNotEmpty)?.let { "${window.windowId}::$it" }
        val acquired = mutex.withLock {
            if (targetRef.isEmpty() || key in commandGuards || group in activeGroups) false
            else {
                commandGuards[key] = group
                group?.let(activeGroups::add)
                stateSignal(key).set(MutationCommandState(
                    phase = MutationCommandPhase.Validating,
                    guarded = true,
                    retryAllowed = false,
                    message = "Validating…",
                    writerStatus = MutationWriterStatus.NotInvoked
                ))
                true
            }
        }
        if (!acquired) return MutationCommandResult(false, "suppressed")

        val admitted = window.metadata.peek()?.authorizationSnapshot.orEmpty()
        val ordered = command.before.isNotEmpty()
        val closing = closeDialogId != null
        val scopeSensitive = ordered || command.clearFormFields.isNotEmpty() || closing
        val selection = if (scopeSensitive) source.selection.peek() else null
        val lease = CommandLease(key, command, presentation, presentationCurrent, closing) {
            window.metadata.peek()?.authorizationSnapshot == admitted &&
                (!scopeSensitive || (source.selection.peek() == selection && window.signals.ownsMetadata(window.windowId, window.metadata)))
        }
        val eligible = { lease.admitted() && (!closing || presentationCurrent()) && predicateAllows(source, command.validateWhen) }
        if (!scopeSensitive) return executeOne(runtime, window, source, command, extras, confirm, lease, eligible)
        val submitted = source.captureFormFields(command.clearFormFields)
        return try {
            val result = if (ordered) {
                val outcome = executeOrdered(runtime, window, source, command, extras, confirm, lease)
                outcome.copy(accepted = outcome.accepted || lease.attempted, invocationId = lease.rootInvocationId)
            } else executeOne(runtime, window, source, command, extras, confirm, lease, eligible)
            if (result.accepted && lease.last.phase != MutationCommandPhase.Indeterminate &&
                result.status in completedFormOutcomes) {
                source.clearSubmittedFormFields(submitted) { lease.admitted() && lease.presentationCurrent() }
            }
            if (closeDialogId != null && presentation != null && result.status == "succeeded" && lease.admitted()) {
                runtime.closeDialog(window.windowId, closeDialogId, presentation)
            }
            result
        } catch (cancelled: CancellationException) {
            withContext(NonCancellable) {
                if (lease.last.phase != MutationCommandPhase.Indeterminate && !lease.rootAcknowledged && lease.last.writerStatus != MutationWriterStatus.Succeeded) {
                    if (lease.completedStep) {
                        lease.settle(MutationCommandState(phase = MutationCommandPhase.Indeterminate, guarded = true,
                            retryAllowed = false, writerStatus = MutationWriterStatus.Indeterminate, message = "Command interrupted after a confirmed step."))
                    } else lease.settle(MutationCommandState(writerStatus = MutationWriterStatus.NotInvoked))
                }
                if (lease.admitted() && lease.last.phase == MutationCommandPhase.Indeterminate) {
                    lease.applyWindowState(runtime, window.windowId, command.indeterminateState)
                }
            }
            throw cancelled
        } finally {
            withContext(NonCancellable) { lease.finish() }
        }
    }

    private inner class CommandLease(val key: String, val root: MutationCommandDef, presented: DialogState?, val presentationCurrent: () -> Boolean, val closing: Boolean, val admitted: () -> Boolean) {
        val ordered = root.before.isNotEmpty()
        val requiresReceipt = ordered || closing
        private val presentation = presented?.let { java.lang.ref.WeakReference(it) }
        val rootInvocationId = if (ordered) UUID.randomUUID().toString() else ""
        var attempted = false
        var rootDispatched = false
        var completedStep = false
        var rootAcknowledged = false
        var cleaningUp = false
        var last = MutationCommandState(writerStatus = MutationWriterStatus.NotInvoked)
        private fun rootState(state: MutationCommandState) = if (!ordered) state else state.copy(
            invocationId = rootInvocationId, presentation = presentation, writerStatus = if (rootDispatched) state.writerStatus else MutationWriterStatus.NotInvoked)
        suspend fun publish(state: MutationCommandState) {
            if (cleaningUp && state.phase == MutationCommandPhase.Pending) return
            last = rootState(state)
            // The root must finish unwinding before authoritative resolution can release its transport.
            if (!ordered || state.phase != MutationCommandPhase.Indeterminate) mutex.withLock { stateSignal(key).set(last) }
        }
        suspend fun settle(state: MutationCommandState) = settle(null, state)
        suspend fun settle(transport: String?, state: MutationCommandState) {
            last = rootState(state)
            mutex.withLock {
                if (transport != null) transportGuards.remove(transport, key)
                if (!requiresReceipt && root.clearFormFields.isEmpty()) release()
            }
        }
        suspend fun finish() = mutex.withLock {
            if (last.phase == MutationCommandPhase.Indeterminate) stateSignal(key).set(last) else release()
        }
        private fun release() {
            commandGuards.remove(key)?.let(activeGroups::remove)
            stateSignal(key).set(last)
        }
    }

    private suspend fun confirmCommand(lease: CommandLease, prompt: String, confirm: (suspend (String) -> Boolean)?): MutationCommandResult? {
        if (prompt.isBlank()) return null
        if (confirm == null) {
            val message = "Confirmation is required but no confirmation service is available."
            lease.settle(MutationCommandState(phase = MutationCommandPhase.Failed, error = message,
                message = message, writerStatus = MutationWriterStatus.NotInvoked))
            return MutationCommandResult(false, "confirmation_unavailable", error = message)
        }
        lease.publish(MutationCommandState(phase = MutationCommandPhase.Confirming, guarded = true,
            retryAllowed = false, message = prompt, writerStatus = MutationWriterStatus.NotInvoked))
        if (confirm(prompt)) return null
        lease.settle(MutationCommandState(writerStatus = MutationWriterStatus.NotInvoked))
        return MutationCommandResult(false, "cancelled")
    }

    private suspend fun executeOrdered(runtime: ForgeRuntime, window: WindowContext, source: DataSourceContext,
        root: MutationCommandDef, extras: Map<String, Any?>, confirm: (suspend (String) -> Boolean)?,
        lease: CommandLease): MutationCommandResult {
        var predicateWindowForm: (Map<String, Any?>) -> Map<String, Any?> = { it }
        fun eligible() = lease.admitted() && predicateAllows(source, root.validateWhen, predicateWindowForm(window.peekWindowForm()))
        fun forwardEligible() = eligible() && lease.presentationCurrent()
        fun applyPhase(patch: JsonObject) {
            if (patch.isEmpty()) return
            val previous = predicateWindowForm
            val before = window.peekWindowForm()
            val admittedView = previous(before)
            lease.applyWindowState(runtime, window.windowId, patch)
            val applied = window.peekWindowForm()
            // Ignore only this command's own stable lifecycle fields when rechecking the admission predicate.
            predicateWindowForm = { current ->
                if (current === applied) admittedView else previous(current.toMutableMap().apply {
                    patch.keys.forEach { field ->
                        if (current[field] == applied[field] && current.containsKey(field) == applied.containsKey(field)) {
                            if (field in before) put(field, before[field]) else remove(field)
                        }
                    }
                })
            }
        }
        var receipts = emptyMap<String, Map<String, Any?>>()
        // Each confirmed invocation publishes a new receipt view. Later steps and cleanup share that view.
        var stepInputs = extras + ("steps" to receipts)
        val cleanups = mutableListOf<MutationCommandDef>()
        suspend fun reject(message: String): MutationCommandResult {
            lease.settle(MutationCommandState(phase = MutationCommandPhase.Failed, error = message, message = message,
                writerStatus = MutationWriterStatus.NotInvoked))
            return MutationCommandResult(false, "invalid", error = message)
        }
        suspend fun superseded(failedStepId: String? = null): MutationCommandResult {
            val message = "The command's authorization, selection, or dialog changed. Remaining steps were skipped."
            lease.settle(MutationCommandState(phase = MutationCommandPhase.Failed, error = message, message = message,
                writerStatus = MutationWriterStatus.NotInvoked, failedStepId = failedStepId))
            return MutationCommandResult(lease.attempted, "superseded", error = message, failedStepId = failedStepId)
        }
        suspend fun failed(primary: MutationCommandResult): MutationCommandResult {
            lease.last = lease.last.copy(failedStepId = primary.failedStepId)
            if (primary.status == "superseded") return primary
            if (primary.status == "indeterminate") {
                if (lease.admitted()) lease.applyWindowState(runtime, window.windowId, root.indeterminateState)
                return primary
            }
            if (!lease.admitted() || !lease.presentationCurrent()) return superseded(primary.failedStepId)
            if (!eligible() && receipts.isNotEmpty()) return superseded(primary.failedStepId)
            val original = lease.last
            val warnings = primary.warnings.toMutableList()
            if (cleanups.isNotEmpty()) {
                applyPhase(root.cleanupState)
                lease.cleaningUp = true
                lease.publish(original.copy(phase = MutationCommandPhase.CleaningUp, guarded = true, retryAllowed = false,
                    pending = false, message = "Cleaning up completed steps.", error = primary.error))
            }
            for (cleanup in cleanups.asReversed()) {
                if (!eligible()) break
                var confirmed = true
                val receiptCheck = cleanup.receiptWhen
                val outcome = executeOne(runtime, window, source, cleanup, stepInputs, null, lease,
                    { eligible() && predicateAllows(source, cleanup.validateWhen) }) { _, rows ->
                    if (receiptCheck != null) confirmed = evaluateReceiptCondition(receiptCheck, rows)
                }
                if (outcome.status == "succeeded") {
                    if (!confirmed) warnings += MutationCommandWarning("cleanup", cleanup.dataSourceRef,
                        "Cleanup ${cleanup.commandId} did not return the expected receipt.")
                    continue
                }
                warnings += MutationCommandWarning("cleanup", cleanup.dataSourceRef,
                    "Cleanup ${cleanup.commandId} (${outcome.status}): ${outcome.error ?: outcome.cause?.message ?: "No confirmed result."}")
                if (outcome.status == "indeterminate" || !lease.admitted()) break
            }
            val unknown = lease.last.phase == MutationCommandPhase.Indeterminate
            if (lease.admitted()) lease.applyWindowState(runtime, window.windowId, if (unknown) root.indeterminateState else root.errorState)
            val state = if (unknown) lease.last else original
            val message = if (warnings.any { it.stage == "cleanup" }) {
                listOfNotNull(primary.error ?: state.message.takeIf(String::isNotBlank), "Cleanup could not be confirmed.").joinToString(" ")
            } else state.message
            lease.settle(state.copy(error = primary.error, message = message, warnings = warnings,
                writerStatus = original.writerStatus, failedStepId = primary.failedStepId))
            return primary.copy(warnings = warnings)
        }

        root.beforeDefinitionError?.let { return reject(it) }
        if (!forwardEligible()) {
            if (lease.admitted()) lease.applyWindowState(runtime, window.windowId, root.errorState)
            return reject(root.invalidMessage ?: "This action is not currently valid.")
        }
        confirmCommand(lease, resolveConfirmation(root, extras), confirm)?.let { return it }
        if (!forwardEligible()) return superseded()
        applyPhase(root.pendingState)
        lease.publish(MutationCommandState(phase = MutationCommandPhase.Pending, guarded = true, pending = true,
            retryAllowed = false, message = "Saving…", writerStatus = MutationWriterStatus.NotInvoked))
        for (step in root.before) {
            if (!forwardEligible()) return superseded()
            if (!predicateAllows(source, step.condition)) continue
            val command = step.command
            val outcome = executeOne(runtime, window, source, command, stepInputs, null, lease,
                { forwardEligible() && predicateAllows(source, step.condition) && predicateAllows(source, command.validateWhen) }) { invocationId, rows ->
                lease.completedStep = true
                val receipt = mapOf("invocationId" to invocationId, "rows" to JsonUtil.elementToAny(rows))
                receipts = receipts + (command.commandId!!.trim() to receipt)
                stepInputs = extras + ("steps" to receipts)
            }
            if (outcome.status != "succeeded") return failed(outcome.copy(failedStepId = command.commandId))
            step.cleanup?.let(cleanups::add)
        }
        if (!forwardEligible()) return superseded()
        val result = executeOne(runtime, window, source, root, stepInputs, null, lease, ::forwardEligible) { _, _ -> lease.rootAcknowledged = true }
        return if (lease.rootAcknowledged || result.status == "succeeded") result else failed(result)
    }

    private suspend fun executeOne(runtime: ForgeRuntime, window: WindowContext, source: DataSourceContext,
        command: MutationCommandDef, extras: Map<String, Any?>, confirm: (suspend (String) -> Boolean)?,
        lease: CommandLease, authorized: () -> Boolean, onReceipt: ((String, JsonArray) -> Unit)? = null): MutationCommandResult {
        val targetRef = command.dataSourceRef.trim()
        if (!authorized()) {
            val message = command.invalidMessage ?: "This action is not currently valid."
            if (!lease.ordered) lease.applyWindowState(runtime, window.windowId, command.errorState)
            lease.settle(MutationCommandState(
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
                deepMerge(base, if (command.payload == null && lease.ordered) extras - "steps"
                    else preparePayload(window, source, command.payload, extras) { initialSources })
            } ?: error("Command payload preparation timed out. The writer was not invoked.")
            val confirmation = if (lease.ordered) "" else resolveConfirmation(command, extras)
            confirmCommand(lease, confirmation, confirm)?.let { return it }

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
            withContext(NonCancellable) { lease.settle(MutationCommandState(writerStatus = MutationWriterStatus.NotInvoked)) }
            throw cancelled
        } catch (error: Exception) {
            val message = error.message ?: "Invalid command preparation."
            if (!lease.ordered && lease.admitted()) lease.applyWindowState(runtime, window.windowId, command.errorState)
            lease.settle(MutationCommandState(phase = MutationCommandPhase.Failed, error = message, message = message, writerStatus = MutationWriterStatus.NotInvoked))
            return MutationCommandResult(false, "invalid_payload", error = message, cause = error)
        }
        val target = window.contextOrNull(targetRef)
        if (target == null) {
            val message = "Command datasource is unavailable: $targetRef"
            lease.settle(MutationCommandState(
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
                transportGuards[transport] = lease.key
                true
            }
        }
        if (!transportAcquired) {
            val message = "Another command is using this datasource."
            lease.settle(MutationCommandState(message = message, writerStatus = MutationWriterStatus.NotInvoked))
            return MutationCommandResult(false, "transport_busy", error = message)
        }

        if (!authorized()) {
            val message = "Authorization or command eligibility changed before dispatch."
            lease.settle(transport, MutationCommandState(phase = MutationCommandPhase.Failed, message = message,
                error = message, writerStatus = MutationWriterStatus.NotInvoked))
            return MutationCommandResult(false, "invalid", error = message)
        }
        val rootWriter = lease.ordered && command === lease.root
        val invocationId = if (rootWriter) lease.rootInvocationId else UUID.randomUUID().toString()
        if (rootWriter) lease.rootDispatched = true
        command.invocationParameter?.trim()?.takeIf(String::isNotEmpty)?.let { parameters[it] = invocationId }
        if (!lease.ordered) lease.applyWindowState(runtime, window.windowId, command.pendingState)
        lease.publish(MutationCommandState(
            phase = MutationCommandPhase.Pending,
            guarded = true,
            pending = true,
            retryAllowed = false,
            message = "Saving…",
            invocationId = invocationId,
            writerStatus = MutationWriterStatus.Pending
        ))
        lease.attempted = true
        val writer = try {
            val receipt = withTimeoutOrNull(timeout) { target.fetchCommandResult(parameters, requireRecords = lease.requiresReceipt) }
            when {
                receipt == null -> MutationWriterOutcome.Indeterminate()
                lease.requiresReceipt && (!receipt.recordsConfirmed || uncertainTransport(receipt.cause)) -> MutationWriterOutcome.Indeterminate(receipt.cause)
                receipt.cause is java.net.SocketTimeoutException || receipt.cause is java.util.concurrent.TimeoutException ->
                    MutationWriterOutcome.Indeterminate(receipt.cause)
                receipt.error != null -> MutationWriterOutcome.Failed(receipt.error, receipt.cause)
                else -> MutationWriterOutcome.Succeeded(receipt.rows)
            }
        } catch (cancelled: CancellationException) {
            withContext(NonCancellable) {
                lease.publish(MutationCommandState(phase = MutationCommandPhase.Indeterminate, guarded = true,
                    retryAllowed = false, invocationId = invocationId, writerStatus = MutationWriterStatus.Indeterminate,
                    message = "Command was cancelled after dispatch. Verify its outcome."))
                if (lease.admitted()) lease.applyWindowState(runtime, window.windowId, command.indeterminateState)
            }
            throw cancelled
        } catch (error: Exception) {
            // Dispatch has started and its completion receipt is unavailable.
            MutationWriterOutcome.Indeterminate(error)
        }
        val lostScope = !lease.admitted()
        if (lease.requiresReceipt && writer !is MutationWriterOutcome.Indeterminate && (lostScope || ((rootWriter || lease.closing) && !lease.presentationCurrent()))) {
            val committed = (rootWriter || lease.closing) && writer is MutationWriterOutcome.Succeeded
            val failure = writer as? MutationWriterOutcome.Failed
            val message = if (committed) "Saved. The original presentation is no longer current."
                else "The command scope changed after dispatch. Remaining steps were skipped."
            val warnings = if (committed) listOf(MutationCommandWarning("synchronize", targetRef, message)) else emptyList()
            lease.rootAcknowledged = committed
            lease.settle(transport, MutationCommandState(phase = if (committed) MutationCommandPhase.Succeeded else MutationCommandPhase.Failed,
                message = message, error = failure?.message, invocationId = invocationId,
                writerStatus = if (committed) MutationWriterStatus.Succeeded else if (rootWriter) MutationWriterStatus.Failed else MutationWriterStatus.NotInvoked,
                syncStatus = if (committed) MutationSyncStatus.PartialFailure else MutationSyncStatus.NotStarted, warnings = warnings))
            val status = if (lease.closing && committed) "succeeded" else "superseded"
            return MutationCommandResult(true, status, invocationId, error = failure?.message, warnings = warnings, cause = failure?.cause)
        }
        if (lostScope && !lease.ordered) {
            val message = "Authorization context changed after dispatch. Verify the outcome."
            lease.publish(MutationCommandState(phase = MutationCommandPhase.Indeterminate, guarded = true, retryAllowed = false,
                message = message, invocationId = invocationId, writerStatus = MutationWriterStatus.Indeterminate))
            return MutationCommandResult(true, "indeterminate", invocationId, message)
        }
        return when (writer) {
            is MutationWriterOutcome.Failed -> {
                if (!lease.ordered) lease.applyWindowState(runtime, window.windowId, command.errorState)
                lease.settle(transport, MutationCommandState(
                    phase = MutationCommandPhase.Failed,
                    error = writer.message,
                    message = writer.message,
                    invocationId = invocationId,
                    writerStatus = MutationWriterStatus.Failed
                ))
                MutationCommandResult(true, "failed", invocationId, writer.message, cause = writer.cause)
            }
            is MutationWriterOutcome.Indeterminate -> {
                lease.applyWindowState(runtime, window.windowId, command.indeterminateState)
                val message = "The writer outcome is unknown because the client stopped waiting."
                lease.publish(MutationCommandState(
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
                if (onReceipt != null) onReceipt(invocationId, checkNotNull(writer.records))
                val warnings = mutableListOf<MutationCommandWarning>()
                val patch = command.successState.toMutableMap()
                for ((field, selectors) in command.resultState) {
                    val value = selectors.firstNotNullOfOrNull { SelectorUtil.resolve(writer.records, it) as? JsonElement }
                    if (value == null) warnings += MutationCommandWarning("resultState", message = "Writer receipt omitted the value for $field.")
                    patch[field] = value ?: JsonNull
                }
                lease.applyWindowState(runtime, window.windowId, JsonObject(patch))
                try {
                    warnings += synchronize(window, target, command, if (lease.ordered) writer.records else null) { lease.admitted() && (!lease.requiresReceipt || lease.presentationCurrent()) }
                } catch (cancelled: CancellationException) {
                    withContext(NonCancellable) { lease.settle(transport, MutationCommandState(
                        phase = MutationCommandPhase.Succeeded, invocationId = invocationId, writerStatus = MutationWriterStatus.Succeeded,
                        syncStatus = MutationSyncStatus.PartialFailure, message = "Saved. Refresh was cancelled.")) }
                    throw cancelled
                }
                val sync = if (warnings.isEmpty()) MutationSyncStatus.Succeeded else MutationSyncStatus.PartialFailure
                val message = if (warnings.isEmpty()) "Completed" else "Saved. Some related data could not be refreshed."
                lease.settle(transport, MutationCommandState(
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
        invocationRows: JsonArray?,
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
                    val rows = invocationRows?.map { JsonUtil.asStringMap(JsonUtil.elementToAny(it)) } ?: target.collection.peek()
                    val incoming = mutationResultRows(rows, spec.resultPath ?: spec.rowsPath)
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

    internal fun predicateAllows(context: DataSourceContext, condition: DashboardConditionDef?,
        windowForm: Map<String, Any?> = context.window.peekWindowForm()): Boolean {
        if (condition == null) return true
        val input = context.input.peek()
        val selection = context.selection.peek()
        return evaluateDashboardCondition(
            condition,
            metrics = context.metrics.peek(),
            filters = input.filter,
            form = context.form.peek(),
            windowForm = windowForm,
            collection = context.collection.peek(),
            input = mapOf("filter" to input.filter, "parameters" to input.parameters, "page" to input.page),
            selectionValues = mapOf("selected" to selection.selected, "selection" to selection.selection, "rowIndex" to selection.rowIndex),
            authorization = context.window.metadata.peek()?.authorizationSnapshot.orEmpty().mapValues { JsonUtil.elementToAny(it.value) }
        )
    }

    private fun CommandLease.applyWindowState(runtime: ForgeRuntime, windowId: String, patch: JsonObject) {
        if (patch.isEmpty() || (requiresReceipt && (!presentationCurrent() || !admitted()))) return
        runtime.setWindowFormValue(windowId, patch.mapValues { JsonUtil.elementToAny(it.value) }, bumpPrefillRevision = false)
    }


}

private val completedFormOutcomes = setOf("succeeded", "failed", "invalid", "invalid_payload", "transport_busy")

private fun uncertainTransport(cause: Throwable?): Boolean = when (cause) {
    is HttpResponseException -> cause.status in 300..399 || cause.status == 408 || cause.status >= 500
    is java.io.IOException, is kotlinx.serialization.SerializationException -> true
    else -> false
}

private fun commandKey(windowId: String, command: MutationCommandDef): String =
    "$windowId::${command.commandId?.trim().takeUnless { it.isNullOrEmpty() } ?: command.dataSourceRef}"

private fun transportKey(windowId: String, dataSourceRef: String): String = "$windowId::$dataSourceRef"

internal fun mutationTargetParameters(envelope: Map<String, Any?>): Map<String, Any?> {
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

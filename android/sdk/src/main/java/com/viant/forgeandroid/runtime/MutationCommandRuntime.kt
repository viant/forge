package com.viant.forgeandroid.runtime

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.supervisorScope
import kotlinx.coroutines.withContext
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.util.UUID

enum class MutationCommandPhase { Idle, Validating, Confirming, Pending, CleaningUp, Succeeded, Failed, PartialFailure, Indeterminate, VerificationFailed }
enum class MutationWriterStatus { Idle, NotInvoked, Pending, Succeeded, Failed, Indeterminate }
enum class MutationSyncStatus { NotStarted, Succeeded, PartialFailure, VerificationFailed }

data class MutationCommandWarning(
    val stage: String,
    val dataSourceRef: String? = null,
    val message: String
)

data class MutationGroupMemberOutcome(
    val label: String,
    val status: String,
    val invocationId: String? = null,
    val rows: JsonArray? = null,
    val error: String? = null,
    val cause: Throwable? = null
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
    val members: Map<String, MutationGroupMemberOutcome> = emptyMap(),
    internal val presentation: java.lang.ref.WeakReference<DialogState>? = null,
    internal val authorization: Map<String, JsonElement>? = null
)

data class MutationCommandResult(
    val accepted: Boolean,
    val status: String,
    val invocationId: String = "",
    val error: String? = null,
    val warnings: List<MutationCommandWarning> = emptyList(),
    val cause: Throwable? = null,
    val failedStepId: String? = null,
    val members: Map<String, MutationGroupMemberOutcome> = emptyMap(),
    internal val receiptRows: JsonArray? = null,
    val writerRecords: JsonArray? = null,
    val readbackRows: List<Map<String, Any?>>? = null
)

private sealed interface MutationWriterOutcome {
    data class Succeeded(val records: JsonArray? = null) : MutationWriterOutcome
    data class Indeterminate(val cause: Throwable? = null, val message: String? = null) : MutationWriterOutcome
    data class Failed(val message: String, val cause: Throwable? = null) : MutationWriterOutcome
}

class MutationCommandRuntime {
    private val mutex = Mutex()
    private val states = java.util.concurrent.ConcurrentHashMap<String, Signal<MutationCommandState>>()
    private val commandGuards = mutableMapOf<String, String?>()
    private val activeGroups = mutableSetOf<String>()
    private val transportGuards = mutableMapOf<String, String>()
    private val readbacks = mutableMapOf<String, AcknowledgedReadback>()

    private fun stateSignal(key: String) = states.computeIfAbsent(key) { Signal(MutationCommandState()) }

    internal fun stateUpdates(windowId: String, command: MutationCommandDef) = stateSignal(commandKey(windowId, command)).flow

    suspend fun state(windowId: String, command: MutationCommandDef): MutationCommandState =
        states[commandKey(windowId, command)]?.peek() ?: MutationCommandState()

    suspend fun resolveIndeterminate(windowId: String, command: MutationCommandDef, message: String = ""): Boolean {
        val key = commandKey(windowId, command)
        return mutex.withLock {
            val phase = states[key]?.peek()?.phase
            if (phase != MutationCommandPhase.Indeterminate && phase != MutationCommandPhase.PartialFailure) return@withLock false
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
        confirm: (suspend (String) -> Boolean)?, closeDialogId: String? = null,
        retryVerificationInvocationId: String? = null): MutationCommandResult {
        val targetRef = command.dataSourceRef.trim()
        val grouped = command.group != null
        val key = commandKey(window.windowId, command)
        val pending = mutex.withLock {
            val stored = readbacks[key]
            if (stored != null && !stored.verifying && !stored.lease.presentationCurrent()) {
                readbacks.remove(key)
                commandGuards.remove(key)?.let(activeGroups::remove)
                stateSignal(key).set(MutationCommandState())
                null
            } else stored
        }
        if (pending != null) {
            if (pending.source !== source || pending.presentation !== presentation ||
                (retryVerificationInvocationId != null && retryVerificationInvocationId != pending.invocationId)) {
                return MutationCommandResult(false, "suppressed")
            }
            return retryReadback(runtime, window, pending)
        }
        if (retryVerificationInvocationId != null) return MutationCommandResult(false, "suppressed")
        command.readbackDefinitionError()?.let { return MutationCommandResult(false, "invalid_payload", error = it) }
        command.groupDefinitionError?.let { return MutationCommandResult(false, "invalid", error = it) }
        command.group?.firstOrNull { it.command.dataSourceRef.trim() !in window.metadata.peek()?.dataSources.orEmpty() }?.let {
            return MutationCommandResult(false, "invalid", error = "Group writer is unavailable: ${it.command.dataSourceRef}.")
        }
        if (command.invalidClearFields) return MutationCommandResult(false, "invalid", error = "clearFormFields requires distinct top-level form fields.")
        command.receiptDefinitionError?.let { return MutationCommandResult(false, "invalid", error = it) }
        command.successFormDefinitionError?.let { return MutationCommandResult(false, "invalid", error = it) }
        val patchForm = command.successFormState.isNotEmpty()
        if (patchForm && (presentation?.open != true || !presentationCurrent())) {
            return MutationCommandResult(false, "invalid", error = "successFormState requires a current submitting dialog.")
        }
        val fields = if (command.clearFormFields.isEmpty()) command.successFormState.keys
            else if (!patchForm) command.clearFormFields else command.successFormState.keys + command.clearFormFields
        val submittedFields = source.captureFormFields(fields)
        val submittingActor = if (patchForm) window.metadata.peek()?.authorizationSnapshot.orEmpty() else null
        val group = command.serializationGroup?.trim()?.takeIf(String::isNotEmpty)?.let { "${window.windowId}::$it" }
        val acquired = mutex.withLock {
            if ((!grouped && targetRef.isEmpty()) || key in commandGuards || group in activeGroups) false
            else {
                if (submittedFields.values.any { it.pending }) {
                    val message = "Wait for the selected file to finish loading."
                    stateSignal(key).set(MutationCommandState(phase = MutationCommandPhase.Failed, error = message,
                        message = message, writerStatus = MutationWriterStatus.NotInvoked, presentation = presentation?.let { java.lang.ref.WeakReference(it) }))
                    return MutationCommandResult(false, "invalid", error = message)
                }
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

        val admitted = submittingActor ?: window.metadata.peek()?.authorizationSnapshot.orEmpty()
        val ordered = command.before.isNotEmpty()
        val closing = closeDialogId != null
        val scopeSensitive = ordered || grouped || command.clearFormFields.isNotEmpty() || closing || command.checksReceipt
        val reviewedCaller = presentation?.verifiedSelection.takeIf { command.reconcile?.verify != null }
        val selection = if (scopeSensitive && reviewedCaller == null) source.selection.peek() else null
        val ownerCurrent = {
            window.metadata.peek()?.authorizationSnapshot == admitted &&
                (!(scopeSensitive || presentation != null) || window.signals.ownsMetadata(window.windowId, window.metadata))
        }
        val lease = CommandLease(key, window.windowId, command, presentation, presentationCurrent, closeDialogId, submittedFields, admitted, ownerCurrent) {
            ownerCurrent() && (reviewedCaller?.current() ?: (!scopeSensitive || source.selection.peek() == selection))
        }
        val checkDialog = closing || patchForm || (presentation != null && (!scopeSensitive || command.checksReceipt))
        val eligible = { lease.admitted() && (!checkDialog || presentationCurrent()) && predicateAllows(source, command.validateWhen) }
        if (!scopeSensitive) return executeOne(runtime, window, source, command, extras, confirm, lease, eligible)
        val submitted = submittedFields.filterKeys { it in command.clearFormFields }
        return try {
            val result = if (grouped) executeGroup(runtime, window, source, command, extras, confirm, lease)
            else if (ordered) {
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
                if (grouped) {
                    finishGroup(runtime, window, source, command, lease, refresh = false)
                } else if (lease.last.phase != MutationCommandPhase.Indeterminate && !lease.rootAcknowledged && lease.last.writerStatus != MutationWriterStatus.Succeeded) {
                    if (lease.completedStep) {
                        lease.settle(MutationCommandState(phase = MutationCommandPhase.Indeterminate, guarded = true,
                            retryAllowed = false, writerStatus = MutationWriterStatus.Indeterminate, message = "Command interrupted after a confirmed step."))
                    } else lease.settle(MutationCommandState(writerStatus = MutationWriterStatus.NotInvoked))
                }
                if (!grouped && lease.admitted() && lease.last.phase == MutationCommandPhase.Indeterminate) {
                    lease.applyWindowState(runtime, window.windowId, command.indeterminateState)
                }
            }
            throw cancelled
        } finally {
            withContext(NonCancellable) { lease.finish() }
        }
    }

    private inner class CommandLease(
        val key: String, val windowId: String, val root: MutationCommandDef, presented: DialogState?,
        val presentationCurrent: () -> Boolean, val closeDialogId: String?,
        val submittedFields: Map<String, DataSourceContext.SubmittedField>,
        val authorization: Map<String, JsonElement>, val ownerCurrent: () -> Boolean, val admitted: () -> Boolean
    ) {
        val closing = closeDialogId != null
        val ordered = root.before.isNotEmpty()
        val grouped = root.group != null
        val requiresReceipt = ordered || grouped || closing || root.checksReceipt
        val origin = presented
        private val presentation = presented?.let { java.lang.ref.WeakReference(it) }
        val rootInvocationId = if (ordered || grouped) UUID.randomUUID().toString() else ""
        val memberResults = java.util.concurrent.ConcurrentHashMap<String, MutationCommandResult>()
        @Volatile var attempted = false
        var rootDispatched = false
        var completedStep = false
        var rootAcknowledged = false
        var cleaningUp = false
        var last = MutationCommandState(writerStatus = MutationWriterStatus.NotInvoked)
        private fun rootState(state: MutationCommandState) = if (grouped) {
            state.copy(invocationId = rootInvocationId, presentation = presentation, authorization = authorization)
        } else if (root.reconcile?.verify != null) {
            state.copy(presentation = presentation, authorization = authorization)
        } else if (!ordered) {
            if (presentation == null) state else state.copy(presentation = presentation)
        } else state.copy(
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
            val pending = readbacks[key]
            if (last.phase == MutationCommandPhase.VerificationFailed && pending?.lease === this) {
                // Open the retry gate and expose its terminal phase together.
                if (ownerCurrent() && presentationCurrent()) {
                    pending.verifying = false
                    stateSignal(key).set(last)
                } else {
                    readbacks.remove(key)
                    last = MutationCommandState()
                    release()
                }
            } else if (last.phase == MutationCommandPhase.Indeterminate || last.phase == MutationCommandPhase.PartialFailure) {
                stateSignal(key).set(last)
            } else release()
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

    private inner class PhasePredicate(
        val runtime: ForgeRuntime, val window: WindowContext, val source: DataSourceContext,
        val lease: CommandLease
    ) {
        private var admittedForm: (Map<String, Any?>) -> Map<String, Any?> = { it }
        fun allows(condition: DashboardConditionDef?) =
            predicateAllows(source, condition, admittedForm(window.peekWindowForm()))

        fun apply(patch: JsonObject) {
            if (patch.isEmpty()) return
            val previous = admittedForm
            val before = window.peekWindowForm()
            val admittedView = previous(before)
            lease.applyWindowState(runtime, window.windowId, patch)
            val applied = window.peekWindowForm()
            // Ignore only this command's own stable lifecycle fields when rechecking the admission predicate.
            admittedForm = { current ->
                if (current === applied) admittedView else previous(current.toMutableMap().apply {
                    patch.keys.forEach { field ->
                        if (current[field] == applied[field] && current.containsKey(field) == applied.containsKey(field)) {
                            if (field in before) put(field, before[field]) else remove(field)
                        }
                    }
                })
            }
        }
    }

    private suspend fun executeGroup(runtime: ForgeRuntime, window: WindowContext, source: DataSourceContext,
        root: MutationCommandDef, extras: Map<String, Any?>, confirm: (suspend (String) -> Boolean)?,
        lease: CommandLease): MutationCommandResult {
        val predicate = PhasePredicate(runtime, window, source, lease)
        fun current() = lease.admitted() && lease.presentationCurrent()
        fun eligible() = current() && predicate.allows(root.validateWhen)
        if (!eligible()) {
            val message = root.invalidMessage ?: "This action is not currently valid."
            lease.settle(MutationCommandState(phase = MutationCommandPhase.Failed, error = message, message = message,
                writerStatus = MutationWriterStatus.NotInvoked))
            return MutationCommandResult(false, "invalid", lease.rootInvocationId, message)
        }

        val members = checkNotNull(root.group)
        fun enabled(member: MutationGroupMemberDef) = predicate.allows(member.condition)
        val sources by lazy { mutationActionSources(runtime, window, source) }
        val ready = mutableListOf<Pair<MutationGroupMemberDef, PreparedGroupWriter>>()
        var preflightMember: String? = null
        try {
            // A group has no target to select from the parameter envelope. Keep
            // authored datasource scopes alongside legacy unscoped bindings.
            val scopedBindings = ParameterResolver().resolve(root.parameters, source).inbound
            val rootBindings = mutationTargetParameters((scopedBindings - "") + scopedBindings[""].orEmpty())
            if (!root.prepare.isNullOrBlank() || members.any(::enabled)) {
                confirmCommand(lease, resolveConfirmation(root, extras), confirm)?.let { return it.copy(invocationId = lease.rootInvocationId) }
            }
            if (!eligible()) return finishGroup(runtime, window, source, root, lease)
            val submissions = root.prepare?.takeIf(String::isNotBlank)?.let { hook ->
                val mapped = prepareWithHook(window, source, root, hook, rootBindings, extras, sources)
                val ids = members.map { checkNotNull(it.command.commandId).trim() }.toSet()
                require(mapped.keys.all(ids::contains) && mapped.values.all { it is Map<*, *> }) {
                    "Group preparation must return parameter maps keyed by declared member IDs."
                }
                mapped
            }
            val commonInputs = if (submissions == null) deepMerge(rootBindings, extras) else emptyMap()
            for (member in members) {
                if (!eligible()) return finishGroup(runtime, window, source, root, lease)
                val command = member.command
                val id = checkNotNull(command.commandId).trim()
                if (!enabled(member) || (submissions != null && id !in submissions)) {
                    lease.memberResults[id] = MutationCommandResult(false, "skipped")
                    continue
                }
                if (!predicate.allows(command.validateWhen)) {
                    val invalid = MutationCommandResult(false, "invalid",
                        error = command.invalidMessage ?: "This action is not currently valid.")
                    lease.memberResults[id] = invalid
                    return finishGroup(runtime, window, source, root, lease, preflightFailure = invalid)
                }
                preflightMember = id
                val memberExtras = if (submissions == null) commonInputs else JsonUtil.asStringMap(submissions[id])
                val parameters = prepareBase(window, source, command, memberExtras, false) { sources }
                val hook = command.prepare?.takeIf(String::isNotBlank)
                val prepared = if (hook == null) parameters else prepareWithHook(window, source, command, hook, parameters, memberExtras, sources)
                val target = window.contextOrNull(command.dataSourceRef.trim())
                    ?: error("Group writer is unavailable: ${command.dataSourceRef}.")
                val invocation = UUID.randomUUID().toString()
                val submitted = prepared.toMutableMap()
                command.invocationParameter?.trim()?.takeIf(String::isNotEmpty)?.let { submitted[it] = invocation }
                val captured = target.snapshotCommandParameters(submitted)
                val ids = command.receiptIdentity?.takeIf { it.generated != true }?.capture(captured)
                ready += member to PreparedGroupWriter(target, captured, ids, invocation)
            }
        } catch (error: Exception) {
            if (error is CancellationException) throw error
            val message = error.message ?: "Invalid group preparation."
            preflightMember?.let { lease.memberResults[it] = MutationCommandResult(false, "invalid_payload", error = message, cause = error) }
            return finishGroup(runtime, window, source, root, lease,
                preflightFailure = MutationCommandResult(false, "invalid_payload", error = message, cause = error))
        }

        if (ready.isNotEmpty() && eligible()) {
            val transports = ready.map { (_, writer) -> transportKey(window.windowId, writer.target.dataSourceRef) }
            val reserved = mutex.withLock {
                if (transports.any(transportGuards::containsKey)) false
                else {
                    transports.forEach { transportGuards[it] = lease.key }
                    true
                }
            }
            if (!reserved) return finishGroup(runtime, window, source, root, lease,
                preflightFailure = MutationCommandResult(false, "transport_busy", error = "Another command is using a group writer."))

            predicate.apply(root.pendingState)
            lease.publish(MutationCommandState(phase = MutationCommandPhase.Pending, guarded = true, pending = true,
                retryAllowed = false, message = "Saving…", writerStatus = MutationWriterStatus.NotInvoked))
            try {
                supervisorScope {
                    ready.map { (member, writer) ->
                        async {
                            val command = member.command
                            val id = checkNotNull(command.commandId).trim()
                            val result = if (!eligible()) MutationCommandResult(false, "not_invoked")
                            else if (!enabled(member)) MutationCommandResult(false, "skipped")
                            else executeOne(runtime, window, source, command, emptyMap(), null, lease,
                                { eligible() && enabled(member) && predicate.allows(command.validateWhen) }, preparedGroup = writer)
                            lease.memberResults[id] = result
                        }
                    }.awaitAll()
                }
            } finally {
                withContext(NonCancellable) {
                    mutex.withLock {
                        ready.forEach { (member, writer) ->
                            val outcome = lease.memberResults[checkNotNull(member.command.commandId).trim()]
                            if (outcome?.status != "indeterminate") transportGuards.remove(
                                transportKey(window.windowId, writer.target.dataSourceRef), lease.key)
                        }
                    }
                }
            }
        }
        return finishGroup(runtime, window, source, root, lease)
    }

    private suspend fun finishGroup(runtime: ForgeRuntime, window: WindowContext, source: DataSourceContext,
        root: MutationCommandDef, lease: CommandLease, refresh: Boolean = true, preflightFailure: MutationCommandResult? = null): MutationCommandResult {
        val members = checkNotNull(root.group)
        val results = members.associate { member ->
            val id = checkNotNull(member.command.commandId).trim()
            val label = member.command.label?.takeIf(String::isNotBlank) ?: id
            val outcome = lease.memberResults[id] ?: MutationCommandResult(false, "not_invoked")
            id to MutationGroupMemberOutcome(label, outcome.status, outcome.invocationId.takeIf(String::isNotBlank),
                outcome.receiptRows, outcome.error, outcome.cause)
        }
        val active = results.values.filter { it.status != "skipped" }
        val confirmed = active.count { it.status == "succeeded" }
        val unknown = active.any { it.status == "indeterminate" }
        val partial = confirmed > 0 && confirmed < active.size
        val status = when {
            preflightFailure != null -> preflightFailure.status
            unknown -> "indeterminate"
            partial -> "partial_failure"
            confirmed > 0 -> "succeeded"
            active.isEmpty() -> "skipped"
            active.all { it.status == "not_invoked" } -> "superseded"
            else -> "failed"
        }
        val summary = members.joinToString("\n") { member ->
            val id = checkNotNull(member.command.commandId).trim()
            val outcome = results.getValue(id)
            val summary = when (outcome.status) {
                "succeeded" -> "Saved."
                "skipped" -> "Skipped."
                "not_invoked" -> "Scope changed before dispatch."
                else -> outcome.error ?: "The write did not complete."
            }
            "${outcome.label}: $summary"
        }
        val message = listOfNotNull(preflightFailure?.error, summary).joinToString("\n")
        val phase = when (status) {
            "indeterminate" -> MutationCommandPhase.Indeterminate
            "partial_failure" -> MutationCommandPhase.PartialFailure
            "succeeded" -> MutationCommandPhase.Succeeded
            "skipped" -> MutationCommandPhase.Idle
            else -> MutationCommandPhase.Failed
        }
        fun current() = lease.admitted() && lease.presentationCurrent()
        val patch = when (status) {
            "indeterminate" -> root.indeterminateState
            "succeeded" -> root.successState
            "skipped" -> JsonObject(emptyMap())
            "superseded" -> if (lease.last.pending) root.errorState else JsonObject(emptyMap())
            else -> root.errorState
        }
        val primary = active.firstOrNull { it.status == if (unknown) "indeterminate" else "failed" }
            ?: active.firstOrNull { it.status != "succeeded" }
        val guarded = unknown || partial
        val writer = when {
            unknown -> MutationWriterStatus.Indeterminate
            confirmed > 0 -> MutationWriterStatus.Succeeded
            lease.attempted -> MutationWriterStatus.Failed
            else -> MutationWriterStatus.NotInvoked
        }
        var state = MutationCommandState(phase = phase, guarded = guarded, retryAllowed = !guarded,
            message = message, error = preflightFailure?.error ?: primary?.error, writerStatus = writer, members = results)
        lease.last = state
        if (current()) lease.applyWindowState(runtime, window.windowId, patch)
        if (refresh && confirmed > 0) {
            val warnings = if (current()) {
                var sourceReset = false
                synchronize(window, null, root, null, source.dataSourceRef, lease.presentationCurrent,
                    onSelectionReset = { ref -> if (ref == source.dataSourceRef) sourceReset = true }) {
                    lease.presentationCurrent() && (if (sourceReset) lease.ownerCurrent() else lease.admitted())
                }
            } else listOf(MutationCommandWarning("refresh", message = "The original command presentation is no longer current."))
            state = state.copy(warnings = warnings, syncStatus = if (warnings.isEmpty()) MutationSyncStatus.Succeeded else MutationSyncStatus.PartialFailure)
        }
        lease.settle(state)
        return MutationCommandResult(lease.attempted, status, lease.rootInvocationId, state.error,
            state.warnings, preflightFailure?.cause ?: primary?.cause, members = results)
    }

    private suspend fun executeOrdered(runtime: ForgeRuntime, window: WindowContext, source: DataSourceContext,
        root: MutationCommandDef, extras: Map<String, Any?>, confirm: (suspend (String) -> Boolean)?,
        lease: CommandLease): MutationCommandResult {
        val predicate = PhasePredicate(runtime, window, source, lease)
        fun eligible() = lease.admitted() && predicate.allows(root.validateWhen)
        fun forwardEligible() = eligible() && lease.presentationCurrent()
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
                predicate.apply(root.cleanupState)
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
        predicate.apply(root.pendingState)
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

    private data class PreparedGroupWriter(
        val target: DataSourceContext, val parameters: Map<String, Any?>, val submittedIds: Set<Any>?, val invocation: String
    )

    private fun mutationActionSources(runtime: ForgeRuntime, window: WindowContext, source: DataSourceContext): JsonObject =
        runtime.actionSnapshots(runtime.registeredWindowDataSources(window.windowId) + (source.dataSourceRef to source))

    private suspend fun writerBindings(command: MutationCommandDef, source: DataSourceContext): Map<String, Any?> {
        val resolved = ParameterResolver().resolve(command.parameters, source)
        return mutationTargetParameters(resolved.inbound[command.dataSourceRef.trim()] ?: resolved.inbound[""] ?: emptyMap())
    }

    private fun MutationCommandDef.timeout(): Long = (timeoutMs ?: 30_000).coerceAtLeast(1_000).toLong()

    private suspend fun prepareBase(window: WindowContext, source: DataSourceContext, command: MutationCommandDef,
        extras: Map<String, Any?>, ordered: Boolean, sources: () -> JsonObject): Map<String, Any?> {
        val base = writerBindings(command, source)
        return withTimeoutOrNull(command.timeout()) {
            deepMerge(base, if (command.payload == null && ordered) extras - "steps"
                else preparePayload(window, source, command.payload, extras, sources))
        } ?: error("Command payload preparation timed out. The writer was not invoked.")
    }

    private suspend fun prepareWithHook(window: WindowContext, source: DataSourceContext, command: MutationCommandDef,
        hook: String, parameters: Map<String, Any?>, extras: Map<String, Any?>, sources: JsonObject): Map<String, Any?> =
        withTimeoutOrNull(command.timeout()) {
            val result = invokePreparation(window, source, hook, JsonObject(mapOf(
                "parameters" to JsonUtil.anyToElement(parameters), "extras" to JsonUtil.anyToElement(extras)
            )), sources)
            require(result is JsonObject) { "Command preparation must return a parameter map." }
            JsonUtil.asStringMap(JsonUtil.elementToAny(result))
        } ?: error("Command preparation timed out. The writer was not invoked.")

    private suspend fun executeOne(runtime: ForgeRuntime, window: WindowContext, source: DataSourceContext,
        command: MutationCommandDef, extras: Map<String, Any?>, confirm: (suspend (String) -> Boolean)?,
        lease: CommandLease, authorized: () -> Boolean, preparedGroup: PreparedGroupWriter? = null,
        onReceipt: ((String, JsonArray) -> Unit)? = null): MutationCommandResult {
        val targetRef = command.dataSourceRef.trim()
        val groupMember = preparedGroup != null
        suspend fun publish(state: MutationCommandState) { if (!groupMember) lease.publish(state) }
        suspend fun settle(state: MutationCommandState) { if (!groupMember) lease.settle(state) }
        suspend fun settle(transport: String, state: MutationCommandState) { if (!groupMember) lease.settle(transport, state) }
        if (!authorized()) {
            val message = command.invalidMessage ?: "This action is not currently valid."
            if (!lease.ordered && !groupMember) lease.applyWindowState(runtime, window.windowId, command.errorState)
            settle(MutationCommandState(
                phase = MutationCommandPhase.Failed,
                error = message,
                message = message,
                writerStatus = MutationWriterStatus.NotInvoked
            ))
            return MutationCommandResult(false, "invalid", error = message)
        }
        val timeout = command.timeout()
        val parameters = preparedGroup?.parameters?.toMutableMap() ?: try {
            fun capture() = mutationActionSources(runtime, window, source)
            val initialSources by lazy { capture() }
            val prepared = prepareBase(window, source, command, extras, lease.ordered) { initialSources }
            val confirmation = if (lease.ordered) "" else resolveConfirmation(command, extras)
            confirmCommand(lease, confirmation, confirm)?.let { return it }
            check(authorized()) { "Authorization or command eligibility changed before dispatch." }
            val hook = command.prepare?.takeIf(String::isNotBlank)
            if (hook == null) prepared.toMutableMap() else {
                val input = prepareWithHook(window, source, command, hook, prepared, extras,
                    if (confirmation.isBlank()) initialSources else capture())
                check(authorized()) { "Authorization or command eligibility changed before dispatch." }
                input.toMutableMap()
            }
        } catch (cancelled: CancellationException) {
            withContext(NonCancellable) { settle(MutationCommandState(writerStatus = MutationWriterStatus.NotInvoked)) }
            throw cancelled
        } catch (error: Exception) {
            val message = error.message ?: "Invalid command preparation."
            if (!lease.ordered && !groupMember && lease.admitted()) lease.applyWindowState(runtime, window.windowId, command.errorState)
            settle(MutationCommandState(phase = MutationCommandPhase.Failed, error = message, message = message, writerStatus = MutationWriterStatus.NotInvoked))
            return MutationCommandResult(false, "invalid_payload", error = message, cause = error)
        }
        val target = preparedGroup?.target ?: window.contextOrNull(targetRef)
        if (target == null) {
            val message = "Command datasource is unavailable: $targetRef"
            settle(MutationCommandState(
                phase = MutationCommandPhase.Failed,
                error = message,
                message = message,
                writerStatus = MutationWriterStatus.NotInvoked
            ))
            return MutationCommandResult(false, "failed", error = message)
        }
        val transport = transportKey(window.windowId, targetRef)
        val transportAcquired = groupMember || mutex.withLock {
            if (transport in transportGuards) false else {
                transportGuards[transport] = lease.key
                true
            }
        }
        if (!transportAcquired) {
            val message = "Another command is using this datasource."
            settle(MutationCommandState(message = message, writerStatus = MutationWriterStatus.NotInvoked))
            return MutationCommandResult(false, "transport_busy", error = message)
        }

        if (!authorized()) {
            val message = "Authorization or command eligibility changed before dispatch."
            settle(transport, MutationCommandState(phase = MutationCommandPhase.Failed, message = message,
                error = message, writerStatus = MutationWriterStatus.NotInvoked))
            return MutationCommandResult(false, "invalid", error = message)
        }
        val rootWriter = lease.ordered && command === lease.root
        val invocationId = preparedGroup?.invocation ?: if (rootWriter) lease.rootInvocationId else UUID.randomUUID().toString()
        command.invocationParameter?.trim()?.takeIf(String::isNotEmpty)?.let { parameters[it] = invocationId }
        // A checked collection must correlate the IDs from the exact final payload sent to the writer.
        val identity = command.receiptIdentity
        val captured: Map<String, Any?>?
        val submittedIds: Set<Any>?
        val verification: PreparedMutationReadback?
        val readTransport = runtime.selectionReadTransport
        try {
            captured = preparedGroup?.parameters ?: if (identity != null && (identity.generated != true || command.reconcile?.verify != null))
                target.snapshotCommandParameters(parameters) else null
            submittedIds = if (preparedGroup != null) preparedGroup.submittedIds else captured?.let { identity?.capture(it) }
            verification = PreparedMutationReadback.prepare(command, captured ?: parameters, source, runtime.parameterResolver)
        } catch (cancelled: CancellationException) {
            withContext(NonCancellable) { settle(transport, MutationCommandState(writerStatus = MutationWriterStatus.NotInvoked)) }
            throw cancelled
        } catch (error: Exception) {
            val message = error.message ?: "Invalid submitted identities."
            if (!lease.ordered && !groupMember && lease.admitted()) lease.applyWindowState(runtime, window.windowId, command.errorState)
            settle(transport, MutationCommandState(phase = MutationCommandPhase.Failed, error = message,
                message = message, writerStatus = MutationWriterStatus.NotInvoked))
            return MutationCommandResult(false, "invalid_payload", error = message, cause = error)
        }
        if (rootWriter) lease.rootDispatched = true
        if (!lease.ordered && !groupMember) lease.applyWindowState(runtime, window.windowId, command.pendingState)
        publish(MutationCommandState(
            phase = MutationCommandPhase.Pending,
            guarded = true,
            pending = true,
            retryAllowed = false,
            message = "Saving…",
            invocationId = invocationId,
            writerStatus = MutationWriterStatus.Pending
        ))
        if (verification != null && (!authorized() || !verification.scopeMatches(source, runtime.parameterResolver))) {
            if (rootWriter) lease.rootDispatched = false
            if (!lease.ordered && lease.admitted()) lease.applyWindowState(runtime, window.windowId, command.errorState)
            val message = "The verification scope changed before submission."
            settle(transport, MutationCommandState(phase = MutationCommandPhase.Failed, error = message,
                message = message, writerStatus = MutationWriterStatus.NotInvoked))
            return MutationCommandResult(false, "invalid_payload", error = message)
        }
        val requiresWriterReceipt = lease.requiresReceipt || command.successFormState.isNotEmpty()
        val writer = try {
            // A confirmation or transport lease can suspend. Admit the exact reviewed selection
            // and enqueue its prepared input under the form's file-selection lock.
            val dispatch = if (lease.cleaningUp || lease.submittedFields.isEmpty()) target.dispatchCommand(parameters, requiresWriterReceipt, captured, rawReceipt = identity != null)
            else synchronized(source.form) {
                if (source.submittedFilesCurrent(lease.submittedFields)) target.dispatchCommand(parameters, requiresWriterReceipt, captured, rawReceipt = identity != null) else null
            }
            if (dispatch == null) {
                if (rootWriter) lease.rootDispatched = false
                val message = "The selected file changed before dispatch. Review the form and try again."
                if (!lease.ordered && !groupMember) lease.applyWindowState(runtime, window.windowId, command.errorState)
                settle(transport, MutationCommandState(phase = MutationCommandPhase.Failed, message = message,
                    error = message, writerStatus = MutationWriterStatus.NotInvoked))
                return MutationCommandResult(false, "invalid", error = message)
            }
            lease.attempted = true
            val receipt = withTimeoutOrNull(timeout) { target.awaitPreparedResult(dispatch) }
            when {
                receipt == null -> MutationWriterOutcome.Indeterminate()
                requiresWriterReceipt && (!receipt.recordsConfirmed || uncertainTransport(receipt.cause)) ->
                    MutationWriterOutcome.Indeterminate(receipt.cause, if (command.checksReceipt && !lease.cleaningUp && !receipt.recordsConfirmed)
                        "The writer did not provide a valid invocation receipt. Verify before retrying." else null)
                receipt.cause is java.net.SocketTimeoutException || receipt.cause is java.util.concurrent.TimeoutException ->
                    MutationWriterOutcome.Indeterminate(receipt.cause)
                receipt.error != null -> MutationWriterOutcome.Failed(receipt.error, receipt.cause)
                else -> confirmedWriterOutcome(command, receipt.rows, lease.cleaningUp, submittedIds)
            }
        } catch (cancelled: CancellationException) {
            withContext(NonCancellable) {
                if (groupMember) lease.memberResults[checkNotNull(command.commandId).trim()] =
                    MutationCommandResult(true, "indeterminate", invocationId, "Command was cancelled after dispatch. Verify its outcome.", cause = cancelled)
                publish(MutationCommandState(phase = MutationCommandPhase.Indeterminate, guarded = true,
                    retryAllowed = false, invocationId = invocationId, writerStatus = MutationWriterStatus.Indeterminate,
                    message = "Command was cancelled after dispatch. Verify its outcome."))
                if (!groupMember && lease.admitted()) lease.applyWindowState(runtime, window.windowId, command.indeterminateState)
            }
            throw cancelled
        } catch (error: Exception) {
            // Dispatch has started and its completion receipt is unavailable.
            MutationWriterOutcome.Indeterminate(error)
        }
        if (groupMember) {
            return when (writer) {
                is MutationWriterOutcome.Succeeded -> MutationCommandResult(true, "succeeded", invocationId, receiptRows = writer.records)
                is MutationWriterOutcome.Failed -> MutationCommandResult(true, "failed",
                    invocationId, writer.message, cause = writer.cause)
                is MutationWriterOutcome.Indeterminate -> MutationCommandResult(true, "indeterminate", invocationId,
                    writer.message ?: "The writer outcome is unknown. Verify before retrying.", cause = writer.cause)
            }
        }
        if (verification != null && writer is MutationWriterOutcome.Succeeded) {
            val records = checkNotNull(writer.records)
            val identities = checkNotNull(verifiedIdentityRows(command, records))
            lease.rootAcknowledged = true
            val pending = AcknowledgedReadback(lease, source, target, verification, readTransport, invocationId, records, identities)
            mutex.withLock {
                readbacks[lease.key] = pending
                transportGuards.remove(transport, lease.key)
            }
            return verifyReadback(runtime, window, pending)
        }
        val lostScope = !lease.admitted()
        val terminalReceipt = rootWriter || lease.closing || (command === lease.root && command.checksReceipt)
        if (lease.requiresReceipt && writer !is MutationWriterOutcome.Indeterminate && (lostScope || (terminalReceipt && !lease.presentationCurrent()))) {
            val committed = terminalReceipt && writer is MutationWriterOutcome.Succeeded
            val failure = writer as? MutationWriterOutcome.Failed
            val message = if (committed) "Saved. The original presentation is no longer current."
                else "The command scope changed after dispatch. Remaining steps were skipped."
            val warnings = if (committed) listOf(MutationCommandWarning("synchronize", targetRef, message)) else emptyList()
            lease.rootAcknowledged = committed
            settle(transport, MutationCommandState(phase = if (committed) MutationCommandPhase.Succeeded else MutationCommandPhase.Failed,
                message = message, error = failure?.message, invocationId = invocationId,
                writerStatus = if (committed) MutationWriterStatus.Succeeded else if (terminalReceipt) MutationWriterStatus.Failed else MutationWriterStatus.NotInvoked,
                syncStatus = if (committed) MutationSyncStatus.PartialFailure else MutationSyncStatus.NotStarted, warnings = warnings))
            val status = if (lease.closing && committed) "succeeded" else "superseded"
            return MutationCommandResult(true, status, invocationId, error = failure?.message, warnings = warnings, cause = failure?.cause)
        }
        if (lostScope && !lease.ordered) {
            val message = "Authorization context changed after dispatch. Verify the outcome."
            publish(MutationCommandState(phase = MutationCommandPhase.Indeterminate, guarded = true, retryAllowed = false,
                message = message, invocationId = invocationId, writerStatus = MutationWriterStatus.Indeterminate))
            return MutationCommandResult(true, "indeterminate", invocationId, message)
        }
        return when (writer) {
            is MutationWriterOutcome.Failed -> {
                if (!lease.ordered && !groupMember) lease.applyWindowState(runtime, window.windowId, command.errorState)
                settle(transport, MutationCommandState(
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
                val message = writer.message ?: "The writer outcome is unknown because the client stopped waiting."
                publish(MutationCommandState(
                    phase = MutationCommandPhase.Indeterminate,
                    guarded = true,
                    retryAllowed = false,
                    message = message,
                    invocationId = invocationId,
                    writerStatus = MutationWriterStatus.Indeterminate
                ))
                MutationCommandResult(true, "indeterminate", invocationId, error = writer.message, cause = writer.cause)
            }
            is MutationWriterOutcome.Succeeded -> {
                if (onReceipt != null) onReceipt(invocationId, checkNotNull(writer.records))
                completeWriter(runtime, window, source, target, command, lease, invocationId, writer.records, transport)
            }
        }
    }

    private class AcknowledgedReadback(
        val lease: CommandLease, val source: DataSourceContext, val target: DataSourceContext,
        val verification: PreparedMutationReadback, val transport: Any?, val invocationId: String,
        val records: JsonArray, val identities: JsonArray
    ) {
        val presentation get() = lease.origin
        var verifying = true
        var retryable = true
    }

    internal suspend fun retireReadbacks(windowId: String, presentation: DialogState? = null) = mutex.withLock {
        val retired = readbacks.entries.filter { (_, pending) ->
            pending.lease.windowId == windowId && !pending.verifying &&
                (presentation == null || pending.presentation === presentation)
        }
        for ((key, _) in retired) {
            readbacks.remove(key)
            commandGuards.remove(key)?.let(activeGroups::remove)
            stateSignal(key).set(MutationCommandState())
        }
    }

    private suspend fun retryReadback(runtime: ForgeRuntime, window: WindowContext, pending: AcknowledgedReadback): MutationCommandResult {
        val lease = pending.lease
        mutex.withLock {
            if (readbacks[lease.key] !== pending || pending.verifying) return MutationCommandResult(false, "suppressed")
            if (!pending.retryable) return MutationCommandResult(true, "verification_failed", pending.invocationId)
            pending.verifying = true
        }
        try {
            val result = verifyReadback(runtime, window, pending)
            if (result.status == "succeeded" && lease.admitted() && lease.presentationCurrent()) {
                pending.source.clearSubmittedFormFields(lease.submittedFields.filterKeys { it in lease.root.clearFormFields }) {
                    lease.admitted() && lease.presentationCurrent()
                }
                if (lease.closeDialogId != null && lease.origin != null) runtime.closeDialog(window.windowId, lease.closeDialogId, lease.origin)
            }
            return result
        } finally {
            withContext(NonCancellable) { lease.finish() }
        }
    }

    private suspend fun verifyReadback(runtime: ForgeRuntime, window: WindowContext, pending: AcknowledgedReadback): MutationCommandResult {
        val lease = pending.lease
        val verification = pending.verification
        fun ownerCurrent() = lease.ownerCurrent() && lease.presentationCurrent()
        fun current() = lease.admitted() && lease.presentationCurrent() &&
            runtime.selectionReadTransport === pending.transport &&
            window.metadata.peek()?.dataSources?.get(verification.reader) === verification.readerDefinition &&
            verification.scopeMatches(pending.source, runtime.parameterResolver)

        val result = try {
            if (!current()) null else {
                lease.publish(MutationCommandState(phase = MutationCommandPhase.Pending, guarded = true, pending = true,
                    retryAllowed = false, invocationId = pending.invocationId, writerStatus = MutationWriterStatus.Succeeded,
                    message = "Verifying saved data…"))
                if (!current()) null else {
                    val rows = withTimeout(lease.root.timeout()) {
                        runtime.readMutationVerificationRows(window, verification.reader, verification.inputs(pending.identities), ::current)
                    }
                    rows.takeIf { current() && verification.matches(it, pending.identities) }
                }
            }
        } catch (timeout: TimeoutCancellationException) {
            return failReadback(pending, ownerCurrent(), current(), "The verification read timed out.", timeout)
        } catch (cancelled: CancellationException) {
            withContext(NonCancellable) {
                failReadback(pending, ownerCurrent(), current(), "The verification read was cancelled.", cancelled)
            }
            throw cancelled
        } catch (error: Exception) {
            return failReadback(pending, ownerCurrent(), current(), "The verification reader could not return records.", error)
        }
        if (result == null || !current()) {
            return failReadback(pending, ownerCurrent(), current(), "The reader did not confirm the submitted rows.")
        }
        mutex.withLock { if (readbacks[lease.key] === pending) readbacks.remove(lease.key) }
        return completeWriter(runtime, window, pending.source, pending.target, lease.root, lease, pending.invocationId,
            pending.records, null, readbackRows = result, verificationCurrent = ::current).also { outcome ->
            if (outcome.status == "succeeded") pending.presentation?.verifiedSelection?.dispose()
        }
    }

    private suspend fun failReadback(pending: AcknowledgedReadback, ownerCurrent: Boolean, current: Boolean,
        issue: String, cause: Throwable? = null): MutationCommandResult {
        val lease = pending.lease
        val message = if (current) "Saved. $issue" else "Saved. The original verification scope is no longer current."
        val warnings = listOf(MutationCommandWarning("verify", pending.verification.reader, message))
        mutex.withLock {
            if (readbacks[lease.key] === pending) {
                pending.retryable = current
                if (!ownerCurrent) readbacks.remove(lease.key)
            }
        }
        lease.settle(if (ownerCurrent) MutationCommandState(phase = MutationCommandPhase.VerificationFailed, guarded = true,
            retryAllowed = current, invocationId = pending.invocationId, writerStatus = MutationWriterStatus.Succeeded,
            syncStatus = MutationSyncStatus.VerificationFailed, message = message, error = message, warnings = warnings)
        else MutationCommandState())
        return MutationCommandResult(true, "verification_failed", pending.invocationId, message, warnings, cause,
            writerRecords = if (current && lease.admitted() && lease.presentationCurrent()) pending.records else null)
    }

    private suspend fun completeWriter(runtime: ForgeRuntime, window: WindowContext, source: DataSourceContext,
        target: DataSourceContext, command: MutationCommandDef, lease: CommandLease, invocationId: String,
        records: JsonArray?, transport: String?, readbackRows: List<Map<String, Any?>>? = null,
        verificationCurrent: (() -> Boolean)? = null): MutationCommandResult {
        val targetRef = target.dataSourceRef
        if (verificationCurrent?.invoke() == false) {
            lease.settle(MutationCommandState())
            return MutationCommandResult(true, "superseded", invocationId)
        }
        val formConflict = if (command === lease.root && command.successFormState.isNotEmpty()) {
            synchronized(runtime) {
                source.applySuccessFormState(command.successFormState, lease.submittedFields) {
                    verificationCurrent?.invoke() ?: (lease.admitted() && lease.presentationCurrent())
                }
            }
        } else false
        val warnings = mutableListOf<MutationCommandWarning>()
        val patch = command.successState.toMutableMap()
        for ((field, selectors) in command.resultState) {
            val value = selectors.firstNotNullOfOrNull { SelectorUtil.resolve(records, it) as? JsonElement }
            if (value == null) warnings += MutationCommandWarning("resultState", message = "Writer receipt omitted the value for $field.")
            patch[field] = value ?: JsonNull
        }
        if (verificationCurrent?.invoke() != false) lease.applyWindowState(runtime, window.windowId, JsonObject(patch))
        try {
            warnings += synchronize(window, target, command, if (lease.ordered || command.checksReceipt) records else null,
                source.dataSourceRef, lease.presentationCurrent) {
                verificationCurrent?.invoke() ?: (lease.admitted() && (!lease.requiresReceipt || lease.presentationCurrent()))
            }
        } catch (cancelled: CancellationException) {
            withContext(NonCancellable) { lease.settle(transport, MutationCommandState(
                phase = MutationCommandPhase.Succeeded, invocationId = invocationId, writerStatus = MutationWriterStatus.Succeeded,
                syncStatus = MutationSyncStatus.PartialFailure, message = "Saved. Refresh was cancelled.")) }
            throw cancelled
        }
        val sync = if (warnings.isEmpty()) MutationSyncStatus.Succeeded else MutationSyncStatus.PartialFailure
        val message = when {
            warnings.isNotEmpty() -> "Saved. Some related data could not be refreshed."
            formConflict && lease.admitted() && lease.presentationCurrent() ->
                "Saved the submitted version. Your newer changes are still in the form."
            else -> "Completed"
        }
        val canPublish = verificationCurrent?.invoke() != false
        lease.settle(transport, if (canPublish) MutationCommandState(
            phase = MutationCommandPhase.Succeeded,
            message = message,
            invocationId = invocationId,
            writerStatus = MutationWriterStatus.Succeeded,
            syncStatus = sync,
            warnings = warnings
        ) else MutationCommandState())
        return if (!canPublish || verificationCurrent?.invoke() == false) MutationCommandResult(true, "superseded", invocationId, warnings = warnings)
        else MutationCommandResult(true, "succeeded", invocationId, warnings = warnings,
            writerRecords = records.takeIf { readbackRows != null }, readbackRows = readbackRows)
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

    private suspend fun invokePreparation(window: WindowContext, source: DataSourceContext,
        handler: String, props: JsonObject, snapshots: JsonObject): JsonElement? {
        val metadata = window.metadata.peek() ?: error("Window metadata is unavailable.")
        val code = metadata.actions?.code?.takeIf { it.isNotBlank() } ?: error("Command preparation handler is unavailable: $handler")
        return UIActionProjection.invoke(code, handler, metadata.actionNamespace(handler), source.dataSourceRef, snapshots,
            JsonUtil.anyToElement(window.peekWindowForm()) as JsonObject, props, JsonObject(metadata.authorizationSnapshot), readOnly = true, windowKey = metadata.windowKey,
            actionNamespaces = metadata.actionNamespaces).result
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
        target: DataSourceContext?,
        command: MutationCommandDef,
        invocationRows: JsonArray?,
        sourceRef: String,
        presentationCurrent: () -> Boolean,
        onSelectionReset: (String) -> Unit = {},
        current: () -> Boolean
    ): List<MutationCommandWarning> {
        val warnings = mutableListOf<MutationCommandWarning>()
        if (!current()) return listOf(MutationCommandWarning("authorization", message = "Authorization changed before synchronization."))
        command.reconcile?.takeIf { it.verify == null && presentationCurrent() }?.let { spec ->
            runCatching {
                val writer = checkNotNull(target)
                val destinationRef = spec.dataSourceRef?.trim().orEmpty().ifBlank { writer.dataSourceRef }
                val destination = window.contextOrNull(destinationRef)
                    ?: error("Reconciliation datasource is unavailable: $destinationRef")
                if (spec.mode.equals("refetch", ignoreCase = true)) {
                    awaitRefresh(destination, true, current)
                } else {
                    val rows = invocationRows?.map { JsonUtil.asStringMap(JsonUtil.elementToAny(it)) } ?: writer.collection.peek()
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
                val original = presentationCurrent()
                if (!original && refresh.dataSourceRef == sourceRef) return@runCatching
                if (refresh.clearSelection && original) {
                    context.resetSelection()
                    onSelectionReset(refresh.dataSourceRef)
                }
                awaitRefresh(context, refresh.bypassCache, current)
            }.onFailure {
                if (it is CancellationException) throw it
                warnings += MutationCommandWarning("refresh", refresh.dataSourceRef, it.message ?: "Refresh failed")
            }
        }
        return warnings
    }

    private suspend fun awaitRefresh(context: DataSourceContext, bypassCache: Boolean, current: () -> Boolean) {
        val result = withTimeoutOrNull(30_000) { context.refreshAndAwait(bypassCache, current) } ?: error("Refresh outcome is unknown")
        result.cause?.let { throw it }
        result.error?.let { error(it) }
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

private fun confirmedWriterOutcome(command: MutationCommandDef, rows: JsonArray, cleanup: Boolean, submittedIds: Set<Any>?): MutationWriterOutcome {
    val accepts = command.acceptedReceipt
    if (cleanup || !command.checksReceipt) return MutationWriterOutcome.Succeeded(rows)
    val rejection = command.rejectedReceipt
    val rejected = if (rejection == null) false else rejection(rows)
    if (rejected == true) {
        val message = (rows.firstOrNull() as? JsonObject)?.get("message") as? JsonPrimitive
        return MutationWriterOutcome.Failed(message?.takeIf { it.isString && it.content.isNotBlank() }?.content
            ?: "The producer rejected the write.")
    }
    if (rejected == false && (accepts == null || accepts(rows) == true) && command.receiptIdentity?.let { identity -> verifiedIdentityRows(command, rows)?.let { identity.matches(it, submittedIds) } == true } != false)
        return MutationWriterOutcome.Succeeded(rows)
    return MutationWriterOutcome.Indeterminate(message = "The producer did not confirm the write. Verify its outcome before retrying.")
}

private fun verifiedIdentityRows(command: MutationCommandDef, rows: JsonArray): JsonArray? {
    val reconcile = command.reconcile ?: return rows
    val path = reconcile.resultPath.takeIf { reconcile.verify != null } ?: return rows
    return readbackValue(rows, path) as? JsonArray
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

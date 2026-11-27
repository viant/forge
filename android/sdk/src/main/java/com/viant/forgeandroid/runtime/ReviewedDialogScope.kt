package com.viant.forgeandroid.runtime

import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.util.concurrent.ConcurrentHashMap

@Serializable
data class MutationReviewedScopeDef(
    val parameter: String,
    val source: String,
    val field: String,
    val dataSourceRef: String? = null
) {
    @Transient internal val parameterPath = parameter.split('.')
    @Transient internal val fieldPath = field.split('.')
    @Transient internal val valid = parameterPath.all(::safeFormField) && fieldPath.all(::safeFormField) && when (source) {
        "windowForm" -> dataSourceRef.isNullOrEmpty()
        "collection", "metrics", "selection" -> dataSourceRef?.isNotBlank() == true
        else -> false
    }

    internal fun currentValue(runtime: ForgeRuntime, window: WindowContext): Any? {
        val store = if (source == "windowForm") window.peekWindowForm() else {
            val owner = runtime.registeredSource(window.windowId, dataSourceRef ?: return null) ?: return null
            when (source) {
                "collection" -> owner.collection.peek()
                "metrics" -> owner.metrics.peek()
                "selection" -> owner.selection.peek().let {
                    mapOf("selected" to it.selected, "selection" to it.selection, "rowIndex" to it.rowIndex)
                }
                else -> return null
            }
        }
        return SelectorUtil.resolveParts(store, fieldPath, null, strictArrayIndex = true)
    }
}

/** Evidence belongs to one opening, before hooks or editable inputs can change it. */
class ReviewedDialogScope private constructor(
    private val dialogId: String,
    private val actor: Actor?,
    private val arguments: Map<String, JsonElement?>
) {
    private val retired = ConcurrentHashMap.newKeySet<String>()
    private val pending = LinkedHashSet<() -> Unit>()
    @Volatile private var ending = false

    @Synchronized internal fun trackPending(settle: () -> Unit) { pending.add(settle) }
    @Synchronized internal fun forgetPending(settle: () -> Unit) { pending.remove(settle) }
    internal fun settleBeforeClose() {
        val actions = synchronized(this) {
            ending = true
            pending.toList().asReversed().also { pending.clear() }
        }
        actions.forEach { it() }
    }

    internal fun current(key: String, bindings: List<MutationReviewedScopeDef>, runtime: ForgeRuntime, window: WindowContext): Boolean {
        if (ending || key in retired || !ownsPresentation(window) || !ownsActor(window)) return false
        return bindings.all { binding ->
            val original = arguments[binding.parameter]
            binding.valid && original != null && sameMutationValue(original, value(binding.currentValue(runtime, window)))
        }
    }

    internal fun ownsPresentation(window: WindowContext) = window.dialogSignal(dialogId).peek().let { it.open && it.reviewedScope === this }
    internal fun ownsActor(window: WindowContext) = actor != null && actor == actor(window.metadata.peek()?.authorizationSnapshot.orEmpty())

    internal fun retire(key: String) { retired.add(key) }

    private data class Actor(val subject: String, val issuer: JsonElement?, val tenantId: JsonElement?)

    companion object {
        internal fun capture(dialog: DialogDef?, ref: String?, args: Map<String, Any?>, authorization: Map<String, JsonElement>): ReviewedDialogScope? {
            val bindings = dialog?.reviewedParameters.orEmpty()
            if (bindings.isEmpty()) return null
            val launch = JsonUtil.asStringMap(args[ref]).ifEmpty { args }
            val values = bindings.associate { binding ->
                val original = if (binding.valid) SelectorUtil.resolveParts(launch, binding.parameterPath, null, strictArrayIndex = true) else null
                binding.parameter to value(original)
            }
            return ReviewedDialogScope(dialog?.id ?: return null, actor(authorization), values)
        }

        private fun actor(snapshot: Map<String, JsonElement>): Actor? {
            val principal = snapshot["principal"] as? JsonObject ?: return null
            val subject = principal["subject"] as? JsonPrimitive ?: return null
            if (!subject.isString || subject.content.isBlank()) return null
            return Actor(subject.content, principal["issuer"]?.takeUnless { it == JsonNull }, principal["tenantId"]?.takeUnless { it == JsonNull })
        }

        private fun value(raw: Any?) = jsonValue(raw)?.takeUnless {
            it == JsonNull || it is JsonPrimitive && it.isString && it.content.isBlank()
        }

        // Authored comparisons accept JSON only. Never stringify an arbitrary SDK value or mutable map key.
        private fun jsonValue(raw: Any?): JsonElement? {
            return when (raw) {
                null, JsonNull -> JsonNull
                is JsonPrimitive -> raw.takeIf { it.isString || it.content == "true" || it.content == "false" || it.content.toBigDecimalOrNull() != null }
                is String -> JsonPrimitive(raw)
                is Boolean -> JsonPrimitive(raw)
                is Number -> if (raw.toString().toBigDecimalOrNull() != null) JsonPrimitive(raw) else null
                is Map<*, *> -> JsonObject(raw.entries.associate { (key, value) ->
                    if (key !is String) return null
                    key to (jsonValue(value) ?: return null)
                })
                is List<*> -> kotlinx.serialization.json.JsonArray(raw.map { jsonValue(it) ?: return null })
                else -> null
            }
        }
    }
}

internal class ReviewedWriterNotInvoked : IllegalStateException("The reviewed context changed before the writer was invoked.")

/** The input is queued; admission must still hold where the physical request starts. */
class ReviewedWriterDispatch internal constructor(internal val current: () -> Boolean, private val started: () -> Unit) {
    private var open = true
    @Volatile internal var dispatched = false
        private set

    @Synchronized internal fun begin() {
        if (!open || !current()) throw ReviewedWriterNotInvoked()
        dispatched = true
        started()
    }

    @Synchronized internal fun finish(): Boolean {
        open = false
        return dispatched
    }
}

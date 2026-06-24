package com.viant.forgeandroid.runtime

private const val WINDOW_FORM_META_KEY = "__forge"
private const val WINDOW_FORM_PREFILL_KEY = "prefill"
private const val WINDOW_FORM_PREFILL_REVISION_KEY = "prefillRevision"
private const val WINDOW_FORM_REPLACE_KEY = "\$replace"
private const val WINDOW_FORM_REPLACE_VALUE_KEY = "value"

private data class WindowFormReplacement(val value: Any?)

internal fun ForgeRuntime.windowFormValue(windowId: String): Map<String, Any?> {
    return windowContext(windowId).peekWindowForm()
}

internal fun ForgeRuntime.setWindowFormValue(
    windowId: String,
    values: Map<String, Any?>,
    replace: Boolean = false,
    bumpPrefillRevision: Boolean = true
) {
    val dsId = WindowIdentity(windowId).windowFormId()
    val signal = windowContext(windowId).signals.form(dsId)
    val nextValues = if (bumpPrefillRevision) {
        withWindowFormPrefillRevision(signal.peek(), values)
    } else {
        values
    }
    if (replace) {
        signal.set(nextValues)
        return
    }
    signal.set(mergeWindowFormValues(signal.peek(), nextValues))
}

internal fun ForgeRuntime.reconcileWindowForm(
    windowId: String,
    metadata: WindowMetadata,
    parameters: Map<String, Any?>
) {
    val seeded = mergeWindowFormValues(parameters, resolveInitialWindowFormValues(metadata))
    val current = windowFormValue(windowId)
    setWindowFormValue(windowId, mergeWindowFormValues(seeded, current), replace = true, bumpPrefillRevision = false)
}

private fun resolveInitialWindowFormValues(metadata: WindowMetadata): Map<String, Any?> {
    val initial = linkedMapOf<String, Any?>()
    val entries = buildList {
        addAll(metadata.on)
        addAll(metadata.window?.on.orEmpty())
    }
    entries
        .filter { it.event == "onInit" && it.handler == "dataSource.setWindowFormData" }
        .forEach { execution ->
            execution.parameters
                .filter { it.input == "const" }
                .forEach { parameter ->
                    val name = parameter.name?.trim().orEmpty()
                    if (name.isNotBlank()) {
                        initial[name] = parameter.locationAny() ?: parameter.value?.let(JsonUtil::elementToAny)
                    }
                }
        }
    metadata.view?.content?.containers.orEmpty().forEach { container ->
        collectInitialWindowFormItemValues(container, initial)
    }
    return initial
}

private fun collectInitialWindowFormItemValues(
    container: ContainerDef,
    initial: MutableMap<String, Any?>
) {
    container.items
        .filter { it.scope?.trim() == "windowForm" }
        .forEach { item ->
            val key = item.valueKey().orEmpty()
            val value = item.value?.let(JsonUtil::elementToAny)
            if (key.isBlank() || value == null) return@forEach
            initial[key] = value
        }
    container.containers.forEach { child ->
        collectInitialWindowFormItemValues(child, initial)
    }
}

private fun mergeWindowFormValues(
    base: Map<String, Any?>,
    override: Map<String, Any?>
): Map<String, Any?> {
    val result = base.toMutableMap()
    override.forEach { (key, value) ->
        val replacement = windowFormReplacementValue(value)
        if (replacement != null) {
            result[key] = replacement.value
            return@forEach
        }
        val current = JsonUtil.asStringMap(result[key])
        val next = JsonUtil.asStringMap(value)
        result[key] = if (current.isNotEmpty() && next.isNotEmpty()) {
            mergeWindowFormValues(current, next)
        } else {
            value
        }
    }
    return result
}

private fun windowFormReplacementValue(value: Any?): WindowFormReplacement? {
    val objectValue = JsonUtil.asStringMap(value)
    if (objectValue[WINDOW_FORM_REPLACE_KEY] != true) {
        return null
    }
    return WindowFormReplacement(objectValue[WINDOW_FORM_REPLACE_VALUE_KEY])
}

private fun withWindowFormPrefillRevision(
    previous: Map<String, Any?>,
    values: Map<String, Any?>
): Map<String, Any?> {
    if (!values.containsKey(WINDOW_FORM_PREFILL_KEY)) {
        return values
    }
    val previousMeta = JsonUtil.asStringMap(previous[WINDOW_FORM_META_KEY])
    val nextMeta = JsonUtil.asStringMap(values[WINDOW_FORM_META_KEY])
    val previousRevision = numericValue(previousMeta[WINDOW_FORM_PREFILL_REVISION_KEY]) ?: 0
    val next = values.toMutableMap()
    next[WINDOW_FORM_META_KEY] = nextMeta + (WINDOW_FORM_PREFILL_REVISION_KEY to previousRevision + 1)
    return next
}

private fun numericValue(value: Any?): Int? {
    return when (value) {
        is Number -> value.toInt()
        is String -> value.trim().toIntOrNull()
        else -> null
    }
}

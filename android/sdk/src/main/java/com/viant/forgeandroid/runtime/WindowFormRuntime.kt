package com.viant.forgeandroid.runtime

internal fun ForgeRuntime.windowFormValue(windowId: String): Map<String, Any?> {
    return windowContext(windowId).peekWindowForm()
}

internal fun ForgeRuntime.setWindowFormValue(
    windowId: String,
    values: Map<String, Any?>,
    replace: Boolean = false
) {
    val dsId = WindowIdentity(windowId).windowFormId()
    val signal = windowContext(windowId).signals.form(dsId)
    if (replace) {
        signal.set(values)
        return
    }
    signal.set(mergeWindowFormValues(signal.peek(), values))
}

internal fun ForgeRuntime.reconcileWindowForm(
    windowId: String,
    metadata: WindowMetadata,
    parameters: Map<String, Any?>
) {
    val seeded = mergeWindowFormValues(parameters, resolveInitialWindowFormValues(metadata))
    val current = windowFormValue(windowId)
    setWindowFormValue(windowId, mergeWindowFormValues(seeded, current), replace = true)
}

private fun resolveInitialWindowFormValues(metadata: WindowMetadata): Map<String, Any?> {
    val initial = linkedMapOf<String, Any?>()
    metadata.on
        .filter { it.event == "onInit" && it.handler == "dataSource.setWindowFormData" }
        .forEach { execution ->
            execution.parameters
                .filter { it.input == "const" }
                .forEach { parameter ->
                    val name = parameter.name?.trim().orEmpty()
                    if (name.isNotBlank()) {
                        initial[name] = parameter.location
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
            val key = (item.bindingPath ?: item.dataField ?: item.id).orEmpty().trim()
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

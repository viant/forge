package com.viant.forgeandroid.runtime

class SignalRegistry {
    private val metadataSignals = mutableMapOf<String, Signal<WindowMetadata?>>()
    private val collectionSignals = mutableMapOf<String, Signal<List<Map<String, Any?>>>>()
    private val formSignals = mutableMapOf<String, Signal<Map<String, Any?>>>()
    private val selectionSignals = mutableMapOf<String, Signal<SelectionState>>()
    private val inputSignals = mutableMapOf<String, Signal<InputState>>()
    private val controlSignals = mutableMapOf<String, Signal<ControlState>>()
    private val metricsSignals = mutableMapOf<String, Signal<Map<String, Any?>>>()
    private val dialogSignals = mutableMapOf<String, Signal<DialogState>>()

    fun metadata(windowId: String): Signal<WindowMetadata?> =
        metadataSignals.getOrPut(windowId) { Signal(null) }

    fun collection(dsId: String): Signal<List<Map<String, Any?>>> =
        collectionSignals.getOrPut(dsId) { Signal(emptyList()) }

    fun form(dsId: String): Signal<Map<String, Any?>> =
        formSignals.getOrPut(dsId) { Signal(emptyMap()) }

    fun selection(dsId: String, initial: SelectionState): Signal<SelectionState> =
        selectionSignals.getOrPut(dsId) { Signal(initial) }

    fun input(dsId: String): Signal<InputState> =
        inputSignals.getOrPut(dsId) { Signal(InputState()) }

    fun control(dsId: String): Signal<ControlState> =
        controlSignals.getOrPut(dsId) { Signal(ControlState()) }

    fun metrics(dsId: String): Signal<Map<String, Any?>> =
        metricsSignals.getOrPut(dsId) { Signal(emptyMap()) }

    fun dialog(dialogId: String): Signal<DialogState> =
        dialogSignals.getOrPut(dialogId) { Signal(DialogState()) }

    fun removeWindow(windowId: String) {
        metadataSignals.remove(windowId)
        val keys = collectionSignals.keys.filter { it.startsWith(windowId) }
        keys.forEach {
            collectionSignals.remove(it)
            formSignals.remove(it)
            selectionSignals.remove(it)
            inputSignals.remove(it)
            controlSignals.remove(it)
            metricsSignals.remove(it)
        }
        dialogSignals.keys.filter { it.startsWith(windowId) }.forEach { dialogSignals.remove(it) }
    }
}

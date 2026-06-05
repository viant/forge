package com.viant.forgeandroid.runtime

import java.util.concurrent.ConcurrentHashMap

class SignalRegistry {
    private val metadataSignals = ConcurrentHashMap<String, Signal<WindowMetadata?>>()
    private val collectionSignals = ConcurrentHashMap<String, Signal<List<Map<String, Any?>>>>()
    private val formSignals = ConcurrentHashMap<String, Signal<Map<String, Any?>>>()
    private val selectionSignals = ConcurrentHashMap<String, Signal<SelectionState>>()
    private val inputSignals = ConcurrentHashMap<String, Signal<InputState>>()
    private val controlSignals = ConcurrentHashMap<String, Signal<ControlState>>()
    private val metricsSignals = ConcurrentHashMap<String, Signal<Map<String, Any?>>>()
    private val dialogSignals = ConcurrentHashMap<String, Signal<DialogState>>()
    private val dashboardFilterSignals = ConcurrentHashMap<String, Signal<Map<String, Any?>>>()
    private val dashboardSelectionSignals = ConcurrentHashMap<String, Signal<DashboardSelectionState>>()

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

    fun dashboardFilters(key: String): Signal<Map<String, Any?>> =
        dashboardFilterSignals.getOrPut(key) { Signal(emptyMap()) }

    fun dashboardSelection(key: String): Signal<DashboardSelectionState> =
        dashboardSelectionSignals.getOrPut(key) { Signal(DashboardSelectionState()) }

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
        dashboardFilterSignals.keys.filter { it.startsWith("$windowId:") }.forEach { dashboardFilterSignals.remove(it) }
        dashboardSelectionSignals.keys.filter { it.startsWith("$windowId:") }.forEach { dashboardSelectionSignals.remove(it) }
    }
}

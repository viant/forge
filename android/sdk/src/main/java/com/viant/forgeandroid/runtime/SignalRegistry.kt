package com.viant.forgeandroid.runtime

import java.util.concurrent.ConcurrentHashMap
import kotlinx.serialization.json.JsonElement

class SignalRegistry {
    private val metadataSignals = ConcurrentHashMap<String, Signal<WindowMetadata?>>()
    private val collectionSignals = ConcurrentHashMap<String, Signal<List<Map<String, Any?>>>>()
    private val formSignals = ConcurrentHashMap<String, SourceForm>()
    private val selectionSignals = ConcurrentHashMap<String, Signal<SelectionState>>()
    private val inputSignals = ConcurrentHashMap<String, Signal<InputState>>()
    private val controlSignals = ConcurrentHashMap<String, Signal<ControlState>>()
    private val metricsSignals = ConcurrentHashMap<String, Signal<Map<String, Any?>>>()
    private val dialogSignals = ConcurrentHashMap<String, Signal<DialogState>>()
    private val dashboardFilterSignals = ConcurrentHashMap<String, Signal<Map<String, Any?>>>()
    private val dashboardSelectionSignals = ConcurrentHashMap<String, Signal<DashboardSelectionState>>()

    fun metadata(windowId: String): Signal<WindowMetadata?> =
        metadataSignals.getOrPut(windowId) { Signal(null) }

    internal fun ownsMetadata(windowId: String, signal: Signal<WindowMetadata?>): Boolean = metadataSignals[windowId] === signal

    fun collection(dsId: String): Signal<List<Map<String, Any?>>> =
        collectionSignals.getOrPut(dsId) { Signal(emptyList()) }

    fun form(dsId: String): Signal<Map<String, Any?>> =
        formSignals.getOrPut(dsId) { SourceForm() }.values

    internal fun sourceForm(dsId: String, values: Signal<Map<String, Any?>>): SourceForm? =
        formSignals[dsId]?.takeIf { it.values === values }

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

/** A datasource instance owns the picker and command state for its form signal. */
internal class SourceForm {
    val values = Signal<Map<String, Any?>>(emptyMap())
    private class FieldFiles(var revision: Long = 0, val reads: MutableMap<String, FileSelection> = mutableMapOf())
    private var fileFields: MutableMap<String, FieldFiles>? = null

    // A command patches a top-level field; a widget reads one exact path underneath it.
    fun revision(field: String): Long = synchronized(values) { fileFields?.get(field)?.revision ?: 0L }
    fun reading(field: String): Boolean = synchronized(values) { fileFields?.get(field)?.reads?.values?.any { it.isCurrent() } == true }

    internal inner class FileSelection(private val path: String, private val field: String, val isCurrent: () -> Boolean) {
        fun settle(file: JsonElement? = null): Boolean = synchronized(values) {
            val reads = fileFields?.get(field)?.reads
            if (reads?.get(path) !== this) return@synchronized false
            reads.remove(path)
            if (file != null) {
                if (!isCurrent()) return@synchronized false
                val value = JsonUtil.elementToAny(file)
                if (path == field) values.update { it + (field to value) }
                else {
                    var updated = false
                    values.update { current ->
                        val next = SelectorUtil.setFormFile(current, path, value)
                        updated = next != null
                        next ?: current
                    }
                    if (!updated) return@synchronized false
                }
            }
            true
        }
    }

    fun beginSelection(path: String, isCurrent: () -> Boolean = { true }): FileSelection = synchronized(values) {
        val key = path.substringBefore('.')
        val fields = fileFields ?: mutableMapOf<String, FieldFiles>().also { fileFields = it }
        val field = fields.getOrPut(key) { FieldFiles() }
        field.revision++
        FileSelection(path, key, isCurrent).also { field.reads[path] = it }
    }
}

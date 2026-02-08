package com.viant.forgeandroid.runtime

import kotlinx.coroutines.flow.StateFlow
import java.util.concurrent.ConcurrentHashMap

class WindowRuntime(
    private val signals: SignalRegistry,
    private val dataSourceRuntime: DataSourceRuntime
) {
    private val windowList = Signal<List<WindowState>>(emptyList())
    private val windowContexts = ConcurrentHashMap<String, WindowContext>()

    fun windows(): StateFlow<List<WindowState>> = windowList.flow

    fun openWindow(windowKey: String, title: String, inTab: Boolean, parameters: Map<String, Any?>, inline: WindowMetadata? = null): WindowState {
        val windowId = windowKey + if (parameters.isNotEmpty()) "_${parameters.hashCode()}" else ""
        val existing = windowList.peek().find { it.windowId == windowId }
        if (existing != null) return existing

        val state = WindowState(windowId, windowKey, title, inTab, parameters, inline)
        windowList.set(windowList.peek() + state)
        return state
    }

    fun closeWindow(windowId: String) {
        windowList.set(windowList.peek().filterNot { it.windowId == windowId })
        windowContexts.remove(windowId)
        signals.removeWindow(windowId)
        dataSourceRuntime.detachWindow(windowId)
    }

    fun context(windowId: String, metadata: Signal<WindowMetadata?>): WindowContext {
        return windowContexts.getOrPut(windowId) {
            WindowContext(windowId, metadata, signals, dataSourceRuntime)
        }
    }
}

class WindowContext(
    val windowId: String,
    val metadata: Signal<WindowMetadata?>,
    private val signals: SignalRegistry,
    private val dataSourceRuntime: DataSourceRuntime
) {
    val identity = WindowIdentity(windowId)

    fun context(dataSourceRef: String): DataSourceContext {
        return dataSourceRuntime.attach(this, dataSourceRef)
    }

    fun contextOrNull(dataSourceRef: String): DataSourceContext? {
        return dataSourceRuntime.attachOrNull(this, dataSourceRef)
    }

    fun dialogSignal(dialogId: String): Signal<DialogState> {
        return signals.dialog("${windowId}Dialog$dialogId")
    }
}

data class WindowIdentity(val windowId: String) {
    fun dataSourceId(ref: String): String = "${windowId}DS$ref"
}

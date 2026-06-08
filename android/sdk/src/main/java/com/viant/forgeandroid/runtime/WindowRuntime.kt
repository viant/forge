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

    fun openWindow(
        windowKey: String,
        title: String,
        inTab: Boolean,
        parameters: Map<String, Any?>,
        inline: WindowMetadata? = null,
        windowIdOverride: String? = null,
        conversationId: String? = null,
        presentation: String? = null,
        region: String? = null,
        workspaceSharePct: Int? = null,
        workspaceMinHeight: Int? = null,
        parentKey: String? = null,
        isModal: Boolean = false
    ): WindowState {
        val windowId = windowIdOverride?.takeIf { it.isNotBlank() }
            ?: windowKey + if (parameters.isNotEmpty()) "_${parameters.hashCode()}" else ""
        val existing = windowList.peek().find { it.windowId == windowId }
        if (existing != null) {
            val requiresRuntimeReset =
                existing.windowKey != windowKey ||
                    existing.parameters != parameters ||
                    existing.inlineMetadata != inline ||
                    existing.conversationId != conversationId ||
                    existing.presentation != presentation ||
                    existing.region != region ||
                    existing.workspaceSharePct != workspaceSharePct ||
                    existing.workspaceMinHeight != workspaceMinHeight ||
                    existing.parentKey != parentKey ||
                    existing.isModal != isModal
            val updated = existing.copy(
                windowKey = windowKey,
                windowTitle = title,
                inTab = inTab,
                parameters = parameters,
                inlineMetadata = inline,
                isModal = isModal,
                conversationId = conversationId,
                presentation = presentation,
                region = region,
                workspaceSharePct = workspaceSharePct,
                workspaceMinHeight = workspaceMinHeight,
                parentKey = parentKey
            )
            if (requiresRuntimeReset) {
                dataSourceRuntime.detachWindow(windowId)
                signals.removeWindow(windowId)
                windowContexts.remove(windowId)
            } else {
                windowContexts.remove(windowId)
            }
            windowList.set(windowList.peek().map { if (it.windowId == windowId) updated else it })
            return updated
        }

        val state = WindowState(
            windowId = windowId,
            windowKey = windowKey,
            windowTitle = title,
            inTab = inTab,
            parameters = parameters,
            inlineMetadata = inline,
            isModal = isModal,
            conversationId = conversationId,
            presentation = presentation,
            region = region,
            workspaceSharePct = workspaceSharePct,
            workspaceMinHeight = workspaceMinHeight,
            parentKey = parentKey
        )
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
            val parameters = windowList.peek().find { it.windowId == windowId }?.parameters ?: emptyMap()
            WindowContext(windowId, metadata, signals, dataSourceRuntime, parameters)
        }
    }
}

class WindowContext(
    val windowId: String,
    val metadata: Signal<WindowMetadata?>,
    internal val signals: SignalRegistry,
    private val dataSourceRuntime: DataSourceRuntime,
    val parameters: Map<String, Any?> = emptyMap()
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

    fun peekWindowForm(): Map<String, Any?> {
        return signals.form(identity.windowFormId()).peek()
    }

    fun windowFormSignal(): Signal<Map<String, Any?>> {
        return signals.form(identity.windowFormId())
    }
}

data class WindowIdentity(val windowId: String) {
    fun dataSourceId(ref: String): String = "${windowId}DS$ref"
    fun windowFormId(): String = "${windowId}:windowForm"
}

package com.viant.forgeandroid.runtime

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json

class ForgeRuntime(
    endpoints: Map<String, EndpointConfig>,
    val scope: CoroutineScope
) {
    private val json = Json { ignoreUnknownKeys = true }
    private val endpointRegistry = EndpointRegistry(endpoints)
    private val restClient = RestClient(endpointRegistry)
    private val signals = SignalRegistry()
    private val dataSourceRuntime = DataSourceRuntime(signals, restClient, scope)
    private val windowRuntime = WindowRuntime(signals, dataSourceRuntime)
    private val parameterResolver = ParameterResolver()

    private val handlers = HandlerRegistry()
    private val execEngine = ExecutionEngine(this, handlers, parameterResolver, scope)
    private val pendingDialogs = mutableMapOf<String, PendingDialog>()

    val windows = windowRuntime.windows()

    fun registerHandler(name: String, handler: Handler) {
        handlers.register(name, handler)
    }

    fun openWindow(windowKey: String, title: String = windowKey, inTab: Boolean = true, parameters: Map<String, Any?> = emptyMap()): WindowState {
        val state = windowRuntime.openWindow(windowKey, title, inTab, parameters)
        loadWindowMetadata(state)
        return state
    }

    fun openWindowInline(windowKey: String, title: String = windowKey, inTab: Boolean = true, metadata: WindowMetadata): WindowState {
        val state = windowRuntime.openWindow(windowKey, title, inTab, emptyMap(), inline = metadata)
        signals.metadata(state.windowId).set(metadata)
        return state
    }

    fun closeWindow(windowId: String) {
        windowRuntime.closeWindow(windowId)
    }

    fun metadataSignal(windowId: String): Signal<WindowMetadata?> = signals.metadata(windowId)

    fun windowContext(windowId: String): WindowContext = windowRuntime.context(windowId, metadataSignal(windowId))

    fun execute(execution: ExecutionDef, context: DataSourceContext?, args: Map<String, Any?> = emptyMap()) {
        execEngine.execute(execution, context, args)
    }

    private fun loadWindowMetadata(window: WindowState) {
        scope.launch(Dispatchers.IO) {
            if (window.inlineMetadata != null) {
                signals.metadata(window.windowId).set(window.inlineMetadata)
                return@launch
            }
            if (signals.metadata(window.windowId).peek() != null) {
                return@launch
            }
            try {
                val meta = restClient.get("appAPI", "forge/window/${window.windowKey}") { body ->
                    json.decodeFromString<WindowMetadata>(body)
                }
                signals.metadata(window.windowId).set(meta)
            } catch (e: Exception) {
                e.printStackTrace()
                signals.metadata(window.windowId).set(null)
            }
        }
    }

    internal fun openDialog(windowId: String, dialogId: String, args: Map<String, Any?>) {
        val sig = signals.dialog("${windowId}Dialog$dialogId")
        sig.set(DialogState(open = true, args = args))
    }

    internal fun closeDialog(windowId: String, dialogId: String) {
        val sig = signals.dialog("${windowId}Dialog$dialogId")
        sig.set(sig.peek().copy(open = false))
        pendingDialogs.remove("${windowId}Dialog$dialogId")
    }

    fun closeDialogPublic(windowId: String, dialogId: String) {
        closeDialog(windowId, dialogId)
    }

    internal fun dataSourceContext(windowId: String, dataSourceRef: String): DataSourceContext {
        return windowContext(windowId).context(dataSourceRef)
    }

    internal fun registerPendingDialog(dialogKey: String, pending: PendingDialog) {
        pendingDialogs[dialogKey] = pending
    }

    internal fun pendingDialog(dialogKey: String): PendingDialog? = pendingDialogs[dialogKey]
}

data class PendingDialog(
    val callerWindowId: String,
    val callerDataSourceRef: String,
    val outbound: List<ParameterDef>
)

class HandlerRegistry {
    private val map = mutableMapOf<String, Handler>()
    fun register(name: String, handler: Handler) {
        map[name] = handler
    }
    fun resolve(name: String): Handler? = map[name]
}

typealias Handler = suspend (ExecutionArgs) -> Any?

data class ExecutionArgs(
    val execution: ExecutionDef,
    val context: DataSourceContext?,
    val parameters: Map<String, Map<String, Any?>>,
    val args: Map<String, Any?>
)

class ExecutionEngine(
    private val runtime: ForgeRuntime,
    private val handlers: HandlerRegistry,
    private val parameterResolver: ParameterResolver,
    private val scope: CoroutineScope
) {
    fun execute(execution: ExecutionDef, context: DataSourceContext?, args: Map<String, Any?> = emptyMap()) {
        val params = if (context != null) parameterResolver.resolve(execution.parameters, context) else ParameterResolution(emptyMap(), emptyList())
        val resolved = ExecutionArgs(execution, context, params.inbound, args)

        val handlerName = execution.handler ?: return
        val handler = handlers.resolve(handlerName) ?: builtIn(handlerName)
        if (handler != null) {
            scope.launch {
                handler.invoke(resolved)
            }
        }
    }

    private fun builtIn(name: String): Handler? = when (name) {
        "window.openDialog" -> handler@{ args ->
            val dialogId = args.execution.args.getOrNull(0) ?: return@handler null
            val windowId = (args.args["windowId"] as? String) ?: args.context?.window?.windowId ?: return@handler null
            val callerCtx = args.context
            if (callerCtx != null) {
                val resolution = parameterResolver.resolve(args.execution.parameters, callerCtx)
                val dialogKey = "${windowId}Dialog$dialogId"
                runtime.registerPendingDialog(
                    dialogKey,
                    PendingDialog(
                        callerWindowId = callerCtx.window.windowId,
                        callerDataSourceRef = callerCtx.dataSourceRef,
                        outbound = resolution.outbound
                    )
                )
            }
            runtime.openDialog(windowId, dialogId, emptyMap())
            null
        }
        "window.openWindow" -> handler@{ args ->
            val windowKey = args.execution.args.getOrNull(0) ?: return@handler null
            val title = args.execution.args.getOrNull(1) ?: windowKey
            runtime.openWindow(windowKey, title, inTab = true, parameters = emptyMap())
            null
        }
        "dialog.commit" -> handler@{ args ->
            val dialogId = (args.args["dialogId"] as? String) ?: args.execution.args.getOrNull(0) ?: return@handler null
            val windowId = (args.args["windowId"] as? String) ?: args.context?.window?.windowId ?: return@handler null
            val dialogKey = "${windowId}Dialog$dialogId"
            val pending = runtime.pendingDialog(dialogKey) ?: return@handler null
            val callerCtx = runtime.dataSourceContext(pending.callerWindowId, pending.callerDataSourceRef)
            val payload = (args.args["payload"] as? Map<String, Any?>)
                ?: args.context?.peekSelection()?.selected
                ?: emptyMap()
            outboundApply(pending.outbound, payload, callerCtx)
            runtime.closeDialog(windowId, dialogId)
            null
        }
        "dialog.close" -> handler@{ args ->
            val dialogId = (args.args["dialogId"] as? String) ?: args.execution.args.getOrNull(0) ?: return@handler null
            val windowId = (args.args["windowId"] as? String) ?: args.context?.window?.windowId ?: return@handler null
            runtime.closeDialog(windowId, dialogId)
            null
        }
        "dataSource.fetchCollection" -> { args ->
            args.context?.fetchCollection()
            null
        }
        "dataSource.toggleSelection" -> handler@{ args ->
            val row = args.args["row"] as? Map<String, Any?> ?: return@handler null
            val rowIndex = (args.args["rowIndex"] as? Int) ?: -1
            args.context?.toggleSelection(row, rowIndex)
            null
        }
        else -> null
    }

    private fun outboundApply(outbound: List<ParameterDef>, payload: Map<String, Any?>, callerCtx: DataSourceContext) {
        outbound.forEach { p ->
            val srcPath = p.location ?: p.name ?: return@forEach
            val value = SelectorUtil.resolve(payload, srcPath)
            val to = p.to ?: return@forEach
            val parts = to.split(":", limit = 2)
            val dsRef = parts.getOrNull(0)?.ifBlank { callerCtx.dataSourceRef } ?: callerCtx.dataSourceRef
            val store = parts.getOrNull(1) ?: "form"
            val target = if (dsRef == callerCtx.dataSourceRef) callerCtx else runtime.dataSourceContext(callerCtx.window.windowId, dsRef)
            when (store) {
                "form" -> target.setFormField(p.name ?: srcPath, value)
                "filter" -> target.setFilterValue(p.name ?: srcPath, value)
                "selection" -> target.setSelection(SelectionState(selected = value as? Map<String, Any?>))
                "metrics" -> target.setMetrics(p.name ?: srcPath, value)
                "input.query", "query" -> target.setFilterValue(p.name ?: srcPath, value)
                else -> target.setFormField(p.name ?: srcPath, value)
            }
        }
    }
}

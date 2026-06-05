package com.viant.forgeandroid.runtime

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.decodeFromJsonElement

class ForgeRuntime(
    endpoints: Map<String, EndpointConfig>,
    val scope: CoroutineScope,
    private val targetContext: ForgeTargetContext = ForgeTargetContext(platform = "android"),
    private val windowMetadataBaseUri: String = "forge/window"
) {
    data class DataSourceFetchRequest(
        val windowId: String,
        val dataSourceRef: String,
        val dataSource: DataSourceDef,
        val input: InputState,
        val resolvedInputs: Map<String, Any?> = emptyMap()
    )

    data class DataSourceFetchResult(
        val rows: List<Map<String, Any?>> = emptyList(),
        val metrics: Map<String, Any?> = emptyMap(),
        val form: Map<String, Any?>? = null,
        val selection: Map<String, Any?>? = null,
        val rowIndex: Int? = null
    )

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
    private val pendingDialogResults = mutableMapOf<String, CompletableDeferred<Map<String, Any?>?>>()
    private val pendingWindows = mutableMapOf<String, PendingWindow>()
    private var windowMetadataLoader: (suspend (String) -> WindowMetadata?)? = null

    val windows = windowRuntime.windows()

    init {
        dataSourceRuntime.setExecutor { execution, context, args ->
            execEngine.execute(execution, context, args)
        }
    }

    fun registerDataSourceLoader(
        loader: suspend (DataSourceFetchRequest) -> DataSourceFetchResult?
    ) {
        dataSourceRuntime.setCollectionLoader { context ->
            loader(
                DataSourceFetchRequest(
                    windowId = context.window.windowId,
                    dataSourceRef = context.dataSourceRef,
                    dataSource = context.dataSource,
                    input = context.input.peek(),
                    resolvedInputs = parameterResolver.resolveFlat(context.dataSource.parameters, context)
                )
            )?.let {
                DataSourceRuntime.LoaderResult(
                    rows = it.rows,
                    metrics = it.metrics,
                    form = it.form,
                    selection = it.selection,
                    rowIndex = it.rowIndex
                )
            }
        }
    }

    fun registerWindowMetadataLoader(
        loader: suspend (String) -> WindowMetadata?
    ) {
        windowMetadataLoader = loader
    }

    fun registerHandler(name: String, handler: Handler) {
        handlers.register(name, handler)
    }

    fun openWindow(
        windowKey: String,
        title: String = windowKey,
        inTab: Boolean = true,
        parameters: Map<String, Any?> = emptyMap(),
        windowIdOverride: String? = null,
        conversationId: String? = null,
        presentation: String? = null,
        region: String? = null,
        workspaceSharePct: Int? = null,
        workspaceMinHeight: Int? = null,
        parentKey: String? = null,
        isModal: Boolean = false
    ): WindowState {
        val state = windowRuntime.openWindow(
            windowKey = windowKey,
            title = title,
            inTab = inTab,
            parameters = parameters,
            windowIdOverride = windowIdOverride,
            conversationId = conversationId,
            presentation = presentation,
            region = region,
            workspaceSharePct = workspaceSharePct,
            workspaceMinHeight = workspaceMinHeight,
            parentKey = parentKey,
            isModal = isModal
        )
        loadWindowMetadata(state, forceReload = true)
        return state
    }

    fun openWindowInline(windowKey: String, title: String = windowKey, inTab: Boolean = true, metadata: WindowMetadata): WindowState {
        val state = windowRuntime.openWindow(windowKey, title, inTab, emptyMap(), inline = metadata)
        val resolved = resolveMetadata(metadata)
        signals.metadata(state.windowId).set(resolved)
        reconcileWindowForm(state.windowId, resolved, state.parameters)
        return state
    }

    fun closeWindow(windowId: String) {
        clearPendingWindow(windowId)
        windowRuntime.closeWindow(windowId)
    }

    fun metadataSignal(windowId: String): Signal<WindowMetadata?> = signals.metadata(windowId)

    fun windowContext(windowId: String): WindowContext = windowRuntime.context(windowId, metadataSignal(windowId))

    fun setWindowFormValues(
        windowId: String,
        values: Map<String, Any?>,
        replace: Boolean = false,
        bumpPrefillRevision: Boolean = true
    ) {
        setWindowFormValue(windowId, values, replace, bumpPrefillRevision)
    }

    fun refreshDataSourceCollection(windowID: String, dataSourceRef: String) {
        windowContext(windowID).contextOrNull(dataSourceRef)?.fetchCollection()
    }

    fun execute(execution: ExecutionDef, context: DataSourceContext?, args: Map<String, Any?> = emptyMap()) {
        execEngine.execute(execution, context, args)
    }

    private fun loadWindowMetadata(window: WindowState, forceReload: Boolean = false) {
        scope.launch(Dispatchers.IO) {
            if (window.inlineMetadata != null) {
                signals.metadata(window.windowId).set(window.inlineMetadata)
                reconcileWindowForm(window.windowId, window.inlineMetadata, window.parameters)
                return@launch
            }
            if (!forceReload && signals.metadata(window.windowId).peek() != null) {
                return@launch
            }
            try {
                if (forceReload) {
                    signals.metadata(window.windowId).set(null)
                }
                val loaded = windowMetadataLoader?.invoke(window.windowKey)
                if (loaded != null) {
                    signals.metadata(window.windowId).set(loaded)
                    reconcileWindowForm(window.windowId, loaded, window.parameters)
                    return@launch
                }
                val meta = restClient.get("appAPI", "${windowMetadataBaseUri.trimEnd('/')}/${window.windowKey}") { body ->
                    val parsed = json.parseToJsonElement(body)
                    val resolved = MetadataResolver.resolve(parsed, targetContext) ?: parsed
                    val normalized = normalizeWindowMetadataJson(resolved)
                    json.decodeFromJsonElement<WindowMetadata>(normalized)
                }
                signals.metadata(window.windowId).set(meta)
                reconcileWindowForm(window.windowId, meta, window.parameters)
            } catch (e: Exception) {
                e.printStackTrace()
                signals.metadata(window.windowId).set(null)
            }
        }
    }

    private fun resolveMetadata(metadata: WindowMetadata): WindowMetadata {
        val parsed = json.parseToJsonElement(json.encodeToString(metadata))
        val resolved = MetadataResolver.resolve(parsed, targetContext) ?: parsed
        return json.decodeFromJsonElement(normalizeWindowMetadataJson(resolved))
    }

    internal fun openDialog(
        windowId: String,
        dialogId: String,
        args: Map<String, Any?>,
        selectionMode: String? = null
    ) {
        val sig = signals.dialog("${windowId}Dialog$dialogId")
        sig.set(DialogState(open = true, selectionMode = selectionMode, props = args, args = args))
    }

    internal fun closeDialog(windowId: String, dialogId: String) {
        val dialogKey = "${windowId}Dialog$dialogId"
        val sig = signals.dialog("${windowId}Dialog$dialogId")
        sig.set(sig.peek().copy(open = false))
        pendingDialogs.remove(dialogKey)
        pendingDialogResults.remove(dialogKey)?.complete(null)
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

    internal fun resolvePendingDialogResult(dialogKey: String, payload: Map<String, Any?>?) {
        pendingDialogResults.remove(dialogKey)?.complete(payload)
    }

    internal fun registerPendingWindow(windowId: String, pending: PendingWindow) {
        pendingWindows[windowId] = pending
    }

    internal fun pendingWindow(windowId: String): PendingWindow? = pendingWindows[windowId]

    internal fun clearPendingWindow(windowId: String) {
        pendingWindows.remove(windowId)
    }

    suspend fun awaitDialogResult(windowId: String, dialogId: String): Map<String, Any?>? {
        val dialogKey = "${windowId}Dialog$dialogId"
        val deferred = CompletableDeferred<Map<String, Any?>?>()
        pendingDialogResults[dialogKey] = deferred
        return deferred.await()
    }

    fun presentDialog(
        windowId: String,
        dialogId: String,
        parameters: Map<String, Any?> = emptyMap(),
        selectionMode: String? = null
    ): Boolean {
        val metadata = metadataSignal(windowId).peek() ?: return false
        if (metadata.dialogs.none { it.id == dialogId }) {
            return false
        }
        openDialog(windowId, dialogId, parameters, selectionMode)
        return true
    }

    suspend fun openDialogAwaitResult(
        windowId: String,
        dialogId: String,
        parameters: Map<String, Any?> = emptyMap(),
        selectionMode: String? = null
    ): Map<String, Any?>? {
        val opened = presentDialog(windowId, dialogId, parameters, selectionMode)
        if (!opened) return null
        return awaitDialogResult(windowId, dialogId)
    }

    fun isReadOnly(execution: ExecutionDef, context: DataSourceContext?): Boolean {
        return execEngine.evaluateReadOnly(execution, context)
    }
}

data class PendingDialog(
    val callerWindowId: String,
    val callerDataSourceRef: String,
    val outbound: List<ParameterDef>
)

data class PendingWindow(
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

    fun evaluateReadOnly(execution: ExecutionDef, context: DataSourceContext?): Boolean {
        return when (execution.handler) {
            "dataSource.noSelection" -> !(context?.hasSelection() ?: false)
            "dataSource.isFormNotDirty" -> !(context?.isFormDirty() ?: false)
            else -> false
        }
    }

    private fun builtIn(name: String): Handler? = when (name) {
        "window.openDialog" -> handler@{ args ->
            val dialogId = args.execution.args.getOrNull(0) ?: return@handler null
            val windowId = (args.args["windowId"] as? String) ?: args.context?.window?.windowId ?: return@handler null
            val callerCtx = args.context
            val explicitSelectionMode = (args.args["selectionMode"] as? String)?.trim()?.takeIf { it.isNotEmpty() }
            val selectionMode = explicitSelectionMode ?: when (args.args["multiple"] as? Boolean) {
                true -> "multi"
                false -> "single"
                null -> null
            }
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
                runtime.openDialog(windowId, dialogId, resolution.inbound, selectionMode)
                return@handler null
            }
            runtime.openDialog(windowId, dialogId, emptyMap(), selectionMode)
            null
        }
        "window.openWindow" -> handler@{ args ->
            val windowKey = args.execution.args.getOrNull(0) ?: return@handler null
            val title = args.execution.args.getOrNull(1) ?: windowKey
            val callerCtx = args.context
            val resolution = if (callerCtx != null) parameterResolver.resolve(args.execution.parameters, callerCtx) else ParameterResolution(emptyMap(), emptyList())
            val state = runtime.openWindow(windowKey, title, inTab = true, parameters = resolution.inbound)
            if (callerCtx != null) {
                if (resolution.outbound.isNotEmpty()) {
                    runtime.registerPendingWindow(
                        state.windowId,
                        PendingWindow(
                            callerWindowId = callerCtx.window.windowId,
                            callerDataSourceRef = callerCtx.dataSourceRef,
                            outbound = resolution.outbound
                        )
                    )
                }
            }
            null
        }
        "window.closeWindow" -> handler@{ args ->
            val windowId = (args.args["windowId"] as? String) ?: args.context?.window?.windowId ?: return@handler null
            runtime.clearPendingWindow(windowId)
            runtime.closeWindow(windowId)
            null
        }
        "window.commit", "window.commitWindow" -> handler@{ args ->
            val windowId = (args.args["windowId"] as? String) ?: args.context?.window?.windowId ?: return@handler null
            val payload = JsonUtil.asStringMap(args.args["payload"]).takeIf { it.isNotEmpty() } ?: run {
                val selection = args.context?.peekSelection()
                when {
                    selection == null -> emptyMap()
                    selection.selection.isNotEmpty() -> buildMap {
                        put("selection", selection.selection)
                        selection.selected?.let { put("selected", it) }
                    }
                    selection.selected != null -> selection.selected
                    else -> emptyMap()
                }
            }
            val pending = runtime.pendingWindow(windowId)
            if (pending != null) {
                val callerCtx = runtime.dataSourceContext(pending.callerWindowId, pending.callerDataSourceRef)
                outboundApply(pending.outbound, payload, callerCtx)
                runtime.clearPendingWindow(windowId)
            }
            runtime.closeWindow(windowId)
            null
        }
        "dialog.commit" -> handler@{ args ->
            val dialogId = (args.args["dialogId"] as? String) ?: args.execution.args.getOrNull(0) ?: return@handler null
            val windowId = (args.args["windowId"] as? String) ?: args.context?.window?.windowId ?: return@handler null
            val dialogKey = "${windowId}Dialog$dialogId"
            val payload = JsonUtil.asStringMap(args.args["payload"]).takeIf { it.isNotEmpty() } ?: run {
                val selection = args.context?.peekSelection()
                when {
                    selection == null -> emptyMap()
                    selection.selection.isNotEmpty() -> buildMap {
                        put("selection", selection.selection)
                        selection.selected?.let { put("selected", it) }
                    }
                    selection.selected != null -> selection.selected
                    else -> emptyMap()
                }
            }
            val pending = runtime.pendingDialog(dialogKey)
            if (pending != null) {
                val callerCtx = runtime.dataSourceContext(pending.callerWindowId, pending.callerDataSourceRef)
                outboundApply(pending.outbound, payload, callerCtx)
            }
            runtime.resolvePendingDialogResult(dialogKey, payload)
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
        "dataSource.setWindowFormData" -> handler@{ args ->
            val windowId = (args.args["windowId"] as? String) ?: args.context?.window?.windowId ?: return@handler null
            val payload = JsonUtil.asStringMap(args.args["payload"]).takeIf { it.isNotEmpty() }
                ?: args.context?.let { parameterResolver.resolveFlat(args.execution.parameters, it) }
                ?: emptyMap()
            if (payload.isNotEmpty()) {
                runtime.setWindowFormValue(windowId, payload)
            }
            null
        }
        "dataSource.handleAddNew" -> handler@{ args ->
            val context = args.context ?: return@handler null
            context.resetSelection()
            context.setForm(emptyMap())
            null
        }
        "dataSource.noSelection" -> handler@{ args ->
            val context = args.context ?: return@handler true
            !context.hasSelection()
        }
        "dataSource.isFormNotDirty" -> handler@{ args ->
            val context = args.context ?: return@handler true
            !context.isFormDirty()
        }
        "dataSource.setFilter" -> handler@{ args ->
            val context = args.context ?: return@handler null
            val directFilter = JsonUtil.asStringMap(args.args["filter"]).takeIf { it.isNotEmpty() }
            if (directFilter != null) {
                context.setFilter(directFilter)
                return@handler null
            }
            val next = context.peekFilter().toMutableMap()
            args.args.forEach { (key, value) ->
                if (key != "row" && key != "rowIndex" && key != "windowId" && value != null) {
                    next[key] = value
                }
            }
            context.setFilter(next)
            null
        }
        "dataSource.toggleSelection" -> handler@{ args ->
            val row = JsonUtil.asStringMap(args.args["row"]).takeIf { it.isNotEmpty() } ?: return@handler null
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
                "selection" -> target.setSelection(SelectionState(selected = JsonUtil.asStringMap(value).takeIf { it.isNotEmpty() }))
                "metrics" -> target.setMetrics(p.name ?: srcPath, value)
                "input.query", "query" -> target.setFilterValue(p.name ?: srcPath, value)
                else -> target.setFormField(p.name ?: srcPath, value)
            }
        }
    }
}

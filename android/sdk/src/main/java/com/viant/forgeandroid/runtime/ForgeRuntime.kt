package com.viant.forgeandroid.runtime

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement

class ForgeRuntime(
    endpoints: Map<String, EndpointConfig>,
    val scope: CoroutineScope,
    val targetContext: ForgeTargetContext = ForgeTargetContext(platform = "android"),
    private val windowMetadataBaseUri: String = "forge/window"
) {
    data class FilePreviewContent(val current: String = "", val previous: String = "", val diff: String = "")
    data class DataSourceFetchRequest(
        val windowId: String,
        val conversationId: String? = null,
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
    val mutationCommands = MutationCommandRuntime()

    private val handlers = HandlerRegistry()
    private val execEngine = ExecutionEngine(this, handlers, parameterResolver, scope)
    private val pendingDialogs = mutableMapOf<String, PendingDialog>()
    private val pendingDialogResults = mutableMapOf<String, CompletableDeferred<Map<String, Any?>?>>()
    private val pendingWindows = mutableMapOf<String, PendingWindow>()
    private var windowMetadataLoader: (suspend (String) -> WindowMetadata?)? = null
    private var windowMetadataRequestLoader: (suspend (WindowMetadataRequest) -> WindowMetadata?)? = null
    private var fileTextLoader: (suspend (String) -> String)? = null
    private var filePreviewLoader: (suspend (String, String) -> FilePreviewContent)? = null
    private var feedPatchHandler: ((String, FeedPatchOperation) -> Boolean)? = null
    @Volatile private var interactionObserver: ((ForgeInteraction) -> Unit)? = null
    @Volatile private var externalURLHandler: ((String) -> Unit)? = null

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
                    conversationId = windows.value.firstOrNull { it.windowId == context.window.windowId }?.conversationId,
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

    fun registerWindowMetadataRequestLoader(
        loader: suspend (WindowMetadataRequest) -> WindowMetadata?
    ) {
        windowMetadataRequestLoader = loader
    }

    fun registerHandler(name: String, handler: Handler) {
        handlers.register(name, handler)
    }

    fun registerExternalURLHandler(handler: ((String) -> Unit)?) {
        externalURLHandler = handler
    }

    fun registerFileTextLoader(loader: suspend (String) -> String) {
        fileTextLoader = loader
    }

    suspend fun loadFileText(uri: String): String = fileTextLoader?.invoke(uri).orEmpty()

    fun registerFilePreviewLoader(loader: suspend (String, String) -> FilePreviewContent) { filePreviewLoader = loader }
    suspend fun loadFilePreview(tool: String, uri: String): FilePreviewContent? = filePreviewLoader?.invoke(tool, uri)

    fun registerFeedPatchHandler(handler: (windowId: String, operation: FeedPatchOperation) -> Boolean) {
        feedPatchHandler = handler
    }

    fun dispatchFeedPatch(windowId: String, operation: FeedPatchOperation): Boolean =
        feedPatchHandler?.invoke(windowId, operation) == true

    fun registerInteractionObserver(observer: ((ForgeInteraction) -> Unit)?) {
        interactionObserver = observer
    }

    fun emitInteraction(
        kind: String,
        windowId: String,
        dataSourceRef: String? = null,
        detail: Map<String, Any?> = emptyMap()
    ) {
        interactionObserver?.invoke(
            ForgeInteraction(
                kind = kind,
                windowId = windowId,
                windowKey = windows.value.firstOrNull { it.windowId == windowId }?.windowKey,
                dataSourceRef = dataSourceRef,
                detail = detail
            )
        )
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

    fun openWindowInline(
        windowKey: String,
        title: String = windowKey,
        inTab: Boolean = true,
        metadata: WindowMetadata,
        conversationId: String? = null,
        presentation: String? = null
    ): WindowState {
        val state = windowRuntime.openWindow(
            windowKey,
            title,
            inTab,
            emptyMap(),
            conversationId = conversationId,
            presentation = presentation,
            inline = metadata
        )
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

    fun windowState(windowId: String): WindowState? = windows.value.firstOrNull { it.windowId == windowId }

    fun setWindowFormValues(
        windowId: String,
        values: Map<String, Any?>,
        replace: Boolean = false,
        bumpPrefillRevision: Boolean = true
    ) {
        setWindowFormValue(windowId, values, replace, bumpPrefillRevision)
    }

    /** Replaces only simulated principal access lists; resource capabilities remain authoritative. */
    fun updatePreviewPrincipal(windowId: String, roles: Set<String>, features: Set<String>) {
        val signal = metadataSignal(windowId)
        val current = signal.peek() ?: return
        val authorization = current.authorizationSnapshot.toMutableMap()
        val principal = (authorization["principal"] as? JsonObject)?.toMutableMap() ?: mutableMapOf()
        principal["roles"] = JsonArray(roles.sorted().map(::JsonPrimitive))
        principal["features"] = JsonArray(features.sorted().map(::JsonPrimitive))
        authorization["principal"] = JsonObject(principal)
        signal.set(current.copy(authorizationSnapshot = authorization))
    }

    fun refreshDataSourceCollection(windowID: String, dataSourceRef: String) {
        windowContext(windowID).contextOrNull(dataSourceRef)?.fetchCollection()
    }

    fun execute(execution: ExecutionDef, context: DataSourceContext?, args: Map<String, Any?> = emptyMap()): Job? {
        return execEngine.execute(execution, context, args)
    }

    suspend fun evaluate(
        execution: ExecutionDef,
        context: DataSourceContext?,
        args: Map<String, Any?> = emptyMap()
    ): Any? = execEngine.evaluate(execution, context, args)

    suspend fun evaluateMetadataAction(
        execution: ExecutionDef,
        context: DataSourceContext,
        args: Map<String, Any?> = emptyMap()
    ): Any? {
        val handler = execution.handler?.trim().orEmpty()
        val code = context.window.metadata.peek()?.actions?.code?.trim().orEmpty()
        if (handler.isBlank() || code.isBlank()) return null
        return ActionHookRuntime.invoke(code, handler, JsonUtil.anyToElement(args))
            ?.let(JsonUtil::elementToAny)
    }

    internal fun canProjectMetadataExecution(execution: ExecutionDef, context: DataSourceContext?): Boolean {
        val handler = execution.handler?.trim().orEmpty()
        val metadata = context?.window?.metadata?.peek() ?: return false
        val namespace = metadata.namespace?.trim().orEmpty()
        return handler.isNotBlank() && namespace.isNotBlank() && handler.startsWith("$namespace.") && !metadata.actions?.code.isNullOrBlank()
    }

    internal suspend fun evaluateMetadataExecution(
        execution: ExecutionDef,
        context: DataSourceContext,
        args: Map<String, Any?>,
        applyEffects: Boolean
    ): Any? {
        val metadata = context.window.metadata.peek() ?: return null
        val code = metadata.actions?.code?.trim().orEmpty()
        val handler = execution.handler?.trim().orEmpty()
        if (code.isBlank() || handler.isBlank()) return null
        val snapshots = JsonObject(metadata.dataSources.keys.associateWith { ref ->
            val target = context.window.contextOrNull(ref)
            val selection = target?.selection?.peek() ?: SelectionState()
            val input = target?.input?.peek() ?: InputState()
            JsonObject(mapOf(
                "form" to JsonUtil.anyToElement(target?.form?.peek().orEmpty()),
                "collection" to JsonUtil.anyToElement(target?.collection?.peek().orEmpty()),
                "selection" to JsonUtil.anyToElement(mapOf("selected" to selection.selected, "selection" to selection.selection, "rowIndex" to selection.rowIndex)),
                "input" to JsonUtil.anyToElement(mapOf("filter" to input.filter, "parameters" to input.parameters, "page" to input.page, "fetch" to input.fetch, "refresh" to input.refresh)),
                "metrics" to JsonUtil.anyToElement(target?.metrics?.peek().orEmpty())
            ))
        })
        val executionValue = mapOf(
            "handler" to execution.handler,
            "event" to execution.event,
            "args" to execution.args,
            "parameters" to execution.parameters
        )
        val projection = UIActionProjection.invoke(
            code = code,
            functionName = handler,
            namespace = metadata.namespace,
            source = context.dataSourceRef,
            snapshots = snapshots,
            windowForm = JsonUtil.anyToElement(context.window.peekWindowForm()) as JsonObject,
            props = JsonUtil.anyToElement(args + ("execution" to executionValue)) as JsonObject
        )
        if (applyEffects) applyUIActionEffects(context, projection.effects, metadata)
        return projection.result?.let(JsonUtil::elementToAny)
    }

    private fun applyUIActionEffects(source: DataSourceContext, effects: List<UIActionEffect>, metadata: WindowMetadata) {
        effects.forEach { effect ->
            val value = JsonUtil.elementToAny(effect.value)
            val target = effect.ref?.let(source.window::contextOrNull)
            when (effect.kind) {
                "form" -> (value as? Map<*, *>)?.let { target?.setForm(it.entries.associate { entry -> entry.key.toString() to entry.value }) }
                "collection" -> (value as? List<*>)?.let { rows ->
                    target?.collection?.set(rows.mapNotNull { JsonUtil.asStringMap(it).takeIf { row -> row.isNotEmpty() } })
                }
                "selection" -> (value as? Map<*, *>)?.let { payload ->
                    val mapped = payload.entries.associate { it.key.toString() to it.value }
                    val rows = (mapped["selection"] as? List<*>)?.mapNotNull { JsonUtil.asStringMap(it).takeIf { row -> row.isNotEmpty() } }.orEmpty()
                    val selected = JsonUtil.asStringMap(mapped["selected"]).takeIf { it.isNotEmpty() } ?: rows.lastOrNull()
                    target?.setSelection(SelectionState(selected = selected, selection = rows, rowIndex = (mapped["rowIndex"] as? Number)?.toInt() ?: -1))
                }
                "windowForm" -> (value as? Map<*, *>)?.let { setWindowFormValues(source.window.windowId, it.entries.associate { entry -> entry.key.toString() to entry.value }, bumpPrefillRevision = false) }
                "windowFormPatch" -> (value as? Map<*, *>)?.let { setWindowFormValues(source.window.windowId, it.entries.associate { entry -> entry.key.toString() to entry.value }, bumpPrefillRevision = false) }
                "input" -> (value as? Map<*, *>)?.let { target?.setInputParameters(it.entries.associate { entry -> entry.key.toString() to entry.value }) }
                "filter" -> (value as? Map<*, *>)?.let { target?.setFilter(it.entries.associate { entry -> entry.key.toString() to entry.value }) }
                "fetch" -> target?.fetchCollection()
                "resetSelection" -> target?.resetSelection()
                "openDialog" -> applyProjectedOpenDialog(source, value, metadata)
                "closeDialog" -> JsonUtil.asStringMap(value)["dialogId"]?.toString()?.let { closeDialog(source.window.windowId, it) }
                "openWindow" -> applyProjectedOpenWindow(source, value)
                "openTarget" -> applyProjectedOpenTarget(source, value, metadata)
                "openURL" -> {
                    val href = JsonUtil.asStringMap(value)["href"]?.toString()?.trim().orEmpty()
                    val scheme = runCatching { java.net.URI(href).scheme?.lowercase() }.getOrNull()
                    if (scheme in setOf("http", "https", "mailto", "tel")) externalURLHandler?.invoke(href)
                }
            }
        }
    }

    private fun applyProjectedOpenDialog(source: DataSourceContext, value: Any?, metadata: WindowMetadata) {
        val payload = JsonUtil.asStringMap(value)
        val projectedExecution = JsonUtil.asStringMap(payload["execution"])
        val args = projectedExecution["args"] as? List<*>
        val dialogId = payload["dialogId"]?.toString() ?: args?.firstOrNull()?.toString() ?: return
        if (metadata.dialogs.none { it.id == dialogId }) return
        val parameters = JsonUtil.asStringMap(payload["parameters"])
        val options = JsonUtil.asStringMap(args?.getOrNull(1))
        openDialog(source.window.windowId, dialogId, parameters, options["selectionMode"]?.toString())
    }

    private fun applyProjectedOpenWindow(source: DataSourceContext, value: Any?) {
        val payload = JsonUtil.asStringMap(value)
        val projectedExecution = JsonUtil.asStringMap(payload["execution"])
        val args = projectedExecution["args"] as? List<*>
        val windowKey = payload["windowKey"]?.toString() ?: args?.firstOrNull()?.toString() ?: return
        val title = payload["windowTitle"]?.toString() ?: payload["title"]?.toString() ?: args?.getOrNull(1)?.toString() ?: windowKey
        openWindow(windowKey, title, inTab = payload["inTab"] as? Boolean ?: true, parameters = JsonUtil.asStringMap(payload["parameters"]))
    }

    private fun applyProjectedOpenTarget(source: DataSourceContext, value: Any?, metadata: WindowMetadata) {
        val payload = JsonUtil.asStringMap(value)
        val target = JsonUtil.asStringMap(payload["target"]).ifEmpty { payload }
        when (target["kind"]?.toString()?.lowercase()) {
            "dialog" -> applyProjectedOpenDialog(source, target, metadata)
            "window" -> applyProjectedOpenWindow(source, target)
            "external", "url", "link" -> {
                val href = target["href"]?.toString() ?: target["url"]?.toString() ?: return
                val scheme = runCatching { java.net.URI(href).scheme?.lowercase() }.getOrNull()
                if (scheme in setOf("http", "https", "mailto", "tel")) externalURLHandler?.invoke(href)
            }
        }
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
                val loaded = windowMetadataRequestLoader?.invoke(
                    WindowMetadataRequest(
                        windowId = window.windowId,
                        windowKey = window.windowKey,
                        parameters = window.parameters,
                        conversationId = window.conversationId
                    )
                ) ?: windowMetadataLoader?.invoke(window.windowKey)
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

    data class WindowMetadataRequest(
        val windowId: String,
        val windowKey: String,
        val parameters: Map<String, Any?> = emptyMap(),
        val conversationId: String? = null
    )

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
    fun execute(execution: ExecutionDef, context: DataSourceContext?, args: Map<String, Any?> = emptyMap()): Job? {
        val handlerName = execution.handler ?: return null
        val handler = handlers.resolve(handlerName) ?: builtIn(handlerName)
        if (handler != null) {
            return scope.launch {
                invokeHandler(execution, context, args, handler, applyState = true)
            }
        }
        if (context != null && runtime.canProjectMetadataExecution(execution, context)) {
            return scope.launch { runtime.evaluateMetadataExecution(execution, context, args, applyEffects = true) }
        }
        return null
    }

    suspend fun evaluate(
        execution: ExecutionDef,
        context: DataSourceContext?,
        args: Map<String, Any?> = emptyMap()
    ): Any? {
        val handlerName = execution.handler ?: return null
        val handler = handlers.resolve(handlerName) ?: builtIn(handlerName)
        if (handler != null) return invokeHandler(execution, context, args, handler, applyState = false)
        if (context != null && runtime.canProjectMetadataExecution(execution, context)) {
            return runtime.evaluateMetadataExecution(execution, context, args, applyEffects = false)
        }
        return null
    }

    private suspend fun invokeHandler(
        execution: ExecutionDef,
        context: DataSourceContext?,
        args: Map<String, Any?>,
        handler: Handler,
        applyState: Boolean
    ): Any? {
        val params = if (context != null) {
            parameterResolver.resolve(execution.parameters, context)
        } else {
            ParameterResolution(emptyMap(), emptyList())
        }
        val result = handler.invoke(ExecutionArgs(execution, context, params.inbound, args))
        if (applyState && result != false && execution.state.isNotEmpty() && context != null) {
            runtime.setWindowFormValues(
                context.window.windowId,
                execution.state.mapValues { JsonUtil.elementToAny(it.value) }
            )
        }
        return result
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
        "dataSource.isFormDirty" -> handler@{ args ->
            val context = args.context ?: return@handler false
            context.isFormDirty()
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
        "reportRuntime.executeAction" -> handler@{ args ->
            val execution = JsonUtil.asStringMap(args.args["execution"]).takeIf { it.isNotEmpty() } ?: args.args
            val kind = (execution["kind"] as? String)?.trim()?.takeIf { it.isNotEmpty() } ?: return@handler null
            val handlerName: String
            val forwardedArgs: Map<String, Any?>
            when (kind) {
                "keep", "exclude" -> {
                    val refinement = JsonUtil.asStringMap(execution["refinement"]).takeIf { it.isNotEmpty() } ?: return@handler null
                    handlerName = "reportRuntime.applyRefinement"
                    forwardedArgs = mapOf("refinement" to refinement)
                }
                "drill" -> {
                    val refinement = JsonUtil.asStringMap(execution["refinement"]).takeIf { it.isNotEmpty() } ?: return@handler null
                    handlerName = "reportRuntime.applyDrillTransition"
                    forwardedArgs = buildMap {
                        put("refinement", refinement)
                        putAll(JsonUtil.asStringMap(execution["transition"]))
                    }
                }
                "detail" -> {
                    val detailRequest = JsonUtil.asStringMap(execution["detailRequest"]).takeIf { it.isNotEmpty() } ?: return@handler null
                    handlerName = "reportRuntime.openDetailTarget"
                    forwardedArgs = mapOf("detailRequest" to detailRequest)
                }
                "removeRefinement" -> {
                    val refinementId = (execution["refinementId"] ?: execution["refinementID"])?.toString()?.trim()?.takeIf { it.isNotEmpty() } ?: return@handler null
                    handlerName = "reportRuntime.removeRefinement"
                    forwardedArgs = mapOf("refinementId" to refinementId)
                }
                "clearRefinements" -> {
                    handlerName = "reportRuntime.clearRefinements"
                    forwardedArgs = emptyMap()
                }
                "undoRefinements" -> {
                    handlerName = "reportRuntime.undoRefinements"
                    forwardedArgs = emptyMap()
                }
                "redoRefinements" -> {
                    handlerName = "reportRuntime.redoRefinements"
                    forwardedArgs = emptyMap()
                }
                "exportPdf" -> {
                    val exportRequest = JsonUtil.asStringMap(execution["exportRequest"])
                        .takeIf { it.isNotEmpty() }
                        ?: return@handler null
                    handlerName = "reportRuntime.exportPdf"
                    forwardedArgs = mapOf("exportRequest" to exportRequest)
                }
                else -> return@handler null
            }
            val handler = handlers.resolve(handlerName)
                ?: return@handler mapOf("executed" to false, "reason" to "unsupportedExecution")
            handler.invoke(ExecutionArgs(ExecutionDef(handler = handlerName), args.context, emptyMap(), forwardedArgs))
                ?: mapOf("executed" to true, "branch" to kind)
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

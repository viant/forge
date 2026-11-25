package com.viant.forgeandroid.runtime

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

class DataSourceRuntime(
    private val signals: SignalRegistry,
    private val restClient: RestClient,
    private val scope: CoroutineScope,
    private val reportRequestInspectionOnly: Boolean = false,
    private val authorizeReportRead: ((DataSourceContext, InputState) -> Boolean)? = null
) {
    data class LoaderResult(
        val rows: List<Map<String, Any?>> = emptyList(),
        val metrics: Map<String, Any?> = emptyMap(),
        val form: Map<String, Any?>? = null,
        val selection: Map<String, Any?>? = null,
        val rowIndex: Int? = null
    )

    private data class PreparedCompletion(val windowId: String, val instanceRef: String, val result: CompletableDeferred<PreparedReportFetchResult>)
    private val preparedCompletions = java.util.concurrent.ConcurrentHashMap<String, PreparedCompletion>()
    private val jobs = mutableMapOf<String, Job>()
    private val registeredContexts = java.util.concurrent.ConcurrentHashMap<String, java.util.concurrent.ConcurrentHashMap<String, DataSourceContext>>()
    internal fun registeredSource(windowId: String, ref: String) = registeredContexts[windowId]?.get(ref)
    fun registeredWindowContexts(windowId: String): Map<String, DataSourceContext> = registeredContexts[windowId]?.toMap().orEmpty()
    private val parameterResolver = ParameterResolver()
    private var executor: ((ExecutionDef, DataSourceContext, Map<String, Any?>) -> Unit)? = null
    private var collectionLoader: (suspend (DataSourceContext, String?) -> LoaderResult?)? = null

    fun setExecutor(executor: (ExecutionDef, DataSourceContext, Map<String, Any?>) -> Unit) {
        this.executor = executor
    }

    fun setCollectionLoader(loader: suspend (DataSourceContext) -> LoaderResult?) {
        setRequestLoader { context, _ -> loader(context) }
    }

    internal fun setRequestLoader(loader: suspend (DataSourceContext, String?) -> LoaderResult?) {
        collectionLoader = loader
    }

    fun attach(window: WindowContext, dataSourceRef: String): DataSourceContext {
        return attachConfigured(window, dataSourceRef, dataSourceRef)
    }

    /**
     * Attaches an independently addressable request to a configured data source.
     * Report documents can reference several logical datasets backed by the same
     * service; using the logical dataset id keeps their input, rows and loading
     * state isolated without changing metadata/parameter resolution semantics.
     */
    fun attachConfigured(
        window: WindowContext,
        instanceRef: String,
        dataSourceRef: String
    ): DataSourceContext {
        return attachInternal(window, instanceRef, dataSourceRef, required = true)!!
    }

    fun attachOrNull(window: WindowContext, dataSourceRef: String): DataSourceContext? {
        return attachInternal(window, dataSourceRef, dataSourceRef, required = false)
    }

    fun attachConfiguredOrNull(
        window: WindowContext,
        instanceRef: String,
        dataSourceRef: String
    ): DataSourceContext? {
        return attachInternal(window, instanceRef, dataSourceRef, required = false)
    }

    private fun attachInternal(
        window: WindowContext,
        instanceRef: String,
        dataSourceRef: String,
        required: Boolean
    ): DataSourceContext? {
        val dsId = window.identity.dataSourceId(instanceRef)
        val dataSource = window.metadata.peek()?.dataSources?.get(dataSourceRef)
            ?: if (required) error("DataSource not found: $dataSourceRef") else return null

        val selectionMode = dataSource.selectionMode ?: "single"
        val initialSelection = if (selectionMode == "multi") SelectionState(selection = emptyList()) else SelectionState()

        val ctx = DataSourceContext(
            window = window,
            dataSourceRef = dataSourceRef,
            dataSource = dataSource,
            collection = signals.collection(dsId),
            form = signals.form(dsId),
            selection = signals.selection(dsId, initialSelection),
            input = signals.input(dsId),
            control = signals.control(dsId),
            metrics = signals.metrics(dsId),
            eventDispatcher = { execution, args -> executor?.invoke(execution, this, args) },
            selectionHook = { row, rowIndex -> applySelectionHook(this, row, rowIndex) },
            instanceRef = instanceRef,
            preparedAuthorization = { proposed ->
                val owned = window.metadata.peek()?.let { dataSourceRef in reportOwnedDataSourceRefs(it) } == true
                !owned || authorizeReportRead?.invoke(registeredContexts[window.windowId]?.get(instanceRef) ?: error("The datasource is not registered."), proposed) != false
            },
            preparedRegister = { id -> preparedCompletions[id] = PreparedCompletion(window.windowId, instanceRef, CompletableDeferred()) },
            preparedAwait = { id ->
                val completion = checkNotNull(preparedCompletions[id]) { "The prepared report dispatch is unavailable." }
                check(completion.windowId == window.windowId && completion.instanceRef == instanceRef) { "The prepared report dispatch belongs to another datasource." }
                try { completion.result.await() } finally { preparedCompletions.remove(id, completion) }
            }
        )
        registeredContexts.computeIfAbsent(window.windowId) { java.util.concurrent.ConcurrentHashMap() }[instanceRef] = ctx
        if (!jobs.containsKey(dsId)) {
            applyInitialParameters(ctx)
            jobs[dsId] = scope.launch(Dispatchers.IO) {
                ctx.input.flow.collectLatest { input ->
                    if (input.fetch) {
                        fetchCollection(ctx, requestedInput = input)
                    }
                }
            }
        }
        return ctx
    }

    fun detachWindow(windowId: String) {
        preparedCompletions.entries.filter { it.value.windowId == windowId }.forEach { (id, completion) ->
            preparedCompletions.remove(id, completion); completion.result.cancel(CancellationException("Report window closed."))
        }
        registeredContexts.remove(windowId)
        jobs.keys.filter { it.startsWith(windowId) }.forEach { key ->
            jobs.remove(key)?.cancel()
        }
    }

    /** Invoke the configured reader without publishing input, rows, lifecycle events, or auto-selection. */
    internal suspend fun readSelectionRows(window: WindowContext, ref: String, parameters: Map<String, Any?>, invocationId: String): List<Map<String, Any?>> {
        val metadata = window.metadata.peek() ?: error("Window metadata is unavailable.")
        val definition = metadata.dataSources[ref] ?: error("Selection reader is unavailable: $ref")
        require(ref !in reportOwnedDataSourceRefs(metadata)) { "This reader requires report admission." }
        val request = DataSourceContext(window.captureRequest(window.peekWindowForm(), metadata), ref, definition,
            Signal(emptyList()), Signal(emptyMap()), Signal(SelectionState()), Signal(InputState(parameters = parameters)),
            Signal(ControlState()), Signal(emptyMap()), { _, _ -> })
        val reader = collectionLoader
        val rows = if (reader != null) {
            val receipt = reader(request, invocationId) ?: error("The selection reader did not acknowledge the request: $ref")
            receipt.rows
        } else {
            val binding = buildRequest(request, suppliedInputs = parameters, detachedReadId = invocationId) ?: error("No physical selection reader is configured: $ref")
            val response = executeRequest(definition.service?.endpoint, binding, requireRecords = true)
            val records = collectionValue(response, definition.selectors?.data, requireRecords = true)
            require(records is List<*> && records.all { it is Map<*, *> }) { "The selection reader did not return an array of records." }
            normalizeCollection(records)
        }
        return applyResourceModel(request, rows)
    }

    private suspend fun fetchCollection(live: DataSourceContext, lifecyclePath: List<String> = emptyList(), requestedInput: InputState = live.input.peek()) {
        val ctx = live.captureRequest(requestedInput)
        val currentPath = lifecyclePath + ctx.dataSourceRef
        val commitGuard = requestedInput.preparedGuard
        val reportOwned = live.window.metadata.peek()?.let { live.dataSourceRef in reportOwnedDataSourceRefs(it) } == true
        if (reportOwned && reportRequestInspectionOnly) { failPrepared(ctx, "Debug report inspection is active."); return }
        fun canCommit() = (!reportOwned || commitGuard != null) && commitGuard?.invoke() != false &&
            (commitGuard == null || live.input.peek().preparedDispatchId == requestedInput.preparedDispatchId) &&
            (!reportOwned || authorizeReportRead?.invoke(live, requestedInput) != false)
        if (!canCommit()) { failPrepared(ctx, "The prepared report dispatch is stale or unauthorized."); return }
        ctx.control.set(ctx.control.peek().copy(loading = true, error = null, resolved = false, requestId = requestedInput.preparedDispatchId))

        var receivedResponse = false
        try {
            val loaderResult = collectionLoader?.invoke(ctx, null)
            if (loaderResult != null) {
                receivedResponse = true
                currentCoroutineContext().ensureActive()
                if (!canCommit()) { failPrepared(ctx, "The prepared report dispatch is stale or unauthorized."); return }
                val data = applyNamedFetchHooks(ctx, applyCollectionHook(ctx, applyResourceModel(ctx, loaderResult.rows)), currentPath)
                currentCoroutineContext().ensureActive()
                if (!canCommit()) { failPrepared(ctx, "The prepared report dispatch is stale or unauthorized."); return }
                ctx.collection.set(data)
                if (loaderResult.form != null) {
                    ctx.form.set(loaderResult.form)
                }
                if (loaderResult.selection != null) {
                    val preparedSelection = applySelectionHook(
                        ctx,
                        loaderResult.selection,
                        loaderResult.rowIndex ?: -1
                    )
                    currentCoroutineContext().ensureActive()
                    if (!canCommit()) { failPrepared(ctx, "The prepared report dispatch is stale or unauthorized."); return }
                    ctx.selection.set(
                        SelectionState(
                            selected = preparedSelection,
                            rowIndex = loaderResult.rowIndex ?: -1
                        )
                    )
                    if (loaderResult.form == null) {
                        ctx.form.set(preparedSelection)
                    }
                } else if (ctx.dataSource.autoSelect != false && data.isNotEmpty() && ctx.peekSelection().selected == null) {
                    ctx.toggleSelection(data.first(), 0, commitGuard = { canCommit() })
                }
                currentCoroutineContext().ensureActive()
                if (!canCommit()) { failPrepared(ctx, "The prepared report dispatch is stale or unauthorized."); return }
                ctx.metrics.set(loaderResult.metrics)
                trigger(ctx, "onFetch", mapOf("collection" to data), currentPath)
                trigger(ctx, "onSuccess", mapOf("collection" to data), currentPath)
                if (!canCommit()) { failPrepared(ctx, "The prepared report dispatch is stale or unauthorized."); return }
                finishFetch(ctx, rows = data, metrics = loaderResult.metrics)
                return
            }

            val endpoint = ctx.dataSource.service?.endpoint
            val request = buildRequest(ctx) ?: run {
                val message = when {
                    reportOwned -> "The report datasource has no physical loader."
                    requestedInput.preparedDispatchId != null -> "The command datasource has no physical loader."
                    else -> null
                }
                finishFetch(ctx, error = message, cause = message?.let(::IllegalStateException))
                return
            }

            val requireRecords = requestedInput.requireCommandRecords && requestedInput.preparedDispatchId != null
            val response = executeRequest(endpoint, request, requireRecords)
            receivedResponse = true
            currentCoroutineContext().ensureActive()
            if (!canCommit()) { failPrepared(ctx, "The prepared report dispatch is stale or unauthorized."); return }
            val rawRows = collectionValue(response, ctx.dataSource.selectors?.data, requireRecords)
            val data = applyNamedFetchHooks(ctx, applyCollectionHook(
                ctx,
                applyResourceModel(ctx, normalizeCollection(rawRows))
            ), currentPath)
            currentCoroutineContext().ensureActive()
            val dataInfo = normalizeDataInfo(response, ctx.dataSource.selectors?.dataInfo)
            if (!canCommit()) { failPrepared(ctx, "The prepared report dispatch is stale or unauthorized."); return }
            ctx.collection.set(data)
            if (ctx.dataSource.autoSelect != false && data.isNotEmpty() && ctx.peekSelection().selected == null) {
                ctx.toggleSelection(data.first(), 0, commitGuard = { canCommit() })
            }
            currentCoroutineContext().ensureActive()
            if (!canCommit()) { failPrepared(ctx, "The prepared report dispatch is stale or unauthorized."); return }
            if (dataInfo.isNotEmpty()) {
                ctx.metrics.set(dataInfo)
            } else {
                ctx.metrics.set(extractPagingMetrics(response, ctx.dataSource))
            }
            trigger(ctx, "onFetch", mapOf("collection" to data, "response" to response), currentPath)
            trigger(ctx, "onSuccess", mapOf("collection" to data, "response" to response), currentPath)
            if (!canCommit()) { failPrepared(ctx, "The prepared report dispatch is stale or unauthorized."); return }
            // The datasource still exposes object rows. A correlated command receipt may also contain JSON scalars.
            val invocationRows = if (requireRecords && rawRows is List<*> && rawRows.any { it !is Map<*, *> }) rawRows else data
            finishFetch(ctx, rows = invocationRows, metrics = if (dataInfo.isNotEmpty()) dataInfo else extractPagingMetrics(response, ctx.dataSource),
                recordsConfirmed = rawRows is List<*>)
        } catch (e: CancellationException) {
            failPrepared(ctx, "The prepared report query was cancelled.")
            throw e
        } catch (e: Exception) {
            if (!canCommit()) { failPrepared(ctx, "The prepared report dispatch is stale or unauthorized."); return }
            trigger(ctx, "onError", mapOf("error" to (e.message ?: "Unknown error")), currentPath)
            if (!canCommit()) { failPrepared(ctx, "The prepared report dispatch is stale or unauthorized."); return }
            finishFetch(ctx, error = e.message ?: e.javaClass.simpleName, cause = e, recordsConfirmed = !receivedResponse)
        } finally {
            if (requestedInput.fetch) {
                live.input.update { current ->
                    if (current === requestedInput) current.copy(fetch = false, refresh = false, requireCommandRecords = false) else current
                }
            }
        }
    }

    private fun executeRequest(endpoint: String?, request: DataSourceRequest, requireRecords: Boolean): Map<String, Any?> {
        val parser: (String) -> Map<String, Any?> = { body ->
            val value = JsonUtil.elementToAny(JsonUtil.json.parseToJsonElement(body))
            if (requireRecords && value is List<*>) mapOf("data" to value) else JsonUtil.asStringMap(value)
        }
        return restClient.request(endpoint, request.method, request.uri, request.body, parser, singleAttempt = requireRecords)
    }

    private fun failPrepared(ctx: DataSourceContext, message: String) {
        ctx.input.peek().preparedDispatchId?.let { preparedCompletions[it]?.result?.completeExceptionally(IllegalStateException(message)) }
    }

    private fun finishFetch(ctx: DataSourceContext, error: String? = null, rows: List<*> = emptyList<Any?>(), metrics: Map<String, Any?> = emptyMap(), cause: Throwable? = null, recordsConfirmed: Boolean = true) {
        ctx.control.set(ctx.control.peek().copy(loading = false, error = error, resolved = true))
        ctx.input.peek().preparedDispatchId?.let { id -> preparedCompletions[id]?.result?.complete(PreparedReportFetchResult(JsonUtil.anyToElement(rows).jsonArray, JsonUtil.anyToElement(metrics).jsonObject, error, cause, recordsConfirmed)) }
    }

    private suspend fun applyCollectionHook(
        ctx: DataSourceContext,
        rows: List<Map<String, Any?>>
    ): List<Map<String, Any?>> {
        val code = ctx.window.metadata.peek()?.actions?.code?.trim().orEmpty()
        if (code.isBlank()) {
            return rows
        }
        val result = ActionHookRuntime.invoke(
            code = code,
            functionName = "prepareCollection",
            props = JsonObject(
                mapOf(
                    "collection" to JsonArray(rows.map(JsonUtil::anyToElement))
                )
            )
        ) ?: return rows
        return when (result) {
            is JsonArray -> result.mapNotNull { element ->
                JsonUtil.elementToAny(element) as? Map<*, *>
            }.map { row ->
                row.entries.associate { it.key.toString() to it.value }
            }
            else -> rows
        }
    }

    private suspend fun applyResourceModel(ctx: DataSourceContext, rows: List<Map<String, Any?>>): List<Map<String, Any?>> {
        val modelRef = ctx.dataSource.resourceModelRef ?: return rows
        val metadata = ctx.window.metadata.peek() ?: return rows
        val code = metadata.actions?.code?.trim().orEmpty()
        val hook: ResourceModelHook? = if (code.isBlank()) null else { name, value ->
            val result = ActionHookRuntime.invoke(code, name, JsonUtil.anyToElement(value))
            result?.let(JsonUtil::elementToAny) ?: value
        }
        return rows.map { row ->
            JsonUtil.asStringMap(ResourceModelRuntime.unmarshal(row, modelRef, metadata.schemas, metadata.resourceModels, hook))
        }
    }

    private suspend fun applySelectionHook(
        ctx: DataSourceContext,
        row: Map<String, Any?>,
        rowIndex: Int
    ): Map<String, Any?> {
        val code = ctx.window.metadata.peek()?.actions?.code?.trim().orEmpty()
        if (code.isBlank()) {
            return row
        }
        val result = ActionHookRuntime.invoke(
            code = code,
            functionName = "prepareSelection",
            props = JsonObject(
                mapOf(
                    "selected" to JsonUtil.anyToElement(row),
                    "rowIndex" to JsonPrimitive(rowIndex)
                )
            )
        ) ?: return row
        return (JsonUtil.elementToAny(result) as? Map<*, *>)
            ?.entries
            ?.associate { it.key.toString() to it.value }
            ?: row
    }

    private fun buildRequest(ctx: DataSourceContext, suppliedInputs: Map<String, Any?> = emptyMap(), detachedReadId: String? = null): DataSourceRequest? {
        val baseUri = ctx.dataSource.service?.uri ?: ctx.dataSource.uri ?: return null
        val method = (ctx.dataSource.service?.method ?: ctx.dataSource.method ?: "GET")
            .trim()
            .uppercase()
            .ifBlank { "GET" }
        return if (method == "GET") {
            DataSourceRequest(method = "GET", uri = buildRequestUri(ctx, baseUri))
        } else {
            DataSourceRequest(
                method = method,
                uri = baseUri,
                body = buildRequestBody(ctx, baseUri, suppliedInputs, detachedReadId)
            )
        }
    }

    private fun buildRequestUri(ctx: DataSourceContext, baseUri: String): String {
        val query = linkedMapOf<String, String>()

        ctx.dataSource.params.forEach { (key, value) ->
            query[key] = value
        }

        ctx.dataSource.parameters.forEach { parameter ->
            if (isCompactParameter(parameter)) {
                return@forEach
            }
            val target = parameter.to ?: return@forEach
            if (!(target.endsWith(":query") || target == "query" || target.endsWith(":input.query"))) {
                return@forEach
            }
            val name = parameter.name ?: return@forEach
            val value = resolveParameterValue(ctx, parameter) ?: return@forEach
            query[name] = value.toString()
        }
        compactInputValues(ctx, "query").forEach { (key, value) ->
            if (value != null) query[key] = value.toString()
        }

        ctx.input.peek().filter.forEach { (key, value) ->
            if (value != null) {
                query[key] = value.toString()
            }
        }

        val paging = ctx.dataSource.paging
        if (paging?.enabled != false) {
            val pageParameters = paging?.parameters.orEmpty()
            val pageValue = ctx.input.peek().page
            if (pageValue != null) {
                val pageParamName = pageParameters["page"] ?: "page"
                query[pageParamName] = resolvedPageValue(pageParamName, pageValue, paging?.size).toString()
            }
            val sizeValue = paging?.size
            if (sizeValue != null && sizeValue > 0) {
                query[pageParameters["size"] ?: "size"] = sizeValue.toString()
            }
        }

        if (query.isEmpty()) {
            return baseUri
        }
        val separator = if (baseUri.contains("?")) "&" else "?"
        val encoded = query.entries.joinToString("&") { (key, value) ->
            "${urlEncode(key)}=${urlEncode(value)}"
        }
        return baseUri + separator + encoded
    }

    private fun buildRequestBody(ctx: DataSourceContext, baseUri: String, suppliedInputs: Map<String, Any?>, detachedReadId: String?): String {
        val payload = if (isDatasourceFetchRoute(baseUri)) {
            val inputs = buildDatasourceFetchInputs(ctx)
            buildMap<String, Any?> {
                put("inputs", if (suppliedInputs.isEmpty()) inputs else inputs + suppliedInputs)
                if (detachedReadId != null) {
                    put("cache", mapOf("bypassCache" to true))
                    put("invocationId", detachedReadId)
                }
            }
        } else {
            buildBodyParameters(ctx)
        }
        return JsonUtil.json.encodeToString(
            kotlinx.serialization.json.JsonElement.serializer(),
            JsonUtil.anyToElement(payload)
        )
    }

    private fun buildDatasourceFetchInputs(ctx: DataSourceContext): Map<String, Any?> {
        val inputs = linkedMapOf<String, Any?>()
        ctx.dataSource.params.forEach { (key, value) -> inputs[key] = value }
        ctx.dataSource.parameters.forEach { parameter ->
            if (isCompactParameter(parameter)) {
                return@forEach
            }
            val target = parameter.to ?: return@forEach
            if (!(target.endsWith(":query") || target == "query" || target.endsWith(":input.query"))) {
                return@forEach
            }
            val name = parameter.name ?: return@forEach
            inputs[name] = resolveParameterValue(ctx, parameter) ?: return@forEach
        }
        inputs.putAll(compactInputValues(ctx, "query"))
        val paging = ctx.dataSource.paging
        if (paging?.enabled != false) {
            val pageParameters = paging?.parameters.orEmpty()
            val pageValue = ctx.input.peek().page
            if (pageValue != null) {
                val pageParamName = pageParameters["page"] ?: "page"
                val sizeValue = paging?.size
                inputs[pageParamName] = resolvedPageValue(pageParamName, pageValue, sizeValue)
                if (sizeValue != null && sizeValue > 0) {
                    inputs[pageParameters["size"] ?: "size"] = sizeValue
                }
            }
        }
        ctx.input.peek().filter.forEach { (key, value) ->
            if (value != null) {
                inputs[key] = value
            }
        }
        return inputs
    }

    private fun buildBodyParameters(ctx: DataSourceContext): Map<String, Any?> {
        val body = linkedMapOf<String, Any?>()
        ctx.dataSource.parameters.forEach { parameter ->
            if (isCompactParameter(parameter)) {
                return@forEach
            }
            val target = parameter.to ?: return@forEach
            if (!(target.endsWith(":body") || target == "body" || target.endsWith(":input.body"))) {
                return@forEach
            }
            val name = parameter.name ?: return@forEach
            body[name] = resolveParameterValue(ctx, parameter) ?: return@forEach
        }
        body.putAll(compactInputValues(ctx, "body"))
        return body
    }

    private fun isCompactParameter(parameter: ParameterDef): Boolean =
        parameter.from?.contains(":") == true && parameter.to?.contains(":") == true

    private fun compactInputValues(ctx: DataSourceContext, store: String): Map<String, Any?> {
        val resolved = parameterResolver.resolve(ctx.dataSource.parameters, ctx)
        val dataSourceValues = resolved.inbound[ctx.dataSourceRef].orEmpty()
        return JsonUtil.asStringMap(JsonUtil.asStringMap(dataSourceValues["input"])[store])
    }

    private fun resolvedPageValue(pageParamName: String, pageValue: Int, pageSize: Int?): Int =
        if (pageParamName.lowercase() == "offset") {
            val size = pageSize?.takeIf { it > 0 } ?: 0
            ((pageValue.takeIf { it > 0 } ?: 1) - 1) * size
        } else {
            pageValue
        }

    private fun isDatasourceFetchRoute(uri: String): Boolean =
        Regex("""(^|/)v1/api/datasources/[^/]+/fetch(?:\?.*)?$""").containsMatchIn(uri)

    private fun resolveParameterValue(ctx: DataSourceContext, parameter: ParameterDef): Any? {
        val source = ((parameter.from ?: "").ifBlank { parameter.input ?: "" }).lowercase()
        val (sourceContext, location) = resolveSourceContext(ctx, parameter.location)
        return when (source) {
            "const" -> parameter.locationAny() ?: parameter.value?.let(JsonUtil::elementToAny)
            "form" -> location?.let { SelectorUtil.resolve(sourceContext.peekForm(), it) }
            "datasource" -> resolveFromLegacyDataSource(sourceContext, location)
            "metrics" -> location?.let {
                SelectorUtil.resolve(sourceContext.metrics.peek(), it)
                    ?: SelectorUtil.resolve(sourceContext.collection.peek().firstOrNull().orEmpty(), it)
            }
            "filter", "input.query", "query" -> location?.let { SelectorUtil.resolve(sourceContext.peekFilter(), it) }
            "input" -> location?.let { SelectorUtil.resolve(inputObject(sourceContext.input.peek()), it) }
            "selection" -> location?.let { SelectorUtil.resolve(sourceContext.peekSelection().selected ?: emptyMap<String, Any?>(), it) }
            "windowform" -> location?.let { SelectorUtil.resolve(ctx.window.peekWindowForm(), it) }
            else -> {
                parameter.value?.let(JsonUtil::elementToAny)
                    ?: parameter.selector?.let { SelectorUtil.resolve(ctx.window.peekWindowForm(), it) }
                    ?: location?.let { SelectorUtil.resolve(sourceContext.peekFilter(), it) }
                    ?: parameter.locationAny()
            }
        }
    }

    private fun resolveFromLegacyDataSource(ctx: DataSourceContext, location: String?): Any? {
        val path = location.orEmpty()
        val candidates = listOf(
            ctx.peekSelection().selected,
            ctx.peekForm(),
            ctx.peekFilter(),
            inputObject(ctx.input.peek())
        )
        return candidates.firstNotNullOfOrNull { candidate ->
            candidate?.let { if (path.isBlank()) it else SelectorUtil.resolve(it, path) }
        }
    }

    private fun inputObject(input: InputState): Map<String, Any?> {
        val output = linkedMapOf<String, Any?>(
            "filter" to input.filter,
            "parameters" to input.parameters,
            "fetch" to input.fetch,
            "refresh" to input.refresh
        )
        if (input.page != null) {
            output["page"] = input.page
        }
        return output
    }

    private fun resolveSourceContext(ctx: DataSourceContext, rawLocation: String?): Pair<DataSourceContext, String?> {
        val location = rawLocation?.trim().orEmpty()
        if (location.isEmpty()) {
            return ctx to rawLocation
        }
        val dotIndex = location.indexOf('.')
        if (dotIndex <= 0) {
            return ctx to location
        }
        val possibleRef = location.substring(0, dotIndex)
        val metadata = ctx.window.metadata.peek()
        if (possibleRef == ctx.dataSourceRef) return ctx to location.substring(dotIndex + 1)
        if (metadata?.dataSources?.containsKey(possibleRef) == true) {
            return ctx.window.context(possibleRef) to location.substring(dotIndex + 1)
        }
        return ctx to location
    }

    private fun urlEncode(value: String): String = URLEncoder.encode(value, StandardCharsets.UTF_8.toString())

    private fun collectionValue(response: Map<String, Any?>, selector: String?, requireRecords: Boolean): Any? =
        if (selector.isNullOrBlank()) {
            response["data"] ?: response["entries"] ?: response["Rows"] ?: response["rows"] ?: response
        } else {
            selectValue(response, selector) ?: if (requireRecords) null else
                response["data"] ?: response["entries"] ?: response["Rows"] ?: response["rows"]
        }

    private fun normalizeCollection(raw: Any?): List<Map<String, Any?>> = when (raw) {
        is List<*> -> raw.mapNotNull { normalizeMap(it) }
        is Map<*, *> -> listOf(normalizeMap(raw))
        else -> emptyList()
    }

    private fun extractPagingMetrics(response: Map<String, Any?>, dataSource: DataSourceDef): Map<String, Any?> {
        val out = linkedMapOf<String, Any?>()
        val selectors = dataSource.paging?.dataInfoSelectors.orEmpty()
        selectors.forEach { (name, path) ->
            selectValue(response, path)?.let { out[name] = it }
        }
        listOf("pageCount", "totalCount", "nextCursor", "prevCursor", "hasMore", "cursor").forEach { key ->
            selectValue(response, key)?.let { out.putIfAbsent(key, it) }
        }
        return out
    }

    private fun selectValue(response: Map<String, Any?>, selector: String?): Any? {
        val path = selector?.trim().orEmpty()
        if (path.isEmpty()) {
            return response
        }
        return SelectorUtil.resolve(response, path)
    }

    private fun normalizeDataInfo(response: Map<String, Any?>, selector: String?): Map<String, Any?> {
        val path = selector?.trim().orEmpty()
        if (path.isEmpty()) {
            return emptyMap()
        }
        return normalizeMap(selectValue(response, path))
    }

    @Suppress("UNCHECKED_CAST")
    private fun normalizeMap(value: Any?): Map<String, Any?> {
        return when (value) {
            is Map<*, *> -> value.entries.associate { it.key.toString() to it.value }
            else -> emptyMap()
        }
    }

    private suspend fun trigger(
        ctx: DataSourceContext,
        event: String,
        args: Map<String, Any?> = emptyMap(),
        lifecyclePath: List<String> = listOf(ctx.dataSourceRef)
    ) {
        val metadata = ctx.window.metadata.peek()
        ctx.dataSource.on
            .filter { it.event == event }
            .forEach { execution ->
                val handler = execution.handler?.trim().orEmpty()
                val code = metadata?.actions?.code?.trim().orEmpty()
                if (event == "onFetch") {
                    return@forEach
                } else if (metadata != null && code.isNotBlank() && metadata.actionNamespace(handler) != null) {
                    runLifecycleHook(ctx, execution, code, metadata, args["collection"] as? List<Map<String, Any?>> ?: ctx.collection.peek(), lifecyclePath)
                } else {
                    executor?.invoke(execution, ctx, args)
                }
            }
    }

    private suspend fun runLifecycleHook(
        source: DataSourceContext,
        execution: ExecutionDef,
        code: String,
        metadata: WindowMetadata,
        collection: List<Map<String, Any?>>,
        lifecyclePath: List<String>
    ) {
        val handler = execution.handler ?: return
        try {
            val snapshots = JsonObject(metadata.dataSources.keys.associateWith { ref ->
                val context = source.window.contextOrNull(ref)
                JsonObject(
                    mapOf(
                        "form" to JsonUtil.anyToElement(context?.form?.peek().orEmpty()),
                        "collection" to JsonUtil.anyToElement(context?.collection?.peek().orEmpty())
                    )
                )
            })
            val projection = DataSourceHookProjection.invoke(
                code = code,
                functionName = handler,
                namespace = metadata.actionNamespace(handler),
                source = source.dataSourceRef,
                snapshots = snapshots,
                windowForm = source.window.peekWindowForm(),
                collection = collection
            )
            applyLifecycleEffects(source, projection.effects, lifecyclePath)
        } catch (error: Exception) {
            println("Forge datasource lifecycle hook failed [$handler]: ${error.message}")
        }
    }

    private suspend fun applyNamedFetchHooks(
        source: DataSourceContext,
        rows: List<Map<String, Any?>>,
        lifecyclePath: List<String>
    ): List<Map<String, Any?>> {
        val metadata = source.window.metadata.peek() ?: return rows
        val code = metadata.actions?.code?.trim().orEmpty()
        if (code.isBlank()) return rows
        var current = rows
        source.dataSource.on.filter { it.event == "onFetch" }.forEach { execution ->
            val handler = execution.handler?.trim().orEmpty()
            if (metadata.actionNamespace(handler) == null) {
                executor?.invoke(execution, source, mapOf("collection" to current))
                return@forEach
            }
            try {
                val projection = DataSourceHookProjection.invoke(
                    code = code,
                    functionName = handler,
                    namespace = metadata.actionNamespace(handler),
                    source = source.dataSourceRef,
                    snapshots = lifecycleSnapshots(source, metadata),
                    windowForm = source.window.peekWindowForm(),
                    collection = current
                )
                applyLifecycleEffects(source, projection.effects, lifecyclePath)
                val transformed = projection.result as? JsonArray
                if (transformed != null) {
                    current = transformed.mapNotNull { JsonUtil.elementToAny(it) as? Map<*, *> }
                        .map { row -> row.entries.associate { it.key.toString() to it.value } }
                }
            } catch (error: Exception) {
                println("Forge datasource onFetch hook failed [$handler]: ${error.message}")
            }
        }
        return current
    }

    private fun lifecycleSnapshots(source: DataSourceContext, metadata: WindowMetadata): JsonObject =
        JsonObject(metadata.dataSources.keys.associateWith { ref ->
            val context = source.window.contextOrNull(ref)
            JsonObject(
                mapOf(
                    "form" to JsonUtil.anyToElement(context?.form?.peek().orEmpty()),
                    "collection" to JsonUtil.anyToElement(context?.collection?.peek().orEmpty())
                )
            )
        })

    private suspend fun applyLifecycleEffects(
        source: DataSourceContext,
        effects: List<DataSourceLifecycleEffect>,
        lifecyclePath: List<String>
    ) {
        effects.forEach { effect ->
                val target = source.window.contextOrNull(effect.ref) ?: return@forEach
                when (effect.kind) {
                    "form" -> (JsonUtil.elementToAny(effect.value) as? Map<*, *>)?.let { value ->
                        target.setForm(value.entries.associate { it.key.toString() to it.value })
                    }
                    "input" -> (JsonUtil.elementToAny(effect.value) as? Map<*, *>)?.let { value ->
                        target.setInputParameters(value.entries.associate { it.key.toString() to it.value })
                    }
                    "fetch" -> {
                        if (effect.ref in lifecyclePath || lifecyclePath.size >= 16) {
                            println("Forge datasource hook cycle rejected: $lifecyclePath -> ${effect.ref}")
                        } else {
                            fetchCollection(target, lifecyclePath)
                        }
                    }
                }
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun applyInitialParameters(ctx: DataSourceContext) {
        val windowParameters = ctx.window.parameters
        if (windowParameters.isEmpty()) {
            return
        }
        val scoped = windowParameters[ctx.dataSourceRef] as? Map<String, Any?>
        val payload = scoped ?: windowParameters
        if (payload.isEmpty()) {
            return
        }

        val inputPayload = payload["input"] as? Map<String, Any?> ?: emptyMap()
        val query = inputPayload["query"] as? Map<String, Any?> ?: emptyMap()
        val mergedFilter = linkedMapOf<String, Any?>().apply {
            putAll(query)
            putAll(ctx.input.peek().filter)
        }

        if (mergedFilter.isNotEmpty() || payload["page"] != null) {
            val nextInput = ctx.input.peek().copy(
                filter = mergedFilter,
                parameters = payload,
                page = (payload["page"] as? Number)?.toInt() ?: ctx.input.peek().page
            )
            ctx.input.set(nextInput)
        } else if (payload.isNotEmpty()) {
            ctx.input.set(ctx.input.peek().copy(parameters = payload))
        }

        val formSeed = payload
            .filterKeys { it != "input" && it != "page" && it != "selection" && it != "selected" }
            .filterValues { it !is Map<*, *> || it.keys.none { key -> key in setOf("query", "path", "headers", "body") } }
        if (formSeed.isNotEmpty() && ctx.peekForm().isEmpty()) {
            ctx.setForm(formSeed)
        }

        applyInitialSelection(ctx, payload)
    }

    @Suppress("UNCHECKED_CAST")
    private fun applyInitialSelection(ctx: DataSourceContext, payload: Map<String, Any?>) {
        if (ctx.peekSelection().selected != null) {
            return
        }
        val seed = (payload["selection"] as? Map<String, Any?>)
            ?: (payload["selected"] as? Map<String, Any?>)
            ?: return
        if (seed.isEmpty()) {
            return
        }
        val rowIndex = (payload["rowIndex"] as? Number)?.toInt() ?: -1
        scope.launch { ctx.toggleSelection(seed, rowIndex) }
    }
}

private data class DataSourceRequest(
    val method: String,
    val uri: String,
    val body: String = "{}"
)

class DataSourceContext(
    val window: WindowContext,
    val dataSourceRef: String,
    val dataSource: DataSourceDef,
    val collection: Signal<List<Map<String, Any?>>>,
    val form: Signal<Map<String, Any?>>,
    val selection: Signal<SelectionState>,
    val input: Signal<InputState>,
    val control: Signal<ControlState>,
    val metrics: Signal<Map<String, Any?>>,
    private val eventDispatcher: DataSourceContext.(ExecutionDef, Map<String, Any?>) -> Unit = { _, _ -> },
    private val selectionHook: suspend DataSourceContext.(Map<String, Any?>, Int) -> Map<String, Any?> = { row, _ -> row },
    val instanceRef: String = dataSourceRef,
    private val preparedAuthorization: (InputState) -> Boolean = { true },
    private val preparedRegister: (String) -> Unit = {},
    private val preparedAwait: suspend (String) -> PreparedReportFetchResult = { error("Prepared report completion is unavailable.") }
) {
    fun peekForm(): Map<String, Any?> = form.peek()
    fun setForm(values: Map<String, Any?>) = form.set(values)
    fun setFormField(key: String, value: Any?) = form.set(form.peek().toMutableMap().apply { this[key] = value })

    internal fun captureFormFields(names: List<String>): Map<String, Any?> {
        if (names.isEmpty()) return emptyMap()
        val current = form.peek()
        return buildMap { names.forEach { if (it in current) put(it, snapshotInputValue(current[it])) } }
    }

    internal fun clearSubmittedFormFields(submitted: Map<String, Any?>, isCurrent: () -> Boolean) {
        if (submitted.isEmpty()) return
        form.update { live ->
            if (!isCurrent()) return@update live
            var edited: MutableMap<String, Any?>? = null
            for ((field, original) in submitted) {
                val value = live[field]
                if (value == null || (value is List<*> && value.isEmpty()) || snapshotInputValue(value) != original) continue
                val next = edited ?: live.toMutableMap().also { edited = it }
                next[field] = if (original is List<*>) emptyList<Any?>() else null
            }
            edited ?: live
        }
    }

    fun peekSelection(): SelectionState = selection.peek()
    fun setSelection(state: SelectionState) = selection.set(state)

    fun resetSelection(selectionModeOverride: String? = null) {
        val mode = selectionModeOverride?.takeIf { it.isNotBlank() } ?: dataSource.selectionMode ?: "single"
        if (mode == "multi") {
            selection.set(SelectionState(selection = emptyList()))
        } else {
            selection.set(SelectionState())
        }
    }

    fun peekFilter(): Map<String, Any?> = input.peek().filter

    fun hasSelection(): Boolean {
        val current = selection.peek()
        val mode = dataSource.selectionMode ?: "single"
        return if (mode == "multi") {
            current.selection.isNotEmpty()
        } else {
            current.selected != null
        }
    }

    fun isFormDirty(): Boolean {
        val currentForm = peekForm()
        val selected = peekSelection().selected
        return if (selected == null) {
            currentForm.isNotEmpty()
        } else {
            currentForm != selected
        }
    }

    fun setFilterValue(key: String, value: Any?) {
        val next = input.peek().filter.toMutableMap()
        next[key] = value
        input.set(input.peek().copy(filter = next, preparedGuard = null, preparedWindowForm = null, preparedMetadata = null, preparedDispatchId = null, preparedReadPermit = null))
    }

    fun fetchCollection() {
        val current = input.peek()
        input.set(current.copy(fetch = true, refresh = !current.refresh))
    }
    fun fetchCollectionAutomatically():Boolean {
        if(dataSource.autoFetch==false) return false
        fetchCollection();return true
    }

    suspend fun toggleSelection(row: Map<String, Any?>, rowIndex: Int, selectionModeOverride: String? = null, commitGuard: (() -> Boolean)? = null) {
        if (commitGuard?.invoke() == false) return
        val preparedRow = selectionHook(row, rowIndex)
        currentCoroutineContext().ensureActive()
        if (commitGuard?.invoke() == false) return
        val mode = selectionModeOverride?.takeIf { it.isNotBlank() } ?: dataSource.selectionMode ?: "single"
        if (mode == "multi") {
            val current = selection.peek().selection.toMutableList()
            val exists = current.contains(preparedRow)
            if (exists) current.remove(preparedRow) else current.add(preparedRow)
            selection.set(selection.peek().copy(selected = current.lastOrNull(), selection = current))
        } else {
            val current = selection.peek()
            if (current.rowIndex == rowIndex || current.selected == preparedRow) {
                resetSelection(selectionModeOverride)
                form.set(emptyMap())
            } else {
                selection.set(SelectionState(selected = preparedRow, rowIndex = rowIndex))
                form.set(preparedRow)
                trigger(
                    "onSelection",
                    mapOf(
                        "row" to preparedRow,
                        "rowIndex" to rowIndex,
                        "selected" to preparedRow,
                        "sourceRow" to row
                    )
                )
            }
        }
    }

    fun setFilter(filter: Map<String, Any?>) {
        input.set(input.peek().copy(filter = filter, fetch = true, preparedGuard = null, preparedWindowForm = null, preparedMetadata = null, preparedDispatchId = null, preparedReadPermit = null))
    }

    internal fun captureRequest(snapshot: InputState): DataSourceContext = DataSourceContext(
        window.captureRequest(snapshot.preparedWindowForm ?: window.peekWindowForm(), snapshot.preparedMetadata ?: window.metadata.peek()),
        dataSourceRef, dataSource, collection, form, selection, Signal(snapshot), control, metrics, eventDispatcher, selectionHook, instanceRef, preparedAuthorization, preparedRegister, preparedAwait)

    internal suspend fun fetchCommandResult(parameters: Map<String, Any?>, requireRecords: Boolean = false): PreparedReportFetchResult {
        val id = checkNotNull(setInputParametersValue(parameters, fetch = true, captureResult = true, requireRecords = requireRecords))
        return preparedAwait(id)
    }

    fun setPreparedInputParameters(parameters: Map<String, Any?>, permit: NativeReportReadPermit? = null, commitGuard: () -> Boolean): String? {
        if (!commitGuard()) return null
        return setInputParametersValue(parameters, fetch = true, commitGuard = commitGuard, permit = permit)
    }
    suspend fun awaitPreparedResult(dispatchId: String): PreparedReportFetchResult = preparedAwait(dispatchId)

    /** Hydrate only an already verified frozen dataset; this never schedules physical IO. */
    fun hydrateFrozenReportDataset(dataset:NativeReportDatasetAdmission,rows:JsonArray):Boolean {
        val windowForm=JsonUtil.anyToElement(window.peekWindowForm()) as? JsonObject ?: return false
        if(windowForm["executeOnOpen"]!=JsonPrimitive(false) || (windowForm["reportMaterialization"] as? JsonObject)?.get("status")!=JsonPrimitive("completed")) return false
        val expectedInstance=if(dataset.id=="primary") dataset.dataSourceRef else "reportDocument:${dataset.id}"
        if(instanceRef!=expectedInstance || dataSourceRef!=dataset.dataSourceRef) return false
        val matches=(windowForm["reportStaticDatasets"] as? JsonArray).orEmpty().filterIsInstance<JsonObject>().filter { it["id"]==JsonPrimitive(dataset.id) }
        val saved=matches.singleOrNull() ?: return false
        if(saved["dataSourceRef"]!=JsonPrimitive(dataset.dataSourceRef) || saved["request"]!=dataset.request || saved["rows"]!=rows) return false
        val parameters=JsonUtil.asStringMap(JsonUtil.elementToAny(dataset.request))
        val frozenInput=InputState(filter=JsonUtil.asStringMap(parameters["filters"]),parameters=parameters)
        if(input.peek()!=frozenInput) input.set(frozenInput)
        val values=rows.map { JsonUtil.asStringMap(JsonUtil.elementToAny(it)) }
        if(collection.peek()!=values) collection.set(values)
        val resolved=control.peek().copy(loading=false,error=null,resolved=true)
        if(control.peek()!=resolved) control.set(resolved)
        val frozenMetrics=mapOf("rowCount" to values.size,"frozen" to true)
        if(metrics.peek()!=frozenMetrics) metrics.set(frozenMetrics)
        return true
    }

    /** A report can preserve primary query identity without storing a primary dataset. */
    fun hydrateFrozenReportPrimaryIdentity(prepared:PreparedReportRequest):Boolean {
        val windowForm=JsonUtil.anyToElement(window.peekWindowForm()) as? JsonObject ?: return false
        if(instanceRef!=dataSourceRef || dataSourceRef!=prepared.dataSourceRef || windowForm["executeOnOpen"]!=JsonPrimitive(false) ||
            (windowForm["reportMaterialization"] as? JsonObject)?.get("status")!=JsonPrimitive("completed")) return false
        if((windowForm["reportStaticDatasets"] as? JsonArray).orEmpty().any { (it as? JsonObject)?.get("id")==JsonPrimitive("primary") }) return false
        val parameters=JsonUtil.asStringMap(JsonUtil.elementToAny(prepared.primaryRequest))
        val frozenInput=InputState(filter=JsonUtil.asStringMap(parameters["filters"]),parameters=parameters)
        if(input.peek()!=frozenInput) input.set(frozenInput)
        if(collection.peek().isNotEmpty()) collection.set(emptyList())
        val unresolved=ControlState(resolved=false)
        if(control.peek()!=unresolved) control.set(unresolved)
        val frozenMetrics=mapOf("frozen" to true,"dataStored" to false)
        if(metrics.peek()!=frozenMetrics) metrics.set(frozenMetrics)
        return true
    }

    fun setInputParameters(parameters: Map<String, Any?>, fetch: Boolean = false) {
        setInputParametersValue(parameters, fetch)
    }

    // Detach mutable inputs while preserving the scalar types supplied by callers.
    private fun snapshotInputValue(value: Any?): Any? = when (value) {
        is JsonElement -> JsonUtil.elementToAny(value)
        is Map<*, *> -> value.entries.associate { it.key.toString() to snapshotInputValue(it.value) }
        is List<*> -> value.map(::snapshotInputValue)
        is Number, is Boolean, is String, null -> value
        else -> value.toString()
    }

    private fun setInputParametersValue(parameters: Map<String, Any?>, fetch: Boolean = false, commitGuard: (() -> Boolean)? = null, permit: NativeReportReadPermit? = null, captureResult: Boolean = false, requireRecords: Boolean = false): String? {
        val current = input.peek()
        val inputPayload = JsonUtil.asStringMap(parameters["input"])
        val query = JsonUtil.asStringMap(inputPayload["query"])
        val nextFilter = if (query.isNotEmpty()) {
            current.filter.toMutableMap().apply { putAll(query) }
        } else {
            current.filter
        }
        val next = current.copy(parameters = parameters.mapValues { snapshotInputValue(it.value) }, filter = nextFilter, fetch = fetch || current.fetch,
            preparedGuard = commitGuard, requireCommandRecords = requireRecords,
            preparedWindowForm = if (commitGuard == null) null else window.peekWindowForm().mapValues { snapshotInputValue(it.value) },
            preparedMetadata = if (commitGuard == null) null else window.metadata.peek(),
            preparedDispatchId = if (commitGuard == null && !captureResult) null else java.util.UUID.randomUUID().toString(), preparedReadPermit = permit)
        if (commitGuard != null && !preparedAuthorization(next)) return null
        if (permit != null || captureResult) next.preparedDispatchId?.let(preparedRegister)
        input.set(next)
        return next.preparedDispatchId
    }

    fun setMetrics(key: String, value: Any?) {
        val next = metrics.peek().toMutableMap()
        next[key] = value
        metrics.set(next)
    }

    fun setPage(page: Int?) {
        input.set(input.peek().copy(page = page, fetch = true, preparedGuard = null, preparedWindowForm = null, preparedMetadata = null, preparedDispatchId = null, preparedReadPermit = null))
    }

    private fun trigger(event: String, args: Map<String, Any?> = emptyMap()) {
        dataSource.on
            .filter { it.event == event }
            .forEach { execution ->
                eventDispatcher(execution, args)
            }
    }
}

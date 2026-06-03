package com.viant.forgeandroid.runtime

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

class DataSourceRuntime(
    private val signals: SignalRegistry,
    private val restClient: RestClient,
    private val scope: CoroutineScope
) {
    data class LoaderResult(
        val rows: List<Map<String, Any?>> = emptyList(),
        val metrics: Map<String, Any?> = emptyMap(),
        val form: Map<String, Any?>? = null,
        val selection: Map<String, Any?>? = null,
        val rowIndex: Int? = null
    )

    private val jobs = mutableMapOf<String, Job>()
    private var executor: ((ExecutionDef, DataSourceContext, Map<String, Any?>) -> Unit)? = null
    private var collectionLoader: (suspend (DataSourceContext) -> LoaderResult?)? = null

    fun setExecutor(executor: (ExecutionDef, DataSourceContext, Map<String, Any?>) -> Unit) {
        this.executor = executor
    }

    fun setCollectionLoader(loader: suspend (DataSourceContext) -> LoaderResult?) {
        collectionLoader = loader
    }

    fun attach(window: WindowContext, dataSourceRef: String): DataSourceContext {
        val dsId = window.identity.dataSourceId(dataSourceRef)
        val dataSource = window.metadata.peek()?.dataSources?.get(dataSourceRef)
            ?: error("DataSource not found: $dataSourceRef")

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
            selectionHook = { row, rowIndex -> applySelectionHook(this, row, rowIndex) }
        )
        applyInitialParameters(ctx)

        if (!jobs.containsKey(dsId)) {
            jobs[dsId] = scope.launch(Dispatchers.IO) {
                ctx.input.flow.collectLatest { input ->
                    if (input.fetch) {
                        fetchCollection(ctx)
                    }
                }
            }
        }
        return ctx
    }

    fun attachOrNull(window: WindowContext, dataSourceRef: String): DataSourceContext? {
        val dsId = window.identity.dataSourceId(dataSourceRef)
        val dataSource = window.metadata.peek()?.dataSources?.get(dataSourceRef) ?: return null

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
            selectionHook = { row, rowIndex -> applySelectionHook(this, row, rowIndex) }
        )
        applyInitialParameters(ctx)

        if (!jobs.containsKey(dsId)) {
            jobs[dsId] = scope.launch(Dispatchers.IO) {
                ctx.input.flow.collectLatest { input ->
                    if (input.fetch) {
                        fetchCollection(ctx)
                    }
                }
            }
        }
        return ctx
    }

    fun detachWindow(windowId: String) {
        jobs.keys.filter { it.startsWith(windowId) }.forEach { key ->
            jobs.remove(key)?.cancel()
        }
    }

    private suspend fun fetchCollection(ctx: DataSourceContext) {
        ctx.control.set(ctx.control.peek().copy(loading = true, error = null))

        try {
            val loaderResult = collectionLoader?.invoke(ctx)
            if (loaderResult != null) {
                val data = applyCollectionHook(ctx, loaderResult.rows)
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
                    ctx.toggleSelection(data.first(), 0)
                }
                ctx.metrics.set(loaderResult.metrics)
                trigger(ctx, "onFetch", mapOf("collection" to data))
                trigger(ctx, "onSuccess", mapOf("collection" to data))
                ctx.control.set(ctx.control.peek().copy(loading = false, error = null))
                ctx.input.set(ctx.input.peek().copy(fetch = false, refresh = false))
                return
            }

            val service = ctx.dataSource.service ?: return
            val endpoint = service.endpoint
            val uri = buildRequestUri(ctx) ?: return

            val response = restClient.get(endpoint, uri) { JsonUtil.parseObject(it) }
            val data = applyCollectionHook(
                ctx,
                normalizeCollection(response, ctx.dataSource.selectors?.data)
            )
            val dataInfo = normalizeMap(selectValue(response, ctx.dataSource.selectors?.dataInfo))
            ctx.collection.set(data)
            if (ctx.dataSource.autoSelect != false && data.isNotEmpty() && ctx.peekSelection().selected == null) {
                ctx.toggleSelection(data.first(), 0)
            }
            if (dataInfo.isNotEmpty()) {
                ctx.metrics.set(dataInfo)
            } else {
                ctx.metrics.set(extractPagingMetrics(response, ctx.dataSource))
            }
            trigger(ctx, "onFetch", mapOf("collection" to data, "response" to response))
            trigger(ctx, "onSuccess", mapOf("collection" to data, "response" to response))
            ctx.control.set(ctx.control.peek().copy(loading = false, error = null))
            ctx.input.set(ctx.input.peek().copy(fetch = false, refresh = false))
        } catch (e: Exception) {
            trigger(ctx, "onError", mapOf("error" to (e.message ?: "Unknown error")))
            ctx.control.set(ctx.control.peek().copy(loading = false, error = e.message))
            ctx.input.set(ctx.input.peek().copy(fetch = false, refresh = false))
        }
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

    private fun buildRequestUri(ctx: DataSourceContext): String? {
        val service = ctx.dataSource.service ?: return null
        val baseUri = service.uri ?: return null
        val query = linkedMapOf<String, String>()

        ctx.dataSource.params.forEach { (key, value) ->
            query[key] = value
        }

        ctx.dataSource.parameters.forEach { parameter ->
            val target = parameter.to ?: return@forEach
            if (!(target.endsWith(":query") || target == "query" || target.endsWith(":input.query"))) {
                return@forEach
            }
            val name = parameter.name ?: return@forEach
            val value = resolveParameterValue(ctx, parameter) ?: return@forEach
            query[name] = value.toString()
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
                query[pageParameters["page"] ?: "page"] = pageValue.toString()
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

    private fun resolveParameterValue(ctx: DataSourceContext, parameter: ParameterDef): Any? {
        val source = ((parameter.from ?: "").ifBlank { parameter.input ?: "" }).lowercase()
        return when (source) {
            "const" -> parameter.location
            "form" -> parameter.location?.let { ctx.peekForm()[it] }
            "filter", "input.query", "query" -> parameter.location?.let { ctx.peekFilter()[it] }
            "selection" -> parameter.location?.let { SelectorUtil.resolve(ctx.peekSelection().selected ?: emptyMap<String, Any?>(), it) }
            "windowform" -> parameter.location?.let { SelectorUtil.resolve(ctx.window.peekWindowForm(), it) }
            else -> parameter.location?.let { ctx.peekFilter()[it] } ?: parameter.location
        }
    }

    private fun urlEncode(value: String): String = URLEncoder.encode(value, StandardCharsets.UTF_8.toString())

    private fun normalizeCollection(response: Map<String, Any?>, selector: String?): List<Map<String, Any?>> {
        val raw = if (selector.isNullOrBlank()) {
            response["data"] ?: response["entries"] ?: response["Rows"] ?: response["rows"] ?: response
        } else {
            selectValue(response, selector) ?: response["data"] ?: response["entries"] ?: response["Rows"] ?: response["rows"]
        }
        return when (raw) {
            is List<*> -> raw.mapNotNull { normalizeMap(it) }
            is Map<*, *> -> listOf(normalizeMap(raw))
            else -> emptyList()
        }
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

    @Suppress("UNCHECKED_CAST")
    private fun normalizeMap(value: Any?): Map<String, Any?> {
        return when (value) {
            is Map<*, *> -> value.entries.associate { it.key.toString() to it.value }
            else -> emptyMap()
        }
    }

    private fun trigger(ctx: DataSourceContext, event: String, args: Map<String, Any?> = emptyMap()) {
        ctx.dataSource.on
            .filter { it.event == event }
            .forEach { execution ->
                executor?.invoke(execution, ctx, args)
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
    private val selectionHook: suspend DataSourceContext.(Map<String, Any?>, Int) -> Map<String, Any?> = { row, _ -> row }
) {
    fun peekForm(): Map<String, Any?> = form.peek()
    fun setForm(values: Map<String, Any?>) = form.set(values)
    fun setFormField(key: String, value: Any?) = form.set(form.peek().toMutableMap().apply { this[key] = value })

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
        input.set(input.peek().copy(filter = next))
    }

    fun fetchCollection() {
        input.set(input.peek().copy(fetch = true))
    }

    suspend fun toggleSelection(row: Map<String, Any?>, rowIndex: Int, selectionModeOverride: String? = null) {
        val preparedRow = selectionHook(row, rowIndex)
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
        input.set(input.peek().copy(filter = filter, fetch = true))
    }

    fun setInputParameters(parameters: Map<String, Any?>, fetch: Boolean = false) {
        val current = input.peek()
        val inputPayload = JsonUtil.asStringMap(parameters["input"])
        val query = JsonUtil.asStringMap(inputPayload["query"])
        val nextFilter = if (query.isNotEmpty()) {
            current.filter.toMutableMap().apply { putAll(query) }
        } else {
            current.filter
        }
        input.set(current.copy(parameters = parameters, filter = nextFilter, fetch = fetch || current.fetch))
    }

    fun setMetrics(key: String, value: Any?) {
        val next = metrics.peek().toMutableMap()
        next[key] = value
        metrics.set(next)
    }

    fun setPage(page: Int?) {
        input.set(input.peek().copy(page = page, fetch = true))
    }

    private fun trigger(event: String, args: Map<String, Any?> = emptyMap()) {
        dataSource.on
            .filter { it.event == event }
            .forEach { execution ->
                eventDispatcher(execution, args)
            }
    }
}

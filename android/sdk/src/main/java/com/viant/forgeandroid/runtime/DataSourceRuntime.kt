package com.viant.forgeandroid.runtime

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class DataSourceRuntime(
    private val signals: SignalRegistry,
    private val restClient: RestClient,
    private val scope: CoroutineScope
) {
    private val jobs = mutableMapOf<String, Job>()

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
            metrics = signals.metrics(dsId)
        )

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
            metrics = signals.metrics(dsId)
        )

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

    private fun fetchCollection(ctx: DataSourceContext) {
        val service = ctx.dataSource.service ?: return
        val endpoint = service.endpoint
        val uri = service.uri ?: return

        ctx.control.set(ctx.control.peek().copy(loading = true, error = null))

        try {
            val response = restClient.get(endpoint, uri) { JsonUtil.parseObject(it) }
            val data = when (val raw = response["data"]) {
                is List<*> -> raw.mapNotNull { it as? Map<String, Any?> }
                is Map<*, *> -> listOf(raw as Map<String, Any?>)
                else -> emptyList()
            }
            ctx.collection.set(data)
            ctx.control.set(ctx.control.peek().copy(loading = false, error = null))
            ctx.input.set(ctx.input.peek().copy(fetch = false, refresh = false))
        } catch (e: Exception) {
            ctx.control.set(ctx.control.peek().copy(loading = false, error = e.message))
            ctx.input.set(ctx.input.peek().copy(fetch = false, refresh = false))
        }
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
    val metrics: Signal<Map<String, Any?>>
) {
    fun peekForm(): Map<String, Any?> = form.peek()
    fun setForm(values: Map<String, Any?>) = form.set(values)
    fun setFormField(key: String, value: Any?) = form.set(form.peek().toMutableMap().apply { this[key] = value })

    fun peekSelection(): SelectionState = selection.peek()
    fun setSelection(state: SelectionState) = selection.set(state)

    fun peekFilter(): Map<String, Any?> = input.peek().filter

    fun setFilterValue(key: String, value: Any?) {
        val next = input.peek().filter.toMutableMap()
        next[key] = value
        input.set(input.peek().copy(filter = next))
    }

    fun fetchCollection() {
        input.set(input.peek().copy(fetch = true))
    }

    fun toggleSelection(row: Map<String, Any?>, rowIndex: Int) {
        val mode = dataSource.selectionMode ?: "single"
        if (mode == "multi") {
            val current = selection.peek().selection.toMutableList()
            val exists = current.contains(row)
            if (exists) current.remove(row) else current.add(row)
            selection.set(selection.peek().copy(selection = current))
        } else {
            val current = selection.peek()
            if (current.rowIndex == rowIndex) {
                selection.set(SelectionState())
                form.set(emptyMap())
            } else {
                selection.set(SelectionState(selected = row, rowIndex = rowIndex))
                form.set(row)
            }
        }
    }

    fun setFilter(filter: Map<String, Any?>) {
        input.set(input.peek().copy(filter = filter, fetch = true))
    }

    fun setMetrics(key: String, value: Any?) {
        val next = metrics.peek().toMutableMap()
        next[key] = value
        metrics.set(next)
    }
}

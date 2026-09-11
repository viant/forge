package com.viant.forgeandroid.ui
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Button
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.evaluateDashboardCondition
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.ItemDef
import com.viant.forgeandroid.runtime.LayoutDef
import com.viant.forgeandroid.runtime.SelectorUtil
import com.viant.forgeandroid.runtime.SelectionState
import com.viant.forgeandroid.runtime.WindowContext
import com.viant.forgeandroid.runtime.DataStateBoundaryKind
import com.viant.forgeandroid.runtime.WorkflowPrimitiveRuntime
import com.viant.forgeandroid.runtime.JsonUtil
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject

@Composable
fun ContainerRenderer(
    runtime: ForgeRuntime,
    window: WindowContext,
    container: ContainerDef,
    selectionModeOverride: String? = null,
    inheritedDataSourceRef: String? = null,
    suppressTitle: Boolean = false,
    modifier: Modifier = Modifier
) {
    val windowFormSignal = window.windowFormSignal()
    val windowForm by windowFormSignal.flow.collectAsState(initial = windowFormSignal.peek())
    val effectiveDataSourceRef = container.dataSourceRef?.trim().orEmpty().ifBlank { inheritedDataSourceRef.orEmpty() }
    val chartDataSourceRef = resolveChartDataSourceRef(windowForm, container, effectiveDataSourceRef.ifBlank { null })
    val visibilityContext = resolveContainerVisibilityContext(window, container, chartDataSourceRef)
    val visibilityMetrics by if (visibilityContext != null) {
        visibilityContext.metrics.flow.collectAsState(initial = visibilityContext.metrics.peek())
    } else {
        androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(emptyMap()) }
    }
    val visibilityCollection by if (visibilityContext != null) {
        visibilityContext.collection.flow.collectAsState(initial = visibilityContext.collection.peek())
    } else {
        androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(emptyList<Map<String, Any?>>()) }
    }
    val visibilityForm by if (visibilityContext != null) {
        visibilityContext.form.flow.collectAsState(initial = visibilityContext.form.peek())
    } else {
        androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(emptyMap()) }
    }
    val visibilityInput by if (visibilityContext != null) {
        visibilityContext.input.flow.collectAsState(initial = visibilityContext.input.peek())
    } else {
        androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(com.viant.forgeandroid.runtime.InputState()) }
    }
    val visibilitySelection by if (visibilityContext != null) {
        visibilityContext.selection.flow.collectAsState(initial = visibilityContext.selection.peek())
    } else {
        androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(SelectionState()) }
    }
    val boundaryContexts = if (container.dataStateBoundary != null) {
        container.dataStateBoundary.dataSourceRefs
            .mapNotNull(window::contextOrNull)
            .distinctBy { it.dataSourceRef }
            .ifEmpty { listOfNotNull(visibilityContext) }
    } else {
        emptyList()
    }
    val boundaryControls = mutableListOf<com.viant.forgeandroid.runtime.ControlState>()
    val boundaryCollections = mutableListOf<List<Map<String, Any?>>>()
    for (boundaryContext in boundaryContexts) {
        val boundaryControl by boundaryContext.control.flow.collectAsState(initial = boundaryContext.control.peek())
        val boundaryCollection by boundaryContext.collection.flow.collectAsState(initial = boundaryContext.collection.peek())
        val boundaryForm by boundaryContext.form.flow.collectAsState(initial = boundaryContext.form.peek())
        val boundaryMetrics by boundaryContext.metrics.flow.collectAsState(initial = boundaryContext.metrics.peek())
        boundaryControls += boundaryControl
        boundaryCollections += effectiveBoundaryRows(boundaryCollection, boundaryForm, boundaryMetrics)
    }
    val permissionContext = container.permissionBoundary?.dataSourceRef?.takeIf(String::isNotBlank)?.let(window::contextOrNull)
    val permissionGrants by if (permissionContext != null) {
        permissionContext.collection.flow.collectAsState(initial = permissionContext.collection.peek())
    } else {
        remember { androidx.compose.runtime.mutableStateOf(emptyList()) }
    }
    val permissionSpec = container.permissionBoundary
    val permissionMode = permissionSpec?.mode?.trim()?.lowercase() ?: "resource"
    val permissionRows = when (permissionMode) {
        "selection" -> visibilitySelection.selection.ifEmpty { visibilitySelection.selected?.let(::listOf).orEmpty() }
        "row" -> visibilityCollection
        else -> emptyList()
    }
    val authorizationSnapshot = window.metadata.peek()?.authorizationSnapshot
        ?.mapValues { JsonUtil.elementToAny(it.value) }
        .orEmpty()
    val permissionPredicateAllows = permissionSpec?.visibleWhen == null || evaluateDashboardCondition(
        permissionSpec.visibleWhen,
        metrics = visibilityMetrics,
        form = visibilityForm,
        windowForm = windowForm,
        collection = visibilityCollection
    )
    val permissionAllowed = permissionSpec == null || (permissionPredicateAllows && WorkflowPrimitiveRuntime.permissionAllows(
        permissionSpec,
        authorizationSnapshot,
        permissionRows,
        permissionGrants
    ))
    val kind = container.kind?.trim().orEmpty()
    val customRenderer = LocalForgeContainerRendererRegistry.current.renderer(kind)
    val presentationDensity = LocalForgePresentationDensity.current

    LaunchedEffect(container.id, visibilityContext?.dataSourceRef) {
        val observesPrimitiveState = container.visibleWhen != null ||
            container.dataStateBoundary != null ||
            container.relationDrill != null ||
            container.notificationRules != null ||
            container.metricSummary != null ||
            container.detailView != null ||
            container.mutationCommand != null
        if (observesPrimitiveState && container.dataStateBoundary == null && visibilityContext != null && visibilityContext.dataSource.autoFetch != false) {
            visibilityContext.fetchCollection()
        }
    }

    LaunchedEffect(container.id, boundaryContexts.map { it.dataSourceRef }) {
        if (container.dataStateBoundary != null && container.fetchData != false) {
            boundaryContexts.forEach { boundaryContext ->
                if (boundaryContext.dataSource.autoFetch != false) boundaryContext.fetchCollection()
            }
        }
    }

    LaunchedEffect(container.id, permissionAllowed, permissionMode, visibilityContext?.dataSourceRef) {
        if (!permissionAllowed && permissionMode == "selection") visibilityContext?.resetSelection()
    }

    if (kind != "dashboard" && !kind.startsWith("dashboard.") &&
        !evaluateDashboardCondition(
            condition = container.visibleWhen,
            metrics = visibilityMetrics,
            filters = visibilityInput.filter,
            form = visibilityForm,
            windowForm = windowForm,
            collection = visibilityCollection,
            input = mapOf(
                "filter" to visibilityInput.filter,
                "parameters" to visibilityInput.parameters,
                "page" to visibilityInput.page,
                "fetch" to visibilityInput.fetch,
                "refresh" to visibilityInput.refresh
            ),
            selectionValues = mapOf(
                "selected" to visibilitySelection.selected,
                "selection" to visibilitySelection.selection,
                "rowIndex" to visibilitySelection.rowIndex
            )
        )
    ) {
        return
    }

    val dataBoundaryKind = container.dataStateBoundary?.let { boundary ->
        WorkflowPrimitiveRuntime.dataStateBoundaryKind(
            controls = boundaryControls,
            collections = boundaryCollections,
            allowPartial = boundary.allowPartial
        )
    }
    container.dataStateBoundary?.let { boundary ->
        when (dataBoundaryKind) {
            DataStateBoundaryKind.Loading -> {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = modifier.padding(12.dp)) {
                    CircularProgressIndicator()
                    Text(boundary.loadingMessage ?: "Loading…")
                }
                return
            }
            DataStateBoundaryKind.Error -> {
                val suppressed = boundary.suppressErrorWhen?.let { condition ->
                    evaluateDashboardCondition(
                        condition = condition,
                        metrics = visibilityMetrics,
                        filters = visibilityInput.filter,
                        form = visibilityForm,
                        windowForm = windowForm,
                        collection = visibilityCollection
                    )
                } == true
                if (!suppressed) {
                    Column(modifier = modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(boundary.errorMessage ?: visibilityContext?.control?.peek()?.error ?: "Unable to load data.", color = Color(0xFFB42318))
                        boundary.errorAction?.let { action ->
                            Button(
                                onClick = {
                                    val ref = action.dataSourceRef?.trim().orEmpty().ifBlank {
                                        boundary.dataSourceRefs.firstOrNull().orEmpty().ifBlank { container.dataSourceRef ?: inheritedDataSourceRef.orEmpty() }
                                    }
                                    if (ref.isNotBlank()) runtime.refreshDataSourceCollection(window.windowId, ref)
                                },
                                modifier = Modifier.semantics { contentDescription = action.label ?: "Retry" }
                            ) { Text(action.label ?: "Retry") }
                        }
                    }
                }
                return
            }
            DataStateBoundaryKind.Empty -> if (!boundary.renderEmptyContent) {
                Text(
                    boundary.emptyMessage ?: "No data",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = modifier.fillMaxWidth().padding(12.dp)
                )
                return
            }
            else -> Unit
        }
    }

    if (permissionSpec != null && permissionMode == "resource" && !permissionAllowed) {
        Text(
            permissionSpec.deniedMessage ?: "You do not have permission to view this content.",
            color = Color(0xFFB54708),
            modifier = modifier.fillMaxWidth().padding(12.dp).semantics { contentDescription = "Permission denied" }
        )
        return
    }

    if (customRenderer != null) {
        customRenderer.Render(
            ForgeContainerRendererContext(
                runtime = runtime,
                window = window,
                container = container,
                inheritedDataSourceRef = inheritedDataSourceRef,
                suppressTitle = suppressTitle,
                presentationDensity = presentationDensity,
                targetContext = runtime.targetContext,
                modifier = modifier
            )
        )
        return
    }

    if (kind.equals("mobile.controlSheet", ignoreCase = true)) {
        val controlContext = resolveContainerItemsContext(window, container, chartDataSourceRef)
        if (controlContext != null) {
            MobileControlSheetRenderer(runtime, controlContext, container.items, container.title)
        }
        return
    }

    val usesContainerChrome = container.card != null || container.section != null

        if (kind == "dashboard" || kind.startsWith("dashboard.")) {
        Column(modifier = modifier.fillMaxWidth()) {
            DashboardRenderer(runtime, window, container)
        }
        return
    }

    Column(
        modifier = if (usesContainerChrome) {
            val compact = presentationDensity == ForgePresentationDensity.Compact
            modifier
                .fillMaxWidth()
                .padding(horizontal = if (compact) 3.dp else 8.dp, vertical = if (compact) 3.dp else 6.dp)
                .background(Color.White, RoundedCornerShape(if (compact) 14.dp else 18.dp))
                .border(1.dp, Color(0xFFE7ECF3), RoundedCornerShape(if (compact) 14.dp else 18.dp))
                .padding(horizontal = if (compact) 7.dp else 12.dp, vertical = if (compact) 6.dp else 10.dp)
        } else {
            modifier
                .fillMaxWidth()
                .padding(
                    horizontal = if (presentationDensity == ForgePresentationDensity.Compact) 3.dp else 12.dp,
                    vertical = if (presentationDensity == ForgePresentationDensity.Compact) 3.dp else 8.dp
                )
        }
    ) {
        if (!suppressTitle) {
            container.title?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
            }
            container.subtitle?.takeIf { it.isNotBlank() }?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
            }
        }

        if (dataBoundaryKind == DataStateBoundaryKind.Partial) {
            Text(
                container.dataStateBoundary?.staleMessage ?: "Some data is unavailable.",
                color = Color(0xFFB54708),
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)
            )
        }

        if (permissionSpec != null && !permissionAllowed) {
            Text(
                permissionSpec.deniedMessage ?: "The current selection is not permitted.",
                color = Color(0xFFB54708),
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)
            )
        }

        WorkflowPresentationPrimitives(
            runtime = runtime,
            window = window,
            container = container,
            context = visibilityContext,
            windowForm = windowForm
        )

        if (container.wizard != null) {
            WorkflowWizardRenderer(runtime, window, container, visibilityContext, windowForm)
            return@Column
        }

        if (container.assignmentPicker != null) {
            AssignmentPickerRenderer(runtime, window, container)
            return@Column
        }

        if (container.scheduleEditor != null) {
            ScheduleEditorRenderer(runtime, window, container)
            return@Column
        }

        if (container.treeEditor != null) {
            TreeEditorRenderer(runtime, window, container)
            return@Column
        }

        if (container.uploadCollection != null) {
            UploadCollectionRenderer(runtime, window, container)
            return@Column
        }

        if (container.masterDetail != null) {
            MasterDetailRenderer(runtime, window, container)
            return@Column
        }

        if (container.toolbar != null &&
            container.toolbar.placement?.lowercase() !in setOf("afternavigation", "windowheader") &&
            effectiveDataSourceRef.isNotBlank()
        ) {
            WithContainerDataSource(
                window = window,
                dataSourceRef = effectiveDataSourceRef
            ) { toolbarContext ->
                TableToolbar(runtime, toolbarContext, container.toolbar)
            }
        }

        if (container.stableTabs != null) {
            StableTabsRenderer(runtime, window, container, inheritedDataSourceRef)
            return@Column
        }
        if ((container.tabs != null || container.stableTabs != null) && container.containers.isNotEmpty()) {
            val tabContainer = if (container.tabs != null) container else container.copy(
                tabs = com.viant.forgeandroid.runtime.TabsDef(
                    defaultSelectedTabId = container.stableTabs?.defaultSelectedTabId,
                    style = container.stableTabs?.appearance
                )
            )
            TabsRenderer(runtime, window, tabContainer)
            return@Column
        }

        if (container.schemaBasedForm != null) {
            val dsRef = container.schemaBasedForm.dataSourceRef
                ?: container.schemaBasedForm.datasourceRef
                ?: effectiveDataSourceRef
            val dsContext = dsRef?.let(window::contextOrNull)
            if (dsContext != null) {
                val submitExecutions = schemaFormSubmitExecutions(container.schemaBasedForm)
                SchemaBasedFormRenderer(
                    runtime = runtime,
                    context = dsContext,
                    container = container,
                    onSubmit = submitExecutions.takeIf { it.isNotEmpty() }?.let { executions ->
                        { payload ->
                            val args = schemaFormSubmitArgs(payload)
                            executions.forEach { execution ->
                                runtime.execute(execution, dsContext, args)
                            }
                        }
                    }
                )
                return@Column
            }
        }
        if (container.table != null && container.chart == null && effectiveDataSourceRef.isNotBlank()) {
            WithContainerDataSource(
                window = window,
                dataSourceRef = effectiveDataSourceRef,
                fetchData = container.fetchData,
                selectFirst = container.selectFirst
            ) { dsContext ->
                val ownsScroll = (container.scrollMode ?: "").trim().lowercase() in setOf("self", "content")
                if (ownsScroll) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f, fill = true)
                    ) {
                        TableRenderer(runtime, dsContext, responsiveTable(container.table, container, runtime.targetContext.formFactor.orEmpty()), selectionModeOverride = selectionModeOverride)
                    }
                } else {
                    TableRenderer(runtime, dsContext, responsiveTable(container.table, container, runtime.targetContext.formFactor.orEmpty()), selectionModeOverride = selectionModeOverride)
                }
            }
        }

        val treeBrowser = container.treeBrowser
        if (treeBrowser != null) {
            val dsRef = treeBrowser.dataSourceRef ?: effectiveDataSourceRef
            WithContainerDataSource(
                window = window,
                dataSourceRef = dsRef,
                fetchData = container.fetchData
            ) { dsContext ->
                TreeBrowserRenderer(dsContext, treeBrowser, selectionModeOverride)
            }
        }

        val fileBrowser = container.fileBrowser
        val fileBrowserDataSourceRef = fileBrowser?.dataSourceRef ?: effectiveDataSourceRef
        if (fileBrowser != null && fileBrowserDataSourceRef.isNotBlank()) {
            WithContainerDataSource(
                window = window,
                dataSourceRef = fileBrowserDataSourceRef,
                fetchData = container.fetchData
            ) { dsContext ->
                FileBrowserRenderer(runtime, dsContext, fileBrowser)
            }
        }

        if (container.chart != null && chartDataSourceRef != null) {
            WithContainerDataSource(
                window = window,
                dataSourceRef = chartDataSourceRef,
                fetchData = container.fetchData
            ) { dsContext ->
                Column {
                    if (container.items.isNotEmpty()) {
                        FormRenderer(runtime, dsContext, container.items)
                    }
                    ChartTableModeRenderer(runtime, dsContext, container, container.chart)
                }
            }
        }

        if (container.editor != null && effectiveDataSourceRef.isNotBlank()) {
            WithContainerDataSource(
                window = window,
                dataSourceRef = effectiveDataSourceRef,
                fetchData = container.fetchData
            ) { dsContext ->
                EditorRenderer(dsContext, container.editor)
            }
        }

        if (container.terminal != null) {
            val dsRef = container.terminal.dataSourceRef ?: effectiveDataSourceRef
            WithContainerDataSource(
                window = window,
                dataSourceRef = dsRef,
                fetchData = container.fetchData
            ) { dsContext ->
                TerminalRenderer(runtime, dsContext, container.terminal)
            }
        }

        if (container.items.isNotEmpty() && effectiveDataSourceRef.isNotBlank()) {
            val useMenuList = shouldUseMenuList(container.items)
            val menuListBaseContext = if (useMenuList && container.dataSourceRef.isNullOrBlank()) {
                resolveContainerItemsContext(window, container, chartDataSourceRef)
                    ?: window.contextOrNull(effectiveDataSourceRef)
            } else {
                null
            }
            WithContainerDataSource(
                window = window,
                dataSourceRef = effectiveDataSourceRef,
                fetchData = container.fetchData,
                selectFirst = container.selectFirst
            ) { dsContext ->
                if (useMenuList) {
                    MenuListRenderer(runtime, window, container, container.items, dsContext)
                } else {
                    FormRenderer(runtime, dsContext, container.items)
                }
            }
        }

        if (
            container.items.isNotEmpty() &&
            effectiveDataSourceRef.isBlank() &&
            container.chart == null &&
            container.table == null &&
            container.treeBrowser == null &&
            container.fileBrowser == null &&
            container.editor == null &&
            container.terminal == null &&
            container.chat == null &&
            container.schemaBasedForm == null
        ) {
            val fallbackContext = resolveContainerItemsContext(window, container, chartDataSourceRef)
            if (shouldUseMenuList(container.items) || fallbackContext == null) {
                MenuListRenderer(runtime, window, container, container.items, fallbackContext)
            } else {
                FormRenderer(runtime, fallbackContext, container.items)
            }
        }

        if (container.chat != null && effectiveDataSourceRef.isNotBlank()) {
            WithContainerDataSource(
                window = window,
                dataSourceRef = effectiveDataSourceRef,
                fetchData = container.fetchData
            ) { dsContext ->
                ChatRenderer(runtime, dsContext, container.chat)
            }
        }

        if (container.containers.isNotEmpty()) {
            NestedContainersRenderer(
                runtime = runtime,
                window = window,
                container = container,
                selectionModeOverride = selectionModeOverride,
                inheritedDataSourceRef = effectiveDataSourceRef.ifBlank { null }
            )
        }
    }
}

internal fun shouldUseMenuList(items: List<ItemDef>): Boolean {
    if (items.isEmpty()) return false
    val formControlTypes = setOf(
        "text", "textarea", "number", "numeric", "currency", "date", "datetime",
        "checkbox", "toggle", "radio", "select", "dropdown", "multiselect", "lookup",
        "object", "schema", "keyvaluepairs", "treemultiselect"
    )
    if (items.any { item ->
            item.lookup != null || item.type?.trim()?.lowercase() in formControlTypes
        }) {
        return false
    }
    return items.all { item ->
        val type = item.type?.trim()?.lowercase().orEmpty()
        item.on.isNotEmpty() ||
            item.properties["tile"].asString() == "true" ||
            type.isEmpty() ||
            type in setOf("label", "markdown", "button", "action", "link")
    }
}

private fun resolveContainerItemsContext(
    window: WindowContext,
    container: ContainerDef,
    chartDataSourceRef: String?
): DataSourceContext? {
    val candidates = linkedSetOf<String>()
    chartDataSourceRef?.takeIf { it.isNotBlank() }?.let(candidates::add)
    container.items.forEach { item ->
        item.dataSourceRef?.trim()?.takeIf { it.isNotEmpty() }?.let(candidates::add)
        if (item.dataSourceRefs.isNotEmpty()) {
            val source = item.dataSourceRefSource?.trim().orEmpty().ifBlank { "windowForm" }
            val selector = item.dataSourceRefSelector?.trim().orEmpty()
            val mapped = when (source.lowercase()) {
                "windowform" -> SelectorUtil.resolve(window.peekWindowForm(), selector)?.toString()
                else -> null
            }?.trim().orEmpty()
            item.dataSourceRefs[mapped]?.takeIf { it.isNotBlank() }?.let(candidates::add)
            item.dataSourceRefs.values.firstOrNull()?.takeIf { it.isNotBlank() }?.let(candidates::add)
        }
    }
    window.metadata.peek()?.dataSources?.keys?.firstOrNull()?.takeIf { it.isNotBlank() }?.let(candidates::add)
    return candidates.firstNotNullOfOrNull(window::contextOrNull)
}

internal fun schemaFormSubmitExecutions(form: com.viant.forgeandroid.runtime.SchemaBasedFormDef): List<com.viant.forgeandroid.runtime.ExecutionDef> {
    return form.on.filter { execution ->
        execution.event?.trim()?.equals("submit", ignoreCase = true) == true &&
            !execution.handler.isNullOrBlank()
    }
}

internal fun schemaFormSubmitArgs(payload: Map<String, Any?>): Map<String, Any?> {
    return mapOf(
        "data" to payload,
        "payload" to payload,
        "form" to payload
    )
}

private fun resolveContainerVisibilityContext(
    window: WindowContext,
    container: ContainerDef,
    chartDataSourceRef: String?
): DataSourceContext? {
    container.dataStateBoundary?.dataSourceRefs?.firstOrNull { it.isNotBlank() }?.let {
        return window.contextOrNull(it)
    }
    container.metricSummary?.dataSourceRef?.trim().orEmpty().takeIf { it.isNotEmpty() }?.let {
        return window.contextOrNull(it)
    }
    container.detailView?.dataSourceRef?.trim().orEmpty().takeIf { it.isNotEmpty() }?.let {
        return window.contextOrNull(it)
    }
    container.relationDrill?.dataSourceRef?.trim().orEmpty().takeIf { it.isNotEmpty() }?.let {
        return window.contextOrNull(it)
    }
    val explicit = container.visibleWhen?.dataSourceRef?.trim().orEmpty().takeIf { it.isNotEmpty() }
    explicit?.let { return window.contextOrNull(it) }

    container.dataSourceRef?.trim().orEmpty().takeIf { it.isNotEmpty() }?.let {
        return window.contextOrNull(it)
    }

    return resolveContainerItemsContext(window, container, chartDataSourceRef)
}

private fun effectiveBoundaryRows(
    collection: List<Map<String, Any?>>,
    form: Map<String, Any?>,
    metrics: Map<String, Any?>
): List<Map<String, Any?>> = when {
    collection.isNotEmpty() -> collection
    form.isNotEmpty() -> listOf(form)
    metrics.isNotEmpty() -> listOf(metrics)
    else -> emptyList()
}

private fun responsiveTable(
    table: com.viant.forgeandroid.runtime.TableDef,
    container: ContainerDef,
    formFactor: String
): com.viant.forgeandroid.runtime.TableDef {
    val spec = container.responsiveDataGrid ?: return table
    val target = formFactor.trim().lowercase().ifBlank { "phone" }
    val state = WorkflowPrimitiveRuntime.responsiveDataGridState(spec, target) ?: return table
    val projected = if (state.columns.isEmpty()) table.columns else state.columns.mapNotNull { requestedID ->
        table.columns.firstOrNull { column -> listOfNotNull(column.id, column.key, column.name).contains(requestedID) }
    }
    val sticky = state.stickyColumns.orEmpty().toSet()
    val columnJson = Json { ignoreUnknownKeys = true; encodeDefaults = false }
    val columns = projected.map { column ->
        val id = column.id ?: column.key ?: column.name.orEmpty()
        val override = state.columnOverrides[id].orEmpty().toMutableMap()
        if (state.stickyColumns != null) override["frozen"] = JsonPrimitive(id in sticky)
        if (override.isEmpty()) column else runCatching {
            val base = columnJson.encodeToJsonElement(com.viant.forgeandroid.runtime.ColumnDef.serializer(), column).jsonObject.toMutableMap()
            base.putAll(override)
            columnJson.decodeFromJsonElement(com.viant.forgeandroid.runtime.ColumnDef.serializer(), JsonObject(base))
        }.getOrDefault(column)
    }
    return table.copy(
        columns = columns,
        presentation = if (state.rowLayout.equals("table", true)) "tabular" else table.presentation
    )
}

@Composable
private fun WithContainerDataSource(
    window: WindowContext,
    dataSourceRef: String?,
    fetchData: Boolean? = null,
    selectFirst: Boolean? = null,
    content: @Composable (DataSourceContext) -> Unit
) {
    val dsContext = dataSourceRef?.let(window::contextOrNull) ?: return
    val rows by dsContext.collection.flow.collectAsState(initial = emptyList())
    val windowFormSignal = window.windowFormSignal()
    val windowForm by windowFormSignal.flow.collectAsState(initial = windowFormSignal.peek())
    val shouldFetch = fetchData != false && dsContext.dataSource.autoFetch != false
    val windowFormKey = remember(windowForm, dsContext.dataSourceRef) {
        if (dependsOnWindowForm(dsContext.dataSource)) {
            windowFormSignature(windowForm)
        } else {
            ""
        }
    }

    LaunchedEffect(shouldFetch, dsContext.dataSourceRef, windowFormKey) {
        if (shouldFetch) {
            dsContext.fetchCollection()
        }
    }
    LaunchedEffect(selectFirst, rows, dsContext) {
        if (selectFirst == true && rows.isNotEmpty() && dsContext.peekSelection().selected == null) {
            dsContext.toggleSelection(rows.first(), 0)
        }
    }
    content(dsContext)
}

internal fun resolveChartDataSourceRef(
    windowForm: Map<String, Any?>,
    container: ContainerDef,
    inheritedDataSourceRef: String? = null
): String? {
    container.dataSourceRef?.takeIf { it.isNotBlank() }?.let { return it }
    val chart = container.chart ?: return null
    chart.dataSourceRef?.takeIf { it.isNotBlank() }?.let { return it }
    if (chart.dataSourceRefs.isEmpty()) {
        return inheritedDataSourceRef?.takeIf { it.isNotBlank() }
    }
    val source = chart.dataSourceRefSource?.trim().orEmpty().ifBlank { "windowForm" }
    val selector = chart.dataSourceRefSelector?.trim().orEmpty()
    val key = when (source.lowercase()) {
        "windowform" -> SelectorUtil.resolve(windowForm, selector)?.toString()
        else -> null
    }?.trim().orEmpty()
    return chart.dataSourceRefs[key]
        ?: chart.dataSourceRefs.values.firstOrNull()
        ?: inheritedDataSourceRef?.takeIf { it.isNotBlank() }
}

@Composable
private fun NestedContainersRenderer(
    runtime: ForgeRuntime,
    window: WindowContext,
    container: ContainerDef,
    selectionModeOverride: String?,
    inheritedDataSourceRef: String?
) {
    val layout = container.layout
    if (layout?.kind?.equals("split", ignoreCase = true) == true &&
        layout.orientation?.equals("horizontal", ignoreCase = true) == true &&
        container.containers.size >= 2
    ) {
        BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
            if (maxWidth >= 900.dp) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(resolveSpacing(layout.gap, 12.dp))
                ) {
                    container.containers.forEach { nested ->
                        ContainerRenderer(
                            runtime = runtime,
                            window = window,
                            container = nested,
                            selectionModeOverride = selectionModeOverride,
                            inheritedDataSourceRef = nested.dataSourceRef?.takeIf { it.isNotBlank() } ?: inheritedDataSourceRef,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(resolveSpacing(layout.gap, 12.dp))) {
                    container.containers.forEach { nested ->
                        ContainerRenderer(
                            runtime,
                            window,
                            nested,
                            selectionModeOverride,
                            inheritedDataSourceRef = nested.dataSourceRef?.takeIf { it.isNotBlank() } ?: inheritedDataSourceRef
                        )
                    }
                }
            }
        }
        return
    }

    if (layout?.kind?.equals("grid", ignoreCase = true) == true &&
        container.containers.isNotEmpty()
    ) {
        BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
            val declaredColumns = layout.columns ?: 0
            if (declaredColumns >= 24) {
                container.containers.forEach { nested ->
                    ContainerRenderer(
                        runtime,
                        window,
                        nested,
                        selectionModeOverride,
                        inheritedDataSourceRef = nested.dataSourceRef?.takeIf { it.isNotBlank() } ?: inheritedDataSourceRef
                    )
                }
                return@BoxWithConstraints
            }
            val requiresWideGrid = declaredColumns > 6 ||
                container.containers.any { (it.columnSpan ?: 0) > 1 }
            val minimumGridWidth = when {
                !requiresWideGrid -> 700.dp
                declaredColumns >= 12 -> 900.dp
                else -> 760.dp
            }
            if (maxWidth >= minimumGridWidth) {
                GridContainerRows(
                    runtime = runtime,
                    window = window,
                    layout = layout,
                    containers = container.containers,
                    selectionModeOverride = selectionModeOverride,
                    inheritedDataSourceRef = inheritedDataSourceRef
                )
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(resolveSpacing(layout.rowGap ?: layout.gap, 12.dp))) {
                    container.containers.forEach { nested ->
                        ContainerRenderer(
                            runtime,
                            window,
                            nested,
                            selectionModeOverride,
                            inheritedDataSourceRef = nested.dataSourceRef?.takeIf { it.isNotBlank() } ?: inheritedDataSourceRef
                        )
                    }
                }
            }
        }
        return
    }

    container.containers.forEach { nested ->
        ContainerRenderer(
            runtime,
            window,
            nested,
            selectionModeOverride,
            inheritedDataSourceRef = nested.dataSourceRef?.takeIf { it.isNotBlank() } ?: inheritedDataSourceRef
        )
    }
}

@Composable
private fun GridContainerRows(
    runtime: ForgeRuntime,
    window: WindowContext,
    layout: LayoutDef,
    containers: List<ContainerDef>,
    selectionModeOverride: String?,
    inheritedDataSourceRef: String?
) {
    val declaredColumns = (layout.columns ?: 0).takeIf { it > 0 } ?: 1
    val rows = rememberGridRows(containers, declaredColumns)
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(resolveSpacing(layout.rowGap ?: layout.gap, 12.dp))
    ) {
        rows.forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(resolveSpacing(layout.gap, 12.dp))
            ) {
                row.forEach { (nested, span) ->
                    ContainerRenderer(
                        runtime = runtime,
                        window = window,
                        container = nested,
                        selectionModeOverride = selectionModeOverride,
                        inheritedDataSourceRef = nested.dataSourceRef?.takeIf { it.isNotBlank() } ?: inheritedDataSourceRef,
                        modifier = Modifier.weight(span.toFloat())
                    )
                }
            }
        }
    }
}

private fun rememberGridRows(
    containers: List<ContainerDef>,
    declaredColumns: Int
): List<List<Pair<ContainerDef, Int>>> {
    if (containers.isEmpty()) return emptyList()
    val rows = mutableListOf<MutableList<Pair<ContainerDef, Int>>>()
    var currentRow = mutableListOf<Pair<ContainerDef, Int>>()
    var remaining = declaredColumns
    containers.forEach { container ->
        val span = (container.columnSpan ?: 1)
            .coerceAtLeast(1)
            .coerceAtMost(declaredColumns)
        if (span > remaining && currentRow.isNotEmpty()) {
            rows += currentRow
            currentRow = mutableListOf()
            remaining = declaredColumns
        }
        currentRow += container to span
        remaining -= span
    }
    if (currentRow.isNotEmpty()) {
        rows += currentRow
    }
    return rows
}

private fun resolveSpacing(raw: String?, fallback: Dp): Dp {
    val numeric = raw
        ?.replace("px", "")
        ?.trim()
        ?.toFloatOrNull()
    return numeric?.dp ?: fallback
}

private fun JsonElement?.asString(): String? {
    return (this as? JsonPrimitive)?.contentOrNull
}

private fun dependsOnWindowForm(dataSource: com.viant.forgeandroid.runtime.DataSourceDef): Boolean {
    return dataSource.parameters.any { parameter ->
        val source = ((parameter.from ?: "").ifBlank { parameter.input ?: "" }).trim().lowercase()
        source == "windowform"
    }
}

private fun windowFormSignature(values: Map<String, Any?>): String {
    return values.toSortedMap().entries.joinToString("|") { (key, value) ->
        "$key=${valueSignature(value)}"
    }
}

private fun valueSignature(value: Any?): String {
    return when (value) {
        null -> "null"
        is Map<*, *> -> value.entries
            .sortedBy { it.key.toString() }
            .joinToString(prefix = "{", postfix = "}") { "${it.key}=${valueSignature(it.value)}" }
        is List<*> -> value.joinToString(prefix = "[", postfix = "]") { valueSignature(it) }
        else -> value.toString()
    }
}

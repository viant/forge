package com.viant.forgeandroid.ui
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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
import com.viant.forgeandroid.runtime.WindowContext
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

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
    val kind = container.kind?.trim().orEmpty()

    LaunchedEffect(container.id, visibilityContext?.dataSourceRef) {
        if (container.visibleWhen != null && visibilityContext != null && visibilityContext.dataSource.autoFetch != false) {
            visibilityContext.fetchCollection()
        }
    }

    if (kind != "dashboard" && !kind.startsWith("dashboard.") &&
        !evaluateDashboardCondition(container.visibleWhen, metrics = visibilityMetrics)
    ) {
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
            modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 6.dp)
                .background(Color.White, RoundedCornerShape(18.dp))
                .border(1.dp, Color(0xFFE7ECF3), RoundedCornerShape(18.dp))
                .padding(horizontal = 12.dp, vertical = 10.dp)
        } else {
            modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp)
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

        if (container.toolbar != null && effectiveDataSourceRef.isNotBlank()) {
            WithContainerDataSource(
                window = window,
                dataSourceRef = effectiveDataSourceRef
            ) { toolbarContext ->
                TableToolbar(runtime, toolbarContext, container.toolbar)
            }
        }

        if (container.tabs != null && container.containers.isNotEmpty()) {
            TabsRenderer(runtime, window, container)
            return@Column
        }

        if (container.schemaBasedForm != null) {
            val dsRef = container.schemaBasedForm.dataSourceRef
                ?: container.schemaBasedForm.datasourceRef
                ?: effectiveDataSourceRef
            val dsContext = dsRef?.let(window::contextOrNull)
            if (dsContext != null) {
                SchemaBasedFormRenderer(runtime, dsContext, container)
                return@Column
            }
        }
        if (container.table != null && effectiveDataSourceRef.isNotBlank()) {
            WithContainerDataSource(
                window = window,
                dataSourceRef = effectiveDataSourceRef,
                fetchData = container.fetchData,
                selectFirst = container.selectFirst
            ) { dsContext ->
                TableRenderer(runtime, dsContext, container.table)
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

        if (container.fileBrowser != null && effectiveDataSourceRef.isNotBlank()) {
            WithContainerDataSource(
                window = window,
                dataSourceRef = effectiveDataSourceRef,
                fetchData = container.fetchData
            ) { dsContext ->
                FileBrowserRenderer(runtime, dsContext, container.fileBrowser)
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
                    ChartRenderer(dsContext, container.chart)
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
                    MenuListRenderer(runtime, window, container, container.items, menuListBaseContext ?: dsContext)
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

private fun shouldUseMenuList(items: List<ItemDef>): Boolean {
    if (items.isEmpty()) return false
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

private fun resolveContainerVisibilityContext(
    window: WindowContext,
    container: ContainerDef,
    chartDataSourceRef: String?
): DataSourceContext? {
    val explicit = container.visibleWhen?.dataSourceRef?.trim().orEmpty().takeIf { it.isNotEmpty() }
    explicit?.let { return window.contextOrNull(it) }

    container.dataSourceRef?.trim().orEmpty().takeIf { it.isNotEmpty() }?.let {
        return window.contextOrNull(it)
    }

    return resolveContainerItemsContext(window, container, chartDataSourceRef)
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

private fun resolveChartDataSourceRef(
    windowForm: Map<String, Any?>,
    container: ContainerDef,
    inheritedDataSourceRef: String? = null
): String? {
    container.dataSourceRef?.takeIf { it.isNotBlank() }?.let { return it }
    val chart = container.chart ?: return null
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

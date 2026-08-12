package com.viant.forgeandroid.ui

import android.content.Intent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.outlined.FilterAlt
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.viant.forgeandroid.runtime.ColumnDef
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.DashboardFilterItemDef
import com.viant.forgeandroid.runtime.DashboardReportRuntimeBlockSummary
import com.viant.forgeandroid.runtime.DashboardReportRuntimeDiagnostic
import com.viant.forgeandroid.runtime.DashboardReportRuntimeActionExecution
import com.viant.forgeandroid.runtime.DashboardReportRuntimeTableValue
import com.viant.forgeandroid.runtime.DashboardReportSectionDef
import com.viant.forgeandroid.runtime.DashboardSelectionState
import com.viant.forgeandroid.runtime.ExecutionDef
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.JsonUtil
import com.viant.forgeandroid.runtime.SelectorUtil
import com.viant.forgeandroid.runtime.SelectionState
import com.viant.forgeandroid.runtime.TableDef
import com.viant.forgeandroid.runtime.WindowContext
import com.viant.forgeandroid.runtime.applyDashboardSelectionToCollection
import com.viant.forgeandroid.runtime.dashboardFilterSignal
import com.viant.forgeandroid.runtime.dashboardCompositionChart
import com.viant.forgeandroid.runtime.dashboardDefaultGeoPalette
import com.viant.forgeandroid.runtime.dashboardGeoTileRegions
import com.viant.forgeandroid.runtime.dashboardReportRuntimeActionExecutionPayload
import com.viant.forgeandroid.runtime.dashboardReportRuntimeExportExecution
import com.viant.forgeandroid.runtime.dashboardReportRuntimeSummary
import com.viant.forgeandroid.runtime.dashboardReportRuntimeBlockVisible
import com.viant.forgeandroid.runtime.dashboardReportRuntimeTableActionExecutions
import com.viant.forgeandroid.runtime.dashboardSelectionSignal
import com.viant.forgeandroid.runtime.dashboardSummaryMetrics
import com.viant.forgeandroid.runtime.dashboardSupportsGeoShape
import com.viant.forgeandroid.runtime.dashboardToneName
import com.viant.forgeandroid.runtime.dashboardTimelineChart
import com.viant.forgeandroid.runtime.evaluateDashboardVisibility
import com.viant.forgeandroid.runtime.evaluateDashboardCondition
import com.viant.forgeandroid.runtime.formatDashboardValue
import com.viant.forgeandroid.runtime.PlannerTableSubmitStatus
import com.viant.forgeandroid.runtime.plannerTableCallbackPayload
import com.viant.forgeandroid.runtime.plannerTableCsv
import com.viant.forgeandroid.runtime.plannerTableDefaultSelectedIndexes
import com.viant.forgeandroid.runtime.plannerTableDisabledField
import com.viant.forgeandroid.runtime.plannerTableRowDisabled
import com.viant.forgeandroid.runtime.plannerTableRowsWithSelection
import com.viant.forgeandroid.runtime.plannerTableSelectableRowCount
import com.viant.forgeandroid.runtime.plannerTableSelectionField
import com.viant.forgeandroid.runtime.plannerTableSubmitFeedback
import com.viant.forgeandroid.runtime.rankedDashboardDimensionRows
import com.viant.forgeandroid.runtime.rankedDashboardGeoMapRows
import com.viant.forgeandroid.runtime.resolvedDashboardSummaryCards
import com.viant.forgeandroid.runtime.setDashboardDateRangeFilter
import com.viant.forgeandroid.runtime.visibleDashboardDetailChildren
import kotlin.math.max
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.util.Locale

@Composable
fun DashboardRenderer(runtime: ForgeRuntime, window: WindowContext, container: ContainerDef) {
    DashboardRenderer(runtime, window, container, container)
}

@Composable
private fun DashboardRenderer(runtime: ForgeRuntime, window: WindowContext, container: ContainerDef, dashboardRoot: ContainerDef) {
    val filterSignal = window.dashboardFilterSignal(dashboardRoot)
    val selectionSignal = window.dashboardSelectionSignal(dashboardRoot)
    val filters by filterSignal.flow.collectAsState(initial = filterSignal.peek())
    val selection by selectionSignal.flow.collectAsState(initial = selectionSignal.peek())
    val metrics = dashboardMetrics(window, container, dashboardRoot)

    if (!window.evaluateDashboardVisibility(container, metrics, filters, selection)) {
        return
    }

    when (container.kind?.trim()) {
        "dashboard" -> DashboardRoot(runtime, window, container, dashboardRoot)
        "dashboard.summary" -> DashboardPanel(runtime, window, container) { DashboardSummaryBlock(window, container, dashboardRoot, metrics) }
        "dashboard.compare" -> DashboardPanel(runtime, window, container) { DashboardCompareBlock(container, metrics) }
        "dashboard.kpiTable" -> DashboardPanel(runtime, window, container) {
            val table = dashboardKPITable(container)
            val dataSourceRef = dashboardDataSourceRef(container, dashboardRoot)
            val context = dataSourceRef?.let { window.contextOrNull(it) }
            if (table != null && context != null) {
                DashboardTableBlock(runtime, context, table)
            } else {
                DashboardKPITableBlock(container, metrics)
            }
        }
        "dashboard.filters" -> DashboardPanel(runtime, window, container) {
            DashboardFiltersBlock(container, filters) { nextFilters ->
                filterSignal.set(nextFilters)
            }
        }
        "dashboard.timeline" -> DashboardPanel(runtime, window, container) {
            DashboardTimelineBlock(window, container, dashboardRoot, filters, selection)
        }
        "dashboard.geoMap" -> DashboardPanel(runtime, window, container) {
            DashboardGeoMapBlock(window, container, dashboardRoot, metrics, filters, selection)
        }
        "dashboard.chart" -> DashboardPanel(runtime, window, container) {
            val chart = container.chart
            val dataSourceRef = dashboardDataSourceRef(container, dashboardRoot)
            val context = dataSourceRef?.let { window.contextOrNull(it) }
            if (chart != null && context != null) {
                val rows by context.collection.flow.collectAsState(initial = context.collection.peek())
                val filteredRows = applyDashboardFiltersToCollection(rows, container.filterBindings, filters)
                val selectedRows = applyDashboardSelectionToCollection(filteredRows, container.selectionBindings, selection)
                ChartTableModeRenderer(runtime, context, container, chart, selectedRows) { table ->
                    DashboardTableBlock(runtime, context, table, rowsOverride = selectedRows)
                }
            } else {
                Text("Dashboard chart requires chart configuration and data source.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        "dashboard.composition" -> DashboardPanel(runtime, window, container) {
            val chart = dashboardCompositionChart(container)
            val dataSourceRef = dashboardDataSourceRef(container, dashboardRoot)
            val context = dataSourceRef?.let { window.contextOrNull(it) }
            if (context != null) {
                val rows by context.collection.flow.collectAsState(initial = context.collection.peek())
                val filteredRows = applyDashboardFiltersToCollection(rows, container.filterBindings, filters)
                val selectedRows = applyDashboardSelectionToCollection(filteredRows, container.selectionBindings, selection)
                ChartTableModeRenderer(runtime, context, container, chart, selectedRows) { table ->
                    DashboardTableBlock(runtime, context, table, rowsOverride = selectedRows)
                }
            } else {
                Text("Dashboard composition requires a data source.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        "dashboard.dimensions" -> DashboardPanel(runtime, window, container) {
            DashboardDimensionsBlock(window, container, dashboardRoot, filters, selection) { nextSelection ->
                selectionSignal.set(nextSelection)
            }
        }
        "dashboard.status" -> DashboardPanel(runtime, window, container) { DashboardStatusBlock(container, metrics) }
        "dashboard.messages" -> DashboardPanel(runtime, window, container) {
            DashboardMessagesBlock(window, container, dashboardRoot, metrics, filters, selection)
        }
        "dashboard.badges" -> DashboardPanel(runtime, window, container) { DashboardBadgesBlock(container, metrics, filters, selection) }
        "dashboard.report" -> DashboardPanel(runtime, window, container) { DashboardReportBlock(container, metrics, filters, selection) }
        "dashboard.reportRuntime" -> DashboardReportRuntimeBlock(runtime, window, container, dashboardRoot, filters, selection)
        "dashboard.table", "planner.table" -> DashboardPanel(runtime, window, container) {
            val table = container.table ?: container.columns.takeIf { it.isNotEmpty() }?.let {
                TableDef(title = container.title, columns = it)
            }
            val dataSourceRef = dashboardDataSourceRef(container, dashboardRoot)
            val context = dataSourceRef?.let { window.contextOrNull(it) }
            if (table != null && context != null) {
                DashboardTableBlock(runtime, context, table, container.kind?.trim() == "planner.table")
            } else {
                Text("Dashboard table requires columns and data source.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        "dashboard.reportBuilder" -> ReportBuilderRenderer(runtime, window, container)
        "dashboard.reportCatalog" -> DashboardPanel(runtime, window, container) {
            DashboardReportCatalogBlock(runtime, window, container)
        }
        "dashboard.feed" -> DashboardPanel(runtime, window, container) {
            DashboardFeedBlock(window, container, dashboardRoot, filters, selection)
        }
        "dashboard.detail" -> DashboardPanel(runtime, window, container) {
            val visibleChildren = visibleDashboardDetailChildren(container, metrics, filters, selection)
            if (visibleChildren.isEmpty()) {
                val emptyMessage = dashboardDetailEmptyMessage(container) ?: "dashboard detail has no visible child blocks"
                DashboardUnsupportedBlock(emptyMessage)
            } else {
                visibleChildren.forEach { child ->
                    DashboardRenderer(runtime, window, child, dashboardRoot)
                }
            }
        }
        else -> DashboardPlaceholderBlock(container)
    }
}

@Composable
private fun DashboardReportCatalogBlock(
    runtime: ForgeRuntime,
    window: WindowContext,
    container: ContainerDef
) {
    val catalog = container.dashboard?.reportCatalog
    val presets = catalog?.presets.orEmpty()
    if (catalog == null || presets.isEmpty()) {
        DashboardUnsupportedBlock("No report templates are configured.")
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
            "Built-in report templates",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            color = Color(0xFF1D2939)
        )
        presets.forEach { preset ->
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Color(0xFFFBFDFF),
                border = BorderStroke(1.dp, Color(0xFFDBE5EC)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(7.dp)
                ) {
                    Text(
                        preset.label ?: preset.title ?: preset.id,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF1D2939)
                    )
                    preset.reportType?.takeIf { it.isNotBlank() }?.let {
                        Text(it, style = MaterialTheme.typography.labelMedium, color = Color(0xFF475467))
                    }
                    preset.description?.takeIf { it.isNotBlank() }?.let {
                        Text(it, style = MaterialTheme.typography.bodySmall, color = Color(0xFF475467))
                    }
                    OutlinedButton(onClick = {
                        openDashboardReportCatalogPreset(runtime, window, catalog, preset)
                    }) {
                        Text("Open template")
                    }
                }
            }
        }
    }
}

private fun openDashboardReportCatalogPreset(
    runtime: ForgeRuntime,
    window: WindowContext,
    catalog: com.viant.forgeandroid.runtime.DashboardReportCatalogDef,
    preset: com.viant.forgeandroid.runtime.DashboardReportCatalogPresetDef
) {
    val builderWindow = preset.builderWindow?.takeIf { it.isNotBlank() }
        ?: catalog.defaultBuilderWindow?.takeIf { it.isNotBlank() }
        ?: "metricReportBuilder"
    val orderValue = window.parameters["AdOrderId"] ?: window.parameters["orderId"]
    val orderId = when (orderValue) {
        is List<*> -> orderValue.firstOrNull()
        else -> orderValue
    }
    val parameters = mutableMapOf<String, Any?>(
        "sourceKind" to "preset",
        "sourceId" to preset.id,
        "reportStarterId" to preset.id,
        "mode" to "result",
        "executeOnOpen" to false
    )
    if (orderId != null) {
        parameters["orderId"] = orderId
        parameters["orderIds"] = listOf(orderId)
        parameters["prefill"] = mapOf("orderId" to orderId, "orderIds" to listOf(orderId))
    }
    val current = runtime.windowState(window.windowId)
    runtime.openWindow(
        windowKey = builderWindow,
        title = preset.label ?: preset.title ?: "Performance report",
        inTab = true,
        parameters = parameters,
        windowIdOverride = current?.windowId,
        conversationId = current?.conversationId,
        presentation = current?.presentation,
        region = current?.region,
        workspaceSharePct = current?.workspaceSharePct,
        workspaceMinHeight = current?.workspaceMinHeight,
        parentKey = current?.parentKey
    )
}

private sealed class PlannerSubmitState {
    object Idle : PlannerSubmitState()
    object Submitting : PlannerSubmitState()
    object Submitted : PlannerSubmitState()
    data class Failure(val message: String) : PlannerSubmitState()
}

private fun PlannerSubmitState.toStatus(): PlannerTableSubmitStatus {
    return when (this) {
        PlannerSubmitState.Idle -> PlannerTableSubmitStatus.Idle
        PlannerSubmitState.Submitting -> PlannerTableSubmitStatus.Submitting
        PlannerSubmitState.Submitted -> PlannerTableSubmitStatus.Submitted
        is PlannerSubmitState.Failure -> PlannerTableSubmitStatus.Failure
    }
}

@Composable
private fun DashboardRoot(runtime: ForgeRuntime, window: WindowContext, container: ContainerDef, dashboardRoot: ContainerDef) {
    val filterSignal = window.dashboardFilterSignal(dashboardRoot)
    LaunchedEffect(dashboardRoot.id, dashboardRoot.dashboard?.key) {
        val current = filterSignal.peek()
        if (current.isEmpty()) {
            val defaults = buildDashboardDefaultFilters(dashboardRoot)
            if (defaults.isNotEmpty()) {
                filterSignal.set(defaults)
            }
        }
    }
    val reportRuntimeOwnsHeader = container.containers.size == 1 &&
        container.containers.firstOrNull()?.kind?.trim() == "dashboard.reportRuntime"
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(
                horizontal = if (reportRuntimeOwnsHeader) 0.dp else 8.dp,
                vertical = if (reportRuntimeOwnsHeader) 0.dp else 6.dp
            ),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        container.title?.takeUnless { reportRuntimeOwnsHeader }?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold
            )
        }
        container.subtitle?.takeUnless { reportRuntimeOwnsHeader }?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        container.containers.forEach { child ->
            DashboardRenderer(runtime, window, child, dashboardRoot)
        }
    }
}

@Composable
private fun DashboardPanel(runtime: ForgeRuntime, window: WindowContext, container: ContainerDef, content: @Composable () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 6.dp),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, Color(0xFFE7ECF3)),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (!container.title.isNullOrBlank() || !container.subtitle.isNullOrBlank()) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    container.title?.let {
                        Text(
                            text = it,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                    container.subtitle?.let {
                        Text(
                            text = it,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
            content()
            DashboardActions(runtime, window, container)
        }
    }
}

@Composable
internal fun DashboardTableBlock(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    table: TableDef,
    isPlannerTable: Boolean = false,
    rowsOverride: List<Map<String, Any?>>? = null
) {
    val datasourceRows by context.collection.flow.collectAsState(initial = context.collection.peek())
    val rows = rowsOverride ?: datasourceRows
    val form by context.form.flow.collectAsState(initial = context.form.peek())
    val metrics by context.metrics.flow.collectAsState(initial = context.metrics.peek())
    val windowForm by context.window.windowFormSignal().flow.collectAsState(initial = context.window.peekWindowForm())
    val uriHandler = LocalUriHandler.current
    val localContext = LocalContext.current
    val uiScope = rememberCoroutineScope()
    val columns = table.columns.filter { dashboardTableColumnKey(it) != null }
    val plannerSelectionField = plannerTableSelectionField(table)
    val plannerDisabledField = plannerTableDisabledField(table)
    var plannerSelectionTouched by remember(context.dataSourceRef) { mutableStateOf(false) }
    var plannerSelectedIndexes by remember(context.dataSourceRef) { mutableStateOf<Set<Int>>(emptySet()) }
    var plannerSubmitState by remember(context.dataSourceRef) { mutableStateOf<PlannerSubmitState>(PlannerSubmitState.Idle) }

    LaunchedEffect(context.dataSourceRef, rowsOverride) {
        if (rowsOverride == null && context.dataSource.service != null && rows.isEmpty()) {
            context.fetchCollection()
        }
    }
    LaunchedEffect(isPlannerTable, rows, plannerSelectionField, plannerDisabledField) {
        if (isPlannerTable) {
            val next = if (plannerSelectionTouched) {
                plannerSelectedIndexes.filter { it in rows.indices }.toSet()
            } else {
                plannerTableDefaultSelectedIndexes(rows, plannerSelectionField, plannerDisabledField)
            }
            plannerSelectedIndexes = next
            context.setSelection(
                SelectionState(
                    selection = plannerTableRowsWithSelection(rows, next, plannerSelectionField)
                        .filterIndexed { index, _ -> next.contains(index) }
                )
            )
        }
    }

    if (columns.isEmpty()) {
        Text("No table columns configured.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        return
    }
    if (rows.isEmpty()) {
        Text("No rows available.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        return
    }

    val rowsForDisplay = if (isPlannerTable) {
        plannerTableRowsWithSelection(rows, plannerSelectedIndexes, plannerSelectionField)
    } else {
        rows
    }
    val submitExecution = table.on.firstOrNull {
        it.event.equals("submit", ignoreCase = true) || it.event.equals("onSubmit", ignoreCase = true)
    } ?: table.on.firstOrNull()
    val plannerSelectedCount = plannerSelectedIndexes.count { index ->
        index in rows.indices && !plannerTableRowDisabled(rows[index], plannerDisabledField)
    }
    val plannerSubmitFeedback = plannerTableSubmitFeedback(
        status = plannerSubmitState.toStatus(),
        selectedCount = plannerSelectedCount,
        selectableCount = plannerTableSelectableRowCount(rows, plannerDisabledField),
        failureMessage = (plannerSubmitState as? PlannerSubmitState.Failure)?.message
    )
    val publishPlannerSelection: (Set<Int>) -> Unit = { nextSelection ->
        plannerSelectionTouched = true
        plannerSelectedIndexes = nextSelection
        plannerSubmitState = PlannerSubmitState.Idle
        context.setSelection(
            SelectionState(
                selection = plannerTableRowsWithSelection(rows, nextSelection, plannerSelectionField)
                    .filterIndexed { index, _ -> nextSelection.contains(index) }
            )
        )
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (isPlannerTable) {
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = {
                        val csv = plannerTableCsv(
                            columns,
                            plannerTableRowsWithSelection(rows, plannerSelectedIndexes, plannerSelectionField),
                            plannerSelectionField
                        )
                        val intent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/csv"
                            putExtra(Intent.EXTRA_SUBJECT, "${context.dataSourceRef}.csv")
                            putExtra(Intent.EXTRA_TEXT, csv)
                        }
                        localContext.startActivity(Intent.createChooser(intent, "Export CSV"))
                    }
                ) {
                    Text("Export CSV")
                }
                if (submitExecution != null || table.callback != null) {
                    OutlinedButton(
                        onClick = {
                            val payload = plannerTableCallbackPayload(table, context.dataSourceRef, rows, plannerSelectedIndexes)
                            val csv = plannerTableCsv(
                                columns,
                                plannerTableRowsWithSelection(rows, plannerSelectedIndexes, plannerSelectionField),
                                plannerSelectionField
                            )
                            val args = mapOf(
                                "payload" to payload,
                                "callback" to payload["callback"],
                                "selectedRows" to payload["selectedRows"],
                                "unselectedRows" to payload["unselectedRows"],
                                "disabledRows" to payload["disabledRows"],
                                "selectionField" to payload["selectionField"],
                                "csv" to csv
                            )
                            if (submitExecution != null) {
                                plannerSubmitState = PlannerSubmitState.Submitting
                                val job = runtime.execute(submitExecution, context, args)
                                if (job == null) {
                                    plannerSubmitState = PlannerSubmitState.Failure("No submit handler configured.")
                                } else {
                                    job.invokeOnCompletion { cause ->
                                        uiScope.launch {
                                            plannerSubmitState = if (cause == null) {
                                                PlannerSubmitState.Submitted
                                            } else {
                                                PlannerSubmitState.Failure(
                                                    cause.message?.takeIf { it.isNotBlank() } ?: "Submit action failed."
                                                )
                                            }
                                        }
                                    }
                                }
                            } else if (table.callback != null) {
                                plannerSubmitState = PlannerSubmitState.Submitted
                            } else {
                                plannerSubmitState = PlannerSubmitState.Failure("No submit action configured.")
                            }
                        },
                        enabled = !plannerSubmitFeedback.busy
                    ) {
                        Text(plannerSubmitFeedback.buttonLabel)
                    }
                }
            }
            plannerSubmitFeedback.message?.takeIf { it.isNotBlank() }?.let { message ->
                Text(
                    text = message,
                    style = MaterialTheme.typography.labelMedium,
                    color = when (plannerSubmitState) {
                        PlannerSubmitState.Submitted -> Color(0xFF067647)
                        is PlannerSubmitState.Failure -> Color(0xFFB42318)
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
            }
        }
        if (isPlannerTable) {
            PlannerSelectionTable(
                columns = columns,
                rows = rowsForDisplay,
                selectedIndexes = plannerSelectedIndexes,
                disabledField = plannerDisabledField,
                onSelectionChange = publishPlannerSelection
            )
        } else {
            rowsForDisplay.forEach { row ->
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, Color(0xFFE0E6EF), RoundedCornerShape(14.dp))
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    columns.forEachIndexed { index, column ->
                        val key = dashboardTableColumnKey(column).orEmpty()
                        val raw = row[key]
                        val value = formatDashboardValue(raw, column.format).ifBlank { column.emptyText ?: "-" }
                        val linkTarget = resolveColumnLinkTargetFromContext(
                            column,
                            LinkResolutionContext(
                                row = row,
                                value = raw,
                                form = form,
                                metrics = metrics,
                                windowForm = windowForm
                            )
                        )
                        val openLink: () -> Unit = {
                            when (linkTarget) {
                                is ExternalLinkTarget -> uriHandler.openUri(linkTarget.href)
                                is WindowLinkTarget -> openResolvedWindowLink(runtime, context.window, linkTarget)
                                null -> Unit
                            }
                        }
                        if (index == 0) {
                            Text(
                                text = value,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                                color = if (linkTarget != null) MaterialTheme.colorScheme.primary else Color.Unspecified,
                                textDecoration = if (linkTarget != null) TextDecoration.Underline else null,
                                modifier = if (linkTarget != null) Modifier.clickable(onClick = openLink) else Modifier
                            )
                        } else {
                            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(
                                    text = column.label ?: key,
                                    style = MaterialTheme.typography.labelMedium,
                                    color = Color(0xFF667085)
                                )
                                Text(
                                    text = value,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = if (linkTarget != null) MaterialTheme.colorScheme.primary else Color.Unspecified,
                                    textDecoration = if (linkTarget != null) TextDecoration.Underline else null,
                                    modifier = if (linkTarget != null) Modifier.clickable(onClick = openLink) else Modifier
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PlannerSelectionTable(
    columns: List<ColumnDef>,
    rows: List<Map<String, Any?>>,
    selectedIndexes: Set<Int>,
    disabledField: String?,
    onSelectionChange: (Set<Int>) -> Unit
) {
    val selectableIndexes = rows.indices.filterNot { plannerTableRowDisabled(rows[it], disabledField.orEmpty()) }.toSet()
    val allSelected = selectableIndexes.isNotEmpty() && selectedIndexes.containsAll(selectableIndexes)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .border(1.dp, Color(0xFFD9E2EF), RoundedCornerShape(12.dp))
    ) {
        Row(
            modifier = Modifier
                .background(Color(0xFFF3F6FA))
                .padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Checkbox(
                checked = allSelected,
                onCheckedChange = { checked ->
                    onSelectionChange(if (checked) selectedIndexes + selectableIndexes else selectedIndexes - selectableIndexes)
                },
                modifier = Modifier.width(52.dp)
            )
            columns.forEach { column ->
                val key = dashboardTableColumnKey(column).orEmpty()
                Text(
                    text = column.label ?: key,
                    modifier = Modifier
                        .width(plannerTableColumnWidth(column))
                        .padding(horizontal = 8.dp),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF344054)
                )
            }
        }
        rows.forEachIndexed { rowIndex, row ->
            val disabled = plannerTableRowDisabled(row, disabledField.orEmpty())
            val selected = selectedIndexes.contains(rowIndex)
            Row(
                modifier = Modifier
                    .background(
                        when {
                            selected -> Color(0xFFF0F5FF)
                            rowIndex % 2 == 1 -> Color(0xFFF9FAFC)
                            else -> Color.White
                        }
                    )
                    .border(width = 0.5.dp, color = Color(0xFFE7ECF3))
                    .padding(vertical = 5.dp),
                verticalAlignment = Alignment.Top
            ) {
                Checkbox(
                    checked = selected,
                    enabled = !disabled,
                    onCheckedChange = { checked ->
                        onSelectionChange(if (checked) selectedIndexes + rowIndex else selectedIndexes - rowIndex)
                    },
                    modifier = Modifier.width(52.dp)
                )
                columns.forEach { column ->
                    val key = dashboardTableColumnKey(column).orEmpty()
                    val value = formatDashboardValue(row[key], column.format).ifBlank { column.emptyText ?: "-" }
                    Text(
                        text = value,
                        modifier = Modifier
                            .width(plannerTableColumnWidth(column))
                            .padding(horizontal = 8.dp, vertical = 7.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = if (disabled) Color(0xFF98A2B3) else Color(0xFF344054),
                        maxLines = if (plannerTableColumnIsNarrative(column)) 4 else 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

internal fun plannerTableColumnIsNarrative(column: ColumnDef): Boolean {
    val value = listOfNotNull(column.id, column.name, column.key, column.label)
        .joinToString(" ")
        .lowercase()
    return listOf("rationale", "reason", "description", "summary", "note").any(value::contains)
}

private fun plannerTableColumnWidth(column: ColumnDef) = when {
    plannerTableColumnIsNarrative(column) -> 280.dp
    listOfNotNull(column.id, column.name, column.key, column.label)
        .any { it.contains("publisher", ignoreCase = true) } -> 164.dp
    else -> 124.dp
}

private fun dashboardTableColumnKey(column: ColumnDef): String? {
    return column.id?.takeIf { it.isNotBlank() }
        ?: column.name?.takeIf { it.isNotBlank() }
        ?: column.key?.takeIf { it.isNotBlank() }
}

@Composable
private fun DashboardActions(runtime: ForgeRuntime, window: WindowContext, container: ContainerDef) {
    val dataSourceRef = container.dataSourceRef
    if (container.actions.isEmpty() || dataSourceRef.isNullOrBlank()) {
        return
    }
    Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        container.actions.forEach { action ->
            val label = action.label?.takeIf { it.isNotBlank() } ?: action.id ?: "Action"
            OutlinedButton(
                onClick = {
                    action.on
                        .filter { it.event.equals("onClick", ignoreCase = true) || it.event.isNullOrBlank() }
                        .forEach { execution ->
                            runtime.execute(execution, window.context(dataSourceRef))
                        }
                }
            ) {
                Text(label)
            }
        }
    }
}

@Composable
private fun DashboardSummaryBlock(
    window: WindowContext,
    container: ContainerDef,
    dashboardRoot: ContainerDef,
    metrics: Map<String, Any?>
) {
    val summaryMetrics = dashboardSummaryMetrics(container)
    val dataSourceRef = dashboardDataSourceRef(container, dashboardRoot)
    val context = dataSourceRef?.let { window.contextOrNull(it) }
    val rows: List<Map<String, Any?>> = if (context != null) {
        val observedRows by context.collection.flow.collectAsState(initial = context.collection.peek())
        observedRows
    } else {
        emptyList()
    }
    val source = rows.firstOrNull()
    val cards = remember(summaryMetrics, metrics, source) {
        resolvedDashboardSummaryCards(container, metrics, source)
            .map { card ->
                DashboardSummaryCard(
                    label = card.label,
                    displayValue = card.displayValue,
                    tone = severityTone(card.tone)
                )
            }
    }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (cards.isEmpty()) {
            DashboardEmptyState("No summary data available for this view.")
        } else {
            StaticGrid(
                items = cards,
                minCellWidth = 180.dp,
                modifier = Modifier.fillMaxWidth(),
                horizontalSpacing = 10.dp,
                verticalSpacing = 10.dp
            ) { card ->
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(card.tone.background, RoundedCornerShape(14.dp))
                        .border(1.dp, card.tone.border, RoundedCornerShape(14.dp))
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = card.label,
                        style = MaterialTheme.typography.labelMedium,
                        color = card.tone.text.copy(alpha = 0.82f)
                    )
                    Text(
                        text = card.displayValue,
                        style = summaryMetricValueStyle(card.displayValue),
                        fontWeight = FontWeight.SemiBold,
                        color = card.tone.text,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
        if (cards.isNotEmpty() && cards.size < summaryMetrics.size) {
            Text(
                text = "Some values are unavailable for this view.",
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFF6A7280)
            )
        }
    }
}

@Composable
private fun DashboardCompareBlock(container: ContainerDef, metrics: Map<String, Any?>) {
    val compareItems = container.dashboard?.compare?.items ?: container.items.map {
        com.viant.forgeandroid.runtime.DashboardCompareItemDef(
            id = it.id,
            label = it.label,
            current = it.current,
            previous = it.previous,
            format = it.format,
            deltaFormat = it.deltaFormat,
            positiveIsUp = it.positiveIsUp,
            deltaLabel = it.deltaLabel,
            currentLabel = it.currentLabel,
            previousLabel = it.previousLabel
        )
    }
    if (compareItems.isEmpty()) {
        Text(
            text = "No comparisons configured.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        compareItems.forEach { item ->
            val current = SelectorUtil.resolve(metrics, item.current)
            val previous = SelectorUtil.resolve(metrics, item.previous)
            val delta = ((current as? Number)?.toDouble() ?: 0.0) - ((previous as? Number)?.toDouble() ?: 0.0)
            val positiveIsUp = item.positiveIsUp != false
            val tone = when {
                delta == 0.0 -> severityTone("neutral")
                ((delta > 0) == positiveIsUp) -> severityTone("success")
                else -> severityTone("danger")
            }
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFF7F9FC), RoundedCornerShape(12.dp))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(text = item.label ?: "Comparison", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = formatDashboardValue(current, item.format), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                    Text(
                        text = formatDashboardDelta(delta, item.deltaFormat ?: item.format),
                        style = MaterialTheme.typography.labelLarge,
                        color = tone.text,
                        modifier = Modifier
                            .background(tone.background, RoundedCornerShape(999.dp))
                            .border(1.dp, tone.border, RoundedCornerShape(999.dp))
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
                if (!item.currentLabel.isNullOrBlank() || !item.previousLabel.isNullOrBlank()) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        item.currentLabel?.takeIf { it.isNotBlank() }?.let { label ->
                            Text(
                                text = label,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier
                                    .background(Color(0xFFEDF4FA), RoundedCornerShape(999.dp))
                                    .border(1.dp, Color(0xFFD5E3EF), RoundedCornerShape(999.dp))
                                    .padding(horizontal = 9.dp, vertical = 4.dp)
                            )
                        }
                        item.previousLabel?.takeIf { it.isNotBlank() }?.let { label ->
                            Text(
                                text = label,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
                Text(
                    text = "${item.deltaLabel ?: "vs previous"}: ${formatDashboardValue(previous, item.format)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun DashboardFiltersBlock(
    container: ContainerDef,
    filters: Map<String, Any?>,
    onFiltersChange: (Map<String, Any?>) -> Unit
) {
    val filterItems = container.dashboard?.filters?.items ?: container.items.map {
        DashboardFilterItemDef(
            id = it.id,
            label = it.label,
            field = it.field,
            type = it.type,
            multiple = it.multiple,
            options = it.options.map { option ->
                com.viant.forgeandroid.runtime.DashboardFilterOptionDef(
                    label = option.label,
                    value = option.value,
                    default = option.default
                )
            }
        )
    }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        filterItems.forEach { item ->
            val field = dashboardFilterKey(item) ?: return@forEach
            val selected = filters[field]
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = item.label ?: field,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (item.type == "dateRange") {
                    val range = selected as? Map<*, *>
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = range?.get("start")?.toString().orEmpty(),
                            onValueChange = { value ->
                                onFiltersChange(setDashboardDateRangeFilter(filters, item, "start", value))
                            },
                            label = { Text("Start") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = range?.get("end")?.toString().orEmpty(),
                            onValueChange = { value ->
                                onFiltersChange(setDashboardDateRangeFilter(filters, item, "end", value))
                            },
                            label = { Text("End") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                    }
                } else {
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        item.options.forEach { option ->
                            val active = if (item.multiple == true) {
                                (selected as? List<*>)?.contains(option.value) == true
                            } else {
                                selected == option.value
                            }
                            AssistChip(
                                onClick = {
                                    onFiltersChange(toggleDashboardFilter(filters, item, option.value))
                                },
                                label = { Text(option.label ?: option.value ?: "") },
                                colors = AssistChipDefaults.assistChipColors(
                                    containerColor = if (active) Color(0xFFDBEAFE) else Color(0xFFF3F4F6),
                                    labelColor = if (active) Color(0xFF1D4ED8) else Color(0xFF374151)
                                )
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DashboardKPITableBlock(container: ContainerDef, metrics: Map<String, Any?>) {
    val rows = container.dashboard?.kpiTable?.rows ?: container.rows
    if (rows.isEmpty()) {
        Text(
            text = "No KPI rows configured.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        rows.forEach { row ->
            val value = SelectorUtil.resolve(metrics, row.value)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White, RoundedCornerShape(14.dp))
                    .border(1.dp, Color(0xFFE7ECF3), RoundedCornerShape(14.dp))
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = row.label ?: row.id ?: "Metric",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    row.context?.takeIf { it.isNotBlank() }?.let {
                        val tone = severityTone(row.contextTone)
                        Text(
                            text = it,
                            style = MaterialTheme.typography.labelSmall,
                            color = tone.text,
                            modifier = Modifier
                                .background(tone.background, RoundedCornerShape(999.dp))
                                .border(1.dp, tone.border, RoundedCornerShape(999.dp))
                                .padding(horizontal = 8.dp, vertical = 3.dp)
                        )
                    }
                }
                Text(
                    text = formatDashboardValue(value, row.format),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
private fun DashboardTimelineBlock(
    window: WindowContext,
    container: ContainerDef,
    dashboardRoot: ContainerDef,
    filters: Map<String, Any?>,
    selection: DashboardSelectionState
) {
    val dataSourceRef = dashboardDataSourceRef(container, dashboardRoot)
    val context = dataSourceRef?.let { window.contextOrNull(it) }
    val rows = if (context != null) {
        val currentRows by context.collection.flow.collectAsState(initial = context.collection.peek())
        currentRows
    } else {
        emptyList()
    }
    val filteredRows = applyDashboardFiltersToCollection(rows, container.filterBindings, filters)
    val filtered = applyDashboardSelectionToCollection(filteredRows, container.selectionBindings, selection)
    val chart = dashboardTimelineChart(container)
    if (chart == null) {
        Text("Timeline requires chart configuration.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        return
    }
    ChartRenderer(filtered, chart, containerTitle = container.title)
}

@Composable
private fun DashboardDimensionsBlock(
    window: WindowContext,
    container: ContainerDef,
    dashboardRoot: ContainerDef,
    filters: Map<String, Any?>,
    selection: DashboardSelectionState,
    onSelectionChange: (DashboardSelectionState) -> Unit
) {
    val dataSourceRef = dashboardDataSourceRef(container, dashboardRoot)
    val context = dataSourceRef?.let { window.contextOrNull(it) }
    val rows = if (context != null) {
        val currentRows by context.collection.flow.collectAsState(initial = context.collection.peek())
        currentRows
    } else {
        emptyList()
    }
    val filteredRows = applyDashboardFiltersToCollection(rows, container.filterBindings, filters)
    val filtered = applyDashboardSelectionToCollection(filteredRows, container.selectionBindings, selection)
    val dimension = container.dashboard?.dimensions?.dimension ?: container.dimension
    val metric = container.dashboard?.dimensions?.metric ?: container.metric
    val limit = container.dashboard?.dimensions?.limit ?: container.limit ?: 10
    val dimensionKey = dimension?.key
    val metricKey = metric?.key
    if (dimensionKey.isNullOrBlank() || metricKey.isNullOrBlank()) {
        Text("Dimensions block requires dimension and metric.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        return
    }
    val ranked = rankedDashboardDimensionRows(filtered, dimensionKey, metricKey, limit)
    if (ranked.isEmpty()) {
        Text("No dimension rows.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        return
    }
    val maxValue = ranked.maxOfOrNull { it.value }?.takeIf { it > 0.0 } ?: 1.0
    val modes = dashboardDimensionsViewModes(container)
    var selectedMode by remember(container.id, modes) {
        mutableStateOf(resolvedChartTableViewMode(null, modes))
    }
    val mode = resolvedChartTableViewMode(selectedMode, modes)
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (modes.size > 1) {
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                modes.forEach { option ->
                    if (option == mode) {
                        Button(onClick = { selectedMode = option }) {
                            Text(chartTableModeLabel(option))
                        }
                    } else {
                        OutlinedButton(onClick = { selectedMode = option }) {
                            Text(chartTableModeLabel(option))
                        }
                    }
                }
            }
        }
        if (mode == "table") {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFFFFFFF), RoundedCornerShape(12.dp))
                    .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(12.dp))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Dimension", style = MaterialTheme.typography.labelMedium, color = Color(0xFF6B7280))
                    Text(
                        text = metric?.label ?: metricKey,
                        style = MaterialTheme.typography.labelMedium,
                        color = Color(0xFF6B7280)
                    )
                }
                ranked.forEachIndexed { index, rankedRow ->
                    val entityKey = rankedRow.entityKey
                    val value = rankedRow.value
                    val row = rankedRow.row
                    val selected = selection.entityKey == entityKey
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(if (selected) Color(0xFFEFF6FF) else Color.Transparent)
                            .clickable {
                                onSelectionChange(
                                    DashboardSelectionState(
                                        dimension = dimensionKey,
                                        entityKey = entityKey,
                                        selected = row,
                                        sourceBlockId = container.id
                                    )
                                )
                            }
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = entityKey ?: "-",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(1f)
                        )
                        Text(
                            text = formatDashboardValue(value, metric?.format),
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = if (selected) Color(0xFF2563EB) else Color(0xFF111827)
                        )
                    }
                    if (index < ranked.lastIndex) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(start = 12.dp)
                                .background(Color(0xFFE5E7EB))
                                .padding(top = 1.dp)
                        ) {}
                    }
                }
            }
        } else {
            ranked.forEach { rankedRow ->
                val entityKey = rankedRow.entityKey
                val value = rankedRow.value
                val row = rankedRow.row
                val selected = selection.entityKey == entityKey
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(if (selected) Color(0xFFEFF6FF) else Color(0xFFFFFFFF), RoundedCornerShape(12.dp))
                        .border(1.dp, if (selected) Color(0xFF93C5FD) else Color(0xFFE5E7EB), RoundedCornerShape(12.dp))
                        .padding(12.dp)
                ) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(
                            text = entityKey ?: "-",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier
                                .weight(1f)
                        )
                        AssistChip(
                            onClick = {
                                onSelectionChange(
                                    DashboardSelectionState(
                                        dimension = dimensionKey,
                                        entityKey = entityKey,
                                        selected = row,
                                        sourceBlockId = container.id
                                    )
                                )
                            },
                            label = { Text(formatDashboardValue(value, metric?.format)) },
                            colors = AssistChipDefaults.assistChipColors(
                                containerColor = if (selected) Color(0xFFDBEAFE) else Color(0xFFF3F4F6)
                            )
                        )
                    }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp)
                            .background(Color(0xFFE5E7EB), RoundedCornerShape(999.dp))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth(max((value / maxValue).toFloat(), 0.03f))
                                .background(Color(0xFF2563EB), RoundedCornerShape(999.dp))
                                .padding(vertical = 4.dp)
                        ) {}
                    }
                }
            }
        }
    }
}

@Composable
private fun DashboardStatusBlock(container: ContainerDef, metrics: Map<String, Any?>) {
    val checks = container.dashboard?.status?.checks ?: container.checks
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        checks.forEach { check ->
            val value = SelectorUtil.resolve(metrics, check.selector)
            val tone = toneColor(value, check.tone)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(tone.background, RoundedCornerShape(12.dp))
                    .border(1.dp, tone.border, RoundedCornerShape(12.dp))
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = check.label ?: check.selector ?: "Check",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = tone.text
                )
                Text(
                    text = formatDashboardValue(value, check.format),
                    style = MaterialTheme.typography.bodyMedium,
                    color = tone.text
                )
            }
        }
    }
}

@Composable
private fun DashboardMessagesBlock(
    window: WindowContext,
    container: ContainerDef,
    dashboardRoot: ContainerDef,
    metrics: Map<String, Any?>,
    filters: Map<String, Any?>,
    selection: DashboardSelectionState
) {
    val dataSourceRef = dashboardDataSourceRef(container, dashboardRoot)
    val context = dataSourceRef?.let { window.contextOrNull(it) }
    val rows = if (context != null) {
        val currentRows by context.collection.flow.collectAsState(initial = context.collection.peek())
        currentRows
    } else {
        emptyList()
    }
    val messageItems = container.dashboard?.messages?.items ?: container.items.map {
        com.viant.forgeandroid.runtime.DashboardMessageDef(
            severity = it.severity,
            title = it.title ?: it.label,
            body = it.body,
            visibleWhen = it.visibleWhen
        )
    }
    val visibleItems = messageItems.filter {
        evaluateDashboardCondition(it.visibleWhen, metrics, filters, selection)
    }
    if (visibleItems.isEmpty()) {
        Text(
            text = "No active messages.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        visibleItems.forEach { item ->
            val tone = severityTone(item.severity)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(tone.background, RoundedCornerShape(12.dp))
                    .border(1.dp, tone.border, RoundedCornerShape(12.dp))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                item.title?.takeIf { it.isNotBlank() }?.let {
                    Text(text = interpolateDashboardTemplate(it, metrics, filters, selection), fontWeight = FontWeight.SemiBold, color = tone.text)
                }
                dashboardMessageBody(item, rows)?.takeIf { it.isNotBlank() }?.let {
                    Text(text = interpolateDashboardTemplate(it, metrics, filters, selection), color = tone.text)
                }
            }
        }
    }
}

private fun dashboardMessageBody(item: com.viant.forgeandroid.runtime.DashboardMessageDef, rows: List<Map<String, Any?>>): String? {
    item.body?.takeIf { it.isNotBlank() }?.let { return it }
    item.text?.takeIf { it.isNotBlank() }?.let { return it }
    if (rows.isEmpty()) {
        return null
    }
    val rowIndex = (item.rowIndex ?: 0).coerceAtLeast(0)
    val row = rows.getOrNull(rowIndex) ?: rows.first()
    return dashboardRowText(row, item.field) ?: dashboardRowText(row, item.bodyField)
}

private fun dashboardRowText(row: Map<String, Any?>, selector: String?): String? {
    val key = selector?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    return SelectorUtil.resolve(row, key)?.toString()?.takeIf { it.isNotBlank() }
}

@Composable
private fun DashboardBadgesBlock(
    container: ContainerDef,
    metrics: Map<String, Any?>,
    filters: Map<String, Any?>,
    selection: DashboardSelectionState
) {
    val badges = container.dashboard?.badges?.items?.map {
        Triple(
            interpolateDashboardTemplate(it.label ?: it.id ?: "Badge", metrics, filters, selection),
            interpolateDashboardTemplate(it.value.orEmpty(), metrics, filters, selection),
            it.tone ?: it.severity ?: "info"
        ) to it.visibleWhen
    } ?: container.items.map {
        Triple(
            interpolateDashboardTemplate(it.label ?: it.title ?: it.id ?: "Badge", metrics, filters, selection),
            "",
            it.appearance ?: it.severity ?: "info"
        ) to it.visibleWhen
    }
    val visible = badges.filter { (_, condition) -> evaluateDashboardCondition(condition, metrics, filters, selection) }
    if (visible.isEmpty()) {
        Text("No active badges.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        return
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        visible.forEach { (badge, _) ->
            val tone = severityTone(badge.third)
            val text = if (badge.second.isBlank()) badge.first else "${badge.first}: ${badge.second}"
            AssistChip(
                onClick = {},
                label = { Text(text, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                colors = AssistChipDefaults.assistChipColors(containerColor = tone.background, labelColor = tone.text),
                border = BorderStroke(1.dp, tone.border)
            )
        }
    }
}

@Composable
private fun DashboardGeoMapBlock(
    window: WindowContext,
    container: ContainerDef,
    dashboardRoot: ContainerDef,
    metrics: Map<String, Any?>,
    filters: Map<String, Any?>,
    selection: DashboardSelectionState
) {
    val metric = container.metric
    val value = metric?.key?.let { SelectorUtil.resolve(metrics, it) }
    val uriHandler = LocalUriHandler.current
    val dataSourceRef = dashboardDataSourceRef(container, dashboardRoot)
    val context = dataSourceRef?.let { window.contextOrNull(it) }
    val rows = if (context != null) {
        val currentRows by context.collection.flow.collectAsState(initial = context.collection.peek())
        currentRows
    } else {
        emptyList()
    }
    val filteredRows = applyDashboardFiltersToCollection(rows, container.filterBindings, filters)
    val selectedRows = applyDashboardSelectionToCollection(filteredRows, container.selectionBindings, selection)
    val rankedRows = rankedDashboardGeoMapRows(
        rows = selectedRows,
        metricKey = metric?.key,
        limit = Int.MAX_VALUE
    )
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFF8FAFC), RoundedCornerShape(12.dp))
            .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text("Geo map", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        Text(metric?.label ?: metric?.key ?: "Regional metric", style = MaterialTheme.typography.bodySmall, color = Color(0xFF6A7280))
        value?.let {
            Text(formatDashboardValue(it, metric?.format), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        }
        if (rankedRows.isEmpty()) {
            Text(
                "No regional rows available.",
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF6A7280)
            )
        } else {
            DashboardGeoTileMap(
                shape = dashboardGeoShape(container),
                rows = rankedRows,
                metricLabel = metric?.label ?: metric?.key ?: "Regional metric",
                metricFormat = metric?.format,
                rankingLimit = container.limit ?: 5,
                onOpenHref = uriHandler::openUri
            )
        }
    }
}

@Composable
private fun DashboardGeoTileMap(
    shape: String,
    rows: List<com.viant.forgeandroid.runtime.DashboardGeoMapRow>,
    metricLabel: String,
    metricFormat: String?,
    rankingLimit: Int = 5,
    onOpenHref: (String) -> Unit = {}
) {
    if (!dashboardSupportsGeoShape(shape)) {
        Text(
            "Unsupported geo shape: $shape",
            style = MaterialTheme.typography.bodySmall,
            color = Color(0xFF6A7280)
        )
        return
    }
    val regions = remember(rows) { dashboardGeoTileRegions(rows) }
    val rankedRows = remember(rows, rankingLimit) {
        rows.sortedByDescending { it.value }.take(rankingLimit.coerceAtLeast(0))
    }
    var selectedKey by remember(rows) {
        mutableStateOf(rows.maxByOrNull { it.value }?.regionCode?.trim()?.uppercase())
    }
    val selected = rows.firstOrNull { it.regionCode.trim().uppercase() == selectedKey }
        ?: rankedRows.firstOrNull()
    val total = rows.sumOf { it.value }
    val displayFormat = metricFormat?.trim()?.takeIf { it.isNotEmpty() } ?: "compactnumber"

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                "${rows.size} regions",
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF6A7280)
            )
            Text(
                "Total ${formatDashboardValue(total, displayFormat)}",
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF6A7280)
            )
            Text(
                "Top ${rankedRows.firstOrNull()?.regionCode ?: "-"}",
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF6A7280)
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            for (rowIndex in 1..8) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    for (columnIndex in 1..12) {
                        val region = regions.firstOrNull {
                            it.tile.row == rowIndex && it.tile.column == columnIndex
                        }
                        if (region == null) {
                            Spacer(modifier = Modifier.weight(1f).aspectRatio(1f))
                        } else {
                            val paletteIndex = region.paletteIndex
                            val fill = paletteIndex?.let {
                                dashboardColor(dashboardDefaultGeoPalette[it])
                            } ?: Color(0xFFEEF3F8)
                            val isSelected = region.tile.key == selectedKey
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .aspectRatio(1f)
                                    .background(fill, RoundedCornerShape(5.dp))
                                    .border(
                                        if (isSelected) 2.dp else 1.dp,
                                        if (isSelected) Color(0xFF101828) else Color(0xFFD0D5DD),
                                        RoundedCornerShape(5.dp)
                                    )
                                    .clickable(enabled = region.value != null) {
                                        selectedKey = region.tile.key
                                    },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    region.tile.key,
                                    fontSize = 8.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if ((paletteIndex ?: 0) >= 3) Color.White else Color(0xFF102A43)
                                )
                            }
                        }
                    }
                }
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Low", style = MaterialTheme.typography.labelSmall, color = Color(0xFF6A7280))
            dashboardDefaultGeoPalette.forEach { color ->
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .background(dashboardColor(color), RoundedCornerShape(999.dp))
                        .padding(vertical = 4.dp)
                )
            }
            Text("High", style = MaterialTheme.typography.labelSmall, color = Color(0xFF6A7280))
        }
        selected?.let { row ->
            val href = row.href?.trim().orEmpty()
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFFBFDFF), RoundedCornerShape(10.dp))
                    .border(1.dp, Color(0xFFD8E1E8), RoundedCornerShape(10.dp))
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "${row.label} (${row.regionCode.trim().uppercase()})",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.SemiBold,
                        textDecoration = if (href.isNotEmpty()) TextDecoration.Underline else null,
                        modifier = if (href.isNotEmpty()) {
                            Modifier.clickable { onOpenHref(href) }
                        } else {
                            Modifier
                        }
                    )
                    Text(metricLabel, style = MaterialTheme.typography.labelSmall, color = Color(0xFF6A7280))
                }
                Text(
                    formatDashboardValue(row.value, displayFormat),
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
        rankedRows.forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    row.regionCode.trim().uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(0.2f)
                )
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .background(Color(0xFFEEF3F8), RoundedCornerShape(999.dp))
                ) {
                    val maximum = rankedRows.firstOrNull()?.value?.takeIf { it > 0 } ?: 1.0
                    Spacer(
                        modifier = Modifier
                            .fillMaxWidth((row.value / maximum).toFloat().coerceIn(0.04f, 1f))
                            .background(Color(0xFF187F78), RoundedCornerShape(999.dp))
                            .padding(vertical = 4.dp)
                    )
                }
                Text(
                    formatDashboardValue(row.value, displayFormat),
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.weight(0.42f)
                )
            }
        }
    }
}

private fun dashboardGeoShape(container: ContainerDef): String {
    val geo = container.geo as? JsonObject
    return (geo?.get("shape") as? JsonPrimitive)?.contentOrNull?.trim().orEmpty()
        .ifEmpty { "us-states" }
}

private fun dashboardColor(value: String): Color {
    val normalized = value.trim().removePrefix("#")
    return runCatching {
        val argb = when (normalized.length) {
            6 -> ("FF$normalized").toLong(16)
            8 -> normalized.toLong(16)
            else -> return@runCatching Color(0xFFEEF3F8)
        }
        Color(argb)
    }.getOrDefault(Color(0xFFEEF3F8))
}

@Composable
private fun DashboardReportBlock(
    container: ContainerDef,
    metrics: Map<String, Any?>,
    filters: Map<String, Any?>,
    selection: DashboardSelectionState
) {
    val sections = (container.dashboard?.report?.sections ?: container.sections).filter {
        evaluateDashboardCondition(it.visibleWhen, metrics, filters, selection)
    }
    if (sections.isEmpty()) {
        Text(
            text = "No report sections.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        sections.forEach { section ->
            val tone = severityTone(section.tone)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(tone.background, RoundedCornerShape(12.dp))
                    .border(1.dp, tone.border, RoundedCornerShape(12.dp))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                section.title?.takeIf { it.isNotBlank() }?.let {
                    Text(
                        text = interpolateDashboardTemplate(it, metrics, filters, selection),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = tone.text
                    )
                }
                section.body.forEach { paragraph ->
                    MarkdownRenderer(
                        markdown = interpolateDashboardTemplate(paragraph, metrics, filters, selection)
                    )
                }
            }
        }
    }
}

@Composable
private fun DashboardReportRuntimeBlock(runtime: ForgeRuntime, window: WindowContext, container: ContainerDef, dashboardRoot: ContainerDef, filters: Map<String, Any?>, selection: DashboardSelectionState) {
    val summary = dashboardReportRuntimeSummary(container)
    val blockById = summary.blocks.associateBy { it.id }
    val exportExecution = dashboardReportRuntimeExportExecution(container)
    val tabSectionIds = summary.blocks
        .filter { it.kind == "tabGroupBlock" }
        .flatMap { reportRuntimeReferenceIds(it.content, "sectionIds", "sections") }
    val tabChildIds = tabSectionIds
        .mapNotNull(blockById::get)
        .flatMap { reportRuntimeSectionChildren(it, summary.blocks).map(DashboardReportRuntimeBlockSummary::id) }
    val nestedBlockIds = (tabSectionIds + tabChildIds).toSet()
    var selectedTabs by remember(summary.blocks) { mutableStateOf(emptyMap<String, String>()) }
    var selectedMobileSection by remember(summary.blocks) { mutableStateOf<String?>(null) }
    var pdfExporting by remember(window.windowId, container.id) { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()
    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        val compact = maxWidth < 600.dp
        Column(
            modifier = if (compact) {
                Modifier.fillMaxWidth()
            } else {
                Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFFFFFFF), RoundedCornerShape(12.dp))
                    .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(12.dp))
                    .padding(12.dp)
            },
            verticalArrangement = Arrangement.spacedBy(if (compact) 10.dp else 6.dp)
        ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = summary.title ?: container.title ?: "Report runtime",
                modifier = Modifier.weight(1f),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold
            )
            if (exportExecution != null) {
                OutlinedButton(
                    enabled = !pdfExporting,
                    onClick = {
                        if (pdfExporting) return@OutlinedButton
                        pdfExporting = true
                        val job = executeReportRuntimeAction(runtime, window, dashboardRoot, exportExecution)
                        if (job == null) {
                            pdfExporting = false
                        } else {
                            coroutineScope.launch {
                                job.join()
                                pdfExporting = false
                            }
                        }
                    }
                ) {
                    if (pdfExporting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp
                        )
                        Text("Preparing PDF…", modifier = Modifier.padding(start = 8.dp))
                    } else {
                        Text("Download PDF")
                    }
                }
            }
        }
        summary.subtitle?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        if (!compact) {
            Text(
                text = if (summary.blockCount == 1) "1 report block" else "${summary.blockCount} report blocks",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        val summaryDiagnostics = summary.diagnostics.filter { it.blockId == null }
        if (summaryDiagnostics.isNotEmpty()) {
            DashboardReportRuntimeDiagnosticsPreview(summaryDiagnostics)
        }
        val topLevelBlocks = summary.blocks.filterNot { it.id in nestedBlockIds }
        val mobileSections = reportRuntimeMobileSections(topLevelBlocks)
        BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
            if (mobileSections.size > 1 && topLevelBlocks.none { it.kind == "tabGroupBlock" }) {
                DashboardReportRuntimeMobileSectionTabs(
                    runtime = runtime,
                    window = window,
                    dashboardRoot = dashboardRoot,
                    sections = mobileSections,
                    selectedId = selectedMobileSection,
                    onSelect = { selectedMobileSection = it },
                    filters = filters,
                    selection = selection
                )
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    topLevelBlocks.forEach { block ->
                        val metrics = (block.table?.rows?.firstOrNull() ?: block.chart?.rows?.firstOrNull()).orEmpty()
                        if (dashboardReportRuntimeBlockVisible(block, metrics, filters, selection)) {
                            if (block.kind == "tabGroupBlock") {
                                DashboardReportRuntimeTabGroup(
                                    runtime = runtime,
                                    window = window,
                                    dashboardRoot = dashboardRoot,
                                    tabGroup = block,
                                    blocks = summary.blocks,
                                    selectedId = selectedTabs[block.id],
                                    onSelect = { selectedTabs = selectedTabs + (block.id to it) },
                                    filters = filters,
                                    selection = selection
                                )
                            } else {
                                DashboardReportRuntimeAuthoredBlock(runtime, window, dashboardRoot, block)
                            }
                        }
                    }
                }
            }
        }
        }
    }
}

@Composable
internal fun DashboardReportRuntimeSurface(
    runtime: ForgeRuntime,
    window: WindowContext,
    container: ContainerDef,
    dashboardRoot: ContainerDef
) {
    DashboardReportRuntimeBlock(
        runtime = runtime,
        window = window,
        container = container,
        dashboardRoot = dashboardRoot,
        filters = emptyMap(),
        selection = DashboardSelectionState()
    )
}

internal data class ReportRuntimeMobileSection(
    val id: String,
    val title: String,
    val blocks: List<DashboardReportRuntimeBlockSummary>
)

internal fun reportRuntimeMobileSections(
    blocks: List<DashboardReportRuntimeBlockSummary>
): List<ReportRuntimeMobileSection> {
    val sections = mutableListOf<ReportRuntimeMobileSection>()
    var current = mutableListOf<DashboardReportRuntimeBlockSummary>()
    fun flush() {
        if (current.isEmpty()) return
        val header = current.firstOrNull { it.kind == "sectionBlock" }
        sections += ReportRuntimeMobileSection(
            id = header?.id ?: "report-section-${sections.size}",
            title = header?.title?.takeIf { it.isNotBlank() } ?: "Overview",
            blocks = current.toList()
        )
        current = mutableListOf()
    }
    blocks.forEach { block ->
        if (block.kind == "sectionBlock" && current.isNotEmpty()) flush()
        current += block
    }
    flush()
    return sections
}

@Composable
private fun DashboardReportRuntimeMobileSectionTabs(
    runtime: ForgeRuntime,
    window: WindowContext,
    dashboardRoot: ContainerDef,
    sections: List<ReportRuntimeMobileSection>,
    selectedId: String?,
    onSelect: (String) -> Unit,
    filters: Map<String, Any?>,
    selection: DashboardSelectionState
) {
    val selectedSection = sections.firstOrNull { it.id == selectedId } ?: sections.first()
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
            val entries = sections.map { it.id to it.title }
            if (maxWidth < 600.dp) {
                CompactReportSectionPicker(entries, selectedSection.id, onSelect)
            } else {
                ReportSectionStrip(entries, selectedSection.id, onSelect)
            }
        }
        key(selectedSection.id) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                // The picker is the page title on phones. Repeating the authored
                // section marker as a bordered card wastes a full row of space.
                selectedSection.blocks.filterNot { it.kind == "sectionBlock" }.forEach { block ->
                    val metrics = (block.table?.rows?.firstOrNull() ?: block.chart?.rows?.firstOrNull()).orEmpty()
                    if (dashboardReportRuntimeBlockVisible(block, metrics, filters, selection)) {
                        DashboardReportRuntimeAuthoredBlock(runtime, window, dashboardRoot, block)
                    }
                }
            }
        }
    }
}

@Composable
private fun DashboardReportRuntimeTabGroup(
    runtime: ForgeRuntime,
    window: WindowContext,
    dashboardRoot: ContainerDef,
    tabGroup: DashboardReportRuntimeBlockSummary,
    blocks: List<DashboardReportRuntimeBlockSummary>,
    selectedId: String?,
    onSelect: (String) -> Unit,
    filters: Map<String, Any?>,
    selection: DashboardSelectionState
) {
    val blockById = blocks.associateBy { it.id }
    val sections = reportRuntimeReferenceIds(tabGroup.content, "sectionIds", "sections")
        .mapNotNull(blockById::get)
    val selectedSection = sections.firstOrNull { it.id == selectedId } ?: sections.firstOrNull()
    if (selectedSection == null) {
        DashboardReportRuntimeAuthoredBlock(runtime, window, dashboardRoot, tabGroup)
        return
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
            val entries = sections.map { it.id to it.title }
            if (maxWidth < 600.dp) {
                CompactReportSectionPicker(entries, selectedSection.id, onSelect)
            } else {
                ReportSectionStrip(entries, selectedSection.id, onSelect)
            }
        }

        key(selectedSection.id) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                DashboardReportRuntimeAuthoredBlock(runtime, window, dashboardRoot, selectedSection)
                reportRuntimeSectionChildren(selectedSection, blocks).forEach { child ->
                    val metrics = (child.table?.rows?.firstOrNull() ?: child.chart?.rows?.firstOrNull()).orEmpty()
                    if (dashboardReportRuntimeBlockVisible(child, metrics, filters, selection)) {
                        DashboardReportRuntimeAuthoredBlock(runtime, window, dashboardRoot, child)
                    }
                }
            }
        }
    }
}

internal fun reportRuntimeSectionChildren(
    section: DashboardReportRuntimeBlockSummary,
    blocks: List<DashboardReportRuntimeBlockSummary>
): List<DashboardReportRuntimeBlockSummary> {
    val blockById = blocks.associateBy { it.id }
    val explicit = reportRuntimeReferenceIds(
        section.content,
        "childBlockIds",
        "blockIds",
        "children"
    ).mapNotNull(blockById::get)
    if (explicit.isNotEmpty()) return explicit

    val sectionIndex = blocks.indexOfFirst { it.id == section.id }
    if (sectionIndex < 0) return emptyList()
    return blocks.drop(sectionIndex + 1).takeWhile { candidate ->
        candidate.kind != "sectionBlock" && candidate.kind != "tabGroupBlock"
    }
}

@Composable
private fun CompactReportSectionPicker(
    entries: List<Pair<String, String>>,
    selectedId: String,
    onSelect: (String) -> Unit
) {
    if (entries.size <= 3) {
        ReportSectionStrip(entries, selectedId, onSelect)
        return
    }
    var expanded by remember(entries, selectedId) { mutableStateOf(false) }
    val selectedIndex = entries.indexOfFirst { it.first == selectedId }.coerceAtLeast(0)
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color(0xFFF5F8FB),
        border = BorderStroke(1.dp, ReportTabStripBorderColor),
        shape = RoundedCornerShape(14.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 2.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                enabled = selectedIndex > 0,
                onClick = { onSelect(entries[selectedIndex - 1].first) }
            ) {
                Text("‹", style = MaterialTheme.typography.headlineSmall)
            }
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clickable { expanded = true }
                    .padding(horizontal = 6.dp, vertical = 8.dp)
            ) {
                Text(
                    text = entries.getOrNull(selectedIndex)?.second ?: "Report section",
                    style = MaterialTheme.typography.labelLarge,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "${selectedIndex + 1} of ${entries.size} · tap to choose",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            IconButton(onClick = { expanded = true }) {
                Icon(Icons.Filled.ArrowDropDown, contentDescription = "Choose report section")
            }
            IconButton(
                enabled = selectedIndex < entries.lastIndex,
                onClick = { onSelect(entries[selectedIndex + 1].first) }
            ) {
                Text("›", style = MaterialTheme.typography.headlineSmall)
            }
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            entries.forEachIndexed { index, entry ->
                DropdownMenuItem(
                    text = {
                        Text(
                            text = "${index + 1}. ${entry.second}",
                            fontWeight = if (entry.first == selectedId) FontWeight.SemiBold else FontWeight.Normal
                        )
                    },
                    onClick = {
                        onSelect(entry.first)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
private fun ReportSectionStrip(
    entries: List<Pair<String, String>>,
    selectedId: String,
    onSelect: (String) -> Unit
) {
    Surface(
        color = ReportTabStripColor,
        border = BorderStroke(1.dp, ReportTabStripBorderColor),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            entries.forEach { entry ->
                val selected = entry.first == selectedId
                FilterChip(
                    selected = selected,
                    onClick = { onSelect(entry.first) },
                    label = { Text(entry.second, maxLines = 1) },
                    border = BorderStroke(1.dp, if (selected) ReportTabSelectedBorderColor else Color.Transparent),
                    colors = reportTabChipColors()
                )
            }
        }
    }
}

private fun reportRuntimeReferenceIds(
    content: Map<String, JsonElement>,
    vararg keys: String
): List<String> {
    keys.forEach { key ->
        val values = content[key] as? JsonArray ?: return@forEach
        val ids = values.mapNotNull { value ->
            when (value) {
                is JsonPrimitive -> value.contentOrNull
                is JsonObject -> (value["id"] as? JsonPrimitive)?.contentOrNull
                else -> null
            }
        }.filter { it.isNotBlank() }
        if (ids.isNotEmpty()) {
            return ids
        }
    }
    return emptyList()
}

@Composable
private fun DashboardReportRuntimeAuthoredBlock(runtime: ForgeRuntime, window: WindowContext, dashboardRoot: ContainerDef, block: DashboardReportRuntimeBlockSummary) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        if (block.diagnostics.isNotEmpty()) {
            DashboardReportRuntimeDiagnosticsPreview(block.diagnostics)
        }
        DashboardReportRuntimeAuthoredBlockBody(runtime, window, dashboardRoot, block)
    }
}

@Composable
private fun DashboardReportRuntimeAuthoredBlockBody(runtime: ForgeRuntime, window: WindowContext, dashboardRoot: ContainerDef, block: DashboardReportRuntimeBlockSummary) {
    when {
        block.kind == "markdownBlock" && block.markdown != null -> DashboardReportRuntimePanel(
            title = block.title
        ) {
            MarkdownRenderer(markdown = block.markdown, modifier = Modifier.fillMaxWidth())
        }

        block.kind == "kpiBlock" && block.kpi != null -> {
            val tone = severityTone(block.kpi.tone ?: "neutral")
            DashboardReportRuntimePanel(title = block.title, background = tone.background, border = tone.border) {
                Spacer(modifier = Modifier.width(32.dp).height(4.dp).background(tone.text, RoundedCornerShape(999.dp)))
                block.kpi.description?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                if (block.kpi.rowCount == 0 || block.kpi.valueText == null) {
                    Text(
                        text = block.kpi.emptyLabel,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    Text(
                        text = block.kpi.valueLabel,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = block.kpi.valueText,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    if (block.kpi.secondaryLabel != null && block.kpi.secondaryValueText != null) {
                        Text(
                            text = "${block.kpi.secondaryLabel}: ${block.kpi.secondaryValueText}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        block.kind == "filterBarBlock" && block.filterBar != null -> DashboardReportRuntimeFilterBarPreview(block)

        block.kind == "refinementBarBlock" && block.refinementBar != null -> DashboardReportRuntimeRefinementBarPreview(block)

        block.kind == "tableBlock" && block.table != null -> DashboardReportRuntimeTablePreview(runtime, window, dashboardRoot, block)

        block.kind == "chartBlock" && block.chart != null -> ChartRenderer(
            rows = block.chart.rows,
            chart = block.chart.chart,
            reportRuntimeBlockId = block.id,
            reportRuntimeActionFields = block.chart.actionFields,
            reportRuntimeActionDescriptors = block.chart.actionDescriptors,
            onReportRuntimeAction = { execution -> executeReportRuntimeAction(runtime, window, dashboardRoot, execution) }
        )

        block.kind == "geoMapBlock" && block.geoMap != null -> DashboardReportRuntimeGeoMapPreview(block)

        block.kind in setOf(
            "badgesBlock", "collectionBlock", "sectionBlock", "tabGroupBlock", "compositeBlock",
            "stepperBlock", "infoPanelBlock", "calloutBlock", "kanbanBlock", "timelineBlock"
        ) -> DashboardReportRuntimePresentationBlock(block)

        else -> Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = block.kind,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = block.title,
                style = MaterialTheme.typography.labelMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun DashboardReportRuntimePresentationBlock(block: DashboardReportRuntimeBlockSummary) {
    val content = block.content
    val entries = reportRuntimePresentationEntries(block.kind, content)
    DashboardReportRuntimePanel(title = block.title) {
        reportRuntimeContentText(content["eyebrow"])?.let {
            Text(it.uppercase(Locale.US), style = MaterialTheme.typography.labelSmall, color = Color(0xFF526A82))
        }
        reportRuntimeContentText(content["subtitle"])?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = Color(0xFF526A82))
        }
        reportRuntimeContentText(content["description"])?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = Color(0xFF6A7280))
        }
        reportRuntimeContentText(content["body"])?.takeIf { it.isNotBlank() }?.let {
            MarkdownRenderer(markdown = it, modifier = Modifier.fillMaxWidth())
        }
        if (block.kind == "badgesBlock") {
            DashboardReportRuntimeBadgePills(content)
        } else entries.forEach { entry ->
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFF7FAFC), RoundedCornerShape(10.dp))
                    .border(1.dp, Color(0xFFD8E2EB), RoundedCornerShape(10.dp))
                    .padding(horizontal = 11.dp, vertical = 9.dp),
                verticalArrangement = Arrangement.spacedBy(3.dp)
            ) {
                Text(entry.first, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
                entry.second?.takeIf { it.isNotBlank() }?.let {
                    MarkdownRenderer(markdown = it, modifier = Modifier.fillMaxWidth())
                }
            }
        }
    }
}

@Composable
private fun DashboardReportRuntimePanel(
    title: String,
    subtitle: String? = null,
    background: Color = Color(0xFFFCFEFF),
    border: Color = Color(0xFFDBE5EC),
    content: @Composable () -> Unit
) {
    val panelContent: @Composable () -> Unit = {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 11.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (title.isNotBlank()) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF182026)
                )
            }
            subtitle?.takeIf { it.isNotBlank() }?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = Color(0xFF526A82))
            }
            content()
        }
    }
    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        val neutral = background == Color(0xFFFCFEFF) && border == Color(0xFFDBE5EC)
        if (maxWidth < 600.dp && neutral) {
            // On a phone the selected report section is already the containing
            // surface. Neutral blocks become native page sections, avoiding the
            // card-within-card layout while keeping semantic titles and spacing.
            panelContent()
        } else {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = background,
                border = BorderStroke(1.dp, border),
                shape = RoundedCornerShape(12.dp),
                shadowElevation = 0.dp,
                content = panelContent
            )
        }
    }
}

internal data class ReportRuntimeBadgePresentation(
    val label: String,
    val displayValue: String,
    val tone: String
) {
    val text: String get() = if (displayValue.isBlank()) label else "$label: $displayValue"
}

internal fun reportRuntimeBadgePresentations(content: Map<String, JsonElement>): List<ReportRuntimeBadgePresentation> =
    ((content["items"] as? JsonArray).orEmpty()).mapNotNull { value ->
        val item = value as? JsonObject ?: return@mapNotNull null
        val label = reportRuntimeContentText(item["label"])
            ?: reportRuntimeContentText(item["id"])
            ?: return@mapNotNull null
        val materializedDisplayValue = item["displayValue"]
        val rawValue = item["value"]
        val format = reportRuntimeContentText(item["format"])
        val displayValue = when {
            materializedDisplayValue != null -> reportRuntimeContentText(materializedDisplayValue).orEmpty()
            rawValue == null -> ""
            !format.isNullOrBlank() -> formatDashboardValue(JsonUtil.elementToAny(rawValue), format)
            else -> reportRuntimeContentText(rawValue).orEmpty()
        }
        ReportRuntimeBadgePresentation(
            label = label,
            displayValue = displayValue,
            tone = reportRuntimeContentText(item["tone"]).orEmpty().ifBlank { "info" }
        )
    }

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DashboardReportRuntimeBadgePills(content: Map<String, JsonElement>) {
    val badges = reportRuntimeBadgePresentations(content)
    if (badges.isEmpty()) {
        Text("No pills configured.", style = MaterialTheme.typography.bodySmall, color = Color(0xFF5F6B7C))
        return
    }
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        badges.forEach { badge ->
            val tone = reportRuntimeBadgeTone(badge.tone)
            Text(
                text = badge.text,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = tone.text,
                modifier = Modifier
                    .background(tone.background, RoundedCornerShape(999.dp))
                    .border(1.dp, tone.border, RoundedCornerShape(999.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            )
        }
    }
}

private fun reportRuntimeBadgeTone(tone: String): DashboardToneColors = when (tone.trim().lowercase()) {
    "danger", "error" -> DashboardToneColors(Color(0xFFFFF1F0), Color(0xFFF5C2C0), Color(0xFFA82A2A))
    "warning", "caution" -> DashboardToneColors(Color(0xFFFFF7E1), Color(0xFFF5D28C), Color(0xFF8A5D00))
    "success", "good" -> DashboardToneColors(Color(0xFFEEF8F0), Color(0xFFCFE7D6), Color(0xFF0F6B3A))
    "info" -> DashboardToneColors(Color(0xFFEEF4FB), Color(0xFFCFDCED), Color(0xFF21538F))
    else -> DashboardToneColors(Color(0xFFF7FAFC), Color(0xFFD8E2EB), Color(0xFF486581))
}

private fun reportRuntimePresentationEntries(
    kind: String,
    content: Map<String, JsonElement>
): List<Pair<String, String?>> {
    fun objects(key: String): List<JsonObject> = (content[key] as? JsonArray).orEmpty().mapNotNull { it as? JsonObject }
    return when (kind) {
        "badgesBlock" -> objects("items").map { item ->
            val label = reportRuntimeContentText(item["label"]) ?: reportRuntimeContentText(item["id"]) ?: "Value"
            label to (reportRuntimeContentText(item["displayValue"]) ?: reportRuntimeContentText(item["value"]))
        }
        "collectionBlock" -> objects("items").map { item ->
            (reportRuntimeContentText(item["title"]) ?: "Item") to reportRuntimeContentText(item["bodyMarkdown"])
        }
        "stepperBlock" -> objects("steps").mapIndexed { index, item ->
            (reportRuntimeContentText(item["title"]) ?: "Step ${index + 1}") to reportRuntimeContentText(item["body"])
        }
        "kanbanBlock" -> objects("columns").flatMap { column ->
            val columnTitle = reportRuntimeContentText(column["title"]) ?: "Column"
            ((column["cards"] as? JsonArray).orEmpty()).mapNotNull { it as? JsonObject }.map { card ->
                "$columnTitle · ${reportRuntimeContentText(card["title"]) ?: "Card"}" to reportRuntimeContentText(card["body"])
            }
        }
        "timelineBlock" -> objects("events").map { event ->
            listOfNotNull(reportRuntimeContentText(event["date"]), reportRuntimeContentText(event["title"])).joinToString(" · ") to
                reportRuntimeContentText(event["body"])
        }
        else -> emptyList()
    }
}

private fun reportRuntimeContentText(value: JsonElement?): String? = when (value) {
    null -> null
    is JsonPrimitive -> value.contentOrNull
    is JsonArray -> value.mapNotNull(::reportRuntimeContentText).joinToString(", ").takeIf { it.isNotBlank() }
    else -> value.toString()
}

@Composable
private fun DashboardReportRuntimeDiagnosticsPreview(diagnostics: List<DashboardReportRuntimeDiagnostic>) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        diagnostics.forEach { diagnostic ->
            val tone = severityTone(diagnostic.severity)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(tone.background, RoundedCornerShape(10.dp))
                    .border(1.dp, tone.border, RoundedCornerShape(10.dp))
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = diagnostic.severity.uppercase(Locale.US),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = tone.text
                    )
                    Text(
                        text = diagnostic.message,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
                diagnostic.suggestedFix?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                val details = listOfNotNull(diagnostic.code, diagnostic.path).joinToString(" · ")
                if (details.isNotBlank()) {
                    Text(
                        text = details,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

@Composable
private fun DashboardReportRuntimeFilterBarPreview(block: DashboardReportRuntimeBlockSummary) {
    val filterBar = block.filterBar ?: return
    var expanded by remember(block.id) { mutableStateOf(false) }
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        OutlinedButton(
            onClick = { expanded = !expanded },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(Icons.Outlined.FilterAlt, contentDescription = null)
            Text(
                text = filterBar.title,
                modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = if (filterBar.params.isEmpty()) "None" else "${filterBar.params.size}",
                style = MaterialTheme.typography.labelSmall
            )
            Icon(
                Icons.Filled.ArrowDropDown,
                contentDescription = if (expanded) "Hide filters" else "Show filters"
            )
        }
        if (!expanded) return@Column
        if (filterBar.params.isEmpty()) {
            Text("No shared scope parameters.", style = MaterialTheme.typography.bodySmall, color = Color(0xFF6A7280))
        } else {
            filterBar.params.forEach { param ->
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFF8FAFC), RoundedCornerShape(10.dp))
                        .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(10.dp))
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(param.id, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold)
                        Text(param.valueText, style = MaterialTheme.typography.bodySmall)
                    }
                    param.description?.let {
                        Text(it, style = MaterialTheme.typography.labelSmall, color = Color(0xFF6A7280))
                    }
                }
            }
        }
    }
}

@Composable
private fun DashboardReportRuntimeRefinementBarPreview(block: DashboardReportRuntimeBlockSummary) {
    val refinementBar = block.refinementBar ?: return
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        refinementBar.title?.let {
            Text(it, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
        }
        if (refinementBar.refinements.isEmpty()) {
            Text(refinementBar.emptyLabel, style = MaterialTheme.typography.bodySmall, color = Color(0xFF6A7280))
        } else {
            refinementBar.refinements.forEach { refinement ->
                Text(
                    text = refinement.label,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF21538F),
                    modifier = Modifier
                        .background(Color(0xFFEEF4FB), RoundedCornerShape(999.dp))
                        .border(1.dp, Color(0xFFCFDCED), RoundedCornerShape(999.dp))
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                )
            }
        }
    }
}

@Composable
private fun DashboardReportRuntimeGeoMapPreview(block: DashboardReportRuntimeBlockSummary) {
    val geoMap = block.geoMap ?: return
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFF8FAFC), RoundedCornerShape(12.dp))
            .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(12.dp))
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(block.title, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
        Text(
            "${geoMap.metricLabel} across ${geoMap.shape}",
            style = MaterialTheme.typography.labelSmall,
            color = Color(0xFF6A7280)
        )
        if (geoMap.rows.isEmpty()) {
            Text("No regional rows available.", style = MaterialTheme.typography.bodySmall, color = Color(0xFF6A7280))
        } else {
            DashboardGeoTileMap(
                shape = geoMap.shape,
                rows = geoMap.rows,
                metricLabel = geoMap.metricLabel,
                metricFormat = geoMap.metricFormat
            )
        }
    }
}

@Composable
private fun DashboardReportRuntimeTablePreview(
    runtime: ForgeRuntime,
    window: WindowContext,
    dashboardRoot: ContainerDef,
    block: DashboardReportRuntimeBlockSummary
) {
    val table = block.table ?: return
    if (table.columns.isEmpty()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = block.kind,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = block.title,
                style = MaterialTheme.typography.labelMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        return
    }
    DashboardReportRuntimePanel(title = block.title) {
        var visibleRowCount by remember(block.id, table.rows.size) { mutableStateOf(8) }
        val visibleRows = table.rows.take(visibleRowCount)
        val dataBarMaximums = table.columns.associateWith { column ->
            if (!reportRuntimeColumnHasDataBar(column)) return@associateWith 0.0
            val key = listOf(column.id, column.key, column.name)
                .firstOrNull { !it.isNullOrBlank() }
                .orEmpty()
            table.rows.maxOfOrNull { reportRuntimeNumericValue(it[key]) ?: 0.0 } ?: 0.0
        }
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .border(1.dp, Color(0xFFDBE5EC), RoundedCornerShape(12.dp)),
            verticalArrangement = Arrangement.spacedBy(0.dp)
        ) {
            Row(
                modifier = Modifier.background(Color(0xFFF2F6FA)).padding(horizontal = 10.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                table.columns.forEach { column ->
                    Text(
                        text = column.label ?: column.name ?: column.id.orEmpty(),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF30404D),
                        modifier = Modifier.widthIn(min = 104.dp, max = 176.dp)
                    )
                }
            }
            visibleRows.forEachIndexed { index, row ->
                Row(
                    modifier = Modifier
                        .background(if (index % 2 == 0) Color.White else Color(0xFFFBFDFF))
                        .padding(horizontal = 10.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    table.columns.forEach { column ->
                        val key = reportRuntimeColumnKey(column)
                        Box(modifier = Modifier.widthIn(min = 104.dp, max = 176.dp)) {
                            ReportRuntimeTableCell(
                                label = null,
                                value = reportRuntimeDisplayValue(row[key], column),
                                fraction = reportRuntimeDataBarFraction(row[key], dataBarMaximums[column] ?: 0.0),
                                primary = false
                            )
                        }
                    }
                }
            }
        }
        if (table.rows.isEmpty()) {
            Text("No rows available.", style = MaterialTheme.typography.bodySmall, color = Color(0xFF5F6B7C))
        } else if (table.rows.size > visibleRows.size) {
            Text(
                "Showing ${visibleRows.size} of ${table.rows.size} rows",
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF5F6B7C)
            )
            OutlinedButton(
                onClick = { visibleRowCount = (visibleRowCount + 8).coerceAtMost(table.rows.size) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Show ${minOf(8, table.rows.size - visibleRows.size)} more")
            }
        }
        DashboardReportRuntimeTableActionStrip(runtime, window, dashboardRoot, block, table)
    }
}

private fun reportRuntimeColumnKey(column: ColumnDef): String =
    listOf(column.id, column.key, column.name).firstOrNull { !it.isNullOrBlank() }.orEmpty()

private fun reportRuntimeDisplayValue(value: Any?, column: ColumnDef): String {
    if (value == null) return column.emptyText ?: "—"
    return formatDashboardValue(value, column.format)
        .takeUnless { it.isBlank() || it.equals("null", ignoreCase = true) }
        ?: column.emptyText
        ?: "—"
}

@Composable
private fun ReportRuntimeTableCell(
    label: String?,
    value: String,
    fraction: Float?,
    primary: Boolean
) {
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        label?.takeIf { it.isNotBlank() }?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF526A82)
            )
        }
        Box(modifier = Modifier.fillMaxWidth()) {
            if (fraction != null) {
                Box(
                    modifier = Modifier.fillMaxWidth().height(32.dp)
                        .background(Color(0xFFF1F5F9), RoundedCornerShape(8.dp))
                )
                Box(
                    modifier = Modifier.fillMaxWidth(fraction).height(32.dp)
                        .background(
                            Brush.horizontalGradient(listOf(Color(0xFFCFE0FB), Color(0xFF3F73EA))),
                            RoundedCornerShape(8.dp)
                        )
                )
            }
            Text(
                text = value,
                style = if (primary) MaterialTheme.typography.bodyMedium else MaterialTheme.typography.bodySmall,
                fontWeight = if (primary || fraction != null) FontWeight.SemiBold else FontWeight.Normal,
                color = Color(0xFF18324A),
                maxLines = 4,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(
                    horizontal = if (fraction != null) 8.dp else 0.dp,
                    vertical = if (fraction != null) 7.dp else 0.dp
                )
            )
        }
    }
}

internal fun reportRuntimeColumnHasDataBar(column: ColumnDef): Boolean =
    (column.cellVisual?.get("kind") as? JsonPrimitive)?.contentOrNull
        ?.trim()
        ?.lowercase() in setOf("databar", "progressbar", "sparkbar")

internal fun reportRuntimeDataBarFraction(value: Any?, maximum: Double): Float? {
    if (maximum <= 0.0) return null
    val numeric = reportRuntimeNumericValue(value) ?: return null
    return (numeric / maximum).coerceIn(0.0, 1.0).toFloat()
}

private fun reportRuntimeNumericValue(value: Any?): Double? = when (value) {
    is Number -> value.toDouble()
    is String -> value.replace(",", "").trim().toDoubleOrNull()
    else -> null
}

@Composable
private fun DashboardReportRuntimeTableActionStrip(
    runtime: ForgeRuntime,
    window: WindowContext,
    dashboardRoot: ContainerDef,
    block: DashboardReportRuntimeBlockSummary,
    table: DashboardReportRuntimeTableValue
) {
    val rowActions = table.rows.take(6).mapIndexedNotNull { index, row ->
        val executions = dashboardReportRuntimeTableActionExecutions(block, table, row)
        if (executions.isEmpty()) {
            null
        } else {
            Triple(index, reportRuntimeTableRowLabel(row, table.columns), executions)
        }
    }
    if (rowActions.isEmpty()) {
        return
    }
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(
            text = "Row actions",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        rowActions.forEach { (_, label, executions) ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFF8FAFC), RoundedCornerShape(10.dp))
                    .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(10.dp))
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    executions.forEach { execution ->
                        AssistChip(
                            onClick = { executeReportRuntimeAction(runtime, window, dashboardRoot, execution) },
                            label = { Text(execution.label) },
                            colors = AssistChipDefaults.assistChipColors(containerColor = Color(0xFFE9EEF9))
                        )
                    }
                }
            }
        }
    }
}

private fun dashboardReportRuntimeTableActionExecutions(
    block: DashboardReportRuntimeBlockSummary,
    table: DashboardReportRuntimeTableValue,
    row: Map<String, Any?>
): List<DashboardReportRuntimeActionExecution> {
    return table.actionFields.flatMap { field ->
        val descriptors = table.actionDescriptors.filter { it.fieldValueKey == field.valueKey }
        dashboardReportRuntimeTableActionExecutions(
            blockId = block.id,
            descriptors = descriptors,
            field = field,
            item = row
        )
    }
}

private fun reportRuntimeTableRowLabel(row: Map<String, Any?>, columns: List<ColumnDef>): String {
    val column = columns.firstOrNull() ?: return "Row"
    val key = listOf(column.id, column.name, column.label).firstOrNull { !it.isNullOrBlank() }.orEmpty()
    return formatDashboardValue(row[key], column.format).ifBlank { column.label ?: column.name ?: column.id ?: "Row" }
}

private fun executeReportRuntimeAction(
    runtime: ForgeRuntime,
    window: WindowContext,
    dashboardRoot: ContainerDef,
    execution: DashboardReportRuntimeActionExecution
): kotlinx.coroutines.Job? {
    execution.selection?.let {
        window.dashboardSelectionSignal(dashboardRoot).set(it)
        return null
    }
    return runtime.execute(
        ExecutionDef(handler = "reportRuntime.executeAction"),
        context = null,
        args = mapOf(
            "windowId" to window.windowId,
            "execution" to dashboardReportRuntimeActionExecutionPayload(execution)
        )
    )
}

@Composable
private fun DashboardFeedBlock(
    window: WindowContext,
    container: ContainerDef,
    dashboardRoot: ContainerDef,
    filters: Map<String, Any?>,
    selection: DashboardSelectionState
) {
    val dataSourceRef = dashboardDataSourceRef(container, dashboardRoot)
    val context = dataSourceRef?.let { window.contextOrNull(it) }
    val rows = if (context != null) {
        val currentRows by context.collection.flow.collectAsState(initial = context.collection.peek())
        currentRows
    } else {
        emptyList()
    }
    val filteredRows = applyDashboardFiltersToCollection(rows, container.filterBindings, filters)
    val items = applyDashboardSelectionToCollection(filteredRows, container.selectionBindings, selection)
    if (items.isEmpty()) {
        Text(
            text = "No feed entries.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items.forEach { item ->
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 2.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                (container.dashboard?.feed?.fields?.timestamp ?: container.fields?.timestamp)?.let { key ->
                    SelectorUtil.resolve(item, key)?.toString()?.takeIf { it.isNotBlank() }?.let {
                        Text(text = it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                (container.dashboard?.feed?.fields?.title ?: container.fields?.title)?.let { key ->
                    SelectorUtil.resolve(item, key)?.toString()?.takeIf { it.isNotBlank() }?.let {
                        Text(text = it, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                    }
                }
                (container.dashboard?.feed?.fields?.body ?: container.fields?.body)?.let { key ->
                    SelectorUtil.resolve(item, key)?.toString()?.takeIf { it.isNotBlank() }?.let {
                        Text(text = it, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
    }
}

@Composable
private fun DashboardPlaceholderBlock(container: ContainerDef) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(16.dp))
            .padding(12.dp)
    ) {
        Text(
            text = container.title ?: container.kind ?: "Dashboard block",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
        container.subtitle?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
        Text(
            text = dashboardUnsupportedBlockMessage(container.kind),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}

internal fun dashboardUnsupportedBlockMessage(kind: String?): String {
    val normalized = kind?.trim()?.takeIf { it.isNotEmpty() }
    return normalized?.let { "Unsupported dashboard block: $it" } ?: "Unsupported dashboard block"
}

@Composable
private fun DashboardUnsupportedBlock(message: String) {
    Text(
        text = message,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(12.dp))
            .padding(12.dp)
    )
}

@Composable
private fun DashboardEmptyState(message: String) {
    Text(
        text = message,
        style = MaterialTheme.typography.bodySmall,
        color = Color(0xFF6A7280),
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFF6F8FB), RoundedCornerShape(12.dp))
            .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 12.dp)
    )
}

private data class DashboardToneColors(
    val background: Color,
    val border: Color,
    val text: Color
)

@Composable
private fun dashboardMetrics(window: WindowContext, container: ContainerDef, dashboardRoot: ContainerDef): Map<String, Any?> {
    val dsRef = dashboardDataSourceRef(container, dashboardRoot) ?: return emptyMap()
    val context = window.contextOrNull(dsRef) ?: return emptyMap()
    val metrics by context.metrics.flow.collectAsState(initial = context.metrics.peek())
    return metrics
}

private fun dashboardDataSourceRef(container: ContainerDef, dashboardRoot: ContainerDef): String? {
    return container.dataSourceRef?.trim()?.takeIf { it.isNotEmpty() }
        ?: dashboardRoot.dataSourceRef?.trim()?.takeIf { it.isNotEmpty() }
}

private fun dashboardKPITable(container: ContainerDef): TableDef? {
    val columns = container.dashboard?.kpiTable?.columns?.takeIf { it.isNotEmpty() }
        ?: container.columns.takeIf { it.isNotEmpty() }
        ?: return null
    return TableDef(title = container.title, columns = columns)
}

private fun dashboardDetailEmptyMessage(container: ContainerDef): String? {
    return if (container.containers.isEmpty()) {
        "dashboard detail has no child blocks"
    } else {
        null
    }
}

private fun toggleDashboardFilter(
    current: Map<String, Any?>,
    item: DashboardFilterItemDef,
    optionValue: String?
): Map<String, Any?> {
    val field = dashboardFilterKey(item) ?: return current
    if (optionValue == null) {
        return current
    }
    return if (item.multiple == true) {
        val list = (current[field] as? List<*>)?.filterIsInstance<String>().orEmpty()
        val next = if (list.contains(optionValue)) list.filterNot { it == optionValue } else list + optionValue
        current + (field to next)
    } else {
        current + (field to optionValue)
    }
}

private fun applyDashboardFiltersToCollection(
    rows: List<Map<String, Any?>>,
    filterBindings: Map<String, String>,
    filters: Map<String, Any?>
): List<Map<String, Any?>> {
    if (filterBindings.isEmpty() || filters.isEmpty()) {
        return rows
    }
    return rows.filter { row ->
        filterBindings.all { (filterKey, rowField) ->
            val filterValue = filters[filterKey] ?: return@all true
            val rowValue = SelectorUtil.resolve(row, rowField)
            when (filterValue) {
                is Collection<*> -> filterValue.isEmpty() || filterValue.any { dashboardFilterValueEquals(it, rowValue) }
                else -> dashboardFilterValueEquals(filterValue, rowValue)
            }
        }
    }
}

private fun buildDashboardDefaultFilters(container: ContainerDef): Map<String, Any?> {
    val defaults = linkedMapOf<String, Any?>()

    fun collectFilters(node: ContainerDef) {
        if (node.kind == "dashboard.filters") {
            val items = node.dashboard?.filters?.items ?: node.items.map {
                DashboardFilterItemDef(
                    id = it.id,
                    label = it.label,
                    field = it.field,
                    multiple = it.multiple,
                    options = it.options.map { option ->
                        com.viant.forgeandroid.runtime.DashboardFilterOptionDef(
                            label = option.label,
                            value = option.value,
                            default = option.default
                        )
                    }
                )
            }
            items.forEach { item ->
                val field = dashboardFilterKey(item) ?: return@forEach
                if (defaults[field] != null) {
                    return@forEach
                }
                val selected = item.options.filter { it.default == true }.mapNotNull { it.value }
                if (selected.isEmpty()) {
                    return@forEach
                }
                defaults[field] = if (item.multiple == true) selected else selected.first()
            }
        }
        node.containers.forEach(::collectFilters)
    }

    collectFilters(container)
    return defaults
}

private fun dashboardFilterKey(item: DashboardFilterItemDef): String? {
    return item.field?.trim()?.takeIf { it.isNotEmpty() }
        ?: item.id?.trim()?.takeIf { it.isNotEmpty() }
}

private fun dashboardFilterValueEquals(filterValue: Any?, rowValue: Any?): Boolean {
    if (rowValue == null || filterValue == null) {
        return false
    }
    return filterValue.toString().equals(rowValue.toString(), ignoreCase = true)
}

private fun formatDashboardDelta(value: Double, format: String?): String {
    val prefix = if (value > 0) "+" else ""
    return when (format?.lowercase()) {
        "currency", "currencydelta" -> prefix + formatDashboardValue(value, "currency")
        "compactnumber", "compactnumberdelta" -> prefix + formatDashboardValue(kotlin.math.abs(value), "compactNumber")
        "percent", "percentdelta" -> prefix + formatDashboardValue(value, "percent")
        else -> prefix + formatDashboardValue(value, "number")
    }
}

private fun interpolateDashboardTemplate(
    template: String,
    metrics: Map<String, Any?>,
    filters: Map<String, Any?>,
    selection: DashboardSelectionState
): String {
    fun resolveKey(key: String): String {
        val value = when {
            key.startsWith("filters.") -> SelectorUtil.resolve(filters, key.removePrefix("filters."))
            key.startsWith("selection.") -> SelectorUtil.resolve(
                mapOf(
                    "dimension" to selection.dimension,
                    "entityKey" to selection.entityKey,
                    "pointKey" to selection.pointKey,
                    "selected" to selection.selected,
                    "sourceBlockId" to selection.sourceBlockId
                ),
                key.removePrefix("selection.")
            )
            else -> SelectorUtil.resolve(metrics, key)
        }
        return value?.toString() ?: ""
    }

    val out = StringBuilder(template.length)
    var index = 0
    while (index < template.length) {
        if (template.startsWith("\${", index)) {
            val close = template.indexOf('}', startIndex = index + 2)
            if (close >= 0) {
                out.append(resolveKey(template.substring(index + 2, close).trim()))
                index = close + 1
                continue
            }
        }
        if (template.startsWith("{{", index)) {
            val close = template.indexOf("}}", startIndex = index + 2)
            if (close >= 0) {
                out.append(resolveKey(template.substring(index + 2, close).trim()))
                index = close + 2
                continue
            }
        }
        out.append(template[index])
        index += 1
    }
    return out.toString()
}

private fun toneColor(value: Any?, warningAbove: Double?, dangerAbove: Double?): DashboardToneColors {
    val number = (value as? Number)?.toDouble()
    return when {
        number != null && dangerAbove != null && number >= dangerAbove -> severityTone("danger")
        number != null && warningAbove != null && number >= warningAbove -> severityTone("warning")
        else -> severityTone("success")
    }
}

private fun toneColor(
    value: Any?,
    tone: com.viant.forgeandroid.runtime.DashboardToneDef?
): DashboardToneColors {
    return severityTone(dashboardToneName(value, tone))
}

private fun severityTone(severity: String?): DashboardToneColors {
    return when (severity?.lowercase()) {
        "danger", "error" -> DashboardToneColors(Color(0xFFFDEDED), Color(0xFFF0BBBB), Color(0xFF99293A))
        "warning", "caution" -> DashboardToneColors(Color(0xFFFFF8E3), Color(0xFFF2D98B), Color(0xFF92620C))
        "success", "good" -> DashboardToneColors(Color(0xFFEEF9EF), Color(0xFFB6E2BE), Color(0xFF1E6E37))
        "info", "setup", "restriction", "accent" -> DashboardToneColors(Color(0xFFF0EEFF), Color(0xFFC8C4F5), Color(0xFF5147A6))
        else -> DashboardToneColors(Color(0xFFF2F4F7), Color(0xFFD8DEE6), Color(0xFF475467))
    }
}

private fun summaryMetricTone(metric: com.viant.forgeandroid.runtime.DashboardMetricDef, index: Int): DashboardToneColors {
    val explicit = metric.tone?.trim().orEmpty()
    if (explicit.isNotEmpty()) {
        return severityTone(explicit)
    }
    return severityTone("neutral")
}

private fun resolveSummaryCards(
    metrics: List<com.viant.forgeandroid.runtime.DashboardMetricDef>,
    values: Map<String, Any?>
): List<DashboardSummaryCard> {
    return metrics.mapIndexedNotNull { index, metric ->
        val value = SelectorUtil.resolve(values, metric.selector)
        val displayValue = formatDashboardValue(value, metric.format)
        if (!isMeaningfulSummaryValue(displayValue)) {
            return@mapIndexedNotNull null
        }
        DashboardSummaryCard(
            label = metric.label ?: metric.selector ?: "Metric",
            displayValue = displayValue,
            tone = summaryMetricTone(metric, index)
        )
    }
}

private fun isMeaningfulSummaryValue(value: String): Boolean {
    val normalized = value.trim()
    if (normalized.isEmpty()) {
        return false
    }
    return normalized.lowercase() !in setOf("-", "—", "/", "n/a", "na", "null")
}

@Composable
private fun summaryMetricValueStyle(text: String): androidx.compose.ui.text.TextStyle {
    val normalized = text.trim()
    val longestToken = normalized
        .split(' ', '_', '-', '/')
        .maxOfOrNull { it.length }
        ?: normalized.length
    return when {
        longestToken >= 18 || normalized.length >= 30 -> MaterialTheme.typography.bodyMedium.copy(fontSize = 16.sp)
        longestToken >= 12 || normalized.length >= 20 -> MaterialTheme.typography.bodyLarge.copy(fontSize = 18.sp)
        else -> MaterialTheme.typography.titleMedium
    }
}

private data class DashboardSummaryCard(
    val label: String,
    val displayValue: String,
    val tone: DashboardToneColors
)

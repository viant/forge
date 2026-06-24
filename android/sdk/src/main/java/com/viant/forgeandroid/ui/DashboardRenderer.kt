package com.viant.forgeandroid.ui

import android.content.Intent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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
import com.viant.forgeandroid.runtime.SelectorUtil
import com.viant.forgeandroid.runtime.SelectionState
import com.viant.forgeandroid.runtime.TableDef
import com.viant.forgeandroid.runtime.WindowContext
import com.viant.forgeandroid.runtime.applyDashboardSelectionToCollection
import com.viant.forgeandroid.runtime.dashboardFilterSignal
import com.viant.forgeandroid.runtime.dashboardCompositionChart
import com.viant.forgeandroid.runtime.dashboardReportRuntimeActionExecutionPayload
import com.viant.forgeandroid.runtime.dashboardReportRuntimeSummary
import com.viant.forgeandroid.runtime.dashboardReportRuntimeTableActionExecutions
import com.viant.forgeandroid.runtime.dashboardSelectionSignal
import com.viant.forgeandroid.runtime.dashboardSummaryMetrics
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
        "dashboard.reportRuntime" -> DashboardPanel(runtime, window, container) { DashboardReportRuntimeBlock(runtime, window, container) }
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
        "dashboard.reportBuilder" -> DashboardPanel(runtime, window, container) { ReportBuilderRenderer(runtime, window, container) }
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
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        container.title?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold
            )
        }
        container.subtitle?.let {
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
        rowsForDisplay.forEachIndexed { rowIndex, row ->
            val plannerDisabled = isPlannerTable && plannerTableRowDisabled(row, plannerDisabledField)
            val plannerSelected = plannerSelectedIndexes.contains(rowIndex)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0xFFE0E6EF), RoundedCornerShape(14.dp))
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (isPlannerTable) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Checkbox(
                            checked = plannerSelected,
                            enabled = !plannerDisabled,
                            onCheckedChange = { checked ->
                                val next = if (checked) {
                                    plannerSelectedIndexes + rowIndex
                                } else {
                                    plannerSelectedIndexes - rowIndex
                                }
                                publishPlannerSelection(next)
                            }
                        )
                        Text(
                            text = if (plannerDisabled) "Locked" else if (plannerSelected) "Selected" else "Not selected",
                            style = MaterialTheme.typography.labelMedium,
                            color = if (plannerDisabled) Color(0xFF98A2B3) else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 12.dp)
                        )
                    }
                }
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
        limit = container.limit
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
                "No regional rows available. Mobile renders geo maps as a compact summary until map geometry is available.",
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF6A7280)
            )
        } else {
            rankedRows.forEach { row ->
                val tone = severityTone(row.tone)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(tone.background, RoundedCornerShape(10.dp))
                        .border(1.dp, tone.border, RoundedCornerShape(10.dp))
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = row.rank?.let { "#$it" } ?: row.regionCode,
                        style = MaterialTheme.typography.labelMedium,
                        color = Color(0xFF6A7280),
                        modifier = Modifier.weight(0.28f)
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        val href = row.href?.trim().orEmpty()
                        Text(
                            row.label,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            textDecoration = if (href.isNotEmpty()) TextDecoration.Underline else null,
                            modifier = if (href.isNotEmpty()) {
                                Modifier.clickable { uriHandler.openUri(href) }
                            } else {
                                Modifier
                            }
                        )
                        if (row.label != row.regionCode) {
                            Text(row.regionCode, style = MaterialTheme.typography.labelSmall, color = Color(0xFF6A7280))
                        }
                    }
                    Text(
                        formatDashboardValue(row.value, metric?.format),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = tone.text
                    )
                }
            }
            Text(
                "Map geometry is not available in this native renderer; showing ranked regional fallback rows.",
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF6A7280)
            )
        }
    }
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
                    Text(
                        text = interpolateDashboardTemplate(paragraph, metrics, filters, selection),
                        style = MaterialTheme.typography.bodyMedium,
                        color = tone.text
                    )
                }
            }
        }
    }
}

@Composable
private fun DashboardReportRuntimeBlock(runtime: ForgeRuntime, window: WindowContext, container: ContainerDef) {
    val summary = dashboardReportRuntimeSummary(container)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFFFFFFF), RoundedCornerShape(12.dp))
            .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(
            text = summary.title ?: container.title ?: "Report runtime",
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold
        )
        summary.subtitle?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Text(
            text = if (summary.blockCount == 1) "1 report block" else "${summary.blockCount} report blocks",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        val summaryDiagnostics = summary.diagnostics.filter { it.blockId == null }
        if (summaryDiagnostics.isNotEmpty()) {
            DashboardReportRuntimeDiagnosticsPreview(summaryDiagnostics)
        }
        summary.blocks.forEach { block ->
            DashboardReportRuntimeAuthoredBlock(runtime, window, block)
        }
    }
}

@Composable
private fun DashboardReportRuntimeAuthoredBlock(runtime: ForgeRuntime, window: WindowContext, block: DashboardReportRuntimeBlockSummary) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        if (block.diagnostics.isNotEmpty()) {
            DashboardReportRuntimeDiagnosticsPreview(block.diagnostics)
        }
        DashboardReportRuntimeAuthoredBlockBody(runtime, window, block)
    }
}

@Composable
private fun DashboardReportRuntimeAuthoredBlockBody(runtime: ForgeRuntime, window: WindowContext, block: DashboardReportRuntimeBlockSummary) {
    when {
        block.kind == "markdownBlock" && block.markdown != null -> Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            if (block.title.isNotBlank()) {
                Text(
                    text = block.title,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }
            MarkdownRenderer(markdown = block.markdown, modifier = Modifier.fillMaxWidth())
        }

        block.kind == "kpiBlock" && block.kpi != null -> Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = block.title,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold
            )
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

        block.kind == "filterBarBlock" && block.filterBar != null -> DashboardReportRuntimeFilterBarPreview(block)

        block.kind == "refinementBarBlock" && block.refinementBar != null -> DashboardReportRuntimeRefinementBarPreview(block)

        block.kind == "tableBlock" && block.table != null -> DashboardReportRuntimeTablePreview(runtime, window, block)

        block.kind == "chartBlock" && block.chart != null -> ChartRenderer(
            rows = block.chart.rows,
            chart = block.chart.chart,
            reportRuntimeBlockId = block.id,
            reportRuntimeActionFields = block.chart.actionFields,
            reportRuntimeActionDescriptors = block.chart.actionDescriptors,
            onReportRuntimeAction = { execution -> executeReportRuntimeAction(runtime, window, execution) }
        )

        block.kind == "geoMapBlock" && block.geoMap != null -> DashboardReportRuntimeGeoMapPreview(block)

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
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(filterBar.title, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
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
            geoMap.rows.take(5).forEach { row ->
                val tone = severityTone(row.tone)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(tone.background, RoundedCornerShape(10.dp))
                        .border(1.dp, tone.border, RoundedCornerShape(10.dp))
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = row.rank?.let { "#$it" } ?: row.regionCode,
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFF6A7280),
                        modifier = Modifier.weight(0.25f)
                    )
                    Text(
                        text = row.label,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = formatDashboardValue(row.value, geoMap.metricFormat),
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.SemiBold,
                        color = tone.text
                    )
                }
            }
            Text(
                "Map geometry is not available in this native renderer; showing ranked regional fallback rows.",
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF6A7280)
            )
        }
    }
}

@Composable
private fun DashboardReportRuntimeTablePreview(
    runtime: ForgeRuntime,
    window: WindowContext,
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
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(
            text = block.title,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold
        )
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            table.columns.forEach { column ->
                Text(
                    text = column.label ?: column.name ?: column.id.orEmpty(),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.widthIn(min = 96.dp)
                )
            }
        }
        table.rows.take(6).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                table.columns.forEach { column ->
                    val key = listOf(column.id, column.key, column.name)
                        .firstOrNull { !it.isNullOrBlank() }
                        .orEmpty()
                    Text(
                        text = formatDashboardValue(row[key], column.format),
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.widthIn(min = 96.dp)
                    )
                }
            }
        }
        if (table.rows.isEmpty()) {
            Text(
                text = "No rows available.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        DashboardReportRuntimeTableActionStrip(runtime, window, block, table)
    }
}

@Composable
private fun DashboardReportRuntimeTableActionStrip(
    runtime: ForgeRuntime,
    window: WindowContext,
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
                            onClick = { executeReportRuntimeAction(runtime, window, execution) },
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
    execution: DashboardReportRuntimeActionExecution
) {
    runtime.execute(
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

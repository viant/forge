package com.viant.forgeandroid.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.DashboardFilterItemDef
import com.viant.forgeandroid.runtime.DashboardReportSectionDef
import com.viant.forgeandroid.runtime.DashboardSelectionState
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.SelectorUtil
import com.viant.forgeandroid.runtime.WindowContext
import com.viant.forgeandroid.runtime.dashboardFilterSignal
import com.viant.forgeandroid.runtime.dashboardSelectionSignal
import com.viant.forgeandroid.runtime.evaluateDashboardVisibility
import com.viant.forgeandroid.runtime.evaluateDashboardCondition
import kotlin.math.max
import java.text.NumberFormat
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
        "dashboard.summary" -> DashboardPanel(runtime, window, container) { DashboardSummaryBlock(container, metrics) }
        "dashboard.compare" -> DashboardPanel(runtime, window, container) { DashboardCompareBlock(container, metrics) }
        "dashboard.kpiTable" -> DashboardPanel(runtime, window, container) { DashboardKPITableBlock(container, metrics) }
        "dashboard.filters" -> DashboardPanel(runtime, window, container) {
            DashboardFiltersBlock(container, filters) { nextFilters ->
                filterSignal.set(nextFilters)
            }
        }
        "dashboard.timeline" -> DashboardPanel(runtime, window, container) { DashboardTimelineBlock(window, container, dashboardRoot, filters) }
        "dashboard.dimensions" -> DashboardPanel(runtime, window, container) {
            DashboardDimensionsBlock(window, container, dashboardRoot, filters, selection) { nextSelection ->
                selectionSignal.set(nextSelection)
            }
        }
        "dashboard.status" -> DashboardPanel(runtime, window, container) { DashboardStatusBlock(container, metrics) }
        "dashboard.messages" -> DashboardPanel(runtime, window, container) { DashboardMessagesBlock(container, metrics, filters, selection) }
        "dashboard.report" -> DashboardPanel(runtime, window, container) { DashboardReportBlock(container, metrics, filters, selection) }
        "dashboard.feed" -> DashboardPanel(runtime, window, container) { DashboardFeedBlock(window, container, dashboardRoot, filters) }
        "dashboard.detail" -> DashboardPanel(runtime, window, container) {
            container.containers.forEach { child ->
                DashboardRenderer(runtime, window, child, dashboardRoot)
            }
        }
        else -> DashboardPlaceholderBlock(container)
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
            .padding(horizontal = 12.dp, vertical = 8.dp),
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
            .padding(horizontal = 12.dp, vertical = 8.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
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
private fun DashboardSummaryBlock(container: ContainerDef, metrics: Map<String, Any?>) {
    val summaryMetrics = container.dashboard?.summary?.metrics ?: container.metrics
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        summaryMetrics.forEach { metric ->
            val value = SelectorUtil.resolve(metrics, metric.selector)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFF7F9FC), RoundedCornerShape(12.dp))
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = metric.label ?: metric.selector ?: "Metric",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    metric.selector?.takeIf { it.isNotBlank() }?.let {
                        Text(
                            text = it,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                Text(
                    text = formatDashboardValue(value, metric.format),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold
                )
            }
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
            deltaLabel = it.deltaLabel
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
            val tone = if ((delta >= 0) == positiveIsUp) severityTone("success") else severityTone("danger")
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
            val field = item.field ?: item.id ?: return@forEach
            val selected = filters[field]
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = item.label ?: field,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
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
                    .background(Color(0xFFF7F9FC), RoundedCornerShape(12.dp))
                    .padding(12.dp),
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
private fun DashboardTimelineBlock(window: WindowContext, container: ContainerDef, dashboardRoot: ContainerDef, filters: Map<String, Any?>) {
    val dataSourceRef = container.dataSourceRef ?: dashboardRoot.dataSourceRef
    val rows = if (dataSourceRef != null) {
        window.contextOrNull(dataSourceRef)?.collection?.peek().orEmpty()
    } else {
        emptyList()
    }
    val filtered = applyDashboardFiltersToCollection(rows, container.filterBindings, filters)
    if (container.chart == null) {
        Text("Timeline requires chart configuration.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        return
    }
    ChartRenderer(filtered, container.chart)
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
    val dataSourceRef = container.dataSourceRef ?: dashboardRoot.dataSourceRef
    val rows = if (dataSourceRef != null) {
        window.contextOrNull(dataSourceRef)?.collection?.peek().orEmpty()
    } else {
        emptyList()
    }
    val filtered = applyDashboardFiltersToCollection(rows, container.filterBindings, filters)
    val dimension = container.dashboard?.dimensions?.dimension ?: container.dimension
    val metric = container.dashboard?.dimensions?.metric ?: container.metric
    val limit = container.dashboard?.dimensions?.limit ?: container.limit ?: 10
    val dimensionKey = dimension?.key
    val metricKey = metric?.key
    if (dimensionKey.isNullOrBlank() || metricKey.isNullOrBlank()) {
        Text("Dimensions block requires dimension and metric.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        return
    }
    val ranked = filtered
        .sortedByDescending { (SelectorUtil.resolve(it, metricKey) as? Number)?.toDouble() ?: 0.0 }
        .take(limit)
    val maxValue = ranked.maxOfOrNull { (SelectorUtil.resolve(it, metricKey) as? Number)?.toDouble() ?: 0.0 } ?: 1.0
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        ranked.forEach { row ->
            val entityKey = SelectorUtil.resolve(row, dimensionKey)?.toString()
            val value = (SelectorUtil.resolve(row, metricKey) as? Number)?.toDouble() ?: 0.0
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
                        label = { Text(formatDashboardValue(value, metric.format)) },
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
    container: ContainerDef,
    metrics: Map<String, Any?>,
    filters: Map<String, Any?>,
    selection: DashboardSelectionState
) {
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
                item.body?.takeIf { it.isNotBlank() }?.let {
                    Text(text = interpolateDashboardTemplate(it, metrics, filters, selection), color = tone.text)
                }
            }
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
private fun DashboardFeedBlock(window: WindowContext, container: ContainerDef, dashboardRoot: ContainerDef, filters: Map<String, Any?>) {
    val dataSourceRef = container.dataSourceRef ?: dashboardRoot.dataSourceRef
    val rows = if (dataSourceRef != null) {
        window.contextOrNull(dataSourceRef)?.collection?.peek().orEmpty()
    } else {
        emptyList()
    }
    val items = applyDashboardFiltersToCollection(rows, container.filterBindings, filters)
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
            text = "Android dashboard block placeholder: ${container.kind ?: "unknown"}",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}

private data class DashboardToneColors(
    val background: Color,
    val border: Color,
    val text: Color
)

private fun dashboardMetrics(window: WindowContext, container: ContainerDef, dashboardRoot: ContainerDef): Map<String, Any?> {
    val dsRef = container.dataSourceRef ?: dashboardRoot.dataSourceRef ?: return emptyMap()
    return window.contextOrNull(dsRef)?.metrics?.peek() ?: emptyMap()
}

private fun toggleDashboardFilter(
    current: Map<String, Any?>,
    item: DashboardFilterItemDef,
    optionValue: String?
): Map<String, Any?> {
    val field = item.field ?: item.id ?: return current
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
                val field = item.field ?: item.id ?: return@forEach
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

private fun dashboardFilterValueEquals(filterValue: Any?, rowValue: Any?): Boolean {
    if (rowValue == null || filterValue == null) {
        return false
    }
    return filterValue.toString().equals(rowValue.toString(), ignoreCase = true)
}

private fun formatDashboardValue(value: Any?, format: String?): String {
    if (value == null) {
        return "n/a"
    }
    val locale = Locale.US
    return when (format?.lowercase()) {
        "currency" -> (value as? Number)?.let { NumberFormat.getCurrencyInstance(locale).format(it.toDouble()) } ?: value.toString()
        "percent" -> (value as? Number)?.let { "${NumberFormat.getNumberInstance(locale).apply { maximumFractionDigits = 1 }.format(it.toDouble())}%" } ?: value.toString()
        "integer" -> (value as? Number)?.let { NumberFormat.getIntegerInstance(locale).format(it.toLong()) } ?: value.toString()
        "compactnumber" -> (value as? Number)?.let { formatCompactNumber(it.toDouble(), locale) } ?: value.toString()
        "number" -> (value as? Number)?.let { NumberFormat.getNumberInstance(locale).format(it.toDouble()) } ?: value.toString()
        else -> value.toString()
    }
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

private fun formatCompactNumber(value: Double, locale: Locale): String {
    val absValue = kotlin.math.abs(value)
    val (scaled, suffix) = when {
        absValue >= 1_000_000_000 -> value / 1_000_000_000 to "B"
        absValue >= 1_000_000 -> value / 1_000_000 to "M"
        absValue >= 1_000 -> value / 1_000 to "K"
        else -> value to ""
    }
    val formatter = NumberFormat.getNumberInstance(locale).apply {
        maximumFractionDigits = if (suffix.isEmpty()) 0 else 1
        minimumFractionDigits = 0
    }
    return formatter.format(scaled) + suffix
}

private fun interpolateDashboardTemplate(
    template: String,
    metrics: Map<String, Any?>,
    filters: Map<String, Any?>,
    selection: DashboardSelectionState
): String {
    val curlyRegex = Regex("\\$\\{\\s*([^}]+)\\s*}")
    val mustacheRegex = Regex("\\{\\{\\s*([^}]+)\\s*}}")

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

    return mustacheRegex.replace(
        curlyRegex.replace(template) { match -> resolveKey(match.groupValues[1].trim()) }
    ) { match ->
        resolveKey(match.groupValues[1].trim())
    }
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
    val number = (value as? Number)?.toDouble()
    if (number == null) {
        return severityTone("info")
    }

    val warningAbove = tone?.warningAbove
    val dangerAbove = tone?.dangerAbove
    val successAbove = tone?.successAbove
    val warningBelow = tone?.warningBelow
    val dangerBelow = tone?.dangerBelow
    val successBelow = tone?.successBelow

    return when {
        dangerAbove != null && number >= dangerAbove -> severityTone("danger")
        warningAbove != null && number >= warningAbove -> severityTone("warning")
        successAbove != null && number >= successAbove -> severityTone("success")
        dangerBelow != null && number <= dangerBelow -> severityTone("danger")
        warningBelow != null && number <= warningBelow -> severityTone("warning")
        successBelow != null && number <= successBelow -> severityTone("success")
        else -> severityTone("info")
    }
}

private fun severityTone(severity: String?): DashboardToneColors {
    return when (severity?.lowercase()) {
        "danger", "error" -> DashboardToneColors(Color(0xFFFDECEC), Color(0xFFF5B5B5), Color(0xFF9F1C1C))
        "warning" -> DashboardToneColors(Color(0xFFFFF7E6), Color(0xFFF7D794), Color(0xFF92400E))
        "success" -> DashboardToneColors(Color(0xFFEEF9F1), Color(0xFFA7E0B8), Color(0xFF166534))
        else -> DashboardToneColors(Color(0xFFF3F6FA), Color(0xFFD7E0EA), Color(0xFF334155))
    }
}

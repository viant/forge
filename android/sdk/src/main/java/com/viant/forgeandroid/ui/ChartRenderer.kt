package com.viant.forgeandroid.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.ChartDef
import com.viant.forgeandroid.runtime.ChartValueOption
import com.viant.forgeandroid.runtime.ControlState
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.DashboardReportRuntimeActionDescriptor
import com.viant.forgeandroid.runtime.DashboardReportRuntimeActionExecution
import com.viant.forgeandroid.runtime.DashboardReportRuntimeActionField
import com.viant.forgeandroid.runtime.DashboardReportRuntimeChartSelection
import com.viant.forgeandroid.runtime.dashboardReportRuntimeChartActionExecutions
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sqrt

private val ChartCanvasColor = Color(0xFFF8FAFC)
private val ChartGridColor = Color(0xFFE4E7EC)
private val ChartMutedText = Color(0xFF6A7280)
private val DefaultChartPalette = listOf("#2563EB", "#16A34A", "#EA580C", "#9333EA")

@Composable
fun ChartRenderer(context: DataSourceContext, chart: ChartDef, containerTitle: String? = null) {
    val rows by context.collection.flow.collectAsState(initial = emptyList())
    val control by context.control.flow.collectAsState(initial = context.control.peek())
    ChartRenderer(
        rows = rows,
        chart = chart,
        containerTitle = containerTitle,
        control = control,
        hasResolvedRows = control.loading || control.resolved || rows.isNotEmpty()
    )
}

@Composable
fun ChartRenderer(
    rows: List<Map<String, Any?>>,
    chart: ChartDef,
    containerTitle: String? = null,
    control: ControlState = ControlState(),
    hasResolvedRows: Boolean = true,
    reportRuntimeBlockId: String? = null,
    reportRuntimeActionFields: List<DashboardReportRuntimeActionField> = emptyList(),
    reportRuntimeActionDescriptors: List<DashboardReportRuntimeActionDescriptor> = emptyList(),
    onReportRuntimeAction: ((DashboardReportRuntimeActionExecution) -> Unit)? = null
) {
    val prepared = prepareChartData(rows, chart)
    val type = chartType(chart)
    var selection by remember(prepared, type) { mutableStateOf<ChartSelection?>(null) }
    val supportsSeriesSelection = prepared.series.size > 1 && type != "pie" && type != "donut"
    val selectionKey = remember(prepared.series) { prepared.series.joinToString("|") { it.key } }
    var selectedSeriesKeys by remember(selectionKey) {
        mutableStateOf(prepared.series.map { it.key }.toSet())
    }
    val activePrepared = if (supportsSeriesSelection) {
        filterPreparedChartData(prepared, selectedSeriesKeys, type)
    } else {
        prepared
    }

    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        val regularWidth = maxWidth >= 720.dp
        val panelPadding = if (regularWidth) 10.dp else 12.dp
        val chartHeight = when {
            type == "pie" || type == "donut" -> if (regularWidth) 196.dp else 220.dp
            regularWidth -> 184.dp
            else -> 220.dp
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White, RoundedCornerShape(16.dp))
                .padding(panelPadding),
            verticalArrangement = Arrangement.spacedBy(if (regularWidth) 10.dp else 12.dp)
        ) {
            chartDisplayTitle(chart.title, containerTitle)?.let {
                Text(text = it, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            }
            chart.yAxis?.label?.takeIf { it.isNotBlank() }?.let {
                Text(text = it, style = MaterialTheme.typography.titleSmall)
            }
            if (supportsSeriesSelection) {
                ChartSeriesSelector(
                    series = prepared.series,
                    selectedKeys = selectedSeriesKeys,
                    onToggle = { key ->
                        val next = selectedSeriesKeys.toMutableSet().apply {
                            if (!add(key)) remove(key)
                        }
                        selectedSeriesKeys = next
                        if (selection?.seriesKey == key && key !in next) {
                            selection = null
                        }
                    }
                )
            }
            if (activePrepared.series.isEmpty()) {
                Text("Select at least one measure", style = MaterialTheme.typography.bodyMedium, color = ChartMutedText)
                return@Column
            }
            if (activePrepared.points.isEmpty()) {
                val feedback = chartDataStateFeedback(
                    loading = control.loading,
                    error = control.error,
                    hasResolvedRows = hasResolvedRows,
                    hasChartValues = false
                ) ?: return@Column
                ChartDataStateMessage(feedback)
                return@Column
            }

            selection?.let { selected ->
                ChartTooltip(selected)
            }
            val selectedExecutions = reportRuntimeChartActionExecutions(
                selection = selection,
                rows = rows,
                blockId = reportRuntimeBlockId,
                fields = reportRuntimeActionFields,
                descriptors = reportRuntimeActionDescriptors
            )
            if (onReportRuntimeAction != null && selectedExecutions.isNotEmpty()) {
                ChartSelectionActions(selectedExecutions, onReportRuntimeAction)
            }

            when {
                type == "bar" || type == "stacked_bar" -> {
                    StackedBarChart(
                        prepared = activePrepared,
                        selection = selection,
                        onSelect = { selection = it }
                    )
                }
                type == "pie" || type == "donut" -> {
                    PieChart(
                        slices = buildPieSlices(activePrepared),
                        donut = type == "donut",
                        selection = selection,
                        onSelect = { selection = it },
                        chartHeight = chartHeight
                    )
                }
                else -> {
                    MultiSeriesCartesianChart(
                        prepared = activePrepared,
                        type = type,
                        selection = selection,
                        onSelect = { selection = it },
                        chartHeight = chartHeight,
                        maximumAxisLabels = if (regularWidth) 6 else 4
                    )
                }
            }
            ChartDataFallback(
                rows = chartAccessibleDataRows(activePrepared, type, limit = 8),
                totalCount = chartAccessibleDataValueCount(activePrepared, type)
            )
        }
    }
}

@Composable
private fun ChartDataStateMessage(feedback: ChartDataStateFeedback) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            feedback.message,
            style = MaterialTheme.typography.bodyMedium,
            color = if (feedback.isError) MaterialTheme.colorScheme.error else ChartMutedText,
            fontWeight = if (feedback.isError) FontWeight.SemiBold else FontWeight.Normal
        )
    }
}

@Composable
internal fun FenceChartRenderer(spec: FenceChartSpec) {
    ChartRenderer(spec.rows, spec.chart)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChartSeriesSelector(
    series: List<ChartSeriesDisplay>,
    selectedKeys: Set<String>,
    onToggle: (String) -> Unit
) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        series.forEach { entry ->
            val selected = selectedKeys.contains(entry.key)
            Surface(
                shape = RoundedCornerShape(999.dp),
                color = if (selected) entry.color.copy(alpha = 0.12f) else Color.White,
                border = BorderStroke(
                    width = 1.dp,
                    color = if (selected) entry.color.copy(alpha = 0.45f) else Color(0xFFD8DEE8)
                ),
                modifier = Modifier.clickable { onToggle(entry.key) }
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp)
                ) {
                    if (selected) {
                        Text(
                            text = "✓",
                            style = MaterialTheme.typography.labelSmall,
                            color = entry.color,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Box(
                        modifier = Modifier
                            .background(entry.color, RoundedCornerShape(999.dp))
                            .padding(horizontal = 5.dp, vertical = 5.dp)
                    )
                    Text(
                        text = entry.label,
                        style = MaterialTheme.typography.bodySmall,
                        color = if (selected) MaterialTheme.colorScheme.onSurface else ChartMutedText,
                        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium
                    )
                }
            }
        }
    }
}

@Composable
private fun ChartTooltip(selection: ChartSelection) {
    Surface(
        color = Color(0xFF101828),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text(selection.label, style = MaterialTheme.typography.labelLarge, color = Color.White)
            Text(
                "${selection.seriesLabel}: ${selection.valueLabel}",
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFFD0D5DD)
            )
        }
    }
}

@Composable
private fun ChartSelectionActions(
    executions: List<DashboardReportRuntimeActionExecution>,
    onAction: (DashboardReportRuntimeActionExecution) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        executions.forEach { execution ->
            AssistChip(
                onClick = { onAction(execution) },
                label = { Text(execution.label) },
                colors = AssistChipDefaults.assistChipColors(containerColor = Color(0xFFE9EEF9))
            )
        }
    }
}

private fun reportRuntimeChartActionExecutions(
    selection: ChartSelection?,
    rows: List<Map<String, Any?>>,
    blockId: String?,
    fields: List<DashboardReportRuntimeActionField>,
    descriptors: List<DashboardReportRuntimeActionDescriptor>
): List<DashboardReportRuntimeActionExecution> {
    if (selection == null || fields.isEmpty() || descriptors.isEmpty()) {
        return emptyList()
    }
    val row = rows.getOrNull(selection.rowIndex).orEmpty()
    val selectionRows = rows.filterIndexed { index, _ -> index == selection.rowIndex }
    return dashboardReportRuntimeChartActionExecutions(
        blockId = blockId,
        descriptors = descriptors,
        fields = fields,
        selection = DashboardReportRuntimeChartSelection(
            xValue = selection.label,
            seriesKey = selection.seriesKey,
            row = row,
            selectionRows = selectionRows
        )
    )
}

@Composable
private fun StackedBarChart(
    prepared: PreparedChartData,
    selection: ChartSelection?,
    onSelect: (ChartSelection?) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        prepared.points.forEach { point ->
            val total = point.total
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(point.label, style = MaterialTheme.typography.labelMedium)
                    Text(formatChartValue(total), style = MaterialTheme.typography.labelMedium)
                }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(10.dp)
                        .background(Color(0xFFE9EEF5), RoundedCornerShape(999.dp))
                        .pointerInput(point, prepared) {
                            detectTapGestures { tap ->
                                val width = size.width.toFloat().coerceAtLeast(1f)
                                var start = 0f
                                val chosen = point.values.firstOrNull { value ->
                                    val segmentWidth = ((value.value / prepared.maxValue).toFloat().coerceAtLeast(0f) * width)
                                    val hit = tap.x in start..(start + segmentWidth)
                                    start += segmentWidth
                                    hit
                                } ?: point.values.maxByOrNull { it.value }
                                onSelect(chosen?.let {
                                    ChartSelection(point.rowIndex, point.label, it.label, it.key, formatChartValue(it.value), it.color)
                                })
                            }
                        },
                    horizontalArrangement = Arrangement.Start
                ) {
                    point.values.forEach { value ->
                        Box(
                            modifier = Modifier
                                .fillMaxWidth((value.value / prepared.maxValue).toFloat().coerceIn(0f, 1f))
                                .height(10.dp)
                                .background(
                                    if (selection?.matches(point.label, value.key) == true) value.color.copy(alpha = 0.82f) else value.color,
                                    RoundedCornerShape(999.dp)
                                )
                        )
                    }
                }
            }
        }
    }
    if (prepared.series.size <= 1) {
        ChartLegend(prepared.series)
    }
}

@Composable
private fun MultiSeriesCartesianChart(
    prepared: PreparedChartData,
    type: String,
    selection: ChartSelection?,
    onSelect: (ChartSelection?) -> Unit,
    chartHeight: androidx.compose.ui.unit.Dp,
    maximumAxisLabels: Int
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(chartHeight)
                .background(ChartCanvasColor, RoundedCornerShape(14.dp))
                .padding(12.dp)
                .pointerInput(prepared, type) {
                    detectTapGestures { tap ->
                        onSelect(findCartesianSelection(tap, size.width.toFloat(), size.height.toFloat(), prepared))
                    }
                }
        ) {
            val width = size.width
            val height = size.height
            if (prepared.points.size == 1 && prepared.series.size == 1) {
                val only = prepared.series.first()
                drawGridLines(width, height)
                drawCircle(
                    color = only.color,
                    radius = 8.dp.toPx(),
                    center = Offset(width / 2f, height / 2f)
                )
                return@Canvas
            }

            drawGridLines(width, height)
            prepared.series.forEach { series ->
                val linePath = Path()
                val areaPath = Path()
                prepared.points.forEachIndexed { index, point ->
                    val value = point.values.firstOrNull { it.key == series.key }?.value ?: 0.0
                    val x = (width / max(prepared.points.size - 1, 1)) * index
                    val y = height - (height * (value / prepared.maxValue).toFloat().coerceIn(0f, 1f))
                    if (index == 0) {
                        linePath.moveTo(x, y)
                        if (type == "area") {
                            areaPath.moveTo(x, height)
                            areaPath.lineTo(x, y)
                        }
                    } else {
                        linePath.lineTo(x, y)
                        if (type == "area") {
                            areaPath.lineTo(x, y)
                        }
                    }
                    val selected = selection?.matches(point.label, series.key) == true
                    drawCircle(
                        color = if (selected) series.color.copy(alpha = 0.82f) else series.color,
                        radius = if (selected) 5.dp.toPx() else 4.dp.toPx(),
                        center = Offset(x, y)
                    )
                }
                if (type == "area" && prepared.points.isNotEmpty()) {
                    areaPath.lineTo(width, height)
                    areaPath.close()
                    drawPath(path = areaPath, color = series.color.copy(alpha = 0.16f), style = Fill)
                }
                drawPath(path = linePath, color = series.color, style = Stroke(width = 3.dp.toPx()))
            }
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            sampledChartAxisLabels(prepared.points.map { it.label }, maximumAxisLabels).forEach { label ->
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelSmall,
                    color = ChartMutedText,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
        if (prepared.series.size <= 1) {
            ChartLegend(prepared.series)
        }
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawGridLines(width: Float, height: Float) {
    repeat(5) { index ->
        val y = (height / 4f) * index
        drawLine(
            color = ChartGridColor,
            start = Offset(0f, y),
            end = Offset(width, y),
            strokeWidth = 1.dp.toPx()
        )
    }
}

@Composable
private fun PieChart(
    slices: List<PieSlice>,
    donut: Boolean,
    selection: ChartSelection?,
    onSelect: (ChartSelection?) -> Unit,
    chartHeight: androidx.compose.ui.unit.Dp
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(chartHeight)
                .background(ChartCanvasColor, RoundedCornerShape(14.dp))
                .padding(12.dp)
                .pointerInput(slices, donut) {
                    detectTapGestures { tap ->
                        onSelect(findPieSelection(tap, size.width.toFloat(), size.height.toFloat(), slices, donut))
                    }
                }
        ) {
            val total = slices.sumOf { it.value }.takeIf { it > 0 } ?: return@Canvas
            val diameter = min(size.width, size.height)
            val topLeft = Offset((size.width - diameter) / 2f, (size.height - diameter) / 2f)
            val chartSize = Size(diameter, diameter)
            var startAngle = -90f
            slices.forEach { slice ->
                val sweep = ((slice.value / total) * 360.0).toFloat()
                drawArc(
                    color = if (selection?.matches(slice.label, slice.seriesKey) == true) slice.color.copy(alpha = 0.82f) else slice.color,
                    startAngle = startAngle,
                    sweepAngle = sweep,
                    useCenter = !donut,
                    topLeft = topLeft,
                    size = chartSize,
                    style = if (donut) Stroke(width = diameter * 0.22f) else Fill
                )
                startAngle += sweep
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            slices.forEach { slice ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(
                        modifier = Modifier
                            .background(slice.color, RoundedCornerShape(999.dp))
                            .padding(horizontal = 6.dp, vertical = 6.dp)
                    )
                    Text(
                        text = slice.label,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = slice.valueLabel,
                        style = MaterialTheme.typography.labelSmall,
                        color = ChartMutedText
                    )
                }
            }
        }
    }
}

@Composable
private fun ChartLegend(series: List<ChartSeriesDisplay>) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        series.forEach { seriesEntry ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(
                    modifier = Modifier
                        .background(seriesEntry.color, RoundedCornerShape(999.dp))
                        .padding(horizontal = 6.dp, vertical = 6.dp)
                )
                Text(
                    text = seriesEntry.label,
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

@Composable
private fun ChartDataFallback(
    rows: List<ChartAccessibleDataRow>,
    totalCount: Int
) {
    if (rows.isEmpty()) {
        return
    }
    Surface(
        color = Color(0xFFF8FAFC),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, Color(0xFFE4E7EC))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = "Chart data",
                style = MaterialTheme.typography.labelMedium,
                color = ChartMutedText,
                fontWeight = FontWeight.SemiBold
            )
            rows.forEach { row ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = row.category,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = row.seriesLabel,
                        style = MaterialTheme.typography.bodySmall,
                        color = ChartMutedText,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = row.valueLabel,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1
                    )
                }
            }
            val remaining = totalCount - rows.size
            if (remaining > 0) {
                Text(
                    text = "+$remaining more",
                    style = MaterialTheme.typography.labelSmall,
                    color = ChartMutedText,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

internal data class ChartSeriesDisplay(
    val key: String,
    val label: String,
    val color: Color
)

internal data class ChartSeriesValue(
    val key: String,
    val label: String,
    val value: Double,
    val color: Color
)

internal data class ChartPoint(
    val rowIndex: Int,
    val label: String,
    val values: List<ChartSeriesValue>
) {
    val total: Double = values.sumOf { it.value }
}

internal data class PieSlice(
    val rowIndex: Int,
    val label: String,
    val seriesKey: String,
    val seriesLabel: String,
    val value: Double,
    val valueLabel: String,
    val color: Color
)

internal data class ChartAccessibleDataRow(
    val category: String,
    val seriesLabel: String,
    val valueLabel: String
)

internal data class ChartDataStateFeedback(
    val message: String,
    val isError: Boolean = false
)

internal data class PreparedChartData(
    val points: List<ChartPoint>,
    val series: List<ChartSeriesDisplay>,
    val maxValue: Double
)

internal data class ChartSelection(
    val rowIndex: Int,
    val label: String,
    val seriesLabel: String,
    val seriesKey: String,
    val valueLabel: String,
    val color: Color
) {
    fun matches(pointLabel: String, pointSeriesKey: String): Boolean {
        return label == pointLabel && seriesKey == pointSeriesKey
    }
}

internal fun prepareChartData(rows: List<Map<String, Any?>>, chart: ChartDef): PreparedChartData {
    val seriesDefs = resolveSeriesDefinitions(chart)
    val labelKey = chart.series?.nameKey?.takeIf { it.isNotBlank() }
        ?: chart.xKey?.takeIf { it.isNotBlank() }
        ?: chart.nameKey?.takeIf { it.isNotBlank() }
        ?: chart.xAxis?.dataKey.orEmpty()
    val points = rows.mapIndexedNotNull { index, row ->
        val label = row[labelKey]?.toString()?.takeIf { it.isNotBlank() } ?: "Item ${index + 1}"
        val values = seriesDefs.mapNotNull { series ->
            val value = (row[series.key] as? Number)?.toDouble()
                ?: row[series.key]?.toString()?.toDoubleOrNull()
                ?: return@mapNotNull null
            ChartSeriesValue(
                key = series.key,
                label = series.label,
                value = value,
                color = series.color
            )
        }
        if (values.isEmpty()) null else ChartPoint(rowIndex = index, label = label, values = values)
    }
    val maxValue = when (chartType(chart)) {
        "bar", "stacked_bar" -> points.maxOfOrNull { it.total }
        "pie", "donut" -> points.maxOfOrNull { point -> point.values.maxOfOrNull { it.value } ?: 0.0 }
        else -> points.maxOfOrNull { point -> point.values.maxOfOrNull { it.value } ?: 0.0 }
    } ?: 0.0
    return PreparedChartData(points = points, series = seriesDefs, maxValue = maxValue.coerceAtLeast(1.0))
}

internal fun sampledChartAxisLabels(labels: List<String>, maximum: Int): List<String> {
    val orderedLabels = labels
        .filter { it.trim().isNotEmpty() }
        .distinct()
    if (maximum <= 0 || orderedLabels.size <= maximum) {
        return orderedLabels
    }
    if (maximum == 1) {
        return listOf(orderedLabels.first())
    }
    val lastIndex = orderedLabels.lastIndex
    return (0 until maximum).map { position ->
        val index = kotlin.math.round(
            position.toDouble() * lastIndex.toDouble() / (maximum - 1).toDouble()
        ).toInt()
        orderedLabels[index]
    }
}

internal fun buildPieSlices(prepared: PreparedChartData): List<PieSlice> {
    return prepared.points.flatMap { point ->
        point.values.map { value ->
            PieSlice(
                rowIndex = point.rowIndex,
                label = if (prepared.series.size > 1) "${point.label} · ${value.label}" else point.label,
                seriesKey = value.key,
                seriesLabel = value.label,
                value = value.value,
                valueLabel = formatChartValue(value.value),
                color = value.color
            )
        }
    }.filter { it.value > 0 }
}

internal fun chartAccessibleDataRows(
    prepared: PreparedChartData,
    chartType: String,
    limit: Int = 12
): List<ChartAccessibleDataRow> {
    val normalizedType = chartType.trim().lowercase()
    val rows = if (normalizedType == "pie" || normalizedType == "donut") {
        buildPieSlices(prepared).map { slice ->
            ChartAccessibleDataRow(
                category = slice.label,
                seriesLabel = slice.seriesLabel,
                valueLabel = slice.valueLabel
            )
        }
    } else {
        prepared.points.flatMap { point ->
            point.values.map { value ->
                ChartAccessibleDataRow(
                    category = point.label,
                    seriesLabel = value.label,
                    valueLabel = formatChartValue(value.value)
                )
            }
        }
    }
    return rows.take(max(limit, 0))
}

internal fun chartAccessibleDataValueCount(
    prepared: PreparedChartData,
    chartType: String
): Int {
    val normalizedType = chartType.trim().lowercase()
    return if (normalizedType == "pie" || normalizedType == "donut") {
        buildPieSlices(prepared).size
    } else {
        prepared.points.sumOf { it.values.size }
    }
}

internal fun chartDataStateFeedback(
    loading: Boolean,
    error: String?,
    hasResolvedRows: Boolean = true,
    hasChartValues: Boolean
): ChartDataStateFeedback? {
    if (hasChartValues) {
        return null
    }
    if (loading || !hasResolvedRows) {
        return ChartDataStateFeedback("Loading chart")
    }
    if (!error.isNullOrBlank()) {
        return ChartDataStateFeedback(
            message = "Unable to load chart data",
            isError = true
        )
    }
    return ChartDataStateFeedback("No chart data")
}

internal fun chartDisplayTitle(chartTitle: String?, containerTitle: String? = null): String? {
    val chart = chartTitle?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    val container = containerTitle?.trim()?.takeIf { it.isNotEmpty() }
    return chart.takeUnless { container != null && it.equals(container, ignoreCase = true) }
}

internal fun filterPreparedChartData(
    prepared: PreparedChartData,
    selectedSeriesKeys: Set<String>,
    chartType: String
): PreparedChartData {
    val filteredSeries = prepared.series.filter { selectedSeriesKeys.contains(it.key) }
    if (filteredSeries.isEmpty()) {
        return prepared.copy(points = emptyList(), series = emptyList(), maxValue = 1.0)
    }
    val filteredPoints = prepared.points.mapNotNull { point ->
        val filteredValues = point.values.filter { selectedSeriesKeys.contains(it.key) }
        if (filteredValues.isEmpty()) null else point.copy(values = filteredValues)
    }
    val normalizedType = chartType.trim().lowercase()
    val maxValue = when (normalizedType) {
        "bar", "stacked_bar" -> filteredPoints.maxOfOrNull { it.total }
        else -> filteredPoints.maxOfOrNull { point ->
            point.values.maxOfOrNull { it.value } ?: 0.0
        }
    }?.coerceAtLeast(1.0) ?: 1.0
    return PreparedChartData(
        points = filteredPoints,
        series = filteredSeries,
        maxValue = maxValue
    )
}

private fun resolveSeriesDefinitions(chart: ChartDef): List<ChartSeriesDisplay> {
    val rawSeries = chart.series
    val palette = if (rawSeries?.palette.isNullOrEmpty()) DefaultChartPalette else rawSeries?.palette.orEmpty()
    val explicitValues = rawSeries?.values.orEmpty()
    val candidates = when {
        explicitValues.isNotEmpty() -> explicitValues
        !rawSeries?.valueKey.isNullOrBlank() -> listOf(ChartValueOption(name = rawSeries?.valueKey, value = rawSeries?.valueKey))
        !chart.valueKey.isNullOrBlank() -> listOf(ChartValueOption(name = chart.valueKey, value = chart.valueKey))
        else -> emptyList()
    }
    return candidates.mapIndexedNotNull { index, item ->
        val key = item.value?.takeIf { it.isNotBlank() } ?: return@mapIndexedNotNull null
        ChartSeriesDisplay(
            key = key,
            label = item.name?.takeIf { it.isNotBlank() } ?: key,
            color = parseChartColor(palette.getOrNull(index % palette.size))
        )
    }
}

private fun chartType(chart: ChartDef): String =
    (chart.type ?: chart.kind ?: "line").trim().lowercase()

internal fun findCartesianSelection(
    tap: Offset,
    width: Float,
    height: Float,
    prepared: PreparedChartData
): ChartSelection? {
    if (prepared.points.isEmpty() || prepared.series.isEmpty()) return null
    var nearest: Triple<ChartPoint, ChartSeriesValue, Float>? = null
    prepared.points.forEachIndexed { index, point ->
        val x = (width / max(prepared.points.size - 1, 1)) * index
        point.values.forEach { value ->
            val y = height - (height * (value.value / prepared.maxValue).toFloat().coerceIn(0f, 1f))
            val distance = sqrt((tap.x - x).pow(2) + (tap.y - y).pow(2))
            if (nearest == null || distance < nearest!!.third) {
                nearest = Triple(point, value, distance)
            }
        }
    }
    val chosen = nearest?.takeIf { it.third <= 40f } ?: return null
    return ChartSelection(
        rowIndex = chosen.first.rowIndex,
        label = chosen.first.label,
        seriesLabel = chosen.second.label,
        seriesKey = chosen.second.key,
        valueLabel = formatChartValue(chosen.second.value),
        color = chosen.second.color
    )
}

internal fun findPieSelection(
    tap: Offset,
    width: Float,
    height: Float,
    slices: List<PieSlice>,
    donut: Boolean
): ChartSelection? {
    if (slices.isEmpty()) return null
    val diameter = min(width, height)
    val center = Offset(width / 2f, height / 2f)
    val radius = diameter / 2f
    val dx = tap.x - center.x
    val dy = tap.y - center.y
    val distance = sqrt(dx * dx + dy * dy)
    val innerRadius = if (donut) radius * 0.56f else 0f
    if (distance > radius || distance < innerRadius) return null
    var angle = Math.toDegrees(atan2(dy.toDouble(), dx.toDouble())).toFloat() + 90f
    if (angle < 0f) angle += 360f
    val total = slices.sumOf { it.value }.takeIf { it > 0 } ?: return null
    var startAngle = 0f
    slices.forEach { slice ->
        val sweep = ((slice.value / total) * 360.0).toFloat()
        if (angle in startAngle..(startAngle + sweep)) {
            return ChartSelection(slice.rowIndex, slice.label, slice.seriesLabel, slice.seriesKey, slice.valueLabel, slice.color)
        }
        startAngle += sweep
    }
    return null
}

private fun parseChartColor(value: String?): Color {
    val raw = value?.trim().orEmpty()
    if (raw.isBlank()) {
        return Color(0xFF2563EB)
    }
    val hex = raw.removePrefix("#")
    val encoded = when (hex.length) {
        6 -> ("FF$hex").toLongOrNull(16)
        8 -> hex.toLongOrNull(16)
        else -> null
    } ?: return Color(0xFF2563EB)
    return Color(encoded)
}

internal fun formatChartValue(value: Double): String {
    return if (value % 1.0 == 0.0) value.toInt().toString() else String.format("%.2f", value)
}

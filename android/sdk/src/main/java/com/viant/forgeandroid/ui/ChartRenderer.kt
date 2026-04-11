package com.viant.forgeandroid.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.ChartDef
import com.viant.forgeandroid.runtime.ChartValueOption
import com.viant.forgeandroid.runtime.DataSourceContext
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
fun ChartRenderer(context: DataSourceContext, chart: ChartDef) {
    val rows by context.collection.flow.collectAsState(initial = emptyList())
    ChartRenderer(rows, chart)
}

@Composable
fun ChartRenderer(rows: List<Map<String, Any?>>, chart: ChartDef) {
    val prepared = prepareChartData(rows, chart)
    val type = (chart.type ?: "line").trim().lowercase()
    var selection by remember(prepared, type) { mutableStateOf<ChartSelection?>(null) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White, RoundedCornerShape(16.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        chart.yAxis?.label?.takeIf { it.isNotBlank() }?.let {
            Text(text = it, style = MaterialTheme.typography.titleSmall)
        }
        if (prepared.points.isEmpty() || prepared.series.isEmpty()) {
            Text("No chart data", style = MaterialTheme.typography.bodyMedium, color = ChartMutedText)
            return@Column
        }

        selection?.let { selected ->
            ChartTooltip(selected)
        }

        when {
            type == "bar" || type == "stacked_bar" -> {
                StackedBarChart(
                    prepared = prepared,
                    selection = selection,
                    onSelect = { selection = it }
                )
            }
            type == "pie" || type == "donut" -> {
                PieChart(
                    slices = buildPieSlices(prepared),
                    donut = type == "donut",
                    selection = selection,
                    onSelect = { selection = it }
                )
            }
            else -> {
                MultiSeriesCartesianChart(
                    prepared = prepared,
                    type = type,
                    selection = selection,
                    onSelect = { selection = it }
                )
            }
        }
    }
}

@Composable
internal fun FenceChartRenderer(spec: FenceChartSpec) {
    ChartRenderer(spec.rows, spec.chart)
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
                                    ChartSelection(point.label, it.label, formatChartValue(it.value), it.color)
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
                                    if (selection?.matches(point.label, value.label) == true) value.color.copy(alpha = 0.82f) else value.color,
                                    RoundedCornerShape(999.dp)
                                )
                        )
                    }
                }
            }
        }
    }
    ChartLegend(prepared.series)
}

@Composable
private fun MultiSeriesCartesianChart(
    prepared: PreparedChartData,
    type: String,
    selection: ChartSelection?,
    onSelect: (ChartSelection?) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(220.dp)
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
                    val selected = selection?.matches(point.label, series.label) == true
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
            prepared.points.forEach { point ->
                Text(
                    text = point.label,
                    style = MaterialTheme.typography.labelSmall,
                    color = ChartMutedText,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
        ChartLegend(prepared.series)
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
    onSelect: (ChartSelection?) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(220.dp)
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
                    color = if (selection?.matches(slice.label, slice.seriesLabel) == true) slice.color.copy(alpha = 0.82f) else slice.color,
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
    val label: String,
    val values: List<ChartSeriesValue>
) {
    val total: Double = values.sumOf { it.value }
}

internal data class PieSlice(
    val label: String,
    val seriesLabel: String,
    val value: Double,
    val valueLabel: String,
    val color: Color
)

internal data class PreparedChartData(
    val points: List<ChartPoint>,
    val series: List<ChartSeriesDisplay>,
    val maxValue: Double
)

internal data class ChartSelection(
    val label: String,
    val seriesLabel: String,
    val valueLabel: String,
    val color: Color
) {
    fun matches(pointLabel: String, pointSeriesLabel: String): Boolean {
        return label == pointLabel && seriesLabel == pointSeriesLabel
    }
}

internal fun prepareChartData(rows: List<Map<String, Any?>>, chart: ChartDef): PreparedChartData {
    val xKey = chart.xAxis?.dataKey.orEmpty()
    val seriesDefs = resolveSeriesDefinitions(chart)
    val points = rows.mapIndexedNotNull { index, row ->
        val label = row[xKey]?.toString()?.takeIf { it.isNotBlank() } ?: "Item ${index + 1}"
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
        if (values.isEmpty()) null else ChartPoint(label = label, values = values)
    }
    val maxValue = when ((chart.type ?: "line").trim().lowercase()) {
        "bar", "stacked_bar" -> points.maxOfOrNull { it.total }
        "pie", "donut" -> points.maxOfOrNull { point -> point.values.maxOfOrNull { it.value } ?: 0.0 }
        else -> points.maxOfOrNull { point -> point.values.maxOfOrNull { it.value } ?: 0.0 }
    } ?: 0.0
    return PreparedChartData(points = points, series = seriesDefs, maxValue = maxValue.coerceAtLeast(1.0))
}

internal fun buildPieSlices(prepared: PreparedChartData): List<PieSlice> {
    return prepared.points.flatMap { point ->
        point.values.map { value ->
            PieSlice(
                label = if (prepared.series.size > 1) "${point.label} · ${value.label}" else point.label,
                seriesLabel = value.label,
                value = value.value,
                valueLabel = formatChartValue(value.value),
                color = value.color
            )
        }
    }.filter { it.value > 0 }
}

private fun resolveSeriesDefinitions(chart: ChartDef): List<ChartSeriesDisplay> {
    val rawSeries = chart.series
    val palette = if (rawSeries?.palette.isNullOrEmpty()) DefaultChartPalette else rawSeries?.palette.orEmpty()
    val explicitValues = rawSeries?.values.orEmpty()
    val candidates = when {
        explicitValues.isNotEmpty() -> explicitValues
        !rawSeries?.valueKey.isNullOrBlank() -> listOf(ChartValueOption(name = rawSeries?.valueKey, value = rawSeries?.valueKey))
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
        label = chosen.first.label,
        seriesLabel = chosen.second.label,
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
            return ChartSelection(slice.label, slice.seriesLabel, slice.valueLabel, slice.color)
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

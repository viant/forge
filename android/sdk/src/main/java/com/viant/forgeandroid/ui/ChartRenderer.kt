package com.viant.forgeandroid.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.ChartDef
import com.viant.forgeandroid.runtime.DataSourceContext
import kotlin.math.max

@Composable
fun ChartRenderer(context: DataSourceContext, chart: ChartDef) {
    val rows by context.collection.flow.collectAsState(initial = emptyList())
    ChartRenderer(rows, chart)
}

@Composable
internal fun ChartRenderer(rows: List<Map<String, Any?>>, chart: ChartDef) {
    val prepared = prepareChartData(rows, chart)
    val type = (chart.type ?: "line").trim().lowercase()

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
        if (prepared.points.isEmpty()) {
            Text("No chart data", style = MaterialTheme.typography.bodyMedium, color = Color(0xFF6A7280))
            return@Column
        }

        if (type == "bar") {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                prepared.points.forEach { point ->
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(point.label, style = MaterialTheme.typography.labelMedium)
                            Text(point.valueLabel, style = MaterialTheme.typography.labelMedium)
                        }
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(10.dp)
                                .background(Color(0xFFE9EEF5), RoundedCornerShape(999.dp))
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(point.ratio)
                                    .height(10.dp)
                                    .background(point.color, RoundedCornerShape(999.dp))
                            )
                        }
                    }
                }
            }
        } else if (type == "pie" || type == "donut") {
            PieChart(prepared.points, donut = type == "donut")
        } else {
            Canvas(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(220.dp)
                    .background(Color(0xFFF8FAFC), RoundedCornerShape(14.dp))
                    .padding(12.dp)
            ) {
                val width = size.width
                val height = size.height
                if (prepared.points.size == 1) {
                    drawCircle(
                        color = prepared.points.first().color,
                        radius = 8.dp.toPx(),
                        center = Offset(width / 2f, height / 2f)
                    )
                    return@Canvas
                }
                val path = Path()
                val areaPath = Path()
                prepared.points.forEachIndexed { index, point ->
                    val x = (width / max(prepared.points.size - 1, 1)) * index
                    val y = height - (height * point.ratio)
                    if (index == 0) {
                        path.moveTo(x, y)
                        if (type == "area") {
                            areaPath.moveTo(x, height)
                            areaPath.lineTo(x, y)
                        }
                    } else {
                        path.lineTo(x, y)
                        if (type == "area") {
                            areaPath.lineTo(x, y)
                        }
                    }
                    drawCircle(color = point.color, radius = 4.dp.toPx(), center = Offset(x, y))
                }
                if (type == "area" && prepared.points.isNotEmpty()) {
                    areaPath.lineTo(width, height)
                    areaPath.close()
                    drawPath(path = areaPath, color = Color(0x332563EB), style = Fill)
                }
                drawPath(path = path, color = Color(0xFF2563EB), style = Stroke(width = 3.dp.toPx()))
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                prepared.points.forEach { point ->
                    Text(
                        text = point.label,
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFF6A7280),
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}

@Composable
internal fun FenceChartRenderer(spec: FenceChartSpec) {
    ChartRenderer(spec.rows, spec.chart)
}

@Composable
private fun PieChart(points: List<ChartPoint>, donut: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(220.dp)
                .background(Color(0xFFF8FAFC), RoundedCornerShape(14.dp))
                .padding(12.dp)
        ) {
            val total = points.sumOf { it.value }.takeIf { it > 0 } ?: return@Canvas
            val diameter = minOf(size.width, size.height)
            val topLeft = Offset((size.width - diameter) / 2f, (size.height - diameter) / 2f)
            val chartSize = Size(diameter, diameter)
            var startAngle = -90f
            points.forEach { point ->
                val sweep = ((point.value / total) * 360.0).toFloat()
                drawArc(
                    color = point.color,
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
            points.forEach { point ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(
                        modifier = Modifier
                            .background(point.color, RoundedCornerShape(999.dp))
                            .padding(horizontal = 6.dp, vertical = 6.dp)
                    )
                    Text(
                        text = point.label,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = point.valueLabel,
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFF6A7280)
                    )
                }
            }
        }
    }
}

private data class ChartPoint(
    val label: String,
    val value: Double,
    val ratio: Float,
    val valueLabel: String,
    val color: Color
)

private data class PreparedChartData(
    val points: List<ChartPoint>
)

private fun prepareChartData(rows: List<Map<String, Any?>>, chart: ChartDef): PreparedChartData {
    val xKey = chart.xAxis?.dataKey.orEmpty()
    val valueKey = chart.series?.valueKey
        ?: chart.series?.values?.firstOrNull()?.value
        ?: ""
    val palette = if (chart.series?.palette.isNullOrEmpty()) {
        listOf("#2563EB", "#16A34A", "#EA580C", "#9333EA")
    } else {
        chart.series?.palette ?: emptyList()
    }
    val pointsRaw = rows.mapIndexedNotNull { index, row ->
        val value = (row[valueKey] as? Number)?.toDouble()
            ?: row[valueKey]?.toString()?.toDoubleOrNull()
            ?: return@mapIndexedNotNull null
        val label = row[xKey]?.toString()?.takeIf { it.isNotBlank() } ?: "Item ${index + 1}"
        val color = parseChartColor(palette.getOrNull(index % palette.size))
        label to (value to color)
    }
    val maxValue = pointsRaw.maxOfOrNull { it.second.first } ?: 0.0
    val points = pointsRaw.map { (label, pair) ->
        val value = pair.first
        ChartPoint(
            label = label,
            value = value,
            ratio = if (maxValue <= 0.0) 0f else (value / maxValue).toFloat().coerceIn(0f, 1f),
            valueLabel = formatChartValue(value),
            color = pair.second
        )
    }
    return PreparedChartData(points)
}

private fun parseChartColor(value: String?): Color {
    return try {
        if (value.isNullOrBlank()) Color(0xFF2563EB) else Color(android.graphics.Color.parseColor(value))
    } catch (_: IllegalArgumentException) {
        Color(0xFF2563EB)
    }
}

private fun formatChartValue(value: Double): String {
    return if (value % 1.0 == 0.0) value.toInt().toString() else String.format("%.2f", value)
}

package com.viant.forgeandroid.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.Dp
import com.viant.forgeandroid.runtime.ChartDef
import com.viant.forgeandroid.runtime.ColumnDef
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.SelectorUtil
import com.viant.forgeandroid.runtime.TableDef
import com.viant.forgeandroid.runtime.formatDashboardValue

@Composable
internal fun ChartTableModeRenderer(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    container: ContainerDef,
    chart: ChartDef,
    rows: List<Map<String, Any?>>? = null,
    tableContent: (@Composable (TableDef) -> Unit)? = null
) {
    val datasourceRows by context.collection.flow.collectAsState(initial = context.collection.peek())
    val control by context.control.flow.collectAsState(initial = context.control.peek())
    val windowForm by context.window.windowFormSignal().flow.collectAsState(
        initial = context.window.peekWindowForm()
    )
    val resolvedChart = resolveChartTickFormat(chart, windowForm)
    val effectiveRows = rows ?: datasourceRows
    val authoredTable = chartTableModeTable(container)
    val table = authoredTable ?: chartTableModeTable(resolvedChart, effectiveRows)
    val modes = normalizedChartTableViewModes(container.viewModes, hasChart = true, hasTable = table != null)
    var selectedMode by remember(container.id, modes) {
        mutableStateOf(resolvedChartTableViewMode(null, modes))
    }
    val mode = resolvedChartTableViewMode(selectedMode, modes)

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
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
        if (mode == "table" && table != null) {
            if (rows == null && control.loading) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            } else if (tableContent != null) {
                tableContent(table)
            } else if (authoredTable == null) {
                ChartDataTable(rows = effectiveRows, table = table, chart = resolvedChart)
            } else {
                TableRenderer(runtime, context, table, rows)
            }
        } else {
            if (rows != null) {
                ChartRenderer(
                    rows,
                    resolvedChart,
                    containerTitle = container.title,
                    showDataFallback = modes.size <= 1
                )
            } else {
                ChartRenderer(
                    context,
                    resolvedChart,
                    containerTitle = container.title,
                    showDataFallback = modes.size <= 1
                )
            }
        }
    }
}

internal fun resolveChartTickFormat(
    chart: ChartDef,
    windowForm: Map<String, Any?>
): ChartDef {
    val axis = chart.xAxis ?: return chart
    val selector = axis.tickFormatSelector?.trim().orEmpty()
    if (selector.isBlank() || axis.tickFormats.isEmpty()) return chart
    val source = axis.tickFormatSource?.trim()?.lowercase().orEmpty()
    if (source.isNotBlank() && source != "windowform") return chart
    val selected = SelectorUtil.resolve(windowForm, selector)?.toString()?.trim().orEmpty()
    val format = axis.tickFormats[selected] ?: axis.tickFormat
    return chart.copy(xAxis = axis.copy(tickFormat = format))
}

internal fun chartTableModeTable(chart: ChartDef, rows: List<Map<String, Any?>>): TableDef? {
    val xKey = chart.xAxis?.dataKey?.trim().orEmpty()
    val series = chart.series?.values.orEmpty().mapNotNull { value ->
        val key = value.value?.trim().takeUnless { it.isNullOrBlank() }
            ?: value.name?.trim().takeUnless { it.isNullOrBlank() }
            ?: return@mapNotNull null
        ColumnDef(
            id = key,
            label = value.label?.takeIf { it.isNotBlank() } ?: value.name?.takeIf { it.isNotBlank() } ?: humanizeChartTableKey(key),
            format = value.format?.takeIf { it.isNotBlank() }
                ?: chart.axes[value.axis?.trim().orEmpty()]?.format?.takeIf { it.isNotBlank() }
                ?: chart.yAxis?.format?.takeIf { value.axis.isNullOrBlank() || value.axis.equals("left", ignoreCase = true) }
                ?: "number"
        )
    }
    if (xKey.isBlank() && series.isEmpty()) {
        return null
    }
    val xColumn = xKey.takeIf { it.isNotBlank() }?.let { key ->
        val temporal = rows.firstNotNullOfOrNull { row -> row[key]?.toString()?.takeIf { chartTemporalInstant(it) != null } } != null
        ColumnDef(
            id = key,
            label = chart.xAxis?.label?.takeIf { it.isNotBlank() } ?: humanizeChartTableKey(key),
            format = if (temporal) chartTableTemporalFormat(chart.xAxis?.tickFormat) else null
        )
    }
    return TableDef(
        title = chart.title,
        columns = listOfNotNull(xColumn) + series
    )
}

private fun chartTableTemporalFormat(tickFormat: String?): String {
    val normalized = tickFormat?.trim().orEmpty()
    val includesTime = normalized.contains("H") || normalized.contains("h") ||
        normalized.contains("m") || normalized.contains("s") ||
        normalized.equals("datetime", ignoreCase = true)
    return if (includesTime) "datetime" else "date"
}

@Composable
private fun ChartDataTable(
    rows: List<Map<String, Any?>>,
    table: TableDef,
    chart: ChartDef
) {
    val orderedRows = remember(rows, chart) {
        val prepared = prepareChartData(rows, chart)
        if (prepared.points.isEmpty()) rows else prepared.points.mapNotNull { rows.getOrNull(it.rowIndex) }
    }
    val visibleRows = orderedRows.take(100)
    val chartSeriesByKey = remember(chart) {
        chart.series?.values.orEmpty().mapIndexedNotNull { index, series ->
            val key = series.value?.trim().takeUnless { it.isNullOrBlank() }
                ?: series.name?.trim().takeUnless { it.isNullOrBlank() }
                ?: return@mapIndexedNotNull null
            key to (series.color?.takeIf { it.isNotBlank() } ?: chartTableSeriesColor(index))
        }.toMap()
    }
    val seriesValues = remember(orderedRows, chartSeriesByKey) {
        chartSeriesByKey.keys.associateWith { key -> orderedRows.map { row -> row[key] } }
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
            val fittedColumnWidth = if (table.columns.size in 1..3) {
                (maxWidth / table.columns.size).coerceAtLeast(88.dp)
            } else {
                null
            }
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
            ) {
                Row(
                    modifier = Modifier
                        .background(Color(0xFFEFF4FF))
                        .padding(horizontal = 10.dp, vertical = 9.dp)
                ) {
                    table.columns.forEach { column ->
                        Text(
                            text = column.label ?: column.id.orEmpty(),
                            modifier = Modifier.width(chartTableColumnWidth(column, fittedColumnWidth)),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF344054)
                        )
                    }
                }
                visibleRows.forEachIndexed { index, row ->
                    Row(
                        modifier = Modifier
                            .background(if (index % 2 == 0) Color.White else Color(0xFFF8FAFC))
                            .padding(horizontal = 10.dp, vertical = 9.dp)
                    ) {
                        table.columns.forEach { column ->
                            val key = column.id ?: column.key ?: column.name
                            val value = key?.let(row::get)
                            val width = chartTableColumnWidth(column, fittedColumnWidth)
                            val barColor = key?.let(chartSeriesByKey::get)?.let(::parseChartColor)
                            val barFraction = key?.let { chartTableDataBarFraction(value, seriesValues[it].orEmpty()) }
                            if (barColor != null && barFraction != null) {
                                ChartTableDataBarCell(
                                    text = formatDashboardValue(value, column.format),
                                    fraction = barFraction,
                                    color = barColor,
                                    modifier = Modifier.width(width)
                                )
                            } else {
                                Text(
                                    text = formatDashboardValue(value, column.format),
                                    modifier = Modifier.width(width),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFF344054),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                }
            }
        }
        Text(
            text = if (orderedRows.size > visibleRows.size) {
                "Showing ${visibleRows.size} of ${orderedRows.size} rows · swipe horizontally for more columns"
            } else {
                "${orderedRows.size} rows · swipe horizontally for more columns"
            },
            style = MaterialTheme.typography.labelSmall,
            color = Color(0xFF667085)
        )
    }
}

@Composable
private fun ChartTableDataBarCell(
    text: String,
    fraction: Float,
    color: Color,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .height(30.dp)
            .padding(end = 8.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFFF3F6FA))
    ) {
        if (fraction > 0f) {
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .fillMaxWidth(fraction.coerceIn(0.025f, 1f))
                    .background(color.copy(alpha = 0.30f))
            )
        }
        Text(
            text = text,
            modifier = Modifier
                .align(Alignment.CenterStart)
                .padding(horizontal = 8.dp),
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.SemiBold,
            color = Color(0xFF10243A),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

internal fun chartTableDataBarFraction(value: Any?, values: List<Any?>): Float? {
    val current = chartTableNumericValue(value) ?: return null
    val numericValues = values.mapNotNull(::chartTableNumericValue)
    if (numericValues.isEmpty()) return null
    val lower = minOf(0.0, numericValues.minOrNull() ?: 0.0)
    val upper = maxOf(0.0, numericValues.maxOrNull() ?: 0.0)
    val range = upper - lower
    return if (range <= 0.0) 0f else ((current - lower) / range).toFloat().coerceIn(0f, 1f)
}

private fun chartTableNumericValue(value: Any?): Double? = when (value) {
    is Number -> value.toDouble().takeIf { it.isFinite() }
    is String -> value.trim().replace(",", "").toDoubleOrNull()?.takeIf { it.isFinite() }
    else -> null
}

private fun chartTableSeriesColor(index: Int): String {
    val colors = listOf("#2f6de1", "#2d8a5d", "#b7791f", "#7c3aed", "#dc2626")
    return colors[index % colors.size]
}

private fun chartTableColumnWidth(column: ColumnDef, fittedWidth: Dp? = null) = fittedWidth ?: when (column.format?.trim()?.lowercase()) {
    "date", "datetime", "wallclockdate", "wallclockhour" -> 148.dp
    else -> 136.dp
}

private fun humanizeChartTableKey(key: String): String = key
    .replace(Regex("([a-z0-9])([A-Z])"), "$1 $2")
    .replace('_', ' ')
    .replace('-', ' ')
    .trim()
    .split(Regex("\\s+"))
    .filter { it.isNotBlank() }
    .joinToString(" ") { it.lowercase().replaceFirstChar(Char::uppercase) }

internal fun chartTableModeTable(container: ContainerDef): TableDef? {
    container.table?.let {
        return it
    }
    return container.columns.takeIf { it.isNotEmpty() }?.let { TableDef(title = container.title, columns = it) }
}

internal fun normalizedChartTableViewModes(
    rawModes: List<String>,
    hasChart: Boolean,
    hasTable: Boolean
): List<String> {
    val available = mutableSetOf<String>().apply {
        if (hasChart) {
            add("chart")
        }
        if (hasTable) {
            add("table")
        }
    }
    val seen = mutableSetOf<String>()
    val requested = rawModes.mapNotNull { raw ->
        val mode = raw.trim().lowercase()
        if (mode in available && seen.add(mode)) mode else null
    }
    if (requested.isNotEmpty()) {
        return requested
    }
    return when {
        hasChart && hasTable -> listOf("chart", "table")
        hasChart -> listOf("chart")
        hasTable -> listOf("table")
        else -> emptyList()
    }
}

internal fun dashboardDimensionsViewModes(container: ContainerDef): List<String> {
    val dimensionsModes = container.dashboard?.dimensions?.viewModes.orEmpty()
    val rawModes = dimensionsModes.ifEmpty { container.viewModes }
    return normalizedChartTableViewModes(rawModes, hasChart = true, hasTable = true)
}

internal fun resolvedChartTableViewMode(selectedMode: String?, modes: List<String>): String {
    val selected = selectedMode?.trim()?.lowercase().orEmpty()
    return selected.takeIf { it in modes } ?: modes.firstOrNull() ?: "chart"
}

internal fun chartTableModeLabel(mode: String): String {
    return when (mode) {
        "chart" -> "Chart"
        "table" -> "Table"
        else -> mode.trim().let { trimmed ->
            if (trimmed.isEmpty()) mode else trimmed.substring(0, 1).uppercase() + trimmed.substring(1)
        }
    }
}

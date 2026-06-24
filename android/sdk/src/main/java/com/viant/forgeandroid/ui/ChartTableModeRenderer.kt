package com.viant.forgeandroid.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.ChartDef
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.TableDef

@Composable
internal fun ChartTableModeRenderer(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    container: ContainerDef,
    chart: ChartDef,
    rows: List<Map<String, Any?>>? = null,
    tableContent: (@Composable (TableDef) -> Unit)? = null
) {
    val table = chartTableModeTable(container)
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
            if (tableContent != null) {
                tableContent(table)
            } else {
                TableRenderer(runtime, context, table, rows)
            }
        } else {
            if (rows != null) {
                ChartRenderer(rows, chart, containerTitle = container.title)
            } else {
                ChartRenderer(context, chart, containerTitle = container.title)
            }
        }
    }
}

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

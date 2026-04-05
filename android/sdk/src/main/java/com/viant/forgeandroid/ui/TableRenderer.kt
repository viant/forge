package com.viant.forgeandroid.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.TableDef

@Composable
fun TableRenderer(runtime: ForgeRuntime, context: DataSourceContext, table: TableDef) {
    val rows by context.collection.flow.collectAsState(initial = emptyList())
    val selection by context.selection.flow.collectAsState(initial = com.viant.forgeandroid.runtime.SelectionState())
    val metrics by context.metrics.flow.collectAsState(initial = emptyMap())
    val input by context.input.flow.collectAsState(initial = com.viant.forgeandroid.runtime.InputState())

    LaunchedEffect(Unit) {
        context.fetchCollection()
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        table.toolbar?.let { tb ->
            TableToolbar(runtime, context, tb)
        }
        BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
            val compact = maxWidth < 720.dp
            LazyColumn(verticalArrangement = Arrangement.spacedBy(if (compact) 10.dp else 2.dp)) {
                itemsIndexed(rows) { index, row ->
                    val isSelected = selection.rowIndex == index
                    if (compact) {
                        MobileTableCard(runtime, context, table, row, index, isSelected)
                    } else {
                        DesktopTableRow(runtime, context, table, row, index, isSelected)
                    }
                }
            }
        }
        if (context.dataSource.paging?.enabled == true || metrics["pageCount"] != null || metrics["hasMore"] != null) {
            TablePagination(
                context = context,
                metrics = metrics,
                currentPage = input.page ?: 1
            )
        }
    }
}

@Composable
private fun MobileTableCard(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    table: TableDef,
    row: Map<String, Any?>,
    index: Int,
    isSelected: Boolean
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { context.toggleSelection(row, index) },
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) Color(0xFFF4F7FF) else Color.White
        ),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = if (isSelected) 3.dp else 1.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            table.columns.filter { it.type != "button" }.forEachIndexed { fieldIndex, col ->
                val key = col.id ?: col.name ?: return@forEachIndexed
                val value = row[key]?.toString().orEmpty()
                if (fieldIndex == 0) {
                    Text(
                        text = value.ifBlank { col.label ?: key },
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            text = col.label ?: col.name ?: key,
                            style = MaterialTheme.typography.labelMedium,
                            color = Color(0xFF6A7280)
                        )
                        Text(
                            text = value.ifBlank { "-" },
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }
            val actions = table.columns.filter { it.type == "button" && it.on.isNotEmpty() }
            if (actions.isNotEmpty()) {
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    actions.forEach { col ->
                        AssistChip(
                            onClick = {
                                col.on.firstOrNull()?.let { exec ->
                                    runtime.execute(exec, context, mapOf("row" to row, "rowIndex" to index))
                                }
                            },
                            label = { Text(col.label ?: col.icon ?: col.id ?: "Action") },
                            colors = AssistChipDefaults.assistChipColors(containerColor = Color(0xFFE9EEF9))
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DesktopTableRow(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    table: TableDef,
    row: Map<String, Any?>,
    index: Int,
    isSelected: Boolean
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                if (isSelected) Color(0xFFE8EEF9) else Color.Transparent,
                shape = RoundedCornerShape(12.dp)
            )
            .clickable { context.toggleSelection(row, index) }
            .padding(horizontal = 10.dp, vertical = 12.dp)
    ) {
        table.columns.forEach { col ->
            when (col.type) {
                "button" -> {
                    Button(
                        onClick = {
                            col.on.firstOrNull()?.let { exec ->
                                runtime.execute(exec, context, mapOf("row" to row, "rowIndex" to index))
                            }
                        },
                        modifier = Modifier.padding(end = 8.dp)
                    ) {
                        Text(col.label ?: col.icon ?: col.id ?: "...")
                    }
                }
                else -> {
                    val key = col.id ?: col.name ?: ""
                    val value = row[key]?.toString() ?: ""
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .padding(end = 12.dp)
                    ) {
                        Text(
                            text = col.label ?: col.name ?: key,
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFF6A7280)
                        )
                        Text(text = value, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
    }
}

@Composable
private fun TablePagination(
    context: DataSourceContext,
    metrics: Map<String, Any?>,
    currentPage: Int
) {
    val totalPages = when (val value = metrics["pageCount"]) {
        is Number -> value.toInt()
        is String -> value.toIntOrNull()
        else -> null
    } ?: if ((metrics["hasMore"] as? Boolean) == true) currentPage + 1 else currentPage

    val totalCount = when (val value = metrics["totalCount"]) {
        is Number -> value.toInt()
        is String -> value.toIntOrNull()
        else -> null
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = buildString {
                append("Page ")
                append(currentPage)
                if (totalPages > 0) {
                    append(" of ")
                    append(totalPages)
                }
                if (totalCount != null) {
                    append(" • ")
                    append(totalCount)
                    append(" total")
                }
            },
            style = MaterialTheme.typography.bodySmall,
            color = Color(0xFF667085),
            modifier = Modifier.weight(1f)
        )
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            IconButton(
                onClick = { context.setPage((currentPage - 1).coerceAtLeast(1)) },
                enabled = currentPage > 1
            ) {
                Icon(Icons.Default.ChevronLeft, contentDescription = "Previous page")
            }
            IconButton(
                onClick = { context.setPage(currentPage + 1) },
                enabled = totalPages <= 0 || currentPage < totalPages || (metrics["hasMore"] as? Boolean == true)
            ) {
                Icon(Icons.Default.ChevronRight, contentDescription = "Next page")
            }
        }
    }
}

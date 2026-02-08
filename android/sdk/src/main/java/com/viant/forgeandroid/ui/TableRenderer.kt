package com.viant.forgeandroid.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ExecutionDef
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.TableDef

@Composable
fun TableRenderer(runtime: ForgeRuntime, context: DataSourceContext, table: TableDef) {
    val rows by context.collection.flow.collectAsState(initial = emptyList())
    val selection by context.selection.flow.collectAsState(initial = com.viant.forgeandroid.runtime.SelectionState())

    LaunchedEffect(Unit) {
        context.fetchCollection()
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        table.toolbar?.let { tb ->
            TableToolbar(runtime, context, tb)
        }
        LazyColumn {
            itemsIndexed(rows) { index, row ->
                val isSelected = selection.rowIndex == index
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(if (isSelected) Color(0xFFE0E0E0) else Color.Transparent)
                        .clickable { context.toggleSelection(row, index) }
                        .padding(8.dp)
                ) {
                    table.columns.forEach { col ->
                        when (col.type) {
                            "button" -> {
                                Button(onClick = {
                                    col.on.firstOrNull()?.let { exec ->
                                        runtime.execute(exec, context, mapOf("row" to row, "rowIndex" to index))
                                    }
                                }) { Text(col.icon ?: col.id ?: "...") }
                            }
                            else -> {
                                val key = col.id ?: col.name ?: ""
                                val value = row[key]?.toString() ?: ""
                                Text(text = value, modifier = Modifier.padding(end = 12.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

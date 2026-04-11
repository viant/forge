package com.viant.forgeandroid.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.FileBrowserDef
import com.viant.forgeandroid.runtime.ForgeRuntime

@Composable
fun FileBrowserRenderer(runtime: ForgeRuntime, context: DataSourceContext, config: FileBrowserDef) {
    val rows by context.collection.flow.collectAsState(initial = emptyList())
    val control by context.control.flow.collectAsState(initial = com.viant.forgeandroid.runtime.ControlState())
    val selection by context.selection.flow.collectAsState(initial = com.viant.forgeandroid.runtime.SelectionState())
    val input by context.input.flow.collectAsState(initial = com.viant.forgeandroid.runtime.InputState())
    val selectedUri = rowLocation(selection.selected)
    val currentUri = input.filter["uri"]?.toString().orEmpty()

    LaunchedEffect(Unit) {
        context.fetchCollection()
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFF8FAFC), RoundedCornerShape(16.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = config.title ?: "Browse files",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold
        )
        if (currentUri.isNotBlank() && currentUri != "/") {
            BrowserBreadcrumb(currentUri = currentUri) {
                val parent = currentUri.substringBeforeLast('/', "").ifBlank { "/" }
                context.setFilter(mapOf("uri" to parent))
            }
        }
        if (control.error != null) {
            Text(
                text = control.error ?: "",
                color = Color(0xFFB42318),
                style = MaterialTheme.typography.bodySmall
            )
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            itemsIndexed(rows, key = { _, row -> rowLocation(row) ?: row.hashCode().toString() }) { index, row ->
                FileBrowserRow(
                    row = row,
                    selected = selectedUri == rowLocation(row),
                    folderOnly = config.folderOnly == true,
                    onClick = {
                        val isFolder = row["isFolder"] as? Boolean == true
                        val uri = rowLocation(row).orEmpty()
                        val actionable = isFolder || config.folderOnly != true
                        if (!actionable) {
                            return@FileBrowserRow
                        }
                        if (isFolder) {
                            context.toggleSelection(row, index)
                            context.setFilter(mapOf("uri" to uri))
                        } else {
                            context.toggleSelection(row, index)
                        }
                        config.on.forEach { exec ->
                            runtime.execute(exec, context, mapOf("row" to row, "rowIndex" to index, "uri" to uri))
                        }
                    }
                )
            }
        }
    }
}

@Composable
private fun BrowserBreadcrumb(currentUri: String, onUp: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onUp)
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Up", tint = Color(0xFF475467))
        Text(
            text = currentUri,
            style = MaterialTheme.typography.bodySmall,
            color = Color(0xFF475467)
        )
    }
}

@Composable
private fun FileBrowserRow(
    row: Map<String, Any?>,
    selected: Boolean,
    folderOnly: Boolean,
    onClick: () -> Unit
) {
    val isFolder = row["isFolder"] as? Boolean == true
    val name = row["name"]?.toString()
        ?.takeIf { it.isNotBlank() }
        ?: rowLocation(row)?.substringAfterLast('/')?.ifBlank { "/" }
        ?: "Unnamed"
    val subtitle = rowLocation(row).orEmpty()

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                if (selected) Color(0xFFE0F2FE) else Color.White,
                RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp)
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(
                imageVector = if (isFolder) Icons.Default.Folder else Icons.Default.Description,
                contentDescription = if (isFolder) "Folder" else "File",
                tint = if (isFolder) Color(0xFF1D4ED8) else Color(0xFF667085)
            )
            Column {
                Text(
                    text = name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = if (folderOnly && !isFolder) "$subtitle (file disabled)" else subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF667085)
                )
            }
        }
    }
}

private fun rowLocation(row: Map<String, Any?>?): String? {
    if (row == null) {
        return null
    }
    return listOf("uri", "URI", "url", "path", "Path")
        .asSequence()
        .mapNotNull { key -> row[key]?.toString()?.trim() }
        .firstOrNull { it.isNotBlank() }
}

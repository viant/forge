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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.FileBrowserDef
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.fileBrowserRowAccessibilityLabel
import com.viant.forgeandroid.runtime.fileBrowserParentUri
import com.viant.forgeandroid.runtime.fileBrowserRowLocation
import com.viant.forgeandroid.runtime.fileBrowserRowModel
import kotlinx.coroutines.launch

@Composable
fun FileBrowserRenderer(runtime: ForgeRuntime, context: DataSourceContext, config: FileBrowserDef) {
    val rows by context.collection.flow.collectAsState(initial = emptyList())
    val control by context.control.flow.collectAsState(initial = com.viant.forgeandroid.runtime.ControlState())
    val selection by context.selection.flow.collectAsState(initial = com.viant.forgeandroid.runtime.SelectionState())
    val input by context.input.flow.collectAsState(initial = com.viant.forgeandroid.runtime.InputState())
    val selectedUri = fileBrowserRowLocation(selection.selected)
    val currentUri = input.filter["uri"]?.toString().orEmpty()
    val coroutineScope = rememberCoroutineScope()

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
                context.setFilter(mapOf("uri" to fileBrowserParentUri(currentUri)))
            }
        }
        if (control.error != null) {
            Text(
                text = control.error ?: "",
                color = Color(0xFFB42318),
                style = MaterialTheme.typography.bodySmall
            )
        }
        if (rows.isEmpty()) {
            Text(
                text = "No files",
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFF667085)
            )
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                itemsIndexed(rows, key = { index, row -> fileBrowserRowModel(row, index).id }) { index, row ->
                    val model = fileBrowserRowModel(row, index)
                    FileBrowserRow(
                        model = model,
                        selected = selectedUri == model.uri,
                        folderOnly = config.folderOnly == true,
                        onClick = {
                            coroutineScope.launch {
                                if (model.isFolder) {
                                    context.toggleSelection(row, index)
                                    context.setFilter(mapOf("uri" to model.uri))
                                } else {
                                    context.toggleSelection(row, index)
                                }
                                config.on.forEach { exec ->
                                    runtime.execute(exec, context, mapOf("row" to row, "rowIndex" to index, "uri" to model.uri))
                                }
                            }
                        }
                    )
                }
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
    model: com.viant.forgeandroid.runtime.FileBrowserRowModel,
    selected: Boolean,
    folderOnly: Boolean,
    onClick: () -> Unit
) {
    val disabled = folderOnly && !model.isFolder
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                if (selected) Color(0xFFE0F2FE) else Color.White,
                RoundedCornerShape(12.dp)
            )
            .semantics {
                contentDescription = fileBrowserRowAccessibilityLabel(model, disabled)
            }
            .clickable(enabled = !disabled, onClick = onClick)
            .alpha(if (disabled) 0.55f else 1f)
            .padding(horizontal = 12.dp, vertical = 10.dp)
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(
                imageVector = if (model.isFolder) Icons.Default.Folder else Icons.Default.Description,
                contentDescription = if (model.isFolder) "Folder" else "File",
                tint = if (model.isFolder) Color(0xFF1D4ED8) else Color(0xFF667085)
            )
            Column {
                Text(
                    text = model.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = if (disabled) "${model.subtitle} (file disabled)" else model.subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF667085)
                )
            }
        }
    }
}

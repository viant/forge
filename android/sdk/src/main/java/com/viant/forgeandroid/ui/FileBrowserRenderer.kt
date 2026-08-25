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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.FilterChip
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
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
import com.viant.forgeandroid.runtime.deduplicateFileBrowserRows
import com.viant.forgeandroid.runtime.previousTextFromUnifiedDiff
import com.viant.forgeandroid.runtime.compactFileBrowserParent
import kotlinx.coroutines.launch

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun FileBrowserRenderer(runtime: ForgeRuntime, context: DataSourceContext, config: FileBrowserDef) {
    val rows by context.collection.flow.collectAsState(initial = emptyList())
    val visibleRows = remember(rows, config.dedupeBy) { deduplicateFileBrowserRows(rows, config.dedupeBy) }
    val control by context.control.flow.collectAsState(initial = com.viant.forgeandroid.runtime.ControlState())
    val selection by context.selection.flow.collectAsState(initial = com.viant.forgeandroid.runtime.SelectionState())
    val input by context.input.flow.collectAsState(initial = com.viant.forgeandroid.runtime.InputState())
    val selectedUri = fileBrowserRowLocation(selection.selected)
    val currentUri = input.filter["uri"]?.toString().orEmpty()
    val coroutineScope = rememberCoroutineScope()
    var previewRow by remember { mutableStateOf<Map<String, Any?>?>(null) }

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
        if (visibleRows.isEmpty()) {
            Text(
                text = "No files",
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFF667085)
            )
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                itemsIndexed(visibleRows, key = { index, row -> fileBrowserRowModel(row, index).id }) { index, row ->
                    val model = fileBrowserRowModel(row, index)
                    FileBrowserRow(
                        model = model.copy(subtitle = compactFileBrowserParent(model.uri)),
                        selected = selectedUri == model.uri,
                        folderOnly = config.folderOnly == true,
                        onClick = {
                            coroutineScope.launch {
                                if (model.isFolder) {
                                    context.toggleSelection(row, index)
                                    context.setFilter(mapOf("uri" to model.uri))
                                } else {
                                    context.toggleSelection(row, index)
                                    if (config.preview != null) previewRow = row
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
    previewRow?.let { row ->
        MobileFilePreviewSheet(runtime = runtime, row = row, config = config, onDismiss = { previewRow = null })
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun MobileFilePreviewSheet(runtime: ForgeRuntime, row: Map<String, Any?>, config: FileBrowserDef, onDismiss: () -> Unit) {
    val preview = config.preview ?: return
    val currentUri = row[preview.currentField ?: "url"]?.toString().orEmpty()
    val previousUri = row[preview.previousField ?: "origUrl"]?.toString().orEmpty()
    val diff = row[preview.diffField ?: "diff"]?.toString().orEmpty()
    var resolvedDiff by remember(row) { mutableStateOf(diff) }
    var current by remember(row) { mutableStateOf("") }
    var previous by remember(row) { mutableStateOf("") }
    var loading by remember(row) { mutableStateOf(true) }
    var mode by remember(row) { mutableStateOf(preview.defaultMode ?: "current") }
    LaunchedEffect(row) {
        preview.tool?.takeIf { it.isNotBlank() }?.let { tool ->
            runtime.loadFilePreview(tool, currentUri)?.let { content ->
                current = content.current; previous = content.previous; resolvedDiff = content.diff
                loading = false
                return@LaunchedEffect
            }
        }
        current = runCatching { runtime.loadFileText(currentUri) }.getOrDefault("")
        if (previousUri.isNotBlank() && previousUri != currentUri) previous = runCatching { runtime.loadFileText(previousUri) }.getOrDefault("")
        if (previous.isBlank()) previous = previousTextFromUnifiedDiff(current, diff)
        loading = false
    }
    val modes = (preview.modes.ifEmpty { listOf("current") }).filter { it != "prev" || previous.isNotBlank() }
    val effectiveMode = mode.takeIf { it in modes } ?: modes.firstOrNull().orEmpty()
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(modifier = Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(currentUri.substringAfterLast('/').ifBlank { "Changed file" }, style = MaterialTheme.typography.titleLarge)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                modes.forEach { item -> FilterChip(selected = effectiveMode == item, onClick = { mode = item }, label = { Text(if (item == "prev") "Previous" else item.replaceFirstChar { it.titlecase() }) }) }
            }
            if (loading) CircularProgressIndicator()
            else SelectionContainer {
                Column(modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).background(Color(0xFF0E131B), RoundedCornerShape(14.dp)).padding(12.dp)) {
                    if (effectiveMode == "diff") resolvedDiff.lines().forEach { line ->
                        Text(line, color = when { line.startsWith("+") && !line.startsWith("+++") -> Color(0xFF6EE7B7); line.startsWith("-") && !line.startsWith("---") -> Color(0xFFFCA5A5); else -> Color(0xFFCBD5E1) }, style = MaterialTheme.typography.bodySmall)
                    } else Text(if (effectiveMode == "prev") previous else current, color = Color(0xFFE5E7EB), style = MaterialTheme.typography.bodySmall)
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

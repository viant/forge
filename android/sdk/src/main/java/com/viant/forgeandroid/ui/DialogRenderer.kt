package com.viant.forgeandroid.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.DialogDef
import com.viant.forgeandroid.runtime.DialogState
import com.viant.forgeandroid.runtime.ExecutionDef
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.JsonUtil
import com.viant.forgeandroid.runtime.SelectionState
import com.viant.forgeandroid.runtime.WindowContext
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

@Composable
fun DialogRenderer(runtime: ForgeRuntime, window: WindowContext, dialogs: List<DialogDef>) {
    dialogs.forEach { dialog ->
        val dialogId = dialog.id ?: return@forEach
        val signal = window.dialogSignal(dialogId)
        val state by signal.flow.collectAsState(initial = DialogState())
        if (!state.open) return@forEach

        if (state.open) {
            key(dialogId) {
                val dialogDataSourceRef = dialog.content?.dataSourceRef ?: dialog.dataSourceRef
                val dsContext = dialogDataSourceRef?.let { window.contextOrNull(it) }
                val selectionState by if (dsContext != null) {
                    dsContext.selection.flow.collectAsState(initial = dsContext.peekSelection())
                } else {
                    remember(dialogId) { mutableStateOf(SelectionState()) }
                }
                val effectiveSelectionMode = (state.selectionMode ?: dialog.selectionMode ?: dsContext?.dataSource?.selectionMode ?: "")
                    .trim()
                    .lowercase()
                val quickFilters = remember(dialogId) { quickFilterSpecs(dialog) }
                val quickFilterValues = remember(dialogId) { mutableStateMapOf<String, String>() }

                LaunchedEffect(dialogId, quickFilters) {
                    quickFilters.forEach { spec ->
                        if (!quickFilterValues.containsKey(spec.field)) {
                            quickFilterValues[spec.field] = ""
                        }
                    }
                }
                LaunchedEffect(dialogId, state.args) {
                    if (dsContext != null && state.args.isNotEmpty()) {
                        val scoped = JsonUtil.asStringMap(state.args[dialogDataSourceRef])
                            .takeIf { value -> value.isNotEmpty() }
                            ?: state.args
                        dsContext.setInputParameters(scoped, fetch = true)
                    }
                }
                LaunchedEffect(dialogId, state.open) {
                    if (state.open && dsContext != null && dsContext.collection.peek().isEmpty()) {
                        dsContext.fetchCollection()
                    }
                }
                AlertDialog(
                    onDismissRequest = { runtime.closeDialogPublic(window.windowId, dialogId) },
                    title = {
                        DialogTitle(
                            title = dialog.title ?: dialogId,
                            style = dialog.style
                        )
                    },
                    text = {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (quickFilters.isNotEmpty()) {
                                quickFilters.forEach { spec ->
                                    OutlinedTextField(
                                        value = quickFilterValues[spec.field].orEmpty(),
                                        onValueChange = { quickFilterValues[spec.field] = it },
                                        modifier = Modifier.fillMaxWidth(),
                                        label = { Text(spec.placeholder) },
                                        singleLine = true
                                    )
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                                    Spacer(modifier = Modifier.weight(1f))
                                    TextButton(onClick = {
                                        dsContext?.setFilter(
                                            quickFilterValues
                                                .filterValues { it.isNotBlank() }
                                                .mapValues { it.value.trim() }
                                        )
                                    }) {
                                        Text("Search")
                                    }
                                }
                            }
                            dialog.content?.let { container ->
                                if (
                                    container.fileBrowser != null ||
                                    container.table != null ||
                                    container.treeBrowser != null ||
                                    container.chart != null ||
                                    container.editor != null ||
                                    container.chat != null ||
                                    container.items.isNotEmpty() ||
                                    container.containers.isNotEmpty()
                                ) {
                                    ContainerRenderer(runtime, window, container, effectiveSelectionMode)
                                } else {
                                    Text("Dialog content")
                                }
                            }
                        }
                    },
                    confirmButton = {
                        val dismissIds = setOf("cancel", "close", "dismiss")
                        val primaryActions = dialog.actions.filterNot { action ->
                            (action.id ?: "").lowercase() in dismissIds
                        }
                        val canSelect = if (effectiveSelectionMode == "multi") {
                            selectionState.selection.isNotEmpty()
                        } else {
                            selectionState.selected != null || selectionState.selection.isNotEmpty()
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (primaryActions.isEmpty()) {
                                TextButton(
                                    onClick = {
                                        runtime.execute(
                                            ExecutionDef(handler = "dialog.commit"),
                                            dsContext,
                                            mapOf("dialogId" to dialogId, "windowId" to window.windowId)
                                        )
                                    },
                                    enabled = canSelect
                                ) {
                                    Text("Select")
                                }
                            } else {
                                primaryActions.forEach { action ->
                                    TextButton(onClick = {
                                        action.on.forEach { exec ->
                                            runtime.execute(exec, dsContext, mapOf("dialogId" to dialogId, "windowId" to window.windowId))
                                        }
                                    }) {
                                        Text(action.label ?: action.id ?: "Action")
                                    }
                                }
                            }
                        }
                    },
                    dismissButton = {
                        val dismissAction = dialog.actions.firstOrNull { action ->
                            (action.id ?: "").lowercase() in setOf("cancel", "close", "dismiss")
                        }
                        if (dismissAction != null) {
                            TextButton(onClick = {
                                dismissAction.on.forEach { exec ->
                                    runtime.execute(exec, dsContext, mapOf("dialogId" to dialogId, "windowId" to window.windowId))
                                }
                            }) {
                                Text(dismissAction.label ?: dismissAction.id ?: "Close")
                            }
                        } else {
                            TextButton(onClick = { runtime.closeDialogPublic(window.windowId, dialogId) }) {
                                Text("Close")
                            }
                        }
                    }
                )
            }
        }
    }
}

@Composable
private fun DialogTitle(title: String, style: Map<String, String>) {
    val headerBackground = dialogStyleColor(
        style,
        "headerBackgroundColor",
        "headerBackground",
        "titleBackgroundColor"
    )
    val headerText = dialogStyleColor(
        style,
        "headerTextColor",
        "headerColor",
        "titleColor"
    ) ?: if (headerBackground != null) Color.White else MaterialTheme.colorScheme.onSurface

    if (headerBackground == null) {
        Text(title)
        return
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(headerBackground, RoundedCornerShape(12.dp))
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        Text(
            text = title,
            color = headerText,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold
        )
    }
}

private fun dialogStyleColor(style: Map<String, String>, vararg keys: String): Color? {
    keys.forEach { key ->
        style[key]?.trim()?.takeIf { it.isNotEmpty() }?.let { raw ->
            parseHexColor(raw)?.let { return it }
        }
    }
    return null
}

private fun parseHexColor(raw: String): Color? {
    val value = raw.trim().removePrefix("#")
    if (value.length != 6 && value.length != 8) return null
    val parsed = value.toLongOrNull(16) ?: return null
    return if (value.length == 8) {
        val alpha = ((parsed shr 24) and 0xff).toInt()
        val red = ((parsed shr 16) and 0xff).toInt()
        val green = ((parsed shr 8) and 0xff).toInt()
        val blue = (parsed and 0xff).toInt()
        Color(red, green, blue, alpha)
    } else {
        val red = ((parsed shr 16) and 0xff).toInt()
        val green = ((parsed shr 8) and 0xff).toInt()
        val blue = (parsed and 0xff).toInt()
        Color(red, green, blue)
    }
}

private data class DialogQuickFilterSpec(
    val field: String,
    val placeholder: String
)

private fun quickFilterSpecs(dialog: DialogDef): List<DialogQuickFilterSpec> {
    val values = dialog.properties["quickFilters"] as? JsonArray ?: return emptyList()
    return values.mapNotNull { entry ->
        val obj = entry as? JsonObject ?: return@mapNotNull null
        val field = (obj["field"] as? JsonPrimitive)?.content?.trim().orEmpty()
        if (field.isEmpty()) {
            return@mapNotNull null
        }
        val placeholder = (obj["placeholder"] as? JsonPrimitive)?.content?.trim().orEmpty().ifEmpty { "Search" }
        DialogQuickFilterSpec(field = field, placeholder = placeholder)
    }
}

package com.viant.forgeandroid.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.DialogDef
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.WindowContext

@Composable
fun DialogRenderer(runtime: ForgeRuntime, window: WindowContext, dialogs: List<DialogDef>) {
    dialogs.forEach { dialog ->
        val dialogId = dialog.id ?: return@forEach
        val signal = window.dialogSignal(dialogId)
        val state by signal.flow.collectAsState(initial = com.viant.forgeandroid.runtime.DialogState())
        if (!state.open) return@forEach

        if (state.open) {
            key(dialogId) {
                val dsContext = dialog.content?.dataSourceRef?.let { window.context(it) }
                LaunchedEffect(dialogId, state.args) {
                    if (dsContext != null && state.args.isNotEmpty()) {
                        val scoped = com.viant.forgeandroid.runtime.JsonUtil.asStringMap(state.args[dialog.content.dataSourceRef]).takeIf { it.isNotEmpty() } ?: state.args
                        dsContext.setInputParameters(scoped, fetch = true)
                    }
                }
                AlertDialog(
                    onDismissRequest = { runtime.closeDialogPublic(window.windowId, dialogId) },
                    title = { Text(dialog.title ?: dialogId) },
                    text = {
                        dialog.content?.let { container ->
                            if (container.fileBrowser != null || container.table != null || container.chart != null || container.editor != null || container.chat != null || container.items.isNotEmpty() || container.containers.isNotEmpty()) {
                                ContainerRenderer(runtime, window, container)
                            } else {
                                Text("Dialog content")
                            }
                        }
                    },
                    confirmButton = {
                        val dismissIds = setOf("cancel", "close", "dismiss")
                        val primaryActions = dialog.actions.filterNot { action ->
                            (action.id ?: "").lowercase() in dismissIds
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
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
                    },
                    dismissButton = {
                        dialog.actions.firstOrNull { action ->
                            (action.id ?: "").lowercase() in setOf("cancel", "close", "dismiss")
                        }?.let { action ->
                            TextButton(onClick = {
                                action.on.forEach { exec ->
                                    runtime.execute(exec, dsContext, mapOf("dialogId" to dialogId, "windowId" to window.windowId))
                                }
                            }) {
                                Text(action.label ?: action.id ?: "Close")
                            }
                        }
                    }
                )
            }
        }
    }
}

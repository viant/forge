package com.viant.forgeandroid.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Divider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.ui.Modifier
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
                AlertDialog(
                    onDismissRequest = { runtime.closeDialogPublic(window.windowId, dialogId) },
                    title = { Text(dialog.title ?: dialogId) },
                    text = {
                        dialog.content?.let { container ->
                            if (container.items.isNotEmpty() && container.dataSourceRef != null) {
                                val dsContext = window.context(container.dataSourceRef)
                                FormRenderer(runtime, dsContext, container.items)
                            } else if (container.items.isNotEmpty()) {
                                Column(modifier = Modifier.fillMaxWidth()) {
                                    container.items.forEachIndexed { idx, item ->
                                        Text(
                                            text = item.label ?: item.id.orEmpty(),
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clickable {
                                                    val ctx = container.dataSourceRef?.let { window.context(it) }
                                                    item.on.forEach { exec ->
                                                        runtime.execute(exec, ctx, mapOf("dialogId" to dialogId, "windowId" to window.windowId))
                                                    }
                                                }
                                                .padding(vertical = 8.dp)
                                        )
                                        if (idx < container.items.size - 1) {
                                            Divider()
                                        }
                                    }
                                }
                            } else {
                                Text("Dialog content")
                            }
                        }
                    },
                    confirmButton = {
                        dialog.actions.firstOrNull { it.id == "ok" }?.let { action ->
                            TextButton(onClick = {
                                val ctx = dialog.content?.dataSourceRef?.let { window.context(it) }
                                action.on.forEach { exec ->
                                    runtime.execute(exec, ctx, mapOf("dialogId" to dialogId, "windowId" to window.windowId))
                                }
                            }) { Text(action.label ?: "OK") }
                        }
                    },
                    dismissButton = {
                        dialog.actions.firstOrNull { it.id == "cancel" }?.let { action ->
                            TextButton(onClick = {
                                val ctx = dialog.content?.dataSourceRef?.let { window.context(it) }
                                action.on.forEach { exec ->
                                    runtime.execute(exec, ctx, mapOf("dialogId" to dialogId, "windowId" to window.windowId))
                                }
                            }) { Text(action.label ?: "Cancel") }
                        }
                    }
                )
            }
        }
    }
}

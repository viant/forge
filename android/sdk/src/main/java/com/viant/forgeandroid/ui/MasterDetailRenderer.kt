package com.viant.forgeandroid.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.JsonUtil
import com.viant.forgeandroid.runtime.WindowContext
import com.viant.forgeandroid.runtime.WorkflowPrimitiveRuntime
import com.viant.forgeandroid.runtime.evaluateDashboardCondition

@Composable
internal fun MasterDetailRenderer(runtime: ForgeRuntime, window: WindowContext, container: ContainerDef) {
    val spec = container.masterDetail ?: return
    val master = container.containers.firstOrNull { it.id == spec.master.containerId } ?: return
    val detail = container.containers.firstOrNull { it.id == spec.detail.containerId } ?: return
    val masterRef = master.dataSourceRef ?: container.dataSourceRef.orEmpty()
    val detailRef = detail.dataSourceRef.orEmpty()
    if (masterRef == detailRef && masterRef.isNotEmpty()) { Text("Master and detail must use distinct datasource contexts."); return }
    val masterContext = window.contextOrNull(masterRef) ?: return
    val detailContext = window.contextOrNull(detailRef)
    val rows by masterContext.collection.flow.collectAsState(initial = masterContext.collection.peek())
    val selection by masterContext.selection.flow.collectAsState(initial = masterContext.selection.peek())
    val windowForm by window.windowFormSignal().flow.collectAsState(initial = window.peekWindowForm())
    val persisted = spec.stateKey?.let { JsonUtil.asStringMap(windowForm[it]) }
    val selected = WorkflowPrimitiveRuntime.resolveMasterDetailSelection(rows, selection.selected ?: selection.selection.lastOrNull(), persisted, spec.identityFields)
    val selectedId = WorkflowPrimitiveRuntime.masterDetailIdentity(selected, spec.identityFields).orEmpty()
    val detailAllowed = selected != null && evaluateDashboardCondition(spec.detail.allowedWhen, form = selected)
    var compactDetailVisible by remember { mutableStateOf(false) }

    LaunchedEffect(masterRef) { if (masterContext.dataSource.autoFetch != false) masterContext.fetchCollection() }
    LaunchedEffect(selectedId, detailAllowed) {
        if (selected == null || !detailAllowed || detailContext == null) {
            detailContext?.resetSelection()
            detailContext?.setForm(emptyMap())
            if (persisted?.isNotEmpty() == true && spec.selectionInvalidation.equals("clear", true)) {
                spec.stateKey?.let { runtime.setWindowFormValues(window.windowId, mapOf(it to mapOf("\$replace" to true, "value" to null)), bumpPrefillRevision = false) }
            }
            return@LaunchedEffect
        }
        val selectedRow = selected ?: return@LaunchedEffect
        spec.stateKey?.let { key ->
            val fields = spec.identityFields.ifEmpty { listOf("id") }
            runtime.setWindowFormValues(window.windowId, mapOf(key to fields.mapNotNull { field -> selectedRow[field]?.let { field to it } }.toMap()), bumpPrefillRevision = false)
        }
        detailContext.setInputParameters(WorkflowPrimitiveRuntime.masterDetailParameters(spec.detail, selectedRow), fetch = true)
    }

    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        val compact = maxWidth < 720.dp
        if (!compact) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.weight(1f)) { ContainerRenderer(runtime, window, master, inheritedDataSourceRef = container.dataSourceRef) }
                Column(modifier = Modifier.weight(1f)) { MasterDetailContent(runtime, window, detail, selected != null, detailAllowed, spec.emptyDetail?.message) }
            }
        } else if (compactDetailVisible && selected != null) {
            Column { Button(onClick = { compactDetailVisible = false }) { Text("Back") }; MasterDetailContent(runtime, window, detail, true, detailAllowed, spec.emptyDetail?.message) }
        } else {
            Column {
                ContainerRenderer(runtime, window, master, inheritedDataSourceRef = container.dataSourceRef)
                if (selectedId.isNotEmpty()) Button(onClick = { compactDetailVisible = true }) { Text("View details") }
            }
        }
    }
}

@Composable
private fun MasterDetailContent(runtime: ForgeRuntime, window: WindowContext, detail: ContainerDef, hasSelection: Boolean, allowed: Boolean, emptyMessage: String?) {
    when { !hasSelection -> Text(emptyMessage ?: "Select an item"); !allowed -> Text("Selection is not permitted"); else -> ContainerRenderer(runtime, window, detail) }
}

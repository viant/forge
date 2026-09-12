package com.viant.forgeandroid.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.*
import kotlinx.serialization.json.JsonPrimitive

@Composable
internal fun StableTabsRenderer(runtime: ForgeRuntime, window: WindowContext, container: ContainerDef, inheritedDataSourceRef: String?) {
    val focusManager = androidx.compose.ui.platform.LocalFocusManager.current
    val windowForm by window.windowFormSignal().flow.collectAsState(initial = window.peekWindowForm())
    val source = (container.dataSourceRef ?: inheritedDataSourceRef)?.let(window::contextOrNull)
    val form by source?.form?.flow?.collectAsState(initial = source.form.peek()) ?: remember { mutableStateOf(emptyMap()) }
    val collection by source?.collection?.flow?.collectAsState(initial = source.collection.peek()) ?: remember { mutableStateOf(emptyList()) }
    val metrics by source?.metrics?.flow?.collectAsState(initial = source.metrics.peek()) ?: remember { mutableStateOf(emptyMap()) }
    val selection by source?.selection?.flow?.collectAsState(initial = source.selection.peek()) ?: remember { mutableStateOf(SelectionState()) }
    val metadata by window.metadata.flow.collectAsState(initial = window.metadata.peek())
    val authorization = metadata?.authorizationSnapshot?.mapValues { JsonUtil.elementToAny(it.value) }.orEmpty()
    fun allows(condition: DashboardConditionDef?) = evaluateDashboardCondition(condition, metrics = metrics, form = form, windowForm = windowForm, collection = collection, authorization = authorization)
    val visible = mutableListOf<ContainerDef>()
    for (child in container.containers) {
        val permission = child.permissionBoundary
        val permissionSource = permission?.dataSourceRef?.let(window::contextOrNull)
        val grants by permissionSource?.collection?.flow?.collectAsState(initial = permissionSource.collection.peek()) ?: remember { mutableStateOf(emptyList()) }
        val rows = when (permission?.mode) { "selection" -> selection.selection.ifEmpty { selection.selected?.let(::listOf).orEmpty() }; "row" -> collection; else -> emptyList() }
        if (allows(child.visibleWhen) && (permission == null || (allows(permission.visibleWhen) && WorkflowPrimitiveRuntime.permissionAllows(permission, authorization, rows, grants)))) visible += child
    }
    val ids = visible.mapNotNull { it.id }
    val stateKey = "__forgeStableTab:${container.id ?: container.containers.firstOrNull()?.id ?: "root"}"
    val selected = StableTabsState.selected(ids, windowForm[stateKey]?.toString(), container.stableTabs?.defaultSelectedTabId)
    var visited by remember(window.windowId, container.id) { mutableStateOf(emptySet<String>()) }
    val mounted = StableTabsState.mounted(ids, selected, visited, container.stableTabs?.keepVisitedTabPanelsMounted == true, container.stableTabs?.renderActiveTabPanelOnly != false)
    LaunchedEffect(selected) { focusManager.clearFocus(); if (selected != null) visited = visited + selected }
    fun select(id: String) {
        if (id in visited && container.stableTabs?.dataSourceFetchMode != "once") (visible.firstOrNull { it.id == id }?.dataSourceRef ?: container.dataSourceRef)?.let { runtime.refreshDataSourceCollection(window.windowId, it) }
        windowForm[stateKey]?.toString().takeIf { it == id } ?: runtime.setWindowFormValues(window.windowId, mapOf(stateKey to id), bumpPrefillRevision = false)
        visited = visited + id
    }
    if (selected == null) return
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        var expanded by remember { mutableStateOf(false) }
        Box {
            OutlinedButton(onClick = { expanded = true }) { Text(visible.first { it.id == selected }.title ?: selected) }
            DropdownMenu(expanded, onDismissRequest = { expanded = false }) { visible.forEach { child -> DropdownMenuItem(text = { Text(child.title ?: child.id.orEmpty()) }, onClick = { child.id?.let(::select); expanded = false }) } }
        }
        visible.filter { it.id in mounted }.forEach { child -> key(child.id) {
            val active = child.id == selected
            Box(if (active) Modifier else Modifier.height(0.dp).alpha(0f).clipToBounds().clearAndSetSemantics {}) {
                ContainerRenderer(runtime, window, child, inheritedDataSourceRef = container.dataSourceRef ?: inheritedDataSourceRef, suppressTitle = true)
            }
        } }
    }
}

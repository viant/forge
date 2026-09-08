package com.viant.forgeandroid.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.OutlinedTextField
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
import com.viant.forgeandroid.runtime.TreeEditorSpec
import com.viant.forgeandroid.runtime.WindowContext
import com.viant.forgeandroid.runtime.WorkflowPrimitiveRuntime

@Composable
internal fun TreeEditorRenderer(runtime: ForgeRuntime, window: WindowContext, container: ContainerDef) {
    val spec = container.treeEditor ?: return
    val dataSourceRef = spec.dataSourceRef ?: container.dataSourceRef ?: return
    val context = window.contextOrNull(dataSourceRef) ?: return
    val nodes by context.collection.flow.collectAsState(initial = context.collection.peek())
    var selected by remember(dataSourceRef) { mutableStateOf(emptySet<String>()) }
    var excluded by remember(dataSourceRef) { mutableStateOf(emptySet<String>()) }
    var expanded by remember(dataSourceRef) { mutableStateOf(emptySet<String>()) }
    var search by remember { mutableStateOf("") }

    LaunchedEffect(dataSourceRef) { if (context.dataSource.autoFetch != false) context.fetchCollection() }
    LaunchedEffect(nodes) {
        val hydration = hydrateTree(nodes, spec)
        if (selected.isEmpty()) selected = hydration.first
        if (excluded.isEmpty()) excluded = hydration.second
        if (expanded.isEmpty()) expanded = hydration.third
    }
    val rows = flattenTree(nodes, spec, expanded, search)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (spec.searchable != false) OutlinedTextField(value = search, onValueChange = { search = it }, label = { Text("Search") }, modifier = Modifier.fillMaxWidth())
        if (rows.isEmpty()) Text(spec.emptyMessage ?: "No items")
        rows.forEach { row ->
            Row(modifier = Modifier.fillMaxWidth().padding(start = (row.depth * 16).dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (row.hasChildren && spec.collapsible != false) Button(onClick = { expanded = if (row.id in expanded) expanded - row.id else expanded + row.id }) { Text(if (row.id in expanded) "−" else "+") }
                if (spec.selectionMode.equals("includeExclude", true)) {
                    val current = if (row.id in excluded) 2 else if (row.id in selected) 1 else 0
                    Row(modifier = Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        listOf("None", "Include", "Exclude").forEachIndexed { index, label ->
                            Button(
                                enabled = current != index,
                                onClick = {
                                    selected = selected - row.id
                                    excluded = excluded - row.id
                                    if (index == 1) selected = selected + row.id
                                    if (index == 2) excluded = excluded + row.id
                                }
                            ) { Text(label) }
                        }
                    }
                } else {
                    Checkbox(
                        checked = row.id in selected,
                        onCheckedChange = { checked -> selected = WorkflowPrimitiveRuntime.toggleTreeSelection(nodes, selected, row.id, checked, spec) }
                    )
                    Text(row.label, modifier = Modifier.padding(top = 12.dp))
                }
            }
        }
        spec.mutation?.let { command ->
            MutationCommandButton(
                runtime, window, context, command,
                labelOverride = command.label ?: "Save selection",
                extras = mapOf("selectedIds" to selected.sorted(), "excludedIds" to excluded.sorted())
            )
        }
    }
}

private data class AndroidTreeRow(val id: String, val label: String, val depth: Int, val hasChildren: Boolean)

private fun flattenTree(nodes: List<Map<String, Any?>>, spec: TreeEditorSpec, expanded: Set<String>, search: String): List<AndroidTreeRow> {
    val result = mutableListOf<AndroidTreeRow>()
    fun visit(rows: List<Map<String, Any?>>, depth: Int) {
        rows.forEach { row ->
            val id = treeIdentity(row, spec) ?: return@forEach
            val label = row[spec.labelField ?: "label"]?.toString() ?: id
            val children = treeChildren(row, spec)
            if (search.isBlank() || label.contains(search, true)) result += AndroidTreeRow(id, label, depth, children.isNotEmpty())
            if (id in expanded || search.isNotBlank()) visit(children, depth + 1)
        }
    }
    visit(nodes, 0)
    return result
}

private fun hydrateTree(nodes: List<Map<String, Any?>>, spec: TreeEditorSpec): Triple<Set<String>, Set<String>, Set<String>> {
    val selected = mutableSetOf<String>(); val excluded = mutableSetOf<String>(); val expanded = mutableSetOf<String>()
    fun visit(rows: List<Map<String, Any?>>, depth: Int) {
        rows.forEach { row ->
            val id = treeIdentity(row, spec) ?: return@forEach
            if (spec.selectedField?.let { row[it] == true } == true) selected += id
            if (spec.excludedField?.let { row[it] == true } == true) excluded += id
            if (depth < (spec.defaultExpandedDepth ?: 0)) expanded += id
            visit(treeChildren(row, spec), depth + 1)
        }
    }
    visit(nodes, 0)
    return Triple(selected, excluded, expanded)
}

private fun treeIdentity(row: Map<String, Any?>, spec: TreeEditorSpec): String? = row[spec.identityField ?: "id"]?.toString()?.takeIf(String::isNotBlank)

private fun treeChildren(row: Map<String, Any?>, spec: TreeEditorSpec): List<Map<String, Any?>> =
    (row[spec.childrenField ?: "children"] as? List<*>)?.map(JsonUtil::asStringMap).orEmpty()

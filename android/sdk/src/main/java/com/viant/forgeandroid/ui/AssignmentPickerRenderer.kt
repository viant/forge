package com.viant.forgeandroid.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
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
import com.viant.forgeandroid.runtime.AssignmentPickerSpec
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.SelectorUtil
import com.viant.forgeandroid.runtime.WindowContext

@Composable
internal fun AssignmentPickerRenderer(runtime: ForgeRuntime, window: WindowContext, container: ContainerDef) {
    val spec = container.assignmentPicker ?: return
    val availableContext = window.contextOrNull(spec.availableDataSourceRef) ?: return
    val assignedContext = window.contextOrNull(spec.assignedDataSourceRef) ?: return
    val available by availableContext.collection.flow.collectAsState(initial = availableContext.collection.peek())
    val assigned by assignedContext.collection.flow.collectAsState(initial = assignedContext.collection.peek())
    var availableSelection by remember { mutableStateOf(emptySet<String>()) }
    var assignedSelection by remember { mutableStateOf(emptySet<String>()) }
    val assignedIds = assigned.mapNotNull { assignmentIdentity(it, spec) }.toSet()
    val assignable = available.filter { assignmentIdentity(it, spec)?.let { id -> id !in assignedIds } == true }

    LaunchedEffect(spec.availableDataSourceRef, spec.assignedDataSourceRef) {
        if (availableContext.dataSource.autoFetch != false) availableContext.fetchCollection()
        if (assignedContext.dataSource.autoFetch != false) assignedContext.fetchCollection()
    }
    LaunchedEffect(assignable) { availableSelection = availableSelection.intersect(assignable.mapNotNull { assignmentIdentity(it, spec) }.toSet()) }
    LaunchedEffect(assigned) { assignedSelection = assignedSelection.intersect(assigned.mapNotNull { assignmentIdentity(it, spec) }.toSet()) }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            AssignmentColumn("Available", assignable, spec, availableSelection, Modifier.weight(1f)) { id ->
                availableSelection = toggleAssignment(availableSelection, id, spec.allowMultiple != false)
            }
            AssignmentColumn("Assigned", assigned, spec, assignedSelection, Modifier.weight(1f)) { id ->
                assignedSelection = toggleAssignment(assignedSelection, id, spec.allowMultiple != false)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            spec.assign?.let { command ->
                MutationCommandButton(
                    runtime, window, availableContext, command,
                    labelOverride = command.label ?: "Assign",
                    extras = mapOf("selectedRows" to assignable.filter { assignmentIdentity(it, spec)?.let(availableSelection::contains) == true }),
                    externallyDisabled = availableSelection.isEmpty()
                )
            }
            spec.unassign?.let { command ->
                MutationCommandButton(
                    runtime, window, assignedContext, command,
                    labelOverride = command.label ?: "Unassign",
                    extras = mapOf("selectedRows" to assigned.filter { assignmentIdentity(it, spec)?.let(assignedSelection::contains) == true }),
                    externallyDisabled = assignedSelection.isEmpty()
                )
            }
        }
    }
}

@Composable
private fun AssignmentColumn(
    title: String,
    rows: List<Map<String, Any?>>,
    spec: AssignmentPickerSpec,
    selection: Set<String>,
    modifier: Modifier,
    onToggle: (String) -> Unit
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(4.dp),
        modifier = modifier.background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f), RoundedCornerShape(10.dp)).padding(10.dp)
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        if (rows.isEmpty()) Text("None", style = MaterialTheme.typography.bodySmall)
        rows.forEach { row ->
            val identity = assignmentIdentity(row, spec)
            Row(modifier = Modifier.fillMaxWidth()) {
                Checkbox(checked = identity != null && identity in selection, enabled = identity != null, onCheckedChange = { if (identity != null) onToggle(identity) })
                Text(assignmentLabel(row, spec), modifier = Modifier.padding(top = 12.dp))
            }
        }
    }
}

private fun assignmentIdentity(row: Map<String, Any?>, spec: AssignmentPickerSpec): String? {
    val fields = spec.identityFields.ifEmpty { listOf("id") }
    val values = fields.map { row[it]?.toString()?.takeIf(String::isNotBlank) ?: return null }
    return values.joinToString("\u001f")
}

private fun assignmentLabel(row: Map<String, Any?>, spec: AssignmentPickerSpec): String =
    SelectorUtil.resolve(row, spec.labelField ?: "label")?.toString()?.takeIf(String::isNotBlank)
        ?: assignmentIdentity(row, spec)
        ?: "Item"

private fun toggleAssignment(selection: Set<String>, id: String, multiple: Boolean): Set<String> = when {
    id in selection -> selection - id
    !multiple -> setOf(id)
    else -> selection + id
}

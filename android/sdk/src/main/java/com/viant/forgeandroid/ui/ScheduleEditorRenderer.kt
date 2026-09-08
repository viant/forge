package com.viant.forgeandroid.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
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
import com.viant.forgeandroid.runtime.ScheduleEditorSpec
import com.viant.forgeandroid.runtime.WindowContext
import com.viant.forgeandroid.runtime.WorkflowPrimitiveRuntime
import java.time.Instant
import java.time.ZoneId

@Composable
internal fun ScheduleEditorRenderer(runtime: ForgeRuntime, window: WindowContext, container: ContainerDef) {
    val spec = container.scheduleEditor ?: return
    val dataSourceRef = spec.dataSourceRef ?: container.dataSourceRef ?: return
    val context = window.contextOrNull(dataSourceRef) ?: return
    val sourceRows by context.collection.flow.collectAsState(initial = context.collection.peek())
    var rows by remember(dataSourceRef) { mutableStateOf(sourceRows.map { it.toMutableMap() }) }
    var dirty by remember(dataSourceRef) { mutableStateOf(false) }
    val validation = WorkflowPrimitiveRuntime.validateSchedule(rows, spec)

    LaunchedEffect(dataSourceRef) { if (context.dataSource.autoFetch != false) context.fetchCollection() }
    LaunchedEffect(sourceRows) { if (!dirty) rows = sourceRows.map { it.toMutableMap() } }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        rows.forEachIndexed { index, row ->
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f), RoundedCornerShape(10.dp)).padding(10.dp)
            ) {
                Text("Schedule ${index + 1}", style = MaterialTheme.typography.titleMedium)
                ScheduleField("Start (ISO-8601)", row[spec.startField ?: "start"]?.toString().orEmpty()) { value ->
                    rows = updateScheduleRow(rows, index, spec.startField ?: "start", value); dirty = true
                }
                ScheduleField("End (ISO-8601)", row[spec.endField ?: "end"]?.toString().orEmpty()) { value ->
                    rows = updateScheduleRow(rows, index, spec.endField ?: "end", value); dirty = true
                }
                spec.timeZoneField?.let { field ->
                    ScheduleField("Time zone", row[field]?.toString() ?: ZoneId.systemDefault().id) { value ->
                        rows = updateScheduleRow(rows, index, field, value); dirty = true
                    }
                }
                validation.errors.filter { it.index == index }.forEach { error ->
                    Text(scheduleErrorMessage(error.code), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
                if (spec.allowRemove != false) {
                    Button(onClick = { rows = rows.filterIndexed { rowIndex, _ -> rowIndex != index }.map { it.toMutableMap() }; dirty = true }) { Text("Remove") }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (spec.allowAdd != false) Button(onClick = { rows = rows + newScheduleRow(spec); dirty = true }) { Text("Add schedule") }
            spec.mutation?.let { command ->
                MutationCommandButton(
                    runtime, window, context, command,
                    labelOverride = command.label ?: "Save schedule",
                    extras = mapOf("rows" to rows),
                    externallyDisabled = !validation.valid || !dirty
                )
            }
        }
    }
}

@Composable
private fun ScheduleField(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(value = value, onValueChange = onChange, label = { Text(label) }, singleLine = true, modifier = Modifier.fillMaxWidth())
}

private fun updateScheduleRow(rows: List<Map<String, Any?>>, index: Int, field: String, value: Any?): List<MutableMap<String, Any?>> =
    rows.mapIndexed { rowIndex, row -> row.toMutableMap().apply { if (rowIndex == index) this[field] = value } }

private fun newScheduleRow(spec: ScheduleEditorSpec): MutableMap<String, Any?> {
    val now = Instant.now()
    return mutableMapOf<String, Any?>(
        (spec.startField ?: "start") to now.toString(),
        (spec.endField ?: "end") to now.plusSeconds(3_600).toString()
    ).apply { spec.timeZoneField?.let { this[it] = ZoneId.systemDefault().id } }
}

private fun scheduleErrorMessage(code: String): String = when (code) {
    "invalid_date" -> "Enter a valid start and end time."
    "invalid_range" -> "End time must be after start time."
    "min_duration" -> "The schedule is shorter than the minimum duration."
    "overlap" -> "This schedule overlaps another entry."
    "timezone" -> "Resolve the time-zone or daylight-saving-time value."
    else -> "The schedule is invalid."
}

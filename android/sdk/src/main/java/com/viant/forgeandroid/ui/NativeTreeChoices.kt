package com.viant.forgeandroid.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import com.viant.forgeandroid.runtime.NativeWidgetContract
import kotlinx.serialization.json.JsonElement

@Composable
internal fun NativeTreeChoices(options: List<Pair<JsonElement,String>>, selected: List<JsonElement>, separator: String, enabled: Boolean, onChange: (List<JsonElement>) -> Unit, depth: Int = 0) {
    val delimiter = separator.ifEmpty { "_" }
    val groups = options.groupBy { NativeWidgetContract.text(it.first).split(delimiter).getOrNull(depth) ?: it.second }
    groups.forEach { (label, leaves) -> key(label) {
        val branch = leaves.any { NativeWidgetContract.text(it.first).split(delimiter).size > depth + 1 }
        if (branch) {
            var expanded by remember(label) { mutableStateOf(false) }
            Column {
                TextButton(onClick = { expanded = !expanded }) { Text("${if (expanded) "−" else "+"} $label") }
                if (expanded) {
                    Row {
                        Checkbox(checked = leaves.all { selected.contains(it.first) }, enabled = enabled, onCheckedChange = { checked -> val values = leaves.map { it.first }; onChange(if (checked) (selected + values).distinct() else selected.filter { it !in values }) })
                        Text("Select all $label")
                    }
                    NativeTreeChoices(leaves, selected, delimiter, enabled, onChange, depth+1)
                }
            }
        } else leaves.forEach { option -> Row { Checkbox(checked = option.first in selected, enabled = enabled, onCheckedChange = { checked -> onChange(if (checked) (selected+option.first).distinct() else selected.filter { it != option.first }) }); Text(option.second) } }
    } }
}

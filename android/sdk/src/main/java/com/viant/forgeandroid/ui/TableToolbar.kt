package com.viant.forgeandroid.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.SelectionState
import com.viant.forgeandroid.runtime.ToolbarDef

@Composable
fun TableToolbar(runtime: ForgeRuntime, context: DataSourceContext, toolbar: ToolbarDef) {
    val selection by context.selection.flow.collectAsState(initial = SelectionState())
    val form by context.form.flow.collectAsState(initial = emptyMap())

    Row(
        modifier = Modifier
            .horizontalScroll(rememberScrollState())
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        toolbar.items.forEach { item ->
            val label = item.icon ?: item.id ?: ""
            val readonly = remember(item.on, selection, form) {
                item.on
                    .filter { it.event == "onReadonly" }
                    .any { exec -> runtime.isReadOnly(exec, context) }
            }
            Button(onClick = {
                item.on.forEach { exec ->
                    if (exec.event == "onClick") {
                        runtime.execute(exec, context, emptyMap())
                    }
                }
            }, enabled = !readonly) {
                Text(label)
            }
        }
    }
}

package com.viant.forgeandroid.ui

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.ToolbarDef

@Composable
fun TableToolbar(runtime: ForgeRuntime, context: DataSourceContext, toolbar: ToolbarDef) {
    Row(modifier = Modifier.padding(vertical = 4.dp)) {
        toolbar.items.forEach { item ->
            val label = item.icon ?: item.id ?: ""
            Button(modifier = Modifier.padding(end = 6.dp), onClick = {
                item.on.forEach { exec ->
                    runtime.execute(exec, context, emptyMap())
                }
            }) {
                Text(label)
            }
        }
    }
}

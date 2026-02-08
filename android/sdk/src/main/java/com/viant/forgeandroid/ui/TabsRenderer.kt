package com.viant.forgeandroid.ui

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.WindowContext

@Composable
fun TabsRenderer(runtime: ForgeRuntime, window: WindowContext, containers: List<ContainerDef>) {
    var index by remember { mutableStateOf(0) }
    if (containers.isEmpty()) return

    Row(modifier = Modifier.padding(vertical = 4.dp)) {
        containers.forEachIndexed { idx, c ->
            val title = c.title ?: c.id ?: "Tab${idx+1}"
            Button(modifier = Modifier.padding(end = 6.dp), onClick = { index = idx }) {
                Text(title)
            }
        }
    }

    ContainerRenderer(runtime, window, containers[index])
}

package com.viant.forgeandroid.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.padding
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.WindowContext

@Composable
fun ContainerRenderer(runtime: ForgeRuntime, window: WindowContext, container: ContainerDef) {
    Column(modifier = Modifier.padding(8.dp)) {
        container.title?.let { Text(it) }

        if (container.tabs != null && container.containers.isNotEmpty()) {
            TabsRenderer(runtime, window, container.containers)
            return@Column
        }

        if (container.table != null && container.dataSourceRef != null) {
            val dsContext = window.contextOrNull(container.dataSourceRef)
            if (dsContext != null) {
                TableRenderer(runtime, dsContext, container.table)
            }
        }

        if (container.items.isNotEmpty() && container.dataSourceRef != null) {
            val dsContext = window.contextOrNull(container.dataSourceRef)
            if (dsContext != null) {
                FormRenderer(runtime, dsContext, container.items)
            }
        }

        if (container.items.isNotEmpty() && container.dataSourceRef == null) {
            MenuListRenderer(runtime, window, container.items)
        }

        if (container.chat != null && container.dataSourceRef != null) {
            val dsContext = window.contextOrNull(container.dataSourceRef)
            if (dsContext != null) {
                ChatRenderer(runtime, dsContext, container.chat)
            }
        }

        container.containers.forEach { nested ->
            ContainerRenderer(runtime, window, nested)
        }
    }
}

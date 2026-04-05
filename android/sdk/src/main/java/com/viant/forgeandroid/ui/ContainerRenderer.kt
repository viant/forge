package com.viant.forgeandroid.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.text.font.FontWeight
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.WindowContext

@Composable
fun ContainerRenderer(runtime: ForgeRuntime, window: WindowContext, container: ContainerDef) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        container.title?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(bottom = 8.dp)
            )
        }

        if (container.tabs != null && container.containers.isNotEmpty()) {
            TabsRenderer(runtime, window, container.containers)
            return@Column
        }

        if (container.table != null && container.dataSourceRef != null) {
            val dsContext = window.contextOrNull(container.dataSourceRef)
            if (dsContext != null) {
                val rows by dsContext.collection.flow.collectAsState(initial = emptyList())
                LaunchedEffect(container.fetchData, dsContext) {
                    if (container.fetchData == true) {
                        dsContext.fetchCollection()
                    }
                }
                LaunchedEffect(container.selectFirst, rows) {
                    if (container.selectFirst == true && rows.isNotEmpty() && dsContext.peekSelection().selected == null) {
                        dsContext.toggleSelection(rows.first(), 0)
                    }
                }
                TableRenderer(runtime, dsContext, container.table)
            }
        }

        if (container.fileBrowser != null && container.dataSourceRef != null) {
            val dsContext = window.contextOrNull(container.dataSourceRef)
            if (dsContext != null) {
                LaunchedEffect(container.fetchData, dsContext) {
                    if (container.fetchData == true) {
                        dsContext.fetchCollection()
                    }
                }
                FileBrowserRenderer(runtime, dsContext, container.fileBrowser)
            }
        }

        if (container.chart != null && container.dataSourceRef != null) {
            val dsContext = window.contextOrNull(container.dataSourceRef)
            if (dsContext != null) {
                LaunchedEffect(container.fetchData, dsContext) {
                    if (container.fetchData == true) {
                        dsContext.fetchCollection()
                    }
                }
                ChartRenderer(dsContext, container.chart)
            }
        }

        if (container.editor != null && container.dataSourceRef != null) {
            val dsContext = window.contextOrNull(container.dataSourceRef)
            if (dsContext != null) {
                LaunchedEffect(container.fetchData, dsContext) {
                    if (container.fetchData == true) {
                        dsContext.fetchCollection()
                    }
                }
                EditorRenderer(dsContext, container.editor)
            }
        }

        if (container.items.isNotEmpty() && container.dataSourceRef != null) {
            val dsContext = window.contextOrNull(container.dataSourceRef)
            if (dsContext != null) {
                val rows by dsContext.collection.flow.collectAsState(initial = emptyList())
                LaunchedEffect(container.fetchData, dsContext) {
                    if (container.fetchData == true) {
                        dsContext.fetchCollection()
                    }
                }
                LaunchedEffect(container.selectFirst, rows) {
                    if (container.selectFirst == true && rows.isNotEmpty() && dsContext.peekSelection().selected == null) {
                        dsContext.toggleSelection(rows.first(), 0)
                    }
                }
                FormRenderer(runtime, dsContext, container.items)
            }
        }

        if (container.items.isNotEmpty() && container.dataSourceRef == null) {
            MenuListRenderer(runtime, window, container.items)
        }

        if (container.chat != null && container.dataSourceRef != null) {
            val dsContext = window.contextOrNull(container.dataSourceRef)
            if (dsContext != null) {
                LaunchedEffect(container.fetchData, dsContext) {
                    if (container.fetchData == true) {
                        dsContext.fetchCollection()
                    }
                }
                ChatRenderer(runtime, dsContext, container.chat)
            }
        }

        container.containers.forEach { nested ->
            ContainerRenderer(runtime, window, nested)
        }
    }
}

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
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.WindowContext

@Composable
fun ContainerRenderer(runtime: ForgeRuntime, window: WindowContext, container: ContainerDef) {
    val kind = container.kind?.trim().orEmpty()
    if (kind == "dashboard" || kind.startsWith("dashboard.")) {
        DashboardRenderer(runtime, window, container)
        return
    }

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
        container.subtitle?.takeIf { it.isNotBlank() }?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(bottom = 8.dp)
            )
        }

        if (container.toolbar != null && container.dataSourceRef != null) {
            WithContainerDataSource(
                window = window,
                dataSourceRef = container.dataSourceRef
            ) { toolbarContext ->
                TableToolbar(runtime, toolbarContext, container.toolbar)
            }
        }

        if (container.tabs != null && container.containers.isNotEmpty()) {
            TabsRenderer(runtime, window, container.containers)
            return@Column
        }

        if (container.schemaBasedForm != null) {
            val dsRef = container.schemaBasedForm.dataSourceRef
                ?: container.schemaBasedForm.datasourceRef
                ?: container.dataSourceRef
            val dsContext = dsRef?.let(window::contextOrNull)
            if (dsContext != null) {
                SchemaBasedFormRenderer(runtime, dsContext, container)
                return@Column
            }
        }

        if (container.table != null && container.dataSourceRef != null) {
            WithContainerDataSource(
                window = window,
                dataSourceRef = container.dataSourceRef,
                fetchData = container.fetchData,
                selectFirst = container.selectFirst
            ) { dsContext ->
                TableRenderer(runtime, dsContext, container.table)
            }
        }

        if (container.fileBrowser != null && container.dataSourceRef != null) {
            WithContainerDataSource(
                window = window,
                dataSourceRef = container.dataSourceRef,
                fetchData = container.fetchData
            ) { dsContext ->
                FileBrowserRenderer(runtime, dsContext, container.fileBrowser)
            }
        }

        if (container.chart != null && container.dataSourceRef != null) {
            WithContainerDataSource(
                window = window,
                dataSourceRef = container.dataSourceRef,
                fetchData = container.fetchData
            ) { dsContext ->
                ChartRenderer(dsContext, container.chart)
            }
        }

        if (container.editor != null && container.dataSourceRef != null) {
            WithContainerDataSource(
                window = window,
                dataSourceRef = container.dataSourceRef,
                fetchData = container.fetchData
            ) { dsContext ->
                EditorRenderer(dsContext, container.editor)
            }
        }

        if (container.terminal != null) {
            val dsRef = container.terminal.dataSourceRef ?: container.dataSourceRef
            WithContainerDataSource(
                window = window,
                dataSourceRef = dsRef,
                fetchData = container.fetchData
            ) { dsContext ->
                TerminalRenderer(runtime, dsContext, container.terminal)
            }
        }

        if (container.items.isNotEmpty() && container.dataSourceRef != null) {
            WithContainerDataSource(
                window = window,
                dataSourceRef = container.dataSourceRef,
                fetchData = container.fetchData,
                selectFirst = container.selectFirst
            ) { dsContext ->
                FormRenderer(runtime, dsContext, container.items)
            }
        }

        if (container.items.isNotEmpty() && container.dataSourceRef == null) {
            MenuListRenderer(runtime, window, container.items)
        }

        if (container.chat != null && container.dataSourceRef != null) {
            WithContainerDataSource(
                window = window,
                dataSourceRef = container.dataSourceRef,
                fetchData = container.fetchData
            ) { dsContext ->
                ChatRenderer(runtime, dsContext, container.chat)
            }
        }

        container.containers.forEach { nested ->
            ContainerRenderer(runtime, window, nested)
        }
    }
}

@Composable
private fun WithContainerDataSource(
    window: WindowContext,
    dataSourceRef: String?,
    fetchData: Boolean? = null,
    selectFirst: Boolean? = null,
    content: @Composable (DataSourceContext) -> Unit
) {
    val dsContext = dataSourceRef?.let(window::contextOrNull) ?: return
    val rows by dsContext.collection.flow.collectAsState(initial = emptyList())

    LaunchedEffect(fetchData, dsContext) {
        if (fetchData == true) {
            dsContext.fetchCollection()
        }
    }
    LaunchedEffect(selectFirst, rows, dsContext) {
        if (selectFirst == true && rows.isNotEmpty() && dsContext.peekSelection().selected == null) {
            dsContext.toggleSelection(rows.first(), 0)
        }
    }
    content(dsContext)
}

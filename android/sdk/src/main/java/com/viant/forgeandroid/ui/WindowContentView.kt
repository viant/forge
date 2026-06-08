package com.viant.forgeandroid.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.Icons
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.WindowMetadata
import kotlinx.coroutines.launch

@Composable
fun WindowContentView(
    runtime: ForgeRuntime,
    windowId: String,
    windowKey: String,
    modifier: Modifier = Modifier,
    scrollEnabled: Boolean = true,
    showWindowHeader: Boolean = true,
    canGoBack: Boolean = false,
    onBack: (() -> Unit)? = null
) {
    val metadataSignal = runtime.metadataSignal(windowId)
    val metadata by metadataSignal.flow.collectAsState(initial = metadataSignal.peek())

    key(windowId, metadata != null) {
        val resolvedMetadata = metadata
        if (resolvedMetadata == null) {
            Text("Loading $windowKey...", modifier = Modifier.padding(16.dp))
        } else {
            WindowContentBody(
                runtime = runtime,
                windowId = windowId,
                windowKey = windowKey,
                metadata = resolvedMetadata,
                modifier = modifier,
                scrollEnabled = scrollEnabled,
                showWindowHeader = showWindowHeader,
                canGoBack = canGoBack,
                onBack = onBack
            )
        }
    }
}

@Composable
private fun WindowContentBody(
    runtime: ForgeRuntime,
    windowId: String,
    windowKey: String,
    metadata: WindowMetadata,
    modifier: Modifier = Modifier,
    scrollEnabled: Boolean = true,
    showWindowHeader: Boolean = true,
    canGoBack: Boolean = false,
    onBack: (() -> Unit)? = null
) {
    val view = metadata.view
    val containers = view?.content?.containers ?: emptyList()
    val context = runtime.windowContext(windowId)
    val defaultDataSourceContext = remember(windowId, metadata) {
        val dataSourceRef = containers.firstOrNull { !it.dataSourceRef.isNullOrBlank() }?.dataSourceRef
            ?: metadata.dataSources.keys.firstOrNull()
        dataSourceRef?.takeIf { it.isNotBlank() }?.let(context::contextOrNull)
    }
    val inheritedDataSourceRef = defaultDataSourceContext?.dataSourceRef

    LaunchedEffect(windowId, metadata) {
        metadata.on.filter { it.event == "onInit" }.forEach {
            runtime.execute(it, defaultDataSourceContext, mapOf("windowId" to windowId))
        }
        metadata.window?.on?.filter { it.event == "onInit" }?.forEach {
            runtime.execute(it, defaultDataSourceContext, mapOf("windowId" to windowId))
        }
    }

    DisposableEffect(windowId, metadata) {
        onDispose {
            metadata.on.filter { it.event == "onDestroy" }.forEach {
                runtime.execute(it, defaultDataSourceContext, mapOf("windowId" to windowId))
            }
            metadata.window?.on?.filter { it.event == "onDestroy" }?.forEach {
                runtime.execute(it, defaultDataSourceContext, mapOf("windowId" to windowId))
            }
        }
    }

    Column(modifier = modifier.fillMaxSize()) {
        if (showWindowHeader) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.Start
            ) {
                IconButton(onClick = { onBack?.invoke() }) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = if (canGoBack) MaterialTheme.colorScheme.onSurface else Color.Transparent
                    )
                }
                Text(
                    text = metadata.namespace ?: windowKey,
                    fontWeight = FontWeight.SemiBold,
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(start = 4.dp, top = 10.dp)
                )
            }
            HorizontalDivider()
        }
        if (scrollEnabled) {
            BoxWithConstraints(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f, fill = true)
            ) {
                val contentLayout = view?.content?.layout
                val useSplit = contentLayout?.kind?.equals("split", ignoreCase = true) == true &&
                    contentLayout.orientation?.equals("horizontal", ignoreCase = true) == true &&
                    containers.size >= 2 &&
                    maxWidth >= 720.dp
                if (useSplit) {
                    val spacing = 16.dp
                    val fractions = splitFractions(containers.size)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .fillMaxHeight(),
                        horizontalArrangement = Arrangement.spacedBy(spacing)
                    ) {
                        containers.forEachIndexed { index, container ->
                            val paneModifier = Modifier
                                .weight(fractions.getOrElse(index) { 1f / containers.size.toFloat() })
                                .fillMaxHeight()
                            if (containerOwnsScrollSpace(container)) {
                                Column(modifier = paneModifier) {
                                    ContainerRenderer(
                                        runtime,
                                        context,
                                        container,
                                        selectionModeOverride = null,
                                        inheritedDataSourceRef = container.dataSourceRef?.takeIf { it.isNotBlank() } ?: inheritedDataSourceRef,
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                }
                            } else {
                                val paneScrollState = remember(windowId, container.id) { ScrollState(0) }
                                val scope = rememberCoroutineScope()
                                LaunchedEffect(windowId, container.id) {
                                    scope.launch { paneScrollState.scrollTo(0) }
                                }
                                Column(
                                    modifier = paneModifier.verticalScroll(paneScrollState)
                                ) {
                                    ContainerRenderer(
                                        runtime,
                                        context,
                                        container,
                                        selectionModeOverride = null,
                                        inheritedDataSourceRef = container.dataSourceRef?.takeIf { it.isNotBlank() } ?: inheritedDataSourceRef,
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                }
                            }
                        }
                    }
                } else {
                    if (containers.any(::containerOwnsScrollSpace)) {
                        Column(modifier = Modifier.fillMaxWidth()) {
                            containers.forEach { container ->
                                ContainerRenderer(
                                    runtime,
                                    context,
                                    container,
                                    inheritedDataSourceRef = container.dataSourceRef?.takeIf { it.isNotBlank() } ?: inheritedDataSourceRef
                                )
                            }
                        }
                    } else {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .verticalScroll(rememberScrollState())
                        ) {
                            containers.forEach { container ->
                                ContainerRenderer(
                                    runtime,
                                    context,
                                    container,
                                    inheritedDataSourceRef = container.dataSourceRef?.takeIf { it.isNotBlank() } ?: inheritedDataSourceRef
                                )
                            }
                        }
                    }
                }
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f, fill = false)
                    .padding(bottom = 8.dp)
            ) {
                containers.forEach { container ->
                    ContainerRenderer(
                        runtime,
                        context,
                        container,
                        inheritedDataSourceRef = container.dataSourceRef?.takeIf { it.isNotBlank() } ?: inheritedDataSourceRef
                    )
                }
            }
        }
    }

    DialogRenderer(runtime, context, metadata.dialogs)
}

private fun splitFractions(count: Int): List<Float> {
    if (count <= 0) return emptyList()
    if (count == 2) return listOf(0.56f, 0.44f)
    val even = 1f / count.toFloat()
    return List(count) { even }
}

private fun containerOwnsScrollSpace(container: com.viant.forgeandroid.runtime.ContainerDef): Boolean {
    val mode = (container.scrollMode ?: "").trim().lowercase()
    if (mode == "self" || mode == "content") {
        return true
    }
    return container.containers.any(::containerOwnsScrollSpace)
}

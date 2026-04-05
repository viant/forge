package com.viant.forgeandroid.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.ForgeRuntime

@Composable
fun WindowContentView(
    runtime: ForgeRuntime,
    windowId: String,
    windowKey: String,
    canGoBack: Boolean = false,
    onBack: (() -> Unit)? = null
) {
    val metadataSignal = runtime.metadataSignal(windowId)
    val metadata by metadataSignal.flow.collectAsState(initial = null)

    if (metadata == null) {
        Text("Loading $windowKey...", modifier = Modifier.padding(16.dp))
        return
    }

    val view = metadata?.view
    val containers = view?.content?.containers ?: emptyList()
    val context = runtime.windowContext(windowId)

    LaunchedEffect(windowId, metadata) {
        metadata?.on?.filter { it.event == "onInit" }?.forEach { runtime.execute(it, null, mapOf("windowId" to windowId)) }
        metadata?.window?.on?.filter { it.event == "onInit" }?.forEach { runtime.execute(it, null, mapOf("windowId" to windowId)) }
    }

    DisposableEffect(windowId, metadata) {
        onDispose {
            metadata?.on?.filter { it.event == "onDestroy" }?.forEach { runtime.execute(it, null, mapOf("windowId" to windowId)) }
            metadata?.window?.on?.filter { it.event == "onDestroy" }?.forEach { runtime.execute(it, null, mapOf("windowId" to windowId)) }
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        if (canGoBack || windowKey != "chat") {
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
                    text = metadata?.namespace ?: windowKey,
                    fontWeight = FontWeight.SemiBold,
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(start = 4.dp, top = 10.dp)
                )
            }
            HorizontalDivider()
        }
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f, fill = true)
                .verticalScroll(rememberScrollState())
        ) {
            containers.forEach { container ->
                ContainerRenderer(runtime, context, container)
            }
        }
    }

    DialogRenderer(runtime, context, metadata?.dialogs.orEmpty())
}

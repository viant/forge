package com.viant.forgeandroid.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
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

    Column(modifier = Modifier.fillMaxSize()) {
        if (canGoBack && windowKey != "chat") {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.Start
            ) {
                IconButton(onClick = { onBack?.invoke() }) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                }
                Text(
                    text = metadata?.namespace ?: windowKey,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(start = 4.dp, top = 10.dp)
                )
            }
        }
        containers.forEach { container ->
            ContainerRenderer(runtime, context, container)
        }
    }

    DialogRenderer(runtime, context, metadata?.dialogs.orEmpty())
}

package com.viant.forgeandroid.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.ForgeRuntime

@Composable
fun ForgeRoot(runtime: ForgeRuntime) {
    val windows by runtime.windows.collectAsState(initial = emptyList())
    var selectedWindowId by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(windows.map { it.windowId }) {
        if (windows.isNotEmpty()) {
            selectedWindowId = windows.last().windowId
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        // Hide window tabs for the iOS-style chat UI parity.
        val selected = windows.firstOrNull { it.windowId == selectedWindowId }
        if (selected == null) {
            Text("No windows", modifier = Modifier.padding(16.dp))
        } else {
            WindowContentView(
                runtime = runtime,
                windowId = selected.windowId,
                windowKey = selected.windowKey,
                canGoBack = windows.size > 1,
                onBack = { runtime.closeWindow(selected.windowId) }
            )
        }
    }
}

package com.viant.forgeandroid.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
fun TabsRenderer(runtime: ForgeRuntime, window: WindowContext, container: ContainerDef) {
    val containers = container.containers
    if (containers.isEmpty()) return

    val initialIndex = resolveInitialTabIndex(container)
    var index by remember(container.id, initialIndex) { mutableStateOf(initialIndex) }
    val currentIndex = index.coerceIn(0, containers.lastIndex)
    val currentContainer = containers[currentIndex]
    val tabStyle = container.tabs?.style?.trim()?.lowercase().orEmpty()

    if (tabStyle == "menu" || tabStyle == "dropdown" || tabStyle == "picker") {
        var expanded by remember(container.id) { mutableStateOf(false) }
        Column(modifier = Modifier.fillMaxWidth()) {
            Box {
                OutlinedButton(
                    onClick = { expanded = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(currentContainer.title ?: currentContainer.id ?: "Tab")
                        Icon(Icons.Filled.ArrowDropDown, contentDescription = "Choose tab")
                    }
                }
                DropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    containers.forEachIndexed { idx, child ->
                        DropdownMenuItem(
                            text = { Text(child.title ?: child.id ?: "Tab${idx + 1}") },
                            onClick = {
                                index = idx
                                expanded = false
                            }
                        )
                    }
                }
            }
            ContainerRenderer(
                runtime,
                window,
                currentContainer,
                suppressTitle = true
            )
        }
        return
    }

    Row(
        modifier = Modifier
            .horizontalScroll(rememberScrollState())
            .padding(vertical = 4.dp)
    ) {
        containers.forEachIndexed { idx, c ->
            val title = c.title ?: c.id ?: "Tab${idx + 1}"
            FilterChip(
                selected = idx == currentIndex,
                onClick = { index = idx },
                label = { Text(title) },
                modifier = Modifier.padding(end = 6.dp),
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer
                )
            )
        }
    }

    ContainerRenderer(
        runtime,
        window,
        currentContainer,
        suppressTitle = true
    )
    
}

private fun resolveInitialTabIndex(container: ContainerDef): Int {
    val requestedId = container.tabs?.selectedTabId?.ifBlank {
        container.tabs?.defaultSelectedTabId
    }?.trim()
    if (requestedId.isNullOrEmpty()) {
        return 0
    }
    return container.containers.indexOfFirst { it.id == requestedId }.takeIf { it >= 0 } ?: 0
}

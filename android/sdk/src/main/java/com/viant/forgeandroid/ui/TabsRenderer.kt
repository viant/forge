package com.viant.forgeandroid.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.key
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.WindowContext

@Composable
fun TabsRenderer(runtime: ForgeRuntime, window: WindowContext, container: ContainerDef) {
    val containers = container.containers
    if (containers.isEmpty()) return

    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        val compactPages = remember(container) { mobileTabPages(container) }
        val tabStyle = container.tabs?.style?.trim()?.lowercase().orEmpty()
        if (maxWidth < 600.dp && tabStyle !in setOf("menu", "dropdown", "picker") && compactPages.isNotEmpty()) {
            MobileTabPagesRenderer(runtime, window, container, compactPages)
        } else {
            StandardTabsRenderer(runtime, window, container)
        }
    }
}

internal data class MobileTabPage(
    val id: String,
    val title: String,
    val container: ContainerDef
)

internal fun mobileTabPages(container: ContainerDef): List<MobileTabPage> =
    container.containers.flatMap { child ->
        if (child.tabs != null && child.containers.isNotEmpty()) {
            child.containers.mapIndexed { index, nested ->
                MobileTabPage(
                    id = nested.id ?: "${child.id ?: "tab"}-$index",
                    title = nested.title ?: child.title ?: "Tab ${index + 1}",
                    container = nested
                )
            }
        } else {
            listOf(MobileTabPage(
                id = child.id ?: "tab-${container.containers.indexOf(child)}",
                title = child.title ?: "Tab ${container.containers.indexOf(child) + 1}",
                container = child
            ))
        }
    }

private fun initialMobileTabPageIndex(container: ContainerDef, pages: List<MobileTabPage>): Int {
    val topLevel = container.containers.getOrNull(resolveInitialTabIndex(container)) ?: return 0
    val requestedId = if (topLevel.tabs != null && topLevel.containers.isNotEmpty()) {
        topLevel.containers.getOrNull(resolveInitialTabIndex(topLevel))?.id
    } else {
        topLevel.id
    }
    return pages.indexOfFirst { it.id == requestedId }.takeIf { it >= 0 } ?: 0
}

@Composable
private fun MobileTabPagesRenderer(
    runtime: ForgeRuntime,
    window: WindowContext,
    container: ContainerDef,
    pages: List<MobileTabPage>
) {
    val initialIndex = initialMobileTabPageIndex(container, pages)
    var index by remember(container.id, initialIndex) { mutableStateOf(initialIndex) }
    val currentIndex = index.coerceIn(0, pages.lastIndex)
    val currentPage = pages[currentIndex]
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            pages.forEachIndexed { pageIndex, page ->
                val selected = pageIndex == currentIndex
                FilterChip(
                    selected = selected,
                    onClick = { index = pageIndex },
                    label = { Text(page.title) },
                    border = BorderStroke(
                        1.dp,
                        if (selected) ReportTabSelectedBorderColor else Color.Transparent
                    ),
                    colors = reportTabChipColors()
                )
            }
        }
        key(currentPage.id) {
            ContainerRenderer(
                runtime = runtime,
                window = window,
                container = currentPage.container,
                suppressTitle = true,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun StandardTabsRenderer(runtime: ForgeRuntime, window: WindowContext, container: ContainerDef) {
    val containers = container.containers

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

    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Surface(
            color = ReportTabStripColor,
            border = BorderStroke(1.dp, ReportTabStripBorderColor),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .horizontalScroll(rememberScrollState())
                    .padding(4.dp)
            ) {
                containers.forEachIndexed { idx, c ->
                    val title = c.title ?: c.id ?: "Tab${idx + 1}"
                    val selected = idx == currentIndex
                    FilterChip(
                        selected = selected,
                        onClick = { index = idx },
                        label = { Text(title) },
                        modifier = Modifier.padding(end = 6.dp),
                        border = BorderStroke(
                            1.dp,
                            if (selected) ReportTabSelectedBorderColor else Color.Transparent
                        ),
                        colors = reportTabChipColors()
                    )
                }
            }
        }

        key(currentContainer.id ?: currentIndex) {
            ContainerRenderer(
                runtime,
                window,
                currentContainer,
                suppressTitle = true
            )
        }
    }
}

@Composable
internal fun reportTabChipColors() = FilterChipDefaults.filterChipColors(
    containerColor = Color.Transparent,
    labelColor = ReportTabLabelColor,
    selectedContainerColor = ReportTabSelectedColor,
    selectedLabelColor = ReportTabSelectedLabelColor
)

internal val ReportTabStripColor = Color(0xFFF5F8FB)
internal val ReportTabStripBorderColor = Color(0xFFDBE5EC)
internal val ReportTabSelectedColor = Color(0xFFFFFFFF)
internal val ReportTabSelectedBorderColor = Color(0xFF93C5FD)
internal val ReportTabSelectedLabelColor = Color(0xFF1D4ED8)
internal val ReportTabLabelColor = Color(0xFF486579)

private fun resolveInitialTabIndex(container: ContainerDef): Int {
    val requestedId = container.tabs?.selectedTabId?.ifBlank {
        container.tabs?.defaultSelectedTabId
    }?.trim()
    if (requestedId.isNullOrEmpty()) {
        return 0
    }
    return container.containers.indexOfFirst { it.id == requestedId }.takeIf { it >= 0 } ?: 0
}

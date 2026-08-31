package com.viant.forgeandroid.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.text.font.FontWeight
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
        val presentation = container.tabs?.presentation?.trim()?.lowercase().orEmpty()
        if (presentation in setOf("views", "pages", "stack") && compactPages.isNotEmpty()) {
            MobileTabViewStackRenderer(runtime, window, container, compactPages)
        } else if (maxWidth < 600.dp && tabStyle !in setOf("menu", "dropdown", "picker") && compactPages.isNotEmpty()) {
            MobileTabPagesRenderer(runtime, window, container, compactPages)
        } else {
            StandardTabsRenderer(runtime, window, container)
        }
    }
}

@Composable
private fun MobileTabViewStackRenderer(
    runtime: ForgeRuntime,
    window: WindowContext,
    container: ContainerDef,
    pages: List<MobileTabPage>
) {
    val initialIndex = initialMobileTabPageIndex(container, pages)
    var selectedPageId by remember(container.id, pages.map { it.id }) {
        mutableStateOf(pages[initialIndex.coerceIn(0, pages.lastIndex)].id)
    }
    val selectedPage = pages.firstOrNull { it.id == selectedPageId } ?: pages.first()

    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        CompactSectionNavigator(
            entries = pages.map { it.id to it.title },
            selectedId = selectedPage.id,
            onSelect = { selectedId ->
                selectedPageId = selectedId
                pages.indexOfFirst { it.id == selectedId }.takeIf { it >= 0 }?.let { selectedIndex ->
                    emitTabInteraction(runtime, window, container, pages[selectedIndex].id, pages[selectedIndex].title, selectedIndex)
                }
            },
            fallbackLabel = "Section",
            chooserContentDescription = "Choose section"
        )
        if (container.toolbar?.placement.equals("afterNavigation", ignoreCase = true)) {
            container.dataSourceRef?.let(window::contextOrNull)?.let { context ->
                TableToolbar(runtime, context, container.toolbar!!)
            }
        }
        key(selectedPage.id) {
            ContainerRenderer(
                runtime = runtime,
                window = window,
                container = selectedPage.container,
                suppressTitle = true,
                modifier = Modifier.fillMaxWidth()
            )
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
        if (pages.size > 3) {
            CompactSectionNavigator(
                entries = pages.map { it.id to it.title },
                selectedId = currentPage.id,
                onSelect = { selectedId ->
                    pages.indexOfFirst { it.id == selectedId }.takeIf { it >= 0 }?.let {
                        index = it
                        emitTabInteraction(runtime, window, container, pages[it].id, pages[it].title, it)
                    }
                },
                fallbackLabel = "Section",
                chooserContentDescription = "Choose feed section"
            )
        } else {
            SectionTabRail(
                items = pages.map { SectionTabItem(it.id, it.title) },
                selectedId = currentPage.id,
                onSelect = { selectedId ->
                    pages.indexOfFirst { it.id == selectedId }.takeIf { it >= 0 }?.let {
                        index = it
                        emitTabInteraction(runtime, window, container, pages[it].id, pages[it].title, it)
                    }
                }
            )
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
                                emitTabInteraction(
                                    runtime,
                                    window,
                                    container,
                                    child.id ?: "tab-$idx",
                                    child.title ?: child.id ?: "Tab${idx + 1}",
                                    idx
                                )
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
        SectionTabRail(
            items = containers.mapIndexed { idx, c ->
                SectionTabItem(c.id ?: "tab-$idx", c.title ?: c.id ?: "Tab${idx + 1}")
            },
            selectedId = currentContainer.id ?: "tab-$currentIndex",
            onSelect = { selectedId ->
                containers.indexOfFirst { (it.id ?: "tab-${containers.indexOf(it)}") == selectedId }
                    .takeIf { it >= 0 }
                    ?.let {
                        index = it
                        emitTabInteraction(
                            runtime,
                            window,
                            container,
                            containers[it].id ?: "tab-$it",
                            containers[it].title ?: containers[it].id ?: "Tab${it + 1}",
                            it
                        )
                    }
            }
        )

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

private fun emitTabInteraction(
    runtime: ForgeRuntime,
    window: WindowContext,
    container: ContainerDef,
    tabId: String,
    tabTitle: String,
    tabIndex: Int
) {
    runtime.emitInteraction(
        kind = "feed.tab_changed",
        windowId = window.windowId,
        dataSourceRef = container.dataSourceRef,
        detail = mapOf(
            "containerId" to container.id,
            "tabId" to tabId,
            "tabTitle" to tabTitle,
            "tabIndex" to tabIndex
        )
    )
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

package com.viant.forgeandroid.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.AssistChip
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.FilterSetDef
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.JsonUtil
import com.viant.forgeandroid.runtime.SelectionState
import com.viant.forgeandroid.runtime.ToolbarDef
import com.viant.forgeandroid.runtime.ToolbarItemDef
import kotlinx.coroutines.delay
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

@Composable
fun TableToolbar(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    toolbar: ToolbarDef,
    hiddenItemIds: Set<String> = emptySet()
) {
    val items = toolbar.items.filterNot { it.id in hiddenItemIds || it.type == "pagination" || it.id == "pagination" }
    val left = items.filter { it.align?.lowercase() == "left" }
    val center = items.filter { it.align?.lowercase() == "center" }
    val right = items.filter { it.align?.lowercase() !in setOf("left", "center") }
    val compactPadding = if (toolbar.density.equals("compact", ignoreCase = true)) 2.dp else 4.dp
    val itemSpacing = toolbarStyleDp(toolbar, "gap") ?: 6.dp
    val itemSize = toolbarStyleDp(toolbar, "itemSize")
    val compactPresentation = LocalForgePresentationDensity.current == ForgePresentationDensity.Compact

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = compactPadding)
    ) {
        val compact = maxWidth < 600.dp
        if (compactPresentation) {
            ToolbarGroup(runtime, context, items, spacing = itemSpacing, actionSize = itemSize)
        } else if (compact && center.isNotEmpty()) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    ToolbarGroup(runtime, context, left, spacing = itemSpacing, actionSize = itemSize)
                    ToolbarGroup(runtime, context, right, spacing = itemSpacing, actionSize = itemSize)
                }
                ToolbarGroup(runtime, context, center, Modifier.fillMaxWidth(), itemSpacing, itemSize)
            }
        } else {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                ToolbarGroup(runtime, context, left, spacing = itemSpacing, actionSize = itemSize)
                Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    ToolbarGroup(runtime, context, center, spacing = itemSpacing, actionSize = itemSize)
                }
                ToolbarGroup(runtime, context, right, spacing = itemSpacing, actionSize = itemSize)
            }
        }
    }
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun ToolbarGroup(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    items: List<ToolbarItemDef>,
    modifier: Modifier = Modifier,
    spacing: Dp = 6.dp,
    actionSize: Dp? = null
) {
    val compactPresentation = LocalForgePresentationDensity.current == ForgePresentationDensity.Compact
    if (compactPresentation) {
        FlowRow(
            modifier = modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(spacing),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            items.forEach { item ->
                when {
                    item.id == "quickFilter" || item.id == "quickFilterInputs" -> QuickFilter(context, item)
                    item.on.any { it.event == "onClick" } -> ToolbarAction(runtime, context, item, actionSize)
                }
            }
        }
    } else {
        Row(
            modifier = modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(spacing),
            verticalAlignment = Alignment.CenterVertically
        ) {
            items.forEach { item ->
                when {
                    item.id == "quickFilter" || item.id == "quickFilterInputs" -> QuickFilter(context, item)
                    item.on.any { it.event == "onClick" } -> ToolbarAction(runtime, context, item, actionSize)
                }
            }
        }
    }
}

@Composable
private fun ToolbarAction(runtime: ForgeRuntime, context: DataSourceContext, item: ToolbarItemDef, sizeOverride: Dp?) {
    val selection by context.selection.flow.collectAsState(initial = SelectionState())
    val form by context.form.flow.collectAsState(initial = context.form.peek())
    val windowForm by context.window.windowFormSignal().flow.collectAsState(initial = context.window.peekWindowForm())
    val collection by context.collection.flow.collectAsState(initial = context.collection.peek())
    val input by context.input.flow.collectAsState(initial = context.input.peek())
    val visibleExecutions = item.on.filter { it.event == "onVisible" }
    val readonlyExecutions = item.on.filter { it.event == "onReadonly" }

    val visible by produceState(
        initialValue = visibleExecutions.isEmpty(),
        item,
        selection,
        form,
        windowForm,
        collection,
        input
    ) {
        value = visibleExecutions.all { execution ->
            runtime.evaluate(execution, context, toolbarEventArgs(item)) as? Boolean ?: true
        }
    }
    if (!visible) return

    val readonly by produceState(
        initialValue = readonlyExecutions.any { runtime.isReadOnly(it, context) },
        item,
        selection,
        form,
        windowForm,
        collection,
        input
    ) {
        value = readonlyExecutions.any { execution ->
            if (runtime.isReadOnly(execution, context)) true
            else runtime.evaluate(execution, context, toolbarEventArgs(item)) as? Boolean ?: false
        }
    }
    val onClick = {
        item.on.filter { it.event == "onClick" }.forEach { execution ->
            runtime.execute(execution, context, toolbarEventArgs(item))
        }
    }
    val description = item.ariaLabel ?: item.tooltip ?: item.label ?: item.id ?: "Action"
    val icon = toolbarIcon(item.icon)
    if (icon != null && item.label.isNullOrBlank()) {
        val size = sizeOverride ?: styleDp(item, "width") ?: 40.dp
        val background = styleColor(item, "backgroundColor") ?: Color.Transparent
        val foreground = styleColor(item, "color") ?: MaterialTheme.colorScheme.primary
        val border = styleColor(item, "borderColor")
        Box(
            modifier = Modifier
                .size(size)
                .alpha(if (readonly) 0.45f else 1f)
                .background(background, CircleShape)
                .then(if (border != null) Modifier.border(1.dp, border, CircleShape) else Modifier),
            contentAlignment = Alignment.Center
        ) {
            IconButton(
                onClick = onClick,
                enabled = !readonly,
                modifier = Modifier
                    .size(size)
                    .semantics { contentDescription = description }
            ) {
                Icon(icon, contentDescription = null, tint = foreground, modifier = Modifier.size(20.dp))
            }
        }
    } else {
        val label = item.label ?: item.icon ?: item.id ?: "Action"
        val compactPresentation = LocalForgePresentationDensity.current == ForgePresentationDensity.Compact
        if (compactPresentation) {
            AssistChip(
                onClick = onClick,
                enabled = !readonly,
                label = { Text(label, maxLines = 1) },
                leadingIcon = icon?.let { image -> { Icon(image, contentDescription = null, modifier = Modifier.size(18.dp)) } }
            )
        } else if (item.appearance == "minimal") {
            TextButton(onClick = onClick, enabled = !readonly) { Text(label) }
        } else {
            OutlinedButton(onClick = onClick, enabled = !readonly) { Text(label, maxLines = 1) }
        }
    }
}

@Composable
private fun QuickFilter(context: DataSourceContext, item: ToolbarItemDef) {
    val input by context.input.flow.collectAsState(initial = context.input.peek())
    val filterSet = quickFilterSet(context)
    val field = filterSet?.defaultField?.takeIf { it.isNotBlank() }
        ?: filterSet?.template?.firstOrNull()?.id?.takeIf { !it.isNullOrBlank() }
        ?: "name"
    val definition = filterSet?.template?.firstOrNull { it.id == field } ?: filterSet?.template?.firstOrNull()
    var text by remember(field) { mutableStateOf(input.filter[field]?.toString().orEmpty()) }
    LaunchedEffect(input.filter, field) {
        val external = input.filter[field]?.toString().orEmpty()
        if (external != text) text = external
    }
    LaunchedEffect(text, field) {
        delay(300)
        val current = context.peekFilter()
        val next = current.toMutableMap()
        if (text.isBlank()) next.remove(field) else next[field] = text
        if (next != current) context.setFilter(next)
    }
    OutlinedTextField(
        value = text,
        onValueChange = { text = it },
        singleLine = true,
        placeholder = { Text(item.placeholder ?: definition?.placeholder ?: definition?.label ?: "Filter") },
        trailingIcon = { Icon(Icons.Default.Search, contentDescription = "Apply filter") },
        modifier = Modifier.fillMaxWidth()
    )
}

private fun quickFilterSet(context: DataSourceContext): FilterSetDef? {
    val name = context.dataSource.quickFilterSet
    return context.dataSource.filterSet.firstOrNull { it.name == name }
        ?: context.dataSource.filterSet.firstOrNull { it.default == true }
        ?: context.dataSource.filterSet.firstOrNull()
}

private fun toolbarEventArgs(item: ToolbarItemDef): Map<String, Any?> = mapOf("item" to item)

private fun toolbarIcon(name: String?): ImageVector? = when (name?.trim()?.lowercase()) {
    "refresh" -> Icons.Default.Refresh
    "plus", "add", "new-object" -> Icons.Default.Add
    "edit" -> Icons.Default.Edit
    "play", "run" -> Icons.Default.PlayArrow
    "trash", "delete" -> Icons.Default.Delete
    "arrow-left", "back" -> Icons.AutoMirrored.Filled.ArrowBack
    "floppy-disk", "save" -> Icons.Default.Save
    "history", "time" -> Icons.Default.History
    "pdf", "document-pdf", "print" -> Icons.Default.PictureAsPdf
    else -> null
}

private fun styleColor(item: ToolbarItemDef, key: String): Color? {
    val raw = (item.style[key] as? JsonPrimitive)?.contentOrNull?.trim().orEmpty()
    if (!raw.startsWith("#")) return null
    val hex = raw.removePrefix("#")
    val value = hex.toLongOrNull(16) ?: return null
    return when (hex.length) {
        6 -> Color(0xFF000000 or value)
        8 -> Color(value)
        else -> null
    }
}

private fun styleDp(item: ToolbarItemDef, key: String): Dp? {
    val raw = item.style[key] ?: return null
    val value = when (raw) {
        is JsonPrimitive -> raw.contentOrNull?.removeSuffix("px")?.trim()?.toFloatOrNull()
        else -> JsonUtil.elementToAny(raw)?.toString()?.removeSuffix("px")?.trim()?.toFloatOrNull()
    } ?: return null
    return value.dp
}

private fun toolbarStyleDp(toolbar: ToolbarDef, key: String): Dp? {
    val raw = toolbar.style[key] as? JsonPrimitive ?: return null
    return raw.contentOrNull?.removeSuffix("px")?.trim()?.toFloatOrNull()?.dp
}

internal fun actionableToolbarItems(toolbar: ToolbarDef) = toolbar.items.filter { item ->
    item.on.any { execution -> execution.event == "onClick" }
}

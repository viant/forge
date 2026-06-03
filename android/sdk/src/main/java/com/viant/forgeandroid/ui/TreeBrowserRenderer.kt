package com.viant.forgeandroid.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.JsonUtil
import com.viant.forgeandroid.runtime.SelectionState
import com.viant.forgeandroid.runtime.SelectorUtil
import com.viant.forgeandroid.runtime.TreeBrowserDef
import kotlinx.coroutines.launch

@Composable
fun TreeBrowserRenderer(
    dsContext: DataSourceContext,
    treeBrowser: TreeBrowserDef,
    selectionModeOverride: String? = null
) {
    val rows by dsContext.collection.flow.collectAsState(initial = emptyList())
    val selection by dsContext.selection.flow.collectAsState(initial = dsContext.peekSelection())
    val control by dsContext.control.flow.collectAsState(initial = dsContext.control.peek())
    val scope = rememberCoroutineScope()
    val nodes = remember(rows, treeBrowser) { buildTreeBrowserNodes(rows, treeBrowser) }
    var expandedNodeIds by remember { mutableStateOf(setOf<String>()) }

    LaunchedEffect(nodes) {
        if (expandedNodeIds.isEmpty()) {
            expandedNodeIds = nodes.filter { !it.isLeaf }.map { it.id }.toSet()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = 360.dp)
            .verticalScroll(rememberScrollState())
    ) {
        treeBrowser.title?.takeIf { it.isNotBlank() }?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(bottom = 8.dp)
            )
        }

        when {
            control.loading && nodes.isEmpty() -> {
                Text("Loading...", style = MaterialTheme.typography.bodyMedium)
            }
            !control.error.isNullOrBlank() && nodes.isEmpty() -> {
                Text(
                    text = control.error ?: "Unknown error",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error
                )
            }
            nodes.isEmpty() -> {
                Text("No tree data", style = MaterialTheme.typography.bodyMedium)
            }
            else -> {
                nodes.forEach { node ->
                    TreeNodeRow(
                        node = node,
                        depth = 0,
                        expandedNodeIds = expandedNodeIds,
                        selection = selection,
                        onToggleExpansion = { target ->
                            expandedNodeIds = if (expandedNodeIds.contains(target.id)) {
                                expandedNodeIds - target.id
                            } else {
                                expandedNodeIds + target.id
                            }
                        },
                        onToggleSelection = { target ->
                            scope.launch {
                                dsContext.toggleSelection(
                                    row = target.selectionPayload,
                                    rowIndex = target.sourceRowIndex,
                                    selectionModeOverride = selectionModeOverride
                                )
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun TreeNodeRow(
    node: TreeBrowserNode,
    depth: Int,
    expandedNodeIds: Set<String>,
    selection: SelectionState,
    onToggleExpansion: (TreeBrowserNode) -> Unit,
    onToggleSelection: (TreeBrowserNode) -> Unit
) {
    val isExpanded = expandedNodeIds.contains(node.id)
    val isSelected = selection.selected == node.selectionPayload || selection.selection.contains(node.selectionPayload)
    val backgroundColor = if (isSelected) {
        MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
    } else {
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 2.dp)
                .clip(MaterialTheme.shapes.medium)
                .background(backgroundColor)
                .clickable {
                    if (node.isLeaf) {
                        onToggleSelection(node)
                    } else {
                        onToggleExpansion(node)
                    }
                }
                .padding(horizontal = 10.dp, vertical = 8.dp)
        ) {
            Spacer(modifier = Modifier.width((depth * 16).dp))
            Text(
                text = when {
                    node.isLeaf -> " "
                    isExpanded -> "▾"
                    else -> "▸"
                },
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.width(14.dp)
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = node.label,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
                if (node.secondaryLabel.isNotBlank()) {
                    Text(
                        text = node.secondaryLabel,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            if (isSelected) {
                Text(
                    text = "✓",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }

        if (!node.isLeaf && isExpanded) {
            node.children.forEach { child ->
                TreeNodeRow(
                    node = child,
                    depth = depth + 1,
                    expandedNodeIds = expandedNodeIds,
                    selection = selection,
                    onToggleExpansion = onToggleExpansion,
                    onToggleSelection = onToggleSelection
                )
            }
        }
    }
}

private data class TreeBrowserNode(
    val id: String,
    val label: String,
    val secondaryLabel: String,
    val fullValue: Any?,
    val row: Map<String, Any?>,
    val isLeaf: Boolean,
    val children: List<TreeBrowserNode>,
    val pathParts: List<String>,
    val sourceRowIndex: Int
) {
    val selectionPayload: Map<String, Any?>
        get() = row.toMutableMap().apply {
            if (this["label"] == null) {
                this["label"] = label
            }
            if (this["displayPath"] == null && pathParts.isNotEmpty()) {
                this["displayPath"] = pathParts.joinToString(" / ")
            }
            if (this["value"] == null && fullValue != null) {
                this["value"] = fullValue
            }
        }
}

private data class TreeAccumulator(
    val id: String,
    var label: String,
    val childMap: LinkedHashMap<String, TreeAccumulator> = linkedMapOf(),
    var row: Map<String, Any?> = emptyMap(),
    var leafLabel: String = "",
    var fullValue: Any? = null,
    var secondaryLabel: String = "",
    var pathParts: List<String> = emptyList(),
    var sourceRowIndex: Int = -1
)

private fun buildTreeBrowserNodes(
    rows: List<Map<String, Any?>>,
    config: TreeBrowserDef
): List<TreeBrowserNode> {
    val pathField = config.pathField?.takeIf { it.isNotBlank() } ?: "path"
    val labelField = config.labelField?.takeIf { it.isNotBlank() }
    val valueField = config.valueField?.takeIf { it.isNotBlank() } ?: "value"
    val subtitleField = config.subtitleField?.takeIf { it.isNotBlank() }
    val childrenField = config.childrenField?.takeIf { it.isNotBlank() } ?: "childNodes"
    val separator = config.separator?.takeIf { it.isNotBlank() } ?: "/"

    if (rows.any { normalizeTreeChildren(resolveTreeValue(it, childrenField)).isNotEmpty() }) {
        return buildNestedTreeNodes(
            inputRows = rows,
            parentParts = emptyList(),
            pathField = pathField,
            labelField = labelField,
            valueField = valueField,
            subtitleField = subtitleField,
            childrenField = childrenField,
            separator = separator
        )
    }

    val rootMap = linkedMapOf<String, TreeAccumulator>()
    rows.forEachIndexed { index, row ->
        val explicitLabel = resolveTreeValue(row, labelField)?.toString()?.trim()
        val value = resolveTreeValue(row, valueField)
        val parts = normalizeTreePath(resolveTreeValue(row, pathField), separator)
        val normalizedParts = if (parts.isNotEmpty()) {
            parts
        } else {
            listOf((explicitLabel ?: value?.toString() ?: "Item ${index + 1}").trim())
        }

        var currentMap = rootMap
        for ((partIndex, rawPart) in normalizedParts.withIndex()) {
            val part = rawPart.trim()
            if (part.isEmpty()) {
                continue
            }
            val isLeaf = partIndex == normalizedParts.lastIndex
            val pathParts = normalizedParts.take(partIndex + 1).map { it.trim() }.filter { it.isNotEmpty() }
            val entry = currentMap.getOrPut(part) {
                TreeAccumulator(
                    id = makeTreeNodeId(pathParts, "node-$index-$partIndex"),
                    label = part
                )
            }
            if (isLeaf) {
                entry.row = row
                entry.leafLabel = (explicitLabel ?: part).trim()
                entry.fullValue = value
                entry.secondaryLabel = resolveTreeSecondaryLabel(row, subtitleField, value)
                entry.pathParts = pathParts
                entry.sourceRowIndex = index
            }
            currentMap = entry.childMap
        }
    }

    return rootMap.values.map { it.toNode() }
}

private fun buildNestedTreeNodes(
    inputRows: List<Map<String, Any?>>,
    parentParts: List<String>,
    pathField: String,
    labelField: String?,
    valueField: String,
    subtitleField: String?,
    childrenField: String,
    separator: String
): List<TreeBrowserNode> {
    return inputRows.mapIndexed { index, row ->
        val explicitLabel = resolveTreeValue(row, labelField)?.toString()?.trim()
        val pathParts = normalizeTreePath(resolveTreeValue(row, pathField), separator)
        val label = (explicitLabel
            ?: pathParts.lastOrNull()
            ?: row["label"]?.toString()
            ?: row["name"]?.toString()
            ?: "Node ${index + 1}").trim()
        val resolvedPathParts = if (pathParts.isNotEmpty()) pathParts else parentParts + label
        val childrenRows = normalizeTreeChildren(resolveTreeValue(row, childrenField))
        val value = resolveTreeValue(row, valueField)
        val children = buildNestedTreeNodes(
            inputRows = childrenRows,
            parentParts = resolvedPathParts,
            pathField = pathField,
            labelField = labelField,
            valueField = valueField,
            subtitleField = subtitleField,
            childrenField = childrenField,
            separator = separator
        )
        TreeBrowserNode(
            id = makeTreeNodeId(resolvedPathParts, "node-$index"),
            label = label,
            secondaryLabel = if (children.isEmpty()) resolveTreeSecondaryLabel(row, subtitleField, value) else "",
            fullValue = if (children.isEmpty()) value else null,
            row = row,
            isLeaf = children.isEmpty(),
            children = children,
            pathParts = resolvedPathParts,
            sourceRowIndex = index
        )
    }
}

private fun TreeAccumulator.toNode(): TreeBrowserNode {
    val childNodes = childMap.values.map { it.toNode() }
    val isLeaf = childNodes.isEmpty()
    return TreeBrowserNode(
        id = id,
        label = if (isLeaf) leafLabel.ifBlank { label } else label,
        secondaryLabel = if (isLeaf) secondaryLabel else "",
        fullValue = if (isLeaf) fullValue else null,
        row = row,
        isLeaf = isLeaf,
        children = childNodes,
        pathParts = pathParts,
        sourceRowIndex = sourceRowIndex
    )
}

private fun resolveTreeValue(row: Map<String, Any?>, selector: String?): Any? {
    if (selector.isNullOrBlank()) return null
    return SelectorUtil.resolve(row, selector)
}

private fun normalizeTreePath(value: Any?, separator: String): List<String> = when (value) {
    is List<*> -> value.mapNotNull { it?.toString()?.trim() }.filter { it.isNotEmpty() }
    null -> emptyList()
    else -> value.toString()
        .trim()
        .takeIf { it.isNotEmpty() }
        ?.split(separator)
        ?.map { it.trim() }
        ?.filter { it.isNotEmpty() }
        ?: emptyList()
}

private fun normalizeTreeChildren(value: Any?): List<Map<String, Any?>> = when (value) {
    is List<*> -> value.mapNotNull { JsonUtil.asStringMap(it).takeIf { map -> map.isNotEmpty() } }
    else -> emptyList()
}

private fun resolveTreeSecondaryLabel(row: Map<String, Any?>, subtitleField: String?, value: Any?): String {
    val subtitle = subtitleField?.let { resolveTreeValue(row, it)?.toString()?.trim() }.orEmpty()
    if (subtitle.isNotEmpty()) {
        return subtitle
    }
    return value?.toString()?.trim().orEmpty()
}

private fun makeTreeNodeId(parts: List<String>, fallback: String): String {
    val base = parts.filter { it.isNotBlank() }.joinToString("::")
    return if (base.isBlank()) fallback else base
}

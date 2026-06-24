package com.viant.forgeandroid.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.ColumnDef
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.SelectorUtil
import com.viant.forgeandroid.runtime.TableDef
import com.viant.forgeandroid.runtime.formatDashboardValue
import kotlinx.coroutines.launch

@Composable
fun TableRenderer(runtime: ForgeRuntime, context: DataSourceContext, table: TableDef, rowsOverride: List<Map<String, Any?>>? = null) {
    val datasourceRows by context.collection.flow.collectAsState(initial = emptyList())
    val rows = rowsOverride ?: datasourceRows
    val form by context.form.flow.collectAsState(initial = context.form.peek())
    val selection by context.selection.flow.collectAsState(initial = com.viant.forgeandroid.runtime.SelectionState())
    val control by context.control.flow.collectAsState(initial = context.control.peek())
    val metrics by context.metrics.flow.collectAsState(initial = emptyMap())
    val windowForm by context.window.windowFormSignal().flow.collectAsState(initial = context.window.peekWindowForm())
    val input by context.input.flow.collectAsState(initial = com.viant.forgeandroid.runtime.InputState())
    val coroutineScope = rememberCoroutineScope()
    var sortColumnId by remember(table.columns) { mutableStateOf<String?>(null) }
    var sortAscending by remember(table.columns) { mutableStateOf(true) }
    val sortedRows = sortedTableRows(rows, sortColumnId, sortAscending)
    val refreshFeedback = tableRefreshFeedback(control.loading, control.error)

    LaunchedEffect(rowsOverride) {
        if (rowsOverride == null) {
            context.fetchCollection()
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        table.toolbar?.let { tb ->
            TableToolbar(runtime, context, tb)
        }
        if (tableRefreshControlVisible(context.dataSourceRef, rowsOverride != null)) {
            Column(modifier = Modifier.padding(bottom = 8.dp)) {
                Button(
                    onClick = {
                        context.fetchCollection()
                    },
                    enabled = !refreshFeedback.busy
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null)
                    Text(if (refreshFeedback.busy) "Refreshing" else "Refresh")
                }
                refreshFeedback.message?.let { message ->
                    Text(
                        text = message,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        }
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f, fill = true)
        ) {
            val compact = maxWidth < 720.dp
            if (compact) {
                Column(modifier = Modifier.fillMaxSize()) {
                    CompactSortControls(table, sortColumnId, sortAscending) { columnId ->
                        if (sortColumnId == columnId) {
                            sortAscending = !sortAscending
                        } else {
                            sortColumnId = columnId
                            sortAscending = true
                        }
                    }
                    LazyColumn(
                        modifier = Modifier.weight(1f, fill = true),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        itemsIndexed(sortedRows) { _, indexed ->
                            val row = indexed.row
                            val rowIndex = indexed.originalIndex
                            val isSelected = selection.rowIndex == rowIndex
                            MobileTableCard(runtime, context, table, row, rowIndex, isSelected, form, metrics, windowForm) {
                                coroutineScope.launch { context.toggleSelection(row, rowIndex) }
                            }
                        }
                    }
                }
            } else {
                val horizontalScroll = rememberScrollState()
                Card(
                    modifier = Modifier
                        .fillMaxSize(),
                    shape = RoundedCornerShape(18.dp),
                    border = BorderStroke(1.dp, Color(0xFFE7ECF3)),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .horizontalScroll(horizontalScroll)
                    ) {
                        DesktopTableHeader(table, sortColumnId, sortAscending) { columnId ->
                            if (sortColumnId == columnId) {
                                sortAscending = !sortAscending
                            } else {
                                sortColumnId = columnId
                                sortAscending = true
                            }
                        }
                        LazyColumn(
                            modifier = Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(0.dp)
                        ) {
                            itemsIndexed(sortedRows) { displayIndex, indexed ->
                                val row = indexed.row
                                val rowIndex = indexed.originalIndex
                                val isSelected = selection.rowIndex == rowIndex
                                DesktopTableRow(runtime, context, table, row, rowIndex, displayIndex, isSelected, form, metrics, windowForm) {
                                    coroutineScope.launch { context.toggleSelection(row, rowIndex) }
                                }
                            }
                        }
                    }
                }
            }
        }
        if (context.dataSource.paging?.enabled == true || metrics["pageCount"] != null || metrics["hasMore"] != null) {
            TablePagination(
                context = context,
                metrics = metrics,
                currentPage = input.page ?: 1
            )
        }
    }
}

fun tableRefreshControlVisible(dataSourceRef: String, usesProvidedRows: Boolean): Boolean =
    !usesProvidedRows && dataSourceRef.trim().isNotEmpty()

data class TableRefreshFeedback(
    val busy: Boolean,
    val message: String?
)

fun tableRefreshFeedback(loading: Boolean, error: String?): TableRefreshFeedback =
    TableRefreshFeedback(
        busy = loading,
        message = error?.trim()?.takeIf { it.isNotEmpty() }
    )

@Composable
private fun CompactSortControls(
    table: TableDef,
    sortColumnId: String?,
    sortAscending: Boolean,
    onSort: (String) -> Unit
) {
    val columns = displayColumns(table).filter { tableColumnSortable(it) && tableColumnKey(it) != null }
    if (columns.isEmpty()) {
        return
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(bottom = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        columns.forEach { column ->
            val columnId = tableColumnKey(column) ?: return@forEach
            AssistChip(
                onClick = { onSort(columnId) },
                label = {
                    Text(sortableHeaderLabel(column.label ?: column.name ?: column.id.orEmpty(), columnId, sortColumnId, sortAscending))
                },
                colors = AssistChipDefaults.assistChipColors(
                    containerColor = if (columnId == sortColumnId) Color(0xFFE9F1FF) else Color(0xFFF2F5FA)
                )
            )
        }
    }
}

@Composable
private fun DesktopTableHeader(
    table: TableDef,
    sortColumnId: String?,
    sortAscending: Boolean,
    onSort: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFF8FAFC), shape = RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp))
            .padding(horizontal = 12.dp, vertical = 9.dp)
    ) {
        displayColumns(table).forEach { col ->
            val columnId = tableColumnKey(col)
            HeaderColumnCell(
                text = sortableHeaderLabel(col.label ?: col.name ?: col.id.orEmpty(), columnId, sortColumnId, sortAscending),
                sortable = tableColumnSortable(col) && columnId != null,
                onSort = columnId?.let { { onSort(it) } }
            )
        }
        if (buttonColumns(table).isNotEmpty() || iconColumns(table).isNotEmpty()) {
            HeaderColumnCell(text = "Actions", weight = 0.8f)
        }
    }
}

@Composable
private fun MobileTableCard(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    table: TableDef,
    row: Map<String, Any?>,
    index: Int,
    isSelected: Boolean,
    form: Map<String, Any?>,
    metrics: Map<String, Any?>,
    windowForm: Map<String, Any?>,
    onToggleSelection: () -> Unit
) {
    val uriHandler = LocalUriHandler.current
    val openLink: (ResolvedLinkTarget) -> Unit = { linkTarget ->
        when (linkTarget) {
            is ExternalLinkTarget -> uriHandler.openUri(linkTarget.href)
            is WindowLinkTarget -> openResolvedWindowLink(runtime, context.window, linkTarget)
        }
    }
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .semantics {
                contentDescription = tableRowAccessibilityLabel(table, row)
            }
            .clickable(onClick = onToggleSelection),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) Color(0xFFF4F7FF) else Color.White
        ),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = if (isSelected) 3.dp else 1.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            displayColumns(table).forEachIndexed { fieldIndex, col ->
                val key = tableColumnKey(col) ?: return@forEachIndexed
                val value = formatTableValue(row[key], col)
                val linkTarget = resolveColumnLinkTargetFromContext(
                    col,
                    LinkResolutionContext(
                        row = row,
                        value = row[key],
                        form = form,
                        metrics = metrics,
                        windowForm = windowForm
                    )
                )
                if (fieldIndex == 0) {
                    Text(
                        text = value.ifBlank { col.label ?: key },
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = if (linkTarget != null) MaterialTheme.colorScheme.primary else Color.Unspecified,
                        textDecoration = if (linkTarget != null) TextDecoration.Underline else null,
                        modifier = if (linkTarget != null) Modifier.clickable { openLink(linkTarget) } else Modifier
                    )
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            text = col.label ?: col.name ?: key,
                            style = MaterialTheme.typography.labelMedium,
                            color = Color(0xFF6A7280)
                        )
                        Text(
                            text = value.ifBlank { "-" },
                            style = MaterialTheme.typography.bodyMedium,
                            color = if (linkTarget != null) MaterialTheme.colorScheme.primary else Color.Unspecified,
                            textDecoration = if (linkTarget != null) TextDecoration.Underline else null,
                            modifier = if (linkTarget != null) Modifier.clickable { openLink(linkTarget) } else Modifier
                        )
                    }
                }
            }
            val actions = buttonColumns(table)
            val iconActions = iconColumns(table)
            if (actions.isNotEmpty()) {
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    actions.forEach { col ->
                        AssistChip(
                            onClick = { executeRowAction(runtime, context, col, row, index) },
                            label = { Text(col.label ?: col.icon ?: col.id ?: "Action") },
                            colors = AssistChipDefaults.assistChipColors(containerColor = Color(0xFFE9EEF9))
                        )
                    }
                }
            }
            if (iconActions.isNotEmpty()) {
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    iconActions.forEach { col ->
                        AssistChip(
                            onClick = { executeRowAction(runtime, context, col, row, index, event = "onClick") },
                            label = { Text(col.label ?: "Open") },
                            leadingIcon = {
                                Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = col.label ?: "Open")
                            },
                            colors = AssistChipDefaults.assistChipColors(containerColor = Color(0xFFE9EEF9))
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DesktopTableRow(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    table: TableDef,
    row: Map<String, Any?>,
    index: Int,
    displayIndex: Int,
    isSelected: Boolean,
    form: Map<String, Any?>,
    metrics: Map<String, Any?>,
    windowForm: Map<String, Any?>,
    onToggleSelection: () -> Unit
) {
    val uriHandler = LocalUriHandler.current
    val openLink: (ResolvedLinkTarget) -> Unit = { linkTarget ->
        when (linkTarget) {
            is ExternalLinkTarget -> uriHandler.openUri(linkTarget.href)
            is WindowLinkTarget -> openResolvedWindowLink(runtime, context.window, linkTarget)
        }
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                if (isSelected) Color(0xFFF4F7FF) else if (displayIndex.isEven()) Color.White else Color(0xFFFBFCFE)
            )
            .semantics {
                contentDescription = tableRowAccessibilityLabel(table, row)
            }
            .clickable(onClick = onToggleSelection)
            .padding(horizontal = 12.dp, vertical = 10.dp)
    ) {
        table.columns.forEach { col ->
            when (col.type) {
                "button" -> {
                    AssistChip(
                        onClick = { executeRowAction(runtime, context, col, row, index) },
                        label = { Text(col.label ?: col.icon ?: col.id ?: "Action") },
                        colors = AssistChipDefaults.assistChipColors(containerColor = Color(0xFFF2F5FA))
                    )
                }
                "icon" -> {
                    IconButton(
                        onClick = { executeRowAction(runtime, context, col, row, index, event = "onClick") }
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.OpenInNew,
                            contentDescription = col.label ?: col.icon ?: col.id ?: "Open"
                        )
                    }
                }
                else -> {
                    val key = tableColumnKey(col) ?: ""
                    val value = formatTableValue(row[key], col)
                    val linkTarget = resolveColumnLinkTargetFromContext(
                        col,
                        LinkResolutionContext(
                            row = row,
                            value = row[key],
                            form = form,
                            metrics = metrics,
                            windowForm = windowForm
                        )
                    )
                    ValueColumnCell(value = value, linkTarget = linkTarget, onOpenLink = openLink)
                }
            }
        }
        if (buttonColumns(table).isNotEmpty() || iconColumns(table).isNotEmpty()) {
            Row(
                modifier = Modifier
                    .weight(0.8f)
                    .padding(start = 4.dp),
                horizontalArrangement = Arrangement.End
            ) {
                buttonColumns(table).forEach { col ->
                    AssistChip(
                        onClick = { executeRowAction(runtime, context, col, row, index) },
                        label = { Text(col.label ?: col.icon ?: col.id ?: "Action") },
                        colors = AssistChipDefaults.assistChipColors(containerColor = Color(0xFFF2F5FA)),
                        modifier = Modifier.padding(end = 8.dp)
                    )
                }
                iconColumns(table).forEach { col ->
                    IconButton(
                        onClick = { executeRowAction(runtime, context, col, row, index, event = "onClick") }
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.OpenInNew,
                            contentDescription = col.label ?: col.icon ?: col.id ?: "Open"
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RowScope.HeaderColumnCell(
    text: String,
    weight: Float = 1f,
    sortable: Boolean = false,
    onSort: (() -> Unit)? = null
) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        color = Color(0xFF6A7280),
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier
            .weight(weight)
            .widthIn(min = 128.dp)
            .padding(end = 12.dp)
            .then(if (sortable && onSort != null) Modifier.clickable { onSort() } else Modifier)
    )
}

@Composable
private fun RowScope.ValueColumnCell(
    value: String,
    linkTarget: ResolvedLinkTarget? = null,
    onOpenLink: ((ResolvedLinkTarget) -> Unit)? = null,
    weight: Float = 1f
) {
    Text(
        text = value.ifBlank { "-" },
        style = MaterialTheme.typography.bodyMedium,
        color = if (linkTarget != null) MaterialTheme.colorScheme.primary else Color.Unspecified,
        textDecoration = if (linkTarget != null) TextDecoration.Underline else null,
        modifier = Modifier
            .weight(weight)
            .widthIn(min = 128.dp)
            .padding(end = 12.dp)
            .then(if (linkTarget != null && onOpenLink != null) Modifier.clickable { onOpenLink(linkTarget) } else Modifier)
    )
}

private fun Int.isEven(): Boolean = this % 2 == 0

private fun displayColumns(table: TableDef): List<ColumnDef> {
    return table.columns.filter { col -> col.type != "button" && col.type != "icon" }
}

private fun buttonColumns(table: TableDef): List<ColumnDef> {
    return table.columns.filter { it.type == "button" && it.on.isNotEmpty() }
}

private fun iconColumns(table: TableDef): List<ColumnDef> {
    return table.columns.filter { it.type == "icon" && it.on.any { exec -> exec.event == "onClick" } }
}

private fun executeRowAction(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    column: ColumnDef,
    row: Map<String, Any?>,
    rowIndex: Int,
    event: String? = null
) {
    val execution = if (event == null) {
        column.on.firstOrNull()
    } else {
        column.on.firstOrNull { it.event == event }
    } ?: return
    runtime.execute(execution, context, mapOf("row" to row, "rowIndex" to rowIndex))
}

private fun formatTableValue(value: Any?, column: ColumnDef): String {
    if (value == null) {
        return column.emptyText?.takeIf { it.isNotBlank() } ?: ""
    }
    return formatDashboardValue(value, column.format)
}

internal fun tableRowAccessibilityLabel(
    table: TableDef,
    row: Map<String, Any?>,
    limit: Int = 3
): String {
    return displayColumns(table)
        .take(limit.coerceAtLeast(0))
        .mapNotNull { column ->
            val key = tableColumnKey(column) ?: return@mapNotNull null
            val label = tableColumnLabel(column, key)
            val value = formatTableValue(row[key], column).ifBlank { "-" }
            "$label $value"
        }
        .joinToString(", ")
}

private fun tableColumnKey(column: ColumnDef): String? {
    return column.id?.takeIf { it.isNotBlank() }
        ?: column.name?.takeIf { it.isNotBlank() }
        ?: column.key?.takeIf { it.isNotBlank() }
}

private fun tableColumnLabel(column: ColumnDef, key: String): String {
    return column.label?.takeIf { it.isNotBlank() }
        ?: column.name?.takeIf { it.isNotBlank() }
        ?: key
}

internal data class IndexedTableRow(
    val originalIndex: Int,
    val row: Map<String, Any?>
)

internal fun sortedTableRows(
    rows: List<Map<String, Any?>>,
    sortColumnId: String?,
    ascending: Boolean
): List<IndexedTableRow> {
    val indexed = rows.mapIndexed { index, row -> IndexedTableRow(index, row) }
    val columnId = sortColumnId?.takeIf { it.isNotBlank() } ?: return indexed
    return indexed.sortedWith { left, right ->
        compareTableSortValues(
            SelectorUtil.resolve(left.row, columnId),
            SelectorUtil.resolve(right.row, columnId),
            ascending
        )
    }
}

private fun compareTableSortValues(left: Any?, right: Any?, ascending: Boolean): Int {
    val result = when {
        left == null && right == null -> 0
        left == null -> -1
        right == null -> 1
        left is Number && right is Number -> left.toDouble().compareTo(right.toDouble())
        left is String && right is String -> left.compareTo(right, ignoreCase = true)
        else -> left.toString().compareTo(right.toString(), ignoreCase = true)
    }
    return if (ascending) result else -result
}

private fun tableColumnSortable(column: ColumnDef): Boolean = column.sortable == true

private fun sortableHeaderLabel(label: String, columnId: String?, sortColumnId: String?, ascending: Boolean): String {
    if (columnId == null || columnId != sortColumnId) {
        return label
    }
    return "$label ${if (ascending) "^" else "v"}"
}

@Composable
private fun TablePagination(
    context: DataSourceContext,
    metrics: Map<String, Any?>,
    currentPage: Int
) {
    val totalPages = when (val value = metrics["pageCount"]) {
        is Number -> value.toInt()
        is String -> value.toIntOrNull()
        else -> null
    } ?: if ((metrics["hasMore"] as? Boolean) == true) currentPage + 1 else currentPage

    val totalCount = when (val value = metrics["totalCount"]) {
        is Number -> value.toInt()
        is String -> value.toIntOrNull()
        else -> null
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = buildString {
                append("Page ")
                append(currentPage)
                if (totalPages > 0) {
                    append(" of ")
                    append(totalPages)
                }
                if (totalCount != null) {
                    append(" • ")
                    append(totalCount)
                    append(" total")
                }
            },
            style = MaterialTheme.typography.bodySmall,
            color = Color(0xFF667085),
            modifier = Modifier.weight(1f)
        )
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            IconButton(
                onClick = { context.setPage((currentPage - 1).coerceAtLeast(1)) },
                enabled = currentPage > 1
            ) {
                Icon(Icons.Default.ChevronLeft, contentDescription = "Previous page")
            }
            IconButton(
                onClick = { context.setPage(currentPage + 1) },
                enabled = totalPages <= 0 || currentPage < totalPages || (metrics["hasMore"] as? Boolean == true)
            ) {
                Icon(Icons.Default.ChevronRight, contentDescription = "Next page")
            }
        }
    }
}

package com.viant.forgeandroid.ui

import android.content.Intent
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
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.FileUpload
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material3.Button
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Checkbox
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.FilterSetDef
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.JsonUtil
import com.viant.forgeandroid.runtime.NativeWidgetContract
import com.viant.forgeandroid.runtime.SelectorUtil
import com.viant.forgeandroid.runtime.SelectionState
import com.viant.forgeandroid.runtime.ToolbarDef
import com.viant.forgeandroid.runtime.ToolbarItemDef
import com.viant.forgeandroid.runtime.TableDef
import com.viant.forgeandroid.runtime.ColumnDef
import com.viant.forgeandroid.runtime.formatDashboardValue
import com.viant.forgeandroid.runtime.evaluateDashboardCondition
import kotlinx.coroutines.delay
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

@Composable
fun TableToolbar(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    toolbar: ToolbarDef,
    table: TableDef? = null,
    rows: List<Map<String, Any?>> = emptyList(),
    hiddenColumnKeys: Set<String> = emptySet(),
    onHiddenColumnKeysChange: (Set<String>) -> Unit = {},
    hiddenItemIds: Set<String> = emptySet()
) {
    val androidContext = LocalContext.current
    val items = toolbar.items.filterNot { it.id in hiddenItemIds || it.type == "pagination" || it.id == "pagination" }
    val left = items.filter { it.align?.lowercase() == "left" }
    val center = items.filter { it.align?.lowercase() == "center" }
    val right = items.filter { it.align?.lowercase() !in setOf("left", "center") }
    val compactPadding = if (toolbar.density.equals("compact", ignoreCase = true)) 2.dp else 4.dp
    val itemSpacing = toolbarStyleDp(toolbar, "gap") ?: 6.dp
    val itemSize = toolbarStyleDp(toolbar, "itemSize")
    val compactPresentation = LocalForgePresentationDensity.current == ForgePresentationDensity.Compact
    val builtInAction: (ToolbarItemDef) -> Unit = { item ->
        if (item.type.equals("tableExport", true) && table != null) shareTableCsv(androidContext, item, table, rows, hiddenColumnKeys)
    }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = compactPadding)
    ) {
        val compact = maxWidth < 600.dp
        if (compactPresentation) {
            ToolbarGroup(runtime, context, items, table, hiddenColumnKeys, onHiddenColumnKeysChange, spacing = itemSpacing, actionSize = itemSize, onBuiltInAction = builtInAction)
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
                    ToolbarGroup(runtime, context, left, table, hiddenColumnKeys, onHiddenColumnKeysChange, spacing = itemSpacing, actionSize = itemSize, onBuiltInAction = builtInAction)
                    ToolbarGroup(runtime, context, right, table, hiddenColumnKeys, onHiddenColumnKeysChange, spacing = itemSpacing, actionSize = itemSize, onBuiltInAction = builtInAction)
                }
                ToolbarGroup(runtime, context, center, table, hiddenColumnKeys, onHiddenColumnKeysChange, Modifier.fillMaxWidth(), itemSpacing, itemSize, builtInAction)
            }
        } else {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                ToolbarGroup(runtime, context, left, table, hiddenColumnKeys, onHiddenColumnKeysChange, spacing = itemSpacing, actionSize = itemSize, onBuiltInAction = builtInAction)
                Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    ToolbarGroup(runtime, context, center, table, hiddenColumnKeys, onHiddenColumnKeysChange, spacing = itemSpacing, actionSize = itemSize, onBuiltInAction = builtInAction)
                }
                ToolbarGroup(runtime, context, right, table, hiddenColumnKeys, onHiddenColumnKeysChange, spacing = itemSpacing, actionSize = itemSize, onBuiltInAction = builtInAction)
            }
        }
    }
}

@Composable
private fun ToolbarColumnCustomizer(
    item: ToolbarItemDef,
    table: TableDef,
    hiddenColumnKeys: Set<String>,
    onHiddenColumnKeysChange: (Set<String>) -> Unit,
    disabled: Boolean
) {
    val columns = table.columns.filter { it.type?.lowercase() !in setOf("button", "icon") }
    val protectedKey = columns.firstOrNull()?.let(::toolbarColumnKey).orEmpty()
    var expanded by remember(item.id) { mutableStateOf(false) }
    Box {
        IconButton(
            onClick = { expanded = true },
            enabled = !disabled,
            modifier = Modifier.size(48.dp).semantics { contentDescription = item.ariaLabel ?: item.tooltip ?: item.label ?: "Customize columns" }
        ) {
            Icon(Icons.Default.Settings, contentDescription = null)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            columns.forEach { column ->
                val key = toolbarColumnKey(column)
                val visible = key !in hiddenColumnKeys
                DropdownMenuItem(
                    text = { Text(column.label ?: column.name ?: key) },
                    leadingIcon = { Checkbox(checked = visible, onCheckedChange = null) },
                    enabled = !disabled && key != protectedKey,
                    onClick = {
                        if (key != protectedKey) {
                            onHiddenColumnKeysChange(if (visible) hiddenColumnKeys + key else hiddenColumnKeys - key)
                        }
                    }
                )
            }
            DropdownMenuItem(
                text = { Text("Show all columns") },
                enabled = !disabled && hiddenColumnKeys.isNotEmpty(),
                onClick = { onHiddenColumnKeysChange(emptySet()) }
            )
        }
    }
}

private fun shareTableCsv(
    context: android.content.Context,
    item: ToolbarItemDef,
    table: TableDef,
    rows: List<Map<String, Any?>>,
    hiddenColumnKeys: Set<String>
) {
    val columns = table.columns.filter { column ->
        column.type?.lowercase() !in setOf("button", "icon") && toolbarColumnKey(column) !in hiddenColumnKeys
    }
    val csv = buildTableCsv(columns, rows)
    val filename = (item.properties["filename"] as? JsonPrimitive)?.contentOrNull?.trim().orEmpty()
        .ifBlank { "table" }
        .let { if (it.endsWith(".csv", true)) it else "$it.csv" }
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/csv"
        putExtra(Intent.EXTRA_SUBJECT, filename)
        putExtra(Intent.EXTRA_TEXT, csv)
    }
    context.startActivity(Intent.createChooser(intent, "Export CSV"))
}

internal fun buildTableCsv(columns: List<ColumnDef>, rows: List<Map<String, Any?>>): String {
    val header = columns.joinToString(",") { csvCell(it.label ?: it.name ?: toolbarColumnKey(it)) }
    val records = rows.map { row ->
        columns.joinToString(",") { column ->
            val raw = SelectorUtil.resolve(row, toolbarColumnKey(column))
            val text = if (column.format.isNullOrBlank()) NativeWidgetContract.displayText(JsonUtil.anyToElement(raw))
            else formatDashboardValue(raw, column.format)
            csvCell(text)
        }
    }
    return (listOf(header) + records).joinToString("\r\n")
}

private fun csvCell(value: String): String {
    val escaped = value.replace("\"", "\"\"")
    return if (escaped.any { it == ',' || it == '\"' || it == '\n' || it == '\r' }) "\"$escaped\"" else escaped
}

private fun toolbarColumnKey(column: ColumnDef): String =
    column.id?.takeIf(String::isNotBlank) ?: column.key?.takeIf(String::isNotBlank) ?: column.name.orEmpty()

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun ToolbarGroup(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    items: List<ToolbarItemDef>,
    table: TableDef? = null,
    hiddenColumnKeys: Set<String> = emptySet(),
    onHiddenColumnKeysChange: (Set<String>) -> Unit = {},
    modifier: Modifier = Modifier,
    spacing: Dp = 6.dp,
    actionSize: Dp? = null,
    onBuiltInAction: (ToolbarItemDef) -> Unit = {}
) {
    val compactPresentation = LocalForgePresentationDensity.current == ForgePresentationDensity.Compact
    val selection by context.selection.flow.collectAsState(initial = SelectionState())
    val form by context.form.flow.collectAsState(initial = context.form.peek())
    val windowForm by context.window.windowFormSignal().flow.collectAsState(initial = context.window.peekWindowForm())
    val collection by context.collection.flow.collectAsState(initial = context.collection.peek())
    val metrics by context.metrics.flow.collectAsState(initial = context.metrics.peek())
    val input by context.input.flow.collectAsState(initial = context.input.peek())
    val metadata by context.window.metadata.flow.collectAsState(initial = context.window.metadata.peek())
    val authorization = metadata?.authorizationSnapshot?.mapValues { JsonUtil.elementToAny(it.value) }.orEmpty()
    fun conditionMatches(item: ToolbarItemDef, disabled: Boolean = false): Boolean {
        val condition = if (disabled) item.disabledWhen else item.visibleWhen
        return evaluateDashboardCondition(
            condition = condition,
            metrics = metrics,
            filters = input.filter,
            form = form,
            windowForm = windowForm,
            collection = collection,
            input = mapOf("filter" to input.filter, "parameters" to input.parameters, "page" to input.page),
            selectionValues = mapOf("selected" to selection.selected, "selection" to selection.selection, "rowIndex" to selection.rowIndex),
            authorization = authorization
        )
    }
    val visibleItems = items.filter { conditionMatches(it) }
    fun itemDisabled(item: ToolbarItemDef) = item.disabled == true || item.enabled == false ||
        (item.disabledWhen != null && conditionMatches(item, disabled = true))
    if (compactPresentation) {
        FlowRow(
            modifier = modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(spacing),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            visibleItems.forEach { item ->
                when {
                    toolbarItemIsQuickSearch(item) -> QuickFilter(context, item, itemDisabled(item))
                    item.type.equals("select", ignoreCase = true) -> ToolbarSelect(runtime, context, item, itemDisabled(item))
                    item.id.equals("settings", true) && table != null -> ToolbarColumnCustomizer(item, table, hiddenColumnKeys, onHiddenColumnKeysChange, itemDisabled(item))
                    item.id.equals("filterList", true) -> ToolbarFilterControl(item, context, itemDisabled(item))
                    item.type.equals("tableExport", true) && table == null -> Unit
                    toolbarItemIsAction(item) -> ToolbarAction(runtime, context, item, actionSize, itemDisabled(item)) { onBuiltInAction(item) }
                }
            }
        }
    } else {
        Row(
            modifier = modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(spacing),
            verticalAlignment = Alignment.CenterVertically
        ) {
            visibleItems.forEach { item ->
                when {
                    toolbarItemIsQuickSearch(item) -> QuickFilter(context, item, itemDisabled(item))
                    item.type.equals("select", ignoreCase = true) -> ToolbarSelect(runtime, context, item, itemDisabled(item))
                    item.id.equals("settings", true) && table != null -> ToolbarColumnCustomizer(item, table, hiddenColumnKeys, onHiddenColumnKeysChange, itemDisabled(item))
                    item.id.equals("filterList", true) -> ToolbarFilterControl(item, context, itemDisabled(item))
                    item.type.equals("tableExport", true) && table == null -> Unit
                    toolbarItemIsAction(item) -> ToolbarAction(runtime, context, item, actionSize, itemDisabled(item)) { onBuiltInAction(item) }
                }
            }
        }
    }
}

@Composable
private fun ToolbarFilterControl(item: ToolbarItemDef, context: DataSourceContext, disabled: Boolean) {
    val fields = quickFilterSet(context)?.template.orEmpty()
    if (fields.isEmpty()) return
    var open by remember(item.id) { mutableStateOf(false) }
    var draft by remember(item.id) { mutableStateOf<Map<String, String>>(emptyMap()) }
    IconButton(
        onClick = {
            draft = buildMap {
                fields.forEach { field ->
                    val key = field.id ?: field.field ?: return@forEach
                    context.peekFilter()[key]?.let { put(key, filterDraftText(it)) }
                }
            }
            open = true
        },
        enabled = !disabled,
        modifier = Modifier.size(48.dp).semantics { contentDescription = item.ariaLabel ?: item.tooltip ?: item.label ?: "Filter rows" }
    ) {
        Icon(Icons.Default.FilterList, contentDescription = null)
    }
    if (open) {
        AlertDialog(
            onDismissRequest = { open = false },
            title = { Text(item.label ?: "Filter rows") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    fields.forEach { field ->
                        val key = field.id ?: field.field ?: return@forEach
                        if (field.type.equals("boolean", true)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(
                                    checked = draft[key] == "true",
                                    onCheckedChange = { checked -> draft = draft + (key to checked.toString()) }
                                )
                                Text(field.label ?: key, modifier = Modifier.weight(1f))
                                if (key in draft) TextButton(onClick = { draft = draft - key }) { Text("Any") }
                            }
                        } else {
                            OutlinedTextField(
                                value = draft[key].orEmpty(),
                                onValueChange = { value -> draft = if (value.isBlank()) draft - key else draft + (key to value) },
                                label = { Text(field.label ?: key) },
                                placeholder = { Text(field.placeholder ?: if (field.type?.endsWith("[]") == true) "Comma-separated values" else "Value") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val next = context.peekFilter().toMutableMap()
                    fields.forEach { field ->
                        val key = field.id ?: field.field ?: return@forEach
                        next.remove(key)
                        draft[key]?.takeIf(String::isNotBlank)?.let { next[key] = parseFilterDraft(it, field.type) }
                    }
                    setToolbarFilter(context, next)
                    open = false
                }) { Text("Apply") }
            },
            dismissButton = {
                TextButton(onClick = {
                    val next = context.peekFilter().toMutableMap()
                    fields.forEach { field -> (field.id ?: field.field)?.let(next::remove) }
                    setToolbarFilter(context, next)
                    draft = emptyMap()
                    open = false
                }) { Text("Clear") }
            }
        )
    }
}

private fun filterDraftText(value: Any?): String = when (value) {
    is Iterable<*> -> value.joinToString(", ") { it.toString() }
    else -> value?.toString().orEmpty()
}

private fun setToolbarFilter(context: DataSourceContext, filter: Map<String, Any?>) {
    if (context.dataSource.filterMode.equals("client", true)) {
        context.input.set(context.input.peek().copy(filter = filter, fetch = false))
    } else {
        context.setFilter(filter)
    }
}

internal fun parseFilterDraft(value: String, type: String?): Any {
    val normalizedType = type?.trim()?.lowercase().orEmpty()
    if (normalizedType.endsWith("[]")) {
        val parts = value.split(',').map(String::trim).filter(String::isNotEmpty)
        return if (normalizedType.startsWith("int") || normalizedType.startsWith("long")) parts.map { it.toLongOrNull() ?: it }
        else parts
    }
    return when (normalizedType) {
        "int", "integer", "long" -> value.trim().toLongOrNull() ?: value.trim()
        "number", "float", "double" -> value.trim().toDoubleOrNull() ?: value.trim()
        "boolean", "bool" -> value.trim().equals("true", true)
        else -> value
    }
}

@Composable
private fun ToolbarSelect(runtime: ForgeRuntime, context: DataSourceContext, item: ToolbarItemDef, externallyDisabled: Boolean) {
    val windowForm by context.window.windowFormSignal().flow.collectAsState(initial = context.window.peekWindowForm())
    val field = toolbarBindingField(item)
    if (field.isBlank() || item.options.isEmpty()) return
    val defaultValue = item.value?.let(JsonUtil::elementToAny)
    val selectedValue = if (item.scope.equals("windowForm", ignoreCase = true)) windowForm[field] ?: defaultValue
        else context.peekForm()[field] ?: defaultValue
    val selected = item.options.firstOrNull { toolbarValuesEquivalent(it.rawValue?.let(JsonUtil::elementToAny), selectedValue) }
    var expanded by remember(item.id, field) { mutableStateOf(false) }
    val label = selected?.label ?: selected?.value ?: item.label ?: "Select"

    Box {
        OutlinedButton(
            onClick = { expanded = true },
            enabled = !externallyDisabled,
            modifier = Modifier.semantics { contentDescription = item.ariaLabel ?: item.label ?: field }
        ) {
            Text(label, maxLines = 1)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            item.options.forEach { option ->
                val raw = option.rawValue?.let(JsonUtil::elementToAny)
                DropdownMenuItem(
                    text = { Text(option.label ?: option.value.orEmpty()) },
                    enabled = !externallyDisabled,
                    onClick = {
                        expanded = false
                        if (item.scope.equals("windowForm", ignoreCase = true)) {
                            runtime.setWindowFormValues(
                                context.window.windowId,
                                mapOf(field to raw),
                                bumpPrefillRevision = false
                            )
                        } else {
                            context.setFormField(field, raw)
                        }
                        item.on.filter { it.event in setOf("onChange", "onSelection") }.forEach { execution ->
                            runtime.execute(execution, context, mapOf("item" to item, "field" to field, "value" to raw))
                        }
                        context.fetchCollection()
                      }
                )
            }
        }
    }
}

@Composable
private fun ToolbarAction(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    item: ToolbarItemDef,
    sizeOverride: Dp?,
    externallyDisabled: Boolean,
    onBuiltInAction: () -> Unit = {}
) {
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
        initialValue = externallyDisabled || readonlyExecutions.any { runtime.isReadOnly(it, context) },
        item,
        externallyDisabled,
        selection,
        form,
        windowForm,
        collection,
        input
    ) {
        value = externallyDisabled || readonlyExecutions.any { execution ->
            if (runtime.isReadOnly(execution, context)) true
            else runtime.evaluate(execution, context, toolbarEventArgs(item)) as? Boolean ?: false
        }
    }
    val onClick = {
        val executions = item.on.filter { it.event == "onClick" }
        if (executions.isEmpty() && item.id.equals("refresh", ignoreCase = true)) {
            context.fetchCollection()
        } else if (executions.isEmpty()) {
            onBuiltInAction()
        } else {
            executions.forEach { execution -> runtime.execute(execution, context, toolbarEventArgs(item)) }
        }
    }
    val description = item.ariaLabel ?: item.tooltip ?: item.label ?: item.id ?: "Action"
    val icon = toolbarIcon(item.icon)
    if (icon != null && (item.hideLabel == true || item.label.isNullOrBlank())) {
        val size = maxOf(sizeOverride ?: 0.dp, styleDp(item, "width") ?: 0.dp, 48.dp)
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
private fun QuickFilter(context: DataSourceContext, item: ToolbarItemDef, disabled: Boolean) {
    val input by context.input.flow.collectAsState(initial = context.input.peek())
    val filterSet = quickFilterSet(context)
    val field = toolbarQuickSearchField(item, filterSet)
    val definition = filterSet?.template?.firstOrNull { it.field == field || it.id == field } ?: filterSet?.template?.firstOrNull()
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
        if (next != current) {
            if (context.dataSource.filterMode.equals("client", ignoreCase = true)) context.input.set(context.input.peek().copy(filter = next))
            else context.setFilter(next)
        }
    }
    OutlinedTextField(
        value = text,
        onValueChange = { text = it },
        enabled = !disabled,
        singleLine = true,
        placeholder = { Text(item.placeholder ?: definition?.placeholder ?: definition?.label ?: "Filter") },
        trailingIcon = { Icon(Icons.Default.Search, contentDescription = "Apply filter") },
        modifier = Modifier.fillMaxWidth()
    )
}

internal fun toolbarItemIsQuickSearch(item: ToolbarItemDef): Boolean =
    item.type.equals("quickSearch", ignoreCase = true) || item.id in setOf("quickFilter", "quickFilterInputs")

internal fun toolbarItemIsAction(item: ToolbarItemDef): Boolean =
    item.on.any { it.event == "onClick" } || item.id.equals("refresh", ignoreCase = true) ||
        item.type.equals("tableExport", ignoreCase = true)

internal fun toolbarBindingField(item: ToolbarItemDef): String =
    item.field?.trim().orEmpty()
        .ifBlank { item.dataField?.trim().orEmpty() }
        .ifBlank { item.id?.trim().orEmpty() }

internal fun toolbarQuickSearchField(item: ToolbarItemDef, filterSet: FilterSetDef?): String {
    val declared = (item.properties["field"] as? JsonPrimitive)?.contentOrNull?.trim().orEmpty()
    return declared.takeIf { it.isNotBlank() }
        ?: filterSet?.defaultField?.takeIf { it.isNotBlank() }
        ?: filterSet?.template?.firstOrNull()?.field?.takeIf { !it.isNullOrBlank() }
        ?: filterSet?.template?.firstOrNull()?.id?.takeIf { !it.isNullOrBlank() }
        ?: "name"
}

internal fun toolbarValuesEquivalent(left: Any?, right: Any?): Boolean {
    if (left == null || right == null) return left == right
    val leftText = left.toString().trim()
    val rightText = right.toString().trim()
    val leftNumber = leftText.toBigDecimalOrNull()
    val rightNumber = rightText.toBigDecimalOrNull()
    return if (leftNumber != null && rightNumber != null) leftNumber.compareTo(rightNumber) == 0
    else leftText == rightText
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
    "export", "upload", "file-upload" -> Icons.Default.FileUpload
    "settings", "customize" -> Icons.Default.Settings
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

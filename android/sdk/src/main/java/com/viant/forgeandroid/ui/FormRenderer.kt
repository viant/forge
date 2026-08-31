package com.viant.forgeandroid.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ExecutionDef
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.ItemDef
import com.viant.forgeandroid.runtime.ParameterDef
import com.viant.forgeandroid.runtime.SelectorUtil
import com.viant.forgeandroid.runtime.formatDashboardValue
import com.viant.forgeandroid.runtime.valueKey
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FormRenderer(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    items: List<ItemDef>,
    validationErrors: Map<String, String> = emptyMap()
) {
    val visibleItems = items.filter(::shouldRenderItem)
    if (visibleItems.isEmpty()) return
    var expandedSummary by remember { mutableStateOf<Pair<String, String>?>(null) }
    val compactPresentation = LocalForgePresentationDensity.current == ForgePresentationDensity.Compact

    val compactSelectGrid = visibleItems.size >= 2 && visibleItems.all { item ->
        item.type?.trim()?.lowercase() in setOf("select", "dropdown")
    }
    if (compactSelectGrid) {
        StaticGrid(
            items = visibleItems,
            minCellWidth = 132.dp,
            minimumColumns = 2,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp)
        ) { item ->
            FormItemRenderer(
                runtime = runtime,
                context = context,
                item = item,
                validationErrors = validationErrors
            )
        }
    } else if (visibleItems.size >= 2 && visibleItems.all(::isSummaryLabelItem)) {
        if (compactPresentation) {
            FlowRow(
                modifier = Modifier.fillMaxWidth().padding(6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                visibleItems.forEach { item ->
                    SummaryItemPill(context = context, item = item) { label, value ->
                        expandedSummary = label to value
                    }
                }
            }
        } else {
            StaticGrid(
                items = visibleItems,
                minCellWidth = 132.dp,
                minimumColumns = 2,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp)
            ) { item ->
                SummaryItemCard(context = context, item = item) { label, value ->
                    expandedSummary = label to value
                }
            }
        }
    } else {
        Column(modifier = Modifier.padding(8.dp)) {
            visibleItems.forEach { item ->
                FormItemRenderer(
                    runtime = runtime,
                    context = context,
                    item = item,
                    validationErrors = validationErrors
                )
            }
        }
    }
    expandedSummary?.let { (label, value) ->
        AlertDialog(
            onDismissRequest = { expandedSummary = null },
            title = { Text(label) },
            text = { Text(value) },
            confirmButton = {
                TextButton(onClick = { expandedSummary = null }) { Text("Done") }
            }
        )
    }
}

@Composable
private fun SummaryItemPill(
    context: DataSourceContext,
    item: ItemDef,
    onExpand: (String, String) -> Unit
) {
    val dataSourceContext = resolveItemDataSourceContext(context, item)
    val form by dataSourceContext.form.flow.collectAsState(initial = emptyMap())
    val metrics by dataSourceContext.metrics.flow.collectAsState(initial = emptyMap())
    val windowFormSignal = dataSourceContext.window.windowFormSignal()
    val windowForm by windowFormSignal.flow.collectAsState(initial = windowFormSignal.peek())
    val key = itemValueKey(item) ?: return
    val label = item.label ?: key
    val value = resolveItemDisplayValue(item, key, form, metrics, windowForm).ifBlank { "—" }
    Text(
        text = "$label: $value",
        style = MaterialTheme.typography.labelMedium,
        fontWeight = FontWeight.Bold,
        color = androidx.compose.ui.graphics.Color(0xFF21538F),
        maxLines = 1,
        modifier = Modifier
            .background(androidx.compose.ui.graphics.Color(0xFFEEF4FB), androidx.compose.foundation.shape.RoundedCornerShape(999.dp))
            .border(1.dp, androidx.compose.ui.graphics.Color(0xFFCFDCED), androidx.compose.foundation.shape.RoundedCornerShape(999.dp))
            .clickable { onExpand(label, value) }
            .padding(horizontal = 12.dp, vertical = 7.dp)
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SegmentedOptionRow(
    modifier: Modifier = Modifier,
    options: List<Pair<String, String>>,
    selectedValue: String? = null,
    selectedValues: Set<String> = emptySet(),
    onSelect: ((String) -> Unit)? = null,
    onToggle: ((String) -> Unit)? = null
) {
    FlowRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        options.forEach { (value, label) ->
            val selected = if (onToggle != null) selectedValues.contains(value) else selectedValue == value
            val shape = androidx.compose.foundation.shape.RoundedCornerShape(999.dp)
            Surface(
                onClick = { onToggle?.invoke(value) ?: onSelect?.invoke(value) },
                shape = shape,
                color = if (selected) Color(0xFFE2E8F0) else Color.Transparent,
                border = if (selected) BorderStroke(1.dp, Color(0xFFCBD5E1)) else null
            ) {
                Text(
                    label,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                    color = if (selected) Color(0xFF1E3F8A) else Color(0xFF607089),
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp)
                )
            }
        }
    }
}

@Composable
private fun SelectMenuItem(
    label: String,
    options: List<Pair<String, String>>,
    selectedValue: String,
    onSelect: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = options.firstOrNull { it.first == selectedValue }?.second
        ?: selectedValue.ifBlank { "Select" }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Box(modifier = Modifier.fillMaxWidth()) {
            OutlinedButton(
                onClick = { expanded = true },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(selectedLabel, modifier = Modifier.weight(1f))
                Icon(Icons.Filled.ArrowDropDown, contentDescription = null)
            }
            DropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false }
            ) {
                options.forEach { (value, optionLabel) ->
                    DropdownMenuItem(
                        text = { Text(optionLabel) },
                        onClick = {
                            expanded = false
                            onSelect(value)
                        }
                    )
                }
            }
        }
    }
}

@Composable
internal fun <T> StaticGrid(
    items: List<T>,
    minCellWidth: Dp,
    modifier: Modifier = Modifier,
    horizontalSpacing: Dp = 12.dp,
    verticalSpacing: Dp = 12.dp,
    minimumColumns: Int = 1,
    content: @Composable (T) -> Unit
) {
    BoxWithConstraints(modifier = modifier) {
        val maxWidthValue = maxWidth
        val autoColumns = if (maxWidthValue <= minCellWidth) {
            1
        } else {
            (((maxWidthValue + horizontalSpacing) / (minCellWidth + horizontalSpacing)).toInt()).coerceAtLeast(1)
        }
        val requestedMinimum = minimumColumns.coerceAtLeast(1)
        val minimumWidth = minCellWidth * requestedMinimum + horizontalSpacing * (requestedMinimum - 1)
        val columns = if (maxWidthValue >= minimumWidth) autoColumns.coerceAtLeast(requestedMinimum) else autoColumns

        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(verticalSpacing)
        ) {
            items.chunked(columns).forEach { rowItems ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(horizontalSpacing)
                ) {
                    rowItems.forEach { item ->
                        Column(modifier = Modifier.weight(1f)) {
                            content(item)
                        }
                    }
                    repeat(columns - rowItems.size) {
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun FormItemRenderer(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    item: ItemDef,
    validationErrors: Map<String, String>
) {
    val dataSourceContext = resolveItemDataSourceContext(context, item)
    val form by dataSourceContext.form.flow.collectAsState(initial = emptyMap())
    val metrics by dataSourceContext.metrics.flow.collectAsState(initial = emptyMap())
    val windowFormSignal = context.window.windowFormSignal()
    val windowForm by windowFormSignal.flow.collectAsState(initial = windowFormSignal.peek())
    val collection by dataSourceContext.collection.flow.collectAsState(initial = dataSourceContext.collection.peek())
    val input by dataSourceContext.input.flow.collectAsState(initial = dataSourceContext.input.peek())
    val selection by dataSourceContext.selection.flow.collectAsState(initial = dataSourceContext.selection.peek())
    val visibleExecutions = item.on.filter { it.event == "onVisible" }
    val callbackVisible by produceState(
        initialValue = true,
        item,
        form,
        metrics,
        windowForm,
        collection,
        input,
        selection
    ) {
        value = visibleExecutions.all { execution ->
            runtime.evaluate(execution, dataSourceContext, mapOf("item" to item)) as? Boolean ?: true
        }
    }
    val metadataVisible = com.viant.forgeandroid.runtime.evaluateDashboardCondition(
        condition = item.visibleWhen,
        metrics = metrics,
        filters = input.filter,
        form = form,
        windowForm = windowForm,
        collection = collection,
        input = mapOf("filter" to input.filter, "parameters" to input.parameters, "page" to input.page),
        selectionValues = mapOf(
            "selected" to selection.selected,
            "selection" to selection.selection,
            "rowIndex" to selection.rowIndex
        )
    )
    if (!callbackVisible || !metadataVisible) return

    LaunchedEffect(dataSourceContext.dataSourceRef) {
        if (dataSourceContext.dataSourceRef != context.dataSourceRef &&
            dataSourceContext.dataSource.autoFetch != false
        ) {
            dataSourceContext.fetchCollection()
        }
    }

    val key = itemValueKey(item) ?: return
    val value = resolveItemValue(item, key, form, metrics, windowForm)
    val validationError = validationErrors[key]
    when (if (item.lookup != null) "lookup" else item.type) {
                "label" -> LabelItemCard(
                    label = item.label ?: key,
                    value = resolveItemDisplayValue(item, key, form, metrics, windowForm)
                )
                "markdown" -> {
                    val markdown = value.ifBlank {
                        (item.properties["value"] as? JsonPrimitive)?.contentOrNull.orEmpty()
                    }
                    MarkdownRenderer(
                        markdown = markdown,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                    )
                }
                "radio" -> {
                    val compactPresentation = LocalForgePresentationDensity.current == ForgePresentationDensity.Compact
                    if (compactPresentation && item.options.size > 5) {
                        SelectMenuItem(
                            label = item.label ?: key,
                            options = item.options.map { option ->
                                option.value.orEmpty() to (option.label ?: option.value.orEmpty())
                            },
                            selectedValue = value,
                            onSelect = { optVal -> setScopedItemValue(runtime, dataSourceContext, item, key, optVal) }
                        )
                    } else if ((compactPresentation || item.appearance?.trim()?.equals("segmented", ignoreCase = true) == true) &&
                        item.options.isNotEmpty()
                    ) {
                        SegmentedOptionRow(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 2.dp),
                            options = item.options.map { option ->
                                option.value.orEmpty() to (option.label ?: option.value.orEmpty())
                            },
                            selectedValue = value,
                            onSelect = { optVal ->
                                setScopedItemValue(runtime, dataSourceContext, item, key, optVal)
                            }
                        )
                    } else {
                        Column(modifier = Modifier.padding(4.dp)) {
                            Text(item.label ?: key)
                            item.options.forEach { option ->
                                val optVal = option.value ?: ""
                                RowRadio(option.label ?: optVal, value == optVal) {
                                    setScopedItemValue(runtime, dataSourceContext, item, key, optVal)
                                }
                            }
                        }
                    }
                }
                "select", "dropdown" -> {
                    SelectMenuItem(
                        label = item.label ?: key,
                        options = item.options.map { option ->
                            option.value.orEmpty() to (option.label ?: option.value.orEmpty())
                        },
                        selectedValue = value,
                        onSelect = { optVal ->
                            setScopedItemValue(runtime, dataSourceContext, item, key, optVal)
                        }
                    )
                }
                "multiSelect" -> {
                    val selectedValues = when (val raw = resolveItemRawValue(item, key, form, metrics, windowForm)) {
                        is List<*> -> raw.mapNotNull { it?.toString() }
                        is String -> listOf(raw)
                        else -> emptyList()
                    }
                    Column(modifier = Modifier.padding(4.dp)) {
                        Text(item.label ?: key)
                        SegmentedOptionRow(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 4.dp),
                            options = item.options.map { option ->
                                option.value.orEmpty() to (option.label ?: option.value.orEmpty())
                            },
                            selectedValues = selectedValues.toSet(),
                            onToggle = { optVal ->
                                val selected = selectedValues.contains(optVal)
                                val next = selectedValues.toMutableList().apply {
                                    if (selected) {
                                        removeAll { it == optVal }
                                    } else {
                                        add(optVal)
                                    }
                                }
                                setScopedItemValue(runtime, dataSourceContext, item, key, next)
                            }
                        )
                    }
                }
                "object", "schema" -> {
                    val content = value.ifBlank {
                        (item.properties["value"] as? JsonPrimitive)?.contentOrNull.orEmpty()
                    }
                    OutlinedTextField(
                        value = prettyJson(content),
                        onValueChange = { setScopedItemValue(runtime, dataSourceContext, item, key, it) },
                        label = { Text(item.label ?: key) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        textStyle = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                        minLines = 8
                    )
                }
                "textarea" -> {
                    val compactPresentation = LocalForgePresentationDensity.current == ForgePresentationDensity.Compact
                    OutlinedTextField(
                        value = value,
                        onValueChange = { setScopedItemValue(runtime, dataSourceContext, item, key, it) },
                        label = { Text(item.label ?: key) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        minLines = if (compactPresentation) 3 else 5,
                        textStyle = if (compactPresentation) MaterialTheme.typography.bodyMedium else MaterialTheme.typography.bodyLarge
                    )
                }
                "dateRange" -> {
                    val raw = resolveItemRawValue(item, key, form, metrics, windowForm) as? Map<*, *> ?: emptyMap<String, Any?>()
                    val start = raw["start"]?.toString().orEmpty()
                    val end = raw["end"]?.toString().orEmpty()
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(vertical = 2.dp)) {
                        Text(item.label ?: key, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Row(
                            modifier = Modifier.horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            DateRangeInput(
                                value = start,
                                onValueChange = { next -> setScopedItemValue(runtime, dataSourceContext, item, key, mapOf("start" to next, "end" to end)) },
                                placeholder = "Start",
                                pickerEnabled = true
                            )
                            DateRangeInput(
                                value = end,
                                onValueChange = { next -> setScopedItemValue(runtime, dataSourceContext, item, key, mapOf("start" to start, "end" to next)) },
                                placeholder = "End",
                                pickerEnabled = true
                            )
                        }
                    }
                }
                "lookup" -> {
                    val lookup = item.lookup ?: item.properties["lookup"]
                    val display = lookupDisplayValue(lookup, form, value)
                    val compactPresentation = LocalForgePresentationDensity.current == ForgePresentationDensity.Compact
                    if (compactPresentation) {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(3.dp)
                        ) {
                            Text(
                                item.label ?: key,
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                CompactTextInputSurface(
                                    value = value,
                                    onValueChange = { setScopedItemValue(runtime, dataSourceContext, item, key, it) },
                                    modifier = Modifier.weight(1f),
                                    backgroundColor = Color(0xFFEEF8F1)
                                )
                                IconButton(
                                    onClick = { openLookup(runtime, dataSourceContext, item, lookup) },
                                    enabled = lookupDialogId(lookup) != null,
                                    modifier = Modifier.size(40.dp)
                                ) {
                                    Icon(Icons.Filled.Search, contentDescription = "Open lookup")
                                }
                            }
                        }
                    } else {
                        Row(modifier = Modifier.fillMaxWidth()) {
                            OutlinedTextField(
                                value = value,
                                onValueChange = { setScopedItemValue(runtime, dataSourceContext, item, key, it) },
                                label = { Text(item.label ?: key) },
                                modifier = Modifier
                                    .weight(1f)
                                    .padding(vertical = 4.dp)
                            )
                            IconButton(
                                onClick = { openLookup(runtime, dataSourceContext, item, lookup) },
                                enabled = lookupDialogId(lookup) != null,
                                modifier = Modifier.padding(top = 8.dp)
                            ) {
                                Icon(Icons.Filled.Search, contentDescription = "Open lookup")
                            }
                        }
                    }
                    if (!display.isNullOrBlank() && display != value) {
                        Text(
                            text = display,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(start = 4.dp, bottom = 4.dp)
                        )
                    }
                }
                "checkbox", "toggle" -> {
                    val checked = when (val raw = resolveItemRawValue(item, key, form, metrics, windowForm)) {
                        is Boolean -> raw
                        is Number -> raw.toInt() != 0
                        else -> raw?.toString()?.equals("true", ignoreCase = true) == true
                    }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 6.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(item.label ?: key)
                        Switch(
                            checked = checked,
                            onCheckedChange = { setScopedItemValue(runtime, dataSourceContext, item, key, it) }
                        )
                    }
                }
                else -> {
                    val compactPresentation = LocalForgePresentationDensity.current == ForgePresentationDensity.Compact
                    if (compactPresentation) {
                        CompactLabeledTextInput(
                            label = item.label ?: key,
                            value = value,
                            onValueChange = { setScopedItemValue(runtime, dataSourceContext, item, key, it) }
                        )
                    } else {
                        OutlinedTextField(
                            value = value,
                            onValueChange = { setScopedItemValue(runtime, dataSourceContext, item, key, it) },
                            label = { Text(item.label ?: key) },
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                        )
                    }
                }
            }
    if (!validationError.isNullOrBlank()) {
        Text(
            text = validationError,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(start = 4.dp, bottom = 4.dp)
        )
    }
}

@Composable
private fun CompactLabeledTextInput(
    label: String,
    value: String,
    onValueChange: (String) -> Unit
) {
    val shape = androidx.compose.foundation.shape.RoundedCornerShape(10.dp)
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        CompactTextInputSurface(value, onValueChange, Modifier.fillMaxWidth(), shape)
    }
}

@Composable
private fun CompactTextInputSurface(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    shape: androidx.compose.ui.graphics.Shape = androidx.compose.foundation.shape.RoundedCornerShape(10.dp),
    backgroundColor: Color = Color.White,
) {
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        singleLine = true,
        textStyle = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurface),
        modifier = modifier
            .background(backgroundColor, shape)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape)
            .padding(horizontal = 11.dp, vertical = 9.dp)
    )
}

@Composable
private fun SummaryItemCard(
    context: DataSourceContext,
    item: ItemDef,
    onExpand: (String, String) -> Unit
) {
    val dataSourceContext = resolveItemDataSourceContext(context, item)
    val form by dataSourceContext.form.flow.collectAsState(initial = emptyMap())
    val metrics by dataSourceContext.metrics.flow.collectAsState(initial = emptyMap())
    val windowFormSignal = dataSourceContext.window.windowFormSignal()
    val windowForm by windowFormSignal.flow.collectAsState(initial = windowFormSignal.peek())
    val key = itemValueKey(item) ?: return
    val value = resolveItemDisplayValue(item, key, form, metrics, windowForm)
    LabelItemCard(
        label = item.label ?: key,
        value = value,
        emphasized = true,
        onClick = { onExpand(item.label ?: key, value.ifBlank { "—" }) }
    )
}

@Composable
private fun LabelItemCard(
    label: String,
    value: String,
    emphasized: Boolean = false,
    onClick: (() -> Unit)? = null
) {
    Surface(
        tonalElevation = 1.dp,
        shadowElevation = if (emphasized) 1.dp else 0.dp,
        shape = MaterialTheme.shapes.large,
        modifier = Modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
    ) {
        BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
            val compact = maxWidth < 120.dp
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(
                        horizontal = if (compact) 9.dp else 14.dp,
                        vertical = if (compact) 9.dp else 12.dp
                    )
            ) {
                Text(
                    text = label,
                    style = if (compact) MaterialTheme.typography.labelSmall else MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = value.ifBlank { "—" },
                    style = when {
                        compact && emphasized -> MaterialTheme.typography.titleSmall
                        emphasized -> MaterialTheme.typography.titleMedium
                        else -> MaterialTheme.typography.bodyLarge
                    },
                    fontWeight = if (emphasized) FontWeight.SemiBold else FontWeight.Normal,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(top = if (compact) 4.dp else 6.dp)
                )
            }
        }
    }
}

private fun openLookup(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    item: ItemDef,
    lookup: JsonElement?
) {
    val dialogId = lookupDialogId(lookup) ?: return
    val execution = ExecutionDef(
        handler = "window.openDialog",
        args = listOf(dialogId),
        parameters = lookupParameters(lookup)
    )
    runtime.execute(
        execution,
        context,
        mapOf(
            "windowId" to context.window.windowId,
            "selectionMode" to if (lookupMultiple(lookup)) "multi" else "single",
            "multiple" to lookupMultiple(lookup)
        )
    )
}

private fun lookupDialogId(lookup: JsonElement?): String? {
    return ((lookup as? JsonObject)?.get("dialogId") as? JsonPrimitive)
        ?.contentOrNull
        ?.trim()
        ?.takeIf { it.isNotEmpty() }
}

private fun lookupMultiple(lookup: JsonElement?): Boolean {
    return ((lookup as? JsonObject)?.get("multiple") as? JsonPrimitive)?.booleanOrNull ?: false
}

private fun lookupParameters(lookup: JsonElement?): List<ParameterDef> {
    val obj = lookup as? JsonObject ?: return emptyList()
    val inputParams = lookupParameterArray(obj["inputs"]).mapNotNull { entry ->
        val name = lookupString(entry["name"]) ?: lookupString(entry["location"]) ?: return@mapNotNull null
        ParameterDef(
            name = name,
            input = "form",
            location = lookupString(entry["location"]) ?: name
        )
    }
    val outputParams = lookupParameterArray(obj["outputs"]).mapNotNull { entry ->
        val name = lookupString(entry["name"]) ?: lookupString(entry["location"]) ?: return@mapNotNull null
        ParameterDef(
            name = name,
            direction = "out",
            output = true,
            location = lookupString(entry["location"]) ?: name,
            to = ":form"
        )
    }
    return inputParams + outputParams
}

private fun lookupParameterArray(value: JsonElement?): List<JsonObject> {
    return (value as? JsonArray).orEmpty().mapNotNull { it as? JsonObject }
}

private fun lookupString(value: JsonElement?): String? {
    return (value as? JsonPrimitive)?.contentOrNull?.trim()?.takeIf { it.isNotEmpty() }
}

internal fun lookupDisplayValue(
    lookup: JsonElement?,
    form: Map<String, Any?>,
    fallback: String = ""
): String? {
    val display = lookupString((lookup as? JsonObject)?.get("display")) ?: return null
    var resolvedAnyPlaceholder = false
    val rendered = interpolateLookupTemplate(display) { selector ->
        val text = SelectorUtil.resolve(form, selector)?.toString().orEmpty()
        if (text.isNotBlank()) {
            resolvedAnyPlaceholder = true
        }
        text
    }.trim()
    if (rendered.isNotEmpty() && resolvedAnyPlaceholder) {
        return rendered
    }
    return fallback.trim().takeIf { it.isNotEmpty() }
}

private fun interpolateLookupTemplate(template: String, resolve: (String) -> String): String {
    val out = StringBuilder(template.length)
    var index = 0
    while (index < template.length) {
        if (template.startsWith("\${", index)) {
            val close = template.indexOf('}', startIndex = index + 2)
            if (close >= 0) {
                out.append(resolve(template.substring(index + 2, close).trim()))
                index = close + 1
                continue
            }
        }
        if (template.startsWith("{{", index)) {
            val close = template.indexOf("}}", startIndex = index + 2)
            if (close >= 0) {
                out.append(resolve(template.substring(index + 2, close).trim()))
                index = close + 2
                continue
            }
        }
        out.append(template[index])
        index += 1
    }
    return out.toString()
}

internal fun resolveItemDataSourceContext(
    context: DataSourceContext,
    item: ItemDef
): DataSourceContext {
    val direct = item.dataSourceRef?.trim().orEmpty().takeIf { it.isNotEmpty() }
    val mapped = if (direct == null && item.dataSourceRefs.isNotEmpty()) {
        val source = item.dataSourceRefSource?.trim().orEmpty().ifBlank { "windowForm" }
        val selector = item.dataSourceRefSelector?.trim().orEmpty()
        val key = when (source.lowercase()) {
            "windowform" -> SelectorUtil.resolve(context.window.peekWindowForm(), selector)?.toString()
            else -> null
        }?.trim().orEmpty()
        item.dataSourceRefs[key] ?: item.dataSourceRefs.values.firstOrNull()
    } else {
        null
    }
    val ref = direct ?: mapped ?: context.dataSourceRef
    return if (ref == context.dataSourceRef) context else context.window.context(ref)
}

internal fun resolveItemRawValue(
    item: ItemDef,
    key: String,
    form: Map<String, Any?>,
    metrics: Map<String, Any?>,
    windowForm: Map<String, Any?>,
    collection: List<Map<String, Any?>> = emptyList()
): Any? {
    return when (item.scope?.trim()?.lowercase()) {
        "metrics" -> SelectorUtil.resolve(metrics, key)
            ?: SelectorUtil.resolve(collection.firstOrNull().orEmpty(), key)
        "windowform" -> SelectorUtil.resolve(windowForm, key)
        else -> SelectorUtil.resolve(form, key)
    }
}

internal fun resolveItemValue(
    item: ItemDef,
    key: String,
    form: Map<String, Any?>,
    metrics: Map<String, Any?>,
    windowForm: Map<String, Any?>,
    collection: List<Map<String, Any?>> = emptyList()
): String {
    return resolveItemRawValue(item, key, form, metrics, windowForm, collection)?.toString().orEmpty()
}

internal fun resolveItemDisplayValue(
    item: ItemDef,
    key: String,
    form: Map<String, Any?>,
    metrics: Map<String, Any?>,
    windowForm: Map<String, Any?>,
    collection: List<Map<String, Any?>> = emptyList()
): String {
    val raw = resolveItemRawValue(item, key, form, metrics, windowForm, collection)
    if (raw is Map<*, *> && raw.containsKey("start") && raw.containsKey("end")) {
        return listOf(raw["start"], raw["end"])
            .mapNotNull { it?.toString()?.takeIf(String::isNotBlank) }
            .joinToString(" – ")
    }
    return if (raw == null) "" else formatDashboardValue(raw, item.format)
}

internal fun setScopedItemValue(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    item: ItemDef,
    key: String,
    value: Any?
) {
    when (item.scope?.trim()?.lowercase()) {
        "windowform" -> runtime.setWindowFormValues(context.window.windowId, mapOf(key to value))
        else -> context.setFormField(key, value)
    }
    runtime.emitInteraction(
        kind = "feed.form_changed",
        windowId = context.window.windowId,
        dataSourceRef = context.dataSourceRef,
        detail = mapOf(
            "field" to key,
            "scope" to (item.scope ?: "form"),
            "controlType" to item.type,
            "value" to value
        )
    )
    val eventOrder = when (item.type?.trim()?.lowercase()) {
        "number", "numeric", "currency" -> listOf("onValueChange", "onChange", "onInput")
        "multiselect" -> listOf("onChange", "onSelection", "onItemSelect")
        else -> listOf("onChange", "onInput", "onValueChange", "onSelection", "onItemSelect")
    }
    val execution = eventOrder.firstNotNullOfOrNull { event -> item.on.firstOrNull { it.event == event } }
    if (execution != null) {
        runtime.execute(
            execution,
            context,
            mapOf("item" to item, "value" to value, "selected" to value)
        )
    }
}

internal fun shouldRenderItem(item: ItemDef): Boolean {
    return listOf(item.id, item.label, item.dataField, item.bindingPath, item.field)
        .any { !it.isNullOrBlank() }
}

internal fun isSummaryLabelItem(item: ItemDef): Boolean {
    val type = item.type?.trim()?.lowercase().orEmpty()
    return type.isEmpty() || type == "label"
}

internal fun itemValueKey(item: ItemDef): String? {
    return item.valueKey()
}

@Composable
private fun RowRadio(label: String, selected: Boolean, onSelect: () -> Unit) {
    androidx.compose.foundation.layout.Row(modifier = Modifier.padding(2.dp)) {
        RadioButton(selected = selected, onClick = onSelect)
        Text(text = label)
    }
}

private fun prettyJson(value: String): String {
    val trimmed = value.trim()
    if (trimmed.isEmpty()) return ""
    return runCatching {
        val element = kotlinx.serialization.json.Json.parseToJsonElement(trimmed)
        kotlinx.serialization.json.Json { prettyPrint = true }.encodeToString(
            kotlinx.serialization.json.JsonElement.serializer(),
            element
        )
    }.getOrDefault(value)
}

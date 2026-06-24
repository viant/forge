package com.viant.forgeandroid.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
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
import com.viant.forgeandroid.runtime.valueKey
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull

@Composable
fun FormRenderer(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    items: List<ItemDef>,
    validationErrors: Map<String, String> = emptyMap()
) {
    val visibleItems = items.filter(::shouldRenderItem)
    if (visibleItems.isEmpty()) return

    if (visibleItems.size >= 2 && visibleItems.all(::isSummaryLabelItem)) {
        StaticGrid(
            items = visibleItems,
            minCellWidth = 180.dp,
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp)
        ) { item ->
            SummaryItemCard(context = context, item = item)
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
            FilterChip(
                selected = selected,
                onClick = { onToggle?.invoke(value) ?: onSelect?.invoke(value) },
                label = { Text(label, style = MaterialTheme.typography.bodySmall) }
            )
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
    content: @Composable (T) -> Unit
) {
    BoxWithConstraints(modifier = modifier) {
        val maxWidthValue = maxWidth
        val columns = if (maxWidthValue <= minCellWidth) {
            1
        } else {
            (((maxWidthValue + horizontalSpacing) / (minCellWidth + horizontalSpacing)).toInt()).coerceAtLeast(1)
        }

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

    LaunchedEffect(dataSourceContext.dataSourceRef) {
        if (dataSourceContext.dataSource.autoFetch != false) {
            dataSourceContext.fetchCollection()
        }
    }

    val key = itemValueKey(item) ?: return
    val value = resolveItemValue(item, key, form, metrics, windowForm)
    val validationError = validationErrors[key]
    when (item.type) {
                "label" -> LabelItemCard(label = item.label ?: key, value = value)
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
                    if (item.appearance?.trim()?.equals("segmented", ignoreCase = true) == true &&
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
                    OutlinedTextField(
                        value = value,
                        onValueChange = { setScopedItemValue(runtime, dataSourceContext, item, key, it) },
                        label = { Text(item.label ?: key) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        minLines = 5
                    )
                }
                "lookup" -> {
                    val lookup = item.properties["lookup"]
                    val display = lookupDisplayValue(lookup, form, value)
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
                    if (!display.isNullOrBlank() && display != value) {
                        Text(
                            text = display,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(start = 4.dp, bottom = 4.dp)
                        )
                    }
                }
                else -> {
                    OutlinedTextField(
                        value = value,
                        onValueChange = { setScopedItemValue(runtime, dataSourceContext, item, key, it) },
                        label = { Text(item.label ?: key) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                    )
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
private fun SummaryItemCard(
    context: DataSourceContext,
    item: ItemDef
) {
    val dataSourceContext = resolveItemDataSourceContext(context, item)
    val form by dataSourceContext.form.flow.collectAsState(initial = emptyMap())
    val metrics by dataSourceContext.metrics.flow.collectAsState(initial = emptyMap())
    val windowFormSignal = dataSourceContext.window.windowFormSignal()
    val windowForm by windowFormSignal.flow.collectAsState(initial = windowFormSignal.peek())
    val key = itemValueKey(item) ?: return
    val value = resolveItemValue(item, key, form, metrics, windowForm)
    LabelItemCard(label = item.label ?: key, value = value, emphasized = true)
}

@Composable
private fun LabelItemCard(
    label: String,
    value: String,
    emphasized: Boolean = false
) {
    Surface(
        tonalElevation = 1.dp,
        shadowElevation = if (emphasized) 1.dp else 0.dp,
        shape = MaterialTheme.shapes.large,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp)
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = value.ifBlank { "—" },
                style = if (emphasized) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyLarge,
                fontWeight = if (emphasized) FontWeight.SemiBold else FontWeight.Normal,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(top = 6.dp)
            )
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

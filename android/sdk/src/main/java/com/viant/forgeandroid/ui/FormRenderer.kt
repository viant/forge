package com.viant.forgeandroid.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.ItemDef
import com.viant.forgeandroid.runtime.SelectorUtil
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

@Composable
fun FormRenderer(runtime: ForgeRuntime, context: DataSourceContext, items: List<ItemDef>) {
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
                FormItemRenderer(runtime = runtime, context = context, item = item)
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
    item: ItemDef
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

    val key = item.dataField ?: item.bindingPath ?: item.id ?: return
    val value = resolveItemValue(item, key, form, metrics, windowForm)
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
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState())
                                .padding(vertical = 4.dp)
                        ) {
                            item.options.forEach { option ->
                                val optVal = option.value ?: ""
                                FilterChip(
                                    selected = value == optVal,
                                    onClick = {
                                        setScopedItemValue(runtime, dataSourceContext, item, key, optVal)
                                    },
                                    label = { Text(option.label ?: optVal) },
                                    modifier = Modifier.padding(end = 8.dp)
                                )
                            }
                        }
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
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState())
                                .padding(top = 6.dp)
                        ) {
                            item.options.forEach { option ->
                                val optVal = option.value ?: ""
                                val selected = selectedValues.contains(optVal)
                                FilterChip(
                                    selected = selected,
                                    onClick = {
                                        val next = selectedValues.toMutableList().apply {
                                            if (selected) {
                                                removeAll { it == optVal }
                                            } else {
                                                add(optVal)
                                            }
                                        }
                                        setScopedItemValue(runtime, dataSourceContext, item, key, next)
                                    },
                                    label = { Text(option.label ?: optVal) },
                                    modifier = Modifier.padding(end = 8.dp)
                                )
                            }
                        }
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
    val key = item.dataField ?: item.bindingPath ?: item.id ?: return
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
    windowForm: Map<String, Any?>
): Any? {
    return when (item.scope?.trim()?.lowercase()) {
        "metrics" -> SelectorUtil.resolve(metrics, key)
        "windowform" -> SelectorUtil.resolve(windowForm, key)
        else -> SelectorUtil.resolve(form, key)
    }
}

internal fun resolveItemValue(
    item: ItemDef,
    key: String,
    form: Map<String, Any?>,
    metrics: Map<String, Any?>,
    windowForm: Map<String, Any?>
): String {
    return resolveItemRawValue(item, key, form, metrics, windowForm)?.toString().orEmpty()
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
    return !(item.id ?: item.label ?: item.dataField ?: item.bindingPath).isNullOrBlank()
}

internal fun isSummaryLabelItem(item: ItemDef): Boolean {
    val type = item.type?.trim()?.lowercase().orEmpty()
    return type.isEmpty() || type == "label"
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

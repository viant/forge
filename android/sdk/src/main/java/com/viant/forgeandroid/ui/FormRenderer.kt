package com.viant.forgeandroid.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.ItemDef
import com.viant.forgeandroid.runtime.SelectorUtil
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

@Composable
fun FormRenderer(runtime: ForgeRuntime, context: DataSourceContext, items: List<ItemDef>) {
    Column(modifier = Modifier.padding(8.dp)) {
        items.forEach { item ->
            FormItemRenderer(runtime = runtime, context = context, item = item)
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
                "label" -> Text(text = "${item.label ?: key}: $value")
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

private fun resolveItemDataSourceContext(
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

private fun resolveItemRawValue(
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

private fun resolveItemValue(
    item: ItemDef,
    key: String,
    form: Map<String, Any?>,
    metrics: Map<String, Any?>,
    windowForm: Map<String, Any?>
): String {
    return resolveItemRawValue(item, key, form, metrics, windowForm)?.toString().orEmpty()
}

private fun setScopedItemValue(
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

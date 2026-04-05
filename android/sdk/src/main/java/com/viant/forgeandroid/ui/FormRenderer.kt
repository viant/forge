package com.viant.forgeandroid.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ItemDef
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

@Composable
@Suppress("UNUSED_PARAMETER")
fun FormRenderer(_runtime: com.viant.forgeandroid.runtime.ForgeRuntime, context: DataSourceContext, items: List<ItemDef>) {
    val form by context.form.flow.collectAsState(initial = emptyMap())
    Column(modifier = Modifier.padding(8.dp)) {
        items.forEach { item ->
            val key = item.dataField ?: item.bindingPath ?: item.id ?: return@forEach
            val value = form[key]?.toString() ?: ""
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
                                context.setFormField(key, optVal)
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
                        onValueChange = { context.setFormField(key, it) },
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
                        onValueChange = { context.setFormField(key, it) },
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
                        onValueChange = { context.setFormField(key, it) },
                        label = { Text(item.label ?: key) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                    )
                }
            }
        }
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

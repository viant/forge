package com.viant.forgeandroid.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ItemDef

@Composable
fun FormRenderer(runtime: com.viant.forgeandroid.runtime.ForgeRuntime, context: DataSourceContext, items: List<ItemDef>) {
    val form by context.form.flow.collectAsState(initial = emptyMap())
    Column(modifier = Modifier.padding(8.dp)) {
        items.forEach { item ->
            val key = item.dataField ?: item.bindingPath ?: item.id ?: return@forEach
            val value = form[key]?.toString() ?: ""
            when (item.type) {
                "label" -> Text(text = "${item.label ?: key}: $value")
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

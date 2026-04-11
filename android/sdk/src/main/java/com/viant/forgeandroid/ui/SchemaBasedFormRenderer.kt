package com.viant.forgeandroid.ui

import androidx.compose.runtime.Composable
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.ItemDef
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

private val schemaJson = Json { ignoreUnknownKeys = true }

@Composable
fun SchemaBasedFormRenderer(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    container: ContainerDef
) {
    val form = container.schemaBasedForm ?: return
    val items = schemaBasedFormItems(form.schema, form.fields)
    FormRenderer(runtime, context, items)
}

private fun schemaBasedFormItems(
    schema: JsonElement?,
    explicitFields: List<com.viant.forgeandroid.runtime.FormFieldDef>
): List<ItemDef> {
    if (explicitFields.isNotEmpty()) {
        return explicitFields.map { field ->
            ItemDef(
                id = field.name,
                dataField = field.name,
                label = field.label ?: field.name,
                type = schemaWidgetToItemType(field.widget, field.type),
                options = field.enum.map { option ->
                    com.viant.forgeandroid.runtime.OptionDef(
                        value = option,
                        label = option
                    )
                }
            )
        }
    }
    val schemaObject = when (schema) {
        is JsonObject -> schema
        is JsonPrimitive -> runCatching { schemaJson.parseToJsonElement(schema.content) as? JsonObject }.getOrNull()
        else -> null
    } ?: return emptyList()

    val properties = schemaObject["properties"] as? JsonObject ?: return emptyList()
    return properties.map { (name, value) ->
        val property = value as? JsonObject ?: JsonObject(emptyMap())
        val widget = (property["x-ui-widget"] as? JsonPrimitive)?.content
        val type = (property["type"] as? JsonPrimitive)?.content
        val enumValues = (property["enum"] as? JsonArray).orEmpty().mapNotNull { (it as? JsonPrimitive)?.content }
        val defaultValue = property["default"]
        ItemDef(
            id = name,
            dataField = name,
            label = (property["title"] as? JsonPrimitive)?.content ?: name,
            type = schemaWidgetToItemType(widget, type),
            options = enumValues.map { option ->
                com.viant.forgeandroid.runtime.OptionDef(
                    value = option,
                    label = option,
                    default = when (defaultValue) {
                        is JsonPrimitive -> defaultValue.content == option
                        is JsonArray -> defaultValue.any { (it as? JsonPrimitive)?.content == option }
                        else -> false
                    }
                )
            }
        )
    }
}

private fun schemaWidgetToItemType(widget: String?, type: String?): String {
    return when ((widget ?: type).orEmpty()) {
        "radio" -> "radio"
        "multiSelect" -> "multiSelect"
        "textarea" -> "textarea"
        else -> "text"
    }
}

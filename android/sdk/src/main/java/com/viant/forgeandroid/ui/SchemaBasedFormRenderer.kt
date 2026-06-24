package com.viant.forgeandroid.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.FormFieldDef
import com.viant.forgeandroid.runtime.ItemDef
import com.viant.forgeandroid.runtime.SelectorUtil
import com.viant.forgeandroid.runtime.valueKey
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject

private val schemaJson = Json { ignoreUnknownKeys = true }

@Composable
fun SchemaBasedFormRenderer(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    container: ContainerDef,
    onSubmit: ((Map<String, Any?>) -> Unit)? = null
) {
    val form = container.schemaBasedForm ?: return
    val formState by context.form.flow.collectAsState(initial = context.peekForm())
    val schema = resolveSchemaBasedFormSchema(form.schema, formState, form.dataBinding)
    val items = schemaBasedFormItems(schema, form.fields)
    var validationErrors by remember(form.id, container.id) {
        mutableStateOf(emptyMap<String, String>())
    }
    Column {
        FormRenderer(runtime, context, items, validationErrors)
        if (form.showSubmit != false && items.isNotEmpty() && onSubmit != null) {
            Button(
                onClick = {
                    val result = schemaFormSubmission(items, context.peekForm())
                    validationErrors = result.errors
                    if (result.errors.isEmpty()) {
                        onSubmit(result.payload)
                    }
                },
                modifier = Modifier.padding(start = 8.dp, top = 4.dp)
            ) {
                Text("Submit")
            }
        }
    }
}

internal data class SchemaFormSubmission(
    val payload: Map<String, Any?>,
    val errors: Map<String, String>
)

internal fun schemaBasedFormItems(
    schema: JsonElement?,
    explicitFields: List<FormFieldDef>
): List<ItemDef> {
    if (explicitFields.isNotEmpty()) {
        return explicitFields.mapNotNull { field ->
            val key = field.name?.trim()?.takeIf { it.isNotEmpty() }
                ?: field.label?.trim()?.takeIf { it.isNotEmpty() }
                ?: return@mapNotNull null
            val label = field.label?.trim()?.takeIf { it.isNotEmpty() } ?: key
            ItemDef(
                id = key,
                dataField = key,
                label = label,
                type = schemaWidgetToItemType(field.widget, field.type, field.enum.isNotEmpty(), field.lookup),
                required = field.required,
                options = field.enum.map { option ->
                    com.viant.forgeandroid.runtime.OptionDef(
                        value = option,
                        label = option
                    )
                },
                properties = mapOfLookup(field.lookup)
            )
        }
    }
    val schemaObject = when (schema) {
        is JsonObject -> schema
        is JsonPrimitive -> runCatching { schemaJson.parseToJsonElement(schema.content) as? JsonObject }.getOrNull()
        else -> null
    } ?: return emptyList()

    val properties = schemaObject["properties"] as? JsonObject ?: return emptyList()
    val required = (schemaObject["required"] as? JsonArray)
        .orEmpty()
        .mapNotNull { (it as? JsonPrimitive)?.content }
        .toSet()
    return properties.entries
        .sortedWith(
            compareBy<Map.Entry<String, JsonElement>> { (_, value) ->
                schemaFieldOrder(value as? JsonObject)
            }.thenBy { it.key }
        )
        .map { (name, value) ->
            val property = value as? JsonObject ?: JsonObject(emptyMap())
            val widget = (property["x-ui-widget"] as? JsonPrimitive)?.content
            val type = (property["type"] as? JsonPrimitive)?.content
            val lookup = property["lookup"]
            val enumValues = (property["enum"] as? JsonArray).orEmpty().mapNotNull { (it as? JsonPrimitive)?.content }
            val defaultValue = property["default"]
            ItemDef(
                id = name,
                dataField = name,
                label = (property["title"] as? JsonPrimitive)?.content ?: name,
                type = schemaWidgetToItemType(widget, type, enumValues.isNotEmpty(), lookup),
                required = required.contains(name),
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
                },
                properties = mapOfLookup(lookup)
            )
        }
}

internal fun schemaFormValidationErrors(
    items: List<ItemDef>,
    payload: Map<String, Any?>
): Map<String, String> {
    return items.fold(mutableMapOf<String, String>()) { errors, item ->
        val key = itemValidationKey(item) ?: return@fold errors
        val value = itemPayloadValue(payload, key)
        if (item.required == true && isMissingFormValue(value)) {
            errors[key] = "Required"
            return@fold errors
        }
        val options = item.options.mapNotNull { option ->
            option.value?.takeIf { it.isNotBlank() } ?: option.label?.takeIf { it.isNotBlank() }
        }
        if (options.isEmpty() || isMissingFormValue(value)) {
            return@fold errors
        }
        if (invalidOptionValue(value, options)) {
            errors[key] = "Invalid value"
        }
        errors
    }
}

internal fun schemaFormSubmission(
    items: List<ItemDef>,
    formState: Map<String, Any?>
): SchemaFormSubmission {
    return SchemaFormSubmission(
        payload = schemaFormPayload(items, formState),
        errors = schemaFormValidationErrors(items, formState)
    )
}

private fun schemaFieldOrder(property: JsonObject?): Double {
    val value = property?.get("x-ui-order") as? JsonPrimitive ?: return 0.0
    return value.content.toDoubleOrNull() ?: 0.0
}

internal fun resolveSchemaBasedFormSchema(
    inlineSchema: JsonElement?,
    formState: Map<String, Any?>,
    dataBinding: String?
): JsonElement? {
    if (inlineSchema != null) return inlineSchema
    val selector = dataBinding?.trim()?.takeIf { it.isNotEmpty() } ?: "schema"
    return anyToJsonElement(SelectorUtil.resolve(formState, selector))
}

private fun anyToJsonElement(value: Any?): JsonElement? {
    return when (value) {
        null -> null
        is JsonElement -> value
        is Map<*, *> -> buildJsonObject {
            value.forEach { (key, child) ->
                val name = key as? String ?: return@forEach
                put(name, anyToJsonElement(child) ?: JsonNull)
            }
        }
        is List<*> -> buildJsonArray {
            value.forEach { child -> add(anyToJsonElement(child) ?: JsonNull) }
        }
        is String -> runCatching { schemaJson.parseToJsonElement(value) }
            .getOrElse { JsonPrimitive(value) }
        is Number -> JsonPrimitive(value)
        is Boolean -> JsonPrimitive(value)
        else -> JsonPrimitive(value.toString())
    }
}

private fun schemaWidgetToItemType(widget: String?, type: String?, hasEnum: Boolean, lookup: JsonElement? = null): String {
    val normalizedWidget = widget?.trim().orEmpty()
    val normalizedType = type?.trim().orEmpty()
    return when ((normalizedWidget.ifBlank { normalizedType })) {
        "lookup", "treeLookup" -> "lookup"
        "radio" -> "radio"
        "multiSelect" -> "multiSelect"
        "multiselect" -> "multiSelect"
        "select", "dropdown" -> "radio"
        "textarea" -> "textarea"
        "array" -> if (hasEnum) "multiSelect" else "text"
        else -> if (lookup is JsonObject) "lookup" else if (hasEnum) "radio" else "text"
    }
}

private fun mapOfLookup(lookup: JsonElement?): Map<String, JsonElement> {
    return if (lookup == null) emptyMap() else mapOf("lookup" to lookup)
}

private fun itemValidationKey(item: ItemDef): String? {
    return item.valueKey()
}

private fun itemPayloadValue(payload: Map<String, Any?>, key: String): Any? {
    return if (payload.containsKey(key)) payload[key] else SelectorUtil.resolve(payload, key)
}

private fun schemaFormPayload(items: List<ItemDef>, formState: Map<String, Any?>): Map<String, Any?> {
    return items.mapNotNull { item ->
        val key = itemValidationKey(item) ?: return@mapNotNull null
        val value = itemPayloadValue(formState, key)
        if (isMissingFormValue(value)) null else key to value
    }.toMap()
}

private fun isMissingFormValue(value: Any?): Boolean {
    return when (value) {
        null -> true
        JsonNull -> true
        is String -> value.trim().isEmpty()
        is JsonPrimitive -> value.content.trim().isEmpty()
        is JsonArray -> value.isEmpty()
        is Collection<*> -> value.isEmpty()
        is Array<*> -> value.isEmpty()
        else -> false
    }
}

private fun invalidOptionValue(value: Any?, options: List<String>): Boolean {
    val values = formValueStrings(value)
    return values.isNotEmpty() && values.any { candidate -> !options.contains(candidate) }
}

private fun formValueStrings(value: Any?): List<String> {
    return when (value) {
        null -> emptyList()
        JsonNull -> emptyList()
        is JsonPrimitive -> listOf(value.content)
        is JsonArray -> value.mapNotNull { child -> (child as? JsonPrimitive)?.content }
        is String -> listOf(value)
        is Collection<*> -> value.flatMap { child -> formValueStrings(child) }
        is Array<*> -> value.flatMap { child -> formValueStrings(child) }
        else -> listOf(value.toString())
    }.map { it.trim() }.filter { it.isNotEmpty() }
}

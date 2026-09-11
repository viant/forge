package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*

data class ReportBuilderOption(
    val name: String, val label: String, val description: String, val type: String,
    val values: List<Pair<JsonElement, String>>, val defaultValue: JsonElement?, val anchorBlockId: String?
)

object ReportBuilderOptions {
    fun text(value: JsonElement): String = when (value) {
        is JsonPrimitive -> if (!value.isString && value.booleanOrNull == null && value != JsonNull) {
            val number = value.doubleOrNull
            if (number != null && number.isFinite() && number % 1.0 == 0.0 && kotlin.math.abs(number) < 1e21) "%.0f".format(java.util.Locale.ROOT, number) else value.content
        } else value.content
        is JsonArray -> value.joinToString(",") { if (it == JsonNull) "" else text(it) }
        else -> "[object Object]"
    }

    private fun normalizedString(value: JsonElement?): String =
        if (value == null || value == JsonNull || value == JsonPrimitive(false) || ((value as? JsonPrimitive)?.let { !it.isString && it.doubleOrNull == 0.0 } == true)) "" else text(value).trim()

    fun coerce(value: JsonElement?, type: String): JsonElement? {
        if (value == null) return null
        if (type == "boolean") {
            val numeric = (value as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull
            if (numeric == 1.0) return JsonPrimitive(true)
            if (numeric == 0.0) return JsonPrimitive(false)
            if (value == JsonPrimitive(true) || value == JsonPrimitive("true") || value == JsonPrimitive(1) || value == JsonPrimitive("1")) return JsonPrimitive(true)
            if (value == JsonPrimitive(false) || value == JsonPrimitive("false") || value == JsonPrimitive(0) || value == JsonPrimitive("0")) return JsonPrimitive(false)
            return null
        }
        if (type == "integer" || type == "number") {
            val raw = text(value).trim()
            val number = when {
                value == JsonNull || raw.isEmpty() -> 0.0
                value == JsonPrimitive(true) -> 1.0
                value == JsonPrimitive(false) -> 0.0
                raw.startsWith("0x", true) -> raw.drop(2).toLongOrNull(16)?.toDouble()
                raw.startsWith("0o", true) -> raw.drop(2).toLongOrNull(8)?.toDouble()
                raw.startsWith("0b", true) -> raw.drop(2).toLongOrNull(2)?.toDouble()
                else -> raw.toDoubleOrNull()
            } ?: return null
            if (!number.isFinite() || (type == "integer" && number % 1.0 != 0.0)) return null
            return JsonPrimitive(number)
        }
        return if (value == JsonNull) null else JsonPrimitive(text(value))
    }

    fun normalize(definitions: List<JsonElement>): List<ReportBuilderOption> {
        val seen = mutableSetOf<String>()
        return definitions.mapNotNull { entry ->
            val source = entry as? JsonObject ?: return@mapNotNull null
            val name = normalizedString(source["name"])
            val entityName = name.replace(Regex("[^a-zA-Z0-9]"), "")
            if (name.isEmpty() || name in seen || Regex("^(account|agency|advertiser|campaign|order|line(item)?|audience|creative|pixel)(id|ids)?$", RegexOption.IGNORE_CASE).matches(entityName)) return@mapNotNull null
            seen.add(name)
            val type = when (normalizedString(source["type"]).lowercase()) {
                "bool", "boolean" -> "boolean"
                "int", "integer" -> "integer"
                "number", "float", "double" -> "number"
                else -> "string"
            }
            val values = (source["values"] as? JsonArray).orEmpty().mapNotNull { item ->
                val value = coerce(if (item is JsonObject) item["value"] else item, type) ?: return@mapNotNull null
                val label = normalizedString((item as? JsonObject)?.get("label"))
                value to label.ifEmpty { text(value) }
            }
            val default = coerce(source["default"], type)?.takeIf { value -> values.isEmpty() || values.any { it.first == value } }
            val presentation = source["presentation"] as? JsonObject
            val anchor = (presentation?.get("anchorBlockId") as? JsonPrimitive)?.takeIf { it.isString }?.content?.trim()?.takeIf { it.isNotEmpty() && presentation["placement"] == JsonPrimitive("header") }
            ReportBuilderOption(name, normalizedString(source["label"]).ifEmpty { name }, normalizedString(source["description"]), type, values, default, anchor)
        }
    }

    fun effective(definitions: List<JsonElement>, selected: Map<String, JsonElement>): Map<String, JsonElement> =
        normalize(definitions).mapNotNull { option ->
            val value = coerce(selected[option.name], option.type)?.takeIf { value -> option.values.isEmpty() || option.values.any { it.first == value } } ?: option.defaultValue
            value?.let { option.name to it }
        }.toMap()
}

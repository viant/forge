package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*

object NativeWidgetContract {
    val kinds = setOf("text","password","file","object","number","textarea","schema","checkbox","toggle","switch","booleanpill","chiplist","select","multiselect","link","currency","mediapreview","percentfraction2input","daterange","daterangepreset","radio","treemultiselect","progressbar","button","label","math","keyvaluepairs","markdown","document","date","datetime")
    fun kind(item: ItemDef): String {
        item.widget?.takeIf { it.isNotBlank() }?.let { return if (it.equals("input",true)) "text" else it.lowercase() }
        val type = item.type.orEmpty().lowercase()
        if (type == "label") return type
        when (item.format.orEmpty().lowercase()) {
            "password", "date", "datetime", "markdown" -> return item.format!!.lowercase()
            "date-time" -> return "datetime"
            "json" -> return "object"
        }
        if ((item.properties["enum"] as? JsonArray)?.isNotEmpty() == true || item.enumValues.isNotEmpty()) return "select"
        return when (type) { "string", "input" -> "text"; "numeric", "integer" -> "number"; "boolean" -> "checkbox"; "dropdown" -> "select"; "" -> if (item.options.isEmpty()) "label" else "select"; else -> type }
    }
    fun truthy(value: JsonElement?): Boolean = when (value) {
        null, JsonNull -> false
        is JsonPrimitive -> if (value.isString) value.content.isNotEmpty() else value.booleanOrNull ?: (value.doubleOrNull?.let { it != 0.0 } ?: true)
        else -> true
    }
    fun hasValue(root: Map<String, Any?>, key: String): Boolean {
        if (root.containsKey(key)) return true
        var current: Any? = root
        for (part in key.replace("[", ".").replace("]", "").split('.').filter { it.isNotEmpty() }) {
            current = when (val holder = current) {
                is Map<*, *> -> if (holder.containsKey(part)) holder[part] else return false
                is List<*> -> part.toIntOrNull()?.takeIf { it in holder.indices }?.let { holder[it] } ?: return false
                else -> return false
            }
        }
        return true
    }
    fun initialValue(item: ItemDef): JsonElement? {
        (item.value ?: item.defaultValue ?: item.properties["default"])?.let { return it }
        val defaults = item.options.filter { it.default == true }.mapNotNull { it.rawValue }
        return if (kind(item) in setOf("multiselect", "treemultiselect", "chiplist")) defaults.takeIf { it.isNotEmpty() }?.let(::JsonArray) else defaults.firstOrNull()
    }
    fun equivalent(a: JsonElement?, b: JsonElement?): Boolean {
        val leftNumber = (a as? JsonPrimitive)?.contentOrNull?.toDoubleOrNull()
        val rightNumber = (b as? JsonPrimitive)?.contentOrNull?.toDoubleOrNull()
        if (leftNumber != null && rightNumber != null && leftNumber.isFinite() && rightNumber.isFinite()) return leftNumber == rightNumber
        return a == b
    }
    fun presentationDisabled(item: ItemDef): Boolean = if (kind(item) in setOf("link", "mediapreview", "schema", "markdown", "label", "progressbar", "treemultiselect")) item.disabled == true || item.properties["disabled"] == JsonPrimitive(true) else disabled(item)
    fun disabled(item: ItemDef) = item.disabled == true || item.readOnly == true || item.properties["disabled"] == JsonPrimitive(true) || item.properties["readOnly"] == JsonPrimitive(true)
    fun text(value: JsonElement?): String = when (value) { null, JsonNull -> ""; is JsonPrimitive -> ReportBuilderOptions.text(value); else -> value.toString() }
    fun displayText(value: JsonElement?): String = when (value) {
        is JsonObject -> objectDisplayText(value) ?: value.toString()
        is JsonArray -> value.joinToString(", ") { displayText(it) }
        else -> text(value)
    }
    private fun objectDisplayText(value: JsonObject): String? {
        val label = listOf("label", "caption", "description", "name", "title", "displayName", "value", "id", "ianaTimezoneStr")
            .firstNotNullOfOrNull { key -> value[key]?.let(::displayText)?.trim()?.takeIf(String::isNotBlank) }
            ?: return null
        val standard = (value["utcOffset"] as? JsonPrimitive)?.doubleOrNull ?: return label
        if (!standard.isFinite()) return label
        val daylight = (value["utcDstOffset"] as? JsonPrimitive)?.doubleOrNull
        val offsets = if (daylight != null && daylight.isFinite() && daylight != standard) {
            "${signedOffset(standard)}/${signedOffset(daylight)}"
        } else signedOffset(standard)
        return "$label (GMT $offsets)"
    }
    private fun signedOffset(value: Double): String {
        val magnitude = if (value % 1.0 == 0.0) value.toLong().toString() else value.toString()
        return if (value >= 0) "+$magnitude" else magnitude
    }
    fun input(text: String, kind: String, properties: Map<String, JsonElement> = emptyMap()): JsonElement? {
        if (kind in setOf("number","currency","percentfraction2input")) {
            if (text.isBlank()) return JsonNull
            val number = text.toDoubleOrNull()?.takeIf { it.isFinite() } ?: return null
            val min = (properties["min"] as? JsonPrimitive)?.doubleOrNull
            val max = (properties["max"] as? JsonPrimitive)?.doubleOrNull
            if ((min != null && number < min) || (max != null && number > max)) return null
            return JsonPrimitive(if (kind == "percentfraction2input") number / 100 else number)
        }
        if (kind in setOf("object", "keyvaluepairs")) return runCatching { Json.parseToJsonElement(text) }.getOrNull()
        return JsonPrimitive(text)
    }
    fun options(item: ItemDef): List<Pair<JsonElement, String>> = (item.properties["enum"] as? JsonArray ?: item.enumValues.takeIf { it.isNotEmpty() }?.let(::JsonArray))?.map { it to text(it) }
        ?: item.options.mapNotNull { option -> option.rawValue?.let { it to (option.label ?: text(it)) } }
}

package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

object JsonUtil {
    val json = Json { ignoreUnknownKeys = true }

    fun parseObject(text: String): Map<String, Any?> {
        val el = json.parseToJsonElement(text)
        return asStringMap(elementToAny(el))
    }

    fun anyToElement(value: Any?): JsonElement = when (value) {
        null -> JsonNull
        is JsonElement -> value
        is Map<*, *> -> JsonObject(value.entries.associate { it.key.toString() to anyToElement(it.value) })
        is List<*> -> JsonArray(value.map(::anyToElement))
        is Boolean -> JsonPrimitive(value)
        is Int -> JsonPrimitive(value)
        is Long -> JsonPrimitive(value)
        is Float -> JsonPrimitive(value)
        is Double -> JsonPrimitive(value)
        is Number -> JsonPrimitive(value.toDouble())
        is String -> JsonPrimitive(value)
        else -> JsonPrimitive(value.toString())
    }

    fun asStringMap(value: Any?): Map<String, Any?> {
        return when (value) {
            is Map<*, *> -> value.entries.associate { it.key.toString() to it.value }
            else -> emptyMap()
        }
    }

    fun elementToAny(el: JsonElement): Any? = when (el) {
        is JsonObject -> el.entries.associate { it.key to elementToAny(it.value) }
        is JsonArray -> el.map { elementToAny(it) }
        is JsonPrimitive -> when {
            el.isString -> el.content
            el.booleanOrNull() != null -> el.booleanOrNull()
            el.longOrNull() != null -> el.longOrNull()
            el.doubleOrNull() != null -> el.doubleOrNull()
            else -> el.content
        }
        else -> null
    }
}

package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

object JsonUtil {
    val json = Json { ignoreUnknownKeys = true }

    fun parseObject(text: String): Map<String, Any?> {
        val el = json.parseToJsonElement(text)
        return asStringMap(elementToAny(el))
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

package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

data class ForgeTargetContext(
    val platform: String,
    val formFactor: String? = null,
    val capabilities: Set<String> = emptySet()
)

object MetadataResolver {
    fun resolve(element: JsonElement, targetContext: ForgeTargetContext): JsonElement? {
        return resolveValue(element, targetContext)
    }

    private fun resolveValue(element: JsonElement, targetContext: ForgeTargetContext): JsonElement? {
        return when (element) {
            is JsonArray -> {
                val items = element.mapNotNull { resolveValue(it, targetContext) }
                JsonArray(items)
            }
            is JsonObject -> resolveObject(element, targetContext)
            else -> element
        }
    }

    private fun resolveObject(node: JsonObject, targetContext: ForgeTargetContext): JsonElement? {
        if (!matchesTarget(node["target"], targetContext)) {
            return null
        }

        var working = JsonObject(node.toMap())
        applicableOverrides(working["targetOverrides"], targetContext).forEach { override ->
            working = deepMerge(working, override)
        }

        val result = linkedMapOf<String, JsonElement>()
        working.forEach { (key, value) ->
            if (key == "target" || key == "targetOverrides") {
                return@forEach
            }
            val resolved = resolveValue(value, targetContext)
            if (resolved != null) {
                result[key] = resolved
            }
        }
        return JsonObject(result)
    }

    private fun applicableOverrides(raw: JsonElement?, targetContext: ForgeTargetContext): List<JsonObject> {
        val obj = raw as? JsonObject ?: return emptyList()
        val keys = mutableListOf<String>()
        if (targetContext.platform.isNotBlank()) {
            keys += targetContext.platform
            if (!targetContext.formFactor.isNullOrBlank()) {
                keys += "${targetContext.platform}:${targetContext.formFactor}"
                keys += "${targetContext.platform}.${targetContext.formFactor}"
            }
        }
        if (!targetContext.formFactor.isNullOrBlank()) {
            keys += "formFactor:${targetContext.formFactor}"
            keys += targetContext.formFactor
        }
        val result = mutableListOf<JsonObject>()
        val seen = mutableSetOf<String>()
        for (key in keys) {
            if (!seen.add(key)) continue
            val candidate = obj[key] as? JsonObject ?: continue
            result += candidate
        }
        return result
    }

    private fun matchesTarget(raw: JsonElement?, targetContext: ForgeTargetContext): Boolean {
        val spec = normalizeTarget(raw) ?: return true

        if (spec.platforms.isNotEmpty() && targetContext.platform !in spec.platforms) {
            return false
        }
        if (spec.excludePlatforms.isNotEmpty() && targetContext.platform in spec.excludePlatforms) {
            return false
        }
        if (spec.formFactors.isNotEmpty()) {
            val formFactor = targetContext.formFactor ?: return false
            if (formFactor !in spec.formFactors) {
                return false
            }
        }
        if (spec.capabilities.isNotEmpty()) {
            for (capability in spec.capabilities) {
                if (capability !in targetContext.capabilities) {
                    return false
                }
            }
        }
        return true
    }

    private fun normalizeTarget(raw: JsonElement?): NormalizedTarget? {
        return when (raw) {
            null, JsonNull -> null
            is JsonPrimitive -> {
                val text = raw.contentOrNull?.trim().orEmpty()
                if (text.isBlank()) null else NormalizedTarget(platforms = listOf(text))
            }
            is JsonArray -> {
                NormalizedTarget(platforms = raw.mapNotNull { (it as? JsonPrimitive)?.contentOrNull?.trim() }.filter { it.isNotBlank() })
            }
            is JsonObject -> {
                NormalizedTarget(
                    platforms = stringList(raw["platforms"]),
                    excludePlatforms = stringList(raw["excludePlatforms"]),
                    formFactors = stringList(raw["formFactors"]),
                    capabilities = stringList(raw["capabilities"])
                )
            }
            else -> null
        }
    }

    private fun stringList(element: JsonElement?): List<String> {
        return when (element) {
            is JsonArray -> element.mapNotNull { (it as? JsonPrimitive)?.contentOrNull?.trim() }.filter { it.isNotBlank() }
            is JsonPrimitive -> listOfNotNull(element.contentOrNull?.trim()?.takeIf { it.isNotBlank() })
            else -> emptyList()
        }
    }

    private fun deepMerge(base: JsonObject, override: JsonObject): JsonObject {
        val result = base.toMutableMap()
        override.forEach { (key, value) ->
            val current = result[key]
            result[key] = if (current is JsonObject && value is JsonObject) {
                deepMerge(current, value)
            } else {
                value
            }
        }
        return JsonObject(result)
    }
}

private data class NormalizedTarget(
    val platforms: List<String> = emptyList(),
    val excludePlatforms: List<String> = emptyList(),
    val formFactors: List<String> = emptyList(),
    val capabilities: List<String> = emptyList()
)

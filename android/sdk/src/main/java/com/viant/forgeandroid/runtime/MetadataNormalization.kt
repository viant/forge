package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

fun normalizeWindowMetadataJson(element: JsonElement): JsonElement {
    val root = element as? JsonObject ?: return element
    val view = root["view"] as? JsonObject ?: return element
    val content = view["content"] as? JsonObject ?: return element
    if (content["containers"] != null) {
        return element
    }
    if (!isMeaningfulContainerObject(content)) {
        return element
    }

    val wrappedContent = JsonObject(
        content.toMutableMap().apply {
            put("containers", JsonArray(listOf(content)))
        }
    )
    val wrappedView = JsonObject(
        view.toMutableMap().apply {
            put("content", wrappedContent)
        }
    )
    return JsonObject(
        root.toMutableMap().apply {
            put("view", wrappedView)
        }
    )
}

private fun isMeaningfulContainerObject(content: JsonObject): Boolean {
    val interestingKeys = setOf(
        "kind",
        "title",
        "subtitle",
        "dashboard",
        "chart",
        "table",
        "schemaBasedForm",
        "tabs",
        "items",
        "containers",
        "dataSourceRef",
        "layout",
        "treeBrowser",
        "editor",
        "terminal",
        "chat"
    )
    return content.keys.any { it in interestingKeys }
}

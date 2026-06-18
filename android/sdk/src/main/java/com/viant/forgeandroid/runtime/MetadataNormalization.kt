package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

fun normalizeWindowMetadataJson(element: JsonElement): JsonElement {
    val root = element as? JsonObject ?: return element
    val view = root["view"] as? JsonObject ?: run {
        return if (isMeaningfulContainerObject(root)) wrapTopLevelContainer(root) else element
    }
    val content = view["content"] as? JsonObject ?: return element
    if (content["containers"] != null) {
        return JsonObject(
            root.toMutableMap().apply {
                put("view", JsonObject(view.toMutableMap().apply {
                    put("content", normalizeContentObject(content))
                }))
            }
        )
    }
    if (!isMeaningfulContainerObject(content)) {
        return normalizeMetadataContainers(root)
    }

    val normalizedContent = normalizeContainerObject(content)
    val wrappedContent = JsonObject(
        normalizedContent.toMutableMap().apply {
            put("containers", JsonArray(listOf(normalizedContent)))
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

private fun normalizeMetadataContainers(root: JsonObject): JsonObject {
    val view = root["view"] as? JsonObject ?: return root
    val content = view["content"] as? JsonObject ?: return root
    return JsonObject(
        root.toMutableMap().apply {
            put("view", JsonObject(view.toMutableMap().apply {
                put("content", normalizeContentObject(content))
            }))
        }
    )
}

private fun wrapTopLevelContainer(root: JsonObject): JsonObject {
    val normalizedContainer = normalizeContainerObject(root)
    return JsonObject(
        root.toMutableMap().apply {
            put(
                "view",
                JsonObject(
                    mapOf(
                        "content" to JsonObject(
                            mapOf("containers" to JsonArray(listOf(normalizedContainer)))
                        )
                    )
                )
            )
        }
    )
}

private fun normalizeContentObject(content: JsonObject): JsonObject {
    val containers = content["containers"] as? JsonArray ?: return normalizeContainerObject(content)
    return JsonObject(
        content.toMutableMap().apply {
            put(
                "containers",
                JsonArray(
                    containers.map { child ->
                        (child as? JsonObject)?.let(::normalizeContainerObject) ?: child
                    }
                )
            )
        }
    )
}

private fun normalizeContainerObject(container: JsonObject): JsonObject {
    val next = container.toMutableMap()
    val childContainers = container["containers"] as? JsonArray
    if (childContainers != null) {
        next["containers"] = JsonArray(
            childContainers.map { child ->
                (child as? JsonObject)?.let(::normalizeContainerObject) ?: child
            }
        )
    }
    normalizeColumnsArray(container["columns"])?.let { next["columns"] = it }
    val table = container["table"] as? JsonObject
    if (table != null) {
        val normalizedTable = table.toMutableMap()
        normalizeColumnsArray(table["columns"])?.let { normalizedTable["columns"] = it }
        next["table"] = JsonObject(normalizedTable)
    }
    val chart = container["chart"] as? JsonObject
    if (chart != null) {
        normalizeCompactChartObject(chart)?.let { next["chart"] = it }
    }

    val existingDashboard = container["dashboard"] as? JsonObject
    val dashboard = existingDashboard?.toMutableMap() ?: mutableMapOf()
    var hasDashboardPatch = false
    for (key in dashboardCompatKeys) {
        val value = container[key] ?: continue
        if (dashboard[key] == null) {
            dashboard[key] = value
            hasDashboardPatch = true
        }
    }
    if (hasDashboardPatch || existingDashboard != null) {
        next["dashboard"] = JsonObject(dashboard)
    }
    return JsonObject(next)
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

private val dashboardCompatKeys = setOf(
    "summary",
    "compare",
    "kpiTable",
    "filters",
    "timeline",
    "dimensions",
    "messages",
    "status",
    "feed",
    "badges",
    "report",
    "reportBuilder",
    "detail"
)

private fun normalizeColumnsArray(element: JsonElement?): JsonArray? {
    val columns = element as? JsonArray ?: return null
    var changed = false
    val normalized = columns.map { item ->
        val primitive = item as? JsonPrimitive
        if (primitive != null && primitive.isString) {
            changed = true
            val key = primitive.content.trim()
            JsonObject(
                mapOf(
                    "id" to JsonPrimitive(key),
                    "name" to JsonPrimitive(key),
                    "label" to JsonPrimitive(key)
                )
            )
        } else {
            item
        }
    }
    return if (changed) JsonArray(normalized) else null
}

private fun normalizeCompactChartObject(chart: JsonObject): JsonObject? {
    val categoryKey = stringValue(chart["categoryKey"]) ?: stringValue(chart["categoryField"])
    val valueKey = stringValue(chart["valueKey"]) ?: stringValue(chart["valueField"])
    if (categoryKey.isNullOrBlank() && valueKey.isNullOrBlank()) {
        return null
    }
    val next = chart.toMutableMap()
    if (categoryKey != null && next["xAxis"] == null) {
        next["xAxis"] = JsonObject(mapOf("dataKey" to JsonPrimitive(categoryKey)))
    }
    if (valueKey != null && next["series"] == null) {
        val series = linkedMapOf<String, JsonElement>(
            "valueKey" to JsonPrimitive(valueKey),
            "values" to JsonArray(listOf(JsonObject(mapOf("value" to JsonPrimitive(valueKey)))))
        )
        categoryKey?.let { series["nameKey"] = JsonPrimitive(it) }
        next["series"] = JsonObject(series)
    }
    return JsonObject(next)
}

private fun stringValue(element: JsonElement?): String? {
    val primitive = element as? JsonPrimitive ?: return null
    return if (primitive.isString) primitive.content.trim().takeIf { it.isNotEmpty() } else null
}

package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

fun normalizeWindowMetadataJson(element: JsonElement): JsonElement {
    val root = element as? JsonObject ?: return element
    rejectUnsupportedDataSourceAliases(root)
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
    val normalizedContainer = JsonObject(
        normalizeContainerObject(root).toMutableMap().apply {
            remove("dataSource")
            remove("dataSources")
        }
    )
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
    if (isDashboardFiltersContainer(container) && dashboard["filters"] == null) {
        val items = container["items"] as? JsonArray
        if (items != null && items.isNotEmpty()) {
            dashboard["filters"] = JsonObject(mapOf("items" to items))
            hasDashboardPatch = true
        }
    }
    if (hasDashboardPatch || existingDashboard != null) {
        next["dashboard"] = JsonObject(dashboard)
    }
    return JsonObject(next)
}

private fun rejectUnsupportedDataSourceAliases(root: JsonObject) {
    if (root["view"] !is JsonObject && isMeaningfulContainerObject(root)) {
        val dataSource = root["dataSource"]
        if (dataSource != null && dataSource !is JsonObject) {
            throw IllegalArgumentException("$.dataSource is not supported on Forge containers; use dataSourceRef")
        }
        val childContainers = root["containers"] as? JsonArray
        childContainers?.forEachIndexed { index, child ->
            val childObject = child as? JsonObject ?: return@forEachIndexed
            rejectUnsupportedContainerDataSourceAlias(childObject, "$.containers[$index]")
        }
    }
    val view = root["view"] as? JsonObject
    val content = view?.get("content") as? JsonObject
    if (content != null) {
        rejectUnsupportedContentDataSourceAliases(content, "$.view.content")
    }
    val dialogs = root["dialogs"] as? JsonArray
    dialogs?.forEachIndexed { index, item ->
        val dialog = item as? JsonObject ?: return@forEachIndexed
        rejectUnsupportedDialogDataSourceAlias(dialog, "$.dialogs[$index]")
        val dialogContent = dialog["content"] as? JsonObject
        if (dialogContent != null) {
            rejectUnsupportedContainerDataSourceAlias(dialogContent, "$.dialogs[$index].content")
        }
    }
}

private fun rejectUnsupportedContentDataSourceAliases(content: JsonObject, path: String) {
    val containers = content["containers"] as? JsonArray
    if (containers != null) {
        containers.forEachIndexed { index, child ->
            val childObject = child as? JsonObject ?: return@forEachIndexed
            rejectUnsupportedContainerDataSourceAlias(childObject, "$path.containers[$index]")
        }
    } else if (isMeaningfulContainerObject(content)) {
        rejectUnsupportedContainerDataSourceAlias(content, path)
    }
}

private fun rejectUnsupportedContainerDataSourceAlias(container: JsonObject, path: String) {
    if (container["dataSource"] != null) {
        throw IllegalArgumentException("$path.dataSource is not supported on Forge containers; use dataSourceRef")
    }
    val childContainers = container["containers"] as? JsonArray
    childContainers?.forEachIndexed { index, child ->
        val childObject = child as? JsonObject ?: return@forEachIndexed
        rejectUnsupportedContainerDataSourceAlias(childObject, "$path.containers[$index]")
    }
}

private fun rejectUnsupportedDialogDataSourceAlias(dialog: JsonObject, path: String) {
    if (dialog["dataSource"] != null) {
        throw IllegalArgumentException("$path.dataSource is not supported on Forge dialogs; use dataSourceRef")
    }
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
        "fileBrowser",
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

private fun isDashboardFiltersContainer(container: JsonObject): Boolean =
    stringValue(container["kind"]) == "dashboard.filters"

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

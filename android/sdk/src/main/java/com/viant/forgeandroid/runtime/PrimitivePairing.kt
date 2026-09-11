package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*

object PrimitivePairing {
    val presentationKeys = listOf("derivedDataSource", "resourceHeader", "queryToolbar", "notificationRules", "editableCollection", "statusWorkflow", "draftForm", "metricSummary", "relationDrill", "detailView", "historyDiff", "mutationCommand")
    fun scopedContainers(container: ContainerDef): List<ContainerDef> {
        val raw = JsonUtil.json.encodeToJsonElement(ContainerDef.serializer(), container).jsonObject
        return presentationKeys.mapNotNull { key ->
            val spec = raw[key] as? JsonObject ?: return@mapNotNull null
            val scoped = raw.toMutableMap()
            presentationKeys.filter { it != key }.forEach(scoped::remove)
            scoped["id"] = JsonPrimitive("${container.id ?: "primitive"}:$key")
            (if (key == "mutationCommand") null else spec["dataSourceRef"] as? JsonPrimitive)?.content?.takeIf { it.isNotBlank() }?.let { scoped["dataSourceRef"] = JsonPrimitive(it) }
            JsonUtil.json.decodeFromJsonElement(ContainerDef.serializer(), JsonObject(scoped))
        }
    }
}

package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*

/** Canonical parameter projection; declared state overrides defaults verbatim, including JSON null. */
fun nativeReportBuilderParameters(state: JsonObject, authoredConfiguration: JsonObject): JsonObject {
    val defaultMode=(authoredConfiguration["result"] as? JsonObject)?.get("defaultMode")?.takeUnless { it==JsonNull } ?: JsonPrimitive("table")
    val parameters=linkedMapOf<String,JsonElement>("viewMode" to defaultMode,"groupBy" to JsonPrimitive(""),"pageSize" to JsonPrimitive(50),"orderField" to JsonPrimitive(""),"orderDir" to JsonPrimitive("desc"))
    parameters.keys.toList().forEach { key -> if(state.containsKey(key)) parameters[key]=state.getValue(key) }
    return JsonObject(parameters)
}

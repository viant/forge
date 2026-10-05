package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class NativeReportBuilderParametersTest {
    @Test fun configViewModeFallbackDoesNotInjectConfigGroupOrderOrFetchLimit() {
        val config=buildJsonObject { put("result",buildJsonObject { put("defaultMode","chart");put("pageSize",250) });put("groupBy",buildJsonObject { put("default","channelId") });put("request",buildJsonObject { put("limit",1000) }) }
        val params=nativeReportBuilderParameters(JsonObject(emptyMap()),config)
        assertEquals(JsonPrimitive("chart"),params["viewMode"]);assertEquals(JsonPrimitive(""),params["groupBy"]);assertEquals(JsonPrimitive(50),params["pageSize"]);assertEquals(JsonPrimitive(""),params["orderField"]);assertEquals(JsonPrimitive("desc"),params["orderDir"])
        val state=buildJsonObject { put("viewMode",JsonNull);put("groupBy",JsonNull);put("pageSize",25);put("orderDir","asc") }
        val overridden=nativeReportBuilderParameters(state,config)
        assertEquals(JsonNull,overridden["viewMode"]);assertEquals(JsonNull,overridden["groupBy"]);assertEquals(JsonPrimitive(25),overridden["pageSize"]);assertEquals(JsonPrimitive("asc"),overridden["orderDir"])
    }
}

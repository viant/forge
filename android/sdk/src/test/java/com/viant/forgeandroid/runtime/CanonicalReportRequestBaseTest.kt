package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class CanonicalReportRequestBaseTest {
    private val json = Json
    @Test fun authoredPathsScopeSemanticsPagingAndSortArePreserved() {
        val config = json.parseToJsonElement("""{
          "binding":{"mode":"semantic","modelRef":"model://example","entity":"delivery"},
          "request":{"baseParameters":{"filters":{"posture":""}},"timeoutMs":12000},
          "measures":[{"id":"amount","semanticRef":"spend","paramPath":"metrics.amount"}],
          "dimensions":[{"id":"day","semanticRef":"event_date","paramPath":"dimensions.day"}],
          "staticFilters":[{"id":"range","type":"dateRange","semanticRef":"window","startParamPath":"filters.begin","endParamPath":"filters.end"},{"id":"entities","paramPath":"filters.entities"}],
          "result":{"orderFields":[{"value":"day","orderBy":["day ${'$'}{dir}"],"defaultDirection":"asc"}]}
        }""").jsonObject
        val state = json.parseToJsonElement("""{"selectedMeasures":["amount"],"selectedDimensions":["day"],"scopeParams":{"range":{"start":"2026-01-01","end":"2026-01-31"},"entities":[42]},"page":3,"pageSize":25,"orderField":"day","orderDir":"desc"}""").jsonObject
        val result = buildCanonicalReportRequestBase(config, state)
        assertEquals(JsonPrimitive("2026-01-01"), reportRequestPath(result, "filters.begin"))
        assertEquals(JsonArray(listOf(JsonPrimitive(42))), reportRequestPath(result, "filters.entities"))
        assertEquals(JsonPrimitive(""), reportRequestPath(result, "filters.posture"))
        assertEquals(JsonPrimitive(true), reportRequestPath(result, "metrics.amount"))
        assertEquals(JsonPrimitive(50), result["offset"])
        assertEquals(JsonArray(listOf(JsonPrimitive("day desc"))), result["orderBy"])
        assertEquals(JsonArray(listOf(JsonPrimitive("spend"))), reportRequestPath(result, "semanticSelection.selection.measures"))
        assertEquals(state["scopeParams"]?.jsonObject?.get("range"), reportRequestPath(result, "semanticSelection.parameters.window"))
        assertFalse(config["request"]!!.jsonObject.containsKey("limit"))
    }
    @Test fun computedDependencyAndHookMappedFiltersDoNotBecomeInventedParameters() {
        val config = json.parseToJsonElement("""{"measures":[{"id":"cost"},{"id":"views"}],"computedMeasures":[{"id":"rate","dependencies":["cost","views"],"compute":{"type":"ratio"}}],"dynamicFilterGroups":[{"id":"include","filters":[{"id":"special","requestMapping":"hook"},{"id":"countries","multiple":true}]}]}""").jsonObject
        val state = json.parseToJsonElement("""{"selectedMeasures":["rate"],"dynamicGroups":{"include":[{"filterId":"special","selections":[{"value":"raw"}]},{"filterId":"countries","selections":[{"value":"US"},{"value":"US"}]}]}}""").jsonObject
        val result = buildCanonicalReportRequestBase(config, state)
        assertEquals(JsonPrimitive(true), reportRequestPath(result,"measures.cost"))
        assertEquals(JsonPrimitive(true), reportRequestPath(result,"measures.views"))
        assertNull(reportRequestPath(result,"filters.special"))
        assertEquals(JsonArray(listOf(JsonPrimitive("US"))), reportRequestPath(result,"filters.countries"))
    }
    @Test fun unresolvedDateCannotSilentlyWidenRequest() {
        val config = json.parseToJsonElement("""{"staticFilters":[{"id":"range","type":"dateRange","startParamPath":"filters.from"}]}""").jsonObject
        val state = json.parseToJsonElement("""{"scopeParams":{"range":{"preset":"last7Days"}}}""").jsonObject
        assertThrows(IllegalArgumentException::class.java) { buildCanonicalReportRequestBase(config,state) }
    }
}

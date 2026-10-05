package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class StewardPreparedHookTest {
    private val json = Json { ignoreUnknownKeys = true }
    private val fixture = json.parseToJsonElement(javaClass.getResource("/steward-request-only.json")!!.readText()).jsonObject
    @Test fun rawAuthoredConfigurationRoundTripsWithoutRuntimeWireFields() {
        val raw = buildJsonObject { put("reportBuilder", fixture.getValue("config")) }
        val variant = json.decodeFromJsonElement<DashboardReportBuilderVariantDef>(raw)
        assertEquals(fixture["config"], variant.reportBuilder!!.authoredConfiguration)
        val encoded = json.encodeToJsonElement(DashboardReportBuilderVariantDef.serializer(), variant).jsonObject
        assertEquals(raw, encoded)
        assertFalse(encoded.toString().contains("authoredConfiguration"))
    }
    @Test fun explicitEmptyCanonicalScopeDoesNotResurrectLegacyFilters() {
        val config = DashboardReportBuilderDef(
            staticFilters = listOf(ReportBuilderStaticFilterDef(id = "advertiserId")),
            hooks = ReportBuilderHooksDef(initializeState = "clearScope"))
        val initial = ReportBuilderStateValues(emptyList(), emptyList(), null, "table",
            mapOf("advertiserId" to 123), emptyMap(), authoredState = mapOf("scopeParams" to buildJsonObject { put("advertiserId", 123) }))
        ActionHookRuntime.testScriptEvaluator = { "{\"scopeParams\":{}}" }
        try {
            val result = applyReportBuilderInitializeStateHook(WindowMetadata(actions = ActionsDef(code = "({clearScope: () => ({scopeParams:{}})})")), config, initial, emptyMap())
            assertEquals(emptyMap<String, Any?>(), result.staticFilters)
            assertEquals(emptyMap<String, Any?>(), currentReportBuilderHookState(result)["scopeParams"])
        } finally { ActionHookRuntime.testScriptEvaluator = null }
    }
    @Test fun actualStewardHooksRetainScopedIntentAndPublishedRequestWithoutAnyFetch() {
        val variant = json.decodeFromJsonElement<DashboardReportBuilderVariantDef>(buildJsonObject { put("reportBuilder", fixture.getValue("config")) })
        val config = lowerReportBuilderPredicates(variant.reportBuilder!!)
        val metadata = WindowMetadata(namespace = (fixture["namespace"] as? JsonPrimitive)?.content,
            actions = json.decodeFromJsonElement<ActionsDef>(fixture.getValue("actions")))
        val form = JsonUtil.asStringMap(JsonUtil.elementToAny(fixture.getValue("windowForm")))
        ActionHookRuntime.testScriptEvaluator = { script ->
            val process = ProcessBuilder("node", "-e", "process.stdout.write(String(eval(process.argv[1])))", script).start()
            val output = process.inputStream.bufferedReader().readText()
            val error = process.errorStream.bufferedReader().readText()
            check(process.waitFor() == 0) { error }
            output
        }
        try {
            val initial = ReportBuilderStateValues(listOf("totalSpend", "impressions"), listOf("eventDate", "channelId"), null, "table", emptyMap(), emptyMap(), authoredState = reportBuilderDefaultAuthorState(config))
            val initialized = applyReportBuilderInitializeStateHook(metadata, config, initial, form)
            assertTrue(initialized.authoredState.containsKey("scopeParams"))
            assertTrue(initialized.authoredState.containsKey("binding"))
            val hookState = currentReportBuilderHookState(initialized)
            assertEquals("channelId", hookState["groupBy"])
            assertEquals(50L, (hookState["pageSize"] as Number).toLong())
            assertEquals("eventDate", hookState["orderField"])
            assertEquals("asc", hookState["orderDir"])
            assertEquals("table", hookState["viewMode"])
            val invocationParameters = nativeReportBuilderParameters(JsonUtil.anyToElement(hookState).jsonObject, config.authoredConfiguration!!)
            assertEquals(JsonPrimitive(50), invocationParameters["pageSize"])
            assertEquals(JsonPrimitive("table"), invocationParameters["viewMode"])
            assertEquals(JsonPrimitive("asc"), invocationParameters["orderDir"])
            assertEquals(JsonPrimitive("channelId"), invocationParameters["groupBy"])
            val primary = buildReportBuilderRequestPayload(config, initialized.selectedMeasures, initialized.selectedDimensions, initialized.staticFilters, initialized.dynamicGroups, hookState) { name, props ->
                invokeReportBuilderHook(metadata, name, props)
            }
            val actual = JsonUtil.anyToElement(primary).jsonObject
            assertEquals(fixture.getValue("request"), actual)
            val chartRead = applyReportBuilderChartDataPolicy(config, primary)
            assertEquals(1000L, (chartRead["limit"] as Number).toLong())
            assertEquals(50L, (hookState["pageSize"] as Number).toLong())
            val identity = ReportPreparationIdentity("proof", "metricsCubeBuilder", "1", "1")
            val prepared = PreparedReportRequest(identity, "ready", "metrics_ad_cube_report", actual, JsonUtil.anyToElement(hookState).jsonObject, publishedSources = config.dataSources)
            val source = config.dataSources.first { it.id == "delivery_summary_active_range" }
            val published = preparePublishedReportRequest(identity, prepared, source)
            assertEquals("ready", published.status)
            val expected = fixture.getValue("published").jsonArray.first().jsonObject.getValue("request")
            assertEquals(expected, published.request)
        } finally { ActionHookRuntime.testScriptEvaluator = null }
    }
}

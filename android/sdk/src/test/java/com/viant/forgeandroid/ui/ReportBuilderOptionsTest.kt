package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.*
import kotlinx.serialization.json.*
import kotlin.test.*

class ReportBuilderOptionsTest {
    private val config = JsonUtil.json.decodeFromString(DashboardReportBuilderDef.serializer(), """{"reportOptions":[{"name":"exposurePerspective","label":"First vs. Last Exposure","default":"Last","values":["First","Last"],"presentation":{"anchorBlockId":"pathways","placement":"header"}},{"name":"days","type":"integer","default":30},{"name":"organic","type":"boolean","default":false},{"name":"campaignId","default":"forbidden"}]}""")

    @Test fun defaultsValidationAndRequest() {
        val definitions = lowerReportBuilderPredicates(config).reportOptions
        assertEquals(JsonPrimitive(true), ReportBuilderOptions.coerce(JsonPrimitive(1.0), "boolean"))
        assertEquals(3, ReportBuilderOptions.normalize(definitions).size)
        assertEquals("pathways", ReportBuilderOptions.normalize(definitions).first().anchorBlockId)
        val values = ReportBuilderOptions.effective(definitions, mapOf("exposurePerspective" to JsonPrimitive("invalid"), "days" to JsonPrimitive("7"), "organic" to JsonPrimitive("true")))
        assertEquals(JsonPrimitive("Last"), values["exposurePerspective"])
        assertEquals(JsonPrimitive(7.0), values["days"])
        assertEquals(JsonPrimitive(true), values["organic"])
        val request = buildReportBuilderRequestPayload(config, emptyList(), emptyList(), emptyMap(), emptyMap(), mapOf("reportOptions" to mapOf("exposurePerspective" to "First"))) { _, _ -> null }
        assertEquals("First", (request["options"] as Map<*, *>)["exposurePerspective"])
        assertFalse((request["options"] as Map<*, *>).containsKey("campaignId"))
    }

    @Test fun restoreLegacyAndSelectedValues() {
        val legacy = JsonUtil.json.decodeFromString(StoredReportBuilderState.serializer(), "{}")
        assertEquals(JsonPrimitive("Last"), legacy.toReportBuilderStateValues(config).reportOptions["exposurePerspective"])
        val stored = legacy.copy(reportOptions = mapOf("exposurePerspective" to JsonPrimitive("First")))
        val decoded = JsonUtil.json.decodeFromString(StoredReportBuilderState.serializer(), JsonUtil.json.encodeToString(StoredReportBuilderState.serializer(), stored))
        assertEquals(JsonPrimitive("First"), decoded.toReportBuilderStateValues(config).reportOptions["exposurePerspective"])
    }

    @Test fun exportUsesReadOnlySelectedMeaning() {
        val report = TranscriptCanonicalReport(scope = "test", id = "test", grammar = "report-document-v1", status = "ready", source = JsonObject(mapOf("blocks" to JsonArray(emptyList()))))
        val artifact = InlineReportRuntimeCompiler.compile(report, reportOptions = config.reportOptions, optionValues = mapOf("exposurePerspective" to JsonPrimitive("First")))
        val container = artifact.metadata.view!!.content!!.containers.first()
        val export = dashboardReportRuntimeExportExecution(container)!!
        val fences = JsonUtil.anyToElement(export.exportRequest!!["fences"]) as JsonArray
        val start = fences.first().jsonObject["payload"]!!.jsonObject
        assertEquals(JsonPrimitive("First"), start["metadata"]!!.jsonObject["options"]!!.jsonObject["exposurePerspective"])
        assertEquals(JsonArray(config.reportOptions), start["metadata"]!!.jsonObject["reportOptions"])
        assertEquals(0, start["blocks"]!!.jsonArray.size)
    }
}

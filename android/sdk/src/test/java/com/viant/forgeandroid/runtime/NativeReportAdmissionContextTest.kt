package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.time.Instant

class NativeReportAdmissionContextTest {
    @Test fun allReadyPublisherFixturesRestoreAtOriginalClockWithOpaqueState() {
        val fixture = Json.parseToJsonElement(File("../../testdata/native-report-preparation/published-requests.json").readText()).jsonObject
        var checked = 0
        fixture.getValue("cases").jsonArray.forEach { raw ->
            val entry = raw.jsonObject
            val expected = entry.getValue("expected").jsonObject
            if (expected["status"] != JsonPrimitive("ready")) return@forEach
            val source = Json.decodeFromJsonElement<ReportBuilderPublishedDataSourceDef>(entry.getValue("source"))
            val state = JsonObject(entry.getValue("state").jsonObject + mapOf("opaque" to buildJsonObject { put("extension", "😀/é"); put("unknown", JsonArray(listOf(JsonPrimitive(1), JsonNull))) }) +
                (entry["datasetScopeParams"]?.let { mapOf("reportDatasetScopeParams" to it) } ?: emptyMap()))
            val packet = PreparedReportRequest(ReportPreparationIdentity("W","builder","form","state"), "ready", entry.getValue("primaryDataSourceRef").jsonPrimitive.content,
                entry.getValue("primaryRequest").jsonObject, state, publishedSources = listOf(source),
                capturedTimeMillis = Instant.parse(fixture.getValue("now").jsonPrimitive.content).toEpochMilli(), capturedZoneId = fixture.getValue("timeZone").jsonPrimitive.content)
            val document = buildJsonObject { put("opaque", "original"); put("blocks", JsonArray(listOf(buildJsonObject { put("datasetRef",source.id) }))) }
            val config = buildJsonObject { put("opaque", "author"); put("dataSources", JsonArray(listOf(entry.getValue("source")))) }
            val admission = NativeReportAdmission(packet,"conversation","selected-state",document,listOf(NativeReportDatasetAdmission(source.id,source.dataSourceRef,expected.getValue("request").jsonObject)),config)
            val requested = nativeReportRequestedParams(admission)
            assertEquals(packet.primaryRequest, JsonObject(requested.filterKeys { it != NATIVE_REPORT_ADMISSION_KEY }))
            val namespace = requested.getValue(NATIVE_REPORT_ADMISSION_KEY).jsonObject
            assertEquals(state,namespace["state"])
            val restored = restoredNativeReportAdmission(namespace,packet.primaryRequest,state,document,config,"conversation","cold-W","builder","selected-state",packet.dataSourceRef,listOf(source))
            assertEquals(entry.getValue("name").jsonPrimitive.content,admission.datasets,restored.datasets)
            assertEquals(packet.capturedTimeMillis,restored.preparation.capturedTimeMillis)
            assertEquals(packet.capturedZoneId,restored.preparation.capturedZoneId)
            checked++
        }
        assertTrue(checked >= 15)
    }
    private fun primary(): NativeReportAdmission {
        val request = buildJsonObject { put("filters",buildJsonObject { put("orderIds",JsonArray(listOf(JsonPrimitive(2659534)))) }); put("limit",50); put("offset",0) }
        val packet = PreparedReportRequest(ReportPreparationIdentity("W","builder","form","state"),"ready","cube",request,
            buildJsonObject { put("unknown",buildJsonObject { put("deep", "original") }) },capturedTimeMillis=1_759_622_400_123,capturedZoneId="America/Los_Angeles")
        val doc = buildJsonObject { put("blocks",JsonArray(listOf(buildJsonObject { put("datasetRef","primary") }))) }
        return NativeReportAdmission(packet,"conversation","state",doc,listOf(NativeReportDatasetAdmission("primary","cube",request)),buildJsonObject { put("opaque",true) })
    }
    @Test fun primaryRequiresExactRequestAndAnyRawStateDocumentOrConfigurationEditRejects() {
        val admission = primary(); val ns = nativeReportAdmissionContext(admission)
        fun restore(state:JsonObject=admission.preparation.state,doc:JsonObject=admission.document,config:JsonObject=admission.authoredConfiguration,request:JsonObject=admission.preparation.primaryRequest,namespace:JsonObject=ns) = restoredNativeReportAdmission(namespace,request,state,doc,config,"conversation","cold","builder","state","cube",emptyList())
        assertEquals(admission.datasets,restore().datasets)
        assertTrue(runCatching { restore(state=JsonObject(admission.preparation.state+mapOf("unknown" to JsonObject(emptyMap())))) }.isFailure)
        assertTrue(runCatching { restore(doc=JsonObject(admission.document+mapOf("unknown" to JsonPrimitive("edit")))) }.isFailure)
        assertTrue(runCatching { restore(config=JsonObject(admission.authoredConfiguration+mapOf("unknown" to JsonPrimitive("edit")))) }.isFailure)
        assertTrue(runCatching { restore(request=JsonObject(admission.preparation.primaryRequest+mapOf("limit" to JsonPrimitive(100)))) }.isFailure)
        assertTrue(runCatching { restore(namespace=JsonObject(ns+mapOf("calendar" to JsonPrimitive("buddhist")))) }.isFailure)
        assertTrue(runCatching { restore(namespace=JsonObject(ns+mapOf("timeZone" to JsonPrimitive("+01:00")))) }.isFailure)
        val datasets=ns.getValue("datasets").jsonArray
        assertTrue(runCatching { restore(namespace=JsonObject(ns+mapOf("datasets" to JsonArray(datasets+datasets)))) }.isFailure)
    }
    @Test fun unchangedOriginalPrefillPermitsAcknowledgedGlobalRunButNewPrefillRejects() {
        val original=primary()
        val prefill=nativeReportPrefillIdentity(buildJsonObject { put("prefill",buildJsonObject { put("orderIds",JsonArray(listOf(JsonPrimitive(2659534)))) }) })
        val request=buildJsonObject { put("filters",JsonObject(emptyMap()));put("limit",50);put("offset",0) }
        val packet=original.preparation.copy(primaryRequest=request,state=JsonObject(emptyMap()),capturedAuthorState=JsonObject(emptyMap()),capturedPrefillIdentity=prefill)
        val global=original.copy(preparation=packet,authorState=JsonObject(emptyMap()),prefillIdentity=prefill,datasets=listOf(NativeReportDatasetAdmission("primary","cube",request)))
        val ns=nativeReportAdmissionContext(global)
        fun restore(identity:JsonObject)=restoredNativeReportAdmission(ns,request,global.authorState,global.document,global.authoredConfiguration,"conversation","cold","builder","state","cube",emptyList(),identity)
        assertEquals(global.datasets,restore(prefill).datasets)
        val changed=nativeReportPrefillIdentity(buildJsonObject { put("prefill",buildJsonObject { put("orderIds",JsonArray(listOf(JsonPrimitive(2703801)))) }) })
        assertTrue(runCatching { restore(changed) }.isFailure)
        assertTrue(runCatching { restore(JsonObject(prefill+mapOf("prefillRevision" to JsonPrimitive("0")))) }.isFailure)
        val digests=ns.getValue("digests").jsonObject
        val missing=JsonObject(ns+mapOf("digests" to JsonObject(digests.filterKeys { it!="prefill" })))
        assertTrue(runCatching { restoredNativeReportAdmission(missing,request,global.authorState,global.document,global.authoredConfiguration,"conversation","cold","builder","state","cube",emptyList(),prefill) }.isFailure)
    }
}

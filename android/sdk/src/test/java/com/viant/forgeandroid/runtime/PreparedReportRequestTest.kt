package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File
import java.time.Instant
import java.time.ZoneId

class PreparedReportRequestTest {
    private val json = Json { ignoreUnknownKeys = true }
    private fun fixture(name: String): JsonObject = json.parseToJsonElement(File("../../testdata/native-report-preparation/$name.json").readText()).jsonObject
    private fun identity(raw: JsonObject) = ReportPreparationIdentity(raw.getValue("windowId").jsonPrimitive.content, raw.getValue("builderRef").jsonPrimitive.content,
        raw.getValue("formRevision").jsonPrimitive.content, raw.getValue("stateRevision").jsonPrimitive.content)
    @Test fun canonicalWebPublishedRequestsMatchExactly() {
        val fixture = fixture("published-requests")
        fixture.getValue("cases").jsonArray.forEach { raw ->
            val entry = raw.jsonObject
            val name = entry.getValue("name").jsonPrimitive.content
            val expected = entry.getValue("expected").jsonObject
            val prepared = PreparedReportRequest(identity(entry.getValue("preparedIdentity").jsonObject), entry.getValue("status").jsonPrimitive.content,
                entry.getValue("primaryDataSourceRef").jsonPrimitive.content, entry.getValue("primaryRequest").jsonObject, entry.getValue("state").jsonObject,
                (entry["requiredBindings"] as? JsonArray).orEmpty().map { ReportIntentBinding(it.jsonObject.getValue("path").jsonPrimitive.content, it.jsonObject.getValue("value")) },
                hookStatus = entry.getValue("hookStatus").jsonPrimitive.content)
            val result = preparePublishedReportRequest(identity(entry.getValue("identity").jsonObject), prepared,
                json.decodeFromJsonElement<ReportBuilderPublishedDataSourceDef>(entry.getValue("source")), entry["datasetScopeParams"] as? JsonObject,
                Instant.parse(fixture.getValue("now").jsonPrimitive.content), ZoneId.of(fixture.getValue("timeZone").jsonPrimitive.content))
            assertEquals(name, expected.getValue("status").jsonPrimitive.content, result.status)
            expected["reason"]?.let { assertEquals(name, it.jsonPrimitive.content, result.reason) }
            expected["request"]?.let { assertEquals(name, it, result.request) }
        }
    }
    @Test fun bridgePlansValidateAllTargetsBeforeAnyEffect() {
        fixture("fetch-plans").getValue("cases").jsonArray.forEach { raw ->
            val entry = raw.jsonObject
            fun refs(key: String) = (entry[key] as? JsonArray).orEmpty().map { it.jsonPrimitive.content }
            val result = preparedReportFetchPlan((entry["requestedRef"] as? JsonPrimitive)?.content, refs("activeRefs"), refs("registryRefs").toSet(), refs("reportRefs").toSet(), refs("preparedRefs").toSet())
            val expected = entry.getValue("expected").jsonObject
            assertEquals(entry.getValue("name").jsonPrimitive.content, expected.getValue("status").jsonPrimitive.content, result.status)
            assertEquals((expected["targets"] as? JsonArray).orEmpty().map { it.jsonPrimitive.content }, result.targets)
        }
    }
}

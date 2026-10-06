package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class ReportPrefillIntentGateTest {
    @Test fun declaredHookCannotEraseFirstDateAndCoercedOrderIntent() {
        val json = Json { ignoreUnknownKeys = true }
        val fixture = json.parseToJsonElement(javaClass.getResource("/steward-request-only.json")!!.readText()).jsonObject
        val config = lowerReportBuilderPredicates(json.decodeFromJsonElement<DashboardReportBuilderVariantDef>(buildJsonObject { put("reportBuilder", fixture.getValue("config")) }).reportBuilder!!)
        val form = mapOf("prefill" to mapOf("from" to "2026-09-27", "to" to "2026-10-04", "orderIds" to listOf("2659534")))
        val bindings = reportBuilderInitialIntentBindings(config, form)
        assertEquals(JsonArray(listOf(JsonPrimitive(2659534))), bindings.first { it.path == "filters.orderIds" }.value)
        val identity = ReportPreparationIdentity("W", "builder", "form", "state")
        val erased = PreparedReportRequest(identity, "ready", "cube", requiredBindings = bindings)
        assertEquals("unbound-intent", preparedReportPrimaryGate(identity, erased).reason)
        assertTrue(reportBuilderInitialIntentBindings(config, emptyMap()).isEmpty())
        assertEquals("ready", preparedReportPrimaryGate(identity, erased.copy(requiredBindings = emptyList())).status)
    }
    @Test fun acknowledgmentRequiresCurrentReadyPublicationAndResetsAfterRevisionOrWindowChange() = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        try {
            val runtime = ForgeRuntime(emptyMap(), scope); runtime.openWindowInline("W", metadata = WindowMetadata())
            val identity = ReportPreparationIdentity("W", "builder", reportPreparationFormRevision(runtime.windowContext("W").peekWindowForm(), runtime.metadataSignal("W").peek()), "state")
            val ready = PreparedReportRequest(identity, "ready", "cube")
            assertFalse(runtime.observeReportPrefill("W", "first", identity.formRevision))
            runtime.acknowledgeReportPrefill("W", "first", ready)
            assertFalse(runtime.reportPrefillAcknowledged("W", "first"))
            runtime.publishPreparedReportRequest(ready); runtime.acknowledgeReportPrefill("W", "first", ready)
            assertTrue(runtime.reportPrefillAcknowledged("W", "first"))
            assertFalse(runtime.observeReportPrefill("W", "new-prefill-or-builder", identity.formRevision))
            assertFalse(runtime.observeReportPrefill("W", "first", identity.formRevision))
            runtime.acknowledgeReportPrefill("W", "first", ready); assertTrue(runtime.reportPrefillAcknowledged("W", "first"))
            runtime.closeWindow("W"); assertFalse(runtime.reportPrefillAcknowledged("W", "first"))
        } finally { scope.cancel() }
    }
    @Test fun equalIdentityDoesNotRetagADifferentPreparedRequestAsCurrent() = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        try {
            val runtime = ForgeRuntime(emptyMap(), scope); runtime.openWindowInline("W", metadata = WindowMetadata())
            val identity = ReportPreparationIdentity("W", "builder", reportPreparationFormRevision(runtime.windowContext("W").peekWindowForm(), runtime.metadataSignal("W").peek()), "state")
            val first = PreparedReportRequest(identity, "ready", "cube", buildJsonObject { put("filters", buildJsonObject { put("orderId", 1) }) })
            runtime.publishPreparedReportRequest(first); assertTrue(runtime.reportPreparationIsCurrent(first))
            val second = first.copy(primaryRequest = buildJsonObject { put("filters", buildJsonObject { put("orderId", 2) }) })
            runtime.publishPreparedReportRequest(second); assertFalse(runtime.reportPreparationIsCurrent(first)); assertTrue(runtime.reportPreparationIsCurrent(second))
        } finally { scope.cancel() }
    }
}

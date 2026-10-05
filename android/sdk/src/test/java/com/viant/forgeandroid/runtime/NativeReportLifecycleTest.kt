package com.viant.forgeandroid.runtime

import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class NativeReportLifecycleTest {
    private fun admission(status: String = "ready", revision: String = "A"): NativeReportAdmission {
        val request = buildJsonObject { put("filters", buildJsonObject { put("orderIds", JsonArray(listOf(JsonPrimitive(2659534)))) }); put("limit", 50); put("offset", 0) }
        val prepared = PreparedReportRequest(ReportPreparationIdentity("W", "builder", "form", revision), status, "cube", request)
        val document = buildJsonObject { put("blocks", JsonArray(listOf(buildJsonObject { put("id", "spend"); put("kind", "kpiBlock"); put("datasetRef", "primary") }))) }
        return NativeReportAdmission(prepared, "conversation", "builder-state", document, listOf(NativeReportDatasetAdmission("primary", "cube", request)))
    }
    private fun host(events: MutableList<String>) = object : NativeReportLifecycleHandler {
        override suspend fun begin(admission: NativeReportAdmission, uiRunRequestId: String, origin: String): NativeReportRunHandle {
            events += "begin"; return NativeReportRunHandle("durable", 1, uiRunRequestId, admission)
        }
        override suspend fun complete(handle: NativeReportRunHandle, rows: JsonObject, current: () -> Boolean): NativeReportCompletedRun {
            assertTrue(current()); events += "persist"; return NativeReportCompletedRun("durable", 2)
        }
        override suspend fun fail(handle: NativeReportRunHandle, code: String, text: String) { events += "fail" }
    }
    @Test fun nestedRepeatedReferencesRemainUniqueByLogicalIdentity() {
        val document = buildJsonObject { put("blocks", JsonArray(listOf(
            buildJsonObject { put("datasetRef", "summary"); put("children", JsonArray(listOf(buildJsonObject { put("datasetRef", "daily") }, buildJsonObject { put("datasetRef", "summary") }))) },
            buildJsonObject { put("datasetRef", "primary") }))) }
        assertEquals(listOf("summary", "daily", "primary"), com.viant.forgeandroid.ui.reportBuilderAuthoredDatasetRefs(document).toList())
    }
    @Test fun remountCannotStartDuplicateMaterializationForTheSameAdmittedRun() = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        try {
            val lifecycle = NativeReportLifecycle(); val events = java.util.Collections.synchronizedList(mutableListOf<String>())
            lifecycle.register(host(events)); val admission = admission(); lifecycle.publish(admission)
            val handle = lifecycle.begin("W", "ui-request", "prompt", admission.preparation) { true }
            val release = CompletableDeferred<Unit>(); val complete = CompletableDeferred<Unit>()
            fun start() = lifecycle.start(scope, handle, { true }, { events += "load"; release.await(); JsonArray(emptyList()) }, {}, { _, _ -> complete.complete(Unit) }, { error(it) })
            start(); start(); release.complete(Unit); withTimeout(2000) { complete.await() }; start(); delay(30)
            assertEquals(listOf("begin", "load", "persist"), events.toList())
        } finally { scope.cancel() }
    }
    @Test fun pendingErrorStaleAndAlteredDatasetRequestsHaveZeroAdmissionEffects() = runBlocking {
        val lifecycle = NativeReportLifecycle(); val events = mutableListOf<String>(); lifecycle.register(host(events))
        for (status in listOf("pending", "error")) {
            val admission = admission(status); lifecycle.publish(admission)
            assertTrue(runCatching { lifecycle.begin("W", status, "prompt", admission.preparation) { true } }.isFailure)
        }
        val old = admission(revision = "A"); val next = admission(revision = "B"); lifecycle.publish(next)
        assertTrue(runCatching { lifecycle.begin("W", "stale", "prompt", old.preparation) { true } }.isFailure)
        val invalid = next.copy(datasets = listOf(next.datasets.single().copy(request = JsonObject(emptyMap())))); lifecycle.publish(invalid)
        assertTrue(runCatching { lifecycle.begin("W", "altered", "prompt", next.preparation) { true } }.isFailure)
        assertEquals(emptyList<String>(), events)
    }
    @Test fun stableAdmissionPrecedesActualRowsAndDurableCompletion() = runBlocking {
        val lifecycle = NativeReportLifecycle(); val events = mutableListOf<String>(); lifecycle.register(host(events))
        val admission = admission(); lifecycle.publish(admission)
        val handle = lifecycle.begin("W", "ui-request", "prompt", admission.preparation) { true }
        assertSame(handle, lifecycle.begin("W", "ui-request", "prompt", admission.preparation) { true })
        val (completed, rows) = lifecycle.loadAndComplete(handle, { true }) { dataset ->
            assertEquals(admission.datasets.single().request, dataset.request); events += "load"
            assertNull(lifecycle.completed("ui-request")); JsonArray(listOf(buildJsonObject { put("totalSpend", 309) }))
        }
        assertEquals(listOf("begin", "load", "persist"), events)
        assertEquals(setOf("primary"), rows.keys); assertEquals(2L, completed.revision)
        assertEquals(completed, lifecycle.completed("ui-request"))
    }
    @Test fun staleRowsCannotReachCompilationOrCompletion() = runBlocking {
        val lifecycle = NativeReportLifecycle(); val events = mutableListOf<String>(); lifecycle.register(host(events))
        val admission = admission(); lifecycle.publish(admission)
        val handle = lifecycle.begin("W", "ui-request", "prompt", admission.preparation) { true }
        var current = true
        assertTrue(runCatching { lifecycle.loadAndComplete(handle, { current }) { current = false; events += "load"; JsonArray(emptyList()) } }.isFailure)
        assertEquals(listOf("begin", "load"), events); assertNull(lifecycle.completed("ui-request"))
    }
}

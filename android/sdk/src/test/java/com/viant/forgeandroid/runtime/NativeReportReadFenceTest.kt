package com.viant.forgeandroid.runtime

import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

class NativeReportReadFenceTest {
    private fun metadata() = WindowMetadata(dataSources = mapOf("cube" to DataSourceDef()),
        view = ViewDef(content = ContentDef(containers = listOf(ContainerDef(id = "builder", kind = "dashboard.reportBuilder", dataSourceRef = "cube", dashboard = DashboardDef(reportBuilder = DashboardReportBuilderDef()))))))
    private fun host() = object : NativeReportLifecycleHandler {
        override suspend fun begin(admission: NativeReportAdmission, uiRunRequestId: String, origin: String) = NativeReportRunHandle("durable", 1, uiRunRequestId, admission)
        override suspend fun complete(handle: NativeReportRunHandle, rows: JsonObject, current: () -> Boolean) = NativeReportCompletedRun(handle.reportRunId, 2)
        override suspend fun fail(handle: NativeReportRunHandle, code: String, text: String) = Unit
    }
    @Test fun admittedReadOwnsItsCompletionAndOrdinaryRefreshCannotQueryCompletedDataset() = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        try {
            val runtime = ForgeRuntime(emptyMap(), scope); runtime.openWindowInline("W", metadata = metadata(), conversationId = "conversation")
            val request = buildJsonObject { put("filters", buildJsonObject { put("orderIds", JsonArray(listOf(JsonPrimitive(2659534)))) }); put("limit", 50); put("offset", 0) }
            val prepared = PreparedReportRequest(ReportPreparationIdentity("W", "builder", reportPreparationFormRevision(runtime.windowContext("W").peekWindowForm(), runtime.metadataSignal("W").peek()), "state"), "ready", "cube", request)
            val document = buildJsonObject { put("blocks", JsonArray(listOf(buildJsonObject { put("id", "one"); put("datasetRef", "primary") }))) }
            val admission = NativeReportAdmission(prepared, "conversation", "state", document, listOf(NativeReportDatasetAdmission("primary", "cube", request)))
            runtime.publishPreparedReportRequest(prepared); runtime.nativeReportLifecycle.publish(admission); runtime.nativeReportLifecycle.register(host())
            val handle = runtime.nativeReportLifecycle.begin("W", "request", "prompt", prepared) { runtime.reportPreparationIsCurrent(it) }
            runtime.setWindowFormValues("W", mapOf("reportRunRequest" to mapOf("id" to "request")), bumpPrefillRevision = false)
            val calls = AtomicInteger(); val started = CompletableDeferred<Unit>(); val release = CompletableDeferred<Unit>()
            runtime.registerDataSourceLoader { calls.incrementAndGet(); started.complete(Unit); release.await(); ForgeRuntime.DataSourceFetchResult(rows = listOf(mapOf("id" to 1))) }
            val context = runtime.windowContext("W").context("cube")
            context.collection.set(listOf(mapOf("id" to 99))); context.control.set(ControlState(resolved = true, requestId = "previous"))
            assertNull(context.setPreparedInputParameters(JsonUtil.asStringMap(JsonUtil.elementToAny(request))) { true })
            val dispatch = context.setPreparedInputParameters(JsonUtil.asStringMap(JsonUtil.elementToAny(request)), NativeReportReadPermit("request", "primary")) { runtime.reportPreparationIsCurrent(prepared) }!!
            withTimeout(2000) { started.await() }
            val result = async { context.awaitPreparedResult(dispatch) }; delay(30); assertFalse(result.isCompleted)
            release.complete(Unit); val captured = withTimeout(2000) { result.await() }
            context.collection.set(listOf(mapOf("id" to 999)))
            assertEquals(JsonPrimitive(1), captured.rows.single().jsonObject["id"])
            runtime.nativeReportLifecycle.complete(handle, buildJsonObject { put("primary", captured.rows) }) { runtime.reportPreparationIsCurrent(it) }
            assertNull(context.setPreparedInputParameters(JsonUtil.asStringMap(JsonUtil.elementToAny(request))) { true })
            assertNull(context.setPreparedInputParameters(JsonUtil.asStringMap(JsonUtil.elementToAny(request)), NativeReportReadPermit("request", "primary")) { true })
            context.fetchCollection(); delay(80)
            assertEquals(1, calls.get())
        } finally { scope.cancel() }
    }
    @Test fun frozenCompletedWindowCannotReopenPrimaryPreview() = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        try {
            val runtime = ForgeRuntime(emptyMap(), scope); runtime.openWindowInline("W", metadata = metadata())
            runtime.setWindowFormValues("W", mapOf("executeOnOpen" to false, "reportMaterialization" to mapOf("status" to "completed")))
            val calls = AtomicInteger(); runtime.registerDataSourceLoader { calls.incrementAndGet(); ForgeRuntime.DataSourceFetchResult() }
            val context = runtime.windowContext("W").context("cube")
            assertNull(context.setPreparedInputParameters(emptyMap()) { true }); context.fetchCollection(); delay(80)
            assertEquals(0, calls.get())
        } finally { scope.cancel() }
    }
}

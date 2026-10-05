package com.viant.forgeandroid.runtime

import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

class PreparedReportDispatchTest {
    private fun metadata() = WindowMetadata(dataSources = mapOf("cube" to DataSourceDef()),
        view = ViewDef(content = ContentDef(containers = listOf(ContainerDef(id = "report", kind = "dashboard.reportBuilder", dataSourceRef = "cube",
            dashboard = DashboardDef(reportBuilder = DashboardReportBuilderDef()))))))

    @Test fun inspectionModeBlocksEvenReadyPreparedPhysicalDispatch() = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        try {
            val runtime = ForgeRuntime(emptyMap(), scope, reportRequestInspectionOnly = true)
            runtime.openWindowInline("W", metadata = metadata())
            val calls = AtomicInteger()
            runtime.registerDataSourceLoader { calls.incrementAndGet(); ForgeRuntime.DataSourceFetchResult(rows = listOf(mapOf("id" to 1))) }
            val context = runtime.windowContext("W").context("cube")
            context.setPreparedInputParameters(mapOf("filters" to mapOf("orderIds" to listOf(2659534)))) { true }
            delay(150)
            assertEquals(0, calls.get())
            assertTrue(context.collection.peek().isEmpty())
            assertTrue(context.metrics.peek().isEmpty())
        } finally { scope.cancel() }
    }
    @Test fun reportOwnedOrdinaryDispatchCannotBypassPreparation() = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        try {
            val runtime = ForgeRuntime(emptyMap(), scope)
            runtime.openWindowInline("W", metadata = metadata())
            val calls = AtomicInteger()
            runtime.registerDataSourceLoader { calls.incrementAndGet(); ForgeRuntime.DataSourceFetchResult(rows = listOf(mapOf("id" to 1))) }
            val context = runtime.windowContext("W").context("cube")
            context.setInputParameters(mapOf("filters" to emptyMap<String, Any?>()), fetch = true)
            context.fetchCollection()
            delay(150)
            assertEquals(0, calls.get())
            assertTrue(context.collection.peek().isEmpty())
        } finally { scope.cancel() }
    }
    @Test fun capturedInputAndGuardStayAtomicAndLateResponseCannotCommit() = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        try {
            val runtime = ForgeRuntime(emptyMap(), scope)
            runtime.openWindowInline("W", metadata = metadata())
            val started = CompletableDeferred<Map<String, Any?>>()
            val release = CompletableDeferred<Unit>()
            val calls = AtomicInteger()
            runtime.registerDataSourceLoader { request ->
                calls.incrementAndGet(); started.complete(request.input.parameters)
                release.await()
                ForgeRuntime.DataSourceFetchResult(rows = listOf(mapOf("id" to 1)))
            }
            val context = runtime.windowContext("W").context("cube")
            var generation = 1
            context.setPreparedInputParameters(mapOf("filters" to mapOf("entityIds" to listOf(101)))) { generation == 1 }
            val captured = withTimeout(3000) { started.await() }
            assertEquals(JsonUtil.anyToElement(mapOf("filters" to mapOf("entityIds" to listOf(101)))), JsonUtil.anyToElement(captured))
            generation = 2 // No replacement fetch: the old response must still be fenced.
            release.complete(Unit)
            delay(150)
            assertEquals(1, calls.get())
            assertTrue(context.collection.peek().isEmpty())
            assertTrue(context.metrics.peek().isEmpty())
        } finally { scope.cancel() }
    }
    @Test fun lateProducerPacketKeepsItsOriginalIdentityAndCannotExecute() = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        try {
            val runtime = ForgeRuntime(emptyMap(), scope)
            runtime.openWindowInline("W", metadata = metadata())
            runtime.setWindowFormValues("W", mapOf("reportBuilderRef" to "A", "reportDefinition" to mapOf("revision" to 1)))
            val identity = ReportPreparationIdentity("W", "A", reportPreparationFormRevision(runtime.windowContext("W").peekWindowForm(), runtime.metadataSignal("W").peek()), "state-A")
            runtime.setWindowFormValues("W", mapOf("reportBuilderRef" to "B", "reportDefinition" to mapOf("revision" to 2)))
            val old = PreparedReportRequest(identity, "ready", "cube")
            assertFalse(runtime.publishPreparedReportRequest(old))
            assertNull(runtime.preparedReportRequest("W"))
            assertFalse(runtime.reportPreparationIsCurrent(old))
        } finally { scope.cancel() }
    }
}

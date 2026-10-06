package com.viant.forgeandroid.runtime

import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CopyOnWriteArrayList

class ReportSourceClassifierTest {
    @Test fun emptyDefaultVariantsDoNotFenceOrdinaryLookupButActualPrimaryStaysUnprepared()=runBlocking {
        val scope=CoroutineScope(SupervisorJob()+Dispatchers.Default)
        try {
            val metadata=WindowMetadata(dataSources=mapOf("advertisers" to DataSourceDef(autoFetch=false),"metrics" to DataSourceDef(autoFetch=false)),
                view=ViewDef(content=ContentDef(containers=listOf(
                    ContainerDef(id="lookup",kind="form",dataSourceRef="advertisers",reportBuilders=emptyMap(),dashboard=DashboardDef(reportBuilders=emptyMap())),
                    ContainerDef(id="report",kind="dashboard.reportBuilder",dataSourceRef="metrics",dashboard=DashboardDef(reportBuilder=DashboardReportBuilderDef()))))))
            assertEquals(setOf("metrics"),reportOwnedDataSourceRefs(metadata))
            val runtime=ForgeRuntime(emptyMap(),scope);runtime.openWindowInline("W",metadata=metadata)
            val calls=CopyOnWriteArrayList<String>();runtime.registerDataSourceLoader { calls+=it.dataSourceRef;ForgeRuntime.DataSourceFetchResult(rows=listOf(mapOf("id" to 7))) }
            runtime.windowContext("W").context("advertisers").fetchCollection()
            withTimeout(2000) { while(calls.isEmpty()) delay(10) }
            runtime.windowContext("W").context("metrics").fetchCollection();delay(100)
            assertEquals(listOf("advertisers"),calls.toList())
            assertNull(runtime.preparedReportRequest("W"))
        } finally { scope.cancel() }
    }
}

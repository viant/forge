package com.viant.forgeandroid.runtime

import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

class NativeReportFrozenAdmissionsTest {
    private fun admission():NativeReportAdmission {
        val request=buildJsonObject { put("filters",buildJsonObject { put("orderIds",JsonArray(listOf(JsonPrimitive(2659534)))) });put("limit",50);put("offset",0) }
        val state=buildJsonObject { put("scopeParams",buildJsonObject { put("orderIds",JsonArray(listOf(JsonPrimitive(2659534)))) });put("opaque",buildJsonObject { put("author",true) }) }
        val packet=PreparedReportRequest(ReportPreparationIdentity("W","builder","form","state"),"ready","cube",request,state,capturedTimeMillis=1000,capturedZoneId="UTC")
        val doc=buildJsonObject { put("blocks",JsonArray(listOf(buildJsonObject { put("datasetRef","primary") }))) }
        val prefill=nativeReportPrefillIdentity(buildJsonObject { put("prefill",buildJsonObject { put("orderIds",JsonArray(listOf(JsonPrimitive(2659534)))) }) })
        return NativeReportAdmission(packet,"conversation","selected-state",doc,listOf(NativeReportDatasetAdmission("primary","cube",request)),buildJsonObject { put("opaque",true) },JsonObject(state+mapOf("dynamicFilterDrafts" to JsonObject(emptyMap()))),prefill)
    }
    private fun form(admission:NativeReportAdmission,rows:JsonArray=JsonArray(emptyList()))=buildJsonObject {
        put("reportBuilderRef","builder");put("selected-state",admission.authorState);put("prefill",buildJsonObject { put("orderIds",JsonArray(listOf(JsonPrimitive(2659534)))) })
        put("executeOnOpen",false);put("reportMaterialization",buildJsonObject { put("status","completed");put("reportRunId","saved") })
        put("reportStaticDatasets",JsonArray(listOf(buildJsonObject { put("id","primary");put("dataSourceRef","cube");put("request",admission.preparation.primaryRequest);put("rows",rows) })))
    }
    @Test fun accountGenerationWindowReuseAndRawIntentEditsInvalidateTrustedFreeze() {
        val registry=NativeReportFrozenAdmissions();registry.bindAccount("account-A");val account=registry.accountBinding()!!
        val admission=admission();val form=form(admission)
        fun install(binding:NativeReportAccountBinding=account)=registry.install("W","conversation",form,admission,"saved","owner",binding)
        assertTrue(install());assertNotNull(registry.current("W","conversation",form,admission.authoredConfiguration,admission.document))
        val edit=JsonObject(form+mapOf("selected-state" to JsonObject(admission.authorState+mapOf("opaque" to JsonObject(emptyMap())))))
        assertNull(registry.current("W","conversation",edit,admission.authoredConfiguration,admission.document));assertFalse(registry.containsWindow("W"))
        assertTrue(install());assertNull(registry.current("W","conversation",JsonObject(form+mapOf("prefill" to JsonObject(emptyMap()))),admission.authoredConfiguration,admission.document))
        assertTrue(install())
        val tampered=form.getValue("reportStaticDatasets").jsonArray.map { JsonObject(it.jsonObject+mapOf("rows" to JsonArray(listOf(buildJsonObject { put("value",999) })))) }
        assertNull(registry.current("W","conversation",JsonObject(form+mapOf("reportStaticDatasets" to JsonArray(tampered))),admission.authoredConfiguration,admission.document))
        assertTrue(install());registry.bindAccount("account-B");assertFalse(install())
        registry.bindAccount("account-A");assertNotEquals(account,registry.accountBinding());assertFalse(install())
        assertTrue(install(registry.accountBinding()!!));registry.closeWindow("W");assertFalse(registry.containsWindow("W"))
    }
    @Test fun verifiedColdPublicationAcknowledgesInitialIntentThenExplicitClearKeepsAcknowledgment() = runBlocking {
        val scope=CoroutineScope(SupervisorJob()+Dispatchers.Default)
        try {
            val admission=admission()
            val metadata=WindowMetadata(view=ViewDef(content=ContentDef(containers=listOf(ContainerDef(id="reportBuilder",reportBuilders=mapOf("builder" to DashboardReportBuilderVariantDef(dataSourceRef="cube",reportBuilder=DashboardReportBuilderDef(authoredConfiguration=admission.authoredConfiguration))))))))
            val runtime=ForgeRuntime(emptyMap(),scope);runtime.openWindowInline("W",metadata=metadata,conversationId="conversation");runtime.bindNativeReportAccount("account")
            runtime.setWindowFormValues("W",JsonUtil.asStringMap(JsonUtil.elementToAny(form(admission))),replace=true,bumpPrefillRevision=false)
            assertTrue(runtime.frozenNativeReports.install("W","conversation",form(admission),admission,"saved","owner",runtime.frozenNativeReports.accountBinding()!!))
            val before=runtime.windowContext("W").peekWindowForm();val revision=reportPreparationFormRevision(before,runtime.metadataSignal("W").peek())
            val key=reportPreparationFingerprint(buildJsonObject { put("builderRef","builder");put("stateKey","selected-state");put("prefill",JsonUtil.anyToElement(before["prefill"]));put("prefillRevision",0) })
            assertFalse(runtime.observeReportPrefill("W",key,revision))
            val frozen=runtime.frozenNativeReportAdmission("W","builder","selected-state",admission.authoredConfiguration,admission.document)!!
            val packet=frozen.admission.preparation
            assertEquals(revision,packet.identity.formRevision)
            assertEquals(admission.authorState,packet.capturedAuthorState)
            runtime.publishPreparedReportRequest(packet);runtime.acknowledgeReportPrefill("W",key,packet);assertTrue(runtime.reportPrefillAcknowledged("W",key))
            val cleared=JsonObject(admission.authorState+mapOf("scopeParams" to JsonObject(emptyMap())))
            runtime.setWindowFormValues("W",mapOf("selected-state" to JsonUtil.elementToAny(cleared)),bumpPrefillRevision=false)
            assertFalse(runtime.publishPreparedReportRequest(packet))
            assertEquals(admission.authorState,packet.capturedAuthorState)
            assertNull(runtime.frozenNativeReportAdmission("W","builder","selected-state",admission.authoredConfiguration,admission.document))
            val changedRevision=reportPreparationFormRevision(runtime.windowContext("W").peekWindowForm(),runtime.metadataSignal("W").peek())
            assertTrue(runtime.observeReportPrefill("W",key,changedRevision))
            val bindings=if(runtime.reportPrefillAcknowledged("W",key)) emptyList() else listOf(ReportIntentBinding("filters.orderIds",JsonArray(listOf(JsonPrimitive(2659534)))))
            val global=packet.copy(identity=packet.identity.copy(formRevision=changedRevision),primaryRequest=buildJsonObject { put("filters",JsonObject(emptyMap())) },state=cleared,requiredBindings=bindings,capturedAuthorState=cleared)
            assertEquals("ready",preparedReportPrimaryGate(global.identity,global).status)
            runtime.bindNativeReportAccount("other-account");assertFalse(runtime.reportPrefillAcknowledged("W",key))
        } finally { scope.cancel() }
    }
    @Test fun frozenHydrationKeepsExactRequestEmptyRowsAndNeverQueriesEvenOnOrdinaryRefresh()=runBlocking {
        val scope=CoroutineScope(SupervisorJob()+Dispatchers.Default)
        try {
            val metadata=WindowMetadata(dataSources=mapOf("cube" to DataSourceDef()),view=ViewDef(content=ContentDef(containers=listOf(ContainerDef(id="builder",kind="dashboard.reportBuilder",dataSourceRef="cube",dashboard=DashboardDef(reportBuilder=DashboardReportBuilderDef()))))))
            val runtime=ForgeRuntime(emptyMap(),scope);runtime.openWindowInline("W",metadata=metadata,conversationId="conversation")
            val admission=admission();val rows=JsonArray(emptyList());runtime.setWindowFormValues("W",JsonUtil.asStringMap(JsonUtil.elementToAny(form(admission,rows))),replace=true,bumpPrefillRevision=false)
            val calls=AtomicInteger();runtime.registerDataSourceLoader { calls.incrementAndGet();ForgeRuntime.DataSourceFetchResult() }
            val context=runtime.windowContext("W").context("cube")
            assertTrue(context.hydrateFrozenReportDataset(admission.datasets.single(),rows))
            assertEquals(admission.preparation.primaryRequest,JsonUtil.anyToElement(context.input.peek().parameters));assertTrue(context.collection.peek().isEmpty());assertTrue(context.control.peek().resolved)
            assertFalse(context.input.peek().fetch);assertFalse(context.input.peek().refresh)
            context.fetchCollection();delay(100);assertEquals(0,calls.get())
            assertFalse(context.hydrateFrozenReportDataset(admission.datasets.single().copy(request=JsonObject(emptyMap())),rows))
            val onlyPublished=buildJsonObject { put("id","published");put("dataSourceRef","cube");put("request",admission.preparation.primaryRequest);put("rows",JsonArray(listOf(buildJsonObject { put("id",7) }))) }
            runtime.setWindowFormValues("W",mapOf("reportStaticDatasets" to JsonUtil.elementToAny(JsonArray(listOf(onlyPublished)))),bumpPrefillRevision=false)
            val alias=runtime.windowContext("W").contextForInstanceOrNull("reportDocument:published","cube")!!
            assertTrue(alias.hydrateFrozenReportDataset(NativeReportDatasetAdmission("published","cube",admission.preparation.primaryRequest),onlyPublished.getValue("rows").jsonArray))
            assertTrue(context.hydrateFrozenReportPrimaryIdentity(admission.preparation))
            assertFalse(context.control.peek().resolved);assertTrue(context.collection.peek().isEmpty());assertEquals(false,context.metrics.peek()["dataStored"])
            assertEquals(admission.preparation.primaryRequest,JsonUtil.anyToElement(context.input.peek().parameters))
            assertEquals(1,alias.collection.peek().size);assertTrue(alias.control.peek().resolved)
            context.fetchCollection();alias.fetchCollection();delay(100);assertEquals(0,calls.get())
        } finally { scope.cancel() }
    }
    @Test fun mountedAutomaticEntryRespectsAutoFetchFalseWhileExplicitRefreshRemainsAvailable()=runBlocking {
        val scope=CoroutineScope(SupervisorJob()+Dispatchers.Default)
        try {
            val runtime=ForgeRuntime(emptyMap(),scope)
            runtime.openWindowInline("ordinary",metadata=WindowMetadata(dataSources=mapOf("ordinary-source" to DataSourceDef(autoFetch=false))))
            val calls=AtomicInteger();runtime.registerDataSourceLoader { calls.incrementAndGet();ForgeRuntime.DataSourceFetchResult() }
            val context=runtime.windowContext("ordinary").context("ordinary-source")
            assertFalse(context.fetchCollectionAutomatically());delay(80);assertEquals(0,calls.get())
            context.fetchCollection();withTimeout(2000) { while(calls.get()==0) delay(10) };assertEquals(1,calls.get())
        } finally { scope.cancel() }
    }
}

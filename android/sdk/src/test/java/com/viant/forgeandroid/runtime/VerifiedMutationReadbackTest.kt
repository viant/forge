package com.viant.forgeandroid.runtime

import com.viant.forgeandroid.ui.startControlMutation
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.test.*

/** Synthetic inventory mutation through the compiled footer and native datasource request paths. */
class VerifiedMutationReadbackTest {
    private val acknowledged = mapOf("data" to listOf(mapOf("id" to 42)), "warning" to "retained")
    private val confirmed = mapOf("key" to 42, "tenant" to 9, "division" to "A", "label" to null)
    private fun inputs(id: Int = 42) = mapOf("items" to listOf(mapOf("id" to id, "name" to null)))

    private class Fixture(val scope: CoroutineScope, server: MockWebServer? = null, readerMethod: String = "POST") {
        val runtime = ForgeRuntime(if (server == null) emptyMap() else mapOf("fixture" to EndpointConfig(server.url("/").toString())), scope)
        val metadata = JsonUtil.json.decodeFromJsonElement(WindowMetadata.serializer(), normalizeWindowMetadataJson(
            JsonUtil.json.parseToJsonElement("""
            {"namespace":"Items","view":{"content":{}},"authorizationSnapshot":{"principal":{"subject":"owner"}},
             "dataSource":{"draft":{"autoFetch":false},"parent":{"autoFetch":false,"uniqueKey":[{"field":"key"}]},
                 "writer":{"autoFetch":false,"service":{"endpoint":"fixture","uri":"/v1/api/datasources/writer/fetch","method":"POST"}},
                 "reader":{"autoFetch":false,"service":{"endpoint":"fixture","uri":"/v1/api/datasources/reader/fetch","method":"$readerMethod"},
                           "params":{"ambient":"excluded"},"parameters":[{"name":"ambient","in":"windowForm","location":"tenantId","to":"query"}]},
                 "related":{"autoFetch":false,"service":{"endpoint":"fixture","uri":"/v1/api/datasources/related/fetch","method":"POST"}}},
             "dialogs":[{"id":"edit","dataSourceRef":"draft","fetchOnOpen":false,
               "actions":[{"id":"submit","label":"Apply","close":true,
                "mutationCommand":{"commandId":"submit","dataSourceRef":"writer","serializationGroup":"editor","confirm":"Apply?",
                 "receiptIdentity":{"field":"id","submittedRows":"items"},
                 "reconcile":{"mode":"refetch","dataSourceRef":"reader","identityField":"key","resultPath":"0.data",
                   "verify":{"idsParameter":"acknowledgedIds","fields":{"name":"label","absent":"missingInReader"},"scope":[
                     {"field":"tenant","passToReader":true,"parameter":{"name":"tenantId","in":"windowForm","location":"tenantId"}},
                     {"field":"division","parameter":{"name":"division","in":"windowForm","location":"division","to":"reader"}}
                   ]}},
                 "resultState":{"writerWarning":["0.warning"]},"successState":{"completed":true},
                 "refresh":[{"dataSourceRef":"related"}]}}]}]}
            """.trimIndent())))
        val id = runtime.openWindowInline("items", "Items", metadata = metadata).windowId
        val window = runtime.windowContext(id)
        val source = window.context("draft")
        val action = metadata.dialogs.single().actions.single()
        val command = checkNotNull(action.footerCommand())
        init { setScope(); open() }
        fun setScope(tenant: Any? = 9) = runtime.setWindowFormValues(id, mapOf("tenantId" to tenant, "division" to "A"))
        fun open() = runtime.openDialog(id, "edit", emptyMap())
        fun close() = runtime.closeDialogPublic(id, "edit")
        fun submit(extras: Map<String, Any?>, retry: String? = null, cmd: MutationCommandDef = command,
            confirm: suspend (String) -> Boolean = { true }) =
            startControlMutation(runtime, window, source, cmd, extras, scope, "edit", closeOnSuccess = action.close,
                retryVerificationInvocationId = retry, confirm = confirm)
        suspend fun state() = runtime.mutationCommands.state(id, command)
    }

    @Test fun retriesOnlyTheExactReaderAndRetainsOriginalNestedAcknowledgement() = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val f = Fixture(scope)
            f.setScope(listOf(9))
            val requests = CopyOnWriteArrayList<ForgeRuntime.DataSourceFetchRequest>()
            var attempt = 0
            val failure = HttpResponseException(503, "POST", "http://fixture.invalid/reader")
            f.window.context("reader").collection.set(listOf(mapOf("key" to 99)))
            f.runtime.registerDataSourceLoader { request ->
                requests.add(request)
                when (request.dataSourceRef) {
                    "writer" -> ForgeRuntime.DataSourceFetchResult(rows = listOf(acknowledged))
                    "reader" -> when (++attempt) {
                        1 -> throw failure
                        2 -> ForgeRuntime.DataSourceFetchResult(rows = listOf(confirmed - "label"))
                        else -> ForgeRuntime.DataSourceFetchResult(rows = listOf(confirmed))
                    }
                    else -> ForgeRuntime.DataSourceFetchResult()
                }
            }
            val first = f.submit(inputs()).await()
            assertEquals("verification_failed", first.status)
            assertTrue(first.accepted)
            assertSame(failure, first.cause)
            assertEquals("verify", first.warnings.single().stage)
            assertEquals(JsonUtil.anyToElement(listOf(acknowledged)).jsonArray, first.writerRecords)
            assertNull(first.readbackRows)
            assertEquals(MutationWriterStatus.Succeeded, f.state().writerStatus)
            assertEquals(MutationSyncStatus.VerificationFailed, f.state().syncStatus)
            assertTrue(f.state().guarded)
            assertTrue(f.state().retryAllowed)
            assertTrue(f.window.dialogSignal("edit").peek().open)
            assertFalse(f.window.peekWindowForm().containsKey("completed"))

            val missing = f.submit(inputs(), first.invocationId, confirm = { error("A retry must not reconfirm.") }).await()
            assertEquals("verification_failed", missing.status)
            assertEquals(first.invocationId, missing.invocationId)
            val result = f.submit(inputs(99), first.invocationId).await()
            assertEquals("succeeded", result.status)
            assertEquals(first.invocationId, result.invocationId)
            assertEquals(first.writerRecords, result.writerRecords)
            assertEquals(JsonUtil.anyToElement(listOf(confirmed)), JsonUtil.anyToElement(result.readbackRows))
            assertEquals(listOf("writer", "reader", "reader", "reader", "related"), requests.map { it.dataSourceRef })
            val reads = requests.filter { it.dataSourceRef == "reader" }
            assertEquals(3, reads.map { it.invocationId }.toSet().size)
            assertTrue(reads.all { it.invocationId != null && it.invocationId != first.invocationId && it.bypassCache })
            val exact = JsonUtil.anyToElement(mapOf("tenantId" to listOf(9), "acknowledgedIds" to listOf(42)))
            assertTrue(reads.all { JsonUtil.anyToElement(it.input.parameters) == exact && JsonUtil.anyToElement(it.resolvedInputs) == exact })
            assertEquals(listOf(mapOf("key" to 99)), f.window.context("reader").collection.peek())
            assertFalse(f.window.dialogSignal("edit").peek().open)
            assertEquals("retained", f.window.peekWindowForm()["writerWarning"])
        } finally { scope.cancel() }
    }

    @Test fun wireReaderPostsUncachedTypedIdsWithoutConfiguredAmbientParameters() = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        MockWebServer().use { server ->
            try {
                server.enqueue(MockResponse().setBody("""{"data":[{"data":[{"id":42}],"warning":"retained"}]}"""))
                server.enqueue(MockResponse().setBody("""{"data":[{"key":42,"tenant":9,"division":"A","label":null}]}"""))
                server.enqueue(MockResponse().setBody("""{"data":[]}"""))
                server.start()
                val f = Fixture(scope, server)
                f.setScope(listOf("9"))
                val reconcile = checkNotNull(f.command.reconcile)
                val verify = checkNotNull(reconcile.verify)
                val scoped = verify.scope.map { binding ->
                    if (binding.passToReader) binding.copy(parameter = binding.parameter.copy(
                        codec = JsonObject(mapOf("name" to JsonPrimitive("int[]")))
                    )) else binding
                }
                val command = f.command.copy(reconcile = reconcile.copy(verify = verify.copy(scope = scoped)))
                val result = f.submit(inputs(), cmd = command).await()
                assertEquals("succeeded", result.status, result.error)
                val paths = (1..3).map { server.takeRequest() }
                assertEquals(listOf("/v1/api/datasources/writer/fetch","/v1/api/datasources/reader/fetch","/v1/api/datasources/related/fetch"), paths.map { it.path })
                val reader = paths[1]
                val body = JsonUtil.json.parseToJsonElement(reader.body.readUtf8()).jsonObject
                assertEquals("POST", reader.method)
                assertEquals("no-cache", reader.getHeader("Cache-Control"))
                assertEquals(JsonUtil.anyToElement(mapOf("tenantId" to listOf(9), "acknowledgedIds" to listOf(42))), body["inputs"])
                assertEquals(JsonUtil.anyToElement(mapOf("bypassCache" to true)), body["cache"])
                assertNotNull(body["invocationId"]?.jsonPrimitive?.contentOrNull)
                assertEquals(3, server.requestCount)
            } finally { scope.cancel() }
        }
    }

    @Test fun unusableScopeValuesStopBeforeAnyWriterOrReaderDispatch() = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val f = Fixture(scope)
            val requests = CopyOnWriteArrayList<String>()
            f.runtime.registerDataSourceLoader { request ->
                requests.add(request.dataSourceRef)
                ForgeRuntime.DataSourceFetchResult()
            }
            val invalid = listOf(null, "", "   ", listOf(9, 10), emptyList<Int>(), listOf(null),
                listOf(" "), listOf(listOf(9)), mapOf("id" to 9), listOf(mapOf("id" to 9)))
            for (tenant in invalid) {
                f.setScope(tenant)
                val result = f.submit(inputs()).await()
                assertEquals("invalid_payload", result.status, "Scope value: $tenant")
                assertEquals(MutationWriterStatus.NotInvoked, f.state().writerStatus)
            }
            f.runtime.setWindowFormValues(f.id, mapOf("division" to "A"), replace = true)
            assertEquals("invalid_payload", f.submit(inputs()).await().status)
            assertTrue(requests.isEmpty())
        } finally { scope.cancel() }
    }

    @Test fun eachPresentSubmittedFieldIsCheckedEvenWhenTwoFieldsMapToTheSameReaderPath() = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val f = Fixture(scope)
            val reconcile = checkNotNull(f.command.reconcile)
            val spec = checkNotNull(reconcile.verify)
            val command = f.command.copy(reconcile = reconcile.copy(verify = spec.copy(
                fields = linkedMapOf("name" to "label", "alias" to "label", "omitted" to "missing")
            )))
            val captured = mapOf("items" to listOf(mapOf("id" to 42, "name" to null,
                "alias" to "alternate", "unrelated" to mapOf("large" to "irrelevant"))))
            val prepared = checkNotNull(PreparedMutationReadback.prepare(command, captured, f.source, f.runtime.parameterResolver))
            val acknowledgedIds = JsonUtil.anyToElement(listOf(mapOf("id" to 42))).jsonArray
            // Each result matches one of the two explicitly submitted values;
            // checking either expectation alone would incorrectly succeed.
            assertFalse(prepared.matches(listOf(confirmed), acknowledgedIds))
            assertFalse(prepared.matches(listOf(confirmed + ("label" to "alternate")), acknowledgedIds))
        } finally { scope.cancel() }
    }

    @Test fun generatedIdentityAndExactRowAndScopeEvidenceAreChecked() = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val f = Fixture(scope)
            val spec = checkNotNull(f.command.reconcile)
            val command = f.command.copy(receiptIdentity = MutationReceiptIdentityDef("id", generated = true),
                reconcile = spec.copy(verify = checkNotNull(spec.verify).copy(submittedRows = "items")))
            val rows = ArrayDeque(listOf(listOf(confirmed, confirmed), listOf(confirmed + ("division" to "B")),
                listOf(confirmed + ("key" to 43)), listOf(confirmed)))
            var writerCalls = 0
            f.runtime.registerDataSourceLoader { request ->
                when (request.dataSourceRef) {
                    "writer" -> { writerCalls++; ForgeRuntime.DataSourceFetchResult(rows = listOf(acknowledged)) }
                    "reader" -> ForgeRuntime.DataSourceFetchResult(rows = rows.removeFirst())
                    else -> ForgeRuntime.DataSourceFetchResult()
                }
            }
            val extra = mapOf("items" to listOf(mapOf("name" to null)))
            var result = f.submit(extra, cmd = command).await()
            repeat(3) {
                assertEquals("verification_failed", result.status)
                result = f.submit(extra, retry = result.invocationId, cmd = command).await()
            }
            assertEquals("succeeded", result.status)
            assertEquals(1, writerCalls)
        } finally { scope.cancel() }
    }

    @Test fun cancelledReadKeepsTheAcknowledgementForAReaderOnlyRetry() = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val f = Fixture(scope)
            val entered = CompletableDeferred<Unit>()
            val ids = CopyOnWriteArrayList<String>()
            var writerCalls = 0
            f.runtime.registerDataSourceLoader { request ->
                when (request.dataSourceRef) {
                    "writer" -> { writerCalls++; ForgeRuntime.DataSourceFetchResult(rows = listOf(acknowledged)) }
                    "reader" -> {
                        ids.add(checkNotNull(request.invocationId))
                        if (ids.size == 1) {
                            entered.complete(Unit)
                            awaitCancellation()
                        }
                        ForgeRuntime.DataSourceFetchResult(rows = listOf(confirmed))
                    }
                    else -> ForgeRuntime.DataSourceFetchResult()
                }
            }
            val first = f.submit(inputs())
            withTimeout(5_000) { entered.await() }
            first.cancelAndJoin()
            val state = f.state()
            assertEquals(MutationCommandPhase.VerificationFailed, state.phase)
            assertEquals(MutationWriterStatus.Succeeded, state.writerStatus)
            assertContains(state.message, "cancelled")
            assertTrue(state.retryAllowed)
            val result = f.submit(inputs(), state.invocationId).await()
            assertEquals("succeeded", result.status)
            assertEquals(state.invocationId, result.invocationId)
            assertEquals(1, writerCalls)
            assertEquals(2, ids.toSet().size)
        } finally { scope.cancel() }
    }

    @Test fun directGetVerificationCannotDropTheIdArrayAndClaimSuccess() = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        MockWebServer().use { server ->
            try {
                server.enqueue(MockResponse().setBody("""{"data":[{"data":[{"id":42}]}]}"""))
                server.start()
                val f = Fixture(scope, server, readerMethod = "GET")
                val result = f.submit(inputs()).await()
                assertEquals("verification_failed", result.status)
                assertEquals(MutationWriterStatus.Succeeded, f.state().writerStatus)
                assertContains(checkNotNull(result.cause).message.orEmpty(), "exact ID array")
                assertEquals(1, server.requestCount)
            } finally { scope.cancel() }
        }
    }

    @Test fun callerIdentitiesSurviveDisplayChangesDuringVerification() = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val f = Fixture(scope)
            val parent = f.window.context("parent")
            fun selection(label: String) = SelectionState(selected = mapOf("key" to 42, "label" to label))
            parent.setSelection(selection("Original"))
            f.close()
            f.runtime.openDialog(f.id, "edit", emptyMap(), callerDataSourceRef = "parent")
            val entered = CompletableDeferred<Unit>()
            val release = CompletableDeferred<Unit>()
            f.runtime.registerDataSourceLoader { request ->
                when (request.dataSourceRef) {
                    "writer" -> ForgeRuntime.DataSourceFetchResult(rows = listOf(acknowledged))
                    "reader" -> {
                        entered.complete(Unit)
                        release.await()
                        ForgeRuntime.DataSourceFetchResult(rows = listOf(confirmed))
                    }
                    else -> ForgeRuntime.DataSourceFetchResult()
                }
            }
            val submitting = f.submit(inputs())
            withTimeout(5_000) { entered.await() }
            parent.setSelection(selection("Retitled"))
            f.source.setSelection(SelectionState(selected = mapOf("id" to "unrelated draft row")))
            release.complete(Unit)
            assertEquals("succeeded", submitting.await().status)
        } finally { scope.cancel() }
    }

    @Test fun rapidCallerSelectionAwayAndBackInvalidatesRetryButNotTheAcknowledgement() = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val f = Fixture(scope)
            val parent = f.window.context("parent")
            val selected = SelectionState(selected = mapOf("key" to 42, "label" to "Reviewed"))
            parent.setSelection(selected)
            f.close()
            f.runtime.openDialog(f.id, "edit", emptyMap(), callerDataSourceRef = "parent")
            val calls = CopyOnWriteArrayList<String>()
            f.runtime.registerDataSourceLoader { request ->
                calls.add(request.dataSourceRef)
                when (request.dataSourceRef) {
                    "writer" -> ForgeRuntime.DataSourceFetchResult(rows = listOf(acknowledged))
                    else -> ForgeRuntime.DataSourceFetchResult()
                }
            }
            val first = f.submit(inputs()).await()
            assertEquals("verification_failed", first.status)
            assertNotNull(first.writerRecords)
            // Both writes occur in the same coroutine turn, before any flow collector runs.
            parent.setSelection(SelectionState(selected = mapOf("key" to 43)))
            parent.setSelection(selected)
            val refused = f.submit(inputs(), first.invocationId).await()
            assertEquals("verification_failed", refused.status)
            assertNull(refused.writerRecords)
            assertFalse(f.state().retryAllowed)
            assertEquals(MutationWriterStatus.Succeeded, f.state().writerStatus)
            assertEquals(listOf("writer","reader"), calls)
        } finally { scope.cancel() }
    }

    @Test fun replacedDialogCannotReceiveOldReceiptAndCanSubmitAnExplicitNewRecord() = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val f = Fixture(scope)
            val entered = CompletableDeferred<Unit>()
            val release = CompletableDeferred<Unit>()
            val requests = CopyOnWriteArrayList<String>()
            var readerCalls = 0
            f.runtime.registerDataSourceLoader { request ->
                requests.add(request.dataSourceRef)
                when (request.dataSourceRef) {
                    "writer" -> {
                        val row = (request.input.parameters["items"] as List<*>).single() as Map<*, *>
                        ForgeRuntime.DataSourceFetchResult(rows = listOf(mapOf("data" to listOf(mapOf("id" to row["id"])))))
                    }
                    "reader" -> {
                        if (++readerCalls == 1) { entered.complete(Unit); release.await() }
                        val id = (request.input.parameters["acknowledgedIds"] as List<*>).single()
                        ForgeRuntime.DataSourceFetchResult(rows = listOf(confirmed + ("key" to id)))
                    }
                    else -> ForgeRuntime.DataSourceFetchResult()
                }
            }
            val original = f.submit(inputs())
            withTimeout(5_000) { entered.await() }
            assertEquals("suppressed", f.submit(inputs()).await().status)
            f.close()
            f.open()
            release.complete(Unit)
            val obsolete = original.await()
            assertEquals("verification_failed", obsolete.status)
            assertNull(obsolete.writerRecords)
            assertNull(obsolete.readbackRows)
            assertEquals("suppressed", f.submit(inputs(43), obsolete.invocationId).await().status)
            assertEquals("succeeded", f.submit(inputs(43)).await().status)
            assertEquals(listOf("writer","reader","writer","reader","related"), requests)
        } finally { scope.cancel() }
    }
}

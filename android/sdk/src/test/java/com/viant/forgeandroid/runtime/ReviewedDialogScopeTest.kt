package com.viant.forgeandroid.runtime

import com.dokar.quickjs.QuickJs
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import kotlin.coroutines.CoroutineContext
import kotlin.test.*

class ReviewedDialogScopeTest {
    private val bindings = """[{"parameter":"parent","source":"windowForm","field":"current.0"},
        {"parameter":"parent","source":"collection","dataSourceRef":"parents","field":"0.id"},
        {"parameter":"range","source":"metrics","dataSourceRef":"parents","field":"range"},
        {"parameter":"id","source":"selection","dataSourceRef":"parents","field":"selected.id"}]"""
    private val args = mapOf("parent" to 7, "range" to listOf(2, 3), "id" to 11)
    private class PausedDispatcher : CoroutineDispatcher() {
        private val tasks = java.util.concurrent.ConcurrentLinkedQueue<Runnable>()
        override fun dispatch(context: CoroutineContext, block: Runnable) { tasks.add(block) }
        fun runNext(): Boolean = tasks.poll()?.let { it.run()
            true } ?: false
        fun drain() { while (runNext()) { /* drain until quiescent */ } }
    }

    private inner class Fixture(spec: String = """"dataSourceRef":"save"""", dispatcher: CoroutineDispatcher = Dispatchers.Unconfined,
        reviewed: Boolean = true) {
        val scope = CoroutineScope(SupervisorJob() + dispatcher)
        val runtime = ForgeRuntime(endpoints = emptyMap(), scope = scope)
        private val reviewSpec = if (reviewed) """"reviewedScope":$bindings,""" else ""
        private val actions = if ("App.prepare" in spec) """"actions":{"code":"({prepare:()=>({})})"},""" else ""
        val metadata = JsonUtil.json.decodeFromString(WindowMetadata.serializer(), """
            {"namespace":"App","view":{"content":{}},$actions
             "authorizationSnapshot":{"principal":{"subject":"owner","issuer":"issuer","tenantId":"one"}},
             "dataSource":{"draft":{"autoFetch":false},"parents":{"autoFetch":false},"save":{"autoFetch":false,"parameters":[{"name":"id","in":"input","location":"save.parameters.id"}]},
                 "stage":{"autoFetch":false},"undo":{"autoFetch":false},"reader":{"autoFetch":false},"list":{"autoFetch":false}},
             "dialogs":[{"id":"edit","dataSourceRef":"draft","fetchOnOpen":false,"actions":[{"id":"apply","mutationCommand":{
                "commandId":"submit",$reviewSpec$spec}}]}]}
        """.trimIndent())
        val window = runtime.windowContext(runtime.openWindowInline("items","Items",metadata=metadata).windowId)
        val draft = window.context("draft")
        val parent = window.context("parents")
        val command = metadata.dialogs.single().actions.single().footerCommand()!!
        val calls: MutableList<String> = java.util.Collections.synchronizedList(mutableListOf())
        var handler: suspend (ForgeRuntime.DataSourceFetchRequest) -> ForgeRuntime.DataSourceFetchResult = {
            ForgeRuntime.DataSourceFetchResult(rows=listOf(mapOf("id" to 11,"parent" to 7)))
        }
        init {
            current(7L)
            parent.collection.set(listOf(mapOf("id" to 7.0)))
            parent.metrics.set(mapOf("range" to listOf(2L,3)))
            parent.setSelection(SelectionState(selected=mapOf("id" to 11)))
            runtime.registerDataSourceLoader { request -> calls += request.dataSourceRef
                handler(request) }
        }
        fun current(parent: Any?) { runtime.setWindowFormValues(window.windowId,mapOf("current" to listOf(parent))) }
        fun open(launch: Map<String,Any?> = args) { runtime.openDialog(window.windowId,"edit",launch) }
        fun close() { runtime.closeDialogPublic(window.windowId,"edit") }
        fun actor(subject: String, issuer: String = "issuer", tenant: String = "one") {
            window.metadata.set(metadata.copy(authorizationSnapshot=mapOf("principal" to JsonUtil.anyToElement(
                mapOf("subject" to subject, "issuer" to issuer, "tenantId" to tenant)))))
        }
        suspend fun submit(extras: Map<String,Any?> = emptyMap(), confirm: (suspend(String)->Boolean)? = null,
            retry: String? = null): MutationCommandResult {
            val signal = window.dialogSignal("edit")
            val shown = signal.peek()
            return runtime.mutationCommands.executePresented(runtime,window,draft,command,extras,shown,
                { signal.peek() === shown && shown.open },confirm,retryVerificationInvocationId=retry)
        }
    }

    @Test fun openingArgumentsAreImmutableAndActorAndAllFourSourcesAreExact() = runBlocking {
        val fixture = Fixture()
        try {
            val range = mutableListOf(2,3)
            fixture.open(args+("range" to range))
            range[0]=5
            fixture.draft.setInputParameters(mapOf("parent" to 99,"id" to 11))
            fixture.current("7")
            assertFalse(fixture.submit().accepted)
            fixture.current(7)
            fixture.parent.metrics.set(mapOf("range" to listOf(5,3)))
            assertFalse(fixture.submit().accepted)
            fixture.parent.metrics.set(mapOf("range" to listOf(2,3)))
            fixture.parent.setSelection(SelectionState(selected=mapOf("id" to "11")))
            assertFalse(fixture.submit().accepted)
            fixture.parent.setSelection(SelectionState(selected=mapOf("id" to 11)))
            fixture.parent.collection.set(listOf(mapOf("id" to 8)))
            assertFalse(fixture.submit().accepted)
            fixture.parent.collection.set(listOf(mapOf("id" to 7)))
            for (value in listOf(null, "", " ")) { fixture.current(value)
                assertFalse(fixture.submit().accepted) }
            fixture.current(7)
            fixture.actor("other")
            assertFalse(fixture.submit().accepted)
            fixture.actor("owner","different")
            assertFalse(fixture.submit().accepted)
            fixture.actor("owner", tenant="different")
            assertFalse(fixture.submit().accepted)
            fixture.actor("owner")
            assertTrue(fixture.calls.isEmpty())
            fixture.submit().let { assertEquals("succeeded",it.status,it.toString()) }
            assertEquals(listOf("save"),fixture.calls)
            fixture.close()
            fixture.actor("")
            fixture.open()
            fixture.actor("owner")
            assertFalse(fixture.submit().accepted)
            fixture.close()
            fixture.open(args-"id")
            assertFalse(fixture.submit().accepted)
        } finally { fixture.scope.cancel() }
    }

    @Test fun physicalWriterRechecksAfterPreparingAndAfterQueueing() = runBlocking {
        val fixture = Fixture(""""dataSourceRef":"save","prepare":"App.prepare"""")
        try {
            fixture.open()
            val entered = CompletableDeferred<Unit>()
            val release = CompletableDeferred<Unit>()
            ActionHookRuntime.testScriptEvaluator = { script ->
                entered.complete(Unit)
                release.await()
                val engine=QuickJs.create(Dispatchers.Default)
                try { engine.evaluate<String>(script) } finally { engine.close() }
            }
            val submitted = async { fixture.submit() }
            withTimeout(5000){entered.await()}
            fixture.current(8)
            release.complete(Unit)
            assertFalse(submitted.await().accepted)
            assertTrue(fixture.calls.isEmpty())
        } finally { ActionHookRuntime.testScriptEvaluator=null
        fixture.scope.cancel() }
        val dispatcher = PausedDispatcher()
        val queued = Fixture(dispatcher=dispatcher)
        try {
            queued.open()
            dispatcher.drain()
            val submitted = async(start=CoroutineStart.UNDISPATCHED){queued.submit()}
            queued.current(8)
            dispatcher.drain()
            val result = submitted.await()
            assertFalse(result.accepted)
            assertEquals("invalid",result.status)
            assertTrue(queued.calls.isEmpty())
            assertEquals(MutationWriterStatus.NotInvoked,queued.runtime.mutationCommands.state(queued.window.windowId,queued.command).writerStatus)
        } finally { queued.scope.cancel()
        dispatcher.drain() }
    }

    @Test fun staleAcknowledgementPreservesReceiptAndBlocksReplayOnOldPresentation() = runBlocking {
        val fixture = Fixture(""""dataSourceRef":"save","successState":{"done":true},"refresh":[{"dataSourceRef":"list"}]""")
        try {
            fixture.open()
            val entered = CompletableDeferred<Unit>()
            val release = CompletableDeferred<Unit>()
            fixture.handler={entered.complete(Unit)
                release.await()
                ForgeRuntime.DataSourceFetchResult(rows=listOf(mapOf("id" to 11)))}
            val submitted = async{fixture.submit()}
            withTimeout(5000){entered.await()}
            fixture.current(8)
            release.complete(Unit)
            val result = submitted.await()
            assertTrue(result.accepted)
            assertEquals("superseded",result.status)
            assertTrue(result.invocationId.isNotEmpty())
            assertEquals(MutationWriterStatus.Succeeded,result.writerStatus)
            assertNull(result.writerRecords)
            assertNull(fixture.window.peekWindowForm()["done"])
            assertTrue(fixture.window.context("save").collection.peek().isEmpty())
            fixture.current(7)
            assertFalse(fixture.submit().accepted)
            assertEquals(listOf("save"),fixture.calls)
            fixture.close()
            fixture.open()
            fixture.submit().let { assertEquals("succeeded",it.status,it.toString()) }
            assertEquals(listOf("save","save","list"),fixture.calls)
        } finally {fixture.scope.cancel()}
    }

    @Test fun scopeLossDuringConfirmedStepSkipsRootAndCleanupAndGroupConfirmationRechecks() = runBlocking {
        val ordered = Fixture(""""dataSourceRef":"save","before":[{"command":{"commandId":"upload","dataSourceRef":"stage"},
            "cleanup":{"commandId":"discard","dataSourceRef":"undo"}}]""")
        try {
            ordered.open()
            ordered.handler={ordered.current(8)
                ForgeRuntime.DataSourceFetchResult(rows=listOf(mapOf("id" to 1)))}
            val result = ordered.submit()
            assertTrue(result.accepted)
            assertNotEquals("succeeded",result.status)
            ordered.current(7)
            assertFalse(ordered.submit().accepted)
            assertEquals(listOf("stage"),ordered.calls)
            assertEquals(MutationWriterStatus.NotInvoked,result.writerStatus)
            assertTrue(result.acknowledgedSteps.getValue("upload").isNotBlank())
            assertEquals(MutationWriterStatus.NotInvoked,ordered.runtime.mutationCommands.state(ordered.window.windowId,ordered.command).writerStatus)
        } finally {ordered.scope.cancel()}
        val group = Fixture(""""confirm":"Confirm?","group":[{"command":{"commandId":"first","dataSourceRef":"save"}},
            {"command":{"commandId":"second","dataSourceRef":"stage"}}]""")
        try {
            group.open()
            val result = group.submit(confirm={group.current(8)
                true})
            assertFalse(result.accepted)
            assertTrue(group.calls.isEmpty())
            group.current(7)
            group.submit(confirm={true}).let { assertEquals("succeeded",it.status,it.toString()) }
            assertEquals(setOf("save","stage"),group.calls.toSet())
        } finally {group.scope.cancel()}
    }

    @Test fun replacementWhileVerificationReadsKeepsAcknowledgementAndDoesNotReplay() = runBlocking {
        val fixture = Fixture(""""dataSourceRef":"save","receiptIdentity":{"field":"id","generated":true},
            "reconcile":{"mode":"refetch","dataSourceRef":"reader","identityField":"id","verify":{
            "idsParameter":"ids","scope":[{"field":"parent","parameter":{"name":"parent","in":"windowForm","location":"current.0"}}]}},
            "successState":{"done":true},"refresh":[{"dataSourceRef":"list"}]""")
        try {
            fixture.open()
            val entered = CompletableDeferred<Unit>()
            val release = CompletableDeferred<Unit>()
            fixture.handler={request->
                if (request.dataSourceRef=="reader") { entered.complete(Unit)
                    release.await() }
                ForgeRuntime.DataSourceFetchResult(rows=listOf(mapOf("id" to 11,"parent" to 7)))
            }
            val save = async{fixture.submit()}
            withTimeout(5000){entered.await()}
            fixture.close()
            fixture.open()
            release.complete(Unit)
            val stale = save.await()
            assertTrue(stale.accepted)
            assertEquals("superseded",stale.status)
            assertEquals(MutationWriterStatus.Succeeded,stale.writerStatus)
            assertNull(fixture.window.peekWindowForm()["done"])
            assertFalse(fixture.submit(retry=stale.invocationId).accepted)
            assertEquals(listOf("save","reader"),fixture.calls)
            fixture.submit().let { assertEquals("succeeded",it.status,it.toString()) }
            assertEquals(listOf("save","reader","save","reader","list"),fixture.calls)
        } finally {fixture.scope.cancel()}
    }

    @Test fun queuedSuppressionClearsOnlyPendingFieldsOfTheOldPresentation() = runBlocking {
        for (change in listOf("parent", "actor", "replacement")) {
            val dispatcher = PausedDispatcher()
            val fixture = Fixture(""""dataSourceRef":"save","pendingState":{"busy":true,"message":"Working","other":"Pending"}""", dispatcher)
            try {
                fixture.runtime.setWindowFormValues(fixture.window.windowId, mapOf("message" to "Private prior value"))
                fixture.open()
                dispatcher.drain()
                val submitted = async(start = CoroutineStart.UNDISPATCHED) { fixture.submit() }
                assertEquals(true, fixture.window.peekWindowForm()["busy"])
                fixture.runtime.setWindowFormValues(fixture.window.windowId, mapOf("other" to "Newer value"))
                when (change) {
                    "parent" -> fixture.current(8)
                    "actor" -> fixture.actor("another")
                    else -> {
                        fixture.close()
                        assertFalse("busy" in fixture.window.peekWindowForm())
                        assertEquals("Private prior value", fixture.window.peekWindowForm()["message"])
                        fixture.open(args + ("parent" to 8))
                        fixture.runtime.setWindowFormValues(fixture.window.windowId, mapOf("busy" to true, "message" to "Replacement"))
                    }
                }
                dispatcher.drain()
                assertFalse(submitted.await().accepted)
                assertTrue(fixture.calls.isEmpty())
                val form = fixture.window.peekWindowForm()
                assertEquals("Newer value", form["other"])
                when (change) {
                    "parent" -> { assertFalse("busy" in form)
                        assertEquals("Private prior value", form["message"]) }
                    "actor" -> { assertFalse("busy" in form)
                        assertFalse("message" in form) }
                    else -> { assertEquals(true, form["busy"])
                        assertEquals("Replacement", form["message"]) }
                }
            } finally { fixture.scope.cancel()
            dispatcher.drain() }
        }
    }

    @Test fun groupRetainsTheOneAcknowledgedMemberAndCanReopen() = runBlocking {
        val dispatcher = PausedDispatcher()
        val fixture = Fixture(""""group":[{"command":{"commandId":"first","dataSourceRef":"save"}},
            {"command":{"commandId":"second","dataSourceRef":"stage"}}],"successState":{"done":true}""", dispatcher)
        try {
            fixture.open()
            dispatcher.drain()
            val scopeChanged = CompletableDeferred<Unit>()
            fixture.handler = {
                fixture.current(8)
                scopeChanged.complete(Unit)
                ForgeRuntime.DataSourceFetchResult(rows=listOf(mapOf("id" to 11)))
            }
            val submission = async { fixture.submit() }
            withTimeout(5000) {
                // Release one queued transport and observe the scope change before releasing the sibling.
                while (!dispatcher.runNext()) yield()
                scopeChanged.await()
                while (!submission.isCompleted) { yield()
                    dispatcher.drain() }
            }
            val result = submission.await()
            assertTrue(result.accepted)
            assertEquals("partial_failure", result.status, result.toString())
            assertEquals(1, result.members.values.count { it.writerStatus == MutationWriterStatus.Succeeded })
            assertEquals(1, result.members.values.count { it.writerStatus == MutationWriterStatus.NotInvoked })
            assertEquals(1, fixture.calls.size)
            assertNull(fixture.window.peekWindowForm()["done"])
            fixture.current(7)
            assertFalse(fixture.submit().accepted)
            fixture.close()
            fixture.open()
            fixture.handler = { ForgeRuntime.DataSourceFetchResult(rows=listOf(mapOf("id" to 11))) }
            val next = async { fixture.submit() }
            withTimeout(5000) { while (!next.isCompleted) { yield()
                dispatcher.drain() } }
            assertEquals("succeeded", next.await().status)
        } finally { fixture.scope.cancel()
        dispatcher.drain() }
    }

    @Test fun changingOrdinaryWriterInputCannotReplaceTheAdmittedDto() = runBlocking {
        val dispatcher = PausedDispatcher()
        val fixture = Fixture(dispatcher = dispatcher)
        try {
            fixture.open()
            dispatcher.drain()
            val writer = fixture.window.context("save")
            val inputs = mutableListOf<Map<String, Any?>>()
            val resolvedInputs = mutableListOf<Map<String, Any?>>()
            fixture.handler = { request ->
                inputs.add(request.input.parameters)
                resolvedInputs.add(request.resolvedInputs)
                ForgeRuntime.DataSourceFetchResult(rows = listOf(mapOf("id" to 7)))
            }
            val id = mutableListOf(7)
            val result = async(start = CoroutineStart.UNDISPATCHED) { fixture.submit(mapOf("id" to id)) }
            id[0] = 8
            writer.setInputParameters(mapOf("id" to listOf(8)))
            dispatcher.drain()
            assertEquals("succeeded", result.await().status)
            assertEquals<List<Map<String, Any?>>>(listOf(mapOf("id" to listOf(7))), inputs)
            assertEquals(inputs, resolvedInputs)
            assertFalse(writer.input.peek().fetch)
            assertEquals(mapOf("id" to listOf(8)), writer.input.peek().parameters)
        } finally { fixture.scope.cancel()
        dispatcher.drain() }
    }

    @Test fun anAcknowledgedStepCannotStartCompensatingWritesUnderChangedScope() = runBlocking {
        val fixture = Fixture(""""dataSourceRef":"save","before":[{"command":{"commandId":"upload","dataSourceRef":"stage"},
            "cleanup":{"commandId":"discard","dataSourceRef":"undo"}}],"errorState":{"failed":true}""")
        try {
            fixture.open()
            fixture.handler = { request ->
                if (request.dataSourceRef == "save") {
                    fixture.current(8)
                    throw IllegalStateException("Writer rejected the record")
                }
                ForgeRuntime.DataSourceFetchResult(rows = listOf(mapOf("id" to 11)))
            }
            val result = fixture.submit()
            assertTrue(result.accepted)
            assertNotEquals("succeeded", result.status)
            assertEquals(listOf("stage", "save"), fixture.calls)
            assertEquals(MutationWriterStatus.Failed, result.writerStatus)
            assertTrue(result.acknowledgedSteps.getValue("upload").isNotBlank())
            assertNull(fixture.window.peekWindowForm()["failed"])
        } finally { fixture.scope.cancel() }
    }

    @Test fun overlappingPendingFieldsUnwindInReverseBeforeImmediateReplacement() = runBlocking {
        val dispatcher = PausedDispatcher()
        val fixture = Fixture(""""dataSourceRef":"save","pendingState":{"message":"First"}""", dispatcher)
        try {
            val first = fixture.metadata.dialogs.single().actions.single()
            val second = first.copy(id = "other", mutationCommand = fixture.command.copy(commandId = "other", dataSourceRef = "stage",
                pendingState = buildJsonObject { put("message", "Second") }))
            val dialog = fixture.metadata.dialogs.single().copy(actions = listOf(first, second))
            fixture.window.metadata.set(fixture.metadata.copy(dialogs = listOf(dialog)))
            fixture.runtime.setWindowFormValues(fixture.window.windowId, mapOf("message" to "Original"))
            fixture.open()
            dispatcher.drain()
            val firstResult = async(start = CoroutineStart.UNDISPATCHED) { fixture.submit() }
            val signal = fixture.window.dialogSignal("edit")
            val shown = signal.peek()
            val secondResult = async(start = CoroutineStart.UNDISPATCHED) {
                fixture.runtime.mutationCommands.executePresented(fixture.runtime, fixture.window, fixture.draft, second.footerCommand()!!, emptyMap(),
                    shown, { signal.peek() === shown }, null)
            }
            assertEquals("Second", fixture.window.peekWindowForm()["message"])
            fixture.open(args + ("parent" to 8))
            assertEquals("Original", fixture.window.peekWindowForm()["message"])
            fixture.runtime.setWindowFormValues(fixture.window.windowId, mapOf("message" to "Replacement"))
            dispatcher.drain()
            for (result in listOf(firstResult.await(), secondResult.await())) {
                assertEquals(MutationWriterStatus.NotInvoked, result.writerStatus)
                assertFalse(result.accepted)
            }
            assertTrue(fixture.calls.isEmpty())
            assertEquals("Replacement", fixture.window.peekWindowForm()["message"])
        } finally { fixture.scope.cancel()
        dispatcher.drain() }
    }

    @Test fun cancellingBeforeTransportKeepsTheWriterNotInvokedAndAllowsASeparateAttempt() = runBlocking {
        val dispatcher = PausedDispatcher()
        val fixture = Fixture(""""dataSourceRef":"save","pendingState":{"busy":true}""", dispatcher)
        try {
            fixture.open()
            dispatcher.drain()
            val submitting = async(start = CoroutineStart.UNDISPATCHED) { fixture.submit() }
            assertEquals(true, fixture.window.peekWindowForm()["busy"])
            submitting.cancelAndJoin()
            dispatcher.drain()
            assertTrue(submitting.isCancelled)
            assertTrue(fixture.calls.isEmpty())
            assertFalse("busy" in fixture.window.peekWindowForm())
            assertEquals(MutationWriterStatus.NotInvoked,
                fixture.runtime.mutationCommands.state(fixture.window.windowId, fixture.command).writerStatus)
            val fresh = async(start = CoroutineStart.UNDISPATCHED) { fixture.submit() }
            dispatcher.drain()
            assertEquals("succeeded", fresh.await().status)
            assertEquals(listOf("save"), fixture.calls)
        } finally {
            fixture.scope.cancel()
            dispatcher.drain()
        }
    }

    @Test fun ordinaryCommandKeepsItsExistingBehavior() = runBlocking {
        val fixture = Fixture(reviewed=false)
        try { fixture.open()
            fixture.current(8)
            fixture.submit().let { assertEquals("succeeded",it.status,it.toString()) }
            assertEquals(listOf("save"),fixture.calls) }
        finally {fixture.scope.cancel()}
    }
}

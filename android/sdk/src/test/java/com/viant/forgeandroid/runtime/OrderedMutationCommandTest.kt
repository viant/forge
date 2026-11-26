package com.viant.forgeandroid.runtime

import com.viant.forgeandroid.ui.readSelectedFile
import com.viant.forgeandroid.ui.startControlMutation
import java.io.IOException
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import kotlinx.serialization.json.*
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import kotlin.test.*

class OrderedMutationCommandTest {
    private val fields = mapOf("token" to ResourceFieldSchemaDef(type = "integer"), "invocation" to ResourceFieldSchemaDef(type = "string"))
    private fun child(id: String) = MutationCommandDef(commandId = id, dataSourceRef = id)
    private fun receiptPayload(step: String) = ResourcePayloadPreparationDef("receipt", fields = mapOf(
        "token" to ResourceValueSourceDef("extras", selector = "steps.$step.rows.0.token"),
        "invocation" to ResourceValueSourceDef("extras", selector = "steps.$step.invocationId")))
    private val stageA = MutationBeforeStepDef(command = child("first").copy(invocationParameter = "id"), cleanup = child("cleanFirst").copy(payload = receiptPayload("first")))
    private val stageB = MutationBeforeStepDef(command = child("second").copy(payload = receiptPayload("first")), cleanup = child("cleanSecond"))
    private val root = child("save").copy(before = listOf(stageA, stageB), serializationGroup = "editor",
        validateWhen = DashboardConditionDef(source = "windowForm", field = "busy", notEquals = JsonPrimitive(true)),
        pendingState = buildJsonObject { put("busy", true) }, errorState = buildJsonObject { put("busy", false); put("failed", true) },
        cleanupState = buildJsonObject { put("cleaning", true) },
        indeterminateState = buildJsonObject { put("unknown", true) }, successState = buildJsonObject { put("busy", false); put("done", true) })

    private inner class Fixture(scope: CoroutineScope, server: MockWebServer? = null) {
        val runtime = ForgeRuntime(if (server == null) emptyMap() else mapOf("local" to EndpointConfig(server.url("/").toString())), scope)
        private val refs = listOf("source", "first", "second", "cleanFirst", "cleanSecond", "save", "unused")
        private val metadata = WindowMetadata(view = ViewDef(content = ContentDef()),
            dialogs = listOf(DialogDef(id = "editor", dataSourceRef = "source", fetchOnOpen = false)),
            schemas = mapOf("receipt" to ResourceSchemaDef(type = "object", properties = fields, required = fields.keys.toList())),
            resourceModels = mapOf("receipt" to ResourceModelDef(schemaRef = "receipt", write = ResourceWriteBindingDef(dataSourceRef = "save", mode = "full"))),
            dataSources = refs.associateWith { ref -> DataSourceDef(autoFetch = false, service = if (server == null) null else ServiceDef(endpoint = "local", uri = "/$ref", method = "POST")) })
        val window = runtime.windowContext(runtime.openWindowInline("inventory", "Inventory", metadata = metadata).windowId)
        val source = window.context("source")
        val calls = mutableListOf<ForgeRuntime.DataSourceFetchRequest>()
        fun loader(response: suspend (ForgeRuntime.DataSourceFetchRequest) -> List<Map<String, Any?>> = { listOf(mapOf("token" to 7)) }) {
            runtime.registerDataSourceLoader {
                calls.add(it)
                ForgeRuntime.DataSourceFetchResult(rows = response(it))
            }
        }
        suspend fun execute(command: MutationCommandDef = root, confirm: (suspend (String) -> Boolean)? = null) =
            runtime.mutationCommands.execute(runtime, window, source, command, mapOf("steps" to mapOf("first" to "forged"), "extra" to false), confirm)
        fun refs() = calls.map { it.dataSourceRef }
    }

    private suspend fun fixture(test: suspend Fixture.() -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try { Fixture(scope).test() } finally { scope.cancel() }
    }

    @Test fun orderedWritersReceiveOnlyCorrelatedRowsAndInvocationIds() = runBlocking { fixture {
        val skipped = MutationBeforeStepDef(condition = DashboardConditionDef(source = "form", field = "optional", equals = JsonPrimitive(true)),
            command = child("unused"))
        val command = root.copy(before = listOf(stageA, skipped, stageB), payload = receiptPayload("second"), confirm = "Continue?", invocationParameter = "rootId")
        val states = mutableListOf<MutationCommandState>()
        loader { request ->
            states += runtime.mutationCommands.state(window.windowId, root)
            assertEquals(true, window.peekWindowForm()["busy"])
            when (request.dataSourceRef) {
                "first" -> listOf(mapOf("token" to 10))
                "second" -> listOf(mapOf("token" to 20))
                else -> emptyList()
            }
        }
        val decoded = JsonUtil.json.decodeFromString(MutationCommandDef.serializer(),
            JsonUtil.json.encodeToString(MutationCommandDef.serializer(), command))
        val result = execute(decoded) { calls.isEmpty() && window.peekWindowForm()["busy"] == null }
        assertEquals("succeeded", result.status)
        assertTrue(result.invocationId.isNotBlank())
        assertEquals(setOf(result.invocationId), states.map { it.invocationId }.toSet())
        assertEquals(listOf(MutationWriterStatus.NotInvoked, MutationWriterStatus.NotInvoked, MutationWriterStatus.Pending), states.map { it.writerStatus })
        assertEquals(result.invocationId, calls[2].input.parameters["rootId"])
        assertEquals(listOf("first", "second", "save"), refs())
        val id = calls[0].input.parameters["id"] as String
        assertEquals(setOf("extra","id"), calls[0].input.parameters.keys)
        assertEquals(mapOf("token" to 10L, "invocation" to id), calls[1].input.parameters)
        assertEquals(20L, calls[2].input.parameters["token"])
        assertNotEquals(id, calls[2].input.parameters["invocation"])
        assertFalse(calls.any { "steps" in it.input.parameters })
        assertEquals(true, window.peekWindowForm()["done"])
        assertFalse("unused" in runtime.registeredWindowDataSources(window.windowId))
    } }

    @Test fun confirmedStagesCleanInReverseAndPrimaryCauseSurvivesCleanupFailure() = runBlocking { fixture {
        val rejection = IllegalArgumentException("version conflict")
        val secondary = IllegalStateException("already removed")
        loader { when (it.dataSourceRef) {
            "save" -> throw rejection
            "cleanSecond" -> {
                val state = runtime.mutationCommands.state(window.windowId, root)
                assertEquals(true, window.peekWindowForm()["cleaning"])
                assertEquals(MutationCommandPhase.CleaningUp, state.phase)
                assertTrue(state.guarded)
                assertFalse(state.pending)
                assertEquals("version conflict", state.error)
                throw secondary
            }
            else -> listOf(mapOf("token" to 7))
        } }
        val result = execute()
        assertEquals(listOf("first","second","save","cleanSecond","cleanFirst"), refs())
        assertEquals("failed", result.status)
        assertSame(rejection, result.cause)
        assertEquals("version conflict", result.error)
        assertEquals("cleanup", result.warnings.single().stage)
        assertTrue(result.warnings.single().message.contains("cleanSecond"))
        assertEquals(mapOf("token" to 7L, "invocation" to calls[0].input.parameters["id"]), calls.last().input.parameters)
        assertFalse(runtime.mutationCommands.state(window.windowId, root).guarded)
        assertEquals(true, window.peekWindowForm()["failed"])
    } }

    @Test fun declinedConfirmationAndInvalidStagesCannotDispatchTheirWriters() = runBlocking { fixture {
        loader()
        assertEquals("cancelled", execute(root.copy(confirm = "Continue?")) { false }.status)
        assertTrue(calls.isEmpty())
        for (invalid in listOf(stageA.copy(command = child("first").copy(before = listOf(stageB))),
            stageB.copy(command = child("first")), stageA.copy(command = child("")))) {
            assertEquals("invalid", execute(root.copy(before = listOf(stageA, invalid))).status)
            assertTrue(calls.isEmpty())
        }
        val denied = stageB.copy(command = stageB.command.copy(validateWhen = DashboardConditionDef(source = "form", field = "allowed", equals = JsonPrimitive(true))))
        val result = execute(root.copy(before = listOf(stageA, denied)))
        assertEquals("invalid", result.status)
        assertTrue(result.accepted)
        assertEquals("second", result.failedStepId)
        val state = runtime.mutationCommands.state(window.windowId, root)
        assertEquals("second", state.failedStepId)
        assertEquals(MutationWriterStatus.NotInvoked, state.writerStatus)
        assertEquals(listOf("first","cleanFirst"), refs())
    } }

    @Test fun unknownStageBlocksRootGroupAndItsOwnTransportUntilExplicitResolution() = runBlocking { fixture {
        val failure = IOException("connection lost")
        loader { if (it.dataSourceRef == "second") throw failure else listOf(mapOf("token" to 7)) }
        val result = execute()
        assertEquals("indeterminate", result.status)
        assertSame(failure, result.cause)
        assertEquals(true, window.peekWindowForm()["unknown"])
        assertEquals("suppressed", execute().status)
        assertEquals("suppressed", execute(child("unused").copy(serializationGroup = "editor")).status)
        assertEquals("transport_busy", execute(child("second")).status)
        assertEquals(listOf("first","second"), refs())
        assertTrue(runtime.mutationCommands.resolveIndeterminate(window.windowId, root))
        loader { emptyList() }
        assertEquals("succeeded", execute(child("second")).status)
        assertEquals(listOf("first","second","second"), refs())
    } }

    @Test fun cleanupUnknownRetainsGuardAndOriginalErrorAndStopsRemainingCleanup() = runBlocking { fixture {
        val original = IllegalArgumentException("rejected")
        loader { when (it.dataSourceRef) {
            "save" -> throw original
            "cleanSecond" -> throw IOException("disconnected")
            else -> listOf(mapOf("token" to 3))
        } }
        val result = execute()
        assertEquals("failed", result.status)
        assertSame(original, result.cause)
        assertEquals("cleanup", result.warnings.single().stage)
        assertTrue(runtime.mutationCommands.state(window.windowId, root).guarded)
        assertEquals(listOf("first","second","save","cleanSecond"), refs())
    } }

    @Test fun revocationAndSelectionChangeStopFurtherWritesAndCompensation() = runBlocking {
        for (changeSelection in listOf(false,true)) fixture {
            loader {
                if (changeSelection) source.setSelection(SelectionState(selected = mapOf("id" to 8)))
                else runtime.updatePreviewPrincipal(window.windowId, setOf("reader"), emptySet())
                listOf(mapOf("token" to 7))
            }
            assertEquals("superseded", execute().status)
            assertEquals(listOf("first"), refs())
            assertFalse(runtime.mutationCommands.state(window.windowId, root).guarded)
        }
    }

    @Test fun doubleActivationStaysSuppressedDuringAChildWrite() = runBlocking { fixture {
        val started = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        loader {
            if (it.dataSourceRef == "first") { started.complete(Unit); release.await() }
            listOf(mapOf("token" to 7))
        }
        coroutineScope {
            val original = async { execute() }
            started.await()
            assertEquals("suppressed", execute().status)
            release.complete(Unit)
            assertEquals("succeeded", original.await().status)
            assertEquals(listOf("first","second","save"), refs())
        }
    } }

    @Test fun committedFinalWriterWithFailedSynchronizationNeverRunsCleanup() = runBlocking { fixture {
        loader { if (it.dataSourceRef == "unused") throw IllegalArgumentException("reader unavailable")
            else listOf(mapOf("token" to 7)) }
        val result = execute(root.copy(refresh = listOf(RefreshSpec(dataSourceRef = "unused"))))
        assertEquals("succeeded", result.status)
        assertEquals("refresh", result.warnings.single().stage)
        assertEquals(listOf("first","second","save","unused"), refs())
        assertTrue(window.peekWindowForm()["done"] == true)
    } }

    @Test fun cancellationAfterDispatchRetainsRootAndDoesNotCompensate() = runBlocking { fixture {
        val started = CompletableDeferred<Unit>()
        loader {
            if (it.dataSourceRef == "second") { started.complete(Unit); awaitCancellation() }
            listOf(mapOf("token" to 7))
        }
        val job = launch { execute() }
        started.await()
        job.cancelAndJoin()
        assertEquals(listOf("first","second"), refs())
        assertEquals(MutationCommandPhase.Indeterminate, runtime.mutationCommands.state(window.windowId, root).phase)
        assertEquals("suppressed", execute().status)
    } }

    @Test fun detachedWindowCannotContinueAnAdmittedSequence() = runBlocking { fixture {
        val started = CompletableDeferred<Unit>()
        loader {
            if (it.dataSourceRef == "first") { started.complete(Unit); awaitCancellation() }
            listOf(mapOf("token" to 7))
        }
        val job = launch { execute() }
        started.await()
        runtime.closeWindow(window.windowId)
        job.join()
        assertEquals(listOf("first"), refs())
        assertEquals(MutationCommandPhase.Indeterminate, runtime.mutationCommands.state(window.windowId, root).phase)
    } }

    @Test fun httpStatusAndCauseDistinguishRejectedAndUnknownWrites() = runBlocking {
        for (status in listOf(303, 307, 400, 401, 403, 409, 422, 408, 500, 503)) {
            val server = MockWebServer()
            val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
            try {
                server.enqueue(MockResponse().setBody("""{"data":[{"token":7}]}"""))
                server.enqueue(MockResponse().setResponseCode(status).setHeader("Retry-After", "0").setBody("""{"message":"rejected"}"""))
                server.enqueue(MockResponse().setBody("""{"data":[]}"""))
                server.start()
                val f = Fixture(scope, server)
                val result = f.execute(root.copy(before = listOf(stageA)))
                val unknown = status in 300..399 || status == 408 || status >= 500
                assertEquals(if (unknown) "indeterminate" else "failed", result.status, status.toString())
                assertEquals(status, assertIs<HttpResponseException>(result.cause).status)
                assertEquals(if (unknown) 2 else 3, server.requestCount)
                assertEquals(unknown, f.runtime.mutationCommands.state(f.window.windowId, root).guarded)
            } finally { scope.cancel(); server.shutdown() }
        }
    }

    @Test fun acknowledgedFinalWriteAfterRevocationSkipsUIPatchesAndReads() = runBlocking { fixture {
        loader {
            if (it.dataSourceRef == "save") runtime.updatePreviewPrincipal(window.windowId, setOf("reader"), emptySet())
            listOf(mapOf("token" to 7))
        }
        val result = execute(root.copy(refresh = listOf(RefreshSpec(dataSourceRef = "unused"))))
        assertEquals("superseded", result.status)
        assertTrue(result.accepted)
        assertEquals("synchronize", result.warnings.single().stage)
        val state = runtime.mutationCommands.state(window.windowId, root)
        assertEquals(MutationWriterStatus.Succeeded, state.writerStatus)
        assertEquals(MutationSyncStatus.PartialFailure, state.syncStatus)
        assertFalse(state.guarded)
        assertNull(window.peekWindowForm()["done"])
        assertEquals(listOf("first","second","save"), refs())
    } }

    @Test fun footerClosesOnlyAfterAnAcknowledgedWriterIncludingAnEmptyReceipt() = runBlocking { fixture {
        val id = "editor"
        val action = ActionDef(id = "apply", close = true, mutationCommand = child("save").copy(
            resultState = mapOf("returnedId" to listOf("0.id"))))
        assertTrue(runtime.presentDialog(window.windowId, id))
        val waiting = async(start = CoroutineStart.UNDISPATCHED) { runtime.awaitDialogResult(window.windowId, id) }
        loader { emptyList() }
        val result = startControlMutation(runtime, window, source, action.footerCommand()!!, emptyMap(), this@runBlocking, id, action.close) { true }.await()
        assertEquals("succeeded", result.status)
        assertEquals(listOf("resultState"), result.warnings.map { it.stage })
        assertFalse(window.dialogSignal(id).peek().open)
        assertNull(withTimeout(2000) { waiting.await() })
    } }

    @Test fun publishingAConfirmedCloseCannotResolveTheReopenedDialogWaiter() = runBlocking { fixture {
        val id = "editor"
        val first = async(start = CoroutineStart.UNDISPATCHED) { runtime.openDialogAwaitResult(window.windowId, id) }
        val presentation = window.dialogSignal(id)
        val replacement = CompletableDeferred<Deferred<Map<String, Any?>?>>()
        val observer = launch(Dispatchers.Unconfined, start = CoroutineStart.UNDISPATCHED) {
            presentation.flow.first { !it.open }
            replacement.complete(async(start = CoroutineStart.UNDISPATCHED) { runtime.openDialogAwaitResult(window.windowId, id) })
        }
        loader { emptyList() }
        val result = startControlMutation(runtime, window, source, child("save"), emptyMap(), this@runBlocking, id, true) { true }.await()
        assertEquals("succeeded", result.status)
        assertNull(withTimeout(2000) { first.await() })
        val next = withTimeout(2000) { replacement.await() }
        assertTrue(presentation.peek().open)
        assertFalse(next.isCompleted)
        runtime.closeDialog(window.windowId, id, result = mapOf("id" to 7))
        assertEquals(mapOf("id" to 7), withTimeout(2000) { next.await() })
        observer.join()
    } }

    @Test fun confirmedFooterPatchesSourceFormOnceBeforeRefresh() = runBlocking { fixture {
        val action = JsonUtil.json.decodeFromString<ActionDef>("""{"id":"apply","mutationCommand":{"dataSourceRef":"save",
            "successFormState":{"note":null,"status":{"confirmed":true},"flags":[false,0]},
            "successState":{"ownerDone":true},"refresh":[{"dataSourceRef":"unused"}]}}""")
        val command = assertNotNull(action.footerCommand())
        val unrelated = listOf(mapOf("value" to "retained"))
        source.setForm(mapOf("status" to "editing", "unrelated" to unrelated))
        val started = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        var atRefresh: Map<String, Any?>? = null
        loader {
            if (it.dataSourceRef == "save") { started.complete(Unit); release.await() }
            else atRefresh = source.peekForm()
            emptyList()
        }
        assertTrue(runtime.presentDialog(window.windowId, "editor"))
        val operation = startControlMutation(runtime, window, source, command, emptyMap(), this@runBlocking, "editor") { true }
        started.await()
        source.setFormField("later", "keep")
        release.complete(Unit)
        assertEquals("succeeded", operation.await().status)
        val form = source.peekForm()
        assertEquals("Completed", runtime.mutationCommands.state(window.windowId, command).message)
        assertEquals(form, atRefresh)
        assertTrue("note" in form)
        assertNull(form["note"])
        assertEquals(mapOf("confirmed" to true), form["status"])
        assertEquals(listOf(false, 0L), form["flags"])
        assertEquals("keep", form["later"])
        assertSame(unrelated, form["unrelated"])
        assertFalse("status" in window.peekWindowForm())
        assertEquals(true, window.peekWindowForm()["ownerDone"])
        assertEquals(listOf("save", "unused"), refs())
    } }

    @Test fun changedPatchedFieldOrPresenceSkipsTheWholePatch() = runBlocking { fixture {
        val patch = JsonUtil.json.parseToJsonElement("""{"selected":null,"untouched":"saved"}""").jsonObject
        for (variant in listOf("nested", "absent", "null")) {
            val nested = mutableListOf("old")
            val original = when (variant) {
                "nested" -> mapOf("selected" to nested)
                "null" -> mapOf("selected" to null)
                else -> emptyMap()
            }
            source.setForm(original + ("untouched" to "draft"))
            val command = child("save").copy(successFormState = patch)
            val started = CompletableDeferred<Unit>()
            val release = CompletableDeferred<Unit>()
            loader { started.complete(Unit); release.await(); emptyList() }
            assertTrue(runtime.presentDialog(window.windowId, "editor"))
            val op = startControlMutation(runtime, window, source, command, emptyMap(), this@runBlocking, "editor") { true }
            started.await()
            when (variant) {
                "nested" -> nested[0] = "edited"
                "null" -> source.setForm(source.peekForm() - "selected")
                else -> source.setFormField("selected", null)
            }
            val expected = source.peekForm()
            release.complete(Unit)
            assertEquals("succeeded", op.await().status)
            assertEquals(expected, source.peekForm())
            assertEquals("Saved the submitted version. Your newer changes are still in the form.",
                runtime.mutationCommands.state(window.windowId, command).message)
            runtime.closeDialogPublic(window.windowId, "editor")
        }
    } }

    @Test fun fileChoiceGuardsReviewedFooterAndPreservesNewReadsThroughAcknowledgement() = runBlocking { fixture {
        val owner = checkNotNull(window.context("source").sourceForm())
        val command = child("save").copy(confirm = "Continue?", successFormState = buildJsonObject {
            put("file", JsonNull); put("status", "complete")
        }, clearFormFields = listOf("other"), refresh = listOf(RefreshSpec(dataSourceRef = "unused")))
        assertTrue(runtime.presentDialog(window.windowId, "editor"))
        source.setForm(mapOf("file" to "original", "status" to "ready", "other" to "second"))
        fun start(confirm: suspend (String) -> Boolean = { true }) =
            startControlMutation(runtime, window, source, command, emptyMap(), this@runBlocking, "editor", confirm = confirm)

        loader()
        val pending = owner.beginSelection("file")
        assertEquals("invalid", start().await().status)
        assertEquals("Wait for the selected file to finish loading.", runtime.mutationCommands.state(window.windowId, command).message)
        pending.settle() // A failed read leaves the original draft intact.
        assertEquals("invalid", start { owner.beginSelection("file").settle(); true }.await().status)
        assertTrue(calls.isEmpty())
        val entered = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        loader { if (it.dataSourceRef == "save") { entered.complete(Unit); release.await() } else delay(50); emptyList() }
        val op = start()
        entered.await()
        val bytesAvailable = CompletableDeferred<JsonElement>()
        var publications = 0
        val reading = launch(start = CoroutineStart.UNDISPATCHED) {
            readSelectedFile(owner.beginSelection("file"), { true }, { bytesAvailable.await() },
                { publications++; assertEquals("original", source.peekForm()["file"]) }, { throw it })
        }
        val other = owner.beginSelection("other")
        release.complete(Unit)
        assertEquals("succeeded", op.await().status)
        assertEquals(listOf("save", "unused"), refs())
        assertEquals(mapOf("file" to "original", "status" to "ready", "other" to "second"), source.peekForm())
        assertEquals("Saved the submitted version. Your newer changes are still in the form.",
            runtime.mutationCommands.state(window.windowId, command).message)
        assertEquals(0, publications)
        bytesAvailable.complete(JsonPrimitive("original")) // Same bytes are still a newer selection.
        reading.join()
        assertEquals(1, publications)
        other.settle()
        val unrelated = owner.beginSelection("independent")
        assertEquals("succeeded", start().await().status)
        assertEquals(mapOf("file" to null, "status" to "complete", "other" to null), source.peekForm())
        unrelated.settle()
    } }

    @Test fun onlyCurrentFileReadPublishesAndDisposalClearOrFailureSettlePending() = runBlocking {
        val form = SourceForm()
        val published = mutableListOf<String>()
        val write: (JsonElement) -> Unit = { published += it.jsonPrimitive.content }
        val first = form.beginSelection("attachment")
        val newest = form.beginSelection("attachment")
        readSelectedFile(first, { true }, { JsonPrimitive("old") }, write, { throw it })
        readSelectedFile(newest, { true }, { JsonPrimitive("new") }, write, { throw it })
        val disposed = form.beginSelection("attachment")
        disposed.settle()
        readSelectedFile(disposed, { true }, { JsonPrimitive("unmounted") }, write, { throw it })
        val clear = form.beginSelection("attachment")
        if (form.beginSelection("attachment").settle(JsonNull)) published += "clear"
        readSelectedFile(clear, { true }, { JsonPrimitive("cleared read") }, write, { throw it })
        val error = IOException("read failed")
        val failed = form.beginSelection("attachment")
        readSelectedFile(failed, { true }, { throw error }, write, { assertSame(error, it) })
        assertFalse(form.reading("attachment"))
        assertTrue(form.revision("attachment") > 0)
        var current = true
        val replaced = form.beginSelection("attachment")
        readSelectedFile(replaced, { current }, { current = false; JsonPrimitive("old presentation") }, write, { throw it })
        assertFalse(form.reading("attachment"))
        val inactive = form.beginSelection("attachment") { false }
        assertFalse(form.reading("attachment"), "a departed presentation cannot block the reopened form")
        assertFalse(inactive.settle(JsonPrimitive("stale")))
        assertNull(form.values.peek()["attachment"])
        assertEquals(listOf("new", "clear"), published)
        form.values.set(mapOf("attachment" to listOf(mapOf("name" to "old", "keep" to 7), "unchanged")))
        assertTrue(form.beginSelection("attachment.0.name").settle(JsonPrimitive("new")))
        val expected = mapOf("attachment" to listOf(mapOf("name" to "new", "keep" to 7), "unchanged"))
        assertEquals(expected, form.values.peek())
        val item = ItemDef(type = "file", dataField = "attachment.0.name")
        assertEquals("new", com.viant.forgeandroid.ui.resolveItemRawValue(item, checkNotNull(item.valueKey()),
            form.values.peek(), emptyMap(), emptyMap()))
        for (invalid in listOf("attachment.4.name", "attachment.1.name", "attachment.bad")) {
            assertFalse(form.beginSelection(invalid).settle(JsonPrimitive("bad")))
            assertEquals(expected, form.values.peek())
        }
    }

    @Test fun changedClearOnlyFileProtectsStatusButOtherSubmittedFieldsStillClear() = runBlocking { fixture {
        val form = checkNotNull(source.sourceForm())
        val command = child("save").copy(successFormState = buildJsonObject { put("status", "complete") },
            clearFormFields = listOf("attachment", "other"), refresh = listOf(RefreshSpec(dataSourceRef = "unused")))
        assertTrue(runtime.presentDialog(window.windowId, "editor"))
        for (action in listOf("same file", "explicit clear", "ordinary edit")) {
            source.setForm(mapOf("status" to "ready", "attachment" to "original", "other" to "submitted"))
            val entered = CompletableDeferred<Unit>()
            val release = CompletableDeferred<Unit>()
            loader { if (it.dataSourceRef == "save") { entered.complete(Unit); release.await() } else delay(50); emptyList() }
            val op = startControlMutation(runtime, window, source, command, emptyMap(), this@runBlocking, "editor") { true }
            entered.await()
            when (action) {
                "same file" -> form.beginSelection("attachment").settle(JsonPrimitive("original"))
                "explicit clear" -> form.beginSelection("attachment").settle(JsonNull)
                else -> source.setFormField("attachment", "typed")
            }
            release.complete(Unit)
            assertEquals("succeeded", op.await().status)
            assertEquals(if (action == "ordinary edit") "complete" else "ready", source.peekForm()["status"])
            assertNull(source.peekForm()["other"])
            assertEquals(when (action) { "same file" -> "original"; "explicit clear" -> null; else -> "typed" },
                source.peekForm()["attachment"])
        }
        assertEquals(listOf("save","unused","save","unused","save","unused"), refs())
    } }

    @Test fun nestedFileReadsProtectTheirParentAndCompleteIndependently() = runBlocking { fixture {
        val form = checkNotNull(source.sourceForm())
        source.setForm(mapOf("files" to mapOf("name" to "untouched", "left" to "old")))
        val command = child("save").copy(successFormState = buildJsonObject { put("files", JsonNull) })
        assertTrue(runtime.presentDialog(window.windowId, "editor"))
        loader()
        fun submit() = startControlMutation(runtime, window, source, command, emptyMap(), this@runBlocking, "editor") { true }
        val slow = CompletableDeferred<JsonElement>()
        val changes = mutableListOf<JsonElement>()
        val reading = launch(start = CoroutineStart.UNDISPATCHED) {
            readSelectedFile(form.beginSelection("files.left"), { true }, { slow.await() }, { changes += it }, { throw it })
        }
        val right = form.beginSelection("files.right")
        assertEquals("invalid", submit().await().status)
        readSelectedFile(right, { true }, { JsonPrimitive("fast") }, { changes += it }, { throw it })
        assertEquals(mapOf("name" to "untouched", "left" to "old", "right" to "fast"), source.peekForm()["files"])
        assertEquals("invalid", submit().await().status, "another path below the same field still has a pending read")
        assertTrue(refs().isEmpty())
        reading.cancelAndJoin()
        assertFalse(form.reading("files"))
        assertEquals(listOf<JsonElement>(JsonPrimitive("fast")), changes.toList())
        assertEquals("succeeded", submit().await().status)
        assertNull(source.peekForm()["files"])
    } }

    @Test fun staleFooterCannotPatchAnIdenticalReopenedFormOrAnotherPrincipal() = runBlocking { fixture {
        for (changeActor in listOf(false, true)) {
            val started = CompletableDeferred<Unit>()
            val release = CompletableDeferred<Unit>()
            val command = child("save").copy(successFormState = JsonObject(mapOf("value" to JsonPrimitive("saved"))),
                successState = JsonObject(mapOf("done" to JsonPrimitive(true))), refresh = listOf(RefreshSpec(dataSourceRef = "unused")))
            loader { if (it.dataSourceRef == "save") { started.complete(Unit); release.await() }; emptyList() }
            val args = mapOf("id" to 3)
            assertTrue(runtime.presentDialog(window.windowId, "editor", args))
            source.setForm(mapOf("value" to "same"))
            val start = calls.size
            val op = startControlMutation(runtime, window, source, command, emptyMap(), this@runBlocking, "editor") { true }
            started.await()
            if (changeActor) {
                val metadata = checkNotNull(window.metadata.peek())
                window.metadata.set(metadata.copy(authorizationSnapshot = mapOf("principal" to JsonObject(mapOf("subject" to JsonPrimitive("another"))))))
            } else {
                runtime.closeDialogPublic(window.windowId, "editor")
                assertTrue(runtime.presentDialog(window.windowId, "editor", args))
            }
            release.complete(Unit)
            val result = op.await()
            assertEquals("same", source.peekForm()["value"])
            if (!changeActor) {
                assertEquals("succeeded", result.status)
                assertEquals(listOf("save","unused"), refs().drop(start))
                assertEquals(true, window.peekWindowForm()["done"])
            }
            runtime.closeDialogPublic(window.windowId, "editor")
        }
    } }

    @Test fun successFormPatchRequiresAValidRootFooterAndConfirmedWrite() = runBlocking { fixture {
        val patch = JsonObject(mapOf("field" to JsonPrimitive("saved")))
        val command = child("save").copy(successFormState = patch)
        loader()
        assertEquals("invalid", execute(command).status)
        for (key in listOf("field.path", "__proto__", "constructor", " field")) {
            val invalid = command.copy(successFormState = JsonObject(mapOf(key to JsonNull)))
            assertEquals("invalid", execute(invalid).status)
        }
        assertEquals("invalid", execute(command.copy(clearFormFields = listOf("field"))).status)
        for (step in listOf(MutationBeforeStepDef(command = child("first").copy(successFormState = patch)),
            MutationBeforeStepDef(command = child("first"), cleanup = child("cleanFirst").copy(successFormState = patch)))) {
            assertFalse(execute(root.copy(before = listOf(step))).accepted)
        }
        assertTrue(calls.isEmpty())
        assertTrue(runtime.presentDialog(window.windowId,"editor"))
        source.setFormField("field", "original")
        val cancelled = startControlMutation(runtime,window,source,command.copy(confirm = "Continue?"),emptyMap(),
            this@runBlocking,"editor") { false }.await()
        assertFalse(cancelled.accepted)
        assertTrue(calls.isEmpty())
        for ((failure, expectedStatus) in listOf(IllegalArgumentException("rejected") to "failed", IOException("lost") to "indeterminate")) {
            loader { throw failure }
            val result = startControlMutation(runtime,window,source,command,emptyMap(),this@runBlocking,"editor") { true }.await()
            assertEquals(expectedStatus,result.status)
            assertEquals("original",source.peekForm()["field"])
        }
    } }

    @Test fun stagedReceiptDoesNotPatchUntilRootSucceedsAndDisjointFilesCanClear() = runBlocking { fixture {
        val command = child("save").copy(
            before = listOf(MutationBeforeStepDef(command = child("first"))),
            successFormState = JsonObject(mapOf("status" to JsonPrimitive("saved"))),
            clearFormFields = listOf("file")
        )
        source.setForm(mapOf("status" to "draft", "file" to "submitted"))
        loader { request ->
            if (request.dataSourceRef == "save") assertEquals("draft", source.peekForm()["status"])
            emptyList()
        }
        assertTrue(runtime.presentDialog(window.windowId, "editor"))
        val result = startControlMutation(runtime, window, source, command, emptyMap(), this@runBlocking, "editor") { true }.await()
        assertEquals("succeeded", result.status)
        assertEquals(listOf("first", "save"), refs())
        assertEquals(mapOf("status" to "saved", "file" to null), source.peekForm())
    } }

    @Test fun formPatchAloneRequiresAnExactHTTPWriterAcknowledgement() = runBlocking {
        for ((body, acknowledged) in listOf("{}" to false, """{"data":[]}""" to true)) {
            val server = MockWebServer()
            val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
            try {
                server.enqueue(MockResponse().setBody(body))
                server.start()
                val f = Fixture(scope, server)
                val command = child("save").copy(successFormState = JsonObject(mapOf("flag" to JsonPrimitive(false))))
                assertTrue(f.runtime.presentDialog(f.window.windowId, "editor"))
                val result = startControlMutation(f.runtime, f.window, f.source, command, emptyMap(), this, "editor") { true }.await()
                assertEquals(if (acknowledged) "succeeded" else "indeterminate", result.status)
                assertEquals(acknowledged, "flag" in f.source.peekForm())
                assertEquals(1, server.requestCount)
            } finally { scope.cancel(); server.shutdown() }
        }
    }

    @Test fun anOldReceiptNeverDismissesAnIdenticalReopenedFooter() = runBlocking { fixture {
        val id = "editor"
        val args = mapOf("record" to 3)
        val started = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        loader { started.complete(Unit); release.await(); emptyList() }
        assertTrue(runtime.presentDialog(window.windowId, id, args))
        val operation = startControlMutation(runtime, window, source, child("save"), emptyMap(), this@runBlocking, id, true) { true }
        withTimeout(3000) { started.await() }
        runtime.closeDialogPublic(window.windowId, id)
        assertTrue(runtime.presentDialog(window.windowId, id, args))
        val reopened = window.dialogSignal(id).peek()
        release.complete(Unit)
        assertEquals("succeeded", operation.await().status)
        assertSame(reopened, window.dialogSignal(id).peek())
        assertTrue(reopened.open)
    } }

    @Test fun nonClosingFooterRetainsDispatchedOutcomeAfterItsControlIsDisposed() = runBlocking { fixture {
        for (rejected in listOf(false, true)) {
            val started = CompletableDeferred<Unit>()
            val release = CompletableDeferred<Unit>()
            val id = "editor"
            val control = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
            val command = child("save").copy(
                pendingState = JsonObject(mapOf("busy" to JsonPrimitive(true))),
                successState = JsonObject(mapOf("busy" to JsonPrimitive(false))),
                errorState = JsonObject(mapOf("busy" to JsonPrimitive(false))),
                refresh = listOf(RefreshSpec(dataSourceRef = "unused", clearSelection = true))
            )
            val initialCalls = calls.size
            loader {
                if (it.dataSourceRef == "save") {
                    started.complete(Unit)
                    release.await()
                    if (rejected) throw IllegalArgumentException("Rejected")
                }
                emptyList()
            }
            assertTrue(runtime.presentDialog(window.windowId, id, mapOf("id" to 1)))
            val operation = startControlMutation(runtime, window, source, command, emptyMap(), control, id, false) { true }
            withTimeout(3000) { started.await() }
            runtime.closeDialogPublic(window.windowId, id)
            control.cancel()
            assertTrue(runtime.presentDialog(window.windowId, id, mapOf("id" to 2)))
            val replacement = window.dialogSignal(id).peek()
            assertEquals(true, window.peekWindowForm()["busy"])
            release.complete(Unit)
            assertEquals(if (rejected) "failed" else "succeeded", operation.await().status)
            assertEquals(false, window.peekWindowForm()["busy"])
            assertSame(replacement, window.dialogSignal(id).peek())
            assertEquals(if (rejected) listOf("save") else listOf("save", "unused"), refs().drop(initialCalls))
            runtime.closeDialogPublic(window.windowId, id)
        }
    } }

    @Test fun failedCancelledAndUncertainWritesLeaveTheFooterOpen() = runBlocking { fixture {
        val id = "editor"
        assertTrue(runtime.presentDialog(window.windowId, id))
        val state = window.dialogSignal(id).peek()
        val command = child("save").copy(confirm = "Confirm?")
        val cancelled = startControlMutation(runtime, window, source, command, emptyMap(), this@runBlocking, id, true) { false }.await()
        assertEquals("cancelled", cancelled.status)
        assertSame(state, window.dialogSignal(id).peek())
        loader { throw IllegalArgumentException("Rejected") }
        val failed = startControlMutation(runtime, window, source, command, emptyMap(), this@runBlocking, id, true) { true }.await()
        assertEquals("failed", failed.status)
        assertSame(state, window.dialogSignal(id).peek())
        loader { throw java.net.SocketTimeoutException("Lost acknowledgement") }
        val unknown = startControlMutation(runtime, window, source, command, emptyMap(), this@runBlocking, id, true) { true }.await()
        assertEquals("indeterminate", unknown.status)
        assertTrue(runtime.mutationCommands.state(window.windowId, command).guarded)
        assertSame(state, window.dialogSignal(id).peek())
    } }

    @Test fun aReopenedDialogCannotSubmitANewDraftWithAnOldStageReceipt() = runBlocking { fixture {
        val control = CoroutineScope(Dispatchers.Unconfined + SupervisorJob())
        val id = "editorDialog"
        runtime.openDialog(window.windowId, id, emptyMap())
        loader {
            runtime.closeDialogPublic(window.windowId, id)
            runtime.openDialog(window.windowId, id, emptyMap())
            runtime.setWindowFormValues(window.windowId, mapOf("newDraft" to true), replace = true, bumpPrefillRevision = false)
            listOf(mapOf("token" to 7))
        }
        try {
            val result = startControlMutation(runtime, window, source, root, emptyMap(), control, id) { true }.await()
            assertEquals("superseded", result.status)
            assertEquals(listOf("first"), refs())
            assertEquals(mapOf("newDraft" to true), window.peekWindowForm())
            assertFalse(runtime.mutationCommands.state(window.windowId, root).guarded)
        } finally { control.cancel() }
    } }

    @Test fun footerDisposalDoesNotCancelCompensationOrPatchTheReopenedDialog() = runBlocking { fixture {
        val control = CoroutineScope(Dispatchers.Unconfined + SupervisorJob())
        val started = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        val failure = IllegalArgumentException("revision conflict")
        loader { when (it.dataSourceRef) {
            "save" -> throw failure
            "cleanSecond" -> { started.complete(Unit); release.await(); emptyList() }
            else -> listOf(mapOf("token" to 7))
        } }
        val id = "editorDialog"
        runtime.openDialog(window.windowId, id, emptyMap())
        val attachment = mapOf("name" to "reselected")
        source.setForm(mapOf("attachment" to attachment))
        val command = root.copy(clearFormFields = listOf("attachment"))
        val operation = startControlMutation(runtime, window, source, command, emptyMap(), control, id) { true }
        started.await()
        assertEquals(MutationCommandPhase.CleaningUp, runtime.mutationCommands.stateUpdates(window.windowId, root).value.phase)
        runtime.closeDialogPublic(window.windowId, id)
        control.cancel()
        runtime.openDialog(window.windowId, id, emptyMap())
        runtime.setWindowFormValues(window.windowId, mapOf("newDraft" to true), replace = true, bumpPrefillRevision = false)
        source.setForm(mapOf("attachment" to attachment))
        release.complete(Unit)
        val result = operation.await()
        assertSame(failure, result.cause)
        assertEquals(listOf("first","second","save","cleanSecond","cleanFirst"), refs())
        assertEquals(mapOf("newDraft" to true), window.peekWindowForm())
        assertEquals(attachment, source.form.peek()["attachment"])
        assertFalse(runtime.mutationCommands.stateUpdates(window.windowId, root).value.guarded)
    } }

    @Test fun clearSubmittedFieldsIsAtomicAndRetainsANewerEditAndUnrelatedSiblings() = runBlocking { fixture {
        val original = mapOf("name" to "one", "data" to "bytes")
        val replaced = mapOf("name" to "two", "data" to "new")
        val mutableFile = mutableMapOf("name" to "before")
        source.setForm(mapOf("one" to original, "many" to listOf(original), "changed" to original, "mutable" to mutableFile, "untouched" to false))
        loader {
            source.setFormField("changed", replaced)
            mutableFile["name"] = "after"
            emptyList()
        }
        val command = child("save").copy(clearFormFields = listOf("one","many","changed","mutable","absent"))
        val result = execute(command)
        assertEquals("succeeded", result.status)
        val form = source.form.peek()
        assertTrue("one" in form && form["one"] == null)
        assertEquals(emptyList<Any>(), form["many"])
        assertEquals(replaced, form["changed"])
        assertEquals(mapOf("name" to "after"), form["mutable"])
        assertEquals(false, form["untouched"])
        assertFalse("absent" in form)
        assertEquals(listOf("save"), refs())
    } }

    @Test fun rejectionClearsOnlyAfterConfirmedCompensationAndKeepsPrimaryError() = runBlocking { fixture {
        source.setForm(mapOf("attachment" to mapOf("name" to "draft")))
        val original = IllegalArgumentException("invalid revision")
        loader { request ->
            if (request.dataSourceRef == "save") throw original
            require(source.form.peek()["attachment"] != null)
            listOf(mapOf("token" to 7))
        }
        val result = execute(root.copy(clearFormFields = listOf("attachment")))
        assertSame(original, result.cause)
        assertEquals(listOf("first","second","save","cleanSecond","cleanFirst"), refs())
        assertTrue("attachment" in source.form.peek() && source.form.peek()["attachment"] == null)
    } }

    @Test fun unknownSupersededAndPreDispatchValidationPreserveFormFields() = runBlocking {
        for (outcome in listOf("timeout","scope","invalid","cleanupTimeout")) fixture {
            val submitted = mapOf("name" to "keep")
            source.setForm(mapOf("attachment" to submitted))
            loader { req ->
                if (outcome == "timeout") throw IOException("interrupted")
                if (outcome == "scope") runtime.updatePreviewPrincipal(window.windowId, setOf("reader"), emptySet())
                if (outcome == "cleanupTimeout" && req.dataSourceRef == "save") throw IllegalArgumentException("rejected")
                if (outcome == "cleanupTimeout" && req.dataSourceRef == "cleanSecond") throw IOException("response lost")
                listOf(mapOf("token" to 7))
            }
            val command = root.copy(clearFormFields = listOf("attachment"),
                validateWhen = if(outcome == "invalid") DashboardConditionDef(source = "form", field = "absent", exists = true) else root.validateWhen)
            val result = execute(command)
            assertEquals(when(outcome){"timeout" -> "indeterminate"; "scope" -> "superseded"; "invalid" -> "invalid"; else -> "failed"}, result.status)
            assertEquals(submitted, source.form.peek()["attachment"])
        }
    }

    @Test fun clearFormFieldsRejectsUnsafeNamesAndChildOwnershipWithoutIO() = runBlocking { fixture {
        loader()
        for (names in listOf(listOf("x","x"), listOf("row.file"), listOf(" x"), listOf("constructor"), listOf("list[1]"))) {
            assertEquals("invalid", execute(child("save").copy(clearFormFields = names)).status)
        }
        val childClear = stageA.copy(command = stageA.command.copy(clearFormFields = listOf("attachment")))
        assertEquals("invalid", execute(root.copy(before = listOf(childClear))).status)
        assertTrue(calls.isEmpty())
    } }

    @Test fun receiptPredicatesAreLimitedToIndexedCleanupRecordsBeforeAnyWrite() = runBlocking { fixture {
        loader()
        val receipt = DashboardConditionDef(source = "collection", field = "0.entity", equals = JsonPrimitive(true))
        for (command in listOf(child("save").copy(receiptWhen = receipt), root.copy(receiptWhen = receipt),
            root.copy(before = listOf(stageA.copy(command = stageA.command.copy(receiptWhen = receipt)))),
            root.copy(before = listOf(stageA.copy(cleanup = stageA.cleanup!!.copy(receiptWhen = receipt.copy(source = "form"))))),
            root.copy(before = listOf(stageA.copy(cleanup = stageA.cleanup!!.copy(receiptWhen = receipt.copy(field = "entity"))))))) {
            assertEquals("invalid", execute(command).status)
        }
        assertTrue(calls.isEmpty())
    } }

    @Test fun cleanupPredicateChecksOnlyItsOwnPhysicalResponseAndContinuesAfterADefiniteNegative() = runBlocking {
        val receipt = DashboardConditionDef(any = listOf("0.entity", "0.data.entity", "0", "1").map { path ->
            DashboardConditionDef(source = "collection", field = path, equals = JsonPrimitive(true)) })
        val command = root.copy(before = listOf(stageA, stageB.copy(cleanup = stageB.cleanup!!.copy(receiptWhen = receipt))))
        for ((rows, confirmed) in listOf("[]" to false, "[{}]" to false, """[{"entity":false}]""" to false,
            """[{"entity":"true"}]""" to false, """[{"entity":true}]""" to true, """[{"data":{"entity":true}}]""" to true,
            "[true]" to true, "[false]" to false, """["true"]""" to false, """[{"message":"first"},true]""" to true)) {
            val server = MockWebServer()
            val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
            try {
                repeat(2) { server.enqueue(MockResponse().setBody("""{"data":[{"token":7}]}""")) }
                server.enqueue(MockResponse().setResponseCode(422))
                server.enqueue(MockResponse().setBody("""{"data":$rows}"""))
                server.enqueue(MockResponse().setBody("""{"data":[]}"""))
                server.start()
                val f = Fixture(scope, server)
                f.window.context("cleanSecond").collection.set(listOf(mapOf("entity" to !confirmed)))
                val result = f.execute(command)
                assertEquals("failed", result.status)
                assertEquals(422, assertIs<HttpResponseException>(result.cause).status)
                assertEquals(if (confirmed) emptyList() else listOf("cleanup"), result.warnings.map { it.stage }, rows)
                assertEquals(5, server.requestCount)
                val state = f.runtime.mutationCommands.state(f.window.windowId, root)
                assertFalse(state.guarded)
                assertEquals(!confirmed, state.message.contains("Cleanup could not be confirmed."))
                assertEquals(result.error, state.error)
            } finally {scope.cancel();server.shutdown()}
        }
    }

    @Test fun connectionLostAfterAReceivedRequestMakesNoSecondPhysicalAttempt() = runBlocking {
        val server = MockWebServer()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            server.enqueue(MockResponse().setBody("""{"data":[{"token":7}]}"""))
            server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AFTER_REQUEST))
            server.enqueue(MockResponse().setBody("""{"data":[]}"""))
            server.start()
            val f = Fixture(scope, server)
            val result = f.execute(root.copy(before = listOf(stageA)))
            assertEquals("indeterminate", result.status)
            assertIs<IOException>(result.cause)
            assertEquals(2, server.requestCount)
            assertTrue(f.runtime.mutationCommands.state(f.window.windowId, root).guarded)
        } finally { scope.cancel(); server.shutdown() }
    }

    @Test fun actualHTTPDistinguishesExplicitEmptyRecordsFromMissingOrMalformedResponses() = runBlocking {
        for ((body, accepted) in listOf("[]" to true, """{"data":[]}""" to true, "{}" to false, """{"data":{}}""" to false, "malformed" to false)) {
            val server = MockWebServer()
            val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
            try {
                server.enqueue(MockResponse().setBody(body))
                server.enqueue(MockResponse().setBody("""{"data":[]}"""))
                server.start()
                val f = Fixture(scope, server)
                val result = f.execute(root.copy(before = listOf(MutationBeforeStepDef(command = child("first")))))
                assertEquals(if (accepted) "succeeded" else "indeterminate", result.status, body)
                assertEquals(if (accepted) 2 else 1, server.requestCount, body)
                assertEquals(!accepted, f.runtime.mutationCommands.state(f.window.windowId, root).guarded)
            } finally { scope.cancel(); server.shutdown() }
        }
    }
}

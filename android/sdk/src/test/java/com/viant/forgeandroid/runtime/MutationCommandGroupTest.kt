package com.viant.forgeandroid.runtime

import com.dokar.quickjs.QuickJs
import com.dokar.quickjs.evaluate
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class MutationCommandGroupTest {
    private val action = JsonUtil.json.decodeFromString(ActionDef.serializer(), """
        {"id":"apply","label":"Apply","disabledWhen":{"source":"windowForm","field":"saving","equals":true},
         "mutationCommand":{
           "commandId":"save-group","confirm":"Apply changes?", "serializationGroup":"editor",
           "pendingState":{"saving":true}, "successState":{"saving":false,"saved":true},
           "errorState":{"saving":false,"failed":true}, "indeterminateState":{"saving":false,"unknown":true},
           "refresh":[{"dataSourceRef":"list"}], "group":[
             {"command":{"commandId":"products","label":"Products","dataSourceRef":"products",
               "receiptIdentity":{"field":"id","submittedRows":"records"},
               "rejectedWhen":{"source":"collection","field":"0.rejected","equals":true}}},
             {"when":{"source":"form","field":"includeServices","equals":true},
               "command":{"commandId":"services","label":"Services","dataSourceRef":"services",
                 "receiptIdentity":{"field":"id","submittedRows":"records"}}},
             {"command":{"commandId":"devices","label":"Devices","dataSourceRef":"devices",
                "receiptIdentity":{"field":"id","submittedRows":"records"}}}
           ]
         }}
    """.trimIndent())

    private class Fixture(val runtime: ForgeRuntime, val window: WindowContext, val source: DataSourceContext) {
        val calls = mutableListOf<ForgeRuntime.DataSourceFetchRequest>()
        var loader: suspend (String) -> List<Map<String, Any?>> = { listOf(mapOf("id" to 7, "rejected" to false)) }
        init {
            runtime.registerDataSourceLoader { request ->
                synchronized(calls) { calls.add(request) }
                ForgeRuntime.DataSourceFetchResult(rows = loader(request.dataSourceRef))
            }
        }

        suspend fun execute(command: MutationCommandDef, extras: Map<String, Any?> = mapOf("records" to listOf(mapOf("id" to 7))),
            confirm: suspend (String) -> Boolean = { true }) =
            runtime.mutationCommands.execute(runtime, window, source, command, extras, confirm)
    }

    private suspend fun withFixture(block: suspend (Fixture, MutationCommandDef) -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        ActionHookRuntime.testScriptEvaluator = { script ->
            val engine = QuickJs.create(Dispatchers.Default)
            try { engine.evaluate<String>(script) } finally { engine.close() }
        }
        try {
            val raw = JsonUtil.anyToElement(mapOf(
                "namespace" to "Editor", "windowKey" to "records",
                "view" to mapOf("content" to emptyMap<String, Any>()),
                "actions" to mapOf("code" to """({
                    prepareGroup: ({parameters, extras}) => {
                        if (parameters.workspace !== "root" || parameters.editor?.parameters?.team !== "fixture" ||
                            "records" in parameters || "workspace" in extras) {
                            throw Error("Root bindings and invocation extras must stay separate.");
                        }
                        const ids = extras.records.map(row => row.id);
                        return { products: {ids}, devices: {ids} };
                    },
                    member: ({parameters, extras}) => {
                        if (extras.scope !== "root" || extras.priority !== "invocation" || "memberOnly" in extras) {
                            throw Error("Unexpected shared member inputs.");
                        }
                        return {...parameters, priority: "prepared"};
                    },
                    omitAll: () => ({}),
                    malformed: () => ({ products: [7] }),
                    unknown: () => ({ other: { ids: [7] } }),
                    malformedIds: () => ({ products: { ids: [7] }, devices: { ids: [7, 7] } })
                })"""),
                "dataSource" to listOf("editor", "products", "services", "devices", "list")
                    .associateWith { mapOf("autoFetch" to false) }
            )) as JsonObject
            val metadata = JsonUtil.json.decodeFromJsonElement(WindowMetadata.serializer(), normalizeWindowMetadataJson(raw))
            val runtime = ForgeRuntime(emptyMap(), scope)
            val window = runtime.windowContext(runtime.openWindowInline("records", "Records", metadata = metadata).windowId)
            block(Fixture(runtime, window, window.context("editor")), checkNotNull(action.footerCommand()))
        } finally {
            ActionHookRuntime.testScriptEvaluator = null
            scope.cancel()
        }
    }

    @Test fun distinctWritersWithSameIdentityAndAnInactiveMemberRefreshOnce() = runBlocking {
        withFixture { f, command ->
            var confirmations = 0
            val result = f.execute(command) {
                assertEquals("Apply changes?", it)
                confirmations++
                true
            }
            assertEquals("succeeded", result.status, result.error)
            assertEquals(1, confirmations)
            assertEquals(setOf("products", "devices"), f.calls.dropLast(1).map { it.dataSourceRef }.toSet())
            assertEquals("list", f.calls.last().dataSourceRef)
            assertEquals(listOf("succeeded", "skipped", "succeeded"), result.members.values.map { it.status })
            assertNotEquals(result.members.getValue("products").invocationId, result.members.getValue("devices").invocationId)
            assertTrue(f.calls.take(2).all {
                JsonUtil.anyToElement(it.input.parameters["records"]).toString() == """[{"id":7}]"""
            })
            assertEquals(true, f.window.peekWindowForm()["saved"])
        }
    }

    @Test fun sharedRefreshCanClearItsOwnCurrentSourceSelection() = runBlocking {
        withFixture { f, command ->
            f.source.setSelection(SelectionState(selected = mapOf("id" to 7), rowIndex = 0))
            f.loader = { ref -> if (ref == "editor") emptyList() else listOf(mapOf("id" to 7, "rejected" to false)) }
            val refresh = RefreshSpec(dataSourceRef = "editor", clearSelection = true)
            val result = f.execute(command.copy(refresh = listOf(refresh)))
            assertEquals("succeeded", result.status, result.error)
            assertTrue(result.warnings.isEmpty())
            assertEquals(listOf("editor"), f.calls.drop(2).map { it.dataSourceRef })
            assertEquals(null, f.source.peekSelection().selected)
        }
    }

    @Test fun rootPreparationPreflightsPrimitiveIdentitiesAndDispatchesIndependentWritersTogether() = runBlocking {
        withFixture { f, command ->
            f.source.setForm(mapOf("team" to "fixture"))
            val scoped = ParameterDef(name = "team", from = "editor:form", to = "editor:parameters")
            val prepared = command.copy(prepare = "Editor.prepareGroup",
                parameters = listOf(binding("workspace", "root"), scoped), group = command.group!!.map { member ->
                member.copy(command = member.command.copy(receiptIdentity = MutationReceiptIdentityDef(field = "id", submittedValues = "ids")))
            })
            for (hook in listOf("Editor.malformed", "Editor.unknown", "Editor.malformedIds")) {
                val result = f.execute(prepared.copy(prepare = hook))
                assertEquals("invalid_payload", result.status, result.error)
                assertTrue(f.calls.isEmpty())
            }
            val started = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()
            val ready = CompletableDeferred<Unit>()
            f.source.setForm(mapOf("team" to "fixture", "includeServices" to true))
            f.loader = { ref ->
                if (ref != "list") {
                    started.add(ref)
                    if (started.size == 2) ready.complete(Unit)
                    withTimeout(2_000) { ready.await() }
                }
                listOf(mapOf("id" to 7, "rejected" to false))
            }
            val result = f.execute(prepared) {
                f.source.setForm(mapOf("team" to "changed after confirmation began", "includeServices" to true))
                true
            }
            assertEquals("succeeded", result.status, result.error)
            assertEquals(setOf("products", "devices"), started)
            assertEquals("skipped", result.members.getValue("services").status)
            assertTrue(f.calls.take(2).all {
                JsonUtil.anyToElement(it.input.parameters).toString() == """{"ids":[7]}"""
            })
            assertEquals("list", f.calls.last().dataSourceRef)
            assertEquals(3, f.calls.size)
        }
    }

    @Test fun rootBindingsAndInvocationExtrasBecomeCommonInputsWithoutRootPreparation() = runBlocking {
        withFixture { f, command ->
            val members = checkNotNull(command.group)
            val first = members.first()
            val root = command.copy(parameters = listOf(binding("scope", "root"), binding("priority", "root")),
                group = listOf(first.copy(command = first.command.copy(prepare = "Editor.member",
                    parameters = listOf(binding("priority", "binding"), binding("memberOnly", "yes"))))) + members.drop(1))
            val result = f.execute(root, mapOf("records" to listOf(mapOf("id" to 7)), "priority" to "invocation"))
            assertEquals("succeeded", result.status, result.error)
            val inputs = f.calls.associate { it.dataSourceRef to it.input.parameters }
            assertEquals("root", inputs.getValue("products")["scope"])
            assertEquals("prepared", inputs.getValue("products")["priority"])
            assertEquals("yes", inputs.getValue("products")["memberOnly"])
            assertEquals("root", inputs.getValue("devices")["scope"])
            assertEquals("invocation", inputs.getValue("devices")["priority"])
            assertFalse("memberOnly" in inputs.getValue("devices"))
        }
    }

    @Test fun allSkippedGroupsDoNotWriteRefreshOrHoldTheOwner() = runBlocking {
        withFixture { f, command ->
            val disabled = DashboardConditionDef(source = "form", field = "enabled", equals = JsonPrimitive(true))
            val inactive = command.copy(group = command.group!!.map { it.copy(condition = disabled) })
            val omitted = command.copy(prepare = "Editor.omitAll")
            for (variant in listOf(inactive, omitted)) {
                val result = if (variant === inactive) f.execute(variant) { error("No member needs confirmation.") } else f.execute(variant)
                assertEquals("skipped", result.status)
                assertFalse(result.accepted)
                assertTrue(result.members.values.all { it.status == "skipped" })
                val state = f.runtime.mutationCommands.state(f.window.windowId, command)
                assertEquals(MutationCommandPhase.Idle, state.phase)
                assertFalse(state.guarded)
                assertTrue(f.calls.isEmpty())
                assertTrue(f.window.peekWindowForm().keys.none { it in setOf("saving", "saved", "failed", "unknown") })
            }
            assertEquals("succeeded", f.execute(command).status)
        }
    }

    private fun binding(name: String, value: String) =
        ParameterDef(name = name, input = "const", locationValue = JsonPrimitive(value))

    @Test fun producerRejectionDoesNotSuppressOtherMembersAndPartialGroupCannotReplay() = runBlocking {
        withFixture { f, command ->
            f.source.setForm(mapOf("includeServices" to true))
            f.loader = { ref -> if (ref == "products") listOf(mapOf("rejected" to true, "message" to "Record was archived"))
                else listOf(mapOf("id" to 7, "rejected" to false)) }
            val result = f.execute(command)
            assertEquals("partial_failure", result.status)
            assertEquals("failed", result.members.getValue("products").status)
            assertEquals("Record was archived", result.members.getValue("products").error)
            assertEquals(setOf("products", "services", "devices"), f.calls.dropLast(1).map { it.dataSourceRef }.toSet())
            assertEquals("list", f.calls.last().dataSourceRef)
            val state = f.runtime.mutationCommands.state(f.window.windowId, command)
            assertTrue(state.guarded)
            assertFalse(state.retryAllowed)
            assertTrue(state.message.contains("Products: Record was archived"))
            assertEquals("suppressed", f.execute(command).status)
            assertEquals(4, f.calls.size)
            assertTrue(f.runtime.mutationCommands.resolveIndeterminate(f.window.windowId, command, "Verified"))
            assertFalse(f.runtime.mutationCommands.state(f.window.windowId, command).guarded)
            assertEquals(4, f.calls.size)
        }
    }

    @Test fun unconfirmedIdentityDoesNotSuppressOtherMembersAndUnknownGroupCannotReplay() = runBlocking {
        withFixture { f, command ->
            f.loader = { ref -> listOf(mapOf("id" to if (ref == "products") "7" else 7, "rejected" to false)) }
            val result = f.execute(command)
            assertEquals("indeterminate", result.status)
            assertEquals("indeterminate", result.members.getValue("products").status)
            assertEquals("succeeded", result.members.getValue("devices").status)
            assertEquals(setOf("products", "devices"), f.calls.dropLast(1).map { it.dataSourceRef }.toSet())
            assertEquals("list", f.calls.last().dataSourceRef)
            assertEquals(true, f.window.peekWindowForm()["unknown"])
            assertEquals("suppressed", f.execute(command).status)
            assertEquals(3, f.calls.size)
            val writer = command.group!!.first().command.copy(commandId = "retry-products")
            assertEquals("transport_busy", f.execute(writer).status)
            val competingGroup = command.copy(commandId = "competing-group", serializationGroup = null)
            assertEquals("transport_busy", f.execute(competingGroup).status)
            assertEquals(3, f.calls.size)
            assertTrue(f.runtime.mutationCommands.resolveIndeterminate(f.window.windowId, command))
            assertNotEquals("transport_busy", f.execute(writer).status)
            assertEquals(4, f.calls.size)
        }
    }

    @Test fun validationRejectsKnownInvalidGroupBeforeDispatch() = runBlocking {
        withFixture { f, command ->
            val members = checkNotNull(command.group)
            val invalid = listOf(
                command.copy(dataSourceRef = "products"),
                command.copy(group = emptyList()),
                command.copy(group = members + members.first()),
                command.copy(refresh = listOf(RefreshSpec(dataSourceRef = "list"), RefreshSpec(dataSourceRef = "list"))),
                command.copy(refresh = listOf(RefreshSpec(dataSourceRef = "products"))),
                command.copy(group = members + MutationGroupMemberDef(command = MutationCommandDef(commandId = "missing", dataSourceRef = "missing")))
            )
            for (variant in invalid) assertEquals("invalid", f.execute(variant).status)
            assertTrue(f.calls.isEmpty())
        }
    }

    @Test fun invalidMemberAndChangedActorStopAllWritersBeforeDispatch() = runBlocking {
        withFixture { f, command ->
            val members = checkNotNull(command.group)
            val denied = members.first().let {
                it.copy(command = it.command.copy(validateWhen = DashboardConditionDef(
                    source = "form", field = "canSaveProducts", equals = JsonPrimitive(true))))
            }
            val mixed = f.execute(command.copy(group = listOf(denied) + members.drop(1)))
            assertEquals("invalid", mixed.status)
            assertEquals("invalid", mixed.members.getValue("products").status)
            assertEquals("not_invoked", mixed.members.getValue("devices").status)
            assertTrue(f.calls.isEmpty())
        }
        withFixture { f, command ->
            val stale = f.execute(command) {
                f.runtime.updatePreviewPrincipal(f.window.windowId, setOf("readOnly"), emptySet())
                true
            }
            assertEquals("superseded", stale.status)
            assertTrue(stale.members.values.all { it.status == "not_invoked" })
            assertTrue(f.calls.isEmpty())
            assertTrue(f.window.peekWindowForm().keys.none { it in setOf("saving", "saved", "failed", "unknown") })
        }
    }

    @Test fun replacementPresentationReceivesNoRemainingDispatchOrLifecycleEffects() = runBlocking {
        withFixture { f, command ->
            val old = DialogState(open = true)
            val dialog = f.window.dialogSignal("editorDialog")
            dialog.set(old)
            val dispatched = CompletableDeferred<Unit>()
            val release = CompletableDeferred<Unit>()
            val started = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()
            f.loader = { ref ->
                started.add(ref)
                if (started.size == 2) dispatched.complete(Unit)
                release.await()
                listOf(mapOf("id" to 7, "rejected" to false))
            }
            coroutineScope {
                val outcome = async {
                    f.runtime.mutationCommands.executePresented(f.runtime, f.window, f.source, command,
                        mapOf("records" to listOf(mapOf("id" to 7))), old, { dialog.peek() === old }, { true })
                }
                withTimeout(2_000) { dispatched.await() }
                dialog.set(DialogState(open = true, initializing = true))
                f.runtime.setWindowFormValue(f.window.windowId, mapOf("saving" to "replacement"), replace = true)
                release.complete(Unit)
                val result = outcome.await()
                assertEquals("succeeded", result.status)
                assertEquals("succeeded", result.members.getValue("products").status)
                assertEquals("succeeded", result.members.getValue("devices").status)
                assertEquals(setOf("products", "devices"), f.calls.map { it.dataSourceRef }.toSet())
                assertEquals(mapOf("saving" to "replacement"), f.window.peekWindowForm())
            }
        }
    }
}

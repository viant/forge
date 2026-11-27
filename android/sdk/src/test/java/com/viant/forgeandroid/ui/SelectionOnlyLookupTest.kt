package com.viant.forgeandroid.ui

import com.dokar.quickjs.QuickJs
import com.dokar.quickjs.evaluate
import com.viant.forgeandroid.runtime.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import kotlinx.serialization.json.*
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.test.*

/** Invented inventory picker through the native renderer's event handler and dialog commit executor. */
class SelectionOnlyLookupTest {
    private class Fixture(scope: CoroutineScope, denied: Boolean) {
        val runtime = ForgeRuntime(emptyMap(), scope)
        val metadata = JsonUtil.json.decodeFromJsonElement(WindowMetadata.serializer(), normalizeWindowMetadataJson(
            JsonUtil.json.parseToJsonElement("""
                {"namespace":"Inventory","view":{"content":{}},"authorizationSnapshot":{"principal":{"subject":"operator","roles":${if (denied) "[\"readonly\"]" else "[]"}}},
                 "actions":{"code":"({select: ({context,record})=>{ const allowed=!context.authorization.principal.roles.includes('readonly'); context.signals.form.value={...context.signals.form.peek(), allowed}; if(allowed){const target=context.Context('details');target.handlers.dataSource.setInputParameters({Id:[record.id]});target.handlers.dataSource.fetchCollection();}return true;}, defaults: ({context,collection})=>{const draft=context.Context('draft');draft.signals.form.value={...draft.signals.form.peek(), unit:collection[0].unit};}})"},
                 "dataSource":{"draft":{"autoFetch":false},"choices":{"autoFetch":false},"details":{"autoFetch":false,"on":[{"event":"onSuccess","handler":"Inventory.defaults"}]}},
                 "dialogs":[{"id":"editor","dataSourceRef":"draft","fetchOnOpen":false,"content":{"dataSourceRef":"draft","fetchData":false,
                  "items":[{"id":"itemLookup","label":"Item","type":"lookup","scope":"noop","dataField":"label",
                   "lookup":{"dialogId":"picker","dataSource":"choices","outputs":[{"name":"itemId","location":"id"},{"name":"label","location":"name"},{"name":"optional","location":"optional"},{"name":"nullable","location":"nullable"}]},
                   "on":[{"event":"onLookup","handler":"Inventory.select"}]}]}},
                  {"id":"picker","dataSourceRef":"choices","fetchOnOpen":false}]}
                """.trimIndent()
            )
        ))
        val id = runtime.openWindowInline("records", "Inventory", metadata = metadata).windowId
        val window = runtime.windowContext(id)
        val draft = window.context("draft")
        val choices = window.context("choices")
        val item = metadata.dialogIndex.getValue("editor").content!!.items.single()
        val reads = CopyOnWriteArrayList<ForgeRuntime.DataSourceFetchRequest>()

        init {
            runtime.registerDataSourceLoader { request ->
                reads.add(request)
                ForgeRuntime.DataSourceFetchResult(rows = listOf(mapOf("unit" to "kg")))
            }
            runtime.openDialog(id, "editor", emptyMap())
        }

        fun commit(record: Map<String, Any?>) {
            choices.setSelection(SelectionState(selected = record, selection = listOf(record), rowIndex = 0))
        }

        fun select() = checkNotNull(runtime.execute(ExecutionDef(handler = "dialog.commit"), choices,
            mapOf("windowId" to id, "dialogId" to "picker")))
    }

    private suspend fun runFixture(denied: Boolean = false, body: suspend CoroutineScope.(Fixture) -> Unit) = coroutineScope {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        ActionHookRuntime.testScriptEvaluator = { script ->
            val js = QuickJs.create(Dispatchers.Default)
            try { js.evaluate<String>(script) } finally { js.close() }
        }
        try { withTimeout(8_000) { body(Fixture(scope, denied)) } }
        finally { ActionHookRuntime.testScriptEvaluator = null; scope.cancel() }
    }

    @Test fun onlyARealSelectionUpdatesTheLiveFormAndReadsItsExactContextOnce() = runBlocking {
        runFixture { f ->
            f.draft.setForm(mapOf("retained" to "initial", "optional" to "previous", "nullable" to "set"))
            setScopedItemValue(f.runtime, f.draft, f.item, "label", "typed")
            assertFalse(f.draft.form.peek().containsKey("label"))
            val owner = FileDialogPresentation(f.window.dialogSignal("editor"), f.window.dialogSignal("editor").peek())
            val lookup = async { runSelectionOnlyLookup(f.runtime, f.draft, f.item, owner::isCurrent) }
            f.window.dialogSignal("picker").flow.first { it.open }
            f.draft.setFormField("retained", "latest")
            f.runtime.registerPendingDialog("${f.id}Dialogpicker", PendingDialog(f.id, f.draft.dataSourceRef,
                listOf(ParameterDef(name = "unrelated", location = "id", to = ":form"))))
            assertNull(f.runtime.awaitDialogResult(f.id, "picker"))
            f.commit(mapOf("id" to 7, "name" to "Reviewed item", "nullable" to null))
            f.select().join()
            lookup.await()
            f.draft.form.flow.first { it["unit"] == "kg" }
            val form = f.draft.form.peek()
            assertEquals(7, (form["itemId"] as Number).toInt())
            assertEquals("Reviewed item", form["label"])
            assertEquals("latest", form["retained"])
            assertEquals("previous", form["optional"])
            assertFalse(form.containsKey("unrelated"))
            assertTrue(form.containsKey("nullable"))
            assertNull(form["nullable"])
            assertEquals(true, form["allowed"])
            assertEquals(listOf("details"), f.reads.map { it.dataSourceRef })
            assertEquals(JsonUtil.anyToElement(mapOf("Id" to listOf(7))), JsonUtil.anyToElement(f.reads.single().input.parameters))
        }
    }

    @Test fun authoredDenialLeavesNoContextRead() = runBlocking {
        runFixture(denied = true) { f ->
            val lookup = async { runSelectionOnlyLookup(f.runtime, f.draft, f.item) }
            f.window.dialogSignal("picker").flow.first { it.open }
            f.commit(mapOf("id" to 7, "name" to "Reviewed item"))
            f.select().join()
            lookup.await()
            assertEquals(false, f.draft.form.peek()["allowed"])
            assertTrue(f.reads.isEmpty())
        }
    }

    @Test fun cancelledAndSupersededPickersLeaveTheDraftUntouched() = runBlocking {
        runFixture { f ->
            val original = mapOf("label" to "Previous")
            f.draft.setForm(original)
            for (mode in listOf("cancel", "picker_replaced", "parent_replaced", "actor_replaced", "window_closed")) {
                val owner = FileDialogPresentation(f.window.dialogSignal("editor"), f.window.dialogSignal("editor").peek())
                val lookup = async { runSelectionOnlyLookup(f.runtime, f.draft, f.item, owner::isCurrent) }
                f.window.dialogSignal("picker").flow.first { it.open }
                f.commit(mapOf("id" to 12, "name" to "Obsolete"))
                when (mode) {
                    "cancel" -> f.runtime.closeDialogPublic(f.id, "picker")
                    "picker_replaced" -> {
                        f.runtime.openDialog(f.id, "picker", mapOf("newPicker" to true))
                        f.select().join()
                    }
                    "parent_replaced" -> {
                        f.runtime.closeDialogPublic(f.id, "editor")
                        f.runtime.openDialog(f.id, "editor", emptyMap())
                        f.select().join()
                    }
                    "actor_replaced" -> {
                        f.window.metadata.set(f.metadata.copy(authorizationSnapshot = mapOf(
                            "principal" to JsonObject(mapOf("subject" to JsonPrimitive("replacement")))
                        )))
                        f.select().join()
                    }
                    else -> f.runtime.closeWindow(f.id)
                }
                lookup.await()
                assertEquals(original, f.draft.form.peek(), mode)
                assertTrue(f.reads.isEmpty(), mode)
            }
        }
    }

    @Test fun ordinaryLookupTypingStillUsesTheExistingBinding() = runBlocking {
        runFixture { f ->
            val ordinary = f.item.copy(scope = "form")
            assertNull(selectionOnlyLookupCallback(ordinary))
            setScopedItemValue(f.runtime, f.draft, ordinary, "label", "ordinary value")
            assertEquals("ordinary value", f.draft.form.peek()["label"])
            assertNull(selectionOnlyLookupCallback(f.item.copy(on = emptyList())))
        }
    }
}

package com.viant.forgeandroid.runtime

import com.viant.forgeandroid.ui.invokeEditableOperation
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import kotlin.test.*

class EditableDialogBindingTest {
    private val metadata = JsonUtil.json.decodeFromString(WindowMetadata.serializer(), """
        {"view":{"content":{}},"dataSource":{"list":{},"parent":{},"draft":{"autoFetch":false}},
         "dialogs":[{"id":"edit","dataSourceRef":"draft","fetchOnOpen":false,"content":{"dataSourceRef":"draft","fetchData":false},
          "on":[{"event":"onOpen","handler":"dataSource.setFormData","parameters":[
           {"name":"id","in":"input","location":"draft.parameters.parentId"},
           {"name":"enabled","in":"input","location":"draft.parameters.enabled"},
           {"name":"limit","in":"input","location":"draft.parameters.limit"},
           {"name":"optional","in":"input","location":"draft.parameters.optional","default":"wrong"},
           {"name":"note","in":"const","location":"\"\"","codec":{"name":"json"}}
          ]}]}]}
    """.trimIndent())
    private val operation = JsonUtil.json.decodeFromString(EditableCollectionOperationSpec.serializer(), """
        {"id":"editRecord","label":"Edit","dialogId":"edit","parameters":[
          {"name":"parentId","in":"form","location":"parent.id","codec":{"name":"int"}},
          {"name":"enabled","in":"const","location":"false","codec":{"name":"boolean"}},
          {"name":"limit","in":"form","location":"parent.absent","default":0},
          {"name":"optional","in":"const","location":"null","codec":{"name":"json"}},
          {"name":"note","in":"const","location":""},
          {"name":"operationId","in":"const","location":"forged"},{"name":"selectedRows","in":"const","location":"forged"}]}
    """.trimIndent())

    @Test fun ordinaryButtonBindsTypedParametersAndResetsOnlyOnAGenuineOpen()=runBlocking {
        val scope=CoroutineScope(SupervisorJob()+Dispatchers.Unconfined)
        try {
            val rt=ForgeRuntime(emptyMap(),scope)
            val window=rt.windowContext(rt.openWindowInline("inventory","Inventory",metadata=metadata).windowId)
            val list=window.context("list");val parent=window.context("parent");val draft=window.context("draft")
            var reads=0;rt.registerDataSourceLoader{reads++;ForgeRuntime.DataSourceFetchResult()}
            for(number in listOf(7L,11L)){
                val selected=listOf(mapOf("id" to number))
                list.setSelection(SelectionState(selection=selected))
                parent.setForm(mapOf("id" to number.toString()))
                draft.setForm(mapOf("stale" to true))
                invokeEditableOperation(rt,list,operation,selected)?.join()
                val expected=mapOf("parentId" to number,"enabled" to false,"limit" to 0L,"optional" to null,"note" to "",
                    "operationId" to operation.id,"selectedRows" to selected)
                assertEquals(expected,window.dialogSignal("edit").peek().args)
                assertEquals(expected,draft.input.peek().parameters)
                assertFalse(draft.input.peek().fetch)
                assertEquals(mapOf("id" to number,"enabled" to false,"limit" to 0L,"optional" to null,"note" to ""),draft.form.peek())
                assertEquals("list",rt.pendingDialog(window.windowId+"Dialogedit")?.callerDataSourceRef)
                draft.setFormField("note","edited")
                invokeEditableOperation(rt,list,operation,selected)?.join()
                assertEquals("edited",draft.form.peek()["note"])
                rt.closeDialog(window.windowId,"edit")
            }
            assertEquals(0,reads)
            rt.execute(ExecutionDef(handler="dataSource.setFormData"),draft,mapOf("values" to mapOf("flag" to false)))?.join()
            assertEquals(mapOf("flag" to false),draft.form.peek())
            rt.execute(ExecutionDef(handler="dataSource.setFormData"),draft)?.join()
            assertTrue(draft.form.peek().isEmpty())
        } finally {scope.cancel()}
    }

    @Test fun fetchOnOpenFalseDoesNotReissueAnEarlierPendingDraftRead()=runBlocking {
        val scope=CoroutineScope(SupervisorJob()+Dispatchers.Unconfined)
        try {
            val rt=ForgeRuntime(emptyMap(),scope)
            val w=rt.windowContext(rt.openWindowInline("inventory","Inventory",metadata=metadata).windowId)
            val draft=w.context("draft");val list=w.context("list")
            val started=CompletableDeferred<Unit>();val cancelled=CompletableDeferred<Unit>()
            val calls=java.util.concurrent.atomic.AtomicInteger()
            rt.registerDataSourceLoader {
                calls.incrementAndGet()
                started.complete(Unit)
                try { awaitCancellation() } finally { cancelled.complete(Unit) }
            }
            draft.setInputParameters(mapOf("old" to true),fetch=true)
            withTimeout(3000){started.await()}
            invokeEditableOperation(rt,list,operation.copy(parameters=emptyList()),emptyList())?.join()
            withTimeout(3000){cancelled.await()}
            assertTrue(w.dialogSignal("edit").peek().open)
            assertFalse(draft.input.peek().fetch)
            assertFalse("old" in draft.input.peek().parameters)
            assertEquals(1,calls.get())
        } finally {scope.cancel()}
    }

    @Test fun foreignEligibilitySubscribesToOnlyTheDeclaredParentStoreAndNeverFetches()=runBlocking {
        val scope=CoroutineScope(SupervisorJob()+Dispatchers.Unconfined)
        try {
            val runtime=ForgeRuntime(emptyMap(),scope)
            val w=runtime.windowContext(runtime.openWindowInline("inventory","Inventory",metadata=metadata).windowId)
            val list=w.context("list")
            val condition=DashboardConditionDef(source="collection",dataSourceRef="parent",field="0.id",gt=1.0)
            val op=operation.copy(disabledWhen=DashboardConditionDef(not=condition))
            val spec=EditableCollectionSpec(operations=listOf(op))
            val watched=spec.predicateSignals(w,list.dataSourceRef)
            assertEquals(setOf(EditablePredicateStore("parent","collection")),watched.keys)
            var reads=0;runtime.registerDataSourceLoader{reads++;ForgeRuntime.DataSourceFetchResult()}
            fun disabled():Boolean {
                val inputs=EditableOperationInputs(emptyMap(),emptyMap(),emptyMap(),list.collection.peek(),emptyMap(),
                    list.input.peek(),list.selection.peek(),list.dataSourceRef,watched.mapValues{it.value.value})
                return inputs.disabled(op,spec,emptyList())
            }
            list.collection.set(listOf(mapOf("id" to 7)))
            assertTrue(disabled())
            w.signals.collection(w.identity.dataSourceId("parent")).set(listOf(mapOf("id" to 3)))
            assertFalse(disabled())
            w.signals.collection(w.identity.dataSourceId("parent")).set(emptyList())
            assertTrue(disabled())
            assertNull(runtime.registeredSource(w.windowId,"parent"))
            assertEquals(0,reads)
        } finally {scope.cancel()}
    }

    @Test fun noParametersAndCustomHandlerRetainOperationSelection()=runBlocking {
        val scope=CoroutineScope(SupervisorJob()+Dispatchers.Unconfined)
        try {
            val rt=ForgeRuntime(emptyMap(),scope)
            val w=rt.windowContext(rt.openWindowInline("inventory","Inventory",metadata=metadata).windowId)
            val source=w.context("list");val selected=listOf(mapOf("id" to 13L))
            val simple=operation.copy(parameters=emptyList())
            invokeEditableOperation(rt,source,simple,selected)?.join()
            assertEquals(mapOf("selectedRows" to selected,"operationId" to operation.id),w.dialogSignal("edit").peek().args)
            rt.closeDialog(w.windowId,"edit")
            var captured=emptyMap<String,Any?>()
            rt.registerHandler("custom"){captured=it.args;true}
            invokeEditableOperation(rt,source,simple.copy(handler="custom"),selected)?.join()
            assertEquals(mapOf("selectedRows" to selected,"operationId" to operation.id),captured)
            assertFalse(w.dialogSignal("edit").peek().open)
        } finally {scope.cancel()}
    }
}

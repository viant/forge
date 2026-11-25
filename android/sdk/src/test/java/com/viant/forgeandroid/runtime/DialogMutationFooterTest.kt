package com.viant.forgeandroid.runtime

import com.dokar.quickjs.QuickJs
import com.dokar.quickjs.evaluate
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import kotlin.test.*

/** Synthetic inventory editor, exercised through the same decoded action and executor as the dialog footer. */
class DialogMutationFooterTest {
    private val formSource = "editor"
    private val writer = "save"
    private val actionJSON = """{"id":"apply","label":"Apply","intent":"primary","on":[{"handler":"legacy"}],
      "visibleWhen":{"source":"authorization","field":"principal.roles","exists":true},
      "disabledWhen":{"source":"form","field":"name","empty":true},
      "mutationCommand":{"commandId":"","dataSourceRef":"save","prepare":"Workspace.prepare",
        "validateWhen":{"not":{"source":"authorization","field":"principal.roles","contains":"readonly"}},
        "confirm":"Apply changes?","resultState":{"updatedId":["0.id"]},"refresh":[{"dataSourceRef":"list"}]}}"""

    private val module = """({
        prepare:({context,parameters,extras})=>{
            const record=context.signals.form.peek();
            const selected=context.Context("list").handlers.dataSource.getSelection().selected;
            if(selected.id!==record.id)throw Error("Selection changed");
            if (parameters.extra!==extras.extra)throw Error("Invalid extras");
            if (context.Context("unused"))throw Error("Unrelated datasource was initialized");
            return {record:{id:record.id,name:record.name},limit:0,enabled:false,optional:null};
        },
        mutate:({context})=>{context.handlers.dataSource.setFormData({values:{}});return {};},
        asyncPrepare:async()=>({}),
        malformed:()=>[],
        transform:({phase,value,context})=>{
            if(!context.signals.authorization.peek().principal)throw Error("A principal is required");
            if(phase==="beforeMarshal")return {...value,id:7};
            if(phase==="afterMarshal")return {key:value.id,optional:null};
            throw Error("Unexpected phase: "+phase);
        }
    })"""

    private class Fixture(val runtime:ForgeRuntime,val window:WindowContext,val source:DataSourceContext,val action:ActionDef) {
        val calls=mutableListOf<Pair<String,Map<String,Any?>>>()
        var response:suspend (ForgeRuntime.DataSourceFetchRequest)->ForgeRuntime.DataSourceFetchResult = {
            ForgeRuntime.DataSourceFetchResult(rows=listOf(mapOf("id" to 7)))
        }
        init {
            runtime.registerDataSourceLoader { request ->
                synchronized(calls) { calls += request.dataSourceRef to request.input.parameters }
                response(request)
            }
        }
        suspend fun execute(command:MutationCommandDef = action.footerCommand()!!, confirm:suspend (String)->Boolean = {true}) =
            runtime.mutationCommands.execute(runtime,window,source,command,mapOf("extra" to 0),confirm)
    }

    private suspend fun withFixture(roles:List<String> = emptyList(), block:suspend (Fixture)->Unit) {
        val scope=CoroutineScope(SupervisorJob()+Dispatchers.Unconfined)
        ActionHookRuntime.testScriptEvaluator={ script ->
            val engine=QuickJs.create(Dispatchers.Default)
            try { engine.evaluate<String>(script) } finally { engine.close() }
        }
        try {
            val actions=JsonUtil.json.parseToJsonElement(actionJSON)
            val raw=buildJsonObject {
                put("namespace","Workspace");put("windowKey","records")
                put("view",buildJsonObject {put("content",JsonObject(emptyMap()))})
                put("actions",buildJsonObject {put("code",module)})
                put("authorizationSnapshot",JsonUtil.anyToElement(mapOf("principal" to mapOf("roles" to roles))))
                put("dataSource",JsonObject(listOf(formSource,writer,"list","unused").associateWith{buildJsonObject{put("autoFetch",false)}}))
                put("dialogs",buildJsonArray{add(buildJsonObject {put("id","editorDialog");put("actions",JsonArray(listOf(actions)))})})
            }
            val metadata=JsonUtil.json.decodeFromJsonElement(WindowMetadata.serializer(),normalizeWindowMetadataJson(raw))
            val runtime=ForgeRuntime(emptyMap(),scope)
            val id=runtime.openWindowInline("records","Records",metadata=metadata).windowId
            val window=runtime.windowContext(id)
            val source=window.context(formSource)
            source.setForm(mapOf("id" to 7,"name" to "Draft"))
            window.context("list").setSelection(SelectionState(selected=mapOf("id" to 7)))
            block(Fixture(runtime,window,source,metadata.dialogs.single().actions.single()))
        } finally {ActionHookRuntime.testScriptEvaluator=null;scope.cancel()}
    }

    @Test fun decodedCommandOwnsPresentationAndDispatch()=runBlocking {withFixture { f ->
        val command=f.action.footerCommand()!!
        assertEquals("apply",command.commandId);assertEquals("Apply",command.label);assertEquals("primary",command.intent)
        var legacy=0;f.runtime.registerHandler("legacy"){legacy++;true}
        val result=f.execute()
        assertEquals("succeeded",result.status,result.error);assertTrue(result.warnings.isEmpty());assertEquals(0,legacy)
        assertEquals(listOf(writer,"list"),f.calls.map{it.first})
        assertEquals(JsonUtil.json.parseToJsonElement("""{"record":{"id":7,"name":"Draft"},"limit":0,"enabled":false,"optional":null}"""),JsonUtil.anyToElement(f.calls.first().second))
        assertEquals(7,(f.window.peekWindowForm()["updatedId"] as Number).toInt())
        assertFalse("unused" in f.runtime.registeredWindowDataSources(f.window.windowId))
        val plain=f.action.copy(mutationCommand=null)
        assertNull(plain.footerCommand());f.runtime.activatePlainFooter(f.window,"editorDialog",plain,f.source)
        assertEquals(1,legacy)
    }}

    @Test fun roleAndChangedSelectionBlockTheWriter()=runBlocking {
        withFixture(listOf("readonly")){ f -> assertFalse(f.execute().accepted);assertTrue(f.calls.isEmpty()) }
        withFixture { f ->
            val result=f.execute { f.window.context("list").setSelection(SelectionState(selected=mapOf("id" to 99)));true }
            assertFalse(result.accepted);assertContains(result.error.orEmpty(),"Selection changed");assertNotNull(result.cause);assertTrue(f.calls.isEmpty())
            f.source.setForm(mapOf("id" to 7,"name" to ""));assertFalse(f.execute().accepted)
        }
    }

    @Test fun malformedMissingAndEffectfulPreparationFailBeforeDispatch()=runBlocking {withFixture { f ->
        for(hook in listOf("Workspace.absent","Workspace.mutate","Workspace.asyncPrepare","Workspace.malformed")){
            val result=f.execute(f.action.footerCommand()!!.copy(prepare=hook))
            assertFalse(result.accepted);assertTrue(result.error.orEmpty().isNotEmpty());assertNotNull(result.cause)
            assertTrue(f.calls.isEmpty());assertEquals("Draft",f.source.form.peek()["name"])
        }
    }}

    @Test fun transportFailureMissingReceiptAndTimeoutRemainDistinct()=runBlocking {withFixture { f ->
        val problem=IllegalArgumentException("Request rejected")
        f.response={throw problem}
        val failure=f.execute();assertEquals("failed",failure.status);assertSame(problem,failure.cause)
        f.response={ForgeRuntime.DataSourceFetchResult()}
        val partial=f.execute();assertEquals("succeeded",partial.status);assertEquals("resultState",partial.warnings.single().stage)
        f.response={delay(2000);ForgeRuntime.DataSourceFetchResult()}
        val command=f.action.footerCommand()!!.copy(timeoutMs=1000)
        assertEquals("indeterminate",f.execute(command).status);assertEquals("suppressed",f.execute(command).status)
        assertEquals(3,f.calls.count{it.first==writer})
    }}

    @Test fun scopedModelHooksReceivePhaseAndReturnExactObjectOrReject() = runBlocking {
        withFixture { f ->
            val meta = f.window.metadata.peek()!!
            val schema = JsonUtil.json.decodeFromString(ResourceSchemaDef.serializer(),
                """{"type":"object","properties":{"id":{"type":"integer"},"name":{"type":"string"}}}""")
            val model = JsonUtil.json.decodeFromString(ResourceModelDef.serializer(), """{
                "schemaRef":"record","write":{"dataSourceRef":"save","inputPath":"records","collection":true,"mode":"full"},
                "hooks":{"beforeMarshal":"Workspace.transform","afterMarshal":"Workspace.transform"}
            }""")
            f.window.metadata.set(meta.copy(schemas=mapOf("record" to schema), resourceModels=mapOf("record" to model)))
            val command = f.action.footerCommand()!!.copy(prepare=null, payload=ResourcePayloadPreparationDef(
                modelRef="record", source=ResourceValueSourceDef(scope="form")))
            val result = f.execute(command)
            assertEquals("succeeded", result.status, result.error)
            // The caller extras are excluded when payload has an explicit source.
            assertEquals(JsonUtil.json.parseToJsonElement("""{"records":[{"key":7,"optional":null}]}"""),
                JsonUtil.anyToElement(f.calls.first().second))
            val missing = model.copy(hooks=ResourceModelHooksDef(beforeMarshal="Workspace.missing"))
            f.window.metadata.set(f.window.metadata.peek()!!.copy(resourceModels=mapOf("record" to missing)))
            val rejected = f.execute(command)
            assertFalse(rejected.accepted)
            assertContains(rejected.error.orEmpty(),"Missing UI action")
            assertEquals(1,f.calls.count {it.first==writer})
        }
    }

    @Test fun openingRunsDeclaredLifecycleOnceAndBindsArgumentsBeforeIt() = runBlocking {
        withFixture { f ->
            var opened = 0
            f.runtime.registerHandler("observe") { event ->
                assertEquals(4,event.context?.input?.peek()?.parameters?.get("id"))
                opened++
                true
            }
            val original = f.window.metadata.peek()!!
            val dialog = original.dialogs.single().copy(dataSourceRef=formSource, fetchOnOpen=false,
                on=listOf(ExecutionDef(event="onOpen",handler="dataSource.setWindowFormData",
                    parameters=listOf(ParameterDef(name="done",input="const",location="false",codec=JsonObject(mapOf("name" to JsonPrimitive("boolean")))))),
                    ExecutionDef(event="onOpen",handler="observe")))
            f.window.metadata.set(original.copy(dialogs=listOf(dialog)))
            f.runtime.setWindowFormValue(f.window.windowId,mapOf("done" to true))
            val id=f.window.windowId
            assertTrue(f.runtime.presentDialog(id,"editorDialog",mapOf("id" to 4)))
            assertEquals(false,f.window.peekWindowForm()["done"])
            assertEquals(1,opened)
            f.runtime.setWindowFormValue(id,mapOf("done" to true))
            f.runtime.presentDialog(id,"editorDialog",mapOf("id" to 4))
            assertEquals(true,f.window.peekWindowForm()["done"])
            f.runtime.closeDialogPublic(id,"editorDialog")
            f.runtime.presentDialog(id,"editorDialog",mapOf("id" to 4))
            assertEquals(2,opened)
            assertEquals(false,f.window.peekWindowForm()["done"])
            assertTrue(f.calls.isEmpty())
        }
    }

}

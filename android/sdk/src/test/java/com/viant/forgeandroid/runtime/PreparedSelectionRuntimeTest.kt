package com.viant.forgeandroid.runtime

import com.dokar.quickjs.QuickJs
import com.dokar.quickjs.evaluate
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.RecordedRequest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import kotlin.test.*

class PreparedSelectionRuntimeTest {
    private val selected = listOf(mapOf("id" to "0002", "editable" to true), mapOf("id" to 1L, "editable" to true))
    private val records = listOf(mapOf("id" to "1", "parent" to "007", "editable" to true, "kind" to "basic"),
        mapOf("id" to 2L, "parent" to 7L, "editable" to true, "kind" to "basic"))
    private val operation = JsonUtil.json.decodeFromString(EditableCollectionOperationSpec.serializer(), """
        {"id":"edit","label":"Edit","dialogId":"editor","requiresSelection":true,
         "parameters":[{"name":"Parent","in":"windowForm","location":"parent","codec":{"name":"int[]"}}],
         "visibleWhen":{"source":"authorization","field":"principal.active","equals":true},
         "disabledWhen":{"source":"windowForm","field":"opening","equals":true},
         "selection":{"every":{"source":"row","field":"editable","equals":true}},
         "prepareSelection":{"dataSourceRef":"detail","idsParameter":"Ids","identityField":"id",
          "scopeFields":{"parent":"Parent"},"mappingRef":"types","prepare":"Inventory.prepare","pendingField":"opening","errorField":"error"}}
    """.trimIndent())
    private val parentOperation = operation.copy(id = "editParent", requiresSelection = false, selection = null,
        parameters = listOf(ParameterDef(name = "Parent", input = "windowForm", location = "parent")),
        prepareSelection = JsonUtil.json.decodeFromString(PreparedSelectionDef.serializer(), """
            {"dataSourceRef":"detail","parentParameter":"Parent","identityField":"id","prepare":"Inventory.plain","pendingField":"opening","errorField":"error"}
        """.trimIndent()))
    private val spec = EditableCollectionSpec(operations = listOf(operation, parentOperation))
    private val module = """({
        normalize: row=>row.id,
        prepare:({context,rows,parameters,invocationId,mapping,descriptors,rowCases,draftModel})=>{
            if(!invocationId || parameters.Ids.join(',')!=='0002,1' || parameters.Parent[0]!==7) throw Error('Bad inputs');
            if(mapping.fieldOrder[0]!=='size'||mapping.cases||descriptors.length!==1 ||
               descriptors[0].modelRef!=='record'||descriptors[0].schema.type!=='object'||descriptors[0].values.flag!==true||
               rowCases.join(',')!=='0,0'||draftModel.schemaRef!=='record')throw Error('Bad mapping projection');
            if(context.Context('unused')||context.handlers.dataSource.getCollection().length)throw Error('Unneeded reader state');
            return {ids:rows.map(context.lookupHandler('Nested.normalize')),invocation:invocationId,version:rows[0].version};
        },
        plain:({rows,mapping,descriptors,rowCases,draftModel})=>{
          if(mapping!==null || descriptors.length || rowCases.length || !draftModel)throw Error('Bad optional mapping');
          return {ids:rows.map(r=>r.id)};
        },
        bad:()=>{throw Error('The chosen rows cannot be opened.')},
        effect:({context})=>{context.handlers.dataSource.setFormData({values:{bad:true}});return {}},
        deferred:async()=>({}),scalar:()=>true,wrong:({context})=>context.lookupHandler('Unknown.normalize')
    })"""
    private inner class Fixture(scope: CoroutineScope, server: MockWebServer? = null) {
        val runtime = ForgeRuntime(if(server==null)emptyMap() else mapOf("service" to EndpointConfig(server.url("/").toString())),scope)
        private val definition = DataSourceDef(autoFetch=false, selectionMode="none",
            service=server?.let { ServiceDef(endpoint="service",uri="/v1/api/datasources/detail/fetch",method="POST") },
            selectors=SelectorDef(data="rows"),
            parameters=listOf(ParameterDef(name="Ids",input="input",location="detail.parameters.Ids"),ParameterDef(name="Parent",input="input",location="detail.parameters.Parent",to=server?.let { "query" })))
        private val model = ResourceModelDef(schemaRef="record")
        private val meta = WindowMetadata(namespace="Inventory",actionAliases=listOf("Nested"),windowKey="inventory",actions=ActionsDef(code=module),
            view=ViewDef(content=ContentDef(containers=listOf(ContainerDef(editableCollection=spec)))),dataSources=mapOf("list" to DataSourceDef(selectionMode="multi"),"detail" to definition,
                "draft" to DataSourceDef(autoFetch=false,resourceModelRef="record"),"unused" to DataSourceDef()),
            schemas=mapOf("record" to ResourceSchemaDef(type="object")),resourceModels=mapOf("record" to model),
            resourceMappings=mapOf("types" to ResourceMappingDef(listOf("kind"),mapOf("basic" to ResourceMappingCase("record",mapOf("flag" to JsonPrimitive(true))),
                "unused" to ResourceMappingCase("absent")),fieldOrder=listOf("size"))),
            dialogs=listOf(DialogDef(id="editor",dataSourceRef="draft",fetchOnOpen=false)),
            authorizationSnapshot=JsonUtil.json.parseToJsonElement("""{"principal":{"active":true}}""").jsonObject)
        val window = runtime.windowContext(runtime.openWindowInline("inventory","Inventory",metadata=meta).windowId)
        val source = window.context("list")
        val draft = window.context("draft")
        val calls = mutableListOf<ForgeRuntime.DataSourceFetchRequest>()
        init {
            source.selection.set(SelectionState(selection=selected))
            source.collection.set(listOf(mapOf("unrelatedList" to true)))
            draft.form.set(mapOf("previous" to true))
            runtime.setWindowFormValues(window.windowId,mapOf("parent" to "007"))
        }
        fun loader(read: suspend (ForgeRuntime.DataSourceFetchRequest)->List<Map<String,Any?>> = { records }) {
            runtime.registerDataSourceLoader { request ->
                require(request.dataSourceRef=="detail")
                calls+=request
                ForgeRuntime.DataSourceFetchResult(rows=read(request))
            }
        }
        suspend fun activate(op:EditableCollectionOperationSpec=operation,presented:()->Boolean={true}) =
            runtime.preparedSelections.activate(runtime,source,spec,op,presented=presented)
        fun untouched(){
            assertEquals(mapOf("previous" to true),draft.form.peek())
            assertFalse(window.dialogSignal("editor").peek().open)
        }
    }
    private suspend fun fixture(server: MockWebServer? = null, test: suspend Fixture.()->Unit){
        val scope=CoroutineScope(SupervisorJob()+Dispatchers.Unconfined)
        ActionHookRuntime.testScriptEvaluator={ script ->
            val js=QuickJs.create(Dispatchers.Default);try{js.evaluate<String>(script)}finally{js.close()}
        }
        try { Fixture(scope,server).test() } finally {ActionHookRuntime.testScriptEvaluator=null;scope.cancel()}
    }

    @Test fun buttonOperationReadsOnlyFreshRowsAndSeedsTheDestinationOnce()=runBlocking { fixture {
        val reader=window.context("detail")
        val oldRows=listOf(mapOf("id" to 12));reader.collection.set(oldRows)
        reader.form.set(mapOf("old" to true));reader.setInputParameters(mapOf("unrelated" to 1))
        loader()
        assertTrue(activate().getOrThrow())
        assertEquals(listOf(2L,"1"),draft.form.peek()["ids"])
        assertTrue(draft.form.peek()["invocation"].toString().isNotBlank())
        assertFalse("previous" in draft.form.peek())
        assertTrue(window.dialogSignal("editor").peek().open)
        assertEquals(1,calls.size)
        val expected=mapOf("Ids" to listOf("0002",1L),"Parent" to listOf(7L))
        assertEquals(expected,calls.single().input.parameters)
        assertEquals(expected,calls.single().resolvedInputs)
        assertTrue(calls.single().bypassCache)
        assertEquals(draft.form.peek()["invocation"],calls.single().invocationId)
        assertEquals(oldRows,reader.collection.peek())
        assertEquals(mapOf("old" to true),reader.form.peek())
        assertEquals(mapOf("unrelated" to 1),reader.input.peek().parameters)
        assertFalse(reader.control.peek().resolved)
        assertFalse("unused" in runtime.registeredWindowDataSources(window.windowId))
        assertEquals(false,window.peekWindowForm()["opening"])
    } }

    @Test fun parentUsesItsDeclaredScalarOrSingletonWithoutAChildSelection() = runBlocking {
        for (value in listOf("007", listOf("007"))) fixture {
            source.setSelection(SelectionState())
            runtime.setWindowFormValues(window.windowId, mapOf("parent" to value))
            loader { request ->
                assertEquals(mapOf("Parent" to value), request.input.parameters)
                assertEquals(request.input.parameters, request.resolvedInputs)
                source.setSelection(SelectionState(selected = mapOf("id" to 42)))
                listOf(mapOf("id" to 7))
            }
            val childTable = spec.copy(selection = PrimitiveSelectionSpec(min = 1))
            assertTrue(runtime.preparedSelections.activate(runtime, source, childTable, parentOperation).getOrThrow())
            assertEquals(1, calls.size)
            assertEquals(listOf(7L), draft.form.peek()["ids"])
        }
    }

    @Test fun invalidParentDeclarationsValuesAndLateParentChangesCannotSeed() = runBlocking {
        for (mode in listOf("ambiguous", "undeclared", "missing", "multiple", "changed", "wrongRow")) fixture {
            source.setSelection(SelectionState())
            val prepare = parentOperation.prepareSelection!!
            val op = when (mode) {
                "ambiguous" -> parentOperation.copy(prepareSelection = prepare.copy(idsParameter = "Ids"))
                "undeclared" -> parentOperation.copy(prepareSelection = prepare.copy(parentParameter = "Absent"))
                else -> parentOperation
            }
            if (mode == "missing" || mode == "multiple") runtime.setWindowFormValues(window.windowId, mapOf(
                "parent" to if (mode == "multiple") listOf(7, 8) else null))
            loader {
                if (mode == "changed") runtime.setWindowFormValues(window.windowId, mapOf("parent" to 9))
                listOf(mapOf("id" to if (mode == "wrongRow") 9 else 7))
            }
            assertFalse(activate(op).getOrDefault(false), mode)
            assertEquals(if (mode in listOf("changed", "wrongRow")) 1 else 0, calls.size)
            untouched()
        }
    }

    @Test fun onlyAnAuthorizedUnchangedReadForTheseInputsCanSupplyTheParent() = runBlocking {
        for (change in listOf("none", "input", "row", "error", "actor", "metadata", "foreign", "transport")) fixture {
            source.setSelection(SelectionState())
            val reader = window.context("detail")
            reader.setInputParameters(mapOf("Parent" to "007"))
            loader { request -> listOf(mapOf("id" to if (change == "foreign" && request.invocationId == null) 8 else 7, "value" to "persisted")) }
            reader.fetchCollection()
            withTimeout(3_000) { while (reader.input.peek().fetch || !reader.control.peek().resolved) delay(2) }
            assertEquals(1, calls.size)
            assertNotNull(runtime.currentParentRows(window, "detail", mapOf("Parent" to "007")), change)
            when (change) {
                "transport" -> loader { listOf(mapOf("id" to 7)) }
                "input" -> reader.setInputParameters(mapOf("Parent" to "008"))
                "row" -> reader.collection.set(listOf(mapOf("id" to 7, "value" to "local")))
                "error" -> reader.control.set(reader.control.peek().copy(error = "offline"))
                "actor" -> {
                    val meta = window.metadata.peek()!!
                    window.metadata.set(meta.copy(authorizationSnapshot = mapOf("principal" to buildJsonObject {
                        put("active", true); put("subject", "replacement")
                    })))
                }
                "metadata" -> window.metadata.set(window.metadata.peek()!!.copy(namespace = "replacement", actionAliases = listOf("Inventory","Nested")))
            }
            assertTrue(activate(parentOperation).getOrThrow(), change)
            assertEquals(if (change == "none") 1 else 2, calls.size, change)
            assertEquals(listOf(7L), draft.form.peek()["ids"], change)
        }
    }

    @Test fun aParentOpenObservesTheDeclaredControlCollectionMetricsAndWindowOwners() = runBlocking {
        for (mode in listOf("ready", "missing", "unloaded", "loading", "stale", "error", "inactive", "metrics", "collection", "owner", "late")) fixture {
            val gate = window.context("unused")
            gate.control.set(ControlState(resolved = mode !in listOf("unloaded","stale"), loading = mode == "loading",
                inactive = mode == "inactive", error = if (mode == "error") "offline" else null))
            gate.metrics.set(mapOf("ready" to (mode != "metrics")))
            gate.collection.set(if (mode == "collection") emptyList() else listOf(mapOf("id" to 7)))
            source.control.set(ControlState(resolved = mode != "owner"))
            val ref = if (mode == "missing") "absent" else "unused"
            val guards = JsonUtil.json.decodeFromString(DashboardConditionDef.serializer(), """
                {"all":[{"source":"control","dataSourceRef":"$ref","field":"loaded","equals":true},
                  {"source":"control","dataSourceRef":"$ref","field":"stale","equals":false},
                  {"source":"control","dataSourceRef":"$ref","field":"loading","equals":false},
                  {"source":"control","dataSourceRef":"$ref","field":"inactive","equals":false},
                  {"not":{"source":"control","dataSourceRef":"$ref","field":"error","notEmpty":true}},
                  {"source":"control","field":"loaded","equals":true},
                  {"source":"metrics","dataSourceRef":"unused","field":"ready","equals":true},
                  {"source":"collection","dataSourceRef":"unused","field":"0.id","equals":7},
                  {"source":"windowForm","field":"parent","equals":"007"}]}
            """.trimIndent())
            val op = parentOperation.copy(visibleWhen = guards)
            source.setSelection(SelectionState())
            loader {
                if (mode == "late") gate.control.set(ControlState(resolved = true, error = "offline"))
                listOf(mapOf("id" to 7))
            }
            val result = runtime.preparedSelections.activate(runtime, source, spec.copy(operations = listOf(op)), op)
            assertEquals(mode == "ready", result.getOrThrow(), mode)
            assertEquals(if (mode in listOf("ready","late")) 1 else 0, calls.size, mode)
            if (mode != "ready") untouched()
        }
    }

    @Test fun ordinaryHTTPEvidenceMatchesTheDetachedParentRequestOnTheWire() = runBlocking {
        val server = MockWebServer()
        repeat(2) { server.enqueue(MockResponse().setBody("""{"rows":[{"id":"007","value":"stored"}]}""")) }
        server.start()
        try { fixture(server) {
            val reader = window.context("detail")
            reader.setInputParameters(mapOf("Parent" to "007"))
            reader.fetchCollection()
            withTimeout(3_000) { while (reader.input.peek().fetch || !reader.control.peek().resolved) delay(2) }
            val body = JsonUtil.json.parseToJsonElement(server.takeRequest().body.readUtf8()).jsonObject
            assertEquals(buildJsonObject { put("Parent", "007") }, body["inputs"])
            assertTrue(activate(parentOperation).getOrThrow())
            assertEquals(1, server.requestCount)
            runtime.closeDialogPublic(window.windowId, "editor")
            reader.collection.set(listOf(mapOf("id" to "007", "value" to "changed locally")))
            assertTrue(activate(parentOperation).getOrThrow())
            assertEquals(2, server.requestCount)
            val fresh = JsonUtil.json.parseToJsonElement(server.takeRequest().body.readUtf8()).jsonObject
            assertEquals(body["inputs"], fresh["inputs"])
            assertEquals(JsonPrimitive(true), fresh["cache"]!!.jsonObject["bypassCache"])
        } } finally { server.shutdown() }
    }

    @Test fun malformedScopeAndDuplicateSelectedIdsCannotInvokeAReader()=runBlocking {
        for(mode in listOf("duplicate","unsafe","missing","scope","empty","denied")) fixture {
            loader()
            when(mode) {
                "scope" -> runtime.setWindowFormValues(window.windowId,mapOf("parent" to listOf(7,8)))
                "empty" -> runtime.setWindowFormValues(window.windowId,mapOf("parent" to null))
                "denied" -> source.setSelection(SelectionState(selection=listOf(mapOf("id" to 1,"editable" to false))))
                else -> source.setSelection(SelectionState(selection=listOf(mapOf("id" to "01","editable" to true),
                    mapOf("id" to when(mode){"duplicate"->1;"unsafe"->9007199254740992L;else->null},"editable" to true))))
            }
            assertFalse(activate().getOrDefault(false));assertTrue(calls.isEmpty());untouched()
        }
    }
    @Test fun invalidForeignDuplicateAndMissingFreshRowsNeverOpenOrPublish()=runBlocking {
        for(bad in listOf(records.drop(1), records+records.first(), listOf(records.first(),records.first()),
            listOf(records.first(),records.last()+("id" to 99)),listOf(records.first(),records.last()+("parent" to 8)),
            listOf(records.first(),records.last()+("editable" to false)))) fixture {
            loader{bad};val result=activate()
            assertTrue(result.isFailure);assertTrue(window.peekWindowForm()["error"].toString().isNotBlank())
            assertEquals(1,calls.size);assertFalse("detail" in runtime.registeredWindowDataSources(window.windowId));untouched()
        }
    }
    @Test fun changedScopePresentationOrParentStopsAnOutstandingReadWithoutAStaleError()=runBlocking {
        for(change in listOf("parent","role","selection","presentation")) fixture {
            var here=true
            loader {
                when(change) {
                    "parent"->runtime.setWindowFormValues(window.windowId,mapOf("parent" to listOf(9)))
                    "role"->runtime.updatePreviewPrincipal(window.windowId,setOf("reader"),emptySet())
                    "selection"->source.setSelection(SelectionState(selection=selected.reversed()))
                    else->here=false
                }
                throw IllegalStateException("no stale diagnostic")
            }
            assertFalse(activate(presented={here}).getOrThrow());untouched()
            assertFalse(window.peekWindowForm()["error"]=="no stale diagnostic")
            assertEquals(false,window.peekWindowForm()["opening"])
        }
    }
    @Test fun aliasErrorsPromisesAndEffectfulHooksCanNeverSeedTheDraft()=runBlocking {
        for(handler in listOf("bad","effect","deferred","scalar","wrong")) fixture {
            loader();val op=operation.copy(prepareSelection=operation.prepareSelection!!.copy(prepare="Inventory.$handler"))
            val result=activate(op)
            assertTrue(result.isFailure);assertEquals(result.exceptionOrNull()?.message,window.peekWindowForm()["error"])
            assertFalse(source.form.peek().containsKey("bad"));untouched()
        }
    }
    @Test fun duplicateClicksShareOnePendingReadAndRestoreTheOwnedFlag()=runBlocking { fixture {
        val start=CompletableDeferred<Unit>();val finish=CompletableDeferred<Unit>()
        loader {start.complete(Unit);finish.await();records}
        coroutineScope {
            val first=async {activate()}
            start.await();assertEquals(true,window.peekWindowForm()["opening"])
            assertFalse(activate().getOrThrow());assertEquals(1,calls.size)
            finish.complete(Unit);assertTrue(first.await().getOrThrow())
        }
        assertEquals(false,window.peekWindowForm()["opening"])
    } }
    @Test fun opaqueAndLargeDecimalTextIdentitiesAreComparedExactly()=runBlocking { fixture {
        val ids=listOf("900719925474099300000000"," X ")
        source.setSelection(SelectionState(selection=ids.map{ mapOf("id" to it,"editable" to true) }))
        loader {ids.reversed().map{mapOf("id" to it,"parent" to 7,"editable" to true)}}
        val op=operation.copy(prepareSelection=operation.prepareSelection!!.copy(mappingRef=null,prepare="Inventory.plain"))
        assertTrue(activate(op).getOrThrow());assertEquals(ids,draft.form.peek()["ids"])
    } }
    @Test fun codecNormalizesOnlySafeScopeValuesAndPreservesLongDecimalText()=runBlocking { fixture {
        val text="9007199254740993123456"
        runtime.setWindowFormValues(window.windowId,mapOf("parent" to text))
        loader { request ->
            require(request.input.parameters["Parent"] == listOf(text))
            records.map { it + ("parent" to text) }
        }
        val op=operation.copy(prepareSelection=operation.prepareSelection!!.copy(mappingRef=null,prepare="Inventory.plain"))
        assertTrue(activate(op).getOrThrow())
    } }
    @Test fun inputAndSelectionPredicatesUseTheSameSourcesAtTheButtonAndBeforeSeeding()=runBlocking { fixture {
        val enabled = DashboardConditionDef(all=listOf(
            DashboardConditionDef(source="input",field="parameters.enabled",equals=JsonPrimitive(true)),
            DashboardConditionDef(source="selection",field="selection.0.id",equals=JsonPrimitive("0002"))))
        val op=operation.copy(visibleWhen=enabled)
        loader { source.setInputParameters(mapOf("enabled" to false));records }
        assertFalse(activate(op).getOrThrow());assertTrue(calls.isEmpty())
        source.setInputParameters(mapOf("enabled" to true))
        assertFalse(activate(op).getOrThrow());assertEquals(1,calls.size);untouched()
    } }
    @Test fun decimalParameterCodecsDoNotAcceptJVMLiteralSuffixes()=runBlocking { fixture {
        val resolver=ParameterResolver()
        val param=ParameterDef(name="N",input="windowForm",location="n",codec=JsonPrimitive("number"))
        for ((text,expected) in listOf("1f" to "1f", "0x1.0p3" to "0x1.0p3", "2.5e1" to 25.0)) {
            runtime.setWindowFormValues(window.windowId,mapOf("n" to text))
            assertEquals(expected,resolver.resolveOperation(listOf(param),source).inbound[""]?.get("N"))
        }
    } }
    @Test fun missingRegisteredReaderReceiptCannotFallThroughToASecondHTTPRead()=runBlocking {
        val server=MockWebServer()
        server.enqueue(MockResponse().setBody(buildJsonObject { put("rows",JsonUtil.anyToElement(records)) }.toString()))
        server.start()
        try { fixture(server) {
            var loaderCalls=0
            runtime.registerDataSourceLoader { request ->
                assertEquals("detail",request.dataSourceRef)
                assertTrue(request.bypassCache)
                assertTrue(!request.invocationId.isNullOrBlank())
                loaderCalls++
                null
            }
            val result=activate()
            assertTrue(result.isFailure)
            assertEquals(result.exceptionOrNull()?.message,window.peekWindowForm()["error"])
            assertEquals(1,loaderCalls)
            assertEquals(0,server.requestCount)
            untouched()
        } } finally { server.shutdown() }
    }

    @Test fun coldAndWarmHTTPSelectionOpensBypassServiceCacheWithSeparateInvocationIds()=runBlocking {
        val server=MockWebServer()
        var producerReads=0
        val envelopes=mutableListOf<JsonObject>()
        server.dispatcher=object: Dispatcher() {
            override fun dispatch(request:RecordedRequest):MockResponse {
                val body=JsonUtil.json.parseToJsonElement(request.body.readUtf8()).jsonObject
                envelopes.add(body)
                if (producerReads==0 || body["cache"]?.jsonObject?.get("bypassCache")==JsonPrimitive(true)) producerReads++
                val rows=records.map { it + ("version" to producerReads) }
                return MockResponse().setBody(buildJsonObject { put("rows",JsonUtil.anyToElement(rows)) }.toString())
            }
        }
        server.start()
        try { fixture(server) {
            for (version in 1..2) {
                assertTrue(activate().getOrThrow())
                assertEquals(version.toLong(),draft.form.peek()["version"])
                assertEquals(draft.form.peek()["invocation"],envelopes.last()["invocationId"]?.jsonPrimitive?.content)
                runtime.closeDialog(window.windowId,"editor")
            }
            assertEquals(2,producerReads)
            assertEquals(2,server.requestCount)
            assertEquals(envelopes[0]["inputs"],envelopes[1]["inputs"])
            assertNotEquals(envelopes[0]["invocationId"],envelopes[1]["invocationId"])
            assertFalse("detail" in runtime.registeredWindowDataSources(window.windowId))
        } } finally { server.shutdown() }
    }

    @Test fun declinedHTTPAndMalformedEnvelopePreserveThePriorDraft()=runBlocking {
        for(code in listOf(200,403)) {
            val server=MockWebServer();val scope=CoroutineScope(SupervisorJob()+Dispatchers.Unconfined)
            try {
                server.enqueue(MockResponse().setResponseCode(code).setBody("""{"data":[{"id":1}]}"""));server.start()
                val f=Fixture(scope,server)
                val result=f.activate();assertTrue(result.isFailure);f.untouched()
                if(code==403)assertEquals(403,assertIs<HttpResponseException>(result.exceptionOrNull()).status)
                assertEquals(1,server.requestCount)
                val request=server.takeRequest()
                assertEquals("/v1/api/datasources/detail/fetch",request.path)
                val envelope=JsonUtil.json.parseToJsonElement(request.body.readUtf8()).jsonObject
                assertEquals(setOf("inputs","cache","invocationId"),envelope.keys)
                assertEquals(JsonUtil.json.parseToJsonElement("""{"Parent":[7],"Ids":["0002",1]}"""),envelope["inputs"])
                assertEquals(JsonUtil.json.parseToJsonElement("""{"bypassCache":true}"""),envelope["cache"])
                assertTrue(envelope.getValue("invocationId").jsonPrimitive.content.isNotBlank())
            }finally{server.shutdown();scope.cancel()}
        }
    }
}

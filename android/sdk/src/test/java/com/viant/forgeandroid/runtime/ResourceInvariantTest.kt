package com.viant.forgeandroid.runtime

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*
import kotlin.test.*

class ResourceInvariantTest {
    private fun schema(body: String) = JsonUtil.json.decodeFromString(ResourceSchemaDef.serializer(), body)
    private fun check(body: String, record: Map<String, Any?>) =
        ResourceModelRuntime.validate(record, "record", mapOf("record" to schema(body)))

    private val guarded = """{
        "type":"object",
        "properties":{"enabled":{"type":"boolean"},"quantity":{"nullable":true},"limit":{"type":"integer"},"label":{"type":"string","nullable":true}},
        "invariants":[{
            "when":{"all":[{"field":"enabled","equals":true},{"not":{"field":"label","equals":"optional"}}]},
            "assert":{"any":[{"field":"label","notEmpty":true},{"source":"form","field":"quantity","gte":1,"lt":10}]},
            "path":"quantity","message":"Choose a quantity from 1 to 9 or provide a label."
        }, {
            "when":{"field":"limit","exists":true},"assert":{"field":"quantity","lteField":"limit"},
            "path":"quantity","message":"Quantity exceeds the limit."
        }]
    }"""

    @Test fun validatesOnlyTheCurrentCanonicalRecord() {
        check(guarded, emptyMap())
        check(guarded, mapOf("enabled" to false, "quantity" to 0))
        check(guarded, mapOf("enabled" to true, "quantity" to "2.5"))
        check(guarded, mapOf("enabled" to true, "quantity" to 10, "label" to " "))
        for (value in listOf(null, false, "", "0", 10, "10", "1f", "0x1.0p1")) {
            val failure = assertFailsWith<IllegalArgumentException> { check(guarded, mapOf("enabled" to true, "quantity" to value)) }
            assertEquals("$.quantity: Choose a quantity from 1 to 9 or provide a label.", failure.message)
        }
    }

    @Test fun scalarComparisonsDistinguishNullAbsenceFalseZeroAndText() {
        fun matches(rule: String, record: Map<String, Any?>): Boolean = runCatching {
            check("""{"type":"object","properties":{"value":{"nullable":true}},"invariants":[{"assert":$rule,"message":"Mismatch"}]}""", record)
        }.isSuccess
        val eqNull = """{"field":"value","equals":null}"""
        assertTrue(matches(eqNull,mapOf("value" to null)))
        assertFalse(matches(eqNull,emptyMap()))
        assertTrue(matches("""{"field":"value","notEquals":null}""",emptyMap()))
        val choices = """{"field":"value","in":[false,0,"x",null]}"""
        for (v in listOf(null,false,0,0.0,"x")) assertTrue(matches(choices,mapOf("value" to v)))
        for (v in listOf("0","false",0.5,true)) assertFalse(matches(choices,mapOf("value" to v)))
        assertFalse(matches(choices,emptyMap()))
        for (v in listOf(0,false," ")) assertTrue(matches("""{"field":"value","exists":true}""",mapOf("value" to v)))
        for (v in listOf(null,"",emptyList<String>(),emptyMap<String,String>())) assertTrue(matches("""{"field":"value","empty":true}""",mapOf("value" to v)))
    }

    @Test fun carriesNamedAndInlineInvariantsThroughNestedObjectsAndArrayItems() {
        val nested = """{"type":"object","properties":{"enabled":{"type":"boolean"},"amount":{"type":"integer"}},"invariants":[{"when":{"field":"enabled","equals":true},"assert":{"field":"amount","gt":0},"path":"amount","message":"Amount must be positive."}]}"""
        val parent = schema("""{"type":"object","properties":{"single":{"${'$'}ref":"child"},"rows":{"type":"array","items":$nested}}}""")
        val schemas = mapOf("parent" to parent,"child" to schema(nested))
        val invalid = mapOf("enabled" to true,"amount" to 0)
        val nestedCases = listOf(mapOf("single" to invalid) to "$.single.amount",mapOf("rows" to listOf(emptyMap<String,Any?>(),invalid)) to "$.rows[1].amount")
        for ((record,path) in nestedCases) assertEquals("$path: Amount must be positive.",
            assertFailsWith<IllegalArgumentException> {ResourceModelRuntime.validate(record,"parent",schemas)}.message)
        val indexed = """{"type":"object","properties":{"rows":{"type":"array","items":$nested}},"invariants":[{"assert":{"field":"rows.0.amount","equals":0},"message":"Missing initial zero."}]}"""
        check(indexed,mapOf("rows" to listOf(mapOf("amount" to 0))))
        assertEquals("$: Missing initial zero.",assertFailsWith<IllegalArgumentException>{check(indexed,mapOf("rows" to emptyList<Any?>()))}.message)
    }

    @Test fun comparesRangeEndpointsAndNestedBoundsInTheSameRecord() {
        val interval = """{
            "type":"object","properties":{
                "start":{"nullable":true},"end":{"nullable":true},"ranges":{"type":"array","items":{"type":"object","properties":{"limit":{"nullable":true}}}}},
            "invariants":[{"assert":{"all":[
                {"field":"end","gteField":"start"},
                {"field":"start","lteField":"end"},
                {"field":"end","ltField":"ranges.0.limit","gte":0},
                {"not":{"field":"start","gtField":"end"}}
            ]},"path":"end","message":"The interval is invalid."}]
        }"""
        val model = schema(interval)
        val saved = JsonUtil.json.encodeToString(ResourceSchemaDef.serializer(), model)
        assertEquals(model, schema(saved))
        fun range(start: Any?, end: Any?, limit: Any?) =
            mapOf("start" to start, "end" to end, "ranges" to listOf(mapOf("limit" to limit)))
        check(saved, range(0, 0, 1))
        check(saved, range("1.25e3", 1251, "1300"))
        for (row in listOf(range(2,1,3), range(0,2,2), range(null,1,3), range(0,null,3),
            range(0,1,null), range(0,1,true), range(0,1,"3f"), range(0,1,Double.POSITIVE_INFINITY),
            mapOf("end" to 0), mapOf("start" to 0, "end" to 1, "ranges" to emptyList<Any?>()))) {
            assertEquals("$.end: The interval is invalid.", assertFailsWith<IllegalArgumentException> {check(saved,row)}.message)
        }
        for ((operator, accepted) in mapOf("gtField" to false, "gteField" to true, "ltField" to false, "lteField" to true)) {
            val equalEndpoints = """{"type":"object","properties":{"a":{},"b":{}},"invariants":[{"assert":{"field":"a","$operator":"b"},"message":"Invalid."}]}"""
            assertEquals(accepted, runCatching { check(equalEndpoints, mapOf("a" to 0,"b" to 0)) }.isSuccess, operator)
        }
    }

    @Test fun refusesNoncanonicalScopesAndMalformedRulesDuringDecode() {
        for (rule in listOf("""{"source":"authorization","field":"enabled","equals":true}""",
            """{"field":"enabled","exists":"true"}""", """{"field":"quantity","gt":null}""",
            """{"all":[]}""", """{"field":"enabled","equals":true,"exists":true}""",
            """{"field":"quantity","contains":1}""", """{"field":"quantity","in":[]}""",
            """{"field":"quantity","ltField":1}""", """{"field":"quantity","gtField":""}""")) {
            assertFails { schema("""{"type":"object","invariants":[{"assert":$rule,"message":"Invalid"}]}""") }
        }
    }

    @Test fun onlyObjectSchemasCanOwnRulesAndNullOperandsSurviveRoundTrip() {
        val rule = """[{"assert":{"field":"value","equals":null},"message":"Explain."}]"""
        assertFails { schema("""{"type":"array","invariants":$rule}""") }
        assertFails { schema("""{"type":"object","properties":{"x":{"type":"string","invariants":$rule}}}""") }
        assertFails { schema("""{"type":"object","properties":{"x":{"type":"object","${'$'}ref":"named","invariants":$rule}}}""") }
        val saved = JsonUtil.json.encodeToString(ResourceSchemaDef.serializer(),
            schema("""{"type":"object","properties":{"value":{"nullable":true}},"invariants":$rule}"""))
        check(saved,mapOf("value" to null))
        assertFails { check(saved,emptyMap()) }
    }

    @Test fun anInvalidCommandSendsNothingAndAValidRetryUsesTheExistingWriter() = runBlocking {
        val scope = CoroutineScope(SupervisorJob()+Dispatchers.Unconfined)
        try {
            val runtime = ForgeRuntime(emptyMap(), scope)
            val payload = ResourcePayloadPreparationDef(modelRef="record",source=ResourceValueSourceDef(scope="form"))
            val model = ResourceModelDef(schemaRef="record",write=ResourceWriteBindingDef(dataSourceRef="writer",inputPath="record",mode="full"))
            val metadata = WindowMetadata(view=ViewDef(content=ContentDef()), dataSources=mapOf("draft" to DataSourceDef(autoFetch=false),"writer" to DataSourceDef(autoFetch=false)),
                schemas=mapOf("record" to schema(guarded)),resourceModels=mapOf("record" to model))
            val window = runtime.windowContext(runtime.openWindowInline("inventory","Inventory",metadata=metadata).windowId)
            val source = window.context("draft")
            val calls = mutableListOf<Map<String,Any?>>()
            runtime.registerDataSourceLoader { request -> calls += request.input.parameters; ForgeRuntime.DataSourceFetchResult() }
            val command = MutationCommandDef(commandId="save",dataSourceRef="writer",payload=payload)
            source.setForm(mapOf("enabled" to true,"quantity" to 15))
            val invalid = runtime.mutationCommands.execute(runtime,window,source,command)
            assertEquals("invalid_payload",invalid.status)
            assertEquals("$.quantity: Choose a quantity from 1 to 9 or provide a label.",invalid.error)
            assertTrue(calls.isEmpty())
            source.setForm(mapOf("enabled" to false,"quantity" to 7,"limit" to 4))
            val exceedsLimit = runtime.mutationCommands.execute(runtime,window,source,command)
            assertEquals("invalid_payload",exceedsLimit.status)
            assertEquals("$.quantity: Quantity exceeds the limit.",exceedsLimit.error)
            assertTrue(calls.isEmpty())
            source.setForm(mapOf("enabled" to false,"quantity" to 0,"limit" to 0))
            assertEquals("succeeded",runtime.mutationCommands.execute(runtime,window,source,command).status)
            assertEquals(JsonUtil.json.parseToJsonElement("""{"record":{"enabled":false,"quantity":0,"limit":0}}"""),JsonUtil.anyToElement(calls.single()))
        } finally { scope.cancel() }
    }
}

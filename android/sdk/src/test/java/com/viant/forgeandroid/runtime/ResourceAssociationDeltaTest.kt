package com.viant.forgeandroid.runtime

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.Assert.assertTrue

class ResourceAssociationDeltaTest {
    private val json = Json
    private val schemas = json.decodeFromString<Map<String, ResourceSchemaDef>>("""
        {
          "member":{"type":"object","identity":["id"],"properties":{
            "id":{"type":"integer"},"complete":{"type":"boolean","readOnly":true},
            "ids":{"type":"array","items":{"type":"integer"}}
          }},
          "group":{"type":"object","properties":{"rows":{"type":"array","items":{"$ref":"member"}}}},
          "operation":{"type":"object","identity":["id"],"properties":{
            "id":{"type":"integer"},
            "edits":{"type":"object","properties":{
              "added":{"type":"array","items":{"type":"string"}},
              "deleted":{"type":"array","items":{"type":"string"}}
            }}
          }}
        }
    """.trimIndent())
    private val models = json.decodeFromString<Map<String, ResourceModelDef>>("""
        {
          "member":{"schemaRef":"member","write":{"inputPath":"records","collection":true},"fields":{
            "id":{"write":"id"},
            "ids":{"associationDelta":{"mode":"diff","baselineComplete":"complete","added":"changes.add","deleted":"changes.delete"}}
          }},
          "group":{"schemaRef":"group","write":{"inputPath":"$"},"fields":{
            "rows":{"write":"rows","collection":{"modelRef":"member","mode":"merge"}}
          }},
          "operation":{"schemaRef":"operation","write":{"inputPath":"records","collection":true},"fields":{
            "id":{"write":"id"},
            "edits":{"associationDelta":{"mode":"explicit","added":"include","deleted":"exclude"}}
          }}
        }
    """.trimIndent())

    private fun parse(value: String) = JsonUtil.elementToAny(json.parseToJsonElement(value))
    private suspend fun project(draft: String, model: String, baseline: String? = null, mode: String? = null) =
        ResourceModelRuntime.marshal(parse(draft), baseline?.let(::parse), model, requestedMode = mode, schemas = schemas, models = models)

    @Test fun diffPairsReorderedRowsByIdentityAndOmitsUntouchedRows() = runBlocking {
        val result = project(
            """{"rows":[{"id":6,"ids":[15,16,16]},{"id":3,"ids":[9,12]}]}""",
            "group",
            """{"rows":[{"id":3,"complete":true,"ids":[4,9]},{"id":6,"complete":true,"ids":[8,15]},{"id":10,"complete":false,"ids":[7]}]}"""
        )
        val expected = """{"rows":[{"id":6,"changes":{"add":[16],"delete":[8]}},{"id":3,"changes":{"add":[12],"delete":[4]}},{"id":10}]}"""
        assertEquals(json.parseToJsonElement(expected), JsonUtil.anyToElement(result))
    }

    @Test fun diffDistinguishesOmittedAndEmptyAndRejectsIncompleteBaseline() = runBlocking {
        val prior = """{"id":1,"complete":true,"ids":[4,9,4]}"""
        val omitted = project("""{"id":1}""", "member", prior, "overlayBaseline")
        val empty = project("""{"id":1,"ids":[]}""", "member", prior)
        val same = project("""{"id":1,"ids":[9,4]}""", "member", prior)
        assertEquals(json.parseToJsonElement("""{"records":[{"id":1}]}"""), JsonUtil.anyToElement(omitted))
        assertEquals(omitted, same)
        assertEquals(json.parseToJsonElement("""{"records":[{"id":1,"changes":{"delete":[4,9]}}]}"""), JsonUtil.anyToElement(empty))
        assertTrue(runCatching { project("""{"id":1,"ids":[]}""", "member", """{"id":1,"complete":false,"ids":[4]}""") }.exceptionOrNull() is IllegalArgumentException)
        assertTrue(runCatching { project("""{"id":1,"ids":[9007199254740992]}""", "member", prior) }.exceptionOrNull() is IllegalArgumentException)
        Unit
    }

    @Test fun explicitNeedsNoBaselineAndIgnoresPriorIntent() = runBlocking {
        val expected = json.parseToJsonElement("""{"records":[{"id":1,"include":["x","z"]}]}""")
        val draft = """{"id":1,"edits":{"added":["x","z","x"]}}"""
        assertEquals(expected, JsonUtil.anyToElement(project(draft, "operation")))
        assertEquals(expected, JsonUtil.anyToElement(project(draft, "operation", """{"id":1,"edits":{"deleted":["y"]}}""", "overlayBaseline")))
        assertTrue(runCatching { project("""{"id":1,"edits":{"added":["x"],"deleted":["x"]}}""", "operation") }.exceptionOrNull() is IllegalArgumentException)
        Unit
    }
}

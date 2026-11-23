package com.viant.forgeandroid.runtime

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFails

class ResourceCollectionRemovalTest {
    @Test
    fun explicitRemovalUsesIdentityAndMarkerWithoutInferringOmissions() = runBlocking {
        val metadata = Json { ignoreUnknownKeys = true }.decodeFromString<WindowMetadata>(
            """
            {"schemas":{"root":{"type":"object","identity":["id"],"properties":{"id":{"type":"integer"},"rows":{"type":"array"}}},
                        "row":{"type":"object","identity":["id"],"properties":{"id":{"type":"integer","nullable":true},"label":{"type":"string"},"remove":{"type":"boolean"}}}},
             "resourceModels":{"root":{"schemaRef":"root","write":{"mode":"changed"},"fields":{"id":{"write":"id"},"rows":{"collection":{"modelRef":"row","deleteMarker":"remove"}}}},
                               "row":{"schemaRef":"row","fields":{"id":{"write":"Id"},"label":{"write":"Label"},"remove":{"write":"toBeDeleted"}}}}}
            """.trimIndent()
        )
        val left = mapOf("id" to 1, "label" to "Left")
        val right = mapOf("id" to 2, "label" to "Right")
        val baseline = mapOf("id" to 7, "rows" to listOf(left, right))
        suspend fun write(rows: List<Map<String, Any>>?) = ResourceModelRuntime.marshal(
            if (rows == null) mapOf("id" to 7) else mapOf("id" to 7, "rows" to rows),
            baseline, "root", schemas = metadata.schemas, models = metadata.resourceModels
        )
        assertEquals(mapOf("id" to 7), write(null))
        assertEquals(mapOf("id" to 7), write(listOf(right)))
        val change = listOf(mapOf("id" to 1, "remove" to true), right, mapOf("label" to "New"))
        val expected = listOf(mapOf("Id" to 1, "toBeDeleted" to true), mapOf("Label" to "New"))
        assertEquals(expected, write(change)["rows"])
        assertEquals(expected, write(change)["rows"])
        assertFails { write(listOf(mapOf("remove" to true))) }
        Unit

    }
}

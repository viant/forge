package com.viant.forgeandroid.runtime

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class ActionHookRuntimeTest {
    @Test
    fun invokeRunsPureCollectionHook() = runBlocking {
        val code = """
            (() => ({
              prepareCollection: (props = {}) => {
                const collection = props.collection || [];
                return collection.map((row) => ({
                  ...row,
                  applyStatus: String(row.apply_status ?? "").trim().toUpperCase()
                }));
              }
            }))()
        """.trimIndent()

        val result = ActionHookRuntime.invoke(
            code = code,
            functionName = "prepareCollection",
            props = buildJsonObject {
                put(
                    "collection",
                    JsonArray(
                        listOf(
                            JsonObject(
                                mapOf(
                                    "apply_status" to JsonPrimitive("approved"),
                                    "id" to JsonPrimitive(2)
                                )
                            )
                        )
                    )
                )
            }
        )

        assertTrue(result is JsonArray)
        val first = result.first() as JsonObject
        assertEquals(JsonPrimitive("APPROVED"), first["applyStatus"])
        assertEquals(JsonPrimitive(2), first["id"])
    }
}

package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals

class TargetingTest {
    @Test
    fun appliesBroadOverridesBeforeExactPlatformFormFactorOverrides() {
        val payload = Json.parseToJsonElement(
            """
            {
              "view": {
                "content": {
                  "layout": { "kind": "base" },
                  "containers": [{ "id": "base" }],
                  "targetOverrides": {
                    "app": {
                      "layout": { "surface": "app" }
                    },
                    "mobile": {
                      "layout": { "kind": "mobile" },
                      "containers": [{ "id": "mobileTabs" }]
                    },
                    "phone": {
                      "layout": { "density": "phone" }
                    },
                    "android": {
                      "layout": { "platform": "android" }
                    },
                    "android:phone": {
                      "layout": { "kind": "androidPhone" },
                      "containers": [{ "id": "androidPhoneTabs" }]
                    }
                  }
                }
              }
            }
            """.trimIndent()
        )

        val resolved = MetadataResolver.resolve(
            payload,
            ForgeTargetContext(platform = "android", formFactor = "phone", surface = "app")
        )!!.jsonObject
        val content = resolved["view"]!!.jsonObject["content"]!!.jsonObject
        val layout = content["layout"]!!.jsonObject
        val containers = content["containers"] as JsonArray

        assertEquals("androidPhone", layout["kind"]!!.jsonPrimitive.content)
        assertEquals("phone", layout["density"]!!.jsonPrimitive.content)
        assertEquals("app", layout["surface"]!!.jsonPrimitive.content)
        assertEquals("android", layout["platform"]!!.jsonPrimitive.content)
        assertEquals("androidPhoneTabs", containers.first().jsonObject["id"]!!.jsonPrimitive.content)
        assertEquals(null, content["targetOverrides"])
    }
}

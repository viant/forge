package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
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
                    },
                    "androidPhone": {
                      "layout": { "alias": "androidPhone" }
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
        assertEquals("androidPhone", layout["alias"]!!.jsonPrimitive.content)
        assertEquals("androidPhoneTabs", containers.first().jsonObject["id"]!!.jsonPrimitive.content)
        assertEquals(null, content["targetOverrides"])
    }

    @Test
    fun leavesWebDesktopOnBaseWhenOnlyMobileOverridesExist() {
        val payload = Json.parseToJsonElement(
            """
            {
              "view": {
                "content": {
                  "id": "builder",
                  "title": "Base",
                  "layout": { "mode": "desktop" },
                  "targetOverrides": {
                    "mobile": {
                      "title": "Mobile",
                      "layout": { "mode": "mobile" }
                    },
                    "phone": {
                      "layout": { "density": "phone" }
                    },
                    "tablet": {
                      "layout": { "density": "tablet" }
                    },
                    "android:phone": {
                      "title": "Android Phone"
                    }
                  }
                }
              }
            }
            """.trimIndent()
        )

        val resolved = MetadataResolver.resolve(
            payload,
            ForgeTargetContext(platform = "web", formFactor = "desktop", surface = "browser")
        )!!.jsonObject["view"]!!.jsonObject["content"]!!.jsonObject
        val layout = resolved["layout"]!!.jsonObject

        assertEquals("Base", resolved["title"]!!.jsonPrimitive.content)
        assertEquals("desktop", layout["mode"]!!.jsonPrimitive.content)
        assertEquals(null, layout["density"])
        assertEquals(null, resolved["targetOverrides"])
    }

    @Test
    fun appliesNestedReportBuilderOverridesForPhoneAndTabletTargets() {
        val payload = Json.parseToJsonElement(
            """
            {
              "view": {
                "content": {
                  "kind": "dashboard.reportBuilder",
                  "id": "builder",
                  "reportBuilder": {
                    "filterPresentation": "rail-left",
                    "unifiedFamilyRows": false
                  },
                  "targetOverrides": {
                    "mobile": {
                      "reportBuilder": {
                        "filterPresentation": "drawer-left"
                      }
                    },
                    "phone": {
                      "reportBuilder": {
                        "unifiedFamilyRows": true
                      }
                    },
                    "tablet": {
                      "reportBuilder": {
                        "filterPresentation": "rail-left"
                      }
                    },
                    "androidTablet": {
                      "reportBuilder": {
                        "unifiedFamilyRows": true
                      }
                    }
                  }
                }
              }
            }
            """.trimIndent()
        )

        val phone = MetadataResolver.resolve(
            payload,
            ForgeTargetContext(platform = "android", formFactor = "phone", surface = "app")
        )!!.jsonObject["view"]!!.jsonObject["content"]!!.jsonObject
        val phoneBuilder = phone["reportBuilder"]!!.jsonObject
        assertEquals("drawer-left", phoneBuilder["filterPresentation"]!!.jsonPrimitive.content)
        assertEquals(true, phoneBuilder["unifiedFamilyRows"]!!.jsonPrimitive.boolean)
        assertEquals(null, phone["targetOverrides"])

        val tablet = MetadataResolver.resolve(
            payload,
            ForgeTargetContext(platform = "android", formFactor = "tablet", surface = "app")
        )!!.jsonObject["view"]!!.jsonObject["content"]!!.jsonObject
        val tabletBuilder = tablet["reportBuilder"]!!.jsonObject
        assertEquals("rail-left", tabletBuilder["filterPresentation"]!!.jsonPrimitive.content)
        assertEquals(true, tabletBuilder["unifiedFamilyRows"]!!.jsonPrimitive.boolean)
        assertEquals(null, tablet["targetOverrides"])
    }

    @Test
    fun treatsFoldableFormFactorAsMobileForBroadOverrides() {
        val payload = Json.parseToJsonElement(
            """
            {
              "view": {
                "content": {
                  "layout": { "kind": "base" },
                  "targetOverrides": {
                    "mobile": {
                      "layout": { "kind": "mobile" }
                    },
                    "foldable": {
                      "layout": { "density": "foldable" }
                    },
                    "mobile:foldable": {
                      "layout": { "mode": "hingeAware" }
                    }
                  }
                }
              }
            }
            """.trimIndent()
        )

        val resolved = MetadataResolver.resolve(
            payload,
            ForgeTargetContext(platform = "", formFactor = "foldable")
        )!!.jsonObject["view"]!!.jsonObject["content"]!!.jsonObject
        val layout = resolved["layout"]!!.jsonObject

        assertEquals("mobile", layout["kind"]!!.jsonPrimitive.content)
        assertEquals("foldable", layout["density"]!!.jsonPrimitive.content)
        assertEquals("hingeAware", layout["mode"]!!.jsonPrimitive.content)
    }

    @Test
    fun trimsTargetSpecsAndContextBeforeMatching() {
        val payload = Json.parseToJsonElement(
            """
            {
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "normalized",
                      "target": {
                        "platforms": [" android "],
                        "formFactors": [" phone "],
                        "capabilities": [" lookup "]
                      }
                    },
                    {
                      "id": "excluded",
                      "target": {
                        "excludePlatforms": [" android "]
                      }
                    }
                  ]
                }
              }
            }
            """.trimIndent()
        )

        val resolved = MetadataResolver.resolve(
            payload,
            ForgeTargetContext(
                platform = " android ",
                formFactor = " phone ",
                surface = " app ",
                capabilities = setOf(" lookup ")
            )
        )!!.jsonObject
        val containers = resolved["view"]!!.jsonObject["content"]!!.jsonObject["containers"] as JsonArray

        assertEquals(listOf("normalized"), containers.map { it.jsonObject["id"]!!.jsonPrimitive.content })
    }
}

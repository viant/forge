package com.viant.forgeandroid.runtime

import com.dokar.quickjs.QuickJs
import com.dokar.quickjs.evaluate
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking

class ActionHookRuntimeTest {
    @BeforeTest
    fun installJvmEvaluator() {
        ActionHookRuntime.testScriptEvaluator = { script ->
            val quickJs = QuickJs.create(Dispatchers.Default)
            try {
                quickJs.evaluate<String>(script)
            } finally {
                quickJs.close()
            }
        }
    }

    @AfterTest
    fun clearJvmEvaluator() {
        ActionHookRuntime.testScriptEvaluator = null
    }

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

    @Test
    fun invokeResolvesNestedFunctionPath() = runBlocking {
        val code = """
            (() => ({
              Analytics: {
                reportBuilderHooks: {
                  resolveLookup: (props = {}) => ({
                    dialogId: "targetingTreePicker",
                    multiple: props.filterDef?.multiple === true
                  })
                }
              }
            }))()
        """.trimIndent()

        val result = ActionHookRuntime.invoke(
            code = code,
            functionName = "Analytics.reportBuilderHooks.resolveLookup",
            props = buildJsonObject {
                put(
                    "filterDef",
                    JsonObject(
                        mapOf(
                            "multiple" to JsonPrimitive(true)
                        )
                    )
                )
            }
        ) as? JsonObject

        assertEquals(JsonPrimitive("targetingTreePicker"), result?.get("dialogId"))
        assertEquals(JsonPrimitive(true), result?.get("multiple"))
    }

    @Test
    fun windowMetadataDecodesPluralDataSourcesAlias() {
        val metadata = Json { ignoreUnknownKeys = true }.decodeFromString(
            WindowMetadata.serializer(),
            """
            {
              "dataSources": {
                "report": {
                  "selectionMode": "single"
                }
              }
            }
            """.trimIndent()
        )

        assertEquals("single", metadata.dataSources["report"]?.selectionMode)
    }

    @Test
    fun openWindowUsesRegisteredMetadataLoader() = runBlocking {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        runtime.registerWindowMetadataLoader { key ->
            assertEquals("reportWindow", key)
            WindowMetadata(
                view = ViewDef(
                    content = ContentDef(
                        containers = listOf(ContainerDef(id = "reportRoot"))
                    )
                )
            )
        }

        val state = runtime.openWindow("reportWindow", "Report Review")
        delay(50)
        val metadata = runtime.metadataSignal(state.windowId).peek()

        assertEquals("reportRoot", metadata?.view?.content?.containers?.firstOrNull()?.id)
    }

    @Test
    fun metadataResolverPreservesDatasourceNamedTarget() {
        val metadata = WindowMetadata(
            dataSources = mapOf(
                "target" to DataSourceDef(),
                "dialogSource" to DataSourceDef(selectionMode = "multi")
            )
        )

        val resolved = MetadataResolver.resolve(
            JsonUtil.json.encodeToJsonElement(WindowMetadata.serializer(), metadata),
            ForgeTargetContext(platform = "android")
        )
        val decoded = JsonUtil.json.decodeFromJsonElement(WindowMetadata.serializer(), resolved!!)

        assertTrue(decoded.dataSources.containsKey("target"))
        assertEquals("multi", decoded.dataSources["dialogSource"]?.selectionMode)
    }

    @Test
    fun reportBuilderHooksDecode() {
        val metadata = Json { ignoreUnknownKeys = true }.decodeFromString(
            WindowMetadata.serializer(),
            """
            {
              "view": {
                "content": {
                  "containers": [
                    {
                      "kind": "dashboard.reportBuilder",
                      "dashboard": {
                        "reportBuilder": {
                          "hooks": {
                            "initializeState": "Analytics.reportBuilderHooks.initializeState",
                            "buildRequest": "Analytics.reportBuilderHooks.buildRequest",
                            "resolveLookup": "Analytics.reportBuilderHooks.resolveLookup"
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
            """.trimIndent()
        )

        val hooks = metadata.view?.content?.containers?.firstOrNull()?.dashboard?.reportBuilder?.hooks
        assertEquals("Analytics.reportBuilderHooks.initializeState", hooks?.initializeState)
        assertEquals("Analytics.reportBuilderHooks.buildRequest", hooks?.buildRequest)
        assertEquals("Analytics.reportBuilderHooks.resolveLookup", hooks?.resolveLookup)
    }

    @Test
    fun lookupReportBuilderDescriptorUsesHookAndNamespace() {
        val metadata = WindowMetadata(
            namespace = "Analytics",
            dialogs = listOf(
                DialogDef(id = "targetingTreePicker", title = "Select Targeting Option")
            ),
            actions = ActionsDef(
                code = """
                    (() => ({
                      Analytics: {
                        reportBuilderHooks: {
                          resolveLookup: (props = {}) => ({
                            dialogId: "targetingTreePicker",
                            parameters: {
                              Field: "SITE_TYPE"
                            },
                            multiple: props.filterDef?.multiple === true
                          })
                        }
                      }
                    }))()
                """.trimIndent()
            )
        )
        val config = DashboardReportBuilderDef(
            hooks = ReportBuilderHooksDef(
                resolveLookup = "reportBuilderHooks.resolveLookup"
            )
        )
        val filter = ReportBuilderDynamicFilterDef(
            id = "includeSiteType",
            label = "Site Type",
            multiple = true
        )

        val descriptor = lookupReportBuilderDescriptor(
            metadata = metadata,
            config = config,
            hookState = mapOf("dynamicGroups" to emptyMap<String, Any?>()),
            groupId = "include",
            filter = filter
        )

        assertEquals("targetingTreePicker", descriptor?.dialogId)
        assertEquals("multi", descriptor?.selectionMode)
        assertEquals("SITE_TYPE", descriptor?.parameters?.get("Field"))
    }

    @Test
    fun windowMetadataDecodesTreeBrowserDialogContent() {
        val metadata = Json { ignoreUnknownKeys = true }.decodeFromString(
            WindowMetadata.serializer(),
            """
            {
              "dialogs": [
                {
                  "id": "targetingTreePicker",
                  "title": "Select Targeting Option",
                  "dataSourceRef": "targeting_tree_lookup",
                  "content": {
                    "id": "targetingTreePickerContent",
                    "dataSourceRef": "targeting_tree_lookup",
                    "treeBrowser": {
                      "dataSourceRef": "targeting_tree_lookup",
                      "pathField": "path",
                      "valueField": "value",
                      "subtitleField": "value",
                      "lazyExpand": false,
                      "target": { "kind": "dialog" },
                      "targetOverrides": {
                        "android:phone": { "title": "Choose" }
                      }
                    }
                  },
                  "properties": {
                    "quickFilters": [
                      {
                        "field": "Body.treeLookupParam.filter.filter",
                        "placeholder": "Search targeting options"
                      }
                    ]
                  }
                }
              ]
            }
            """.trimIndent()
        )

        val dialog = metadata.dialogs.first()
        assertEquals("targetingTreePicker", dialog.id)
        assertEquals("targeting_tree_lookup", dialog.dataSourceRef)
        assertEquals("targeting_tree_lookup", dialog.content?.treeBrowser?.dataSourceRef)
        assertEquals("path", dialog.content?.treeBrowser?.pathField)
        assertEquals("value", dialog.content?.treeBrowser?.valueField)
        assertEquals(false, dialog.content?.treeBrowser?.lazyExpand)
        assertEquals("dialog", dialog.content?.treeBrowser?.target?.jsonObject?.get("kind")?.jsonPrimitive?.contentOrNull)
        assertEquals(
            "Choose",
            dialog.content?.treeBrowser?.targetOverrides?.get("android:phone")?.jsonObject?.get("title")?.jsonPrimitive?.contentOrNull
        )
        assertTrue(dialog.properties.containsKey("quickFilters"))
    }
}

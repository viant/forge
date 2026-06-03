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
import kotlinx.serialization.json.Json
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking

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

    @Test
    fun invokeResolvesNestedFunctionPath() = runBlocking {
        val code = """
            (() => ({
              Forecasting: {
                stewardForecastingBuilder: {
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
            functionName = "Forecasting.stewardForecastingBuilder.resolveLookup",
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
                "recommendation": {
                  "selectionMode": "single"
                }
              }
            }
            """.trimIndent()
        )

        assertEquals("single", metadata.dataSources["recommendation"]?.selectionMode)
    }

    @Test
    fun openWindowUsesRegisteredMetadataLoader() = runBlocking {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        runtime.registerWindowMetadataLoader { key ->
            assertEquals("recommendationList", key)
            WindowMetadata(
                view = ViewDef(
                    content = ContentDef(
                        containers = listOf(ContainerDef(id = "recommendationRoot"))
                    )
                )
            )
        }

        val state = runtime.openWindow("recommendationList", "Recommendation Review")
        delay(50)
        val metadata = runtime.metadataSignal(state.windowId).peek()

        assertEquals("recommendationRoot", metadata?.view?.content?.containers?.firstOrNull()?.id)
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
                            "initializeState": "Forecasting.stewardForecastingBuilder.initializeState",
                            "buildRequest": "Forecasting.stewardForecastingBuilder.buildRequest",
                            "resolveLookup": "Forecasting.stewardForecastingBuilder.resolveLookup"
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
        assertEquals("Forecasting.stewardForecastingBuilder.initializeState", hooks?.initializeState)
        assertEquals("Forecasting.stewardForecastingBuilder.buildRequest", hooks?.buildRequest)
        assertEquals("Forecasting.stewardForecastingBuilder.resolveLookup", hooks?.resolveLookup)
    }

    @Test
    fun lookupReportBuilderDescriptorUsesHookAndNamespace() {
        val metadata = WindowMetadata(
            namespace = "Forecasting",
            dialogs = listOf(
                DialogDef(id = "targetingTreePicker", title = "Select Targeting Option")
            ),
            actions = ActionsDef(
                code = """
                    (() => ({
                      Forecasting: {
                        stewardForecastingBuilder: {
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
                resolveLookup = "stewardForecastingBuilder.resolveLookup"
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
                      "lazyExpand": false
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
        assertTrue(dialog.properties.containsKey("quickFilters"))
    }
}

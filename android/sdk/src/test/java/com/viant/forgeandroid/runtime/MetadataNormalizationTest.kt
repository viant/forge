package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull

class MetadataNormalizationTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `normalizeWindowMetadataJson wraps top level content container`() {
        val raw = json.parseToJsonElement(
            """
            {
              "namespace": "Analytics",
              "view": {
                "content": {
                  "id": "reportBuilderRoot",
                  "kind": "dashboard.reportBuilder",
                  "title": "Analytics builder"
                }
              }
            }
            """.trimIndent()
        )

        val normalized = normalizeWindowMetadataJson(raw)
        val decoded = json.decodeFromJsonElement(WindowMetadata.serializer(), normalized)

        assertNotNull(decoded.view)
        assertEquals(1, decoded.view?.content?.containers?.size)
        assertEquals("dashboard.reportBuilder", decoded.view?.content?.containers?.first()?.kind)
        assertEquals("Analytics builder", decoded.view?.content?.containers?.first()?.title)
    }

    @Test
    fun `normalizeWindowMetadataJson wraps direct top level report builder container`() {
        val raw = json.parseToJsonElement(
            """
            {
              "namespace": "Analytics",
              "kind": "dashboard.reportBuilder",
              "id": "analyticsCubeBuilder",
              "title": "Analytics",
              "dataSourceRef": "analytics_cube_report",
              "reportBuilder": {
                "unifiedFamilyRows": true,
                "showResultHeader": false
              }
            }
            """.trimIndent()
        )

        val normalized = normalizeWindowMetadataJson(raw)
        val decoded = json.decodeFromJsonElement(WindowMetadata.serializer(), normalized)
        val root = decoded.view?.content?.containers?.first()

        assertEquals("dashboard.reportBuilder", root?.kind)
        assertEquals("analyticsCubeBuilder", root?.id)
        assertEquals("analytics_cube_report", root?.dataSourceRef)
        assertEquals(true, root?.dashboard?.reportBuilder?.unifiedFamilyRows)
        assertEquals(false, root?.dashboard?.reportBuilder?.showResultHeader)
    }

    @Test
    fun `normalizeWindowMetadataJson wraps top level file browser container`() {
        val raw = json.parseToJsonElement(
            """
            {
              "namespace": "Workspace",
              "view": {
                "content": {
                  "kind": "workspace.files",
                  "id": "fileBrowserRoot",
                  "dataSourceRef": "workspace_files",
                  "fileBrowser": {
                    "title": "Workspace files",
                    "dataSourceRef": "workspace_files_nested",
                    "folderOnly": true,
                    "on": [
                      { "handler": "workspace.open", "args": ["row", "uri"] }
                    ],
                    "targetOverrides": {
                      "android:phone": {
                        "title": "Files"
                      }
                    }
                  }
                }
              }
            }
            """.trimIndent()
        )

        val normalized = normalizeWindowMetadataJson(raw)
        val decoded = json.decodeFromJsonElement(WindowMetadata.serializer(), normalized)
        val root = decoded.view?.content?.containers?.firstOrNull()

        assertEquals("fileBrowserRoot", root?.id)
        assertEquals("workspace_files", root?.dataSourceRef)
        assertEquals("Workspace files", root?.fileBrowser?.title)
        assertEquals("workspace_files_nested", root?.fileBrowser?.dataSourceRef)
        assertEquals(true, root?.fileBrowser?.folderOnly)
        assertEquals("workspace.open", root?.fileBrowser?.on?.firstOrNull()?.handler)
        assertEquals("Files", root?.fileBrowser?.targetOverrides?.get("android:phone")?.jsonObject?.get("title")?.jsonPrimitive?.contentOrNull)
    }

    @Test
    fun `normalizeWindowMetadataJson synthesizes dashboard blocks inside nested containers`() {
        val raw = json.parseToJsonElement(
            """
            {
              "namespace": "Analytics",
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "dashboardRoot",
                      "kind": "dashboard",
                      "containers": [
                        {
                          "id": "summary",
                          "kind": "dashboard.summary",
                          "summary": {
                            "metrics": [
                              { "id": "spend", "label": "Spend", "selector": "spend" }
                            ]
                          }
                        },
                        {
                          "id": "analyticsCubeBuilder",
                          "kind": "dashboard.reportBuilder",
                          "dataSourceRef": "analytics_cube_report",
                          "reportBuilder": {
                            "result": { "defaultMode": "table" }
                          }
                        }
                      ]
                    }
                  ]
                }
              }
            }
            """.trimIndent()
        )

        val normalized = normalizeWindowMetadataJson(raw)
        val decoded = json.decodeFromJsonElement(WindowMetadata.serializer(), normalized)
        val children = decoded.view?.content?.containers?.first()?.containers.orEmpty()
        val summary = children.firstOrNull { it.id == "summary" }
        val builder = children.firstOrNull { it.id == "analyticsCubeBuilder" }

        assertEquals(1, summary?.dashboard?.summary?.metrics?.size)
        assertEquals("table", builder?.dashboard?.reportBuilder?.result?.defaultMode)
    }

    @Test
    fun `normalizeWindowMetadataJson preserves analytics report builder shape`() {
        val raw = json.parseToJsonElement(
            """
            {
              "namespace": "Analytics",
              "dataSource": {
                "analytics_cube_report": {
                  "service": { "endpoint": "workspaceAPI", "uri": "/v1/api/datasources/analytics_cube_report/fetch", "method": "POST" }
                }
              },
              "view": {
                "content": {
                  "id": "reportBuilderRoot",
                  "kind": "dashboard.reportBuilder",
                  "title": "Analytics",
                  "subtitle": "Build a normalized analytics stack and review live inventory outputs.",
                  "dataSourceRef": "analytics_cube_report",
                  "dashboard": {
                    "reportBuilder": {
                      "measures": [],
                      "dimensions": [],
                      "staticFilters": [],
                      "unifiedFamilyRows": true,
                      "dynamicFilterGroups": [],
                      "result": {
                        "chartDataMode": "fullQuery",
                        "chartRowLimit": 2500,
                        "chartDataLimit": 1000
                      }
                    }
                  }
                }
              }
            }
            """.trimIndent()
        )

        val normalized = normalizeWindowMetadataJson(raw)
        val decoded = json.decodeFromJsonElement(WindowMetadata.serializer(), normalized)

        assertEquals(1, decoded.view?.content?.containers?.size)
        assertEquals("analytics_cube_report", decoded.view?.content?.containers?.first()?.dataSourceRef)
        assertEquals(true, decoded.view?.content?.containers?.first()?.dashboard?.reportBuilder != null)
        assertEquals(true, decoded.view?.content?.containers?.first()?.dashboard?.reportBuilder?.unifiedFamilyRows)
        assertEquals("fullQuery", decoded.view?.content?.containers?.first()?.dashboard?.reportBuilder?.result?.chartDataMode)
        assertEquals(2500, decoded.view?.content?.containers?.first()?.dashboard?.reportBuilder?.result?.chartRowLimit)
        assertEquals(1000, decoded.view?.content?.containers?.first()?.dashboard?.reportBuilder?.result?.chartDataLimit)
        assertEquals(true, decoded.dataSources.containsKey("analytics_cube_report"))
    }

    @Test
    fun `normalizeWindowMetadataJson decodes latest report builder fields`() {
        val raw = json.parseToJsonElement(
            """
            {
              "namespace": "Capacity",
              "view": {
                "content": {
                  "kind": "dashboard.reportBuilder",
                  "id": "capacityCubeBuilder",
                  "dataSourceRef": "capacity_cube_report",
                  "reportBuilder": {
                    "filterPresentation": "rail",
                    "showFilterCategoryBar": true,
                    "hiddenDynamicGroupIds": ["scope"],
                    "notices": [
                      { "id": "sample", "level": "info", "title": "Sample", "sourcePath": "metadata.notice" }
                    ],
                    "primaryMeasure": "avails",
                    "measureSections": [
                      { "id": "delivery", "label": "Delivery" }
                    ],
                    "measures": [
                      { "id": "avails", "key": "avails", "label": "Avails", "section": "delivery", "paramPath": "measures.avails" },
                      { "id": "bids", "key": "bids", "label": "Bids", "paramPath": "measures.bids" }
                    ],
                    "computedMeasures": [
                      {
                        "id": "bidRate",
                        "key": "bidRate",
                        "label": "Bid Rate",
                        "dependencies": ["bids", "avails"],
                        "compute": { "type": "ratio", "numerator": "bids", "denominator": "avails", "scale": 100, "decimals": 1 }
                      }
                    ],
                    "dimensions": [
                      {
                        "id": "channel",
                        "key": "channelId",
                        "displayKey": "channelName",
                        "runtimeFilter": {
                          "includeParamPath": "filters.includeChannelIds",
                          "excludeParamPath": "filters.excludeChannelIds",
                          "format": "number"
                        }
                      }
                    ],
                    "dynamicFilterFamilies": [
                      { "id": "inventory", "label": "Inventory", "icon": "layers" }
                    ],
                    "resultCategories": ["inventory", "location"],
                    "groupBy": {
                      "default": "date",
                      "options": [
                        { "id": "date", "label": "Date", "dimensionId": "eventDate", "paramPath": "groupBy", "paramValue": "date" }
                      ]
                    }
                  }
                }
              }
            }
            """.trimIndent()
        )

        val normalized = normalizeWindowMetadataJson(raw)
        val decoded = json.decodeFromJsonElement(WindowMetadata.serializer(), normalized)
        val builder = decoded.view?.content?.containers?.firstOrNull()?.dashboard?.reportBuilder

        assertEquals("rail", builder?.filterPresentation)
        assertEquals(true, builder?.showFilterCategoryBar)
        assertEquals(listOf("scope"), builder?.hiddenDynamicGroupIds)
        assertEquals("metadata.notice", builder?.notices?.firstOrNull()?.sourcePath)
        assertEquals("avails", builder?.primaryMeasure)
        assertEquals("delivery", builder?.measureSections?.firstOrNull()?.id)
        assertEquals(listOf("bids", "avails"), builder?.computedMeasures?.firstOrNull()?.dependencies)
        assertEquals("ratio", builder?.computedMeasures?.firstOrNull()?.compute?.type)
        assertEquals(100.0, builder?.computedMeasures?.firstOrNull()?.compute?.scale)
        assertEquals("channelName", builder?.dimensions?.firstOrNull()?.displayKey)
        assertEquals("filters.includeChannelIds", builder?.dimensions?.firstOrNull()?.runtimeFilter?.includeParamPath)
        assertEquals("layers", builder?.dynamicFilterFamilies?.firstOrNull()?.icon)
        assertEquals(listOf("inventory", "location"), builder?.resultCategories)
        assertEquals("date", builder?.groupBy?.defaultValue)
        assertEquals("date", builder?.groupBy?.options?.firstOrNull()?.paramValue?.jsonPrimitive?.content)
    }

    @Test
    fun `normalizeWindowMetadataJson decodes legacy forecast categories`() {
        val raw = json.parseToJsonElement(
            """
            {
              "view": {
                "content": {
                  "kind": "dashboard.reportBuilder",
                  "id": "capacityCubeBuilder",
                  "reportBuilder": {
                    "forecastCategories": ["inventory", "location"]
                  }
                }
              }
            }
            """.trimIndent()
        )

        val normalized = normalizeWindowMetadataJson(raw)
        val decoded = json.decodeFromJsonElement(WindowMetadata.serializer(), normalized)
        val builder = decoded.view?.content?.containers?.firstOrNull()?.dashboard?.reportBuilder

        assertEquals(listOf("inventory", "location"), builder?.resultCategories)
    }

    @Test
    fun `normalizeWindowMetadataJson decodes compact dashboard compatibility blocks`() {
        val raw = json.parseToJsonElement(
            """
            {
              "namespace": "Dashboard",
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "dashboardRoot",
                      "kind": "dashboard",
                      "containers": [
                        {
                          "id": "table",
                          "kind": "dashboard.table",
                          "dataSourceRef": "summary_rows",
                          "columns": ["lineId", "status"]
                        },
                        {
                          "id": "composition",
                          "kind": "dashboard.composition",
                          "dataSourceRef": "summary_rows",
                          "chart": {
                            "type": "donut",
                            "categoryKey": "channel",
                            "valueField": "avails"
                          }
                        },
                        {
                          "id": "badges",
                          "kind": "dashboard.badges",
                          "badges": {
                            "items": [
                              { "id": "limited", "label": "Limited", "value": "2", "tone": "warning" }
                            ]
                          }
                        },
                        {
                          "id": "period",
                          "kind": "dashboard.filters",
                          "items": [
                            {
                              "id": "periodView",
                              "label": "Period",
                              "field": "periodView",
                              "options": [
                                { "label": "7D", "value": "7d", "default": true },
                                { "label": "30D", "value": "30d" }
                              ]
                            }
                          ]
                        },
                        {
                          "id": "geo",
                          "kind": "dashboard.geoMap",
                          "geo": { "shape": "us-postal-code" },
                          "metric": { "key": "avails", "label": "Avails", "format": "compact" }
                        }
                      ]
                    }
                  ]
                }
              }
            }
            """.trimIndent()
        )

        val normalized = normalizeWindowMetadataJson(raw)
        val decoded = json.decodeFromJsonElement(WindowMetadata.serializer(), normalized)
        val children = decoded.view?.content?.containers?.firstOrNull()?.containers.orEmpty()
        val table = children.firstOrNull { it.id == "table" }
        val composition = children.firstOrNull { it.id == "composition" }
        val badges = children.firstOrNull { it.id == "badges" }
        val filters = children.firstOrNull { it.id == "period" }
        val geo = children.firstOrNull { it.id == "geo" }

        assertEquals(listOf("lineId", "status"), table?.columns?.map { it.id })
        assertEquals("channel", composition?.chart?.xAxis?.dataKey)
        assertEquals("avails", composition?.chart?.series?.valueKey)
        assertEquals("channel", composition?.chart?.series?.nameKey)
        assertEquals("warning", badges?.dashboard?.badges?.items?.firstOrNull()?.tone)
        assertEquals("periodView", filters?.dashboard?.filters?.items?.firstOrNull()?.field)
        assertEquals(true, filters?.dashboard?.filters?.items?.firstOrNull()?.options?.firstOrNull()?.default)
        assertEquals("us-postal-code", geo?.geo?.jsonObject?.get("shape")?.jsonPrimitive?.content)
        assertEquals("avails", geo?.metric?.key)
    }

    @Test
    fun `normalizeWindowMetadataJson decodes chart dimensions when width is css string`() {
        val raw = json.parseToJsonElement(
            """
            {
              "namespace": "Chart Overview",
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "trendChart",
                      "kind": "chart",
                      "chart": {
                        "title": "Trend",
                        "dataSourceRef": "trend_rows",
                        "type": "line",
                        "width": "100%",
                        "height": "420",
                        "xAxis": { "dataKey": "date" },
                        "series": {
                          "values": [
                            { "name": "Primary", "value": "primary" },
                            { "name": "Secondary", "value": "secondary" }
                          ]
                        }
                      }
                    }
                  ]
                }
              }
            }
            """.trimIndent()
        )

        val normalized = normalizeWindowMetadataJson(raw)
        val decoded = json.decodeFromJsonElement(WindowMetadata.serializer(), normalized)
        val chart = decoded.view?.content?.containers?.firstOrNull()?.chart

        assertNotNull(chart)
        assertEquals("Trend", chart.title)
        assertEquals("trend_rows", chart.dataSourceRef)
        assertEquals("100%", chart.width?.jsonPrimitive?.content)
        assertEquals("420", chart.height?.jsonPrimitive?.content)
    }

    @Test
    fun `normalizeWindowMetadataJson preserves top level split content layout`() {
        val raw = json.parseToJsonElement(
            """
            {
              "namespace": "Workspace Overview",
              "view": {
                "content": {
                  "id": "workspaceRoot",
                  "layout": {
                    "kind": "split",
                    "orientation": "horizontal",
                    "columns": 2
                  },
                  "containers": [
                    { "id": "primaryPane", "title": "Primary Metrics" },
                    { "id": "detailPane", "title": "Details" }
                  ]
                }
              }
            }
            """.trimIndent()
        )

        val normalized = normalizeWindowMetadataJson(raw)
        val decoded = json.decodeFromJsonElement(WindowMetadata.serializer(), normalized)

        assertEquals("workspaceRoot", decoded.view?.content?.id)
        assertEquals("split", decoded.view?.content?.layout?.kind)
        assertEquals("horizontal", decoded.view?.content?.layout?.orientation)
        assertEquals(2, decoded.view?.content?.layout?.columns)
        assertEquals(listOf("primaryPane", "detailPane"), decoded.view?.content?.containers?.map { it.id })
    }

    @Test
    fun `normalizeWindowMetadataJson decodes nested grid layout and column spans`() {
        val raw = json.parseToJsonElement(
            """
            {
              "namespace": "Workspace Overview",
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "detailPane",
                      "layout": {
                        "kind": "grid",
                        "columns": 41,
                        "gap": "12px",
                        "rowGap": "12px"
                      },
                      "containers": [
                        { "id": "statusSummary", "title": "Status", "columnSpan": 14 },
                        { "id": "activitySummary", "title": "Activity", "columnSpan": 14 },
                        { "id": "coverageSummary", "title": "Coverage", "columnSpan": 13 }
                      ]
                    }
                  ]
                }
              }
            }
            """.trimIndent()
        )

        val normalized = normalizeWindowMetadataJson(raw)
        val decoded = json.decodeFromJsonElement(WindowMetadata.serializer(), normalized)
        val detailPane = decoded.view?.content?.containers?.firstOrNull()

        assertNotNull(detailPane)
        assertEquals("grid", detailPane.layout?.kind)
        assertEquals(41, detailPane.layout?.columns)
        assertEquals("12px", detailPane.layout?.gap)
        assertEquals("12px", detailPane.layout?.rowGap)
        assertEquals(listOf(14, 14, 13), detailPane.containers.map { it.columnSpan })
    }

    @Test
    fun `normalizeWindowMetadataJson rejects container dataSource alias`() {
        val raw = json.parseToJsonElement(
            """
            {
              "namespace": "Invalid",
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "badTable",
                      "kind": "dashboard.table",
                      "dataSource": "orders"
                    }
                  ]
                }
              }
            }
            """.trimIndent()
        )

        val failure = assertFailsWith<IllegalArgumentException> {
            normalizeWindowMetadataJson(raw)
        }

        assertEquals(
            "$.view.content.containers[0].dataSource is not supported on Forge containers; use dataSourceRef",
            failure.message
        )
    }

    @Test
    fun `normalizeWindowMetadataJson rejects nested container dataSource alias`() {
        val raw = json.parseToJsonElement(
            """
            {
              "namespace": "Invalid",
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "root",
                      "kind": "dashboard",
                      "containers": [
                        {
                          "id": "badTable",
                          "kind": "dashboard.table",
                          "dataSource": "orders"
                        }
                      ]
                    }
                  ]
                }
              }
            }
            """.trimIndent()
        )

        val failure = assertFailsWith<IllegalArgumentException> {
            normalizeWindowMetadataJson(raw)
        }

        assertEquals(
            "$.view.content.containers[0].containers[0].dataSource is not supported on Forge containers; use dataSourceRef",
            failure.message
        )
    }

    @Test
    fun `normalizeWindowMetadataJson rejects dialog dataSource alias`() {
        val raw = json.parseToJsonElement(
            """
            {
              "namespace": "Invalid",
              "dialogs": [
                {
                  "id": "pick",
                  "title": "Pick",
                  "dataSource": "accounts"
                }
              ],
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "root",
                      "title": "Root"
                    }
                  ]
                }
              }
            }
            """.trimIndent()
        )

        val failure = assertFailsWith<IllegalArgumentException> {
            normalizeWindowMetadataJson(raw)
        }

        assertEquals(
            "$.dialogs[0].dataSource is not supported on Forge dialogs; use dataSourceRef",
            failure.message
        )
    }

    @Test
    fun `normalizeWindowMetadataJson rejects dialog content dataSource alias`() {
        val raw = json.parseToJsonElement(
            """
            {
              "namespace": "Invalid",
              "dialogs": [
                {
                  "id": "pick",
                  "title": "Pick",
                  "content": {
                    "id": "badContent",
                    "kind": "dashboard.table",
                    "dataSource": "accounts"
                  }
                }
              ],
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "root",
                      "title": "Root"
                    }
                  ]
                }
              }
            }
            """.trimIndent()
        )

        val failure = assertFailsWith<IllegalArgumentException> {
            normalizeWindowMetadataJson(raw)
        }

        assertEquals(
            "$.dialogs[0].content.dataSource is not supported on Forge containers; use dataSourceRef",
            failure.message
        )
    }

    @Test
    fun `normalizeWindowMetadataJson preserves top level legacy dataSource map`() {
        val raw = json.parseToJsonElement(
            """
            {
              "namespace": "Valid",
              "dataSource": {
                "orders": {
                  "selectionMode": "single"
                }
              },
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "orders",
                      "kind": "dashboard.table",
                      "dataSourceRef": "orders"
                    }
                  ]
                }
              }
            }
            """.trimIndent()
        )

        val normalized = normalizeWindowMetadataJson(raw)
        val decoded = json.decodeFromJsonElement(WindowMetadata.serializer(), normalized)

        assertEquals("single", decoded.dataSources["orders"]?.selectionMode)
        assertEquals("orders", decoded.view?.content?.containers?.firstOrNull()?.dataSourceRef)
    }

    @Test
    fun `normalizeWindowMetadataJson preserves top level legacy dataSource map with direct container`() {
        val raw = json.parseToJsonElement(
            """
            {
              "namespace": "Valid",
              "kind": "dashboard.table",
              "id": "orders",
              "title": "Orders",
              "dataSourceRef": "orders",
              "dataSource": {
                "orders": {
                  "selectionMode": "single"
                }
              }
            }
            """.trimIndent()
        )

        val normalized = normalizeWindowMetadataJson(raw)
        val decoded = json.decodeFromJsonElement(WindowMetadata.serializer(), normalized)
        val root = decoded.view?.content?.containers?.firstOrNull()

        assertEquals("single", decoded.dataSources["orders"]?.selectionMode)
        assertEquals("orders", root?.id)
        assertEquals("orders", root?.dataSourceRef)
        assertEquals(false, (normalized.jsonObject["view"]?.jsonObject
            ?.get("content")?.jsonObject
            ?.get("containers") as? kotlinx.serialization.json.JsonArray)
            ?.firstOrNull()?.jsonObject?.containsKey("dataSource"))
    }

    @Test
    fun `normalizeWindowMetadataJson rejects nested alias under direct container with legacy map`() {
        val raw = json.parseToJsonElement(
            """
            {
              "namespace": "Invalid",
              "kind": "dashboard",
              "id": "root",
              "dataSource": {
                "orders": {
                  "selectionMode": "single"
                }
              },
              "containers": [
                {
                  "id": "badTable",
                  "kind": "dashboard.table",
                  "dataSource": "orders"
                }
              ]
            }
            """.trimIndent()
        )

        val failure = assertFailsWith<IllegalArgumentException> {
            normalizeWindowMetadataJson(raw)
        }

        assertEquals(
            "$.containers[0].dataSource is not supported on Forge containers; use dataSourceRef",
            failure.message
        )
    }
}

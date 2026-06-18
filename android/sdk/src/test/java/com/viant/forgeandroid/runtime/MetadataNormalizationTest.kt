package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
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
              "namespace": "Forecasting",
              "view": {
                "content": {
                  "kind": "dashboard.reportBuilder",
                  "id": "forecastingCubeBuilder",
                  "dataSourceRef": "forecasting_cube_report",
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
                    "forecastCategories": ["inventory", "location"],
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
        assertEquals(listOf("inventory", "location"), builder?.forecastCategories)
        assertEquals("date", builder?.groupBy?.defaultValue)
        assertEquals("date", builder?.groupBy?.options?.firstOrNull()?.paramValue?.jsonPrimitive?.content)
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
        val geo = children.firstOrNull { it.id == "geo" }

        assertEquals(listOf("lineId", "status"), table?.columns?.map { it.id })
        assertEquals("channel", composition?.chart?.xAxis?.dataKey)
        assertEquals("avails", composition?.chart?.series?.valueKey)
        assertEquals("channel", composition?.chart?.series?.nameKey)
        assertEquals("warning", badges?.dashboard?.badges?.items?.firstOrNull()?.tone)
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
}

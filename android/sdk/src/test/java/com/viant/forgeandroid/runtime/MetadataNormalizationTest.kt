package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.Json
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
                      "dynamicFilterGroups": []
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
        assertEquals(true, decoded.dataSources.containsKey("analytics_cube_report"))
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

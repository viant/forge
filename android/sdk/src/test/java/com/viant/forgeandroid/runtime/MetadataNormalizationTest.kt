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
              "namespace": "Forecasting",
              "view": {
                "content": {
                  "id": "reportBuilderRoot",
                  "kind": "dashboard.reportBuilder",
                  "title": "Forecasting builder"
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
        assertEquals("Forecasting builder", decoded.view?.content?.containers?.first()?.title)
    }

    @Test
    fun `normalizeWindowMetadataJson preserves forecasting report builder shape`() {
        val raw = json.parseToJsonElement(
            """
            {
              "namespace": "Forecasting",
              "dataSource": {
                "forecasting_cube_report": {
                  "service": { "endpoint": "agentlyAPI", "uri": "/v1/api/datasources/forecasting_cube_report/fetch", "method": "POST" }
                }
              },
              "view": {
                "content": {
                  "id": "reportBuilderRoot",
                  "kind": "dashboard.reportBuilder",
                  "title": "Forecasting",
                  "subtitle": "Build a normalized forecasting stack and review live inventory outputs.",
                  "dataSourceRef": "forecasting_cube_report",
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
        assertEquals("forecasting_cube_report", decoded.view?.content?.containers?.first()?.dataSourceRef)
        assertEquals(true, decoded.view?.content?.containers?.first()?.dashboard?.reportBuilder != null)
        assertEquals(true, decoded.view?.content?.containers?.first()?.dashboard?.reportBuilder?.unifiedFamilyRows)
        assertEquals(true, decoded.dataSources.containsKey("forecasting_cube_report"))
    }

    @Test
    fun `normalizeWindowMetadataJson decodes chart dimensions when width is css string`() {
        val raw = json.parseToJsonElement(
            """
            {
              "namespace": "Order Summary",
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "orderMetrics",
                      "kind": "chart",
                      "chart": {
                        "type": "line",
                        "width": "100%",
                        "height": "420",
                        "xAxis": { "dataKey": "date" },
                        "series": {
                          "values": [
                            { "name": "Spend", "value": "spend" },
                            { "name": "Delivery", "value": "delivery" }
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
              "namespace": "Order Summary",
              "view": {
                "content": {
                  "id": "orderRoot",
                  "layout": {
                    "kind": "split",
                    "orientation": "horizontal",
                    "columns": 2
                  },
                  "containers": [
                    { "id": "analysisPane", "title": "Order Metrics" },
                    { "id": "summaryRail", "title": "Budget/Pacing" }
                  ]
                }
              }
            }
            """.trimIndent()
        )

        val normalized = normalizeWindowMetadataJson(raw)
        val decoded = json.decodeFromJsonElement(WindowMetadata.serializer(), normalized)

        assertEquals("orderRoot", decoded.view?.content?.id)
        assertEquals("split", decoded.view?.content?.layout?.kind)
        assertEquals("horizontal", decoded.view?.content?.layout?.orientation)
        assertEquals(2, decoded.view?.content?.layout?.columns)
        assertEquals(listOf("analysisPane", "summaryRail"), decoded.view?.content?.containers?.map { it.id })
    }

    @Test
    fun `normalizeWindowMetadataJson decodes nested grid layout and column spans`() {
        val raw = json.parseToJsonElement(
            """
            {
              "namespace": "Order Summary",
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "summaryRail",
                      "layout": {
                        "kind": "grid",
                        "columns": 41,
                        "gap": "12px",
                        "rowGap": "12px"
                      },
                      "containers": [
                        { "id": "budgetSummary", "title": "Budget/Pacing", "columnSpan": 14 },
                        { "id": "deliverySummary", "title": "Delivery", "columnSpan": 14 },
                        { "id": "householdSummary", "title": "Household", "columnSpan": 13 }
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
        val summaryRail = decoded.view?.content?.containers?.firstOrNull()

        assertNotNull(summaryRail)
        assertEquals("grid", summaryRail.layout?.kind)
        assertEquals(41, summaryRail.layout?.columns)
        assertEquals("12px", summaryRail.layout?.gap)
        assertEquals("12px", summaryRail.layout?.rowGap)
        assertEquals(listOf(14, 14, 13), summaryRail.containers.map { it.columnSpan })
    }
}

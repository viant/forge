package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DashboardModelsTest {

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun decodesDashboardContainersFromWindowMetadata() {
        val payload = """
            {
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "homeDashboard",
                      "kind": "dashboard",
                      "title": "Android Home",
                      "subtitle": "Shared Forge metadata",
                      "layout": {
                        "kind": "grid",
                        "columns": 12
                      },
                      "containers": [
                        {
                          "id": "summary",
                          "kind": "dashboard.summary",
                          "columnSpan": 12,
                          "metrics": [
                            { "id": "value", "label": "Value", "selector": "totals.value", "format": "number" }
                          ]
                        },
                        {
                          "id": "filters",
                          "kind": "dashboard.filters",
                          "items": [
                            {
                              "id": "range",
                              "label": "Range",
                              "field": "dateRange",
                              "options": [
                                { "label": "7d", "value": "7d", "default": true }
                              ]
                            }
                          ]
                        },
                        {
                          "id": "status",
                          "kind": "dashboard.status",
                          "checks": [
                            { "label": "Freshness", "selector": "quality.delay_minutes", "format": "number" }
                          ]
                        },
                        {
                          "id": "compare",
                          "kind": "dashboard.compare",
                          "items": [
                            {
                              "id": "valueChange",
                              "label": "Value",
                              "current": "summary.total_value",
                              "previous": "summary.previous_total_value",
                              "format": "number",
                              "deltaFormat": "numberDelta"
                            }
                          ]
                        },
                        {
                          "id": "kpiTable",
                          "kind": "dashboard.kpiTable",
                          "rows": [
                            {
                              "id": "value",
                              "label": "Total Value",
                              "value": "summary.total_value",
                              "format": "number",
                              "context": "Operational",
                              "contextTone": "info"
                            }
                          ]
                        },
                        {
                          "id": "report",
                          "kind": "dashboard.report",
                          "sections": [
                            {
                              "title": "Notes",
                              "body": ["Hello"],
                              "visibleWhen": { "selector": "quality.zero_value_rate", "gt": 40 }
                            }
                          ]
                        },
                        {
                          "id": "timeline",
                          "kind": "dashboard.timeline",
                          "dashboard": {
                            "visibleWhen": { "source": "filters", "field": "dateRange", "notEmpty": true },
                            "timeline": {
                              "viewModes": ["daily", "weekly"],
                              "annotations": { "selector": "annotations.deployments" }
                            }
                          }
                        },
                        {
                          "id": "dimensions",
                          "kind": "dashboard.dimensions",
                          "dashboard": {
                            "dimensions": {
                              "dimension": { "key": "country", "label": "Country" },
                              "metric": { "key": "summary.total_value", "label": "Value", "format": "number" },
                              "viewModes": ["table"],
                              "limit": 5,
                              "orderBy": "summary.total_value desc"
                            }
                          }
                        },
                        {
                          "id": "messages",
                          "kind": "dashboard.messages",
                          "dashboard": {
                            "messages": {
                              "items": [
                                {
                                  "severity": "warning",
                                  "title": "Watchlist",
                                  "body": "Value is trending up"
                                }
                              ]
                            }
                          }
                        },
                        {
                          "id": "feed",
                          "kind": "dashboard.feed",
                          "dashboard": {
                            "feed": {
                              "fields": {
                                "title": "title",
                                "body": "body",
                                "timestamp": "createdAt",
                                "severity": "severity"
                              }
                            }
                          }
                        },
                        {
                          "id": "detail",
                          "kind": "dashboard.detail",
                          "dashboard": {
                            "detail": {
                              "reserved": "selection"
                            }
                          }
                        }
                      ]
                    }
                  ]
                }
              }
            }
        """.trimIndent()

        val metadata = json.decodeFromString(WindowMetadata.serializer(), payload)
        val root = metadata.view?.content?.containers?.firstOrNull()

        assertNotNull(root)
        assertEquals("dashboard", root?.kind)
        assertEquals("Shared Forge metadata", root?.subtitle)
        assertEquals("grid", root?.layout?.kind)
        assertEquals(12, root?.layout?.columns)

        val summary = root?.containers?.firstOrNull { it.id == "summary" }
        assertEquals("dashboard.summary", summary?.kind)
        assertEquals(12, summary?.columnSpan)
        assertEquals("Value", summary?.metrics?.firstOrNull()?.label)

        val filters = root?.containers?.firstOrNull { it.id == "filters" }
        assertEquals("dashboard.filters", filters?.kind)
        assertEquals("dateRange", filters?.items?.firstOrNull()?.field)

        val status = root?.containers?.firstOrNull { it.id == "status" }
        assertEquals("dashboard.status", status?.kind)
        assertEquals("Freshness", status?.checks?.firstOrNull()?.label)

        val compare = root?.containers?.firstOrNull { it.id == "compare" }
        assertEquals("dashboard.compare", compare?.kind)
        assertEquals("summary.total_value", compare?.items?.firstOrNull()?.current)

        val kpiTable = root?.containers?.firstOrNull { it.id == "kpiTable" }
        assertEquals("dashboard.kpiTable", kpiTable?.kind)
        assertEquals("summary.total_value", kpiTable?.rows?.firstOrNull()?.value)

        val report = root?.containers?.firstOrNull { it.id == "report" }
        assertEquals("dashboard.report", report?.kind)
        assertTrue(report?.sections?.firstOrNull()?.body?.contains("Hello") == true)
        assertNotNull(report?.sections?.firstOrNull()?.visibleWhen)

        val timeline = root?.containers?.firstOrNull { it.id == "timeline" }
        assertEquals("dashboard.timeline", timeline?.kind)
        assertEquals("filters", timeline?.dashboard?.visibleWhen?.source)
        assertEquals(listOf("daily", "weekly"), timeline?.dashboard?.timeline?.viewModes)
        assertEquals("annotations.deployments", timeline?.dashboard?.timeline?.annotations?.selector)

        val dimensions = root?.containers?.firstOrNull { it.id == "dimensions" }
        assertEquals("dashboard.dimensions", dimensions?.kind)
        assertEquals("country", dimensions?.dashboard?.dimensions?.dimension?.key)
        assertEquals(5, dimensions?.dashboard?.dimensions?.limit)

        val messages = root?.containers?.firstOrNull { it.id == "messages" }
        assertEquals("dashboard.messages", messages?.kind)
        assertEquals("Watchlist", messages?.dashboard?.messages?.items?.firstOrNull()?.title)

        val feed = root?.containers?.firstOrNull { it.id == "feed" }
        assertEquals("dashboard.feed", feed?.kind)
        assertEquals("createdAt", feed?.dashboard?.feed?.fields?.timestamp)

        val detail = root?.containers?.firstOrNull { it.id == "detail" }
        assertEquals("dashboard.detail", detail?.kind)
        assertEquals("selection", detail?.dashboard?.detail?.reserved)
    }
}

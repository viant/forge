package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DashboardModelsTest {

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun decodesReportBuilderDynamicFilterGroupIcon() {
        val payload = """
            {
              "view": {
                "content": {
                  "kind": "dashboard.reportBuilder",
                  "id": "analyticsBuilder",
                  "dataSourceRef": "analytics_report",
                  "reportBuilder": {
                    "dynamicFilterGroups": [
                      {
                        "id": "inventory",
                        "label": "Inventory",
                        "icon": "layers",
                        "description": "Inventory filters",
                        "filters": [
                          { "id": "publisher", "label": "Publisher", "paramPath": "filters.publisher" }
                        ]
                      }
                    ]
                  }
                }
              }
            }
        """.trimIndent()

        val metadata = json.decodeFromJsonElement(
            WindowMetadata.serializer(),
            normalizeWindowMetadataJson(json.parseToJsonElement(payload))
        )
        val group = metadata.view
            ?.content
            ?.containers
            ?.firstOrNull()
            ?.dashboard
            ?.reportBuilder
            ?.dynamicFilterGroups
            ?.firstOrNull()

        assertEquals("inventory", group?.id)
        assertEquals("Inventory", group?.label)
        assertEquals("layers", group?.icon)
        assertEquals("Inventory filters", group?.description)
        assertEquals("publisher", group?.filters?.firstOrNull()?.id)
    }

    @Test
    fun decodesDashboardConditionJsonOperands() {
        val payload = """
            {
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "conditional",
                      "visibleWhen": {
                        "source": "filters",
                        "field": "segment",
                        "equals": { "id": "enterprise", "tier": 2 },
                        "notEquals": ["blocked"],
                        "in": [
                          { "id": "enterprise", "tier": 2 },
                          ["agency", "brand"]
                        ]
                      }
                    }
                  ]
                }
              }
            }
        """.trimIndent()

        val metadata = json.decodeFromString(WindowMetadata.serializer(), payload)
        val condition = metadata.view?.content?.containers?.firstOrNull()?.visibleWhen

        assertEquals("enterprise", condition?.equals?.jsonObject?.get("id")?.jsonPrimitive?.contentOrNull)
        assertEquals(2, condition?.equals?.jsonObject?.get("tier")?.jsonPrimitive?.contentOrNull?.toInt())
        assertEquals("blocked", condition?.notEquals?.jsonArray?.firstOrNull()?.jsonPrimitive?.contentOrNull)
        assertEquals("enterprise", condition?.inValues?.firstOrNull()?.jsonObject?.get("id")?.jsonPrimitive?.contentOrNull)
        assertEquals("agency", condition?.inValues?.getOrNull(1)?.jsonArray?.firstOrNull()?.jsonPrimitive?.contentOrNull)
    }

    @Test
    fun decodesParameterJsonValueSelectorAndStructuredLocation() {
        val payload = """
            {
              "dataSource": {
                "report": {
                  "parameters": [
                    {
                      "name": "scope",
                      "in": "const",
                      "location": { "path": "payload.scope", "mode": "literal" },
                      "value": { "platforms": ["phone", "tablet"] },
                      "selector": "prefill.scope"
                    }
                  ]
                }
              }
            }
        """.trimIndent()

        val metadata = json.decodeFromJsonElement(
            WindowMetadata.serializer(),
            normalizeWindowMetadataJson(json.parseToJsonElement(payload))
        )
        val parameter = metadata.dataSources["report"]?.parameters?.firstOrNull()

        assertNotNull(parameter)
        assertEquals("scope", parameter?.name)
        assertEquals("const", parameter?.input)
        assertEquals("payload.scope", parameter?.locationValue?.jsonObject?.get("path")?.jsonPrimitive?.contentOrNull)
        assertEquals("phone", parameter?.value?.jsonObject?.get("platforms")?.jsonArray?.firstOrNull()?.jsonPrimitive?.contentOrNull)
        assertEquals("prefill.scope", parameter?.selector)
    }

    @Test
    fun decodesTopLevelDataSourceUriAndMethodCompatibility() {
        val payload = """
            {
              "dataSource": {
                "report": {
                  "uri": "/reports/search",
                  "method": "POST",
                  "service": {
                    "endpoint": "appAPI"
                  }
                }
              }
            }
        """.trimIndent()

        val metadata = json.decodeFromString(WindowMetadata.serializer(), payload)
        val dataSource = metadata.dataSources["report"]

        assertEquals("/reports/search", dataSource?.uri)
        assertEquals("POST", dataSource?.method)
        assertEquals("appAPI", dataSource?.service?.endpoint)
        assertEquals(null, dataSource?.service?.uri)
    }

    @Test
    fun evaluateDashboardConditionSupportsJsonOperands() {
        assertTrue(
            evaluateDashboardCondition(
                DashboardConditionDef(
                    source = "filters",
                    field = "segment",
                    equals = json.parseToJsonElement("""{"id":"enterprise","tier":2}""")
                ),
                filters = mapOf("segment" to mapOf("id" to "enterprise", "tier" to 2))
            )
        )
        assertTrue(
            evaluateDashboardCondition(
                DashboardConditionDef(
                    source = "filters",
                    field = "segments",
                    inValues = listOf(
                        json.parseToJsonElement("""["agency","brand"]"""),
                        json.parseToJsonElement("""["enterprise","direct"]""")
                    )
                ),
                filters = mapOf("segments" to listOf("enterprise", "direct"))
            )
        )
    }

    @Test
    fun decodesEditorLanguageAndFallbackValue() {
        val payload = """
            {
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "editor",
                      "dataSourceRef": "editorForm",
                      "editor": {
                        "selector": {
                          "source": "patch",
                          "location": "path",
                          "extension": "language"
                        },
                        "style": {
                          "height": "320px",
                          "readOnly": "true"
                        },
                        "language": "diff",
                        "value": "fallback"
                      }
                    }
                  ]
                }
              }
            }
        """.trimIndent()

        val metadata = json.decodeFromString(WindowMetadata.serializer(), payload)
        val editor = metadata.view?.content?.containers?.firstOrNull()?.editor

        assertEquals("patch", editor?.selector?.source)
        assertEquals("path", editor?.selector?.location)
        assertEquals("language", editor?.selector?.extension)
        assertEquals("320px", editor?.style?.get("height"))
        assertEquals("true", editor?.style?.get("readOnly"))
        assertEquals("diff", editor?.language)
        assertEquals("fallback", editor?.value)
    }

    @Test
    fun decodesLayoutLabelPositionAndRequiredItem() {
        val payload = """
            {
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "form-panel",
                      "layout": {
                        "kind": "grid",
                        "columns": 2,
                        "labelPosition": "top"
                      },
                      "items": [
                        {
                          "id": "name",
                          "label": "Name",
                          "subtitle": "Used in workspace forms",
                          "type": "text",
                          "field": "name",
                          "required": true,
                          "multiple": false,
                          "dataSourceRefSource": "windowForm",
                          "dataSourceRefSelector": "type",
                          "dataSourceRefs": { "lookup": "names" },
                          "scope": "windowForm",
                          "properties": { "placeholder": "Enter name" },
                          "targetOverrides": { "phone": { "type": "compact" } }
                        }
                      ]
                    }
                  ]
                }
              }
            }
        """.trimIndent()

        val metadata = json.decodeFromString(WindowMetadata.serializer(), payload)
        val container = metadata.view?.content?.containers?.firstOrNull()
        val item = container?.items?.firstOrNull()

        assertEquals("top", container?.layout?.labelPosition)
        assertEquals(true, item?.required)
        assertEquals("Used in workspace forms", item?.subtitle)
        assertEquals(false, item?.multiple)
        assertEquals("windowForm", item?.dataSourceRefSource)
        assertEquals("type", item?.dataSourceRefSelector)
        assertEquals("names", item?.dataSourceRefs?.get("lookup"))
        assertEquals("windowForm", item?.scope)
        assertEquals("Enter name", item?.properties?.get("placeholder")?.jsonPrimitive?.contentOrNull)
        assertEquals("compact", item?.targetOverrides?.get("phone")?.jsonObject?.get("type")?.jsonPrimitive?.contentOrNull)
    }

    @Test
    fun decodesGenericContainerChromeAndActions() {
        val payload = """
            {
              "view": {
                "content": {
                  "containers": [
                    {
                      "kind": "panel",
                      "role": "supporting",
                      "card": {
                        "elevation": 2,
                        "className": "quiet-card",
                        "style": { "padding": "compact" }
                      },
                      "section": {
                        "properties": { "tone": "info" }
                      },
                      "toolbar": {
                        "items": [
                          { "id": "refresh", "label": "Refresh", "icon": "refresh", "on": [{ "handler": "data.refresh" }] }
                        ],
                        "targetOverrides": { "phone": { "items": [] } }
                      },
                      "terminal": {
                        "dataSourceRef": "logs",
                        "height": "320px",
                        "prompt": "$",
                        "autoScroll": true,
                        "showDividers": false,
                        "truncateLongOutput": true,
                        "truncateLength": 1200,
                        "toolbar": {
                          "items": [
                            { "id": "clear", "label": "Clear" }
                          ]
                        },
                        "target": { "platform": "tablet" }
                      },
                      "actions": [
                        { "id": "open", "label": "Open", "on": [{ "handler": "window.open" }] }
                      ],
                      "on": [
                        { "event": "onAppear", "handler": "panel.ready" }
                      ]
                    }
                  ]
                }
              }
            }
        """.trimIndent()

        val metadata = json.decodeFromString(WindowMetadata.serializer(), payload)
        val container = metadata.view?.content?.containers?.firstOrNull()

        assertEquals("supporting", container?.role)
        assertEquals(2, container?.card?.elevation)
        assertEquals("quiet-card", container?.card?.className)
        assertEquals("compact", container?.card?.style?.get("padding")?.jsonPrimitive?.contentOrNull)
        assertEquals("info", container?.section?.properties?.get("tone")?.jsonPrimitive?.contentOrNull)
        assertEquals("refresh", container?.toolbar?.items?.firstOrNull()?.id)
        assertEquals("data.refresh", container?.toolbar?.items?.firstOrNull()?.on?.firstOrNull()?.handler)
        assertTrue(container?.toolbar?.targetOverrides?.containsKey("phone") == true)
        assertEquals("logs", container?.terminal?.dataSourceRef)
        assertEquals("320px", container?.terminal?.height)
        assertEquals("$", container?.terminal?.prompt)
        assertEquals(true, container?.terminal?.autoScroll)
        assertEquals(false, container?.terminal?.showDividers)
        assertEquals(true, container?.terminal?.truncateLongOutput)
        assertEquals(1200, container?.terminal?.truncateLength)
        assertEquals("clear", container?.terminal?.toolbar?.items?.firstOrNull()?.id)
        assertEquals("tablet", container?.terminal?.target?.jsonObject?.get("platform")?.jsonPrimitive?.contentOrNull)
        assertEquals("open", container?.actions?.firstOrNull()?.id)
        assertEquals("window.open", container?.actions?.firstOrNull()?.on?.firstOrNull()?.handler)
        assertEquals("onAppear", container?.on?.firstOrNull()?.event)
        assertEquals("panel.ready", container?.on?.firstOrNull()?.handler)
    }

    @Test
    fun decodesGenericChatConfiguration() {
        val payload = """
            {
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "assistant",
                      "chat": {
                        "header": {
                          "title": "Workspace assistant",
                          "left": [
                            { "icon": "back", "on": [{ "handler": "window.back" }] }
                          ],
                          "right": [
                            { "icon": "settings", "label": "Tune", "targetOverrides": { "phone": { "label": "Tune" } } }
                          ]
                        },
                        "showUpload": false,
                        "uploadField": "uploads",
                        "showMic": true,
                        "showSettings": true,
                        "showAbort": true,
                        "showTools": false,
                        "commandCenter": true,
                        "abortVisible": { "selector": "state.streaming" },
                        "target": { "platform": "phone" },
                        "targetOverrides": { "tablet": { "showTools": true } },
                        "on": [
                          { "event": "onSubmit", "handler": "chat.submit" }
                        ]
                      }
                    }
                  ]
                }
              }
            }
        """.trimIndent()

        val metadata = json.decodeFromString(WindowMetadata.serializer(), payload)
        val chat = metadata.view?.content?.containers?.firstOrNull()?.chat

        assertEquals("Workspace assistant", chat?.header?.title)
        assertEquals("back", chat?.header?.left?.firstOrNull()?.icon)
        assertEquals("window.back", chat?.header?.left?.firstOrNull()?.on?.firstOrNull()?.handler)
        assertEquals("Tune", chat?.header?.right?.firstOrNull()?.label)
        assertEquals("Tune", chat?.header?.right?.firstOrNull()?.targetOverrides?.get("phone")?.jsonObject?.get("label")?.jsonPrimitive?.contentOrNull)
        assertEquals(false, chat?.showUpload)
        assertEquals("uploads", chat?.uploadField)
        assertEquals(true, chat?.showMic)
        assertEquals(true, chat?.showSettings)
        assertEquals(true, chat?.showAbort)
        assertEquals(false, chat?.showTools)
        assertEquals(true, chat?.commandCenter)
        assertEquals("state.streaming", chat?.abortVisible?.jsonObject?.get("selector")?.jsonPrimitive?.contentOrNull)
        assertEquals("phone", chat?.target?.jsonObject?.get("platform")?.jsonPrimitive?.contentOrNull)
        assertEquals(true, chat?.targetOverrides?.get("tablet")?.jsonObject?.get("showTools")?.jsonPrimitive?.contentOrNull == "true")
        assertEquals("onSubmit", chat?.on?.firstOrNull()?.event)
        assertEquals("chat.submit", chat?.on?.firstOrNull()?.handler)
    }

    @Test
    fun decodesDataSourceUniqueKeyAndSparseLinkParameters() {
        val payload = """
            {
              "dataSources": {
                "rows": {
                  "uniqueKey": [
                    { "field": "id" },
                    { "parameter": "accountId" }
                  ],
                  "parameters": [
                    { "from": "selection.id", "to": "rowId", "direction": "in" }
                  ]
                }
              },
              "kind": "list",
              "items": [
                {
                  "id": "open-row",
                  "label": "Open row",
                  "link": {
                    "kind": "window",
                    "windowKey": "detail"
                  }
                }
              ]
            }
        """.trimIndent()

        val metadata = json.decodeFromJsonElement(
            WindowMetadata.serializer(),
            normalizeWindowMetadataJson(json.parseToJsonElement(payload))
        )
        val dataSource = metadata.dataSources["rows"]
        val item = metadata.view?.content?.containers?.firstOrNull()?.items?.firstOrNull()

        assertEquals(listOf("id", null), dataSource?.uniqueKey?.map { it.field })
        assertEquals(listOf(null, "accountId"), dataSource?.uniqueKey?.map { it.parameter })
        assertEquals(null, dataSource?.parameters?.firstOrNull()?.name)
        assertEquals("selection.id", dataSource?.parameters?.firstOrNull()?.from)
        assertEquals("rowId", dataSource?.parameters?.firstOrNull()?.to)
        assertEquals("detail", item?.link?.windowKey)
        assertTrue(item?.link?.parameters?.isEmpty() == true)
    }

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
                              "type": "dateRange",
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
                              "deltaFormat": "numberDelta",
                              "currentLabel": "Current period",
                              "previousLabel": "Baseline period"
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
                            },
                            {
                              "title": "String body",
                              "body": "Single paragraph"
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
                                  "body": "Value is trending up",
                                  "text": "Text fallback",
                                  "field": "status.message",
                                  "bodyField": "message",
                                  "rowIndex": 2
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
        assertEquals("dateRange", filters?.items?.firstOrNull()?.type)

        val status = root?.containers?.firstOrNull { it.id == "status" }
        assertEquals("dashboard.status", status?.kind)
        assertEquals("Freshness", status?.checks?.firstOrNull()?.label)

        val compare = root?.containers?.firstOrNull { it.id == "compare" }
        assertEquals("dashboard.compare", compare?.kind)
        assertEquals("summary.total_value", compare?.items?.firstOrNull()?.current)
        assertEquals("Current period", compare?.items?.firstOrNull()?.currentLabel)
        assertEquals("Baseline period", compare?.items?.firstOrNull()?.previousLabel)

        val kpiTable = root?.containers?.firstOrNull { it.id == "kpiTable" }
        assertEquals("dashboard.kpiTable", kpiTable?.kind)
        assertEquals("summary.total_value", kpiTable?.rows?.firstOrNull()?.value)

        val report = root?.containers?.firstOrNull { it.id == "report" }
        assertEquals("dashboard.report", report?.kind)
        assertTrue(report?.sections?.firstOrNull()?.body?.contains("Hello") == true)
        assertEquals(listOf("Single paragraph"), report?.sections?.getOrNull(1)?.body)
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
        assertEquals("Text fallback", messages?.dashboard?.messages?.items?.firstOrNull()?.text)
        assertEquals("status.message", messages?.dashboard?.messages?.items?.firstOrNull()?.field)
        assertEquals("message", messages?.dashboard?.messages?.items?.firstOrNull()?.bodyField)
        assertEquals(2, messages?.dashboard?.messages?.items?.firstOrNull()?.rowIndex)

        val feed = root?.containers?.firstOrNull { it.id == "feed" }
        assertEquals("dashboard.feed", feed?.kind)
        assertEquals("createdAt", feed?.dashboard?.feed?.fields?.timestamp)

        val detail = root?.containers?.firstOrNull { it.id == "detail" }
        assertEquals("dashboard.detail", detail?.kind)
        assertEquals("selection", detail?.dashboard?.detail?.reserved)
    }

    @Test
    fun decodesDashboardSummaryItemsAndSelectorAliases() {
        val payload = """
            {
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "summary",
                      "kind": "dashboard.summary",
                      "dashboard": {
                        "summary": {
                          "items": [
                            { "id": "avails", "label": "Avails", "field": "avails", "format": "compactNumber" },
                            { "id": "fallback", "label": "Fallback", "key": "totals.value", "value": 12 }
                          ]
                        }
                      }
                    }
                  ]
                }
              }
            }
        """.trimIndent()

        val metadata = json.decodeFromString<WindowMetadata>(payload)
        val items = metadata.view?.content?.containers?.firstOrNull()?.dashboard?.summary?.items.orEmpty()

        assertEquals(2, items.size)
        assertEquals("avails", items[0].field)
        assertEquals("totals.value", items[1].key)
        assertEquals(JsonPrimitive(12), items[1].value)
    }

    @Test
    fun decodesSparseChartSeriesObject() {
        val payload = """
            {
              "series": {
                "nameKey": "channel",
                "valueKey": "avails"
              }
            }
        """.trimIndent()

        val chart = json.decodeFromString<ChartDef>(payload)

        assertEquals("channel", chart.series?.nameKey)
        assertEquals("avails", chart.series?.valueKey)
        assertTrue(chart.series?.palette?.isEmpty() == true)
        assertEquals(listOf("avails"), chart.series?.values?.map { it.value })
    }

    @Test
    fun decodesLegacyChartKeysAndSeriesArray() {
        val payload = """
            {
              "kind": "donut",
              "xKey": "channel",
              "nameKey": "channel",
              "valueKey": "avails",
              "series": ["avails", "hhUniques"]
            }
        """.trimIndent()

        val chart = json.decodeFromString<ChartDef>(payload)

        assertEquals("donut", chart.kind)
        assertEquals("channel", chart.xKey)
        assertEquals("channel", chart.nameKey)
        assertEquals("avails", chart.valueKey)
        assertEquals(listOf("avails", "hhUniques"), chart.series?.values?.map { it.value })
    }

    @Test
    fun decodesChartAxesDimensionsAndTargetMetadata() {
        val payload = """
            {
              "title": "Trend",
              "dataSourceRef": "trendRows",
              "type": "bar",
              "xAxis": {
                "dataKey": "day",
                "label": "Date",
                "tickFormat": "shortDate"
              },
              "yAxis": {
                "dataKey": "avails",
                "label": "Avails",
                "tickFormat": "compact"
              },
              "series": {
                "nameKey": "channel",
                "valueKey": "avails"
              },
              "width": "100%",
              "height": 420,
              "target": { "surface": "dashboard" },
              "targetOverrides": {
                "android:phone": { "height": 260 }
              }
            }
        """.trimIndent()

        val chart = json.decodeFromString<ChartDef>(payload)

        assertEquals("Trend", chart.title)
        assertEquals("trendRows", chart.dataSourceRef)
        assertEquals("bar", chart.type)
        assertEquals("day", chart.xAxis?.dataKey)
        assertEquals("Date", chart.xAxis?.label)
        assertEquals("shortDate", chart.xAxis?.tickFormat)
        assertEquals("avails", chart.yAxis?.dataKey)
        assertEquals("Avails", chart.yAxis?.label)
        assertEquals("compact", chart.yAxis?.tickFormat)
        assertEquals("avails", chart.series?.valueKey)
        assertEquals("channel", chart.series?.nameKey)
        assertEquals("100%", chart.width?.jsonPrimitive?.contentOrNull)
        assertEquals("420", chart.height?.jsonPrimitive?.contentOrNull)
        assertEquals("dashboard", chart.target?.jsonObject?.get("surface")?.jsonPrimitive?.contentOrNull)
        assertEquals("260", chart.targetOverrides["android:phone"]?.jsonObject?.get("height")?.jsonPrimitive?.contentOrNull)
    }

    @Test
    fun decodesExecutionEventLifecycleAndTargetMetadata() {
        val eventOnlyPayload = """
            {
              "event": "submit"
            }
        """.trimIndent()
        val richPayload = """
            {
              "event": "submit",
              "handler": "form.submit",
              "args": ["selection"],
              "parameters": [
                { "name": "recordId", "from": ":windowform", "to": ":query" }
              ],
              "init": "form.prepare",
              "onError": "form.error",
              "onDone": "form.done",
              "onSuccess": "form.success",
              "async": true,
              "target": { "surface": "dialog" },
              "targetOverrides": {
                "android:phone": { "surface": "sheet" }
              }
            }
        """.trimIndent()

        val eventOnly = json.decodeFromString<ExecutionDef>(eventOnlyPayload)
        val rich = json.decodeFromString<ExecutionDef>(richPayload)

        assertEquals("submit", eventOnly.event)
        assertEquals(null, eventOnly.handler)
        assertEquals("submit", rich.event)
        assertEquals("form.submit", rich.handler)
        assertEquals(listOf("selection"), rich.args)
        assertEquals("recordId", rich.parameters.firstOrNull()?.name)
        assertEquals("form.prepare", rich.init)
        assertEquals("form.error", rich.onError)
        assertEquals("form.done", rich.onDone)
        assertEquals("form.success", rich.onSuccess)
        assertEquals(true, rich.async)
        assertEquals("dialog", rich.target?.jsonObject?.get("surface")?.jsonPrimitive?.contentOrNull)
        assertEquals(
            "sheet",
            rich.targetOverrides["android:phone"]?.jsonObject?.get("surface")?.jsonPrimitive?.contentOrNull
        )
    }

    @Test
    fun decodesDashboardKPITableExplicitColumns() {
        val payload = """
            {
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "kpi",
                      "kind": "dashboard.kpiTable",
                      "dashboard": {
                        "kpiTable": {
                          "columns": [
                            { "key": "name", "label": "Name" },
                            { "key": "avails", "label": "Avails", "format": "compactNumber" }
                          ]
                        }
                      }
                    }
                  ]
                }
              }
            }
        """.trimIndent()

        val metadata = json.decodeFromString<WindowMetadata>(payload)
        val kpiTable = metadata.view?.content?.containers?.firstOrNull()?.dashboard?.kpiTable

        assertEquals(listOf("name", "avails"), kpiTable?.columns?.map { it.key })
        assertEquals(listOf("Name", "Avails"), kpiTable?.columns?.map { it.label })
        assertTrue(kpiTable?.rows?.isEmpty() == true)
    }

    @Test
    fun decodesDashboardBlocksWithMissingArraysAsEmpty() {
        val payload = """
            {
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "root",
                      "kind": "dashboard",
                      "containers": [
                        { "id": "compare", "kind": "dashboard.compare", "dashboard": { "compare": {} } },
                        { "id": "filters", "kind": "dashboard.filters", "dashboard": { "filters": {} } },
                        { "id": "timeline", "kind": "dashboard.timeline", "dashboard": { "timeline": { "annotations": { "selector": "notes" } } } },
                        { "id": "dimensions", "kind": "dashboard.dimensions", "dashboard": { "dimensions": { "dimension": { "key": "channel" } } } },
                        { "id": "messages", "kind": "dashboard.messages", "dashboard": { "messages": {} } },
                        { "id": "badges", "kind": "dashboard.badges", "dashboard": { "badges": {} } },
                        { "id": "status", "kind": "dashboard.status", "dashboard": { "status": {} } },
                        { "id": "report", "kind": "dashboard.report", "dashboard": { "report": {} } }
                      ]
                    }
                  ]
                }
              }
            }
        """.trimIndent()

        val metadata = json.decodeFromString<WindowMetadata>(payload)
        val children = metadata.view?.content?.containers?.firstOrNull()?.containers.orEmpty()

        assertTrue(children.firstOrNull { it.id == "compare" }?.dashboard?.compare?.items?.isEmpty() == true)
        assertTrue(children.firstOrNull { it.id == "filters" }?.dashboard?.filters?.items?.isEmpty() == true)
        assertEquals(emptyList<String>(), children.firstOrNull { it.id == "timeline" }?.dashboard?.timeline?.viewModes)
        assertEquals("notes", children.firstOrNull { it.id == "timeline" }?.dashboard?.timeline?.annotations?.selector)
        assertEquals(emptyList<String>(), children.firstOrNull { it.id == "dimensions" }?.dashboard?.dimensions?.viewModes)
        assertEquals("channel", children.firstOrNull { it.id == "dimensions" }?.dashboard?.dimensions?.dimension?.key)
        assertTrue(children.firstOrNull { it.id == "messages" }?.dashboard?.messages?.items?.isEmpty() == true)
        assertTrue(children.firstOrNull { it.id == "badges" }?.dashboard?.badges?.items?.isEmpty() == true)
        assertTrue(children.firstOrNull { it.id == "status" }?.dashboard?.status?.checks?.isEmpty() == true)
        assertTrue(children.firstOrNull { it.id == "report" }?.dashboard?.report?.sections?.isEmpty() == true)
    }

    @Test
    fun decodesDashboardTableColumnKeyCompatibility() {
        val payload = """
            {
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "dashboardRoot",
                      "kind": "dashboard",
                      "containers": [
                        {
                          "id": "primary-evidence",
                          "kind": "dashboard.table",
                          "dataSourceRef": "summary_metrics",
                          "columns": [
                            { "key": "record_name", "label": "Record", "format": "text" },
                            { "key": "primary_status", "label": "Status", "format": "text" }
                          ]
                        },
                        {
                          "id": "planner",
                          "kind": "planner.table",
                          "dataSourceRef": "planner_rows",
                          "table": {
                            "title": "Planner",
                            "columns": [
                              { "key": "recommendation", "label": "Recommendation", "format": "text" },
                              { "key": "status", "label": "Status", "format": "text" }
                            ],
                            "selectionField": "selected",
                            "disabledField": "locked",
                            "callback": {
                              "type": "llm_event",
                              "eventName": "planner_submit",
                              "target": "foreground"
                            },
                            "on": [
                                { "handler": "planner.submit", "args": ["selection"] }
                            ]
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
        val containers = metadata.view?.content?.containers?.firstOrNull()?.containers.orEmpty()
        val table = containers.firstOrNull { it.id == "primary-evidence" }
        val planner = containers.firstOrNull { it.id == "planner" }

        assertEquals("dashboard.table", table?.kind)
        assertEquals(listOf("record_name", "primary_status"), table?.columns?.map { it.key })
        assertEquals(listOf("Record", "Status"), table?.columns?.map { it.label })
        assertEquals("planner.table", planner?.kind)
        assertEquals("planner_rows", planner?.dataSourceRef)
        assertEquals("Planner", planner?.table?.title)
        assertEquals(listOf("recommendation", "status"), planner?.table?.columns?.map { it.key })
        assertEquals("selected", planner?.table?.selectionField)
        assertEquals("locked", planner?.table?.disabledField)
        val callback = planner?.table?.callback?.let(JsonUtil::elementToAny) as? Map<*, *>
        assertEquals("planner_submit", callback?.get("eventName"))
        assertEquals("planner.submit", planner?.table?.on?.firstOrNull()?.handler)
    }

    @Test
    fun plannerTableBuildsCallbackPayloadAndCsv() {
        val callback = json.parseToJsonElement(
            """
            {
              "type": "llm_event",
              "eventName": "planner_submit",
              "target": "foreground"
            }
            """.trimIndent()
        )
        val table = TableDef(
            columns = listOf(
                ColumnDef(key = "name", label = "Name"),
                ColumnDef(key = "status", label = "Status"),
                ColumnDef(key = "rank")
            ),
            selectionField = "selected",
            disabledField = "locked",
            callback = callback
        )
        val rows = listOf(
            mapOf("name" to "Alpha", "status" to "Ready", "rank" to 1),
            mapOf("name" to "Beta, Inc", "status" to "Review", "rank" to 2, "selected" to false),
            mapOf("name" to "Gamma", "status" to "Locked", "rank" to 3, "locked" to true)
        )

        val selected = plannerTableDefaultSelectedIndexes(
            rows,
            plannerTableSelectionField(table),
            plannerTableDisabledField(table)
        )
        val payload = plannerTableCallbackPayload(table, "recommended_sites", rows, selected)
        val csv = plannerTableCsv(
            table.columns,
            plannerTableRowsWithSelection(rows, selected, "selected"),
            "selected"
        )

        assertEquals(setOf(0), selected)
        assertEquals("recommended_sites", payload["dataSourceRef"])
        assertEquals("selected", payload["selectionField"])
        assertEquals("planner_submit", (payload["callback"] as? Map<*, *>)?.get("eventName"))
        assertEquals(1, (payload["selectedRows"] as? List<*>)?.size)
        assertEquals(1, (payload["unselectedRows"] as? List<*>)?.size)
        assertEquals(1, (payload["disabledRows"] as? List<*>)?.size)
        val selectedRow = (payload["selectedRows"] as? List<*>)?.firstOrNull() as? Map<*, *>
        val unselectedRow = (payload["unselectedRows"] as? List<*>)?.firstOrNull() as? Map<*, *>
        val disabledRow = (payload["disabledRows"] as? List<*>)?.firstOrNull() as? Map<*, *>
        assertEquals("Alpha", selectedRow?.get("name"))
        assertEquals(true, selectedRow?.get("selected"))
        assertEquals("Beta, Inc", unselectedRow?.get("name"))
        assertEquals(false, unselectedRow?.get("selected"))
        assertEquals("Gamma", disabledRow?.get("name"))
        assertEquals(true, disabledRow?.get("locked"))
        assertEquals(false, disabledRow?.get("selected"))
        assertEquals(
            """
            Name,Status,rank,selected
            Alpha,Ready,1,true
            "Beta, Inc",Review,2,false
            Gamma,Locked,3,false
            """.trimIndent(),
            csv
        )
    }

    @Test
    fun plannerTableSubmitFeedbackUsesSelectableRowCountsAndFailureFallback() {
        val rows = listOf(
            mapOf("name" to "Alpha", "selected" to true),
            mapOf("name" to "Beta", "selected" to false),
            mapOf("name" to "Gamma", "locked" to true)
        )
        val selectableCount = plannerTableSelectableRowCount(rows, "locked")

        val submitting = plannerTableSubmitFeedback(
            status = PlannerTableSubmitStatus.Submitting,
            selectedCount = 1,
            selectableCount = selectableCount
        )
        val submitted = plannerTableSubmitFeedback(
            status = PlannerTableSubmitStatus.Submitted,
            selectedCount = 1,
            selectableCount = selectableCount
        )
        val failure = plannerTableSubmitFeedback(
            status = PlannerTableSubmitStatus.Failure,
            failureMessage = "  "
        )

        assertEquals(2, selectableCount)
        assertEquals("Submitting...", submitting.buttonLabel)
        assertEquals("Submitting 1 of 2 selectable rows.", submitting.message)
        assertEquals(true, submitting.busy)
        assertEquals("Submitted", submitted.buttonLabel)
        assertEquals("Submitted 1 of 2 selectable rows.", submitted.message)
        assertEquals(false, submitted.busy)
        assertEquals("Retry", failure.buttonLabel)
        assertEquals("Submit action failed.", failure.message)
    }
}

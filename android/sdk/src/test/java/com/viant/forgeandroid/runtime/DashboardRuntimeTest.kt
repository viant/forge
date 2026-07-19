package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

class DashboardRuntimeTest {

    @Test
    fun dashboardReportRuntimeBlocksPreserveResolvedPresentationContent() {
        val presentationKinds = listOf(
            "badgesBlock", "collectionBlock", "sectionBlock", "tabGroupBlock", "compositeBlock",
            "stepperBlock", "infoPanelBlock", "calloutBlock", "kanbanBlock", "timelineBlock"
        )
        val blocks = dashboardReportRuntimeBlocks(values = presentationKinds.mapIndexed { index, kind ->
            JsonObject(
                mapOf(
                    "id" to JsonPrimitive("block-${index + 1}"),
                    "kind" to JsonPrimitive(kind),
                    "content" to JsonObject(mapOf("marker" to JsonPrimitive(kind)))
                )
            )
        })

        assertEquals(presentationKinds, blocks.map { it.kind })
        assertEquals(presentationKinds, blocks.map { it.content["marker"]?.jsonPrimitive?.contentOrNull })
    }

    @Test
    fun evaluateDashboardConditionSupportsThresholdsAndSelection() {
        val gtCondition = DashboardConditionDef(selector = "quality.zero_spend_rate", gt = 40.0)
        assertTrue(
            evaluateDashboardCondition(
                gtCondition,
                metrics = mapOf("quality" to mapOf("zero_spend_rate" to 47.2))
            )
        )
        assertFalse(
            evaluateDashboardCondition(
                gtCondition,
                metrics = mapOf("quality" to mapOf("zero_spend_rate" to 12.0))
            )
        )

        val selectionCondition = DashboardConditionDef(selector = "selection.entityKey", whenValue = JsonPrimitive("US"))
        assertTrue(
            evaluateDashboardCondition(
                selectionCondition,
                selection = DashboardSelectionState(entityKey = "US")
            )
        )
        assertFalse(
            evaluateDashboardCondition(
                selectionCondition,
                selection = DashboardSelectionState(entityKey = "GB")
            )
        )
    }

    @Test
    fun dashboardSummaryResolvedCardsUseItemsAndFirstDatasourceRow() {
        val container = ContainerDef(
            id = "summary",
            kind = "dashboard.summary",
            dashboard = DashboardDef(
                summary = DashboardSummaryDef(
                    items = listOf(
                        DashboardMetricDef(id = "avails", label = "Avails", field = "avails", format = "number"),
                        DashboardMetricDef(id = "fallback", label = "Fallback", key = "totals.value", format = "number"),
                        DashboardMetricDef(id = "literal", label = "Literal", format = "number", value = JsonPrimitive(7))
                    )
                )
            )
        )

        val cards = resolvedDashboardSummaryCards(
            container,
            metrics = mapOf("avails" to 100, "totals" to mapOf("value" to 12)),
            source = mapOf("avails" to 42)
        )

        assertEquals(listOf("Avails", "Fallback", "Literal"), cards.map { it.label })
        assertEquals(listOf("42", "12", "7"), cards.map { it.displayValue })
    }

    @Test
    fun dashboardRuntimeFormatsSummaryValues() {
        assertEquals("42", formatDashboardValue(42, "integer"))
        assertEquals("1.2K", formatDashboardValue(1250.0, "compactNumber"))
        assertEquals("1.2K", formatDashboardValue("1250", "compactNumber"))
        assertEquals("19.4%", formatDashboardValue(JsonPrimitive("0.1937"), "percentFraction"))
        assertEquals("n/a", formatDashboardValue(null, "number"))
        assertEquals("May 1, 2026", formatDashboardValue("2026-05-01T04:00:00Z", "date"))
        assertEquals("May 1, 2026, 4:00 AM", formatDashboardValue("2026-05-01T04:00:00Z", "dateTime"))
        assertEquals("12 AM", formatDashboardValue("2026-05-13T00:00:00Z", "wallClockHour"))
        assertEquals("May 13, 2026", formatDashboardValue("2026-05-13T00:00:00Z", "wallClockDate"))
    }

    @Test
    fun evaluateDashboardConditionSupportsFilterLookupAndNotEmpty() {
        val condition = DashboardConditionDef(selector = "filters.dateRange", notEmpty = true)
        assertTrue(
            evaluateDashboardCondition(
                condition,
                filters = mapOf("dateRange" to "7d")
            )
        )
        assertFalse(
            evaluateDashboardCondition(
                condition,
                filters = emptyMap()
            )
        )
    }

    @Test
    fun evaluateDashboardConditionSupportsSourceAndEqualityOperators() {
        assertTrue(
            evaluateDashboardCondition(
                DashboardConditionDef(source = "selection", field = "entityKey", equals = JsonPrimitive("US")),
                selection = DashboardSelectionState(entityKey = "US")
            )
        )
        assertFalse(
            evaluateDashboardCondition(
                DashboardConditionDef(source = "selection", field = "entityKey", notEquals = JsonPrimitive("US")),
                selection = DashboardSelectionState(entityKey = "US")
            )
        )
        assertTrue(
            evaluateDashboardCondition(
                DashboardConditionDef(source = "filters", field = "region", inValues = listOf(JsonPrimitive("NA"), JsonPrimitive("EMEA"))),
                filters = mapOf("region" to "NA")
            )
        )
        assertTrue(
            evaluateDashboardCondition(
                DashboardConditionDef(source = "filters", field = "region", empty = true),
                filters = emptyMap()
            )
        )
    }

    @Test
    fun visibleDashboardDetailChildrenHonorsChildVisibleWhen() {
        val detail = ContainerDef(
            id = "detail",
            kind = "dashboard.detail",
            containers = listOf(
                ContainerDef(
                    id = "visible",
                    kind = "dashboard.summary",
                    visibleWhen = DashboardConditionDef(source = "filters", field = "region", equals = JsonPrimitive("NA"))
                ),
                ContainerDef(
                    id = "hidden",
                    kind = "dashboard.summary",
                    visibleWhen = DashboardConditionDef(source = "filters", field = "region", equals = JsonPrimitive("EU"))
                ),
                ContainerDef(
                    id = "nestedVisible",
                    kind = "dashboard.summary",
                    visibleWhen = DashboardConditionDef(source = "filters", field = "region", equals = JsonPrimitive("EU")),
                    dashboard = DashboardDef(
                        visibleWhen = DashboardConditionDef(source = "filters", field = "region", equals = JsonPrimitive("NA"))
                    )
                ),
                ContainerDef(id = "always", kind = "dashboard.summary")
            )
        )

        val visible = visibleDashboardDetailChildren(
            detail,
            filters = mapOf("region" to "NA")
        )

        assertEquals(listOf("visible", "nestedVisible", "always"), visible.map { it.id })
    }

    @Test
    fun dashboardTimelineChartUsesShorthandWhenChartIsAbsent() {
        val timeline = ContainerDef(
            id = "timeline",
            kind = "dashboard.timeline",
            dateField = "day",
            chartType = "area",
            series = JsonArray(
                listOf(
                    JsonObject(mapOf("label" to JsonPrimitive("Avails"), "value" to JsonPrimitive("avails"))),
                    JsonObject(mapOf("label" to JsonPrimitive("HH uniques"), "value" to JsonPrimitive("hhUniques")))
                )
            )
        )

        val chart = dashboardTimelineChart(timeline)

        assertEquals("area", chart?.type)
        assertEquals("day", chart?.xAxis?.dataKey)
        assertEquals(listOf("avails", "hhUniques"), chart?.series?.values?.map { it.value })
        assertEquals(listOf("Avails", "HH uniques"), chart?.series?.values?.map { it.name })
    }

    @Test
    fun dashboardCompositionChartUsesCompactFieldsWhenChartIsAbsent() {
        val composition = ContainerDef(
            id = "channelMix",
            kind = "dashboard.composition",
            dataSourceRef = "channel_rows",
            categoryKey = "channel",
            valueKey = "avails",
            chartType = "pie",
            legendLimit = 4
        )

        val chart = dashboardCompositionChart(composition)

        assertEquals(4, composition.legendLimit)
        assertEquals("pie", chart.type)
        assertEquals("channel", chart.xAxis?.dataKey)
        assertEquals("channel", chart.series?.nameKey)
        assertEquals("avails", chart.series?.valueKey)
        assertEquals(listOf("avails"), chart.series?.values?.map { it.value })
    }

    @Test
    fun dashboardReportRuntimeSummaryUsesDirectThenNestedConfig() {
        val direct = ContainerDef(
            id = "runtime",
            kind = "dashboard.reportRuntime",
            title = "Fallback Runtime",
            reportRuntime = JsonObject(
                mapOf(
                    "title" to JsonPrimitive("Runtime Report"),
                    "subtitle" to JsonPrimitive("Current run"),
                            "reportSpec" to JsonObject(
                                mapOf(
                                    "layoutIntent" to JsonObject(
                                        mapOf(
                                            "blockOrder" to JsonArray(
                                                listOf(
                                                    JsonPrimitive("filters"),
                                                    JsonPrimitive("refinements"),
                                                    JsonPrimitive("kpi"),
                                                    JsonPrimitive("chart"),
                                                    JsonPrimitive("geo"),
                                                    JsonPrimitive("table"),
                                                    JsonPrimitive("summary")
                                                )
                                            )
                                        )
                                    ),
                                    "parameters" to JsonObject(
                                mapOf(
                                    "pageSize" to JsonPrimitive(10)
                                )
                            ),
                            "datasets" to JsonArray(
                                listOf(
                                    JsonObject(
                                        mapOf(
                                            "id" to JsonPrimitive("rows"),
                                            "request" to JsonObject(
                                                mapOf(
                                                    "dimensions" to JsonObject(
                                                        mapOf("name" to JsonPrimitive(true))
                                                    )
                                                )
                                            )
                                        )
                                    )
                                )
                            ),
                            "blocks" to JsonArray(
                                listOf(
                                    JsonObject(
                                        mapOf(
                                            "id" to JsonPrimitive("tableSpec"),
                                            "kind" to JsonPrimitive("tableBlock"),
                                            "datasetRef" to JsonPrimitive("rows"),
                                            "columns" to JsonArray(
                                                listOf(
                                                    JsonObject(
                                                        mapOf(
                                                            "key" to JsonPrimitive("name"),
                                                            "sourceKey" to JsonPrimitive("name"),
                                                            "displayKey" to JsonPrimitive("name"),
                                                            "label" to JsonPrimitive("Name"),
                                                            "runtimeFilterable" to JsonPrimitive(true)
                                                        )
                                                    ),
                                                    JsonObject(
                                                        mapOf(
                                                            "key" to JsonPrimitive("value"),
                                                            "label" to JsonPrimitive("Value"),
                                                            "format" to JsonPrimitive("integer")
                                                        )
                                                    )
                                                )
                                            )
                                        )
                                    )
                                )
                            ),
                            "drillMetadata" to JsonObject(
                                mapOf(
                                    "hierarchies" to JsonArray(emptyList()),
                                    "detailTargets" to JsonArray(emptyList()),
                                    "fieldActions" to JsonArray(
                                        listOf(
                                            JsonObject(
                                                mapOf(
                                                    "fieldRef" to JsonPrimitive("name"),
                                                    "actions" to JsonArray(
                                                        listOf(
                                                            JsonObject(
                                                                mapOf(
                                                                    "id" to JsonPrimitive("drill_region"),
                                                                    "label" to JsonPrimitive("Drill to region"),
                                                                    "kind" to JsonPrimitive("drill"),
                                                                    "nextFieldRef" to JsonPrimitive("region")
                                                                )
                                                            ),
                                                            JsonObject(
                                                                mapOf(
                                                                    "id" to JsonPrimitive("detail_name"),
                                                                    "label" to JsonPrimitive("Show name details"),
                                                                    "kind" to JsonPrimitive("detail"),
                                                                    "targetRef" to JsonPrimitive("target://example/name")
                                                                )
                                                            )
                                                        )
                                                    )
                                                )
                                            )
                                        )
                                    )
                                )
                            ),
                            "scope" to JsonObject(
                                mapOf(
                                    "params" to JsonArray(
                                        listOf(
                                            JsonObject(
                                                mapOf(
                                                    "id" to JsonPrimitive("dateRange"),
                                                    "description" to JsonPrimitive("Reporting period"),
                                                    "value" to JsonObject(
                                                        mapOf(
                                                            "start" to JsonPrimitive("2026-06-01"),
                                                            "end" to JsonPrimitive("2026-06-05")
                                                        )
                                                    )
                                                )
                                            ),
                                            JsonObject(
                                                mapOf(
                                                    "id" to JsonPrimitive("channels"),
                                                    "description" to JsonPrimitive("Included channels"),
                                                    "value" to JsonArray(listOf(JsonPrimitive("Display"), JsonPrimitive("CTV")))
                                                )
                                            )
                                        )
                                    )
                                )
                            ),
                            "refinements" to JsonArray(
                                listOf(
                                    JsonObject(
                                        mapOf(
                                            "id" to JsonPrimitive("ref-channel"),
                                            "op" to JsonPrimitive("drill"),
                                            "field" to JsonPrimitive("channel"),
                                            "fieldLabel" to JsonPrimitive("Channel"),
                                            "values" to JsonArray(listOf(JsonPrimitive("Display")))
                                        )
                                    )
                                )
                            )
                        )
                    ),
                    "reportFill" to JsonObject(
                        mapOf(
                            "datasets" to JsonArray(
                                listOf(
                                    JsonObject(
                                        mapOf(
                                            "id" to JsonPrimitive("rows"),
                                            "rows" to JsonArray(
                                                listOf(
                                                    JsonObject(mapOf("name" to JsonPrimitive("North"), "value" to JsonPrimitive(12))),
                                                    JsonObject(mapOf("name" to JsonPrimitive("South"), "value" to JsonPrimitive(8)))
                                                )
                                            ),
                                            "provenance" to JsonObject(
                                                mapOf(
                                                    "rowCount" to JsonPrimitive(2),
                                                    "diagnostics" to JsonArray(
                                                        listOf(
                                                            JsonObject(
                                                                mapOf(
                                                                    "code" to JsonPrimitive("datasetStale"),
                                                                    "severity" to JsonPrimitive("warning"),
                                                                    "path" to JsonPrimitive("datasets.rows"),
                                                                    "message" to JsonPrimitive("Rows were served from cache")
                                                                )
                                                            )
                                                        )
                                                    )
                                                )
                                            )
                                        )
                                    ),
                                    JsonObject(
                                        mapOf(
                                            "id" to JsonPrimitive("geoRows"),
                                            "rows" to JsonArray(
                                                listOf(
                                                    JsonObject(
                                                        mapOf(
                                                            "state" to JsonPrimitive("CA"),
                                                            "label" to JsonPrimitive("California"),
                                                            "avails" to JsonPrimitive(1200000)
                                                        )
                                                    ),
                                                    JsonObject(
                                                        mapOf(
                                                            "state" to JsonPrimitive("WA"),
                                                            "label" to JsonPrimitive("Washington"),
                                                            "avails" to JsonPrimitive(980000)
                                                        )
                                                    )
                                                )
                                            ),
                                            "provenance" to JsonObject(mapOf("rowCount" to JsonPrimitive(2)))
                                        )
                                    )
                                )
                            ),
                            "diagnostics" to JsonArray(
                                listOf(
                                    JsonObject(
                                        mapOf(
                                            "code" to JsonPrimitive("actionProviderFailed"),
                                            "severity" to JsonPrimitive("warning"),
                                            "blockId" to JsonPrimitive("chart"),
                                            "path" to JsonPrimitive("reportRuntime.blocks.chart.actions.channel"),
                                            "message" to JsonPrimitive("Provider offline"),
                                            "suggestedFix" to JsonPrimitive("Retry later.")
                                        )
                                    ),
                                    JsonObject(
                                        mapOf(
                                            "code" to JsonPrimitive("invalidGeo"),
                                            "severity" to JsonPrimitive("error"),
                                            "blockId" to JsonPrimitive("geo"),
                                            "message" to JsonPrimitive("Geo payload incomplete")
                                        )
                                    )
                                )
                            ),
                            "blocks" to JsonArray(
                                listOf(
                                    JsonObject(
                                        mapOf(
                                            "id" to JsonPrimitive("summary"),
                                            "kind" to JsonPrimitive("markdownBlock"),
                                            "title" to JsonPrimitive("Summary"),
                                            "content" to JsonObject(
                                                mapOf("markdown" to JsonPrimitive("# Summary\nReady to review."))
                                            )
                                        )
                                    ),
                                    JsonObject(
                                        mapOf(
                                            "id" to JsonPrimitive("filters"),
                                            "kind" to JsonPrimitive("filterBarBlock"),
                                            "title" to JsonPrimitive("Report Scope"),
                                            "content" to JsonObject(
                                                mapOf(
                                                    "title" to JsonPrimitive("Report Scope"),
                                                    "params" to JsonArray(
                                                        listOf(
                                                            JsonObject(
                                                                mapOf(
                                                                    "id" to JsonPrimitive("dateRange"),
                                                                    "description" to JsonPrimitive("Reporting period"),
                                                                    "value" to JsonObject(
                                                                        mapOf(
                                                                            "start" to JsonPrimitive("2026-06-01"),
                                                                            "end" to JsonPrimitive("2026-06-05")
                                                                        )
                                                                    )
                                                                )
                                                            ),
                                                            JsonObject(
                                                                mapOf(
                                                                    "id" to JsonPrimitive("channels"),
                                                                    "description" to JsonPrimitive("Included channels"),
                                                                    "value" to JsonArray(listOf(JsonPrimitive("Display"), JsonPrimitive("CTV")))
                                                                )
                                                            )
                                                        )
                                                    )
                                                )
                                            )
                                        )
                                    ),
                                    JsonObject(
                                        mapOf(
                                            "id" to JsonPrimitive("refinements"),
                                            "kind" to JsonPrimitive("refinementBarBlock"),
                                            "content" to JsonObject(
                                                mapOf(
                                                    "title" to JsonPrimitive("Refinements"),
                                                    "emptyLabel" to JsonPrimitive("No active refinements"),
                                                    "refinements" to JsonArray(
                                                        listOf(
                                                            JsonObject(
                                                                mapOf(
                                                                    "id" to JsonPrimitive("ref-channel"),
                                                                    "op" to JsonPrimitive("drill"),
                                                                    "field" to JsonPrimitive("channel"),
                                                                    "fieldLabel" to JsonPrimitive("Channel"),
                                                                    "values" to JsonArray(listOf(JsonPrimitive("Display")))
                                                                )
                                                            )
                                                        )
                                                    )
                                                )
                                            )
                                        )
                                    ),
                                    JsonObject(
                                        mapOf(
                                            "id" to JsonPrimitive("kpi"),
                                            "kind" to JsonPrimitive("kpiBlock"),
                                            "content" to JsonObject(
                                                mapOf(
                                                    "title" to JsonPrimitive("Revenue"),
                                                    "description" to JsonPrimitive("Current period"),
                                                    "valueLabel" to JsonPrimitive("Booked"),
                                                    "value" to JsonPrimitive("42"),
                                                    "secondaryField" to JsonPrimitive("change"),
                                                    "secondaryValue" to JsonPrimitive("12%"),
                                                    "rowCount" to JsonPrimitive(1)
                                                )
                                            )
                                        )
                                    ),
                                    JsonObject(
                                        mapOf(
                                            "id" to JsonPrimitive("chart"),
                                            "kind" to JsonPrimitive("chartBlock"),
                                            "title" to JsonPrimitive("Trend"),
                                            "datasetRef" to JsonPrimitive("rows"),
                                            "content" to JsonObject(
                                                mapOf(
                                                    "chartSpec" to JsonObject(
                                                        mapOf("xField" to JsonPrimitive("name"))
                                                    ),
                                                    "chartModel" to JsonObject(
                                                        mapOf(
                                                            "type" to JsonPrimitive("bar"),
                                                            "xAxis" to JsonObject(mapOf("dataKey" to JsonPrimitive("name"))),
                                                            "series" to JsonObject(
                                                                mapOf(
                                                                    "values" to JsonArray(
                                                                        listOf(
                                                                            JsonObject(
                                                                                mapOf(
                                                                                    "name" to JsonPrimitive("Value"),
                                                                                    "value" to JsonPrimitive("value")
                                                                                )
                                                                            )
                                                                        )
                                                                    )
                                                                )
                                                            )
                                                        )
                                                    )
                                                )
                                            )
                                        )
                                    ),
                                    JsonObject(
                                        mapOf(
                                            "id" to JsonPrimitive("geo"),
                                            "kind" to JsonPrimitive("geoMapBlock"),
                                            "title" to JsonPrimitive("State Geo"),
                                            "datasetRef" to JsonPrimitive("geoRows"),
                                            "content" to JsonObject(
                                                mapOf(
                                                    "geo" to JsonObject(
                                                        mapOf(
                                                            "shape" to JsonPrimitive("us-states"),
                                                            "key" to JsonPrimitive("state"),
                                                            "labelKey" to JsonPrimitive("label"),
                                                            "metric" to JsonObject(
                                                                mapOf(
                                                                    "key" to JsonPrimitive("avails"),
                                                                    "label" to JsonPrimitive("Avails"),
                                                                    "format" to JsonPrimitive("compactNumber")
                                                                )
                                                            )
                                                        )
                                                    )
                                                )
                                            )
                                        )
                                    ),
                                    JsonObject(
                                        mapOf(
                                            "id" to JsonPrimitive("table"),
                                            "kind" to JsonPrimitive("tableBlock"),
                                            "title" to JsonPrimitive("Rows"),
                                            "datasetRef" to JsonPrimitive("rows"),
                                            "content" to JsonObject(
                                                mapOf(
                                                    "columns" to JsonArray(
                                                        listOf(
                                                            JsonObject(
                                                                mapOf(
                                                                    "key" to JsonPrimitive("name"),
                                                                    "sourceKey" to JsonPrimitive("name"),
                                                                    "displayKey" to JsonPrimitive("name"),
                                                                    "label" to JsonPrimitive("Name"),
                                                                    "runtimeFilterable" to JsonPrimitive(true)
                                                                )
                                                            ),
                                                            JsonObject(
                                                                mapOf(
                                                                    "key" to JsonPrimitive("value"),
                                                                    "label" to JsonPrimitive("Value"),
                                                                    "format" to JsonPrimitive("integer")
                                                                )
                                                            )
                                                        )
                                                    )
                                                )
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )
        val nested = ContainerDef(
            id = "runtime",
            kind = "dashboard.reportRuntime",
            dashboard = DashboardDef(
                reportRuntime = JsonObject(
                    mapOf(
                        "reportSpec" to JsonObject(
                            mapOf(
                                "title" to JsonPrimitive("Nested Runtime"),
                                "blocks" to JsonArray(
                                    listOf(
                                        JsonObject(
                                            mapOf(
                                                "key" to JsonPrimitive("chart"),
                                                "type" to JsonPrimitive("chartBlock"),
                                                "label" to JsonPrimitive("Trend")
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )
        val chartDiagnostic = DashboardReportRuntimeDiagnostic(
            id = "actionProviderFailed:chart:reportRuntime.blocks.chart.actions.channel:1",
            severity = "warning",
            code = "actionProviderFailed",
            blockId = "chart",
            path = "reportRuntime.blocks.chart.actions.channel",
            message = "Provider offline",
            suggestedFix = "Retry later."
        )
        val geoDiagnostic = DashboardReportRuntimeDiagnostic(
            id = "invalidGeo:geo:2",
            severity = "error",
            code = "invalidGeo",
            blockId = "geo",
            path = null,
            message = "Geo payload incomplete",
            suggestedFix = null
        )
        val rowsDatasetDiagnostic = DashboardReportRuntimeDiagnostic(
            id = "dataset:rows:datasetStale:datasets.rows:1",
            severity = "warning",
            code = "datasetStale",
            blockId = null,
            path = "datasets.rows",
            message = "Rows were served from cache",
            suggestedFix = null
        )
        val tableNameActionField = DashboardReportRuntimeActionField(
            id = "name",
            valueKey = "name",
            displayValueKey = "name",
            label = "Name",
            runtimeFilterable = true
        )
        val chartNameActionField = DashboardReportRuntimeActionField(
            id = "name",
            kind = "xField",
            valueKey = "name",
            displayValueKey = "name",
            label = "Name",
            selectionSource = "xValue",
            runtimeFilterable = true
        )
        val tableActionDescriptors = listOf(
            DashboardReportRuntimeActionDescriptor(id = "keep:name", kind = "keep", fieldValueKey = "name", label = "Keep Name"),
            DashboardReportRuntimeActionDescriptor(id = "exclude:name", kind = "exclude", fieldValueKey = "name", label = "Exclude Name"),
            DashboardReportRuntimeActionDescriptor(
                id = "drill_region",
                kind = "drill",
                fieldValueKey = "name",
                label = "Drill to region",
                nextFieldRef = "region"
            ),
            DashboardReportRuntimeActionDescriptor(
                id = "detail_name",
                kind = "detail",
                fieldValueKey = "name",
                label = "Show name details",
                targetRef = "target://example/name"
            )
        )
        val chartActionDescriptors = listOf(
            DashboardReportRuntimeActionDescriptor(id = "keep:chart:name", kind = "keep", fieldValueKey = "name", label = "Keep Name"),
            DashboardReportRuntimeActionDescriptor(id = "exclude:chart:name", kind = "exclude", fieldValueKey = "name", label = "Exclude Name"),
            DashboardReportRuntimeActionDescriptor(
                id = "drill_region",
                kind = "drill",
                fieldValueKey = "name",
                label = "Drill to region",
                nextFieldRef = "region"
            ),
            DashboardReportRuntimeActionDescriptor(
                id = "detail_name",
                kind = "detail",
                fieldValueKey = "name",
                label = "Show name details",
                targetRef = "target://example/name"
            )
        )

        assertEquals("Runtime Report", dashboardReportRuntimeConfig(direct)?.get("title")?.jsonPrimitive?.contentOrNull)
        assertEquals(
            DashboardReportRuntimeSummary(
                title = "Runtime Report",
                subtitle = "Current run",
                blockCount = 7,
                blocks = listOf(
                    DashboardReportRuntimeBlockSummary(
                        id = "filters",
                        kind = "filterBarBlock",
                        title = "Report Scope",
                        filterBar = DashboardReportRuntimeFilterBarValue(
                            title = "Report Scope",
                            params = listOf(
                                DashboardReportRuntimeFilterParamValue(
                                    id = "dateRange",
                                    description = "Reporting period",
                                    valueText = "2026-06-01 to 2026-06-05"
                                ),
                                DashboardReportRuntimeFilterParamValue(
                                    id = "channels",
                                    description = "Included channels",
                                    valueText = "Display, CTV"
                                )
                            )
                        )
                    ),
                    DashboardReportRuntimeBlockSummary(
                        id = "refinements",
                        kind = "refinementBarBlock",
                        title = "Refinements",
                        refinementBar = DashboardReportRuntimeRefinementBarValue(
                            title = "Refinements",
                            emptyLabel = "No active refinements",
                            refinements = listOf(
                                DashboardReportRuntimeRefinementValue(
                                    id = "ref-channel",
                                    label = "Drill: Channel = Display"
                                )
                            )
                        )
                    ),
                    DashboardReportRuntimeBlockSummary(
                        id = "kpi",
                        kind = "kpiBlock",
                        title = "Revenue",
                        kpi = DashboardReportRuntimeKpiValue(
                            description = "Current period",
                            valueLabel = "Booked",
                            valueText = "42",
                            secondaryLabel = "change",
                            secondaryValueText = "12%",
                            emptyLabel = "No KPI value available.",
                            rowCount = 1
                        )
                    ),
                    DashboardReportRuntimeBlockSummary(
                        id = "chart",
                        kind = "chartBlock",
                        title = "Trend",
                        diagnostics = listOf(chartDiagnostic, rowsDatasetDiagnostic),
                        chart = DashboardReportRuntimeChartValue(
                            dataSourceRef = "rows",
                            chart = ChartDef(
                                xAxis = ChartAxisDef(dataKey = "name"),
                                series = ChartSeriesDef(values = listOf(ChartValueOption(name = "Value", value = "value"))),
                                type = "bar"
                            ),
                            rows = listOf(
                                mapOf("name" to "North", "value" to 12L),
                                mapOf("name" to "South", "value" to 8L)
                            ),
                            actionFields = listOf(chartNameActionField),
                            actionDescriptors = chartActionDescriptors
                        )
                    ),
                    DashboardReportRuntimeBlockSummary(
                        id = "geo",
                        kind = "geoMapBlock",
                        title = "State Geo",
                        diagnostics = listOf(geoDiagnostic),
                        geoMap = DashboardReportRuntimeGeoMapValue(
                            dataSourceRef = "geoRows",
                            shape = "us-states",
                            metricLabel = "Avails",
                            metricFormat = "compactNumber",
                            rows = listOf(
                                DashboardGeoMapRow(regionCode = "CA", label = "California", value = 1200000.0),
                                DashboardGeoMapRow(regionCode = "WA", label = "Washington", value = 980000.0)
                            )
                        )
                    ),
                    DashboardReportRuntimeBlockSummary(
                        id = "table",
                        kind = "tableBlock",
                        title = "Rows",
                        diagnostics = listOf(rowsDatasetDiagnostic),
                        table = DashboardReportRuntimeTableValue(
                            dataSourceRef = "rows",
                            columns = listOf(
                                ColumnDef(id = "name", name = "name", label = "Name"),
                                ColumnDef(id = "value", name = "value", label = "Value", format = "integer")
                            ),
                            rows = listOf(
                                mapOf("name" to "North", "value" to 12L),
                                mapOf("name" to "South", "value" to 8L)
                            ),
                            limit = 2,
                            actionFields = listOf(tableNameActionField),
                            actionDescriptors = tableActionDescriptors
                        )
                    ),
                    DashboardReportRuntimeBlockSummary(
                        id = "summary",
                        kind = "markdownBlock",
                        title = "Summary",
                        markdown = "# Summary\nReady to review."
                    )
                ),
                diagnostics = listOf(chartDiagnostic, geoDiagnostic)
            ),
            dashboardReportRuntimeSummary(direct)
        )
        assertEquals(
            DashboardReportRuntimeSummary(
                title = "Nested Runtime",
                subtitle = null,
                blockCount = 1,
                blocks = listOf(DashboardReportRuntimeBlockSummary(id = "chart", kind = "chartBlock", title = "Trend"))
            ),
            dashboardReportRuntimeSummary(nested)
        )
    }

    @Test
    fun dashboardReportRuntimeSummaryResolvesSpecAuthoredFiltersAndRefinements() {
        val container = ContainerDef(
            id = "runtime",
            kind = "dashboard.reportRuntime",
            dashboard = DashboardDef(
                reportRuntime = JsonObject(
                    mapOf(
                        "reportSpec" to JsonObject(
                            mapOf(
                                "title" to JsonPrimitive("Spec Authored Runtime"),
                                "scope" to JsonObject(
                                    mapOf(
                                        "params" to JsonArray(
                                            listOf(
                                                JsonObject(
                                                    mapOf(
                                                        "id" to JsonPrimitive("dateRange"),
                                                        "description" to JsonPrimitive("Reporting period"),
                                                        "value" to JsonObject(
                                                            mapOf(
                                                                "start" to JsonPrimitive("2026-06-01"),
                                                                "end" to JsonPrimitive("2026-06-05")
                                                            )
                                                        )
                                                    )
                                                ),
                                                JsonObject(
                                                    mapOf(
                                                        "id" to JsonPrimitive("channels"),
                                                        "description" to JsonPrimitive("Included channels"),
                                                        "value" to JsonArray(listOf(JsonPrimitive("Display"), JsonPrimitive("CTV")))
                                                    )
                                                )
                                            )
                                        )
                                    )
                                ),
                                "refinements" to JsonArray(
                                    listOf(
                                        JsonObject(
                                            mapOf(
                                                "id" to JsonPrimitive("ref-market"),
                                                "op" to JsonPrimitive("keep"),
                                                "field" to JsonPrimitive("country"),
                                                "fieldLabel" to JsonPrimitive("Market"),
                                                "values" to JsonArray(listOf(JsonPrimitive("US")))
                                            )
                                        )
                                    )
                                ),
                                "blocks" to JsonArray(
                                    listOf(
                                        JsonObject(
                                            mapOf(
                                                "id" to JsonPrimitive("filters"),
                                                "kind" to JsonPrimitive("filterBarBlock"),
                                                "title" to JsonPrimitive("Report Scope"),
                                                "paramIds" to JsonArray(listOf(JsonPrimitive("dateRange")))
                                            )
                                        ),
                                        JsonObject(
                                            mapOf(
                                                "id" to JsonPrimitive("activeRefinements"),
                                                "kind" to JsonPrimitive("refinementBarBlock"),
                                                "title" to JsonPrimitive("Active Refinements"),
                                                "emptyLabel" to JsonPrimitive("No refinements yet")
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )

        assertEquals(
            DashboardReportRuntimeSummary(
                title = "Spec Authored Runtime",
                subtitle = null,
                blockCount = 2,
                blocks = listOf(
                    DashboardReportRuntimeBlockSummary(
                        id = "filters",
                        kind = "filterBarBlock",
                        title = "Report Scope",
                        filterBar = DashboardReportRuntimeFilterBarValue(
                            title = "Report Scope",
                            params = listOf(
                                DashboardReportRuntimeFilterParamValue(
                                    id = "dateRange",
                                    description = "Reporting period",
                                    valueText = "2026-06-01 to 2026-06-05"
                                )
                            )
                        )
                    ),
                    DashboardReportRuntimeBlockSummary(
                        id = "activeRefinements",
                        kind = "refinementBarBlock",
                        title = "Active Refinements",
                        refinementBar = DashboardReportRuntimeRefinementBarValue(
                            title = "Active Refinements",
                            emptyLabel = "No refinements yet",
                            refinements = listOf(
                                DashboardReportRuntimeRefinementValue(
                                    id = "ref-market",
                                    label = "Keep: Market = US"
                                )
                            )
                        )
                    )
                )
            ),
            dashboardReportRuntimeSummary(container)
        )
    }

    @Test
    fun dashboardReportRuntimeTableActionExecutionsMatchWebPayloadShape() {
        val field = DashboardReportRuntimeActionField(
            id = "channelV2",
            valueKey = "channelV2",
            displayValueKey = "channel.channel",
            label = "Channel",
            selectionSource = "seriesKey",
            runtimeFilterable = true
        )
        val descriptors = listOf(
            DashboardReportRuntimeActionDescriptor(id = "keep:channelV2", kind = "keep", fieldValueKey = "channelV2", label = "Keep only"),
            DashboardReportRuntimeActionDescriptor(
                id = "drill_market",
                kind = "drill",
                fieldValueKey = "channelV2",
                label = "Drill to Market",
                nextFieldRef = "country"
            ),
            DashboardReportRuntimeActionDescriptor(
                id = "detail_channel",
                kind = "detail",
                fieldValueKey = "channelV2",
                label = "Show channel details",
                targetRef = "target://example/performance/channel-detail"
            )
        )
        val item = mapOf(
            "channelV2" to 1,
            "channel" to mapOf("channel" to "Display"),
            "campaign" to "Prospect Sprint"
        )

        val executions = dashboardReportRuntimeTableActionExecutions(
            blockId = "comparisonTable",
            descriptors = descriptors,
            field = field,
            item = item
        )

        assertEquals(
            listOf(
                DashboardReportRuntimeActionExecution(
                    id = "keep:channelV2",
                    label = "Keep only",
                    kind = "keep",
                    refinement = DashboardReportRuntimeActionRefinement(
                        op = "keep",
                        field = "channelV2",
                        value = 1,
                        sourceBlockId = "comparisonTable",
                        fieldLabel = "Channel",
                        label = "Keep only = Display"
                    )
                ),
                DashboardReportRuntimeActionExecution(
                    id = "drill_market",
                    label = "Drill to Market",
                    kind = "drill",
                    refinement = DashboardReportRuntimeActionRefinement(
                        op = "drill",
                        field = "channelV2",
                        value = 1,
                        sourceBlockId = "comparisonTable",
                        fieldLabel = "Channel",
                        label = "Drill to Market = Display"
                    ),
                    transition = DashboardReportRuntimeActionTransition(
                        sourceField = "channelV2",
                        nextFieldRef = "country",
                        sourceBlockId = "comparisonTable"
                    )
                ),
                DashboardReportRuntimeActionExecution(
                    id = "detail_channel",
                    label = "Show channel details",
                    kind = "detail",
                    detailRequest = DashboardReportRuntimeDetailRequest(
                        action = DashboardReportRuntimeDetailAction(
                            id = "detail_channel",
                            kind = "detail",
                            label = "Show channel details",
                            targetRef = "target://example/performance/channel-detail"
                        ),
                        item = item,
                        value = 1,
                        field = field,
                        sourceBlockId = "comparisonTable"
                    )
                )
            ),
            executions
        )
    }

    @Test
    fun dashboardReportRuntimeExecutesAuthoredSelectionAction() {
        val field = DashboardReportRuntimeActionField(
            id = "market",
            valueKey = "market",
            displayValueKey = "market",
            label = "Market",
            runtimeFilterable = false
        )
        val block = JsonObject(mapOf(
            "runtime" to JsonObject(mapOf(
                "actions" to JsonArray(listOf(JsonObject(mapOf(
                    "id" to JsonPrimitive("selectMarket"),
                    "kind" to JsonPrimitive("select"),
                    "dimension" to JsonPrimitive("market")
                ))))
            ))
        ))
        val descriptors = dashboardReportRuntimeAuthoredSelectionDescriptors(block, listOf(field))
        val executions = dashboardReportRuntimeTableActionExecutions(
            blockId = "marketTable",
            descriptors = descriptors,
            field = field,
            item = mapOf("market" to "US", "spend" to 10)
        )
        assertEquals(
            DashboardSelectionState(
                dimension = "market",
                entityKey = "US",
                selected = mapOf("market" to "US", "spend" to 10),
                sourceBlockId = "marketTable"
            ),
            executions.first().selection
        )
    }

    @Test
    fun dashboardReportRuntimeChartActionExecutionsMatchWebPayloadShape() {
        val fields = listOf(
            DashboardReportRuntimeActionField(
                id = "country",
                kind = "xField",
                valueKey = "country",
                displayValueKey = "country",
                label = "Market",
                selectionSource = "xValue",
                runtimeFilterable = true
            ),
            DashboardReportRuntimeActionField(
                id = "channelV2",
                kind = "seriesField",
                valueKey = "channelV2",
                displayValueKey = "channel.channel",
                label = "Channel",
                selectionSource = "seriesKey",
                runtimeFilterable = true
            )
        )
        val descriptors = listOf(
            DashboardReportRuntimeActionDescriptor(id = "keep:reachRateTrend:country", kind = "keep", fieldValueKey = "country", label = "Keep only"),
            DashboardReportRuntimeActionDescriptor(
                id = "drill_region",
                kind = "drill",
                fieldValueKey = "country",
                label = "Drill to Region",
                nextFieldRef = "region"
            ),
            DashboardReportRuntimeActionDescriptor(
                id = "detail_channel",
                kind = "detail",
                fieldValueKey = "channelV2",
                label = "Show channel details",
                targetRef = "target://example/performance/channel-detail"
            )
        )
        val selectionRows = listOf(
            mapOf("channelV2" to "Display", "channel" to mapOf("channel" to "Display"), "region" to "West"),
            mapOf("channelV2" to "Display", "channel" to mapOf("channel" to "Display"), "region" to "Midwest")
        )

        val executions = dashboardReportRuntimeChartActionExecutions(
            blockId = "reachRateTrend",
            descriptors = descriptors,
            fields = fields,
            selection = DashboardReportRuntimeChartSelection(
                xValue = "US",
                seriesKey = "Display",
                row = mapOf(
                    "country" to "US",
                    "channelV2" to "Display",
                    "reachRate" to 40.82
                ),
                selectionRows = selectionRows
            )
        )

        assertEquals(
            listOf(
                DashboardReportRuntimeActionExecution(
                    id = "keep:reachRateTrend:country",
                    label = "Keep only",
                    kind = "keep",
                    refinement = DashboardReportRuntimeActionRefinement(
                        op = "keep",
                        field = "country",
                        value = "US",
                        sourceBlockId = "reachRateTrend",
                        fieldLabel = "Market",
                        label = "Keep only = US"
                    )
                ),
                DashboardReportRuntimeActionExecution(
                    id = "drill_region",
                    label = "Drill to Region",
                    kind = "drill",
                    refinement = DashboardReportRuntimeActionRefinement(
                        op = "drill",
                        field = "country",
                        value = "US",
                        sourceBlockId = "reachRateTrend",
                        fieldLabel = "Market",
                        label = "Drill to Region = US"
                    ),
                    transition = DashboardReportRuntimeActionTransition(
                        sourceField = "country",
                        nextFieldRef = "region",
                        sourceBlockId = "reachRateTrend"
                    )
                ),
                DashboardReportRuntimeActionExecution(
                    id = "detail_channel",
                    label = "Show channel details",
                    kind = "detail",
                    detailRequest = DashboardReportRuntimeDetailRequest(
                        action = DashboardReportRuntimeDetailAction(
                            id = "detail_channel",
                            kind = "detail",
                            label = "Show channel details",
                            targetRef = "target://example/performance/channel-detail"
                        ),
                        item = mapOf(
                            "country" to "US",
                            "channelV2" to "Display",
                            "reachRate" to 40.82,
                            "selectionRows" to selectionRows
                        ),
                        value = "Display",
                        field = fields[1],
                        sourceBlockId = "reachRateTrend"
                    )
                )
            ),
            executions
        )
    }

    @Test
    fun evaluateDashboardConditionSupportsGteLtAndLteOperators() {
        val metrics = mapOf("quality" to mapOf("delay_minutes" to 12.0))

        assertTrue(
            evaluateDashboardCondition(
                DashboardConditionDef(selector = "quality.delay_minutes", gte = 12.0),
                metrics = metrics
            )
        )
        assertTrue(
            evaluateDashboardCondition(
                DashboardConditionDef(selector = "quality.delay_minutes", lt = 15.0),
                metrics = metrics
            )
        )
        assertTrue(
            evaluateDashboardCondition(
                DashboardConditionDef(selector = "quality.delay_minutes", lte = 12.0),
                metrics = metrics
            )
        )
        assertFalse(
            evaluateDashboardCondition(
                DashboardConditionDef(selector = "quality.delay_minutes", lt = 10.0),
                metrics = metrics
            )
        )
    }

    @Test
    fun dashboardKeyUsesExplicitDashboardKeyWhenPresent() {
        val signals = SignalRegistry()
        val metadata = Signal<WindowMetadata?>(null)
        val window = WindowContext(
            windowId = "W_dash",
            metadata = metadata,
            signals = signals,
            dataSourceRuntime = DataSourceRuntime(
                signals = signals,
                restClient = RestClient(EndpointRegistry(emptyMap())),
                scope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Unconfined)
            )
        )
        val container = ContainerDef(id = "home", dashboard = DashboardDef(key = "shared-dashboard"))

        assertEquals("shared-dashboard", window.dashboardKey(container))
    }

    @Test
    fun dashboardVisibilityPrefersGroupedConditionWithLegacyFallback() {
        val signals = SignalRegistry()
        val metadata = Signal<WindowMetadata?>(null)
        val window = WindowContext(
            windowId = "W_dash",
            metadata = metadata,
            signals = signals,
            dataSourceRuntime = DataSourceRuntime(
                signals = signals,
                restClient = RestClient(EndpointRegistry(emptyMap())),
                scope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Unconfined)
            )
        )
        val grouped = ContainerDef(
            id = "summary",
            visibleWhen = DashboardConditionDef(source = "filters", field = "region", equals = JsonPrimitive("legacy")),
            dashboard = DashboardDef(
                visibleWhen = DashboardConditionDef(source = "filters", field = "region", equals = JsonPrimitive("NA"))
            )
        )
        val legacy = ContainerDef(
            id = "summary",
            visibleWhen = DashboardConditionDef(source = "filters", field = "region", equals = JsonPrimitive("NA"))
        )

        assertTrue(window.evaluateDashboardVisibility(grouped, filters = mapOf("region" to "NA")))
        assertFalse(window.evaluateDashboardVisibility(grouped, filters = mapOf("region" to "legacy")))
        assertTrue(window.evaluateDashboardVisibility(legacy, filters = mapOf("region" to "NA")))
    }

    @Test
    fun interpolateDashboardTemplateResolvesMetricsFiltersAndSelection() {
        val method = Class
            .forName("com.viant.forgeandroid.ui.DashboardRendererKt")
            .getDeclaredMethod(
                "interpolateDashboardTemplate",
                String::class.java,
                Map::class.java,
                Map::class.java,
                DashboardSelectionState::class.java
            )
            .apply { isAccessible = true }

        val result = method.invoke(
            null,
            "Value {{ summary.total_value }} in ${'$'}{filters.region} for ${'$'}{selection.entityKey}",
            mapOf("summary" to mapOf("total_value" to 42)),
            mapOf("region" to "NA"),
            DashboardSelectionState(entityKey = "US")
        ) as String

        assertEquals("Value 42 in NA for US", result)
    }

    @Test
    fun interpolateDashboardTemplateSupportsBadgeLabelsAndValues() {
        val method = Class
            .forName("com.viant.forgeandroid.ui.DashboardRendererKt")
            .getDeclaredMethod(
                "interpolateDashboardTemplate",
                String::class.java,
                Map::class.java,
                Map::class.java,
                DashboardSelectionState::class.java
            )
            .apply { isAccessible = true }

        val result = method.invoke(
            null,
            "Country ${'$'}{selection.entityKey}: {{ summary.total_value }}",
            mapOf("summary" to mapOf("total_value" to 42)),
            emptyMap<String, Any?>(),
            DashboardSelectionState(entityKey = "US")
        ) as String

        assertEquals("Country US: 42", result)
    }

    @Test
    fun dashboardToneNameCoercesStringAndNormalizesThresholds() {
        val tone = DashboardToneDef(warningAbove = 90.0, dangerAbove = 80.0)

        assertEquals("danger", dashboardToneName("95", tone))
        assertEquals("warning", dashboardToneName("85", tone))
        assertEquals("info", dashboardToneName("75", tone))
    }

    @Test
    fun applyDashboardFiltersToCollectionHonorsBindingsAndMultiSelect() {
        val method = Class
            .forName("com.viant.forgeandroid.ui.DashboardRendererKt")
            .getDeclaredMethod(
                "applyDashboardFiltersToCollection",
                List::class.java,
                Map::class.java,
                Map::class.java
            )
            .apply { isAccessible = true }

        val rows = listOf(
            mapOf("region" to "NA", "status" to "healthy"),
            mapOf("region" to "EMEA", "status" to "warning"),
            mapOf("region" to "APAC", "status" to "healthy")
        )

        val filtered = method.invoke(
            null,
            rows,
            mapOf("region" to "region", "state" to "status"),
            mapOf("region" to listOf("NA", "EMEA"), "state" to "healthy")
        ) as List<*>

        assertEquals(1, filtered.size)
        assertEquals("NA", (filtered.first() as Map<*, *>)["region"])
    }

    @Test
    fun setDashboardDateRangeFilterWritesWebCompatibleRangeObject() {
        val item = DashboardFilterItemDef(id = "range", field = "dateRange", type = "dateRange")

        val started = setDashboardDateRangeFilter(emptyMap(), item, "start", "2026-06-01")
        val ended = setDashboardDateRangeFilter(started, item, "end", "2026-06-20")
        val clearedStart = setDashboardDateRangeFilter(ended, item, "start", " ")

        assertEquals(
            mapOf("start" to "2026-06-01", "end" to "2026-06-20"),
            ended["dateRange"]
        )
        assertEquals(mapOf("end" to "2026-06-20"), clearedStart["dateRange"])
    }

    @Test
    fun applyDashboardSelectionToCollectionHonorsSelectionBindings() {
        val rows = listOf(
            mapOf("stateCode" to "CA", "dma" to "Los Angeles"),
            mapOf("stateCode" to "CA", "dma" to "San Francisco"),
            mapOf("stateCode" to "TX", "dma" to "Dallas-Fort Worth")
        )

        val selected = applyDashboardSelectionToCollection(
            rows,
            selectionBindings = mapOf("entityKey" to "stateCode"),
            selection = DashboardSelectionState(dimension = "stateCode", entityKey = "CA")
        )

        assertEquals(listOf("Los Angeles", "San Francisco"), selected.map { it["dma"] })
    }

    @Test
    fun dashboardSelectionFilteredRowsFeedDimensionAndGeoMapRanking() {
        val rows = listOf(
            mapOf("stateCode" to "CA", "regionCode" to "CA", "label" to "California", "avails" to 3100),
            mapOf("stateCode" to "TX", "regionCode" to "TX", "label" to "Texas", "avails" to 1200),
            mapOf("stateCode" to "CA", "regionCode" to "CA-N", "label" to "Northern California", "avails" to 900)
        )
        val selected = applyDashboardSelectionToCollection(
            rows,
            selectionBindings = mapOf("entityKey" to "stateCode"),
            selection = DashboardSelectionState(entityKey = "CA")
        )

        val dimensions = rankedDashboardDimensionRows(selected, dimensionKey = "label", metricKey = "avails", limit = 3)
        val geoRows = rankedDashboardGeoMapRows(selected, metricKey = "avails", limit = 3)

        assertEquals(listOf("California", "Northern California"), dimensions.map { it.entityKey })
        assertEquals(listOf("CA", "CA-N"), geoRows.map { it.regionCode })
    }

    @Test
    fun rankedDashboardDimensionRowsSortsStringMetricsAndLimits() {
        val rows = listOf(
            mapOf("label" to "Low", "avails" to "50"),
            mapOf("label" to "High", "avails" to "3100"),
            mapOf("label" to "Middle", "avails" to 1200),
            mapOf("label" to "   ", "avails" to 900)
        )

        val ranked = rankedDashboardDimensionRows(rows, dimensionKey = "label", metricKey = "avails", limit = 3)

        assertEquals(listOf("High", "Middle", null), ranked.map { it.entityKey })
        assertEquals(listOf(3100.0, 1200.0, 900.0), ranked.map { it.value })
        assertTrue(rankedDashboardDimensionRows(rows, dimensionKey = "label", metricKey = "avails", limit = 0).isEmpty())
        assertTrue(rankedDashboardDimensionRows(rows, dimensionKey = "label", metricKey = "avails", limit = -1).isEmpty())
        assertTrue(rankedDashboardDimensionRows(rows, dimensionKey = " ", metricKey = "avails", limit = 3).isEmpty())
    }

    @Test
    fun dashboardDataSourceRefTrimsAndFallsBackToRoot() {
        val method = Class
            .forName("com.viant.forgeandroid.ui.DashboardRendererKt")
            .getDeclaredMethod(
                "dashboardDataSourceRef",
                ContainerDef::class.java,
                ContainerDef::class.java
            )
            .apply { isAccessible = true }

        val root = ContainerDef(id = "dashboard", dataSourceRef = " rootRows ")
        val blankChild = ContainerDef(id = "feed", dataSourceRef = "   ")
        val directChild = ContainerDef(id = "feed", dataSourceRef = "\tchildRows\n")
        val blankRoot = ContainerDef(id = "dashboard", dataSourceRef = "\n")

        assertEquals("rootRows", method.invoke(null, blankChild, root))
        assertEquals("childRows", method.invoke(null, directChild, root))
        assertNull(method.invoke(null, blankChild, blankRoot))
    }

    @Test
    fun dashboardDetailEmptyMessagePreventsBlankDetailPanels() {
        val method = Class
            .forName("com.viant.forgeandroid.ui.DashboardRendererKt")
            .getDeclaredMethod("dashboardDetailEmptyMessage", ContainerDef::class.java)
            .apply { isAccessible = true }

        val emptyDetail = ContainerDef(id = "detail", kind = "dashboard.detail")
        val populatedDetail = ContainerDef(
            id = "detail",
            kind = "dashboard.detail",
            containers = listOf(ContainerDef(id = "summary", kind = "dashboard.summary"))
        )

        assertEquals("dashboard detail has no child blocks", method.invoke(null, emptyDetail))
        assertNull(method.invoke(null, populatedDetail))
    }

    @Test
    fun dashboardMessageBodyResolvesBodyTextAndRowFieldsInWebOrder() {
        val method = Class
            .forName("com.viant.forgeandroid.ui.DashboardRendererKt")
            .getDeclaredMethod(
                "dashboardMessageBody",
                DashboardMessageDef::class.java,
                List::class.java
            )
            .apply { isAccessible = true }
        val rows = listOf(
            mapOf("message" to "First row", "status" to mapOf("message" to "Nested first")),
            mapOf("message" to "Second row", "status" to mapOf("message" to "Nested second"))
        )

        assertEquals(
            "Body wins",
            method.invoke(null, DashboardMessageDef(body = "Body wins", text = "Text fallback", field = "message"), rows)
        )
        assertEquals(
            "Text fallback",
            method.invoke(null, DashboardMessageDef(text = "Text fallback", field = "message"), rows)
        )
        assertEquals(
            "Nested second",
            method.invoke(null, DashboardMessageDef(field = "status.message", bodyField = "message", rowIndex = 1), rows)
        )
        assertEquals(
            "First row",
            method.invoke(null, DashboardMessageDef(bodyField = "message", rowIndex = 99), rows)
        )
    }

    @Test
    fun rankedDashboardGeoMapRowsBuildsMapReadyFallbackRows() {
        val rows = listOf(
            mapOf(
                "regionCode" to "TX",
                "label" to "Texas",
                "avails" to 1200,
                "tone" to "success",
                "rank" to 2,
                "href" to "https://example.test/tx"
            ),
            mapOf(
                "stateCode" to "CA",
                "stateName" to "California",
                "avails" to "3100",
                "statusTone" to "warning",
                "rank" to 1,
                "url" to "https://example.test/ca"
            ),
            mapOf(
                "regionCode" to "",
                "label" to "Missing",
                "avails" to 9999
            ),
            mapOf(
                "regionCode" to "NY",
                "label" to "New York",
                "avails" to 850,
                "link" to "https://example.test/ny"
            )
        )

        val ranked = rankedDashboardGeoMapRows(rows, metricKey = "avails", limit = 3)

        assertEquals(listOf("CA", "TX", "NY"), ranked.map { it.regionCode })
        assertEquals(listOf("California", "Texas", "New York"), ranked.map { it.label })
        assertEquals(listOf(3100.0, 1200.0, 850.0), ranked.map { it.value })
        assertEquals(listOf("warning", "success", null), ranked.map { it.tone })
        assertEquals(listOf(1, 2, null), ranked.map { it.rank })
        assertEquals(
            listOf("https://example.test/ca", "https://example.test/tx", "https://example.test/ny"),
            ranked.map { it.href }
        )
    }

    @Test
    fun buildDashboardDefaultFiltersCollectsNestedDefaultSelections() {
        val method = Class
            .forName("com.viant.forgeandroid.ui.DashboardRendererKt")
            .getDeclaredMethod("buildDashboardDefaultFilters", ContainerDef::class.java)
            .apply { isAccessible = true }

        val root = ContainerDef(
            id = "dashboard",
            kind = "dashboard",
            containers = listOf(
                ContainerDef(
                    id = "filters",
                    kind = "dashboard.filters",
                    dashboard = DashboardDef(
                        filters = DashboardFiltersDef(
                            items = listOf(
                                DashboardFilterItemDef(
                                    id = "range",
                                    field = "dateRange",
                                    options = listOf(
                                        DashboardFilterOptionDef(label = "7d", value = "7d", default = true),
                                        DashboardFilterOptionDef(label = "30d", value = "30d")
                                    )
                                ),
                                DashboardFilterItemDef(
                                    id = "region",
                                    field = "regions",
                                    multiple = true,
                                    options = listOf(
                                        DashboardFilterOptionDef(label = "NA", value = "NA", default = true),
                                        DashboardFilterOptionDef(label = "EMEA", value = "EMEA", default = true)
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )

        val defaults = method.invoke(null, root) as Map<*, *>

        assertEquals("7d", defaults["dateRange"])
        assertEquals(listOf("NA", "EMEA"), defaults["regions"])
    }

    @Test
    fun buildDashboardDefaultFiltersSkipsBlankFieldAndFallsBackToId() {
        val method = Class
            .forName("com.viant.forgeandroid.ui.DashboardRendererKt")
            .getDeclaredMethod("buildDashboardDefaultFilters", ContainerDef::class.java)
            .apply { isAccessible = true }

        val root = ContainerDef(
            id = "dashboard",
            kind = "dashboard",
            containers = listOf(
                ContainerDef(
                    id = "filters",
                    kind = "dashboard.filters",
                    dashboard = DashboardDef(
                        filters = DashboardFiltersDef(
                            items = listOf(
                                DashboardFilterItemDef(
                                    id = "status",
                                    field = "   ",
                                    options = listOf(
                                        DashboardFilterOptionDef(label = "Healthy", value = "healthy", default = true)
                                    )
                                ),
                                DashboardFilterItemDef(
                                    id = "\t",
                                    field = "\n",
                                    options = listOf(
                                        DashboardFilterOptionDef(label = "Ignored", value = "ignored", default = true)
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )

        val defaults = method.invoke(null, root) as Map<*, *>

        assertEquals("healthy", defaults["status"])
        assertFalse(defaults.containsKey("   "))
        assertFalse(defaults.containsKey(""))
    }

    @Test
    fun toggleDashboardFilterUsesTrimmedFilterKey() {
        val method = Class
            .forName("com.viant.forgeandroid.ui.DashboardRendererKt")
            .getDeclaredMethod(
                "toggleDashboardFilter",
                Map::class.java,
                DashboardFilterItemDef::class.java,
                String::class.java
            )
            .apply { isAccessible = true }

        val byId = method.invoke(
            null,
            emptyMap<String, Any?>(),
            DashboardFilterItemDef(id = " status ", field = "   "),
            "healthy"
        ) as Map<*, *>
        val byField = method.invoke(
            null,
            emptyMap<String, Any?>(),
            DashboardFilterItemDef(id = "status", field = " region "),
            "NA"
        ) as Map<*, *>

        assertEquals("healthy", byId["status"])
        assertFalse(byId.containsKey(" status "))
        assertEquals("NA", byField["region"])
    }
}

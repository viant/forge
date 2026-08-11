package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.ChartDef
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.DashboardReportRuntimeBlockSummary
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

class DashboardRendererSupportTest {

    @Test
    fun dashboardUnsupportedBlockMessageNamesUnknownKind() {
        assertEquals(
            "Unsupported dashboard block: dashboard.customInsight",
            dashboardUnsupportedBlockMessage(" dashboard.customInsight ")
        )
    }

    @Test
    fun dashboardUnsupportedBlockMessageUsesGenericDefaultWhenKindMissing() {
        assertEquals("Unsupported dashboard block", dashboardUnsupportedBlockMessage(null))
        assertEquals("Unsupported dashboard block", dashboardUnsupportedBlockMessage(" "))
    }

    @Test
    fun chartDataSourceRefPrefersDirectChartRefBeforeMappedAndInheritedRefs() {
        val container = ContainerDef(
            id = "trend",
            chart = ChartDef(
                dataSourceRef = "chart_rows",
                dataSourceRefSource = "windowForm",
                dataSourceRefSelector = "mode",
                dataSourceRefs = mapOf("detail" to "detail_rows")
            )
        )

        assertEquals(
            "chart_rows",
            resolveChartDataSourceRef(
                windowForm = mapOf("mode" to "detail"),
                container = container,
                inheritedDataSourceRef = "parent_rows"
            )
        )
    }

    @Test
    fun chartDataSourceRefFallsBackToMappedThenInheritedRefs() {
        val mapped = ContainerDef(
            id = "mapped",
            chart = ChartDef(
                dataSourceRefSource = "windowForm",
                dataSourceRefSelector = "mode",
                dataSourceRefs = mapOf("detail" to "detail_rows", "summary" to "summary_rows")
            )
        )
        val inherited = ContainerDef(id = "inherited", chart = ChartDef())

        assertEquals(
            "detail_rows",
            resolveChartDataSourceRef(mapOf("mode" to "detail"), mapped, inheritedDataSourceRef = "parent_rows")
        )
        assertEquals(
            "parent_rows",
            resolveChartDataSourceRef(emptyMap(), inherited, inheritedDataSourceRef = "parent_rows")
        )
    }

    @Test
    fun reportRuntimeMobileSectionsGroupsBlocksUnderAuthoredSectionTabs() {
        val blocks = listOf(
            DashboardReportRuntimeBlockSummary("overview", "sectionBlock", "Overview"),
            DashboardReportRuntimeBlockSummary("posture", "badgesBlock", "Current posture"),
            DashboardReportRuntimeBlockSummary("delivery", "sectionBlock", "Delivery posture"),
            DashboardReportRuntimeBlockSummary("spend", "kpiBlock", "Window spend"),
            DashboardReportRuntimeBlockSummary("funnel", "tableBlock", "Bid funnel")
        )

        val sections = reportRuntimeMobileSections(blocks)

        assertEquals(listOf("Overview", "Delivery posture"), sections.map { it.title })
        assertEquals(listOf("overview", "posture"), sections[0].blocks.map { it.id })
        assertEquals(listOf("delivery", "spend", "funnel"), sections[1].blocks.map { it.id })
    }

    @Test
    fun flatReportDocumentSectionsExposeFollowingBlocksToTabView() {
        val blocks = listOf(
            DashboardReportRuntimeBlockSummary("tabs", "tabGroupBlock", "Views"),
            DashboardReportRuntimeBlockSummary("overview", "sectionBlock", "Overview"),
            DashboardReportRuntimeBlockSummary("posture", "badgesBlock", "Current posture"),
            DashboardReportRuntimeBlockSummary("delivery", "sectionBlock", "Delivery posture"),
            DashboardReportRuntimeBlockSummary("trend", "chartBlock", "Spend trend")
        )

        assertEquals(
            listOf("posture"),
            reportRuntimeSectionChildren(blocks[1], blocks).map { it.id }
        )
        assertEquals(
            listOf("trend"),
            reportRuntimeSectionChildren(blocks[3], blocks).map { it.id }
        )
    }

    @Test
    fun reportRuntimeBadgePresentationsKeepValuesAndWebSeverityTones() {
        val badges = reportRuntimeBadgePresentations(mapOf(
            "items" to JsonArray(listOf(
                JsonObject(mapOf(
                    "label" to JsonPrimitive("Setup"),
                    "displayValue" to JsonPrimitive("Ready"),
                    "tone" to JsonPrimitive("success")
                )),
                JsonObject(mapOf(
                    "label" to JsonPrimitive("Pacing"),
                    "value" to JsonPrimitive("Daily and flight behind"),
                    "tone" to JsonPrimitive("warning")
                ))
            ))
        ))

        assertEquals(listOf("Setup: Ready", "Pacing: Daily and flight behind"), badges.map { it.text })
        assertEquals(listOf("success", "warning"), badges.map { it.tone })
    }

    @Test
    fun reportRuntimeDataBarUsesAuthoredVisualAndColumnMaximum() {
        val column = com.viant.forgeandroid.runtime.ColumnDef(
            id = "count",
            cellVisual = JsonObject(mapOf("kind" to JsonPrimitive("dataBar")))
        )

        assertEquals(true, reportRuntimeColumnHasDataBar(column))
        assertEquals(1.0f, reportRuntimeDataBarFraction(249300, 249300.0))
        assertEquals(0.0072f, reportRuntimeDataBarFraction(1800, 249300.0)!!, 0.0001f)
    }

    @Test
    fun mobileTabsFlattenNestedGroupsIntoIndependentPages() {
        val root = ContainerDef(
            id = "workspace",
            tabs = com.viant.forgeandroid.runtime.TabsDef(defaultSelectedTabId = "performance"),
            containers = listOf(
                ContainerDef(
                    id = "performance",
                    title = "Performance",
                    tabs = com.viant.forgeandroid.runtime.TabsDef(defaultSelectedTabId = "delivery"),
                    containers = listOf(
                        ContainerDef(id = "delivery", title = "Delivery"),
                        ContainerDef(id = "kpis", title = "KPIs"),
                        ContainerDef(id = "pacing", title = "Pacing")
                    )
                ),
                ContainerDef(id = "summary", title = "Summary"),
                ContainerDef(id = "lines", title = "Lines")
            )
        )

        val pages = mobileTabPages(root)

        assertEquals(listOf("delivery", "kpis", "pacing", "summary", "lines"), pages.map { it.id })
        assertEquals(listOf("Delivery", "KPIs", "Pacing", "Summary", "Lines"), pages.map { it.title })
    }
}

package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.ColumnDef
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.DashboardDef
import com.viant.forgeandroid.runtime.DashboardDimensionsDef
import com.viant.forgeandroid.runtime.DashboardFieldDef
import org.junit.Assert.assertEquals
import org.junit.Test

class ChartTableModeRendererTest {

    @Test
    fun keepsAvailableRequestedModes() {
        val modes = normalizedChartTableViewModes(
            rawModes = listOf("table", "chart", "json", "table"),
            hasChart = true,
            hasTable = true
        )

        assertEquals(listOf("table", "chart"), modes)
        assertEquals("chart", resolvedChartTableViewMode("chart", modes))
        assertEquals("table", resolvedChartTableViewMode("json", modes))
        assertEquals("Chart", chartTableModeLabel("chart"))
    }

    @Test
    fun fallsBackToRenderableMode() {
        assertEquals(
            listOf("chart"),
            normalizedChartTableViewModes(rawModes = listOf("table"), hasChart = true, hasTable = false)
        )
        assertEquals(
            listOf("table"),
            normalizedChartTableViewModes(rawModes = emptyList(), hasChart = false, hasTable = true)
        )
        assertEquals(
            emptyList<String>(),
            normalizedChartTableViewModes(rawModes = emptyList(), hasChart = false, hasTable = false)
        )
    }

    @Test
    fun dashboardDimensionsModesUseNestedModesThenContainerFallback() {
        val nested = ContainerDef(
            id = "ageGroups",
            kind = "dashboard.dimensions",
            viewModes = listOf("chart"),
            dashboard = DashboardDef(
                dimensions = DashboardDimensionsDef(
                    dimension = DashboardFieldDef(key = "age_group"),
                    metric = DashboardFieldDef(key = "avails"),
                    viewModes = listOf("table", "chart")
                )
            )
        )
        val fallback = ContainerDef(
            id = "channels",
            kind = "dashboard.dimensions",
            viewModes = listOf("table", "chart"),
            dashboard = DashboardDef(
                dimensions = DashboardDimensionsDef(
                    dimension = DashboardFieldDef(key = "channel"),
                    metric = DashboardFieldDef(key = "avails")
                )
            )
        )

        assertEquals(listOf("table", "chart"), dashboardDimensionsViewModes(nested))
        assertEquals(listOf("table", "chart"), dashboardDimensionsViewModes(fallback))
    }

    @Test
    fun derivesTableFromColumns() {
        val container = ContainerDef(
            id = "capacityByChannel",
            title = "Capacity",
            viewModes = listOf("chart", "table"),
            columns = listOf(
                ColumnDef(id = "channel", label = "Channel"),
                ColumnDef(id = "avails", label = "Avails")
            )
        )

        val table = chartTableModeTable(container)

        assertEquals("Capacity", table?.title)
        assertEquals(listOf("channel", "avails"), table?.columns?.map { it.id })
    }
}

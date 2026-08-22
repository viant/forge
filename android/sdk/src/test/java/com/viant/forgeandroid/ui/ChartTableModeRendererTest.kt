package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.ColumnDef
import com.viant.forgeandroid.runtime.ChartAxisDef
import com.viant.forgeandroid.runtime.ChartDef
import com.viant.forgeandroid.runtime.ChartSeriesDef
import com.viant.forgeandroid.runtime.ChartValueOption
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.DashboardDef
import com.viant.forgeandroid.runtime.DashboardDimensionsDef
import com.viant.forgeandroid.runtime.DashboardFieldDef
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
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
            normalizedChartTableViewModes(rawModes = emptyList(), hasChart = true, hasTable = true)
        )
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

    @Test
    fun derivesFormattedTableFromChartDefinition() {
        val chart = ChartDef(
            xAxis = ChartAxisDef(dataKey = "advertiserTime"),
            series = ChartSeriesDef(
                values = listOf(
                    ChartValueOption(label = "Spend", value = "spend", format = "currency"),
                    ChartValueOption(label = "Impressions", value = "impressions", format = "compactNumber")
                )
            )
        )

        val table = chartTableModeTable(
            chart,
            listOf(mapOf("advertiserTime" to "2026-08-10T00:00:00Z", "spend" to 162.33, "impressions" to 46379))
        )

        assertEquals(listOf("advertiserTime", "spend", "impressions"), table?.columns?.map { it.id })
        assertEquals(listOf("date", "currency", "compactNumber"), table?.columns?.map { it.format })
        assertEquals("Advertiser Time", table?.columns?.first()?.label)
    }

    @Test
    fun preservesGranularityWhileResolvingHourAndDayLabels() {
        val chart = ChartDef(
            xAxis = ChartAxisDef(
                dataKey = "advertiserTime",
                tickFormat = "MM/dd",
                tickFormatSelector = "granularity",
                tickFormats = mapOf("hour" to "MM/dd h a", "day" to "MM/dd")
            )
        )

        val hourly = resolveChartTickFormat(chart, mapOf("periodView" to "30d", "granularity" to "hour"))
        val daily = resolveChartTickFormat(chart, mapOf("periodView" to "7d", "granularity" to "day"))

        assertEquals("MM/dd h a", hourly.xAxis?.tickFormat)
        assertEquals("MM/dd", daily.xAxis?.tickFormat)
        assertEquals("datetime", chartTableModeTable(hourly, listOf(mapOf("advertiserTime" to "2026-08-10T03:00:00Z")))?.columns?.first()?.format)
        assertEquals("date", chartTableModeTable(daily, listOf(mapOf("advertiserTime" to "2026-08-10T03:00:00Z")))?.columns?.first()?.format)
    }

    @Test
    fun normalizesChartSeriesValuesForTableDataBars() {
        val values = listOf<Any?>(249_300, 1_800, 1_100)

        assertEquals(1f, chartTableDataBarFraction(249_300, values))
        assertEquals(0.0072f, chartTableDataBarFraction(1_800, values)!!, 0.0001f)
        assertEquals(0f, chartTableDataBarFraction(0, listOf(0, 0)))
        assertNull(chartTableDataBarFraction("not numeric", values))
    }
}

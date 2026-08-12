package com.viant.forgeandroid.ui

import androidx.compose.ui.geometry.Offset
import com.viant.forgeandroid.runtime.ChartAxisDef
import com.viant.forgeandroid.runtime.ChartDef
import com.viant.forgeandroid.runtime.ChartSeriesDef
import com.viant.forgeandroid.runtime.ChartValueOption
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ChartRendererTest {

    @Test
    fun `sampled chart axis labels preserve boundaries and deduplicate categories`() {
        assertEquals(
            listOf("Jan", "Mar", "May", "Jul"),
            sampledChartAxisLabels(listOf("Jan", "Feb", "Feb", "Mar", "Apr", "May", "Jun", "Jul"), 4)
        )
        assertEquals(listOf("Jan", "Feb"), sampledChartAxisLabels(listOf("Jan", "Feb"), 4))
        assertEquals(listOf("Jan"), sampledChartAxisLabels(listOf("Jan", "Feb"), 1))
    }

    @Test
    fun `sampled chart axis labels preserve raw category identity`() {
        assertEquals(
            listOf(" Q1 ", "Q1", "Q2"),
            sampledChartAxisLabels(listOf(" Q1 ", "Q1", "Q2"), 4)
        )
    }

    @Test
    fun `chart axis formatter applies authored mobile date format`() {
        assertEquals("07/11", formatChartAxisLabel("2026-07-11T00:00:00Z", "MM/dd"))
        assertEquals("12AM", formatChartAxisLabel("2026-07-11T00:00:00Z", "ha"))
        assertEquals("Unparsed", formatChartAxisLabel("Unparsed", "MM/dd"))
    }

    @Test
    fun `chart axis formatter compacts unformatted ISO dates and local timestamps`() {
        assertEquals("07/11", formatChartAxisLabel("2026-07-11", null))
        assertEquals("07/11", formatChartAxisLabel("2026-07-11T14:30:00", null))
        assertEquals("Category", formatChartAxisLabel("Category", null))
    }

    @Test
    fun `chartDisplayTitle trims blanks and suppresses duplicate container titles`() {
        assertEquals("Capacity Trend", chartDisplayTitle("  Capacity Trend  "))
        assertNull(chartDisplayTitle("   "))
        assertNull(chartDisplayTitle("Capacity Trend", containerTitle = " capacity trend "))
        assertEquals("Inventory Trend", chartDisplayTitle("Inventory Trend", containerTitle = "Capacity Trend"))
    }

    @Test
    fun `prepareChartData keeps multiple named series`() {
        val chart = ChartDef(
            type = "line",
            xAxis = ChartAxisDef(dataKey = "month"),
            series = ChartSeriesDef(
                values = listOf(
                    ChartValueOption(name = "Revenue", value = "revenue"),
                    ChartValueOption(name = "Cost", value = "cost")
                )
            )
        )

        val prepared = prepareChartData(
            rows = listOf(
                mapOf("month" to "Jan", "revenue" to 10, "cost" to 6),
                mapOf("month" to "Feb", "revenue" to 14, "cost" to 7)
            ),
            chart = chart
        )

        assertEquals(2, prepared.series.size)
        assertEquals(listOf("Revenue", "Cost"), prepared.series.map { it.label })
        assertEquals(2, prepared.points.size)
        assertEquals(2, prepared.points.first().values.size)
        assertEquals(14.0, prepared.maxValue)
    }

    @Test
    fun `prepareChartData sorts temporal line points without reordering categorical charts`() {
        val rows = listOf(
            mapOf("day" to "2026-08-03", "spend" to 30),
            mapOf("day" to "2026-07-28", "spend" to 10),
            mapOf("day" to "2026-07-31", "spend" to 20)
        )
        val series = ChartSeriesDef(values = listOf(ChartValueOption(name = "Spend", value = "spend")))

        val line = prepareChartData(
            rows,
            ChartDef(type = "line", xAxis = ChartAxisDef(dataKey = "day"), series = series)
        )
        val bar = prepareChartData(
            rows,
            ChartDef(type = "bar", xAxis = ChartAxisDef(dataKey = "day"), series = series)
        )

        assertEquals(listOf("2026-07-28", "2026-07-31", "2026-08-03"), line.points.map { it.label })
        assertEquals(listOf("2026-08-03", "2026-07-28", "2026-07-31"), bar.points.map { it.label })
        assertEquals(listOf(1, 2, 0), line.points.map { it.rowIndex })
    }

    @Test
    fun `prepareChartData preserves composed series visuals and scales independent axes`() {
        val chart = ChartDef(
            type = "composed",
            xAxis = ChartAxisDef(dataKey = "day"),
            series = ChartSeriesDef(values = listOf(
                ChartValueOption(
                    label = "Spend",
                    value = "spend",
                    type = "area",
                    axis = "left",
                    color = "#2f6de1"
                ),
                ChartValueOption(
                    label = "Impressions",
                    value = "impressions",
                    type = "line",
                    axis = "right",
                    color = "#2d8a5d"
                )
            ))
        )

        val prepared = prepareChartData(
            rows = listOf(
                mapOf("day" to "Aug 1", "spend" to 10.0, "impressions" to 1000),
                mapOf("day" to "Aug 2", "spend" to 25.0, "impressions" to 4000)
            ),
            chart = chart
        )

        assertEquals(listOf("area", "line"), prepared.series.map { it.type })
        assertEquals(listOf("left", "right"), prepared.series.map { it.axis })
        assertEquals(25.0, prepared.maximumForSeries("spend"))
        assertEquals(4000.0, prepared.maximumForSeries("impressions"))
    }

    @Test
    fun `legacy composed charts use independent series scales and area line defaults`() {
        val prepared = prepareChartData(
            rows = listOf(
                mapOf("day" to "Aug 1", "spend" to 12.0, "impressions" to 1200),
                mapOf("day" to "Aug 2", "spend" to 30.0, "impressions" to 9000)
            ),
            chart = ChartDef(
                type = "composed",
                xAxis = ChartAxisDef(dataKey = "day"),
                series = ChartSeriesDef(values = listOf(
                    ChartValueOption(name = "Spend", value = "spend"),
                    ChartValueOption(name = "Impressions", value = "impressions")
                ))
            )
        )

        assertEquals(listOf("area", "line"), prepared.series.map { it.type })
        assertEquals(30.0, prepared.maximumForSeries("spend"))
        assertEquals(9000.0, prepared.maximumForSeries("impressions"))
    }

    @Test
    fun `prepareChartData uses structured series nameKey for point labels`() {
        val chart = ChartDef(
            type = "bar",
            series = ChartSeriesDef(
                nameKey = "label",
                values = listOf(
                    ChartValueOption(name = "Activity", value = "activity")
                )
            )
        )

        val prepared = prepareChartData(
            rows = listOf(
                mapOf("label" to "January", "activity" to 10),
                mapOf("label" to "February", "activity" to 14)
            ),
            chart = chart
        )

        assertEquals(listOf("January", "February"), prepared.points.map { it.label })
    }

    @Test
    fun `prepareChartData uses legacy chart keys`() {
        val chart = ChartDef(
            kind = "bar",
            xKey = "channel",
            valueKey = "avails"
        )

        val prepared = prepareChartData(
            rows = listOf(
                mapOf("channel" to "Audio", "avails" to 20),
                mapOf("channel" to "Video", "avails" to 30)
            ),
            chart = chart
        )

        assertEquals(listOf("Audio", "Video"), prepared.points.map { it.label })
        assertEquals(listOf("avails"), prepared.series.map { it.key })
        assertEquals(30.0, prepared.maxValue)
    }

    @Test
    fun `prepareChartData keeps duplicate labels distinct by series key`() {
        val chart = ChartDef(
            type = "bar",
            xAxis = ChartAxisDef(dataKey = "month"),
            series = ChartSeriesDef(
                values = listOf(
                    ChartValueOption(name = "Activity", value = "primaryActivity"),
                    ChartValueOption(name = "Activity", value = "secondaryActivity")
                )
            )
        )

        val prepared = prepareChartData(
            rows = listOf(
                mapOf("month" to "Jan", "primaryActivity" to 10, "secondaryActivity" to 14)
            ),
            chart = chart
        )
        val selection = ChartSelection(
            rowIndex = 0,
            label = "Jan",
            seriesLabel = "Activity",
            seriesKey = "secondaryActivity",
            valueLabel = "14",
            color = parseColorForTest("#16A34A")
        )

        assertEquals(listOf("primaryActivity", "secondaryActivity"), prepared.series.map { it.key })
        assertEquals(listOf("Activity", "Activity"), prepared.series.map { it.label })
        assertEquals(listOf("primaryActivity", "secondaryActivity"), prepared.points.single().values.map { it.key })
        assertTrue(selection.matches("Jan", "secondaryActivity"))
        assertEquals(false, selection.matches("Jan", "primaryActivity"))
    }

    @Test
    fun `prepareChartData uses stacked totals for bar charts`() {
        val chart = ChartDef(
            type = "bar",
            xAxis = ChartAxisDef(dataKey = "name"),
            series = ChartSeriesDef(
                values = listOf(
                    ChartValueOption(name = "Approved", value = "approved"),
                    ChartValueOption(name = "Pending", value = "pending")
                )
            )
        )

        val prepared = prepareChartData(
            rows = listOf(
                mapOf("name" to "A", "approved" to 6, "pending" to 4),
                mapOf("name" to "B", "approved" to 3, "pending" to 2)
            ),
            chart = chart
        )

        assertEquals(10.0, prepared.maxValue)
        assertEquals(10.0, prepared.points.first().total)
    }

    @Test
    fun `filterPreparedChartData keeps stacked totals for selected bar series`() {
        val chart = ChartDef(
            type = "bar",
            xAxis = ChartAxisDef(dataKey = "name"),
            series = ChartSeriesDef(
                values = listOf(
                    ChartValueOption(name = "Approved", value = "approved"),
                    ChartValueOption(name = "Pending", value = "pending"),
                    ChartValueOption(name = "Rejected", value = "rejected")
                )
            )
        )
        val prepared = prepareChartData(
            rows = listOf(
                mapOf("name" to "A", "approved" to 6, "pending" to 4, "rejected" to 2),
                mapOf("name" to "B", "approved" to 5, "pending" to 3, "rejected" to 9)
            ),
            chart = chart
        )

        val filtered = filterPreparedChartData(
            prepared = prepared,
            selectedSeriesKeys = setOf("approved", "pending"),
            chartType = "bar"
        )

        assertEquals(10.0, filtered.maxValue)
        assertEquals(10.0, filtered.points.first().total)
        assertEquals(listOf("approved", "pending"), filtered.series.map { it.key })
    }

    @Test
    fun `buildPieSlices flattens multi-series charts`() {
        val chart = ChartDef(
            type = "donut",
            xAxis = ChartAxisDef(dataKey = "quarter"),
            series = ChartSeriesDef(
                values = listOf(
                    ChartValueOption(name = "North", value = "north"),
                    ChartValueOption(name = "South", value = "south")
                )
            )
        )

        val prepared = prepareChartData(
            rows = listOf(
                mapOf("quarter" to "Q1", "north" to 8, "south" to 5)
            ),
            chart = chart
        )
        val slices = buildPieSlices(prepared)

        assertEquals(2, slices.size)
        assertTrue(slices.all { it.label.startsWith("Q1") })
        assertEquals(listOf("North", "South"), slices.map { it.seriesLabel })
    }

    @Test
    fun `chartAccessibleDataRows flattens cartesian chart values`() {
        val chart = ChartDef(
            type = "line",
            xAxis = ChartAxisDef(dataKey = "month"),
            series = ChartSeriesDef(
                values = listOf(
                    ChartValueOption(name = "Revenue", value = "revenue"),
                    ChartValueOption(name = "Cost", value = "cost")
                )
            )
        )
        val prepared = prepareChartData(
            rows = listOf(
                mapOf("month" to "Jan", "revenue" to 10, "cost" to 6.5),
                mapOf("month" to "Feb", "revenue" to 14, "cost" to 7)
            ),
            chart = chart
        )

        val rows = chartAccessibleDataRows(prepared, "line", limit = 3)

        assertEquals(3, rows.size)
        assertEquals(listOf("Jan", "Jan", "Feb"), rows.map { it.category })
        assertEquals(listOf("Revenue", "Cost", "Revenue"), rows.map { it.seriesLabel })
        assertEquals(listOf("10", "6.50", "14"), rows.map { it.valueLabel })
        assertEquals(4, chartAccessibleDataValueCount(prepared, "line"))
    }

    @Test
    fun `chartAccessibleDataRows uses pie slices for donut charts`() {
        val chart = ChartDef(
            type = "donut",
            xAxis = ChartAxisDef(dataKey = "channel"),
            series = ChartSeriesDef(
                values = listOf(
                    ChartValueOption(name = "Avails", value = "avails"),
                    ChartValueOption(name = "HH Uniques", value = "uniques")
                )
            )
        )
        val prepared = prepareChartData(
            rows = listOf(
                mapOf("channel" to "Audio", "avails" to 385800000, "uniques" to 7600000)
            ),
            chart = chart
        )

        val rows = chartAccessibleDataRows(prepared, "donut")

        assertEquals(2, rows.size)
        assertEquals(listOf("Audio · Avails", "Audio · HH Uniques"), rows.map { it.category })
        assertEquals(listOf("Avails", "HH Uniques"), rows.map { it.seriesLabel })
        assertEquals(listOf("385800000", "7600000"), rows.map { it.valueLabel })
        assertEquals(2, chartAccessibleDataValueCount(prepared, "donut"))
    }

    @Test
    fun `chartDataStateFeedback distinguishes loading empty and errors`() {
        assertEquals(
            ChartDataStateFeedback("Loading chart"),
            chartDataStateFeedback(loading = true, error = null, hasChartValues = false)
        )
        assertEquals(
            ChartDataStateFeedback("Loading chart"),
            chartDataStateFeedback(loading = false, error = null, hasResolvedRows = false, hasChartValues = false)
        )
        assertEquals(
            ChartDataStateFeedback("Unable to load chart data", isError = true),
            chartDataStateFeedback(loading = false, error = "  Timeout  ", hasChartValues = false)
        )
        assertEquals(
            ChartDataStateFeedback("No chart data"),
            chartDataStateFeedback(loading = false, error = "  ", hasChartValues = false)
        )
        assertEquals(
            null,
            chartDataStateFeedback(loading = true, error = "Timeout", hasChartValues = true)
        )
    }

    @Test
    fun `chart empty state explains future scheduled order`() {
        assertEquals(
            "Scheduled to start Aug 21, 2026",
            chartEmptyStateMessage(
                metrics = mapOf("startDate" to "2026-08-21T00:00:00Z"),
                now = java.time.Instant.parse("2026-08-12T00:00:00Z")
            )
        )
        assertEquals(
            "No activity in this period",
            chartEmptyStateMessage(
                metrics = mapOf("startDate" to "2026-08-01T00:00:00Z"),
                now = java.time.Instant.parse("2026-08-12T00:00:00Z")
            )
        )
    }

    @Test
    fun `findCartesianSelection picks nearest point`() {
        val chart = ChartDef(
            type = "line",
            xAxis = ChartAxisDef(dataKey = "month"),
            series = ChartSeriesDef(
                values = listOf(
                    ChartValueOption(name = "Revenue", value = "revenue"),
                    ChartValueOption(name = "Cost", value = "cost")
                )
            )
        )
        val prepared = prepareChartData(
            rows = listOf(
                mapOf("month" to "Jan", "revenue" to 10, "cost" to 6),
                mapOf("month" to "Feb", "revenue" to 18, "cost" to 9),
                mapOf("month" to "Mar", "revenue" to 15, "cost" to 8)
            ),
            chart = chart
        )

        val selection = findCartesianSelection(
            tap = Offset(150f, 20f),
            width = 300f,
            height = 120f,
            prepared = prepared
        )

        val chosen = assertNotNull(selection)
        assertEquals("Feb", chosen.label)
        assertEquals("Revenue", chosen.seriesLabel)
    }

    @Test
    fun `findPieSelection resolves donut slice`() {
        val prepared = PreparedChartData(
            points = listOf(
                ChartPoint(
                    rowIndex = 0,
                    label = "Q1",
                    values = listOf(
                        ChartSeriesValue("north", "North", 8.0, parseColorForTest("#2563EB")),
                        ChartSeriesValue("south", "South", 4.0, parseColorForTest("#16A34A"))
                    )
                )
            ),
            series = listOf(
                ChartSeriesDisplay("north", "North", parseColorForTest("#2563EB")),
                ChartSeriesDisplay("south", "South", parseColorForTest("#16A34A"))
            ),
            maxValue = 8.0
        )

        val slices = buildPieSlices(prepared)
        val selection = findPieSelection(
            tap = Offset(100f, 20f),
            width = 200f,
            height = 200f,
            slices = slices,
            donut = true
        )

        val chosen = assertNotNull(selection)
        assertTrue(chosen.label.startsWith("Q1"))
    }
}

private fun parseColorForTest(raw: String) = androidx.compose.ui.graphics.Color(
    raw.removePrefix("#").let { hex ->
        when (hex.length) {
            6 -> ("FF$hex").toLong(16)
            8 -> hex.toLong(16)
            else -> error("Unsupported color")
        }
    }
)

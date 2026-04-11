package com.viant.forgeandroid.ui

import androidx.compose.ui.geometry.Offset
import com.viant.forgeandroid.runtime.ChartAxisDef
import com.viant.forgeandroid.runtime.ChartDef
import com.viant.forgeandroid.runtime.ChartSeriesDef
import com.viant.forgeandroid.runtime.ChartValueOption
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class ChartRendererTest {

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

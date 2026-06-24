package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.ChartDef
import com.viant.forgeandroid.runtime.ContainerDef
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
}

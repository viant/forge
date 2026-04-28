package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class DashboardRuntimeTest {

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
            "Spend {{ summary.total_spend }} in ${'$'}{filters.region} for ${'$'}{selection.entityKey}",
            mapOf("summary" to mapOf("total_spend" to 42)),
            mapOf("region" to "NA"),
            DashboardSelectionState(entityKey = "US")
        ) as String

        assertEquals("Spend 42 in NA for US", result)
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
}

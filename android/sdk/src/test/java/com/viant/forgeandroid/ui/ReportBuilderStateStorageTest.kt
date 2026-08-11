package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.DashboardDef
import com.viant.forgeandroid.runtime.DashboardReportBuilderDef
import com.viant.forgeandroid.runtime.DashboardReportBuilderVariantDef
import com.viant.forgeandroid.runtime.ReportBuilderChartSpecDef
import com.viant.forgeandroid.runtime.ReportBuilderDynamicFilterDef
import com.viant.forgeandroid.runtime.ReportBuilderDynamicFilterGroupDef
import com.viant.forgeandroid.runtime.ReportBuilderDimensionDef
import com.viant.forgeandroid.runtime.ReportBuilderMeasureDef
import com.viant.forgeandroid.runtime.ReportBuilderResultDef
import com.viant.forgeandroid.runtime.ReportBuilderStaticFilterDef
import com.viant.forgeandroid.runtime.WindowMetadata
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ReportBuilderStateStorageTest {
    @Test
    fun reportDatasourceTimeoutIsPresentedWithoutRawTransportJargon() {
        assertEquals(
            "The report service did not respond. Try again.",
            reportBuilderLoadErrorMessage("Read timed out")
        )
    }

    @Test
    fun nonTimeoutReportDatasourceErrorsRetainUsefulDetail() {
        assertEquals(
            "Unable to load report data: invalid response",
            reportBuilderLoadErrorMessage("invalid response")
        )
    }

    @Test
    fun defaultStaticFiltersResolveRelativeDatePresetLikeWeb() {
        val state = defaultReportBuilderStaticFilters(
            filters = listOf(
                ReportBuilderStaticFilterDef(
                    id = "dateRange",
                    type = "dateRange",
                    defaultValue = buildJsonObject { put("preset", "last3Days") }
                )
            ),
            today = LocalDate.of(2026, 8, 11)
        )

        assertEquals(
            mapOf("start" to "2026-08-09", "end" to "2026-08-11"),
            state["dateRange"]
        )
    }

    @Test
    fun resolvesReportBuilderVariantFromWindowFormRef() {
        val fallback = DashboardReportBuilderDef(measures = listOf(ReportBuilderMeasureDef(id = "spend", key = "spend")))
        val forecast = DashboardReportBuilderDef(
            title = "Forecast Inventory",
            subtitle = "Build a normalized forecasting stack.",
            measures = listOf(ReportBuilderMeasureDef(id = "avails", key = "avails"))
        )
        val container = ContainerDef(
            kind = "dashboard.reportBuilder",
            dataSourceRef = "metrics",
            reportBuilderRef = "metricsCubeBuilder",
            reportBuilders = mapOf(
                "forecastingCubeBuilder" to DashboardReportBuilderVariantDef(
                    dataSourceRef = "forecasting",
                    reportBuilder = forecast
                )
            ),
            dashboard = DashboardDef(reportBuilder = fallback)
        )

        val resolved = resolveReportBuilderVariant(
            container,
            mapOf("reportBuilderRef" to "forecastingCubeBuilder")
        )

        assertFalse(resolved.missing)
        assertEquals("forecastingCubeBuilder", resolved.builderRef)
        assertEquals("forecasting", resolved.dataSourceRef)
        assertEquals("Forecast Inventory", resolved.config?.title)
        assertEquals("Build a normalized forecasting stack.", resolved.config?.subtitle)
        assertEquals("avails", resolved.config?.measures?.singleOrNull()?.key)
    }

    @Test
    fun resolvesReportBuilderVariantFromDashboardSchema() {
        val fallback = DashboardReportBuilderDef(measures = listOf(ReportBuilderMeasureDef(id = "spend", key = "spend")))
        val forecast = DashboardReportBuilderDef(measures = listOf(ReportBuilderMeasureDef(id = "avails", key = "avails")))
        val container = ContainerDef(
            kind = "dashboard.reportBuilder",
            dataSourceRef = "metrics",
            dashboard = DashboardDef(
                reportBuilderRef = "metricsCubeBuilder",
                reportBuilders = mapOf(
                    "forecastingCubeBuilder" to DashboardReportBuilderVariantDef(
                        dataSourceRef = "forecasting",
                        reportBuilder = forecast
                    )
                ),
                reportBuilder = fallback
            )
        )

        val resolved = resolveReportBuilderVariant(
            container,
            mapOf("reportBuilderRef" to "forecastingCubeBuilder")
        )

        assertFalse(resolved.missing)
        assertEquals("forecastingCubeBuilder", resolved.builderRef)
        assertEquals("forecasting", resolved.dataSourceRef)
        assertEquals("avails", resolved.config?.measures?.singleOrNull()?.key)
    }

    @Test
    fun fallsBackToDefaultReportBuilderWhenRequestedRefIsDefault() {
        val fallback = DashboardReportBuilderDef(measures = listOf(ReportBuilderMeasureDef(id = "spend", key = "spend")))
        val forecast = DashboardReportBuilderDef(measures = listOf(ReportBuilderMeasureDef(id = "avails", key = "avails")))
        val container = ContainerDef(
            kind = "dashboard.reportBuilder",
            dataSourceRef = "metrics",
            reportBuilderRef = "metricsCubeBuilder",
            reportBuilders = mapOf(
                "forecastingCubeBuilder" to DashboardReportBuilderVariantDef(
                    dataSourceRef = "forecasting",
                    reportBuilder = forecast
                )
            ),
            dashboard = DashboardDef(reportBuilder = fallback)
        )

        val resolved = resolveReportBuilderVariant(
            container,
            mapOf("reportBuilderRef" to "metricsCubeBuilder")
        )

        assertFalse(resolved.missing)
        assertEquals("metricsCubeBuilder", resolved.builderRef)
        assertEquals("metrics", resolved.dataSourceRef)
        assertEquals("spend", resolved.config?.measures?.singleOrNull()?.key)
    }

    @Test
    fun resolvesReportBuilderVariantWithoutLegacyFallbackConfig() {
        val forecast = DashboardReportBuilderDef(
            title = "Forecast Inventory",
            measures = listOf(ReportBuilderMeasureDef(id = "avails", key = "avails"))
        )
        val container = ContainerDef(
            kind = "dashboard.reportBuilder",
            dataSourceRef = "metrics",
            reportBuilderRef = "forecastingCubeBuilder",
            reportBuilders = mapOf(
                "forecastingCubeBuilder" to DashboardReportBuilderVariantDef(
                    dataSourceRef = "forecasting",
                    reportBuilder = forecast
                )
            )
        )

        val resolved = resolveReportBuilderVariant(container, emptyMap())

        assertFalse(resolved.missing)
        assertEquals("forecastingCubeBuilder", resolved.builderRef)
        assertEquals("forecasting", resolved.dataSourceRef)
        assertEquals("Forecast Inventory", resolved.config?.title)
        assertEquals("avails", resolved.config?.measures?.singleOrNull()?.key)
    }

    @Test
    fun reportsMissingRequestedReportBuilderVariant() {
        val container = ContainerDef(
            kind = "dashboard.reportBuilder",
            dataSourceRef = "metrics",
            reportBuilders = mapOf(
                "metricsCubeBuilder" to DashboardReportBuilderVariantDef(
                    dataSourceRef = "metrics",
                    reportBuilder = DashboardReportBuilderDef()
                )
            ),
            dashboard = DashboardDef(reportBuilder = DashboardReportBuilderDef())
        )

        val resolved = resolveReportBuilderVariant(
            container,
            mapOf("reportBuilderRef" to "forecastingCubeBuilder")
        )

        assertTrue(resolved.missing)
        assertEquals("forecastingCubeBuilder", resolved.builderRef)
    }

    @Test
    fun shouldAutoCollapseReportBuilderFiltersOnlyOncePerCompletedResult() {
        assertEquals(
            true,
            shouldAutoCollapseReportBuilderFilters(
                hasRows = true,
                completedRequestSignature = """{"filters":{"country":["US"]}}""",
                lastCollapsedRequestSignature = ""
            )
        )
        assertEquals(
            false,
            shouldAutoCollapseReportBuilderFilters(
                hasRows = true,
                completedRequestSignature = """{"filters":{"country":["US"]}}""",
                lastCollapsedRequestSignature = """{"filters":{"country":["US"]}}"""
            )
        )
        assertEquals(
            false,
            shouldAutoCollapseReportBuilderFilters(
                hasRows = true,
                completedRequestSignature = """ {"filters":{"country":["US"]}} """,
                lastCollapsedRequestSignature = """{"filters":{"country":["US"]}}"""
            )
        )
        assertEquals(
            false,
            shouldAutoCollapseReportBuilderFilters(
                hasRows = false,
                completedRequestSignature = """{"filters":{"country":["US"]}}""",
                lastCollapsedRequestSignature = ""
            )
        )
        assertEquals(
            false,
            shouldAutoCollapseReportBuilderFilters(
                hasRows = true,
                completedRequestSignature = "",
                lastCollapsedRequestSignature = ""
            )
        )
    }

    @Test
    fun activeReportBuilderFilterCountMatchesConfiguredValues() {
        val filters = listOf(
            ReportBuilderStaticFilterDef(id = "dateRange", type = "dateRange"),
            ReportBuilderStaticFilterDef(id = "channels", multiple = true),
            ReportBuilderStaticFilterDef(id = "empty", multiple = true)
        )
        val count = activeReportBuilderFilterCount(
            staticFilters = filters,
            staticState = mapOf(
                "dateRange" to mapOf("start" to "2026-06-03", "end" to ""),
                "channels" to listOf("display", "audio"),
                "empty" to emptyList<String>()
            ),
            dynamicGroups = mapOf(
                "include" to listOf(
                    ReportBuilderDynamicRowState(
                        id = "row-1",
                        filterId = "publisher",
                        enabled = true,
                        selections = listOf(
                            ReportBuilderDynamicSelectionState(
                                value = kotlinx.serialization.json.JsonPrimitive("rubicon"),
                                label = "Rubicon"
                            )
                        )
                    ),
                    ReportBuilderDynamicRowState(
                        id = "row-2",
                        filterId = "publisher",
                        enabled = true,
                        selections = emptyList()
                    )
                )
            )
        )

        assertEquals(4, count)
    }

    @Test
    fun activeReportBuilderFilterCountExcludesHiddenScopeRows() {
        val count = activeReportBuilderFilterCount(
            staticFilters = listOf(ReportBuilderStaticFilterDef(id = "dateRange", type = "dateRange")),
            staticState = mapOf(
                "dateRange" to mapOf("start" to "2026-08-09", "end" to "2026-08-11")
            ),
            dynamicGroups = mapOf(
                "scope" to listOf(
                    ReportBuilderDynamicRowState(
                        id = "scope-order",
                        filterId = "adOrderIds",
                        selections = listOf(
                            ReportBuilderDynamicSelectionState(
                                value = kotlinx.serialization.json.JsonPrimitive(2664518),
                                label = "Local Forecast Order"
                            )
                        )
                    )
                ),
                "location" to listOf(
                    ReportBuilderDynamicRowState(
                        id = "country",
                        filterId = "country",
                        selections = listOf(
                            ReportBuilderDynamicSelectionState(
                                value = kotlinx.serialization.json.JsonPrimitive("US"),
                                label = "US"
                            )
                        )
                    )
                )
            ),
            hiddenDynamicGroupIds = setOf("scope")
        )

        assertEquals(2, count)
    }

    @Test
    fun persistStoredStateToWindowFormUsesNestedStateKey() {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        val state = runtime.openWindowInline(
            windowKey = "analytics",
            title = "Analytics",
            metadata = WindowMetadata()
        )
        val stored = StoredReportBuilderState(
            selectedMeasures = listOf("avails"),
            selectedDimensions = listOf("eventDate"),
            viewMode = "table",
            dynamicGroups = mapOf(
                "include" to listOf(
                    ReportBuilderDynamicRowState(
                        id = "row-1",
                        filterId = "includeSiteType",
                        enabled = true,
                        selections = listOf(
                            ReportBuilderDynamicSelectionState(
                                value = kotlinx.serialization.json.JsonPrimitive("Website"),
                                label = "Website"
                            )
                        )
                    )
                )
            ),
            dynamicFilterValues = mapOf("includeSiteType" to "Website"),
            dynamicFilterSelections = mapOf(
                "includeSiteType" to listOf(
                    ReportBuilderDynamicSelectionState(
                        value = kotlinx.serialization.json.JsonPrimitive("Website"),
                        label = "Website"
                    )
                )
            ),
            activeDynamicFilterKeys = listOf("includeSiteType")
        )

        persistStoredStateToWindowForm(runtime, state.windowId, "reportBuilder:analytics", stored)

        val loaded = loadStoredStateFromWindowForm(runtime, state.windowId, "reportBuilder:analytics")
        assertNotNull(loaded)
        assertEquals(listOf("avails"), loaded.selectedMeasures)
        assertEquals("Website", loaded.dynamicFilterValues["includeSiteType"])
        assertEquals("includeSiteType", loaded.dynamicGroups["include"]?.firstOrNull()?.filterId)
        assertEquals(listOf("includeSiteType"), loaded.activeDynamicFilterKeys)
    }

    @Test
    fun reportBuilderVariantStateKeySeparatesSharedContainerVariants() {
        assertEquals(
            "reportBuilder:metricsCubeBuilder",
            reportBuilderVariantStateKey("reportBuilder", "metricsCubeBuilder")
        )
        assertEquals(
            "reportBuilder:forecastingCubeBuilder",
            reportBuilderVariantStateKey("reportBuilder", "forecastingCubeBuilder")
        )
        assertEquals(
            "reportBuilder",
            reportBuilderVariantStateKey("reportBuilder", "")
        )
        assertEquals(
            "reportBuilder:forecasting/cube.builder",
            reportBuilderVariantStateKey("reportBuilder", "forecasting/cube.builder")
        )
    }

    @Test
    fun loadsWebCompatibleVariantStateFromConversationWindowForm() {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        val state = runtime.openWindowInline(
            windowKey = "conversation-report",
            title = "Order Performance Report",
            metadata = WindowMetadata()
        )
        runtime.setWindowFormValues(
            state.windowId,
            mapOf(
                "reportBuilderRef" to "metricsCubeBuilder",
                "reportBuilder:metricsCubeBuilder" to mapOf(
                    "selectedMeasures" to listOf("avails", "bids"),
                    "selectedDimensions" to listOf("eventDate"),
                    "viewMode" to "chart",
                    "dynamicFilterValues" to mapOf("orderIds" to "2676237"),
                    "activeDynamicFilterKeys" to listOf("orderIds")
                )
            ),
            replace = true
        )

        val loaded = loadStoredStateFromWindowForm(
            runtime,
            state.windowId,
            reportBuilderVariantStateKey("reportBuilder", "metricsCubeBuilder")
        )

        assertNotNull(loaded)
        assertEquals(listOf("avails", "bids"), loaded.selectedMeasures)
        assertEquals(listOf("eventDate"), loaded.selectedDimensions)
        assertEquals("chart", loaded.viewMode)
        assertEquals("2676237", loaded.dynamicFilterValues["orderIds"])
        assertEquals(listOf("orderIds"), loaded.activeDynamicFilterKeys)
    }

    @Test
    fun migratedDynamicGroupsBuildsRowStateFromLegacyStoredFields() {
        val config = DashboardReportBuilderDef(
            dynamicFilterGroups = listOf(
                ReportBuilderDynamicFilterGroupDef(
                    id = "include",
                    filters = listOf(
                        ReportBuilderDynamicFilterDef(
                            id = "includeSiteType",
                            label = "Site Type",
                            manualValueType = "string"
                        )
                    )
                )
            )
        )
        val legacyState = StoredReportBuilderState(
            activeDynamicFilterKeys = listOf("includeSiteType"),
            dynamicFilterValues = mapOf("includeSiteType" to "Website, Application"),
            dynamicFilterSelections = mapOf(
                "includeSiteType" to listOf(
                    ReportBuilderDynamicSelectionState(
                        value = kotlinx.serialization.json.JsonPrimitive("Website"),
                        label = "Website"
                    ),
                    ReportBuilderDynamicSelectionState(
                        value = kotlinx.serialization.json.JsonPrimitive("Application"),
                        label = "Application"
                    )
                )
            )
        )

        val migrated = migratedDynamicGroups(config, legacyState)

        val includeRows = migrated["include"]
        assertNotNull(includeRows)
        assertEquals(1, includeRows.size)
        assertEquals("includeSiteType", includeRows.first().filterId)
        assertEquals(listOf("Website", "Application"), includeRows.first().selections.map { it.label })
        assertEquals("Website,Application", legacyDynamicFilterValues(migrated)["includeSiteType"])
        assertEquals(listOf("includeSiteType"), legacyActiveDynamicFilterKeys(migrated))
    }

    @Test
    fun resolveAutoAppliedReportBuilderChartSpecUsesFirstCompatiblePreset() {
        val config = DashboardReportBuilderDef(
            measures = listOf(
                ReportBuilderMeasureDef(id = "avails", key = "avails"),
                ReportBuilderMeasureDef(id = "hhUniqs", key = "hhUniqs")
            ),
            dimensions = listOf(
                ReportBuilderDimensionDef(id = "eventDate", key = "eventDate"),
                ReportBuilderDimensionDef(id = "channelV2", key = "channelV2"),
                ReportBuilderDimensionDef(id = "siteType", key = "siteType")
            ),
            result = ReportBuilderResultDef(
                chartCreationMode = "explicit",
                autoApplyDefaultChartOnResult = true,
                defaultChartSpecs = listOf(
                    ReportBuilderChartSpecDef(
                        title = "Needs extra dimension",
                        type = "donut",
                        xField = "siteType",
                        yFields = listOf("avails")
                    ),
                    ReportBuilderChartSpecDef(
                        title = "Unsupported multi measure",
                        type = "bar",
                        xField = "eventDate",
                        yFields = listOf("avails", "hhUniqs")
                    ),
                    ReportBuilderChartSpecDef(
                        title = "Compatible trend",
                        type = "line",
                        xField = "eventDate",
                        yFields = listOf("avails"),
                        seriesField = "channelV2"
                    )
                )
            )
        )

        val resolved = resolveAutoAppliedReportBuilderChartSpec(
            config = config,
            selectedMeasures = listOf("avails"),
            selectedDimensions = listOf("eventDate", "channelV2")
        )

        assertNotNull(resolved)
        assertEquals("Compatible trend", resolved.title)
        assertEquals("line", resolved.type)
    }

    @Test
    fun resolveAutoAppliedReportBuilderChartSpecReturnsNullWhenDisabled() {
        val config = DashboardReportBuilderDef(
            measures = listOf(ReportBuilderMeasureDef(id = "avails", key = "avails")),
            dimensions = listOf(ReportBuilderDimensionDef(id = "eventDate", key = "eventDate")),
            result = ReportBuilderResultDef(
                chartCreationMode = "explicit",
                autoApplyDefaultChartOnResult = false,
                defaultChartSpecs = listOf(
                    ReportBuilderChartSpecDef(
                        title = "Trend",
                        type = "line",
                        xField = "eventDate",
                        yFields = listOf("avails")
                    )
                )
            )
        )

        val resolved = resolveAutoAppliedReportBuilderChartSpec(
            config = config,
            selectedMeasures = listOf("avails"),
            selectedDimensions = listOf("eventDate")
        )

        assertNull(resolved)
    }
}

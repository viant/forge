package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.DashboardReportBuilderDef
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
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class ReportBuilderStateStorageTest {
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

        persistStoredStateToWindowForm(runtime, state.windowId, "reportBuilder.analytics", stored)

        val loaded = loadStoredStateFromWindowForm(runtime, state.windowId, "reportBuilder.analytics")
        assertNotNull(loaded)
        assertEquals(listOf("avails"), loaded.selectedMeasures)
        assertEquals("Website", loaded.dynamicFilterValues["includeSiteType"])
        assertEquals("includeSiteType", loaded.dynamicGroups["include"]?.firstOrNull()?.filterId)
        assertEquals(listOf("includeSiteType"), loaded.activeDynamicFilterKeys)
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

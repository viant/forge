package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.DashboardReportBuilderDef
import com.viant.forgeandroid.runtime.ReportBuilderDynamicFilterDef
import com.viant.forgeandroid.runtime.ReportBuilderDynamicFilterGroupDef
import com.viant.forgeandroid.runtime.WindowMetadata
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

class ReportBuilderStateStorageTest {
    @Test
    fun persistStoredStateToWindowFormUsesNestedStateKey() {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        val state = runtime.openWindowInline(
            windowKey = "forecasting",
            title = "Forecasting",
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

        persistStoredStateToWindowForm(runtime, state.windowId, "reportBuilder.forecasting", stored)

        val loaded = loadStoredStateFromWindowForm(runtime, state.windowId, "reportBuilder.forecasting")
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
}

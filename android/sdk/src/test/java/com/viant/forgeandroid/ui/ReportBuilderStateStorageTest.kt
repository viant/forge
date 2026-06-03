package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.ForgeRuntime
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
        assertEquals(listOf("includeSiteType"), loaded.activeDynamicFilterKeys)
    }
}

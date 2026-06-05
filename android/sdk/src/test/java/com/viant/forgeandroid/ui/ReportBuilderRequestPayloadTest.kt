package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.DashboardReportBuilderDef
import com.viant.forgeandroid.runtime.ReportBuilderDynamicFilterDef
import com.viant.forgeandroid.runtime.ReportBuilderDynamicFilterGroupDef
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ReportBuilderRequestPayloadTest {
    @Test
    fun buildReportBuilderRequestPayloadUsesEnabledRowSelectionsAndSkipsHookMappedRows() {
        val config = DashboardReportBuilderDef(
            dynamicFilterGroups = listOf(
                ReportBuilderDynamicFilterGroupDef(
                    id = "include",
                    filters = listOf(
                        ReportBuilderDynamicFilterDef(
                            id = "includeSiteType",
                            paramPath = "filters.includeSiteType",
                            multiple = true,
                            emitArray = true,
                            manualValueType = "string"
                        ),
                        ReportBuilderDynamicFilterDef(
                            id = "includeIris",
                            paramPath = "filters.includeIris",
                            requestMapping = "hook",
                            multiple = true
                        )
                    )
                )
            )
        )

        val payload = buildReportBuilderRequestPayload(
            config = config,
            selectedMeasures = emptyList(),
            selectedDimensions = emptyList(),
            staticFilters = emptyMap(),
            dynamicGroups = mapOf(
                "include" to listOf(
                    ReportBuilderDynamicRowState(
                        id = "row-1",
                        filterId = "includeSiteType",
                        enabled = true,
                        selections = listOf(
                            ReportBuilderDynamicSelectionState(
                                value = JsonPrimitive("Website"),
                                label = "Website"
                            ),
                            ReportBuilderDynamicSelectionState(
                                value = JsonPrimitive("Application"),
                                label = "Application"
                            )
                        )
                    ),
                    ReportBuilderDynamicRowState(
                        id = "row-2",
                        filterId = "includeSiteType",
                        enabled = false,
                        selections = listOf(
                            ReportBuilderDynamicSelectionState(
                                value = JsonPrimitive("CTV App"),
                                label = "CTV App"
                            )
                        )
                    ),
                    ReportBuilderDynamicRowState(
                        id = "row-3",
                        filterId = "includeIris",
                        enabled = true,
                        selections = listOf(
                            ReportBuilderDynamicSelectionState(
                                value = JsonPrimitive("18-24"),
                                label = "18-24"
                            )
                        )
                    )
                )
            ),
            hookState = emptyMap(),
            hookInvoker = { _, _ -> null }
        )

        val input = payload["input"] as? Map<*, *>
        val query = input?.get("query") as? Map<*, *>
        val siteTypes = query?.get("filters") as? Map<*, *>
        val includeSiteType = siteTypes?.get("includeSiteType") as? List<*>

        assertEquals(listOf("Website", "Application"), includeSiteType)
        assertFalse((siteTypes ?: emptyMap<Any?, Any?>()).containsKey("includeIris"))
    }

    @Test
    fun buildReportBuilderRequestPayloadAppliesBuildRequestHook() {
        val config = DashboardReportBuilderDef(
            hooks = com.viant.forgeandroid.runtime.ReportBuilderHooksDef(
                buildRequest = "Analytics.reportBuilderHooks.buildRequest"
            )
        )

        val payload = buildReportBuilderRequestPayload(
            config = config,
            selectedMeasures = emptyList(),
            selectedDimensions = emptyList(),
            staticFilters = emptyMap(),
            dynamicGroups = emptyMap(),
            hookState = mapOf("viewMode" to "table"),
            hookInvoker = { functionName, props ->
                assertEquals("Analytics.reportBuilderHooks.buildRequest", functionName)
                val state = props["state"] as? JsonObject
                assertTrue(state != null)
                mapOf("input" to mapOf("query" to mapOf("hooked" to true)))
            }
        )

        val input = payload["input"] as? Map<*, *>
        val query = input?.get("query") as? Map<*, *>
        assertEquals(true, query?.get("hooked"))
    }
}

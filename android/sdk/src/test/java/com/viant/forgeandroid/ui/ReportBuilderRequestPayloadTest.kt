package com.viant.forgeandroid.ui

import com.dokar.quickjs.QuickJs
import com.dokar.quickjs.evaluate
import com.viant.forgeandroid.runtime.ActionHookRuntime
import com.viant.forgeandroid.runtime.ActionsDef
import com.viant.forgeandroid.runtime.DashboardReportBuilderDef
import com.viant.forgeandroid.runtime.ReportBuilderHooksDef
import com.viant.forgeandroid.runtime.ReportBuilderDynamicFilterDef
import com.viant.forgeandroid.runtime.ReportBuilderDynamicFilterGroupDef
import com.viant.forgeandroid.runtime.WindowMetadata
import kotlinx.coroutines.Dispatchers
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ReportBuilderRequestPayloadTest {
    @BeforeTest
    fun installJvmEvaluator() {
        ActionHookRuntime.testScriptEvaluator = { script ->
            val quickJs = QuickJs.create(Dispatchers.Default)
            try {
                quickJs.evaluate<String>(script)
            } finally {
                quickJs.close()
            }
        }
    }

    @AfterTest
    fun clearJvmEvaluator() {
        ActionHookRuntime.testScriptEvaluator = null
    }

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

    @Test
    fun applyReportBuilderInitializeStateHookMapsPrefillIntoGenericState() {
        val metadata = WindowMetadata(
            namespace = "Analytics",
            actions = ActionsDef(
                code = """
                    (() => ({
                      Analytics: {
                        reportBuilderHooks: {
                          initializeState: (props = {}) => ({
                            ...props.state,
                            dynamicGroups: {
                              include: [
                                {
                                  id: "prefill_includeRecordIds",
                                  filterId: "includeRecordIds",
                                  enabled: true,
                                  selections: (props.windowForm?.prefill?.includeRecordIds || []).map((value) => ({
                                    value,
                                    label: String(value),
                                    record: { value, label: String(value) }
                                  }))
                                }
                              ]
                            }
                          })
                        }
                      }
                    }))()
                """.trimIndent()
            )
        )
        val config = DashboardReportBuilderDef(
            hooks = ReportBuilderHooksDef(
                initializeState = "reportBuilderHooks.initializeState"
            )
        )
        val fallback = ReportBuilderStateValues(
            selectedMeasures = listOf("avails"),
            selectedDimensions = emptyList(),
            chartSpec = null,
            viewMode = "table",
            staticFilters = emptyMap(),
            dynamicGroups = emptyMap()
        )

        val next = applyReportBuilderInitializeStateHook(
            metadata = metadata,
            config = config,
            values = fallback,
            windowForm = mapOf(
                "prefill" to mapOf(
                    "includeRecordIds" to listOf(70731)
                )
            )
        )

        val row = next.dynamicGroups["include"]?.firstOrNull()
        assertEquals("includeRecordIds", row?.filterId)
        assertEquals(JsonPrimitive(70731), row?.selections?.firstOrNull()?.value)
    }
}

package com.viant.forgeandroid.runtime

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers

class WindowFormRuntimeTest {
    @Test
    fun openWindowInlineSeedsWindowFormFromMetadataOnInitConstants() {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )

        val state = runtime.openWindowInline(
            windowKey = "metrics",
            title = "Metrics",
            metadata = WindowMetadata(
                on = listOf(
                    ExecutionDef(
                        event = "onInit",
                        handler = "dataSource.setWindowFormData",
                        parameters = listOf(
                            ParameterDef(name = "granularity", input = "const", location = "day"),
                            ParameterDef(name = "periodView", input = "const", location = "today")
                        )
                    )
                )
            )
        )

        val windowForm = runtime.windowFormValue(state.windowId)
        assertEquals("day", windowForm["granularity"])
        assertEquals("today", windowForm["periodView"])
    }

    @Test
    fun setWindowFormValueMergesNestedMaps() {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        val state = runtime.openWindowInline(windowKey = "metrics", title = "Metrics", metadata = WindowMetadata())

        runtime.setWindowFormValue(
            state.windowId,
            mapOf(
                "prefill" to mapOf(
                    "accountId" to 7
                )
            ),
            replace = true
        )
        runtime.setWindowFormValue(
            state.windowId,
            mapOf(
                "prefill" to mapOf(
                    "segmentId" to 9
                )
            )
        )

        val windowForm = runtime.windowFormValue(state.windowId)
        val prefill = JsonUtil.asStringMap(windowForm["prefill"])
        assertEquals(7, prefill["accountId"])
        assertEquals(9, prefill["segmentId"])
    }

    @Test
    fun setWindowFormValueBumpsGenericPrefillRevisionForRepeatedHandoffs() {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        val state = runtime.openWindowInline(windowKey = "metrics", title = "Metrics", metadata = WindowMetadata())

        runtime.setWindowFormValue(
            state.windowId,
            mapOf("prefill" to mapOf("recordId" to 7))
        )
        runtime.setWindowFormValue(
            state.windowId,
            mapOf("prefill" to mapOf("recordId" to 7))
        )

        val windowForm = runtime.windowFormValue(state.windowId)
        val meta = JsonUtil.asStringMap(windowForm["__forge"])
        assertEquals(2, meta["prefillRevision"])
    }

    @Test
    fun openWindowInlineSeedsWindowFormFromScopedItems() {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )

        val state = runtime.openWindowInline(
            windowKey = "metrics",
            title = "Metrics",
            metadata = WindowMetadata(
                view = ViewDef(
                    content = ContentDef(
                        containers = listOf(
                            ContainerDef(
                                id = "root",
                                items = listOf(
                                    ItemDef(
                                        id = "granularity",
                                        bindingPath = "granularity",
                                        scope = "windowForm",
                                        value = kotlinx.serialization.json.JsonPrimitive("day")
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )

        val windowForm = runtime.windowFormValue(state.windowId)
        assertEquals("day", windowForm["granularity"])
    }

    @Test
    fun dataSourceSetWindowFormDataResolvesWindowFormParameters() {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        val state = runtime.openWindowInline(
            windowKey = "metrics",
            title = "Metrics",
            metadata = WindowMetadata(
                dataSources = mapOf(
                    "runs" to DataSourceDef()
                )
            )
        )

        runtime.setWindowFormValue(
            state.windowId,
            mapOf(
                "prefill" to mapOf(
                    "recordId" to 2637048,
                    "granularity" to "hour"
                )
            ),
            replace = true
        )

        val context = runtime.windowContext(state.windowId).context("runs")
        runtime.execute(
            ExecutionDef(
                handler = "dataSource.setWindowFormData",
                parameters = listOf(
                    ParameterDef(name = "selectedRecordId", input = "windowForm", location = "prefill.recordId"),
                    ParameterDef(name = "selectedGranularity", input = "windowForm", location = "prefill.granularity")
                )
            ),
            context
        )

        val windowForm = runtime.windowFormValue(state.windowId)
        assertEquals(2637048, windowForm["selectedRecordId"])
        assertEquals("hour", windowForm["selectedGranularity"])
    }

    @Test
    fun parameterResolverResolvesWindowFormInputsForDatasourceParameters() {
        val signals = SignalRegistry()
        val metadata = Signal<WindowMetadata?>(null).also {
            it.set(
                WindowMetadata(
                    dataSources = mapOf(
                        "record_performance_period_today" to DataSourceDef(
                            parameters = listOf(
                                ParameterDef(name = "record_id", input = "windowForm", location = "recordId.0"),
                                ParameterDef(name = "period", input = "const", location = "today"),
                                ParameterDef(name = "granularity", input = "windowForm", location = "granularity")
                            )
                        )
                    )
                )
            )
        }
        val runtime = DataSourceRuntime(
            signals = signals,
            restClient = RestClient(EndpointRegistry(emptyMap())),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        val window = WindowContext(
            windowId = "recordWindow",
            metadata = metadata,
            signals = signals,
            dataSourceRuntime = runtime
        )
        val context = runtime.attach(window, "record_performance_period_today")
        signals.form(WindowIdentity("recordWindow").windowFormId()).set(
            mapOf(
                "recordId" to listOf(2673453),
                "granularity" to "day"
            )
        )

        val resolved = ParameterResolver().resolveFlat(
            context.dataSource.parameters,
            context
        )

        assertEquals("2673453", resolved["record_id"]?.toString())
        assertEquals("today", resolved["period"])
        assertEquals("day", resolved["granularity"])
    }
}

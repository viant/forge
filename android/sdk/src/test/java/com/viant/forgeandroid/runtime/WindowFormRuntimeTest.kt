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
                    "advertiserId" to 7
                )
            ),
            replace = true
        )
        runtime.setWindowFormValue(
            state.windowId,
            mapOf(
                "prefill" to mapOf(
                    "campaignId" to 9
                )
            )
        )

        val windowForm = runtime.windowFormValue(state.windowId)
        val prefill = JsonUtil.asStringMap(windowForm["prefill"])
        assertEquals(7, prefill["advertiserId"])
        assertEquals(9, prefill["campaignId"])
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
}

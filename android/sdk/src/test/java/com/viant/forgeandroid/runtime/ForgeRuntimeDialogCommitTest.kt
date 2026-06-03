package com.viant.forgeandroid.runtime

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers

class ForgeRuntimeDialogCommitTest {
    @Test
    fun dialogCommitPrefersStructuredMultiSelectionOverFormState() {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        val state = runtime.openWindowInline(
            windowKey = "w1",
            title = "W1",
            metadata = WindowMetadata(
                dataSources = mapOf(
                    "dialogSource" to DataSourceDef(selectionMode = "multi"),
                    "target" to DataSourceDef()
                )
            )
        )

        val dialogKey = "${state.windowId}Dialogpick"
        runtime.registerPendingDialog(
            dialogKey,
            PendingDialog(
                callerWindowId = state.windowId,
                callerDataSourceRef = "target",
                outbound = listOf(
                    ParameterDef(name = "allSelections", location = "selection", to = "target:form"),
                    ParameterDef(name = "selectedValue", location = "selected.value", to = "target:form")
                )
            )
        )

        val dialogContext = runtime.windowContext(state.windowId).context("dialogSource")
        dialogContext.setForm(mapOf("value" to "web"))
        dialogContext.setSelection(
            SelectionState(
                selected = mapOf(
                    "value" to "web",
                    "label" to "Website"
                ),
                selection = listOf(
                    mapOf(
                        "value" to "app",
                        "label" to "Application"
                    ),
                    mapOf(
                        "value" to "web",
                        "label" to "Website"
                    )
                )
            )
        )

        runtime.execute(
            ExecutionDef(action = "dialog.commit"),
            dialogContext,
            mapOf(
                "dialogId" to "pick",
                "windowId" to state.windowId
            )
        )

        val targetForm = runtime.windowContext(state.windowId).context("target").peekForm()
        val selections = targetForm["allSelections"] as? List<*>

        assertEquals("web", targetForm["selectedValue"])
        assertEquals(2, selections?.size)
        val firstSelection = selections?.firstOrNull() as? Map<*, *>
        assertEquals("app", firstSelection?.get("value"))
        assertTrue(runtime.pendingDialog(dialogKey) == null)
    }
}

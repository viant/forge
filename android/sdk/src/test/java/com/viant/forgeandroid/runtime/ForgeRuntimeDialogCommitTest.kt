package com.viant.forgeandroid.runtime

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking

class ForgeRuntimeDialogCommitTest {
    @Test
    fun executeReturnsHandlerJobForSubmitStateTracking() = runBlocking {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        var handled = false
        runtime.registerHandler("planner.submit") {
            handled = true
            "ok"
        }

        val job = runtime.execute(ExecutionDef(handler = "planner.submit"), null)

        assertNotNull(job)
        job.join()
        assertTrue(handled)
        assertNull(runtime.execute(ExecutionDef(handler = "missing.handler"), null))
    }

    @Test
    fun reportRuntimeExecuteActionDispatchesRefinementHandler() = runBlocking {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        var captured: Map<String, Any?>? = null
        runtime.registerHandler("reportRuntime.applyRefinement") { args ->
            captured = JsonUtil.asStringMap(args.args["refinement"])
            null
        }
        val payload = dashboardReportRuntimeActionExecutionPayload(
            DashboardReportRuntimeActionExecution(
                id = "keep:channel",
                label = "Keep only",
                kind = "keep",
                refinement = DashboardReportRuntimeActionRefinement(
                    op = "keep",
                    field = "channel",
                    value = "Display",
                    sourceBlockId = "table",
                    fieldLabel = "Channel",
                    label = "Keep only = Display"
                )
            )
        )

        val job = runtime.execute(
            ExecutionDef(handler = "reportRuntime.executeAction"),
            context = null,
            args = mapOf("execution" to payload)
        )

        assertNotNull(job)
        job.join()
        assertEquals(
            mapOf(
                "op" to "keep",
                "field" to "channel",
                "value" to "Display",
                "sourceBlockId" to "table",
                "fieldLabel" to "Channel",
                "label" to "Keep only = Display"
            ),
            captured
        )
    }

    @Test
    fun reportRuntimeExecuteActionDispatchesDrillHandler() = runBlocking {
        val runtime = ForgeRuntime(
            endpoints = emptyMap(),
            scope = CoroutineScope(Dispatchers.Unconfined)
        )
        var captured: Map<String, Any?>? = null
        runtime.registerHandler("reportRuntime.applyDrillTransition") { args ->
            captured = args.args
            null
        }
        val payload = dashboardReportRuntimeActionExecutionPayload(
            DashboardReportRuntimeActionExecution(
                id = "drill_region",
                label = "Drill to Region",
                kind = "drill",
                refinement = DashboardReportRuntimeActionRefinement(
                    op = "drill",
                    field = "country",
                    value = "US",
                    sourceBlockId = "chart",
                    fieldLabel = "Market",
                    label = "Drill to Region = US"
                ),
                transition = DashboardReportRuntimeActionTransition(
                    sourceField = "country",
                    nextFieldRef = "region",
                    sourceBlockId = "chart"
                )
            )
        )

        val job = runtime.execute(
            ExecutionDef(handler = "reportRuntime.executeAction"),
            context = null,
            args = mapOf("execution" to payload)
        )

        assertNotNull(job)
        job.join()
        assertEquals("country", captured?.get("sourceField"))
        assertEquals("region", captured?.get("nextFieldRef"))
        assertEquals("chart", captured?.get("sourceBlockId"))
        assertEquals("country", JsonUtil.asStringMap(captured?.get("refinement"))["field"])
        assertEquals("US", JsonUtil.asStringMap(captured?.get("refinement"))["value"])
    }

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
        val targetContext = runtime.windowContext(state.windowId).context("target")
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
            ExecutionDef(handler = "dialog.commit"),
            dialogContext,
            mapOf(
                "dialogId" to "pick",
                "windowId" to state.windowId
            )
        )

        val targetForm = targetContext.peekForm()
        val selections = targetForm["allSelections"] as? List<*>

        assertEquals("web", targetForm["selectedValue"])
        assertEquals(2, selections?.size)
        val firstSelection = selections?.firstOrNull() as? Map<*, *>
        assertEquals("app", firstSelection?.get("value"))
        assertTrue(runtime.pendingDialog(dialogKey) == null)
    }
}

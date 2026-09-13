package com.viant.forgeandroid.runtime

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class MutationCommandRuntimeTest {
    @Test
    fun `selection confirmation matches web contract`() = runBlocking {
        val runtime = MutationCommandRuntime()
        val command = MutationCommandDef(
            confirmSelection = SelectionConfirmationDef(
                action = "Remove", singularLabel = "Creative", pluralLabel = "Creatives",
                labelField = "name", identityField = "id", maxItems = 2,
                suffix = "Inventory is retained."
            ),
            dataSourceRef = "writer"
        )
        assertEquals(
            "Remove 3 Creatives: Alpha (7), Beta (8), +1 more? Inventory is retained.",
            runtime.resolveConfirmation(command, mapOf("selectedRows" to listOf(
                mapOf("id" to 7, "name" to "Alpha"), mapOf("id" to 8, "name" to "Beta"), mapOf("id" to 9, "name" to "Gamma")
            )))
        )
    }

    @Test
    fun `command executes once and reconciles committed rows`() = runBlocking {
        val runtime = ForgeRuntime(emptyMap(), CoroutineScope(Dispatchers.Unconfined))
        val metadata = WindowMetadata(
            view = ViewDef(content = ContentDef()),
            dataSources = mapOf("source" to DataSourceDef(), "writer" to DataSourceDef(), "records" to DataSourceDef())
        )
        val state = runtime.openWindowInline("test", "Test", metadata = metadata)
        val window = runtime.windowContext(state.windowId)
        val source = window.context("source")
        val records = window.context("records")
        records.collection.set(listOf(mapOf("id" to 1, "name" to "before", "retained" to true)))
        val requests = mutableListOf<ForgeRuntime.DataSourceFetchRequest>()
        runtime.registerDataSourceLoader { request ->
            requests += request
            if (request.dataSourceRef == "writer") {
                ForgeRuntime.DataSourceFetchResult(rows = listOf(mapOf("id" to 1, "name" to "after")))
            } else ForgeRuntime.DataSourceFetchResult()
        }
        val command = MutationCommandDef(
            commandId = "save-record",
            timeoutMs = 120_000,
            invocationParameter = "invocationId",
            dataSourceRef = "writer",
            successState = JsonObject(mapOf("saved" to JsonPrimitive(true))),
            reconcile = ReconcileSpec(mode = "merge", dataSourceRef = "records", identityField = "id")
        )

        val result = runtime.mutationCommands.execute(
            runtime,
            window,
            source,
            command,
            extras = mapOf("id" to 1, "name" to "after")
        )

        assertTrue(result.accepted)
        assertEquals("succeeded", result.status)
        assertTrue(result.invocationId.isNotBlank())
        assertEquals("after", records.collection.peek().first()["name"])
        assertEquals(true, records.collection.peek().first()["retained"])
        assertEquals(true, window.peekWindowForm()["saved"])
        assertEquals(1, requests.count { it.dataSourceRef == "writer" })
        assertEquals(result.invocationId, requests.last().input.parameters["invocationId"])
        assertEquals(MutationWriterStatus.Succeeded, runtime.mutationCommands.state(window.windowId, command).writerStatus)
    }

    @Test
    fun `validation and cancelled confirmation never invoke writer`() = runBlocking {
        val runtime = ForgeRuntime(emptyMap(), CoroutineScope(Dispatchers.Unconfined))
        val metadata = WindowMetadata(
            view = ViewDef(content = ContentDef()),
            dataSources = mapOf("source" to DataSourceDef(), "writer" to DataSourceDef())
        )
        val state = runtime.openWindowInline("test", "Test", metadata = metadata)
        val window = runtime.windowContext(state.windowId)
        val source = window.context("source")
        source.form.set(mapOf("allowed" to false))
        var calls = 0
        runtime.registerDataSourceLoader { calls += 1; ForgeRuntime.DataSourceFetchResult() }
        val invalid = MutationCommandDef(
            commandId = "invalid",
            invalidMessage = "Not allowed",
            dataSourceRef = "writer",
            validateWhen = DashboardConditionDef(source = "form", field = "allowed", equals = JsonPrimitive(true))
        )
        assertEquals("invalid", runtime.mutationCommands.execute(runtime, window, source, invalid).status)

        val confirmation = MutationCommandDef(commandId = "confirm", confirm = "Continue?", dataSourceRef = "writer")
        val cancelled = runtime.mutationCommands.execute(runtime, window, source, confirmation) { false }
        assertEquals("cancelled", cancelled.status)
        assertEquals(0, calls)
    }

    @Test
    fun `timeout remains guarded until authoritative resolution`() = runBlocking {
        val runtime = ForgeRuntime(emptyMap(), CoroutineScope(Dispatchers.Unconfined))
        val metadata = WindowMetadata(
            view = ViewDef(content = ContentDef()),
            dataSources = mapOf("source" to DataSourceDef(), "writer" to DataSourceDef())
        )
        val state = runtime.openWindowInline("test", "Test", metadata = metadata)
        val window = runtime.windowContext(state.windowId)
        val source = window.context("source")
        runtime.registerDataSourceLoader { delay(5_000); ForgeRuntime.DataSourceFetchResult() }
        val command = MutationCommandDef(commandId = "slow", timeoutMs = 1_000, dataSourceRef = "writer")

        val result = runtime.mutationCommands.execute(runtime, window, source, command)

        assertEquals("indeterminate", result.status)
        assertTrue(runtime.mutationCommands.state(window.windowId, command).guarded)
        assertTrue(runtime.mutationCommands.resolveIndeterminate(window.windowId, command))
        assertFalse(runtime.mutationCommands.state(window.windowId, command).guarded)
    }
}

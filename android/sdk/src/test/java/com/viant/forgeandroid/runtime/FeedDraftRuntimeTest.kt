package com.viant.forgeandroid.runtime

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FeedDraftRuntimeTest {
    @Test
    fun feedEditorMetadataAndPatchDispatchRemainGeneric() {
        val metadata = Json { ignoreUnknownKeys = true }.decodeFromString<WindowMetadata>(
            """
            {"view":{"content":{"containers":[{
              "id":"frequency","kind":"dashboard.editableTable","dataSourceRef":"rows","quickFilter":true,
              "addRow":{"label":"Add","defaults":{"value":0}},"removeRowLabel":"Remove",
              "columns":[{"key":"value","editor":{"type":"number"}}],
              "lookup":{"options":[{"label":"One","value":1}]}
            }]}}}
            """.trimIndent()
        )
        val container = metadata.view!!.content!!.containers.single()
        assertEquals("dashboard.editableTable", container.kind)
        assertEquals(true, container.quickFilter)
        assertEquals("Add", container.addRow?.get("label")?.toString()?.trim('"'))
        assertEquals("number", (container.columns.single().editor as kotlinx.serialization.json.JsonObject)["type"]?.toString()?.trim('"'))

        val runtime = ForgeRuntime(emptyMap(), CoroutineScope(Dispatchers.Unconfined))
        var received: FeedPatchOperation? = null
        runtime.registerFeedPatchHandler { _, operation -> received = operation; true }
        val operation = FeedPatchOperation("rows", "replace", "/collection/0/value", 3)
        assertTrue(runtime.dispatchFeedPatch("window", operation))
        assertEquals(operation, received)
    }

    @Test
    fun patchesFirstMiddleLastAndSnapshotsAllViews() {
        val runtime = ForgeRuntime(emptyMap(), CoroutineScope(Dispatchers.Unconfined))
        val metadata = WindowMetadata(
            dataSources = mapOf("items" to DataSourceDef(selectionMode = "multi"))
        )
        val window = runtime.openWindowInline("feed-test", metadata = metadata)
        val context = runtime.windowContext(window.windowId).contextOrNull("items")!!
        context.collection.set(listOf(row(1), row(2), row(3)))
        context.setForm(mapOf("title" to "Draft"))
        context.setSelection(SelectionState(selection = listOf(row(1))))

        val changed = applyFeedPatchOperations(
            runtime.windowContext(window.windowId),
            listOf(
                FeedPatchOperation("items", "replace", "/collection/0/value", 10),
                FeedPatchOperation("items", "remove", "/collection/1"),
                FeedPatchOperation("items", "add", "/collection/-", row(4)),
                FeedPatchOperation("items", "replace", "/form/title", "Changed"),
                FeedPatchOperation("items", "add", "/selection/selection/-", row(4))
            )
        )

        assertEquals(setOf("items"), changed)
        val snapshot = snapshotFeedDataSources(runtime.windowContext(window.windowId), listOf("items")).getValue("items")
        assertEquals(listOf(10, 3, 4), snapshot.collection.map { it["value"] })
        assertEquals("Changed", snapshot.form["title"])
        assertEquals(2, (snapshot.selection["selection"] as List<*>).size)
    }

    @Test
    fun rejectsRelativeAndOutOfBoundsPaths() {
        val runtime = ForgeRuntime(emptyMap(), CoroutineScope(Dispatchers.Unconfined))
        val window = runtime.openWindowInline(
            "feed-test",
            metadata = WindowMetadata(dataSources = mapOf("items" to DataSourceDef()))
        )
        val context = runtime.windowContext(window.windowId).contextOrNull("items")!!
        context.collection.set(listOf(row(1)))

        val relative = runCatching {
            applyFeedPatchOperations(
                runtime.windowContext(window.windowId),
                listOf(FeedPatchOperation("items", "remove", "collection/0"))
            )
        }
        val outOfBounds = runCatching {
            applyFeedPatchOperations(
                runtime.windowContext(window.windowId),
                listOf(FeedPatchOperation("items", "remove", "/collection/4"))
            )
        }

        assertTrue(relative.isFailure)
        assertTrue(outOfBounds.isFailure)
    }

    private fun row(value: Int): Map<String, Any?> = mapOf("value" to value)
}

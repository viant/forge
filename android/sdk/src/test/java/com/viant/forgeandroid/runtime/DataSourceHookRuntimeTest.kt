package com.viant.forgeandroid.runtime

import com.dokar.quickjs.QuickJs
import com.dokar.quickjs.evaluate
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonObject
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class DataSourceHookRuntimeTest {
    private val server = MockWebServer()

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
    fun tearDown() {
        ActionHookRuntime.testScriptEvaluator = null
        server.shutdown()
    }

    @Test
    fun fetchCollectionAppliesPrepareCollectionHook() = runBlocking {
        server.enqueue(
            MockResponse().setBody(
                """
                {
                  "data": [
                    { "apply_status": "approved", "id": 2 }
                  ]
                }
                """.trimIndent()
            )
        )
        server.start()

        val signals = SignalRegistry()
        val restClient = RestClient(
            EndpointRegistry(
                mapOf("appAPI" to EndpointConfig(baseUrl = server.url("/").toString().trimEnd('/')))
            )
        )
        val runtime = DataSourceRuntime(signals, restClient, CoroutineScope(Dispatchers.Unconfined))
        val metadata = WindowMetadata(
            actions = ActionsDef(
                code = """
                    (() => ({
                      prepareCollection: (props = {}) => {
                        const collection = props.collection || [];
                        return collection.map((row) => ({
                          ...row,
                          applyStatus: String(row.apply_status ?? "").trim().toUpperCase()
                        }));
                      }
                    }))()
                """.trimIndent()
            ),
            dataSources = mapOf(
                "recommendation" to DataSourceDef(
                    service = ServiceDef(
                        endpoint = "appAPI",
                        uri = "/recommendation"
                    )
                )
            )
        )
        val metadataSignal = signals.metadata("W1")
        metadataSignal.set(metadata)
        val window = WindowContext(
            windowId = "W1",
            metadata = metadataSignal,
            signals = signals,
            dataSourceRuntime = runtime
        )
        val ctx = runtime.attach(window, "recommendation")

        ctx.fetchCollection()
        delay(150)

        val row = ctx.collection.peek().first()
        assertEquals("APPROVED", row["applyStatus"])
        assertEquals(2L, row["id"])
    }

    @Test
    fun toggleSelectionAppliesPrepareSelectionHookAndSyncsForm() = runBlocking {
        val signals = SignalRegistry()
        val restClient = RestClient(EndpointRegistry(emptyMap()))
        val runtime = DataSourceRuntime(signals, restClient, CoroutineScope(Dispatchers.Unconfined))
        val metadata = WindowMetadata(
            actions = ActionsDef(
                code = """
                    (() => ({
                      prepareSelection: ({ selected = {}, rowIndex = -1 }) => ({
                        ...selected,
                        normalizedId: String(selected.id ?? ""),
                        selectedRowIndex: rowIndex
                      })
                    }))()
                """.trimIndent()
            ),
            dataSources = mapOf(
                "recommendation" to DataSourceDef()
            )
        )
        val metadataSignal = signals.metadata("W1")
        metadataSignal.set(metadata)
        val window = WindowContext(
            windowId = "W1",
            metadata = metadataSignal,
            signals = signals,
            dataSourceRuntime = runtime
        )
        val ctx = runtime.attach(window, "recommendation")
        val row = mapOf<String, Any?>("id" to 42L)

        ctx.toggleSelection(row, 3)

        assertEquals("42", ctx.peekSelection().selected?.get("normalizedId"))
        assertEquals(3L, ctx.peekSelection().selected?.get("selectedRowIndex"))
        assertEquals("42", ctx.peekForm()["normalizedId"])
        assertEquals(3L, ctx.peekForm()["selectedRowIndex"])

        ctx.toggleSelection(row, 3)

        assertNull(ctx.peekSelection().selected)
        assertEquals(emptyMap(), ctx.peekForm())
    }

    @Test
    fun fetchCollectionAutoSelectAppliesPrepareSelectionHook() = runBlocking {
        server.enqueue(
            MockResponse().setBody(
                """
                {
                  "data": [
                    { "id": 2, "apply_status": "approved" }
                  ]
                }
                """.trimIndent()
            )
        )
        server.start()

        val signals = SignalRegistry()
        val restClient = RestClient(
            EndpointRegistry(
                mapOf("appAPI" to EndpointConfig(baseUrl = server.url("/").toString().trimEnd('/')))
            )
        )
        val runtime = DataSourceRuntime(signals, restClient, CoroutineScope(Dispatchers.Unconfined))
        val metadata = WindowMetadata(
            actions = ActionsDef(
                code = """
                    (() => ({
                      prepareSelection: ({ selected = {}, rowIndex = -1 }) => ({
                        ...selected,
                        normalizedId: String(selected.id ?? ""),
                        selectedRowIndex: rowIndex
                      })
                    }))()
                """.trimIndent()
            ),
            dataSources = mapOf(
                "recommendation" to DataSourceDef(
                    service = ServiceDef(
                        endpoint = "appAPI",
                        uri = "/recommendation"
                    )
                )
            )
        )
        val metadataSignal = signals.metadata("W1")
        metadataSignal.set(metadata)
        val window = WindowContext(
            windowId = "W1",
            metadata = metadataSignal,
            signals = signals,
            dataSourceRuntime = runtime
        )
        val ctx = runtime.attach(window, "recommendation")

        ctx.fetchCollection()
        withTimeout(5000) {
            ctx.selection.flow.first { it.selected != null }
        }

        assertEquals("2", ctx.peekSelection().selected?.get("normalizedId"))
        assertEquals(0L, ctx.peekSelection().selected?.get("selectedRowIndex"))
        assertEquals("2", ctx.peekForm()["normalizedId"])
        assertEquals(0L, ctx.peekForm()["selectedRowIndex"])
    }

    @Test
    fun initialSelectionParameterAppliesPrepareSelectionHookAndSyncsForm() = runBlocking {
        val signals = SignalRegistry()
        val restClient = RestClient(EndpointRegistry(emptyMap()))
        val runtime = DataSourceRuntime(signals, restClient, CoroutineScope(Dispatchers.Unconfined))
        val metadata = WindowMetadata(
            actions = ActionsDef(
                code = """
                    (() => ({
                      prepareSelection: ({ selected = {}, rowIndex = -1 }) => ({
                        ...selected,
                        normalizedId: String(selected.id ?? ""),
                        selectedRowIndex: rowIndex
                      })
                    }))()
                """.trimIndent()
            ),
            dataSources = mapOf(
                "recommendation" to DataSourceDef()
            )
        )
        val metadataSignal = signals.metadata("W1")
        metadataSignal.set(metadata)
        val window = WindowContext(
            windowId = "W1",
            metadata = metadataSignal,
            signals = signals,
            dataSourceRuntime = runtime,
            parameters = mapOf(
                "selection" to mapOf<String, Any?>("id" to 99L),
                "rowIndex" to 5
            )
        )

        val ctx = runtime.attach(window, "recommendation")
        withTimeout(5000) {
            ctx.selection.flow.first { it.selected != null }
        }

        assertEquals("99", ctx.peekSelection().selected?.get("normalizedId"))
        assertEquals(5L, ctx.peekSelection().selected?.get("selectedRowIndex"))
        assertEquals("99", ctx.peekForm()["normalizedId"])
        assertEquals(5L, ctx.peekForm()["selectedRowIndex"])
    }

    @Test
    fun fetchCollectionUsesRegisteredLoaderResult() = runBlocking {
        val signals = SignalRegistry()
        val restClient = RestClient(EndpointRegistry(emptyMap()))
        val runtime = DataSourceRuntime(signals, restClient, CoroutineScope(Dispatchers.Unconfined))
        runtime.setCollectionLoader { ctx ->
            if (ctx.dataSourceRef != "recommendation") {
                return@setCollectionLoader null
            }
            DataSourceRuntime.LoaderResult(
                rows = listOf(mapOf("id" to 7L, "apply_status" to "approved")),
                metrics = mapOf("totalCount" to 1L),
                selection = mapOf("id" to 7L),
                rowIndex = 0
            )
        }
        val metadata = WindowMetadata(
            dataSources = mapOf(
                "recommendation" to DataSourceDef()
            )
        )
        val metadataSignal = signals.metadata("W1")
        metadataSignal.set(metadata)
        val window = WindowContext(
            windowId = "W1",
            metadata = metadataSignal,
            signals = signals,
            dataSourceRuntime = runtime
        )
        val ctx = runtime.attach(window, "recommendation")

        ctx.fetchCollection()
        delay(150)

        assertEquals(1, ctx.collection.peek().size)
        assertEquals(7L, ctx.collection.peek().first()["id"])
        assertEquals(1L, ctx.metrics.peek()["totalCount"])
        assertEquals(7L, ctx.peekSelection().selected?.get("id"))
        assertTrue(ctx.peekForm().isNotEmpty())
    }
}

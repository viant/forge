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
                "report" to DataSourceDef(
                    service = ServiceDef(
                        endpoint = "appAPI",
                        uri = "/report"
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
        val ctx = runtime.attach(window, "report")

        ctx.fetchCollection()
        delay(150)

        val row = ctx.collection.peek().first()
        assertEquals("APPROVED", row["applyStatus"])
        assertEquals(2L, row["id"])
    }

    @Test
    fun fetchCollectionResolvesDatasourceInputAndFilterParametersIntoQuery() = runBlocking {
        server.enqueue(MockResponse().setBody("""{"data": []}"""))
        server.start()

        val signals = SignalRegistry()
        val restClient = RestClient(
            EndpointRegistry(
                mapOf("appAPI" to EndpointConfig(baseUrl = server.url("/").toString().trimEnd('/')))
            )
        )
        val runtime = DataSourceRuntime(signals, restClient, CoroutineScope(Dispatchers.Unconfined))
        val metadata = WindowMetadata(
            dataSources = mapOf(
                "orders" to DataSourceDef(
                    service = ServiceDef(
                        endpoint = "appAPI",
                        uri = "/orders"
                    ),
                    parameters = listOf(
                        ParameterDef(name = "orderId", input = "dataSource", location = "orderId", to = ":query"),
                        ParameterDef(name = "status", input = "dataSource", location = "status", to = ":query"),
                        ParameterDef(name = "country", input = "filter", location = "country", to = ":query"),
                        ParameterDef(name = "pageSize", input = "input", location = "parameters.pageSize", to = ":query")
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
        val ctx = runtime.attach(window, "orders")
        signals.selection(WindowIdentity("W1").dataSourceId("orders")).set(
            SelectionState(selected = mapOf("orderId" to 201))
        )
        signals.form(WindowIdentity("W1").dataSourceId("orders")).set(
            mapOf("orderId" to 301, "status" to "active")
        )
        signals.input(WindowIdentity("W1").dataSourceId("orders")).set(
            InputState(
                filter = mapOf("country" to "US"),
                parameters = mapOf("pageSize" to 25)
            )
        )

        ctx.fetchCollection()
        delay(150)

        val request = server.takeRequest()
        assertEquals("201", request.requestUrl?.queryParameter("orderId"))
        assertEquals("active", request.requestUrl?.queryParameter("status"))
        assertEquals("US", request.requestUrl?.queryParameter("country"))
        assertEquals("25", request.requestUrl?.queryParameter("pageSize"))
    }

    @Test
    fun fetchCollectionUsesTopLevelDataSourceUriWithSingleEndpoint() = runBlocking {
        server.enqueue(MockResponse().setBody("""{"data": [{"id": 1}]}"""))
        server.start()

        val signals = SignalRegistry()
        val restClient = RestClient(
            EndpointRegistry(
                mapOf("appAPI" to EndpointConfig(baseUrl = server.url("/").toString().trimEnd('/')))
            )
        )
        val runtime = DataSourceRuntime(signals, restClient, CoroutineScope(Dispatchers.Unconfined))
        val metadata = WindowMetadata(
            dataSources = mapOf(
                "report" to DataSourceDef(
                    uri = "/reports/search",
                    params = mapOf("static" to "yes"),
                    paging = PagingDef(
                        enabled = true,
                        size = 25,
                        parameters = mapOf("page" to "offset", "size" to "limit")
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
        val ctx = runtime.attach(window, "report")
        signals.input(WindowIdentity("W1").dataSourceId("report")).set(
            InputState(filter = mapOf("country" to "US"), page = 4)
        )

        ctx.fetchCollection()
        delay(150)

        val request = server.takeRequest()
        assertEquals("/reports/search", request.requestUrl?.encodedPath)
        assertEquals("yes", request.requestUrl?.queryParameter("static"))
        assertEquals("US", request.requestUrl?.queryParameter("country"))
        assertEquals("75", request.requestUrl?.queryParameter("offset"))
        assertEquals("25", request.requestUrl?.queryParameter("limit"))
        assertEquals(1L, ctx.collection.peek().firstOrNull()?.get("id"))
        assertEquals(false, ctx.control.peek().loading)
        assertEquals(true, ctx.control.peek().resolved)
    }

    @Test
    fun fetchCollectionPostsDatasourceFetchInputsForNonGetFetchRoute() = runBlocking {
        server.enqueue(MockResponse().setBody("""{"data": [{"id": 2}]}"""))
        server.start()

        val signals = SignalRegistry()
        val restClient = RestClient(
            EndpointRegistry(
                mapOf("appAPI" to EndpointConfig(baseUrl = server.url("/").toString().trimEnd('/')))
            )
        )
        val runtime = DataSourceRuntime(signals, restClient, CoroutineScope(Dispatchers.Unconfined))
        val metadata = WindowMetadata(
            dataSources = mapOf(
                "report" to DataSourceDef(
                    service = ServiceDef(
                        endpoint = "appAPI",
                        uri = "/v1/api/datasources/report/fetch",
                        method = "POST"
                    ),
                    params = mapOf("advertiserId" to "17"),
                    paging = PagingDef(
                        enabled = true,
                        size = 25,
                        parameters = mapOf("page" to "offset", "size" to "limit")
                    ),
                    parameters = listOf(
                        ParameterDef(name = "status", input = "filter", location = "status", to = ":query")
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
        val ctx = runtime.attach(window, "report")
        signals.input(WindowIdentity("W1").dataSourceId("report")).set(
            InputState(
                filter = mapOf("country" to "US", "status" to "active"),
                page = 4
            )
        )

        ctx.fetchCollection()
        delay(150)

        val request = server.takeRequest()
        val body = JsonUtil.parseObject(request.body.readUtf8())
        val inputs = JsonUtil.asStringMap(body["inputs"])
        assertEquals("POST", request.method)
        assertEquals("/v1/api/datasources/report/fetch", request.requestUrl?.encodedPath)
        assertEquals("17", inputs["advertiserId"])
        assertEquals(75L, inputs["offset"])
        assertEquals(25L, inputs["limit"])
        assertEquals("US", inputs["country"])
        assertEquals("active", inputs["status"])
        assertEquals(2L, ctx.collection.peek().firstOrNull()?.get("id"))
    }

    @Test
    fun fetchCollectionUsesResponseSelectorsForRowsAndMetrics() = runBlocking {
        server.enqueue(
            MockResponse().setBody(
                """
                {
                  "payload": {
                    "rows": [
                      { "id": 1, "name": "Alpha" },
                      { "id": 2, "name": "Beta" }
                    ]
                  },
                  "meta": {
                    "total": 2,
                    "hasMore": false
                  }
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
            dataSources = mapOf(
                "report" to DataSourceDef(
                    service = ServiceDef(endpoint = "appAPI", uri = "/reports/search"),
                    selectors = SelectorDef(data = "payload.rows", dataInfo = "meta")
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
        val ctx = runtime.attach(window, "report")

        ctx.fetchCollection()
        delay(150)

        assertEquals(2, ctx.collection.peek().size)
        assertEquals("Alpha", ctx.collection.peek().firstOrNull()?.get("name"))
        assertEquals(2L, ctx.metrics.peek()["total"])
        assertEquals(false, ctx.metrics.peek()["hasMore"])
    }

    @Test
    fun fetchCollectionExtractsPagingMetricsWhenDataInfoSelectorMissing() = runBlocking {
        server.enqueue(
            MockResponse().setBody(
                """
                {
                  "data": [
                    { "id": 7 }
                  ],
                  "page": {
                    "total": 99,
                    "count": 4
                  },
                  "nextCursor": "cursor-2",
                  "hasMore": true
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
            dataSources = mapOf(
                "report" to DataSourceDef(
                    service = ServiceDef(endpoint = "appAPI", uri = "/reports/search"),
                    paging = PagingDef(
                        size = 25,
                        dataInfoSelectors = mapOf(
                            "totalCount" to "page.total",
                            "pageCount" to "page.count"
                        )
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
        val ctx = runtime.attach(window, "report")

        ctx.fetchCollection()
        delay(150)

        assertEquals(7L, ctx.collection.peek().firstOrNull()?.get("id"))
        assertEquals(99L, ctx.metrics.peek()["totalCount"])
        assertEquals(4L, ctx.metrics.peek()["pageCount"])
        assertEquals("cursor-2", ctx.metrics.peek()["nextCursor"])
        assertEquals(true, ctx.metrics.peek()["hasMore"])
    }

    @Test
    fun fetchCollectionRequiresNamedServiceWhenMultipleEndpointsExist() = runBlocking {
        val signals = SignalRegistry()
        val restClient = RestClient(
            EndpointRegistry(
                mapOf(
                    "appAPI" to EndpointConfig(baseUrl = "http://127.0.0.1/app"),
                    "auditAPI" to EndpointConfig(baseUrl = "http://127.0.0.1/audit")
                )
            )
        )
        val runtime = DataSourceRuntime(signals, restClient, CoroutineScope(Dispatchers.Unconfined))
        val metadata = WindowMetadata(
            dataSources = mapOf(
                "report" to DataSourceDef(uri = "/reports/search")
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
        val ctx = runtime.attach(window, "report")

        ctx.fetchCollection()
        delay(150)

        assertTrue(ctx.collection.peek().isEmpty())
        assertEquals(false, ctx.control.peek().loading)
        assertEquals(true, ctx.control.peek().resolved)
        assertEquals("Endpoint not found: null", ctx.control.peek().error)
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
                "report" to DataSourceDef()
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
        val ctx = runtime.attach(window, "report")
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
                "report" to DataSourceDef(
                    service = ServiceDef(
                        endpoint = "appAPI",
                        uri = "/report"
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
        val ctx = runtime.attach(window, "report")

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
                "report" to DataSourceDef()
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

        val ctx = runtime.attach(window, "report")
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
        var sawFetchStartControl = false
        runtime.setCollectionLoader { ctx ->
            if (ctx.dataSourceRef != "report") {
                return@setCollectionLoader null
            }
            assertEquals(true, ctx.control.peek().loading)
            assertEquals(false, ctx.control.peek().resolved)
            sawFetchStartControl = true
            DataSourceRuntime.LoaderResult(
                rows = listOf(mapOf("id" to 7L, "apply_status" to "approved")),
                metrics = mapOf("totalCount" to 1L),
                selection = mapOf("id" to 7L),
                rowIndex = 0
            )
        }
        val metadata = WindowMetadata(
            dataSources = mapOf(
                "report" to DataSourceDef()
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
        val ctx = runtime.attach(window, "report")

        ctx.fetchCollection()
        delay(150)

        assertEquals(1, ctx.collection.peek().size)
        assertEquals(7L, ctx.collection.peek().first()["id"])
        assertEquals(1L, ctx.metrics.peek()["totalCount"])
        assertEquals(7L, ctx.peekSelection().selected?.get("id"))
        assertTrue(ctx.peekForm().isNotEmpty())
        assertEquals(true, sawFetchStartControl)
        assertEquals(false, ctx.control.peek().loading)
        assertEquals(true, ctx.control.peek().resolved)
    }

    @Test
    fun fetchCollectionWithoutLoaderOrServiceResolvesControlState() = runBlocking {
        val signals = SignalRegistry()
        val restClient = RestClient(EndpointRegistry(emptyMap()))
        val runtime = DataSourceRuntime(signals, restClient, CoroutineScope(Dispatchers.Unconfined))
        val metadata = WindowMetadata(
            dataSources = mapOf(
                "report" to DataSourceDef()
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
        val ctx = runtime.attach(window, "report")

        ctx.fetchCollection()
        delay(150)

        assertTrue(ctx.collection.peek().isEmpty())
        assertEquals(false, ctx.control.peek().loading)
        assertEquals(true, ctx.control.peek().resolved)
        assertNull(ctx.control.peek().error)
        assertEquals(false, ctx.input.peek().fetch)
        assertEquals(false, ctx.input.peek().refresh)
    }
}

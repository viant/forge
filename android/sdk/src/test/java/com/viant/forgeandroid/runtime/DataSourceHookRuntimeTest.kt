package com.viant.forgeandroid.runtime

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonObject
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals

class DataSourceHookRuntimeTest {
    private val server = MockWebServer()

    @AfterTest
    fun tearDown() {
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
}

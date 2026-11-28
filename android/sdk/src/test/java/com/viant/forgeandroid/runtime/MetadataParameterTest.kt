package com.viant.forgeandroid.runtime

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonPrimitive
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import java.util.concurrent.TimeUnit
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertSame

class MetadataParameterTest {
    @Test
    fun selectsMetadataAndKeepsLegacyEmptyLocationsAndTypedDefaults() {
        val metadata = decodeMetadata(
            """
            {
                "namespace": "Records",
                "windowKey": "sample",
                "authorizationSnapshot": {"account":{"id":"42","roles":["reader","editor"],"note":null}},
                "dialogs": [{"id":"sample","fetchOnOpen":false}],
                "dataSource": {"source":{"autoSelect":false},"authorizationSnapshot":{}}
            }
            """
        )
        val runtime = ForgeRuntime(emptyMap(), CoroutineScope(Dispatchers.Unconfined))
        val state = runtime.openWindowInline("sample", metadata = metadata)
        runtime.setWindowFormValue(state.windowId, mapOf("seed" to mapOf("id" to 17L)))
        val window = runtime.windowContext(state.windowId)
        val context = window.context("source")
        val resolver = ParameterResolver()
        val parameters = listOf(
            binding("key", "windowKey"),
            binding("Id", "authorizationSnapshot.account.id").copy(codec = JsonPrimitive("int")),
            binding("role", "authorizationSnapshot.account.roles.1"),
            binding("enabled", "dialogs.0.fetchOnOpen"),
            binding("autoSelect", "dataSource.source.autoSelect"),
            binding("swiftAlias", "dataSources.source.autoSelect"),
            binding("absent", "authorizationSnapshot.account.roles.9").copy(defaultValue = JsonPrimitive("fallback")),
            binding("note", "authorizationSnapshot.account.note").copy(defaultValue = JsonPrimitive("fallback")),
            ParameterDef(name = "fixed", input = "const", location = "007", codec = JsonPrimitive("int")),
            ParameterDef(name = "seeded", input = "windowForm", location = "seed.id", codec = JsonPrimitive("int"))
        )

        val expected = mapOf(
            "key" to "sample", "Id" to "42", "role" to "editor", "enabled" to false,
            "autoSelect" to false, "swiftAlias" to false, "fixed" to "007", "seeded" to 17L
        )
        val flat = expected + ("Id" to 42L)
        assertEquals(flat, resolver.resolveFlat(parameters, context))
        assertEquals(expected + mapOf("absent" to null, "note" to null), resolver.resolve(parameters, context).inbound[""])
        assertEquals(
            expected + mapOf("Id" to 42L, "fixed" to 7L, "absent" to "fallback", "note" to null),
            resolver.resolveOperation(parameters, context).inbound[""]
        )
        assertSame(window.metadata.peek(), resolver.resolveFlat(listOf(binding("whole", null)), context)["whole"])
        assertSame(window.metadata.peek(), resolver.resolveFlat(listOf(binding("whole", "")), context)["whole"])
        window.metadata.set(metadata.copy(dialogs = emptyList()))
        assertEquals(flat - "enabled", resolver.resolveFlat(parameters, context))
    }

    @Test
    fun registeredLoaderReceivesScalarThenOmittedRequiredInputAfterOwnerReplacement() = runBlocking {
        val metadata = decodeMetadata(
            """
            {
                "authorizationSnapshot": {"account":{"id":42}},
                "dataSource": {"source":{"parameters":[
                    {"name":"Id","in":"metadata","location":"authorizationSnapshot.account.id","from":"","to":"",
                     "codec":{"name":"int","args":null},"required":true}
                ]}}
            }
            """
        )
        val runtime = ForgeRuntime(emptyMap(), CoroutineScope(Dispatchers.Unconfined))
        val requests = Channel<ForgeRuntime.DataSourceFetchRequest>(Channel.UNLIMITED)
        runtime.registerDataSourceLoader { request ->
            requests.send(request)
            ForgeRuntime.DataSourceFetchResult()
        }
        val state = runtime.openWindowInline("sample", metadata = metadata)

        suspend fun fetchInputs(): Map<String, Any?> {
            runtime.refreshDataSourceCollection(state.windowId, "source")
            val request = withTimeout(5_000) { requests.receive() }
            assertEquals("source", request.dataSourceRef)
            assertEquals(state.windowId, request.windowId)
            return request.resolvedInputs
        }

        assertEquals(mapOf("Id" to 42L), fetchInputs())
        val signed = decodeMetadata("""{"authorizationSnapshot":{"account":{"id":"71"}}}""")
        runtime.metadataSignal(state.windowId).set(metadata.copy(authorizationSnapshot = signed.authorizationSnapshot))
        assertEquals(mapOf("Id" to 71L), fetchInputs())
        runtime.metadataSignal(state.windowId).set(metadata.copy(authorizationSnapshot = emptyMap()))
        assertEquals(emptyMap(), fetchInputs())
    }

    @Test
    fun restDatasourceFetchWritesNumericIdToQueryInputs() {
        MockWebServer().use { server ->
            repeat(2) { server.enqueue(MockResponse().setBody("""{"data":[]}""")) }
            server.start()
            val metadata = decodeMetadata(
                """
                {
                    "authorizationSnapshot": {"account":{"id":"42"}},
                    "dataSource": {"source":{
                        "service":{"endpoint":"test","uri":"/v1/api/datasources/source/fetch","method":"POST"},
                        "parameters":[{"name":"Id","in":"metadata","location":"authorizationSnapshot.account.id",
                          "to":"query","codec":{"name":"int"}}]
                    }}
                }
                """
            )
            val runtime = ForgeRuntime(
                mapOf("test" to EndpointConfig(baseUrl = server.url("/").toString().trimEnd('/'))),
                CoroutineScope(Dispatchers.Unconfined)
            )
            val state = runtime.openWindowInline("sample", metadata = metadata)
            runtime.refreshDataSourceCollection(state.windowId, "source")

            val request = assertNotNull(server.takeRequest(5, TimeUnit.SECONDS))
            assertEquals("POST", request.method)
            assertEquals(mapOf("inputs" to mapOf("Id" to 42L)), JsonUtil.parseObject(request.body.readUtf8()))

            runtime.metadataSignal(state.windowId).set(metadata.copy(authorizationSnapshot = emptyMap()))
            runtime.refreshDataSourceCollection(state.windowId, "source")
            val missing = assertNotNull(server.takeRequest(5, TimeUnit.SECONDS))
            assertEquals(mapOf("inputs" to emptyMap<String, Any?>()), JsonUtil.parseObject(missing.body.readUtf8()))
        }
    }

    private fun decodeMetadata(source: String) = JsonUtil.json.decodeFromString(WindowMetadata.serializer(), source)

    private fun binding(name: String, location: String?) = ParameterDef(name = name, input = "metadata", location = location)
}

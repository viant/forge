package com.viant.forgeandroid.runtime

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class EndpointRegistry(private val endpoints: Map<String, EndpointConfig>) {
    fun resolve(name: String?): EndpointConfig? = name?.let { endpoints[it] }
}

data class EndpointConfig(
    val baseUrl: String,
    val authTokenProvider: (() -> String?)? = null,
    val defaultHeadersProvider: (() -> Map<String, String>)? = null,
    val httpClient: OkHttpClient? = null
)

class RestClient(
    private val endpoints: EndpointRegistry
) {
    private val fallbackClient = OkHttpClient()

    fun <T> get(endpoint: String?, uri: String, parser: (String) -> T): T {
        val config = endpoints.resolve(endpoint)
            ?: error("Endpoint not found: $endpoint")
        val url = config.baseUrl.trimEnd('/') + "/" + uri.trimStart('/')
        val request = Request.Builder().url(url)
            .applyEndpoint(config)
            .get()
            .build()
        clientFor(config).newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) error("GET $url failed: ${resp.code}")
            val body = resp.body?.string() ?: ""
            return parser(body)
        }
    }

    fun <T> patch(endpoint: String?, uri: String, payload: String, parser: (String) -> T): T {
        val config = endpoints.resolve(endpoint)
            ?: error("Endpoint not found: $endpoint")
        val url = config.baseUrl.trimEnd('/') + "/" + uri.trimStart('/')
        val request = Request.Builder().url(url)
            .applyEndpoint(config)
            .patch(payload.toRequestBody("application/json".toMediaType()))
            .build()
        clientFor(config).newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) error("PATCH $url failed: ${resp.code}")
            val body = resp.body?.string() ?: ""
            return parser(body)
        }
    }

    fun <T> post(endpoint: String?, uri: String, payload: String, parser: (String) -> T): T {
        val config = endpoints.resolve(endpoint)
            ?: error("Endpoint not found: $endpoint")
        val url = config.baseUrl.trimEnd('/') + "/" + uri.trimStart('/')
        val request = Request.Builder().url(url)
            .applyEndpoint(config)
            .post(payload.toRequestBody("application/json".toMediaType()))
            .build()
        clientFor(config).newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) error("POST $url failed: ${resp.code}")
            val body = resp.body?.string() ?: ""
            return parser(body)
        }
    }

    fun <T> put(endpoint: String?, uri: String, payload: String, parser: (String) -> T): T {
        val config = endpoints.resolve(endpoint)
            ?: error("Endpoint not found: $endpoint")
        val url = config.baseUrl.trimEnd('/') + "/" + uri.trimStart('/')
        val request = Request.Builder().url(url)
            .applyEndpoint(config)
            .put(payload.toRequestBody("application/json".toMediaType()))
            .build()
        clientFor(config).newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) error("PUT $url failed: ${resp.code}")
            val body = resp.body?.string() ?: ""
            return parser(body)
        }
    }

    fun <T> delete(endpoint: String?, uri: String, parser: (String) -> T): T {
        val config = endpoints.resolve(endpoint)
            ?: error("Endpoint not found: $endpoint")
        val url = config.baseUrl.trimEnd('/') + "/" + uri.trimStart('/')
        val request = Request.Builder().url(url)
            .applyEndpoint(config)
            .delete()
            .build()
        clientFor(config).newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) error("DELETE $url failed: ${resp.code}")
            val body = resp.body?.string() ?: ""
            return parser(body)
        }
    }

    private fun clientFor(config: EndpointConfig): OkHttpClient = config.httpClient ?: fallbackClient
}

internal fun Request.Builder.applyEndpoint(config: EndpointConfig): Request.Builder {
    config.defaultHeadersProvider?.invoke()?.forEach { (name, value) ->
        if (name.isNotBlank() && value.isNotBlank()) {
            header(name, value)
        }
    }
    config.authTokenProvider?.invoke()?.takeIf { it.isNotBlank() }?.let {
        header("Authorization", "Bearer $it")
    }
    return this
}

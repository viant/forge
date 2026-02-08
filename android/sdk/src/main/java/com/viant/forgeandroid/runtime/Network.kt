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
    val authTokenProvider: (() -> String?)? = null
)

class RestClient(
    private val endpoints: EndpointRegistry
) {
    private val client = OkHttpClient()

    fun <T> get(endpoint: String?, uri: String, parser: (String) -> T): T {
        val config = endpoints.resolve(endpoint)
            ?: error("Endpoint not found: $endpoint")
        val url = config.baseUrl.trimEnd('/') + "/" + uri.trimStart('/')
        val request = Request.Builder().url(url)
            .apply { config.authTokenProvider?.invoke()?.let { header("Authorization", "Bearer $it") } }
            .get()
            .build()
        client.newCall(request).execute().use { resp ->
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
            .apply { config.authTokenProvider?.invoke()?.let { header("Authorization", "Bearer $it") } }
            .patch(payload.toRequestBody("application/json".toMediaType()))
            .build()
        client.newCall(request).execute().use { resp ->
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
            .apply { config.authTokenProvider?.invoke()?.let { header("Authorization", "Bearer $it") } }
            .post(payload.toRequestBody("application/json".toMediaType()))
            .build()
        client.newCall(request).execute().use { resp ->
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
            .apply { config.authTokenProvider?.invoke()?.let { header("Authorization", "Bearer $it") } }
            .put(payload.toRequestBody("application/json".toMediaType()))
            .build()
        client.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) error("PUT $url failed: ${resp.code}")
            val body = resp.body?.string() ?: ""
            return parser(body)
        }
    }
}

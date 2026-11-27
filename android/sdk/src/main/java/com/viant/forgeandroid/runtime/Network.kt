package com.viant.forgeandroid.runtime

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class EndpointRegistry(private val endpoints: Map<String, EndpointConfig>) {
    fun resolve(name: String?): EndpointConfig? {
        val key = name?.trim().orEmpty()
        if (key.isNotEmpty()) {
            return endpoints[key]
        }
        return endpoints.values.singleOrNull()
    }
}

data class EndpointConfig(
    val baseUrl: String,
    val authTokenProvider: (() -> String?)? = null,
    val defaultHeadersProvider: (() -> Map<String, String>)? = null,
    val httpClient: OkHttpClient? = null
) {
    internal val singleAttemptClient by lazy { httpClient?.forSingleAttempt() }
}

internal class HttpResponseException(val status: Int, method: String, url: String) :
    IllegalStateException("$method ${url.substringBefore('?')} failed: $status")

class RestClient(
    private val endpoints: EndpointRegistry
) {
    private val fallbackClient = OkHttpClient()

    private val singleAttemptFallback by lazy { fallbackClient.forSingleAttempt() }

    fun <T> get(endpoint: String?, uri: String, parser: (String) -> T): T = request(endpoint, "GET", uri, null, parser)
    fun <T> patch(endpoint: String?, uri: String, payload: String, parser: (String) -> T): T = request(endpoint, "PATCH", uri, payload, parser)
    fun <T> post(endpoint: String?, uri: String, payload: String, parser: (String) -> T): T = request(endpoint, "POST", uri, payload, parser)
    fun <T> put(endpoint: String?, uri: String, payload: String, parser: (String) -> T): T = request(endpoint, "PUT", uri, payload, parser)
    fun <T> delete(endpoint: String?, uri: String, parser: (String) -> T): T = request(endpoint, "DELETE", uri, null, parser)

    internal fun <T> request(endpoint: String?, method: String, uri: String, payload: String?, parser: (String) -> T,
        singleAttempt: Boolean = false, bypassCache: Boolean = false): T {
        val config = endpoints.resolve(endpoint) ?: error("Endpoint not found: $endpoint")
        val url = config.baseUrl.trimEnd('/') + "/" + uri.trimStart('/')
        val builder = Request.Builder().url(url).applyEndpoint(config)
        if (bypassCache) builder.header("Cache-Control", "no-cache")
        val request = when (method) {
            "PATCH", "POST", "PUT" -> builder.method(method, requireNotNull(payload).toRequestBody("application/json".toMediaType()))
            "DELETE" -> builder.delete()
            else -> builder.get()
        }
        val client = if (singleAttempt) {
            request.tag(PhysicalAttempt::class.java, PhysicalAttempt())
            config.singleAttemptClient ?: singleAttemptFallback
        } else config.httpClient ?: fallbackClient
        client.newCall(request.build()).execute().use { response ->
            if (!response.isSuccessful) throw HttpResponseException(response.code, method, url)
            return parser(response.body?.string().orEmpty())
        }
    }
}

private class PhysicalAttempt {
    val started = java.util.concurrent.atomic.AtomicBoolean(false)
}

private fun OkHttpClient.forSingleAttempt(): OkHttpClient =
    newBuilder().retryOnConnectionFailure(false).followRedirects(false).followSslRedirects(false).cache(null)
        .addNetworkInterceptor { chain ->
            val request = chain.request()
            val attempt = checkNotNull(request.tag(PhysicalAttempt::class.java))
            if (!attempt.started.compareAndSet(false, true)) throw java.io.IOException("An ordered command cannot repeat its HTTP request.")
            val response = chain.proceed(request)
            // Surface the first response before OkHttp can follow a 408, 503 Retry-After, or authentication challenge.
            if (!response.isSuccessful) response.use { throw HttpResponseException(it.code, request.method, request.url.toString()) }
            response
        }.build()

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

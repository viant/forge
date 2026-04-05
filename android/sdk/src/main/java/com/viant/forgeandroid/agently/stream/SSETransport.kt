package com.viant.forgeandroid.agently.stream

import com.viant.forgeandroid.runtime.applyEndpoint
import com.viant.forgeandroid.runtime.EndpointConfig
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.BufferedReader
import java.io.InterruptedIOException
import java.io.InputStreamReader
import java.net.SocketException
import kotlin.concurrent.thread

fun openEventStream(
    endpoint: EndpointConfig,
    path: String,
    conversationId: String,
    json: Json = Json { ignoreUnknownKeys = true }
): Flow<SSEEvent> = callbackFlow {
    val client = endpoint.httpClient ?: OkHttpClient()
    val url = endpoint.baseUrl.trimEnd('/') + "/" + path.trimStart('/')
    val request = Request.Builder()
        .url(url)
        .header("Accept", "text/event-stream")
        .applyEndpoint(endpoint)
        .build()

    val call = client.newCall(request)
    var reader: BufferedReader? = null
    var body = null as okhttp3.ResponseBody?
    var response = null as okhttp3.Response?
    val worker = thread(name = "agently-sse-$conversationId", isDaemon = true) {
        try {
            response = call.execute()
            val currentResponse = response ?: return@thread
            if (!currentResponse.isSuccessful) {
                close(IllegalStateException("GET $url failed: ${currentResponse.code}"))
                return@thread
            }

            body = currentResponse.body
            val currentBody = body
            if (currentBody == null) {
                close(IllegalStateException("GET $url returned empty response body"))
                return@thread
            }

            reader = BufferedReader(InputStreamReader(currentBody.byteStream()))
            val dataLines = mutableListOf<String>()

            fun flushDataLines() {
                if (dataLines.isEmpty()) return
                val payload = dataLines.joinToString("\n")
                dataLines.clear()
                val event = runCatching {
                    json.decodeFromString(SSEEvent.serializer(), payload)
                }.getOrNull()?.let { normalizeStreamEventIdentity(it, conversationId) }
                if (event != null) {
                    trySend(event)
                }
            }

            while (!call.isCanceled()) {
                val rawLine = reader?.readLine() ?: break
                when {
                    rawLine.startsWith("data:") -> dataLines += rawLine.removePrefix("data:")
                    rawLine.startsWith(":") -> Unit
                    rawLine.isBlank() -> flushDataLines()
                }
            }
            flushDataLines()
            close()
        } catch (err: Throwable) {
            val isExpectedShutdown = call.isCanceled() ||
                err is InterruptedException ||
                err is InterruptedIOException ||
                err is SocketException
            if (!isExpectedShutdown) {
                close(err)
            }
        } finally {
            runCatching { reader?.close() }
            runCatching { body?.close() }
            runCatching { response?.close() }
        }
    }

    awaitClose {
        call.cancel()
        worker.interrupt()
        runCatching { reader?.close() }
        runCatching { body?.close() }
        runCatching { response?.close() }
    }
}

package com.viant.forgeandroid.runtime

import android.content.Context
import androidx.javascriptengine.JavaScriptIsolate
import androidx.javascriptengine.JavaScriptSandbox
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

object ActionHookRuntime {
    private val json = Json { ignoreUnknownKeys = true }
    private val sandboxMutex = Mutex()
    private val sandboxScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    @Volatile
    private var applicationContext: Context? = null

    private var sandbox: JavaScriptSandbox? = null
    private var isolate: JavaScriptIsolate? = null
    private var idleCloseJob: Job? = null

    @Volatile
    internal var testScriptEvaluator: (suspend (String) -> String?)? = null

    fun initialize(context: Context) {
        applicationContext = context.applicationContext
    }

    suspend fun invoke(
        code: String,
        functionName: String,
        props: JsonElement = JsonObject(emptyMap())
    ): JsonElement? {
        val propsJson = json.encodeToString(JsonElement.serializer(), props)
        val fnNameJson = json.encodeToString(functionName)
        val script = """
          (() => {
            const __forge_module = ($code);
            const __forge_props = $propsJson;
            const __forge_fn_name = $fnNameJson;
            const __forge_fn = String(__forge_fn_name || "")
              .split(".")
              .filter(Boolean)
              .reduce((current, key) => current == null ? undefined : current[key], __forge_module);
            const __forge_result = typeof __forge_fn === "function"
              ? __forge_fn(__forge_props)
              : null;
            return __forge_result === undefined ? "null" : JSON.stringify(__forge_result);
          })()
        """.trimIndent()

        val encoded = testScriptEvaluator?.invoke(script) ?: evaluateWithSandbox(script)
        return if (encoded.isNullOrBlank() || encoded == "null") {
            null
        } else {
            json.parseToJsonElement(encoded)
        }
    }

    private suspend fun evaluateWithSandbox(script: String): String = sandboxMutex.withLock {
        withContext(Dispatchers.Default) {
            idleCloseJob?.cancel()
            idleCloseJob = null
            check(JavaScriptSandbox.isSupported()) {
                "Android JavaScriptSandbox is not supported on this device."
            }
            val context = checkNotNull(applicationContext) {
                "ActionHookRuntime is not initialized with an Android application context."
            }
            val activeIsolate = isolate ?: createIsolate(context)
            try {
                activeIsolate.evaluateJavaScriptAsync(script).get().also {
                    scheduleIdleClose()
                }
            } catch (error: Throwable) {
                closeSandbox()
                throw error
            }
        }
    }

    private fun scheduleIdleClose() {
        idleCloseJob?.cancel()
        idleCloseJob = sandboxScope.launch {
            delay(SANDBOX_IDLE_TIMEOUT_MILLIS)
            sandboxMutex.withLock {
                closeSandbox()
                idleCloseJob = null
            }
        }
    }

    private fun createIsolate(context: Context): JavaScriptIsolate {
        val connectedSandbox = JavaScriptSandbox.createConnectedInstanceAsync(context).get()
        return try {
            connectedSandbox.createIsolate().also { connectedIsolate ->
                sandbox = connectedSandbox
                isolate = connectedIsolate
            }
        } catch (error: Throwable) {
            connectedSandbox.close()
            throw error
        }
    }

    private fun closeSandbox() {
        runCatching { isolate?.close() }
        runCatching { sandbox?.close() }
        isolate = null
        sandbox = null
    }
}

private const val SANDBOX_IDLE_TIMEOUT_MILLIS = 10_000L

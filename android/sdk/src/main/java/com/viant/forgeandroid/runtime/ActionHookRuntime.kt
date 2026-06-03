package com.viant.forgeandroid.runtime

import android.content.Context
import androidx.javascriptengine.JavaScriptSandbox
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

object ActionHookRuntime {
    private val json = Json { ignoreUnknownKeys = true }

    @Volatile
    private var applicationContext: Context? = null

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
            __forge_result === undefined ? "null" : JSON.stringify(__forge_result);
        """.trimIndent()

        val encoded = testScriptEvaluator?.invoke(script) ?: evaluateWithSandbox(script)
        return if (encoded.isNullOrBlank() || encoded == "null") {
            null
        } else {
            json.parseToJsonElement(encoded)
        }
    }

    private suspend fun evaluateWithSandbox(script: String): String = withContext(Dispatchers.Default) {
        check(JavaScriptSandbox.isSupported()) {
            "Android JavaScriptSandbox is not supported on this device."
        }
        val context = checkNotNull(applicationContext) {
            "ActionHookRuntime is not initialized with an Android application context."
        }
        val sandbox = JavaScriptSandbox.createConnectedInstanceAsync(context).get()
        val isolate = sandbox.createIsolate()
        try {
            isolate.evaluateJavaScriptAsync(script).get()
        } finally {
            isolate.close()
            sandbox.close()
        }
    }
}

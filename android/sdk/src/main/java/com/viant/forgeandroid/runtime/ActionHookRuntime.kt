package com.viant.forgeandroid.runtime

import com.dokar.quickjs.QuickJs
import com.dokar.quickjs.evaluate
import kotlinx.coroutines.Dispatchers
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

object ActionHookRuntime {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun invoke(
        code: String,
        functionName: String,
        props: JsonElement = JsonObject(emptyMap())
    ): JsonElement? {
        val quickJs = QuickJs.create(Dispatchers.Default)
        return try {
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
            val encoded = quickJs.evaluate<String>(script)
            if (encoded.isBlank() || encoded == "null") {
                null
            } else {
                json.parseToJsonElement(encoded)
            }
        } finally {
            quickJs.close()
        }
    }
}

package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*

data class DataSourceLifecycleEffect(val kind: String, val ref: String, val value: JsonElement)

/** Executes synchronous metadata lifecycle hooks against snapshots and returns ordered effects. */
object DataSourceHookProjection {
    suspend fun invoke(
        code: String,
        functionName: String,
        namespace: String?,
        source: String,
        snapshots: JsonObject,
        collection: List<Map<String, Any?>>
    ): List<DataSourceLifecycleEffect> {
        val name = namespace?.takeIf { functionName.startsWith("$it.") }
            ?.let { functionName.removePrefix("$it.") } ?: functionName
        val wrapper = """
            (() => {
              const timers = [];
              const setTimeout = (fn, delay = 0) => {
                if (delay !== 0) throw new Error('Delayed lifecycle timers are unsupported');
                timers.push(fn); return timers.length;
              };
              const module = (
            $code
              );
              return { run: ({name, source, snapshots, collection}) => {
                const effects = [];
                const contexts = {};
                const contextFor = ref => {
                  if (!Object.prototype.hasOwnProperty.call(snapshots, ref)) return undefined;
                  if (contexts[ref]) return contexts[ref];
                  const state = snapshots[ref];
                  const form = { peek: () => state.form || {} };
                  Object.defineProperty(form, 'value', {
                    get: () => state.form || {},
                    set: value => { state.form = value; effects.push({kind:'form', ref, value}); }
                  });
                  const ctx = {
                    Context: contextFor,
                    signals: {form},
                    handlers: {dataSource: {
                      getFormData: () => state.form || {},
                      getCollection: () => state.collection || [],
                      setInputParameters: value => { state.input = value; effects.push({kind:'input', ref, value}); },
                      fetchCollection: options => { effects.push({kind:'fetch', ref, value: options || {}}); }
                    }}
                  };
                  contexts[ref] = ctx; return ctx;
                };
                const fn = module[name];
                if (typeof fn !== 'function') throw new Error('Missing lifecycle hook: ' + name);
                const result = fn({context:contextFor(source), collection});
                if (result && typeof result.then === 'function') throw new Error('Async lifecycle hooks are unsupported');
                let count = 0;
                while (timers.length) {
                  if (++count > 100) throw new Error('Lifecycle timer limit exceeded');
                  timers.shift()();
                }
                return effects;
              }};
            })()
        """.trimIndent()
        val result = ActionHookRuntime.invoke(
            code = wrapper,
            functionName = "run",
            props = JsonObject(
                mapOf(
                    "name" to JsonPrimitive(name),
                    "source" to JsonPrimitive(source),
                    "snapshots" to snapshots,
                    "collection" to JsonArray(collection.map(JsonUtil::anyToElement))
                )
            )
        ) as? JsonArray ?: return emptyList()
        return result.mapNotNull { element ->
            val obj = element as? JsonObject ?: return@mapNotNull null
            val kind = (obj["kind"] as? JsonPrimitive)?.contentOrNull ?: return@mapNotNull null
            val ref = (obj["ref"] as? JsonPrimitive)?.contentOrNull ?: return@mapNotNull null
            DataSourceLifecycleEffect(kind, ref, obj["value"] ?: JsonNull)
        }
    }
}

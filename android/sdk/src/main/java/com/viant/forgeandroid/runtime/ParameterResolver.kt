package com.viant.forgeandroid.runtime

class ParameterResolver {
    fun resolve(params: List<ParameterDef>, context: DataSourceContext): ParameterResolution {
        val inbound = mutableMapOf<String, MutableMap<String, Any?>>()
        val outbound = mutableListOf<ParameterDef>()

        fun ensure(ds: String): MutableMap<String, Any?> =
            inbound.getOrPut(ds) { mutableMapOf() }

        val compact = params.filter { it.from?.contains(":") == true && it.to?.contains(":") == true }
        compact.forEach { p ->
            val from = p.from ?: return@forEach
            val to = p.to ?: return@forEach
            if (p.direction == "out" || p.output == true || from.endsWith(":output")) {
                outbound.add(p)
                return@forEach
            }
            val (srcDsRaw, srcStoreRaw) = from.split(":", limit = 2)
            val (dstDsRaw, dstStoreRaw) = to.split(":", limit = 2)
            val srcDs = if (srcDsRaw.isBlank()) context.dataSourceRef else srcDsRaw
            val dstDs = if (dstDsRaw.isBlank()) context.dataSourceRef else dstDsRaw
            val srcStore = expandStore(srcStoreRaw)
            val dstStore = expandStore(dstStoreRaw)
            val srcValue = readStore(context, srcDs, srcStore, p.location ?: p.name)
            val dstMap = ensure(dstDs)
            writeStore(dstMap, dstStore, p.name, srcValue)
        }

        params.filter { it !in compact }.forEach { p ->
            if (p.output == true) {
                outbound.add(p)
                return@forEach
            }
            val toDs = p.to ?: p.kind
            val dst = toDs ?: ""
            val dstMap = ensure(dst)
            val value = readLegacy(context, p)
            val name = p.name ?: return@forEach
            dstMap[name] = value
        }

        return ParameterResolution(inbound, outbound)
    }

    private fun expandStore(store: String): String = when (store) {
        "query" -> "input.query"
        "path" -> "input.path"
        "headers" -> "input.headers"
        "body" -> "input.body"
        else -> store
    }

    private fun readStore(context: DataSourceContext, dsRef: String, store: String, path: String?): Any? {
        val ctx = context.window.context(dsRef)
        val key = path ?: ""
        return when (store) {
            "form" -> ctx.peekForm()[key]
            "selection" -> ctx.peekSelection().selected?.get(key)
            "filter" -> ctx.peekFilter()[key]
            else -> null
        }
    }

    private fun writeStore(dst: MutableMap<String, Any?>, store: String, name: String?, value: Any?) {
        val key = name ?: return
        when (store) {
            "input", "input.query", "input.path", "input.headers", "input.body" -> {
                val sub = dst.getOrPut("input") { mutableMapOf<String, Any?>() } as MutableMap<String, Any?>
                val subKey = store.removePrefix("input.")
                if (subKey.isNotEmpty()) {
                    val child = sub.getOrPut(subKey) { mutableMapOf<String, Any?>() } as MutableMap<String, Any?>
                    child[key] = value
                } else {
                    sub[key] = value
                }
            }
            else -> dst[key] = value
        }
    }

    private fun readLegacy(context: DataSourceContext, p: ParameterDef): Any? {
        return when (p.input) {
            "selection" -> context.peekSelection().selected?.get(p.location ?: "")
            "form" -> context.peekForm()[p.location ?: ""]
            "metadata" -> context.window.metadata.peek()?.let { it } // full metadata if needed
            "const" -> p.location
            else -> null
        }
    }
}

data class ParameterResolution(
    val inbound: Map<String, Map<String, Any?>>, // dsRef -> map
    val outbound: List<ParameterDef>
)

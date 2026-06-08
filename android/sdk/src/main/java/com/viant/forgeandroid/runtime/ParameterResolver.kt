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
            "metrics" -> SelectorUtil.resolve(ctx.metrics.peek(), key)
                ?: SelectorUtil.resolve(ctx.collection.peek().firstOrNull().orEmpty(), key)
            "input" -> SelectorUtil.resolve(ctx.input.peek(), key)
            "windowForm" -> SelectorUtil.resolve(context.window.peekWindowForm(), key)
            else -> null
        }
    }

    private fun writeStore(dst: MutableMap<String, Any?>, store: String, name: String?, value: Any?) {
        val key = name ?: return
        when (store) {
            "input", "input.query", "input.path", "input.headers", "input.body" -> {
                val sub = mutableMapStore(dst, "input")
                val subKey = store.removePrefix("input.")
                if (subKey.isNotEmpty()) {
                    val child = mutableMapStore(sub, subKey)
                    child[key] = value
                } else {
                    sub[key] = value
                }
            }
            else -> dst[key] = value
        }
    }

    private fun mutableMapStore(dst: MutableMap<String, Any?>, key: String): MutableMap<String, Any?> {
        val existing = dst[key]
        return if (existing is MutableMap<*, *>) {
            @Suppress("UNCHECKED_CAST")
            existing as MutableMap<String, Any?>
        } else {
            JsonUtil.asStringMap(existing).toMutableMap().also { dst[key] = it }
        }
    }

    private fun readLegacy(context: DataSourceContext, p: ParameterDef): Any? {
        val (sourceContext, location) = resolveLegacySourceContext(context, p.location)
        return when (p.input) {
            "selection" -> location?.let { SelectorUtil.resolve(sourceContext.peekSelection().selected ?: emptyMap<String, Any?>(), it) }
            "form" -> location?.let { SelectorUtil.resolve(sourceContext.peekForm(), it) }
            "windowForm" -> location?.let { SelectorUtil.resolve(context.window.peekWindowForm(), it) }
            "metrics" -> location?.let {
                SelectorUtil.resolve(sourceContext.metrics.peek(), it)
                    ?: SelectorUtil.resolve(sourceContext.collection.peek().firstOrNull().orEmpty(), it)
            }
            "filter" -> location?.let { SelectorUtil.resolve(sourceContext.peekFilter(), it) }
            "input" -> location?.let { SelectorUtil.resolve(sourceContext.input.peek(), it) }
            "metadata" -> sourceContext.window.metadata.peek()?.let { it } // full metadata if needed
            "const" -> p.location
            else -> null
        }
    }

    fun resolveFlat(params: List<ParameterDef>, context: DataSourceContext): Map<String, Any?> {
        val resolved = linkedMapOf<String, Any?>()
        params.forEach { parameter ->
            val name = parameter.name ?: return@forEach
            val value = readLegacy(context, parameter) ?: return@forEach
            resolved[name] = value
        }
        return resolved
    }

    private fun resolveLegacySourceContext(
        context: DataSourceContext,
        rawLocation: String?
    ): Pair<DataSourceContext, String?> {
        val location = rawLocation?.trim().orEmpty()
        if (location.isEmpty()) {
            return context to rawLocation
        }
        val dotIndex = location.indexOf('.')
        if (dotIndex <= 0) {
            return context to location
        }
        val possibleRef = location.substring(0, dotIndex)
        val metadata = context.window.metadata.peek()
        if (metadata?.dataSources?.containsKey(possibleRef) == true) {
            return context.window.context(possibleRef) to location.substring(dotIndex + 1)
        }
        return context to location
    }
}

data class ParameterResolution(
    val inbound: Map<String, Map<String, Any?>>, // dsRef -> map
    val outbound: List<ParameterDef>
)

package com.viant.forgeandroid.runtime

class ParameterResolver {
    fun resolve(params: List<ParameterDef>, context: DataSourceContext): ParameterResolution {
        val inbound = mutableMapOf<String, MutableMap<String, Any?>>()
        val outbound = mutableListOf<ParameterDef>()

        fun ensure(ds: String): MutableMap<String, Any?> =
            inbound.getOrPut(ds) { mutableMapOf() }

        val compact = params.filter { isCompact(it) }
        compact.forEach { p ->
            val from = p.from ?: return@forEach
            val to = p.to ?: return@forEach
            if (isOutbound(p)) {
                outbound.add(p)
                return@forEach
            }
            val (srcDsRaw, srcStoreRaw) = from.split(":", limit = 2)
            val (dstDsRaw, dstStoreRaw) = to.split(":", limit = 2)
            val srcDs = if (srcDsRaw.isBlank()) context.dataSourceRef else srcDsRaw
            val dstDs = if (dstDsRaw.isBlank()) context.dataSourceRef else dstDsRaw
            val srcStore = expandStore(srcStoreRaw)
            val dstStore = expandStore(dstStoreRaw)
            val sourcePath = if (p.name == "...") p.location else p.location ?: p.name
            val srcValue = readStore(context, srcDs, srcStore, sourcePath) ?: return@forEach
            val dstMap = ensure(dstDs)
            writeStore(dstMap, dstStore, p.name, srcValue)
        }

        params.filter { it !in compact }.forEach { p ->
            if (isOutbound(p)) {
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

    private fun isCompact(parameter: ParameterDef): Boolean =
        parameter.from?.contains(":") == true && parameter.to?.contains(":") == true

    private fun isOutbound(parameter: ParameterDef): Boolean {
        if (parameter.output == true) return true
        if (parameter.direction?.trim()?.lowercase() == "out") return true
        return parameter.from?.trim()?.lowercase()?.endsWith(":output") == true
    }

    private fun expandStore(store: String): String = when (store.trim().lowercase()) {
        "query" -> "input.query"
        "path" -> "input.path"
        "headers" -> "input.headers"
        "body" -> "input.body"
        else -> store.trim().lowercase()
    }

    private fun readStore(context: DataSourceContext, dsRef: String, store: String, path: String?): Any? {
        val ctx = context.window.contextOrNull(dsRef) ?: return null
        val key = path ?: ""
        return when (store) {
            "form" -> readObjectValue(ctx.peekForm(), key)
            "selection" -> readSelectionValue(ctx, key)
            "filter" -> readObjectValue(ctx.peekFilter(), key)
            "metrics" -> SelectorUtil.resolve(ctx.metrics.peek(), key)
                ?: SelectorUtil.resolve(ctx.collection.peek().firstOrNull().orEmpty(), key)
            "input" -> SelectorUtil.resolve(inputObject(ctx.input.peek()), key)
            "windowform" -> SelectorUtil.resolve(context.window.peekWindowForm(), key)
            else -> null
        }
    }

    private fun writeStore(dst: MutableMap<String, Any?>, store: String, name: String?, value: Any?) {
        val key = name ?: return
        when (store) {
            "input", "input.query", "input.path", "input.headers", "input.body" -> {
                val sub = mutableMapStore(dst, "input")
                val subKey = if (store == "input") "" else store.removePrefix("input.")
                if (subKey.isNotEmpty()) {
                    val child = mutableMapStore(sub, subKey)
                    applyResolvedValue(child, key, value)
                } else {
                    applyResolvedValue(sub, key, value)
                }
            }
            else -> {
                val target = mutableMapStore(dst, store)
                applyResolvedValue(target, key, value)
            }
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
            "dataSource" -> resolveFromLegacyDataSource(sourceContext, location)
            "windowForm" -> location?.let { SelectorUtil.resolve(context.window.peekWindowForm(), it) }
            "metrics" -> location?.let {
                SelectorUtil.resolve(sourceContext.metrics.peek(), it)
                    ?: SelectorUtil.resolve(sourceContext.collection.peek().firstOrNull().orEmpty(), it)
            }
            "filter" -> location?.let { SelectorUtil.resolve(sourceContext.peekFilter(), it) }
            "input" -> location?.let { SelectorUtil.resolve(inputObject(sourceContext.input.peek()), it) }
            "metadata" -> sourceContext.window.metadata.peek()?.let { it } // full metadata if needed
            "const" -> p.locationAny()
            else -> {
                p.value?.let(JsonUtil::elementToAny)
                    ?: p.selector?.let { SelectorUtil.resolve(context.window.peekWindowForm(), it) }
                    ?: p.locationAny()
            }
        }
    }

    private fun readSelectionValue(context: DataSourceContext, path: String): Any? {
        val selection = context.peekSelection()
        return if (context.dataSource.selectionMode == "multi") {
            if (path.isBlank()) {
                selection.selection
            } else {
                selection.selection.mapNotNull { row -> SelectorUtil.resolve(row, path) }
            }
        } else {
            val selected = selection.selected ?: return null
            readObjectValue(selected, path)
        }
    }

    private fun readObjectValue(source: Map<String, Any?>, path: String): Any? =
        if (path.isBlank()) source else SelectorUtil.resolve(source, path)

    private fun inputObject(input: InputState): Map<String, Any?> {
        val output = linkedMapOf<String, Any?>(
            "filter" to input.filter,
            "parameters" to input.parameters,
            "fetch" to input.fetch,
            "refresh" to input.refresh
        )
        if (input.page != null) {
            output["page"] = input.page
        }
        return output
    }

    private fun resolveFromLegacyDataSource(context: DataSourceContext, location: String?): Any? {
        val path = location.orEmpty()
        val candidates = listOf(
            context.peekSelection().selected,
            context.peekForm(),
            context.peekFilter(),
            inputObject(context.input.peek())
        )
        return candidates.firstNotNullOfOrNull { candidate ->
            candidate?.let { readObjectValue(it, path) }
        }
    }

    private fun applyResolvedValue(target: MutableMap<String, Any?>, name: String, value: Any?) {
        when {
            name == "..." -> {
                JsonUtil.asStringMap(value).forEach { (key, child) -> target[key] = child }
            }
            name.startsWith("[]") -> {
                val key = name.removePrefix("[]")
                if (key.isNotBlank()) {
                    target[key] = if (value is List<*>) value else listOf(value)
                }
            }
            name.contains(".") -> {
                val next = SelectorUtil.set(target, name, value)
                target.clear()
                target.putAll(next)
            }
            else -> target[name] = value
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

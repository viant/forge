package com.viant.forgeandroid.runtime

class ParameterResolver {
    fun resolve(params: List<ParameterDef>, context: DataSourceContext): ParameterResolution =
        resolveBindings(params, context, applyCodecs = false)

    internal fun resolveOperation(params: List<ParameterDef>, context: DataSourceContext): ParameterResolution =
        resolveBindings(params, context, applyCodecs = true)

    private fun resolveBindings(params: List<ParameterDef>, context: DataSourceContext, applyCodecs: Boolean): ParameterResolution {
        fun decoded(parameter: ParameterDef, raw: Any?): Any? {
            if (!applyCodecs || parameter.codec == null) return raw
            val codec = parameter.codec
            val name = (if (codec is kotlinx.serialization.json.JsonObject) codec["name"] else codec) as? kotlinx.serialization.json.JsonPrimitive
            return parameterValue(raw, name?.content?.trim()?.lowercase().orEmpty())
        }
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
            val srcValue = readStore(context, srcDs, srcStore, sourcePath)
            if (srcValue === SelectorUtil.Missing || (srcValue == null && srcStore != "collection")) return@forEach
            val dstMap = ensure(dstDs)
            writeStore(dstMap, dstStore, p.name, decoded(p, srcValue))
        }

        params.filter { it !in compact }.forEach { p ->
            if (isOutbound(p)) {
                outbound.add(p)
                return@forEach
            }
            val toDs = p.to ?: p.kind
            val dst = toDs ?: ""
            val dstMap = ensure(dst)
            val name = p.name ?: return@forEach
            if (!applyCodecs) {
                dstMap[name] = readLegacy(context, p)
                return@forEach
            }
            val raw = if (p.input == null && p.defaultValue != null) SelectorUtil.Missing else readLegacy(context, p, typed = true)
            if (raw === SelectorUtil.Missing && p.defaultValue == null) return@forEach
            val value = if (raw === SelectorUtil.Missing) p.defaultValue?.let(JsonUtil::elementToAny) else raw
            if (name == "...") checkParameterKeys(value)
            applyResolvedValue(dstMap, name, decoded(p, value))
        }

        return ParameterResolution(inbound, outbound)
    }

    private fun parameterValue(raw: Any?, codec: String): Any? {
        if (raw == null || codec.isEmpty()) return raw
        if (codec.endsWith("[]")) {
            val entries = if (raw is List<*>) raw else listOf(raw)
            return entries.map { parameterValue(it, codec.removeSuffix("[]")) }
        }
        if (raw is List<*>) return if (raw.size == 1) parameterValue(raw.first(), codec) else raw
        return when (codec) {
            "int", "integer" -> {
                if (raw !is String) raw else {
                    val parsed = raw.trim().toBigDecimalOrNull()
                    // Unsafe decimal IDs are opaque text all the way to the producer.
                    val integer = try { parsed?.longValueExact() } catch (_: ArithmeticException) { null }
                    if (integer != null && integer in -9007199254740991L..9007199254740991L) integer else raw
                }
            }
            "number", "float" -> if (raw is String) conditionNumber(raw) ?: raw else raw
            "boolean", "bool" -> when (raw) {
                is Number -> when (raw.toDouble()) { 1.0 -> true; 0.0 -> false; else -> raw }
                is String -> when (raw.trim().lowercase()) { "1", "true" -> true; "0", "false" -> false; else -> raw }
                else -> raw
            }
            "string" -> if (raw is Map<*, *>) "[object Object]" else raw.toString()
            "json" -> (if (raw is String) JsonUtil.elementToAny(JsonUtil.json.parseToJsonElement(raw)) else raw).also(::checkParameterKeys)
            else -> raw
        }
    }

    private fun checkParameterKeys(value: Any?) {
        when (value) {
            is Map<*, *> -> value.forEach { (key, child) ->
                require(key != "__proto__" && key != "prototype" && key != "constructor") { "The parameter contains an unsafe key." }
                checkParameterKeys(child)
            }
            is List<*> -> value.forEach(::checkParameterKeys)
        }
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
        val key = path ?: ""
        if (store == "collection") {
            if (context.window.metadata.peek()?.dataSources?.containsKey(dsRef) != true) return SelectorUtil.Missing
            val rows = context.window.signals.collection(context.window.identity.dataSourceId(dsRef)).peek()
            return if (key.isEmpty() || key == ".") rows else SelectorUtil.resolveParts(rows, key.split('.'), SelectorUtil.Missing)
        }
        val ctx = if (dsRef == context.dataSourceRef) context else context.window.contextOrNull(dsRef) ?: return null
        return when (store) {
            "form" -> readObjectValue(ctx.peekForm(), key)
            "selection" -> readSelectionValue(ctx, key)
            "filter" -> readObjectValue(ctx.peekFilter(), key)
            "metrics" -> SelectorUtil.resolve(ctx.metrics.peek(), key)
                ?: SelectorUtil.resolve(ctx.collection.peek().firstOrNull().orEmpty(), key)
            "input" -> SelectorUtil.resolve(ctx.input.peek().bindingValues(), key)
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

    private fun readLegacy(context: DataSourceContext, p: ParameterDef, typed: Boolean = false): Any? {
        val (sourceContext, location) = resolveLegacySourceContext(context, p.location, wholeReference = typed && (p.input == "selection" || p.input == "form"))
        fun select(store: Any?): Any? = when {
            location == null -> if (typed) SelectorUtil.Missing else null
            location.isEmpty() -> store
            else -> SelectorUtil.resolveParts(store, location.split('.'), if (typed) SelectorUtil.Missing else null)
        }
        return when (p.input) {
            "selection" -> if (typed && sourceContext.dataSource.selectionMode == "multi") {
                readSelectionValue(sourceContext, location.orEmpty())
            } else select(sourceContext.peekSelection().selected)
            "form" -> select(sourceContext.peekForm())
            "dataSource" -> resolveFromLegacyDataSource(sourceContext, location)
            "windowForm" -> select(context.window.peekWindowForm())
            "metrics" -> if (typed) select(sourceContext.metrics.peek()) else location?.let {
                SelectorUtil.resolve(sourceContext.metrics.peek(), it)
                    ?: SelectorUtil.resolve(sourceContext.collection.peek().firstOrNull().orEmpty(), it)
            }
            "filter" -> select(sourceContext.peekFilter())
            "input" -> select(sourceContext.input.peek().bindingValues())
            "metadata" -> sourceContext.window.metadata.peek()?.let { it } // full metadata if needed
            "const" -> if (!typed) p.constantValue() else if (p.locationElement() == null) SelectorUtil.Missing else p.locationAny()
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

    private fun resolveFromLegacyDataSource(context: DataSourceContext, location: String?): Any? {
        val path = location.orEmpty()
        val candidates = listOf(
            context.peekSelection().selected,
            context.peekForm(),
            context.peekFilter(),
            context.input.peek().bindingValues()
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
            val value = readLegacy(context, parameter)
            if (value != null || (parameter.input == "const" && parameter.locationElement() != null)) resolved[name] = value
        }
        return resolved
    }

    private fun resolveLegacySourceContext(
        context: DataSourceContext,
        rawLocation: String?,
        wholeReference: Boolean = false
    ): Pair<DataSourceContext, String?> {
        val location = rawLocation?.trim().orEmpty()
        if (location.isEmpty()) {
            return context to rawLocation
        }
        val dotIndex = location.indexOf('.')
        if (dotIndex <= 0) {
            if (wholeReference && location == context.dataSourceRef) return context to ""
            if (wholeReference && context.window.metadata.peek()?.dataSources?.containsKey(location) == true) {
                return context.window.context(location) to ""
            }
            return context to location
        }
        val possibleRef = location.substring(0, dotIndex)
        val metadata = context.window.metadata.peek()
        if (possibleRef == context.dataSourceRef) return context to location.substring(dotIndex + 1)
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

internal fun InputState.bindingValues(): Map<String, Any?> {
    val output = linkedMapOf<String, Any?>(
        "filter" to filter,
        "parameters" to parameters,
        "fetch" to fetch,
        "refresh" to refresh
    )
    if (page != null) {
        output["page"] = page
    }
    return output
}

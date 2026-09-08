package com.viant.forgeandroid.runtime

data class ResourceDataSnapshot(
    val form: Map<String, Any?> = emptyMap(),
    val collection: List<Map<String, Any?>> = emptyList(),
    val selection: SelectionState = SelectionState(),
    val metrics: Map<String, Any?> = emptyMap(),
    val input: InputState = InputState()
)

data class ResourceValueEnvironment(
    val identityDataSourceRef: String,
    val dataSources: Map<String, ResourceDataSnapshot>,
    val windowForm: Map<String, Any?> = emptyMap(),
    val extras: Map<String, Any?> = emptyMap()
)

typealias ResourceModelHook = suspend (name: String, value: Any?) -> Any?

object ResourceModelRuntime {
    suspend fun unmarshal(value: Any?, modelRef: String, schemas: Map<String, ResourceSchemaDef>, models: Map<String, ResourceModelDef>, hook: ResourceModelHook? = null): Any? {
        val model = models[modelRef] ?: error("Unknown resource model: $modelRef")
        val prepared = applyHook(model.hooks?.beforeUnmarshal, value, hook)
        val decoded = if (prepared is List<*>) prepared.map { unmarshalObject(it, model, schemas, models, hook) } else unmarshalObject(prepared, model, schemas, models, hook)
        return applyHook(model.hooks?.afterUnmarshal, decoded, hook)
    }

    suspend fun marshal(draft: Any?, baseline: Any?, modelRef: String, requestedMode: String? = null, requestedTarget: String? = null, schemas: Map<String, ResourceSchemaDef>, models: Map<String, ResourceModelDef>, hook: ResourceModelHook? = null): Map<String, Any?> {
        val model = models[modelRef] ?: error("Unknown resource model: $modelRef")
        val write = model.write ?: error("Resource model $modelRef requires a write binding")
        val mode = normalizeMode(requestedMode ?: write.mode ?: "changed")
        var canonical = if (mode == "overlaybaseline") overlayResource(baseline, draft) else draft
        canonical = applyHook(model.hooks?.beforeMarshal, canonical, hook)
        validate(canonical, model.schemaRef, schemas)
        validateImmutableIdentity(canonical, baseline, schemas[model.schemaRef])
        val wire = applyHook(model.hooks?.afterMarshal, marshalValue(canonical, baseline, model, mode, schemas, models, hook), hook)
        val target = requestedTarget?.trim().orEmpty().ifBlank { write.inputPath.orEmpty() }
        if (target.isEmpty() || target == "\$") return JsonUtil.asStringMap(wire).ifEmpty { error("Root resource payload must be an object") }
        val output = linkedMapOf<String, Any?>(); setPath(output, target, wire); return output
    }

    suspend fun prepare(payload: ResourcePayloadPreparationDef, environment: ResourceValueEnvironment, schemas: Map<String, ResourceSchemaDef>, models: Map<String, ResourceModelDef>, hook: ResourceModelHook? = null): Map<String, Any?> {
        val draft = if (payload.fields.isNotEmpty()) {
            linkedMapOf<String, Any?>().also { output -> payload.fields.forEach { (path, source) -> resolveSource(source, environment)?.let { setPath(output, path, it) } } }
        } else payload.source?.let { resolveSource(it, environment) } ?: environment.extras
        val baseline = payload.baseline?.let { resolveSource(it, environment) }
        return marshal(draft, baseline, payload.modelRef, payload.mode, payload.target, schemas, models, hook)
    }

    fun validate(value: Any?, schemaRef: String, schemas: Map<String, ResourceSchemaDef>) {
        val schema = schemas[schemaRef] ?: error("Unknown resource schema: $schemaRef")
        validateObject(value, schema, schemas, "\$")
    }

    private suspend fun unmarshalObject(value: Any?, model: ResourceModelDef, schemas: Map<String, ResourceSchemaDef>, models: Map<String, ResourceModelDef>, hook: ResourceModelHook?): Map<String, Any?> {
        val input = JsonUtil.asStringMap(value).ifEmpty { if (value is Map<*, *>) emptyMap() else error("Resource reader value must be an object") }
        val output = if (model.read?.preserveUnbound == true) input.toMutableMap() else linkedMapOf()
        model.fields.forEach { (field, binding) ->
            val raw = resolvePath(input, binding.read ?: field) ?: binding.defaultValue?.let(JsonUtil::elementToAny) ?: return@forEach
            output[field] = transformRead(raw, binding, schemas, models, hook)
        }
        validate(output, model.schemaRef, schemas)
        return output
    }

    private suspend fun transformRead(value: Any?, binding: ResourceFieldBindingDef, schemas: Map<String, ResourceSchemaDef>, models: Map<String, ResourceModelDef>, hook: ResourceModelHook?): Any? = when {
        binding.modelRef != null -> unmarshal(value, binding.modelRef, schemas, models, hook)
        binding.collection?.modelRef != null && value is List<*> -> value.map { unmarshal(it, binding.collection.modelRef, schemas, models, hook) }
        else -> applyCodec(value, binding.codec, binding.trim, binding.empty)
    }

    private suspend fun marshalValue(value: Any?, baseline: Any?, model: ResourceModelDef, mode: String, schemas: Map<String, ResourceSchemaDef>, models: Map<String, ResourceModelDef>, hook: ResourceModelHook?): Any? {
        if (value is List<*>) {
            val prior = baseline as? List<*> ?: emptyList<Any?>()
            return value.mapIndexed { index, item -> marshalValue(item, prior.getOrNull(index), model, mode, schemas, models, hook) }
        }
        val source = JsonUtil.asStringMap(value)
        val prior = JsonUtil.asStringMap(baseline)
        val schema = schemas[model.schemaRef]
        val output = linkedMapOf<String, Any?>()
        model.fields.forEach { (field, binding) ->
            if (binding.write == "-") return@forEach
            val current = if (source.containsKey(field)) source[field] else binding.defaultValue?.let(JsonUtil::elementToAny)
            val previous = prior[field]
            val include = mode != "changed" || field in schema?.identity.orEmpty() || binding.alwaysWrite || (!binding.omitIfUnchanged && current != previous)
            if (!include || current == null) return@forEach
            val transformed = when {
                binding.modelRef != null -> {
                    val nested = models[binding.modelRef] ?: error("Unknown nested model: ${binding.modelRef}")
                    val prepared = applyHook(nested.hooks?.beforeMarshal, current, hook)
                    applyHook(nested.hooks?.afterMarshal, marshalValue(prepared, previous, nested, mode, schemas, models, hook), hook)
                }
                binding.collection?.modelRef != null -> {
                    val nested = models[binding.collection.modelRef] ?: error("Unknown nested model: ${binding.collection.modelRef}")
                    val prepared = applyHook(nested.hooks?.beforeMarshal, mergeCollection(current, previous, binding.collection, schemas[nested.schemaRef]), hook)
                    applyHook(nested.hooks?.afterMarshal, marshalValue(prepared, previous, nested, mode, schemas, models, hook), hook)
                }
                else -> applyCodec(current, binding.codec, binding.trim, binding.empty)
            }
            if (transformed == null && binding.empty.equals("omit", true)) return@forEach
            setPath(output, binding.write ?: field, transformed)
        }
        return output
    }

    private fun resolveSource(source: ResourceValueSourceDef, environment: ResourceValueEnvironment): Any? {
        val scope = source.scope?.lowercase() ?: "extras"
        val snapshot = environment.dataSources[source.dataSourceRef ?: environment.identityDataSourceRef] ?: ResourceDataSnapshot()
        var value: Any? = when (scope) {
            "constant" -> source.value?.let(JsonUtil::elementToAny)
            "extras" -> environment.extras
            "form" -> snapshot.form
            "collection" -> snapshot.collection
            "selection" -> snapshot.selection.selection.ifEmpty { snapshot.selection.selected?.let(::listOf).orEmpty() }
            "metrics" -> snapshot.metrics
            "input" -> mapOf("filter" to snapshot.input.filter, "parameters" to snapshot.input.parameters)
            "windowform" -> environment.windowForm
            else -> error("Unsupported resource value scope: $scope")
        }
        source.selector?.takeIf(String::isNotBlank)?.let { value = resolveValuePath(value, it) }
        source.where?.let { filter -> if (value is List<*>) value = (value as List<*>).filter { filterMatches(it, filter) } }
        source.mapSelector?.let { selector -> if (value is List<*>) value = (value as List<*>).map { resolveValuePath(it, selector) } }
        return source.codec?.let { applyCodec(value, it, false, null) } ?: value
    }

    private fun validateObject(value: Any?, schema: ResourceSchemaDef, schemas: Map<String, ResourceSchemaDef>, path: String) {
        val objectValue = JsonUtil.asStringMap(value)
        require(objectValue.isNotEmpty() || value is Map<*, *>) { "$path must be an object" }
        schema.required.forEach { require(objectValue.containsKey(it) && objectValue[it] != null) { "$path.$it is required" } }
        if (schema.additionalProperties == false) objectValue.keys.forEach { require(it in schema.properties) { "$path.$it is not declared" } }
        schema.properties.forEach { (field, fieldSchema) -> if (objectValue.containsKey(field)) validateField(objectValue[field], fieldSchema, schemas, "$path.$field") }
    }

    private fun validateField(value: Any?, schema: ResourceFieldSchemaDef, schemas: Map<String, ResourceSchemaDef>, path: String) {
        if (value == null) { require(schema.nullable) { "$path cannot be null" }; return }
        schema.ref?.let { ref -> validateObject(value, schemas[ref] ?: error("Unknown resource schema: $ref"), schemas, path); return }
        when (schema.type?.lowercase()) {
            "string" -> { require(value is String) { "$path must be a string" }; schema.minLength?.let { require(value.length >= it) { "$path is too short" } }; schema.maxLength?.let { require(value.length <= it) { "$path is too long" } } }
            "integer" -> require(value is Number && value.toDouble() % 1.0 == 0.0) { "$path must be an integer" }
            "number" -> require(value is Number) { "$path must be a number" }
            "boolean" -> require(value is Boolean) { "$path must be a boolean" }
            "array" -> { require(value is List<*>) { "$path must be an array" }; schema.minItems?.let { require(value.size >= it) { "$path has too few items" } }; schema.maxItems?.let { require(value.size <= it) { "$path has too many items" } }; schema.items?.let { item -> value.forEachIndexed { index, entry -> validateField(entry, item, schemas, "$path[$index]") } } }
            "object" -> validateObject(value, ResourceSchemaDef(type = "object", required = schema.required, properties = schema.properties), schemas, path)
        }
        if (schema.enumValues.isNotEmpty()) require(schema.enumValues.map(JsonUtil::elementToAny).contains(value)) { "$path is not an allowed value" }
        (value as? Number)?.toDouble()?.let { number -> schema.minimum?.let { require(number >= it) { "$path is below minimum" } }; schema.maximum?.let { require(number <= it) { "$path is above maximum" } } }
    }

    private fun applyCodec(raw: Any?, codec: String?, trim: Boolean, empty: String?): Any? {
        var value = if (trim && raw is String) raw.trim() else raw
        if (value == "" && (empty.equals("null", true) || empty.equals("omit", true))) return null
        value = when (codec?.lowercase()) {
            "int", "integer" -> (value as? Number)?.toLong() ?: value?.toString()?.toLongOrNull() ?: error("Cannot coerce value to integer")
            "float", "number" -> (value as? Number)?.toDouble() ?: value?.toString()?.toDoubleOrNull() ?: error("Cannot coerce value to number")
            "bool", "boolean" -> value as? Boolean ?: value?.toString()?.toBooleanStrictOrNull() ?: error("Cannot coerce value to boolean")
            "string" -> value?.toString()
            else -> value
        }
        return value
    }

    private fun mergeCollection(draft: Any?, baseline: Any?, binding: ResourceCollectionBindingDef, schema: ResourceSchemaDef?): List<Any?> {
        val draftRows = draft as? List<*> ?: error("Nested resource collection must be an array")
        val baselineRows = baseline as? List<*> ?: emptyList<Any?>()
        val identities = binding.identity.ifEmpty { schema?.identity.orEmpty() }
        require(identities.isNotEmpty()) { "Nested resource collection requires identity fields" }
        fun key(value: Any?, index: Int): String {
            val row = JsonUtil.asStringMap(value)
            val values = identities.map { row[it] }
            val newIdentity = values.all { it == null || it == "" || (it as? Number)?.toDouble() == 0.0 || it == "0" }
            if (newIdentity) binding.clientKey?.let { row[it]?.toString()?.takeIf(String::isNotBlank)?.let { key -> return "client:$key" } }
            val identity = values.mapNotNull { it?.toString()?.takeIf(String::isNotBlank) }
            if (identity.size == identities.size) return identity.joinToString("\u001f")
            error("Nested resource row $index is missing identity fields")
        }
        val baselineByKey = baselineRows.mapIndexed { index, row -> key(row, index) to row }.toMap()
        val seen = mutableSetOf<String>()
        val result = draftRows.mapIndexed { index, row -> val id = key(row, index); require(seen.add(id)) { "Duplicate nested resource identity: $id" }; overlayResource(baselineByKey[id], row) }.toMutableList()
        if (binding.mode.equals("merge", true)) {
            if (binding.preserveOrder == false) {
                val draftByKey = result.mapIndexed { index, row -> key(row, index) to row }.toMap()
                val baselineKeys = mutableSetOf<String>()
                val ordered = baselineRows.mapIndexed { index, row ->
                    val id = key(row, index); baselineKeys += id; draftByKey[id] ?: row
                }.toMutableList()
                result.forEachIndexed { index, row -> if (key(row, index) !in baselineKeys) ordered += row }
                return ordered
            }
            baselineRows.forEachIndexed { index, row -> if (key(row, index) !in seen) result += row }
        }
        return result
    }

    private fun validateImmutableIdentity(draft: Any?, baseline: Any?, schema: ResourceSchemaDef?) {
        val current = JsonUtil.asStringMap(draft); val prior = JsonUtil.asStringMap(baseline)
        schema?.identity.orEmpty().forEach { field -> if (current.containsKey(field)) require(current[field] == prior[field]) { "Resource identity field is immutable: $field" } }
    }

    private fun filterMatches(value: Any?, filter: ResourceValueFilterDef): Boolean {
        val actual = resolveValuePath(value, filter.field)
        filter.equals?.let { return actual == JsonUtil.elementToAny(it) }
        filter.notEquals?.let { return actual != JsonUtil.elementToAny(it) }
        if (filter.inValues.isNotEmpty()) return filter.inValues.map(JsonUtil::elementToAny).contains(actual)
        return false
    }

    private suspend fun applyHook(name: String?, value: Any?, hook: ResourceModelHook?): Any? {
        val hookName = name?.trim().orEmpty()
        if (hookName.isEmpty() || hook == null) return value
        return hook(hookName, value) ?: value
    }
}

private fun normalizeMode(value: String): String = value.lowercase().replace("-", "").replace("_", "")
private fun overlayResource(base: Any?, patch: Any?): Any? {
    val left = base as? Map<*, *> ?: return patch
    val right = patch as? Map<*, *> ?: return patch
    val result = left.entries.filter { it.key is String }.associate { it.key as String to it.value }.toMutableMap()
    right.entries.filter { it.key is String }.forEach { (key, value) -> result[key as String] = if (result.containsKey(key)) overlayResource(result[key], value) else value }
    return result
}
private fun resolvePath(objectValue: Map<String, Any?>, path: String): Any? = resolveValuePath(objectValue, path)
private fun resolveValuePath(value: Any?, path: String): Any? {
    if (path.isBlank()) return value
    return path.split('.').fold(value) { current, part -> when (current) { is Map<*, *> -> current[part]; is List<*> -> part.toIntOrNull()?.let(current::getOrNull); else -> null } }
}
private fun setPath(objectValue: MutableMap<String, Any?>, path: String, value: Any?) {
    val parts = path.split('.'); if (parts.size == 1) { objectValue[parts[0]] = value; return }
    val first = parts.first(); val child = JsonUtil.asStringMap(objectValue[first]).toMutableMap(); setPath(child, parts.drop(1).joinToString("."), value); objectValue[first] = child
}

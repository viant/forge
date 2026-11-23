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
        val associationModels = associationCollectionModels(modelRef, models)
        val associationFields = model.fields.filterValues { it.associationDelta != null }.keys
        val overlayBase = if (associationFields.isEmpty()) baseline else {
            require(draft is Map<*, *>) { "Association delta requires one canonical resource object" }
            JsonUtil.asStringMap(baseline).filterKeys { it !in associationFields }
        }
        var canonical = if (mode == "overlaybaseline") overlayResource(overlayBase, draft) else draft
        canonical = applyHook(model.hooks?.beforeMarshal, canonical, hook)
        validate(canonical, model.schemaRef, schemas)
        if (associationFields.isEmpty() || baseline != null) validateImmutableIdentity(canonical, baseline, schemas[model.schemaRef])
        val wire = applyHook(model.hooks?.afterMarshal, marshalValue(canonical, baseline, model, mode, schemas, models, associationModels, hook), hook)
        val target = requestedTarget?.trim().orEmpty().ifBlank { write.inputPath.orEmpty() }
        if (target.isEmpty() || target == "\$") return JsonUtil.asStringMap(wire).ifEmpty { error("Root resource payload must be an object") }
        val payload = if (associationFields.isNotEmpty() && write.collection) listOf(wire) else wire
        val output = linkedMapOf<String, Any?>()
        setPath(output, target, payload)
        return output
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
            if (binding.associationDelta?.mode == "explicit") {
                output.remove(field)
                return@forEach
            }
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

    private suspend fun marshalValue(value: Any?, baseline: Any?, model: ResourceModelDef, mode: String, schemas: Map<String, ResourceSchemaDef>, models: Map<String, ResourceModelDef>, associationModels: Set<String>, hook: ResourceModelHook?): Any? {
        if (value is List<*>) {
            val prior = baseline as? List<*> ?: emptyList<Any?>()
            return value.mapIndexed { index, item -> marshalValue(item, prior.getOrNull(index), model, mode, schemas, models, associationModels, hook) }
        }
        val source = JsonUtil.asStringMap(value)
        val prior = JsonUtil.asStringMap(baseline)
        val schema = schemas[model.schemaRef]
        val output = linkedMapOf<String, Any?>()
        model.fields.forEach { (field, binding) ->
            binding.associationDelta?.let { delta ->
                if (source.containsKey(field)) {
                    val fieldSchema = schema?.properties?.get(field) ?: error("Missing association schema for $field")
                    if (baseline != null) validateImmutableIdentity(value, baseline, schema)
                    projectAssociationDelta(source[field], prior, field, fieldSchema, delta, output)
                }
                return@forEach
            }
            if (binding.write == "-") return@forEach
            val current = if (source.containsKey(field)) source[field] else binding.defaultValue?.let(JsonUtil::elementToAny)
            val previous = prior[field]
            val include = mode != "changed" || field in schema?.identity.orEmpty() || binding.alwaysWrite || (!binding.omitIfUnchanged && current != previous)
            if (!include || current == null) return@forEach
            val transformed = when {
                binding.modelRef != null -> {
                    val nested = models[binding.modelRef] ?: error("Unknown nested model: ${binding.modelRef}")
                    val prepared = applyHook(nested.hooks?.beforeMarshal, current, hook)
                    applyHook(nested.hooks?.afterMarshal, marshalValue(prepared, previous, nested, mode, schemas, models, associationModels, hook), hook)
                }
                binding.collection?.modelRef != null -> {
                    val nested = models[binding.collection.modelRef] ?: error("Unknown nested model: ${binding.collection.modelRef}")
                    val collection = binding.collection
                    val nestedSchema = schemas[nested.schemaRef]
                    val pairByIdentity = binding.collection.modelRef in associationModels
                    val associationFields = if (pairByIdentity) nested.fields.filterValues { it.associationDelta != null }.keys else emptySet()
                    val merged = mergeCollection(current, previous, collection, nestedSchema, associationFields, pairByIdentity)
                    val marker = collection.deleteMarker
                    if (marker == null) {
                        val draftRows = merged.map { it.row }
                        val prepared = applyHook(nested.hooks?.beforeMarshal, draftRows, hook)
                        require(!pairByIdentity || prepared == draftRows) {
                            "Collection hooks cannot replace association draft rows before identity pairing"
                        }
                        val priorRows = if (pairByIdentity) merged.map { it.prior } else previous
                        applyHook(nested.hooks?.afterMarshal, marshalValue(prepared, priorRows, nested, mode, schemas, models, associationModels, hook), hook)
                    } else {
                        val identities = collection.identity.ifEmpty { nestedSchema?.identity.orEmpty() }
                        val markerSchema = nestedSchema?.properties?.get(marker)
                        require(markerSchema?.type == "boolean" && !markerSchema.readOnly && markerSchema.defaultValue == null &&
                            nested.fields[marker]?.defaultValue == null && nested.fields[marker]?.write != "-") {
                            "Collection deleteMarker must be a writable boolean"
                        }
                        val rows = mutableListOf<Any?>()
                        for (entry in merged) {
                            val row = JsonUtil.asStringMap(entry.row)
                            require(!row.containsKey(marker) || row[marker] is Boolean) {
                                "Collection removal requires an explicit boolean marker"
                            }
                            if (row[marker] == true) {
                                val removed = linkedMapOf<String, Any?>()
                                for (identity in identities) {
                                    val value = row[identity]
                                    val identityBinding = nested.fields[identity]
                                    require(persistedCollectionIdentity(value) && identity != marker && identityBinding?.write != "-") {
                                        "Collection removal requires a writable persisted identity"
                                    }
                                    setPath(removed, identityBinding?.write ?: identity, applyCodec(value, identityBinding?.codec, identityBinding?.trim == true, identityBinding?.empty))
                                }
                                setPath(removed, nested.fields[marker]?.write ?: marker, true)
                                rows.add(removed)
                            } else {
                                if (mode == "changed" && entry.prior != null) {
                                    val comparison = if (associationFields.isEmpty()) entry.prior else
                                        JsonUtil.asStringMap(entry.prior).filterKeys { it !in associationFields || row.containsKey(it) }
                                    if (entry.row == comparison) continue
                                }
                                val prepared = applyHook(nested.hooks?.beforeMarshal, entry.row, hook)
                                val wire = marshalValue(prepared, entry.prior, nested, if (mode == "changed") "overlaybaseline" else mode, schemas, models, associationModels, hook)
                                rows.add(applyHook(nested.hooks?.afterMarshal, wire, hook))
                            }
                        }
                        if (mode == "changed" && rows.isEmpty()) return@forEach
                        rows
                    }
                }
                else -> applyCodec(current, binding.codec, binding.trim, binding.empty)
            }
            if (transformed == null && binding.empty.equals("omit", true)) return@forEach
            setPath(output, binding.write ?: field, transformed)
        }
        return output
    }

    private fun associationCollectionModels(root: String, models: Map<String, ResourceModelDef>): Set<String> {
        val reachable = mutableSetOf<String>()
        val pending = mutableListOf(root)
        val parents = mutableMapOf<String, MutableSet<String>>()
        val affected = mutableSetOf<String>()
        while (pending.isNotEmpty()) {
            val ref = pending.removeAt(pending.lastIndex)
            if (!reachable.add(ref)) continue
            models[ref]?.fields?.values.orEmpty().forEach { binding ->
                if (binding.associationDelta != null) affected += ref
                val child = binding.modelRef ?: binding.collection?.modelRef ?: return@forEach
                parents.getOrPut(child) { mutableSetOf() } += ref
                pending += child
            }
        }
        pending.addAll(affected)
        while (pending.isNotEmpty()) {
            val child = pending.removeAt(pending.lastIndex)
            parents[child].orEmpty().forEach { parent -> if (affected.add(parent)) pending += parent }
        }
        return affected
    }

    private fun projectAssociationDelta(current: Any?, prior: Map<String, Any?>, field: String, schema: ResourceFieldSchemaDef, delta: ResourceAssociationDeltaBindingDef, output: MutableMap<String, Any?>) {
        fun ids(value: Any?, type: String?, path: String): Set<Any> {
            require(value is List<*>) { "$path must be an ID array" }
            return value.mapTo(linkedSetOf()) { id ->
                when {
                    type == "string" && id is String -> id
                    type == "integer" && id is Number -> {
                        val number = id.toDouble()
                        require(kotlin.math.abs(number) < 9_007_199_254_740_992.0 && number == number.toLong().toDouble()) {
                            "$path contains an invalid association ID"
                        }
                        number.toLong()
                    }
                    else -> error("$path contains an invalid association ID")
                }
            }
        }
        val (added, deleted) = when (delta.mode) {
            "diff" -> {
                require(delta.baselineComplete?.let { resolvePath(prior, it) } == true) { "$field requires a complete association baseline" }
                val before = ids(prior[field], schema.items?.type, "$field.baseline")
                val after = ids(current, schema.items?.type, field)
                (after - before) to (before - after)
            }
            "explicit" -> {
                require(current is Map<*, *> && current.keys.all { it == "added" || it == "deleted" }) {
                    "$field must contain explicit added or deleted ID lists"
                }
                val additions = ids(if (current.containsKey("added")) current["added"] else emptyList<Any>(), schema.properties["added"]?.items?.type, "$field.added")
                val removals = ids(if (current.containsKey("deleted")) current["deleted"] else emptyList<Any>(), schema.properties["deleted"]?.items?.type, "$field.deleted")
                require(additions.none { it in removals }) { "$field cannot add and delete the same ID" }
                additions to removals
            }
            else -> error("Unknown association delta mode: ${delta.mode}")
        }
        if (added.isNotEmpty()) setPath(output, delta.added, added.toList())
        if (deleted.isNotEmpty()) setPath(output, delta.deleted, deleted.toList())
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

    private fun persistedCollectionIdentity(value: Any?): Boolean {
        val number = when (value) {
            is Number -> value.toDouble()
            is String -> value.trim().toDoubleOrNull()
            else -> return false
        }
        return if (number != null) number.isFinite() && number in 1.0..9_007_199_254_740_991.0 && number % 1.0 == 0.0
        else value is String && value.isNotBlank()
    }

    private data class NestedRow(val row: Any?, val prior: Any?, val id: String?)

    private fun mergeCollection(draft: Any?, baseline: Any?, binding: ResourceCollectionBindingDef, schema: ResourceSchemaDef?, associationFields: Set<String>, pairByIdentity: Boolean): List<NestedRow> {
        val draftRows = draft as? List<*> ?: error("Nested resource collection must be an array")
        val baselineRows = (baseline as? List<*> ?: emptyList<Any?>()).map { row ->
            if (binding.deleteMarker == null) row else JsonUtil.asStringMap(row) - binding.deleteMarker
        }
        val identities = binding.identity.ifEmpty { schema?.identity.orEmpty() }
        require(identities.isNotEmpty()) { "Nested resource collection requires identity fields" }
        fun key(value: Any?, index: Int): String? {
            val row = JsonUtil.asStringMap(value)
            val values = identities.map { row[it] }
            val newIdentity = values.all { it == null || it == "" || (it as? Number)?.toDouble() == 0.0 || it == "0" }
            if (newIdentity) {
                binding.clientKey?.let { row[it]?.toString()?.takeIf(String::isNotBlank)?.let { key -> return "client:$key" } }
                if (binding.clientKey == null && binding.deleteMarker != null) return null
            }
            if (pairByIdentity) {
                val typed = values.mapNotNull {
                    when (it) {
                        is String -> it.takeUnless(String::isEmpty)?.let { value -> "s:${value.length}:$value" }
                        is Number -> it.toDouble().takeIf(Double::isFinite)?.let { value -> "n:${if (value == 0.0) 0.0 else value}" }
                        is Boolean -> "b:$it"
                        else -> null
                    }
                }
                if (typed.size == identities.size) return typed.joinToString("|")
                error("Nested resource row $index is missing identity fields")
            }
            val identity = values.mapNotNull { it?.toString()?.takeIf(String::isNotBlank) }
            if (identity.size == identities.size) return identity.joinToString("\u001f")
            error("Nested resource row $index is missing identity fields")
        }
        fun overlayBase(value: Any?): Any? {
            if (associationFields.isEmpty() || value == null) return value
            return JsonUtil.asStringMap(value).filterKeys { it !in associationFields }
        }
        val baselineEntries = baselineRows.mapIndexedNotNull { index, row -> key(row, index)?.let { it to row } }
        val baselineByKey = baselineEntries.toMap()
        require(!pairByIdentity || baselineByKey.size == baselineEntries.size) { "Duplicate nested baseline resource identity" }
        val seen = mutableSetOf<String>()
        val result = draftRows.mapIndexed { index, row ->
            val id = key(row, index)
            if (id != null) require(seen.add(id)) { "Duplicate nested resource identity: $id" }
            val prior = baselineByKey[id]
            NestedRow(overlayResource(overlayBase(prior), row), prior, id)
        }.toMutableList()
        if (binding.mode.equals("merge", true)) {
            if (binding.preserveOrder == false) {
                val draftByKey = result.mapNotNull { entry -> entry.id?.let { it to entry } }.toMap()
                return baselineEntries.map { (id, row) -> draftByKey[id] ?: NestedRow(overlayBase(row), row, id) } +
                    result.filter { it.id == null || it.id !in baselineByKey }
            }
            baselineEntries.forEach { (id, row) -> if (id !in seen) result += NestedRow(overlayBase(row), row, id) }
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

package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*

/** Canonical web request base, before the authored buildRequest hook. Inputs are immutable. */
fun buildCanonicalReportRequestBase(config: JsonObject, state: JsonObject): JsonObject {
    val requestConfig = cbObject(config["request"])
    val resultConfig = cbObject(config["result"])
    val measures = cbObjects(config["measures"])
    val dimensions = cbObjects(config["dimensions"])
    val calculated = listOf("computedMeasures", "calculatedFields", "tableCalculations")
        .flatMap { cbObjects(config[it]) }.filter { it["hidden"] != JsonPrimitive(true) }
    var request = cbObject(requestConfig["baseParameters"])
    fun emit(path: String, value: JsonElement) { request = reportSetPath(request, path, value) }
    val options = buildJsonObject {
        cbObjects(config["reportOptions"]).forEach { def ->
            val name = cbText(def["name"])
            if (name.isEmpty() || cbEntityOption(name)) return@forEach
            val type = cbText(def["type"]).lowercase()
            val selected = cbOptionValue(cbObject(state["reportOptions"])[name], type)
            val values = cbArray(def["values"]).mapNotNull { cbOptionValue((it as? JsonObject)?.get("value") ?: it, type) }
            val fallback = cbOptionValue(def["default"], type)?.takeIf { values.isEmpty() || it in values }
            val value = selected?.takeIf { values.isEmpty() || it in values } ?: fallback
            if (value != null && value != JsonNull) put(name, value)
        }
    }
    if (options.isNotEmpty()) emit("options", options)
    val selectedDimensions = cbIds(state["selectedDimensions"]).toMutableSet()
    val dependencyMeasures = linkedSetOf<String>()
    val visited = mutableSetOf<String>()
    fun dimension(field: String) = dimensions.firstOrNull { cbAliases(it).contains(field) }
    fun dependency(field: String) {
        if (field.isBlank() || !visited.add(field)) return
        val measure = measures.firstOrNull { cbAliases(it).contains(field) }
        if (measure != null) {
            val id = cbId(measure)
            dependencyMeasures.add(id)
            emit(cbText(measure["paramPath"]).ifEmpty { "measures.$id" }, JsonPrimitive(true))
            return
        }
        dimension(field)?.let { selectedDimensions.add(cbId(it)); return }
        calculated.firstOrNull { cbAliases(it).contains(field) }?.let {
            cbIds(it["dependencies"]).forEach(::dependency)
        }
    }
    val selectedMeasures = cbIds(state["selectedMeasures"])
    selectedMeasures.forEach { id ->
        val measure = measures.firstOrNull { cbId(it) == id }
        if (measure != null) emit(cbText(measure["paramPath"]).ifEmpty { "measures.$id" }, JsonPrimitive(true))
        else calculated.firstOrNull { cbId(it) == id }?.let { cbIds(it["dependencies"]).forEach(::dependency) }
    }
    calculated.filter { cbId(it) in selectedMeasures }.forEach { field ->
        val compute = cbObject(field["compute"])
        (cbIds(compute["partitionBy"]) + cbObjects(compute["orderBy"]).map { cbText(it["field"]) })
            .forEach { key -> dimension(key)?.let { selectedDimensions.add(cbId(it)) } }
    }
    val groupBy = cbText(state["groupBy"])
    if (groupBy.isNotEmpty()) {
        val option = cbObjects(cbObject(config["groupBy"])["options"]).firstOrNull { cbText(it["value"]) == groupBy }
        selectedDimensions.add(cbText(option?.get("dimensionId")).ifEmpty { groupBy })
        val path = cbText(option?.get("paramPath"))
        if (path.isNotEmpty()) emit(path, option?.get("paramValue")?.takeIf { it != JsonNull } ?: JsonPrimitive(true))
    }
    selectedDimensions.forEach { id -> dimensions.firstOrNull { cbId(it) == id }?.let {
        emit(cbText(it["paramPath"]).ifEmpty { "dimensions.$id" }, JsonPrimitive(true))
    } }

    // The caller supplies the predicate-lowered config, exactly as the web builder does.
    val filters = cbObjects(config["staticFilters"])
    val scope = (state["scopeParams"] as? JsonObject) ?: cbObject(state["staticFilters"])
    filters.forEach { filter ->
        val id = cbId(filter).ifEmpty { cbText(filter["field"]) }
        val value = scope[id] ?: return@forEach
        if (cbText(filter["type"]) == "dateRange" || cbText(filter["kind"]) == "dateRange") {
            val range = cbObject(value)
            // Relative dates must be resolved by the preparation's captured clock,
            // never silently omitted or evaluated against a different generation.
            require(range["preset"] == null && range["startExpression"] == null && range["endExpression"] == null) {
                "Report date range must be resolved before request preparation"
            }
            val paths = cbObject(filter["paramPaths"])
            listOf("start" to "startParamPath", "end" to "endParamPath").forEach { (edge, field) ->
                val path = cbText(filter[field]).ifEmpty { cbText(paths[edge]) }
                val edgeValue = range[edge]
                if (path.isNotEmpty() && edgeValue != null && !reportJsonEmpty(edgeValue)) emit(path, edgeValue)
            }
        } else if (!reportJsonEmpty(value)) emit(cbText(filter["paramPath"]).ifEmpty { "filters.$id" }, value)
    }
    val dynamic = linkedMapOf<String, JsonElement>()
    cbObjects(config["dynamicFilterGroups"]).forEach { group ->
        cbObjects(cbObject(state["dynamicGroups"])[cbId(group)]).forEach row@ { row ->
            if (row["enabled"] == JsonPrimitive(false)) return@row
            val def = cbObjects(group["filters"]).firstOrNull { cbId(it) == cbText(row["filterId"]) } ?: return@row
            if (cbText(def["requestMapping"]) == "hook" || def["handledByHook"] == JsonPrimitive(true)) return@row
            val values = cbObjects(row["selections"]).mapNotNull { it["value"] }.filterNot(::reportJsonEmpty)
            if (values.isEmpty()) return@row
            val path = cbText(def["paramPath"]).ifEmpty { "filters.${cbId(def)}" }
            if (def["multiple"] == JsonPrimitive(false) && def["emitArray"] != JsonPrimitive(true) && cbText(def["valueMode"]) != "array") {
                dynamic[path] = values.first()
            } else dynamic[path] = JsonArray((cbArray(dynamic[path]) + values).distinct())
        }
    }
    dynamic.forEach(::emit)

    val binding = (state["binding"] as? JsonObject) ?: cbObject(config["binding"])
    if (cbText(binding["mode"]) == "semantic") {
        val local = calculated.filter { cbText(it["semanticRef"]).isEmpty() && (it["compute"] is JsonObject || cbText(it["expr"]).isNotEmpty()) }.map(::cbId).toSet()
        val semanticMeasures = measures + calculated.filter { cbId(it) !in local }
        fun mapped(fields: List<JsonObject>, ids: Collection<String>) = ids.mapNotNull { id ->
            fields.firstOrNull { cbId(it) == id }?.let { cbText(it["semanticRef"]).takeIf(String::isNotEmpty) }
        }.distinct()
        fun unmapped(fields: List<JsonObject>, ids: Collection<String>) = ids.filter { id ->
            cbText(fields.firstOrNull { cbId(it) == id }?.get("semanticRef")).isEmpty()
        }.distinct()
        val parameterValues = buildJsonObject { filters.forEach { field ->
            val ref = cbText(field["semanticRef"])
            val value = scope[cbId(field).ifEmpty { cbText(field["field"]) }]
            if (ref.isNotEmpty() && value != null && !reportJsonEmpty(value)) put(ref, value)
        } }
        val missingDimensions = unmapped(dimensions, selectedDimensions)
        val missingMeasures = unmapped(semanticMeasures, selectedMeasures.filter { it !in local })
        val missingParameters = filters.filter { it.containsKey("semanticRef") && cbText(it["semanticRef"]).isEmpty() && scope[cbId(it)]?.let { v -> !reportJsonEmpty(v) } == true }.map(::cbId)
        emit("semanticSelection", buildJsonObject {
            put("modelRef", binding["modelRef"] ?: JsonPrimitive("")); put("entity", binding["entity"] ?: JsonPrimitive(""))
            put("selection", buildJsonObject {
                put("dimensions", JsonArray(mapped(dimensions, selectedDimensions).map(::JsonPrimitive)))
                put("measures", JsonArray(mapped(semanticMeasures, selectedMeasures + dependencyMeasures).map(::JsonPrimitive)))
            })
            if (missingDimensions.isNotEmpty() || missingMeasures.isNotEmpty() || missingParameters.isNotEmpty()) put("unmapped", buildJsonObject {
                if (missingDimensions.isNotEmpty()) put("dimensions", JsonArray(missingDimensions.map(::JsonPrimitive)))
                if (missingMeasures.isNotEmpty()) put("measures", JsonArray(missingMeasures.map(::JsonPrimitive)))
                if (missingParameters.isNotEmpty()) put("parameters", JsonArray(missingParameters.map(::JsonPrimitive)))
            })
            put("refinements", JsonArray(emptyList())); put("parameters", parameterValues)
        })
    }
    val pageSize = maxOf(1, cbNumber(state["pageSize"]) ?: cbNumber(resultConfig["pageSize"]) ?: cbNumber(requestConfig["limit"]) ?: 50)
    val page = maxOf(1, cbNumber(state["page"]) ?: 1)
    emit("limit", JsonPrimitive(pageSize)); emit("offset", requestConfig["offset"]?.takeIf { it != JsonNull } ?: JsonPrimitive((page - 1) * pageSize))
    requestConfig["timeoutMs"]?.takeIf { it != JsonNull }?.let { emit("timeoutMs", it) }
    val order = cbObjects(resultConfig["orderFields"] ?: config["orderFields"]).firstOrNull {
        cbText(it["value"]).ifEmpty { cbText(it["field"]) } == cbText(state["orderField"]) && cbText(state["orderField"]).isNotEmpty()
    }
    if (order != null) {
        val direction = cbText(state["orderDir"]).ifEmpty { cbText(order["defaultDirection"]).ifEmpty { "desc" } }.lowercase()
        val expressions = cbArray(order["orderBy"])
        val value = when {
            expressions.isNotEmpty() -> JsonArray(expressions.map { JsonPrimitive(cbText(it).replace("\${dir}", direction)) })
            direction == "desc" && order["orderByDesc"] != null -> JsonArray(listOf(order.getValue("orderByDesc")))
            direction == "asc" && order["orderByAsc"] != null -> JsonArray(listOf(order.getValue("orderByAsc")))
            else -> JsonArray(listOf(JsonPrimitive("${cbText(order["field"]).ifEmpty { cbText(order["value"]) }} $direction")))
        }
        emit("orderBy", value)
    } else requestConfig["orderBy"]?.let { emit("orderBy", it) }
    return request
}

private fun cbObject(value: JsonElement?) = value as? JsonObject ?: JsonObject(emptyMap())
private fun cbArray(value: JsonElement?): List<JsonElement> = when (value) { null, JsonNull -> emptyList(); is JsonArray -> value.toList(); else -> listOf(value) }
private fun cbObjects(value: JsonElement?) = cbArray(value).mapNotNull { it as? JsonObject }
private fun cbText(value: JsonElement?) = (value as? JsonPrimitive)?.takeIf { it != JsonNull }?.content?.trim().orEmpty()
private fun cbId(value: JsonObject) = cbText(value["id"]).ifEmpty { cbText(value["key"]) }
private fun cbIds(value: JsonElement?) = cbArray(value).flatMap { cbText(it).split(Regex("[\\s,]+")) }.filter(String::isNotBlank).distinct()
private fun cbAliases(value: JsonObject) = listOf("id", "key", "semanticRef").map { cbText(value[it]) }.filter(String::isNotEmpty)
private fun cbNumber(value: JsonElement?) = (value as? JsonPrimitive)?.doubleOrNull?.takeIf { it.isFinite() && it != 0.0 }?.toInt()
private fun cbEntityOption(name: String) = Regex("^(account|agency|advertiser|campaign|order|line(item)?|audience|creative|pixel)(id|ids)?$", RegexOption.IGNORE_CASE).matches(name.replace(Regex("[^a-zA-Z0-9]"), ""))
private fun cbOptionValue(value: JsonElement?, type: String): JsonElement? {
    val p = value as? JsonPrimitive ?: return null
    if (p == JsonNull) return null
    return when (type) {
        "bool", "boolean" -> when (p.content) { "true", "1" -> JsonPrimitive(true); "false", "0" -> JsonPrimitive(false); else -> null }
        "int", "integer" -> p.doubleOrNull?.takeIf { it.isFinite() && it % 1.0 == 0.0 }?.let { JsonPrimitive(it.toLong()) }
        "number", "float", "double" -> p.doubleOrNull?.takeIf { it.isFinite() }?.let(::JsonPrimitive)
        else -> JsonPrimitive(p.content)
    }
}

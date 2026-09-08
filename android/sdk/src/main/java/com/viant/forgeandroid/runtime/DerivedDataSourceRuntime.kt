package com.viant.forgeandroid.runtime

object DerivedDataSourceRuntime {
    fun run(sources: Map<String, List<Map<String, Any?>>>, spec: DerivedDataSourceSpec): List<Map<String, Any?>> {
        val limit = (spec.maxRows ?: 10_000).coerceAtLeast(1)
        spec.sources.forEach { ref -> require(sources[ref].orEmpty().size <= limit) { "Derived datasource source $ref exceeds maxRows $limit; use a server datasource." } }
        var rows = spec.sources.firstOrNull()?.let { sources[it] }.orEmpty().map { it.toMap() }
        spec.pipeline.forEach { step ->
            when (val operation = step.operation.lowercase()) {
                "filter" -> rows = rows.filter { evaluateDashboardCondition(step.whenCondition, form = it) }
                "select", "map" -> rows = rows.map { it + projectDerived(it, step) }
                "union" -> {
                    val ref = declaredSource(step.source, operation, spec)
                    rows = rows + sources[ref].orEmpty()
                }
                "join" -> rows = joinDerived(rows, sources[declaredSource(step.source, operation, spec)].orEmpty(), step, limit)
                "group" -> rows = groupDerived(rows, step)
                "sort" -> rows = rows.sortedWith { left, right -> compareDerived(left, right, step.orderBy) }
                else -> error("Unsupported derived operation: ${step.operation}")
            }
            require(rows.size <= limit) { "Derived datasource output exceeds maxRows $limit; use a server datasource." }
        }
        return rows
    }

    private fun declaredSource(raw: String?, operation: String, spec: DerivedDataSourceSpec): String {
        val ref = raw?.trim().orEmpty()
        require(ref.isNotEmpty() && ref in spec.sources) { "Derived $operation source ${ref.ifEmpty { "<empty>" }} must be declared in sources." }
        return ref
    }

    private fun joinDerived(left: List<Map<String, Any?>>, right: List<Map<String, Any?>>, step: DerivedDataStepSpec, limit: Int): List<Map<String, Any?>> {
        val fields = step.on.ifEmpty { listOf("id") }
        val rightByKey = linkedMapOf<String, MutableList<Map<String, Any?>>>()
        right.forEach { row ->
            val key = derivedIdentity(row, fields)
            require(step.joinCardinality.equals("many", true) || rightByKey[key].isNullOrEmpty()) { "Derived join expected one right row for key $key." }
            rightByKey.getOrPut(key) { mutableListOf() } += row
        }
        val result = mutableListOf<Map<String, Any?>>()
        left.forEach { row ->
            val matches = rightByKey[derivedIdentity(row, fields)].orEmpty()
            if (matches.isEmpty() && step.joinType.equals("inner", true)) return@forEach
            val selected = if (step.joinCardinality.equals("many", true)) matches.ifEmpty { listOf(emptyMap()) } else listOf(matches.firstOrNull().orEmpty())
            selected.forEach { match ->
                result += row + projectDerived(match, step)
                require(result.size <= limit) { "Derived datasource output exceeds maxRows $limit; use a server datasource." }
            }
        }
        return result
    }

    private fun groupDerived(rows: List<Map<String, Any?>>, step: DerivedDataStepSpec): List<Map<String, Any?>> =
        rows.groupBy { derivedIdentity(it, step.groupBy) }.toSortedMap().values.map { members ->
            val result = linkedMapOf<String, Any?>()
            step.groupBy.forEach { field -> result[field] = SelectorUtil.resolve(members.first(), field) }
            step.measures.forEach { measure ->
                val values = measure.source?.let { source -> members.mapNotNull { SelectorUtil.resolve(it, source) } }.orEmpty()
                result[measure.target] = when (measure.operation.lowercase()) {
                    "count" -> if (measure.source == null) members.size else values.size
                    "sum" -> values.sumOf { (it as? Number)?.toDouble() ?: it.toString().toDoubleOrNull() ?: 0.0 }
                    "min" -> values.minByOrNull(::derivedComparable)
                    "max" -> values.maxByOrNull(::derivedComparable)
                    "first" -> values.firstOrNull()
                    "list" -> values
                    else -> error("Unsupported derived measure: ${measure.operation}")
                }
            }
            result
        }

    private fun projectDerived(row: Map<String, Any?>, step: DerivedDataStepSpec): Map<String, Any?> {
        val result = linkedMapOf<String, Any?>()
        step.fields.forEach { (target, source) -> result[target] = if (source is kotlinx.serialization.json.JsonPrimitive && source.isString) SelectorUtil.resolve(row, source.content) else JsonUtil.elementToAny(source) }
        step.projections.forEach { projection -> result[projection.target] = projection.source?.let { SelectorUtil.resolve(row, it) } ?: projection.value?.let(JsonUtil::elementToAny) }
        return result
    }

    private fun compareDerived(left: Map<String, Any?>, right: Map<String, Any?>, orderBy: List<kotlinx.serialization.json.JsonElement>): Int {
        orderBy.forEach { raw ->
            val item = raw as? kotlinx.serialization.json.JsonObject ?: return@forEach
            val field = (item["columnId"] ?: item["field"])?.let(JsonUtil::elementToAny)?.toString().orEmpty()
            val direction = item["direction"]?.let(JsonUtil::elementToAny)?.toString()?.lowercase() ?: "asc"
            val value = derivedComparable(SelectorUtil.resolve(left, field)).compareTo(derivedComparable(SelectorUtil.resolve(right, field)))
            if (value != 0) return if (direction == "desc") -value else value
        }
        return 0
    }

    private fun derivedIdentity(row: Map<String, Any?>, fields: List<String>): String = fields.joinToString("\u001f") { derivedComparable(SelectorUtil.resolve(row, it)) }
    private fun derivedComparable(value: Any?): String = when (value) {
        null -> ""
        is Number -> String.format("%020.8f", value.toDouble())
        is Map<*, *> -> value.entries.sortedBy { it.key.toString() }.joinToString(",") { "${it.key}=${derivedComparable(it.value)}" }
        is Iterable<*> -> value.joinToString(",") { derivedComparable(it) }
        else -> value.toString()
    }
}

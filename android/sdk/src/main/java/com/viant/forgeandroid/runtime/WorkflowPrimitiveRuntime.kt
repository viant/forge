package com.viant.forgeandroid.runtime

enum class DataStateBoundaryKind {
    Loading,
    Empty,
    Partial,
    Error,
    Ready
}

data class HistoryDiffEntry(val path: String, val label: String, val before: String, val after: String, val redacted: Boolean)
data class ScheduleValidationError(val index: Int, val code: String)
data class ScheduleValidationResult(val valid: Boolean, val errors: List<ScheduleValidationError>)
data class UploadFileValue(val name: String, val mimeType: String = "application/octet-stream", val data: ByteArray)
data class UploadValidationResult(val valid: Boolean, val errors: List<String>)

object WorkflowPrimitiveRuntime {
    fun dataStateBoundaryKind(
        controls: List<ControlState>,
        collections: List<List<Map<String, Any?>>>,
        allowPartial: Boolean = false
    ): DataStateBoundaryKind {
        val hasError = controls.any { !it.error.isNullOrBlank() }
        val loading = controls.any { it.loading }
        val populated = collections.count { it.isNotEmpty() }
        val sourceCount = maxOf(controls.size, collections.size)

        if (loading && populated == 0) return DataStateBoundaryKind.Loading
        if (hasError) {
            return if (allowPartial && populated > 0) DataStateBoundaryKind.Partial else DataStateBoundaryKind.Error
        }
        if (sourceCount > 1 && populated in 1 until sourceCount) {
            return if (allowPartial) DataStateBoundaryKind.Partial else DataStateBoundaryKind.Empty
        }
        return if (populated == 0) DataStateBoundaryKind.Empty else DataStateBoundaryKind.Ready
    }

    fun presentationRecord(
        form: Map<String, Any?>,
        collection: List<Map<String, Any?>>,
        metrics: Map<String, Any?>
    ): Map<String, Any?> = when {
        form.isNotEmpty() -> form
        collection.isNotEmpty() -> collection.first()
        else -> metrics
    }

    fun relationLabel(count: Int, spec: RelationDrillSpec): String {
        if (count == 0 && !spec.emptyText.isNullOrBlank()) return spec.emptyText
        val noun = if (count == 1) spec.singularLabel ?: "item" else spec.pluralLabel ?: "items"
        return "$count $noun"
    }

    fun permissionAllows(
        spec: PermissionBoundarySpec,
        authorization: Map<String, Any?>,
        rows: List<Map<String, Any?>> = emptyList(),
        grants: List<Map<String, Any?>> = emptyList()
    ): Boolean {
        val capability = spec.capability?.trim().orEmpty()
        if (capability.isEmpty()) return true
        val mode = spec.mode?.trim()?.lowercase() ?: "resource"
        if (mode == "resource") {
            val resource = JsonUtil.asStringMap(authorization["resource"])
            return JsonUtil.asStringMap(resource["capabilities"])[capability] == true
        }
        if (rows.isEmpty()) return true
        val identity = spec.identityField?.trim().orEmpty().ifBlank { "id" }
        val grantsById = grants.mapNotNull { grant ->
            (grant["resourceId"] ?: grant[identity])?.toString()?.takeIf(String::isNotBlank)?.let { it to grant }
        }.toMap()
        return rows.all { row ->
            val key = row[identity]?.toString()?.takeIf(String::isNotBlank) ?: return@all false
            val grant = grantsById[key] ?: return@all false
            JsonUtil.asStringMap(grant["capabilities"])[capability] == true
        }
    }

    fun responsiveDataGridState(spec: ResponsiveDataGridSpec, target: String): ResponsiveDataGridStateSpec? =
        spec.breakpoints[target]
            ?: spec.breakpoints[if (target == "phone") "narrow" else "wide"]
            ?: spec.breakpoints["desktop"]
            ?: spec.breakpoints.values.firstOrNull()

    fun validateSchedule(rows: List<Map<String, Any?>>, spec: ScheduleEditorSpec): ScheduleValidationResult {
        val startField = spec.startField ?: "start"
        val endField = spec.endField ?: "end"
        val minimum = parseDurationMillis(spec.minDuration)
        val normalized = mutableListOf<Triple<Int, java.time.Instant?, java.time.Instant?>>()
        val errors = mutableListOf<ScheduleValidationError>()
        rows.forEachIndexed { index, row ->
            if (JsonUtil.asStringMap(row["_scheduleErrors"]).values.any { it == true || it?.toString()?.isNotBlank() == true }) errors += ScheduleValidationError(index, "timezone")
            val start = scheduleInstant(SelectorUtil.resolve(row, startField))
            val end = scheduleInstant(SelectorUtil.resolve(row, endField))
            normalized += Triple(index, start, end)
            if (start == null || end == null) errors += ScheduleValidationError(index, "invalid_date")
            else {
                if (!end.isAfter(start)) errors += ScheduleValidationError(index, "invalid_range")
                if (minimum != null && java.time.Duration.between(start, end).toMillis() < minimum) errors += ScheduleValidationError(index, "min_duration")
            }
        }
        if (spec.allowOverlap == false) {
            val sorted = normalized.filter { it.second != null && it.third != null }.sortedBy { it.second }
            for (index in 1 until sorted.size) if (sorted[index].second!!.isBefore(sorted[index - 1].third!!)) errors += ScheduleValidationError(sorted[index].first, "overlap")
        }
        return ScheduleValidationResult(errors.isEmpty(), errors)
    }

    fun toggleTreeSelection(nodes: List<Map<String, Any?>>, selected: Set<String>, key: String, checked: Boolean, spec: TreeEditorSpec): Set<String> {
        val keys = mutableSetOf(key)
        if (spec.cascade.equals("descendants", true)) nodes.forEach { collectTreeKeys(it, key, false, spec, keys) }
        return selected.toMutableSet().apply { keys.forEach { if (checked) add(it) else remove(it) } }
    }

    fun validateUpload(files: List<UploadFileValue>, spec: UploadCollectionSpec): UploadValidationResult {
        val errors = mutableListOf<String>()
        if (spec.multiple == false && files.size > 1) errors += "Only one file is allowed."
        if ((spec.maxFiles ?: 0) > 0 && files.size > spec.maxFiles!!) errors += "No more than ${spec.maxFiles} files are allowed."
        files.forEach { file ->
            if (!uploadTypeAccepted(file, spec.accept)) errors += "${file.name} has an unsupported type."
            if ((spec.maxBytes ?: 0) > 0 && file.data.size > spec.maxBytes!!) errors += "${file.name} exceeds the size limit."
        }
        return UploadValidationResult(errors.isEmpty(), errors)
    }

    fun encodeUpload(files: List<UploadFileValue>, spec: UploadCollectionSpec): Map<String, Any?> {
        val transport = spec.transport ?: "mcpBlob"
        require(transport == "mcpBlob") { "Unsupported upload transport: $transport" }
        val blobs = files.map { file -> mapOf(
            "name" to file.name, "size" to file.data.size, "type" to file.mimeType,
            "data" to java.util.Base64.getEncoder().encodeToString(file.data), "filename" to file.name, "mimeType" to file.mimeType
        ) }
        return mapOf("transport" to "mcpBlob", (spec.blobField ?: "files") to if (spec.multiple == false) blobs.firstOrNull() else blobs)
    }

    fun masterDetailIdentity(row: Map<String, Any?>?, fields: List<String>): String? {
        if (row == null) return null
        val keys = fields.ifEmpty { listOf("id") }
        val values = keys.map { row[it]?.toString()?.takeIf(String::isNotBlank) ?: return null }
        return values.joinToString("\u001f")
    }

    fun resolveMasterDetailSelection(rows: List<Map<String, Any?>>, selected: Map<String, Any?>?, persisted: Map<String, Any?>?, identityFields: List<String>): Map<String, Any?>? {
        masterDetailIdentity(selected, identityFields)?.let { id -> rows.firstOrNull { masterDetailIdentity(it, identityFields) == id }?.let { return it } }
        masterDetailIdentity(persisted, identityFields)?.let { id -> return rows.firstOrNull { masterDetailIdentity(it, identityFields) == id } }
        return null
    }

    fun masterDetailParameters(spec: MasterDetailRegionSpec, row: Map<String, Any?>): Map<String, Any?> = spec.parameters.mapValues { (_, parameter) ->
        val objectValue = parameter as? kotlinx.serialization.json.JsonObject ?: return@mapValues JsonUtil.elementToAny(parameter)
        val source = objectValue["source"]?.let(JsonUtil::elementToAny)?.toString()?.lowercase() ?: "row"
        if (source != "row") return@mapValues objectValue["value"]?.let(JsonUtil::elementToAny)
        val selector = (objectValue["selector"] ?: objectValue["field"])?.let(JsonUtil::elementToAny)?.toString().orEmpty()
        val value = SelectorUtil.resolve(row, selector)
        if (objectValue["wrap"]?.let(JsonUtil::elementToAny)?.toString()?.lowercase() == "array") listOf(value) else value
    }

    private fun collectTreeKeys(node: Map<String, Any?>, target: String, collecting: Boolean, spec: TreeEditorSpec, result: MutableSet<String>) {
        val nodeKey = SelectorUtil.resolve(node, spec.identityField ?: "id")?.toString().orEmpty()
        val shouldCollect = collecting || nodeKey == target
        if (shouldCollect && nodeKey.isNotEmpty()) result += nodeKey
        @Suppress("UNCHECKED_CAST")
        val children = SelectorUtil.resolve(node, spec.childrenField ?: "children") as? List<Map<String, Any?>> ?: emptyList()
        children.forEach { collectTreeKeys(it, target, shouldCollect, spec, result) }
    }

    fun historyDiffEntries(before: Any?, after: Any?, spec: HistoryDiffSpec): List<HistoryDiffEntry> {
        val result = mutableListOf<HistoryDiffEntry>()
        collectHistoryDiff(before, after, "", spec, result)
        return result
    }

    private fun collectHistoryDiff(before: Any?, after: Any?, path: String, spec: HistoryDiffSpec, result: MutableList<HistoryDiffEntry>) {
        val leaf = path.substringAfterLast('.', path)
        if (path in spec.ignoreFields || leaf in spec.ignoreFields) return
        val left = before as? Map<*, *>
        val right = after as? Map<*, *>
        if (left != null && right != null) {
            (left.keys + right.keys).filterIsInstance<String>().toSortedSet().forEach { key ->
                collectHistoryDiff(left[key], right[key], if (path.isEmpty()) key else "$path.$key", spec, result)
            }
            return
        }
        val normalizedBefore = normalizeHistoryValue(before, spec.arrayStrategy)
        val normalizedAfter = normalizeHistoryValue(after, spec.arrayStrategy)
        if (normalizedBefore == normalizedAfter) return
        val redacted = path in spec.redactFields || leaf in spec.redactFields
        result += HistoryDiffEntry(
            path.ifEmpty { "value" },
            spec.fieldLabels[path] ?: spec.fieldLabels[leaf] ?: historyLabel(leaf),
            if (redacted) "••••" else historyDisplay(before),
            if (redacted) "••••" else historyDisplay(after),
            redacted
        )
    }

    private fun normalizeHistoryValue(value: Any?, strategy: String?): Any? =
        if (strategy.equals("set", true) && value is List<*>) value.map(::historyDisplay).sorted() else value

    private fun historyDisplay(value: Any?): String = when (value) {
        null -> "—"
        is Map<*, *> -> value.entries.sortedBy { it.key.toString() }.joinToString(", ") { "${it.key}: ${historyDisplay(it.value)}" }
        is Iterable<*> -> value.joinToString(", ") { historyDisplay(it) }
        is Number -> if (value.toDouble() % 1.0 == 0.0) value.toLong().toString() else value.toString()
        else -> value.toString()
    }

    private fun historyLabel(value: String): String = value.replace('_', ' ').split(' ').joinToString(" ") { word -> word.replaceFirstChar { it.uppercase() } }
}

private fun uploadTypeAccepted(file: UploadFileValue, rules: List<String>): Boolean {
    if (rules.isEmpty()) return true
    val name = file.name.lowercase(); val type = file.mimeType.lowercase()
    return rules.any { raw ->
        val rule = raw.lowercase()
        when { rule.startsWith(".") -> name.endsWith(rule); rule.endsWith("/*") -> type.startsWith(rule.dropLast(1)); else -> type == rule }
    }
}

private fun scheduleInstant(value: Any?): java.time.Instant? = runCatching {
    when (value) {
        is java.time.Instant -> value
        is String -> java.time.Instant.parse(value)
        else -> null
    }
}.getOrNull()

private fun parseDurationMillis(raw: String?): Long? {
    val match = Regex("^(\\d+(?:\\.\\d+)?)\\s*(ms|s|m|h|d)$", RegexOption.IGNORE_CASE).matchEntire(raw?.trim().orEmpty()) ?: return null
    val value = match.groupValues[1].toDoubleOrNull() ?: return null
    val multiplier = when (match.groupValues[2].lowercase()) { "ms" -> 1.0; "s" -> 1_000.0; "m" -> 60_000.0; "h" -> 3_600_000.0; "d" -> 86_400_000.0; else -> 1.0 }
    return (value * multiplier).toLong()
}

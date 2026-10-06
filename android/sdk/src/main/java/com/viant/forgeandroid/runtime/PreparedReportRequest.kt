package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** An immutable generation; an empty request during initialization is pending, never global. */
data class ReportPreparationIdentity(val windowId: String, val builderRef: String, val formRevision: String, val stateRevision: String)
data class ReportIntentBinding(val path: String, val value: JsonElement)
data class PreparedReportRequest(
    val identity: ReportPreparationIdentity,
    val status: String,
    val dataSourceRef: String,
    val primaryRequest: JsonObject = JsonObject(emptyMap()),
    val state: JsonObject = JsonObject(emptyMap()),
    val requiredBindings: List<ReportIntentBinding> = emptyList(),
    val reason: String? = null,
    val hookStatus: String = "completed",
    val publishedSources: List<ReportBuilderPublishedDataSourceDef> = emptyList(),
    val capturedTimeMillis: Long = System.currentTimeMillis(),
    val capturedZoneId: String = ZoneId.systemDefault().id,
    val capturedCalendar: String = "gregorian",
    val capturedAuthorState: JsonObject? = null,
    val capturedPrefillIdentity: JsonObject? = null
)
data class PreparedDatasetRequest(val status: String, val request: JsonObject? = null, val reason: String? = null)
data class PreparedFetchPlan(val status: String, val targets: List<String> = emptyList(), val reason: String? = null)

fun preparedReportPrimaryGate(current: ReportPreparationIdentity, prepared: PreparedReportRequest): PreparedDatasetRequest {
    if (prepared.identity != current) return PreparedDatasetRequest("pending", reason = "stale-preparation")
    if (prepared.hookStatus != "completed") return PreparedDatasetRequest("error", reason = "unsupported-hook")
    if (prepared.status != "ready") return PreparedDatasetRequest(prepared.status, reason = prepared.reason)
    if (prepared.requiredBindings.any { reportRequestPath(prepared.primaryRequest, it.path) != it.value }) return PreparedDatasetRequest("error", reason = "unbound-intent")
    return PreparedDatasetRequest("ready", prepared.primaryRequest)
}

/** Pure port of the canonical web publisher; policy applies after initial intent binding. */
fun preparePublishedReportRequest(
    current: ReportPreparationIdentity,
    prepared: PreparedReportRequest,
    source: ReportBuilderPublishedDataSourceDef,
    datasetScopeParams: JsonObject? = null,
    now: Instant = Instant.ofEpochMilli(prepared.capturedTimeMillis),
    zone: ZoneId = ZoneId.of(prepared.capturedZoneId)
): PreparedDatasetRequest {
    val gate = preparedReportPrimaryGate(current, prepared)
    if (gate.status != "ready") return gate
    val catalog = source.request ?: return PreparedDatasetRequest("error", reason = "missing-request")
    return try {
        val scope = source.scope
        val explicit = (scope["mode"] as? JsonPrimitive)?.content?.trim()?.lowercase().orEmpty()
        require(explicit.isEmpty() || explicit in setOf("inherit", "append", "override", "exclude"))
        val excluded = (scope["exclude"] as? JsonArray).orEmpty().mapNotNull { (it as? JsonPrimitive)?.content?.trim()?.takeIf(String::isNotBlank) }.toSet()
        val reserved = setOf("mode", "local", "exclude", "relativeDateRange", "inheritContext")
        val local = reportMergeJson(JsonObject(scope.filterKeys { it !in reserved }), scope["local"] as? JsonObject ?: JsonObject(emptyMap()))
        val inheritContext = (scope["inheritContext"] as? JsonPrimitive)?.booleanOrNull
        require(!(inheritContext == false && excluded.isNotEmpty() && explicit.isEmpty()))
        val mode = explicit.ifEmpty { when { excluded.isNotEmpty() -> "exclude"; inheritContext == false -> "override"; local.isNotEmpty() -> "append"; else -> "inherit" } }
        require(mode != "exclude" || excluded.isNotEmpty())
        var context = buildJsonObject {
            (prepared.primaryRequest["options"] as? JsonObject)?.let { put("options", it) }
            if (source.dataSourceRef == prepared.dataSourceRef) {
                (prepared.primaryRequest["filters"] as? JsonObject)?.let { put("filters", it) }
                (prepared.primaryRequest["refinements"] as? JsonArray)?.let { put("refinements", it) }
            }
        }
        val stateParams = prepared.state["scopeParams"] as? JsonObject ?: JsonObject(emptyMap())
        val sources = prepared.publishedSources.ifEmpty { listOf(source) }
        val declaredRefOwner = sources.firstOrNull { it.id == source.dataSourceRef }
        val aliasAllowed = if (declaredRefOwner != null) declaredRefOwner.id == source.id else sources.count { it.dataSourceRef == source.dataSourceRef } == 1
        val datasetValues = (datasetScopeParams?.get(source.id) as? JsonObject)
            ?: if (aliasAllowed) datasetScopeParams?.get(source.dataSourceRef) as? JsonObject else null
        source.scopeParamOptions.forEach { raw ->
            val option = raw as? JsonObject ?: return@forEach
            val id = ((option["id"] ?: option["value"]) as? JsonPrimitive)?.content?.trim().orEmpty()
            if (id.isBlank()) return@forEach
            fun path(key: String) = (option[key] as? JsonPrimitive)?.content?.trim().orEmpty()
            if (id in excluded) {
                listOf("paramPath", "startParamPath", "endParamPath").forEach { key -> if (path(key).isNotBlank()) context = reportDeletePath(context, path(key)) }
                return@forEach
            }
            val value = if (datasetValues?.containsKey(id) == true) datasetValues[id] else stateParams[id]
            if ((option["kind"] as? JsonPrimitive)?.content?.lowercase() == "daterange") {
                val dates = value as? JsonObject
                val start = dates?.get("start")?.takeUnless(::reportJsonEmpty) ?: reportRequestPath(prepared.primaryRequest, path("startParamPath"))
                val end = dates?.get("end")?.takeUnless(::reportJsonEmpty) ?: reportRequestPath(prepared.primaryRequest, path("endParamPath"))
                if (path("startParamPath").isNotBlank() && start != null && !reportJsonEmpty(start)) context = reportSetPath(context, path("startParamPath"), start)
                if (path("endParamPath").isNotBlank() && end != null && !reportJsonEmpty(end)) context = reportSetPath(context, path("endParamPath"), end)
            } else {
                val resolved = value?.takeUnless(::reportJsonEmpty) ?: reportRequestPath(prepared.primaryRequest, path("paramPath"))
                if (path("paramPath").isNotBlank() && resolved != null && !reportJsonEmpty(resolved)) context = reportSetPath(context, path("paramPath"), resolved)
            }
        }
        var resolvedLocal = local
        (scope["relativeDateRange"] as? JsonObject)?.let { relative ->
            val paths = listOf("startParamPath", "endParamPath").map { (relative[it] as? JsonPrimitive)?.content?.trim().orEmpty() }
            require(paths.all(String::isNotBlank))
            val dates = reportRelativeDates(relative, now, zone)
            resolvedLocal = reportSetPath(reportSetPath(resolvedLocal, paths[0], JsonPrimitive(dates.first)), paths[1], JsonPrimitive(dates.second))
        }
        val request = when(mode) {
            "append" -> reportMergeJson(reportMergeJson(catalog, resolvedLocal), context)
            "override", "exclude" -> reportMergeJson(reportMergeJson(catalog, context), resolvedLocal)
            else -> reportMergeJson(catalog, context)
        }
        PreparedDatasetRequest("ready", request)
    } catch (_: IllegalArgumentException) { PreparedDatasetRequest("error", reason = "invalid-scope-policy") }
}

fun preparedReportFetchPlan(requestedRef: String?, activeRefs: List<String>, registryRefs: Set<String>, reportRefs: Set<String>, preparedRefs: Set<String>): PreparedFetchPlan {
    val targets = (requestedRef?.trim()?.takeIf(String::isNotBlank)?.let(::listOf) ?: activeRefs).distinct()
    if (targets.any { it !in registryRefs }) return PreparedFetchPlan("error", reason = "unknown-datasource")
    if (targets.any { it in reportRefs && it !in preparedRefs }) return PreparedFetchPlan("pending", reason = "unprepared-report")
    return PreparedFetchPlan("ready", targets)
}

internal fun reportJsonEmpty(value: JsonElement): Boolean = value == JsonNull || value == JsonPrimitive("") || value == JsonArray(emptyList())
internal fun reportRequestPath(root: JsonObject, path: String): JsonElement? = path.split('.').filter(String::isNotBlank).fold(root as JsonElement?) { node, part -> (node as? JsonObject)?.get(part) }
internal fun reportSetPath(root: JsonObject, path: String, value: JsonElement): JsonObject {
    val parts = path.split('.').filter(String::isNotBlank)
    fun set(node: JsonObject, remaining: List<String>): JsonObject {
        if (remaining.isEmpty()) return node
        val key = remaining.first()
        return JsonObject(node.toMutableMap().apply { put(key, if (remaining.size == 1) value else set(node[key] as? JsonObject ?: JsonObject(emptyMap()), remaining.drop(1))) })
    }
    return set(root, parts)
}
internal fun reportDeletePath(root: JsonObject, path: String): JsonObject {
    val parts = path.split('.').filter(String::isNotBlank)
    fun remove(node: JsonObject, remaining: List<String>): JsonObject {
        if (remaining.isEmpty()) return node
        val key = remaining.first()
        return JsonObject(node.toMutableMap().apply { if (remaining.size == 1) remove(key) else (node[key] as? JsonObject)?.let { put(key, remove(it, remaining.drop(1))) } })
    }
    return remove(root, parts)
}
internal fun reportMergeJson(base: JsonObject, patch: JsonObject): JsonObject = JsonObject(base.toMutableMap().apply {
    patch.forEach { (key, value) -> put(key, if (get(key) is JsonObject && value is JsonObject) reportMergeJson(get(key) as JsonObject, value) else value) }
})
internal fun reportRelativeDates(spec: JsonObject, now: Instant, zone: ZoneId): Pair<String, String> {
    val preset = (spec["preset"] as? JsonPrimitive)?.content?.lowercase()?.replace("_", "").orEmpty()
    val today = now.atZone(zone).toLocalDate()
    val range = when(preset) {
        "today" -> today to today
        "yesterday" -> today.minusDays(1) to today.minusDays(1)
        "last3days", "3d" -> today.minusDays(2) to today
        "last7days", "7d" -> today.minusDays(6) to today
        "last30days", "30d" -> today.minusDays(29) to today
        else -> null
    }
    if (range != null) return range.first.toString() to range.second.toString()
    fun expression(key: String): String {
        val source = (spec[key] as? JsonPrimitive)?.content.orEmpty().replace(Regex("([a-z])([A-Z])"), "$1 $2").replace(Regex("(\\d)([A-Za-z])"), "$1 $2").replace(Regex("([A-Za-z])(\\d)"), "$1 $2").lowercase().replace(Regex("\\s+in\\s*utc$"), "").trim()
        val seconds = when(source) { "now", "today" -> 0L; "yesterday" -> -86400L; "tomorrow" -> 86400L; else -> {
            val match = Regex("^(\\d+)\\s*(seconds?|secs?|minutes?|mins?|hours?|days?|weeks?)\\s+(ahead|after|later|onward|ago|before|earlier|past)$").matchEntire(source) ?: throw IllegalArgumentException("Unsupported relative expression")
            val count = match.groupValues[1].toLong()
            val unit = match.groupValues[2]
            val multiplier = when { unit.startsWith("sec") -> 1; unit.startsWith("min") -> 60; unit.startsWith("hour") -> 3600; unit.startsWith("week") -> 604800; else -> 86400 }
            count * multiplier * if (match.groupValues[3] in setOf("ago", "before", "earlier", "past")) -1 else 1
        } }
        val instant = now.plusSeconds(seconds)
        return if ((spec["format"] as? JsonPrimitive)?.content?.lowercase() == "datetime") DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneId.of("UTC")).format(instant) else instant.atZone(zone).toLocalDate().toString()
    }
    return expression("startExpression") to expression("endExpression")
}

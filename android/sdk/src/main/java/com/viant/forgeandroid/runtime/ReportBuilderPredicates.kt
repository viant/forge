package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull

fun lowerReportBuilderPredicates(config: DashboardReportBuilderDef): DashboardReportBuilderDef {
    if (config.predicates.isEmpty()) return config

    val normalizedPredicates = config.predicates.mapNotNull(::normalizePredicate)
    if (normalizedPredicates.isEmpty()) return config

    val staticFilters = config.staticFilters.toMutableList()
    val staticIds = staticFilters.mapNotNull { (it.id ?: "").trim().takeIf(String::isNotEmpty) }.toMutableSet()
    normalizedPredicates.filter { it.pinned }.forEach { predicate ->
        if (staticIds.add(predicate.id)) {
            staticFilters += lowerPinnedPredicate(predicate)
        }
    }

    val dynamicGroups = config.dynamicFilterGroups.map {
        it.copy(filters = it.filters.toList())
    }.toMutableList()
    val groupById = dynamicGroups.mapNotNull { group ->
        group.id?.trim()?.takeIf { it.isNotEmpty() }?.let { it to group }
    }.toMap().toMutableMap()
    val bucketById = config.predicateBuckets.mapIndexedNotNull { index, bucket ->
        val id = bucket.id?.trim()?.takeIf { it.isNotEmpty() } ?: return@mapIndexedNotNull null
        id to bucket.copy(order = bucket.order ?: index.toDouble())
    }.toMap()

    fun seedGroup(groupId: String): ReportBuilderDynamicFilterGroupDef? {
        val id = groupId.trim()
        if (id.isEmpty()) return null
        groupById[id]?.let { return it }
        val bucket = bucketById[id]
        val seeded = if (bucket != null) {
            ReportBuilderDynamicFilterGroupDef(
                id = id,
                label = bucket.label?.trim()?.ifEmpty { null } ?: pascalCase(id),
                description = bucket.description?.trim()?.ifEmpty { null },
                filters = emptyList()
            )
        } else {
            ReportBuilderDynamicFilterGroupDef(
                id = id,
                label = when (id) {
                    "include" -> "Include"
                    "exclude" -> "Exclude"
                    else -> pascalCase(id)
                },
                filters = emptyList()
            )
        }
        dynamicGroups += seeded
        groupById[id] = seeded
        return seeded
    }

    bucketById.values.sortedBy { it.order ?: 0.0 }.forEach { bucket ->
        bucket.id?.let(::seedGroup)
    }

    val familyMembership = linkedMapOf<String, Pair<MutableList<String>, MutableList<String>>>()
    fun registerFamily(predicate: NormalizedPredicate, direction: NormalizedDirection) {
        if (predicate.group.isBlank() || direction.direction.isBlank()) return
        val filterId = direction.filter.id ?: return
        val membership = familyMembership.getOrPut(predicate.group) { mutableListOf<String>() to mutableListOf() }
        val target = if (direction.direction == "include") membership.first else membership.second
        if (!target.contains(filterId)) target += filterId
    }

    normalizedPredicates.filterNot { it.pinned }.forEach { predicate ->
        predicate.directions.forEach directionLoop@ { direction ->
            val group = seedGroup(direction.groupId) ?: return@directionLoop
            if (group.filters.none { (it.id ?: "").trim() == direction.filter.id }) {
                val updated = group.copy(filters = group.filters + direction.filter)
                val index = dynamicGroups.indexOfFirst { (it.id ?: "").trim() == (group.id ?: "").trim() }
                if (index >= 0) dynamicGroups[index] = updated
                groupById[(updated.id ?: "").trim()] = updated
            }
            registerFamily(predicate, direction)
        }
    }

    val dynamicFamilies = config.dynamicFilterFamilies.toMutableList()
    val existingFamilyIds = dynamicFamilies.mapNotNull { it.id?.trim()?.takeIf(String::isNotEmpty) }.toMutableSet()
    val declaredGroups = config.predicateGroups.mapIndexedNotNull { index, group ->
        val id = group.id?.trim()?.takeIf { it.isNotEmpty() } ?: return@mapIndexedNotNull null
        id to group.copy(order = group.order ?: index.toDouble())
    }
    val declaredById = declaredGroups.toMap()
    val orderedFamilyIds = declaredGroups.map { it.first } +
        familyMembership.keys.filter { id -> declaredById[id] == null }
    orderedFamilyIds.forEach { groupId ->
        val membership = familyMembership[groupId] ?: return@forEach
        if (!existingFamilyIds.add(groupId)) return@forEach
        val declared = declaredById[groupId]
        dynamicFamilies += ReportBuilderDynamicFilterFamilyDef(
            id = groupId,
            label = declared?.label?.trim()?.ifEmpty { null } ?: pascalCase(groupId),
            icon = declared?.icon?.trim()?.ifEmpty { null },
            description = declared?.description?.trim()?.ifEmpty { null },
            includeFilterIds = membership.first,
            excludeFilterIds = membership.second
        )
    }

    return config.copy(
        staticFilters = staticFilters,
        dynamicFilterGroups = dynamicGroups,
        dynamicFilterFamilies = dynamicFamilies
    )
}

private data class NormalizedPredicate(
    val id: String,
    val label: String,
    val description: String,
    val group: String,
    val kind: String,
    val pinned: Boolean,
    val required: Boolean,
    val multiple: Boolean?,
    val presentation: String,
    val semanticRef: String,
    val options: List<ReportBuilderStaticFilterOptionDef>,
    val defaultValue: JsonElement?,
    val paramPath: String,
    val startParamPath: String,
    val endParamPath: String,
    val bucket: String,
    val directions: List<NormalizedDirection>
)

private data class NormalizedDirection(
    val direction: String,
    val groupId: String,
    val filter: ReportBuilderDynamicFilterDef
)

private fun normalizePredicate(entry: ReportBuilderPredicateDef): NormalizedPredicate? {
    val id = entry.id?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    val kind = if ((entry.kind ?: "").trim().equals("dateRange", ignoreCase = true)) "dateRange" else "value"
    val pinned = entry.pinned == true || kind == "dateRange"
    val predicate = NormalizedPredicate(
        id = id,
        label = entry.label?.trim()?.ifEmpty { null } ?: id,
        description = entry.description?.trim().orEmpty(),
        group = entry.group?.trim().orEmpty(),
        kind = kind,
        pinned = pinned,
        required = entry.required == true,
        multiple = entry.multiple,
        presentation = entry.presentation?.trim().orEmpty(),
        semanticRef = entry.semanticRef?.trim().orEmpty(),
        options = entry.options,
        defaultValue = entry.defaultValue,
        paramPath = entry.paramPath?.trim().orEmpty(),
        startParamPath = entry.startParamPath?.trim().orEmpty(),
        endParamPath = entry.endParamPath?.trim().orEmpty(),
        bucket = entry.bucket?.trim()?.ifEmpty { null } ?: "scope",
        directions = emptyList()
    )
    if (pinned) return predicate

    val directions = mutableListOf<NormalizedDirection>()
    val hasInclude = directionEnabled(entry.include)
    val hasExclude = directionEnabled(entry.exclude)
    if (hasInclude) directions += buildDirection(entry, predicate, "include", entry.include)
    if (hasExclude) directions += buildDirection(entry, predicate, "exclude", entry.exclude)
    if (!hasInclude && !hasExclude) directions += buildDirection(entry, predicate, "", null)
    return predicate.copy(directions = directions)
}

private fun lowerPinnedPredicate(predicate: NormalizedPredicate): ReportBuilderStaticFilterDef {
    return ReportBuilderStaticFilterDef(
        id = predicate.id,
        label = predicate.label,
        type = if (predicate.kind == "dateRange") "dateRange" else null,
        required = predicate.required.takeIf { it },
        multiple = predicate.multiple,
        paramPath = predicate.paramPath.takeIf { it.isNotBlank() },
        startParamPath = predicate.startParamPath.takeIf { it.isNotBlank() },
        endParamPath = predicate.endParamPath.takeIf { it.isNotBlank() },
        options = predicate.options,
        defaultValue = predicate.defaultValue
    )
}

private fun buildDirection(
    entry: ReportBuilderPredicateDef,
    predicate: NormalizedPredicate,
    direction: String,
    spec: JsonElement?
): NormalizedDirection {
    val overrides = spec as? JsonObject
    val fallbackId = if (direction.isBlank()) predicate.id else direction + pascalCase(predicate.id)
    val filterId = overrides.string("filterId") ?: fallbackId
    val paramPath = overrides.string("paramPath")
        ?: if (direction.isNotBlank()) {
            when (direction) {
                "include" -> entry.includeParamPath
                "exclude" -> entry.excludeParamPath
                else -> null
            }
        } else {
            entry.paramPath
        }
        ?: "filters.$filterId"
    val multiple = overrides.boolean("multiple") ?: entry.multiple ?: true
    return NormalizedDirection(
        direction = direction,
        groupId = direction.takeIf { it.isNotBlank() } ?: predicate.bucket,
        filter = ReportBuilderDynamicFilterDef(
            id = filterId,
            label = overrides.string("label") ?: predicate.label,
            paramPath = paramPath,
            multiple = multiple,
            emitArray = overrides.boolean("emitArray") ?: entry.emitArray ?: multiple.takeIf { it },
            manualEntry = overrides.boolean("manualEntry") ?: entry.manualEntry,
            manualValueType = overrides.string("manualValueType") ?: entry.manualValueType,
            manualPlaceholder = overrides.string("manualPlaceholder")
                ?: entry.manualPlaceholder
                ?: entry.placeholder,
            dialogId = overrides.string("dialogId") ?: entry.dialogId,
            valueSelector = overrides.string("valueSelector") ?: entry.valueSelector,
            labelSelector = overrides.string("labelSelector") ?: entry.labelSelector,
            groupSelector = overrides.string("groupSelector") ?: entry.groupSelector,
            recordSelectors = overrides.stringList("recordSelectors") ?: entry.recordSelectors,
            requestMapping = overrides.string("requestMapping") ?: entry.requestMapping,
            targetingFeatureKey = overrides.string("targetingFeatureKey") ?: entry.targetingFeatureKey
        )
    )
}

private fun directionEnabled(value: JsonElement?): Boolean {
    if (value == null) return false
    if (value is JsonPrimitive && value.booleanOrNull == false) return false
    return true
}

private fun JsonObject?.string(key: String): String? =
    (this?.get(key) as? JsonPrimitive)?.contentOrNull?.trim()?.takeIf { it.isNotEmpty() }

private fun JsonObject?.boolean(key: String): Boolean? =
    (this?.get(key) as? JsonPrimitive)?.booleanOrNull

private fun JsonObject?.stringList(key: String): List<String>? {
    val value = this?.get(key) ?: return null
    return when (val any = JsonUtil.elementToAny(value)) {
        is List<*> -> any.mapNotNull { it?.toString()?.trim()?.takeIf(String::isNotEmpty) }
        else -> null
    }
}

private fun pascalCase(value: String): String {
    val normalized = value.trim()
    if (normalized.isEmpty()) return ""
    return normalized.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
}

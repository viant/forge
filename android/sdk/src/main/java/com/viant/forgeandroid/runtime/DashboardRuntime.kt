package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive

data class DashboardSelectionState(
    val dimension: String? = null,
    val entityKey: String? = null,
    val pointKey: String? = null,
    val selected: Map<String, Any?>? = null,
    val sourceBlockId: String? = null
)

fun WindowContext.dashboardKey(container: ContainerDef): String {
    return container.dashboard?.key ?: "${windowId}:${container.id ?: "dashboard"}"
}

fun WindowContext.dashboardFilterSignal(container: ContainerDef): Signal<Map<String, Any?>> {
    return signals.dashboardFilters(dashboardKey(container))
}

fun WindowContext.dashboardSelectionSignal(container: ContainerDef): Signal<DashboardSelectionState> {
    return signals.dashboardSelection(dashboardKey(container))
}

fun WindowContext.evaluateDashboardVisibility(
    container: ContainerDef,
    metrics: Map<String, Any?> = emptyMap(),
    filters: Map<String, Any?> = emptyMap(),
    selection: DashboardSelectionState = DashboardSelectionState()
): Boolean {
    return evaluateDashboardCondition(container.dashboard?.visibleWhen ?: container.visibleWhen, metrics, filters, selection)
}

fun evaluateDashboardCondition(
    condition: DashboardConditionDef?,
    metrics: Map<String, Any?> = emptyMap(),
    filters: Map<String, Any?> = emptyMap(),
    selection: DashboardSelectionState = DashboardSelectionState()
): Boolean {
    if (condition == null) {
        return true
    }
    val selector = condition.selector ?: condition.field ?: condition.key
    val actual = resolveDashboardValue(condition.source, selector, metrics, filters, selection)

    condition.whenValue?.let { expected ->
        if (!dashboardValuesEqual(actual, expected)) {
            return false
        }
    }
    condition.equals?.let { expected ->
        if (!dashboardValuesEqual(actual, expected)) {
            return false
        }
    }
    condition.notEquals?.let { expected ->
        if (dashboardValuesEqual(actual, expected)) {
            return false
        }
    }
    if (condition.inValues.isNotEmpty() && condition.inValues.none { dashboardValuesEqual(actual, it) }) {
        return false
    }
    condition.gt?.let { if ((actual as? Number)?.toDouble()?.let { value -> value > it } != true) return false }
    condition.gte?.let { if ((actual as? Number)?.toDouble()?.let { value -> value >= it } != true) return false }
    condition.lt?.let { if ((actual as? Number)?.toDouble()?.let { value -> value < it } != true) return false }
    condition.lte?.let { if ((actual as? Number)?.toDouble()?.let { value -> value <= it } != true) return false }
    condition.empty?.let { required ->
        val empty = when (actual) {
            null -> true
            is String -> actual.isBlank()
            is Collection<*> -> actual.isEmpty()
            is Map<*, *> -> actual.isEmpty()
            else -> false
        }
        if (empty != required) {
            return false
        }
    }
    condition.notEmpty?.let { required ->
        val present = when (actual) {
            null -> false
            is String -> actual.isNotBlank()
            is Collection<*> -> actual.isNotEmpty()
            is Map<*, *> -> actual.isNotEmpty()
            else -> true
        }
        if (present != required) {
            return false
        }
    }
    return true
}

private fun resolveDashboardValue(
    source: String?,
    selector: String?,
    metrics: Map<String, Any?>,
    filters: Map<String, Any?>,
    selection: DashboardSelectionState
): Any? {
    if (selector.isNullOrBlank()) {
        return when (source?.lowercase()) {
            "selection" -> mapOf(
                "dimension" to selection.dimension,
                "entityKey" to selection.entityKey,
                "pointKey" to selection.pointKey,
                "selected" to selection.selected,
                "sourceBlockId" to selection.sourceBlockId
            )
            "filters", "filter" -> filters
            else -> metrics
        }
    }
    return when (source?.lowercase()) {
        "selection" -> SelectorUtil.resolve(
            mapOf(
                "dimension" to selection.dimension,
                "entityKey" to selection.entityKey,
                "pointKey" to selection.pointKey,
                "selected" to selection.selected,
                "sourceBlockId" to selection.sourceBlockId
            ),
            selector
        )
        "filters", "filter" -> SelectorUtil.resolve(filters, selector)
        else -> when {
            selector.startsWith("filters.") -> SelectorUtil.resolve(filters, selector.removePrefix("filters."))
            selector.startsWith("selection.") -> SelectorUtil.resolve(
                mapOf(
                    "dimension" to selection.dimension,
                    "entityKey" to selection.entityKey,
                    "pointKey" to selection.pointKey,
                    "selected" to selection.selected,
                    "sourceBlockId" to selection.sourceBlockId
                ),
                selector.removePrefix("selection.")
            )
            else -> SelectorUtil.resolve(metrics, selector)
        }
    }
}

private fun dashboardValuesEqual(actual: Any?, expected: JsonElement): Boolean {
    return when (expected) {
        is JsonPrimitive -> {
            when {
                expected.isString -> actual?.toString() == expected.content
                expected.booleanOrNull() != null -> actual == expected.booleanOrNull()
                expected.longOrNull() != null -> (actual as? Number)?.toLong() == expected.longOrNull()
                expected.doubleOrNull() != null -> (actual as? Number)?.toDouble() == expected.doubleOrNull()
                else -> actual?.toString() == expected.content
            }
        }
        else -> actual?.toString() == expected.toString()
    }
}

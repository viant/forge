package com.viant.forgeandroid.runtime

object StableTabsState {
    fun selected(ids: List<String>, requested: String?, fallback: String?): String? = requested?.takeIf(ids::contains) ?: fallback?.takeIf(ids::contains) ?: ids.firstOrNull()
    fun mounted(ids: List<String>, selected: String?, visited: Set<String>, keepVisited: Boolean, activeOnly: Boolean): List<String> =
        if (!activeOnly && !keepVisited) ids else ids.filter { it == selected || (keepVisited && it in visited) }
}

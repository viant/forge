package com.viant.forgeandroid.runtime

object SelectorUtil {
    fun resolve(obj: Any?, path: String?): Any? {
        if (path == null || path.isEmpty()) return obj
        val parts = path.split('.')
        var current: Any? = obj
        for (part in parts) {
            if (current !is Map<*, *>) return null
            current = current[part]
        }
        return current
    }

    fun set(map: Map<String, Any?>, path: String, value: Any?): Map<String, Any?> {
        val parts = path.split('.')
        val root = map.toMutableMap()
        var cur: MutableMap<String, Any?> = root
        for (i in parts.indices) {
            val key = parts[i]
            if (i == parts.lastIndex) {
                cur[key] = value
            } else {
                val next = (cur[key] as? Map<String, Any?>)?.toMutableMap() ?: mutableMapOf()
                cur[key] = next
                cur = next
            }
        }
        return root
    }
}

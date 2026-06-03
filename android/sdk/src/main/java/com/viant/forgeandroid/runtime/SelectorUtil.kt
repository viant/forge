package com.viant.forgeandroid.runtime

object SelectorUtil {
    fun resolve(obj: Any?, path: String?): Any? {
        if (path == null || path.isEmpty()) return obj
        val parts = path.split('.')
        var current: Any? = obj
        for (part in parts) {
            current = when (current) {
                is Map<*, *> -> current[part]
                is List<*> -> {
                    val list = current
                    part.toIntOrNull()?.takeIf { it in list.indices }?.let { list[it] }
                }
                else -> null
            } ?: return null
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
                val next = JsonUtil.asStringMap(cur[key]).toMutableMap()
                cur[key] = next
                cur = next
            }
        }
        return root
    }
}

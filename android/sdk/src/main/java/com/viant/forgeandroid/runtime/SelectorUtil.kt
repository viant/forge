package com.viant.forgeandroid.runtime

object SelectorUtil {
    internal object Missing

    fun resolve(obj: Any?, path: String?): Any? {
        if (path.isNullOrEmpty()) return obj
        return resolveParts(obj, path.split('.'), null)
    }

    internal fun resolveParts(obj: Any?, parts: List<String>, missing: Any?): Any? {
        var current = obj
        for (part in parts) {
            current = when (val parent = current) {
                is Map<*, *> -> parent[part] ?: if (missing == null || parent.containsKey(part)) null else return missing
                is List<*> -> {
                    val index = part.toIntOrNull() ?: return missing
                    if (index !in parent.indices) return missing
                    parent[index]
                }
                else -> return missing
            }
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

package com.viant.forgeandroid.runtime

/** A platform-neutral view of one datasource's live Forge state. */
data class FeedDataSourceSnapshot(
    val form: Map<String, Any?> = emptyMap(),
    val collection: List<Map<String, Any?>> = emptyList(),
    val selection: Map<String, Any?> = emptyMap()
)

/** JSON-Patch-like operation relative to a datasource view. */
data class FeedPatchOperation(
    val dataSourceRef: String,
    val op: String,
    val path: String,
    val value: Any? = null
)

fun snapshotFeedDataSources(
    windowContext: WindowContext,
    dataSourceRefs: Collection<String>
): Map<String, FeedDataSourceSnapshot> = dataSourceRefs.distinct().associateWith { ref ->
    val context = windowContext.contextOrNull(ref)
        ?: throw IllegalArgumentException("unknown dataSourceRef: $ref")
    val selection = context.peekSelection()
    FeedDataSourceSnapshot(
        form = context.peekForm(),
        collection = context.collection.peek(),
        selection = buildMap {
            selection.selected?.let { put("selected", it) }
            if (selection.selection.isNotEmpty()) put("selection", selection.selection)
            if (selection.rowIndex >= 0) put("rowIndex", selection.rowIndex)
        }
    )
}

/**
 * Applies feed operations to Forge signals exactly once. The host remains
 * responsible for mapping derived datasource paths back to canonical domain
 * data and for recomputing dependent datasource projections.
 */
fun applyFeedPatchOperations(
    windowContext: WindowContext,
    operations: List<FeedPatchOperation>
): Set<String> {
    val changed = linkedSetOf<String>()
    operations.forEach { operation ->
        val context = windowContext.contextOrNull(operation.dataSourceRef)
            ?: throw IllegalArgumentException("unknown dataSourceRef: ${operation.dataSourceRef}")
        val tokens = parseFeedPointer(operation.path)
        require(tokens.isNotEmpty()) { "feed patch path must select a datasource view" }
        val view = tokens.first()
        val relative = tokens.drop(1)
        when (view) {
            "form" -> {
                val patched = patchFeedValue(context.peekForm(), relative, operation)
                context.setForm(stringMap(patched, "form"))
            }
            "collection" -> {
                val patched = patchFeedValue(context.collection.peek(), relative, operation)
                context.collection.set(rowList(patched, "collection"))
            }
            "selection" -> {
                val current = context.peekSelection()
                val selectionView = linkedMapOf<String, Any?>(
                    "selected" to current.selected,
                    "selection" to current.selection,
                    "rowIndex" to current.rowIndex
                )
                val patched = stringMap(patchFeedValue(selectionView, relative, operation), "selection")
                context.setSelection(
                    SelectionState(
                        selected = stringMapOrNull(patched["selected"]),
                        selection = rowListOrEmpty(patched["selection"]),
                        rowIndex = (patched["rowIndex"] as? Number)?.toInt() ?: -1
                    )
                )
            }
            else -> throw IllegalArgumentException("unsupported feed patch view: $view")
        }
        changed += operation.dataSourceRef
    }
    return changed
}

private fun parseFeedPointer(path: String): List<String> {
    require(path.startsWith('/')) { "feed patch path must be an absolute JSON Pointer" }
    return path.split('/').drop(1).map { token ->
        token.replace("~1", "/").replace("~0", "~")
    }
}

private fun patchFeedValue(root: Any?, tokens: List<String>, operation: FeedPatchOperation): Any? {
    if (tokens.isEmpty()) {
        require(operation.op != "remove") { "cannot remove a datasource view root" }
        require(operation.op == "add" || operation.op == "replace") { "unsupported feed patch op: ${operation.op}" }
        return operation.value
    }
    val mutable = mutableFeedValue(root)
    patchFeedChild(mutable, tokens, operation)
    return immutableFeedValue(mutable)
}

private fun patchFeedChild(parent: Any?, tokens: List<String>, operation: FeedPatchOperation) {
    val token = tokens.first()
    if (tokens.size == 1) {
        when (parent) {
            is MutableMap<*, *> -> patchFeedMap(parent as MutableMap<String, Any?>, token, operation)
            is MutableList<*> -> patchFeedList(parent as MutableList<Any?>, token, operation)
            else -> throw IllegalArgumentException("feed patch path traverses a scalar")
        }
        return
    }
    val child = when (parent) {
        is MutableMap<*, *> -> (parent as MutableMap<String, Any?>)[token]
        is MutableList<*> -> (parent as MutableList<Any?>).getOrNull(feedListIndex(token, parent.size, false))
        else -> null
    } ?: throw IllegalArgumentException("feed patch path does not exist: $token")
    patchFeedChild(child, tokens.drop(1), operation)
}

private fun patchFeedMap(target: MutableMap<String, Any?>, key: String, operation: FeedPatchOperation) {
    when (operation.op) {
        "add" -> target[key] = mutableFeedValue(operation.value)
        "replace" -> {
            require(target.containsKey(key)) { "feed replace path does not exist: $key" }
            target[key] = mutableFeedValue(operation.value)
        }
        "remove" -> {
            require(target.containsKey(key)) { "feed remove path does not exist: $key" }
            target.remove(key)
        }
        else -> throw IllegalArgumentException("unsupported feed patch op: ${operation.op}")
    }
}

private fun patchFeedList(target: MutableList<Any?>, token: String, operation: FeedPatchOperation) {
    when (operation.op) {
        "add" -> {
            val index = feedListIndex(token, target.size, true)
            if (index == target.size) target.add(mutableFeedValue(operation.value))
            else target.add(index, mutableFeedValue(operation.value))
        }
        "replace" -> target[feedListIndex(token, target.size, false)] = mutableFeedValue(operation.value)
        "remove" -> target.removeAt(feedListIndex(token, target.size, false))
        else -> throw IllegalArgumentException("unsupported feed patch op: ${operation.op}")
    }
}

private fun feedListIndex(token: String, size: Int, allowEnd: Boolean): Int {
    if (allowEnd && token == "-") return size
    val index = token.toIntOrNull() ?: throw IllegalArgumentException("invalid feed array index: $token")
    val valid = if (allowEnd) index in 0..size else index in 0 until size
    require(valid) { "feed array index out of bounds: $index" }
    return index
}

private fun mutableFeedValue(value: Any?): Any? = when (value) {
    is Map<*, *> -> value.entries.associateTo(linkedMapOf()) { it.key.toString() to mutableFeedValue(it.value) }
    is List<*> -> value.mapTo(mutableListOf(), ::mutableFeedValue)
    else -> value
}

private fun immutableFeedValue(value: Any?): Any? = when (value) {
    is Map<*, *> -> value.entries.associate { it.key.toString() to immutableFeedValue(it.value) }
    is List<*> -> value.map(::immutableFeedValue)
    else -> value
}

private fun stringMap(value: Any?, label: String): Map<String, Any?> =
    stringMapOrNull(value) ?: throw IllegalArgumentException("patched $label must be an object")

private fun stringMapOrNull(value: Any?): Map<String, Any?>? =
    (value as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value }

private fun rowList(value: Any?, label: String): List<Map<String, Any?>> =
    (value as? List<*>)?.mapIndexed { index, row ->
        stringMapOrNull(row) ?: throw IllegalArgumentException("patched $label row $index must be an object")
    } ?: throw IllegalArgumentException("patched $label must be an array")

private fun rowListOrEmpty(value: Any?): List<Map<String, Any?>> =
    (value as? List<*>)?.mapNotNull(::stringMapOrNull).orEmpty()

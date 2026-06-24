package com.viant.forgeandroid.runtime

data class FileBrowserRowModel(
    val id: String,
    val uri: String,
    val name: String,
    val subtitle: String,
    val isFolder: Boolean
)

fun fileBrowserRowModel(row: Map<String, Any?>, fallbackIndex: Int): FileBrowserRowModel {
    val uri = fileBrowserRowLocation(row).orEmpty()
    val explicitName = listOf("name", "label", "filename", "fileName")
        .asSequence()
        .mapNotNull { key -> row[key]?.toString()?.trim() }
        .firstOrNull { it.isNotBlank() }
    val uriName = uri.substringAfterLast('/').ifBlank { if (uri.isNotBlank()) "/" else "" }
    val resolvedName = explicitName ?: uriName.ifBlank { "Unnamed" }
    val identity = listOf(uri.takeIf { it.isNotBlank() } ?: resolvedName, fallbackIndex.toString())
        .joinToString("#")
    return FileBrowserRowModel(
        id = identity,
        uri = uri,
        name = resolvedName,
        subtitle = uri,
        isFolder = fileBrowserRowIsFolder(row)
    )
}

fun fileBrowserRowAccessibilityLabel(model: FileBrowserRowModel, disabled: Boolean = false): String {
    val kind = if (model.isFolder) "Folder" else "File"
    val status = if (disabled) ", disabled" else ""
    return if (model.subtitle.isBlank()) {
        "$kind ${model.name}$status"
    } else {
        "$kind ${model.name}, ${model.subtitle}$status"
    }
}

fun fileBrowserRowLocation(row: Map<String, Any?>?): String? {
    if (row == null) {
        return null
    }
    return listOf("uri", "URI", "url", "path", "Path")
        .asSequence()
        .mapNotNull { key -> row[key]?.toString()?.trim() }
        .firstOrNull { it.isNotBlank() }
}

fun fileBrowserParentUri(uri: String): String {
    val trimmed = uri.trim()
    if (trimmed.isBlank() || trimmed == "/") {
        return "/"
    }
    val withoutTrailingSlash = if (trimmed.length > 1 && trimmed.endsWith("/")) {
        trimmed.dropLast(1)
    } else {
        trimmed
    }
    val slash = withoutTrailingSlash.lastIndexOf('/')
    if (slash <= 0) {
        return "/"
    }
    return withoutTrailingSlash.substring(0, slash).ifBlank { "/" }
}

private fun fileBrowserRowIsFolder(row: Map<String, Any?>): Boolean {
    listOf("isFolder", "isDirectory", "directory", "folder").forEach { key ->
        fileBrowserBool(row[key])?.let { return it }
    }
    listOf("type", "kind", "fileType").forEach { key ->
        val normalized = row[key]?.toString()?.trim()?.lowercase()
        if (normalized in setOf("folder", "directory", "dir")) {
            return true
        }
        if (normalized in setOf("file", "document", "blob")) {
            return false
        }
    }
    return false
}

private fun fileBrowserBool(value: Any?): Boolean? {
    return when (value) {
        is Boolean -> value
        is Number -> value.toDouble() != 0.0
        is String -> when (value.trim().lowercase()) {
            "true", "yes", "1", "folder", "directory", "dir" -> true
            "false", "no", "0", "file", "document", "blob" -> false
            else -> null
        }
        else -> null
    }
}

package com.viant.forgeandroid.agently

import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.ContentDef
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.EditorDef
import com.viant.forgeandroid.runtime.EditorSelectorDef
import com.viant.forgeandroid.runtime.JsonUtil
import com.viant.forgeandroid.runtime.ViewDef
import com.viant.forgeandroid.runtime.WindowMetadata
import java.nio.charset.StandardCharsets

fun registerAgentlyHandlers(runtime: ForgeRuntime, client: AgentlyClient? = null) {
    runtime.registerHandler("chat.onUpload") { args ->
        val windowId = (args.args["windowId"] as? String)
            ?: args.context?.window?.windowId
            ?: return@registerHandler null
        runtime.openDialog(windowId, "fileBrowser", emptyMap())
        null
    }

    runtime.registerHandler("chat.onSettings") { args ->
        val windowId = (args.args["windowId"] as? String)
            ?: args.context?.window?.windowId
            ?: return@registerHandler null
        runtime.openDialog(windowId, "settings", emptyMap())
        null
    }

    runtime.registerHandler("chat.selectFolder") { args ->
        val dialogId = (args.args["dialogId"] as? String) ?: "fileBrowser"
        val windowId = (args.args["windowId"] as? String)
            ?: args.context?.window?.windowId
            ?: return@registerHandler null
        val payload = JsonUtil.asStringMap(args.args["payload"]).takeIf { it.isNotEmpty() }
            ?: args.context?.peekSelection()?.selected
            ?: emptyMap()
        val dialogKey = "${windowId}Dialog$dialogId"
        val pending = runtime.pendingDialog(dialogKey)
        if (pending != null) {
            val callerCtx = runtime.dataSourceContext(pending.callerWindowId, pending.callerDataSourceRef)
            val uri = payload["uri"] ?: payload["path"]
            if (uri != null) {
                callerCtx.setFormField("folder", uri)
                callerCtx.setFormField("uri", uri)
            }
            if (payload.isNotEmpty()) {
                callerCtx.setFormField("selectedFolder", payload)
            }
        }
        runtime.closeDialogPublic(windowId, dialogId)
        null
    }

    runtime.registerHandler("chat.openFile") { args ->
        val file = JsonUtil.asStringMap(args.args["file"]).takeIf { it.isNotEmpty() } ?: return@registerHandler null
        val windowId = (args.args["windowId"] as? String)
            ?: args.context?.window?.windowId
            ?: "file"
        val title = (
            file["filename"]
                ?: file["name"]
                ?: file["title"]
                ?: file["uri"]
                ?: file["path"]
                ?: "File"
        ).toString().ifBlank { "File" }
        val content = resolveFileContent(file, client)
        val extension = resolveFileExtension(file, title, content.second)
        val metadata = WindowMetadata(
            namespace = "File",
            view = ViewDef(
                content = ContentDef(
                    containers = listOf(
                        ContainerDef(
                            id = "fileViewer",
                            title = title,
                            dataSourceRef = "file",
                            editor = EditorDef(
                                selector = EditorSelectorDef(
                                    source = "source",
                                    extension = "extension",
                                    location = "location"
                                ),
                                style = mapOf("readOnly" to "true")
                            )
                        )
                    )
                )
            ),
            dataSources = emptyMap()
        )
        val state = runtime.openWindowInline(
            windowKey = "file:${windowId}:${title}",
            title = title,
            inTab = true,
            metadata = metadata
        )
        val ctx = runtime.windowContext(state.windowId)
        val ds = ctx.context("file")
        ds.setForm(
            mapOf(
                "source" to content.first,
                "extension" to extension,
                "location" to (file["uri"] ?: file["path"] ?: title).toString()
            )
        )
        null
    }
}

private suspend fun resolveFileContent(file: Map<String, Any?>, client: AgentlyClient?): Pair<String, String?> {
    val inline = file["content"]?.toString()?.takeIf { it.isNotBlank() }
    if (inline != null) {
        return inline to (file["mimeType"] ?: file["contentType"])?.toString()
    }
    if (client == null) {
        return "File preview unavailable: AgentlyClient not registered." to null
    }
    val generatedFileId = file["id"]?.toString()?.takeIf { it.isNotBlank() }
    val fileId = (file["fileId"] ?: file["id"])?.toString()?.takeIf { it.isNotBlank() }
    val payloadId = (file["payloadId"] ?: file["attachmentPayloadId"])?.toString()?.takeIf { it.isNotBlank() }
    val uri = (file["uri"] ?: file["path"])?.toString()?.takeIf { it.isNotBlank() }
    val conversationId = file["conversationId"]?.toString()?.takeIf { it.isNotBlank() }
    return try {
        when {
            conversationId != null && fileId != null -> {
                val download = client.downloadFile(conversationId, fileId)
                decodeFile(download.data) to download.contentType
            }
            generatedFileId != null -> {
                val download = client.downloadGeneratedFile(generatedFileId)
                decodeFile(download.data) to download.contentType
            }
            payloadId != null -> {
                val download = client.downloadPayload(payloadId)
                decodeFile(download.data) to download.contentType
            }
            uri != null -> client.downloadWorkspaceFile(uri) to "text/plain"
            else -> "File preview unavailable." to null
        }
    } catch (e: Exception) {
        "Failed to load file: ${e.message ?: "unknown error"}" to null
    }
}

private fun decodeFile(bytes: ByteArray): String {
    if (bytes.isEmpty()) {
        return ""
    }
    return try {
        String(bytes, StandardCharsets.UTF_8)
    } catch (_: Exception) {
        bytes.joinToString(separator = " ") { b -> "%02x".format(b) }
    }
}

private fun resolveFileExtension(file: Map<String, Any?>, title: String, contentType: String?): String {
    val explicit = (file["extension"] ?: file["language"])?.toString()?.trim().orEmpty()
    if (explicit.isNotBlank()) {
        return explicit
    }
    val name = title.substringAfterLast('/', title)
    val ext = name.substringAfterLast('.', "").trim()
    if (ext.isNotBlank() && ext != name) {
        return ext
    }
    return when {
        contentType?.contains("json", true) == true -> "json"
        contentType?.contains("yaml", true) == true -> "yaml"
        contentType?.contains("markdown", true) == true -> "md"
        contentType?.contains("html", true) == true -> "html"
        else -> "txt"
    }
}

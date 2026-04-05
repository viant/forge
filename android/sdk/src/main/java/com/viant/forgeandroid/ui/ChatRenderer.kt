package com.viant.forgeandroid.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.ThumbDownOffAlt
import androidx.compose.material.icons.filled.ThumbUpOffAlt
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.AssistChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.ChatDef
import com.viant.forgeandroid.runtime.ChatHeaderDef
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ExecutionDef
import com.viant.forgeandroid.runtime.ForgeRuntime

@Composable
fun ChatRenderer(runtime: ForgeRuntime, context: DataSourceContext, chat: ChatDef) {
    val messages by context.collection.flow.collectAsState(initial = emptyList())
    val form by context.form.flow.collectAsState(initial = emptyMap())
    var input by remember { mutableStateOf("") }
    val windowId = context.window.windowId
    val attachmentField = chat.uploadField?.ifBlank { "files" } ?: "files"
    val attachments = remember(form, attachmentField) {
        normalizeAttachments(form[attachmentField])
    }

    LaunchedEffect(Unit) {
        context.fetchCollection()
    }

    Column(modifier = Modifier.fillMaxSize().background(Color.White)) {
        ChatHeader(chat.header, runtime, windowId)
        HorizontalDivider(color = Color(0xFFE6E6E6), thickness = 1.dp)
        LazyColumn(
            modifier = Modifier
                .weight(1f, fill = true)
                .padding(horizontal = 12.dp)
        ) {
            items(messages) { msg ->
                val kind = msg["kind"]?.toString()
                if (kind == "chip") {
                    val text = msg["content"]?.toString() ?: ""
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                        Box(
                            modifier = Modifier
                                .padding(vertical = 8.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color(0xFFEDEDED))
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text(text, color = Color(0xFF666666), textAlign = TextAlign.Center)
                        }
                    }
                    return@items
                }
                val role = msg["role"]?.toString() ?: "user"
                val content = msg["content"]?.toString() ?: ""
                val rowFiles = remember(msg) {
                    normalizeChatFiles(
                        msg["generatedFiles"],
                        msg["attachments"],
                        msg["files"]
                    )
                }
                val isUser = role == "user"
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
                ) {
                    if (isUser) {
                        Box(
                            modifier = Modifier
                                .padding(vertical = 6.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color(0xFFEDEDED))
                                .padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                if (content.isNotBlank()) {
                                    Text(text = content, color = Color(0xFF333333))
                                }
                                if (rowFiles.isNotEmpty()) {
                                    ChatFileChips(runtime = runtime, context = context, files = rowFiles)
                                }
                            }
                        }
                    } else {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(end = 18.dp)
                        ) {
                            if (content.isNotBlank()) {
                                Box(
                                    modifier = Modifier
                                        .padding(top = 6.dp, bottom = 4.dp)
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(Color(0xFFF8FAFC))
                                        .padding(horizontal = 12.dp, vertical = 10.dp)
                                ) {
                                    MarkdownRenderer(
                                        markdown = content,
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                }
                            } else {
                                Text(
                                    text = "Thinking...",
                                    color = Color(0xFF6A7280),
                                    style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier.padding(top = 6.dp, bottom = 4.dp)
                                )
                            }
                            val status = msg["status"]?.toString().orEmpty()
                            val toolName = msg["toolName"]?.toString().orEmpty()
                            val meta = listOfNotNull(
                                toolName.takeIf { it.isNotBlank() },
                                status.takeIf { it.isNotBlank() && !it.equals("done", true) }
                            ).joinToString(" • ")
                            if (meta.isNotBlank()) {
                                Text(
                                    text = meta,
                                    color = Color(0xFF6A7280),
                                    style = MaterialTheme.typography.labelSmall,
                                    modifier = Modifier.padding(bottom = 6.dp)
                                )
                            }
                            if (rowFiles.isNotEmpty()) {
                                ChatFileChips(
                                    runtime = runtime,
                                    context = context,
                                    files = rowFiles,
                                    modifier = Modifier.padding(bottom = 6.dp)
                                )
                            }
                            Spacer(modifier = Modifier.height(2.dp))
                            Row(
                                modifier = Modifier.padding(bottom = 8.dp),
                                horizontalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                Icon(Icons.Default.ContentCopy, contentDescription = "Copy", tint = Color(0xFF888888))
                                Icon(Icons.AutoMirrored.Filled.VolumeUp, contentDescription = "Speak", tint = Color(0xFF888888))
                                Icon(Icons.Default.ThumbUpOffAlt, contentDescription = "Like", tint = Color(0xFF888888))
                                Icon(Icons.Default.ThumbDownOffAlt, contentDescription = "Dislike", tint = Color(0xFF888888))
                                Icon(Icons.Default.Share, contentDescription = "Share", tint = Color(0xFF888888))
                            }
                        }
                    }
                }
            }
        }
        ChatInputBar(
            runtime = runtime,
            context = context,
            chat = chat,
            input = input,
            attachments = attachments,
            onInputChange = { input = it },
            onRemoveAttachment = { attachment ->
                val remaining = attachments
                    .filterNot { it.name == attachment.name && it.uri == attachment.uri }
                    .map { mapOf("name" to it.name, "uri" to it.uri) }
                context.setFormField(attachmentField, remaining)
            },
            onSend = {
                if (input.isBlank() && attachments.isEmpty()) return@ChatInputBar
                val exec = chat.on.firstOrNull { it.event == "onSubmit" } ?: ExecutionDef(handler = "chat.submitMessage")
                runtime.execute(
                    exec,
                    context,
                    mapOf(
                        "message" to input.takeIf { it.isNotBlank() },
                        "files" to attachments.map { mapOf("name" to it.name, "uri" to it.uri) },
                        attachmentField to attachments.map { mapOf("name" to it.name, "uri" to it.uri) }
                    )
                )
                if (attachments.isNotEmpty()) {
                    context.setFormField(attachmentField, emptyList<Map<String, Any?>>())
                }
                input = ""
            }
        )
    }
}

@Composable
private fun ChatFileChips(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    files: List<ChatFile>,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth().wrapContentWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        files.forEach { file ->
            AssistChip(
                onClick = {
                    runtime.execute(
                        ExecutionDef(handler = "chat.openFile"),
                        context,
                        mapOf("file" to file.raw, "windowId" to context.window.windowId)
                    )
                },
                label = { Text(file.name) }
            )
        }
    }
}

@Composable
private fun ChatHeader(header: ChatHeaderDef?, runtime: ForgeRuntime, windowId: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row {
            val leftButtons = header?.left ?: listOf(com.viant.forgeandroid.runtime.ChatHeaderButtonDef(icon = "back"))
            leftButtons.forEach { btn ->
                IconButton(onClick = {
                    btn.on.forEach { exec ->
                        runtime.execute(exec, null, mapOf("windowId" to windowId))
                    }
                }) {
                    Icon(resolveHeaderIcon(btn.icon), contentDescription = btn.icon ?: "Back")
                }
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = header?.title ?: "ChatGPT 5.2",
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center
            )
        }
        Row {
            val rightButtons = header?.right ?: listOf(
                com.viant.forgeandroid.runtime.ChatHeaderButtonDef(icon = "edit"),
                com.viant.forgeandroid.runtime.ChatHeaderButtonDef(icon = "plus")
            )
            rightButtons.forEach { btn ->
                IconButton(onClick = {
                    btn.on.forEach { exec ->
                        runtime.execute(exec, null, mapOf("windowId" to windowId))
                    }
                }) {
                    Icon(resolveHeaderIcon(btn.icon), contentDescription = btn.icon ?: "Action")
                }
            }
        }
    }
}

private fun resolveHeaderIcon(name: String?) = when (name) {
    "back" -> Icons.AutoMirrored.Filled.ArrowBack
    "edit" -> Icons.Default.Edit
    "plus", "add" -> Icons.Default.Add
    "settings" -> Icons.Default.Tune
    else -> Icons.AutoMirrored.Filled.ArrowBack
}

@Composable
private fun ChatInputBar(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    chat: ChatDef,
    input: String,
    attachments: List<ChatAttachment>,
    onInputChange: (String) -> Unit,
    onRemoveAttachment: (ChatAttachment) -> Unit,
    onSend: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (attachments.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth().wrapContentWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                attachments.forEach { attachment ->
                    AssistChip(
                        onClick = { onRemoveAttachment(attachment) },
                        label = { Text(attachment.name) }
                    )
                }
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (chat.showUpload != false) {
                IconButton(
                    onClick = {
                        val exec = chat.on.firstOrNull { it.event == "onUpload" }
                        if (exec != null) {
                            runtime.execute(exec, context, emptyMap())
                        }
                    },
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(Color(0xFFF1F1F1))
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Attach")
                }
            }
            OutlinedTextField(
                value = input,
                onValueChange = onInputChange,
                modifier = Modifier
                    .weight(1f)
                    .height(40.dp),
                shape = RoundedCornerShape(20.dp),
                placeholder = { Text("Ask anything") },
                singleLine = true,
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White,
                    focusedIndicatorColor = Color(0xFFDDDDDD),
                    unfocusedIndicatorColor = Color(0xFFDDDDDD),
                    cursorColor = Color(0xFF111111),
                    focusedTextColor = Color(0xFF111111),
                    unfocusedTextColor = Color(0xFF111111),
                    focusedPlaceholderColor = Color(0xFF888888),
                    unfocusedPlaceholderColor = Color(0xFF888888)
                )
            )
            IconButton(
                onClick = onSend,
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(Color(0xFF0F0F0F))
            ) {
                Icon(
                    imageVector = if (chat.showMic == true && input.isBlank()) Icons.Default.Mic else Icons.AutoMirrored.Filled.Send,
                    contentDescription = "Send",
                    tint = Color.White
                )
            }
        }
    }
}

private data class ChatAttachment(
    val name: String,
    val uri: String? = null
)

private data class ChatFile(
    val name: String,
    val uri: String? = null,
    val raw: Map<String, Any?> = emptyMap()
)

private fun normalizeAttachments(value: Any?): List<ChatAttachment> {
    val items = value as? List<*> ?: return emptyList()
    return items.mapNotNull { item ->
        val map = item as? Map<*, *> ?: return@mapNotNull null
        val name = (map["name"] ?: map["title"] ?: map["uri"] ?: map["path"])?.toString()?.trim().orEmpty()
        if (name.isBlank()) {
            return@mapNotNull null
        }
        ChatAttachment(
            name = name.substringAfterLast('/'),
            uri = (map["uri"] ?: map["path"] ?: map["url"])?.toString()
        )
    }
}

private fun normalizeChatFiles(vararg values: Any?): List<ChatFile> {
    val out = mutableListOf<ChatFile>()
    val seen = mutableSetOf<String>()
    for (value in values) {
        val items = value as? List<*> ?: continue
        for (item in items) {
            val map = item as? Map<*, *> ?: continue
            val name = (map["filename"] ?: map["name"] ?: map["title"] ?: map["uri"] ?: map["path"])
                ?.toString()
                ?.trim()
                .orEmpty()
            if (name.isBlank()) {
                continue
            }
            val uri = (map["uri"] ?: map["path"] ?: map["url"] ?: map["downloadUrl"])?.toString()
            val key = "${uri.orEmpty()}::$name"
            if (seen.add(key)) {
                val raw = map.entries.associate { it.key.toString() to it.value }
                out += ChatFile(name = name.substringAfterLast('/'), uri = uri, raw = raw)
            }
        }
    } 
    return out
}

package com.viant.forgeandroid.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Divider
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.ThumbDownOffAlt
import androidx.compose.material.icons.filled.ThumbUpOffAlt
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.sp
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
    var input by remember { mutableStateOf("") }
    val windowId = context.window.windowId

    LaunchedEffect(Unit) {
        context.fetchCollection()
    }

    Column(modifier = Modifier.fillMaxSize().background(Color.White)) {
        ChatHeader(chat.header, runtime, windowId)
        Divider(color = Color(0xFFE6E6E6), thickness = 1.dp)
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
                            Text(text = content, color = Color(0xFF333333))
                        }
                    } else {
                        Column(modifier = Modifier.fillMaxWidth()) {
                            Text(
                                text = content,
                                color = Color(0xFF111111),
                                fontSize = 15.sp,
                                lineHeight = 20.sp,
                                modifier = Modifier.padding(top = 6.dp, bottom = 4.dp)
                            )
                            Row(
                                modifier = Modifier.padding(bottom = 8.dp),
                                horizontalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                Icon(Icons.Default.ContentCopy, contentDescription = "Copy", tint = Color(0xFF888888))
                                Icon(Icons.Default.VolumeUp, contentDescription = "Speak", tint = Color(0xFF888888))
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
            input = input,
            onInputChange = { input = it },
            onSend = {
                if (input.isBlank()) return@ChatInputBar
                val exec = chat.on.firstOrNull { it.event == "onSubmit" } ?: ExecutionDef(handler = "chat.submitMessage")
                runtime.execute(exec, context, mapOf("message" to input))
                input = ""
            }
        )
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
    "back" -> Icons.Default.ArrowBack
    "edit" -> Icons.Default.Edit
    "plus", "add" -> Icons.Default.Add
    "settings" -> Icons.Default.Tune
    else -> Icons.Default.ArrowBack
}

@Composable
private fun ChatInputBar(input: String, onInputChange: (String) -> Unit, onSend: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        IconButton(
            onClick = {},
            modifier = Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(Color(0xFFF1F1F1))
        ) {
            Icon(Icons.Default.Add, contentDescription = "Plus")
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
            Icon(Icons.Default.Mic, contentDescription = "Mic", tint = Color.White)
        }
    }
}

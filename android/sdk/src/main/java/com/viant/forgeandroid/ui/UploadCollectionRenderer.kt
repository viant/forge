package com.viant.forgeandroid.ui

import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.UploadFileValue
import com.viant.forgeandroid.runtime.WindowContext
import com.viant.forgeandroid.runtime.WorkflowPrimitiveRuntime
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
internal fun UploadCollectionRenderer(runtime: ForgeRuntime, window: WindowContext, container: ContainerDef) {
    val spec = container.uploadCollection ?: return
    val dataSourceRef = container.dataSourceRef ?: spec.upload.dataSourceRef
    val source = window.contextOrNull(dataSourceRef) ?: return
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var files by remember { mutableStateOf(emptyList<UploadFileValue>()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val validation = WorkflowPrimitiveRuntime.validateUpload(files, spec)
    val encoded = runCatching { WorkflowPrimitiveRuntime.encodeUpload(files, spec) }.getOrElse { emptyMap() }.toMutableMap()
    spec.metadataField?.let { encoded[it] = source.peekForm() }

    fun loadUris(uris: List<android.net.Uri>) {
        scope.launch {
            loading = true; error = ""
            runCatching {
                withContext(Dispatchers.IO) {
                    uris.map { uri ->
                        val name = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                            if (cursor.moveToFirst()) cursor.getString(0) else null
                        } ?: uri.lastPathSegment ?: "blob"
                        val mime = context.contentResolver.getType(uri) ?: "application/octet-stream"
                        val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                            ?: throw IllegalStateException("Unable to read $name")
                        UploadFileValue(name, mime, bytes)
                    }
                }
            }.onSuccess { files = if (spec.multiple == false) it.take(1) else it }
                .onFailure { error = it.message ?: "Unable to read selected files." }
            loading = false
        }
    }

    val singleLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> if (uri != null) loadUris(listOf(uri)) }
    val multipleLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris -> loadUris(uris) }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Button(enabled = !loading, onClick = {
            val types = uploadMimeTypes(spec.accept)
            if (spec.multiple == false) singleLauncher.launch(types) else multipleLauncher.launch(types)
        }) { Text(spec.emptyMessage ?: "Choose files…") }
        files.forEachIndexed { index, file ->
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column { Text(file.name); Text("${file.data.size} bytes", style = MaterialTheme.typography.bodySmall) }
                Button(onClick = { files = files.filterIndexed { fileIndex, _ -> fileIndex != index } }) { Text("Remove") }
            }
        }
        val messages = validation.errors + listOfNotNull(error.takeIf(String::isNotBlank))
        if (messages.isNotEmpty()) Text(messages.joinToString(" "), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        MutationCommandButton(
            runtime, window, source, spec.upload,
            labelOverride = if (loading) "Preparing…" else spec.upload.label ?: "Upload",
            extras = encoded,
            externallyDisabled = files.isEmpty() || !validation.valid || loading || error.isNotBlank(),
            onSettled = { result -> if (result.status == "succeeded") files = emptyList() }
        )
    }
}

private fun uploadMimeTypes(accept: List<String>): Array<String> {
    val values = accept.filter { !it.startsWith(".") }
    return if (values.isEmpty()) arrayOf("*/*") else values.toTypedArray()
}

package com.viant.forgeandroid.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
import java.time.*

@Composable
internal fun NativeWidgetView(sourceItem: ItemDef, value: JsonElement?, onChange: (JsonElement) -> Unit, onAction: (() -> Unit)? = null, windowForm: Map<String, Any?> = emptyMap(), onDraftChange: ((Map<String, Any?>) -> Unit)? = null) {
    val item = sourceItem.copy(properties = sourceItem.properties + buildMap {
        sourceItem.min?.let { put("min", it) }; sourceItem.max?.let { put("max", it) }
        sourceItem.accept?.let { put("accept", JsonPrimitive(it)) }; sourceItem.separator?.let { put("separator", JsonPrimitive(it)) }
    })
    val appearance = LocalForgeThemeAppearance.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val kind = NativeWidgetContract.kind(item)
    val label = item.label ?: item.title ?: item.id ?: "Field"
    val unavailable = NativeWidgetContract.disabled(item)
    val presentationDisabled = NativeWidgetContract.presentationDisabled(item)
    var error by remember(item.id) { mutableStateOf("") }
    LaunchedEffect(value) { error = "" }
    var draft by remember(item.id, value) { mutableStateOf<String?>(null) }
    val text = if (kind == "object") NativeWidgetContract.text(value) else NativeWidgetContract.displayText(value)
    val number = (value as? JsonPrimitive)?.doubleOrNull
    val display = draft ?: if (kind == "percentfraction2input" && number != null) "%.2f".format(java.util.Locale.ROOT, number * 100) else text
    fun edit(raw: String) {
        draft = raw
        val next = NativeWidgetContract.input(raw, kind, item.properties)
        if (next != null) { error = ""; onChange(next) } else error = if (kind == "object") "Enter valid JSON" else "Enter a valid value"
    }
    fun open(raw: String) {
        val uri = Uri.parse(raw)
        if (uri.scheme?.lowercase() !in setOf("http","https","mailto","tel","content","file")) { error = "Invalid link"; return }
        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }.onFailure { error = "No application can open this item" }
    }
    val importer = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) scope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    val resolver = context.contentResolver
                    var filename = "blob"
                    resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor -> if (cursor.moveToFirst()) filename = cursor.getString(0) }
                    val bytes = resolver.openInputStream(uri)?.use { it.readBytes() } ?: error("No file bytes")
                    val mime = resolver.getType(uri) ?: "application/octet-stream"
                    JsonObject(mapOf("name" to JsonPrimitive(filename), "filename" to JsonPrimitive(filename), "size" to JsonPrimitive(bytes.size), "type" to JsonPrimitive(mime), "mimeType" to JsonPrimitive(mime), "data" to JsonPrimitive(Base64.encodeToString(bytes, Base64.NO_WRAP))))
                }
            }.onSuccess { onChange(it); error = "" }.onFailure { error = "Could not read the selected file" }
        }
    }
    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp).semantics { contentDescription = label }, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        when (kind) {
            "text","password","number","currency","percentfraction2input","math","textarea","document","object" -> {
                ForgeThemeTextField(value = display, onValueChange = ::edit, label = label, enabled = !unavailable,
                    errorMessage = error,
                    visualTransformation = if (kind == "password") PasswordVisualTransformation() else VisualTransformation.None,
                    keyboardOptions = KeyboardOptions(keyboardType = if (kind == "password") KeyboardType.Password else if (kind in setOf("number","currency","percentfraction2input")) KeyboardType.Decimal else KeyboardType.Text),
                    singleLine = kind !in setOf("textarea","document","object"), minLines = if (kind in setOf("textarea","document","object")) 3 else 1)
                if (kind == "document") MarkdownRenderer(markdown = display)
            }
            "schema" -> { Text(label); Text(text, style = MaterialTheme.typography.bodySmall) }
            "checkbox","toggle","switch","booleanpill" -> Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(label)
                Switch(checked = NativeWidgetContract.truthy(value), onCheckedChange = { onChange(JsonPrimitive(it)) }, enabled = !unavailable)
            }
            "select","radio","daterangepreset" -> {
                var expanded by remember(item.id) { mutableStateOf(false) }
                val options = NativeWidgetContract.options(item)
                Text(label)
                Box {
                    OutlinedButton(onClick = { expanded = true }, enabled = !unavailable) { Text(options.firstOrNull { NativeWidgetContract.equivalent(it.first, value) }?.second ?: "Select") }
                    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                        options.forEach { option -> DropdownMenuItem(text = { Text(option.second) }, onClick = { if (kind != "daterangepreset" || NativeWidgetContract.text(option.first) != "custom") onChange(option.first); expanded = false }) }
                    }
                }
                if (kind == "daterangepreset") {
                    val startField = item.startField ?: (item.properties["startField"] as? JsonPrimitive)?.content ?: "customDateStart"
                    val endField = item.endField ?: (item.properties["endField"] as? JsonPrimitive)?.content ?: "customDateEnd"
                    val granularityField = item.granularityField ?: (item.properties["granularityField"] as? JsonPrimitive)?.content ?: "granularity"
                    val partialField = item.includePartialDataField ?: (item.properties["includePartialDataField"] as? JsonPrimitive)?.content ?: "includePartialData"
                    val start = windowForm[startField]?.toString().orEmpty(); val end = windowForm[endField]?.toString().orEmpty()
                    NativeDateButton("Custom start", start, false, !unavailable) { onDraftChange?.invoke(mapOf(startField to it)) }
                    NativeDateButton("Custom end", end, false, !unavailable) { onDraftChange?.invoke(mapOf(endField to it)) }
                    Row { Text("Include partial data"); Switch(checked = windowForm[partialField] != false, onCheckedChange = { onDraftChange?.invoke(mapOf(partialField to it)) }, enabled = !unavailable) }
                    val customEnabled = item.customApplyEnabled == true || item.properties["customApplyEnabled"] == JsonPrimitive(true)
                    TextButton(enabled = !unavailable && customEnabled && start.isNotEmpty() && end.isNotEmpty() && start <= end, onClick = {
                        val days = java.time.temporal.ChronoUnit.DAYS.between(LocalDate.parse(start),LocalDate.parse(end)) + 1
                        onDraftChange?.invoke(mapOf(granularityField to if (days <= 2) "hour" else "day")); onChange(JsonPrimitive("custom"))
                    }) { Text("Apply custom dates") }
                    if (!customEnabled) Text("Custom dates are saved as a draft and do not refresh data yet.")
                }
            }
            "treemultiselect" -> NativeTreeChoices(NativeWidgetContract.options(item), (value as? JsonArray).orEmpty(), (item.properties["separator"] as? JsonPrimitive)?.content ?: "_", !unavailable, onChange = { onChange(JsonArray(it)) })
            "multiselect" -> {
                Text(label)
                val selected = (value as? JsonArray).orEmpty()
                NativeWidgetContract.options(item).forEach { option ->
                    Row { Checkbox(checked = selected.any { NativeWidgetContract.equivalent(it, option.first) }, enabled = !unavailable, onCheckedChange = { checked -> onChange(JsonArray(if (checked) (selected + option.first).distinct() else selected.filterNot { NativeWidgetContract.equivalent(it, option.first) })) }); Text(option.second) }
                }
            }
            "chiplist" -> {
                val chips = (value as? JsonArray).orEmpty()
                if (chips.isEmpty()) Text((item.properties["emptyText"] as? JsonPrimitive)?.content ?: "None")
                chips.forEachIndexed { index, chip ->
                    val raw = (chip as? JsonObject)?.let { it["label"] ?: it["name"] ?: it["value"] } ?: chip
                    Row { Text((if ((chip as? JsonObject)?.get("excluded") == JsonPrimitive(true) || (chip as? JsonObject)?.get("mode") == JsonPrimitive("exclude")) "Exclude: " else "") + NativeWidgetContract.text(raw)); if (item.readOnly == false || item.properties["readOnly"] == JsonPrimitive(false)) TextButton(onClick = { onChange(JsonArray(chips.filterIndexed { i, _ -> i != index })) }, enabled = !unavailable) { Text("Remove") } }
                }
            }
            "keyvaluepairs" -> {
                val fields = (value as? JsonObject).orEmpty()
                Text(label)
                fields.forEach { (key, entry) -> Row(Modifier.fillMaxWidth()) {
                    OutlinedTextField(value = key, onValueChange = { next -> onChange(JsonObject(fields.toMutableMap().apply { remove(key); put(next, entry) })) }, label = { Text("Key") }, enabled = !unavailable, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = NativeWidgetContract.text(entry), onValueChange = { next -> onChange(JsonObject(fields + (key to JsonPrimitive(next)))) }, label = { Text("Value") }, enabled = !unavailable, modifier = Modifier.weight(1f))
                    TextButton(onClick = { onChange(JsonObject(fields - key)) }, enabled = !unavailable) { Text("Remove") }
                } }
                TextButton(onClick = { onChange(JsonObject(fields + ("" to JsonPrimitive("")))) }, enabled = !unavailable) { Text("Add pair") }
            }
            "date","datetime" -> NativeDateButton(label, text, kind == "datetime", !unavailable) { onChange(JsonPrimitive(it)) }
            "daterange" -> {
                val range = (value as? JsonObject).orEmpty()
                val start = NativeWidgetContract.text(range["start"]); val end = NativeWidgetContract.text(range["end"])
                Text(label)
                NativeDateButton("Start", start, false, !unavailable) { onChange(JsonObject(range + ("start" to JsonPrimitive(it)))) }
                NativeDateButton("End", end, false, !unavailable) { onChange(JsonObject(range + ("end" to JsonPrimitive(it)))) }
                if (start.isNotEmpty() && end.isNotEmpty() && start > end) Text("Start must not be after end", color = MaterialTheme.colorScheme.error)
            }
            "file" -> Row { Text((value as? JsonObject)?.get("name")?.jsonPrimitive?.content ?: "No file selected"); TextButton(onClick = { importer.launch(nativeAcceptMime(item)) }, enabled = !unavailable) { Text("Browse") }; if (value != null && value != JsonNull) TextButton(onClick = { onChange(JsonNull) }, enabled = !unavailable) { Text("Clear") } }
            "progressbar" -> { Text(label); LinearProgressIndicator(progress = (number ?: 0.0).toFloat().coerceIn(0f,1f), modifier = Modifier.fillMaxWidth()) }
            "link" -> TextButton(onClick = { open(text) }, enabled = !presentationDisabled) { Text(label) }
            "mediapreview" -> {
                val uri = (value as? JsonObject)?.let { NativeWidgetContract.text(it["url"] ?: it["href"]) } ?: text
                val mediaKind = (value as? JsonObject)?.get("kind")?.jsonPrimitive?.content?.lowercase()
                val safe = uri.startsWith("https://", ignoreCase = true)
                if (safe && mediaKind in setOf("audio", "video")) {
                    androidx.compose.ui.viewinterop.AndroidView(factory = { android.widget.VideoView(it).apply {
                        val controls = android.widget.MediaController(it); controls.setAnchorView(this); setMediaController(controls)
                    } }, update = { view -> if (view.tag != uri) { view.tag = uri; view.setVideoURI(Uri.parse(uri)) } }, modifier = Modifier.fillMaxWidth().height(180.dp))
                } else if (safe && mediaKind == "image") {
                    val bitmap by produceState<android.graphics.Bitmap?>(null, uri) { this.value = withContext(Dispatchers.IO) { runCatching { java.net.URL(uri).openStream().use(BitmapFactory::decodeStream) }.getOrNull() } }
                    bitmap?.let { Image(it.asImageBitmap(), contentDescription = (value as? JsonObject)?.get("alt")?.jsonPrimitive?.content ?: label, modifier = Modifier.heightIn(max = 200.dp)) }
                } else Text((value as? JsonObject)?.get("message")?.jsonPrimitive?.content ?: "Preview is not available for this media type.")
                if (safe) TextButton(onClick = { open(uri) }, enabled = !presentationDisabled) { Text("Open $label") }
            }
            "markdown" -> MarkdownRenderer(markdown = text)
            "label" -> { Text(label); Text(text) }
            "button" -> Button(onClick = { onAction?.invoke() }, enabled = !unavailable,
                modifier = if (appearance != null) Modifier.heightIn(min = maxOf(48f, appearance.controlHeight).dp) else Modifier,
                shape = appearance?.let { RoundedCornerShape(it.radius.dp) } ?: ButtonDefaults.shape,
                contentPadding = appearance?.let { PaddingValues(horizontal = it.paddingInline.dp, vertical = 8.dp) } ?: ButtonDefaults.ContentPadding,
                colors = appearance?.let { ButtonDefaults.buttonColors(containerColor = it.buttonBackground, contentColor = it.buttonForeground,
                    disabledContainerColor = it.disabledBackground, disabledContentColor = it.disabledForeground) } ?: ButtonDefaults.buttonColors(),
            ) { Text(label, style = LocalTextStyle.current.let { if (appearance != null) it.copy(fontSize = appearance.fontSize.sp) else it }) }
            else -> Text("Unsupported widget: $kind", color = MaterialTheme.colorScheme.error)
        }
        if (error.isNotEmpty()) Text(error, color = MaterialTheme.colorScheme.error)
    }
}

private fun nativeAcceptMime(item: ItemDef): String {
    val accept = (item.properties["accept"] as? JsonPrimitive)?.content ?: ".csv"
    if (accept.contains(',')) return "*/*"
    if (accept.startsWith('.')) return android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(accept.drop(1)) ?: "*/*"
    return accept
}

@Composable
private fun NativeDateButton(label: String, raw: String, time: Boolean, enabled: Boolean, change: (String) -> Unit) {
    val context = LocalContext.current
    val date = runCatching { LocalDate.parse(raw.take(10)) }.getOrElse { LocalDate.now(ZoneOffset.UTC) }
    OutlinedButton(enabled = enabled, onClick = {
        DatePickerDialog(context, { _, year, month, day ->
            val selected = LocalDate.of(year,month+1,day)
            if (time) TimePickerDialog(context, { _, hour, minute -> change(selected.atTime(hour,minute).toInstant(ZoneOffset.UTC).toString()) }, 0, 0, true).show()
            else change(selected.toString())
        }, date.year,date.monthValue-1,date.dayOfMonth).show()
    }) { Text("$label: ${raw.ifBlank { "Select date" }}") }
}

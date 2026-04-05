package com.viant.forgeandroid.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.EditorDef

@Composable
fun EditorRenderer(context: DataSourceContext, editor: EditorDef) {
    val form by context.form.flow.collectAsState(initial = emptyMap())
    val selector = editor.selector
    val sourceKey = selector?.source ?: "source"
    val extensionKey = selector?.extension ?: "extension"
    val locationKey = selector?.location ?: "location"
    val source = form[sourceKey]?.toString().orEmpty()
    val extension = form[extensionKey]?.toString().orEmpty()
    val location = form[locationKey]?.toString().orEmpty()
    val isDiff = extension.equals("diff", true) || source.startsWith("---") || source.startsWith("@@")
    val readOnly = editor.style["readonly"]?.equals("true", true) == true
        || editor.style["readOnly"]?.equals("true", true) == true

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFF8FAFC), RoundedCornerShape(16.dp))
            .padding(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            if (location.isNotBlank()) {
                Text(
                    text = location,
                    style = MaterialTheme.typography.labelMedium,
                    color = Color(0xFF6A7280)
                )
            }
            if (extension.isNotBlank()) {
                Text(
                    text = buildString {
                        append(extension.uppercase())
                        if (readOnly) append(" • READ ONLY")
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFF6A7280)
                )
            }
        }
        if (isDiff) {
            DiffView(source)
        } else {
            OutlinedTextField(
                value = source,
                onValueChange = { if (!readOnly) context.setFormField(sourceKey, it) },
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 220.dp),
                textStyle = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                supportingText = {},
                minLines = 10,
                enabled = !readOnly
            )
        }
    }
}

@Composable
private fun DiffView(text: String) {
    val horizontal = rememberScrollState()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(horizontal)
    ) {
        text.lines().forEachIndexed { index, line ->
            val bg = when {
                line.startsWith("+") -> Color(0xFFEAF7EC)
                line.startsWith("-") -> Color(0xFFFDECEC)
                line.startsWith("@@") -> Color(0xFFF4F4F5)
                else -> Color.Transparent
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(bg)
                    .padding(horizontal = 8.dp, vertical = 2.dp)
            ) {
                Text(
                    text = (index + 1).toString().padStart(4, ' '),
                    fontFamily = FontFamily.Monospace,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF98A2B3),
                    modifier = Modifier.padding(end = 12.dp)
                )
                Text(
                    text = line,
                    fontFamily = FontFamily.Monospace,
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

package com.viant.forgeandroid.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.TerminalDef

internal data class TerminalEntryView(
    val input: String,
    val output: String,
    val stderr: String,
    val status: Int,
    val isError: Boolean
)

internal fun normalizeTerminalEntries(rows: List<Map<String, Any?>>): List<TerminalEntryView> {
    return rows.map { row ->
        val stderr = stringValue(row["stderr"]).ifBlank { stringValue(row["stderro"]) }
        val status = intValue(row["code"]) ?: intValue(row["status"]) ?: 0
        TerminalEntryView(
            input = stringValue(row["input"]),
            output = stringValue(row["output"]),
            stderr = stderr,
            status = status,
            isError = stderr.isNotBlank() || status != 0
        )
    }
}

@Composable
fun TerminalRenderer(runtime: ForgeRuntime, context: DataSourceContext, terminal: TerminalDef) {
    val rows by context.collection.flow.collectAsState(initial = emptyList())
    val control by context.control.flow.collectAsState(initial = com.viant.forgeandroid.runtime.ControlState())
    val listState = rememberLazyListState()
    val entries = normalizeTerminalEntries(rows)
    val autoScroll = terminal.autoScroll != false

    LaunchedEffect(Unit) {
        context.fetchCollection()
    }

    LaunchedEffect(entries.size, autoScroll) {
        if (autoScroll && entries.isNotEmpty()) {
            listState.animateScrollToItem(entries.lastIndex)
        }
    }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        terminal.toolbar?.let {
            TableToolbar(runtime, context, it)
        }
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = parseTerminalHeight(terminal.height)),
            color = Color(0xFF0B1220),
            tonalElevation = 0.dp,
            shadowElevation = 0.dp,
            shape = MaterialTheme.shapes.large
        ) {
            if (control.error != null) {
                Box(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = control.error.orEmpty(),
                        color = Color(0xFFFDA29B),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    itemsIndexed(entries) { index, entry ->
                        TerminalEntry(
                            entry = entry,
                            prompt = terminal.prompt ?: "$",
                            truncateLongOutput = terminal.truncateLongOutput != false,
                            truncateLength = terminal.truncateLength ?: 150
                        )
                        if (terminal.showDividers == true && index < entries.lastIndex) {
                            HorizontalDivider(color = Color(0xFF223042))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TerminalEntry(
    entry: TerminalEntryView,
    prompt: String,
    truncateLongOutput: Boolean,
    truncateLength: Int
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = prompt,
                    color = Color(0xFF7DD3FC),
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = entry.input,
                    color = Color(0xFFE5E7EB),
                    fontFamily = FontFamily.Monospace,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            Text(
                text = if (entry.isError) "exit ${entry.status}" else "ok",
                color = if (entry.isError) Color(0xFFFDA29B) else Color(0xFF6CE9A6),
                fontFamily = FontFamily.Monospace,
                style = MaterialTheme.typography.labelSmall
            )
        }
        renderTerminalBlock(
            text = entry.output,
            color = Color(0xFFD0D5DD),
            truncateLongOutput = truncateLongOutput,
            truncateLength = truncateLength
        )
        renderTerminalBlock(
            text = entry.stderr,
            color = Color(0xFFFDA29B),
            truncateLongOutput = truncateLongOutput,
            truncateLength = truncateLength
        )
    }
}

@Composable
private fun renderTerminalBlock(
    text: String,
    color: Color,
    truncateLongOutput: Boolean,
    truncateLength: Int
) {
    if (text.isBlank()) {
        return
    }
    val display = if (truncateLongOutput && text.length > truncateLength) {
        text.take(truncateLength) + "…"
    } else {
        text
    }
    Text(
        text = display,
        color = color,
        fontFamily = FontFamily.Monospace,
        style = MaterialTheme.typography.bodySmall,
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF111827), MaterialTheme.shapes.medium)
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 10.dp, vertical = 8.dp)
    )
}

private fun parseTerminalHeight(raw: String?): androidx.compose.ui.unit.Dp {
    val normalized = raw?.trim().orEmpty().lowercase()
    val numeric = normalized.removeSuffix("px").removeSuffix("dp")
    return numeric.toFloatOrNull()?.dp ?: 320.dp
}

private fun stringValue(value: Any?): String = value?.toString().orEmpty()

private fun intValue(value: Any?): Int? {
    return when (value) {
        is Int -> value
        is Long -> value.toInt()
        is Double -> value.toInt()
        is Float -> value.toInt()
        is Number -> value.toInt()
        is String -> value.trim().toIntOrNull()
        else -> null
    }
}

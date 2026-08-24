package com.viant.forgeandroid.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.ItemDef
import com.viant.forgeandroid.runtime.SelectorUtil
import com.viant.forgeandroid.runtime.valueKey

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun MobileControlSheetRenderer(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    items: List<ItemDef>,
    title: String?
) {
    var expanded by remember { mutableStateOf(false) }
    val formSignal = context.window.windowFormSignal()
    val windowForm by formSignal.flow.collectAsState(initial = formSignal.peek())
    val summary = remember(windowForm, items) { mobileControlSheetSummary(windowForm, items) }

    Surface(
        color = Color(0xFFF8FAFD),
        shape = RoundedCornerShape(14.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFD7DFEA)),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { expanded = true }
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 11.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = title?.takeIf { it.isNotBlank() } ?: "View options",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = summary.ifBlank { "Choose view options" },
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Icon(Icons.Outlined.Tune, contentDescription = "Open view options")
        }
    }

    if (expanded) {
        ModalBottomSheet(onDismissRequest = { expanded = false }) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(horizontal = 18.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = title?.takeIf { it.isNotBlank() } ?: "View options",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                FormRenderer(runtime = runtime, context = context, items = items)
            }
        }
    }
}

internal fun mobileControlSheetSummary(windowForm: Map<String, Any?>, items: List<ItemDef>): String =
    items.mapNotNull { item ->
        val key = item.valueKey() ?: return@mapNotNull null
        val selected = SelectorUtil.resolve(windowForm, key)?.toString()?.trim().orEmpty()
        if (selected.isBlank()) return@mapNotNull null
        item.options.firstOrNull { it.value == selected }?.label?.takeIf { it.isNotBlank() } ?: selected
    }.joinToString(" · ")

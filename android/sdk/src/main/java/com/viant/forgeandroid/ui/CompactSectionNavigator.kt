package com.viant.forgeandroid.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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

@Composable
internal fun CompactSectionNavigator(
    entries: List<Pair<String, String>>,
    selectedId: String,
    onSelect: (String) -> Unit,
    fallbackLabel: String = "Section",
    chooserContentDescription: String = "Choose section"
) {
    if (entries.isEmpty()) return
    var expanded by remember(entries, selectedId) { mutableStateOf(false) }
    val selectedIndex = entries.indexOfFirst { it.first == selectedId }.coerceAtLeast(0)
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color(0xFFF5F8FB),
        border = BorderStroke(1.dp, ReportTabStripBorderColor),
        shape = RoundedCornerShape(14.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 2.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                enabled = selectedIndex > 0,
                onClick = { onSelect(entries[selectedIndex - 1].first) }
            ) {
                Text("‹", style = MaterialTheme.typography.headlineSmall)
            }
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clickable { expanded = true }
                    .padding(horizontal = 6.dp, vertical = 8.dp)
            ) {
                Text(
                    text = entries.getOrNull(selectedIndex)?.second ?: fallbackLabel,
                    style = MaterialTheme.typography.labelLarge,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "${selectedIndex + 1} of ${entries.size} · tap to choose",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            IconButton(onClick = { expanded = true }) {
                Icon(Icons.Filled.ArrowDropDown, contentDescription = chooserContentDescription)
            }
            IconButton(
                enabled = selectedIndex < entries.lastIndex,
                onClick = { onSelect(entries[selectedIndex + 1].first) }
            ) {
                Text("›", style = MaterialTheme.typography.headlineSmall)
            }
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            entries.forEachIndexed { index, entry ->
                DropdownMenuItem(
                    text = {
                        Text(
                            text = "${index + 1}. ${entry.second}",
                            fontWeight = if (entry.first == selectedId) FontWeight.SemiBold else FontWeight.Normal
                        )
                    },
                    onClick = {
                        onSelect(entry.first)
                        expanded = false
                    }
                )
            }
        }
    }
}

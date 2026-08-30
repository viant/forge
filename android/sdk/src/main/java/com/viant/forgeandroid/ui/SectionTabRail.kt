package com.viant.forgeandroid.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

internal data class SectionTabItem(val id: String, val label: String)

/** Native counterpart of Forge web's shared SectionTabRail. */
@Composable
internal fun SectionTabRail(
    items: List<SectionTabItem>,
    selectedId: String,
    onSelect: (String) -> Unit
) {
    Surface(
        color = Color(0xFFF5F8FB),
        border = BorderStroke(1.dp, Color(0xFFDBE5EC)),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items.forEach { item ->
                val selected = item.id == selectedId
                FilterChip(
                    selected = selected,
                    onClick = { onSelect(item.id) },
                    label = { Text(item.label, maxLines = 1) },
                    border = BorderStroke(1.dp, if (selected) Color(0xFF6F9FE9) else Color.Transparent),
                    colors = FilterChipDefaults.filterChipColors(
                        containerColor = Color.Transparent,
                        labelColor = Color(0xFF486579),
                        selectedContainerColor = Color.White,
                        selectedLabelColor = Color(0xFF1D4ED8)
                    ),
                    modifier = Modifier.shadow(
                        elevation = if (selected) 3.dp else 0.dp,
                        shape = RoundedCornerShape(10.dp),
                        clip = false
                    )
                )
            }
        }
    }
}

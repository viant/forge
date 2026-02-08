package com.viant.forgeandroid.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.Divider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.ItemDef
import com.viant.forgeandroid.runtime.WindowContext
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

@Composable
fun MenuListRenderer(runtime: ForgeRuntime, window: WindowContext, items: List<ItemDef>) {
    val useTiles = items.any { it.properties["tile"].asString() == "true" }
    if (useTiles) {
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(12.dp),
            verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(12.dp),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp)
        ) {
            items(items) { item ->
                val accent = parseColor(item.properties["accent"].asString()) ?: Color(0xFFF1F2F6)
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(accent, shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp))
                        .clickable {
                            item.on.forEach { exec ->
                                runtime.execute(exec, null, mapOf("windowId" to window.windowId))
                            }
                        }
                        .padding(16.dp)
                ) {
                    Text(
                        text = item.label ?: item.id.orEmpty(),
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp,
                        color = Color(0xFF111111)
                    )
                    val subtitle = item.properties["subtitle"].asString()
                    if (!subtitle.isNullOrBlank()) {
                        Text(
                            text = subtitle,
                            fontSize = 12.sp,
                            color = Color(0xFF5F6B7A),
                            modifier = Modifier.padding(top = 6.dp)
                        )
                    }
                }
            }
        }
        return
    }

    Column(modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
        items.forEachIndexed { idx, item ->
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        item.on.forEach { exec ->
                            runtime.execute(exec, null, mapOf("windowId" to window.windowId))
                        }
                    }
                    .padding(horizontal = 12.dp, vertical = 12.dp)
            ) {
                Row(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = item.label ?: item.id.orEmpty(),
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp,
                        color = Color(0xFF111111)
                    )
                }
                val subtitle = item.properties["subtitle"].asString()
                if (!subtitle.isNullOrBlank()) {
                    Text(
                        text = subtitle,
                        fontSize = 13.sp,
                        color = Color(0xFF6B6B6B),
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
            if (idx < items.size - 1) {
                Divider(color = Color(0xFFE6E6E6))
            }
        }
    }
}

private fun parseColor(value: String?): Color? {
    if (value.isNullOrBlank()) return null
    return try {
        Color(android.graphics.Color.parseColor(value))
    } catch (_: IllegalArgumentException) {
        null
    }
}

private fun JsonElement?.asString(): String? {
    return (this as? JsonPrimitive)?.contentOrNull
}

package com.viant.forgeandroid.ui
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.ItemDef
import com.viant.forgeandroid.runtime.WindowContext
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

@Composable
fun MenuListRenderer(
    runtime: ForgeRuntime,
    window: WindowContext,
    container: ContainerDef,
    items: List<ItemDef>,
    baseContext: DataSourceContext? = null
) {
    val visibleItems = items.filter(::shouldRenderItem)
    if (visibleItems.isEmpty()) return

    val useTiles = visibleItems.any { it.properties["tile"].asString() == "true" }
    val useSummaryCards = visibleItems.size >= 2 && visibleItems.all(::isSummaryLabelItem)

    when {
        useTiles -> TileList(runtime, window, visibleItems)
        useSummaryCards -> SummaryList(window, baseContext, container, visibleItems)
        else -> PlainList(runtime, window, baseContext, container, visibleItems)
    }
}

@Composable
private fun TileList(
    runtime: ForgeRuntime,
    window: WindowContext,
    items: List<ItemDef>
) {
    StaticGrid(
        items = items,
        minCellWidth = 220.dp,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) { item ->
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

@Composable
private fun SummaryList(
    window: WindowContext,
    baseContext: DataSourceContext?,
    container: ContainerDef,
    items: List<ItemDef>
) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxWidth()
            .padding(8.dp)
    ) {
        if (maxWidth < 340.dp) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items.forEach { item ->
                    val dataContext = resolveMenuListContext(window, baseContext, container, item)
                    val windowFormSignal = window.windowFormSignal()
                    val windowForm by windowFormSignal.flow.collectAsState(initial = windowFormSignal.peek())
                    val form by if (dataContext != null) {
                        dataContext.form.flow.collectAsState(initial = dataContext.form.peek())
                    } else {
                        androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(emptyMap()) }
                    }
                    val metrics by if (dataContext != null) {
                        dataContext.metrics.flow.collectAsState(initial = dataContext.metrics.peek())
                    } else {
                        androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(emptyMap()) }
                    }
                    val key = item.dataField ?: item.bindingPath ?: item.id ?: return@forEach
                    val value = resolveItemValue(item, key, form, metrics, windowForm)
                    SummaryCard(item.label ?: key, value)
                }
            }
        } else {
            StaticGrid(
                items = items,
                minCellWidth = 180.dp,
                modifier = Modifier.fillMaxWidth()
            ) { item ->
                val dataContext = resolveMenuListContext(window, baseContext, container, item)
                val windowFormSignal = window.windowFormSignal()
                val windowForm by windowFormSignal.flow.collectAsState(initial = windowFormSignal.peek())
                val form by if (dataContext != null) {
                    dataContext.form.flow.collectAsState(initial = dataContext.form.peek())
                } else {
                    androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(emptyMap()) }
                }
                val metrics by if (dataContext != null) {
                    dataContext.metrics.flow.collectAsState(initial = dataContext.metrics.peek())
                } else {
                    androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(emptyMap()) }
                }
                val key = item.dataField ?: item.bindingPath ?: item.id ?: return@StaticGrid
                val value = resolveItemValue(item, key, form, metrics, windowForm)
                SummaryCard(item.label ?: key, value)
            }
        }
    }
}

@Composable
private fun PlainList(
    runtime: ForgeRuntime,
    window: WindowContext,
    baseContext: DataSourceContext?,
    container: ContainerDef,
    items: List<ItemDef>
) {
    Column(modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
        items.forEachIndexed { idx, item ->
            val dataContext = resolveMenuListContext(window, baseContext, container, item)
            val windowFormSignal = window.windowFormSignal()
            val windowForm by windowFormSignal.flow.collectAsState(initial = windowFormSignal.peek())
            val form by if (dataContext != null) {
                dataContext.form.flow.collectAsState(initial = dataContext.form.peek())
            } else {
                androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(emptyMap()) }
            }
            val metrics by if (dataContext != null) {
                dataContext.metrics.flow.collectAsState(initial = dataContext.metrics.peek())
            } else {
                androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(emptyMap()) }
            }
            val key = item.dataField ?: item.bindingPath ?: item.id ?: ""
            val value = if (key.isNotBlank()) resolveItemValue(item, key, form, metrics, windowForm) else ""

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        val args = mapOf("windowId" to window.windowId)
                        if (item.on.isNotEmpty()) {
                            item.on.forEach { exec ->
                                runtime.execute(exec, dataContext, args)
                            }
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
                val subtitle = item.properties["subtitle"].asString()?.ifBlank { value.ifBlank { null } }
                    ?: value.ifBlank { null }
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
                HorizontalDivider(color = Color(0xFFE6E6E6))
            }
        }
    }
}

@Composable
private fun SummaryCard(label: String, value: String) {
    Surface(
        tonalElevation = 1.dp,
        shadowElevation = 1.dp,
        shape = MaterialTheme.shapes.large,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp)
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = value.ifBlank { "—" },
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(top = 6.dp)
            )
        }
    }
}

private fun resolveMenuListContext(
    window: WindowContext,
    baseContext: DataSourceContext?,
    container: ContainerDef,
    item: ItemDef
): DataSourceContext? {
    val direct = item.dataSourceRef?.trim().orEmpty().takeIf { it.isNotEmpty() }
    val mapped = if (direct == null && item.dataSourceRefs.isNotEmpty()) {
        val source = item.dataSourceRefSource?.trim().orEmpty().ifBlank { "windowForm" }
        val selector = item.dataSourceRefSelector?.trim().orEmpty()
        val key = when (source.lowercase()) {
            "windowform" -> com.viant.forgeandroid.runtime.SelectorUtil.resolve(window.peekWindowForm(), selector)?.toString()
            else -> null
        }?.trim().orEmpty()
        item.dataSourceRefs[key] ?: item.dataSourceRefs.values.firstOrNull()
    } else {
        null
    }
    val ref = direct
        ?: mapped
        ?: container.dataSourceRef?.trim().orEmpty().ifBlank { null }
        ?: baseContext?.dataSourceRef
    return when {
        ref.isNullOrBlank() -> baseContext
        baseContext?.dataSourceRef == ref -> baseContext
        else -> window.contextOrNull(ref)
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

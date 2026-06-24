package com.viant.forgeandroid.ui
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.ItemDef
import com.viant.forgeandroid.runtime.LinkDef
import com.viant.forgeandroid.runtime.SelectorUtil
import com.viant.forgeandroid.runtime.WindowContext
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.longOrNull

@Composable
fun MenuListRenderer(
    runtime: ForgeRuntime,
    window: WindowContext,
    container: ContainerDef,
    items: List<ItemDef>,
    baseContext: DataSourceContext? = null
) {
    val windowFormSignal = window.windowFormSignal()
    val windowForm by windowFormSignal.flow.collectAsState(initial = windowFormSignal.peek())
    val baseMetrics by if (baseContext != null) {
        baseContext.metrics.flow.collectAsState(initial = baseContext.metrics.peek())
    } else {
        androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(emptyMap()) }
    }
    val baseRows by if (baseContext != null) {
        baseContext.collection.flow.collectAsState(initial = baseContext.collection.peek())
    } else {
        androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(emptyList()) }
    }
    val relevantContexts = remember(
        window.windowId,
        baseContext?.dataSourceRef,
        container.dataSourceRef,
        items,
        windowForm
    ) {
        items.mapNotNull { item ->
            resolveMenuListContext(window, baseContext, container, item)
        }.distinctBy { it.dataSourceRef }
    }
    LaunchedEffect(
        relevantContexts.map { it.dataSourceRef }.sorted().joinToString("|"),
        windowForm.toString()
    ) {
        relevantContexts.forEach { context ->
            val dependsOnBaseMetrics = baseContext != null && dataSourceDependsOnMetricsContext(
                context.dataSource,
                baseContext.dataSourceRef
            )
            val baseReady = baseMetrics.isNotEmpty() || baseRows.isNotEmpty()
            if (context.dataSource.autoFetch != false && (!dependsOnBaseMetrics || baseReady)) {
                context.fetchCollection()
            }
        }
    }
    val upstreamContextNeedsFollowUpFetch = remember(baseContext?.dataSourceRef, relevantContexts) {
        val upstreamRef = baseContext?.dataSourceRef?.trim().orEmpty()
        upstreamRef.isNotEmpty() && relevantContexts.none { it.dataSourceRef == upstreamRef }
    }
    val upstreamSignature = remember(baseMetrics, baseRows) {
        buildString {
            append(baseMetrics.toString())
            append('#')
            append(baseRows.toString())
        }
    }
    LaunchedEffect(upstreamContextNeedsFollowUpFetch, upstreamSignature) {
        if (!upstreamContextNeedsFollowUpFetch) {
            return@LaunchedEffect
        }
        val upstreamReady = baseMetrics.isNotEmpty() || baseRows.isNotEmpty()
        if (!upstreamReady) {
            return@LaunchedEffect
        }
        relevantContexts.forEach { context ->
            if (context.dataSource.autoFetch != false) {
                context.fetchCollection()
            }
        }
    }
    val visibleItems = items.filter(::shouldRenderItem)
    if (visibleItems.isEmpty()) return

    val useTiles = visibleItems.any { it.properties["tile"].asString() == "true" }
    val useSummaryCards = visibleItems.size >= 2 && visibleItems.all(::isSummaryLabelItem)
    val useInlineRow = visibleItems.isNotEmpty() && visibleItems.all {
        it.appearance?.trim()?.lowercase().orEmpty() == "inline"
    }

    when {
        useTiles -> TileList(runtime, window, visibleItems)
        useInlineRow -> InlineList(runtime, window, baseContext, container, visibleItems)
        useSummaryCards -> SummaryList(window, baseContext, container, visibleItems)
        else -> PlainList(runtime, window, baseContext, container, visibleItems)
    }
}

private fun dataSourceDependsOnMetricsContext(
    dataSource: com.viant.forgeandroid.runtime.DataSourceDef,
    baseDataSourceRef: String
): Boolean {
    val normalizedBaseRef = baseDataSourceRef.trim()
    if (normalizedBaseRef.isEmpty()) {
        return false
    }
    return dataSource.parameters.any { parameter ->
        val source = ((parameter.from ?: "").ifBlank { parameter.input ?: "" }).trim().lowercase()
        if (source != "metrics") {
            return@any false
        }
        val location = parameter.location?.trim().orEmpty()
        location.startsWith("$normalizedBaseRef.")
    }
}

@Composable
private fun InlineList(
    runtime: ForgeRuntime,
    window: WindowContext,
    baseContext: DataSourceContext?,
    container: ContainerDef,
    items: List<ItemDef>
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items.forEach { item ->
            InlineItem(runtime, window, baseContext, container, item)
        }
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
            val subtitle = item.subtitle?.trim()?.takeIf { it.isNotEmpty() }
                ?: item.properties["subtitle"].asString()
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
                    val rows by if (dataContext != null) {
                        dataContext.collection.flow.collectAsState(initial = dataContext.collection.peek())
                    } else {
                        androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(emptyList()) }
                    }
                    val key = itemValueKey(item) ?: return@forEach
                    if (isItemVisible(item, form, metrics, windowForm, rows)) {
                        val value = resolveItemValue(item, key, form, metrics, windowForm, rows)
                        SummaryCard(item.label ?: key, value)
                    }
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
                val rows by if (dataContext != null) {
                    dataContext.collection.flow.collectAsState(initial = dataContext.collection.peek())
                } else {
                    androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(emptyList()) }
                }
                val key = itemValueKey(item) ?: return@StaticGrid
                if (isItemVisible(item, form, metrics, windowForm, rows)) {
                    val value = resolveItemValue(item, key, form, metrics, windowForm, rows)
                    SummaryCard(item.label ?: key, value)
                }
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
            val rows by if (dataContext != null) {
                dataContext.collection.flow.collectAsState(initial = dataContext.collection.peek())
            } else {
                androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(emptyList()) }
            }
            if (!isItemVisible(item, form, metrics, windowForm, rows)) {
                return@forEachIndexed
            }
            val key = itemValueKey(item) ?: ""
            val value = if (key.isNotBlank()) resolveItemValue(item, key, form, metrics, windowForm, rows) else ""
            val rawValue = if (key.isNotBlank()) resolveItemRawValue(item, key, form, metrics, windowForm, rows) else null

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        if (item.type?.trim()?.lowercase() == "link" && item.link != null) {
                            openLinkedWindow(runtime, window, item, form, metrics, windowForm, rawValue)
                        } else if (item.on.isNotEmpty()) {
                            val args = mapOf("windowId" to window.windowId)
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
                        color = if (item.type?.trim()?.lowercase() == "link") Color(0xFF175CD3) else Color(0xFF111111)
                    )
                }
                val subtitle = item.subtitle?.trim()?.takeIf { it.isNotEmpty() }
                    ?: item.properties["subtitle"].asString()?.ifBlank { normalizeValue(value).ifBlank { null } }
                    ?: normalizeValue(value).ifBlank { null }
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
private fun InlineItem(
    runtime: ForgeRuntime,
    window: WindowContext,
    baseContext: DataSourceContext?,
    container: ContainerDef,
    item: ItemDef
) {
    val dataContext = resolveMenuListContext(window, baseContext, container, item)
    val uriHandler = LocalUriHandler.current
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
    val rows by if (dataContext != null) {
        dataContext.collection.flow.collectAsState(initial = dataContext.collection.peek())
    } else {
        androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(emptyList()) }
    }
    if (!isItemVisible(item, form, metrics, windowForm, rows)) {
        return
    }
    val key = itemValueKey(item) ?: ""
    val rawValue = if (key.isNotBlank()) resolveItemRawValue(item, key, form, metrics, windowForm, rows) else null
    val value = normalizeValue(rawValue?.toString().orEmpty())

    Surface(
        shape = RoundedCornerShape(999.dp),
        color = if (item.type?.trim()?.lowercase() == "link") Color(0xFFE8F1FF) else Color(0xFFF2F4F7),
        modifier = Modifier.clickable {
            if (item.type?.trim()?.lowercase() == "link" && item.link != null) {
                val href = item.link.href?.trim().orEmpty()
                if (href.isNotEmpty()) {
                    uriHandler.openUri(href)
                } else {
                    openLinkedWindow(runtime, window, item, form, metrics, windowForm, rawValue)
                }
            }
        }
    ) {
        Text(
            text = value.ifBlank { item.label ?: item.id.orEmpty() },
            color = if (item.type?.trim()?.lowercase() == "link") Color(0xFF175CD3) else Color(0xFF475467),
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
        )
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
                text = normalizeValue(value),
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

private fun openLinkedWindow(
    runtime: ForgeRuntime,
    window: WindowContext,
    item: ItemDef,
    form: Map<String, Any?>,
    metrics: Map<String, Any?>,
    windowForm: Map<String, Any?>,
    rawValue: Any?
) {
    val link = item.link ?: return
    val windowKey = link.windowKey?.trim().orEmpty()
    if (windowKey.isEmpty()) {
        return
    }
    val resolutionContext = LinkResolutionContext(
        row = emptyMap(),
        value = rawValue,
        form = form,
        metrics = metrics,
        windowForm = windowForm
    )
    openResolvedWindowLink(
        runtime = runtime,
        window = window,
        link = WindowLinkTarget(
            windowKey = windowKey,
            title = resolveLinkWindowTitleFromContext(
                link = link,
                context = resolutionContext,
                fallbackTitle = item.label?.takeIf { it.isNotBlank() }
                    ?: rawValue?.toString()?.takeIf { it.isNotBlank() }
                    ?: windowKeyFallback(link)
            ),
            parameters = resolveLinkParametersFromContext(link, resolutionContext),
            inTab = link.inTab != false,
            modal = link.modal == true,
            newInstance = link.newInstance == true
        )
    )
}

private fun windowKeyFallback(link: LinkDef): String {
    return link.windowKey?.trim().orEmpty().ifBlank { "window" }
}

private fun isItemVisible(
    item: ItemDef,
    form: Map<String, Any?>,
    metrics: Map<String, Any?>,
    windowForm: Map<String, Any?>,
    rows: List<Map<String, Any?>>
): Boolean {
    val condition = item.visibleWhen ?: return true
    val selector = condition.selector?.takeIf { it.isNotBlank() }
        ?: condition.field?.takeIf { it.isNotBlank() }
        ?: condition.key?.takeIf { it.isNotBlank() }
    val actual = when (condition.source?.trim()?.lowercase()) {
        "windowform" -> if (selector == null) windowForm else SelectorUtil.resolve(windowForm, selector)
        "form" -> if (selector == null) form else SelectorUtil.resolve(form, selector)
        "metrics" -> if (selector == null) {
            if (metrics.isNotEmpty()) metrics else rows.firstOrNull().orEmpty()
        } else {
            SelectorUtil.resolve(metrics, selector) ?: SelectorUtil.resolve(rows.firstOrNull().orEmpty(), selector)
        }
        else -> if (selector == null) metrics else SelectorUtil.resolve(metrics, selector)
    }
    condition.whenValue?.let { if (!jsonMatches(actual, it)) return false }
    condition.equals?.let { if (!jsonMatches(actual, it)) return false }
    condition.notEquals?.let { if (jsonMatches(actual, it)) return false }
    if (condition.inValues.isNotEmpty() && condition.inValues.none { jsonMatches(actual, it) }) return false
    condition.gt?.let { if ((actual as? Number)?.toDouble()?.let { value -> value > it } != true) return false }
    condition.gte?.let { if ((actual as? Number)?.toDouble()?.let { value -> value >= it } != true) return false }
    condition.lt?.let { if ((actual as? Number)?.toDouble()?.let { value -> value < it } != true) return false }
    condition.lte?.let { if ((actual as? Number)?.toDouble()?.let { value -> value <= it } != true) return false }
    condition.empty?.let { required ->
        val empty = when (actual) {
            null -> true
            is String -> actual.isBlank()
            is Collection<*> -> actual.isEmpty()
            is Map<*, *> -> actual.isEmpty()
            else -> false
        }
        if (empty != required) return false
    }
    condition.notEmpty?.let { required ->
        val present = when (actual) {
            null -> false
            is String -> actual.isNotBlank()
            is Collection<*> -> actual.isNotEmpty()
            is Map<*, *> -> actual.isNotEmpty()
            else -> true
        }
        if (present != required) return false
    }
    return true
}

private fun jsonMatches(actual: Any?, expected: JsonElement): Boolean {
    return when (expected) {
        JsonNull -> actual == null
        is JsonPrimitive -> when {
            expected.isString -> actual?.toString() == expected.content
            expected.booleanOrNull != null -> actual == expected.booleanOrNull
            expected.longOrNull != null -> (actual as? Number)?.toLong() == expected.longOrNull
            expected.doubleOrNull != null -> (actual as? Number)?.toDouble() == expected.doubleOrNull
            else -> actual?.toString() == expected.content
        }
        is JsonObject -> actual == jsonElementToAny(expected)
        else -> actual == jsonElementToAny(expected)
    }
}

private fun jsonElementToAny(value: JsonElement): Any? {
    return when (value) {
        is kotlinx.serialization.json.JsonObject -> value.mapValues { (_, entry) -> jsonElementToAny(entry) }
        is kotlinx.serialization.json.JsonArray -> value.map { jsonElementToAny(it) }
        is JsonPrimitive -> {
            if (value.isString) value.contentOrNull
            else value.booleanOrNull ?: value.longOrNull ?: value.doubleOrNull ?: value.contentOrNull
        }
        else -> null
    }
}

private fun normalizeValue(value: String): String {
    return if (isPlaceholderValue(value)) "No data" else value
}

private fun isPlaceholderValue(value: String): Boolean {
    val normalized = value.trim().lowercase()
    return normalized.isEmpty() || normalized in setOf("-", "—", "/", "n/a", "na", "null")
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

package com.viant.forgeandroid.ui

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.automirrored.filled.ShowChart
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.ChartAxisDef
import com.viant.forgeandroid.runtime.ChartDef
import com.viant.forgeandroid.runtime.ChartSeriesDef
import com.viant.forgeandroid.runtime.ChartValueOption
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.JsonUtil
import com.viant.forgeandroid.runtime.ReportBuilderChartSpecDef
import com.viant.forgeandroid.runtime.ReportBuilderDimensionDef
import com.viant.forgeandroid.runtime.ReportBuilderMeasureDef
import com.viant.forgeandroid.runtime.ReportBuilderStaticFilterDef
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.time.LocalDate

private const val REPORT_BUILDER_PRESET_STORAGE = "forge_report_builder_presets"

@Serializable
private data class StoredReportBuilderChartPreset(
    val title: String,
    val settingsHash: String,
    val chartSpec: ReportBuilderChartSpecDef,
    val updatedAt: Long
)

@Serializable
private data class StoredReportBuilderState(
    val selectedMeasures: List<String> = emptyList(),
    val selectedDimensions: List<String> = emptyList(),
    val chartSpec: ReportBuilderChartSpecDef? = null,
    val viewMode: String = "table",
    val staticFilters: Map<String, StoredStaticFilterValue> = emptyMap(),
    val dynamicFilterValues: Map<String, String> = emptyMap(),
    val activeDynamicFilterKeys: List<String> = emptyList()
)

@Serializable
private sealed class StoredStaticFilterValue {
    @Serializable
    data class ListValue(val values: List<String>) : StoredStaticFilterValue()

    @Serializable
    data class DateRangeValue(val start: String, val end: String) : StoredStaticFilterValue()
}

private data class AggregatedRow(
    val values: Map<String, Any?>
)

@Composable
fun ReportBuilderRenderer(
    window: com.viant.forgeandroid.runtime.WindowContext,
    container: ContainerDef
) {
    val config = container.dashboard?.reportBuilder
    if (config == null) {
        ReportBuilderPlaceholder(container, "Missing report builder config")
        return
    }
    val dataSourceRef = container.dataSourceRef
    if (dataSourceRef.isNullOrBlank()) {
        ReportBuilderPlaceholder(container, "Missing dataSourceRef")
        return
    }
    val context = window.contextOrNull(dataSourceRef) ?: run {
        ReportBuilderPlaceholder(container, "Missing data source context")
        return
    }
    val rows by context.collection.flow.collectAsState(initial = emptyList())
    LaunchedEffect(dataSourceRef) {
        context.fetchCollection()
    }

    val visibleMeasures = remember(config) { config.measures.filter { it.hidden != true } }
    val visibleDimensions = remember(config) { config.dimensions.filter { it.hidden != true } }
    var selectedMeasures by remember(config) { mutableStateOf(defaultMeasureKeys(visibleMeasures)) }
    var selectedDimensions by remember(config) { mutableStateOf(defaultDimensionKeys(visibleDimensions)) }
    var chartSpec by remember { mutableStateOf<ReportBuilderChartSpecDef?>(null) }
    var viewMode by remember(config) { mutableStateOf(if (config.result?.chartCreationMode == "explicit") "table" else (config.result?.defaultMode ?: "chart")) }
    var previousMenuExpanded by remember { mutableStateOf(false) }
    var staticFilters by remember(config) { mutableStateOf(defaultStaticFilters(config.staticFilters)) }
    var dynamicFilterValues by remember(config) { mutableStateOf(emptyMap<String, String>()) }
    var dynamicFilterDrafts by remember(config) { mutableStateOf(emptyMap<String, String>()) }
    var activeDynamicFilterKeys by remember(config) { mutableStateOf(defaultDynamicFilterKeys()) }
    val settingsHash = remember(selectedDimensions, selectedMeasures) { buildSettingsHash(selectedDimensions, selectedMeasures) }
    val requestPayload = remember(config, selectedMeasures, selectedDimensions, staticFilters, dynamicFilterValues) {
        buildReportBuilderRequestPayload(config, selectedMeasures, selectedDimensions, staticFilters, dynamicFilterValues)
    }
    val preferences = LocalContext.current.getSharedPreferences(REPORT_BUILDER_PRESET_STORAGE, Context.MODE_PRIVATE)
    val stateStorageKey = "reportBuilder.state.${container.id ?: "reportBuilder"}"
    var storedPresets by remember(settingsHash, container.id) {
        mutableStateOf(loadStoredPresets(preferences, container.id ?: "reportBuilder").filter { it.settingsHash == settingsHash })
    }
    var restoredStoredState by remember { mutableStateOf(false) }

    val filteredRows = remember(rows, staticFilters, config.staticFilters) {
        applyStaticFilters(rows, config.staticFilters, staticFilters)
    }
    val aggregatedRows = remember(filteredRows, selectedDimensions, selectedMeasures) {
        aggregateRows(filteredRows, selectedDimensions, selectedMeasures)
    }

    val currentChartSpec = chartSpec
    val chartRows = remember(aggregatedRows, currentChartSpec) {
        buildChartRows(aggregatedRows, currentChartSpec)
    }
    val chartDef = remember(aggregatedRows, currentChartSpec) {
        buildChartDef(aggregatedRows, currentChartSpec)
    }

    LaunchedEffect(Unit) {
        if (!restoredStoredState) {
            loadStoredState(preferences, stateStorageKey)?.let { state ->
                selectedMeasures = state.selectedMeasures
                selectedDimensions = state.selectedDimensions
                chartSpec = state.chartSpec
                viewMode = state.viewMode
                staticFilters = state.staticFilters.mapValues { it.value.toRuntimeValue() }
                dynamicFilterValues = state.dynamicFilterValues
                activeDynamicFilterKeys = state.activeDynamicFilterKeys
            }
            restoredStoredState = true
        }
    }

    LaunchedEffect(requestPayload) {
        if (requestPayload.isNotEmpty()) {
            context.setInputParameters(requestPayload, fetch = true)
        }
    }
    LaunchedEffect(selectedMeasures, selectedDimensions, chartSpec, viewMode, staticFilters, dynamicFilterValues, activeDynamicFilterKeys) {
        saveStoredState(
            preferences,
            stateStorageKey,
            StoredReportBuilderState(
                selectedMeasures = selectedMeasures,
                selectedDimensions = selectedDimensions,
                chartSpec = chartSpec,
                viewMode = viewMode,
                staticFilters = staticFilters.mapValues { runtime ->
                    when (val value = runtime.value) {
                        is List<*> -> StoredStaticFilterValue.ListValue(value.map { it.toString() })
                        is Map<*, *> -> StoredStaticFilterValue.DateRangeValue(
                            start = value["start"]?.toString().orEmpty(),
                            end = value["end"]?.toString().orEmpty()
                        )
                        else -> StoredStaticFilterValue.ListValue(emptyList())
                    }
                },
                dynamicFilterValues = dynamicFilterValues,
                activeDynamicFilterKeys = activeDynamicFilterKeys
            )
        )
    }

    fun applyChart(next: ReportBuilderChartSpecDef, persist: Boolean = true) {
        chartSpec = normalizeChartSpec(next)
        viewMode = "chart"
        if (persist) {
            val updated = upsertPreset(
                loadStoredPresets(preferences, container.id ?: "reportBuilder"),
                StoredReportBuilderChartPreset(
                    title = next.title ?: generatedTitle(next, visibleMeasures, visibleDimensions),
                    settingsHash = settingsHash,
                    chartSpec = normalizeChartSpec(next),
                    updatedAt = System.currentTimeMillis()
                )
            )
            saveStoredPresets(preferences, container.id ?: "reportBuilder", updated)
            storedPresets = updated.filter { it.settingsHash == settingsHash }
        }
    }

    ReportBuilderPanel(container) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            ChipSection(
                title = "Measures",
                items = visibleMeasures.map { reportBuilderMeasureLabel(it) to reportBuilderMeasureKey(it) },
                selected = selectedMeasures,
                onToggle = { key ->
                    selectedMeasures = toggleKey(selectedMeasures, key).ifEmpty { listOf(key) }
                }
            )
            ChipSection(
                title = "Breakdowns",
                items = visibleDimensions.map { reportBuilderDimensionLabel(it) to reportBuilderDimensionKey(it) },
                selected = selectedDimensions,
                onToggle = { key ->
                    selectedDimensions = toggleKey(selectedDimensions, key).ifEmpty { listOf(key) }
                }
            )
            StaticFilterSection(config.staticFilters, staticFilters) { key, value ->
                staticFilters = staticFilters.toMutableMap().apply { put(key, value) }
            }
            DynamicFilterBridgeSection(
                groups = config.dynamicFilterGroups,
                families = config.dynamicFilterFamilies,
                activeKeys = activeDynamicFilterKeys,
                values = dynamicFilterValues,
                drafts = dynamicFilterDrafts,
                onAddFilter = { key ->
                    activeDynamicFilterKeys = (activeDynamicFilterKeys + key).distinct()
                },
                onRemoveFilter = { key ->
                    activeDynamicFilterKeys = activeDynamicFilterKeys.filterNot { it == key }
                    dynamicFilterValues = dynamicFilterValues.toMutableMap().apply { remove(key) }
                    dynamicFilterDrafts = dynamicFilterDrafts.toMutableMap().apply { remove(key) }
                },
                onDraftChange = { key, value ->
                    dynamicFilterDrafts = dynamicFilterDrafts.toMutableMap().apply { put(key, value) }
                },
                onChange = { key, value ->
                    dynamicFilterValues = dynamicFilterValues.toMutableMap().apply { put(key, value) }
                }
            )

            if (config.result?.chartCreationMode == "explicit" && chartSpec == null) {
                ChartTile(
                    title = "Create a chart from this table",
                    description = "Create a chart from the currently selected dimensions and measures.",
                    onCreate = {
                        quickChartSpec(visibleMeasures, visibleDimensions, selectedMeasures, selectedDimensions)?.let { applyChart(it) }
                    },
                    defaults = config.result.defaultChartSpecs,
                    onDefault = { applyChart(it) },
                    previous = storedPresets,
                    expanded = previousMenuExpanded,
                    onExpandedChange = { previousMenuExpanded = it },
                    onPrevious = { applyChart(it.chartSpec, persist = false) }
                )
            }

            if (chartSpec != null) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { viewMode = "table" }) { Text("Table") }
                    OutlinedButton(onClick = { viewMode = "chart" }) { Text("Chart") }
                    OutlinedButton(onClick = {
                        chartSpec = null
                        viewMode = "table"
                    }) {
                        Icon(Icons.Filled.Delete, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Remove Chart")
                    }
                }
            }

            if (viewMode == "chart" && chartSpec != null && chartDef != null) {
                ChartRenderer(chartRows, chartDef)
            } else {
                SimpleReportTable(aggregatedRows, selectedDimensions + selectedMeasures)
            }
        }
    }
}

@Composable
private fun DynamicFilterBridgeSection(
    groups: List<com.viant.forgeandroid.runtime.ReportBuilderDynamicFilterGroupDef>,
    families: List<com.viant.forgeandroid.runtime.ReportBuilderDynamicFilterFamilyDef>,
    activeKeys: List<String>,
    values: Map<String, String>,
    drafts: Map<String, String>,
    onAddFilter: (String) -> Unit,
    onRemoveFilter: (String) -> Unit,
    onDraftChange: (String, String) -> Unit,
    onChange: (String, String) -> Unit
) {
    if (groups.isEmpty() && families.isEmpty()) return
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFFFAFBFD)),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text("Advanced filters", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Text(
                "This builder includes dynamic filter groups and families. The native SDK now decodes this contract, but interactive row-based filter editing is still being bridged.",
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFF6A7280)
            )
            if (families.isNotEmpty()) {
                families.forEach { family ->
                    DynamicFilterFamilyCard(
                        family = family,
                        groups = groups,
                        activeKeys = activeKeys,
                        values = values,
                        drafts = drafts,
                        onAddFilter = onAddFilter,
                        onRemoveFilter = onRemoveFilter,
                        onDraftChange = onDraftChange,
                        onChange = onChange
                    )
                }
            } else if (groups.isNotEmpty()) {
                groups.forEach { group ->
                    DynamicFilterGroupFields(
                        title = group.label ?: group.id ?: "Group",
                        filters = group.filters,
                        activeKeys = activeKeys,
                        values = values,
                        drafts = drafts,
                        onAddFilter = onAddFilter,
                        onRemoveFilter = onRemoveFilter,
                        onDraftChange = onDraftChange,
                        onChange = onChange
                    )
                }
            }
        }
    }
}

@Composable
private fun DynamicFilterFamilyCard(
    family: com.viant.forgeandroid.runtime.ReportBuilderDynamicFilterFamilyDef,
    groups: List<com.viant.forgeandroid.runtime.ReportBuilderDynamicFilterGroupDef>,
    activeKeys: List<String>,
    values: Map<String, String>,
    drafts: Map<String, String>,
    onAddFilter: (String) -> Unit,
    onRemoveFilter: (String) -> Unit,
    onDraftChange: (String, String) -> Unit,
    onChange: (String, String) -> Unit
) {
    val includeFilters = groups.flatMap { it.filters }.filter { family.includeFilterIds.contains(it.id) }
    val excludeFilters = groups.flatMap { it.filters }.filter { family.excludeFilterIds.contains(it.id) }
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(family.label ?: family.id ?: "Family", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
            family.description?.takeIf { it.isNotBlank() }?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = Color(0xFF6A7280))
            }
            if (includeFilters.isNotEmpty()) {
                DynamicFilterGroupFields("Include", includeFilters, activeKeys, values, drafts, onAddFilter, onRemoveFilter, onDraftChange, onChange)
            }
            if (excludeFilters.isNotEmpty()) {
                DynamicFilterGroupFields("Exclude", excludeFilters, activeKeys, values, drafts, onAddFilter, onRemoveFilter, onDraftChange, onChange)
            }
        }
    }
}

@Composable
private fun DynamicFilterGroupFields(
    title: String,
    filters: List<com.viant.forgeandroid.runtime.ReportBuilderDynamicFilterDef>,
    activeKeys: List<String>,
    values: Map<String, String>,
    drafts: Map<String, String>,
    onAddFilter: (String) -> Unit,
    onRemoveFilter: (String) -> Unit,
    onDraftChange: (String, String) -> Unit,
    onChange: (String, String) -> Unit
) {
    var menuExpanded by remember(title, filters) { mutableStateOf(false) }
    val activeFilters = filters.filter { activeKeys.contains(it.id) }
    val availableFilters = filters.filterNot { activeKeys.contains(it.id) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.labelMedium, color = Color(0xFF607080), modifier = Modifier.weight(1f))
            if (availableFilters.isNotEmpty()) {
                Box {
                    OutlinedButton(onClick = { menuExpanded = !menuExpanded }) {
                        Icon(Icons.Filled.Add, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Add line")
                    }
                    DropdownMenu(expanded = menuExpanded, onDismissRequest = { menuExpanded = false }) {
                        availableFilters.forEach { filter ->
                            DropdownMenuItem(
                                text = { Text(filter.label ?: filter.id ?: "Filter") },
                                onClick = {
                                    menuExpanded = false
                                    filter.id?.let(onAddFilter)
                                }
                            )
                        }
                    }
                }
            }
        }
        activeFilters.forEach { filter ->
            val filterKey = filter.id ?: return@forEach
            val chips = values[filterKey]
                ?.split(",")
                ?.map { it.trim() }
                ?.filter { it.isNotEmpty() }
                .orEmpty()
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = drafts[filterKey].orEmpty(),
                        onValueChange = { next -> onDraftChange(filterKey, next) },
                        modifier = Modifier.weight(1f),
                        label = { Text(filter.label ?: filterKey) },
                        placeholder = { Text(filter.manualPlaceholder ?: "Comma-separated values") }
                    )
                    Button(
                        onClick = {
                            val next = drafts[filterKey].orEmpty().trim()
                            if (next.isEmpty()) return@Button
                            val merged = (chips + listOf(next)).filter { it.isNotEmpty() }
                            onChange(filterKey, merged.joinToString(", "))
                            onDraftChange(filterKey, "")
                        }
                    ) {
                        Text("Add")
                    }
                    OutlinedButton(onClick = { onRemoveFilter(filterKey) }) {
                        Icon(Icons.Filled.Delete, contentDescription = null)
                    }
                }
                if (chips.isNotEmpty()) {
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        chips.forEach { chip ->
                            AssistChip(
                                onClick = {
                                    val next = chips.filterNot { it == chip }
                                    onChange(filterKey, next.joinToString(", "))
                                },
                                label = { Text(chip) },
                                trailingIcon = { Icon(Icons.Filled.Delete, contentDescription = null) },
                                colors = AssistChipDefaults.assistChipColors(containerColor = Color(0xFFE8F0FF))
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StaticFilterSection(
    filters: List<ReportBuilderStaticFilterDef>,
    state: Map<String, Any?>,
    onChange: (String, Any?) -> Unit
) {
    if (filters.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Filters", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        filters.forEach { filter ->
            val key = filter.id ?: return@forEach
            val type = (filter.type ?: "").trim().lowercase()
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(filter.label ?: key, style = MaterialTheme.typography.labelMedium, color = Color(0xFF6A7280))
                if (type == "daterange") {
                    val current = state[key] as? Map<*, *> ?: emptyMap<String, String>()
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = current["start"]?.toString().orEmpty(),
                            onValueChange = { next ->
                                onChange(key, mapOf("start" to next, "end" to current["end"]?.toString().orEmpty()))
                            },
                            modifier = Modifier.weight(1f),
                            label = { Text("Start") }
                        )
                        OutlinedTextField(
                            value = current["end"]?.toString().orEmpty(),
                            onValueChange = { next ->
                                onChange(key, mapOf("start" to current["start"]?.toString().orEmpty(), "end" to next))
                            },
                            modifier = Modifier.weight(1f),
                            label = { Text("End") }
                        )
                    }
                } else {
                    val selected = (state[key] as? List<*>)?.map { it.toString() } ?: emptyList()
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        filter.options.forEach optionLoop@ { option ->
                            val optionValue = option.value?.toString()?.trim('"') ?: return@optionLoop
                            val optionLabel = option.label ?: optionValue
                            FilterChip(
                                selected = selected.contains(optionValue),
                                onClick = {
                                    val next = if (selected.contains(optionValue)) selected.filterNot { it == optionValue } else selected + optionValue
                                    onChange(key, next)
                                },
                                label = { Text(optionLabel) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ReportBuilderPanel(container: ContainerDef, content: @Composable () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            container.title?.takeIf { it.isNotBlank() }?.let {
                Text(it, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            }
            container.subtitle?.takeIf { it.isNotBlank() }?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, color = Color(0xFF6A7280))
            }
            content()
        }
    }
}

@Composable
private fun ReportBuilderPlaceholder(container: ContainerDef, message: String) {
    ReportBuilderPanel(container) {
        Text(message, color = Color(0xFF6A7280))
    }
}

@Composable
private fun ChipSection(
    title: String,
    items: List<Pair<String, String>>,
    selected: List<String>,
    onToggle: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items.forEach { (label, key) ->
                FilterChip(
                    selected = selected.contains(key),
                    onClick = { onToggle(key) },
                    label = { Text(label) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Color(0xFFE8F0FF)
                    )
                )
            }
        }
    }
}

@Composable
private fun ChartTile(
    title: String,
    description: String,
    onCreate: () -> Unit,
    defaults: List<ReportBuilderChartSpecDef>,
    onDefault: (ReportBuilderChartSpecDef) -> Unit,
    previous: List<StoredReportBuilderChartPreset>,
    expanded: Boolean,
    onExpandedChange: (Boolean) -> Unit,
    onPrevious: (StoredReportBuilderChartPreset) -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FBFF)),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text("Chart", style = MaterialTheme.typography.labelSmall, color = Color(0xFF607080))
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(description, style = MaterialTheme.typography.bodyMedium, color = Color(0xFF4C6172))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onCreate) {
                    Icon(Icons.Filled.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Create Chart")
                }
                Box {
                    OutlinedButton(onClick = { onExpandedChange(!expanded) }) {
                        Text("Previous")
                        Icon(Icons.Filled.ArrowDropDown, contentDescription = null)
                    }
                    DropdownMenu(expanded = expanded, onDismissRequest = { onExpandedChange(false) }) {
                        if (previous.isEmpty()) {
                            DropdownMenuItem(text = { Text("No matching saved charts") }, onClick = {})
                        } else {
                            previous.forEach { preset ->
                                DropdownMenuItem(
                                    text = { Text(preset.title) },
                                    onClick = {
                                        onExpandedChange(false)
                                        onPrevious(preset)
                                    }
                                )
                            }
                        }
                    }
                }
            }
            if (defaults.isNotEmpty()) {
                Text("Default charts", style = MaterialTheme.typography.labelMedium, color = Color(0xFF607080))
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    defaults.forEach { spec ->
                        AssistChip(
                            onClick = { onDefault(spec) },
                            label = { Text(spec.title ?: generatedTitle(spec, emptyList(), emptyList())) },
                            leadingIcon = { Icon(Icons.AutoMirrored.Filled.ShowChart, contentDescription = null) },
                            colors = AssistChipDefaults.assistChipColors(containerColor = Color.White)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SimpleReportTable(rows: List<AggregatedRow>, columns: List<String>) {
    if (rows.isEmpty()) {
        Text("No rows", color = Color(0xFF6A7280))
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFFF6F8FB), RoundedCornerShape(12.dp))
                .padding(horizontal = 10.dp, vertical = 8.dp)
        ) {
            columns.forEach { column ->
                Text(
                    text = column,
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.labelMedium,
                    color = Color(0xFF6A7280)
                )
            }
        }
        rows.forEachIndexed { index, row ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(if (index % 2 == 0) Color.White else Color(0xFFFBFDFF), RoundedCornerShape(10.dp))
                    .padding(horizontal = 10.dp, vertical = 10.dp)
            ) {
                columns.forEach { column ->
                    Text(
                        text = formatValue(row.values[column]),
                        modifier = Modifier.weight(1f),
                        style = MaterialTheme.typography.bodyMedium,
                        maxLines = 1
                    )
                }
            }
        }
    }
}

private fun defaultMeasureKeys(measures: List<ReportBuilderMeasureDef>): List<String> {
    val explicit = measures.filter { it.defaultValue == true }.mapNotNull { reportBuilderMeasureKey(it).takeIf(String::isNotBlank) }
    return if (explicit.isNotEmpty()) explicit else measures.firstNotNullOfOrNull { it.key ?: it.id }?.let(::listOf).orEmpty()
}

private fun defaultDimensionKeys(dimensions: List<ReportBuilderDimensionDef>): List<String> {
    val explicit = dimensions.filter { it.defaultValue == true || it.chartAxis == true }.mapNotNull { reportBuilderDimensionKey(it).takeIf(String::isNotBlank) }
    return if (explicit.isNotEmpty()) explicit else dimensions.firstNotNullOfOrNull { it.key ?: it.id }?.let(::listOf).orEmpty()
}

private fun defaultStaticFilters(filters: List<ReportBuilderStaticFilterDef>): Map<String, Any?> {
    val result = linkedMapOf<String, Any?>()
    filters.forEach { filter ->
        val key = filter.id ?: return@forEach
        if ((filter.type ?: "").trim().equals("dateRange", ignoreCase = true)) {
            val raw = JsonUtil.asStringMap(filter.defaultValue)
            result[key] = mapOf(
                "start" to (raw["start"]?.toString() ?: ""),
                "end" to (raw["end"]?.toString() ?: "")
            )
        } else {
            val defaults = filter.options.filter { it.defaultValue == true }.mapNotNull { it.value?.toString()?.trim('"') }
            if (defaults.isNotEmpty()) {
                result[key] = defaults
            }
        }
    }
    return result
}

private fun defaultDynamicFilterKeys(): List<String> {
    return emptyList()
}

private fun reportBuilderMeasureKey(measure: ReportBuilderMeasureDef): String = measure.key ?: measure.id ?: ""
private fun reportBuilderMeasureLabel(measure: ReportBuilderMeasureDef): String = measure.label ?: reportBuilderMeasureKey(measure)
private fun reportBuilderDimensionKey(dimension: ReportBuilderDimensionDef): String = dimension.key ?: dimension.id ?: ""
private fun reportBuilderDimensionLabel(dimension: ReportBuilderDimensionDef): String = dimension.label ?: reportBuilderDimensionKey(dimension)

private fun toggleKey(current: List<String>, key: String): List<String> = if (current.contains(key)) current.filterNot { it == key } else current + key

private fun aggregateRows(rows: List<Map<String, Any?>>, dimensions: List<String>, measures: List<String>): List<AggregatedRow> {
    val grouped = linkedMapOf<String, MutableMap<String, Any?>>()
    rows.forEach { row ->
        val bucket = dimensions.joinToString("||") { row[it]?.toString().orEmpty() }
        val existing = grouped.getOrPut(bucket) { linkedMapOf() }
        dimensions.forEach { existing[it] = row[it] }
        measures.forEach { key ->
            val numeric = (row[key] as? Number)?.toDouble() ?: row[key]?.toString()?.toDoubleOrNull() ?: 0.0
            existing[key] = ((existing[key] as? Double) ?: (existing[key] as? Number)?.toDouble() ?: 0.0) + numeric
        }
    }
    return grouped.values.map { AggregatedRow(it) }
}

private fun quickChartSpec(
    measures: List<ReportBuilderMeasureDef>,
    dimensions: List<ReportBuilderDimensionDef>,
    selectedMeasures: List<String>,
    selectedDimensions: List<String>
): ReportBuilderChartSpecDef? {
    val xField = selectedDimensions.firstOrNull() ?: return null
    val yField = selectedMeasures.firstOrNull() ?: return null
    val seriesField = selectedDimensions.drop(1).firstOrNull()
    return ReportBuilderChartSpecDef(
        title = "${resolveMeasureLabel(yField, measures)} by ${resolveDimensionLabel(xField, dimensions)}",
        type = "line",
        xField = xField,
        yFields = listOf(yField),
        seriesField = seriesField
    )
}

private fun generatedTitle(
    spec: ReportBuilderChartSpecDef,
    measures: List<ReportBuilderMeasureDef>,
    dimensions: List<ReportBuilderDimensionDef>
): String {
    val yField = spec.yFields.firstOrNull().orEmpty()
    val xField = spec.xField.orEmpty()
    return "${resolveMeasureLabel(yField, measures)} by ${resolveDimensionLabel(xField, dimensions)}"
}

private fun resolveMeasureLabel(key: String, measures: List<ReportBuilderMeasureDef>): String =
    measures.firstOrNull { (it.key ?: it.id) == key }?.label ?: key

private fun resolveDimensionLabel(key: String, dimensions: List<ReportBuilderDimensionDef>): String =
    dimensions.firstOrNull { (it.key ?: it.id) == key }?.label ?: key

private fun normalizeChartSpec(spec: ReportBuilderChartSpecDef): ReportBuilderChartSpecDef =
    ReportBuilderChartSpecDef(
        title = spec.title,
        type = (spec.type ?: "line").trim().lowercase(),
        xField = spec.xField,
        yFields = spec.yFields.filter { it.isNotBlank() },
        seriesField = spec.seriesField?.takeIf { it.isNotBlank() }
    )

private fun buildSettingsHash(dimensions: List<String>, measures: List<String>): String {
    val signature = dimensions.joinToString("|") + "::" + measures.joinToString("|")
    var hash = 5381
    signature.forEach { ch ->
        hash = ((hash shl 5) + hash) + ch.code
    }
    return "rb_${hash.toUInt().toString(16)}"
}

private fun buildChartRows(rows: List<AggregatedRow>, chartSpec: ReportBuilderChartSpecDef?): List<Map<String, Any?>> {
    val spec = chartSpec ?: return emptyList()
    val xField = spec.xField ?: return emptyList()
    val yField = spec.yFields.firstOrNull() ?: return emptyList()
    val seriesField = spec.seriesField
    if (seriesField.isNullOrBlank()) {
        return rows.map { row ->
            mapOf(
                xField to row.values[xField].orEmptyString(),
                yField to (row.values[yField] ?: 0.0)
            )
        }
    }
    val grouped = linkedMapOf<String, MutableMap<String, Any?>>()
    rows.forEach { row ->
        val xValue = row.values[xField].orEmptyString()
        val seriesValue = row.values[seriesField].orEmptyString()
        val bucket = grouped.getOrPut(xValue) { linkedMapOf(xField to xValue) }
        bucket[seriesValue] = row.values[yField] ?: 0.0
    }
    return grouped.values.map { it.toMap() }
}

private fun buildReportBuilderRequestPayload(
    config: com.viant.forgeandroid.runtime.DashboardReportBuilderDef,
    selectedMeasures: List<String>,
    selectedDimensions: List<String>,
    staticFilters: Map<String, Any?>,
    dynamicFilterValues: Map<String, String>
): Map<String, Any?> {
    val request = linkedMapOf<String, Any?>()
    selectedMeasures.forEach { key ->
        val measure = config.measures.firstOrNull { reportBuilderMeasureKey(it) == key } ?: return@forEach
        setNestedValue(request, measure.paramPath ?: "measures.$key", true)
    }
    selectedDimensions.forEach { key ->
        val dimension = config.dimensions.firstOrNull { reportBuilderDimensionKey(it) == key } ?: return@forEach
        setNestedValue(request, dimension.paramPath ?: "dimensions.$key", true)
    }
    config.staticFilters.forEach { filter ->
        val key = filter.id ?: return@forEach
        val value = staticFilters[key] ?: return@forEach
        val type = (filter.type ?: "").trim().lowercase()
        if (type == "daterange") {
            val range = value as? Map<*, *> ?: return@forEach
            val start = range["start"]?.toString().orEmpty()
            val end = range["end"]?.toString().orEmpty()
            if (start.isNotBlank()) {
                setNestedValue(request, filter.startParamPath ?: "${filter.paramPath ?: "filters.$key"}.start", start)
            }
            if (end.isNotBlank()) {
                setNestedValue(request, filter.endParamPath ?: "${filter.paramPath ?: "filters.$key"}.end", end)
            }
            return@forEach
        }
        if (value is List<*> && value.isNotEmpty()) {
            setNestedValue(request, filter.paramPath ?: "filters.$key", value)
        }
    }
    config.dynamicFilterGroups.forEach { group ->
        group.filters.forEach filterLoop@ { filter ->
            val filterKey = filter.id ?: return@filterLoop
            val raw = dynamicFilterValues[filterKey]?.trim().orEmpty()
            if (raw.isEmpty()) return@filterLoop
            val parts = raw.split(",").map { it.trim() }.filter { it.isNotEmpty() }
            if (parts.isEmpty()) return@filterLoop
            val mapped: Any? = if (filter.multiple == true) parts else parts.first()
            setNestedValue(request, filter.paramPath ?: "filters.$filterKey", mapped)
        }
    }
    return if (request.isEmpty()) emptyMap() else mapOf("input" to mapOf("query" to request))
}

@Suppress("UNCHECKED_CAST")
private fun setNestedValue(target: MutableMap<String, Any?>, path: String, value: Any?) {
    val parts = path.split('.').map { it.trim() }.filter { it.isNotEmpty() }
    if (parts.isEmpty()) return
    var current: MutableMap<String, Any?> = target
    parts.dropLast(1).forEach { part ->
        val next = current[part] as? MutableMap<String, Any?> ?: linkedMapOf<String, Any?>().also { current[part] = it }
        current = next
    }
    current[parts.last()] = value
}

private fun applyStaticFilters(
    rows: List<Map<String, Any?>>,
    filters: List<ReportBuilderStaticFilterDef>,
    state: Map<String, Any?>
): List<Map<String, Any?>> {
    return rows.filter { row ->
        filters.all { filter ->
            val key = filter.id ?: return@all true
            val type = (filter.type ?: "").trim().lowercase()
            if (type == "daterange") {
                val range = state[key] as? Map<*, *> ?: return@all true
                val start = range["start"]?.toString().orEmpty()
                val end = range["end"]?.toString().orEmpty()
                val eventDate = row["eventDate"]?.toString().orEmpty()
                if (start.isBlank() || end.isBlank() || eventDate.isBlank()) {
                    return@all true
                }
                val date = runCatching { LocalDate.parse(eventDate) }.getOrNull() ?: return@all true
                val from = runCatching { LocalDate.parse(start) }.getOrNull() ?: return@all true
                val to = runCatching { LocalDate.parse(end) }.getOrNull() ?: return@all true
                !date.isBefore(from) && !date.isAfter(to)
            } else {
                val selected = (state[key] as? List<*>)?.map { it.toString() } ?: return@all true
                if (selected.isEmpty()) {
                    return@all true
                }
                val value = row[key]?.toString() ?: return@all true
                selected.contains(value)
            }
        }
    }
}

private fun buildChartDef(rows: List<AggregatedRow>, chartSpec: ReportBuilderChartSpecDef?): ChartDef? {
    val spec = chartSpec ?: return null
    val xField = spec.xField ?: return null
    val yField = spec.yFields.firstOrNull() ?: return null
    val seriesField = spec.seriesField
    val values = if (seriesField.isNullOrBlank()) {
        listOf(ChartValueOption(name = yField, value = yField))
    } else {
        rows.mapNotNull { it.values[seriesField]?.toString() }.distinct().map { value ->
            ChartValueOption(name = value, value = value)
        }
    }
    return ChartDef(
        xAxis = ChartAxisDef(dataKey = xField, label = xField),
        yAxis = com.viant.forgeandroid.runtime.ChartAxisDef(label = yField),
        series = ChartSeriesDef(values = values),
        type = spec.type ?: "line"
    )
}

private fun loadStoredPresets(preferences: android.content.SharedPreferences, key: String): List<StoredReportBuilderChartPreset> {
    val raw = preferences.getString(key, null) ?: return emptyList()
    return runCatching {
        Json.decodeFromString<List<StoredReportBuilderChartPreset>>(raw)
    }.getOrDefault(emptyList())
}

private fun saveStoredPresets(preferences: android.content.SharedPreferences, key: String, presets: List<StoredReportBuilderChartPreset>) {
    preferences.edit().putString(key, Json.encodeToString(presets)).apply()
}

private fun loadStoredState(preferences: android.content.SharedPreferences, key: String): StoredReportBuilderState? {
    val raw = preferences.getString(key, null) ?: return null
    return runCatching {
        Json.decodeFromString<StoredReportBuilderState>(raw)
    }.getOrNull()
}

private fun saveStoredState(
    preferences: android.content.SharedPreferences,
    key: String,
    state: StoredReportBuilderState
) {
    preferences.edit().putString(key, Json.encodeToString(state)).apply()
}

private fun upsertPreset(
    current: List<StoredReportBuilderChartPreset>,
    next: StoredReportBuilderChartPreset
): List<StoredReportBuilderChartPreset> {
    return listOf(next) + current.filterNot {
        it.title == next.title && it.settingsHash == next.settingsHash
    }
}

private fun Any?.orEmptyString(): String = this?.toString().orEmpty()

private fun StoredStaticFilterValue.toRuntimeValue(): Any = when (this) {
    is StoredStaticFilterValue.ListValue -> values
    is StoredStaticFilterValue.DateRangeValue -> mapOf("start" to start, "end" to end)
}

private fun formatValue(value: Any?): String = when (value) {
    null -> "-"
    is Double -> if (value >= 1000.0) String.format("%.1fK", value / 1000.0) else String.format("%.0f", value)
    is Float -> if (value >= 1000f) String.format("%.1fK", value / 1000f) else String.format("%.0f", value)
    is Number -> {
        val numeric = value.toDouble()
        if (numeric >= 1000.0) String.format("%.1fK", numeric / 1000.0) else String.format("%.0f", numeric)
    }
    else -> value.toString()
}

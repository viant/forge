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
import androidx.compose.runtime.rememberCoroutineScope
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
import com.viant.forgeandroid.runtime.ReportBuilderLookupDescriptor
import com.viant.forgeandroid.runtime.ReportBuilderChartSpecDef
import com.viant.forgeandroid.runtime.ReportBuilderDimensionDef
import com.viant.forgeandroid.runtime.ReportBuilderDynamicFilterDef
import com.viant.forgeandroid.runtime.ReportBuilderDynamicFilterGroupDef
import com.viant.forgeandroid.runtime.ReportBuilderMeasureDef
import com.viant.forgeandroid.runtime.ReportBuilderStaticFilterDef
import com.viant.forgeandroid.runtime.SelectorUtil
import com.viant.forgeandroid.runtime.invokeReportBuilderHook
import com.viant.forgeandroid.runtime.lookupReportBuilderDescriptor
import com.viant.forgeandroid.runtime.setWindowFormValue
import com.viant.forgeandroid.runtime.windowFormValue
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement
import java.time.LocalDate
import kotlinx.coroutines.launch

private const val REPORT_BUILDER_PRESET_STORAGE = "forge_report_builder_presets"

@Serializable
private data class StoredReportBuilderChartPreset(
    val title: String,
    val settingsHash: String,
    val chartSpec: ReportBuilderChartSpecDef,
    val updatedAt: Long
)

@Serializable
internal data class StoredReportBuilderState(
    val selectedMeasures: List<String> = emptyList(),
    val selectedDimensions: List<String> = emptyList(),
    val chartSpec: ReportBuilderChartSpecDef? = null,
    val viewMode: String = "table",
    val staticFilters: Map<String, StoredStaticFilterValue> = emptyMap(),
    val dynamicGroups: Map<String, List<ReportBuilderDynamicRowState>> = emptyMap(),
    val dynamicFilterDrafts: Map<String, String> = emptyMap(),
    // Legacy fields kept only so previously persisted state can still decode.
    val dynamicFilterValues: Map<String, String> = emptyMap(),
    val dynamicFilterSelections: Map<String, List<ReportBuilderDynamicSelectionState>> = emptyMap(),
    val activeDynamicFilterKeys: List<String> = emptyList()
)

@Serializable
internal data class ReportBuilderDynamicSelectionState(
    val value: JsonElement,
    val label: String,
    val group: String = "",
    val record: Map<String, JsonElement> = emptyMap()
)

@Serializable
internal data class ReportBuilderDynamicRowState(
    val id: String,
    val filterId: String,
    val enabled: Boolean = true,
    val selections: List<ReportBuilderDynamicSelectionState> = emptyList()
)

@Serializable
internal sealed class StoredStaticFilterValue {
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
    runtime: ForgeRuntime,
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
    var dynamicGroups by remember(config) { mutableStateOf(emptyMap<String, List<ReportBuilderDynamicRowState>>()) }
    var dynamicFilterDrafts by remember(config) { mutableStateOf(emptyMap<String, String>()) }
    val coroutineScope = rememberCoroutineScope()
    val settingsHash = remember(selectedDimensions, selectedMeasures) { buildSettingsHash(selectedDimensions, selectedMeasures) }
    val hookState = remember(config, selectedMeasures, selectedDimensions, chartSpec, viewMode, staticFilters, dynamicGroups, dynamicFilterDrafts) {
        currentReportBuilderHookState(
            config = config,
            selectedMeasures = selectedMeasures,
            selectedDimensions = selectedDimensions,
            chartSpec = chartSpec,
            viewMode = viewMode,
            staticFilters = staticFilters,
            dynamicGroups = dynamicGroups
        )
    }
    val requestPayload = remember(config, selectedMeasures, selectedDimensions, chartSpec, viewMode, staticFilters, dynamicGroups) {
        buildReportBuilderRequestPayload(
            config = config,
            selectedMeasures = selectedMeasures,
            selectedDimensions = selectedDimensions,
            staticFilters = staticFilters,
            dynamicGroups = dynamicGroups,
            hookState = hookState,
            hookInvoker = { functionName, props ->
                invokeReportBuilderWindowHook(
                    window = window,
                    functionName = functionName,
                    props = props
                )
            }
        )
    }
    val preferences = LocalContext.current.getSharedPreferences(REPORT_BUILDER_PRESET_STORAGE, Context.MODE_PRIVATE)
    val builderStateKey = remember(container.stateKey, container.id) {
        (container.stateKey ?: container.id ?: "reportBuilder").trim().ifBlank { "reportBuilder" }
    }
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
            loadStoredStateFromWindowForm(runtime, window.windowId, builderStateKey)?.let { state ->
                selectedMeasures = state.selectedMeasures
                selectedDimensions = state.selectedDimensions
                chartSpec = state.chartSpec
                viewMode = state.viewMode
                staticFilters = state.staticFilters.mapValues { it.value.toRuntimeValue() }
                dynamicGroups = migratedDynamicGroups(config, state)
                dynamicFilterDrafts = state.dynamicFilterDrafts
            }
            restoredStoredState = true
        }
    }

    LaunchedEffect(requestPayload) {
        if (requestPayload.isNotEmpty()) {
            context.setInputParameters(requestPayload, fetch = true)
        }
    }
    LaunchedEffect(selectedMeasures, selectedDimensions, chartSpec, viewMode, staticFilters, dynamicGroups, dynamicFilterDrafts) {
        persistStoredStateToWindowForm(
            runtime = runtime,
            windowId = window.windowId,
            stateKey = builderStateKey,
            state = StoredReportBuilderState(
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
                dynamicGroups = dynamicGroups,
                dynamicFilterDrafts = dynamicFilterDrafts,
                dynamicFilterValues = legacyDynamicFilterValues(dynamicGroups),
                dynamicFilterSelections = legacyDynamicFilterSelections(dynamicGroups),
                activeDynamicFilterKeys = legacyActiveDynamicFilterKeys(dynamicGroups)
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
            BreakdownSection(
                title = "Breakdowns",
                items = visibleDimensions.map { reportBuilderDimensionLabel(it) to reportBuilderDimensionKey(it) },
                selected = selectedDimensions,
                onAdd = { key ->
                    if (!selectedDimensions.contains(key)) {
                        selectedDimensions = selectedDimensions + key
                    }
                },
                onRemove = { key ->
                    val next = selectedDimensions.filterNot { it == key }
                    if (next.isNotEmpty()) {
                        selectedDimensions = next
                    }
                }
            )
            StaticFilterSection(config.staticFilters, staticFilters) { key, value ->
                staticFilters = staticFilters.toMutableMap().apply { put(key, value) }
            }
            DynamicFilterBridgeSection(
                groups = config.dynamicFilterGroups,
                families = config.dynamicFilterFamilies,
                rowsByGroupId = dynamicGroups,
                drafts = dynamicFilterDrafts,
                isLookupAvailable = { groupId, filter ->
                    lookupDescriptorForWindow(
                        window = window,
                        config = config,
                        hookState = hookState,
                        groupId = groupId,
                        filter = filter
                    ) != null
                },
                onAddRow = { groupId, filterId ->
                    val row = ReportBuilderDynamicRowState(
                        id = java.util.UUID.randomUUID().toString(),
                        filterId = filterId,
                        enabled = true
                    )
                    dynamicGroups = dynamicGroups.toMutableMap().apply {
                        put(groupId, this[groupId].orEmpty() + row)
                    }
                },
                onChangeFilter = { groupId, rowId, filterId ->
                    dynamicGroups = dynamicGroups.toMutableMap().apply {
                        put(groupId, this[groupId].orEmpty().map { row ->
                            if (row.id == rowId) row.copy(filterId = filterId, selections = emptyList()) else row
                        })
                    }
                    dynamicFilterDrafts = dynamicFilterDrafts.toMutableMap().apply { remove(rowId) }
                },
                onToggleEnabled = { groupId, rowId ->
                    dynamicGroups = dynamicGroups.toMutableMap().apply {
                        put(groupId, this[groupId].orEmpty().map { row ->
                            if (row.id == rowId) row.copy(enabled = !row.enabled) else row
                        })
                    }
                },
                onRemoveRow = { groupId, rowId ->
                    dynamicGroups = dynamicGroups.toMutableMap().apply {
                        put(groupId, this[groupId].orEmpty().filterNot { it.id == rowId })
                    }
                    dynamicFilterDrafts = dynamicFilterDrafts.toMutableMap().apply { remove(rowId) }
                },
                onDraftChange = { rowId, value ->
                    dynamicFilterDrafts = dynamicFilterDrafts.toMutableMap().apply { put(rowId, value) }
                },
                onAddManualSelection = { groupId, rowId, filter ->
                    val selection = projectManualDynamicSelection(filter, dynamicFilterDrafts[rowId].orEmpty())
                    if (selection != null) {
                        dynamicGroups = dynamicGroups.toMutableMap().apply {
                            put(groupId, this[groupId].orEmpty().map { row ->
                                if (row.id == rowId) {
                                    row.copy(
                                        selections = (row.selections + selection)
                                            .distinctBy { dynamicSelectionValueKey(it.value) }
                                    )
                                } else {
                                    row
                                }
                            })
                        }
                        dynamicFilterDrafts = dynamicFilterDrafts.toMutableMap().apply { put(rowId, "") }
                    }
                },
                onRemoveSelection = { groupId, rowId, selection ->
                    dynamicGroups = dynamicGroups.toMutableMap().apply {
                        put(groupId, this[groupId].orEmpty().map { row ->
                            if (row.id == rowId) row.copy(selections = row.selections.filterNot { it == selection }) else row
                        })
                    }
                },
                onPickSelection = { groupId, rowId, filter ->
                    coroutineScope.launch {
                        val descriptor = lookupDescriptorForWindow(
                            window = window,
                            config = config,
                            hookState = hookState,
                            groupId = groupId,
                            filter = filter
                        ) ?: return@launch
                        val payload = runtime.openDialogAwaitResult(
                            windowId = window.windowId,
                            dialogId = descriptor.dialogId,
                            parameters = descriptor.parameters,
                            selectionMode = descriptor.selectionMode
                        ) ?: return@launch
                        val projected = projectLookupSelections(filter, payload)
                        if (projected.isEmpty()) return@launch
                        dynamicGroups = dynamicGroups.toMutableMap().apply {
                            put(groupId, this[groupId].orEmpty().map { row ->
                                if (row.id == rowId) {
                                    row.copy(
                                        selections = if (filter.multiple == false) {
                                            listOf(projected.first())
                                        } else {
                                            (row.selections + projected)
                                                .distinctBy { dynamicSelectionValueKey(it.value) }
                                        }
                                    )
                                } else {
                                    row
                                }
                            })
                        }
                    }
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
    rowsByGroupId: Map<String, List<ReportBuilderDynamicRowState>>,
    drafts: Map<String, String>,
    isLookupAvailable: (String, ReportBuilderDynamicFilterDef) -> Boolean,
    onAddRow: (String, String) -> Unit,
    onChangeFilter: (String, String, String) -> Unit,
    onToggleEnabled: (String, String) -> Unit,
    onRemoveRow: (String, String) -> Unit,
    onDraftChange: (String, String) -> Unit,
    onAddManualSelection: (String, String, ReportBuilderDynamicFilterDef) -> Unit,
    onRemoveSelection: (String, String, ReportBuilderDynamicSelectionState) -> Unit,
    onPickSelection: (String, String, ReportBuilderDynamicFilterDef) -> Unit
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
                "Add one filter line at a time. Committed values become request parameters for the report datasource.",
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFF6A7280)
            )
            if (families.isNotEmpty()) {
                families.forEach { family ->
                    DynamicFilterFamilyCard(
                        family = family,
                        groups = groups,
                        rowsByGroupId = rowsByGroupId,
                        drafts = drafts,
                        isLookupAvailable = isLookupAvailable,
                        onAddRow = onAddRow,
                        onChangeFilter = onChangeFilter,
                        onToggleEnabled = onToggleEnabled,
                        onRemoveRow = onRemoveRow,
                        onDraftChange = onDraftChange,
                        onAddManualSelection = onAddManualSelection,
                        onRemoveSelection = onRemoveSelection,
                        onPickSelection = onPickSelection
                    )
                }
            } else if (groups.isNotEmpty()) {
                groups.forEach { group ->
                    DynamicFilterGroupFields(
                        title = group.label ?: group.id ?: "Group",
                        groupId = group.id ?: "",
                        filters = group.filters,
                        rowsByGroupId = rowsByGroupId,
                        drafts = drafts,
                        isLookupAvailable = isLookupAvailable,
                        onAddRow = onAddRow,
                        onChangeFilter = onChangeFilter,
                        onToggleEnabled = onToggleEnabled,
                        onRemoveRow = onRemoveRow,
                        onDraftChange = onDraftChange,
                        onAddManualSelection = onAddManualSelection,
                        onRemoveSelection = onRemoveSelection,
                        onPickSelection = onPickSelection
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
    rowsByGroupId: Map<String, List<ReportBuilderDynamicRowState>>,
    drafts: Map<String, String>,
    isLookupAvailable: (String, ReportBuilderDynamicFilterDef) -> Boolean,
    onAddRow: (String, String) -> Unit,
    onChangeFilter: (String, String, String) -> Unit,
    onToggleEnabled: (String, String) -> Unit,
    onRemoveRow: (String, String) -> Unit,
    onDraftChange: (String, String) -> Unit,
    onAddManualSelection: (String, String, ReportBuilderDynamicFilterDef) -> Unit,
    onRemoveSelection: (String, String, ReportBuilderDynamicSelectionState) -> Unit,
    onPickSelection: (String, String, ReportBuilderDynamicFilterDef) -> Unit
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
                DynamicFilterGroupFields("Include", "include", includeFilters, rowsByGroupId, drafts, isLookupAvailable, onAddRow, onChangeFilter, onToggleEnabled, onRemoveRow, onDraftChange, onAddManualSelection, onRemoveSelection, onPickSelection)
            }
            if (excludeFilters.isNotEmpty()) {
                DynamicFilterGroupFields("Exclude", "exclude", excludeFilters, rowsByGroupId, drafts, isLookupAvailable, onAddRow, onChangeFilter, onToggleEnabled, onRemoveRow, onDraftChange, onAddManualSelection, onRemoveSelection, onPickSelection)
            }
        }
    }
}

@Composable
private fun DynamicFilterGroupFields(
    title: String,
    groupId: String,
    filters: List<com.viant.forgeandroid.runtime.ReportBuilderDynamicFilterDef>,
    rowsByGroupId: Map<String, List<ReportBuilderDynamicRowState>>,
    drafts: Map<String, String>,
    isLookupAvailable: (String, ReportBuilderDynamicFilterDef) -> Boolean,
    onAddRow: (String, String) -> Unit,
    onChangeFilter: (String, String, String) -> Unit,
    onToggleEnabled: (String, String) -> Unit,
    onRemoveRow: (String, String) -> Unit,
    onDraftChange: (String, String) -> Unit,
    onAddManualSelection: (String, String, ReportBuilderDynamicFilterDef) -> Unit,
    onRemoveSelection: (String, String, ReportBuilderDynamicSelectionState) -> Unit,
    onPickSelection: (String, String, ReportBuilderDynamicFilterDef) -> Unit
) {
    val rows = (rowsByGroupId[groupId] ?: emptyList()).filter { row ->
        filters.any { it.id == row.filterId }
    }
    val defaultFilterId = filters.firstOrNull()?.id.orEmpty()
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.labelMedium, color = Color(0xFF607080), modifier = Modifier.weight(1f))
            if (defaultFilterId.isNotBlank()) {
                OutlinedButton(onClick = { onAddRow(groupId, defaultFilterId) }) {
                    Icon(Icons.Filled.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Add line")
                }
            }
        }
        rows.forEach { row ->
            val filter = filters.firstOrNull { it.id == row.filterId } ?: return@forEach
            val rowId = row.id
            val lookupAvailable = isLookupAvailable(groupId, filter)
            var rowMenuExpanded by remember(rowId, filters) { mutableStateOf(false) }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(modifier = Modifier.weight(1f)) {
                        OutlinedButton(onClick = { rowMenuExpanded = true }) {
                            Text(filter.label ?: filter.id ?: "Filter")
                            Icon(Icons.Filled.ArrowDropDown, contentDescription = null)
                        }
                        DropdownMenu(expanded = rowMenuExpanded, onDismissRequest = { rowMenuExpanded = false }) {
                            filters.forEach { candidate ->
                                DropdownMenuItem(
                                    text = { Text(candidate.label ?: candidate.id ?: "Filter") },
                                    onClick = {
                                        rowMenuExpanded = false
                                        candidate.id?.let { onChangeFilter(groupId, rowId, it) }
                                    }
                                )
                            }
                        }
                    }
                    OutlinedButton(onClick = { onToggleEnabled(groupId, rowId) }) {
                        Text(if (row.enabled) "On" else "Off")
                    }
                    OutlinedButton(onClick = { onRemoveRow(groupId, rowId) }) {
                        Icon(Icons.Filled.Delete, contentDescription = null)
                    }
                }
                LookupSelectionControl(
                    selections = row.selections,
                    draft = drafts[rowId].orEmpty(),
                    placeholder = filter.manualPlaceholder ?: filter.label ?: "Enter value",
                    manualEntry = filter.manualEntry == true,
                    lookupAvailable = lookupAvailable,
                    enabled = row.enabled,
                    onDraftChange = { next -> onDraftChange(rowId, next) },
                    onCommitManual = { onAddManualSelection(groupId, rowId, filter) },
                    onPick = { onPickSelection(groupId, rowId, filter) },
                    onRemoveSelection = { selection -> onRemoveSelection(groupId, rowId, selection) }
                )
            }
        }
    }
}

@Composable
private fun LookupSelectionControl(
    selections: List<ReportBuilderDynamicSelectionState>,
    draft: String,
    placeholder: String,
    manualEntry: Boolean,
    lookupAvailable: Boolean,
    enabled: Boolean,
    onDraftChange: (String) -> Unit,
    onCommitManual: () -> Unit,
    onPick: () -> Unit,
    onRemoveSelection: (ReportBuilderDynamicSelectionState) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (selections.isNotEmpty()) {
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                selections.forEach { chip ->
                    AssistChip(
                        onClick = { onRemoveSelection(chip) },
                        label = {
                            Text(
                                chip.label.ifBlank { dynamicSelectionValueText(chip.value) },
                                color = Color(0xFF755600)
                            )
                        },
                        trailingIcon = { Icon(Icons.Filled.Delete, contentDescription = null) },
                        colors = AssistChipDefaults.assistChipColors(containerColor = Color(0xFFFFF7D8))
                    )
                }
            }
        }

        if (manualEntry || lookupAvailable) {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                if (manualEntry) {
                    OutlinedTextField(
                        value = draft,
                        onValueChange = onDraftChange,
                        modifier = Modifier.width(176.dp),
                        placeholder = { Text(placeholder) },
                        singleLine = true,
                        enabled = enabled,
                        shape = RoundedCornerShape(topStart = 28.dp, bottomStart = 28.dp, topEnd = 8.dp, bottomEnd = 8.dp)
                    )
                } else {
                    OutlinedButton(
                        onClick = onPick,
                        enabled = enabled && lookupAvailable,
                        shape = RoundedCornerShape(topStart = 28.dp, bottomStart = 28.dp, topEnd = 8.dp, bottomEnd = 8.dp)
                    ) {
                        Text(placeholder)
                    }
                }
                OutlinedButton(
                    onClick = {
                        if (lookupAvailable) onPick() else onCommitManual()
                    },
                    enabled = enabled && (lookupAvailable || draft.isNotBlank()),
                    modifier = Modifier.height(56.dp).width(44.dp),
                    shape = RoundedCornerShape(topStart = 8.dp, bottomStart = 8.dp, topEnd = 28.dp, bottomEnd = 28.dp)
                ) {
                    Icon(if (lookupAvailable) Icons.Filled.ArrowDropDown else Icons.Filled.Add, contentDescription = null)
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
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = current["start"]?.toString().orEmpty(),
                            onValueChange = { next ->
                                onChange(key, mapOf("start" to next, "end" to current["end"]?.toString().orEmpty()))
                            },
                            modifier = Modifier.width(136.dp),
                            label = { Text("Start") },
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = current["end"]?.toString().orEmpty(),
                            onValueChange = { next ->
                                onChange(key, mapOf("start" to current["start"]?.toString().orEmpty(), "end" to next))
                            },
                            modifier = Modifier.width(136.dp),
                            label = { Text("End") },
                            singleLine = true
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
private fun BreakdownSection(
    title: String,
    items: List<Pair<String, String>>,
    selected: List<String>,
    onAdd: (String) -> Unit,
    onRemove: (String) -> Unit
) {
    var expanded by remember(items, selected) { mutableStateOf(false) }
    val selectedKeys = selected.toSet()
    val available = items.filterNot { selectedKeys.contains(it.second) }
    val selectedItems = selected.mapNotNull { key -> items.firstOrNull { it.second == key } }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        Box {
            OutlinedButton(
                onClick = { expanded = true },
                enabled = available.isNotEmpty()
            ) {
                Text(if (available.isEmpty()) "All breakdowns added" else "Add breakdown...")
                Icon(Icons.Filled.ArrowDropDown, contentDescription = null)
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                if (available.isEmpty()) {
                    DropdownMenuItem(text = { Text("All breakdowns added") }, onClick = { expanded = false })
                } else {
                    available.forEach { (label, key) ->
                        DropdownMenuItem(
                            text = { Text(label) },
                            onClick = {
                                expanded = false
                                onAdd(key)
                            }
                        )
                    }
                }
            }
        }
        if (selectedItems.isNotEmpty()) {
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                selectedItems.forEach { (label, key) ->
                    val removable = selectedItems.size > 1
                    AssistChip(
                        onClick = { if (removable) onRemove(key) },
                        label = { Text(label) },
                        trailingIcon = if (removable) {
                            { Icon(Icons.Filled.Delete, contentDescription = null) }
                        } else null,
                        colors = AssistChipDefaults.assistChipColors(containerColor = Color(0xFFE8F0FF))
                    )
                }
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

internal fun buildReportBuilderRequestPayload(
    config: com.viant.forgeandroid.runtime.DashboardReportBuilderDef,
    selectedMeasures: List<String>,
    selectedDimensions: List<String>,
    staticFilters: Map<String, Any?>,
    dynamicGroups: Map<String, List<ReportBuilderDynamicRowState>>,
    hookState: Map<String, Any?>,
    hookInvoker: (String, JsonObject) -> Map<String, Any?>?
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
        val rows = dynamicGroups[group.id].orEmpty()
        group.filters.forEach filterLoop@ { filter ->
            val filterKey = filter.id ?: return@filterLoop
            val requestMapping = (filter.requestMapping ?: "").trim().lowercase()
            if (requestMapping == "hook") return@filterLoop
            val values = rows
                .filter { it.filterId == filterKey && it.enabled }
                .flatMap { row ->
                    row.selections.mapNotNull { dynamicSelectionRequestValue(filter, it.value) }
                }
            if (values.isEmpty()) return@filterLoop
            val mapped: Any? = if (filter.multiple == true || filter.emitArray == true) {
                values
            } else {
                values.first()
            }
            setNestedValue(request, filter.paramPath ?: "filters.$filterKey", mapped)
        }
    }
    val baseRequest = if (request.isEmpty()) emptyMap() else mapOf("input" to mapOf("query" to request))
    val hookName = config.hooks?.buildRequest?.trim().orEmpty()
    if (hookName.isBlank()) {
        return baseRequest
    }
    val hookResult = hookInvoker(
        hookName,
        JsonObject(
            mapOf(
                "request" to JsonUtil.anyToElement(baseRequest),
                "state" to JsonUtil.anyToElement(hookState),
                "config" to JsonUtil.json.encodeToJsonElement(
                    com.viant.forgeandroid.runtime.DashboardReportBuilderDef.serializer(),
                    config
                )
            )
        )
    ) ?: return baseRequest
    return if (hookResult.isEmpty()) baseRequest else hookResult
}

private fun normalizeDynamicFilterValue(
    filter: com.viant.forgeandroid.runtime.ReportBuilderDynamicFilterDef,
    rawValue: String
): String? {
    val trimmed = rawValue.trim()
    if (trimmed.isEmpty()) return null
    val valueType = (filter.manualValueType ?: "").trim().lowercase()
    return when (valueType) {
        "int", "integer" -> trimmed.takeIf { it.matches(Regex("^-?\\d+$")) }
        else -> trimmed
    }
}

private fun coerceDynamicFilterRequestValue(
    filter: com.viant.forgeandroid.runtime.ReportBuilderDynamicFilterDef,
    rawValue: String
): Any {
    val valueType = (filter.manualValueType ?: "").trim().lowercase()
    return when (valueType) {
        "int", "integer" -> rawValue.toInt()
        else -> rawValue
    }
}

private fun dynamicSelectionRequestValue(
    filter: com.viant.forgeandroid.runtime.ReportBuilderDynamicFilterDef,
    value: JsonElement
): Any? {
    return when (val any = JsonUtil.elementToAny(value)) {
        null -> null
        is Number -> any
        is String -> coerceDynamicFilterRequestValue(filter, any)
        else -> any
    }
}

private fun dynamicSelectionValueText(value: JsonElement): String =
    JsonUtil.elementToAny(value)?.toString().orEmpty()

private fun dynamicSelectionValueKey(value: JsonElement): String = value.toString()

private fun projectManualDynamicSelection(
    filter: com.viant.forgeandroid.runtime.ReportBuilderDynamicFilterDef,
    rawValue: String
): ReportBuilderDynamicSelectionState? {
    val normalized = normalizeDynamicFilterValue(filter, rawValue) ?: return null
    val valueType = (filter.manualValueType ?: "").trim().lowercase()
    val value = when (valueType) {
        "int", "integer" -> JsonPrimitive(normalized.toInt())
        else -> JsonPrimitive(normalized)
    }
    val label = normalized
    val valueSelector = filter.valueSelector?.takeIf { it.isNotBlank() } ?: "value"
    val labelSelector = filter.labelSelector?.takeIf { it.isNotBlank() } ?: "label"
    return ReportBuilderDynamicSelectionState(
        value = value,
        label = label,
        record = linkedMapOf(
            valueSelector to value,
            labelSelector to JsonPrimitive(label)
        )
    )
}

private fun currentReportBuilderHookState(
    config: com.viant.forgeandroid.runtime.DashboardReportBuilderDef,
    selectedMeasures: List<String>,
    selectedDimensions: List<String>,
    chartSpec: ReportBuilderChartSpecDef?,
    viewMode: String,
    staticFilters: Map<String, Any?>,
    dynamicGroups: Map<String, List<ReportBuilderDynamicRowState>>
): Map<String, Any?> {
    return linkedMapOf(
        "selectedMeasures" to selectedMeasures,
        "selectedDimensions" to selectedDimensions,
        "chartSpec" to chartSpec,
        "viewMode" to viewMode,
        "staticFilters" to staticFilters,
        "dynamicFilterValues" to legacyDynamicFilterValues(dynamicGroups),
        "activeDynamicFilterKeys" to legacyActiveDynamicFilterKeys(dynamicGroups),
        "dynamicGroups" to synthesizeDynamicGroups(dynamicGroups)
    )
}

private fun synthesizeDynamicGroups(
    dynamicGroups: Map<String, List<ReportBuilderDynamicRowState>>
): Map<String, Any?> {
    return dynamicGroups.mapValues { (_, rows) ->
        rows.map { row ->
            linkedMapOf(
                "id" to row.id,
                "filterId" to row.filterId,
                "enabled" to row.enabled,
                "selections" to row.selections.map { selection ->
                    linkedMapOf(
                        "value" to JsonUtil.elementToAny(selection.value),
                        "label" to selection.label,
                        "group" to selection.group,
                        "record" to selection.record.mapValues { (_, value) -> JsonUtil.elementToAny(value) }
                    )
                }
            )
        }
    }
}

internal fun migratedDynamicGroups(
    config: com.viant.forgeandroid.runtime.DashboardReportBuilderDef,
    state: StoredReportBuilderState
): Map<String, List<ReportBuilderDynamicRowState>> {
    if (state.dynamicGroups.isNotEmpty()) {
        return state.dynamicGroups
    }
    val filterToGroup = config.dynamicFilterGroups.flatMap { group ->
        group.filters.mapNotNull { filter -> filter.id?.let { id -> id to (group.id ?: "") } }
    }.toMap()
    val activeKeys = state.activeDynamicFilterKeys.toSet()
    val result = linkedMapOf<String, MutableList<ReportBuilderDynamicRowState>>()
    activeKeys.forEach { filterKey ->
        val groupId = filterToGroup[filterKey].orEmpty()
        if (groupId.isBlank()) return@forEach
        val filter = config.dynamicFilterGroups
            .firstOrNull { it.id == groupId }
            ?.filters
            ?.firstOrNull { it.id == filterKey }
            ?: return@forEach
        val selections = state.dynamicFilterSelections[filterKey].orEmpty().ifEmpty {
            state.dynamicFilterValues[filterKey]
                ?.split(",")
                ?.map { it.trim() }
                ?.filter { it.isNotEmpty() }
                ?.mapNotNull { raw -> projectManualDynamicSelection(filter, raw) }
                .orEmpty()
        }
        result.getOrPut(groupId) { mutableListOf() }.add(
            ReportBuilderDynamicRowState(
                id = filterKey,
                filterId = filterKey,
                enabled = true,
                selections = selections
            )
        )
    }
    return result
}

internal fun legacyDynamicFilterValues(
    dynamicGroups: Map<String, List<ReportBuilderDynamicRowState>>
): Map<String, String> {
    val result = linkedMapOf<String, String>()
    dynamicGroups.values.flatten().forEach { row ->
        result[row.filterId] = row.selections.joinToString(",") { dynamicSelectionValueText(it.value) }
    }
    return result
}

internal fun legacyDynamicFilterSelections(
    dynamicGroups: Map<String, List<ReportBuilderDynamicRowState>>
): Map<String, List<ReportBuilderDynamicSelectionState>> {
    val result = linkedMapOf<String, List<ReportBuilderDynamicSelectionState>>()
    dynamicGroups.values.flatten().forEach { row ->
        result[row.filterId] = row.selections
    }
    return result
}

internal fun legacyActiveDynamicFilterKeys(
    dynamicGroups: Map<String, List<ReportBuilderDynamicRowState>>
): List<String> = dynamicGroups.values.flatten().map { it.filterId }.distinct()

private fun invokeReportBuilderWindowHook(
    window: com.viant.forgeandroid.runtime.WindowContext,
    functionName: String,
    props: JsonObject
): Map<String, Any?>? {
    return invokeReportBuilderHook(window.metadata.peek(), functionName, props)
}

private fun lookupDescriptorForWindow(
    window: com.viant.forgeandroid.runtime.WindowContext,
    config: com.viant.forgeandroid.runtime.DashboardReportBuilderDef,
    hookState: Map<String, Any?>,
    groupId: String,
    filter: ReportBuilderDynamicFilterDef
): ReportBuilderLookupDescriptor? {
    return lookupReportBuilderDescriptor(window.metadata.peek(), config, hookState, groupId, filter)
}

private fun projectLookupSelections(
    filter: ReportBuilderDynamicFilterDef,
    payload: Map<String, Any?>
): List<ReportBuilderDynamicSelectionState> {
    val records = when (val selection = payload["selection"]) {
        is List<*> -> selection.mapNotNull { JsonUtil.asStringMap(it).takeIf { map -> map.isNotEmpty() } }
        else -> {
            val selected = JsonUtil.asStringMap(payload["selected"]).takeIf { it.isNotEmpty() }
            listOfNotNull(selected ?: payload.takeIf { it.isNotEmpty() })
        }
    }

    val valueSelectors = lookupValueSelectors(filter)
    val labelSelectors = lookupLabelSelectors(filter)
    val groupSelectors = listOfNotNull(filter.groupSelector?.takeIf { it.isNotBlank() })

    return records.mapNotNull { record ->
        val rawValue = resolveLookupRecordValue(record, valueSelectors) ?: return@mapNotNull null
        val label = resolveLookupRecordValue(record, labelSelectors)?.toString()
            ?.takeIf { it.isNotBlank() }
            ?: rawValue.toString()
        val group = resolveLookupRecordValue(record, groupSelectors)?.toString().orEmpty()
        val compactRecord = linkedMapOf<String, JsonElement>()
        (filter.recordSelectors + listOfNotNull(filter.valueSelector, filter.labelSelector, filter.groupSelector))
            .filter { it.isNotBlank() }
            .distinct()
            .forEach { selector ->
                val value = resolveLookupRecordValue(record, listOf(selector)) ?: return@forEach
                compactRecord[selector] = JsonUtil.anyToElement(value)
            }
        ReportBuilderDynamicSelectionState(
            value = JsonUtil.anyToElement(rawValue),
            label = label,
            group = group,
            record = compactRecord
        )
    }
}

private fun lookupValueSelectors(filter: ReportBuilderDynamicFilterDef): List<String> {
    val selector = filter.valueSelector?.trim().orEmpty()
    if (selector.isEmpty()) return listOf("value", "id")
    return listOf(selector, selector.substringAfterLast('.'), "value", "id").distinct()
}

private fun lookupLabelSelectors(filter: ReportBuilderDynamicFilterDef): List<String> {
    val selector = filter.labelSelector?.trim().orEmpty()
    val valueSelector = filter.valueSelector?.trim().orEmpty()
    val selectors = mutableListOf<String>()
    if (selector.isNotEmpty()) {
        selectors += selector
        selectors += selector.substringAfterLast('.')
    }
    selectors += listOf("label", "name")
    if (valueSelector.isNotEmpty()) {
        selectors += valueSelector.substringAfterLast('.')
    }
    return selectors.filter { it.isNotBlank() }.distinct()
}

private fun resolveLookupRecordValue(record: Map<String, Any?>, selectors: List<String>): Any? {
    selectors.forEach { selector ->
        val trimmed = selector.trim()
        if (trimmed.isEmpty()) return@forEach
        val resolved = SelectorUtil.resolve(record, trimmed)
        if (resolved != null && resolved.toString().isNotEmpty()) {
            return resolved
        }
    }
    return null
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

internal fun loadStoredStateFromWindowForm(
    runtime: ForgeRuntime,
    windowId: String,
    stateKey: String
): StoredReportBuilderState? {
    val stored = resolveNestedValue(runtime.windowFormValue(windowId), stateKey) ?: return null
    return runCatching {
        Json.decodeFromJsonElement<StoredReportBuilderState>(JsonUtil.anyToElement(stored))
    }.getOrNull()
}

internal fun persistStoredStateToWindowForm(
    runtime: ForgeRuntime,
    windowId: String,
    stateKey: String,
    state: StoredReportBuilderState
) {
    val payload = linkedMapOf<String, Any?>()
    setNestedValue(
        payload,
        stateKey,
        JsonUtil.elementToAny(
            JsonUtil.json.encodeToJsonElement(StoredReportBuilderState.serializer(), state)
        )
    )
    runtime.setWindowFormValue(windowId, payload)
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

internal fun resolveNestedValue(values: Map<String, Any?>, path: String): Any? {
    val parts = path.split('.').map { it.trim() }.filter { it.isNotEmpty() }
    if (parts.isEmpty()) return null
    var current: Any? = values
    for (part in parts) {
        current = JsonUtil.asStringMap(current)[part]
        if (current == null) return null
    }
    return current
}

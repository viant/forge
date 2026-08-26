package com.viant.forgeandroid.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.ChartAxisDef
import com.viant.forgeandroid.runtime.ChartDef
import com.viant.forgeandroid.runtime.ChartSeriesDef
import com.viant.forgeandroid.runtime.ChartValueOption
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.ControlState
import com.viant.forgeandroid.runtime.DashboardReportBuilderDef
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.InlineReportRuntimeCompiler
import com.viant.forgeandroid.runtime.JsonUtil
import com.viant.forgeandroid.runtime.ReportBuilderPublishedDataSourceDef
import com.viant.forgeandroid.runtime.WindowContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.coroutines.flow.first

internal fun reportBuilderAuthoredDocument(windowForm: Map<String, Any?>): JsonObject? {
    fun obj(value: Any?): JsonObject? = JsonUtil.anyToElement(value) as? JsonObject
    val reportDefinition = obj(windowForm["reportDefinition"])
    val definitionDocument = obj(reportDefinition?.get("documentPatch"))
        ?: obj(reportDefinition?.get("reportDocument"))
    // Conversation window snapshots depth-limit deeply nested reportDefinition
    // values. The report-builder state carries the same authored blocks one
    // level closer to the root, preserving chart fields and table columns. Web
    // restores from that state as well, so prefer it when reopening on Android.
    val stateBlocks = windowForm.values.asSequence()
        .mapNotNull(::obj)
        .mapNotNull { it["reportDocumentBlocks"] as? JsonArray }
        .firstOrNull { it.isNotEmpty() }
    val stateDocument = stateBlocks?.let { blocks ->
        JsonObject((definitionDocument?.toMutableMap() ?: mutableMapOf()).apply {
            put("blocks", blocks)
        })
    }
    val candidates = listOf(
        stateDocument,
        reportDefinition?.get("documentPatch"),
        reportDefinition?.get("reportDocument"),
        windowForm["documentPatch"],
        windowForm["reportDocument"]
    )
    return candidates.asSequence()
        .mapNotNull(::obj)
        .firstOrNull { (it["blocks"] as? JsonArray)?.isNotEmpty() == true }
}

internal fun reportBuilderAuthoredDatasetRefs(document: JsonObject): Set<String> =
    (document["blocks"] as? JsonArray).orEmpty()
        .mapNotNull { block ->
            ((block as? JsonObject)?.get("datasetRef") as? JsonPrimitive)?.content
                ?.trim()?.takeIf { it.isNotEmpty() }
        }
        .toSet()

internal fun reportBuilderMaterializeComputedRows(
    rows: List<Map<String, Any?>>,
    config: DashboardReportBuilderDef
): List<Map<String, Any?>> {
    val computedKeys = config.computedMeasures.map(::reportBuilderMeasureKey)
    if (computedKeys.isEmpty()) return rows
    return rows.map { row -> applyReportBuilderComputedMeasures(row, computedKeys, config) }
}

internal fun reportBuilderPersistedDatasets(
    windowForm: Map<String, Any?>,
    config: DashboardReportBuilderDef
): Map<String, List<Map<String, Any?>>> {
    val datasets = windowForm["reportStaticDatasets"] as? List<*> ?: return emptyMap()
    return datasets.mapNotNull { value ->
        val dataset = value as? Map<*, *> ?: return@mapNotNull null
        val id = (dataset["id"] ?: dataset["dataSourceRef"])?.toString()?.trim().orEmpty()
        if (id.isEmpty()) return@mapNotNull null
        val rows = (dataset["rows"] as? List<*>).orEmpty().mapNotNull { row ->
            (row as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value }
        }
        id to reportBuilderMaterializeComputedRows(rows, config)
    }.toMap()
}

internal fun reportBuilderPublishedSources(
    config: DashboardReportBuilderDef,
    document: JsonObject
): List<ReportBuilderPublishedDataSourceDef> {
    val referencedInDocumentOrder = (document["blocks"] as? JsonArray).orEmpty()
        .mapNotNull { block ->
            ((block as? JsonObject)?.get("datasetRef") as? JsonPrimitive)?.content
                ?.trim()?.takeIf { it.isNotEmpty() && it != "primary" }
        }
        .distinct()
    val order = referencedInDocumentOrder.withIndex().associate { it.value to it.index }
    return config.dataSources
        .filter { it.id in order }
        .sortedWith(compareBy<ReportBuilderPublishedDataSourceDef>(
            { reportBuilderPublishedFetchPriority(it) },
            { order[it.id] ?: Int.MAX_VALUE }
        ))
}

/** Fetch cheap aggregate cards before detailed chart/table datasets on mobile. */
internal fun reportBuilderPublishedFetchPriority(source: ReportBuilderPublishedDataSourceDef): Int {
    val request = source.request
    val dimensions = request["dimensions"] as? JsonObject
    val limit = (request["limit"] as? JsonPrimitive)?.content?.toIntOrNull()
    return if (dimensions?.isEmpty() == true && limit != null && limit <= 1) 0 else 1
}

/** Catalog request fields define the dataset shape; active filters remain inherited. */
internal fun reportBuilderPublishedRequest(
    primaryRequest: Map<String, Any?>,
    declaration: ReportBuilderPublishedDataSourceDef
): Map<String, Any?> {
    val catalog = JsonUtil.elementToAny(declaration.request) as? Map<*, *> ?: emptyMap<Any?, Any?>()
    val result = primaryRequest.toMutableMap()
    catalog.forEach { (rawKey, value) ->
        val key = rawKey?.toString() ?: return@forEach
        if (key == "filters") {
            val inherited = (result[key] as? Map<*, *>)?.entries
                ?.associate { it.key.toString() to it.value }.orEmpty()
            val declared = (value as? Map<*, *>)?.entries
                ?.associate { it.key.toString() to it.value }.orEmpty()
            result[key] = inherited + declared
        } else {
            result[key] = value
        }
    }
    return result
}

internal fun materializeReportBuilderAuthoredDocument(document: JsonObject): JsonObject {
    val blocks = (document["blocks"] as? JsonArray).orEmpty().map { value ->
        val block = value as? JsonObject ?: return@map value
        if ((block["kind"] as? JsonPrimitive)?.content != "chartBlock" || block["chartModel"] != null) {
            return@map block
        }
        val spec = block["chartSpec"] as? JsonObject ?: return@map block
        val xField = (spec["xField"] as? JsonPrimitive)?.content ?: return@map block
        val yFields = (spec["yFields"] as? JsonArray).orEmpty()
            .mapNotNull { (it as? JsonPrimitive)?.content }
        if (yFields.isEmpty()) return@map block
        val authoredType = (spec["type"] as? JsonPrimitive)?.content?.lowercase().orEmpty()
        val type = when (authoredType) {
            "horizontal_bar", "horizontalbar", "column" -> "bar"
            "stackedbar" -> "stacked_bar"
            else -> authoredType.ifBlank { "line" }
        }
        val chart = ChartDef(
            title = (spec["title"] as? JsonPrimitive)?.content
                ?: (block["title"] as? JsonPrimitive)?.content,
            xAxis = ChartAxisDef(dataKey = xField),
            yAxis = ChartAxisDef(label = (spec["yLabel"] as? JsonPrimitive)?.content),
            series = ChartSeriesDef(values = yFields.map { field ->
                ChartValueOption(name = field, label = field, value = field)
            }),
            type = type
        )
        JsonObject(block.toMutableMap().apply {
            put("chartModel", JsonUtil.json.parseToJsonElement(JsonUtil.json.encodeToString(chart)))
        })
    }
    return JsonObject(document.toMutableMap().apply { put("blocks", JsonArray(blocks)) })
}

@Composable
internal fun ReportBuilderAuthoredResult(
    runtime: ForgeRuntime,
    window: WindowContext,
    dashboardRoot: ContainerDef,
    config: DashboardReportBuilderDef,
    document: JsonObject,
    primaryRows: List<Map<String, Any?>>,
    primaryControl: ControlState,
    primaryRequest: Map<String, Any?>,
    runRequestId: String?
) {
    val referencedDatasetRefs = remember(document) { reportBuilderAuthoredDatasetRefs(document) }
    val persistedRows = reportBuilderPersistedDatasets(window.peekWindowForm(), config)
    val declarations = remember(config, document) { reportBuilderPublishedSources(config, document) }
    val contexts = declarations.mapNotNull { declaration ->
        window.contextForInstanceOrNull(
            instanceRef = "reportDocument:${declaration.id}",
            dataSourceRef = declaration.dataSourceRef
        )?.let { declaration to it }
    }
    val rowsById = linkedMapOf<String, List<Map<String, Any?>>>()
    rowsById.putAll(persistedRows)
    val controls = mutableListOf<ControlState>()
    if ("primary" in referencedDatasetRefs && "primary" !in persistedRows) {
        rowsById["primary"] = primaryRows
        controls += primaryControl
    }
    contexts.forEach { (declaration, context) ->
        if (declaration.id in persistedRows) return@forEach
        val rows by context.collection.flow.collectAsState(initial = context.collection.peek())
        val control by context.control.flow.collectAsState(initial = context.control.peek())
        rowsById[declaration.id] = reportBuilderMaterializeComputedRows(rows, config)
        controls += control
    }
    // A large authored report can reference many logical datasets backed by
    // one expensive cube. Hydrate them in priority order so Android does not
    // stampede the gateway with identical concurrent cube jobs. The first
    // cheap aggregate normally unlocks the KPI overview immediately.
    LaunchedEffect(primaryRequest, declarations, primaryRows, runRequestId) {
        val requestId = runRequestId?.trim()?.takeIf(String::isNotEmpty)
            ?: "native-${java.util.UUID.randomUUID()}"
        if (runRequestId.isNullOrBlank() && persistedRows.isNotEmpty()) {
            runtime.publishNativeReportMaterialization(
                windowId = window.windowId,
                requestId = requestId,
                status = "completed",
                rowsById = persistedRows,
                errors = emptyList()
            )
            return@LaunchedEffect
        }
        runtime.publishNativeReportMaterialization(
            windowId = window.windowId,
            requestId = requestId,
            status = "running",
            rowsById = emptyMap(),
            errors = emptyList()
        )
        val loadedRows = linkedMapOf<String, List<Map<String, Any?>>>()
        val loadErrors = mutableListOf<String>()
        if ("primary" in referencedDatasetRefs) {
            loadedRows["primary"] = primaryRows
            primaryControl.error?.takeIf(String::isNotBlank)?.let(loadErrors::add)
        }
        contexts.forEach { (declaration, context) ->
            val request = reportBuilderPublishedRequest(primaryRequest, declaration)
            if (request.isEmpty()) return@forEach
            context.setInputParameters(request, fetch = true)
            context.control.flow.first { it.loading || it.resolved }
            context.control.flow.first { !it.loading && it.resolved }
            loadedRows[declaration.id] = reportBuilderMaterializeComputedRows(
                context.collection.peek(),
                config
            )
            context.control.peek().error?.takeIf(String::isNotBlank)?.let(loadErrors::add)
        }
        runtime.publishNativeReportMaterialization(
            windowId = window.windowId,
            requestId = requestId,
            status = if (loadErrors.isEmpty()) "completed" else "failed",
            rowsById = loadedRows,
            errors = loadErrors
        )
    }

    val preparedDocument = remember(document) { materializeReportBuilderAuthoredDocument(document) }
    val artifact = remember(preparedDocument, rowsById.toMap()) {
        InlineReportRuntimeCompiler.compile(
            TranscriptCanonicalReport(
                scope = "report-builder",
                id = "${window.windowId}-authored-report",
                grammar = "report-document-v1",
                status = "ready",
                source = preparedDocument,
                dataSources = rowsById.mapValues { (id, rows) ->
                    TranscriptCanonicalData(
                        id = id,
                        format = "json",
                        payload = JsonArray(rows.map(JsonUtil::anyToElement))
                    )
                }
            )
        )
    }
    val runtimeContainer = remember(artifact.metadata) {
        artifact.metadata.view?.content?.containers?.firstOrNull()
    }
    val pending = controls.any { it.loading || !it.resolved }
    val hasMaterializedRows = rowsById.values.any { it.isNotEmpty() }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        val error = controls.firstNotNullOfOrNull { it.error?.takeIf(String::isNotBlank) }
        if (error != null) {
            Text(
                text = authoredReportLoadErrorMessage(error),
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFFB42318)
            )
        }
        if (pending) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                Text(
                    text = "Loading report data…",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        // Do not turn an unresolved dataset into a definitive empty KPI/card.
        // Partial output remains useful after an explicit error, while a normal
        // in-flight request gets one honest loading state.
        if (runtimeContainer != null && (hasMaterializedRows || !pending || error != null)) {
            DashboardReportRuntimeSurface(runtime, window, runtimeContainer, dashboardRoot)
        }
    }
}

private fun ForgeRuntime.publishNativeReportMaterialization(
    windowId: String,
    requestId: String,
    status: String,
    rowsById: Map<String, List<Map<String, Any?>>>,
    errors: List<String>
) {
    val materialization = linkedMapOf<String, Any?>(
        "id" to requestId,
        "requestId" to requestId,
        "status" to status,
        "materialized" to (status == "completed"),
        "datasetRefs" to rowsById.keys.sorted(),
        "rowCounts" to rowsById.mapValues { it.value.size }
    )
    if (errors.isNotEmpty()) materialization["errors"] = errors
    val values = linkedMapOf<String, Any?>("reportMaterialization" to materialization)
    if (status != "running") {
        values["reportStaticDatasets"] = rowsById.keys.sorted().map { id ->
            mapOf(
                "id" to id,
                "dataSourceRef" to id,
                "rows" to rowsById[id].orEmpty()
            )
        }
    }
    setWindowFormValues(windowId, values, replace = false, bumpPrefillRevision = false)
}

internal fun authoredReportLoadErrorMessage(error: String): String {
    val detail = error.trim()
    if (detail.contains("504") || detail.contains("gateway time-out", ignoreCase = true)) {
        return "Report data took too long to load. Try refreshing."
    }
    if (detail.contains("timeout", ignoreCase = true) ||
        detail.contains("timed out", ignoreCase = true)
    ) {
        return "Some report data did not respond. Try refreshing."
    }
    return "Some report data could not be loaded. Try refreshing."
}

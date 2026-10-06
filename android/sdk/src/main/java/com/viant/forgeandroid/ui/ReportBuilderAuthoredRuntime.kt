package com.viant.forgeandroid.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
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
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.coroutines.flow.first

internal fun reportBuilderAuthoredDocument(windowForm: Map<String, Any?>, stateKey: String? = null): JsonObject? =
    com.viant.forgeandroid.runtime.nativeReportSelectedDocument(JsonUtil.anyToElement(windowForm).jsonObject, stateKey)

internal fun reportBuilderAuthoredDatasetRefs(document: JsonObject): Set<String> {
    val refs = linkedSetOf<String>()
    fun visit(value: JsonElement) {
        when (value) {
            is JsonObject -> {
                (value["datasetRef"] as? JsonPrimitive)?.content?.trim()?.takeIf(String::isNotEmpty)?.let(refs::add)
                value.values.forEach(::visit)
            }
            is JsonArray -> value.forEach(::visit)
            else -> Unit
        }
    }
    visit(document)
    return refs
}

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
    val referencedInDocumentOrder = reportBuilderAuthoredDatasetRefs(document).filter { it != "primary" }
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
    val dimensions = request?.get("dimensions") as? JsonObject
    val limit = (request?.get("limit") as? JsonPrimitive)?.content?.toIntOrNull()
    return if (dimensions?.isEmpty() == true && limit != null && limit <= 1) 0 else 1
}

/** Catalog request fields define the dataset shape; active filters remain inherited. */
internal fun reportBuilderPublishedRequest(primaryRequest: Map<String, Any?>, declaration: ReportBuilderPublishedDataSourceDef): Map<String, Any?> {
    if (primaryRequest.isEmpty()) return emptyMap()
    val identity = com.viant.forgeandroid.runtime.ReportPreparationIdentity("legacy-helper", "", "", "")
    val prepared = com.viant.forgeandroid.runtime.PreparedReportRequest(identity, "ready", declaration.dataSourceRef, JsonUtil.anyToElement(primaryRequest).jsonObject)
    val result = com.viant.forgeandroid.runtime.preparePublishedReportRequest(identity, prepared, declaration)
    return result.request?.let { JsonUtil.asStringMap(JsonUtil.elementToAny(it)) }.orEmpty()
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
    runRequestId: String?,
    preparation: com.viant.forgeandroid.runtime.PreparedReportRequest,
    stateKey: String
) {
    val referencedDatasetRefs = remember(document) { reportBuilderAuthoredDatasetRefs(document) }
    val materializationStatus=JsonUtil.asStringMap(window.peekWindowForm()["reportMaterialization"])["status"]?.toString()
    val verifiedSavedRows=runtime.verifiedCompletedReportDatasets(window.windowId)
    val persistedRows = if(materializationStatus=="completed" && verifiedSavedRows==null) emptyMap() else reportBuilderPersistedDatasets(window.peekWindowForm(), config)
    val declarations = remember(config, document) { reportBuilderPublishedSources(config, document) }
    val contexts = declarations.mapNotNull { declaration ->
        window.contextForInstanceOrNull(
            instanceRef = "reportDocument:${declaration.id}",
            dataSourceRef = declaration.dataSourceRef
        )?.let { declaration to it }
    }
    val scoped = (preparation.state["reportDatasetScopeParams"] ?: preparation.state["datasetScopeParams"]) as? JsonObject
    val plans = contexts.map { (declaration, context) ->
        Triple(declaration, context, com.viant.forgeandroid.runtime.preparePublishedReportRequest(preparation.identity, preparation, declaration, scoped))
    }
    val admittedDatasets = plans.mapNotNull { (declaration, _, plan) -> plan.request?.takeIf { plan.status == "ready" }?.let {
        com.viant.forgeandroid.runtime.NativeReportDatasetAdmission(declaration.id, declaration.dataSourceRef, it)
    } } + if ("primary" in referencedDatasetRefs) listOf(com.viant.forgeandroid.runtime.NativeReportDatasetAdmission("primary", preparation.dataSourceRef, preparation.primaryRequest)) else emptyList()
    val rawAuthorState = preparation.capturedAuthorState
    val admission = com.viant.forgeandroid.runtime.NativeReportAdmission(preparation,
        runtime.windows.value.firstOrNull { it.windowId == window.windowId }?.conversationId.orEmpty(), stateKey, document, admittedDatasets,
        config.authoredConfiguration ?: JsonUtil.json.encodeToJsonElement(DashboardReportBuilderDef.serializer(), config).jsonObject,
        rawAuthorState ?: JsonObject(emptyMap()))
    val admissionEncodingError=remember(admission,rawAuthorState) {
        if(preparation.status=="ready" && rawAuthorState!=null) runCatching { com.viant.forgeandroid.runtime.nativeReportAdmissionContext(admission) }.exceptionOrNull()?.message else null
    }
    SideEffect {
        val frozen=runtime.frozenNativeReportAdmission(window.windowId,preparation.identity.builderRef,stateKey,admission.authoredConfiguration,document)
        if(frozen!=null) {
            val saved=(JsonUtil.anyToElement(window.peekWindowForm()["reportStaticDatasets"]) as? JsonArray).orEmpty().filterIsInstance<JsonObject>().associateBy { (it["id"] as? JsonPrimitive)?.content }
            frozen.admission.datasets.forEach { dataset ->
                val target=if(dataset.id=="primary") window.contextOrNull(dataset.dataSourceRef) else contexts.firstOrNull { it.first.id==dataset.id }?.second
                val rows=saved[dataset.id]?.get("rows") as? JsonArray
                if(target!=null && rows!=null) target.hydrateFrozenReportDataset(dataset,rows)
            }
            if(frozen.admission.datasets.none { it.id=="primary" }) window.contextOrNull(frozen.admission.preparation.dataSourceRef)?.hydrateFrozenReportPrimaryIdentity(frozen.admission.preparation)
        }
    }
    SideEffect {
        val failed = plans.firstOrNull { it.third.status == "error" }
        when {
            preparation.status != "ready" -> runtime.nativeReportLifecycle.publishStatus(preparation, preparation.status, preparation.reason)
            !runtime.reportPreparationIsCurrent(preparation) -> runtime.nativeReportLifecycle.publishStatus(preparation,"pending","The report preparation changed before admission publication.")
            rawAuthorState == null -> runtime.nativeReportLifecycle.publishStatus(preparation, "pending", "The selected report state has not been saved.")
            admissionEncodingError != null -> runtime.nativeReportLifecycle.publishStatus(preparation,"error","The report admission cannot be preserved: $admissionEncodingError")
            failed != null -> runtime.nativeReportLifecycle.publishStatus(preparation, "error", failed.third.reason ?: "The declared report dataset request is unsupported.")
            admittedDatasets.map { it.id }.toSet() != referencedDatasetRefs -> runtime.nativeReportLifecycle.publishStatus(preparation, "error", "The authored report references an unavailable dataset.")
            plans.all { it.third.status == "ready" } -> runtime.nativeReportLifecycle.publish(admission)
            else -> runtime.nativeReportLifecycle.publishStatus(preparation, "pending", "Waiting for declared report dataset requests.")
        }
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
    LaunchedEffect(preparation.identity, preparation.status, runRequestId) {
        if (runtime.reportRequestInspectionOnly || runRequestId.isNullOrBlank()) return@LaunchedEffect
        if (runtime.nativeReportLifecycle.completed(runRequestId) != null) return@LaunchedEffect
        val requestId = runRequestId.trim()
        val gate = com.viant.forgeandroid.runtime.preparedReportPrimaryGate(preparation.identity, preparation)
        if (gate.status == "pending") return@LaunchedEffect
        val handle = runtime.nativeReportLifecycle.handle(requestId)
        if (gate.status != "ready" || !runtime.reportPreparationIsCurrent(preparation) || handle == null) {
            if (gate.status != "pending") runtime.publishNativeReportMaterialization(window.windowId, requestId, "failed", emptyMap(), listOf(gate.reason ?: "Durable report admission is unavailable."))
            return@LaunchedEffect
        }
        fun current() = runtime.reportPreparationIsCurrent(preparation) &&
            JsonUtil.asStringMap(window.peekWindowForm()["reportRunRequest"])["id"]?.toString() == requestId
        if (handle.admission != admission || admittedDatasets.map { it.id }.toSet() != referencedDatasetRefs || plans.any { it.third.status != "ready" }) {
            runtime.publishNativeReportMaterialization(window.windowId, requestId, "failed", emptyMap(), listOf("The authored report does not match its admitted dataset requests."), handle.reportRunId)
            return@LaunchedEffect
        }
        runtime.nativeReportLifecycle.start(runtime.scope, handle, { current() },
            load = { dataset ->
                val context = if (dataset.id == "primary") window.context(preparation.dataSourceRef)
                    else contexts.firstOrNull { it.first.id == dataset.id }?.second ?: error("The admitted report dataset context is unavailable.")
                val dispatch = context.setPreparedInputParameters(JsonUtil.asStringMap(JsonUtil.elementToAny(dataset.request)), com.viant.forgeandroid.runtime.NativeReportReadPermit(handle.uiRunRequestId, dataset.id)) { current() }
                    ?: error("The report admission changed before loading data.")
                val result = context.awaitPreparedResult(dispatch)
                check(current()) { "The report admission changed while loading data." }
                result.error?.takeIf(String::isNotBlank)?.let { error(it) }
                val actualRows = (JsonUtil.elementToAny(result.rows) as? List<*>).orEmpty().map { JsonUtil.asStringMap(it) }
                JsonUtil.anyToElement(reportBuilderMaterializeComputedRows(actualRows, config)).jsonArray
            },
            onRunning = { runtime.publishNativeReportMaterialization(window.windowId, requestId, "running", emptyMap(), emptyList(), handle.reportRunId) },
            onCompleted = { completed, filled ->
                val loadedRows = filled.mapValues { (_, data) -> (JsonUtil.elementToAny(data) as? List<*>).orEmpty().map { JsonUtil.asStringMap(it) } }
                runtime.publishNativeReportMaterialization(window.windowId, requestId, "completed", loadedRows, emptyList(), completed.reportRunId, completed.contextStatus, completed.active, completed.activationError)
            },
            onFailure = { message -> runtime.publishNativeReportMaterialization(window.windowId, requestId, "failed", emptyMap(), listOf(message), handle.reportRunId) })

    }

    val activationError = JsonUtil.asStringMap(window.peekWindowForm()["reportMaterialization"])["activationError"]?.toString()?.takeIf(String::isNotBlank)
    activationError?.let { Text("Report saved. $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
    if(materializationStatus=="completed" && verifiedSavedRows==null) Text("The saved report data could not be verified. Reopen the report to restore it.",style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.error)

    val preparedDocument = remember(document) { materializeReportBuilderAuthoredDocument(document) }
    val artifact = remember(preparedDocument, rowsById.toMap(), primaryRequest, config.reportOptions) {
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
            ),
            reportOptions = config.reportOptions, optionValues = JsonUtil.asStringMap(primaryRequest["options"]).mapValues { JsonUtil.anyToElement(it.value) }
        )
    }
    val runtimeContainer = remember(artifact.metadata) {
        artifact.metadata.view?.content?.containers?.firstOrNull()
    }
    val pending = (persistedRows.isEmpty() && preparation.status == "pending") || controls.any { it.loading || !it.resolved }
    val hasMaterializedRows = rowsById.values.any { it.isNotEmpty() }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        val error = (if (persistedRows.isEmpty() && preparation.status == "error") preparation.reason else null) ?: controls.firstNotNullOfOrNull { it.error?.takeIf(String::isNotBlank) }
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
                    text = if (runRequestId.isNullOrBlank()) "Run the report to load its data." else "Loading report data…",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        // Do not turn an unresolved dataset into a definitive empty KPI/card.
        // Partial output remains useful after an explicit error, while a normal
        // in-flight request gets one honest loading state.
        if (runtimeContainer != null && !(materializationStatus=="completed" && verifiedSavedRows==null) && (hasMaterializedRows || !pending || error != null)) {
            DashboardReportRuntimeSurface(runtime, window, runtimeContainer, dashboardRoot)
        }
    }
}

private fun ForgeRuntime.publishNativeReportMaterialization(
    windowId: String,
    requestId: String,
    status: String,
    rowsById: Map<String, List<Map<String, Any?>>>,
    errors: List<String>,
    reportRunId: String? = null,
    contextStatus: String? = null,
    active: Boolean? = null,
    activationError: String? = null
) {
    val materialization = linkedMapOf<String, Any?>(
        "id" to requestId,
        "requestId" to requestId,
        "status" to status,
        "materialized" to (status == "completed"),
        "datasetRefs" to rowsById.keys.sorted(),
        "rowCounts" to rowsById.mapValues { it.value.size }
    )
    reportRunId?.let { materialization["reportRunId"] = it }
    contextStatus?.let { materialization["contextStatus"] = it; materialization["active"] = active }
    activationError?.let { materialization["activationError"] = it }
    if (errors.isNotEmpty()) materialization["errors"] = errors
    val values = linkedMapOf<String, Any?>("reportMaterialization" to materialization)
    if (status != "running") {
        val verified=if(status=="completed") nativeReportLifecycle.completedDatasets(requestId) else null
        val admitted=nativeReportLifecycle.handle(requestId)?.admission?.datasets?.associateBy { it.id }.orEmpty()
        values["reportStaticDatasets"] = verified?.let(JsonUtil::elementToAny) ?: rowsById.keys.sorted().map { id ->
            mapOf(
                "id" to id,
                "dataSourceRef" to (admitted[id]?.dataSourceRef ?: id),
                "request" to admitted[id]?.request?.let(JsonUtil::elementToAny),
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

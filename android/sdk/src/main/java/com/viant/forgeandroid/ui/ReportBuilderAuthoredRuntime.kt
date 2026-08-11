package com.viant.forgeandroid.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
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

internal fun reportBuilderAuthoredDocument(windowForm: Map<String, Any?>): JsonObject? {
    fun obj(value: Any?): JsonObject? = JsonUtil.anyToElement(value) as? JsonObject
    val reportDefinition = obj(windowForm["reportDefinition"])
    val candidates = listOf(
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

internal fun reportBuilderPublishedSources(
    config: DashboardReportBuilderDef,
    document: JsonObject
): List<ReportBuilderPublishedDataSourceDef> {
    val referenced = reportBuilderAuthoredDatasetRefs(document) - "primary"
    return config.dataSources.filter { it.id in referenced }
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
    primaryRequest: Map<String, Any?>
) {
    val declarations = remember(config, document) { reportBuilderPublishedSources(config, document) }
    val contexts = declarations.mapNotNull { declaration ->
        window.contextForInstanceOrNull(
            instanceRef = "reportDocument:${declaration.id}",
            dataSourceRef = declaration.dataSourceRef
        )?.let { declaration to it }
    }
    val rowsById = linkedMapOf("primary" to primaryRows)
    val controls = mutableListOf(primaryControl)
    contexts.forEach { (declaration, context) ->
        val rows by context.collection.flow.collectAsState(initial = context.collection.peek())
        val control by context.control.flow.collectAsState(initial = context.control.peek())
        rowsById[declaration.id] = rows
        controls += control
        val request = remember(primaryRequest, declaration) {
            reportBuilderPublishedRequest(primaryRequest, declaration)
        }
        LaunchedEffect(request) {
            if (request.isNotEmpty()) context.setInputParameters(request, fetch = true)
        }
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
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        val error = controls.firstNotNullOfOrNull { it.error?.takeIf(String::isNotBlank) }
        if (error != null) {
            Text(
                text = authoredReportLoadErrorMessage(error),
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFFB42318)
            )
        }
        if (runtimeContainer != null) {
            DashboardReportRuntimeSurface(runtime, window, runtimeContainer, dashboardRoot)
        }
    }
}

internal fun authoredReportLoadErrorMessage(error: String): String {
    val detail = error.trim()
    if (detail.contains("timeout", ignoreCase = true) ||
        detail.contains("timed out", ignoreCase = true)
    ) {
        return "Some report data did not respond. Try refreshing."
    }
    return if (detail.isBlank()) {
        "Some report data could not be loaded."
    } else {
        "Some report data could not be loaded: $detail"
    }
}

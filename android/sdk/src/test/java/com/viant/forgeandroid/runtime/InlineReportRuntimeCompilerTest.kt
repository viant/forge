package com.viant.forgeandroid.runtime

import com.viant.forgeandroid.ui.TranscriptCanonicalData
import com.viant.forgeandroid.ui.TranscriptCanonicalReport
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals

class InlineReportRuntimeCompilerTest {
    @Test
    fun compilesCanonicalPrimitivesIntoNativeReportRuntime() {
        val blocks = listOf(
            block("tabs", "tabGroupBlock"),
            block("overview", "sectionBlock"),
            JsonObject(mapOf(
                "id" to JsonPrimitive("kpi"), "kind" to JsonPrimitive("kpiBlock"),
                "datasetRef" to JsonPrimitive("rows"), "valueField" to JsonPrimitive("spend")
            )),
            JsonObject(mapOf(
                "id" to JsonPrimitive("table"), "kind" to JsonPrimitive("tableBlock"),
                "datasetRef" to JsonPrimitive("rows"),
                "columns" to JsonArray(listOf(JsonObject(mapOf("key" to JsonPrimitive("channel")))))
            )),
            block("chart", "chartBlock"),
            block("geo", "geoMapBlock"),
            block("findings", "collectionBlock"),
            block("timeline", "timelineBlock"),
            block("markdown", "markdownBlock"),
            block("filters", "filterBarBlock"),
            block("refinements", "refinementBarBlock"),
            block("badges", "badgesBlock"),
            block("composite", "compositeBlock"),
            block("stepper", "stepperBlock"),
            block("info", "infoPanelBlock"),
            block("callout", "calloutBlock"),
            block("kanban", "kanbanBlock")
        )
        val report = TranscriptCanonicalReport(
            scope = "message",
            id = "delivery",
            grammar = "report-document-v1",
            status = "committed",
            source = JsonObject(mapOf(
                "title" to JsonPrimitive("Delivery review"),
                "blocks" to JsonArray(blocks),
                "layout" to JsonObject(mapOf("items" to JsonArray(listOf(
                    JsonObject(mapOf("blockId" to JsonPrimitive("tabs"))),
                    JsonObject(mapOf("blockId" to JsonPrimitive("kpi"))),
                    JsonObject(mapOf("blockId" to JsonPrimitive("table")))
                ))))
            )),
            dataSources = mapOf(
                "rows" to TranscriptCanonicalData(
                    id = "rows",
                    payload = JsonArray(listOf(JsonObject(mapOf(
                        "channel" to JsonPrimitive("CTV"), "spend" to JsonPrimitive(125)
                    ))))
                )
            )
        )

        val artifact = InlineReportRuntimeCompiler.compile(report)
        val runtimeContainer = artifact.metadata.view?.content?.containers?.single()
        assertEquals("dashboard.reportRuntime", runtimeContainer?.kind)
        assertEquals(17, dashboardReportRuntimeSummary(runtimeContainer!!).blockCount)
        assertEquals(listOf("tabs", "kpi", "table"),
            ((artifact.reportSpec["layoutIntent"] as JsonObject)["blockOrder"] as JsonArray).map { it.toString().trim('"') })
        val kpi = (artifact.reportFill["blocks"] as JsonArray)
            .map { it as JsonObject }
            .single { it["id"] == JsonPrimitive("kpi") }
        assertEquals(JsonPrimitive(125), (kpi["content"] as JsonObject)["value"])
    }

    @Test
    fun extractsUnmaterializedWorkspaceRequests() {
        val report = TranscriptCanonicalReport(
            scope = "message",
            id = "delivery",
            grammar = "report-document-v1",
            status = "committed",
            source = JsonObject(mapOf(
                "datasets" to JsonArray(listOf(JsonObject(mapOf(
                    "id" to JsonPrimitive("delivery"), "kind" to JsonPrimitive("workspaceRef"),
                    "dataSourceRef" to JsonPrimitive("metrics_delivery"),
                    "request" to JsonObject(mapOf("orderId" to JsonPrimitive(42)))
                )))),
                "blocks" to JsonArray(emptyList())
            ))
        )
        assertEquals(
            listOf(InlineReportWorkspaceDatasetRequest("delivery", "metrics_delivery", mapOf("orderId" to JsonPrimitive(42)))),
            InlineReportRuntimeCompiler.workspaceDatasetRequests(report)
        )
    }

    @Test
    fun materializesCanonicalCsvData() {
        val report = TranscriptCanonicalReport(
            scope = "message",
            id = "csv-delivery",
            grammar = "report-document-v1",
            status = "committed",
            source = JsonObject(mapOf(
                "blocks" to JsonArray(listOf(JsonObject(mapOf(
                    "id" to JsonPrimitive("table"),
                    "kind" to JsonPrimitive("tableBlock"),
                    "datasetRef" to JsonPrimitive("rows")
                ))))
            )),
            dataSources = mapOf(
                "rows" to TranscriptCanonicalData(
                    id = "rows",
                    format = "csv",
                    payload = JsonPrimitive("channel,spend\n\"CTV, Premium\",125\nDisplay,75")
                )
            )
        )

        val artifact = InlineReportRuntimeCompiler.compile(report)
        val rows = (((artifact.reportFill["datasets"] as JsonArray).first() as JsonObject)["rows"] as JsonArray)
        assertEquals(2, rows.size)
        assertEquals(JsonPrimitive("CTV, Premium"), (rows[0] as JsonObject)["channel"])
        assertEquals(JsonPrimitive(125), (rows[0] as JsonObject)["spend"])
    }

    private fun block(id: String, kind: String) = JsonObject(mapOf(
        "id" to JsonPrimitive(id), "kind" to JsonPrimitive(kind)
    ))
}

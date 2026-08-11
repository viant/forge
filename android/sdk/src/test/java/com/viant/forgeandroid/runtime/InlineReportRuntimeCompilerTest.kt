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
            JsonObject(mapOf(
                "id" to JsonPrimitive("timeline"), "kind" to JsonPrimitive("timelineBlock"),
                "datasetRef" to JsonPrimitive("timelineRows"),
                "timeField" to JsonPrimitive("timestamp"),
                "titleField" to JsonPrimitive("event"),
                "descriptionField" to JsonPrimitive("detail"),
                "columns" to JsonArray(listOf(JsonObject(mapOf(
                    "key" to JsonPrimitive("impact"), "label" to JsonPrimitive("Impact")
                ))))
            )),
            block("markdown", "markdownBlock"),
            block("filters", "filterBarBlock"),
            block("refinements", "refinementBarBlock"),
            JsonObject(mapOf(
                "id" to JsonPrimitive("badges"), "kind" to JsonPrimitive("badgesBlock"),
                "datasetRef" to JsonPrimitive("rows"),
                "items" to JsonArray(listOf(JsonObject(mapOf(
                    "label" to JsonPrimitive("Status"),
                    "valueField" to JsonPrimitive("status"),
                    "rules" to JsonArray(listOf(JsonObject(mapOf(
                        "value" to JsonPrimitive("behind"),
                        "label" to JsonPrimitive("Behind"),
                        "tone" to JsonPrimitive("warning")
                    ))))
                ))))
            )),
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
                        "channel" to JsonPrimitive("CTV"), "spend" to JsonPrimitive(125),
                        "status" to JsonPrimitive("behind")
                    ))))
                ),
                "timelineRows" to TranscriptCanonicalData(
                    id = "timelineRows",
                    payload = JsonArray(listOf(JsonObject(mapOf(
                        "timestamp" to JsonPrimitive("2026-08-09"),
                        "event" to JsonPrimitive("Pacing mode changed"),
                        "detail" to JsonPrimitive("ASAP changed to spend-evenly."),
                        "impact" to JsonPrimitive("Primary incident contributor")
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
        val badges = (artifact.reportFill["blocks"] as JsonArray)
            .map { it as JsonObject }
            .single { it["id"] == JsonPrimitive("badges") }
        val badge = (((badges["content"] as JsonObject)["items"] as JsonArray).single() as JsonObject)
        assertEquals(JsonPrimitive("behind"), badge["value"])
        assertEquals(JsonPrimitive("Behind"), badge["displayValue"])
        assertEquals(JsonPrimitive("warning"), badge["tone"])
        val timeline = (artifact.reportFill["blocks"] as JsonArray)
            .map { it as JsonObject }
            .single { it["id"] == JsonPrimitive("timeline") }
        val event = ((((timeline["content"] as JsonObject)["events"] as JsonArray).single()) as JsonObject)
        assertEquals(JsonPrimitive("2026-08-09"), event["date"])
        assertEquals(JsonPrimitive("Pacing mode changed"), event["title"])
        assertEquals(
            JsonPrimitive("ASAP changed to spend-evenly.\n\nImpact: Primary incident contributor"),
            event["body"]
        )
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

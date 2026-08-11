package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.DashboardReportBuilderDef
import com.viant.forgeandroid.runtime.ReportBuilderPublishedDataSourceDef
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class ReportBuilderAuthoredRuntimeTest {
    @Test
    fun persistedDocumentPatchAndOnlyReferencedCatalogDatasetsAreResolved() {
        val document = mapOf(
            "title" to "Order performance",
            "blocks" to listOf(
                mapOf("id" to "overview", "kind" to "sectionBlock"),
                mapOf("id" to "summary", "kind" to "kpiBlock", "datasetRef" to "delivery_summary_active_range"),
                mapOf("id" to "primaryTable", "kind" to "tableBlock", "datasetRef" to "primary")
            )
        )
        val resolved = reportBuilderAuthoredDocument(
            mapOf("reportDefinition" to mapOf("documentPatch" to document))
        )
        assertNotNull(resolved)
        assertEquals(setOf("delivery_summary_active_range", "primary"), reportBuilderAuthoredDatasetRefs(resolved))

        val sources = reportBuilderPublishedSources(
            DashboardReportBuilderDef(dataSources = listOf(
                ReportBuilderPublishedDataSourceDef("primary", "cube"),
                ReportBuilderPublishedDataSourceDef("delivery_summary_active_range", "cube"),
                ReportBuilderPublishedDataSourceDef("unused_daily", "cube")
            )),
            resolved
        )
        assertEquals(listOf("delivery_summary_active_range"), sources.map { it.id })
    }

    @Test
    fun catalogShapeOverridesPrimaryWhileFiltersRemainScoped() {
        val request = reportBuilderPublishedRequest(
            primaryRequest = mapOf(
                "measures" to mapOf("clicks" to true),
                "dimensions" to mapOf("channelId" to true),
                "filters" to mapOf("orderIds" to listOf(2676237), "From" to "2026-08-03")
            ),
            declaration = ReportBuilderPublishedDataSourceDef(
                id = "daily",
                dataSourceRef = "cube",
                request = JsonObject(mapOf(
                    "measures" to JsonObject(mapOf("totalSpend" to JsonPrimitive(true))),
                    "dimensions" to JsonObject(mapOf("eventDate" to JsonPrimitive(true))),
                    "filters" to JsonObject(emptyMap()),
                    "limit" to JsonPrimitive(366)
                ))
            )
        )
        assertEquals(mapOf("totalSpend" to true), request["measures"])
        assertEquals(mapOf("eventDate" to true), request["dimensions"])
        assertEquals(mapOf("orderIds" to listOf(2676237), "From" to "2026-08-03"), request["filters"])
        assertEquals(366L, request["limit"])
    }

    @Test
    fun authoredChartSpecBecomesNativeChartModel() {
        val document = JsonObject(mapOf(
            "blocks" to JsonArray(listOf(JsonObject(mapOf(
                "id" to JsonPrimitive("trend"),
                "kind" to JsonPrimitive("chartBlock"),
                "title" to JsonPrimitive("Spend trend"),
                "chartSpec" to JsonObject(mapOf(
                    "type" to JsonPrimitive("line"),
                    "xField" to JsonPrimitive("eventDate"),
                    "yFields" to JsonArray(listOf(JsonPrimitive("totalSpend")))
                ))
            ))))
        ))
        val block = (materializeReportBuilderAuthoredDocument(document)["blocks"] as JsonArray).first() as JsonObject
        assertTrue(block["chartModel"] is JsonObject)
    }
}

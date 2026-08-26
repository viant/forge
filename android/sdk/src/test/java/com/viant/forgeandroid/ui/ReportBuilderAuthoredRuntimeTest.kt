package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.DashboardReportBuilderDef
import com.viant.forgeandroid.runtime.ReportBuilderPublishedDataSourceDef
import com.viant.forgeandroid.runtime.ReportBuilderMeasureDef
import com.viant.forgeandroid.runtime.ReportBuilderComputeDef
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class ReportBuilderAuthoredRuntimeTest {
    @Test
    fun builderStateBlocksReplaceDepthLimitedDefinitionBlocks() {
        val resolved = reportBuilderAuthoredDocument(
            mapOf(
                "reportDefinition" to mapOf(
                    "documentPatch" to mapOf(
                        "title" to "Performance",
                        "blocks" to listOf(
                            mapOf(
                                "id" to "trend",
                                "kind" to "chartBlock",
                                "chartSpec" to mapOf("yFields" to listOf("[MaxDepth]"))
                            )
                        )
                    )
                ),
                "reportBuilder:metricsCubeBuilder" to mapOf(
                    "reportDocumentBlocks" to listOf(
                        mapOf(
                            "id" to "trend",
                            "kind" to "chartBlock",
                            "chartSpec" to mapOf("yFields" to listOf("totalSpend"))
                        )
                    )
                )
            )
        )

        assertNotNull(resolved)
        assertEquals("Performance", (resolved["title"] as JsonPrimitive).content)
        val block = (resolved["blocks"] as JsonArray).first() as JsonObject
        val spec = block["chartSpec"] as JsonObject
        assertEquals(
            "totalSpend",
            ((spec["yFields"] as JsonArray).first() as JsonPrimitive).content
        )
    }

    @Test
    fun authoredReportTimeoutUsesActionableCopy() {
        assertEquals(
            "Some report data did not respond. Try refreshing.",
            authoredReportLoadErrorMessage("timeout")
        )
    }

    @Test
    fun authoredReportGatewayErrorDoesNotExposeUrlOrHtml() {
        assertEquals(
            "Report data took too long to load. Try refreshing.",
            authoredReportLoadErrorMessage(
                "POST https://example.test/fetch failed: 504: <html>Gateway Time-out</html>"
            )
        )
    }

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
    fun aggregateDatasetIsHydratedBeforeDetailedDatasets() {
        val document = JsonObject(mapOf(
            "blocks" to JsonArray(listOf(
                JsonObject(mapOf("datasetRef" to JsonPrimitive("daily"))),
                JsonObject(mapOf("datasetRef" to JsonPrimitive("summary")))
            ))
        ))
        val detailed = ReportBuilderPublishedDataSourceDef(
            id = "daily",
            dataSourceRef = "cube",
            request = JsonObject(mapOf(
                "dimensions" to JsonObject(mapOf("eventDate" to JsonPrimitive(true))),
                "limit" to JsonPrimitive(366)
            ))
        )
        val summary = ReportBuilderPublishedDataSourceDef(
            id = "summary",
            dataSourceRef = "cube",
            request = JsonObject(mapOf(
                "dimensions" to JsonObject(emptyMap()),
                "limit" to JsonPrimitive(1)
            ))
        )

        assertEquals(
            listOf("summary", "daily"),
            reportBuilderPublishedSources(
                DashboardReportBuilderDef(dataSources = listOf(detailed, summary)),
                document
            ).map { it.id }
        )
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

    @Test
    fun computedRowsUsePublishedMeasureFormula() {
        val rows = reportBuilderMaterializeComputedRows(
            rows = listOf(mapOf("clicks" to 20, "impressions" to 1_000, "totalSpend" to 15)),
            config = DashboardReportBuilderDef(computedMeasures = listOf(
                ReportBuilderMeasureDef(
                    key = "ctr",
                    compute = ReportBuilderComputeDef(type = "ratio", numerator = "clicks", denominator = "impressions")
                ),
                ReportBuilderMeasureDef(
                    key = "ecpm",
                    compute = ReportBuilderComputeDef(type = "ratio", numerator = "totalSpend", denominator = "impressions", scale = 1_000.0)
                )
            ))
        )
        assertEquals(0.02, rows.first()["ctr"])
        assertEquals(15.0, rows.first()["ecpm"])
    }
}

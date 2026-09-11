package com.viant.forgeandroid.runtime

import java.io.File
import kotlinx.serialization.json.*
import kotlin.test.*

class ReportRuntimeStructureTest {
    @Test fun sharedCompositeOwnershipContract() {
        val root = generateSequence(File(System.getProperty("user.dir"))) { it.parentFile }
            .first { File(it, "src/reporting/fixtures/report-runtime-structure-conformance.v1.json").exists() }
        val fixture = Json.parseToJsonElement(File(root, "src/reporting/fixtures/report-runtime-structure-conformance.v1.json").readText()).jsonObject
        for (scenario in fixture["cases"]!!.jsonArray.map { it.jsonObject }) {
            val blocks = dashboardReportRuntimeBlocks(scenario["blocks"]!!.jsonArray)
            assertEquals(scenario["parents"], JsonObject(blocks.mapNotNull { block -> block.compositeParentId?.let { block.id to JsonPrimitive(it) } }.toMap()))
            assertEquals(scenario["roots"], JsonArray(blocks.filter { it.compositeParentId == null }.map { JsonPrimitive(it.id) }))
            blocks.forEach { block -> assertTrue(block.children.all { it.compositeParentId == block.id }) }
        }
    }
}

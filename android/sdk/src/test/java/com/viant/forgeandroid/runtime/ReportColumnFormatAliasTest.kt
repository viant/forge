package com.viant.forgeandroid.runtime

import com.viant.forgeandroid.ui.TranscriptCanonicalData
import com.viant.forgeandroid.ui.TranscriptCanonicalReport
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class ReportColumnFormatAliasTest {
    private fun column(format:String?=null,alias:String?=null)=buildJsonObject { put("key","observed");format?.let { put("format",it) };alias?.let { put("valueFormat",it) } }
    @Test fun canonicalNonemptyFormatWinsAndAliasUsesExistingPercentFractionFormatter() {
        val aliased=dashboardReportRuntimeColumns(listOf(column(alias="percentFraction"))).single()
        assertEquals("percentFraction",aliased.format);assertEquals("19.4%",formatDashboardValue(0.1937,aliased.format))
        assertEquals("number2",dashboardReportRuntimeColumns(listOf(column("number2","percentFraction"))).single().format)
        assertEquals("percentFraction",dashboardReportRuntimeColumns(listOf(column("  ","percentFraction"))).single().format)
        assertEquals("unknown",dashboardReportRuntimeColumns(listOf(column("unknown","percentFraction"))).single().format)
        assertEquals("0.1937",formatDashboardValue(0.1937,"unknown"))
        assertNull(dashboardReportRuntimeColumns(listOf(column())).single().format)
    }
    @Test fun storedReportDocumentAndSpecKeepOriginalAliasWhileReaderFormatsIt() {
        val columns=JsonArray(listOf(column(alias="percentFraction")))
        val source=buildJsonObject { put("blocks",JsonArray(listOf(buildJsonObject { put("id","table");put("kind","tableBlock");put("datasetRef","rows");put("columns",columns) }))) }
        val report=TranscriptCanonicalReport(scope="message",id="report",grammar="report-document-v1",status="committed",source=source,
            dataSources=mapOf("rows" to TranscriptCanonicalData(id="rows",payload=JsonArray(listOf(buildJsonObject { put("observed",0.1937) })))))
        val artifact=InlineReportRuntimeCompiler.compile(report)
        assertEquals(columns,artifact.reportSpec.getValue("blocks").jsonArray.single().jsonObject["columns"])
        assertEquals(columns,source.getValue("blocks").jsonArray.single().jsonObject["columns"])
        val reader=dashboardReportRuntimeSummary(artifact.metadata.view!!.content!!.containers.single()).blocks.single().table!!.columns.single()
        assertEquals("percentFraction",reader.format)
    }
    @Test fun inlineDashboardAdapterHonorsAliasAndCanonicalPrecedence() {
        val source=buildJsonObject { put("kind","dashboard.table");put("dataSourceRef","rows");put("columns",JsonArray(listOf(column(alias="percentFraction"),buildJsonObject { put("key","target");put("format","number2");put("valueFormat","percentFraction") }))) }
        val artifact=InlineReportRuntimeCompiler.compile(TranscriptCanonicalReport(scope="message",id="report",grammar="dashboard-v1",status="committed",source=buildJsonObject { put("blocks",JsonArray(listOf(source))) },
            dataSources=mapOf("rows" to TranscriptCanonicalData(id="rows",payload=JsonArray(listOf(buildJsonObject { put("observed",0.2);put("target",0.3) }))))))
        val columns=artifact.reportSpec.getValue("blocks").jsonArray.single().jsonObject.getValue("columns").jsonArray
        assertEquals(JsonPrimitive("percentFraction"),columns[0].jsonObject["format"]);assertEquals(JsonPrimitive("number2"),columns[1].jsonObject["format"])
    }
}

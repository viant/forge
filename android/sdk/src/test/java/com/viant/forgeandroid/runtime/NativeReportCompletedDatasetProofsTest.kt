package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class NativeReportCompletedDatasetProofsTest {
    @Test fun legacyProofRetainsFullImmutableSavedDatasetsAndCannotGrantAnAcknowledgment() {
        var account=NativeReportAccountBinding("owner",1)
        val proof=NativeReportCompletedDatasetProofs { account }
        val backing=mutableListOf<JsonElement>(buildJsonObject { put("value",1) })
        val datasets=JsonArray(listOf(buildJsonObject { put("id","summary");put("dataSourceRef","cube");put("request",buildJsonObject { put("limit",1) });put("rows",JsonArray(backing));put("provenance",buildJsonObject { put("unknown","preserved") }) }))
        fun form(saved:JsonArray=datasets)=buildJsonObject { put("reportMaterialization",buildJsonObject { put("status","completed");put("reportRunId","saved") });put("reportStaticDatasets",saved) }
        assertTrue(proof.install("W","conversation","saved","owner",datasets,account) { _,_ -> true })
        assertEquals(datasets,proof.verified("W","conversation",form(),null))
        backing[0]=buildJsonObject { put("value",999) }
        assertNull(proof.verified("W","conversation",form(),null))
        account=account.copy(generation=2)
        assertNull(proof.verified("W","conversation",form(),null))
    }
}

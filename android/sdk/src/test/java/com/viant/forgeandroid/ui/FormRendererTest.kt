package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.ItemDef
import kotlin.test.Test
import kotlin.test.assertEquals

class FormRendererTest {
    @Test
    fun `label display applies authored formats without changing raw form values`() {
        val cpm = ItemDef(
            id = "selectedCPM",
            dataField = "periodSummary.periodEcpm",
            scope = "metrics",
            format = "currency2"
        )
        val ctr = ItemDef(
            id = "selectedCTR",
            dataField = "periodSummary.periodCtr",
            scope = "metrics",
            format = "percentFraction"
        )
        val metrics = mapOf(
            "periodSummary" to mapOf(
                "periodEcpm" to 3.5,
                "periodCtr" to 0.069
            )
        )

        assertEquals(
            "$3.50",
            resolveItemDisplayValue(cpm, cpm.dataField!!, emptyMap(), metrics, emptyMap())
        )
        assertEquals(
            "6.9%",
            resolveItemDisplayValue(ctr, ctr.dataField!!, emptyMap(), metrics, emptyMap())
        )
        assertEquals(
            "3.5",
            resolveItemValue(cpm, cpm.dataField!!, emptyMap(), metrics, emptyMap())
        )
    }
}

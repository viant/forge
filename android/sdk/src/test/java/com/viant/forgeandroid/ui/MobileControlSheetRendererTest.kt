package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.ItemDef
import com.viant.forgeandroid.runtime.OptionDef
import org.junit.Assert.assertEquals
import org.junit.Test

class MobileControlSheetRendererTest {
    @Test
    fun `summary uses authored option labels in control order`() {
        val items = listOf(
            ItemDef(id = "periodView", options = listOf(OptionDef(value = "30d", label = "30 days"))),
            ItemDef(id = "granularity", options = listOf(OptionDef(value = "day", label = "Daily")))
        )

        assertEquals(
            "30 days · Daily",
            mobileControlSheetSummary(mapOf("periodView" to "30d", "granularity" to "day"), items)
        )
    }
}

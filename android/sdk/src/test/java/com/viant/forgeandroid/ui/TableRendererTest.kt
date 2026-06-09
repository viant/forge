package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.ColumnDef
import com.viant.forgeandroid.runtime.LinkDef
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull

class TableRendererTest {

    @Test
    fun `resolveColumnLinkTargetFromContext builds window target from row metadata`() {
        val column = ColumnDef(
            id = "adOrderName",
            type = "link",
            link = LinkDef(
                kind = "window",
                windowKey = "order",
                windowTitleSource = "row",
                windowTitleTemplate = "{{adOrderName}} ({{adOrderId}})",
                parameters = mapOf(
                    "AdOrderId" to buildJsonObject {
                        put("source", "row")
                        put("selector", "adOrderId")
                        put("wrap", "array")
                    }
                )
            )
        )

        val target = resolveColumnLinkTargetFromContext(
            column = column,
            context = LinkResolutionContext(
                row = mapOf(
                    "adOrderId" to 2660900,
                    "adOrderName" to "OLV_BAU_AUS"
                ),
                value = "OLV_BAU_AUS"
            )
        )

        val window = assertIs<WindowLinkTarget>(target)
        assertEquals("order", window.windowKey)
        assertEquals("OLV_BAU_AUS (2660900)", window.title)
        assertEquals(listOf(2660900), window.parameters["AdOrderId"])
    }

    @Test
    fun `resolveLinkWindowTitleFromContext renders metrics template without row inference`() {
        val title = resolveLinkWindowTitleFromContext(
            link = LinkDef(
                windowKey = "order",
                windowTitleSource = "metrics",
                windowTitleTemplate = "{{adOrderName}} ({{adOrderId}})"
            ),
            context = LinkResolutionContext(
                metrics = mapOf(
                    "adOrderId" to 2660900,
                    "adOrderName" to "OLV_BAU_AUS"
                )
            ),
            fallbackTitle = "Order"
        )

        assertEquals("OLV_BAU_AUS (2660900)", title)
    }

    @Test
    fun `resolveColumnLinkTargetFromContext rejects window links without a key`() {
        val column = ColumnDef(
            id = "broken",
            type = "link",
            link = LinkDef(kind = "window")
        )

        val target = resolveColumnLinkTargetFromContext(
            column = column,
            context = LinkResolutionContext(
                row = mapOf("broken" to "Open"),
                value = "Open"
            )
        )

        assertNull(target)
    }
}

package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.ColumnDef
import com.viant.forgeandroid.runtime.LinkDef
import com.viant.forgeandroid.runtime.TableDef
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
    fun `resolveLinkWindowTitleFromContext uses display strings for arrays maps and numbers`() {
        val title = resolveLinkWindowTitleFromContext(
            link = LinkDef(
                windowKey = "order",
                windowTitleSource = "metrics",
                windowTitleTemplate = "{{names}} · {{score}} · {{details}}"
            ),
            context = LinkResolutionContext(
                metrics = mapOf(
                    "names" to listOf("Alpha", "Beta"),
                    "score" to 42.0,
                    "details" to mapOf("rank" to 2, "status" to "Ready")
                )
            ),
            fallbackTitle = "Order"
        )

        assertEquals("Alpha, Beta · 42 · rank: 2, status: Ready", title)
    }

    @Test
    fun `resolveColumnLinkTargetFromContext uses display string fallback title`() {
        val column = ColumnDef(
            id = "segments",
            label = "Segments",
            type = "link",
            link = LinkDef(kind = "window", windowKey = "segment")
        )

        val target = resolveColumnLinkTargetFromContext(
            column = column,
            context = LinkResolutionContext(value = listOf("CTV", "Audio"))
        )

        val window = assertIs<WindowLinkTarget>(target)
        assertEquals("CTV, Audio", window.title)
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

    @Test
    fun `sortedTableRows sorts numbers and preserves original row index`() {
        val rows = listOf(
            mapOf("name" to "Charlie", "rank" to 3),
            mapOf("name" to "alpha", "rank" to 1),
            mapOf("name" to "Bravo", "rank" to 2)
        )

        val sorted = sortedTableRows(rows, "rank", ascending = true)

        assertEquals(listOf(1, 2, 0), sorted.map { it.originalIndex })
        assertEquals(listOf(1, 2, 3), sorted.map { it.row["rank"] })
    }

    @Test
    fun `sortedTableRows sorts strings case insensitively and handles nulls`() {
        val rows = listOf(
            mapOf("name" to "delta"),
            mapOf("name" to null),
            mapOf("name" to "Alpha"),
            mapOf("name" to "bravo")
        )

        val ascending = sortedTableRows(rows, "name", ascending = true)
        val descending = sortedTableRows(rows, "name", ascending = false)

        assertEquals(listOf(1, 2, 3, 0), ascending.map { it.originalIndex })
        assertEquals(listOf(0, 3, 2, 1), descending.map { it.originalIndex })
    }

    @Test
    fun `tableRowAccessibilityLabel summarizes visible columns`() {
        val table = TableDef(
            columns = listOf(
                ColumnDef(id = "name", label = "Name"),
                ColumnDef(id = "rank", label = "Rank"),
                ColumnDef(id = "status", label = "Status", emptyText = "Unknown"),
                ColumnDef(id = "open", type = "button", label = "Open")
            )
        )

        val label = tableRowAccessibilityLabel(
            table = table,
            row = mapOf("name" to "Alpha", "rank" to 2, "status" to null)
        )

        assertEquals("Name Alpha, Rank 2, Status Unknown", label)
    }

    @Test
    fun `tableRowAccessibilityLabel respects custom limit`() {
        val table = TableDef(
            columns = listOf(
                ColumnDef(id = "name", label = "Name"),
                ColumnDef(id = "rank", label = "Rank"),
                ColumnDef(id = "status", label = "Status")
            )
        )

        val label = tableRowAccessibilityLabel(
            table = table,
            row = mapOf("name" to "Alpha", "rank" to 2, "status" to "Ready"),
            limit = 2
        )

        assertEquals("Name Alpha, Rank 2", label)
    }

    @Test
    fun `tableRefreshControlVisible only allows runtime datasource rows`() {
        assertEquals(true, tableRefreshControlVisible("orders", usesProvidedRows = false))
        assertEquals(false, tableRefreshControlVisible("orders", usesProvidedRows = true))
        assertEquals(false, tableRefreshControlVisible("  ", usesProvidedRows = false))
    }

    @Test
    fun `tableRefreshFeedback uses datasource control state`() {
        assertEquals(
            TableRefreshFeedback(busy = true, message = null),
            tableRefreshFeedback(loading = true, error = null)
        )
        assertEquals(
            TableRefreshFeedback(busy = false, message = "Timeout"),
            tableRefreshFeedback(loading = false, error = "  Timeout  ")
        )
        assertEquals(
            TableRefreshFeedback(busy = false, message = null),
            tableRefreshFeedback(loading = false, error = "  ")
        )
    }
}

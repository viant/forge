package com.viant.forgeandroid.ui

import androidx.compose.ui.text.font.FontWeight
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class MarkdownRendererTest {

    @Test
    fun `inline markdown preserves emphasis while removing transport markers`() {
        val text = inlineMarkdownAnnotatedString("Delivery is **blocked**; inspect `bid_count`.")

        assertEquals("Delivery is blocked; inspect bid_count.", text.text)
        assertTrue(text.spanStyles.any { it.item.fontWeight == FontWeight.Bold })
    }

    @Test
    fun `markdownCodeHighlightRuns classifies json tokens`() {
        val runs = markdownCodeHighlightRuns("json", """{"ok": true, "count": 42}""")

        assertTrue(runs.contains(MarkdownCodeHighlightRun("\"ok\"", MarkdownCodeHighlightKind.String)))
        assertTrue(runs.contains(MarkdownCodeHighlightRun("true", MarkdownCodeHighlightKind.Literal)))
        assertTrue(runs.contains(MarkdownCodeHighlightRun("42", MarkdownCodeHighlightKind.Number)))
        assertTrue(runs.any { it.kind == MarkdownCodeHighlightKind.Punctuation && it.text.contains("{") })
    }

    @Test
    fun `markdownCodeHighlightRuns classifies kotlin keywords and comments`() {
        val runs = markdownCodeHighlightRuns("kotlin", "val total = 3 // count")

        assertTrue(runs.contains(MarkdownCodeHighlightRun("val", MarkdownCodeHighlightKind.Keyword)))
        assertTrue(runs.contains(MarkdownCodeHighlightRun("3", MarkdownCodeHighlightKind.Number)))
        assertTrue(runs.contains(MarkdownCodeHighlightRun("// count", MarkdownCodeHighlightKind.Comment)))
    }

    @Test
    fun `markdown code copy labels use normalized fence language`() {
        assertEquals("TYPESCRIPT", markdownCodeLanguageLabel("ts"))
        assertEquals("CODE", markdownCodeLanguageLabel(""))
        assertEquals("Copy typescript code block", markdownCodeCopyAccessibilityLabel("ts"))
        assertEquals("Copy code block", markdownCodeCopyAccessibilityLabel(""))
    }

    @Test
    fun `two column markdown tables fit the mobile viewport`() {
        assertTrue(markdownTableFitsViewport(2))
        assertEquals(1.35f, markdownTableColumnWeight(0, 2))
        assertEquals(0.85f, markdownTableColumnWeight(1, 2))
        assertTrue(!markdownTableFitsViewport(3))
    }

    @Test
    fun `markdown table rows are padded to the header width`() {
        assertEquals(
            listOf("Agriculture", "`1476373`"),
            normalizedMarkdownTableRow(listOf("Agriculture", "`1476373`"), 2)
        )
        assertEquals(
            listOf("Agriculture", ""),
            normalizedMarkdownTableRow(listOf("Agriculture"), 2)
        )
    }
}

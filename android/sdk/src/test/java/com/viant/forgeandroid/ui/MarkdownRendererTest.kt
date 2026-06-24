package com.viant.forgeandroid.ui

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class MarkdownRendererTest {

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
}

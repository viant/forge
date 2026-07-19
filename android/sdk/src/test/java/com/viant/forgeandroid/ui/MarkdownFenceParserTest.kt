package com.viant.forgeandroid.ui

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class MarkdownFenceParserTest {

    @Test
    fun `segments adjacent fences and preserves surrounding text`() {
        val parts = MarkdownFenceParser.parse(
            "before```forge-data{\"id\":\"rows\"}```between```forge-ui\n{\"blocks\":[]}\n```after"
        )

        assertEquals(5, parts.size)
        assertEquals("before", assertIs<MarkdownFencePart.Text>(parts[0]).value)
        assertEquals("forge-data", assertIs<MarkdownFencePart.Fence>(parts[1]).language)
        assertEquals("{\"id\":\"rows\"}", assertIs<MarkdownFencePart.Fence>(parts[1]).body)
        assertEquals("between", assertIs<MarkdownFencePart.Text>(parts[2]).value)
        assertEquals("forge-ui", assertIs<MarkdownFencePart.Fence>(parts[3]).language)
        assertEquals("after", assertIs<MarkdownFencePart.Text>(parts[4]).value)
    }

    @Test
    fun `keeps malformed marker as text and reports an unfinished fence`() {
        val malformed = MarkdownFenceParser.parse("start```forge-ui invalid```end")
        assertEquals(1, malformed.size)
        assertEquals("start```forge-ui invalid```end", assertIs<MarkdownFencePart.Text>(malformed.single()).value)

        val unfinished = MarkdownFenceParser.parse("start```forge-ui\n{\"blocks\":[]}")
        assertEquals("start", assertIs<MarkdownFencePart.Text>(unfinished[0]).value)
        val fence = assertIs<MarkdownFencePart.Fence>(unfinished[1])
        assertEquals(false, fence.closed)
        assertEquals("forge-ui", fence.language)
    }

    @Test
    fun `preserves a fenced header before the payload`() {
        val parts = MarkdownFenceParser.parse("```forge-data id=\"summary_metrics\"\n[{\"label\":\"Spend\"}]\n```")

        val fence = assertIs<MarkdownFencePart.Fence>(parts.single())
        assertEquals("forge-data", fence.language)
        assertEquals("id=\"summary_metrics\"", fence.header)
        assertEquals("[{\"label\":\"Spend\"}]\n", fence.body)
    }

    @Test
    fun `parses quoted and unquoted header attributes`() {
        assertEquals(
            mapOf("id" to "summary_metrics", "mode" to "append", "format" to "json"),
            MarkdownFenceHeader.attributes("id=\"summary_metrics\" mode=append format='json'")
        )
    }

    @Test
    fun `does not close a compact JSON fence inside a string value`() {
        val parts = MarkdownFenceParser.parse(
            "```forge-data{\"id\":\"rows\",\"data\":[{\"note\":\"contains ``` text\"}]}```"
        )

        val fence = assertIs<MarkdownFencePart.Fence>(parts.single())
        assertEquals(true, fence.closed)
        assertEquals("{\"id\":\"rows\",\"data\":[{\"note\":\"contains ``` text\"}]}", fence.body)
    }
}

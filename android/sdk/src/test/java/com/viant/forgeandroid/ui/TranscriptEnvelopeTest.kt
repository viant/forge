package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.WindowMetadata
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlinx.serialization.json.Json

class TranscriptEnvelopeTest {
    @Test
    fun `materializes quoted multiline CSV`() {
        val parts = TranscriptEnvelope.parse("""
            ```forge-data id=rows format=csv
            name,note
            one,"line 1
            line 2"
            ```
            ```forge-ui
            {"blocks":[]}
            ```
        """.trimIndent())

        val ui = assertIs<TranscriptEnvelopePart.ForgeUi>(parts.single())
        val row = TranscriptEnvelope.rows(ui.dataStore.getValue("rows").rows).single()
        assertEquals("line 1\nline 2", row["note"])
    }

    @Test
    fun `preserves malformed CSV payload instead of silently dropping it`() {
        val parts = TranscriptEnvelope.parse("""
            ```forge-data id=rows format=csv
            name,name
            one,two
            ```
            ```forge-ui
            {"blocks":[]}
            ```
        """.trimIndent())

        val ui = assertIs<TranscriptEnvelopePart.ForgeUi>(parts.single())
        assertEquals("name,name\none,two\n", ui.dataStore.getValue("rows").rows)
    }

    @Test
    fun `preserves whitespace only markdown`() {
        assertEquals(listOf(TranscriptEnvelopePart.Markdown(" \n")), TranscriptEnvelope.parse(" \n"))
    }

    @Test
    fun `preserves structured data fence with a blank identifier`() {
        val content = """
            ```forge-data
            {"id":"","data":[{"name":"ignored"}]}
            ```
        """.trimIndent()

        assertEquals(listOf(TranscriptEnvelopePart.Markdown(content)), TranscriptEnvelope.parse(content))
    }

    @Test
    fun `uses a legacy header identifier for a JSON row with a blank id`() {
        val parts = TranscriptEnvelope.parse("""
            ```forge-data id=rows
            {"id":"","name":"kept"}
            ```
            ```forge-ui
            {"blocks":[]}
            ```
        """.trimIndent())

        val ui = assertIs<TranscriptEnvelopePart.ForgeUi>(parts.single())
        assertEquals("kept", TranscriptEnvelope.rows(ui.dataStore.getValue("rows").rows).single()["name"])
    }

    @Test
    fun `scopes data to the immediately adjacent ui fence while allowing formatting whitespace`() {
        val parts = TranscriptEnvelope.parse("""
            ```forge-data id=rows
            [{"name":"kept"}]
            ```

            ```forge-ui
            {"blocks":[]}
            ```
        """.trimIndent())

        val ui = assertIs<TranscriptEnvelopePart.ForgeUi>(parts.single())
        assertEquals("kept", TranscriptEnvelope.rows(ui.dataStore.getValue("rows").rows).single()["name"])
    }

    @Test
    fun `does not carry data across intervening markdown`() {
        val parts = TranscriptEnvelope.parse("""
            ```forge-data id=rows
            [{"name":"stale"}]
            ```
            This explanation separates the data from the UI.
            ```forge-ui
            {"blocks":[]}
            ```
        """.trimIndent())

        assertEquals(2, parts.size)
        val markdown = assertIs<TranscriptEnvelopePart.Markdown>(parts.first())
        assertEquals(true, markdown.text.contains("forge-data"))
        val ui = assertIs<TranscriptEnvelopePart.ForgeUi>(parts.last())
        assertEquals(emptyMap<String, TranscriptForgeDataStore>(), ui.dataStore)
    }

    @Test
    fun `does not carry data across a malformed ui fence`() {
        val parts = TranscriptEnvelope.parse("""
            ```forge-data id=rows
            [{"name":"stale"}]
            ```
            ```forge-ui
            not json
            ```
            ```forge-ui
            {"blocks":[]}
            ```
        """.trimIndent())

        assertEquals(2, parts.size)
        assertIs<TranscriptEnvelopePart.Markdown>(parts.first())
        val ui = assertIs<TranscriptEnvelopePart.ForgeUi>(parts.last())
        assertEquals(emptyMap<String, TranscriptForgeDataStore>(), ui.dataStore)
    }

    @Test
    fun `renders canonical SDK parts without reparsing markdown`() {
        val parts = TranscriptEnvelope.fromCanonical(
            listOf(
                TranscriptCanonicalPart(
                    kind = "forgeData",
                    source = "```forge-data id=rows\n[{\"name\":\"kept\"}]\n```",
                    data = TranscriptCanonicalData(id = "rows", payload = Json.parseToJsonElement("[{\"name\":\"kept\"}]"))
                ),
                TranscriptCanonicalPart(
                    kind = "forgeUI",
                    source = "```forge-ui\n{\"blocks\":[]}\n```",
                    payload = Json.parseToJsonElement("{\"blocks\":[]}")
                )
            )
        )

        val ui = assertIs<TranscriptEnvelopePart.ForgeUi>(parts.single())
        assertEquals("kept", TranscriptEnvelope.rows(ui.dataStore.getValue("rows").rows).single()["name"])
    }

    @Test
    fun `inline policy responds only to form factor`() {
        val metadata = WindowMetadata(namespace = "unrelated")
        assertEquals(340, transcriptInlinePresentation(metadata, TranscriptInlineFormFactor.Compact).maximumHeight.value.toInt())
        assertEquals(420, transcriptInlinePresentation(metadata, TranscriptInlineFormFactor.Regular).maximumHeight.value.toInt())
    }
}

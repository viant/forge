package com.viant.forgeandroid.ui

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull

class FenceDescriptorsTest {

    @Test
    fun `describeFence falls back to code for ordinary source blocks`() {
        val fence = describeFence(
            rawLang = "kotlin",
            body = """
                val status = "ok"
                println(status)
            """.trimIndent()
        )

        assertEquals(FenceRendererType.Code, fence.renderer)
        assertEquals("kotlin", fence.lang)
    }

    @Test
    fun `describeFence detects markdown pipe tables`() {
        val fence = describeFence(
            rawLang = "markdown",
            body = """
                | Name | Value |
                | --- | --- |
                | A | 1 |
            """.trimIndent()
        )

        assertEquals(FenceRendererType.PipeTable, fence.renderer)
        val table = assertNotNull(fence.table)
        assertEquals(listOf("Name", "Value"), table.headers)
        assertEquals(listOf(listOf("A", "1")), table.rows)
    }

    @Test
    fun `describeFence detects chart specs`() {
        val fence = describeFence(
            rawLang = "json",
            body = """{"chart":{"type":"bar","x":{"key":"name"},"y":[{"key":"value"}]},"data":[{"name":"A","value":1}]}"""
        )

        assertEquals(FenceRendererType.Chart, fence.renderer)
        val chart = assertNotNull(fence.chart)
        assertEquals("bar", chart.chart.type)
        assertEquals(1, chart.rows.size)
    }

    @Test
    fun `describeFence detects shorthand chart specs`() {
        val fence = describeFence(
            rawLang = "json",
            body = """{"type":"line","data":[{"month":"Jan","value":2},{"month":"Feb","value":3}],"xKey":"month","valueKey":"value"}"""
        )

        assertEquals(FenceRendererType.Chart, fence.renderer)
        val chart = assertNotNull(fence.chart)
        assertEquals("line", chart.chart.type)
        assertEquals("month", chart.chart.xAxis?.dataKey)
        assertEquals("value", chart.chart.series?.valueKey)
        assertEquals(2, chart.rows.size)
    }

    @Test
    fun `parseMermaidDiagram parses flowcharts`() {
        val diagram = parseMermaidDiagram(
            """
                flowchart TD
                    A[Start] --> B[Run]
                    B --> C[Done]
            """.trimIndent()
        )

        val flowchart = assertIs<MermaidDiagram.Flowchart>(diagram)
        assertEquals(listOf("Start", "Run", "Done"), flowchart.nodes)
    }

    @Test
    fun `parseMermaidDiagram returns null for unsupported mermaid grammar`() {
        val diagram = parseMermaidDiagram(
            """
                erDiagram
                    USER ||--o{ ORDER : places
            """.trimIndent()
        )

        assertEquals(null, diagram)
    }

    @Test
    fun `parseMermaidDiagram parses sequence diagrams`() {
        val diagram = parseMermaidDiagram(
            """
                sequenceDiagram
                    participant User
                    participant Agent
                    User->>Agent: Ask
                    Agent-->>User: Reply
            """.trimIndent()
        )

        val sequence = assertIs<MermaidDiagram.Sequence>(diagram)
        assertEquals(listOf("User", "Agent"), sequence.actors)
        assertEquals(2, sequence.messages.size)
        assertEquals("Ask", sequence.messages.first().text)
    }

    @Test
    fun `parseMermaidDiagram parses class diagrams`() {
        val diagram = parseMermaidDiagram(
            """
                classDiagram
                    class Client
                    Client : uploadFile()
                    Client --> Tracker : uses
            """.trimIndent()
        )

        val classDiagram = assertIs<MermaidDiagram.ClassDiagram>(diagram)
        assertEquals(2, classDiagram.classes.size)
        assertEquals("Client", classDiagram.classes.first().name)
        assertEquals(listOf("uploadFile()"), classDiagram.classes.first().members)
        assertEquals("uses", classDiagram.relations.first().label)
    }

    @Test
    fun `parseMermaidDiagram parses state diagrams`() {
        val diagram = parseMermaidDiagram(
            """
                stateDiagram-v2
                    [*] --> Idle
                    Idle --> Running : query
                    Running --> [*] : done
            """.trimIndent()
        )

        val stateDiagram = assertIs<MermaidDiagram.StateDiagram>(diagram)
        assertEquals(listOf("Start/End", "Idle", "Running"), stateDiagram.states)
        assertEquals(3, stateDiagram.transitions.size)
        assertEquals("query", stateDiagram.transitions[1].label)
    }
}

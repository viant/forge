package com.viant.forgeandroid.ui

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class TerminalRendererTest {

    @Test
    fun `normalizeTerminalEntries prefers stderr alias and numeric code`() {
        val entries = normalizeTerminalEntries(
            listOf(
                mapOf(
                    "input" to "ls -la",
                    "output" to "file.txt",
                    "stderro" to "warning",
                    "code" to "2"
                )
            )
        )

        val entry = entries.single()
        assertEquals("ls -la", entry.input)
        assertEquals("file.txt", entry.output)
        assertEquals("warning", entry.stderr)
        assertEquals(2, entry.status)
        assertTrue(entry.isError)
    }

    @Test
    fun `normalizeTerminalEntries treats zero status without stderr as ok`() {
        val entries = normalizeTerminalEntries(
            listOf(
                mapOf(
                    "input" to "pwd",
                    "output" to "/tmp",
                    "status" to 0
                )
            )
        )

        val entry = entries.single()
        assertEquals("/tmp", entry.output)
        assertEquals(0, entry.status)
        assertFalse(entry.isError)
    }
}

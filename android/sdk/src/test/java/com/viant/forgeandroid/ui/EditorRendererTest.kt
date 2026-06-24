package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.EditorSelectorDef
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class EditorRendererTest {

    @Test
    fun `editor helpers use selector style and fallback values`() {
        val selector = EditorSelectorDef(source = "patch", location = "path", extension = "language")
        val form = mapOf(
            "patch" to "@@ -1 +1\n+ok",
            "path" to "src/main.go",
            "language" to "diff"
        )
        val style = mapOf("readOnly" to "true")

        assertEquals("patch", editorSourceKey(selector))
        assertEquals("@@ -1 +1\n+ok", editorSource(form, selector, fallback = "fallback"))
        assertEquals("src/main.go", editorLocation(form, selector))
        assertEquals("diff", editorExtension(form, selector))
        assertEquals("DIFF • READ ONLY", editorLanguageLabel(editorExtension(form, selector), style))
        assertEquals("KOTLIN • READ ONLY", editorLanguageLabel("kotlin", style))
        assertTrue(editorReadOnly(style))
        assertTrue(editorIsDiff("@@ -1 +1", extension = null))
        assertEquals("fallback", editorSource(emptyMap(), selector, fallback = "fallback"))
    }

    @Test
    fun `editor helpers use default selector fields and editable labels`() {
        val form = mapOf(
            "source" to "val total = 3",
            "location" to "Main.kt",
            "extension" to "kt"
        )

        assertEquals("val total = 3", editorSource(form, selector = null))
        assertEquals("Main.kt", editorLocation(form, selector = null))
        assertEquals("kt", editorExtension(form, selector = null))
        assertEquals("KT", editorLanguageLabel("kt", emptyMap()))
        assertFalse(editorReadOnly(emptyMap()))
        assertFalse(editorIsDiff("val total = 3", extension = "kt"))
    }
}

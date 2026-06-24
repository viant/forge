package com.viant.forgeandroid.runtime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FileBrowserSupportTest {

    @Test
    fun rowLocationAcceptsCommonPathKeys() {
        assertEquals("/workspace", fileBrowserRowLocation(mapOf("uri" to "/workspace")))
        assertEquals("/upper", fileBrowserRowLocation(mapOf("URI" to "/upper")))
        assertEquals("https://example.test/file.txt", fileBrowserRowLocation(mapOf("url" to "https://example.test/file.txt")))
        assertEquals("/trimmed/path", fileBrowserRowLocation(mapOf("path" to "  /trimmed/path  ")))
        assertEquals("42", fileBrowserRowLocation(mapOf("Path" to 42)))
        assertNull(fileBrowserRowLocation(mapOf("name" to "No path")))
    }

    @Test
    fun parentUriHandlesRootTrailingSlashAndRelativeNames() {
        assertEquals("/", fileBrowserParentUri(""))
        assertEquals("/", fileBrowserParentUri("/"))
        assertEquals("/", fileBrowserParentUri("/reports"))
        assertEquals("/reports", fileBrowserParentUri("/reports/daily"))
        assertEquals("/reports", fileBrowserParentUri("/reports/daily/"))
        assertEquals("/", fileBrowserParentUri("daily"))
    }

    @Test
    fun rowModelResolvesNameFolderStateAndStableIdentity() {
        val folder = fileBrowserRowModel(
            mapOf("path" to "/reports/daily", "label" to "Daily", "type" to "folder"),
            0
        )
        val directory = fileBrowserRowModel(
            mapOf("uri" to "/reports/monthly", "isDirectory" to "yes"),
            1
        )
        val folderFlag = fileBrowserRowModel(
            mapOf("uri" to "/reports/flagged", "folder" to "true"),
            2
        )
        val file = fileBrowserRowModel(
            mapOf("url" to "/reports/readme.md", "fileType" to "file"),
            3
        )
        val unnamed = fileBrowserRowModel(emptyMap(), 4)

        assertEquals("/reports/daily#0", folder.id)
        assertEquals("Daily", folder.name)
        assertEquals("/reports/daily", folder.subtitle)
        assertTrue(folder.isFolder)

        assertEquals("monthly", directory.name)
        assertTrue(directory.isFolder)

        assertEquals("flagged", folderFlag.name)
        assertTrue(folderFlag.isFolder)

        assertEquals("readme.md", file.name)
        assertFalse(file.isFolder)

        assertEquals("Unnamed", unnamed.name)
        assertFalse(unnamed.isFolder)
    }

    @Test
    fun rowAccessibilityLabelIncludesKindLocationAndDisabledState() {
        val folder = fileBrowserRowModel(
            mapOf("uri" to "/reports", "type" to "folder"),
            0
        )
        val file = fileBrowserRowModel(
            mapOf("uri" to "/reports/readme.md", "type" to "file"),
            1
        )
        val unnamed = fileBrowserRowModel(emptyMap(), 2)

        assertEquals("Folder reports, /reports", fileBrowserRowAccessibilityLabel(folder))
        assertEquals("File readme.md, /reports/readme.md, disabled", fileBrowserRowAccessibilityLabel(file, disabled = true))
        assertEquals("File Unnamed", fileBrowserRowAccessibilityLabel(unnamed))
    }
}

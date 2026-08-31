package com.viant.forgeandroid.runtime

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import org.junit.Assert.assertEquals
import org.junit.Test

class ForgeInteractionTest {
    @Test
    fun `interaction observer receives window identity and authored detail`() {
        val runtime = ForgeRuntime(emptyMap(), CoroutineScope(Dispatchers.Unconfined))
        val window = runtime.openWindowInline(
            windowKey = "feed-catalog",
            title = "Catalog",
            metadata = WindowMetadata()
        )
        var observed: ForgeInteraction? = null
        runtime.registerInteractionObserver { observed = it }

        runtime.emitInteraction(
            kind = "feed.tab_changed",
            windowId = window.windowId,
            dataSourceRef = "catalog",
            detail = mapOf("tabId" to "records")
        )

        assertEquals("feed-catalog", observed?.windowKey)
        assertEquals("catalog", observed?.dataSourceRef)
        assertEquals("records", observed?.detail?.get("tabId"))
    }
}

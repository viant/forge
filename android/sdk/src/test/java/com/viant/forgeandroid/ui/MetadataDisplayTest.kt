package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.ColumnDef
import com.viant.forgeandroid.runtime.ItemDef
import com.viant.forgeandroid.runtime.JsonUtil
import com.viant.forgeandroid.runtime.ActionHookRuntime
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.WindowMetadata
import com.dokar.quickjs.QuickJs
import com.dokar.quickjs.evaluate
import kotlinx.coroutines.*
import kotlin.test.Test
import kotlin.test.assertEquals

class MetadataDisplayTest {
    @Test fun metricsLabelUsesItsBoundSourceBeforeFormatting() {
        val item = JsonUtil.json.decodeFromString(ItemDef.serializer(),
            """{"type":"label","dataField":"kind","scope":"metrics","valueMap":{"1":"One","true":"Yes","2.5":"Fraction","0.000001":"Small","1e-7":"Exponent","a,1":"List"},"emptyText":"—"}""")
        val row = mapOf("kind" to 1L)
        assertEquals("One", resolveItemDisplayValue(item, "kind", emptyMap(), emptyMap(), emptyMap(), listOf(row)))
        for ((input, expected) in listOf(1.0 to "One", "1" to "One", true to "Yes", 2.5 to "Fraction",
            0.000001 to "Small", 0.0000001 to "Exponent", listOf("a", 1) to "List",
            "Other" to "Other", null to "—", " " to "—")) {
            assertEquals(expected, formatLabelValue(item, input))
        }
        assertEquals(1L, row["kind"])
    }

    @Test fun projectedValueIsResolvedBeforeTheLabelMap() = runBlocking {
        val metadata = JsonUtil.json.decodeFromString(WindowMetadata.serializer(), """
            {"namespace":"Records","view":{"content":{}},"dataSource":{"record":{}},
             "actions":{"code":"({next: ({value}) => value + 1, Records: {nested: () => 7}, nested: () => 9})"}}
        """.trimIndent())
        val label = JsonUtil.json.decodeFromString(ItemDef.serializer(),
            """{"dataField":"kind","valueMap":{"1":"Original","2":"Projected"},"on":[{"event":"onValue","handler":"Records.next"}]}""")
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        ActionHookRuntime.testScriptEvaluator = { script ->
            val js = QuickJs.create(Dispatchers.Default)
            try { js.evaluate<String>(script) } finally { js.close() }
        }
        try {
            val runtime = ForgeRuntime(emptyMap(), scope)
            val window = runtime.openWindowInline("inventory", "Inventory", metadata = metadata)
            val context = runtime.windowContext(window.windowId).context("record")
            val original = mapOf("kind" to 1L)
            context.setForm(original)
            val computed = runtime.evaluateMetadataAction(label.on.single(), context, mapOf("value" to original["kind"]))
            assertEquals("Projected", formatLabelValue(label, computed))
            val nested = runtime.evaluateMetadataAction(label.on.single().copy(handler = "Records.nested"), context)
            assertEquals(7L, nested)
            assertEquals(original, context.form.peek())
        } finally {
            ActionHookRuntime.testScriptEvaluator = null
            scope.cancel()
        }
    }

    @Test fun tableMapsOnlyTheDisplayValueAndKeepsComputedText() {
        val column = JsonUtil.json.decodeFromString(ColumnDef.serializer(),
            """{"key":"kind","format":"raw","valueMap":{"1":"One"},"emptyText":"Unassigned"}""")
        assertEquals("One", formatTableValue(1L, column))
        assertEquals("other", formatTableValue("other", column))
        assertEquals("Unassigned", formatTableValue(null, column))
        assertEquals("1", formatTableValue("1", column, projected = true))
    }
}

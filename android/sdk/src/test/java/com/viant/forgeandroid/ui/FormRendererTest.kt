package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.ContentDef
import com.viant.forgeandroid.runtime.DataSourceDef
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.ItemDef
import com.viant.forgeandroid.runtime.JsonUtil
import com.viant.forgeandroid.runtime.MutationCommandDef
import com.viant.forgeandroid.runtime.NativeWidgetContract
import com.viant.forgeandroid.runtime.ResourceFieldBindingDef
import com.viant.forgeandroid.runtime.ResourceFieldSchemaDef
import com.viant.forgeandroid.runtime.ResourceModelDef
import com.viant.forgeandroid.runtime.ResourcePayloadPreparationDef
import com.viant.forgeandroid.runtime.ResourceSchemaDef
import com.viant.forgeandroid.runtime.ResourceValueSourceDef
import com.viant.forgeandroid.runtime.ResourceWriteBindingDef
import com.viant.forgeandroid.runtime.ViewDef
import com.viant.forgeandroid.runtime.WindowMetadata
import com.viant.forgeandroid.runtime.bindingValues
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class FormRendererTest {
    @Test
    fun typedInputParameterReachesTheWriterWithoutChangingTheForm() = runBlocking {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        try {
            val runtime = ForgeRuntime(emptyMap(), scope)
            val schema = ResourceSchemaDef(type = "object", properties = mapOf("quantity" to ResourceFieldSchemaDef(type = "integer")))
            val model = ResourceModelDef(schemaRef = "record", write = ResourceWriteBindingDef(dataSourceRef = "writer", mode = "full"),
                fields = mapOf("quantity" to ResourceFieldBindingDef(codec = "integer")))
            val metadata = WindowMetadata(view = ViewDef(content = ContentDef()), dataSources = mapOf(
                "edit" to DataSourceDef(autoFetch = false), "writer" to DataSourceDef(autoFetch = false)),
                schemas = mapOf("record" to schema), resourceModels = mapOf("record" to model))
            val window = runtime.windowContext(runtime.openWindowInline("inventory", "Inventory", metadata = metadata).windowId)
            val source = window.context("edit")
            val originalForm = mapOf("quantity" to 17, "saved" to false)
            source.setForm(originalForm)
            source.setInputParameters(mapOf("row" to mapOf("quantity" to 48, "note" to "sibling"), "version" to 2))
            source.input.update { it.copy(filter = mapOf("active" to true), page = 2, refresh = true, preparedDispatchId = "previous") }
            val writes = mutableListOf<String>()
            runtime.registerDataSourceLoader { request ->
                writes += request.dataSourceRef
                require(request.input.parameters["quantity"] == 91L)
                ForgeRuntime.DataSourceFetchResult()
            }

            val path = "parameters.row.quantity"
            val item = ItemDef(id = "amount", type = "number", scope = "input", dataField = path)
            fun display() = resolveItemValue(item, path, source.form.peek(), emptyMap(), emptyMap(), input = source.input.peek().bindingValues())
            assertEquals("48", display())
            val typed = checkNotNull(NativeWidgetContract.input("91", NativeWidgetContract.kind(item), item.properties))
            setScopedItemValue(runtime, source, item, path, JsonUtil.elementToAny(typed))
            assertEquals(91.0, display().toDouble())
            assertEquals(mapOf("row" to mapOf("quantity" to JsonUtil.elementToAny(typed), "note" to "sibling"), "version" to 2), source.input.peek().parameters)
            assertEquals(originalForm, source.form.peek())
            val savedInput = source.input.peek()
            assertFalse(savedInput.fetch)
            assertEquals(mapOf("active" to true), savedInput.filter)
            assertEquals(2, savedInput.page)
            assertTrue(savedInput.refresh)
            assertEquals(null, savedInput.preparedDispatchId)
            assertTrue(writes.isEmpty())

            val payload = ResourcePayloadPreparationDef(modelRef = "record", fields = mapOf("quantity" to
                ResourceValueSourceDef(scope = "input", selector = path)))
            val command = MutationCommandDef(dataSourceRef = "writer", payload = payload)
            assertEquals("succeeded", runtime.mutationCommands.execute(runtime, window, source, command).status)
            assertEquals(listOf("writer"), writes)
        } finally {
            scope.cancel()
        }
    }

    @Test
    fun `label display applies authored formats without changing raw form values`() {
        val cpm = ItemDef(
            id = "selectedCPM",
            dataField = "periodSummary.periodEcpm",
            scope = "metrics",
            format = "currency2"
        )
        val ctr = ItemDef(
            id = "selectedCTR",
            dataField = "periodSummary.periodCtr",
            scope = "metrics",
            format = "percentFraction"
        )
        val metrics = mapOf(
            "periodSummary" to mapOf(
                "periodEcpm" to 3.5,
                "periodCtr" to 0.069
            )
        )

        assertEquals(
            "$3.50",
            resolveItemDisplayValue(cpm, cpm.dataField!!, emptyMap(), metrics, emptyMap())
        )
        assertEquals(
            "6.9%",
            resolveItemDisplayValue(ctr, ctr.dataField!!, emptyMap(), metrics, emptyMap())
        )
        assertEquals(
            "3.5",
            resolveItemValue(cpm, cpm.dataField!!, emptyMap(), metrics, emptyMap())
        )
    }

    @Test
    fun `dynamic widget options preserve typed values and semantic labels`() {
        val item = ItemDef(
            id = "category",
            properties = mapOf(
                "optionsDataSourceRef" to JsonPrimitive("categories"),
                "optionValueField" to JsonPrimitive("category.id"),
                "optionLabelField" to JsonPrimitive("category.caption")
            )
        )
        val options = loadedNativeWidgetOptions(
            item,
            listOf(
                mapOf("category" to mapOf("id" to 8, "caption" to "Retail")),
                mapOf("category" to mapOf("id" to 45, "caption" to "Automotive"))
            )
        )

        assertEquals(listOf(JsonPrimitive(8), JsonPrimitive(45)), options?.map { it.first })
        assertEquals(listOf("Retail", "Automotive"), options?.map { it.second })

        val rootAuthored = Json { ignoreUnknownKeys = true }.decodeFromString(
            ItemDef.serializer(),
            """{"id":"category","optionsDataSourceRef":"categories","optionValueField":"id","optionLabelField":"caption"}"""
        )
        assertEquals("categories", rootAuthored.optionsDataSourceRef)
        assertEquals(listOf("Retail"), loadedNativeWidgetOptions(rootAuthored, listOf(mapOf("id" to 8, "caption" to "Retail")))?.map { it.second })
    }

    @Test
    fun `authored editability conditions evaluate from root and properties`() {
        val json = Json { ignoreUnknownKeys = true }
        val rootItem = json.decodeFromString(
            ItemDef.serializer(),
            """{"id":"name","readOnlyWhen":{"source":"authorization","field":"resource.capabilities.write","notEquals":true}}"""
        )
        val propertyItem = ItemDef(
            id = "save",
            properties = mapOf(
                "disabledWhen" to json.parseToJsonElement("""{"source":"windowForm","field":"safe","notEquals":true}""")
            )
        )

        val inputItem = json.decodeFromString(
            ItemDef.serializer(),
            """{"id":"amount","disabledWhen":{"source":"input","field":"parameters.count","lte":0}}"""
        )
        assertTrue(itemConditionDisables(inputItem, input = mapOf("parameters" to mapOf("count" to 0))))
        assertFalse(itemConditionDisables(inputItem, input = mapOf("parameters" to mapOf("count" to 91))))

        assertTrue(itemConditionDisables(rootItem, authorization = mapOf("resource" to mapOf("capabilities" to mapOf("write" to false)))))
        assertFalse(itemConditionDisables(rootItem, authorization = mapOf("resource" to mapOf("capabilities" to mapOf("write" to true)))))
        assertTrue(itemConditionDisables(propertyItem, windowForm = mapOf("safe" to false)))
        assertFalse(itemConditionDisables(propertyItem, windowForm = mapOf("safe" to true)))
    }
}

package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.ItemDef
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class FormRendererTest {
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

        assertTrue(itemConditionDisables(rootItem, authorization = mapOf("resource" to mapOf("capabilities" to mapOf("write" to false)))))
        assertFalse(itemConditionDisables(rootItem, authorization = mapOf("resource" to mapOf("capabilities" to mapOf("write" to true)))))
        assertTrue(itemConditionDisables(propertyItem, windowForm = mapOf("safe" to false)))
        assertFalse(itemConditionDisables(propertyItem, windowForm = mapOf("safe" to true)))
    }
}

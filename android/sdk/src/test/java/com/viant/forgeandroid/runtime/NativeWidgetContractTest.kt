package com.viant.forgeandroid.runtime

import java.io.File
import java.time.Instant
import kotlinx.serialization.json.*
import kotlin.test.*

class NativeWidgetContractTest {
    private fun fixtures(): JsonObject {
        val root = generateSequence(File(System.getProperty("user.dir")!!)) { it.parentFile }.first { File(it,"src/components/primitives/nativeWidgetContract.fixtures.json").exists() }
        return Json.parseToJsonElement(File(root,"src/components/primitives/nativeWidgetContract.fixtures.json").readText()).jsonObject
    }
    @Test fun sharedClassificationAndValues() {
        val fixture = fixtures()
        fixture["booleans"]!!.jsonArray.forEach { entry -> assertEquals(entry.jsonObject["expected"]!!.jsonPrimitive.boolean, NativeWidgetContract.truthy(entry.jsonObject["value"])) }
        fixture["widgets"]!!.jsonArray.forEach { widget -> assertTrue(NativeWidgetContract.kind(ItemDef(widget = widget.jsonPrimitive.content)) in NativeWidgetContract.kinds) }
        fixture["classification"]!!.jsonArray.forEach { value ->
            val entry = value.jsonObject
            val item = JsonUtil.json.decodeFromJsonElement(ItemDef.serializer(),entry["item"]!!)
            assertEquals(entry["expected"]!!.jsonPrimitive.content, NativeWidgetContract.kind(item))
        }
        fixture["inputs"]!!.jsonArray.forEach { value ->
            val entry = value.jsonObject
            val parsed = NativeWidgetContract.input(entry["text"]!!.jsonPrimitive.content, entry["kind"]!!.jsonPrimitive.content)
            if (entry["invalid"] == JsonPrimitive(true)) assertNull(parsed) else assertTrue(NativeWidgetContract.equivalent(entry["expected"],parsed), entry.toString())
        }
    }
    @Test fun sharedPresetsAndTabPolicy() {
        val fixture = fixtures()
        fixture["presets"]!!.jsonArray.forEach { value ->
            val entry = value.jsonObject
            val actual = NativeDateRangePreset.resolve(entry["value"]!!.jsonPrimitive.content, Instant.parse(entry["now"]!!.jsonPrimitive.content), entry["timeZone"]?.jsonPrimitive?.content ?: "UTC")
            assertEquals(entry["expected"],JsonUtil.anyToElement(actual))
        }
        fixture["tabs"]!!.jsonArray.forEach { value ->
            val entry = value.jsonObject
            val ids = entry["ids"]!!.jsonArray.map { it.jsonPrimitive.content }
            val selected = StableTabsState.selected(ids,entry["requested"]?.jsonPrimitive?.content,entry["default"]?.jsonPrimitive?.content)
            assertEquals(entry["selected"]!!.jsonPrimitive.content,selected)
            assertEquals(entry["mounted"]!!.jsonArray.map { it.jsonPrimitive.content },StableTabsState.mounted(ids,selected,entry["visited"]!!.jsonArray.map { it.jsonPrimitive.content }.toSet(),entry["keepVisited"] == JsonPrimitive(true),entry["activeOnly"] == JsonPrimitive(true)))
        }
    }
    @Test fun scopeIsolationAndTypedOptions() {
        val container = JsonUtil.json.decodeFromString(ContainerDef.serializer(),"""{"id":"root","dataSourceRef":"reader","resourceHeader":{"dataSourceRef":"identity"},"draftForm":{"dataSourceRef":"editor"},"mutationCommand":{"dataSourceRef":"writer"}}""")
        val parts = PrimitivePairing.scopedContainers(container)
        assertEquals("identity",parts.first { it.resourceHeader != null }.dataSourceRef)
        assertEquals("editor",parts.first { it.draftForm != null }.dataSourceRef)
        assertEquals("reader",parts.first { it.mutationCommand != null }.dataSourceRef)
        val item = JsonUtil.json.decodeFromString(ItemDef.serializer(),"""{"widget":"select","disabled":true,"options":[{"value":2,"label":"Two"},{"value":false,"label":"No"}]}""")
        assertEquals(listOf(JsonPrimitive(2),JsonPrimitive(false)),NativeWidgetContract.options(item).map { it.first })
        assertTrue(NativeWidgetContract.disabled(item))
        val decoded = JsonUtil.json.decodeFromString(ItemDef.serializer(),JsonUtil.json.encodeToString(ItemDef.serializer(),item))
        assertEquals(NativeWidgetContract.options(item),NativeWidgetContract.options(decoded))
    }
    @Test fun draftBaselineResetAndSaveContract() {
        val initial = mapOf("id" to 1, "name" to "Before")
        val edited = mapOf("id" to 1, "name" to "After")
        val state = NativeDraftState(initial)
        assertFalse(state.dirty(initial)); assertTrue(state.dirty(edited))
        assertEquals(mapOf("data" to edited), state.submitExtras(edited))
        assertEquals(mapOf("values" to initial), state.resetExtras())
        val saved = state.accepted(edited)
        assertFalse(saved.dirty(edited))
        assertTrue(saved.dirty(mapOf("id" to 1, "name" to "Edited during save")))
    }

}

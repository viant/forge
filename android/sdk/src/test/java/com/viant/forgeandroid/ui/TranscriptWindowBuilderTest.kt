package com.viant.forgeandroid.ui

import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals

class TranscriptWindowBuilderTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `hydrates summary item values synthesized by the builder`() {
        val payload = json.decodeFromString(
            TranscriptForgeUiPayload.serializer(),
            """{"blocks":[{"id":"summary","kind":"dashboard.summary","items":[{"label":"Delivery posture","value":"live"}]}]}"""
        )

        val presentation = buildTranscriptWindowPresentation(payload, emptyMap())

        assertEquals(setOf("inline_summary"), presentation.dataStore.keys)
        assertEquals(
            "live",
            TranscriptEnvelope.rows(presentation.dataStore.getValue("inline_summary").rows).single()["deliveryPosture"]
        )
        assertEquals(setOf("inline_summary"), presentation.metadata.dataSources.keys)
    }

    @Test
    fun `uses the same camel case synthetic summary data source identifier as iOS`() {
        val payload = json.decodeFromString(
            TranscriptForgeUiPayload.serializer(),
            """{"blocks":[{"id":"deliverySummary","kind":"dashboard.summary","items":[{"label":"Delivery posture","value":"live"}]}]}"""
        )

        val presentation = buildTranscriptWindowPresentation(payload, emptyMap())

        assertEquals(setOf("inline_deliverySummary"), presentation.dataStore.keys)
    }

    @Test
    fun `hydrates referenced sources without data as an explicit empty collection`() {
        val payload = json.decodeFromString(
            TranscriptForgeUiPayload.serializer(),
            """{"blocks":[{"id":"evidence","kind":"dashboard.table","dataSourceRef":"evidence_rows","columns":[{"key":"name"}]}]}"""
        )

        val presentation = buildTranscriptWindowPresentation(payload, emptyMap())

        assertEquals(emptyList<Any>(), presentation.dataStore.getValue("evidence_rows").rows)
        assertEquals(setOf("evidence_rows"), presentation.metadata.dataSources.keys)
    }

    @Test
    fun `does not synthesize a datasource for non-summary blocks without an explicit reference`() {
        val payload = json.decodeFromString(
            TranscriptForgeUiPayload.serializer(),
            """{"blocks":[{"id":"notes","kind":"dashboard.messages","items":[{"title":"Observe"}]}]}"""
        )

        val presentation = buildTranscriptWindowPresentation(payload, emptyMap())

        assertEquals(emptySet<String>(), presentation.metadata.dataSources.keys)
    }
}

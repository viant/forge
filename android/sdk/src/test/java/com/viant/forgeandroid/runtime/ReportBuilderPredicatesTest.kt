package com.viant.forgeandroid.runtime

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlinx.serialization.json.Json

class ReportBuilderPredicatesTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `lowerReportBuilderPredicates derives static filters groups and families`() {
        val config = json.decodeFromString(
            DashboardReportBuilderDef.serializer(),
            """
            {
              "predicates": [
                {
                  "id": "dateRange",
                  "label": "Date Range",
                  "kind": "dateRange",
                  "required": true,
                  "startParamPath": "filters.from",
                  "endParamPath": "filters.to"
                },
                {
                  "id": "publisher",
                  "label": "Publisher",
                  "group": "inventory",
                  "include": true,
                  "exclude": { "paramPath": "filters.excludePublisherId" },
                  "dialogId": "publisherPicker",
                  "manualEntry": true,
                  "manualValueType": "int",
                  "valueSelector": "publisherId",
                  "labelSelector": "publisherName",
                  "recordSelectors": ["publisherId", "publisherName"]
                },
                {
                  "id": "audienceIds",
                  "label": "Audience",
                  "bucket": "scope",
                  "paramPath": "filters.audienceIds",
                  "manualEntry": true,
                  "manualValueType": "int"
                }
              ],
              "predicateBuckets": [
                { "id": "scope", "label": "Context" }
              ],
              "predicateGroups": [
                { "id": "inventory", "label": "Inventory" }
              ]
            }
            """.trimIndent()
        )

        val lowered = lowerReportBuilderPredicates(config)

        assertEquals(listOf("dateRange"), lowered.staticFilters.mapNotNull { it.id })
        assertEquals("filters.from", lowered.staticFilters.first().startParamPath)

        val include = assertNotNull(lowered.dynamicFilterGroups.firstOrNull { it.id == "include" })
        val exclude = assertNotNull(lowered.dynamicFilterGroups.firstOrNull { it.id == "exclude" })
        val scope = assertNotNull(lowered.dynamicFilterGroups.firstOrNull { it.id == "scope" })

        assertEquals("includePublisher", include.filters.first().id)
        assertEquals("filters.includePublisher", include.filters.first().paramPath)
        assertEquals("excludePublisher", exclude.filters.first().id)
        assertEquals("filters.excludePublisherId", exclude.filters.first().paramPath)
        assertEquals("audienceIds", scope.filters.first().id)

        val family = assertNotNull(lowered.dynamicFilterFamilies.firstOrNull { it.id == "inventory" })
        assertEquals(listOf("includePublisher"), family.includeFilterIds)
        assertEquals(listOf("excludePublisher"), family.excludeFilterIds)
    }
}

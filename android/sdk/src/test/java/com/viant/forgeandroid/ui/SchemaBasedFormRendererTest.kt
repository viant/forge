package com.viant.forgeandroid.ui

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import com.viant.forgeandroid.runtime.ExecutionDef
import com.viant.forgeandroid.runtime.FormFieldDef
import com.viant.forgeandroid.runtime.ItemDef
import com.viant.forgeandroid.runtime.OptionDef
import com.viant.forgeandroid.runtime.SchemaBasedFormDef
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class SchemaBasedFormRendererTest {

    @Test
    fun resolvesSchemaFromDatasourceFormStateUsingDefaultBinding() {
        val schema = mapOf(
            "type" to "object",
            "required" to listOf("region"),
            "properties" to mapOf(
                "region" to mapOf(
                    "type" to "string",
                    "title" to "Region",
                    "enum" to listOf("NA", "EMEA")
                )
            )
        )

        val resolved = resolveSchemaBasedFormSchema(
            inlineSchema = null,
            formState = mapOf("schema" to schema),
            dataBinding = null
        )
        val items = schemaBasedFormItems(resolved, emptyList())

        assertNotNull(resolved)
        assertEquals(1, items.size)
        assertEquals("region", items[0].dataField)
        assertEquals("Region", items[0].label)
        assertEquals("radio", items[0].type)
        assertEquals(true, items[0].required)
        assertEquals(listOf("NA", "EMEA"), items[0].options.map { it.value })
    }

    @Test
    fun schemaEnumArrayMapsToMultiSelect() {
        val schema = Json.parseToJsonElement(
            """
            {
              "type": "object",
              "properties": {
                "names": {
                  "type": "array",
                  "title": "Names",
                  "enum": ["HOME", "SHELL"]
                }
              }
            }
            """.trimIndent()
        )

        val items = schemaBasedFormItems(schema, emptyList())

        assertEquals(1, items.size)
        assertEquals("names", items[0].dataField)
        assertEquals("multiSelect", items[0].type)
        assertEquals(listOf("HOME", "SHELL"), items[0].options.map { it.value })
    }

    @Test
    fun explicitWidgetTakesPriorityOverEnumInference() {
        val schema = Json.parseToJsonElement(
            """
            {
              "type": "object",
              "properties": {
                "notes": {
                  "type": "string",
                  "title": "Notes",
                  "enum": ["A", "B"],
                  "x-ui-widget": "textarea"
                }
              }
            }
            """.trimIndent()
        )

        val items = schemaBasedFormItems(schema, emptyList())

        assertEquals(1, items.size)
        assertEquals("notes", items[0].dataField)
        assertEquals("textarea", items[0].type)
    }

    @Test
    fun schemaLookupMetadataMapsToLookupItem() {
        val schema = Json.parseToJsonElement(
            """
            {
              "type": "object",
              "properties": {
                "entity_id": {
                  "type": "integer",
                  "title": "Entity",
                  "lookup": {
                    "dialogId": "entityPicker",
                    "outputs": [
                      { "location": "entityId", "name": "entity_id" }
                    ]
                  }
                }
              }
            }
            """.trimIndent()
        )

        val items = schemaBasedFormItems(schema, emptyList())

        assertEquals(1, items.size)
        assertEquals("entity_id", items[0].dataField)
        assertEquals("lookup", items[0].type)
        assertNotNull(items[0].properties["lookup"])
    }

    @Test
    fun explicitLookupFieldMapsToLookupItem() {
        val lookup = Json.parseToJsonElement(
            """
            {
              "dialogId": "entityPicker",
              "outputs": [
                { "location": "entityId", "name": "entity_id" }
              ]
            }
            """.trimIndent()
        )

        val items = schemaBasedFormItems(
            schema = null,
            explicitFields = listOf(
                FormFieldDef(
                    name = "entity_id",
                    label = "Entity",
                    type = "integer",
                    lookup = lookup
                )
            )
        )

        assertEquals(1, items.size)
        assertEquals("entity_id", items[0].dataField)
        assertEquals("lookup", items[0].type)
        assertNotNull(items[0].properties["lookup"])
    }

    @Test
    fun explicitFieldBlankNameFallsBackToTrimmedLabel() {
        val items = schemaBasedFormItems(
            schema = null,
            explicitFields = listOf(
                FormFieldDef(
                    name = "   ",
                    label = " Region ",
                    type = "string"
                ),
                FormFieldDef(
                    name = "\t",
                    label = "\n"
                )
            )
        )

        assertEquals(1, items.size)
        assertEquals("Region", items[0].id)
        assertEquals("Region", items[0].dataField)
        assertEquals("Region", items[0].label)
    }

    @Test
    fun lookupDisplayValueRendersTemplateFromFormState() {
        val lookup = Json.parseToJsonElement(
            """
            {
              "display": "${'$'}{entityName} | {{campaign.name}}"
            }
            """.trimIndent()
        )

        val display = lookupDisplayValue(
            lookup = lookup,
            form = mapOf(
                "entity_id" to 42,
                "entityName" to "Entity 42",
                "campaign" to mapOf("name" to "Campaign A")
            ),
            fallback = "42"
        )

        assertEquals("Entity 42 | Campaign A", display)
        assertEquals("42", lookupDisplayValue(lookup, emptyMap(), fallback = "42"))
    }

    @Test
    fun validatesRequiredAndEnumValues() {
        val items = listOf(
            ItemDef(
                id = "region",
                dataField = "region",
                label = "Region",
                required = true,
                options = listOf(
                    OptionDef(value = "NA", label = "NA"),
                    OptionDef(value = "EMEA", label = "EMEA")
                )
            ),
            ItemDef(
                id = "notes",
                dataField = "notes",
                label = "Notes"
            )
        )

        assertEquals(
            mapOf("region" to "Required"),
            schemaFormValidationErrors(items, emptyMap())
        )
        assertEquals(
            mapOf("region" to "Invalid value"),
            schemaFormValidationErrors(items, mapOf("region" to "APAC"))
        )
        assertEquals(
            emptyMap<String, String>(),
            schemaFormValidationErrors(items, mapOf("region" to "NA"))
        )
    }

    @Test
    fun validatesMultiSelectEnumValues() {
        val items = listOf(
            ItemDef(
                id = "names",
                dataField = "names",
                label = "Names",
                type = "multiSelect",
                required = true,
                options = listOf(
                    OptionDef(value = "HOME", label = "HOME"),
                    OptionDef(value = "SHELL", label = "SHELL")
                )
            )
        )

        assertEquals(
            mapOf("names" to "Required"),
            schemaFormValidationErrors(items, mapOf("names" to emptyList<String>()))
        )
        assertEquals(
            mapOf("names" to "Invalid value"),
            schemaFormValidationErrors(items, mapOf("names" to listOf("HOME", "BAD")))
        )
        assertEquals(
            emptyMap<String, String>(),
            schemaFormValidationErrors(items, mapOf("names" to listOf("HOME", "SHELL")))
        )
    }

    @Test
    fun schemaFormSubmissionBuildsPayloadAndErrors() {
        val items = listOf(
            ItemDef(
                id = "region",
                dataField = "region",
                required = true,
                options = listOf(OptionDef(value = "NA"), OptionDef(value = "EMEA"))
            ),
            ItemDef(
                id = "nested",
                bindingPath = "profile.name"
            ),
            ItemDef(
                id = "legacyLabel",
                field = "legacy.field"
            )
        )

        val invalid = schemaFormSubmission(
            items,
            mapOf(
                "region" to "APAC",
                "profile" to mapOf("name" to "Ada"),
                "legacy" to mapOf("field" to "kept")
            )
        )

        assertEquals(
            mapOf("region" to "APAC", "profile.name" to "Ada", "legacy.field" to "kept"),
            invalid.payload
        )
        assertEquals(mapOf("region" to "Invalid value"), invalid.errors)

        val valid = schemaFormSubmission(
            items,
            mapOf(
                "region" to "NA",
                "profile" to mapOf("name" to "Ada"),
                "legacy" to mapOf("field" to "kept")
            )
        )

        assertEquals(
            mapOf("region" to "NA", "profile.name" to "Ada", "legacy.field" to "kept"),
            valid.payload
        )
        assertEquals(emptyMap<String, String>(), valid.errors)
    }

    @Test
    fun schemaFormSubmitExecutionsSelectSubmitHandlersOnly() {
        val form = SchemaBasedFormDef(
            on = listOf(
                ExecutionDef(event = "submit", handler = "form.submit"),
                ExecutionDef(event = "onChange", handler = "form.change"),
                ExecutionDef(event = "submit", handler = null)
            )
        )

        val executions = schemaFormSubmitExecutions(form)
        val payload = mapOf("region" to "NA")
        val args = schemaFormSubmitArgs(payload)

        assertEquals(listOf("form.submit"), executions.map { it.handler })
        assertEquals(payload, args["data"])
        assertEquals(payload, args["payload"])
        assertEquals(payload, args["form"])
    }

    @Test
    fun genericItemValueKeyIncludesFieldMetadata() {
        assertEquals(
            "explicit",
            itemValueKey(ItemDef(id = "id", field = "field", bindingPath = "binding", dataField = "explicit"))
        )
        assertEquals(
            "binding",
            itemValueKey(ItemDef(id = "id", field = "field", bindingPath = "binding"))
        )
        assertEquals(
            "field",
            itemValueKey(ItemDef(id = "id", field = "field"))
        )
        assertEquals(
            true,
            shouldRenderItem(ItemDef(field = "field"))
        )
        assertEquals(
            true,
            shouldRenderItem(ItemDef(id = "   ", field = "field"))
        )
        assertEquals(
            false,
            shouldRenderItem(ItemDef(id = "   ", field = "\t"))
        )
        assertEquals(
            "value",
            resolveItemValue(
                item = ItemDef(field = "profile.name"),
                key = "profile.name",
                form = mapOf("profile" to mapOf("name" to "value")),
                metrics = emptyMap(),
                windowForm = emptyMap()
            )
        )
    }

    @Test
    fun schemaFieldsSortByUiOrderThenName() {
        val schema = Json.parseToJsonElement(
            """
            {
              "type": "object",
              "properties": {
                "zeta": {
                  "type": "string",
                  "title": "Zeta"
                },
                "alpha": {
                  "type": "string",
                  "title": "Alpha"
                },
                "first": {
                  "type": "string",
                  "title": "First",
                  "x-ui-order": -1
                },
                "last": {
                  "type": "string",
                  "title": "Last",
                  "x-ui-order": 10
                }
              }
            }
            """.trimIndent()
        )

        val items = schemaBasedFormItems(schema, emptyList())

        assertEquals(listOf("first", "alpha", "zeta", "last"), items.map { it.dataField })
    }

    @Test
    fun resolvesSchemaFromDatasourceFormStateUsingNestedBinding() {
        val schema = Json.parseToJsonElement(
            """
            {
              "type": "object",
              "properties": {
                "notes": {
                  "type": "string",
                  "title": "Notes",
                  "x-ui-widget": "textarea"
                }
              }
            }
            """.trimIndent()
        )

        val resolved = resolveSchemaBasedFormSchema(
            inlineSchema = null,
            formState = mapOf("payload" to mapOf("schema" to schema)),
            dataBinding = "payload.schema"
        )
        val items = schemaBasedFormItems(resolved, emptyList())

        assertEquals(1, items.size)
        assertEquals("notes", items[0].dataField)
        assertEquals("textarea", items[0].type)
    }

    @Test
    fun inlineSchemaTakesPriorityOverDatasourceFormState() {
        val inlineSchema = JsonPrimitive(
            """
            {
              "type": "object",
              "properties": {
                "inlineOnly": { "type": "string", "title": "Inline" }
              }
            }
            """.trimIndent()
        )

        val resolved = resolveSchemaBasedFormSchema(
            inlineSchema = inlineSchema,
            formState = mapOf(
                "schema" to mapOf(
                    "type" to "object",
                    "properties" to mapOf("dynamicOnly" to mapOf("type" to "string"))
                )
            ),
            dataBinding = null
        )
        val items = schemaBasedFormItems(resolved, emptyList())

        assertEquals(1, items.size)
        assertEquals("inlineOnly", items[0].dataField)
    }
}

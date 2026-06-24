package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class SchemaBasedFormModelsTest {

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun decodesSchemaBasedFormContainer() {
        val payload = """
            {
              "view": {
                "content": {
                  "containers": [
                    {
                      "id": "approvalEnvPicker",
                      "dataSourceRef": "approvalEditor",
                      "schemaBasedForm": {
                        "id": "approvalForgeForm",
                        "dataSourceRef": "approvalEditor",
                        "schema": {
                          "type": "object",
                          "properties": {
                            "names": {
                              "type": "array",
                              "title": "names",
                              "enum": ["HOME", "SHELL"],
                              "x-ui-widget": "multiSelect"
                            }
                          }
                        },
                        "on": [
                          { "event": "submit", "handler": "approval.submit" }
                        ],
                        "showSubmit": false
                      }
                    }
                  ]
                }
              }
            }
        """.trimIndent()

        val metadata = json.decodeFromString(WindowMetadata.serializer(), payload)
        val container = metadata.view?.content?.containers?.firstOrNull()

        assertNotNull(container)
        assertEquals("approvalEnvPicker", container?.id)
        assertEquals("approvalForgeForm", container?.schemaBasedForm?.id)
        assertEquals("approvalEditor", container?.schemaBasedForm?.dataSourceRef)
        assertEquals(false, container?.schemaBasedForm?.showSubmit)
        assertEquals("submit", container?.schemaBasedForm?.on?.firstOrNull()?.event)
        assertEquals("approval.submit", container?.schemaBasedForm?.on?.firstOrNull()?.handler)
        assertNotNull(container?.schemaBasedForm?.schema)
    }
}

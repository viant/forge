package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.*
import kotlinx.serialization.json.*
import kotlin.test.*

class NativeSchemaWidgetTest {
    @Test fun typedDefaultsAndExplicitNullArePreserved() {
        val schema = Json.parseToJsonElement("""{"type":"object","required":["count"],"properties":{"count":{"type":"number","enum":[1,2],"default":2},"secret":{"type":"string","format":"password"},"optional":{"type":"number","default":4}}}""")
        val fields = schemaBasedFormItems(schema, emptyList())
        assertEquals("password", NativeWidgetContract.kind(fields.first { it.id == "secret" }))
        val initial = schemaFormSubmission(fields, emptyMap())
        assertTrue(initial.errors.isEmpty())
        assertEquals(2, (initial.payload["count"] as Number).toInt())
        val cleared = schemaFormSubmission(fields, mapOf("count" to 1.0, "optional" to null))
        assertTrue(cleared.errors.isEmpty())
        assertTrue(cleared.payload.containsKey("optional")); assertNull(cleared.payload["optional"])
    }
}

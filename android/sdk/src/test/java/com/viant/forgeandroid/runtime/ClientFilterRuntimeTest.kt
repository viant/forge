package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*
import kotlin.test.*

class ClientFilterRuntimeTest {
    @Test
    fun authoredScalarMembershipAndComparisonOperatorsMatchIos() {
        assertTrue(ClientFilterRuntime.matches(JsonPrimitive("Synthetic Report"), JsonPrimitive("REPORT"), "contains"))
        assertTrue(ClientFilterRuntime.matches(JsonPrimitive(2), JsonPrimitive("2"), "equal"))
        assertTrue(ClientFilterRuntime.matches(JsonPrimitive("Active"), JsonArray(listOf(JsonPrimitive("Active"), JsonPrimitive("Paused"))), "in"))
        assertTrue(ClientFilterRuntime.matches(JsonPrimitive(10), JsonPrimitive(5), ">="))
        assertFalse(ClientFilterRuntime.matches(null, JsonPrimitive("anything"), "contains"))
    }

    @Test
    fun invalidOperandsAndUnknownOperatorsFailClosed() {
        assertFailsWith<ClientFilterException> { ClientFilterRuntime.matches(JsonPrimitive("anything"), JsonObject(emptyMap()), "contains") }
        assertFailsWith<ClientFilterException> { ClientFilterRuntime.matches(JsonPrimitive(2), JsonPrimitive(1), "invented") }
        assertFailsWith<ClientFilterException> { ClientFilterRuntime.matches(JsonPrimitive("not numeric"), JsonPrimitive(1), ">") }
        assertFailsWith<ClientFilterException> { ClientFilterRuntime.matches(JsonPrimitive("Active"), JsonPrimitive("Active"), "in") }
    }
}

package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class JsonUtilTest {
    @Test
    fun elementToAnyKeepsJsonNullOutOfTextInputs() {
        assertNull(JsonUtil.elementToAny(JsonNull))
        assertEquals("null", JsonUtil.elementToAny(JsonPrimitive("null")))
    }
}

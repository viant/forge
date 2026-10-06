package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.io.File

class NativeReportAdmissionDigestTest {
    @Test fun sharedCrossPlatformVectorsMatchPortableProfile() {
        val fixture = Json.parseToJsonElement(File("../../testdata/native-report-preparation/admission-digest-v1.json").readText()).jsonObject
        assertEquals(NATIVE_REPORT_DIGEST_PROFILE, fixture.getValue("profile").jsonPrimitive.content)
        fixture.getValue("cases").jsonArray.forEach { raw ->
            val entry = raw.jsonObject
            val result = runCatching { nativeReportAdmissionDigest(Json.parseToJsonElement(entry.getValue("json").jsonPrimitive.content)) }
            if (entry["error"] != null) assertEquals(entry.getValue("name").jsonPrimitive.content, entry.getValue("error").jsonPrimitive.content, result.exceptionOrNull()?.message)
            else assertEquals(entry.getValue("name").jsonPrimitive.content, entry.getValue("sha256").jsonPrimitive.content, result.getOrThrow())
        }
    }
    @Test fun invalidUnicodeCannotCollideWithReplacementText() {
        assertTrue(runCatching { nativeReportAdmissionDigest(JsonPrimitive("\uD800")) }.isFailure)
        assertTrue(runCatching { nativeReportAdmissionDigest(JsonPrimitive("\uDC00")) }.isFailure)
    }
}

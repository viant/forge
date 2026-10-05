package com.viant.forgeandroid.ui

import org.junit.Assert.*
import org.junit.Test

class LookupQueryPolicyTest {
    @Test fun declaredMinimumPreventsEmptyAndPartialRemoteQueries() {
        assertFalse(isLookupQueryReady("", 2))
        assertFalse(isLookupQueryReady("   ", 2))
        assertFalse(isLookupQueryReady(" a ", 2))
        assertTrue(isLookupQueryReady(" ab ", 2))
        assertTrue(isLookupQueryReady("programmatic", 2))
        assertTrue(isLookupQueryReady("", 0))
    }
}

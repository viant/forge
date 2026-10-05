package com.viant.forgeandroid.ui

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Test

class ChartThemePaletteTest {
    @Test fun authoredCategoricalReferenceUsesNativeThemeTokenOrDeclaredFallback() {
        val authored = "var(--forge-data-categorical-2, #2aa198)"
        assertEquals(Color(0xFF2AA198), parseChartColor(authored))
        assertEquals(Color(0xFF884422), parseChartColor(authored, listOf(Color.Red, Color(0xFF884422))))
        assertEquals(Color(0xFF123456), parseChartColor("#123456", listOf(Color.Red)))
    }
}

package com.viant.forgeandroid.ui

import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.TextFieldColors
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

data class ForgeThemeAppearance(
    val surface: Color, val text: Color,
    val controlBackground: Color, val controlForeground: Color, val controlBorder: Color,
    val focus: Color, val buttonBackground: Color, val buttonForeground: Color,
    val disabledBackground: Color, val disabledForeground: Color, val validationBorder: Color,
    val fontSize: Float, val controlHeight: Float, val radius: Float, val paddingInline: Float,
)
val LocalForgeThemeAppearance = staticCompositionLocalOf<ForgeThemeAppearance?> { null }

@Composable
internal fun forgeThemeInputColors(theme: ForgeThemeAppearance?): TextFieldColors =
    if (theme == null) OutlinedTextFieldDefaults.colors() else OutlinedTextFieldDefaults.colors(
        focusedTextColor = theme.controlForeground, unfocusedTextColor = theme.controlForeground,
        disabledTextColor = theme.disabledForeground, errorTextColor = theme.controlForeground,
        focusedContainerColor = theme.controlBackground, unfocusedContainerColor = theme.controlBackground,
        disabledContainerColor = theme.disabledBackground, errorContainerColor = theme.controlBackground,
        focusedBorderColor = theme.focus, unfocusedBorderColor = theme.controlBorder,
        disabledBorderColor = theme.controlBorder, errorBorderColor = theme.validationBorder,
        cursorColor = theme.focus, errorCursorColor = theme.validationBorder,
    )

/** Appearance preview uses the production widget adapters and local form state. */
@Composable
fun ForgeThemePreview() {
    val value = androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<kotlinx.serialization.json.JsonElement>(kotlinx.serialization.json.JsonPrimitive("")) }
    androidx.compose.foundation.layout.Column {
        NativeWidgetView(com.viant.forgeandroid.runtime.ItemDef(id = "theme-preview-input", label = "Sample field", type = "text"), value.value, { value.value = it })
        NativeWidgetView(com.viant.forgeandroid.runtime.ItemDef(id = "theme-preview-clear", label = "Clear sample", type = "button"), null, {}, onAction = { value.value = kotlinx.serialization.json.JsonPrimitive("") })
    }
}

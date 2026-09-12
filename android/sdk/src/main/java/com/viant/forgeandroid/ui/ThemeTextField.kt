package com.viant.forgeandroid.ui

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.LocalTextSelectionColors
import androidx.compose.foundation.text.selection.TextSelectionColors
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Material's decoration API exposes inner padding without replacing input semantics. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ForgeThemeTextField(value: String, onValueChange: (String) -> Unit, label: String,
    enabled: Boolean, singleLine: Boolean, minLines: Int, visualTransformation: VisualTransformation,
    keyboardOptions: KeyboardOptions, errorMessage: String) {
    val theme = LocalForgeThemeAppearance.current
    if (theme == null) {
        OutlinedTextField(value = value, onValueChange = onValueChange, label = { Text(label) }, enabled = enabled,
            singleLine = singleLine, minLines = minLines, visualTransformation = visualTransformation,
            keyboardOptions = keyboardOptions, isError = errorMessage.isNotBlank(), modifier = Modifier.fillMaxWidth())
        return
    }
    val interaction = remember { MutableInteractionSource() }
    val invalid = errorMessage.isNotBlank()
    val colors = forgeThemeInputColors(theme)
    val labelSpace = with(LocalDensity.current) { 8.sp.toDp() }
    CompositionLocalProvider(LocalTextSelectionColors provides TextSelectionColors(theme.focus, theme.focus.copy(alpha = 0.35f))) {
        BasicTextField(value = value, onValueChange = onValueChange, enabled = enabled,
            singleLine = singleLine, minLines = minLines, visualTransformation = visualTransformation,
            keyboardOptions = keyboardOptions, interactionSource = interaction,
            textStyle = LocalTextStyle.current.copy(fontSize = theme.fontSize.sp, color = if (enabled) theme.controlForeground else theme.disabledForeground),
            cursorBrush = SolidColor(if (invalid) theme.validationBorder else theme.focus),
            modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) { if (invalid) error(errorMessage) }
                .padding(top = labelSpace).heightIn(min = maxOf(48f, theme.controlHeight).dp),
            decorationBox = { inner ->
                OutlinedTextFieldDefaults.DecorationBox(value = value, innerTextField = inner, enabled = enabled,
                    singleLine = singleLine, visualTransformation = visualTransformation, interactionSource = interaction,
                    isError = invalid, label = { Text(label) }, colors = colors,
                    contentPadding = OutlinedTextFieldDefaults.contentPadding(start = theme.paddingInline.dp, end = theme.paddingInline.dp),
                    container = { OutlinedTextFieldDefaults.Container(enabled, invalid, interaction, colors = colors,
                        shape = RoundedCornerShape(theme.radius.dp)) })
            })
    }
}

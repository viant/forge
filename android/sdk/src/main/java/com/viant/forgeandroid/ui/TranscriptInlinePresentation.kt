package com.viant.forgeandroid.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.WindowMetadata

enum class TranscriptInlineFormFactor {
    Compact,
    Regular
}

data class TranscriptInlinePresentation(
    val maximumHeight: Dp
)

/**
 * Stable transcript sizing belongs to Forge. It uses only the supplied window
 * metadata and platform form factor, never response titles or content length.
 */
fun transcriptInlinePresentation(
    metadata: WindowMetadata,
    formFactor: TranscriptInlineFormFactor
): TranscriptInlinePresentation {
    // Metadata is intentionally accepted so future declared presentation fields
    // extend this contract without moving layout policy back into a host app.
    @Suppress("UNUSED_VARIABLE")
    val ignoredMetadata = metadata
    return TranscriptInlinePresentation(
        maximumHeight = if (formFactor == TranscriptInlineFormFactor.Regular) 420.dp else 340.dp
    )
}

@Composable
fun rememberTranscriptInlinePresentation(metadata: WindowMetadata): TranscriptInlinePresentation {
    val configuration = LocalConfiguration.current
    val formFactor = if (configuration.screenWidthDp >= 600) {
        TranscriptInlineFormFactor.Regular
    } else {
        TranscriptInlineFormFactor.Compact
    }
    return remember(metadata, formFactor) { transcriptInlinePresentation(metadata, formFactor) }
}

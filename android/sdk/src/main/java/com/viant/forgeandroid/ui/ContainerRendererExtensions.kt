package com.viant.forgeandroid.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.ForgeTargetContext
import com.viant.forgeandroid.runtime.WindowContext

enum class ForgePresentationDensity {
    Automatic,
    Standard,
    Compact
}

data class ForgeContainerRendererContext(
    val runtime: ForgeRuntime,
    val window: WindowContext,
    val container: ContainerDef,
    val inheritedDataSourceRef: String?,
    val suppressTitle: Boolean,
    val presentationDensity: ForgePresentationDensity,
    val targetContext: ForgeTargetContext,
    val modifier: Modifier
)

fun interface ForgeContainerRendererExtension {
    @Composable
    fun Render(context: ForgeContainerRendererContext)
}

class ForgeContainerRendererRegistry private constructor(
    private val renderers: Map<String, ForgeContainerRendererExtension>
) {
    fun renderer(kind: String?): ForgeContainerRendererExtension? =
        kind?.trim()?.takeIf(String::isNotEmpty)?.let(renderers::get)

    val registeredKinds: Set<String>
        get() = renderers.keys

    class Builder {
        private val renderers = linkedMapOf<String, ForgeContainerRendererExtension>()

        fun register(
            kind: String,
            renderer: ForgeContainerRendererExtension
        ): Builder = apply {
            val normalized = kind.trim()
            require(normalized.isNotEmpty()) { "container renderer kind must not be blank" }
            require(!renderers.containsKey(normalized)) {
                "duplicate container renderer kind: $normalized"
            }
            renderers[normalized] = renderer
        }

        fun build(): ForgeContainerRendererRegistry =
            ForgeContainerRendererRegistry(renderers.toMap())
    }

    companion object {
        val Empty: ForgeContainerRendererRegistry = Builder().build()
    }
}

val LocalForgeContainerRendererRegistry = staticCompositionLocalOf {
    ForgeContainerRendererRegistry.Empty
}

val LocalForgePresentationDensity = staticCompositionLocalOf {
    ForgePresentationDensity.Automatic
}

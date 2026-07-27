package com.viant.forgeandroid.ui

import androidx.compose.runtime.Composable
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertNull

private object TestContainerRendererExtension : ForgeContainerRendererExtension {
    @Composable
    override fun Render(context: ForgeContainerRendererContext) = Unit
}

class ContainerRendererRegistryTest {
    @Test
    fun `registry uses exact kind`() {
        val registry = ForgeContainerRendererRegistry.Builder()
            .register("vendor.custom-panel", TestContainerRendererExtension)
            .build()

        assertNotNull(registry.renderer("vendor.custom-panel"))
        assertNull(registry.renderer("Vendor.Custom-Panel"))
        assertEquals(setOf("vendor.custom-panel"), registry.registeredKinds)
    }

    @Test
    fun `registry rejects duplicate kind`() {
        val error = assertFailsWith<IllegalArgumentException> {
            ForgeContainerRendererRegistry.Builder()
                .register("vendor.custom-panel", TestContainerRendererExtension)
                .register("vendor.custom-panel", TestContainerRendererExtension)
        }

        assertEquals(
            "duplicate container renderer kind: vendor.custom-panel",
            error.message,
        )
    }
}

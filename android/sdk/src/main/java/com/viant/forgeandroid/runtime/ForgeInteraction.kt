package com.viant.forgeandroid.runtime

/** Host-neutral description of a user interaction with authored Forge UI. */
data class ForgeInteraction(
    val kind: String,
    val windowId: String,
    val windowKey: String? = null,
    val dataSourceRef: String? = null,
    val detail: Map<String, Any?> = emptyMap()
)

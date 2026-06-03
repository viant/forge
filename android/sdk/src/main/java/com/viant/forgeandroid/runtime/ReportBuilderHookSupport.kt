package com.viant.forgeandroid.runtime

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonObject

internal data class ReportBuilderLookupDescriptor(
    val dialogId: String,
    val parameters: Map<String, Any?> = emptyMap(),
    val selectionMode: String = "single"
)

internal fun invokeReportBuilderHook(
    metadata: WindowMetadata?,
    functionName: String,
    props: JsonObject
): Map<String, Any?>? {
    val code = metadata?.actions?.code?.trim().orEmpty()
    if (code.isBlank()) return null
    val namespace = metadata?.namespace?.trim().orEmpty()
    val candidates = linkedSetOf(functionName.trim()).apply {
        if (namespace.isNotBlank()) {
            val prefix = "$namespace."
            if (functionName.startsWith(prefix)) {
                add(functionName.removePrefix(prefix))
            } else {
                add(prefix + functionName.trim())
            }
        }
    }.filter { it.isNotBlank() }
    for (candidate in candidates) {
        val result = runBlocking { ActionHookRuntime.invoke(code, candidate, props) } ?: continue
        val resolved = JsonUtil.elementToAny(result)
        val asMap = JsonUtil.asStringMap(resolved)
        if (asMap.isNotEmpty()) {
            return asMap
        }
    }
    return null
}

internal fun lookupReportBuilderDescriptor(
    metadata: WindowMetadata?,
    config: DashboardReportBuilderDef,
    hookState: Map<String, Any?>,
    groupId: String,
    filter: ReportBuilderDynamicFilterDef
): ReportBuilderLookupDescriptor? {
    metadata ?: return null
    val directDialogId = filter.dialogId?.trim().orEmpty()
    var descriptor = ReportBuilderLookupDescriptor(
        dialogId = directDialogId,
        selectionMode = if (filter.multiple == false) "single" else "multi"
    )

    val hookName = config.hooks?.resolveLookup?.trim().orEmpty()
    if (hookName.isNotBlank()) {
        val result = invokeReportBuilderHook(
            metadata = metadata,
            functionName = hookName,
            props = JsonObject(
                mapOf(
                    "state" to JsonUtil.anyToElement(hookState),
                    "group" to JsonUtil.anyToElement(mapOf("id" to groupId)),
                    "filterDef" to JsonUtil.json.encodeToJsonElement(
                        ReportBuilderDynamicFilterDef.serializer(),
                        filter
                    )
                )
            )
        )
        if (result != null) {
            val dialogId = result["dialogId"]?.toString()?.trim().orEmpty()
            if (dialogId.isNotEmpty()) {
                descriptor = descriptor.copy(dialogId = dialogId)
            }
            val parameters = JsonUtil.asStringMap(result["parameters"]).takeIf { it.isNotEmpty() }.orEmpty()
            if (parameters.isNotEmpty()) {
                descriptor = descriptor.copy(parameters = parameters)
            }
            val multiple = result["multiple"] as? Boolean
            if (multiple != null) {
                descriptor = descriptor.copy(selectionMode = if (multiple) "multi" else "single")
            }
        }
    }

    if (descriptor.dialogId.isBlank()) return null
    if (metadata.dialogs.none { it.id == descriptor.dialogId }) return null
    return descriptor
}

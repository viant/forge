package com.viant.forgeandroid.ui

import com.viant.forgeandroid.runtime.ColumnDef
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.LinkDef
import com.viant.forgeandroid.runtime.SelectorUtil
import com.viant.forgeandroid.runtime.WindowContext
import com.viant.forgeandroid.runtime.WindowState
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.longOrNull

internal sealed interface ResolvedLinkTarget

internal data class ExternalLinkTarget(
    val href: String
) : ResolvedLinkTarget

internal data class WindowLinkTarget(
    val windowKey: String,
    val title: String,
    val parameters: Map<String, Any?> = emptyMap(),
    val inTab: Boolean = true,
    val modal: Boolean = false,
    val newInstance: Boolean = false
) : ResolvedLinkTarget

internal data class LinkResolutionContext(
    val row: Map<String, Any?> = emptyMap(),
    val value: Any? = null,
    val form: Map<String, Any?> = emptyMap(),
    val metrics: Map<String, Any?> = emptyMap(),
    val windowForm: Map<String, Any?> = emptyMap()
)

internal fun resolveColumnLinkTargetFromContext(
    column: ColumnDef,
    context: LinkResolutionContext
): ResolvedLinkTarget? {
    if (column.type?.trim()?.lowercase() != "link") {
        return null
    }
    val link = column.link ?: return null
    val windowKey = link.windowKey?.trim().orEmpty()
    val kind = link.kind?.trim()?.lowercase().orEmpty()
    val fallbackTitle = linkDisplayString(context.value).trim()
        .ifBlank { column.label?.trim().orEmpty() }
        .ifBlank { windowKey }
        .ifBlank { "Open" }
    if (windowKey.isNotEmpty() || kind == "window") {
        if (windowKey.isEmpty()) {
            return null
        }
        return WindowLinkTarget(
            windowKey = windowKey,
            title = resolveLinkWindowTitleFromContext(link, context, fallbackTitle),
            parameters = resolveLinkParametersFromContext(link, context),
            inTab = link.inTab != false,
            modal = link.modal == true,
            newInstance = link.newInstance == true
        )
    }
    val hrefSelector = link.href?.trim().orEmpty()
    if (hrefSelector.isEmpty()) {
        return null
    }
    val href = linkDisplayString(SelectorUtil.resolve(context.row, hrefSelector)).trim()
    if (href.isEmpty()) {
        return null
    }
    return ExternalLinkTarget(href)
}

internal fun resolveLinkWindowTitleFromContext(
    link: LinkDef,
    context: LinkResolutionContext,
    fallbackTitle: String
): String {
    val template = link.windowTitleTemplate?.trim().orEmpty()
    if (template.isNotEmpty()) {
        val holder = resolveLinkSourceValue(
            source = link.windowTitleSource?.trim()?.lowercase().takeUnless { it.isNullOrEmpty() } ?: "row",
            selector = "",
            context = context
        )
        val rendered = renderLinkTemplate(template, holder)
        if (rendered.isNotEmpty()) {
            return rendered
        }
    }

    val selector = link.windowTitleSelector?.trim().orEmpty()
    val source = link.windowTitleSource?.trim()?.lowercase().orEmpty()
    if (selector.isNotEmpty() || source.isNotEmpty()) {
        val resolved = resolveLinkSourceValue(
            source = source.ifBlank { "row" },
            selector = selector,
            context = context
        )?.let(::linkDisplayString)?.trim().orEmpty()
        if (resolved.isNotEmpty()) {
            return resolved
        }
    }

    val explicit = link.windowTitle?.trim().orEmpty()
    if (explicit.isNotEmpty()) {
        return explicit
    }
    return fallbackTitle
}

internal fun resolveLinkParametersFromContext(
    link: LinkDef,
    context: LinkResolutionContext
): Map<String, Any?> {
    return link.parameters.mapNotNull { (key, spec) ->
        resolveLinkParameterValue(spec, context)?.let { key to it }
    }.toMap()
}

internal fun openResolvedWindowLink(
    runtime: ForgeRuntime,
    window: WindowContext,
    link: WindowLinkTarget
): WindowState {
    val currentState = runtime.windowState(window.windowId)
    val replaceHostedWindow =
        currentState?.presentation?.trim()?.lowercase() == "hosted" &&
            currentState.region?.trim()?.lowercase() == "chat.top" &&
            !link.newInstance
    return runtime.openWindow(
        windowKey = link.windowKey,
        title = link.title,
        inTab = link.inTab,
        parameters = link.parameters,
        windowIdOverride = if (replaceHostedWindow) currentState?.windowId else null,
        conversationId = currentState?.conversationId,
        presentation = currentState?.presentation,
        region = currentState?.region,
        workspaceSharePct = currentState?.workspaceSharePct,
        workspaceMinHeight = currentState?.workspaceMinHeight,
        parentKey = currentState?.parentKey,
        isModal = link.modal
    )
}

private fun resolveLinkParameterValue(
    spec: JsonElement,
    context: LinkResolutionContext
): Any? {
    val obj = spec as? JsonObject ?: return jsonElementToLinkAny(spec)
    val selector = (
        obj["selector"].asString()
            ?: obj["field"].asString()
            ?: obj["location"].asString()
            ?: ""
        ).trim()
    val explicitSource = obj["source"].asString()?.trim()?.lowercase().orEmpty()
    val source = when {
        explicitSource.isNotEmpty() -> explicitSource
        selector.isNotEmpty() -> "row"
        obj.containsKey("value") -> "const"
        else -> "value"
    }
    val candidate = if (source == "const") {
        jsonElementToLinkAny(obj["value"] ?: JsonNull)
    } else {
        resolveLinkSourceValue(source, selector, context)
    }
    val wrap = obj["wrap"].asString()?.trim()?.lowercase().orEmpty()
    return if (wrap == "array" && candidate != null) listOf(candidate) else candidate
}

private fun resolveLinkSourceValue(
    source: String,
    selector: String,
    context: LinkResolutionContext
): Any? {
    return when (source) {
        "row" -> {
            if (selector.isEmpty()) {
                context.row
            } else {
                SelectorUtil.resolve(context.row, selector)
            }
        }
        "value" -> {
            if (selector.isEmpty()) {
                context.value
            } else {
                val valueMap = stringKeyedMap(context.value)
                valueMap?.let { SelectorUtil.resolve(it, selector) }
            }
        }
        "form" -> if (selector.isEmpty()) context.form else SelectorUtil.resolve(context.form, selector)
        "windowform" -> if (selector.isEmpty()) context.windowForm else SelectorUtil.resolve(context.windowForm, selector)
        "metrics" -> if (selector.isEmpty()) context.metrics else SelectorUtil.resolve(context.metrics, selector)
        else -> if (selector.isEmpty()) context.value else null
    }
}

private fun renderLinkTemplate(
    template: String,
    holder: Any?
): String {
    val source = template.trim()
    if (source.isEmpty()) {
        return ""
    }
    val holderMap = stringKeyedMap(holder)
    return LINK_TEMPLATE_REGEX.replace(source) { match ->
        val selector = match.groupValues.getOrNull(1)?.trim().orEmpty()
        if (selector.isEmpty() || holderMap == null) {
            ""
        } else {
            linkDisplayString(SelectorUtil.resolve(holderMap, selector))
        }
    }.replace(Regex("\\s{2,}"), " ").trim()
}

internal fun linkDisplayString(value: Any?): String {
    return when (value) {
        null -> "—"
        is String -> value
        is Boolean -> if (value) "true" else "false"
        is Float -> numberDisplayString(value.toDouble())
        is Double -> numberDisplayString(value)
        is Number -> value.toString()
        is Map<*, *> -> value.entries
            .filter { it.key is String }
            .sortedBy { it.key as String }
            .joinToString(", ") { (key, entryValue) -> "$key: ${linkDisplayString(entryValue)}" }
        is Iterable<*> -> value.joinToString(", ") { linkDisplayString(it) }
        is Array<*> -> value.joinToString(", ") { linkDisplayString(it) }
        else -> value.toString()
    }
}

private fun numberDisplayString(value: Double): String =
    if (value.isFinite() && value % 1.0 == 0.0) value.toLong().toString() else value.toString()

private fun jsonElementToLinkAny(value: JsonElement): Any? {
    return when (value) {
        is JsonObject -> value.mapValues { (_, entry) -> jsonElementToLinkAny(entry) }
        is JsonArray -> value.map { jsonElementToLinkAny(it) }
        is JsonPrimitive -> {
            if (value.isString) value.contentOrNull
            else value.booleanOrNull ?: value.longOrNull ?: value.doubleOrNull ?: value.contentOrNull
        }
        else -> null
    }
}

private fun stringKeyedMap(value: Any?): Map<String, Any?>? {
    val raw = value as? Map<*, *> ?: return null
    return raw.entries
        .filter { it.key is String }
        .associate { (key, entryValue) -> key as String to entryValue }
}

private fun JsonElement?.asString(): String? {
    return (this as? JsonPrimitive)?.contentOrNull
}

private val LINK_TEMPLATE_REGEX = Regex("\\{\\{\\s*([^}]+?)\\s*\\}\\}")

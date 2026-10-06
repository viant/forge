package com.viant.forgeandroid.runtime

import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.*

/** Preserve authored hook input without adding any transport or snapshot field. */
object PreservingReportBuilderSerializer : KSerializer<DashboardReportBuilderDef> {
    private val delegate = DashboardReportBuilderDef.serializer()
    override val descriptor: SerialDescriptor = delegate.descriptor
    override fun deserialize(decoder: Decoder): DashboardReportBuilderDef {
        val jsonDecoder = decoder as? JsonDecoder ?: error("Report builder metadata requires JSON")
        val raw = jsonDecoder.decodeJsonElement() as? JsonObject ?: error("Report builder must be an object")
        return jsonDecoder.json.decodeFromJsonElement(delegate, raw).copy(authoredConfiguration = raw)
    }
    override fun serialize(encoder: Encoder, value: DashboardReportBuilderDef) {
        val jsonEncoder = encoder as? JsonEncoder ?: error("Report builder metadata requires JSON")
        jsonEncoder.encodeJsonElement(value.authoredConfiguration ?: jsonEncoder.json.encodeToJsonElement(delegate, value))
    }
}

fun reportBuilderHookConfiguration(config: DashboardReportBuilderDef): JsonObject {
    val typed = JsonUtil.json.encodeToJsonElement(DashboardReportBuilderDef.serializer(), config).jsonObject
    val raw = config.authoredConfiguration ?: typed
    // Native lowering supplies declarative filter controls, retaining every authored extension.
    return JsonObject(raw.toMutableMap().apply {
        if (config.staticFilters.isNotEmpty()) put("staticFilters", mergeHookControls(raw["staticFilters"], typed.getValue("staticFilters")))
        if (config.dynamicFilterGroups.isNotEmpty()) put("dynamicFilterGroups", mergeHookControls(raw["dynamicFilterGroups"], typed.getValue("dynamicFilterGroups")))
        if (config.dynamicFilterFamilies.isNotEmpty()) put("dynamicFilterFamilies", mergeHookControls(raw["dynamicFilterFamilies"], typed.getValue("dynamicFilterFamilies")))
    })
}

private fun mergeHookControls(raw: JsonElement?, lowered: JsonElement): JsonElement {
    if (raw is JsonObject && lowered is JsonObject) return JsonObject(raw.toMutableMap().apply {
        lowered.forEach { (key, value) -> put(key, mergeHookControls(raw[key], value)) }
    })
    if (raw is JsonArray && lowered is JsonArray) {
        val emitted = lowered.map { value ->
            val id = (value as? JsonObject)?.get("id")
            val original = if (id != null) raw.firstOrNull { (it as? JsonObject)?.get("id") == id } else null
            mergeHookControls(original, value)
        }
        return JsonArray(emitted)
    }
    return lowered
}

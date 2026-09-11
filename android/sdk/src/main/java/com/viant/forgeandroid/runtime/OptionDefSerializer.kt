package com.viant.forgeandroid.runtime

import kotlinx.serialization.*
import kotlinx.serialization.descriptors.*
import kotlinx.serialization.encoding.*
import kotlinx.serialization.json.*

object OptionDefSerializer : KSerializer<OptionDef> {
    override val descriptor = buildClassSerialDescriptor("OptionDef")
    override fun deserialize(decoder: Decoder): OptionDef {
        val value = (decoder as JsonDecoder).decodeJsonElement().jsonObject
        val raw = value["value"]?.takeIf { it != JsonNull }
        return OptionDef(raw?.let(NativeWidgetContract::text), value["label"]?.jsonPrimitive?.contentOrNull, value["default"]?.jsonPrimitive?.booleanOrNull, raw)
    }
    override fun serialize(encoder: Encoder, value: OptionDef) {
        (encoder as JsonEncoder).encodeJsonElement(JsonObject(buildMap {
            value.rawValue?.let { put("value", it) }; value.label?.let { put("label", JsonPrimitive(it)) }; value.default?.let { put("default", JsonPrimitive(it)) }
        }))
    }
}

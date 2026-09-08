package com.viant.forgeandroid.runtime

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable data class ResourceSchemaDef(val type: String? = null, val identity: List<String> = emptyList(), val required: List<String> = emptyList(), val properties: Map<String, ResourceFieldSchemaDef> = emptyMap(), val additionalProperties: Boolean? = null)
@Serializable data class ResourceFieldSchemaDef(val type: String? = null, @SerialName("\$ref") val ref: String? = null, val format: String? = null, val nullable: Boolean = false, val readOnly: Boolean = false, val writeOnly: Boolean = false, @SerialName("enum") val enumValues: List<JsonElement> = emptyList(), @SerialName("default") val defaultValue: JsonElement? = null, val minimum: Double? = null, val maximum: Double? = null, val minLength: Int? = null, val maxLength: Int? = null, val minItems: Int? = null, val maxItems: Int? = null, val items: ResourceFieldSchemaDef? = null, val required: List<String> = emptyList(), val properties: Map<String, ResourceFieldSchemaDef> = emptyMap())
@Serializable data class ResourceModelDef(val schemaRef: String, val read: ResourceReadBindingDef? = null, val write: ResourceWriteBindingDef? = null, val fields: Map<String, ResourceFieldBindingDef> = emptyMap(), val hooks: ResourceModelHooksDef? = null)
@Serializable data class ResourceReadBindingDef(val dataSourceRef: String? = null, val preserveUnbound: Boolean = false)
@Serializable data class ResourceWriteBindingDef(val dataSourceRef: String? = null, val inputPath: String? = null, val mode: String? = null, val collection: Boolean = false)
@Serializable data class ResourceFieldBindingDef(val read: String? = null, val write: String? = null, val codec: String? = null, val trim: Boolean = false, val empty: String? = null, @SerialName("default") val defaultValue: JsonElement? = null, val alwaysWrite: Boolean = false, val omitIfUnchanged: Boolean = false, val modelRef: String? = null, val collection: ResourceCollectionBindingDef? = null)
@Serializable data class ResourceCollectionBindingDef(val modelRef: String? = null, val identity: List<String> = emptyList(), val clientKey: String? = null, val mode: String? = null, val preserveOrder: Boolean? = null)
@Serializable data class ResourceModelHooksDef(val beforeUnmarshal: String? = null, val afterUnmarshal: String? = null, val beforeMarshal: String? = null, val afterMarshal: String? = null)
@Serializable data class ResourceValueSourceDef(val scope: String? = null, val dataSourceRef: String? = null, val selector: String? = null, val value: JsonElement? = null, val where: ResourceValueFilterDef? = null, val mapSelector: String? = null, val codec: String? = null)
@Serializable data class ResourceValueFilterDef(val field: String, val equals: JsonElement? = null, val notEquals: JsonElement? = null, @SerialName("in") val inValues: List<JsonElement> = emptyList())
@Serializable data class ResourcePayloadPreparationDef(val modelRef: String, val source: ResourceValueSourceDef? = null, val fields: Map<String, ResourceValueSourceDef> = emptyMap(), val baseline: ResourceValueSourceDef? = null, val mode: String? = null, val target: String? = null)

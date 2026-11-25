package com.viant.forgeandroid.runtime

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.*

@Serializable
data class ResourceInvariantDef(
    @SerialName("when")
    val whenCondition: @Serializable(with = CanonicalConditionSerializer::class) DashboardConditionDef? = null,
    @SerialName("assert")
    val assertion: @Serializable(with = CanonicalConditionSerializer::class) DashboardConditionDef,
    val path: String? = null,
    val message: String
) {
    init {
        require(message.isNotBlank()) { "An invariant requires a message" }
        whenCondition?.prepareCanonicalSelectors()
        assertion.prepareCanonicalSelectors()
    }
}

internal class CanonicalInvariantSelectors(val field: List<String>, val bounds: Map<String, List<String>>)

private fun DashboardConditionDef.prepareCanonicalSelectors() {
    if (canonicalSelectors != null) return
    canonicalSelectors = CanonicalInvariantSelectors(field?.split('.').orEmpty(),
        if (invariantBounds.isEmpty()) emptyMap() else invariantBounds.mapValues { (_, path) -> path.split('.') })
    all.forEach { it.prepareCanonicalSelectors() }
    any.forEach { it.prepareCanonicalSelectors() }
    not?.prepareCanonicalSelectors()
}

/** Decode only the record-local subset of the presentation predicate language. */
internal object CanonicalConditionSerializer : KSerializer<DashboardConditionDef> {
    override val descriptor = JsonObject.serializer().descriptor
    private val bounds = setOf("gt", "gte", "lt", "lte")
    private val fieldBounds = bounds.map { it + "Field" }.toSet()
    private val leaves = bounds + fieldBounds + setOf("equals", "notEquals", "in", "exists", "empty", "notEmpty")

    override fun deserialize(decoder: Decoder): DashboardConditionDef =
        compile((decoder as JsonDecoder).decodeJsonElement().jsonObject, decoder.json)

    override fun serialize(encoder: Encoder, value: DashboardConditionDef) {
        val json = encoder as JsonEncoder
        json.encodeJsonElement(encode(value, json.json))
    }

    private fun encode(node: DashboardConditionDef, json: Json): JsonObject {
        if (node.not != null) return buildJsonObject { put("not", encode(node.not, json)) }
        if (node.all.isNotEmpty()) return buildJsonObject { put("all", JsonArray(node.all.map { encode(it, json) })) }
        if (node.any.isNotEmpty()) return buildJsonObject { put("any", JsonArray(node.any.map { encode(it, json) })) }
        val base = json.encodeToJsonElement(DashboardConditionDef.serializer(), node).jsonObject
        if (node.invariantBounds.isEmpty()) return base
        return buildJsonObject {
            base.forEach { (key, value) -> put(key, value) }
            node.invariantBounds.forEach { (bound, path) -> put(bound + "Field", path) }
        }
    }

    private fun compile(node: JsonObject, json: Json): DashboardConditionDef {
        node["not"]?.let {
            require(node.size == 1) { "An invariant group cannot contain leaf predicates" }
            return DashboardConditionDef(not = compile(it.jsonObject, json))
        }
        for (operator in listOf("all", "any")) {
            val entries = node[operator] ?: continue
            require(node.size == 1 && entries is JsonArray && entries.isNotEmpty()) { "Invalid invariant $operator group" }
            val children = entries.map { compile(it.jsonObject, json) }
            return if (operator == "all") DashboardConditionDef(all = children) else DashboardConditionDef(any = children)
        }
        val field = node["field"] as? JsonPrimitive
        require(field?.isString == true && field.content.isNotBlank()) { "An invariant leaf requires a field" }
        require("source" !in node || node["source"] == JsonPrimitive("form")) { "Invariants require a canonical form field" }
        val operators = node.keys - "field" - "source"
        require(operators.isNotEmpty() && operators.all(leaves::contains)) { "Unsupported invariant predicate" }
        require(operators.size == 1 || operators.all { it in bounds || it in fieldBounds }) { "Ambiguous invariant predicate" }
        for (op in operators) {
            val operand = node.getValue(op)
            if (op in bounds) require(operand is JsonPrimitive && !operand.isString && operand.doubleOrNull?.isFinite() == true) {
                "An invariant $op requires a finite numeric bound"
            }
            if (op == "empty" || op == "notEmpty" || op == "exists") require(operand is JsonPrimitive && !operand.isString && operand.booleanOrNull != null) {
                "An invariant $op requires a boolean"
            }
        }
        val refs = operators.filter(fieldBounds::contains).associate { op ->
            val ref = node.getValue(op) as? JsonPrimitive
            require(ref != null && ref.isString && ref.content.isNotBlank()) { "An invariant $op requires a field path" }
            op.removeSuffix("Field") to ref.content
        }
        val declared = if (refs.isEmpty()) node else JsonObject(node.filterKeys { it !in fieldBounds })
        val condition = json.decodeFromJsonElement(DashboardConditionDef.serializer(), declared)
        if ("in" in operators) require(condition.inValues.isNotEmpty() && condition.inValues.all { it is JsonPrimitive }) {
            "An invariant in predicate requires scalar choices"
        }
        for (op in listOf("equals", "notEquals")) {
            require(op !in operators || node[op] is JsonPrimitive) { "An invariant equality requires a scalar" }
        }
        // A nullable Kotlin property normally decodes a JSON null as a missing operator.
        return if (refs.isNotEmpty() || node["equals"] === JsonNull || node["notEquals"] === JsonNull)
            condition.copy(equals = node["equals"], notEquals = node["notEquals"], invariantBounds = refs) else condition
    }
}

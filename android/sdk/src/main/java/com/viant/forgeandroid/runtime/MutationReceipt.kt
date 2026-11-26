package com.viant.forgeandroid.runtime

import kotlinx.serialization.KSerializer
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.*

/** Preserve declared operators: ordinary presentation metadata ignores unknown keys and conflates absent and null operands. */
internal object ReceiptConditionSerializer : KSerializer<DashboardConditionDef> {
    override val descriptor = DashboardConditionDef.serializer().descriptor

    override fun deserialize(decoder: Decoder): DashboardConditionDef {
        val input = decoder as JsonDecoder
        val declared = input.decodeJsonElement()
        return input.json.decodeFromJsonElement(DashboardConditionDef.serializer(), declared).also { it.declaredReceipt = declared }
    }

    override fun serialize(encoder: Encoder, value: DashboardConditionDef) {
        val output = encoder as JsonEncoder
        output.encodeJsonElement(value.declaredReceipt ?: output.json.encodeToJsonElement(DashboardConditionDef.serializer(), value))
    }
}

internal typealias ReceiptPredicate = (JsonArray) -> Boolean?
private val receiptBounds = setOf("gt", "gte", "lt", "lte")
private val receiptSelectors = setOf("source", "field", "selector", "key")

private fun validReceiptLeaf(leaf: JsonObject): Boolean {
    val operators = leaf.keys - receiptSelectors
    if (operators.size > 1 && !receiptBounds.containsAll(operators)) return false
    return operators.all { name ->
        val value = leaf.getValue(name)
        when (name) {
            in receiptBounds -> value is JsonPrimitive && !value.isString && value.doubleOrNull?.isFinite() == true
            "equals", "notEquals", "contains" -> value is JsonPrimitive
            "in" -> value is JsonArray && value.isNotEmpty() && value.all { it is JsonPrimitive }
            "empty", "notEmpty", "exists" -> value is JsonPrimitive && !value.isString && value.booleanOrNull != null
            "matches" -> value is JsonPrimitive && value.isString
            else -> false
        }
    }
}

// Compile once for an opted-in command. A missing field supplies no evidence, even under negation.
internal fun DashboardConditionDef.compileReceiptPredicate(declared: JsonElement? = declaredReceipt): ReceiptPredicate? {
    val rule = (declared ?: JsonUtil.json.encodeToJsonElement(DashboardConditionDef.serializer(), this)) as? JsonObject ?: return null
    if ("not" in rule) {
        if (rule.size != 1) return null
        val child = not?.compileReceiptPredicate(rule["not"]) ?: return null
        return { rows -> child(rows)?.not() }
    }
    if ("all" in rule || "any" in rule) {
        if (rule.size != 1) return null
        val anyGroup = "any" in rule
        val entries = rule.values.single() as? JsonArray ?: return null
        val items = if (anyGroup) any else all
        if (entries.isEmpty() || items.size != entries.size) return null
        val children = items.mapIndexed { i, node -> node.compileReceiptPredicate(entries[i]) ?: return null }
        return fun(rows): Boolean? {
            var missing = false
            for (child in children) {
                val value = child(rows)
                if (value == anyGroup) return anyGroup
                if (value == null) missing = true
            }
            return if (missing) null else !anyGroup
        }
    }
    val path = listOfNotNull(selector, field, key).singleOrNull() ?: return null
    if (source != "collection" || !validReceiptLeaf(rule)) return null
    val parts = path.split('.')
    val index = parts.first().toIntOrNull() ?: return null
    if (index < 0 || parts.first() != index.toString()) return null
    val fields = parts.drop(1)
    if (fields.any { !safeFormField(it) }) return null
    // Nullable serialization drops an explicitly null operand. Keep that comparison for checked writers.
    val leaf = if (rule["equals"] === JsonNull || rule["notEquals"] === JsonNull || rule["contains"] === JsonNull)
        copy(equals = rule["equals"], notEquals = rule["notEquals"], contains = rule["contains"]) else this
    val bare = rule.keys.all(receiptSelectors::contains)
    val numeric = rule.keys.any(receiptBounds::contains)
    return fun(rows): Boolean? {
        val record = rows.getOrNull(index) as? JsonObject ?: return null
        val value = SelectorUtil.resolveParts(record, fields, SelectorUtil.Missing) as? JsonElement ?: return null
        if (numeric && (value !is JsonPrimitive || value.isString || value.doubleOrNull?.isFinite() != true)) return null
        if (bare) return when {
            value === JsonNull -> false
            value !is JsonPrimitive -> true
            value.isString -> value.content.isNotEmpty()
            value.booleanOrNull != null -> value.boolean
            else -> value.doubleOrNull?.let { it != 0.0 } == true
        }
        return evaluateConditionTree(leaf, record) { _, _ -> value }
    }
}

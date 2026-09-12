package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*

class ClientFilterException(message: String) : IllegalArgumentException(message)

object ClientFilterRuntime {
    fun matches(value: JsonElement?, expected: JsonElement, operation: String): Boolean {
        val actual = value ?: JsonNull
        fun text(item: JsonElement): String = when (item) {
            is JsonPrimitive -> item.content
            else -> ""
        }
        fun equal(left: JsonElement, right: JsonElement): Boolean {
            if (left == right) return true
            val leftPrimitive = left as? JsonPrimitive
            val rightPrimitive = right as? JsonPrimitive
            val leftNumber = leftPrimitive?.contentOrNull?.toDoubleOrNull()
            val rightNumber = rightPrimitive?.contentOrNull?.toDoubleOrNull()
            if (leftNumber != null && rightNumber != null && leftNumber.isFinite() && rightNumber.isFinite()) return leftNumber == rightNumber
            return leftPrimitive?.contentOrNull?.equals(rightPrimitive?.contentOrNull, ignoreCase = true) == true
        }
        return when (val op = operation.trim().lowercase()) {
            "contains" -> {
                if (actual is JsonArray) actual.any { equal(it, expected) }
                else {
                    if (actual is JsonObject || expected is JsonObject || expected is JsonArray || expected is JsonNull) throw ClientFilterException("invalid contains operand")
                    actual !is JsonNull && text(actual).contains(text(expected), ignoreCase = true)
                }
            }
            "equal", "equals", "eq", "=" -> equal(actual, expected)
            "notequal", "neq", "!=" -> !equal(actual, expected)
            "in", "notin" -> {
                val candidates = expected as? JsonArray ?: throw ClientFilterException("membership requires an array")
                val values = (actual as? JsonArray)?.toList() ?: listOf(actual)
                val matched = values.any { value -> candidates.any { equal(value, it) } }
                if (op == "in") matched else !matched
            }
            "greaterthan", "gt", ">", "greaterorequal", "gte", ">=", "lessthan", "lt", "<", "lessorequal", "lte", "<=" -> {
                val left = text(actual).toDoubleOrNull()?.takeIf(Double::isFinite) ?: throw ClientFilterException("invalid numeric operand")
                val right = text(expected).toDoubleOrNull()?.takeIf(Double::isFinite) ?: throw ClientFilterException("invalid numeric operand")
                when (op) {
                    "greaterthan", "gt", ">" -> left > right
                    "greaterorequal", "gte", ">=" -> left >= right
                    "lessthan", "lt", "<" -> left < right
                    else -> left <= right
                }
            }
            else -> throw ClientFilterException("unsupported operator: $operation")
        }
    }
}

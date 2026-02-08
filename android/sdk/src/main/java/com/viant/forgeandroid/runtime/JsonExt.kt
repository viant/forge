package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.JsonPrimitive

fun JsonPrimitive.booleanOrNull(): Boolean? = content.toBooleanStrictOrNull()

fun JsonPrimitive.longOrNull(): Long? = content.toLongOrNull()

fun JsonPrimitive.doubleOrNull(): Double? = content.toDoubleOrNull()

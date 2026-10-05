package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*
import java.security.MessageDigest

const val NATIVE_REPORT_DIGEST_PROFILE = "agently-json-binary64-v1"

/** Copy tree containers without a second full JSON string or copying immutable string leaves. */
fun nativeReportImmutableJson(value:JsonElement):JsonElement = when(value) {
    is JsonObject -> JsonObject(value.mapValues { nativeReportImmutableJson(it.value) })
    is JsonArray -> JsonArray(value.map(::nativeReportImmutableJson))
    else -> value
}

/** Portable framed JSON digest; never retains an encoder-specific canonical JSON string. */
fun nativeReportAdmissionDigest(value: JsonElement): String {
    val digest = MessageDigest.getInstance("SHA-256")
    fun ascii(text: String) { digest.update(text.toByteArray(Charsets.US_ASCII)) }
    fun utf8(text: String): ByteArray {
        var index = 0
        while (index < text.length) {
            val char = text[index]
            if (Character.isHighSurrogate(char)) {
                require(index + 1 < text.length && Character.isLowSurrogate(text[index + 1])) { "unsupported-unicode" }
                index += 2
            } else {
                require(!Character.isLowSurrogate(char)) { "unsupported-unicode" }
                index++
            }
        }
        return text.toByteArray(Charsets.UTF_8)
    }
    fun string(text: String) { val bytes = utf8(text); ascii("S${bytes.size}:"); digest.update(bytes) }
    fun compare(left: ByteArray, right: ByteArray): Int {
        for (index in 0 until minOf(left.size, right.size)) {
            val difference = (left[index].toInt() and 255) - (right[index].toInt() and 255)
            if (difference != 0) return difference
        }
        return left.size - right.size
    }
    fun emit(input: JsonElement) {
        when (input) {
            JsonNull -> ascii("N")
            is JsonArray -> { ascii("A${input.size}:"); input.forEach(::emit) }
            is JsonObject -> {
                val entries = input.entries.map { Triple(it.key, it.value, utf8(it.key)) }.sortedWith { left, right -> compare(left.third, right.third) }
                ascii("O${entries.size}:"); entries.forEach { string(it.first); emit(it.second) }
            }
            is JsonPrimitive -> {
                if (input.isString) string(input.content)
                else if (input.booleanOrNull != null) ascii(if (input.booleanOrNull == true) "T" else "F")
                else {
                    val number = input.doubleOrNull ?: error("unsupported-number")
                    require(number.isFinite() && !(number % 1.0 == 0.0 && kotlin.math.abs(number) > 9_007_199_254_740_991.0)) { "unsupported-number" }
                    val bits = java.lang.Double.doubleToLongBits(if (number == 0.0) 0.0 else number)
                    ascii("D${java.lang.Long.toUnsignedString(bits, 16).padStart(16, '0')}")
                }
            }
        }
    }
    ascii("$NATIVE_REPORT_DIGEST_PROFILE\n"); emit(value)
    return digest.digest().joinToString("") { "%02x".format(it) }
}

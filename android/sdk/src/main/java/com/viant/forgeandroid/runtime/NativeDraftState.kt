package com.viant.forgeandroid.runtime

data class NativeDraftState(val baseline: Map<String, Any?>) {
    fun dirty(form: Map<String, Any?>) = form != baseline
    fun accepted(form: Map<String, Any?>) = copy(baseline = form.toMap())
    fun submitExtras(form: Map<String, Any?>) = mapOf("data" to form)
    fun resetExtras() = mapOf("values" to baseline)
}

package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull

internal class PreparedMutationReadback private constructor(
    val reader: String,
    private val spec: ReconcileVerificationSpec,
    identityField: String,
    private val scopeValues: List<JsonElement>,
    private val submitted: Map<Any, List<ReadbackExpectedField>>,
    private val generated: List<ReadbackExpectedField>?,
    returnedIdentityField: String,
    val readerDefinition: DataSourceDef
) {
    private val identityPath = identityField.split('.')
    private val returnedIdentityPath = returnedIdentityField.split('.')
    private val readerScope = spec.scope.zip(scopeValues).map { (binding, value) ->
        ReadbackExpectedField(binding.field.split('.'), checkNotNull(readbackScopeScalar(value)))
    }

    fun inputs(acknowledged: JsonArray): Map<String, Any?> = buildMap {
        put(spec.idsParameter, acknowledged.map { row -> JsonUtil.elementToAny(checkNotNull(readbackValue(row, returnedIdentityPath))) })
        for ((binding, value) in spec.scope.zip(scopeValues)) {
            if (binding.passToReader) put(checkNotNull(binding.parameter.name), JsonUtil.elementToAny(value))
        }
    }

    fun scopeMatches(source: DataSourceContext, resolver: ParameterResolver): Boolean =
        resolveReadbackScope(spec, reader, source, resolver)?.let { values ->
            values.zip(scopeValues).all { (actual, expected) -> sameReadbackValue(actual, expected) }
        } == true

    fun matches(rows: List<Map<String, Any?>>, acknowledged: JsonArray): Boolean {
        if (rows.size != acknowledged.size) return false
        val remaining = acknowledged.map { receiptId(readbackValue(it, returnedIdentityPath)) }.toMutableSet()
        for (record in rows) {
            val row = JsonUtil.anyToElement(record)
            val id = receiptId(readbackValue(row, identityPath)) ?: return false
            if (!remaining.remove(id)) return false
            if (readerScope.any { !it.matches(row) }) return false
            if (spec.fields.isNotEmpty()) {
                val fields = generated ?: submitted[id] ?: return false
                if (fields.any { !it.matches(row) }) return false
            }
        }
        return remaining.isEmpty()
    }

    companion object {
        fun prepare(command: MutationCommandDef, parameters: Map<String, Any?>, source: DataSourceContext,
            resolver: ParameterResolver): PreparedMutationReadback? {
            val reconcile = command.reconcile ?: return null
            val spec = reconcile.verify ?: return null
            val reader = checkNotNull(reconcile.dataSourceRef)
            val definition = source.window.metadata.peek()?.dataSources?.get(reader)
                ?: error("The verification reader is unavailable.")
            val identity = checkNotNull(command.receiptIdentity)
            val submittedPath = spec.submittedRows ?: identity.submittedRows
            val captured = JsonUtil.anyToElement(parameters)
            val rows = if (submittedPath != null) {
                requireNotNull(readbackValue(captured, submittedPath) as? JsonArray).also {
                    require(it.isNotEmpty() && it.all { row -> row is JsonObject }) { "Submitted verification rows are invalid." }
                }.map { it as JsonObject }
            } else emptyList()
            val fields = spec.fields.map { (input, output) -> input.split('.') to output.split('.') }
            fun project(row: JsonObject): List<ReadbackExpectedField> = fields.mapNotNull { (input, output) ->
                // A missing input is omitted. An explicitly submitted null
                // remains present and must be confirmed by the reader.
                readbackValue(row, input)?.let { ReadbackExpectedField(output, it) }
            }
            val indexed = mutableMapOf<Any, List<ReadbackExpectedField>>()
            var generated: List<ReadbackExpectedField>? = null
            if (fields.isNotEmpty()) {
                if (identity.generated == true) {
                    generated = project(rows.singleOrNull() ?: error("Generated verification requires exactly one submitted row."))
                } else {
                    val idPath = (identity.submittedField ?: identity.field).split('.')
                    for (row in rows) {
                        val id = receiptId(readbackValue(row, idPath))
                            ?: error("A submitted verification row is missing its identity.")
                        require(indexed.put(id, project(row)) == null) { "Submitted verification identities must be distinct." }
                    }
                }
            }
            val scope = resolveReadbackScope(spec, reader, source, resolver) ?: error("Verification scope parameters are unavailable.")
            return PreparedMutationReadback(reader, spec, reconcile.identityField ?: identity.field, scope,
                indexed, generated, identity.field, definition)
        }
    }
}

internal fun MutationCommandDef.readbackDefinitionError(): String? {
    val reconcile = reconcile ?: return null
    val spec = reconcile.verify ?: return null
    val identity = receiptIdentity
    val ref = reconcile.dataSourceRef
    val invalid = "Verification requires a distinct refetch reader, receipt identities, and valid named scope bindings."
    if (group != null || reconcile.mode != "refetch" || identity == null || ref.isNullOrBlank() || ref == dataSourceRef ||
        !safeFormField(spec.idsParameter) || spec.scope.isEmpty() ||
        reconcile.identityFields.isNotEmpty() || reconcile.rowsPath != null ||
        listOfNotNull(reconcile.identityField, reconcile.resultPath, spec.submittedRows).any { !readbackPath(it) } ||
        refresh.any { it.dataSourceRef == ref || it.dataSourceRef == dataSourceRef } ||
        before.any { it.command.dataSourceRef == ref || it.cleanup?.dataSourceRef == ref } ||
        (spec.submittedRows != null && identity.generated != true && spec.submittedRows != identity.submittedRows) ||
        (spec.fields.isNotEmpty() && spec.submittedRows == null && identity.submittedRows == null) ||
        spec.fields.any { (from, to) -> !readbackPath(from) || !readbackPath(to) }) return invalid
    val names = mutableSetOf(spec.idsParameter)
    val fields = mutableSetOf<String>()
    for (binding in spec.scope) {
        val name = binding.parameter.name ?: return invalid
        if (!safeFormField(name) || !names.add(name) || !readbackPath(binding.field) || !fields.add(binding.field)) return invalid
    }
    return null
}

internal fun readbackValue(value: JsonElement, path: String): JsonElement? =
    readbackValue(value, path.split('.'))

private fun readbackValue(value: JsonElement, path: List<String>): JsonElement? =
    SelectorUtil.resolveParts(value, path, SelectorUtil.Missing, strictArrayIndex = true) as? JsonElement

private data class ReadbackExpectedField(val path: List<String>, val expected: JsonElement) {
    fun matches(row: JsonElement): Boolean = sameReadbackValue(readbackValue(row, path), expected)
}

private fun readbackScopeScalar(value: JsonElement): JsonPrimitive? {
    val scalar = (if (value is JsonArray) value.singleOrNull() else value) as? JsonPrimitive ?: return null
    return when {
        scalar === JsonNull -> null
        scalar.isString -> scalar.takeIf { it.content.isNotBlank() }
        scalar.booleanOrNull != null || scalar.doubleOrNull?.isFinite() == true -> scalar
        else -> null
    }
}

private fun readbackPath(value: String): Boolean = value.split('.').all(::safeFormField)

private fun resolveReadbackScope(spec: ReconcileVerificationSpec, reader: String, source: DataSourceContext,
    resolver: ParameterResolver): List<JsonElement>? {
    return spec.scope.map { binding ->
        val resolved = resolver.resolveOperation(listOf(binding.parameter), source).inbound
        val parameters = mutationTargetParameters(resolved[reader] ?: resolved[""] ?: emptyMap())
        val name = binding.parameter.name ?: return null
        if (!parameters.containsKey(name)) return null
        val value = JsonUtil.anyToElement(parameters[name])
        if (readbackScopeScalar(value) == null) return null
        value
    }
}

private fun sameReadbackValue(left: JsonElement?, right: JsonElement?): Boolean {
    if (left == right) return true
    return when {
        left is JsonObject && right is JsonObject ->
            left.keys == right.keys && left.all { (key, value) -> sameReadbackValue(value, right[key]) }
        left is JsonArray && right is JsonArray ->
            left.size == right.size && left.indices.all { sameReadbackValue(left[it], right[it]) }
        left is JsonPrimitive && right is JsonPrimitive && !left.isString && !right.isString -> {
            val number = left.content.toBigDecimalOrNull()
            val other = right.content.toBigDecimalOrNull()
            number != null && other != null && number.compareTo(other) == 0
        }
        else -> false
    }
}


// Kept with the opening dialog, not the mutable draft or an ambient datasource.
class VerifiedDialogSelection private constructor(private val source: DataSourceContext) {
    private val fields = source.dataSource.uniqueKey.mapNotNull { it.field ?: it.parameter }.ifEmpty { listOf("id") }
    private val expected = identityKeys(source.selection.peek())
    private val invalid = java.util.concurrent.atomic.AtomicBoolean(expected == null)
    private val observation = source.selection.observeChanges { if (identityKeys(it) != expected) invalid.set(true) }

    internal fun current(): Boolean = !invalid.get() && identityKeys(source.selection.peek()) == expected
    internal fun dispose() = observation()

    private fun identityKeys(selection: SelectionState): Set<List<String>>? = runCatching {
        val rows = selection.selection.ifEmpty { listOfNotNull(selection.selected) }
        val keys = rows.map { row -> fields.map { field -> selectionIdentity(SelectorUtil.resolve(row, field)) } }.toSet()
        require(keys.size == rows.size)
        keys
    }.getOrNull()

    companion object {
        internal fun capture(source: DataSourceContext): VerifiedDialogSelection? {
            val selection = source.selection.peek()
            if (selection.selection.isEmpty() && selection.selected == null) return null
            return VerifiedDialogSelection(source)
        }
    }
}

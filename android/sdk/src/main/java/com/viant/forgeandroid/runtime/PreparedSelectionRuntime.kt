package com.viant.forgeandroid.runtime

import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*

internal class EditableOperationInputs(
    private val metrics: Map<String, Any?>, private val form: Map<String, Any?>, private val windowForm: Map<String, Any?>,
    private val collection: List<Map<String, Any?>>, private val authorization: Map<String, Any?>, input: InputState, selection: SelectionState
) {
    private val inputValues = input.bindingValues()
    private val filter = input.filter
    private val selectionValues = mapOf("selected" to selection.selected, "selection" to selection.selection, "rowIndex" to selection.rowIndex)

    fun allows(condition: DashboardConditionDef?, row: Map<String, Any?>? = null): Boolean =
        evaluateDashboardCondition(condition, metrics = metrics, filters = filter, form = row ?: form,
            windowForm = windowForm, collection = collection, input = inputValues, selectionValues = selectionValues,
            authorization = authorization, row = row)

    fun disabled(operation: EditableCollectionOperationSpec, spec: EditableCollectionSpec, rows: List<Map<String, Any?>>): Boolean {
        val bounds = operation.selection ?: spec.selection
        val minimum = bounds?.min ?: if (operation.requiresSelection) 1 else 0
        val maximum = bounds?.max ?: 0
        if (rows.size < minimum || (maximum > 0 && rows.size > maximum)) return true
        if (operation.disabledWhen?.let { allows(it) } == true || bounds?.disabledWhen?.let { allows(it) } == true) return true
        bounds?.every?.let { predicate -> if (rows.isEmpty() || rows.any { !allows(predicate, it) }) return true }
        bounds?.any?.let { predicate -> if (rows.none { allows(predicate, it) }) return true }
        bounds?.none?.let { predicate -> if (rows.any { allows(predicate, it) }) return true }
        return false
    }
}

/** Owns only in-flight editable operations; prepared records never enter the reader's published state. */
internal class PreparedSelectionRuntime {
    private val active = ConcurrentHashMap<Pair<String, String>, String>()

    suspend fun activate(runtime: ForgeRuntime, source: DataSourceContext, spec: EditableCollectionSpec,
        operation: EditableCollectionOperationSpec, permission: PermissionBoundarySpec? = null,
        presented: () -> Boolean = { true }): Result<Boolean> {
        val prepare = operation.prepareSelection ?: return Result.success(false)
        val window = source.window
        val metadata = window.metadata.peek() ?: return Result.success(false)
        val dialogId = operation.dialogId ?: return Result.failure(IllegalArgumentException("The selection operation requires a dialog."))
        val dialog = window.dialogSignal(dialogId)
        val priorDialog = dialog.peek()
        val key = window.windowId to operation.id
        val invocation = UUID.randomUUID().toString()
        if (priorDialog.open || active.putIfAbsent(key, invocation) != null) return Result.success(false)
        val selection = source.selection.peek()
        val selected = selection.selection.ifEmpty { selection.selected?.let(::listOf).orEmpty() }
        val authorization = metadata.authorizationSnapshot.mapValues { JsonUtil.elementToAny(it.value) }
        val original = window.peekWindowForm()
        var pending = false
        var expectedParameters: JsonObject? = null
        fun currentPresentation() = presented() && window.signals.ownsMetadata(window.windowId, window.metadata) &&
            window.metadata.peek() === metadata && dialog.peek() === priorDialog && active[key] == invocation
        fun parameters(): Map<String, Any?> {
            val resolved = ParameterResolver().resolvePreparedSelection(operation.parameters, source).inbound
            return mutationTargetParameters(resolved[prepare.dataSourceRef] ?: resolved[""] ?: emptyMap())
        }
        fun eligible(rows: List<Map<String, Any?>> = selected): Boolean {
            if (!currentPresentation() || source.selection.peek() != selection) return false
            val form = source.form.peek()
            val metrics = source.metrics.peek()
            val collection = source.collection.peek()
            val current = window.peekWindowForm()
            val flag = prepare.pendingField
            val state = if (pending && flag != null && current[flag] == true) current.toMutableMap().also {
                if (flag in original) it[flag] = original[flag] else it.remove(flag)
            } else current
            val facts = EditableOperationInputs(metrics, form, state, collection, authorization, source.input.peek(), selection)
            if (!facts.allows(operation.visibleWhen) || facts.disabled(operation, spec, rows)) return false
            if (permission != null) {
                if (!facts.allows(permission.visibleWhen)) return false
                val grants = permission.dataSourceRef?.let { runtime.registeredSource(window.windowId, it)?.collection?.peek() }.orEmpty()
                if (!WorkflowPrimitiveRuntime.permissionAllows(permission, authorization, rows, grants)) return false
            }
            return expectedParameters?.let { JsonUtil.anyToElement(parameters()) == it } ?: true
        }
        try {
            if (!eligible()) return Result.success(false)
            val destination = metadata.dialogIndex[dialogId] ?: error("Selection dialog is unavailable: $dialogId")
            val draftRef = destination.content?.dataSourceRef ?: destination.dataSourceRef ?: error("The selection dialog requires a draft datasource.")
            val definition = metadata.dataSources[draftRef] ?: error("Selection draft is unavailable: $draftRef")
            require(prepare.mappingRef == null || prepare.mappingRef in metadata.resourceMappings) { "The selection mapping is unavailable." }
            require(prepare.idsParameter !in operation.parameters.mapNotNull { it.name }) { "The selection ID parameter is already declared." }
            require(destination.fetchOnOpen == false || (destination.fetchOnOpen == null && destination.content?.fetchData == false)) {
                "Prepared selection dialogs must disable their automatic opening read."
            }
            require(selected.isNotEmpty()) { "Select at least one record." }
            val ids = selected.map { SelectorUtil.resolve(it, prepare.identityField) }
            val keys = ids.map(::selectionIdentity)
            require(keys.toSet().size == keys.size) { "The selection contains a duplicate identity." }
            val resolved = parameters()
            val captured = JsonUtil.anyToElement(resolved).jsonObject
            expectedParameters = captured
            val request = JsonUtil.asStringMap(JsonUtil.elementToAny(captured)) + (prepare.idsParameter to ids)
            val scopes = prepare.scopeFields.mapValues { (_, name) ->
                val value = request[name]
                selectionIdentity(if (value is List<*>) value.singleOrNull() else value)
            }
            val status = buildMap<String, Any?> {
                prepare.errorField?.let { put(it, "") }
                prepare.pendingField?.let { put(it, true) }
            }
            if (status.isNotEmpty()) runtime.setWindowFormValues(window.windowId, status, bumpPrefillRevision = false)
            pending = true
            val fresh = withContext(Dispatchers.IO) { runtime.readSelectedRows(window, prepare.dataSourceRef, request) }
            currentCoroutineContext().ensureActive()
            if (!eligible()) return Result.success(false)
            val ordered = orderedSelection(fresh, keys, prepare.identityField, scopes)
            require(eligible(ordered)) { "The refreshed records are not eligible for this operation." }
            val props = selectionProps(metadata, prepare.mappingRef, ordered, request, invocation, definition.resourceModelRef)
            val code = metadata.actions?.code?.takeIf(String::isNotBlank) ?: error("Selection preparation handler is unavailable.")
            val projection = UIActionProjection.invoke(code, prepare.prepare, metadata.actionNamespace(prepare.prepare), source.dataSourceRef,
                runtime.actionSnapshots(mapOf(source.dataSourceRef to source), includeCollection = false),
                JsonUtil.anyToElement(window.peekWindowForm()).jsonObject, props, JsonObject(metadata.authorizationSnapshot),
                readOnly = true, windowKey = metadata.windowKey, actionNamespaces = listOfNotNull(metadata.namespace) + metadata.actionAliases)
            val seed = projection.result as? JsonObject ?: error("Selection preparation must return the complete draft object.")
            currentCoroutineContext().ensureActive()
            return synchronized(runtime) {
                if (!eligible(ordered)) Result.success(false) else {
                    val draft = window.contextOrNull(draftRef) ?: error("Selection draft is unavailable: $draftRef")
                    val previous = draft.form.peek()
                    val prepared = JsonUtil.asStringMap(JsonUtil.elementToAny(seed))
                    draft.setForm(prepared)
                    if (!eligible(ordered)) {
                        draft.form.update { if (it === prepared) previous else it }
                        Result.success(false)
                    } else {
                        runtime.openDialog(window.windowId, dialogId, emptyMap(), callerDataSourceRef = source.dataSourceRef)
                        Result.success(true)
                    }
                }
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            if (!currentPresentation() || source.selection.peek() != selection || expectedParameters?.let { runCatching { JsonUtil.anyToElement(parameters()) != it }.getOrDefault(true) } == true) return Result.success(false)
            prepare.errorField?.let { runtime.setWindowFormValues(window.windowId, mapOf(it to (error.message ?: "Could not prepare the selected records.")), bumpPrefillRevision = false) }
            return Result.failure(error)
        } finally {
            if (pending && active[key] == invocation && window.signals.ownsMetadata(window.windowId, window.metadata)) prepare.pendingField?.let { field ->
                if (window.peekWindowForm()[field] == true) runtime.setWindowFormValues(window.windowId, mapOf(field to false), bumpPrefillRevision = false)
            }
            active.remove(key, invocation)
        }
    }
}

private val decimalIdentity = Regex("[+-]?[0-9]+")
private const val maxExactSelectionInteger = 9007199254740991L

private fun selectionIdentity(value: Any?): String = when (value) {
    is String -> {
        require(value.isNotBlank()) { "A nonblank selection or scope identity is required." }
        if (decimalIdentity.matches(value)) value.toBigInteger().toString() else value
    }
    is Number -> {
        val number = value.toDouble()
        require(number.isFinite() && number % 1.0 == 0.0 && number >= -maxExactSelectionInteger && number <= maxExactSelectionInteger) {
            "A numeric selection or scope identity must be a safe integer."
        }
        number.toLong().toString()
    }
    else -> throw IllegalArgumentException("A selection or scope identity must be a number or nonblank string.")
}

private fun orderedSelection(rows: List<Map<String, Any?>>, keys: List<String>, identity: String,
    scopes: Map<String, String>): List<Map<String, Any?>> {
    require(rows.size == keys.size) { "The reader did not return exactly the selected records." }
    val byId = HashMap<String, Map<String, Any?>>(rows.size)
    for (row in rows) {
        require(scopes.all { (selector, expected) -> selectionIdentity(SelectorUtil.resolve(row, selector)) == expected }) {
            "The reader returned a record outside the selected scope."
        }
        require(byId.put(selectionIdentity(SelectorUtil.resolve(row, identity)), row) == null) { "The reader returned a duplicate record." }
    }
    return keys.map { byId[it] ?: error("The reader did not confirm every selected record.") }
}

private fun selectionProps(metadata: WindowMetadata, mappingRef: String?, rows: List<Map<String, Any?>>,
    parameters: Map<String, Any?>, invocationId: String, draftModelRef: String?): JsonObject {
    val descriptors = mutableListOf<JsonObject>()
    val indexes = HashMap<ResourceMappingCase, Int>()
    val cases = mutableListOf<Int>()
    val mapping = mappingRef?.let { metadata.resourceMappings[it] ?: error("Unknown resource mapping: $it") }
    if (mappingRef != null) for (row in rows) {
        val selected = ResourceModelRuntime.mappedCase(mappingRef, row, metadata)
        cases += indexes.getOrPut(selected) {
            val model = metadata.resourceModels.getValue(selected.modelRef)
            val schema = metadata.schemas.getValue(model.schemaRef)
            descriptors += buildJsonObject {
                put("modelRef", selected.modelRef); put("model", JsonUtil.json.encodeToJsonElement(ResourceModelDef.serializer(), model))
                put("schema", JsonUtil.json.encodeToJsonElement(ResourceSchemaDef.serializer(), schema)); put("values", JsonObject(selected.values))
            }
            descriptors.lastIndex
        }
    }
    return buildJsonObject {
        put("rows", JsonUtil.anyToElement(rows)); put("parameters", JsonUtil.anyToElement(parameters)); put("invocationId", invocationId)
        put("mapping", mapping?.let { buildJsonObject {
            put("fieldOrder", JsonUtil.anyToElement(it.fieldOrder))
            put("uploads", JsonObject(it.uploads.mapValues { (_, upload) -> JsonUtil.json.encodeToJsonElement(ResourceMappingUploadDef.serializer(), upload) }))
        } } ?: JsonNull)
        put("descriptors", JsonArray(descriptors)); put("rowCases", JsonUtil.anyToElement(cases))
        put("draftModel", draftModelRef?.let { JsonUtil.json.encodeToJsonElement(ResourceModelDef.serializer(), metadata.resourceModels.getValue(it)) } ?: JsonNull)
    }
}

package com.viant.forgeandroid.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.DetailViewFieldSpec
import com.viant.forgeandroid.runtime.DetailViewSectionSpec
import com.viant.forgeandroid.runtime.DetailViewSpec
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.MetricSummaryItemSpec
import com.viant.forgeandroid.runtime.MetricSummarySpec
import com.viant.forgeandroid.runtime.MutationCommandDef
import com.viant.forgeandroid.runtime.MutationCommandPhase
import com.viant.forgeandroid.runtime.MutationCommandState
import com.viant.forgeandroid.runtime.EditableCollectionOperationSpec
import com.viant.forgeandroid.runtime.EditableCollectionSpec
import com.viant.forgeandroid.runtime.JsonUtil
import com.viant.forgeandroid.runtime.SelectorUtil
import com.viant.forgeandroid.runtime.WindowContext
import com.viant.forgeandroid.runtime.WorkflowPrimitiveRuntime
import com.viant.forgeandroid.runtime.evaluateDashboardCondition
import com.viant.forgeandroid.runtime.formatDashboardValue
import kotlin.math.absoluteValue
import kotlinx.coroutines.launch
import kotlinx.coroutines.async
import kotlinx.coroutines.yield
import com.viant.forgeandroid.runtime.MutationCommandResult

@Composable
internal fun WorkflowPresentationPrimitives(
    runtime: ForgeRuntime,
    window: WindowContext,
    container: ContainerDef,
    context: DataSourceContext?,
    windowForm: Map<String, Any?>,
    scoped: Boolean = false
) {
    if (!scoped) {
        com.viant.forgeandroid.runtime.PrimitivePairing.scopedContainers(container).forEach { part ->
            androidx.compose.runtime.key(part.id) {
                WorkflowPresentationPrimitives(runtime, window, part, part.dataSourceRef?.let(window::contextOrNull) ?: context ?: part.mutationCommand?.dataSourceRef?.let(window::contextOrNull), windowForm, scoped = true)
            }
        }
        return
    }
    val form by context?.form?.flow?.collectAsState(initial = context.form.peek())
        ?: androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(emptyMap()) }
    val collection by context?.collection?.flow?.collectAsState(initial = context.collection.peek())
        ?: androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(emptyList()) }
    val metrics by context?.metrics?.flow?.collectAsState(initial = context.metrics.peek())
        ?: androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(emptyMap()) }
    val selection by context?.selection?.flow?.collectAsState(initial = context.selection.peek())
        ?: androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(com.viant.forgeandroid.runtime.SelectionState()) }
    val metadata by window.metadata.flow.collectAsState(initial = window.metadata.peek())
    val authorization = metadata?.authorizationSnapshot?.mapValues { JsonUtil.elementToAny(it.value) }.orEmpty()
    androidx.compose.runtime.LaunchedEffect(context?.dataSourceRef) {
        if (container.mutationCommand == null && context != null && context.dataSource.autoFetch != false && !context.control.peek().resolved) context.fetchCollection()
    }
    val record = WorkflowPrimitiveRuntime.presentationRecord(form, collection, metrics)
    val detailRecord = when (container.detailView?.source?.lowercase()) {
        "selection" -> selection.selected ?: selection.selection.lastOrNull().orEmpty()
        "collection" -> collection.firstOrNull().orEmpty()
        "metrics" -> metrics
        else -> form.ifEmpty { collection.firstOrNull() ?: metrics }
    }
    val selectedRows = selection.selection.ifEmpty { selection.selected?.let(::listOf).orEmpty() }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (container.derivedDataSource != null) DerivedDataSourceRenderer(window, container)
        if (container.queryToolbar != null && context != null && container.queryToolbar.items.isNotEmpty()) {
            FormRenderer(runtime, context, container.queryToolbar.items)
        }
        container.resourceHeader?.let { spec ->
            Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.weight(1f)) {
                        spec.titleField?.let { field ->
                            Text(
                                formatDashboardValue(SelectorUtil.resolve(record, field), null),
                                style = MaterialTheme.typography.headlineSmall
                            )
                        }
                        spec.subtitleField?.let { field ->
                            Text(
                                formatDashboardValue(SelectorUtil.resolve(record, field), null),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    spec.actions.filter { evaluateDashboardCondition(it.visibleWhen, metrics = metrics, form = form, windowForm = windowForm, collection = collection, authorization = authorization) }
                        .forEach { action ->
                            if (action.mutation != null && context != null) {
                                MutationCommandButton(
                                    runtime, window, context, action.mutation,
                                    labelOverride = action.label,
                                    extras = mapOf("record" to record),
                                    externallyDisabled = action.disabledWhen != null && evaluateDashboardCondition(action.disabledWhen, metrics = metrics, form = form, windowForm = windowForm, collection = collection, authorization = authorization)
                                )
                            } else if (!action.handler.isNullOrBlank() && context != null) {
                                Button(
                                    enabled = action.disabledWhen == null || !evaluateDashboardCondition(action.disabledWhen, metrics = metrics, form = form, windowForm = windowForm, collection = collection, authorization = authorization),
                                    onClick = { runtime.execute(com.viant.forgeandroid.runtime.ExecutionDef(handler = action.handler), context, mapOf("record" to record, "action" to com.viant.forgeandroid.runtime.JsonUtil.elementToAny(com.viant.forgeandroid.runtime.JsonUtil.json.encodeToJsonElement(com.viant.forgeandroid.runtime.ResourceHeaderActionSpec.serializer(), action)))) }
                                ) { Text(action.label ?: action.id) }
                            }
                        }
                }
                if (spec.fields.isNotEmpty()) {
                    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        spec.fields.forEach { field ->
                            Column {
                                Text(field.label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(formatDashboardValue(SelectorUtil.resolve(record, field.field), field.format).ifBlank { "—" })
                            }
                        }
                    }
                }
            }
        }

        container.notificationRules?.rules
            ?.filter { evaluateDashboardCondition(it.visibleWhen, metrics = metrics, form = form, windowForm = windowForm, collection = collection, authorization = authorization) }
            ?.forEach { rule ->
                val color = notificationColor(rule.intent)
                Column(modifier = Modifier.fillMaxWidth().background(color.copy(alpha = 0.1f), RoundedCornerShape(10.dp)).padding(10.dp).semantics { contentDescription = rule.message }) {
                    Text(text = rule.message, color = color, style = MaterialTheme.typography.bodyMedium)
                    rule.action?.takeIf { it.visibleWhen == null || evaluateDashboardCondition(it.visibleWhen, metrics = metrics, form = form, windowForm = windowForm, collection = collection, authorization = authorization) }?.let { action ->
                        if (action.mutation != null && context != null) {
                            MutationCommandButton(runtime, window, context, action.mutation, labelOverride = action.label, externallyDisabled = action.disabledWhen != null && evaluateDashboardCondition(action.disabledWhen, metrics = metrics, form = form, windowForm = windowForm, collection = collection, authorization = authorization))
                        } else if (!action.handler.isNullOrBlank() && context != null) {
                            Button(
                                enabled = action.disabledWhen == null || !evaluateDashboardCondition(action.disabledWhen, metrics = metrics, form = form, windowForm = windowForm, collection = collection, authorization = authorization),
                                onClick = { runtime.execute(com.viant.forgeandroid.runtime.ExecutionDef(handler = action.handler), context) }
                            ) { Text(action.label ?: action.id) }
                        }
                    }
                }
            }

        container.editableCollection?.takeIf { it.operations.isNotEmpty() }?.let { spec ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                spec.operations.filter { operationVisible(it, metrics, form, windowForm, collection, authorization) }.forEach { operation ->
                    val disabled = operationDisabled(operation, spec, selectedRows, metrics, form, windowForm, collection, authorization)
                    val mutation = operation.mutation ?: spec.mutation
                    if (mutation != null && context != null) {
                        MutationCommandButton(
                            runtime, window, context, mutation,
                            labelOverride = operation.label,
                            extras = mapOf("operationId" to operation.id, "selectedRows" to selectedRows),
                            externallyDisabled = disabled,
                            accessibilityDescriptionOverride = listOfNotNull(operation.label, operation.tooltip).joinToString(". ")
                        )
                    } else {
                        Button(enabled = !disabled, modifier = Modifier.semantics { contentDescription = listOfNotNull(operation.label, operation.tooltip).joinToString(". ") }, onClick = {
                            if (context != null) invokeEditableOperation(runtime, context, operation, selectedRows)
                        }) { Text(operation.label) }
                    }
                }
            }
            if (spec.selectionStatus) {
                Text(
                    if (selectedRows.isEmpty()) spec.selectionPrompt ?: "Select a row to enable row actions."
                    else "${selectedRows.size} ${if (selectedRows.size == 1) "row" else "rows"} selected",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        container.statusWorkflow?.let { workflow ->
            val current = SelectorUtil.resolve(record, workflow.stateField)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                workflow.transitions.filter { transition ->
                    (transition.from.isEmpty() || transition.from.any { JsonUtil.elementToAny(it) == current }) &&
                        evaluateDashboardCondition(transition.availableWhen, metrics = metrics, form = form, windowForm = windowForm, collection = collection, authorization = authorization)
                }.forEach { transition ->
                    if (context != null) {
                        MutationCommandButton(
                            runtime, window, context, transition.command,
                            labelOverride = transition.label,
                            confirmationOverride = transition.confirm,
                            extras = mapOf("transitionId" to transition.id, "from" to current, "to" to JsonUtil.elementToAny(transition.to))
                        )
                    }
                }
            }
        }

        if (container.draftForm != null && context != null) {
            val spec = container.draftForm
            val baseline = selection.selected.orEmpty()
            val valid = spec.validWhen == null || evaluateDashboardCondition(spec.validWhen, metrics = metrics, form = form, windowForm = windowForm, collection = collection, authorization = authorization)
            val dirty = spec.dirtyWhen?.let { evaluateDashboardCondition(it, metrics = metrics, form = form, windowForm = windowForm, collection = collection, authorization = authorization) }
                ?: (form != baseline)
            DraftFormActions(runtime, window, context, spec, form, baseline, valid, dirty)
        }

        container.metricSummary?.takeIf { it.metrics.isNotEmpty() }?.let { spec ->
            MetricSummary(spec, record)
        }

        container.relationDrill?.let { spec ->
            val rawCount = SelectorUtil.resolve(record, spec.countField ?: "count")
            val count = (rawCount as? Number)?.toInt() ?: rawCount?.toString()?.toIntOrNull() ?: 0
            Button(
                enabled = count > 0 && spec.link != null,
                onClick = {
                    val link = spec.link ?: return@Button
                    val key = link.windowKey?.trim().orEmpty()
                    if (key.isEmpty()) return@Button
                    val linkContext = LinkResolutionContext(record, rawCount, form, metrics, windowForm)
                    openResolvedWindowLink(
                        runtime,
                        window,
                        WindowLinkTarget(
                            windowKey = key,
                            title = resolveLinkWindowTitleFromContext(link, linkContext, link.title ?: key),
                            parameters = resolveLinkParametersFromContext(link, linkContext),
                            inTab = link.inTab != false,
                            modal = link.modal == true,
                            newInstance = link.newInstance == true
                        )
                    )
                }
            ) {
                Text(WorkflowPrimitiveRuntime.relationLabel(count, spec))
            }
        }

        container.detailView?.let { spec ->
            DetailView(spec, detailRecord, metrics, form, windowForm, collection, authorization)
        }

        container.historyDiff?.let { spec ->
            val entries = WorkflowPrimitiveRuntime.historyDiffEntries(
                SelectorUtil.resolve(record, spec.beforeField ?: "before"),
                SelectorUtil.resolve(record, spec.afterField ?: "after"),
                spec
            )
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                entries.forEach { entry ->
                    Column(
                        modifier = Modifier.fillMaxWidth()
                            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f), RoundedCornerShape(8.dp))
                            .padding(8.dp)
                    ) {
                        Text(entry.label, style = MaterialTheme.typography.labelMedium)
                        Text("${entry.before} → ${entry.after}", style = MaterialTheme.typography.bodyMedium)
                    }
                }
                if (entries.isEmpty()) Text("No changes", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        if (container.mutationCommand != null && context != null) {
            MutationCommandButton(runtime, window, context, container.mutationCommand)
        }
    }
}

@Composable
private fun DraftFormActions(
    runtime: ForgeRuntime,
    window: WindowContext,
    context: DataSourceContext,
    spec: com.viant.forgeandroid.runtime.DraftFormSpec,
    form: Map<String, Any?>,
    baseline: Map<String, Any?>,
    valid: Boolean,
    dirty: Boolean
) {
    var draftState by remember(context.dataSourceRef, baseline) { mutableStateOf(com.viant.forgeandroid.runtime.NativeDraftState(form.toMap())) }
    val control by context.control.flow.collectAsState(initial = context.control.peek())
    var wasLoading by remember(context.dataSourceRef) { mutableStateOf(control.loading) }
    androidx.compose.runtime.LaunchedEffect(control.loading, control.error) {
        if (wasLoading && !control.loading && control.error.isNullOrBlank()) draftState = draftState.accepted(context.form.peek())
        wasLoading = control.loading
    }
    val isDirty = if (spec.dirtyWhen == null) draftState.dirty(form) else dirty
    var confirmationVisible by remember { mutableStateOf(false) }
    fun reset() {
        context.setForm(draftState.baseline)
        spec.onReset?.takeIf(String::isNotBlank)?.let { handler ->
            runtime.execute(com.viant.forgeandroid.runtime.ExecutionDef(handler = handler), context, draftState.resetExtras())
        }
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(enabled = isDirty && !control.loading, onClick = {
            if (!spec.confirmDiscard.isNullOrBlank()) confirmationVisible = true else reset()
        }) { Text(spec.resetLabel ?: "Reset") }
        spec.submit?.let { submit ->
            MutationCommandButton(
                runtime, window, context, submit,
                labelOverride = spec.saveLabel ?: submit.label,
                extras = draftState.submitExtras(form),
                externallyDisabled = !valid || !isDirty || control.loading,
                onSettled = { result -> if (result.status == "succeeded") draftState = draftState.accepted(form) }
            )
        }
        if (isDirty) Text("Unsaved changes", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    if (confirmationVisible) {
        AlertDialog(
            onDismissRequest = { confirmationVisible = false },
            text = { Text(spec.confirmDiscard ?: "Discard changes?") },
            confirmButton = {
                TextButton(onClick = { confirmationVisible = false; reset() }) { Text("Discard") }
            },
            dismissButton = {
                TextButton(onClick = { confirmationVisible = false }) { Text("Cancel") }
            }
        )
    }
}

@Composable
internal fun MutationCommandButton(
    runtime: ForgeRuntime,
    window: WindowContext,
    source: DataSourceContext,
    command: MutationCommandDef,
    labelOverride: String? = null,
    confirmationOverride: String? = null,
    extras: Map<String, Any?> = emptyMap(),
    externallyDisabled: Boolean = false,
    onSettled: ((MutationCommandResult) -> Unit)? = null,
    accessibilityDescriptionOverride: String? = null
) {
    val scope = rememberCoroutineScope()
    var state by remember(command.commandId, command.dataSourceRef) { mutableStateOf(MutationCommandState()) }
    var confirmationVisible by remember { mutableStateOf(false) }

    fun execute(confirmed: Boolean) {
        scope.launch {
            val execution = async { runtime.mutationCommands.execute(
                runtime = runtime,
                window = window,
                source = source,
                command = command,
                extras = extras,
                confirm = if (confirmed) ({ true }) else null
            ) }
            yield()
            state = runtime.mutationCommands.state(window.windowId, command)
            val result = execution.await()
            state = runtime.mutationCommands.state(window.windowId, command)
            onSettled?.invoke(result)
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Button(
            enabled = !state.guarded && !externallyDisabled,
            onClick = {
                if (!(confirmationOverride ?: runtime.mutationCommands.resolveConfirmation(command, extras)).isBlank()) confirmationVisible = true else execute(false)
            },
            modifier = Modifier.semantics {
                contentDescription = accessibilityDescriptionOverride ?: command.label ?: "Save"
            }
        ) {
            Text(if (state.pending) "Saving…" else labelOverride ?: command.label ?: "Save")
        }
        if (state.message.isNotBlank()) {
            Text(
                state.message,
                style = MaterialTheme.typography.bodySmall,
                color = if (state.phase == MutationCommandPhase.Failed) Color(0xFFB42318) else MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
    if (confirmationVisible) {
        AlertDialog(
            onDismissRequest = { confirmationVisible = false },
            title = { Text(labelOverride ?: command.label ?: "Confirm") },
            text = { Text(confirmationOverride ?: runtime.mutationCommands.resolveConfirmation(command, extras).ifBlank { "Continue?" }) },
            confirmButton = {
                TextButton(onClick = {
                    confirmationVisible = false
                    execute(true)
                }) { Text(labelOverride ?: command.label ?: "Confirm") }
            },
            dismissButton = {
                TextButton(onClick = { confirmationVisible = false }) { Text("Cancel") }
            }
        )
    }
}

private fun operationVisible(
    operation: EditableCollectionOperationSpec,
    metrics: Map<String, Any?>,
    form: Map<String, Any?>,
    windowForm: Map<String, Any?>,
    collection: List<Map<String, Any?>>,
    authorization: Map<String, Any?>
): Boolean = operation.visibleWhen == null || evaluateDashboardCondition(
    operation.visibleWhen, metrics = metrics, form = form, windowForm = windowForm, collection = collection, authorization = authorization
)

private fun operationDisabled(
    operation: EditableCollectionOperationSpec,
    spec: EditableCollectionSpec,
    selectedRows: List<Map<String, Any?>>,
    metrics: Map<String, Any?>,
    form: Map<String, Any?>,
    windowForm: Map<String, Any?>,
    collection: List<Map<String, Any?>>,
    authorization: Map<String, Any?>
): Boolean {
    val selection = operation.selection ?: spec.selection
    val minimum = selection?.min ?: if (operation.requiresSelection) 1 else 0
    val maximum = selection?.max ?: 0
    if (selectedRows.size < minimum || (maximum > 0 && selectedRows.size > maximum)) return true
    if (operation.disabledWhen != null && evaluateDashboardCondition(operation.disabledWhen, metrics = metrics, form = form, windowForm = windowForm, collection = collection, authorization = authorization)) return true
    if (selection?.disabledWhen != null && evaluateDashboardCondition(selection.disabledWhen, metrics = metrics, form = form, windowForm = windowForm, collection = collection, authorization = authorization)) return true
    selection?.every?.let { predicate ->
        if (selectedRows.isEmpty() || selectedRows.any { !evaluateDashboardCondition(predicate, metrics = metrics, form = it, windowForm = windowForm, collection = collection, authorization = authorization) }) return true
    }
    selection?.any?.let { predicate ->
        if (selectedRows.isEmpty() || selectedRows.none { evaluateDashboardCondition(predicate, metrics = metrics, form = it, windowForm = windowForm, collection = collection, authorization = authorization) }) return true
    }
    selection?.none?.let { predicate ->
        if (selectedRows.any { evaluateDashboardCondition(predicate, metrics = metrics, form = it, windowForm = windowForm, collection = collection, authorization = authorization) }) return true
    }
    return false
}

private fun invokeEditableOperation(
    runtime: ForgeRuntime,
    context: DataSourceContext,
    operation: EditableCollectionOperationSpec,
    selectedRows: List<Map<String, Any?>>
) {
    val args = mapOf("operationId" to operation.id, "selectedRows" to selectedRows)
    when {
        !operation.handler.isNullOrBlank() -> runtime.execute(com.viant.forgeandroid.runtime.ExecutionDef(handler = operation.handler), context, args)
        !operation.dialogId.isNullOrBlank() -> runtime.execute(com.viant.forgeandroid.runtime.ExecutionDef(handler = "window.openDialog", args = listOf(operation.dialogId.orEmpty())), context, args)
    }
}

@Composable
private fun MetricSummary(spec: MetricSummarySpec, record: Map<String, Any?>) {
    val columns = spec.columns?.coerceIn(1, 4) ?: 2
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        spec.metrics.chunked(columns).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                row.forEach { item -> MetricCard(item, record, Modifier.weight(1f)) }
                repeat(columns - row.size) { Column(modifier = Modifier.weight(1f)) {} }
            }
        }
    }
}

@Composable
private fun MetricCard(item: MetricSummaryItemSpec, record: Map<String, Any?>, modifier: Modifier) {
    val value = SelectorUtil.resolve(record, item.field)
    val comparison = item.comparisonField?.let { SelectorUtil.resolve(record, it) }
    Column(
        verticalArrangement = Arrangement.spacedBy(4.dp),
        modifier = modifier
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f), RoundedCornerShape(12.dp))
            .padding(12.dp)
            .semantics { contentDescription = item.label }
    ) {
        Text(item.label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            value?.let { formatDashboardValue(it, item.format) }?.takeIf(String::isNotBlank) ?: item.emptyText ?: "—",
            style = MaterialTheme.typography.titleMedium
        )
        val comparisonNumber = (comparison as? Number)?.toDouble() ?: comparison?.toString()?.toDoubleOrNull()
        if (comparisonNumber != null) {
            val prefix = if (comparisonNumber >= 0) "↗ " else "↘ "
            Text(
                prefix + formatDashboardValue(comparisonNumber.absoluteValue, item.comparisonFormat),
                style = MaterialTheme.typography.labelSmall,
                color = comparisonColor(comparisonNumber, item.betterWhen)
            )
        }
    }
}

@Composable
private fun DetailView(
    spec: DetailViewSpec,
    record: Map<String, Any?>,
    metrics: Map<String, Any?>,
    form: Map<String, Any?>,
    windowForm: Map<String, Any?>,
    collection: List<Map<String, Any?>>,
    authorization: Map<String, Any?>
) {
    val sections = spec.sections.ifEmpty { listOf(DetailViewSectionSpec(id = "details", fields = spec.fields)) }
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        sections.filter { evaluateDashboardCondition(it.visibleWhen, metrics = metrics, form = form, windowForm = windowForm, collection = collection, authorization = authorization) }
            .forEach { section ->
                section.label?.takeIf(String::isNotBlank)?.let {
                    Text(it, style = MaterialTheme.typography.titleMedium)
                }
                section.description?.takeIf(String::isNotBlank)?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                DetailFields(spec, section.fields, record, metrics, form, windowForm, collection, authorization)
            }
    }
}

@Composable
private fun DetailFields(
    spec: DetailViewSpec,
    fields: List<DetailViewFieldSpec>,
    record: Map<String, Any?>,
    metrics: Map<String, Any?>,
    form: Map<String, Any?>,
    windowForm: Map<String, Any?>,
    collection: List<Map<String, Any?>>,
    authorization: Map<String, Any?>
) {
    val visible = fields.filter { evaluateDashboardCondition(it.visibleWhen, metrics = metrics, form = form, windowForm = windowForm, collection = collection, authorization = authorization) }
    val columns = (spec.responsiveColumns["phone"] ?: spec.columns ?: 2).coerceIn(1, 2)
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        visible.chunked(columns).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                row.forEach { field ->
                    val value = SelectorUtil.resolve(record, field.field)
                    Column(modifier = Modifier.weight(1f).semantics { contentDescription = field.label }) {
                        Text(field.label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(value?.let { formatDashboardValue(it, field.format) }?.takeIf(String::isNotBlank) ?: field.emptyText ?: spec.emptyText ?: "—")
                    }
                }
                repeat(columns - row.size) { Column(modifier = Modifier.weight(1f)) {} }
            }
        }
    }
}

private fun notificationColor(intent: String?): Color = when (intent?.lowercase()) {
    "danger", "error" -> Color(0xFFB42318)
    "warning" -> Color(0xFFB54708)
    "success" -> Color(0xFF067647)
    else -> Color(0xFF175CD3)
}

private fun comparisonColor(value: Double, betterWhen: String?): Color = when (betterWhen?.lowercase()) {
    "lower" -> if (value <= 0) Color(0xFF067647) else Color(0xFFB42318)
    "neutral" -> Color.Gray
    else -> if (value >= 0) Color(0xFF067647) else Color(0xFFB42318)
}

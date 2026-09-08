package com.viant.forgeandroid.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.ControlState
import com.viant.forgeandroid.runtime.DerivedDataSourceRuntime
import com.viant.forgeandroid.runtime.WindowContext

@Composable
internal fun DerivedDataSourceRenderer(window: WindowContext, container: ContainerDef) {
    val spec = container.derivedDataSource ?: return
    val targetRef = container.dataSourceRef?.trim().orEmpty()
    val target = window.contextOrNull(targetRef) ?: return
    val sourceContexts = spec.sources.mapNotNull(window::contextOrNull)
    val sourceRows = linkedMapOf<String, List<Map<String, Any?>>>()
    val sourceControls = linkedMapOf<String, ControlState>()
    for (context in sourceContexts) {
        val rows by context.collection.flow.collectAsState(initial = context.collection.peek())
        val control by context.control.flow.collectAsState(initial = context.control.peek())
        sourceRows[context.dataSourceRef] = rows
        sourceControls[context.dataSourceRef] = control
    }

    LaunchedEffect(spec.sources, targetRef) {
        sourceContexts.forEach { context ->
            if (context.collection.peek().isEmpty() && context.dataSource.autoFetch != false) context.fetchCollection()
        }
    }
    val signature = spec.sources.joinToString("|") { ref -> "$ref:${sourceRows[ref]}:${sourceControls[ref]}" }
    LaunchedEffect(signature, targetRef) {
        val optional = spec.optionalSources.toSet()
        val requiredError = spec.sources.firstNotNullOfOrNull { ref ->
            sourceControls[ref]?.error?.takeIf { ref !in optional && it.isNotBlank() }
        }
        if (requiredError != null) {
            target.control.set(ControlState(error = requiredError, resolved = true))
            return@LaunchedEffect
        }
        if (spec.sources.any { sourceControls[it]?.loading == true }) {
            target.control.set(ControlState(loading = true))
            return@LaunchedEffect
        }
        val warnings = spec.sources.mapNotNull { ref ->
            sourceControls[ref]?.error?.takeIf { ref in optional && it.isNotBlank() }?.let { "$ref: $it" }
        }
        val effective = sourceRows.toMutableMap()
        optional.filter { sourceControls[it]?.error?.isNotBlank() == true }.forEach { effective[it] = emptyList() }
        runCatching { DerivedDataSourceRuntime.run(effective, spec) }
            .onSuccess { rows ->
                if (target.collection.peek() != rows) target.collection.set(rows)
                target.control.set(ControlState(resolved = true, warnings = warnings))
            }
            .onFailure { error ->
                target.control.set(ControlState(error = error.message ?: "Derived datasource failed", resolved = true, warnings = warnings))
            }
    }
}

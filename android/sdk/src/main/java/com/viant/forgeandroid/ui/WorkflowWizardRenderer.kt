package com.viant.forgeandroid.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.viant.forgeandroid.runtime.ContainerDef
import com.viant.forgeandroid.runtime.DataSourceContext
import com.viant.forgeandroid.runtime.ForgeRuntime
import com.viant.forgeandroid.runtime.JsonUtil
import com.viant.forgeandroid.runtime.WindowContext
import com.viant.forgeandroid.runtime.evaluateDashboardCondition

@Composable
internal fun WorkflowWizardRenderer(
    runtime: ForgeRuntime,
    window: WindowContext,
    container: ContainerDef,
    context: DataSourceContext?,
    windowForm: Map<String, Any?>
) {
    val wizard = container.wizard ?: return
    val metadata by window.metadata.flow.collectAsState(initial = window.metadata.peek())
    val authorization = metadata?.authorizationSnapshot?.mapValues { JsonUtil.elementToAny(it.value) }.orEmpty()
    val form by context?.form?.flow?.collectAsState(initial = context.form.peek())
        ?: remember { mutableStateOf(emptyMap()) }
    val collection by context?.collection?.flow?.collectAsState(initial = context.collection.peek())
        ?: remember { mutableStateOf(emptyList()) }
    val metrics by context?.metrics?.flow?.collectAsState(initial = context.metrics.peek())
        ?: remember { mutableStateOf(emptyMap()) }
    val visibleSteps = wizard.steps.filter {
        evaluateDashboardCondition(it.visibleWhen, metrics = metrics, form = form, windowForm = windowForm, collection = collection, authorization = authorization)
    }
    val persisted = wizard.stateKey?.let { windowForm[it]?.toString() }
    var currentStepId by remember(wizard.stateKey, persisted, visibleSteps.map { it.id }) {
        mutableStateOf(persisted?.takeIf { id -> visibleSteps.any { it.id == id } } ?: visibleSteps.firstOrNull()?.id.orEmpty())
    }
    val currentIndex = visibleSteps.indexOfFirst { it.id == currentStepId }.coerceAtLeast(0)
    val current = visibleSteps.getOrNull(currentIndex)

    fun select(index: Int) {
        val step = visibleSteps.getOrNull(index) ?: return
        currentStepId = step.id
        wizard.stateKey?.let { runtime.setWindowFormValues(window.windowId, mapOf(it to step.id), bumpPrefillRevision = false) }
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.semantics { contentDescription = "Wizard" }) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
        ) {
            visibleSteps.forEachIndexed { index, step ->
                Surface(
                    color = if (index == currentIndex) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
                    shape = RoundedCornerShape(999.dp)
                ) {
                    Text(step.label, modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp))
                }
            }
        }
        current?.containerId?.let { childId ->
            container.containers.firstOrNull { it.id == childId }?.let { child ->
                ContainerRenderer(runtime, window, child, inheritedDataSourceRef = container.dataSourceRef)
            }
        }
        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
            Button(enabled = currentIndex > 0, onClick = { select(currentIndex - 1) }) { Text("Back") }
            if (currentIndex < visibleSteps.lastIndex) {
                Button(
                    enabled = current?.let { evaluateDashboardCondition(it.validWhen, metrics = metrics, form = form, windowForm = windowForm, collection = collection, authorization = authorization) } == true,
                    onClick = { select(currentIndex + 1) }
                ) { Text("Next") }
            } else if (wizard.submit != null && context != null) {
                MutationCommandButton(
                    runtime,
                    window,
                    context,
                    wizard.submit,
                    labelOverride = wizard.submit.label ?: "Submit"
                )
            }
        }
    }
}

package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*
import java.security.MessageDigest

/** Exclude results and command acknowledgments from request input generations. */
fun reportPreparationFormRevision(form: Map<String, Any?>, metadata: WindowMetadata?): String = reportPreparationFingerprint(
    JsonObject(mapOf("form" to JsonUtil.anyToElement(form.filterKeys { it !in setOf("reportMaterialization", "reportStaticDatasets", "reportRunRequest") }),
        "metadataRevision" to JsonPrimitive(metadata?.hashCode() ?: 0)))
)
fun reportPreparationFingerprint(value: JsonElement): String {
    fun ordered(input: JsonElement): JsonElement = when(input) {
        is JsonObject -> JsonObject(input.toSortedMap().mapValues { ordered(it.value) })
        is JsonArray -> JsonArray(input.map(::ordered))
        else -> input
    }
    return MessageDigest.getInstance("SHA-256").digest(ordered(value).toString().toByteArray()).joinToString("") { "%02x".format(it) }
}

/** Active view dependencies, excluding registry-only/dialog definitions. No IO occurs here. */
fun activeWindowDataSourceRefs(metadata: WindowMetadata, windowForm: Map<String, Any?>): List<String> {
    val refs = linkedSetOf<String>()
    fun visit(container: ContainerDef) {
        if (container.visibleWhen != null && !evaluateDashboardCondition(container.visibleWhen, windowForm = windowForm)) return
        val variants = container.reportBuilders.ifEmpty { container.dashboard?.reportBuilders.orEmpty() }
        val isReport = container.kind == "dashboard.reportBuilder" || container.dashboard?.reportBuilder != null || variants.isNotEmpty()
        if (isReport) {
            val defaultRef = container.reportBuilderRef ?: container.dashboard?.reportBuilderRef
            val selected = windowForm["reportBuilderRef"]?.toString()?.takeIf(String::isNotBlank) ?: defaultRef
            val variant = selected?.let(variants::get)
            if (selected != null && variants.isNotEmpty() && variant == null) return
            (variant?.dataSourceRef ?: container.dataSourceRef)?.takeIf(String::isNotBlank)?.let(refs::add)
        } else container.dataSourceRef?.takeIf(String::isNotBlank)?.let(refs::add)
        container.containers.forEach(::visit)
    }
    metadata.view?.content?.containers.orEmpty().forEach(::visit)
    return refs.toList()
}
fun reportOwnedDataSourceRefs(metadata: WindowMetadata): Set<String> {
    val refs = linkedSetOf<String>()
    fun add(config: DashboardReportBuilderDef?, ref: String?) { ref?.takeIf(String::isNotBlank)?.let(refs::add); config?.dataSources.orEmpty().forEach { refs.add(it.dataSourceRef) } }
    fun visit(container: ContainerDef) {
        if (container.kind == "dashboard.reportBuilder" || container.dashboard?.reportBuilder != null) add(container.dashboard?.reportBuilder, container.dataSourceRef)
        (container.reportBuilders + container.dashboard?.reportBuilders.orEmpty()).values.forEach { add(it.reportBuilder, it.dataSourceRef) }
        container.containers.forEach(::visit)
    }
    metadata.view?.content?.containers.orEmpty().forEach(::visit)
    return refs
}

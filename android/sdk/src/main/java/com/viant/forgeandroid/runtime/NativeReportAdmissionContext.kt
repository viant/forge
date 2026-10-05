package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatterBuilder

const val NATIVE_REPORT_ADMISSION_KEY = "_agentlyReportAdmission"
private val admissionTimestamp = DateTimeFormatterBuilder().appendInstant(3).toFormatter()

fun nativeReportPrefillIdentity(form:JsonObject):JsonObject=buildJsonObject {
    put("prefill",form["prefill"]?:JsonNull)
    put("prefillRevision",(form["__forge"] as? JsonObject)?.get("prefillRevision")?:JsonPrimitive(0))
}

/** Resolve only the selected authored configuration; ambiguous metadata stays unverified. */
fun nativeReportMetadataConfiguration(metadata:JsonElement,builderRef:String):Pair<JsonObject,String>? {
    val candidates=mutableListOf<Pair<JsonObject,String>>()
    fun visit(value:JsonElement,inheritedRef:String="") {
        when(value) {
            is JsonArray -> value.forEach { visit(it,inheritedRef) }
            is JsonObject -> {
                val ref=(value["dataSourceRef"] as? JsonPrimitive)?.content ?: inheritedRef
                val selected=(value["reportBuilders"] as? JsonObject)?.get(builderRef) as? JsonObject
                val config=selected?.get("reportBuilder") as? JsonObject
                if(config!=null) candidates += config to ((selected["dataSourceRef"] as? JsonPrimitive)?.content ?: ref)
                if(value["id"]==JsonPrimitive(builderRef) || value["reportBuilderRef"]==JsonPrimitive(builderRef)) {
                    val direct=(value["dashboard"] as? JsonObject)?.get("reportBuilder") as? JsonObject
                    if(direct!=null) candidates += direct to ref
                }
                value.filterKeys { it!="reportBuilders" }.values.forEach { visit(it,ref) }
            }
            else -> Unit
        }
    }
    visit(metadata)
    return candidates.distinct().singleOrNull()?.takeIf { it.second.isNotBlank() }
}

/** Only the explicitly selected raw state may replace the definition's blocks. */
fun nativeReportSelectedDocument(form: JsonObject, stateKey: String?): JsonObject? {
    val definition = form["reportDefinition"] as? JsonObject
    val header = (definition?.get("documentPatch") ?: definition?.get("reportDocument") ?: form["documentPatch"] ?: form["reportDocument"]) as? JsonObject
    val blocks = stateKey?.let { (form[it] as? JsonObject)?.get("reportDocumentBlocks") as? JsonArray }?.takeIf { it.isNotEmpty() }
    val selected = blocks?.let { JsonObject(header.orEmpty() + ("blocks" to it)) } ?: header
    return selected?.takeIf { (it["blocks"] as? JsonArray)?.isNotEmpty() == true }
}

/** V1 preserves the entire author-state JSON. Runtime acknowledgments/results are outside it. */
fun nativeReportAdmissionContext(admission: NativeReportAdmission): JsonObject {
    validateNativeReportAdmission(admission)
    val packet = admission.preparation
    require(packet.capturedCalendar == "gregorian") { "unsupported-calendar" }
    require(packet.capturedZoneId in ZoneId.getAvailableZoneIds()) { "unsupported-time-zone" }
    require(admission.authoredConfiguration.isNotEmpty()) { "missing-authored-configuration" }
    return buildJsonObject {
        put("version", 1); put("preparedAt", admissionTimestamp.format(Instant.ofEpochMilli(packet.capturedTimeMillis)))
        put("timeZone", packet.capturedZoneId); put("calendar", packet.capturedCalendar)
        put("builderRef", packet.identity.builderRef); put("stateKey", admission.stateKey); put("primaryDataSourceRef", packet.dataSourceRef)
        put("state", packet.state)
        put("digests", buildJsonObject {
            put("profile", NATIVE_REPORT_DIGEST_PROFILE); put("authorState", nativeReportAdmissionDigest(admission.authorState)); put("policyState", nativeReportAdmissionDigest(packet.state))
            put("prefill",nativeReportAdmissionDigest(admission.prefillIdentity))
            put("document", nativeReportAdmissionDigest(admission.document)); put("configuration", nativeReportAdmissionDigest(admission.authoredConfiguration))
        })
        put("datasets", JsonArray(admission.datasets.map { dataset -> buildJsonObject {
            put("id", dataset.id); put("dataSourceRef", dataset.dataSourceRef); put("request", dataset.request)
        } }))
    }
}

fun nativeReportRequestedParams(admission: NativeReportAdmission): JsonObject {
    require(NATIVE_REPORT_ADMISSION_KEY !in admission.preparation.primaryRequest) { "reserved-admission-query-key" }
    return JsonObject(admission.preparation.primaryRequest + (NATIVE_REPORT_ADMISSION_KEY to nativeReportAdmissionContext(admission)))
}

/** Pure cold verification: no query hook, dispatcher, clock read, or network activity. */
fun restoredNativeReportAdmission(
    namespace: JsonObject, primaryRequest: JsonObject, state: JsonObject, document: JsonObject, configuration: JsonObject,
    conversationId: String, windowId: String, builderRef: String, stateKey: String, primaryDataSourceRef: String,
    publishedSources: List<ReportBuilderPublishedDataSourceDef>,prefillIdentity:JsonObject=nativeReportPrefillIdentity(JsonObject(emptyMap()))
): NativeReportAdmission {
    require(namespace["version"] == JsonPrimitive(1)) { "unsupported-admission-version" }
    require(namespace["calendar"] == JsonPrimitive("gregorian")) { "unsupported-calendar" }
    require(namespace["builderRef"] == JsonPrimitive(builderRef) && namespace["stateKey"] == JsonPrimitive(stateKey) && namespace["primaryDataSourceRef"] == JsonPrimitive(primaryDataSourceRef)) { "admission-source-mismatch" }
    val recordedState = namespace["state"] as? JsonObject ?: error("missing-admission-state")
    val digests = namespace["digests"] as? JsonObject ?: error("missing-admission-digests")
    require(digests["profile"] == JsonPrimitive(NATIVE_REPORT_DIGEST_PROFILE)) { "unsupported-digest-profile" }
    require(digests["policyState"] == JsonPrimitive(nativeReportAdmissionDigest(recordedState))) { "admission-policy-state-mismatch" }
    require(digests["authorState"] == JsonPrimitive(nativeReportAdmissionDigest(state))) { "admission-author-state-mismatch" }
    require(digests["prefill"]==JsonPrimitive(nativeReportAdmissionDigest(prefillIdentity))) { "admission-prefill-mismatch" }
    require(digests["document"] == JsonPrimitive(nativeReportAdmissionDigest(document))) { "admission-document-mismatch" }
    require(digests["configuration"] == JsonPrimitive(nativeReportAdmissionDigest(configuration))) { "admission-configuration-mismatch" }
    val timestamp = (namespace["preparedAt"] as? JsonPrimitive)?.content ?: error("missing-admission-clock")
    val instant = Instant.parse(timestamp)
    require(admissionTimestamp.format(instant) == timestamp) { "unsupported-admission-clock" }
    val zone = (namespace["timeZone"] as? JsonPrimitive)?.content ?: error("missing-admission-zone")
    require(zone in ZoneId.getAvailableZoneIds()) { "unsupported-time-zone" }
    val rawDatasets = namespace["datasets"] as? JsonArray ?: error("missing-admission-datasets")
    val datasets = rawDatasets.map { raw ->
        val dataset = raw as? JsonObject ?: error("invalid-admission-dataset")
        require(dataset.keys == setOf("id", "dataSourceRef", "request")) { "invalid-admission-dataset-fields" }
        NativeReportDatasetAdmission(dataset.getValue("id").jsonPrimitive.content, dataset.getValue("dataSourceRef").jsonPrimitive.content, dataset["request"] as? JsonObject ?: error("invalid-admission-request"))
    }
    val identity = ReportPreparationIdentity(windowId, builderRef, "restored-admission", "restored-admission")
    val packet = PreparedReportRequest(identity, "ready", primaryDataSourceRef, primaryRequest, recordedState,
        publishedSources = publishedSources, capturedTimeMillis = instant.toEpochMilli(), capturedZoneId = zone, capturedCalendar = "gregorian",capturedAuthorState=state,capturedPrefillIdentity=prefillIdentity)
    return NativeReportAdmission(packet, conversationId, stateKey, document, datasets, configuration, state).also(::validateNativeReportAdmission)
}

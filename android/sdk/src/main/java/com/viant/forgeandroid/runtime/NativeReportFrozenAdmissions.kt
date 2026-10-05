package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*
import java.util.concurrent.ConcurrentHashMap

data class NativeReportAccountBinding(val accountKey:String,val generation:Long)
data class NativeReportFrozenAdmission(val admission:NativeReportAdmission,val reportRunId:String,val ownerId:String,val account:NativeReportAccountBinding,val digest:String,val prefill:JsonElement,val prefillRevision:JsonElement,val savedDatasets:JsonArray)

/** Runtime-only trust installed by the authenticated host, never by an authored window form. */
class NativeReportFrozenAdmissions(private val rejected:((String,String)->Unit)?=null) {
    private var account:NativeReportAccountBinding?=null
    private var generation=0L
    private val entries=ConcurrentHashMap<String,NativeReportFrozenAdmission>()
    @Synchronized fun bindAccount(key:String?) {
        if(account?.accountKey==key && key!=null) return
        generation++;account=key?.takeIf(String::isNotBlank)?.let { NativeReportAccountBinding(it,generation) };entries.clear()
    }
    @Synchronized fun accountBinding()=account
    fun closeWindow(windowId:String) { entries.remove(windowId) }
    fun containsWindow(windowId:String)=entries.containsKey(windowId)
    fun stateKey(windowId:String)=entries[windowId]?.admission?.stateKey
    fun install(windowId:String,conversationId:String,form:JsonObject,admission:NativeReportAdmission,reportRunId:String,ownerId:String,expectedAccount:NativeReportAccountBinding):Boolean {
        if(accountBinding()!=expectedAccount || reportRunId.isBlank() || ownerId.isBlank() || admission.conversationId!=conversationId) return false
        return runCatching {
            val bound=admission.copy(preparation=admission.preparation.copy(identity=admission.preparation.identity.copy(windowId=windowId)))
            validateNativeReportAdmission(bound)
            require(nativeReportPrefillIdentity(form)==bound.prefillIdentity)
            val context=nativeReportAdmissionContext(bound)
            val saved=nativeReportImmutableJson(form["reportStaticDatasets"] as? JsonArray ?: error("missing-saved-datasets")) as JsonArray
            val savedEntries=saved.map { it.jsonObject }
            require(savedEntries.map { it.getValue("id").jsonPrimitive.content }.toSet()==bound.datasets.map { it.id }.toSet() && savedEntries.size==bound.datasets.size)
            bound.datasets.forEach { dataset ->
                val entry=savedEntries.single { it["id"]==JsonPrimitive(dataset.id) }
                require(entry["dataSourceRef"]==JsonPrimitive(dataset.dataSourceRef) && entry["request"]==dataset.request && entry["rows"] is JsonArray)
            }
            val value=NativeReportFrozenAdmission(bound,reportRunId,ownerId,expectedAccount,nativeReportAdmissionDigest(context),form["prefill"]?:JsonNull,
                (form["__forge"] as? JsonObject)?.get("prefillRevision")?:JsonPrimitive(0),saved)
            entries[windowId]=value
            if(current(windowId,conversationId,form,bound.authoredConfiguration,bound.document)==null) { entries.remove(windowId,value); false } else true
        }.getOrDefault(false)
    }
    fun current(windowId:String,conversationId:String,form:JsonObject,configuration:JsonObject,document:JsonObject):NativeReportFrozenAdmission? {
        val entry=entries[windowId]?:return null
        val admission=entry.admission
        val valid=runCatching {
            require(accountBinding()==entry.account && conversationId==admission.conversationId) { "frozen-account-conversation-mismatch" }
            require(form["reportBuilderRef"]==JsonPrimitive(admission.preparation.identity.builderRef)) { "frozen-builder-mismatch" }
            require(form["executeOnOpen"]==JsonPrimitive(false)) { "frozen-execution-mode-mismatch" }
            val materialization=form["reportMaterialization"] as? JsonObject ?: error("missing-saved-materialization")
            require(materialization["status"]==JsonPrimitive("completed") && materialization["reportRunId"]==JsonPrimitive(entry.reportRunId)) { "frozen-materialization-mismatch" }
            require(form["reportStaticDatasets"]==entry.savedDatasets) { "frozen-saved-datasets-mismatch" }
            require((form["prefill"]?:JsonNull)==entry.prefill && ((form["__forge"] as? JsonObject)?.get("prefillRevision")?:JsonPrimitive(0))==entry.prefillRevision) { "frozen-prefill-mismatch" }
            val raw=form[admission.stateKey] as? JsonObject ?: error("missing-author-state")
            require(nativeReportAdmissionDigest(raw)==nativeReportAdmissionDigest(admission.authorState)) { "frozen-author-state-mismatch" }
            require(nativeReportAdmissionDigest(configuration)==nativeReportAdmissionDigest(admission.authoredConfiguration)) { "frozen-configuration-mismatch" }
            require(nativeReportAdmissionDigest(document)==nativeReportAdmissionDigest(admission.document)) { "frozen-document-mismatch" }
            true
        }.onFailure { rejected?.invoke(windowId,it.message.orEmpty().take(120)) }.getOrDefault(false)
        if(!valid) { entries.remove(windowId,entry);return null }
        return entry
    }
}

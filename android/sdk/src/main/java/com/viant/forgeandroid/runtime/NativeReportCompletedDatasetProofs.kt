package com.viant.forgeandroid.runtime

import kotlinx.serialization.json.*
import java.util.concurrent.ConcurrentHashMap

/** Authenticated legacy rows are verified separately; they do not establish a clock or ACK. */
class NativeReportCompletedDatasetProofs(private val account:()->NativeReportAccountBinding?) {
    private data class Proof(val conversationId:String,val reportRunId:String,val ownerId:String,val account:NativeReportAccountBinding,val datasets:JsonArray,val current:(JsonObject,WindowMetadata?)->Boolean)
    private val entries=ConcurrentHashMap<String,Proof>()
    fun clear()=entries.clear()
    fun closeWindow(windowId:String) { entries.remove(windowId) }
    fun install(windowId:String,conversationId:String,reportRunId:String,ownerId:String,datasets:JsonArray,expectedAccount:NativeReportAccountBinding,current:(JsonObject,WindowMetadata?)->Boolean):Boolean {
        if(account()!=expectedAccount || ownerId.isBlank() || reportRunId.isBlank()) return false
        val objects=datasets.mapNotNull { it as? JsonObject }
        if(objects.size!=datasets.size || objects.map { it["id"] }.toSet().size!=objects.size || objects.any { it["request"] !is JsonObject || it["rows"] !is JsonArray || it["dataSourceRef"] !is JsonPrimitive }) return false
        entries[windowId]=Proof(conversationId,reportRunId,ownerId,expectedAccount,nativeReportImmutableJson(datasets) as JsonArray,current)
        return account()==expectedAccount
    }
    fun verified(windowId:String,conversationId:String,form:JsonObject,metadata:WindowMetadata?):JsonArray? {
        val proof=entries[windowId]?:return null
        val materialization=form["reportMaterialization"] as? JsonObject ?: return null
        if(account()!=proof.account || conversationId!=proof.conversationId || materialization["status"]!=JsonPrimitive("completed") || materialization["reportRunId"]!=JsonPrimitive(proof.reportRunId) || form["reportStaticDatasets"]!=proof.datasets) return null
        return proof.datasets.takeIf { runCatching { proof.current(form,metadata) }.getOrDefault(false) }
    }
}

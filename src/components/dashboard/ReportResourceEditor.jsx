import React, {useCallback, useEffect, useState} from "react";
import {Callout, Spinner} from "@blueprintjs/core";
import ReportDesigner from "./ReportDesigner.jsx";
import {buildReportBuilderResourceSaveRequest,buildReportResourceRunRequest,hostedReportResource,resourceEditorDefinition,resourceEditorDocument,validateReportResourceRunResult} from "./reportBuilderResourceLifecycle.js";

export default function ReportResourceEditor({container,context,forceReadOnly=false}) {
    const pin=hostedReportResource(container);
    const scoped=container?.dataSourceRef && typeof context?.Context === "function" ? context.Context(container.dataSourceRef) : context;
    const store=scoped?.handlers?.reportStore || context?.handlers?.reportStore;
    const [saved,setSaved]=useState(null), [document,setDocument]=useState(null), [error,setError]=useState("");
    const identity=JSON.stringify([pin?.uri,pin?.kind,pin?.revision,pin?.contentFingerprint,pin?.authorityBinding]);
    useEffect(()=>{
        let cancelled=false;setSaved(null);setDocument(null);setError("");
        Promise.resolve().then(()=>{
            if(typeof store?.getReport!=="function")throw new Error("Report editing is unavailable in this workspace.");
            return store.getReport(buildReportResourceRunRequest(pin));
        }).then(value=>{
            if(cancelled)return;
            if(["uri","kind","revision","contentFingerprint","authorityBinding"].some(field=>(pin[field]??"")!==(value.resource?.[field]??"")))throw new Error("The selected report changed. Refresh and try again.");
            setDocument(resourceEditorDocument(value));setSaved(value);
        }).catch(failure=>{if(!cancelled)setError(failure?.message || "The report could not be opened.");});
        return()=>{cancelled=true;};
    },[identity,store]);
    const save=useCallback(async({report})=>{
        const definition=resourceEditorDefinition(saved,report);
        const request=buildReportBuilderResourceSaveRequest({reportDocument:definition.reportDocument,title:definition.reportDocument.title},{current:saved});
        request.definition=definition;
        const value=await store.updateReport(request);
        setSaved(value);setDocument(resourceEditorDocument(value));
        return {status:"result",report:resourceEditorDocument(value)};
    },[saved,store]);
    const run=useCallback(async({report})=>{
        if(JSON.stringify(report)!==JSON.stringify(resourceEditorDocument(saved)))return {status:"conflict",message:"Save the draft before running the report."};
        if(typeof store?.runReport!=="function")throw new Error("Report execution is unavailable in this workspace.");
        const result=validateReportResourceRunResult(await store.runReport(buildReportResourceRunRequest(saved.resource,container?.parameters)),saved.resource);
        return {status:"result",...result};
    },[saved,store,container?.parameters]);
    if(error)return <Callout intent="danger" title="Report unavailable">This report could not be opened. Please try again.</Callout>;
    if(!saved || !document)return <Callout icon={<Spinner size={18}/>} title="Loading report"/>;
    const editable=!forceReadOnly && saved.resource?.kind==="working" && container?.parameters?.reportCapabilities?.edit===true;
    const executable=container?.parameters?.reportCapabilities?.run===true;
    return <ReportDesigner report={document} catalog={saved.resourceDefinition?.builderDefinition?.reportBuilder || {}} expectedRevision={saved.draftRevision} readOnly={!editable} onChange={()=>{}} onSave={editable?save:null} onRun={!forceReadOnly && executable?run:null} onPreview={!forceReadOnly && executable?run:null}/>;
}

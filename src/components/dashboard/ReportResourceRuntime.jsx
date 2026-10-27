import React, {useCallback, useEffect, useRef, useState} from "react";
import {Button, Callout, Spinner} from "@blueprintjs/core";
import ReportPrintPreview from "./ReportPrintPreview.jsx";
import ReportRuntime from "./ReportRuntime.jsx";
import ReportOutputActions from "./ReportOutputActions.jsx";
import {useReportOutput} from "./useReportOutput.js";
import {freshReportActionPin, sameReportActionIdentity, ReportMetadataRefreshError} from "./reportResourceFreshness.js";
import {buildReportResourceRunRequest, hostedReportResource, hostedReportParameters, validateReportResourceRunResult, reportResourceFailureMessage} from "./reportBuilderResourceLifecycle.js";
import {exportSelectedReport, reportResourceControls} from "./reportResourceExport.js";

export function reportExecutionProgressMessage(value) {
    if (value?.kind !== "reportExecution" || !Number.isInteger(value.total) || value.total < 1
        || !Number.isInteger(value.completed) || value.completed < 0 || value.completed > value.total) return "";
    if (value.phase === "materializing") return `Preparing report output. ${value.completed} of ${value.total} datasets loaded.`;
    if (value.phase === "planned") return `Loading report datasets. 0 of ${value.total} loaded.`;
    if (!["started", "completed"].includes(value.phase)) return "";
    const label = String(value.datasetLabel || value.datasetId || value.dataSourceId || "").trim();
    if (!label) return "";
    const tabs = Array.isArray(value.tabs) ? value.tabs.map(tab => String(tab?.label || tab?.id || "").trim()).filter(Boolean) : [];
    return `${value.phase === "completed" ? "Loaded" : "Loading"} ${label}${tabs.length ? ` (${tabs.join(", ")})` : ""}. ${value.completed} of ${value.total} loaded.`;
}

export function validateReportSectionSnapshot(value, expected, choices = {}) {
    if (value?.kind !== "reportSectionReady" || typeof value.sectionId !== "string" || !value.sectionId.trim() || !Array.isArray(value.sections) || value.sections.length < 2
        || value.sections.some(item => typeof item?.id !== "string" || !item.id.trim() || typeof item.label !== "string")
        || new Set(value.sections.map(item => item.id)).size !== value.sections.length
        || !value.sections.some(item => item.id === value.sectionId)
        || !value.reportSpec?.blocks?.some(block => block.id === value.sectionId && block.kind === "sectionBlock")
        || !Array.isArray(value.reportSpec?.datasets) || !Array.isArray(value.reportFill?.datasets)
        || value.reportSpec.datasets.some(dataset => !value.reportFill.datasets.some(fill => fill.id === dataset.id))) {
        throw new Error("Invalid report section snapshot.");
    }
    const selected = Object.fromEntries(Object.entries(choices || {}).filter(([id]) => value.reportSpec.blocks.some(block => block.id === id)));
    validateReportResourceRunResult(value, expected, selected, {fillOnly:true});
    return value;
}

export default function ReportResourceRuntime({container, context}) {
    const pin = hostedReportResource(container);
    const parameters = hostedReportParameters(container);
    const canRun = parameters.reportCapabilities?.run === true || parameters.reportCapabilities?.runRange === true;
    const canExport = parameters.reportCapabilities?.export === true;
    const canSelectMetrics = parameters.reportCapabilities?.chartMetricSelection === true;
    const scoped = container?.dataSourceRef && context?.Context ? context.Context(container.dataSourceRef) : context;
    const services = scoped?.handlers || context?.handlers || {};
    const [runResult, setRunResult] = useState(null);
    const [sectionSnapshot, setSectionSnapshot] = useState(null);
    const result = runResult?.result || sectionSnapshot || null;
    const [selectedSectionId, setSelectedSectionId] = useState("");
    const selectedSection = useRef("");
    const changeSection = id => {selectedSection.current=id;setSelectedSectionId(id);};
    const [error, setError] = useState("");
    const [progress, setProgress] = useState("");
    const generation = useRef(0);
    const sourceIdentity = JSON.stringify([pin, parameters.runOverride, parameters.prefill, parameters.runTrigger]);
    const [metricState, setMetricState] = useState(null);
    const metricSelections = metricState?.identity === sourceIdentity ? metricState.selections : {};
    const identity = JSON.stringify([sourceIdentity,canSelectMetrics ? metricSelections : {}]);
    const runParameters = {...parameters,chartMetricSelections:canSelectMetrics ? metricSelections : undefined};
    const changeMetrics = ({blockId,selection}) => {
        ++generation.current;
        setProgress(""); setError("");
        setMetricState(previous => ({identity:sourceIdentity,selections:{...(previous?.identity===sourceIdentity ? previous.selections : {}),[blockId]:selection}}));
    };
    const pendingRun = useRef(null);
    const metadataCache = useRef(null);
    const [metadataRefreshing, setMetadataRefreshing] = useState(false);
    const metadataIdentity = JSON.stringify(pin);
    const getReport = services.reportStore?.getReport;
    const actionPin = useCallback(async (selectedPin, options) => {
        const cached = metadataCache.current;
        const candidate = cached?.identity === metadataIdentity && sameReportActionIdentity(cached.pin,selectedPin) ? cached.pin : selectedPin;
        const fresh = await freshReportActionPin(candidate,getReport,options);
        if (fresh && options.isCurrent()) metadataCache.current={identity:metadataIdentity,pin:fresh};
        return fresh;
    },[metadataIdentity,getReport]);
    const outputActionPin = async (selectedPin,isCurrent) => {
        try {return await actionPin(selectedPin,{isCurrent,onRefresh:()=>{if(isCurrent())setMetadataRefreshing(true);}});}
        finally {if(isCurrent())setMetadataRefreshing(false);}
    };
    const runReport = services.reportStore?.runReport;
    const executeOnOpen = parameters.executeOnOpen === true;
    const run = useCallback(async () => {
        const current = ++generation.current;
        if (!canSelectMetrics) setMetricState(null);
        setRunResult(null); setSectionSnapshot(null); setMetadataRefreshing(false); setError(""); setProgress("Running the selected report revision.");
        try {
            if (!canRun || typeof runReport !== "function") throw new Error("Report execution is unavailable.");
            // StrictMode may replay the opening effect. Share only a pending request
            // for this exact authority/parameter identity; manual reruns after it
            // settles must execute again.
            let pending = pendingRun.current;
            if (!pending || pending.identity !== identity || pending.runReport !== runReport || pending.getReport !== getReport) {
                const request = {...buildReportResourceRunRequest(pin, runParameters), fillOnly:true, ...(selectedSection.current ? {prioritySectionId:selectedSection.current} : {})};
                pending = {identity, runReport, getReport, request, progress:"", listener:null, snapshot:null, updateListener:null, done:false};
                pending.promise = Promise.resolve().then(async () => {
                    const refreshed = await actionPin(request.resolvedResource,{isCurrent:()=>pending.isCurrent?.()===true,onRefresh:()=>{
                        pending.progress="Refreshing report details.";pending.listener?.(pending.progress);
                    }});
                    if (!refreshed) return null;
                    pending.request={...request,...buildReportResourceRunRequest(refreshed,{runOverride:request.parameters,chartMetricSelections:request.chartMetricSelections})};
                    pending.progress="Running the selected report revision.";pending.listener?.(pending.progress);
                    return runReport(pending.request, {onProgress:value => {
                        if (pending.done) return;
                        const message = reportExecutionProgressMessage(value);
                        if (!message) return;
                        pending.progress = message;
                        pending.listener?.(message);
                    }, onUpdate:value => {
                        if (pending.done) return;
                        if (pending.snapshot) throw new Error("Unexpected repeated report section snapshot.");
                        pending.snapshot = validateReportSectionSnapshot(value, pending.request.resolvedResource, pending.request.chartMetricSelections);
                        pending.updateListener?.(pending.snapshot);
                    }});
                })
                    .then(value => value == null && !pending.isCurrent?.() ? null : validateReportResourceRunResult(value, pending.request.resolvedResource, pending.request.chartMetricSelections, {fillOnly:true}))
                    .finally(() => {
                        pending.done = true; pending.listener = null; pending.updateListener = null;
                        if (pendingRun.current === pending) pendingRun.current = null;
                    });
                pendingRun.current = pending;
            }
            pending.isCurrent=()=>current === generation.current;
            pending.listener = message => {if (current === generation.current) setProgress(message);};
            pending.updateListener = value => {
                if (current !== generation.current) return;
                if (!value.sections.some(section => section.id === selectedSection.current)) changeSection(value.sectionId);
                setSectionSnapshot(value);
            };
            if (pending.progress) pending.listener(pending.progress);
            if (pending.snapshot) pending.updateListener(pending.snapshot);
            const value = await pending.promise;
            if (current === generation.current) {setSectionSnapshot(null);setRunResult({result:value, request:pending.request, version:current});}
        } catch (failure) {if (current === generation.current) {setSectionSnapshot(null);setError(failure instanceof ReportMetadataRefreshError ? failure.message : reportResourceFailureMessage(failure));}}
        finally {if (current === generation.current) setProgress("");}
    }, [identity, canRun, runReport, canSelectMetrics, actionPin, getReport]);
    useEffect(() => {
        ++generation.current;
        setRunResult(null); setSectionSnapshot(null); setMetadataRefreshing(false); setError(""); setProgress("");
        if (executeOnOpen || canSelectMetrics && Object.keys(metricSelections).length > 0) void run();
        // The host contract has no abort signal. Invalidate UI ownership so a
        // late result cannot replace a newer selection or update a closed view.
        return () => {++generation.current;};
    }, [identity, executeOnOpen, run]);
    const unexportedMetricSelection = !canSelectMetrics && Object.keys(metricSelections).length > 0;
    // A manual rerun can keep the same parameters. Its output still belongs to
    // a new execution, so a pending print/export from the older run must expire.
    const outputScopeKey = JSON.stringify([identity, runResult?.version]);
    const output = useReportOutput({scopeKey:outputScopeKey,disabled:!canExport||!runResult||!!progress||unexportedMetricSelection,
        onExport:async({format,tableBlockId,isCurrent})=>{
            const refreshed=await outputActionPin(runResult.request.resolvedResource,isCurrent);
            if(!refreshed||!isCurrent())return null;
            return exportSelectedReport({pin:refreshed,parameters:runParameters,format,tableBlockId,services:services.reportExport,isCurrent});
        },
        onPrint:async({isCurrent})=>{
            // Full print materialization is an explicit, fresh authorized run.
            // Reuse the completed screen run's captured pin, scope and metrics.
            const captured = runResult.request;
            const refreshed=await outputActionPin(captured.resolvedResource,isCurrent);
            if(!refreshed||!isCurrent())return null;
            const request = buildReportResourceRunRequest(refreshed, {runOverride:captured.parameters, chartMetricSelections:captured.chartMetricSelections});
            const printed = validateReportResourceRunResult(await runReport(request), refreshed, request.chartMetricSelections);
            return printed.reportPrint;
        }});
    const controls = reportResourceControls({canRun, canExport, result, progress});
    const tables=parameters.reportCapabilities?.tableBlockSelection===true?result?.reportSpec?.blocks?.filter(block=>block.kind==='tableBlock'):undefined;
    return <section style={{padding:16}}>
        <h2>{result?.reportSpec?.title || parameters.reportTitle || "Selected report"}</h2>
        <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            {parameters.showRunControl !== false && <Button icon="play" onClick={run} disabled={controls.runDisabled}>Run report</Button>}

        </div>
        <ReportOutputActions scopeKey={identity} output={output} disabled={!canExport||!runResult||!!progress||unexportedMetricSelection} tableBlocks={tables} reportSpec={result?.reportSpec} workbookExport={parameters.reportCapabilities?.workbookExport===true}/>
        {unexportedMetricSelection && <Callout>Chart selections cannot be exported from this preview. Run the report again to restore its saved chart choices.</Callout>}
        {progress && <Callout role="status" aria-live="polite" data-forge-status="info" icon={<Spinner size={18}/>} title="Report progress">{progress}</Callout>}
        {metadataRefreshing && <Callout role="status" aria-live="polite" data-forge-status="info" icon={<Spinner size={18}/>}>Refreshing report details.</Callout>}
        {error && <Callout intent="danger" title="Report unavailable">{error}</Callout>}
        {result && !output.printModel && <ReportRuntime reportSpec={result.reportSpec} reportFill={result.reportFill} presentationMode="report" onChartMetricSelectionChange={changeMetrics}
            selectedSectionId={selectedSectionId} onSectionChange={changeSection}
            sectionNavigation={sectionSnapshot?.sections || null}
            sectionLoading={!!sectionSnapshot && selectedSectionId !== sectionSnapshot.sectionId}/>}
        {output.printModel && <ReportPrintPreview reportPrint={output.printModel}/>}
    </section>;
}

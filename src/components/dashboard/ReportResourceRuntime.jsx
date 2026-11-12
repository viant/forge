import {readVisibleReport} from "../../core/ui/reportVisible.js";
import NativeControlTarget from "../../runtime/NativeControlTarget.jsx";
import {registerReportWindowActions} from "../../core/ui/reportActions.js";
import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from "react";
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

export default function ReportResourceRuntime({container, context, onViewStateChange}) {
    const rendererRoot = useRef(null);
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
    const [visibleSectionId, setVisibleSectionId] = useState("");
    const selectedSection = useRef("");
    const changeSection = id => {selectedSection.current=id;setSelectedSectionId(id);};
    const [error, setError] = useState("");
    const [progress, setProgress] = useState("");
    const generation = useRef(0);
    // The native host may readmit the same content after credential rotation.
    // Keep the completed display and scope; new actions use its current pin.
    const {authorityBinding: _authority, validUntil: _expiry, ...contentPin} = pin || {};
    const sourceIdentity = JSON.stringify([contentPin, parameters.runOverride, parameters.prefill, parameters.runTrigger]);
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
    const completion = useRef(null);
    const currentRead = useRef(null);
    useEffect(() => () => {
        completion.current?.finish({status:'closed',error:'Report window closed while waiting.'});
    }, []);
    useLayoutEffect(() => {
        const waiting = completion.current;
        if (!waiting || waiting.generation !== generation.current || progress) return;
        if (runResult?.version === waiting.generation || error) waiting.finish();
    }, [runResult, error, progress]);
    const metadataCache = useRef(null);
    const [metadataRefreshing, setMetadataRefreshing] = useState(false);
    const displayedSection = visibleSectionId || selectedSectionId || result?.reportSpec?.blocks?.find(block=>block.kind==='tabGroupBlock')?.defaultSectionId || '';
    const displayedTitle = result?.reportSpec?.title || parameters.reportTitle || '';
    const displayedStatus = progress ? 'loading' : error ? 'error' : result ? 'ready' : 'idle';
    const metadataIdentity = JSON.stringify(pin);
    const getReport = services.reportStore?.getReport;
    const currentMetadata = useRef(null);
    currentMetadata.current = {pin, metadataIdentity};
    const actionPin = useCallback(async (selectedPin, options) => {
        const current = currentMetadata.current;
        const sameContent = ['providerIdentity','uri','kind','revision','contentFingerprint'].every(field => (current.pin?.[field] ?? '') === (selectedPin?.[field] ?? ''));
        const selected = sameContent ? current.pin : selectedPin;
        const cached = metadataCache.current;
        const candidate = cached?.identity === current.metadataIdentity && sameReportActionIdentity(cached.pin,selected) ? cached.pin : selected;
        const fresh = await freshReportActionPin(candidate,getReport,options);
        if (fresh && options.isCurrent()) metadataCache.current={identity:current.metadataIdentity,pin:fresh};
        return fresh;
    },[getReport]);
    const outputActionPin = async (selectedPin,isCurrent) => {
        try {return await actionPin(selectedPin,{isCurrent,onRefresh:()=>{if(isCurrent())setMetadataRefreshing(true);}});}
        finally {if(isCurrent())setMetadataRefreshing(false);}
    };
    const runReport = services.reportStore?.runReport;
    const executeOnOpen = parameters.executeOnOpen === true;
    const run = useCallback(async () => {
        completion.current?.finish({status:'superseded',error:'Report execution was superseded.'});
        const current = ++generation.current;
        let finish;
        const promise = new Promise(resolve => {finish=resolve;});
        completion.current = {generation:current,promise,finish};
        if (!canSelectMetrics) setMetricState(null);
        setRunResult(null); setSectionSnapshot(null); setMetadataRefreshing(false); setError(""); setProgress("Running the selected report revision.");
        try {
            if (!canRun || typeof runReport !== "function") throw new Error("Report execution is unavailable.");
            // StrictMode may replay the opening effect. Share only a pending request
            // for this exact authority/parameter identity; manual reruns after it
            // settles must execute again.
            let pending = pendingRun.current;
            if (!pending || pending.identity !== identity || pending.runReport !== runReport || pending.getReport !== getReport) {
                const request = {...buildReportResourceRunRequest(currentMetadata.current.pin, runParameters), fillOnly:true, ...(selectedSection.current ? {prioritySectionId:selectedSection.current} : {})};
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
        } catch (failure) {if (current === generation.current) {completion.current.failure=failure;setSectionSnapshot(null);setError(failure instanceof ReportMetadataRefreshError ? failure.message : reportResourceFailureMessage(failure));}}
        finally {if (current === generation.current) setProgress("");}
    }, [identity, canRun, runReport, canSelectMetrics, actionPin, getReport]);
    useEffect(() => {
        ++generation.current;
        setRunResult(null); setSectionSnapshot(null); setMetadataRefreshing(false); setError(""); setProgress("");
        if (executeOnOpen || canSelectMetrics && Object.keys(metricSelections).length > 0) void run();
        // The host contract has no abort signal. Invalidate UI ownership so a
        // late result cannot replace a newer selection or update a closed view.
        return () => {++generation.current;completion.current?.finish({status:'superseded',error:'Report execution was superseded.'});};
    }, [identity, executeOnOpen, run]);
    const unexportedMetricSelection = !canSelectMetrics && Object.keys(metricSelections).length > 0;
    // A manual rerun can keep the same parameters. Its output still belongs to
    // a new execution, so a pending print/export from the older run must expire.
    const outputScopeKey = JSON.stringify([identity, metadataIdentity, runResult?.version]);
    const output = useReportOutput({scopeKey:outputScopeKey,title:displayedTitle,disabled:!canExport||!runResult||!!progress||unexportedMetricSelection,
        onExport:async({format,tableBlockId,isCurrent})=>{
            const refreshed=await outputActionPin(runResult.request.resolvedResource,isCurrent);
            if(!refreshed||!isCurrent())return null;
            return exportSelectedReport({pin:refreshed,parameters:{runOverride:runResult.request.parameters,chartMetricSelections:runResult.request.chartMetricSelections},format,tableBlockId,services:services.reportExport,isCurrent});
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
    const windowId=context?.identity?.windowId || context?.windowState?.windowId;
    const controls = reportResourceControls({canRun, canExport, result, progress});
    useLayoutEffect(()=>{
        const current={ok:true,windowId,
            reportId:pin?.uri || '',reportName:displayedTitle,sourceKind:'resource',
            request:{parameters:structuredClone(parameters.prefill || {})},
            draftParameters:structuredClone(context?.windowState?.windowForm || parameters.prefill || {}),
            canRun:canRun&&typeof runReport==='function'&&!progress,canSave:false,
            hasCompletedRun:!!runResult,status:displayedStatus,activeSectionId:displayedSection,
            error,progress,
            runControlId:parameters.showRunControl===false?'report-filter:apply':'report-run',
            canExport:!controls.exportDisabled&&!output.busy,
        };
        onViewStateChange?.({resourceUri:current.reportId,title:current.reportName,status:current.status,activeSectionId:current.activeSectionId,
            parameters:current.request.parameters,draftParameters:current.draftParameters,canRun:current.canRun,canSave:current.canSave,
            canExport:current.canExport,hasCompletedRun:current.hasCompletedRun,runControlId:current.runControlId,error:current.error,progress:current.progress});
        if(!windowId)return;
        currentRead.current = ({include} = {}) => {
            const completed=runResult?.version===generation.current?runResult:null;
            return {...current,hasCompletedRun:!!completed,
                ...(include?.visible && !include.raw && completed && current.status === "ready" ? {visible:readVisibleReport(rendererRoot.current)} : {}),
                ...(completed?{reportSpec:completed.result.reportSpec,reportFill:completed.result.reportFill}: {})};
        };
        return registerReportWindowActions(windowId,{getCurrent:async(input = {})=>{
            if (input.waitForCompletion === true && currentRead.current?.().status === 'loading') {
                const waiting = completion.current;
                if (!waiting) throw new Error('Report completion is unavailable for this execution.');
                let timer;
                try {
                    const timeout = Number.isFinite(input.timeoutMs) && input.timeoutMs > 0 ? input.timeoutMs : 330000;
                    const outcome = await Promise.race([waiting.promise,new Promise(resolve=>{
                        timer=setTimeout(()=>resolve({status:'timeout',error:'Timed out waiting for report completion; execution may still be running.'}),timeout);
                    })]);
                    if (outcome) return {...currentRead.current(input),ok:false,...outcome};
                    if (waiting.generation !== generation.current) return {...currentRead.current(input),ok:false,status:'superseded',error:'Report execution was superseded.'};
                } finally {clearTimeout(timer);}
            }
            const snapshot=currentRead.current(input);
            return input.waitForCompletion === true && snapshot.status === 'error'
                ? {...snapshot,ok:false,...(completion.current?.failure?.name === 'AbortError' ? {status:'cancelled'} : {})} : snapshot;
        }});
    },[onViewStateChange,windowId,identity,displayedTitle,displayedStatus,displayedSection,canRun,runReport,error,progress,runResult,context?.windowState?.windowForm,controls.exportDisabled,output.busy]);
    const tables=parameters.reportCapabilities?.tableBlockSelection===true?result?.reportSpec?.blocks?.filter(block=>block.kind==='tableBlock'):undefined;
    return <section style={{padding:16}}>
        <h2>{result?.reportSpec?.title || parameters.reportTitle || "Selected report"}</h2>
        <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            {parameters.showRunControl !== false && <NativeControlTarget context={context} controlId="report-run" item={{type:"button"}} disabled={controls.runDisabled} actions={{click:run}}><Button icon="play" onClick={run} disabled={controls.runDisabled}>Run report</Button></NativeControlTarget>}

        </div>
        <ReportOutputActions context={context} scopeKey={identity} output={output} disabled={!canExport||!runResult||!!progress||unexportedMetricSelection} tableBlocks={tables} reportSpec={result?.reportSpec} workbookExport={parameters.reportCapabilities?.workbookExport===true}/>
        {unexportedMetricSelection && <Callout>Chart selections cannot be exported from this preview. Run the report again to restore its saved chart choices.</Callout>}
        {progress && <Callout role="status" aria-live="polite" data-forge-status="info" icon={<Spinner size={18}/>} title="Report progress">{progress}</Callout>}
        {metadataRefreshing && <Callout role="status" aria-live="polite" data-forge-status="info" icon={<Spinner size={18}/>}>Refreshing report details.</Callout>}
        {error && <Callout intent="danger" title="Report unavailable">{error}</Callout>}
        {result && !output.printModel && <ReportRuntime reportRootRef={rendererRoot} reportSpec={result.reportSpec} reportFill={result.reportFill} presentationMode="report" onChartMetricSelectionChange={changeMetrics}
            selectedSectionId={selectedSectionId} onSectionChange={changeSection} onActiveSectionChange={setVisibleSectionId}
            sectionNavigation={sectionSnapshot?.sections || null}
            sectionLoading={!!sectionSnapshot && selectedSectionId !== sectionSnapshot.sectionId}/>}
        {output.printModel && <ReportPrintPreview reportPrint={output.printModel}/>}
    </section>;
}

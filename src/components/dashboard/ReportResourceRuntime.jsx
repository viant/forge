import React, {useCallback, useEffect, useRef, useState} from "react";
import {Button, Callout, Spinner} from "@blueprintjs/core";
import ReportPrintPreview from "./ReportPrintPreview.jsx";
import ReportRuntime from "./ReportRuntime.jsx";
import ReportOutputActions from "./ReportOutputActions.jsx";
import {useReportOutput} from "./useReportOutput.js";
import {buildReportResourceRunRequest, hostedReportResource, hostedReportParameters, validateReportResourceRunResult} from "./reportBuilderResourceLifecycle.js";
import {exportSelectedReport, reportResourceControls} from "./reportResourceExport.js";

export default function ReportResourceRuntime({container, context}) {
    const pin = hostedReportResource(container);
    const parameters = hostedReportParameters(container);
    const canRun = parameters.reportCapabilities?.run === true || parameters.reportCapabilities?.runRange === true;
    const canExport = parameters.reportCapabilities?.export === true;
    const canSelectMetrics = parameters.reportCapabilities?.chartMetricSelection === true;
    const scoped = container?.dataSourceRef && context?.Context ? context.Context(container.dataSourceRef) : context;
    const services = scoped?.handlers || context?.handlers || {};
    const [runResult, setRunResult] = useState(null);
    const result = runResult?.result || null;
    const [error, setError] = useState("");
    const [progress, setProgress] = useState("");
    const generation = useRef(0);
    const sourceIdentity = JSON.stringify([pin, parameters.runOverride, parameters.prefill]);
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
    const runReport = services.reportStore?.runReport;
    const executeOnOpen = parameters.executeOnOpen === true;
    const run = useCallback(async () => {
        const current = ++generation.current;
        if (!canSelectMetrics) setMetricState(null);
        setRunResult(null); setError(""); setProgress("Running the selected report revision.");
        try {
            if (!canRun || typeof runReport !== "function") throw new Error("Report execution is unavailable.");
            // StrictMode may replay the opening effect. Share only a pending request
            // for this exact authority/parameter identity; manual reruns after it
            // settles must execute again.
            let pending = pendingRun.current;
            if (!pending || pending.identity !== identity || pending.runReport !== runReport) {
                const request = {...buildReportResourceRunRequest(pin, runParameters), fillOnly:true};
                pending = {identity, runReport, request};
                pending.promise = Promise.resolve().then(() => runReport(request))
                    .then(value => validateReportResourceRunResult(value, request.resolvedResource, request.chartMetricSelections, {fillOnly:true}))
                    .finally(() => {
                        if (pendingRun.current === pending) pendingRun.current = null;
                    });
                pendingRun.current = pending;
            }
            const value = await pending.promise;
            if (current === generation.current) setRunResult({result:value, request:pending.request, version:current});
        } catch (failure) {if (current === generation.current) setError(failure?.message || "The report could not be run.");}
        finally {if (current === generation.current) setProgress("");}
    }, [identity, canRun, runReport, canSelectMetrics]);
    useEffect(() => {
        ++generation.current;
        setRunResult(null); setError(""); setProgress("");
        if (executeOnOpen || canSelectMetrics && Object.keys(metricSelections).length > 0) void run();
        // The host contract has no abort signal. Invalidate UI ownership so a
        // late result cannot replace a newer selection or update a closed view.
        return () => {++generation.current;};
    }, [identity, executeOnOpen, run]);
    const unexportedMetricSelection = !canSelectMetrics && Object.keys(metricSelections).length > 0;
    // A manual rerun can keep the same parameters. Its output still belongs to
    // a new execution, so a pending print/export from the older run must expire.
    const outputScopeKey = JSON.stringify([identity, runResult?.version]);
    const output = useReportOutput({scopeKey:outputScopeKey,disabled:!canExport||!result||!!progress||unexportedMetricSelection,
        onExport:({format,tableBlockId,isCurrent})=>exportSelectedReport({pin,parameters:runParameters,format,tableBlockId,services:services.reportExport,isCurrent}),
        onPrint:async()=>{
            // Full print materialization is an explicit, fresh authorized run.
            // Reuse the completed screen run's captured pin, scope and metrics.
            const captured = runResult.request;
            const request = buildReportResourceRunRequest(captured.resolvedResource, {runOverride:captured.parameters, chartMetricSelections:captured.chartMetricSelections});
            const printed = validateReportResourceRunResult(await runReport(request), captured.resolvedResource, request.chartMetricSelections);
            return printed.reportPrint;
        }});
    const controls = reportResourceControls({canRun, canExport, result, progress});
    const tables=parameters.reportCapabilities?.tableBlockSelection===true?result?.reportSpec?.blocks?.filter(block=>block.kind==='tableBlock'):undefined;
    return <section style={{padding:16}}>
        <h2>{result?.reportSpec?.title || parameters.reportTitle || "Selected report"}</h2>
        <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <Button icon="play" onClick={run} disabled={controls.runDisabled}>Run report</Button>

        </div>
        <ReportOutputActions scopeKey={identity} output={output} disabled={!canExport||!result||!!progress||unexportedMetricSelection} tableBlocks={tables}/>
        {unexportedMetricSelection && <Callout>Chart selections cannot be exported from this preview. Run the report again to restore its saved chart choices.</Callout>}
        {progress && <Callout icon={<Spinner size={18}/>} title="Report progress">{progress}</Callout>}
        {error && <Callout intent="danger" title="Report unavailable">This report could not be run. Please try again.</Callout>}
        {result && !output.printModel && <ReportRuntime reportSpec={result.reportSpec} reportFill={result.reportFill} presentationMode="report" onChartMetricSelectionChange={changeMetrics}/>}
        {output.printModel && <ReportPrintPreview reportPrint={output.printModel}/>}
    </section>;
}

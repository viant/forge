import React, {useCallback, useEffect, useRef, useState} from "react";
import {Button, Callout, Spinner} from "@blueprintjs/core";
import ReportPrintPreview from "./ReportPrintPreview.jsx";
import ReportRuntime from "./ReportRuntime.jsx";
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
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");
    const [progress, setProgress] = useState("");
    const [printPreview, setPrintPreview] = useState(false);
    const generation = useRef(0);
    const clearPreview = () => setPrintPreview(false);
    const sourceIdentity = JSON.stringify([pin, parameters.runOverride, parameters.prefill]);
    const [metricState, setMetricState] = useState(null);
    const metricSelections = metricState?.identity === sourceIdentity ? metricState.selections : {};
    const identity = JSON.stringify([sourceIdentity,canSelectMetrics ? metricSelections : {}]);
    const runParameters = {...parameters,chartMetricSelections:canSelectMetrics ? metricSelections : undefined};
    const changeMetrics = ({blockId,selection}) => {
        ++generation.current;
        clearPreview(); setProgress(""); setError("");
        setMetricState(previous => ({identity:sourceIdentity,selections:{...(previous?.identity===sourceIdentity ? previous.selections : {}),[blockId]:selection}}));
    };
    const pendingRun = useRef(null);
    const runReport = services.reportStore?.runReport;
    const executeOnOpen = parameters.executeOnOpen === true;
    const run = useCallback(async () => {
        const current = ++generation.current;
        if (!canSelectMetrics) setMetricState(null);
        clearPreview();
        setResult(null); setError(""); setProgress("Running the selected report revision.");
        try {
            if (!canRun || typeof runReport !== "function") throw new Error("Report execution is unavailable.");
            // StrictMode may replay the opening effect. Share only a pending request
            // for this exact authority/parameter identity; manual reruns after it
            // settles must execute again.
            let pending = pendingRun.current;
            if (!pending || pending.identity !== identity || pending.runReport !== runReport) {
                const request = buildReportResourceRunRequest(pin, runParameters);
                pending = {identity, runReport};
                pending.promise = Promise.resolve().then(() => runReport(request))
                    .then(value => validateReportResourceRunResult(value, pin, request.chartMetricSelections))
                    .finally(() => {
                        if (pendingRun.current === pending) pendingRun.current = null;
                    });
                pendingRun.current = pending;
            }
            const value = await pending.promise;
            if (current === generation.current) setResult(value);
        } catch (failure) {if (current === generation.current) setError(failure?.message || "The report could not be run.");}
        finally {if (current === generation.current) setProgress("");}
    }, [identity, canRun, runReport, canSelectMetrics]);
    useEffect(() => {
        ++generation.current;
        setResult(null); setError(""); setProgress(""); clearPreview();
        if (executeOnOpen || canSelectMetrics && Object.keys(metricSelections).length > 0) void run();
        // The host contract has no abort signal. Invalidate UI ownership so a
        // late result cannot replace a newer selection or update a closed view.
        return () => {++generation.current;};
    }, [identity, executeOnOpen, run]);
    const download = async format => {
        const current = ++generation.current;
        setError(""); setProgress(`Preparing ${format.toUpperCase()} export.`);
        try {
            if (!canExport || !result) throw new Error("Run the selected report before exporting.");
            if (!canSelectMetrics && Object.keys(metricSelections).length) throw new Error("Run the report again before exporting its saved chart choices.");
            const artifact = await exportSelectedReport({pin, parameters:runParameters, format, services: services.reportExport, isCurrent: () => current === generation.current});
            if (!artifact) return;
            const bytes = Uint8Array.from(atob(artifact.data), character => character.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([bytes], {type: artifact.contentType}));
            const link = document.createElement("a");
            link.href = url; link.download = artifact.filename || artifact.fileName || `report.${format}`; link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (failure) {if (current === generation.current) setError(failure.message);}
        finally {if (current === generation.current) setProgress("");}
    };
    const controls = reportResourceControls({canRun, canExport, result, progress});
    const unexportedMetricSelection = !canSelectMetrics && Object.keys(metricSelections).length > 0;
    if (unexportedMetricSelection) controls.exportDisabled = true;
    return <section style={{padding:16}}>
        <h2>{result?.reportSpec?.title || parameters.reportTitle || "Selected report"}</h2>
        <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <Button icon="play" onClick={run} disabled={controls.runDisabled}>Run report</Button>
            <Button icon="print" onClick={() => setPrintPreview(value => !value)} disabled={controls.exportDisabled}>Print preview</Button>
            {["pdf","csv","xlsx"].map(format => <Button key={format} onClick={() => download(format)} disabled={controls.exportDisabled}>Export {format.toUpperCase()}</Button>)}
        </div>
        {unexportedMetricSelection && <Callout>Chart selections cannot be exported from this preview. Run the report again to restore its saved chart choices.</Callout>}
        {progress && <Callout icon={<Spinner size={18}/>} title="Report progress">{progress}</Callout>}
        {error && <Callout intent="danger" title="Report unavailable">{error}</Callout>}
        {result && <ReportRuntime reportSpec={result.reportSpec} reportFill={result.reportFill} presentationMode="report" onChartMetricSelectionChange={changeMetrics}/>}
        {printPreview && result && <ReportPrintPreview reportPrint={result.reportPrint}/>}
    </section>;
}

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
    const scoped = container?.dataSourceRef && context?.Context ? context.Context(container.dataSourceRef) : context;
    const services = scoped?.handlers || context?.handlers || {};
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");
    const [progress, setProgress] = useState("");
    const [printPreview, setPrintPreview] = useState(false);
    const generation = useRef(0);
    const clearPreview = () => setPrintPreview(false);
    const identity = JSON.stringify([pin, parameters.runOverride, parameters.prefill]);
    const pendingRun = useRef(null);
    const runReport = services.reportStore?.runReport;
    const executeOnOpen = parameters.executeOnOpen === true;
    const run = useCallback(async () => {
        const current = ++generation.current;
        clearPreview();
        setResult(null); setError(""); setProgress("Running the selected report revision.");
        try {
            if (!canRun || typeof runReport !== "function") throw new Error("Report execution is unavailable.");
            // StrictMode may replay the opening effect. Share only a pending request
            // for this exact authority/parameter identity; manual reruns after it
            // settles must execute again.
            let pending = pendingRun.current;
            if (!pending || pending.identity !== identity || pending.runReport !== runReport) {
                const request = buildReportResourceRunRequest(pin, parameters);
                pending = {identity, runReport};
                pending.promise = Promise.resolve().then(() => runReport(request))
                    .then(value => validateReportResourceRunResult(value, pin))
                    .finally(() => {
                        if (pendingRun.current === pending) pendingRun.current = null;
                    });
                pendingRun.current = pending;
            }
            const value = await pending.promise;
            if (current === generation.current) setResult(value);
        } catch (failure) {if (current === generation.current) setError(failure?.message || "The report could not be run.");}
        finally {if (current === generation.current) setProgress("");}
    }, [identity, canRun, runReport]);
    useEffect(() => {
        ++generation.current;
        setResult(null); setError(""); setProgress(""); clearPreview();
        if (executeOnOpen) void run();
        // The host contract has no abort signal. Invalidate UI ownership so a
        // late result cannot replace a newer selection or update a closed view.
        return () => {++generation.current;};
    }, [identity, executeOnOpen, run]);
    const download = async format => {
        const current = ++generation.current;
        setError(""); setProgress(`Preparing ${format.toUpperCase()} export.`);
        try {
            if (!canExport || !result) throw new Error("Run the selected report before exporting.");
            const artifact = await exportSelectedReport({pin, parameters, format, services: services.reportExport, isCurrent: () => current === generation.current});
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
    return <section style={{padding:16}}>
        <h2>{result?.reportSpec?.title || parameters.reportTitle || "Selected report"}</h2>
        <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <Button icon="play" onClick={run} disabled={controls.runDisabled}>Run report</Button>
            <Button icon="print" onClick={() => setPrintPreview(value => !value)} disabled={controls.exportDisabled}>Print preview</Button>
            {["pdf","csv","xlsx"].map(format => <Button key={format} onClick={() => download(format)} disabled={controls.exportDisabled}>Export {format.toUpperCase()}</Button>)}
        </div>
        {progress && <Callout icon={<Spinner size={18}/>} title="Report progress">{progress}</Callout>}
        {error && <Callout intent="danger" title="Report unavailable">{error}</Callout>}
        {result && <ReportRuntime reportSpec={result.reportSpec} reportFill={result.reportFill} presentationMode="report"/>}
        {printPreview && result && <ReportPrintPreview reportPrint={result.reportPrint}/>}
    </section>;
}

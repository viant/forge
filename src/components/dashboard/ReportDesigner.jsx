import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signal } from "@preact/signals-react";
import ReportBuilder from "./ReportBuilder.jsx";
import ReportRuntime from "./ReportRuntime.jsx";
import SectionTabRail from "../SectionTabRail.jsx";
import { buildReportBuilderDesignSections } from "./reportBuilderDesignSections.js";
import { addEmbeddedDataset, replaceEmbeddedDataset, applyEmbeddedReportChange, prepareEmbeddedReport, validateProviderSourceSelection } from "./reportDesignerModel.js";

const signature = (value) => JSON.stringify(value ?? null);
const label = (error) => String(error?.message || error || "Request failed.");
const actionable = (status) => status === "result" || status === "partial";
const EMPTY_CATALOG = Object.freeze({});
const EMPTY_PROVIDERS = Object.freeze([]);

function EmbeddedDesignWorkspace({ report, catalog, capabilities, readOnly, selectedSectionId, onChange, onEditorDraftChange }) {
    const prepared = useMemo(() => prepareEmbeddedReport(report, catalog), [report, catalog]);
    const primarySourceRef = report.scope?.dataSourceRef || prepared.builder?.source?.dataSourceRef || report.datasets?.[0]?.dataSourceRef || "";
    const context = useMemo(() => {
        const stateKey = `embedded_${report.id || "report"}`;
        const own = {
            identity: { dataSourceRef: primarySourceRef, windowId: stateKey },
            metadata: { namespace: "Report designer", dialogs: [] },
            signals: {
                windowForm: signal({ [stateKey]: prepared.state }),
                collection: signal([]), control: signal({ loading: false, error: null }),
                collectionInfo: signal({ hasMore: false }), input: signal({ parameters: {} }),
                form: signal({}), metrics: signal({}), selection: signal({ selected: null, rowIndex: -1 }), message: signal(null),
            },
            handlers: { dataSource: { getWindowFormData: () => own.signals.windowForm.peek(), setWindowFormData: () => {} } },
            lookupHandler(name) {
                if (name?.endsWith(".initializeState")) return ({ state }) => state;
                if (name?.endsWith(".buildRequest")) return ({ request }) => request;
                if (name?.endsWith(".resolveLookup")) return () => null;
                return undefined;
            },
            Context() { return own; },
        };
        return own;
    }, [prepared.state, report.id, primarySourceRef]);
    const container = useMemo(() => ({
        id: `embedded_${report.id || "report"}`, stateKey: `embedded_${report.id || "report"}`,
        title: report.title || "Report", dataSourceRef: primarySourceRef,
        parameters: { mode: "design" }, reportBuilder: { ...prepared.config, result: { ...(prepared.config.result || {}), runtimePreview: { enabled: false } } },
    }), [prepared.config, report.id, primarySourceRef, report.title]);
    const changed = useCallback((nextState, nextConfig) => {
        const next = applyEmbeddedReportChange(report, nextState, nextConfig);
        onChange(next, { kind: "document", source: "design" });
    }, [onChange, report]);
    const bridge = useMemo(() => ({ mode: "controlled", onChange: changed, onEditorDraftChange, selectedSectionId, capabilities, readOnly }), [changed, onEditorDraftChange, selectedSectionId, capabilities, readOnly]);
    return <fieldset disabled={readOnly} className={`forge-report-designer__workspace${readOnly ? " is-read-only" : ""}`}>
        <ReportBuilder container={container} context={context} hostAdapter={bridge} />
    </fieldset>;
}

/** Controlled native-report authoring. The host owns persistence, revisions and every source request. */
export default function ReportDesigner({
    report, catalog = EMPTY_CATALOG, datasets = null, capabilities = EMPTY_CATALOG, sourceProviders = EMPTY_PROVIDERS, readOnly = false,
    expectedRevision = null, onChange, onPreview, onRun, onSave,
}) {
    const [candidate, setCandidate] = useState(report);
    const [base, setBase] = useState(report);
    const [pendingHostReport, setPendingHostReport] = useState(null);
    const [activeEditorDraft, setActiveEditorDraft] = useState(false);
    const [readOnlySectionId, setReadOnlySectionId] = useState("");
    const [generation, setGeneration] = useState(0);
    const [operation, setOperation] = useState({ status: "idle" });
    const [sources, setSources] = useState([]);
    const [sourcePages, setSourcePages] = useState([]);
    const [sourceState, setSourceState] = useState({ status: "idle" });
    const [pendingSourceAuthoring, setPendingSourceAuthoring] = useState(null);
    const [pendingDatasetUpdate, setPendingDatasetUpdate] = useState(null);
    const requestRef = useRef(null);
    const incomingSignature = signature(report);
    const incomingRef = useRef(incomingSignature);
    useEffect(() => {
        if (incomingRef.current === incomingSignature) return;
        incomingRef.current = incomingSignature;
        if (incomingSignature === signature(candidate)) {
            setBase(report); setPendingHostReport(null);
        } else if (activeEditorDraft || signature(candidate) !== signature(base)) {
            setPendingHostReport(report);
        } else {
            setBase(report); setCandidate(report); setPendingHostReport(null); setGeneration((value) => value + 1);
        }
    }, [incomingSignature, report, candidate, base, activeEditorDraft]);
    useEffect(() => () => requestRef.current?.abort(), []);
    const dirty = signature(candidate) !== signature(base);
    const effectiveReadOnly = readOnly || typeof onChange !== "function";
    const acceptChange = useCallback((next, change) => {
        if (effectiveReadOnly || !next || signature(next) === signature(candidate)) return;
        setCandidate(next);
        setOperation({ status: "idle" });
        onChange?.(next, change);
    }, [candidate, onChange, effectiveReadOnly]);
    const replaceFromHost = () => {
        requestRef.current?.abort();
        setBase(pendingHostReport); setCandidate(pendingHostReport); setPendingHostReport(null); setPendingDatasetUpdate(null); setPendingSourceAuthoring(null);
        setGeneration((value) => value + 1); setActiveEditorDraft(false); setOperation({ status: "idle" });
    };
    const invoke = async (kind, callback) => {
        if (typeof callback !== "function") return;
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        setOperation({ status: "loading", kind });
        try {
            const result = await callback({ report: candidate, expectedRevision, signal: controller.signal });
            if (controller.signal.aborted) return;
            const status = result?.status || (result?.reportSpec && result?.reportFill ? "result" : "error");
            setOperation({ ...result, status, kind });
            if (kind === "save" && result?.report && actionable(status)) {
                setBase(result.report); setCandidate(result.report);
                setGeneration((value) => value + 1);
            }
        } catch (error) {
            if (!controller.signal.aborted) setOperation({ kind, status: "error", message: label(error) });
        }
    };
    const cancelRequest = () => {
        requestRef.current?.abort();
        requestRef.current = null;
        setOperation({ status: "idle" });
        setSourceState((current) => current.status === "loading" ? { status: "idle" } : current);
    };
    const discover = async () => {
        requestRef.current?.abort();
        const controller = new AbortController(); requestRef.current = controller;
        setPendingSourceAuthoring(null);
        setSourcePages([]);
        setSourceState({ status: "loading" });
        try {
            const results = await Promise.allSettled(sourceProviders.map(async (provider) => ({
                provider,
                response: await provider.discover({ signal: controller.signal }),
            })));
            if (controller.signal.aborted) return;
            const found = [];
            const unavailable = [];
            const pages = [];
            for (const entry of results) {
                if (entry.status === "rejected") { unavailable.push(label(entry.reason)); continue; }
                const { provider, response } = entry.value;
                if (!Array.isArray(response) && response?.status && response.status !== "result") {
                    unavailable.push(response.message || `${provider.id} is ${response.status}.`);
                }
                const items = Array.isArray(response) ? response : response?.sources;
                (Array.isArray(items) ? items : []).forEach((source) => found.push({ provider, source }));
                if (response?.nextAfter) pages.push({ provider, after: response.nextAfter });
            }
            setSources(found);
            setSourcePages(pages);
            setSourceState({ status: unavailable.length || pages.length ? (found.length ? "partial" : "unavailable") : "result", message: unavailable.join(" ") });
        } catch (error) { if (!controller.signal.aborted) setSourceState({ status: "error", message: label(error) }); }
    };
    const loadMoreSources = async () => {
        if (!sourcePages.length) return;
        requestRef.current?.abort();
        const controller = new AbortController(); requestRef.current = controller;
        setSourceState({ status: "loading" });
        const results = await Promise.allSettled(sourcePages.map(async ({ provider, after }) => ({
            provider, response: await provider.discover({ after, signal: controller.signal }),
        })));
        if (controller.signal.aborted) return;
        const found = [...sources];
        const seen = new Set(found.map(({ provider, source }) => `${provider.id}:${source.id}:${source.version}`));
        const pages = [];
        const unavailable = [];
        results.forEach((entry, index) => {
            if (entry.status === "rejected") {
                unavailable.push(label(entry.reason));
                pages.push(sourcePages[index]);
                return;
            }
            const { provider, response } = entry.value;
            if (!Array.isArray(response) && response?.status && response.status !== "result" && response.status !== "partial") {
                unavailable.push(response.message || `${provider.id} is ${response.status}.`);
            }
            const items = Array.isArray(response) ? response : response?.sources;
            (Array.isArray(items) ? items : []).forEach((source) => {
                const key = `${provider.id}:${source.id}:${source.version}`;
                if (!seen.has(key)) { seen.add(key); found.push({ provider, source }); }
            });
            if (response?.nextAfter && response.nextAfter !== sourcePages[index].after) pages.push({ provider, after: response.nextAfter });
        });
        setSources(found);
        setSourcePages(pages);
        setSourceState({ status: unavailable.length || pages.length ? "partial" : "result", message: unavailable.join(" ") });
    };
    const completeSource = async ({ provider, source, described, authored, controller }) => {
        try {
            const checked = await provider.validate({ source: described, report: candidate, authored, signal: controller.signal });
            if (controller.signal.aborted) return;
            if (checked?.status === "denied" || checked?.status === "unavailable" || checked?.valid !== true) {
                setSourceState({ status: checked?.status || "error", message: checked?.message || "Source validation failed." }); return;
            }
            const selectionError = validateProviderSourceSelection(source, described, checked.dataset);
            if (selectionError) { setSourceState({ status: "error", message: selectionError }); return; }
            setPendingSourceAuthoring(null);
            if ((candidate.datasets || []).some((entry) => entry.id === checked.dataset.id)) {
                setPendingDatasetUpdate(checked.dataset);
                setSourceState({ status: "result", message: `${checked.dataset.id} is already declared. Review the source update.` });
                return;
            }
            const added = addEmbeddedDataset(candidate, checked.dataset);
            if (!added.valid) { setSourceState({ status: "error", message: added.error }); return; }
            acceptChange(added.report, { kind: "dataset.add", datasetId: checked.dataset.id });
            setSourceState({ status: "result", message: `${checked.dataset.id} added.` });
            setGeneration((value) => value + 1);
        } catch (error) { if (!controller.signal.aborted) setSourceState({ status: "error", message: label(error) }); }
    };
    const selectSource = async ({ provider, source }) => {
        requestRef.current?.abort();
        const controller = new AbortController(); requestRef.current = controller;
        setPendingSourceAuthoring(null);
        setSourceState({ status: "loading" });
        try {
            const described = await provider.describe({ id: source.id, version: source.version, signal: controller.signal });
            if (controller.signal.aborted) return;
            if (described?.status === "denied" || described?.status === "unavailable") {
                setSourceState({ status: described.status, message: described.message || "Source unavailable." }); return;
            }
            if (typeof provider.renderAuthoring === "function") {
                setPendingSourceAuthoring({ provider, source, described });
                setSourceState({ status: "result", message: "Declare the dataset and result contract before adding this source." });
                return;
            }
            await completeSource({ provider, source, described, controller });
        } catch (error) { if (!controller.signal.aborted) setSourceState({ status: "error", message: label(error) }); }
    };
    const submitSourceAuthoring = (authored) => {
        if (!pendingSourceAuthoring || effectiveReadOnly) return;
        requestRef.current?.abort();
        const controller = new AbortController(); requestRef.current = controller;
        setSourceState({ status: "loading" });
        void completeSource({ ...pendingSourceAuthoring, authored, controller });
    };
    const effectiveCatalog = datasets || catalog;
    const prepared = prepareEmbeddedReport(candidate, effectiveCatalog);
    const readOnlyTabs = effectiveReadOnly ? buildReportBuilderDesignSections(
        candidate.blocks.filter((block) => block.kind !== "reportBuilderBlock"),
        candidate.blocks.filter((block) => block.kind !== "reportBuilderBlock"),
    ).tabs : [];
    if (!prepared.valid) return <section role="status" className="forge-report-designer__unsupported">{prepared.reason}</section>;
    return <section className="forge-report-designer" aria-label="Report designer">
        <div className="forge-report-designer__host-actions">
            {dirty ? <span role="status">Unsaved changes</span> : null}
            {pendingHostReport ? <div role="alert">The host supplied a newer report. Your draft is retained.
                <button type="button" onClick={replaceFromHost}>Discard draft and load newer report</button>
                <button type="button" onClick={() => setPendingHostReport(null)}>Keep draft</button>
            </div> : null}
            {typeof onPreview === "function" ? <button type="button" disabled={operation.status === "loading"} onClick={() => invoke("preview", onPreview)}>Preview</button> : null}
            {typeof onRun === "function" ? <button type="button" disabled={operation.status === "loading"} onClick={() => invoke("run", onRun)}>Run</button> : null}
            {typeof onSave === "function" ? <button type="button" disabled={effectiveReadOnly || !dirty || operation.status === "loading"} onClick={() => invoke("save", onSave)}>Save</button> : null}
            {sourceProviders.length && capabilities.sourceManager !== false ? <button type="button" disabled={effectiveReadOnly || sourceState.status === "loading" || operation.status === "loading"} onClick={discover}>Find sources</button> : null}
            {operation.status === "loading" || sourceState.status === "loading" ? <button type="button" onClick={cancelRequest}>Cancel request</button> : null}
        </div>
        {pendingDatasetUpdate ? <div role="group" aria-label="Update dataset declaration">
            <span>Update {pendingDatasetUpdate.id} to source version {pendingDatasetUpdate.source.version}?</span>
            <button type="button" disabled={effectiveReadOnly} onClick={() => {
                const updated = replaceEmbeddedDataset(candidate, pendingDatasetUpdate);
                if (updated.valid) { acceptChange(updated.report, { kind: "dataset.update", datasetId: pendingDatasetUpdate.id }); setGeneration((value) => value + 1); }
                setPendingDatasetUpdate(null);
            }}>Update dataset</button>
            <button type="button" onClick={() => setPendingDatasetUpdate(null)}>Cancel update</button>
        </div> : null}
        {sourceState.status === "loading" ? <p role="status">Loading sources…</p> : null}
        {sourceState.message ? <p role={sourceState.status === "error" || sourceState.status === "denied" ? "alert" : "status"}>{sourceState.message}</p> : null}
        {sources.length ? <div className="forge-report-designer__sources" aria-label="Discovered sources">{sources.map(({ provider, source }) => (
            <button key={`${provider.id}:${source.id}:${source.version}`} type="button" disabled={effectiveReadOnly || source.status === "denied" || source.status === "unavailable"}
                onClick={() => selectSource({ provider, source })}>{source.display?.label || source.id} · {source.version}{source.status && source.status !== "available" ? ` · ${source.status}` : ""}</button>
        ))}</div> : null}
        {sourcePages.length ? <button type="button" disabled={effectiveReadOnly || sourceState.status === "loading"}
            onClick={loadMoreSources}>Load more sources</button> : null}
        {pendingSourceAuthoring ? <div role="group" aria-label="Author source dataset" className="forge-report-designer__source-authoring">
            {pendingSourceAuthoring.provider.renderAuthoring({ source: pendingSourceAuthoring.described,
                onSubmit: submitSourceAuthoring, onCancel: () => setPendingSourceAuthoring(null),
                disabled: effectiveReadOnly || sourceState.status === "loading" })}
        </div> : null}
        {effectiveReadOnly && (candidate.datasets || []).length ? <details className="forge-report-designer__declared-sources">
            <summary>Declared sources ({candidate.datasets.length})</summary>
            <ul>{candidate.datasets.map((dataset) => <li key={dataset.id}>{dataset.label || dataset.id} · {dataset.dataSourceRef || "Source unavailable"}</li>)}</ul>
        </details> : null}
        {effectiveReadOnly && readOnlyTabs.length > 1 ? <SectionTabRail items={readOnlyTabs} selectedId={readOnlySectionId || readOnlyTabs[0].id}
            onChange={setReadOnlySectionId} ariaLabel="Read-only report tabs" /> : null}
        <EmbeddedDesignWorkspace key={`${candidate.id}:${generation}`} report={candidate} catalog={effectiveCatalog}
            capabilities={{ ...capabilities, sourceManager: capabilities.embeddedSourceManager ?? capabilities.sourceManager }} readOnly={effectiveReadOnly}
            selectedSectionId={readOnlySectionId} onChange={acceptChange} onEditorDraftChange={setActiveEditorDraft} />
        {operation.status === "loading" ? <p role="status">{operation.kind} in progress…</p> : null}
        {["error", "conflict", "denied", "unavailable"].includes(operation.status) ? <p role="alert">{operation.message || `${operation.kind} ${operation.status}.`}</p> : null}
        {operation.status === "partial" ? <p role="status">Partial result. Some datasets are still unavailable.</p> : null}
        {operation.kind === "save" && operation.status === "result" ? <p role="status">{operation.report ? "Saved." : "Save accepted. Waiting for the host revision."}</p> : null}
        {actionable(operation.status) && operation.reportSpec && operation.reportFill ? <ReportRuntime
            reportSpec={operation.reportSpec} reportFill={operation.reportFill} reportDocument={operation.reportDocument || candidate}
            presentationMode="preview" showContextSummary={false} /> : null}
    </section>;
}

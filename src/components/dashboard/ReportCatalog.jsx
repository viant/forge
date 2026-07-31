import React, {useCallback, useEffect, useMemo, useState} from "react";
import {
    Button,
    Dialog,
    DialogBody,
    DialogFooter,
    Icon,
    Menu,
    MenuItem,
    Popover,
    Spinner,
    Tag,
} from "@blueprintjs/core";
import {
    buildReportBuilderExportArtifactDownload,
    isReportBuilderExportJobTerminal,
    normalizeReportBuilderExportArtifact,
    normalizeReportBuilderExportJob,
} from "./reportBuilderExportLifecycle.js";
import "./ReportCatalog.css";

const SCOPES = [
    { id: "order", label: "Current order", icon: "layers" },
    { id: "all", label: "All my reports", icon: "folder-open" },
    { id: "presets", label: "Built-in presets", icon: "layout-auto" },
];

function normalizeString(value = "") {
    return String(value || "").trim();
}

function normalizeOrderId(value = "") {
    if (Array.isArray(value)) {
        return normalizeOrderId(value[0]);
    }
    return normalizeString(value);
}

function normalizeReports(value = null) {
    const reports = Array.isArray(value) ? value : (Array.isArray(value?.reports) ? value.reports : []);
    return reports
        .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
        .map((entry) => ({
            ...entry,
            artifactId: normalizeString(entry.artifactId),
            reportId: normalizeString(entry.reportId),
            title: normalizeString(entry.title || entry.reportId || "Untitled report") || "Untitled report",
            ownerId: normalizeString(entry.ownerId),
            reportType: normalizeString(entry.reportType || "Saved report") || "Saved report",
            builderRef: normalizeString(entry.builderRef || "metricsCubeBuilder") || "metricsCubeBuilder",
            orderIds: (Array.isArray(entry.orderIds) ? entry.orderIds : []).map(normalizeString).filter(Boolean),
            defaultFrom: normalizeString(entry.defaultFrom),
            defaultTo: normalizeString(entry.defaultTo),
            createdAt: normalizeString(entry.createdAt),
            updatedAt: normalizeString(entry.updatedAt),
            lastRunAt: normalizeString(entry.lastRunAt),
            sourceKind: "report",
        }))
        .filter((entry) => entry.reportId && entry.artifactId);
}

function normalizePresets(value = [], defaultBuilderWindow = "metricReportBuilder") {
    return (Array.isArray(value) ? value : [])
        .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
        .map((entry) => ({
            id: normalizeString(entry.id),
            reportId: normalizeString(entry.id),
            title: normalizeString(entry.label || entry.title || entry.id),
            description: normalizeString(entry.description),
            reportType: normalizeString(entry.reportType || "Built-in preset"),
            builderWindow: normalizeString(entry.builderWindow || defaultBuilderWindow) || defaultBuilderWindow,
            sourceKind: "preset",
        }))
        .filter((entry) => entry.id && entry.title);
}

function formatDate(value = "", { relative = false } = {}) {
    const timestamp = Date.parse(normalizeString(value));
    if (!Number.isFinite(timestamp)) {
        return "Not yet";
    }
    if (relative) {
        const delta = Date.now() - timestamp;
        const minutes = Math.round(delta / 60000);
        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.round(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.round(hours / 24);
        if (days < 30) return `${days}d ago`;
    }
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(new Date(timestamp));
}

function dateRangeLabel(report = {}) {
    if (report.defaultFrom && report.defaultTo) {
        return `${report.defaultFrom} → ${report.defaultTo}`;
    }
    return "Uses report defaults";
}

function reportMatchesOrder(report = {}, orderId = "") {
    const normalized = normalizeOrderId(orderId);
    return !!normalized && report.orderIds.some((candidate) => candidate === normalized);
}

function resolveBuilderWindow(report = {}, config = {}) {
    return normalizeString(
        report.builderWindow
        || config.builderWindowByRef?.[report.builderRef]
        || config.defaultBuilderWindow
        || "metricReportBuilder",
    ) || "metricReportBuilder";
}

function reportEntryKey(report = {}) {
    return `${normalizeString(report.sourceKind || "report")}:${normalizeString(report.artifactId || report.reportId || report.id)}`;
}

function buildTemporaryRunDefinition(storedReport = {}, report = {}, {
    from = "",
    to = "",
    orderId = "",
} = {}) {
    const source = storedReport?.document && typeof storedReport.document === "object" && !Array.isArray(storedReport.document)
        ? JSON.parse(JSON.stringify(storedReport.document))
        : null;
    if (!source) {
        throw new Error("The saved report does not contain an editable report document.");
    }
    const normalizedOrderId = Number(orderId);
    const params = Array.isArray(source?.scope?.params) ? source.scope.params : [];
    source.scope = {
        ...(source.scope || {}),
        params: params.map((param) => {
            const id = normalizeString(param?.id);
            if (id === "dateRange") {
                return { ...param, value: { start: from, end: to } };
            }
            if (id === "orderIds" && Number.isFinite(normalizedOrderId) && normalizedOrderId > 0) {
                return { ...param, value: [normalizedOrderId] };
            }
            return param;
        }),
    };
    const baseId = normalizeString(report.reportId || storedReport.reportId || "saved-report");
    return {
        id: `${baseId}-temporary-run`,
        reportId: `${baseId}-temporary-run`,
        grammar: "report-document-v1",
        status: "ready",
        source,
    };
}

function downloadArtifact(artifact = null, title = "") {
    const descriptor = buildReportBuilderExportArtifactDownload(artifact, { title, format: "pdf" });
    if (!descriptor) {
        throw new Error("The export completed without downloadable PDF bytes.");
    }
    const blob = new Blob([descriptor.bytes], { type: descriptor.mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = descriptor.filename;
    document.body.appendChild(anchor);
    anchor.click();
    window.setTimeout(() => {
        anchor.remove();
        URL.revokeObjectURL(url);
    }, 1000);
}

function ReportCard({
    report,
    currentOrderId,
    busyAction,
    onOpen,
    onRun,
    onRunRange,
    onEdit,
    onDuplicate,
    onRename,
    onExport,
    onDelete,
}) {
    const isPreset = report.sourceKind === "preset";
    const orderLabel = isPreset
        ? "Reusable starter"
        : (report.orderIds.length > 0 ? report.orderIds.map((id) => `Order ${id}`).join(", ") : "Cross-order report");
    return (
        <article className="forge-report-catalog-card">
            <div className="forge-report-catalog-card__accent" />
            <div className="forge-report-catalog-card__header">
                <div className="forge-report-catalog-card__icon">
                    <Icon icon={isPreset ? "layout-auto" : "document"} size={20} />
                </div>
                <div className="forge-report-catalog-card__identity">
                    <h3>{report.title}</h3>
                    <div className="forge-report-catalog-card__tags">
                        <Tag minimal intent={isPreset ? "primary" : "success"}>{report.reportType}</Tag>
                        {!isPreset && reportMatchesOrder(report, currentOrderId) ? (
                            <Tag minimal intent="primary">Current order</Tag>
                        ) : null}
                    </div>
                </div>
                <Popover
                    placement="bottom-end"
                    content={(
                        <Menu>
                            {!isPreset ? <MenuItem icon="edit" text="Rename" onClick={() => onRename(report)} /> : null}
                            <MenuItem icon="duplicate" text={isPreset ? "Use as new report" : "Duplicate"} onClick={() => onDuplicate(report)} />
                            {!isPreset ? <MenuItem icon="calendar" text="Run for another date range" onClick={() => onRunRange(report)} /> : null}
                            <MenuItem icon="download" text="Export PDF" onClick={() => onExport(report)} />
                            {!isPreset ? <MenuItem intent="danger" icon="trash" text="Delete report" onClick={() => onDelete(report)} /> : null}
                        </Menu>
                    )}
                >
                    <Button minimal icon="more" aria-label={`More actions for ${report.title}`} />
                </Popover>
            </div>

            {report.description ? <p className="forge-report-catalog-card__description">{report.description}</p> : null}

            <div className="forge-report-catalog-card__scope">
                <Icon icon="layer" size={14} />
                <span>{orderLabel}</span>
            </div>

            <dl className="forge-report-catalog-card__metadata">
                <div>
                    <dt>Saved</dt>
                    <dd>{isPreset ? "Built in" : formatDate(report.updatedAt || report.createdAt)}</dd>
                </div>
                <div>
                    <dt>Last run</dt>
                    <dd>{isPreset ? "On demand" : formatDate(report.lastRunAt, { relative: true })}</dd>
                </div>
                <div>
                    <dt>Date range</dt>
                    <dd>{isPreset ? "Choose when running" : dateRangeLabel(report)}</dd>
                </div>
                <div>
                    <dt>Owner</dt>
                    <dd>{isPreset ? "Steward" : (report.ownerId || "You")}</dd>
                </div>
            </dl>

            <div className="forge-report-catalog-card__actions">
                <Button
                    intent="primary"
                    icon="play"
                    loading={busyAction === `${reportEntryKey(report)}:run`}
                    onClick={() => onRun(report)}
                >
                    Run
                </Button>
                <Button icon="folder-open" onClick={() => onOpen(report)}>
                    Open
                </Button>
                <Button minimal icon="edit" onClick={() => onEdit(report)}>
                    {isPreset ? "Customize" : "Edit"}
                </Button>
            </div>
        </article>
    );
}

export default function ReportCatalog({container, context}) {
    const config = container?.dashboard?.reportCatalog || container?.reportCatalog || {};
    const reportStore = context?.handlers?.reportStore || null;
    const reportExport = context?.handlers?.reportExport || null;
    const windowHandler = context?.handlers?.window || null;
    const windowParameters = context?.windowState?.parameters || context?._globalServices?.windowState?.parameters || {};
    const currentOrderId = normalizeOrderId(
        windowParameters.orderId
        || windowParameters.AdOrderId
        || windowParameters.orderIds
        || windowParameters.adOrderId,
    );
    const presets = useMemo(
        () => normalizePresets(config.presets, config.defaultBuilderWindow),
        [config.defaultBuilderWindow, config.presets],
    );
    const [scope, setScope] = useState(currentOrderId ? "order" : "all");
    const [query, setQuery] = useState("");
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [feedback, setFeedback] = useState(null);
    const [busyAction, setBusyAction] = useState("");
    const [renameTarget, setRenameTarget] = useState(null);
    const [renameValue, setRenameValue] = useState("");
    const [rangeTarget, setRangeTarget] = useState(null);
    const [rangeFrom, setRangeFrom] = useState("");
    const [rangeTo, setRangeTo] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);

    const loadReports = useCallback(async ({ silent = false } = {}) => {
        if (typeof reportStore?.listReports !== "function") {
            setError("Saved reports are unavailable in this workspace.");
            setLoading(false);
            return;
        }
        if (!silent) setLoading(true);
        try {
            const result = await reportStore.listReports({ limit: 0 });
            setReports(normalizeReports(result));
            setError("");
        } catch (loadError) {
            setError(loadError?.message || "Could not load saved reports.");
        } finally {
            setLoading(false);
        }
    }, [reportStore]);

    useEffect(() => {
        loadReports();
    }, [loadReports]);

    useEffect(() => {
        const refresh = () => loadReports({ silent: true });
        globalThis.addEventListener?.("agently:report-store-changed", refresh);
        return () => globalThis.removeEventListener?.("agently:report-store-changed", refresh);
    }, [loadReports]);

    const entries = useMemo(() => {
        const source = scope === "presets"
            ? presets
            : (scope === "order" ? reports.filter((report) => reportMatchesOrder(report, currentOrderId)) : reports);
        const normalizedQuery = normalizeString(query).toLowerCase();
        if (!normalizedQuery) return source;
        return source.filter((entry) => [
            entry.title,
            entry.description,
            entry.reportType,
            ...(entry.orderIds || []),
        ].join(" ").toLowerCase().includes(normalizedQuery));
    }, [currentOrderId, presets, query, reports, scope]);

    const openBuilder = useCallback((report, {
        mode = "result",
        executeOnOpen = false,
        from = "",
        to = "",
        newInstance = false,
        reportDefinition = null,
    } = {}) => {
        if (typeof windowHandler?.openWindow !== "function") {
            setFeedback({ intent: "danger", message: "The report builder window is unavailable." });
            return;
        }
        const builderWindow = resolveBuilderWindow(report, config);
        const isPreset = report.sourceKind === "preset";
        const isInline = !!reportDefinition;
        const prefill = {
            ...(currentOrderId ? { orderId: Number(currentOrderId), orderIds: [Number(currentOrderId)] } : {}),
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
        };
        const parameters = {
            sourceKind: isInline ? "inline" : (isPreset ? "preset" : "report"),
            sourceId: isInline
                ? normalizeString(reportDefinition.reportId || reportDefinition.id)
                : report.reportId,
            ...(isInline
                ? { reportDefinition }
                : (isPreset ? { reportStarterId: report.reportId } : { reportId: report.reportId })),
            mode,
            executeOnOpen,
            ...prefill,
            ...(Object.keys(prefill).length > 0 ? { prefill } : {}),
            ...(!isPreset && !isInline && Object.keys(prefill).length > 0 ? {
                runOverride: prefill,
                ...(from ? { runFrom: from } : {}),
                ...(to ? { runTo: to } : {}),
                ...(prefill.orderIds ? { runOrderIds: prefill.orderIds } : {}),
            } : {}),
        };
        windowHandler.openWindow({
            execution: {
                args: [
                    builderWindow,
                    report.title,
                    "",
                    true,
                    {
                        presentation: "hosted",
                        region: "chat.top",
                        replaceHostedRegion: true,
                        newInstance,
                        conversationId: context?.windowState?.conversationId,
                    },
                ],
            },
            parameters,
            context,
        });
    }, [config, context, currentOrderId, windowHandler]);

    const renameReport = useCallback(async () => {
        if (!renameTarget || typeof reportStore?.updateReport !== "function") return;
        const title = normalizeString(renameValue);
        if (!title) return;
        const key = `${reportEntryKey(renameTarget)}:rename`;
        setBusyAction(key);
        try {
            await reportStore.updateReport({ artifactId: renameTarget.artifactId, title });
            setRenameTarget(null);
            setFeedback({ intent: "success", message: `Renamed report to ${title}.` });
            await loadReports({ silent: true });
        } catch (renameError) {
            setFeedback({ intent: "danger", message: renameError?.message || "Could not rename the report." });
        } finally {
            setBusyAction("");
        }
    }, [loadReports, renameTarget, renameValue, reportStore]);

    const duplicateReport = useCallback(async (report) => {
        if (report.sourceKind === "preset") {
            openBuilder(report, { mode: "design", executeOnOpen: false });
            return;
        }
        if (typeof reportStore?.duplicateReport !== "function") {
            setFeedback({ intent: "danger", message: "Report duplication is unavailable." });
            return;
        }
        const key = `${reportEntryKey(report)}:duplicate`;
        setBusyAction(key);
        try {
            const duplicated = await reportStore.duplicateReport({ artifactId: report.artifactId });
            setFeedback({ intent: "success", message: `Created ${duplicated?.title || `Copy of ${report.title}`}.` });
            await loadReports({ silent: true });
        } catch (duplicateError) {
            setFeedback({ intent: "danger", message: duplicateError?.message || "Could not duplicate the report." });
        } finally {
            setBusyAction("");
        }
    }, [loadReports, openBuilder, reportStore]);

    const deleteReport = useCallback(async () => {
        if (!deleteTarget || typeof reportStore?.deleteReport !== "function") return;
        const key = `${reportEntryKey(deleteTarget)}:delete`;
        setBusyAction(key);
        try {
            await reportStore.deleteReport({ artifactId: deleteTarget.artifactId });
            setDeleteTarget(null);
            setFeedback({ intent: "success", message: `Deleted ${deleteTarget.title}.` });
            await loadReports({ silent: true });
        } catch (deleteError) {
            setFeedback({ intent: "danger", message: deleteError?.message || "Could not delete the report." });
        } finally {
            setBusyAction("");
        }
    }, [deleteTarget, loadReports, reportStore]);

    const exportReport = useCallback(async (report) => {
        if (report.sourceKind === "preset") {
            openBuilder(report, { mode: "result", executeOnOpen: true });
            setFeedback({ intent: "primary", message: "Run the preset first, then export its generated report." });
            return;
        }
        if (typeof reportExport?.submitSource !== "function") {
            setFeedback({ intent: "danger", message: "Saved-report export is unavailable." });
            return;
        }
        const key = `${reportEntryKey(report)}:export`;
        setBusyAction(key);
        try {
            let job = normalizeReportBuilderExportJob(await reportExport.submitSource({
                source: { kind: "report", reportId: report.reportId },
                format: "pdf",
                conversationId: context?.windowState?.conversationId,
                workspaceId: resolveBuilderWindow(report, config),
            }));
            if (!job) throw new Error("The export service did not return a job.");
            const deadline = Date.now() + 90000;
            while (!isReportBuilderExportJobTerminal(job) && Date.now() < deadline) {
                await new Promise((resolve) => window.setTimeout(resolve, 750));
                job = normalizeReportBuilderExportJob(await reportExport.getStatus({ jobId: job.jobId }));
            }
            if (job?.status !== "succeeded" || !job.artifactId) {
                throw new Error(job?.error || "The PDF export did not complete.");
            }
            const artifact = normalizeReportBuilderExportArtifact(await reportExport.getArtifact({ artifactId: job.artifactId }));
            downloadArtifact(artifact, report.title);
            setFeedback({ intent: "success", message: `Exported ${report.title} as PDF.` });
        } catch (exportError) {
            setFeedback({ intent: "danger", message: exportError?.message || "Could not export the report." });
        } finally {
            setBusyAction("");
        }
    }, [config, context?.windowState?.conversationId, openBuilder, reportExport]);

    const runRange = useCallback(async () => {
        if (!rangeTarget || !rangeFrom || !rangeTo) return;
        if (typeof reportStore?.getReport !== "function") {
            setFeedback({ intent: "danger", message: "Saved-report retrieval is unavailable." });
            return;
        }
        const target = rangeTarget;
        const key = `${reportEntryKey(target)}:run-range`;
        setBusyAction(key);
        try {
            const storedReport = await reportStore.getReport({ artifactId: target.artifactId });
            const reportDefinition = buildTemporaryRunDefinition(storedReport, target, {
                from: rangeFrom,
                to: rangeTo,
                orderId: currentOrderId,
            });
            openBuilder(target, {
                mode: "result",
                executeOnOpen: true,
                newInstance: true,
                reportDefinition,
            });
            setRangeTarget(null);
        } catch (runError) {
            setFeedback({ intent: "danger", message: runError?.message || "Could not run the saved report for that date range." });
        } finally {
            setBusyAction("");
        }
    }, [currentOrderId, openBuilder, rangeFrom, rangeTarget, rangeTo, reportStore]);

    const emptyTitle = scope === "order"
        ? `No saved reports for order ${currentOrderId || ""}`.trim()
        : (scope === "presets" ? "No built-in presets are configured" : "No saved reports yet");

    return (
        <section className="forge-report-catalog">
            <header className="forge-report-catalog__hero">
                <div className="forge-report-catalog__hero-icon"><Icon icon="projects" size={24} /></div>
                <div>
                    <p className="forge-report-catalog__eyebrow">REPORT LIBRARY</p>
                    <h2>{currentOrderId ? `Reports for order ${currentOrderId}` : "My reports"}</h2>
                    <p>Open, rerun, edit, export, and organize reusable reports without leaving the order workspace.</p>
                </div>
                <div className="forge-report-catalog__hero-stat">
                    <strong>{scope === "presets" ? presets.length : reports.length}</strong>
                    <span>{scope === "presets" ? "presets" : "saved reports"}</span>
                </div>
            </header>

            <div className="forge-report-catalog__toolbar">
                <div className="forge-report-catalog__scopes" role="tablist" aria-label="Report catalog scope">
                    {SCOPES.map((entry) => (
                        <button
                            key={entry.id}
                            type="button"
                            role="tab"
                            aria-selected={scope === entry.id}
                            className={scope === entry.id ? "is-active" : ""}
                            disabled={entry.id === "order" && !currentOrderId}
                            onClick={() => setScope(entry.id)}
                        >
                            <Icon icon={entry.icon} size={15} />
                            <span>{entry.label}</span>
                            {entry.id === "order" && currentOrderId ? (
                                <span className="forge-report-catalog__scope-count">
                                    {reports.filter((report) => reportMatchesOrder(report, currentOrderId)).length}
                                </span>
                            ) : null}
                        </button>
                    ))}
                </div>
                <label className="forge-report-catalog__search">
                    <Icon icon="search" size={16} />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search reports"
                        aria-label="Search reports"
                    />
                </label>
                <Button icon="refresh" minimal onClick={() => loadReports()} loading={loading}>Refresh</Button>
            </div>

            {feedback ? (
                <div className={`forge-report-catalog__feedback is-${feedback.intent || "primary"}`}>
                    <Icon icon={feedback.intent === "danger" ? "error" : "tick-circle"} size={16} />
                    <span>{feedback.message}</span>
                    <Button minimal small icon="cross" aria-label="Dismiss" onClick={() => setFeedback(null)} />
                </div>
            ) : null}

            {error ? <div className="forge-report-catalog__error"><Icon icon="error" />{error}</div> : null}

            {loading && reports.length === 0 ? (
                <div className="forge-report-catalog__loading"><Spinner size={28} /><span>Loading report library…</span></div>
            ) : entries.length === 0 ? (
                <div className="forge-report-catalog__empty">
                    <div className="forge-report-catalog__empty-icon"><Icon icon="folder-new" size={26} /></div>
                    <h3>{emptyTitle}</h3>
                    <p>{scope === "order" ? "Build or save a report for this order and it will appear here immediately." : "Adjust the scope or create a new report in the report builder."}</p>
                    <Button
                        intent="primary"
                        icon="plus"
                        onClick={() => openBuilder({
                            sourceKind: "preset",
                            reportId: config.defaultPresetId || presets[0]?.id || "",
                            title: "New performance report",
                            builderWindow: config.defaultBuilderWindow,
                        }, { mode: "design", executeOnOpen: false })}
                    >
                        Build a report
                    </Button>
                </div>
            ) : (
                <div className="forge-report-catalog__grid">
                    {entries.map((report) => (
                        <ReportCard
                            key={reportEntryKey(report)}
                            report={report}
                            currentOrderId={currentOrderId}
                            busyAction={busyAction}
                            onOpen={(entry) => openBuilder(entry, { mode: "result", executeOnOpen: false })}
                            onRun={(entry) => openBuilder(entry, { mode: "result", executeOnOpen: true })}
                            onEdit={(entry) => openBuilder(entry, { mode: "design", executeOnOpen: false })}
                            onRunRange={(entry) => {
                                setRangeTarget(entry);
                                setRangeFrom(entry.defaultFrom || "");
                                setRangeTo(entry.defaultTo || "");
                            }}
                            onDuplicate={duplicateReport}
                            onRename={(entry) => {
                                setRenameTarget(entry);
                                setRenameValue(entry.title);
                            }}
                            onExport={exportReport}
                            onDelete={setDeleteTarget}
                        />
                    ))}
                </div>
            )}

            <Dialog isOpen={!!renameTarget} onClose={() => setRenameTarget(null)} title="Rename report" icon="edit">
                <DialogBody>
                    <label className="forge-report-catalog__field">
                        <span>Report name</span>
                        <input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus />
                    </label>
                </DialogBody>
                <DialogFooter
                    actions={(
                        <>
                            <Button onClick={() => setRenameTarget(null)}>Cancel</Button>
                            <Button intent="primary" onClick={renameReport} disabled={!normalizeString(renameValue)}>Rename</Button>
                        </>
                    )}
                />
            </Dialog>

            <Dialog isOpen={!!rangeTarget} onClose={() => setRangeTarget(null)} title="Run for another date range" icon="calendar">
                <DialogBody>
                    <p className="forge-report-catalog__dialog-copy">This run uses a temporary date override and does not change the saved report defaults.</p>
                    <div className="forge-report-catalog__date-fields">
                        <label className="forge-report-catalog__field"><span>From</span><input type="date" value={rangeFrom} onChange={(event) => setRangeFrom(event.target.value)} /></label>
                        <label className="forge-report-catalog__field"><span>To</span><input type="date" value={rangeTo} onChange={(event) => setRangeTo(event.target.value)} /></label>
                    </div>
                </DialogBody>
                <DialogFooter
                    actions={(
                        <>
                            <Button onClick={() => setRangeTarget(null)}>Cancel</Button>
                            <Button intent="primary" icon="play" onClick={runRange} disabled={!rangeFrom || !rangeTo || rangeFrom > rangeTo}>Run report</Button>
                        </>
                    )}
                />
            </Dialog>

            <Dialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete saved report?" icon="trash">
                <DialogBody>
                    <div className="forge-report-catalog__delete-warning">
                        <Icon icon="warning-sign" intent="danger" size={22} />
                        <div>
                            <strong>{deleteTarget?.title}</strong>
                            <p>This permanently removes the user-defined report. Built-in presets are never affected.</p>
                        </div>
                    </div>
                </DialogBody>
                <DialogFooter
                    actions={(
                        <>
                            <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
                            <Button intent="danger" icon="trash" onClick={deleteReport}>Delete report</Button>
                        </>
                    )}
                />
            </Dialog>
        </section>
    );
}

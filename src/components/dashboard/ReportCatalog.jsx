import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
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
import {
    buildReportCatalogPageItems,
    normalizeReportCatalogPageSize,
    paginateReportCatalogEntries,
} from "./reportCatalogPagination.js";
import {
    buildReportCatalogListRequest,
    formatReportCatalogDate,
    buildReportCatalogMutationRequest,
    buildReportCatalogResourceRequest,
    filterReportCatalogResources,
    normalizeReportCatalogResources,
    readReportCatalogResource,
} from "./reportCatalogResources.js";
import { REPORT_STORE_CHANGED_EVENT } from "./reportBuilderHostServices.js";
import "./ReportCatalog.css";

const SCOPES = [
    { id: "order", label: "Current order", icon: "layers" },
    { id: "all", label: "All reports", icon: "folder-open" },
    { id: "user", label: "Current user", icon: "person" },
];
const DEFAULT_PAGE_SIZE_OPTIONS = [20, 50, 100];

function normalizeString(value = "") {
    return String(value || "").trim();
}

function normalizeOrderId(value = "") {
    if (Array.isArray(value)) {
        return normalizeOrderId(value[0]);
    }
    return normalizeString(value);
}

function formatDate(value, options) {return formatReportCatalogDate(value,options);}

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
    return report.resourceUri;
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

export function ReportCard({
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
    const capabilities = report.capabilities || {};
    const orderLabel = report.orderIds.length > 0
        ? report.orderIds.map((id) => `Order ${id}`).join(", ") : "Cross-order report";
    const hasMenuActions = ["rename", "duplicate", "runRange", "export", "delete"].some((action) => capabilities[action]);
    return (
        <article className="forge-report-catalog-card">
            <div className="forge-report-catalog-card__accent" />
            <div className="forge-report-catalog-card__header">
                <div className="forge-report-catalog-card__icon">
                    <Icon icon="document" size={20} />
                </div>
                <div className="forge-report-catalog-card__identity">
                    <h3>{report.title}</h3>
                    <div className="forge-report-catalog-card__tags">
                        <Tag minimal>{report.namespace}</Tag>
                        {reportMatchesOrder(report, currentOrderId) ? (
                            <Tag minimal intent="primary">Current order</Tag>
                        ) : null}
                    </div>
                </div>
                {hasMenuActions ? <Popover
                    placement="bottom-end"
                    content={(
                        <Menu>
                            {capabilities.rename ? <MenuItem icon="edit" text="Rename" onClick={() => onRename(report)} /> : null}
                            {capabilities.duplicate ? <MenuItem icon="duplicate" text="Duplicate" onClick={() => onDuplicate(report)} /> : null}
                            {capabilities.runRange ? <MenuItem icon="calendar" text="Run for another date range" onClick={() => onRunRange(report)} /> : null}
                            {capabilities.export ? <MenuItem icon="download" text="Export PDF" onClick={() => onExport(report)} /> : null}
                            {capabilities.delete ? <MenuItem intent="danger" icon="trash" text="Delete report" onClick={() => onDelete(report)} /> : null}
                        </Menu>
                    )}
                >
                    <Button minimal icon="more" aria-label={`More actions for ${report.title}`} />
                </Popover> : null}
            </div>

            {report.description ? <p className="forge-report-catalog-card__description">{report.description}</p> : null}

            <div className="forge-report-catalog-card__scope">
                <Icon icon="layer" size={14} />
                <span>{orderLabel}</span>
            </div>

            <dl className="forge-report-catalog-card__metadata">
                <div>
                    <dt>Updated</dt>
                    <dd>{formatDate(report.updatedAt || report.createdAt)}</dd>
                </div>
                <div>
                    <dt>Last run</dt>
                    <dd>{formatDate(report.lastRunAt, { relative: true })}</dd>
                </div>
                <div>
                    <dt>Date range</dt>
                    <dd>{dateRangeLabel(report)}</dd>
                </div>
                <div>
                    <dt>Owner</dt>
                    <dd>{report.ownerId || "Not specified"}</dd>
                </div>
            </dl>

            <div className="forge-report-catalog-card__actions">
                <Button
                    intent="primary"
                    icon="play"
                    loading={busyAction === `${reportEntryKey(report)}:run`}
                    disabled={!capabilities.run}
                    onClick={() => onRun(report)}
                >
                    Run
                </Button>
                <Button icon="folder-open" disabled={!capabilities.open} onClick={() => onOpen(report)}>
                    Open
                </Button>
                <Button minimal icon="edit" disabled={!capabilities.edit} onClick={() => onEdit(report)}>
                    Edit
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
    const pageSizeOptions = useMemo(() => {
        const configured = Array.isArray(config.pageSizeOptions) ? config.pageSizeOptions : DEFAULT_PAGE_SIZE_OPTIONS;
        const normalized = configured
            .map((entry) => Number(entry))
            .filter((entry, index, source) => Number.isInteger(entry) && entry > 0 && source.indexOf(entry) === index)
            .sort((left, right) => left - right);
        return normalized.length > 0 ? normalized : DEFAULT_PAGE_SIZE_OPTIONS;
    }, [config.pageSizeOptions]);
    const catalogRef = useRef(null);
    const loadSequence = useRef(0);
    const [scope, setScope] = useState(currentOrderId ? "order" : "all");
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(() => normalizeReportCatalogPageSize(
        config.defaultPageSize,
        pageSizeOptions,
    ));
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
        const sequence = ++loadSequence.current;
        if (typeof reportStore?.listReports !== "function") {
            setError("Reports are unavailable in this workspace.");
            setLoading(false);
            return;
        }
        if (!silent) setLoading(true);
        try {
            const result = await reportStore.listReports(buildReportCatalogListRequest(scope));
            if (sequence !== loadSequence.current) return;
            setReports(normalizeReportCatalogResources(result));
            setError("");
        } catch (loadError) {
            if (sequence !== loadSequence.current) return;
            setReports([]);
            setError(loadError?.message || "Could not load reports. Try Refresh.");
        } finally {
            if (sequence === loadSequence.current) setLoading(false);
        }
    }, [reportStore, scope]);

    useEffect(() => {
        loadReports();
    }, [loadReports]);

    useEffect(() => {
        const refresh = () => loadReports({ silent: true });
        globalThis.addEventListener?.(REPORT_STORE_CHANGED_EVENT, refresh);
        return () => globalThis.removeEventListener?.(REPORT_STORE_CHANGED_EVENT, refresh);
    }, [loadReports]);

    const entries = useMemo(() => filterReportCatalogResources(reports, {
        scope, orderId: currentOrderId, query,
    }), [currentOrderId, query, reports, scope]);
    const pagination = useMemo(
        () => paginateReportCatalogEntries(entries, page, pageSize),
        [entries, page, pageSize],
    );
    const pageItems = useMemo(
        () => buildReportCatalogPageItems(pagination.currentPage, pagination.totalPages),
        [pagination.currentPage, pagination.totalPages],
    );

    useEffect(() => {
        setPage(1);
    }, [query, scope]);

    useEffect(() => {
        if (page !== pagination.currentPage) {
            setPage(pagination.currentPage);
        }
    }, [page, pagination.currentPage]);

    useEffect(() => {
        const target = catalogRef.current;
        if (!target || typeof target.scrollTo !== "function") return;
        target.scrollTo({ top: 0, behavior: "smooth" });
    }, [pagination.currentPage, pageSize, query, scope]);

    const selectPage = useCallback((nextPage) => {
        const normalized = Math.min(pagination.totalPages, Math.max(1, Number(nextPage) || 1));
        setPage(normalized);
    }, [pagination.totalPages]);

    const selectPageSize = useCallback((event) => {
        setPageSize(normalizeReportCatalogPageSize(event.currentTarget.value, pageSizeOptions));
        setPage(1);
    }, [pageSizeOptions]);

    const openBuilder = useCallback(async (report, {
        mode = "result",
        executeOnOpen = false,
        from = "",
        to = "",
        newInstance = false,
    } = {}) => {
        const action = from || to ? "runRange" : (executeOnOpen ? "run" : (mode === "design" ? "edit" : "open"));
        if (!report.capabilities[action]) return;
        if (typeof windowHandler?.openTarget !== "function") {
            setFeedback({ intent: "danger", message: "The report builder window is unavailable." });
            return;
        }
        const key = `${reportEntryKey(report)}:${action}`;
        setBusyAction(key);
        try {
            report = await readReportCatalogResource(report, reportStore);
            const builderWindow = resolveBuilderWindow(report, config);
            const prefill = {
                ...(from ? { from } : {}),
                ...(to ? { to } : {}),
            };
            const parameters = {
                ...buildReportCatalogResourceRequest(report),
                ...(report.resource ? { reportResource: report.resource } : {}),
                sourceKind: "report",
                sourceId: report.resourceUri,
                reportId: report.resourceUri,
                reportTitle: report.title,
                reportCapabilities: report.capabilities,
                mode,
                executeOnOpen,
                ...prefill,
                ...(Object.keys(prefill).length > 0 ? { prefill } : {}),
                ...(Object.keys(prefill).length > 0 ? {
                    runOverride: prefill,
                    ...(from ? { runFrom: from } : {}),
                    ...(to ? { runTo: to } : {}),
                    ...(prefill.orderIds ? { runOrderIds: prefill.orderIds } : {}),
                } : {}),
            };
            await windowHandler.openTarget({
                target: {
                    kind: "window",
                    windowKey: builderWindow,
                    windowTitle: report.title,
                    presentation: "hosted",
                    region: "chat.top",
                    replaceHostedRegion: true,
                    newInstance,
                    conversationId: context?.windowState?.conversationId,
                    parameters,
                },
                context,
            });
        } catch (openError) {
            setFeedback({ intent: "danger", message: openError?.message || "Could not open the report. Refresh and try again." });
        } finally {
            setBusyAction("");
        }
    }, [config, context, currentOrderId, reportStore, windowHandler]);

    const renameReport = useCallback(async () => {
        if (!renameTarget?.capabilities.rename || typeof reportStore?.updateReport !== "function") return;
        const title = normalizeString(renameValue);
        if (!title) return;
        const key = `${reportEntryKey(renameTarget)}:rename`;
        setBusyAction(key);
        try {
            const selected = await readReportCatalogResource(renameTarget, reportStore);
            await reportStore.updateReport({ ...buildReportCatalogMutationRequest(selected, "update"), title });
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
        if (!report.capabilities.duplicate) return;
        if (typeof reportStore?.duplicateReport !== "function") {
            setFeedback({ intent: "danger", message: "Report duplication is unavailable." });
            return;
        }
        const key = `${reportEntryKey(report)}:duplicate`;
        setBusyAction(key);
        try {
            const selected = await readReportCatalogResource(report, reportStore);
            const duplicated = await reportStore.duplicateReport(buildReportCatalogMutationRequest(selected, "duplicate"));
            setFeedback({ intent: "success", message: `Created ${duplicated?.title || `Copy of ${report.title}`}.` });
            await loadReports({ silent: true });
        } catch (duplicateError) {
            setFeedback({ intent: "danger", message: duplicateError?.message || "Could not duplicate the report." });
        } finally {
            setBusyAction("");
        }
    }, [loadReports, reportStore]);

    const deleteReport = useCallback(async () => {
        if (!deleteTarget?.capabilities.delete || typeof reportStore?.deleteReport !== "function") return;
        const key = `${reportEntryKey(deleteTarget)}:delete`;
        setBusyAction(key);
        try {
            const selected = await readReportCatalogResource(deleteTarget, reportStore);
            await reportStore.deleteReport(buildReportCatalogMutationRequest(selected, "archive"));
            setDeleteTarget(null);
            setFeedback({ intent: "success", message: `Archived ${deleteTarget.title}.` });
            await loadReports({ silent: true });
        } catch (deleteError) {
            setFeedback({ intent: "danger", message: deleteError?.message || "Could not delete the report." });
        } finally {
            setBusyAction("");
        }
    }, [deleteTarget, loadReports, reportStore]);

    const exportReport = useCallback(async (report) => {
        if (!report.capabilities.export) return;
        if (typeof reportExport?.submitSource !== "function") {
            setFeedback({ intent: "danger", message: "Report export is unavailable." });
            return;
        }
        const key = `${reportEntryKey(report)}:export`;
        setBusyAction(key);
        try {
            let job = normalizeReportBuilderExportJob(await reportExport.submitSource({
                ...buildReportCatalogResourceRequest(report),
                source: { kind: "report", ...buildReportCatalogResourceRequest(report) },
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
    }, [config, context?.windowState?.conversationId, reportExport]);

    const runRange = useCallback(() => {
        if (!rangeTarget?.capabilities.runRange || !rangeFrom || !rangeTo) return;
        const target = rangeTarget;
        openBuilder(target, {
            mode: "result",
            executeOnOpen: true,
            from: rangeFrom,
            to: rangeTo,
            newInstance: true,
        });
        setRangeTarget(null);
    }, [openBuilder, rangeFrom, rangeTarget, rangeTo]);

    const emptyTitle = scope === "order"
        ? `No reports for order ${currentOrderId || ""}`.trim()
        : (scope === "user" ? "No reports owned by the current user" : "No reports available");

    return (
        <section className="forge-report-catalog" ref={catalogRef}>
            <header className="forge-report-catalog__hero">
                <div className="forge-report-catalog__hero-icon"><Icon icon="projects" size={24} /></div>
                <div>
                    <h2>{currentOrderId ? `Reports for order ${currentOrderId}` : "Reports"}</h2>
                    <p>Open, rerun, edit, export, and organize reusable reports without leaving the order workspace.</p>
                </div>
                <div className="forge-report-catalog__hero-stat">
                    <strong>{entries.length}</strong>
                    <span>reports</span>
                </div>
            </header>

            <div className="forge-report-catalog__toolbar">
                <div className="forge-report-catalog__scopes" role="tablist" aria-label="Report catalog scope">
                    {SCOPES.filter((entry) => entry.id !== "order" || currentOrderId).map((entry) => (
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

                </div>
            ) : (
                <>
                <div className="forge-report-catalog__grid" aria-live="polite">
                    {pagination.entries.map((report) => (
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
                {pagination.totalItems > pageSizeOptions[0] ? (
                    <nav className="forge-report-catalog__pagination" aria-label="Report catalog pagination">
                        <div className="forge-report-catalog__pagination-summary" aria-live="polite">
                            <strong>{pagination.startIndex + 1}–{pagination.endIndex}</strong>
                            <span>of {pagination.totalItems} reports</span>
                        </div>
                        <label className="forge-report-catalog__page-size">
                            <span>Reports per page</span>
                            <select value={pageSize} onChange={selectPageSize} aria-label="Reports per page">
                                {pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                        </label>
                        <div className="forge-report-catalog__page-buttons">
                            <Button
                                minimal
                                icon="chevron-left"
                                aria-label="Previous reports page"
                                disabled={pagination.currentPage <= 1}
                                onClick={() => selectPage(pagination.currentPage - 1)}
                            />
                            {pageItems.map((item) => typeof item === "number" ? (
                                <button
                                    key={item}
                                    type="button"
                                    className={item === pagination.currentPage ? "is-active" : ""}
                                    aria-label={`Reports page ${item}`}
                                    aria-current={item === pagination.currentPage ? "page" : undefined}
                                    onClick={() => selectPage(item)}
                                >
                                    {item}
                                </button>
                            ) : (
                                <span key={item} className="forge-report-catalog__page-ellipsis" aria-hidden="true">…</span>
                            ))}
                            <Button
                                minimal
                                icon="chevron-right"
                                aria-label="Next reports page"
                                disabled={pagination.currentPage >= pagination.totalPages}
                                onClick={() => selectPage(pagination.currentPage + 1)}
                            />
                        </div>
                    </nav>
                ) : null}
                </>
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
                        <label className="forge-report-catalog__field"><span>From</span><input type="date" value={rangeFrom} onInput={(event) => setRangeFrom(event.currentTarget.value)} /></label>
                        <label className="forge-report-catalog__field"><span>To</span><input type="date" value={rangeTo} onInput={(event) => setRangeTo(event.currentTarget.value)} /></label>
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

            <Dialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete report?" icon="trash">
                <DialogBody>
                    <div className="forge-report-catalog__delete-warning">
                        <Icon icon="warning-sign" intent="danger" size={22} />
                        <div>
                            <strong>{deleteTarget?.title}</strong>
                            <p>This permanently removes this report.</p>
                        </div>
                    </div>
                </DialogBody>
                <DialogFooter
                    actions={(
                        <>
                            <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
                            <Button intent="danger" icon="trash" onClick={deleteReport}>Archive report</Button>
                        </>
                    )}
                />
            </Dialog>
        </section>
    );
}

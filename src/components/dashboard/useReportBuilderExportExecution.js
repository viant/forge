import React from "react";

import {
    buildReportBuilderExportArtifactDownload,
    buildReportBuilderExportJobSummary,
    buildReportBuilderExportRequestIdentity,
    normalizeReportBuilderExportArtifact,
    normalizeReportBuilderExportArtifactList,
    normalizeReportBuilderExportJob,
    normalizeReportBuilderExportJobList,
    isReportBuilderExportJobTerminal,
} from "./reportBuilderExportLifecycle.js";
import {
    buildReportBuilderExportRequestDownload,
    buildReportBuilderExportRequestInspectorState,
    buildReportBuilderExportRequestSummary,
} from "./reportBuilderExportRequest.js";
import { recordReportBuilderExportAuditEvent } from "./reportBuilderAuditHandler.js";
import {
    buildReportBuilderExportEventDetail,
    emitReportBuilderUIEvent,
} from "./reportBuilderUIEvents.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeMetadata(value = null) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? cloneValue(value)
        : {};
}

function buildExportFailureMessage({
    error = null,
    message = "",
    format = "",
    title = "",
} = {}) {
    const normalizedErrorMessage = normalizeString(error?.message || error);
    if (normalizedErrorMessage) {
        return normalizedErrorMessage;
    }
    const normalizedMessage = normalizeString(message);
    if (normalizedMessage) {
        return normalizedMessage;
    }
    const normalizedFormat = normalizeString(format);
    const normalizedTitle = normalizeString(title);
    if (normalizedFormat && normalizedTitle) {
        return `Could not submit ${normalizedFormat} export for ${normalizedTitle}.`;
    }
    if (normalizedFormat) {
        return `Could not submit ${normalizedFormat} export.`;
    }
    if (normalizedTitle) {
        return `Could not submit export for ${normalizedTitle}.`;
    }
    return "Could not submit export.";
}

function buildExportFormatLabel(format = "") {
    return normalizeString(format).toUpperCase() || "EXPORT";
}

export const REPORT_EXPORT_STATUS_POLL_INTERVAL_MS = 1500;
export const REPORT_EXPORT_SUBMIT_TIMEOUT_MS = 30000;
export const REPORT_EXPORT_STATUS_TIMEOUT_MS = 15000;
export const REPORT_EXPORT_ARTIFACT_TIMEOUT_MS = 30000;
export const REPORT_EXPORT_HISTORY_TIMEOUT_MS = 20000;
export const REPORT_EXPORT_SIDE_EFFECT_TIMEOUT_MS = 5000;

export async function runReportBuilderExportOperation(operation, {
    timeoutMs = 0,
    timeoutMessage = "The report export operation timed out.",
} = {}) {
    if (typeof operation !== "function") {
        throw new TypeError("A report export operation is required.");
    }
    const normalizedTimeoutMs = Math.max(0, Math.trunc(Number(timeoutMs) || 0));
    if (!normalizedTimeoutMs || typeof globalThis.setTimeout !== "function") {
        return operation();
    }
    let timeoutId = null;
    try {
        return await Promise.race([
            Promise.resolve().then(operation),
            new Promise((_, reject) => {
                timeoutId = globalThis.setTimeout(() => {
                    reject(new Error(normalizeString(timeoutMessage) || "The report export operation timed out."));
                }, normalizedTimeoutMs);
            }),
        ]);
    } finally {
        if (timeoutId != null) {
            globalThis.clearTimeout(timeoutId);
        }
    }
}

function runReportBuilderExportSideEffect(operation, label = "report export side effect") {
    void runReportBuilderExportOperation(operation, {
        timeoutMs: REPORT_EXPORT_SIDE_EFFECT_TIMEOUT_MS,
        timeoutMessage: `${label} did not respond within ${REPORT_EXPORT_SIDE_EFFECT_TIMEOUT_MS / 1000} seconds.`,
    }).catch((error) => {
        globalThis.console?.warn?.(
            `[forge-reporting] ${label} did not complete: ${normalizeString(error?.message || error) || "unknown error"}`,
        );
    });
}

export function resolveReportBuilderExportEventSourceKind({
    sourceKind = "",
    eventSourceKind = "",
} = {}) {
    return normalizeString(eventSourceKind) || normalizeString(sourceKind);
}

export function shouldAutoRefreshReportBuilderExportJob(job = null, reportExportHandler = null) {
    const normalizedJob = normalizeReportBuilderExportJob(job);
    if (!normalizedJob) {
        return false;
    }
    if (typeof reportExportHandler?.getStatus !== "function") {
        return false;
    }
    if (normalizeString(normalizedJob.artifactId)) {
        return false;
    }
    return !isReportBuilderExportJobTerminal(normalizedJob);
}

export function resolveReportBuilderExportSubmitFailure(error = null, {
    format = "",
    title = "",
} = {}) {
    const normalizedJob = normalizeReportBuilderExportJob(
        error?.toolResult
        ?? error?.job
        ?? error?.responseEnvelope?.result
        ?? null,
    );
    return {
        job: normalizedJob,
        message: normalizeString(normalizedJob?.error)
            || buildExportFailureMessage({ error, format, title }),
    };
}

export function resolveReportBuilderExportStatusFailure(error = null, {
    jobId = "",
} = {}) {
    const normalizedJob = normalizeReportBuilderExportJob(
        error?.toolResult
        ?? error?.job
        ?? error?.responseEnvelope?.result
        ?? null,
    );
    return {
        job: normalizedJob,
        message: normalizeString(normalizedJob?.error)
            || buildExportFailureMessage({
                error,
                message: normalizeString(jobId) ? `Could not refresh export ${normalizeString(jobId)}.` : "Could not refresh export.",
            }),
    };
}

function triggerDownload({ filename = "", mimeType = "application/octet-stream", payload = null } = {}) {
    if (!filename) {
        return false;
    }
    let blob = null;
    if (payload instanceof Uint8Array) {
        blob = new Blob([payload], { type: mimeType });
    } else if (typeof payload === "string") {
        blob = new Blob([payload], { type: mimeType });
    } else {
        return false;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return true;
}

export function useReportBuilderExportExecution({
    request = null,
    sourceKind = "",
    eventSourceKind = "",
    eventRuntimeRequest = null,
    eventReportId = "",
    eventReportName = "",
    localSavedPayloads = [],
    reportExportHandler = null,
    reportAuditHandler = null,
    reportAuditActorRef = "",
    reportAuditMetadata = {},
    reportEventHandler = null,
    reportEventContext = {},
    setFeedback = () => {},
    missingRequestMessage = "No export request is available.",
    missingJobMessage = "No export job is available to refresh.",
    missingArtifactMessage = "No completed export artifact is available yet.",
    historyEnabled = false,
} = {}) {
    const requestSummary = React.useMemo(
        () => buildReportBuilderExportRequestSummary(request, {
            localSavedPayloads,
        }),
        [localSavedPayloads, request],
    );
    const requestInspector = React.useMemo(
        () => buildReportBuilderExportRequestInspectorState(request, {
            localSavedPayloads,
        }),
        [localSavedPayloads, request],
    );
    const requestIdentity = React.useMemo(
        () => buildReportBuilderExportRequestIdentity(request),
        [request],
    );
    const [requestOpen, setRequestOpen] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [job, setJob] = React.useState(null);
    const [statusLoading, setStatusLoading] = React.useState(false);
    const [artifact, setArtifact] = React.useState(null);
    const [artifactLoading, setArtifactLoading] = React.useState(false);
    const [historyLoading, setHistoryLoading] = React.useState(false);
    const [historyJobs, setHistoryJobs] = React.useState([]);
    const [historyArtifacts, setHistoryArtifacts] = React.useState([]);
    const historyRequestVersionRef = React.useRef(0);
    const statusRequestVersionRef = React.useRef(0);
    const statusPollTimerRef = React.useRef(null);
    const completedEventKeysRef = React.useRef(new Set());
    const jobSummary = React.useMemo(
        () => buildReportBuilderExportJobSummary(job),
        [job],
    );
    const historyArtifactRef = React.useMemo(
        () => normalizeString(request?.source?.artifactRef),
        [request],
    );
    const historyAvailable = !!historyEnabled
        && !!historyArtifactRef
        && (
            typeof reportExportHandler?.listJobs === "function"
            || typeof reportExportHandler?.listArtifacts === "function"
        );

    React.useEffect(() => {
        historyRequestVersionRef.current += 1;
        statusRequestVersionRef.current += 1;
        setRequestOpen(false);
        setSubmitting(false);
        setJob(null);
        setStatusLoading(false);
        setArtifact(null);
        setArtifactLoading(false);
        setHistoryLoading(false);
        setHistoryJobs([]);
        setHistoryArtifacts([]);
        completedEventKeysRef.current.clear();
    }, [requestIdentity]);

    const emitExportEvent = React.useCallback(async (kind, {
        nextJob = null,
        nextArtifact = null,
    } = {}) => emitReportBuilderUIEvent(reportEventHandler, {
        kind,
        windowId: normalizeString(reportEventContext?.windowId),
        windowKey: normalizeString(reportEventContext?.windowKey),
        conversationId: normalizeString(reportEventContext?.conversationId),
        detail: buildReportBuilderExportEventDetail({
            request,
            sourceKind: resolveReportBuilderExportEventSourceKind({ sourceKind, eventSourceKind }),
            job: nextJob,
            artifact: nextArtifact,
            runtimeRequest: eventRuntimeRequest,
            reportId: eventReportId,
            reportName: eventReportName,
        }),
    }), [eventReportId, eventReportName, eventRuntimeRequest, eventSourceKind, reportEventContext?.conversationId, reportEventContext?.windowId, reportEventContext?.windowKey, reportEventHandler, request, sourceKind]);

    const emitExportComplete = React.useCallback(async (nextJob = null) => {
        const normalizedJob = normalizeReportBuilderExportJob(nextJob);
        if (normalizedJob?.status !== "succeeded" || !normalizeString(normalizedJob?.artifactId)) {
            return false;
        }
        const eventKey = normalizeString(normalizedJob.jobId || normalizedJob.artifactId);
        if (completedEventKeysRef.current.has(eventKey)) {
            return false;
        }
        completedEventKeysRef.current.add(eventKey);
        let nextArtifact = null;
        if (typeof reportExportHandler?.getArtifact === "function") {
            try {
                nextArtifact = normalizeReportBuilderExportArtifact(await reportExportHandler.getArtifact({
                    artifactId: normalizedJob.artifactId,
                }));
                if (nextArtifact) {
                    setArtifact(nextArtifact);
                }
            } catch (_) {
                // Completion remains useful with the canonical artifact id.
            }
        }
        return emitExportEvent("report.export_complete", {
            nextJob: normalizedJob,
            nextArtifact,
        });
    }, [emitExportEvent, reportExportHandler]);

    const selectHistoryEntry = React.useCallback(({ job: nextJob = null, artifact: nextArtifact = null } = {}) => {
        const normalizedJob = normalizeReportBuilderExportJob(nextJob);
        const normalizedArtifact = normalizeReportBuilderExportArtifact(nextArtifact);
        if (normalizedJob) {
            setJob(normalizedJob);
        }
        setArtifact(
            normalizedArtifact
            && normalizedJob
            && normalizeString(normalizedArtifact.artifactId) === normalizeString(normalizedJob.artifactId)
                ? normalizedArtifact
                : null,
        );
        return normalizedJob;
    }, []);

    const refreshHistory = React.useCallback(async ({ silent = false } = {}) => {
        if (!historyAvailable) {
            return { jobs: [], artifacts: [] };
        }
        const requestVersion = historyRequestVersionRef.current + 1;
        historyRequestVersionRef.current = requestVersion;
        setHistoryLoading(true);
        try {
            const [jobsResult, artifactsResult] = await runReportBuilderExportOperation(
                () => Promise.all([
                    typeof reportExportHandler?.listJobs === "function"
                        ? reportExportHandler.listJobs({ artifactRef: historyArtifactRef, limit: 6 })
                        : Promise.resolve([]),
                    typeof reportExportHandler?.listArtifacts === "function"
                        ? reportExportHandler.listArtifacts({ artifactRef: historyArtifactRef, limit: 6 })
                        : Promise.resolve([]),
                ]),
                {
                    timeoutMs: REPORT_EXPORT_HISTORY_TIMEOUT_MS,
                    timeoutMessage: `Recent exports did not respond within ${REPORT_EXPORT_HISTORY_TIMEOUT_MS / 1000} seconds.`,
                },
            );
            const nextJobs = normalizeReportBuilderExportJobList(jobsResult);
            const nextArtifacts = normalizeReportBuilderExportArtifactList(artifactsResult);
            if (historyRequestVersionRef.current !== requestVersion) {
                return null;
            }
            setHistoryJobs(nextJobs);
            setHistoryArtifacts(nextArtifacts);
            return {
                jobs: nextJobs,
                artifacts: nextArtifacts,
            };
        } catch (error) {
            if (!silent) {
                setFeedback({
                    level: "warning",
                    message: normalizeString(error?.message || error) || "Could not load recent exports.",
                });
            }
            return null;
        } finally {
            if (historyRequestVersionRef.current === requestVersion) {
                setHistoryLoading(false);
            }
        }
    }, [historyArtifactRef, historyAvailable, reportExportHandler, setFeedback]);

    const submit = React.useCallback(async () => {
        const normalizedSourceKind = normalizeString(sourceKind);
        const title = normalizeString(request?.source?.title || request?.reportSpec?.title || "Report") || "Report";
        const format = normalizeString(request?.target?.format).toUpperCase() || "EXPORT";
        if (!request || typeof request !== "object" || Array.isArray(request)) {
            setFeedback({
                level: "warning",
                message: missingRequestMessage,
            });
            return null;
        }
        if (typeof reportExportHandler?.submitRequest !== "function") {
            setRequestOpen(true);
            setFeedback({
                level: "info",
                message: `No host export handler is configured. Inspect or download the ${normalizedSourceKind || "report"} export request instead.`,
            });
            return null;
        }
        setSubmitting(true);
        runReportBuilderExportSideEffect(
            () => emitExportEvent("report.export_start"),
            "report.export_start event",
        );
        try {
            const result = await runReportBuilderExportOperation(
                () => reportExportHandler.submitRequest({
                    request: cloneValue(request),
                    source: normalizedSourceKind,
                }),
                {
                    timeoutMs: REPORT_EXPORT_SUBMIT_TIMEOUT_MS,
                    timeoutMessage: `Export submission did not respond within ${REPORT_EXPORT_SUBMIT_TIMEOUT_MS / 1000} seconds. Check recent exports before retrying.`,
                },
            );
            const normalizedJob = normalizeReportBuilderExportJob(result);
            if (normalizedJob) {
                setJob(normalizedJob);
                setArtifact(null);
                runReportBuilderExportSideEffect(
                    () => emitExportComplete(normalizedJob),
                    "report.export_complete event",
                );
            }
            const readyAction = normalizedJob?.status === "succeeded" && normalizeString(normalizedJob?.artifactId)
                ? {
                    action: "downloadArtifact",
                    actionLabel: `Download ${buildExportFormatLabel(normalizedJob?.format || request?.target?.format)}`,
                    exportKind: normalizedSourceKind,
                    exportFormat: normalizeString(normalizedJob?.format || request?.target?.format).toLowerCase(),
                }
                : {};
            setFeedback({
                level: "success",
                message: normalizeString(result?.message) || `Submitted ${format} export for ${title}.`,
                ...readyAction,
            });
            runReportBuilderExportSideEffect(async () => {
                const auditResult = await recordReportBuilderExportAuditEvent(request, {
                    handler: reportAuditHandler,
                    actorRef: reportAuditActorRef,
                    metadata: {
                        ...normalizeMetadata(reportAuditMetadata),
                        ...(normalizedSourceKind ? { triggerSource: normalizedSourceKind } : {}),
                    },
                });
                if (auditResult.issue) {
                    globalThis.console?.warn?.(`[forge-reporting] ${auditResult.issue}`);
                }
                return auditResult;
            }, "report export audit");
            if (historyAvailable) {
                Promise.resolve().then(() => refreshHistory({ silent: true }));
            }
            return result || { ok: true };
        } catch (error) {
            const failure = resolveReportBuilderExportSubmitFailure(error, { format, title });
            if (failure.job) {
                setJob(failure.job);
                setArtifact(null);
            }
            setFeedback({
                level: "warning",
                message: failure.message,
            });
            return null;
        } finally {
            setSubmitting(false);
        }
    }, [
        historyAvailable,
        missingRequestMessage,
        refreshHistory,
        reportAuditActorRef,
        reportAuditHandler,
        reportAuditMetadata,
        emitExportComplete,
        emitExportEvent,
        reportExportHandler,
        request,
        setFeedback,
        sourceKind,
    ]);

    const refreshStatus = React.useCallback(async ({ jobId: requestedJobId = "", silent = false } = {}) => {
        const jobId = normalizeString(requestedJobId || job?.jobId);
        const title = normalizeString(request?.source?.title || request?.reportSpec?.title || "Report") || "Report";
        if (!jobId) {
            if (!silent) {
                setFeedback({
                    level: "warning",
                    message: missingJobMessage,
                });
            }
            return null;
        }
        if (typeof reportExportHandler?.getStatus !== "function") {
            if (!silent) {
                setFeedback({
                    level: "info",
                    message: "The current host export handler does not expose export status polling.",
                });
            }
            return null;
        }
        const requestVersion = statusRequestVersionRef.current + 1;
        statusRequestVersionRef.current = requestVersion;
        setStatusLoading(true);
        try {
            const nextJob = normalizeReportBuilderExportJob(await runReportBuilderExportOperation(
                () => reportExportHandler.getStatus({ jobId }),
                {
                    timeoutMs: REPORT_EXPORT_STATUS_TIMEOUT_MS,
                    timeoutMessage: `Export status ${jobId} did not respond within ${REPORT_EXPORT_STATUS_TIMEOUT_MS / 1000} seconds.`,
                },
            ));
            if (statusRequestVersionRef.current !== requestVersion) {
                return null;
            }
            if (nextJob) {
                setJob(nextJob);
                if (!normalizeString(nextJob.artifactId)) {
                    setArtifact(null);
                }
                if (!silent) {
                    setFeedback({
                        level: nextJob.status === "failed" ? "warning" : "success",
                        message: nextJob.status === "failed"
                            ? (normalizeString(nextJob.error) || `Export ${jobId} failed.`)
                            : `Export ${jobId} is ${nextJob.status}.`,
                    });
                } else if (nextJob.status === "failed") {
                    setFeedback({
                        level: "warning",
                        message: normalizeString(nextJob.error) || `Export ${jobId} failed.`,
                    });
                } else if (nextJob.status === "succeeded" && normalizeString(nextJob.artifactId)) {
                    setFeedback({
                        level: "success",
                        message: `${buildExportFormatLabel(nextJob.format || request?.target?.format)} export for ${title} is ready to download.`,
                        action: "downloadArtifact",
                        actionLabel: `Download ${buildExportFormatLabel(nextJob.format || request?.target?.format)}`,
                        exportKind: normalizeString(sourceKind),
                        exportFormat: normalizeString(nextJob.format || request?.target?.format).toLowerCase(),
                    });
                }
                if (historyAvailable) {
                    Promise.resolve().then(() => refreshHistory({ silent: true }));
                }
                runReportBuilderExportSideEffect(
                    () => emitExportComplete(nextJob),
                    "report.export_complete event",
                );
            }
            return nextJob;
        } catch (error) {
            if (statusRequestVersionRef.current !== requestVersion) {
                return null;
            }
            const failure = resolveReportBuilderExportStatusFailure(error, { jobId });
            if (failure.job) {
                setJob(failure.job);
                if (!normalizeString(failure.job.artifactId)) {
                    setArtifact(null);
                }
            }
            if (!silent || failure.job?.status === "failed") {
                setFeedback({
                    level: "warning",
                    message: failure.message,
                    action: failure.job?.status === "failed" ? "retryExport" : "",
                    actionLabel: failure.job?.status === "failed"
                        ? `Retry ${buildExportFormatLabel(failure.job?.format || request?.target?.format)} export`
                        : "",
                    exportKind: normalizeString(sourceKind),
                    exportFormat: normalizeString(failure.job?.format || request?.target?.format).toLowerCase(),
                });
            }
            return null;
        } finally {
            if (statusRequestVersionRef.current === requestVersion) {
                setStatusLoading(false);
            }
        }
    }, [emitExportComplete, historyAvailable, job, missingJobMessage, refreshHistory, reportExportHandler, request, setFeedback, sourceKind]);

    const refreshStatusRef = React.useRef(refreshStatus);
    React.useEffect(() => {
        refreshStatusRef.current = refreshStatus;
    }, [refreshStatus]);

    React.useEffect(() => {
        if (statusPollTimerRef.current != null) {
            globalThis.clearTimeout(statusPollTimerRef.current);
            statusPollTimerRef.current = null;
        }
        if (!shouldAutoRefreshReportBuilderExportJob(job, reportExportHandler)) {
            return undefined;
        }
        const normalizedJob = normalizeReportBuilderExportJob(job);
        let cancelled = false;
        const scheduleNextPoll = () => {
            statusPollTimerRef.current = globalThis.setTimeout(async () => {
                statusPollTimerRef.current = null;
                if (cancelled || !normalizedJob?.jobId) {
                    return;
                }
                await refreshStatusRef.current({
                    jobId: normalizedJob.jobId,
                    silent: true,
                });
                if (!cancelled) {
                    scheduleNextPoll();
                }
            }, REPORT_EXPORT_STATUS_POLL_INTERVAL_MS);
        };
        scheduleNextPoll();
        return () => {
            cancelled = true;
            if (statusPollTimerRef.current != null) {
                globalThis.clearTimeout(statusPollTimerRef.current);
                statusPollTimerRef.current = null;
            }
        };
    }, [job?.jobId, jobSummary?.canRefresh, reportExportHandler?.getStatus]);

    const downloadArtifactByReference = React.useCallback(async ({
        artifactId = "",
        title = "",
        format = "",
        preferredArtifact = null,
        unavailableMessage = "",
    } = {}) => {
        const normalizedArtifactId = normalizeString(artifactId);
        if (!normalizedArtifactId) {
            setFeedback({
                level: "warning",
                message: normalizeString(unavailableMessage) || missingArtifactMessage,
            });
            return false;
        }
        let resolvedArtifact = preferredArtifact?.artifactId === normalizedArtifactId
            ? preferredArtifact
            : null;
        if (!resolvedArtifact) {
            if (typeof reportExportHandler?.getArtifact !== "function") {
                setFeedback({
                    level: "info",
                    message: "The current host export handler does not expose artifact retrieval.",
                });
                return false;
            }
            setArtifactLoading(true);
            try {
                const nextArtifact = normalizeReportBuilderExportArtifact(await runReportBuilderExportOperation(
                    () => reportExportHandler.getArtifact({ artifactId: normalizedArtifactId }),
                    {
                        timeoutMs: REPORT_EXPORT_ARTIFACT_TIMEOUT_MS,
                        timeoutMessage: `Export artifact ${normalizedArtifactId} did not respond within ${REPORT_EXPORT_ARTIFACT_TIMEOUT_MS / 1000} seconds.`,
                    },
                ));
                if (nextArtifact) {
                    resolvedArtifact = nextArtifact;
                    if (job?.artifactId === normalizedArtifactId) {
                        setArtifact(nextArtifact);
                    }
                }
            } catch (error) {
                setFeedback({
                    level: "warning",
                    message: normalizeString(error?.message || error) || `Could not load export artifact ${normalizedArtifactId}.`,
                });
                setArtifactLoading(false);
                return false;
            } finally {
                setArtifactLoading(false);
            }
        }
        const descriptor = buildReportBuilderExportArtifactDownload(resolvedArtifact, {
            title,
            format,
        });
        if (!descriptor) {
            setFeedback({
                level: "warning",
                message: normalizeString(unavailableMessage) || `Export artifact ${normalizedArtifactId} is unavailable for download.`,
            });
            return false;
        }
        return triggerDownload({
            filename: descriptor.filename,
            mimeType: descriptor.mimeType,
            payload: descriptor.bytes,
        });
    }, [job?.artifactId, missingArtifactMessage, reportExportHandler, setFeedback]);

    const downloadArtifact = React.useCallback(async () => {
        const artifactId = normalizeString(job?.artifactId);
        const title = normalizeString(request?.source?.title || request?.reportSpec?.title || "Report") || "Report";
        const format = normalizeString(request?.target?.format || job?.format || "pdf").toLowerCase() || "pdf";
        return downloadArtifactByReference({
            artifactId,
            title,
            format,
            preferredArtifact: artifact?.artifactId === artifactId ? artifact : null,
            unavailableMessage: `Export artifact ${artifactId} is unavailable for download.`,
        });
    }, [artifact, downloadArtifactByReference, job, request]);

    const downloadHistoryArtifact = React.useCallback(async ({
        artifactId = "",
        title = "",
        format = "",
        artifact: preferredArtifact = null,
    } = {}) => downloadArtifactByReference({
        artifactId,
        title,
        format,
        preferredArtifact,
        unavailableMessage: normalizeString(artifactId)
            ? `Export artifact ${normalizeString(artifactId)} is unavailable for download.`
            : "Selected export artifact is unavailable for download.",
    }), [downloadArtifactByReference]);

    React.useEffect(() => {
        if (!historyAvailable) {
            historyRequestVersionRef.current += 1;
            setHistoryLoading(false);
            setHistoryJobs([]);
            setHistoryArtifacts([]);
            return;
        }
        refreshHistory({ silent: true });
    }, [historyAvailable, refreshHistory, requestIdentity]);

    const downloadRequest = React.useCallback(() => {
        const descriptor = buildReportBuilderExportRequestDownload(request, {
            localSavedPayloads,
        });
        if (!descriptor) {
            return false;
        }
        return triggerDownload({
            filename: descriptor.filename,
            mimeType: descriptor.mimeType,
            payload: descriptor.payload,
        });
    }, [localSavedPayloads, request]);

    return {
        requestOpen,
        setRequestOpen,
        requestSummary,
        requestInspector,
        submitting,
        job,
        jobSummary,
        statusLoading,
        artifact,
        artifactLoading,
        historyAvailable,
        historyLoading,
        historyJobs,
        historyArtifacts,
        submit,
        refreshStatus,
        refreshHistory,
        selectHistoryEntry,
        downloadHistoryArtifact,
        downloadArtifact,
        downloadRequest,
    };
}

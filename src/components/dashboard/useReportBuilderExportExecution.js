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
    localSavedPayloads = [],
    reportExportHandler = null,
    reportAuditHandler = null,
    reportAuditActorRef = "",
    reportAuditMetadata = {},
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
    const statusPollTimerRef = React.useRef(null);
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
        setRequestOpen(false);
        setSubmitting(false);
        setJob(null);
        setStatusLoading(false);
        setArtifact(null);
        setArtifactLoading(false);
        setHistoryLoading(false);
        setHistoryJobs([]);
        setHistoryArtifacts([]);
    }, [requestIdentity]);

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
            const [jobsResult, artifactsResult] = await Promise.all([
                typeof reportExportHandler?.listJobs === "function"
                    ? reportExportHandler.listJobs({ artifactRef: historyArtifactRef, limit: 6 })
                    : Promise.resolve([]),
                typeof reportExportHandler?.listArtifacts === "function"
                    ? reportExportHandler.listArtifacts({ artifactRef: historyArtifactRef, limit: 6 })
                    : Promise.resolve([]),
            ]);
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
        try {
            const result = await reportExportHandler.submitRequest({
                request: cloneValue(request),
                source: normalizedSourceKind,
            });
            const normalizedJob = normalizeReportBuilderExportJob(result);
            if (normalizedJob) {
                setJob(normalizedJob);
                setArtifact(null);
            }
            const auditResult = await recordReportBuilderExportAuditEvent(request, {
                handler: reportAuditHandler,
                actorRef: reportAuditActorRef,
                metadata: {
                    ...normalizeMetadata(reportAuditMetadata),
                    ...(normalizedSourceKind ? { triggerSource: normalizedSourceKind } : {}),
                },
            });
            const readyAction = normalizedJob?.status === "succeeded" && normalizeString(normalizedJob?.artifactId)
                ? {
                    action: "downloadArtifact",
                    actionLabel: `Download ${buildExportFormatLabel(normalizedJob?.format || request?.target?.format)}`,
                    exportKind: normalizedSourceKind,
                    exportFormat: normalizeString(normalizedJob?.format || request?.target?.format).toLowerCase(),
                }
                : {};
            setFeedback({
                level: auditResult.issue ? "warning" : "success",
                message: `${normalizeString(result?.message) || `Submitted ${format} export for ${title}.`}${auditResult.issue ? ` ${auditResult.issue}` : ""}`,
                ...readyAction,
            });
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
        setStatusLoading(true);
        try {
            const nextJob = normalizeReportBuilderExportJob(await reportExportHandler.getStatus({ jobId }));
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
            }
            return nextJob;
        } catch (error) {
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
            setStatusLoading(false);
        }
    }, [historyAvailable, job, missingJobMessage, refreshHistory, reportExportHandler, request, setFeedback]);

    React.useEffect(() => {
        if (statusPollTimerRef.current != null) {
            globalThis.clearTimeout(statusPollTimerRef.current);
            statusPollTimerRef.current = null;
        }
        if (!shouldAutoRefreshReportBuilderExportJob(job, reportExportHandler)) {
            return undefined;
        }
        const normalizedJob = normalizeReportBuilderExportJob(job);
        statusPollTimerRef.current = globalThis.setTimeout(() => {
            statusPollTimerRef.current = null;
            if (normalizedJob?.jobId) {
                refreshStatus({
                    jobId: normalizedJob.jobId,
                    silent: true,
                });
            }
        }, REPORT_EXPORT_STATUS_POLL_INTERVAL_MS);
        return () => {
            if (statusPollTimerRef.current != null) {
                globalThis.clearTimeout(statusPollTimerRef.current);
                statusPollTimerRef.current = null;
            }
        };
    }, [job, refreshStatus, reportExportHandler]);

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
                const nextArtifact = normalizeReportBuilderExportArtifact(await reportExportHandler.getArtifact({ artifactId: normalizedArtifactId }));
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

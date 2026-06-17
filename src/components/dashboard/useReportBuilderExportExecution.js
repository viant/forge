import React from "react";

import {
    buildReportBuilderExportArtifactDownload,
    buildReportBuilderExportJobSummary,
    buildReportBuilderExportRequestIdentity,
    normalizeReportBuilderExportArtifact,
    normalizeReportBuilderExportJob,
} from "./reportBuilderExportLifecycle.js";
import {
    buildReportBuilderExportRequestDownload,
    buildReportBuilderExportRequestInspectorState,
    buildReportBuilderExportRequestSummary,
} from "./reportBuilderExportRequest.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
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
    reportExportHandler = null,
    setFeedback = () => {},
    missingRequestMessage = "No export request is available.",
    missingJobMessage = "No export job is available to refresh.",
    missingArtifactMessage = "No completed export artifact is available yet.",
} = {}) {
    const requestSummary = React.useMemo(
        () => buildReportBuilderExportRequestSummary(request),
        [request],
    );
    const requestInspector = React.useMemo(
        () => buildReportBuilderExportRequestInspectorState(request),
        [request],
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
    const jobSummary = React.useMemo(
        () => buildReportBuilderExportJobSummary(job),
        [job],
    );

    React.useEffect(() => {
        setRequestOpen(false);
        setSubmitting(false);
        setJob(null);
        setStatusLoading(false);
        setArtifact(null);
        setArtifactLoading(false);
    }, [requestIdentity]);

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
            setFeedback({
                level: "success",
                message: normalizeString(result?.message) || `Submitted ${format} export for ${title}.`,
            });
            return result || { ok: true };
        } catch (error) {
            setFeedback({
                level: "warning",
                message: normalizeString(error?.message || error) || `Could not submit ${format} export for ${title}.`,
            });
            return null;
        } finally {
            setSubmitting(false);
        }
    }, [missingRequestMessage, reportExportHandler, request, setFeedback, sourceKind]);

    const refreshStatus = React.useCallback(async () => {
        const jobId = normalizeString(job?.jobId);
        if (!jobId) {
            setFeedback({
                level: "warning",
                message: missingJobMessage,
            });
            return null;
        }
        if (typeof reportExportHandler?.getStatus !== "function") {
            setFeedback({
                level: "info",
                message: "The current host export handler does not expose export status polling.",
            });
            return null;
        }
        setStatusLoading(true);
        try {
            const nextJob = normalizeReportBuilderExportJob(await reportExportHandler.getStatus({ jobId }));
            if (nextJob) {
                setJob(nextJob);
                setFeedback({
                    level: nextJob.status === "failed" ? "warning" : "success",
                    message: nextJob.status === "failed"
                        ? (normalizeString(nextJob.error) || `Export ${jobId} failed.`)
                        : `Export ${jobId} is ${nextJob.status}.`,
                });
            }
            return nextJob;
        } catch (error) {
            setFeedback({
                level: "warning",
                message: normalizeString(error?.message || error) || `Could not refresh export ${jobId}.`,
            });
            return null;
        } finally {
            setStatusLoading(false);
        }
    }, [job, missingJobMessage, reportExportHandler, setFeedback]);

    const downloadArtifact = React.useCallback(async () => {
        const artifactId = normalizeString(job?.artifactId);
        const title = normalizeString(request?.source?.title || request?.reportSpec?.title || "Report") || "Report";
        const format = normalizeString(request?.target?.format || job?.format || "pdf").toLowerCase() || "pdf";
        let resolvedArtifact = artifact?.artifactId === artifactId ? artifact : null;
        if (!artifactId) {
            setFeedback({
                level: "warning",
                message: missingArtifactMessage,
            });
            return false;
        }
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
                const nextArtifact = normalizeReportBuilderExportArtifact(await reportExportHandler.getArtifact({ artifactId }));
                if (nextArtifact) {
                    resolvedArtifact = nextArtifact;
                    setArtifact(nextArtifact);
                }
            } catch (error) {
                setFeedback({
                    level: "warning",
                    message: normalizeString(error?.message || error) || `Could not load export artifact ${artifactId}.`,
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
                message: `Export artifact ${artifactId} is unavailable for download.`,
            });
            return false;
        }
        return triggerDownload({
            filename: descriptor.filename,
            mimeType: descriptor.mimeType,
            payload: descriptor.bytes,
        });
    }, [artifact, job, missingArtifactMessage, reportExportHandler, request, setFeedback]);

    const downloadRequest = React.useCallback(() => {
        const descriptor = buildReportBuilderExportRequestDownload(request);
        if (!descriptor) {
            return false;
        }
        return triggerDownload({
            filename: descriptor.filename,
            mimeType: descriptor.mimeType,
            payload: descriptor.payload,
        });
    }, [request]);

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
        submit,
        refreshStatus,
        downloadArtifact,
        downloadRequest,
    };
}

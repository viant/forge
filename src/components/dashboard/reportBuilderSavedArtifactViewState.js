import { buildReportBuilderExportProvenanceMetaChips } from "./reportBuilderExportViewState.js";
import {
    buildReportBuilderExportActionState,
    buildReportBuilderExportControlLabels,
    buildReportBuilderExportJobPanelState,
    buildReportBuilderExportRequestPanelState,
} from "./reportBuilderExportViewState.js";
import { buildReportBuilderExportFailureNotice as buildLifecycleExportFailureNotice } from "./reportBuilderExportLifecycle.js";
import {
    buildReportBuilderExportJobSummary,
    normalizeReportBuilderExportArtifact,
} from "./reportBuilderExportLifecycle.js";
import {
    buildReportBuilderTemplateConflictState,
    resolveEmbeddedReportBuilderTemplateIdentity,
    resolveReportBuilderTemplateIdentity,
} from "./reportBuilderTemplateIdentity.js";
import { buildReportBuilderReopenSourceResolutionState } from "./reportBuilderReopenSourceResolution.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function normalizePositiveInteger(value = 0) {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : 0;
}

function formatCountChip(count = 0, singular = "", plural = "") {
    const numeric = Number(count || 0) || 0;
    if (numeric <= 0) {
        return "";
    }
    return `${numeric} ${numeric === 1 ? singular : plural}`;
}

function parseTimestampMs(value = "") {
    const normalized = normalizeString(value);
    if (!normalized) {
        return 0;
    }
    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatRelativeTimestampChip(label = "", timestamp = "", nowMs = Date.now()) {
    const normalizedLabel = normalizeString(label);
    const ts = parseTimestampMs(timestamp);
    if (!normalizedLabel || !ts) {
        return "";
    }
    const diff = Math.max(0, Number(nowMs || Date.now()) - ts);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < hour) {
        return `${normalizedLabel} ${Math.max(1, Math.floor(diff / minute))}m ago`;
    }
    if (diff < day) {
        return `${normalizedLabel} ${Math.max(1, Math.floor(diff / hour))}h ago`;
    }
    return `${normalizedLabel} ${Math.max(1, Math.floor(diff / day))}d ago`;
}

function formatRetentionChip(timestamp = "", retentionTtlMs = 0, nowMs = Date.now()) {
    const ttl = Number(retentionTtlMs || 0);
    const ts = parseTimestampMs(timestamp);
    if (ttl <= 0 || !ts) {
        return "";
    }
    const remaining = (ts + ttl) - Number(nowMs || Date.now());
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (remaining <= 0) {
        return "expired";
    }
    if (remaining < hour) {
        return `expires in ${Math.max(1, Math.floor(remaining / minute))}m`;
    }
    if (remaining < day) {
        return `expires in ${Math.max(1, Math.floor(remaining / hour))}h`;
    }
    return `expires in ${Math.max(1, Math.floor(remaining / day))}d`;
}

function buildTemplateMetaChips({
    templateLabel = "",
    templateConflictLabel = "",
} = {}) {
    return [
        normalizeString(templateLabel),
        normalizeString(templateConflictLabel),
    ].filter(Boolean);
}

function buildExportRequestSummaryContext(requestSummary = null) {
    return {
        semanticBindingTitle: normalizeString(requestSummary?.semanticBindingTitle),
        semanticBindingChips: Array.isArray(requestSummary?.semanticBindingChips)
            ? requestSummary.semanticBindingChips.filter(Boolean)
            : [],
        semanticBindingFieldGroups: Array.isArray(requestSummary?.semanticBindingFieldGroups)
            ? requestSummary.semanticBindingFieldGroups
            : [],
        scopeSummaryTitle: normalizeString(requestSummary?.scopeSummaryTitle),
        scopeSummaryText: normalizeString(requestSummary?.scopeSummaryText),
        scopeSummaryItems: Array.isArray(requestSummary?.scopeSummaryItems)
            ? requestSummary.scopeSummaryItems
            : [],
    };
}

function resolveDraftExportTemplateState({
    requestSummary = null,
    templateIdentity = null,
    templateConflictState = null,
    document = null,
} = {}) {
    const resolvedTemplateIdentity = templateIdentity || resolveReportBuilderTemplateIdentity(
        document || null,
        document || null,
    );
    const resolvedTemplateConflictState = templateConflictState || buildReportBuilderTemplateConflictState(
        resolveReportBuilderTemplateIdentity(document || null, null),
        resolveEmbeddedReportBuilderTemplateIdentity(document || null),
        {
            primaryRole: "Draft report",
            secondaryRole: "embedded report document",
        },
    );
    return {
        requestSummary,
        templateIdentity: resolvedTemplateIdentity,
        templateConflictState: resolvedTemplateConflictState,
    };
}

function buildSelectedListEntryExportLabelsState({
    requestSummary = null,
    entrySummary = null,
} = {}) {
    return buildReportBuilderExportControlLabels({
        fallbackSubject: "catalog entry",
        backingSource: entrySummary?.backingSource || "",
        artifactKindLabel: requestSummary?.artifactKindLabel || "",
    });
}

function buildSelectedListEntryExportUnavailableReason(entrySummary = null) {
    const availability = normalizeString(entrySummary?.localBackingAvailability);
    if (availability === "ambiguous") {
        return "Multiple local artifacts match this report id. Explicit source identity is required before a selected-entry export request can be prepared.";
    }
    if (availability === "missing") {
        return "No unique local export-ready artifact is available for this catalog entry yet. Prepare a matching local reopen or saved artifact first.";
    }
    if (entrySummary?.reopenable && entrySummary?.exportable !== true) {
        return "A local reopen artifact is available for this catalog entry, but no local export-ready artifact is available yet. Save or prepare a matching export-ready artifact first.";
    }
    return "";
}

export function buildReportBuilderSavedArtifactViewState({
    savedExplorationArtifactOpen = false,
    savedReportPayloadOpen = false,
    savedReportPayloadApiArtifactsOpen = false,
    preparedApiArtifactCount = 0,
} = {}) {
    const normalizedPreparedApiArtifactCount = Number(preparedApiArtifactCount || 0) > 0
        ? Number(preparedApiArtifactCount || 0)
        : 0;
    return {
        loadFileLabel: "Load report file",
        saveLabel: "Save report file",
        savedExploration: {
            prepareLabel: "Build report file",
            inspectLabel: savedExplorationArtifactOpen ? "Hide draft snapshot" : "Review draft snapshot",
            downloadLabel: "Download draft snapshot",
            reuseHint: "This draft snapshot backs the saved report file and stays available when you need to review the local handoff.",
        },
        savedReportPayload: {
            inspectLabel: savedReportPayloadOpen ? "Hide report file" : "Review report file",
            downloadLabel: "Download report file",
            apiArtifactsLabel: savedReportPayloadApiArtifactsOpen
                ? "Hide delivery handoff"
                : (normalizedPreparedApiArtifactCount > 0
                    ? `Open delivery handoff (${normalizedPreparedApiArtifactCount} ready)`
                    : "Open delivery handoff"),
            reuseHint: "Download this report file to reopen it locally. Use delivery handoff when you need reopen bundles, catalog responses, or persisted API requests.",
            documentVersionLabel: normalizeString("Document version"),
            expectedVersionLabel: normalizeString("Expected version"),
            prepareGetResponseLabel: "Prepare reopen bundle",
            prepareListResponseLabel: "Prepare catalog response",
            prepareUpdatePayloadLabel: "Prepare update request",
            prepareCreatePayloadLabel: "Prepare create request",
        },
    };
}

function buildSavedPayloadApiArtifactEntry({
    id = "",
    label = "",
    title = "",
    subtitle = "",
    description = "",
    metaChips = [],
    inspectOpen = false,
    inspectLabel = "Review artifact",
    hideLabel = "Hide artifact",
    downloadLabel = "",
    notice = null,
} = {}) {
    const normalizedId = normalizeString(id);
    const normalizedLabel = normalizeString(label);
    const normalizedTitle = normalizeString(title);
    if (!normalizedId || !normalizedLabel || !normalizedTitle) {
        return null;
    }
    const normalizedNotice = notice && typeof notice === "object" && !Array.isArray(notice)
        ? {
            level: normalizeString(notice.level) || "info",
            message: normalizeString(notice.message),
        }
        : null;
    return {
        id: normalizedId,
        label: normalizedLabel,
        title: normalizedTitle,
        subtitle: normalizeString(subtitle),
        description: normalizeString(description),
        metaChips: (Array.isArray(metaChips) ? metaChips : []).filter(Boolean),
        inspectLabel: inspectOpen ? normalizeString(hideLabel) || "Hide artifact" : normalizeString(inspectLabel) || "Review artifact",
        downloadLabel: normalizeString(downloadLabel),
        notice: normalizedNotice?.message ? normalizedNotice : null,
    };
}

export function buildReportBuilderSavedPayloadApiArtifactEntries({
    getReportDocumentResponseSummary = null,
    getReportDocumentResponseOpen = false,
    getReportDocumentResponseCompileValidation = null,
    reopenReportDocumentDiagnosticSummary = null,
    reopenReportDocumentDiagnosticOpen = false,
    listReportDocumentsResponseSummary = null,
    listReportDocumentsResponseOpen = false,
    selectedListReportDocumentsEntrySummary = null,
    getReportDocumentRequestPayloadSummary = null,
    getReportDocumentRequestPayloadOpen = false,
    createReportDocumentPayloadSummary = null,
    createReportDocumentPayloadOpen = false,
    updateReportDocumentPayloadSummary = null,
    updateReportDocumentPayloadOpen = false,
    updateReportDocumentConflictDiagnosticSummary = null,
    updateReportDocumentConflictDiagnosticOpen = false,
} = {}) {
    const getResponseEntry = getReportDocumentResponseSummary
        ? buildSavedPayloadApiArtifactEntry({
            id: "getReportDocumentResponse",
            label: "Reopen bundle",
            title: normalizeString(getReportDocumentResponseSummary?.title) || normalizeString(getReportDocumentResponseSummary?.reportId),
            subtitle: getReportDocumentResponseSummary?.subtitle,
            description: getReportDocumentResponseSummary?.description,
            metaChips: [
                normalizeString(getReportDocumentResponseSummary?.reportId),
                Number(getReportDocumentResponseSummary?.documentVersion || 0) > 0
                    ? `v${Number(getReportDocumentResponseSummary.documentVersion || 0)}`
                    : "",
                normalizeString(getReportDocumentResponseSummary?.compileStatus),
                normalizeString(getReportDocumentResponseSummary?.templateLabel),
                normalizeString(getReportDocumentResponseSummary?.templateConflictLabel),
                Number(getReportDocumentResponseSummary?.authoredBlockCount || 0) > 0
                    ? `${Number(getReportDocumentResponseSummary.authoredBlockCount || 0)} authored blocks`
                    : "",
                Number(getReportDocumentResponseSummary?.drillHierarchyCount || 0) > 0
                    ? `${Number(getReportDocumentResponseSummary.drillHierarchyCount || 0)} drill hierarchies`
                    : "",
                Number(getReportDocumentResponseSummary?.detailTargetCount || 0) > 0
                    ? `${Number(getReportDocumentResponseSummary.detailTargetCount || 0)} detail targets`
                    : "",
                ...(Array.isArray(getReportDocumentResponseSummary?.reopenSourceResolutionChips)
                    ? getReportDocumentResponseSummary.reopenSourceResolutionChips
                    : []),
                ...(Array.isArray(getReportDocumentResponseSummary?.shareableMetaChips)
                    ? getReportDocumentResponseSummary.shareableMetaChips
                    : []),
            ],
            inspectOpen: getReportDocumentResponseOpen,
            inspectLabel: "Review reopen bundle",
            hideLabel: "Hide reopen bundle",
            downloadLabel: "Download reopen bundle file",
            notice: getReportDocumentResponseCompileValidation && !getReportDocumentResponseCompileValidation.valid
                ? {
                    level: "warning",
                    message: `Persisted compile warning: ${normalizeString(getReportDocumentResponseCompileValidation.message)}`,
                }
                : null,
        })
        : null;
    const listResponseEntry = listReportDocumentsResponseSummary
        ? buildSavedPayloadApiArtifactEntry({
            id: "listReportDocumentsResponse",
            label: "Catalog response",
            title: `${Number(listReportDocumentsResponseSummary?.entryCount || 0) || 0} entries`,
            subtitle: normalizeString(selectedListReportDocumentsEntrySummary?.title)
                ? `Selected entry: ${normalizeString(selectedListReportDocumentsEntrySummary?.title)}`
                : "",
            description: normalizeString(selectedListReportDocumentsEntrySummary?.subtitle)
                || normalizeString(selectedListReportDocumentsEntrySummary?.description),
            metaChips: [
                normalizeString(listReportDocumentsResponseSummary?.cursor),
                listReportDocumentsResponseSummary?.hasMore ? "has more" : "complete",
                normalizeString(selectedListReportDocumentsEntrySummary?.templateLabel),
                normalizeString(selectedListReportDocumentsEntrySummary?.templateConflictLabel),
                ...(Array.isArray(selectedListReportDocumentsEntrySummary?.shareableMetaChips)
                    ? selectedListReportDocumentsEntrySummary.shareableMetaChips
                    : []),
            ],
            inspectOpen: listReportDocumentsResponseOpen,
            inspectLabel: "Review catalog response",
            hideLabel: "Hide catalog response",
            downloadLabel: "Download catalog response file",
        })
        : null;
    const reopenDiagnosticEntry = reopenReportDocumentDiagnosticSummary
        ? buildSavedPayloadApiArtifactEntry({
            id: "reopenReportDocumentDiagnostic",
            label: "Reopen diagnostic",
            title: normalizeString(reopenReportDocumentDiagnosticSummary?.title)
                || normalizeString(reopenReportDocumentDiagnosticSummary?.reportId),
            subtitle: reopenReportDocumentDiagnosticSummary?.subtitle,
            description: reopenReportDocumentDiagnosticSummary?.description
                || normalizeString(reopenReportDocumentDiagnosticSummary?.message),
            metaChips: [
                normalizeString(reopenReportDocumentDiagnosticSummary?.reportId),
                normalizeString(reopenReportDocumentDiagnosticSummary?.code),
                normalizeString(reopenReportDocumentDiagnosticSummary?.severity),
                normalizeString(reopenReportDocumentDiagnosticSummary?.templateConflictLabel),
                ...(Array.isArray(reopenReportDocumentDiagnosticSummary?.reopenSourceResolutionChips)
                    ? reopenReportDocumentDiagnosticSummary.reopenSourceResolutionChips
                    : []),
            ],
            inspectOpen: reopenReportDocumentDiagnosticOpen,
            inspectLabel: "Review reopen diagnostic",
            hideLabel: "Hide reopen diagnostic",
            downloadLabel: "Download reopen diagnostic file",
        })
        : null;
    const getRequestEntry = getReportDocumentRequestPayloadSummary
        ? buildSavedPayloadApiArtifactEntry({
            id: "getReportDocumentRequest",
            label: "Get request",
            title: normalizeString(getReportDocumentRequestPayloadSummary?.title)
                || normalizeString(getReportDocumentRequestPayloadSummary?.reportId),
            subtitle: getReportDocumentRequestPayloadSummary?.subtitle,
            description: getReportDocumentRequestPayloadSummary?.description,
            metaChips: [
                normalizeString(getReportDocumentRequestPayloadSummary?.kind),
                normalizeString(getReportDocumentRequestPayloadSummary?.reportId),
            ],
            inspectOpen: getReportDocumentRequestPayloadOpen,
            inspectLabel: "Review get request",
            hideLabel: "Hide get request",
            downloadLabel: "Download get request file",
        })
        : null;
    const createPayloadEntry = createReportDocumentPayloadSummary
        ? buildSavedPayloadApiArtifactEntry({
            id: "createReportDocumentPayload",
            label: "Create request",
            title: normalizeString(createReportDocumentPayloadSummary?.title) || normalizeString(createReportDocumentPayloadSummary?.reportId),
            subtitle: createReportDocumentPayloadSummary?.subtitle,
            description: createReportDocumentPayloadSummary?.description,
            metaChips: [
                normalizeString(createReportDocumentPayloadSummary?.reportId),
                normalizeString(createReportDocumentPayloadSummary?.compileStatus),
                formatCountChip(createReportDocumentPayloadSummary?.blockCount, "block", "blocks"),
                formatCountChip(createReportDocumentPayloadSummary?.datasetCount, "dataset", "datasets"),
                normalizeString(createReportDocumentPayloadSummary?.templateLabel),
                normalizeString(createReportDocumentPayloadSummary?.templateConflictLabel),
                ...(Array.isArray(createReportDocumentPayloadSummary?.reopenSourceResolutionChips)
                    ? createReportDocumentPayloadSummary.reopenSourceResolutionChips
                    : []),
            ],
            inspectOpen: createReportDocumentPayloadOpen,
            inspectLabel: "Review create request",
            hideLabel: "Hide create request",
            downloadLabel: "Download create request file",
        })
        : null;
    const updatePayloadEntry = updateReportDocumentPayloadSummary
        ? buildSavedPayloadApiArtifactEntry({
            id: "updateReportDocumentPayload",
            label: "Update request",
            title: normalizeString(updateReportDocumentPayloadSummary?.title) || normalizeString(updateReportDocumentPayloadSummary?.reportId),
            subtitle: updateReportDocumentPayloadSummary?.subtitle,
            description: updateReportDocumentPayloadSummary?.description,
            metaChips: [
                normalizeString(updateReportDocumentPayloadSummary?.reportId),
                Number(updateReportDocumentPayloadSummary?.expectedVersion || 0) > 0
                    ? `v${Number(updateReportDocumentPayloadSummary.expectedVersion || 0)}`
                    : "",
                normalizeString(updateReportDocumentPayloadSummary?.compileStatus),
                formatCountChip(updateReportDocumentPayloadSummary?.blockCount, "block", "blocks"),
                formatCountChip(updateReportDocumentPayloadSummary?.datasetCount, "dataset", "datasets"),
                normalizeString(updateReportDocumentPayloadSummary?.templateLabel),
                normalizeString(updateReportDocumentPayloadSummary?.templateConflictLabel),
                ...(Array.isArray(updateReportDocumentPayloadSummary?.reopenSourceResolutionChips)
                    ? updateReportDocumentPayloadSummary.reopenSourceResolutionChips
                    : []),
            ],
            inspectOpen: updateReportDocumentPayloadOpen,
            inspectLabel: "Review update request",
            hideLabel: "Hide update request",
            downloadLabel: "Download update request file",
        })
        : null;
    const conflictDiagnosticEntry = updateReportDocumentConflictDiagnosticSummary
        ? buildSavedPayloadApiArtifactEntry({
            id: "updateReportDocumentConflictDiagnostic",
            label: "Conflict diagnostic",
            title: normalizeString(updateReportDocumentConflictDiagnosticSummary?.title)
                || normalizeString(updateReportDocumentConflictDiagnosticSummary?.reportId),
            subtitle: updateReportDocumentConflictDiagnosticSummary?.subtitle,
            description: updateReportDocumentConflictDiagnosticSummary?.description
                || normalizeString(updateReportDocumentConflictDiagnosticSummary?.message),
            metaChips: [
                normalizeString(updateReportDocumentConflictDiagnosticSummary?.reportId),
                Number(updateReportDocumentConflictDiagnosticSummary?.expectedVersion || 0) > 0
                    ? `expected v${Number(updateReportDocumentConflictDiagnosticSummary.expectedVersion || 0)}`
                    : "",
                Number(updateReportDocumentConflictDiagnosticSummary?.currentVersion || 0) > 0
                    ? `current v${Number(updateReportDocumentConflictDiagnosticSummary.currentVersion || 0)}`
                    : "",
                normalizeString(updateReportDocumentConflictDiagnosticSummary?.code),
                normalizeString(updateReportDocumentConflictDiagnosticSummary?.severity),
            ],
            inspectOpen: updateReportDocumentConflictDiagnosticOpen,
            inspectLabel: "Review conflict diagnostic",
            hideLabel: "Hide conflict diagnostic",
            downloadLabel: "Download conflict diagnostic file",
        })
        : null;
    return [
        getResponseEntry,
        reopenDiagnosticEntry,
        listResponseEntry,
        getRequestEntry,
        createPayloadEntry,
        updatePayloadEntry,
        conflictDiagnosticEntry,
    ].filter(Boolean);
}

export function buildReportBuilderDraftExportExecutionConfig({
    request = null,
    localSavedPayloads = [],
    reportExportHandler = null,
    setFeedback = () => {},
} = {}) {
    return {
        request,
        sourceKind: "draft",
        localSavedPayloads,
        reportExportHandler,
        setFeedback,
        missingRequestMessage: "No draft export request is available.",
        missingJobMessage: "No draft export job is available to refresh.",
        missingArtifactMessage: "No completed draft export artifact is available yet.",
    };
}

export function buildReportBuilderSavedPayloadExportExecutionConfig({
    request = null,
    localSavedPayloads = [],
    reportExportHandler = null,
    setFeedback = () => {},
} = {}) {
    return {
        request,
        sourceKind: "savedPayload",
        localSavedPayloads,
        reportExportHandler,
        setFeedback,
        missingRequestMessage: "No canonical saved export snapshot is available for this report payload yet.",
        missingJobMessage: "No saved export job is available to refresh.",
        missingArtifactMessage: "No completed saved export artifact is available yet.",
        historyEnabled: true,
    };
}

export function buildReportBuilderSavedPayloadRecentExportEntries({
    jobs = [],
    artifacts = [],
    summary = null,
    activeJobId = "",
    activeArtifactId = "",
    nowMs = Date.now(),
} = {}) {
    const normalizedArtifacts = (Array.isArray(artifacts) ? artifacts : [])
        .map((entry) => normalizeReportBuilderExportArtifact(entry))
        .filter(Boolean);
    const artifactsByJobId = new Map(
        normalizedArtifacts
            .map((entry) => [normalizeString(entry?.jobId), entry]),
    );
    const artifactsByArtifactId = new Map(
        normalizedArtifacts
            .map((entry) => [normalizeString(entry?.artifactId), entry]),
    );
    return (Array.isArray(jobs) ? jobs : [])
        .map((job) => {
            const jobSummary = buildReportBuilderExportJobSummary(job);
            if (!jobSummary) {
                return null;
            }
            const artifact = artifactsByJobId.get(normalizeString(jobSummary.jobId))
                || artifactsByArtifactId.get(normalizeString(jobSummary.artifactId))
                || null;
            const isActive = !!(
                normalizeString(activeJobId) === normalizeString(jobSummary.jobId)
                || (normalizeString(activeArtifactId) && normalizeString(activeArtifactId) === normalizeString(jobSummary.artifactId))
            );
            const statusLabel = normalizeString(jobSummary.status) || "unknown";
            const formatLabel = normalizeString(jobSummary.format).toUpperCase() || "EXPORT";
            const submittedChip = formatRelativeTimestampChip("submitted", job?.submittedAt, nowMs);
            const retentionChip = formatRetentionChip(
                artifact?.createdAt || job?.completedAt,
                artifact?.retentionTtlMs || job?.retentionTtlMs,
                nowMs,
            );
            const artifactExpired = retentionChip === "expired";
            const hasDownloadableArtifact = !!jobSummary.hasArtifact && !artifactExpired;
            const selectedJob = artifactExpired
                ? {
                    ...job,
                    artifactId: "",
                }
                : job;
            const selectedArtifact = artifactExpired ? null : artifact;
            return {
                id: `recentExport:${jobSummary.jobId}`,
                label: jobSummary.hasFailure
                    ? "Failed export"
                    : (hasDownloadableArtifact ? "Completed export" : "Recent export"),
                title: normalizeString(summary?.title) || "Report",
                subtitle: `${formatLabel} • ${statusLabel}`,
                description: jobSummary.hasFailure
                    ? (normalizeString(jobSummary.error) || jobSummary.primaryDiagnosticMessage || `Export ${jobSummary.jobId} failed.`)
                    : (artifactExpired
                        ? `Artifact ${normalizeString(jobSummary.artifactId) || "export"} has expired and is no longer downloadable.`
                        : (hasDownloadableArtifact
                        ? `Artifact ${normalizeString(jobSummary.artifactId) || "ready"} is available for download.`
                        : `Export ${jobSummary.jobId} is ${statusLabel}.`)),
                metaChips: [
                    normalizeString(jobSummary.jobId),
                    normalizeString(jobSummary.artifactId),
                    normalizeString(jobSummary.format),
                    submittedChip,
                    retentionChip,
                    normalizeString(summary?.templateLabel),
                    ...(Array.isArray(summary?.shareableMetaChips) ? summary.shareableMetaChips : []),
                    ...(Array.isArray(summary?.reopenSourceResolutionChips) ? summary.reopenSourceResolutionChips : []),
                ].filter(Boolean),
                notice: isActive
                    ? {
                        level: "info",
                        message: "Current export selection",
                    }
                    : (jobSummary.hasFailure
                        ? {
                            level: "warning",
                            message: normalizeString(jobSummary.error) || jobSummary.primaryDiagnosticMessage || "Export failed.",
                        }
                        : null),
                reviewLabel: "Use current",
                downloadLabel: hasDownloadableArtifact ? "Download artifact" : "",
                hasArtifact: hasDownloadableArtifact,
                canRefresh: !!jobSummary.canRefresh,
                active: isActive,
                job: selectedJob,
                artifact: selectedArtifact,
            };
        })
        .filter(Boolean);
}

export function buildReportBuilderReopenedExportExecutionConfig({
    request = null,
    localSavedPayloads = [],
    reportExportHandler = null,
    setFeedback = () => {},
} = {}) {
    return {
        request,
        sourceKind: "reopened",
        localSavedPayloads,
        reportExportHandler,
        setFeedback,
        missingRequestMessage: "No canonical export snapshot is available for the reopened ReportDocument.",
        missingJobMessage: "No reopened export job is available to refresh.",
        missingArtifactMessage: "No completed reopened export artifact is available yet.",
    };
}

export function buildReportBuilderSelectedListEntryExportExecutionConfig({
    request = null,
    localSavedPayloads = [],
    reportExportHandler = null,
    setFeedback = () => {},
} = {}) {
    return {
        request,
        sourceKind: "listEntry",
        localSavedPayloads,
        reportExportHandler,
        setFeedback,
        missingRequestMessage: "No canonical export snapshot is available for the selected catalog entry.",
        missingJobMessage: "No selected export job is available to refresh.",
        missingArtifactMessage: "No completed selected export artifact is available yet.",
    };
}

export function buildReportBuilderActiveSavedArtifactNoticeState({
    summary = null,
    kindLabel = "",
    reuseHint = "",
    isSavedReportPayload = false,
} = {}) {
    if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
        return null;
    }
    return {
        level: summary?.templateConflict ? "warning" : "info",
        templateLabel: normalizeString(summary?.templateLabel),
        templateConflictLabel: normalizeString(summary?.templateConflictLabel),
        templateConflictMessage: normalizeString(summary?.templateConflictMessage),
        reuseHint: normalizeString(reuseHint),
        metaChips: [
            normalizeString(summary?.compileStatus),
            normalizeString(summary?.templateLabel),
            normalizeString(summary?.templateConflictLabel),
            !isSavedReportPayload ? normalizeString(kindLabel) : "",
            Number(summary?.authoredBlockCount || 0) > 0 ? `${Number(summary.authoredBlockCount)} authored blocks` : "",
            Number(summary?.drillHierarchyCount || 0) > 0 ? `${Number(summary.drillHierarchyCount)} drill hierarchies` : "",
            Number(summary?.detailTargetCount || 0) > 0 ? `${Number(summary.detailTargetCount)} detail targets` : "",
            formatCountChip(summary?.blockCount, "block", "blocks"),
            formatCountChip(summary?.datasetCount, "dataset", "datasets"),
            ...(Array.isArray(summary?.shareableMetaChips) ? summary.shareableMetaChips : []),
            ...(Array.isArray(summary?.reopenSourceResolutionChips) ? summary.reopenSourceResolutionChips : []),
        ].filter(Boolean),
    };
}

export function buildReportBuilderReopenedSessionNoticeState({
    session = null,
    exportRequestSummary = null,
} = {}) {
    if (!session || typeof session !== "object" || Array.isArray(session)) {
        return null;
    }
    const documentVersion = normalizePositiveInteger(session?.documentVersion);
    const reopenSourceResolutionState = buildReportBuilderReopenSourceResolutionState({
        baseSource: session?.savedViewOverlayBaseSource,
        publishedSnapshotSource: session?.savedViewOverlayPublishedSnapshotSource,
    });
    const sharedArtifactProvenanceChips = [
        normalizeString(session?.lifecycle),
        normalizeString(session?.artifactId),
        normalizeString(session?.savedSource?.sourceArtifactId),
    ].filter(Boolean);
    return {
        level: exportRequestSummary?.templateConflict ? "warning" : "info",
        templateLabel: normalizeString(exportRequestSummary?.templateLabel || session?.templateLabel),
        templateConflictLabel: normalizeString(exportRequestSummary?.templateConflictLabel),
        templateConflictMessage: normalizeString(exportRequestSummary?.templateConflictMessage),
        metaChips: [
            normalizeString(session?.reportId),
            documentVersion > 0 ? `v${documentVersion}` : "",
            normalizeString(session?.reopenedCompileState?.status),
            normalizeString(exportRequestSummary?.templateLabel || session?.templateLabel),
            normalizeString(exportRequestSummary?.templateConflictLabel),
            ...sharedArtifactProvenanceChips,
            ...(Array.isArray(exportRequestSummary?.shareableMetaChips) ? exportRequestSummary.shareableMetaChips : []),
            ...(Array.isArray(reopenSourceResolutionState?.reopenSourceResolutionChips) ? reopenSourceResolutionState.reopenSourceResolutionChips : []),
        ].filter(Boolean),
        ...(normalizeString(session?.artifactId) ? { artifactId: normalizeString(session.artifactId) } : {}),
        ...(normalizeString(session?.artifactKind) ? { artifactKind: normalizeString(session.artifactKind) } : {}),
        ...(normalizeString(session?.artifactRef) ? { artifactRef: normalizeString(session.artifactRef) } : {}),
        ...(normalizeString(session?.lifecycle) ? { lifecycle: normalizeString(session.lifecycle) } : {}),
        ...(normalizeString(session?.ownerRef) ? { ownerRef: normalizeString(session.ownerRef) } : {}),
        ...(normalizeString(session?.policyRef) ? { policyRef: normalizeString(session.policyRef) } : {}),
        ...(Number(session?.shareableVersion || 0) > 0 ? { shareableVersion: Number(session.shareableVersion) || 0 } : {}),
        ...(Array.isArray(session?.badges) ? { badges: session.badges } : {}),
        ...(session?.capabilities && typeof session.capabilities === "object" && !Array.isArray(session.capabilities) ? { capabilities: session.capabilities } : {}),
        ...(Array.isArray(session?.grants) ? { grants: session.grants } : {}),
        ...(reopenSourceResolutionState ? reopenSourceResolutionState : {}),
    };
}

export function buildReportBuilderLatestSharedArtifactSupplementalText(summary = null) {
    if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
        return "";
    }
    const kind = normalizeString(summary?.kind);
    const lifecycle = normalizeString(summary?.lifecycle).toLowerCase();
    if (lifecycle === "archived") {
        return kind === "reportBuilder.publishedSnapshot"
            ? "The latest archive action preserved an immutable snapshot artifact for this report."
            : "The latest archive action preserved an immutable shared artifact for this report.";
    }
    if (kind === "reportBuilder.publishedSnapshot") {
        return "The latest publish action returned an immutable snapshot artifact for this report.";
    }
    return "The latest share action returned an immutable shared artifact for this report.";
}

export function buildReportBuilderDraftExportMetaChips({
    requestSummary = null,
    templateIdentity = null,
    templateConflictState = null,
    document = null,
} = {}) {
    return buildReportBuilderDraftExportNoticeState(
        resolveDraftExportTemplateState({
            requestSummary,
            templateIdentity,
            templateConflictState,
            document,
        }),
    )?.metaChips || [];
}

export function buildReportBuilderDraftExportActionState({
    requestSummary = null,
    requestOpen = false,
    submitting = false,
    reportExportHandlerAvailable = false,
} = {}) {
    return buildReportBuilderExportActionState({
        requestSummary,
        requestOpen,
        submitting,
        reportExportHandlerAvailable,
        handlerLabel: "Export PDF",
        reviewLabel: "Review Export",
    });
}

export function buildReportBuilderDraftExportRequestPanelState({
    requestInspector = null,
    requestOpen = false,
    requestSummary = null,
    templateIdentity = null,
    templateConflictState = null,
    document = null,
} = {}) {
    return buildReportBuilderExportRequestPanelState({
        requestInspector,
        requestOpen,
        includeReportPrintChip: true,
        additionalMetaChips: buildReportBuilderDraftExportMetaChips({
            requestSummary,
            templateIdentity,
            templateConflictState,
            document,
        }),
    });
}

export function buildReportBuilderDraftExportJobPanelState({
    jobSummary = null,
    requestSummary = null,
    templateIdentity = null,
    templateConflictState = null,
    document = null,
    statusLoading = false,
    artifactLoading = false,
} = {}) {
    return buildReportBuilderExportJobPanelState({
        jobSummary,
        label: "Draft export",
        title: normalizeString(requestSummary?.title) || "Report",
        statusLoading,
        artifactLoading,
        additionalMetaChips: buildReportBuilderDraftExportMetaChips({
            requestSummary,
            templateIdentity,
            templateConflictState,
            document,
        }),
        ...buildExportRequestSummaryContext(requestSummary),
    });
}

export function buildReportBuilderDraftExportFailureNotice({
    job = null,
    requestSummary = null,
    templateIdentity = null,
    templateConflictState = null,
    document = null,
} = {}) {
    return buildLifecycleExportFailureNotice(job, {
        label: "Draft export",
        additionalMetaChips: buildReportBuilderDraftExportMetaChips({
            requestSummary,
            templateIdentity,
            templateConflictState,
            document,
        }),
        ...buildExportRequestSummaryContext(requestSummary),
    });
}

export function buildReportBuilderReopenedExportMetaChips({
    requestSummary = null,
    session = null,
} = {}) {
    const noticeMetaChips = buildReportBuilderReopenedExportNoticeState({
        requestSummary,
        session,
    })?.metaChips || [];
    const reopenSourceResolutionState = buildReportBuilderReopenSourceResolutionState({
        baseSource: session?.savedViewOverlayBaseSource,
        publishedSnapshotSource: session?.savedViewOverlayPublishedSnapshotSource,
    });
    return noticeMetaChips
        .concat(Array.isArray(requestSummary?.shareableMetaChips) ? requestSummary.shareableMetaChips : [])
        .concat(Array.isArray(reopenSourceResolutionState?.reopenSourceResolutionChips)
            ? reopenSourceResolutionState.reopenSourceResolutionChips
            : []);
}

export function buildReportBuilderReopenedExportActionState({
    requestSummary = null,
    requestOpen = false,
    submitting = false,
    reportExportHandlerAvailable = false,
} = {}) {
    return buildReportBuilderExportActionState({
        requestSummary,
        requestOpen,
        submitting,
        reportExportHandlerAvailable,
        handlerLabel: "Export snapshot",
        reviewLabel: "Review export",
    });
}

export function buildReportBuilderReopenedExportRequestPanelState({
    requestInspector = null,
    requestOpen = false,
    requestSummary = null,
    session = null,
} = {}) {
    return buildReportBuilderExportRequestPanelState({
        requestInspector,
        requestOpen,
        additionalMetaChips: buildReportBuilderReopenedExportMetaChips({
            requestSummary,
            session,
        }),
    });
}

export function buildReportBuilderReopenedExportJobPanelState({
    jobSummary = null,
    requestSummary = null,
    session = null,
    statusLoading = false,
    artifactLoading = false,
} = {}) {
    return buildReportBuilderExportJobPanelState({
        jobSummary,
        label: "Reopened export",
        title: normalizeString(session?.title) || "Report",
        statusLoading,
        artifactLoading,
        additionalMetaChips: buildReportBuilderReopenedExportMetaChips({
            requestSummary,
            session,
        }),
        ...buildExportRequestSummaryContext(requestSummary),
    });
}

export function buildReportBuilderReopenedExportFailureNotice({
    job = null,
    requestSummary = null,
    session = null,
} = {}) {
    return buildLifecycleExportFailureNotice(job, {
        label: "Reopened export",
        additionalMetaChips: buildReportBuilderReopenedExportMetaChips({
            requestSummary,
            session,
        }),
        ...buildExportRequestSummaryContext(requestSummary),
    });
}

export function buildReportBuilderSavedPayloadExportMetaChips({
    summary = null,
} = {}) {
    return buildTemplateMetaChips({
        templateLabel: summary?.templateLabel,
        templateConflictLabel: summary?.templateConflictLabel,
    }).concat(Array.isArray(summary?.shareableMetaChips) ? summary.shareableMetaChips : [])
        .concat(Array.isArray(summary?.reopenSourceResolutionChips) ? summary.reopenSourceResolutionChips : []);
}

export function buildReportBuilderSavedPayloadExportActionState({
    requestSummary = null,
    requestOpen = false,
    submitting = false,
    reportExportHandlerAvailable = false,
} = {}) {
    return buildReportBuilderExportActionState({
        requestSummary,
        requestOpen,
        submitting,
        reportExportHandlerAvailable,
        handlerLabel: "Export snapshot",
        reviewLabel: "Review export",
    });
}

export function buildReportBuilderSelectedListEntryExportMetaChips({
    entrySummary = null,
    artifactKindLabel = "",
} = {}) {
    return buildReportBuilderExportProvenanceMetaChips({
        backingState: entrySummary?.backingState,
        backingSource: entrySummary?.backingSource,
        artifactKindLabel: normalizeString(artifactKindLabel || entrySummary?.backingArtifactKindLabel),
        localBackingLabel: entrySummary?.localBackingLabel,
    }).concat(buildTemplateMetaChips({
        templateLabel: entrySummary?.templateLabel,
        templateConflictLabel: entrySummary?.templateConflictLabel,
    })).concat(Array.isArray(entrySummary?.shareableMetaChips) ? entrySummary.shareableMetaChips : [])
        .concat(Array.isArray(entrySummary?.reopenSourceResolutionChips) ? entrySummary.reopenSourceResolutionChips : [])
        .concat(Array.isArray(entrySummary?.savedViewOverlayChips) ? entrySummary.savedViewOverlayChips : []);
}

export function buildReportBuilderSelectedListEntryExportLabels({
    requestSummary = null,
    entrySummary = null,
} = {}) {
    return buildSelectedListEntryExportLabelsState({
        requestSummary,
        entrySummary,
    });
}

export function buildReportBuilderSelectedListEntryExportActionState({
    requestSummary = null,
    requestOpen = false,
    submitting = false,
    reportExportHandlerAvailable = false,
    entrySummary = null,
} = {}) {
    const labels = buildSelectedListEntryExportLabelsState({
        requestSummary,
        entrySummary,
    });
    const unavailableReason = buildSelectedListEntryExportUnavailableReason(entrySummary);
    if (!requestSummary && unavailableReason) {
        return {
            submitLabel: "Export unavailable",
            submitDisabled: true,
            inspectLabel: requestOpen ? "Hide export blocker" : "Why export is unavailable",
        };
    }
    return buildReportBuilderExportActionState({
        requestSummary,
        requestOpen,
        submitting,
        reportExportHandlerAvailable,
        handlerLabel: labels.handlerLabel,
        reviewLabel: labels.reviewLabel,
        inspectLabel: labels.inspectLabel,
        hideLabel: labels.hideLabel,
    });
}

export function buildReportBuilderSavedPayloadExportRequestPanelState({
    requestInspector = null,
    requestOpen = false,
    summary = null,
} = {}) {
    return buildReportBuilderExportRequestPanelState({
        requestInspector,
        requestOpen,
        includeDocumentVersionChip: true,
        additionalMetaChips: buildReportBuilderSavedPayloadExportMetaChips({
            summary,
        }),
    });
}

export function buildReportBuilderSavedPayloadExportJobPanelState({
    jobSummary = null,
    summary = null,
    requestSummary = null,
    statusLoading = false,
    artifactLoading = false,
} = {}) {
    return buildReportBuilderExportJobPanelState({
        jobSummary,
        label: "Saved export",
        title: normalizeString(summary?.title) || "Report",
        statusLoading,
        artifactLoading,
        additionalMetaChips: buildReportBuilderSavedPayloadExportMetaChips({
            summary,
        }),
        ...buildExportRequestSummaryContext(requestSummary),
    });
}

export function buildReportBuilderSavedPayloadExportFailureNotice({
    job = null,
    summary = null,
    requestSummary = null,
} = {}) {
    return buildLifecycleExportFailureNotice(job, {
        label: "Saved export",
        additionalMetaChips: buildReportBuilderSavedPayloadExportMetaChips({
            summary,
        }),
        ...buildExportRequestSummaryContext(requestSummary),
    });
}

export function buildReportBuilderSelectedListEntryExportRequestPanelState({
    requestInspector = null,
    requestOpen = false,
    requestSummary = null,
    entrySummary = null,
    hideLabel = "",
} = {}) {
    const labels = buildSelectedListEntryExportLabelsState({
        requestSummary,
        entrySummary,
    });
    const unavailableReason = buildSelectedListEntryExportUnavailableReason(entrySummary);
    if (requestOpen && !requestInspector && unavailableReason) {
        return {
            metaChips: buildReportBuilderSelectedListEntryExportMetaChips({
                entrySummary,
                artifactKindLabel: requestSummary?.artifactKindLabel,
            }),
            hideLabel: normalizeString(hideLabel) || "Hide export blocker",
            ...(normalizeString(entrySummary?.semanticBindingTitle)
                ? { semanticBindingTitle: normalizeString(entrySummary.semanticBindingTitle) }
                : {}),
            ...(Array.isArray(entrySummary?.semanticBindingChips)
                ? { semanticBindingChips: entrySummary.semanticBindingChips.filter(Boolean) }
                : {}),
            ...(Array.isArray(entrySummary?.semanticBindingFieldGroups) && entrySummary.semanticBindingFieldGroups.length > 0
                ? { semanticBindingFieldGroups: entrySummary.semanticBindingFieldGroups }
                : {}),
            ...(normalizeString(entrySummary?.scopeSummaryTitle)
                ? { scopeSummaryTitle: normalizeString(entrySummary.scopeSummaryTitle) }
                : {}),
            ...(normalizeString(entrySummary?.scopeSummaryText)
                ? { scopeSummaryText: normalizeString(entrySummary.scopeSummaryText) }
                : {}),
            ...(Array.isArray(entrySummary?.scopeSummaryItems) && entrySummary.scopeSummaryItems.length > 0
                ? { scopeSummaryItems: entrySummary.scopeSummaryItems }
                : {}),
            ...(normalizeString(entrySummary?.title) ? { headerSubtitle: normalizeString(entrySummary.title) } : {}),
            headerDescription: unavailableReason,
            content: unavailableReason,
        };
    }
    return buildReportBuilderExportRequestPanelState({
        requestInspector,
        requestOpen,
        includeDocumentVersionChip: true,
        additionalMetaChips: buildReportBuilderSelectedListEntryExportMetaChips({
            entrySummary,
            artifactKindLabel: requestSummary?.artifactKindLabel,
        }),
        hideLabel: normalizeString(hideLabel) || labels.hideLabel,
    });
}

export function buildReportBuilderSelectedListEntryExportJobPanelState({
    jobSummary = null,
    requestSummary = null,
    entrySummary = null,
    label = "",
    statusLoading = false,
    artifactLoading = false,
} = {}) {
    const labels = buildSelectedListEntryExportLabelsState({
        requestSummary,
        entrySummary,
    });
    const unavailableReason = buildSelectedListEntryExportUnavailableReason(entrySummary);
    if (!jobSummary && unavailableReason) {
        return {
            tone: "warning",
            label: normalizeString(label) || labels.jobLabel,
            title: normalizeString(entrySummary?.title) || "Report",
            error: unavailableReason,
            metaChips: buildReportBuilderSelectedListEntryExportMetaChips({
                entrySummary,
                artifactKindLabel: requestSummary?.artifactKindLabel,
            }),
            ...(normalizeString(entrySummary?.semanticBindingTitle)
                ? { semanticBindingTitle: normalizeString(entrySummary.semanticBindingTitle) }
                : {}),
            ...(Array.isArray(entrySummary?.semanticBindingChips)
                ? { semanticBindingChips: entrySummary.semanticBindingChips.filter(Boolean) }
                : {}),
            ...(Array.isArray(entrySummary?.semanticBindingFieldGroups) && entrySummary.semanticBindingFieldGroups.length > 0
                ? { semanticBindingFieldGroups: entrySummary.semanticBindingFieldGroups }
                : {}),
            ...(normalizeString(entrySummary?.scopeSummaryTitle)
                ? { scopeSummaryTitle: normalizeString(entrySummary.scopeSummaryTitle) }
                : {}),
            ...(normalizeString(entrySummary?.scopeSummaryText)
                ? { scopeSummaryText: normalizeString(entrySummary.scopeSummaryText) }
                : {}),
            ...(Array.isArray(entrySummary?.scopeSummaryItems) && entrySummary.scopeSummaryItems.length > 0
                ? { scopeSummaryItems: entrySummary.scopeSummaryItems }
                : {}),
            refreshLabel: "Refresh status",
            refreshDisabled: true,
            downloadLabel: "Download artifact",
            downloadDisabled: true,
        };
    }
    return buildReportBuilderExportJobPanelState({
        jobSummary,
        label: normalizeString(label) || labels.jobLabel,
        title: normalizeString(entrySummary?.title) || "Report",
        statusLoading,
        artifactLoading,
        additionalMetaChips: buildReportBuilderSelectedListEntryExportMetaChips({
            entrySummary,
            artifactKindLabel: requestSummary?.artifactKindLabel,
        }),
        ...buildExportRequestSummaryContext(requestSummary),
    });
}

export function buildReportBuilderSelectedListEntryExportFailureNotice({
    job = null,
    requestSummary = null,
    entrySummary = null,
    label = "",
} = {}) {
    const labels = buildSelectedListEntryExportLabelsState({
        requestSummary,
        entrySummary,
    });
    return buildLifecycleExportFailureNotice(job, {
        label: normalizeString(label) || labels.jobLabel,
        additionalMetaChips: buildReportBuilderSelectedListEntryExportMetaChips({
            entrySummary,
            artifactKindLabel: requestSummary?.artifactKindLabel,
        }),
        ...buildExportRequestSummaryContext(requestSummary),
    });
}

export function buildReportBuilderDraftExportNoticeState({
    requestSummary = null,
    templateIdentity = null,
    templateConflictState = null,
} = {}) {
    const templateLabel = normalizeString(requestSummary?.templateLabel || templateIdentity?.templateLabel || "");
    const templateConflictLabel = normalizeString(requestSummary?.templateConflictLabel || templateConflictState?.templateConflictLabel || "");
    const templateConflictMessage = normalizeString(requestSummary?.templateConflictMessage || templateConflictState?.templateConflictMessage || "");
    if (!templateLabel && !templateConflictLabel && !templateConflictMessage) {
        return null;
    }
    return {
        tone: templateConflictLabel ? "warning" : "info",
        ...(templateLabel ? { templateLabel } : {}),
        ...(templateConflictLabel ? { templateConflictLabel } : {}),
        ...(templateConflictMessage ? { templateConflictMessage } : {}),
        metaChips: buildTemplateMetaChips({
            templateLabel,
            templateConflictLabel,
        }),
    };
}

export function buildReportBuilderReopenedExportNoticeState({
    requestSummary = null,
    session = null,
} = {}) {
    const templateLabel = normalizeString(requestSummary?.templateLabel || session?.templateLabel || "");
    const templateConflictLabel = normalizeString(requestSummary?.templateConflictLabel || "");
    const templateConflictMessage = normalizeString(requestSummary?.templateConflictMessage || "");
    if (!templateLabel && !templateConflictLabel && !templateConflictMessage) {
        return null;
    }
    return {
        tone: templateConflictLabel ? "warning" : "info",
        ...(templateLabel ? { templateLabel } : {}),
        ...(templateConflictLabel ? { templateConflictLabel } : {}),
        ...(templateConflictMessage ? { templateConflictMessage } : {}),
        metaChips: buildTemplateMetaChips({
            templateLabel,
            templateConflictLabel,
        }),
    };
}

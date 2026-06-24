function normalizeString(value = "") {
    return String(value || "").trim();
}

function capitalizeLabel(value = "") {
    const normalized = normalizeString(value);
    return normalized ? `${normalized[0].toUpperCase()}${normalized.slice(1)}` : "";
}

export function buildReportBuilderExportProvenanceMetaChips({
    backingState = "",
    backingSource = "",
    artifactKindLabel = "",
    localBackingLabel = "",
} = {}) {
    return [
        normalizeString(backingState),
        normalizeString(backingSource),
        normalizeString(artifactKindLabel),
        normalizeString(localBackingLabel),
    ].filter(Boolean);
}

export function buildReportBuilderExportControlLabels({
    fallbackSubject = "selected",
    backingSource = "",
    artifactKindLabel = "",
} = {}) {
    const normalizedFallbackSubject = normalizeString(fallbackSubject) || "selected";
    const normalizedBackingSource = normalizeString(backingSource);
    const normalizedArtifactKindLabel = normalizeString(artifactKindLabel);
    const subject = normalizedArtifactKindLabel || normalizedBackingSource || normalizedFallbackSubject;
    const capitalizedSubject = capitalizeLabel(subject) || "Selected";
    return {
        handlerLabel: `Export ${subject}`,
        reviewLabel: (normalizedArtifactKindLabel || normalizedBackingSource)
            ? `Review ${subject} export`
            : "Review export",
        inspectLabel: (normalizedArtifactKindLabel || normalizedBackingSource)
            ? `Inspect ${subject} export`
            : "Inspect export",
        hideLabel: (normalizedArtifactKindLabel || normalizedBackingSource)
            ? `Hide ${subject} export`
            : "Hide export",
        jobLabel: (normalizedArtifactKindLabel || normalizedBackingSource)
            ? `${capitalizedSubject} export`
            : "Selected export",
    };
}

export function buildReportBuilderExportActionState({
    requestSummary = null,
    requestOpen = false,
    submitting = false,
    reportExportHandlerAvailable = false,
    handlerLabel = "Export snapshot",
    reviewLabel = "Review export",
    inspectLabel = "Inspect export",
    hideLabel = "Hide export",
} = {}) {
    if (!requestSummary) {
        return null;
    }
    return {
        submitLabel: reportExportHandlerAvailable ? handlerLabel : reviewLabel,
        submitDisabled: !!submitting,
        inspectLabel: requestOpen ? hideLabel : inspectLabel,
    };
}

export function buildReportBuilderExportRequestPanelState({
    requestInspector = null,
    requestOpen = false,
    includeReportPrintChip = false,
    includeDocumentVersionChip = false,
    additionalMetaChips = [],
    hideLabel = "Hide export request",
    downloadLabel = "Download export request",
} = {}) {
    if (!requestOpen || !requestInspector) {
        return null;
    }
    return {
        metaChips: [
            normalizeString(requestInspector.from),
            normalizeString(requestInspector.format),
            normalizeString(requestInspector.artifactRef),
            includeDocumentVersionChip && Number(requestInspector.documentVersion || 0) > 0
                ? `v${Number(requestInspector.documentVersion || 0)}`
                : "",
            normalizeString(requestInspector.templateLabel),
            normalizeString(requestInspector.templateConflictLabel),
            includeReportPrintChip && requestInspector.hasReportPrint ? "reportPrint" : "",
            ...(Array.isArray(requestInspector?.semanticBindingChips) ? requestInspector.semanticBindingChips : []),
            ...(Array.isArray(additionalMetaChips) ? additionalMetaChips : []),
        ].filter(Boolean),
        hideLabel: normalizeString(hideLabel) || "Hide export request",
        downloadLabel: normalizeString(downloadLabel) || "Download export request",
        ...(normalizeString(requestInspector?.semanticBindingTitle)
            ? { semanticBindingTitle: normalizeString(requestInspector.semanticBindingTitle) }
            : {}),
        ...(Array.isArray(requestInspector?.semanticBindingChips)
            ? { semanticBindingChips: requestInspector.semanticBindingChips.filter(Boolean) }
            : {}),
        ...(Array.isArray(requestInspector?.semanticBindingFieldGroups) && requestInspector.semanticBindingFieldGroups.length > 0
            ? { semanticBindingFieldGroups: requestInspector.semanticBindingFieldGroups }
            : {}),
        ...(normalizeString(requestInspector?.scopeSummaryTitle)
            ? { scopeSummaryTitle: normalizeString(requestInspector.scopeSummaryTitle) }
            : {}),
        ...(normalizeString(requestInspector?.scopeSummaryText)
            ? { scopeSummaryText: normalizeString(requestInspector.scopeSummaryText) }
            : {}),
        ...(Array.isArray(requestInspector?.scopeSummaryItems) && requestInspector.scopeSummaryItems.length > 0
            ? { scopeSummaryItems: requestInspector.scopeSummaryItems }
            : {}),
        content: normalizeString(requestInspector.content),
    };
}

export function buildReportBuilderExportJobPanelState({
    jobSummary = null,
    label = "Export",
    title = "",
    statusLoading = false,
    artifactLoading = false,
    additionalMetaChips = [],
    semanticBindingTitle = "",
    semanticBindingChips = [],
    semanticBindingFieldGroups = [],
    scopeSummaryTitle = "",
    scopeSummaryText = "",
    scopeSummaryItems = [],
} = {}) {
    if (!jobSummary) {
        return null;
    }
    return {
        tone: jobSummary.hasFailure ? "warning" : "info",
        label: normalizeString(label) || "Export",
        title: normalizeString(title) || "Report",
        error: normalizeString(jobSummary.error),
        metaChips: [
            normalizeString(jobSummary.jobId),
            normalizeString(jobSummary.status),
            normalizeString(jobSummary.artifactId),
            ...(Array.isArray(additionalMetaChips) ? additionalMetaChips : []),
        ].filter(Boolean),
        ...(normalizeString(semanticBindingTitle) ? { semanticBindingTitle: normalizeString(semanticBindingTitle) } : {}),
        ...(Array.isArray(semanticBindingChips) ? { semanticBindingChips: semanticBindingChips.filter(Boolean) } : {}),
        ...(Array.isArray(semanticBindingFieldGroups) && semanticBindingFieldGroups.length > 0
            ? { semanticBindingFieldGroups: semanticBindingFieldGroups }
            : {}),
        ...(normalizeString(scopeSummaryTitle) ? { scopeSummaryTitle: normalizeString(scopeSummaryTitle) } : {}),
        ...(normalizeString(scopeSummaryText) ? { scopeSummaryText: normalizeString(scopeSummaryText) } : {}),
        ...(Array.isArray(scopeSummaryItems) && scopeSummaryItems.length > 0
            ? { scopeSummaryItems }
            : {}),
        refreshLabel: statusLoading ? "Refreshing..." : "Refresh status",
        refreshDisabled: !!statusLoading || !jobSummary.canRefresh,
        downloadLabel: artifactLoading ? "Loading artifact..." : "Download artifact",
        downloadDisabled: !!artifactLoading || !jobSummary.hasArtifact,
    };
}

export function buildReportBuilderExportFailureNotice(job = null, {
    label = "Export",
    semanticBindingTitle = "",
    semanticBindingChips = [],
    semanticBindingFieldGroups = [],
    scopeSummaryTitle = "",
    scopeSummaryText = "",
    scopeSummaryItems = [],
    additionalMetaChips = [],
} = {}) {
    if (!job || typeof job !== "object" || Array.isArray(job) || !job.hasFailure) {
        return null;
    }
    const diagnostics = (Array.isArray(job?.diagnostics) ? job.diagnostics : [])
        .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
        .map((entry, index) => ({
            id: normalizeString(entry?.id || `${normalizeString(entry?.code || "diagnostic")}:${index}`),
            code: normalizeString(entry?.code),
            severity: normalizeString(entry?.severity || "warning"),
            path: normalizeString(entry?.path),
            message: normalizeString(entry?.message),
            suggestedFix: normalizeString(entry?.suggestedFix),
        }))
        .filter((entry) => entry.message);
    return {
        level: "warning",
        label: normalizeString(label) || "Export",
        title: normalizeString(job?.error || "Export failed") || "Export failed",
        error: normalizeString(job?.error),
        metaChips: [
            normalizeString(job?.jobId),
            normalizeString(job?.status),
            normalizeString(job?.artifactId),
            ...(Array.isArray(additionalMetaChips) ? additionalMetaChips : []),
        ].filter(Boolean),
        diagnostics,
        ...(normalizeString(semanticBindingTitle) ? { semanticBindingTitle: normalizeString(semanticBindingTitle) } : {}),
        ...(Array.isArray(semanticBindingChips) ? { semanticBindingChips: semanticBindingChips.filter(Boolean) } : {}),
        ...(Array.isArray(semanticBindingFieldGroups) && semanticBindingFieldGroups.length > 0
            ? { semanticBindingFieldGroups }
            : {}),
        ...(normalizeString(scopeSummaryTitle) ? { scopeSummaryTitle: normalizeString(scopeSummaryTitle) } : {}),
        ...(normalizeString(scopeSummaryText) ? { scopeSummaryText: normalizeString(scopeSummaryText) } : {}),
        ...(Array.isArray(scopeSummaryItems) && scopeSummaryItems.length > 0
            ? { scopeSummaryItems }
            : {}),
    };
}

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeTimestamp(value, fallback = Date.now()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function normalizePositiveInteger(value) {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : 0;
}

function sanitizeFilenameSegment(value = "") {
    return normalizeString(value).replace(/[\\/:*?"<>|]+/g, "-");
}

function buildBuilderTarget(builderIdentity = {}) {
    return {
        containerId: normalizeString(builderIdentity?.containerId),
        stateKey: normalizeString(builderIdentity?.stateKey),
        dataSourceRef: normalizeString(builderIdentity?.dataSourceRef),
    };
}

function buildSuggestedAction(code = "") {
    switch (normalizeString(code)) {
        case "missingResponse":
        case "unsupportedResponse":
        case "unsupportedResponseVersion":
            return "Prepare a valid getReportDocument response before reopening this ReportDocument.";
        case "missingEntry":
            return "Select a valid list response entry before checking reopen compatibility.";
        case "invalidDocument":
        case "unsupportedDocumentVersion":
            return "Refresh the saved ReportDocument artifact or reload a supported version before reopening.";
        case "incompatibleSource":
            return "Open this ReportDocument from a compatible builder target or reload a matching document.";
        default:
            return "Review the reopen diagnostic and reload a compatible ReportDocument before retrying.";
    }
}

export function resolveReportBuilderReopenCompatibility(source = {}, builderIdentity = {}) {
    const mismatches = [];
    const target = buildBuilderTarget(builderIdentity);
    const sourceKind = normalizeString(source?.kind);
    const sourceContainerId = normalizeString(source?.containerId);
    const sourceStateKey = normalizeString(source?.stateKey);
    const sourceDataSourceRef = normalizeString(source?.dataSourceRef);

    if (!sourceKind) {
        mismatches.push("missing source kind");
    } else if (sourceKind !== "dashboard.reportBuilder") {
        mismatches.push(`source kind ${sourceKind}`);
    }
    if (!sourceContainerId && target.containerId) {
        mismatches.push("missing container");
    }
    if (!sourceStateKey) {
        mismatches.push("missing state key");
    }
    if (!sourceDataSourceRef && target.dataSourceRef) {
        mismatches.push("missing data source");
    }
    if (sourceContainerId && (!target.containerId || sourceContainerId !== target.containerId)) {
        mismatches.push(`container ${sourceContainerId}`);
    }
    if (sourceStateKey && (!target.stateKey || sourceStateKey !== target.stateKey)) {
        mismatches.push(`state key ${sourceStateKey}`);
    }
    if (sourceDataSourceRef && (!target.dataSourceRef || sourceDataSourceRef !== target.dataSourceRef)) {
        mismatches.push(`data source ${sourceDataSourceRef}`);
    }

    if (mismatches.length === 0) {
        return {
            compatible: true,
            code: "",
            message: "",
        };
    }
    return {
        compatible: false,
        code: "incompatibleSource",
        message: `This ReportDocument targets a different builder source: ${mismatches.join(", ")}.`,
    };
}

export function buildReportBuilderHydratedReportDocumentDiagnostic(getResponse = null, hydrateResult = null, {
    detectedAt = Date.now(),
    builderIdentity = {},
} = {}) {
    if (!hydrateResult || hydrateResult.valid === true) {
        return null;
    }
    const reportId = normalizeString(getResponse?.reportRef?.reportId)
        || normalizeString(getResponse?.document?.id)
        || normalizeString(hydrateResult?.source?.stateKey);
    const title = normalizeString(
        normalizeString(getResponse?.document?.title)
        || normalizeString(getResponse?.reportRef?.reportId)
        || reportId
        || "Report",
    );
    const subtitle = normalizeString(getResponse?.document?.subtitle);
    const description = normalizeString(getResponse?.document?.description);
    return {
        version: 1,
        kind: "reportBuilder.reopenDiagnostic",
        code: normalizeString(hydrateResult?.code || "reopenDiagnostic") || "reopenDiagnostic",
        severity: "error",
        detectedAt: normalizeTimestamp(detectedAt),
        reportRef: reportId ? { reportId } : null,
        title,
        ...(subtitle ? { subtitle } : {}),
        ...(description ? { description } : {}),
        responseKind: normalizeString(getResponse?.kind),
        responseVersion: normalizePositiveInteger(getResponse?.version),
        documentKind: normalizeString(getResponse?.document?.kind),
        documentVersion: normalizePositiveInteger(getResponse?.documentVersion),
        documentSchemaVersion: normalizePositiveInteger(getResponse?.document?.version),
        builderTarget: buildBuilderTarget(builderIdentity),
        message: normalizeString(hydrateResult?.message || "Could not reopen the saved ReportDocument."),
        suggestedAction: buildSuggestedAction(hydrateResult?.code),
        ...(hydrateResult?.source && typeof hydrateResult.source === "object" && !Array.isArray(hydrateResult.source)
            ? { source: cloneValue(hydrateResult.source) }
            : {}),
    };
}

export function buildReportBuilderListReportDocumentsEntryDiagnostic(listResponse = null, {
    entryReportId = "",
    detectedAt = Date.now(),
    builderIdentity = {},
} = {}) {
    const entries = Array.isArray(listResponse?.entries) ? listResponse.entries : [];
    const targetReportId = normalizeString(entryReportId);
    if (!targetReportId) {
        return null;
    }
    const entry = entries.find((candidate) => normalizeString(candidate?.reportRef?.reportId) === targetReportId) || null;
    if (!entry) {
        return {
            version: 1,
            kind: "reportBuilder.reopenDiagnostic",
            code: "missingEntry",
            severity: "error",
            detectedAt: normalizeTimestamp(detectedAt),
            reportRef: { reportId: targetReportId },
            title: targetReportId,
            responseKind: normalizeString(listResponse?.kind),
            responseVersion: normalizePositiveInteger(listResponse?.version),
            documentKind: "",
            documentVersion: 0,
            documentSchemaVersion: 0,
            builderTarget: buildBuilderTarget(builderIdentity),
            message: `The list response entry ${targetReportId} is unavailable for reopen compatibility checks.`,
            suggestedAction: buildSuggestedAction("missingEntry"),
        };
    }
    const source = entry?.source && typeof entry.source === "object" && !Array.isArray(entry.source)
        ? cloneValue(entry.source)
        : {};
    const compatibility = resolveReportBuilderReopenCompatibility(source, builderIdentity);
    if (compatibility.compatible) {
        return null;
    }
    const title = normalizeString(entry?.title) || targetReportId || "Report";
    const subtitle = normalizeString(entry?.subtitle);
    const description = normalizeString(entry?.description);
    return {
        version: 1,
        kind: "reportBuilder.reopenDiagnostic",
        code: compatibility.code,
        severity: "error",
        detectedAt: normalizeTimestamp(detectedAt),
        reportRef: targetReportId ? { reportId: targetReportId } : null,
        title,
        ...(subtitle ? { subtitle } : {}),
        ...(description ? { description } : {}),
        responseKind: normalizeString(listResponse?.kind),
        responseVersion: normalizePositiveInteger(listResponse?.version),
        documentKind: "",
        documentVersion: normalizePositiveInteger(entry?.documentVersion),
        documentSchemaVersion: 0,
        builderTarget: buildBuilderTarget(builderIdentity),
        message: compatibility.message,
        suggestedAction: buildSuggestedAction(compatibility.code),
        ...(Object.keys(source).length > 0 ? { source } : {}),
    };
}

export function buildReportBuilderHydratedReportDocumentDiagnosticSummary(diagnostic = null) {
    if (!diagnostic || typeof diagnostic !== "object" || Array.isArray(diagnostic)) {
        return null;
    }
    const subtitle = normalizeString(diagnostic?.subtitle);
    const description = normalizeString(diagnostic?.description);
    return {
        title: normalizeString(diagnostic?.title)
            || normalizeString(diagnostic?.reportRef?.reportId)
            || "Report",
        ...(subtitle ? { subtitle } : {}),
        ...(description ? { description } : {}),
        kind: normalizeString(diagnostic?.kind),
        code: normalizeString(diagnostic?.code),
        severity: normalizeString(diagnostic?.severity),
        reportId: normalizeString(diagnostic?.reportRef?.reportId),
        message: normalizeString(diagnostic?.message),
    };
}

export function serializeReportBuilderHydratedReportDocumentDiagnostic(diagnostic = null, {
    pretty = true,
} = {}) {
    if (!diagnostic || typeof diagnostic !== "object" || Array.isArray(diagnostic)) {
        return "";
    }
    return pretty === false
        ? JSON.stringify(diagnostic)
        : JSON.stringify(diagnostic, null, 2);
}

export function buildReportBuilderHydratedReportDocumentDiagnosticInspectorState(diagnostic = null) {
    const summary = buildReportBuilderHydratedReportDocumentDiagnosticSummary(diagnostic);
    if (!summary) {
        return null;
    }
    return {
        ...summary,
        ...(summary.subtitle ? { headerSubtitle: summary.subtitle } : {}),
        ...(summary.description ? { headerDescription: summary.description } : {}),
        content: serializeReportBuilderHydratedReportDocumentDiagnostic(diagnostic),
    };
}

export function buildReportBuilderHydratedReportDocumentDiagnosticDownload(diagnostic = null) {
    const summary = buildReportBuilderHydratedReportDocumentDiagnosticSummary(diagnostic);
    if (!summary) {
        return null;
    }
    const content = serializeReportBuilderHydratedReportDocumentDiagnostic(diagnostic);
    if (!content) {
        return null;
    }
    const normalizedReportId = sanitizeFilenameSegment(summary.title || summary.reportId || "report-document") || "report-document";
    return {
        filename: `${normalizedReportId}-reopen-diagnostic.json`,
        mimeType: "application/json;charset=utf-8",
        payload: content,
    };
}

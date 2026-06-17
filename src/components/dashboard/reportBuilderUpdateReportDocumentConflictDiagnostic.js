import { buildUpdateReportDocumentConflictDiagnostic } from "../../reporting/reportDocumentStore.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function sanitizeFilenameSegment(value = "") {
    return normalizeString(value).replace(/[\\/:*?"<>|]+/g, "-");
}

export function resolveReportBuilderUpdateReportDocumentCurrentVersion(value = "") {
    const normalized = normalizeString(value);
    if (!/^[1-9]\d*$/.test(normalized)) {
        return 0;
    }
    const parsed = Number(normalized);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function buildReportBuilderUpdateReportDocumentConflictVersionState({
    expectedVersion = 0,
    currentVersionDraft = "",
} = {}) {
    const normalizedDraft = normalizeString(currentVersionDraft);
    const normalizedExpectedVersion = Number(expectedVersion || 0) || 0;
    const currentVersion = resolveReportBuilderUpdateReportDocumentCurrentVersion(normalizedDraft);
    const valid = currentVersion > 0;
    const conflictReady = valid && normalizedExpectedVersion > 0 && currentVersion !== normalizedExpectedVersion;
    return {
        draft: normalizedDraft,
        expectedVersion: normalizedExpectedVersion,
        currentVersion,
        valid,
        conflictReady,
        helperText: normalizedExpectedVersion < 1
            ? "Prepare an update payload before generating a conflict diagnostic."
            : conflictReady
                ? `Current version ${currentVersion} conflicts with expected version ${normalizedExpectedVersion}.`
                : !normalizedDraft
                    ? "Enter the current saved document version to prepare a conflict diagnostic."
                    : !valid
                        ? "Current version must be a positive integer."
                        : `Current version ${currentVersion} matches expected version ${normalizedExpectedVersion}; no conflict diagnostic is needed.`,
    };
}

export function buildReportBuilderUpdateReportDocumentConflictDiagnostic(updatePayload = null, {
    currentVersion = 0,
    detectedAt = Date.now(),
} = {}) {
    return buildUpdateReportDocumentConflictDiagnostic({
        updatePayload,
        currentVersion,
        detectedAt,
    });
}

export function buildReportBuilderUpdateReportDocumentConflictDiagnosticSummary(diagnostic = null) {
    if (!diagnostic || typeof diagnostic !== "object" || Array.isArray(diagnostic)) {
        return null;
    }
    const subtitle = normalizeString(diagnostic?.subtitle);
    const description = normalizeString(diagnostic?.description);
    return {
        title: normalizeString(diagnostic?.title || diagnostic?.reportRef?.reportId || "Report"),
        ...(subtitle ? { subtitle } : {}),
        ...(description ? { description } : {}),
        kind: normalizeString(diagnostic?.kind),
        code: normalizeString(diagnostic?.code),
        severity: normalizeString(diagnostic?.severity),
        reportId: normalizeString(diagnostic?.reportRef?.reportId),
        expectedVersion: Number(diagnostic?.expectedVersion || 0) || 0,
        currentVersion: Number(diagnostic?.currentVersion || 0) || 0,
        message: normalizeString(diagnostic?.message),
    };
}

export function serializeReportBuilderUpdateReportDocumentConflictDiagnostic(diagnostic = null, {
    pretty = true,
} = {}) {
    if (!diagnostic || typeof diagnostic !== "object" || Array.isArray(diagnostic)) {
        return "";
    }
    return pretty === false
        ? JSON.stringify(diagnostic)
        : JSON.stringify(diagnostic, null, 2);
}

export function buildReportBuilderUpdateReportDocumentConflictDiagnosticInspectorState(diagnostic = null) {
    const summary = buildReportBuilderUpdateReportDocumentConflictDiagnosticSummary(diagnostic);
    if (!summary) {
        return null;
    }
    return {
        ...summary,
        ...(summary.subtitle ? { headerSubtitle: summary.subtitle } : {}),
        ...(summary.description ? { headerDescription: summary.description } : {}),
        content: serializeReportBuilderUpdateReportDocumentConflictDiagnostic(diagnostic),
    };
}

export function buildReportBuilderUpdateReportDocumentConflictDiagnosticDownload(diagnostic = null) {
    const summary = buildReportBuilderUpdateReportDocumentConflictDiagnosticSummary(diagnostic);
    if (!summary) {
        return null;
    }
    const content = serializeReportBuilderUpdateReportDocumentConflictDiagnostic(diagnostic);
    if (!content) {
        return null;
    }
    const normalizedReportId = sanitizeFilenameSegment(summary.title || summary.reportId || "report-document") || "report-document";
    return {
        filename: `${normalizedReportId}-update-conflict-v${summary.expectedVersion || 0}-current-v${summary.currentVersion || 0}.json`,
        mimeType: "application/json;charset=utf-8",
        payload: content,
    };
}

import { buildUpdateReportDocumentConflictDiagnostic } from "../../reporting/reportDocumentStore.js";
import { resolvePreferredReportBuilderSemanticBindingViewState } from "./reportBuilderSemanticBindingViewPreference.js";
import { buildReportBuilderScopeSummaryFromParams } from "./reportBuilderDocumentBlocks.js";
import { resolveNormalizedReportSpecDocumentContext } from "./reportBuilderSavedRecordMetadataContext.js";

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
    const diagnostic = buildUpdateReportDocumentConflictDiagnostic({
        updatePayload,
        currentVersion,
        detectedAt,
    });
    if (!diagnostic) {
        return null;
    }
    const payloadContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec: updatePayload?.reportSpec || null,
        document: updatePayload?.document || null,
        title: updatePayload?.title || updatePayload?.reportRef?.reportId || "",
    });
    const semanticBindingViewState = resolvePreferredReportBuilderSemanticBindingViewState({
        metadataContexts: [payloadContext],
        candidates: [updatePayload?.semanticBindingViewState],
    });
    const scopeSummary = buildReportBuilderScopeSummaryFromParams(payloadContext?.scopeParams);
    return semanticBindingViewState
        ? {
            ...diagnostic,
            semanticBindingTitle: semanticBindingViewState.title,
            semanticBindingChips: semanticBindingViewState.chips,
            ...(Array.isArray(semanticBindingViewState.fieldGroups) && semanticBindingViewState.fieldGroups.length > 0
                ? { semanticBindingFieldGroups: semanticBindingViewState.fieldGroups }
                : {}),
            ...(Array.isArray(scopeSummary?.items) && scopeSummary.items.length > 0 ? {
                scopeSummaryTitle: "Filters",
                scopeSummaryText: scopeSummary.text,
                scopeSummaryItems: scopeSummary.items,
            } : {}),
        }
        : (
            Array.isArray(scopeSummary?.items) && scopeSummary.items.length > 0
                ? {
                    ...diagnostic,
                    scopeSummaryTitle: "Filters",
                    scopeSummaryText: scopeSummary.text,
                    scopeSummaryItems: scopeSummary.items,
                }
                : diagnostic
        );
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
        ...(normalizeString(diagnostic?.semanticBindingTitle) ? { semanticBindingTitle: normalizeString(diagnostic.semanticBindingTitle) } : {}),
        ...(Array.isArray(diagnostic?.semanticBindingChips) ? { semanticBindingChips: diagnostic.semanticBindingChips.filter(Boolean) } : {}),
        ...(Array.isArray(diagnostic?.semanticBindingFieldGroups) && diagnostic.semanticBindingFieldGroups.length > 0
            ? { semanticBindingFieldGroups: diagnostic.semanticBindingFieldGroups.map((group) => ({
                ...group,
                fields: Array.isArray(group?.fields) ? group.fields.filter(Boolean) : [],
            })) }
            : {}),
        ...(normalizeString(diagnostic?.scopeSummaryTitle) ? { scopeSummaryTitle: normalizeString(diagnostic.scopeSummaryTitle) } : {}),
        ...(normalizeString(diagnostic?.scopeSummaryText) ? { scopeSummaryText: normalizeString(diagnostic.scopeSummaryText) } : {}),
        ...(Array.isArray(diagnostic?.scopeSummaryItems) && diagnostic.scopeSummaryItems.length > 0
            ? { scopeSummaryItems: diagnostic.scopeSummaryItems }
            : {}),
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
        ...(Array.isArray(summary.semanticBindingFieldGroups) && summary.semanticBindingFieldGroups.length > 0
            ? { semanticBindingFieldGroups: summary.semanticBindingFieldGroups }
            : {}),
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

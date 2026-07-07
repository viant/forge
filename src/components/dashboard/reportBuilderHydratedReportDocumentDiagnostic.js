import { resolveReportBuilderSavedReportRecordByReportId } from "./reportBuilderSavedReportRecords.js";
import { resolvePreferredReportBuilderSemanticBindingViewState } from "./reportBuilderSemanticBindingViewPreference.js";
import { buildReportBuilderScopeSummaryFromParams } from "./reportBuilderDocumentBlocks.js";
import {
    buildReportBuilderListReportDocumentsEntrySummary,
    resolveReportBuilderListReportDocumentsResponseEntry,
} from "./reportBuilderReportDocumentReadResponse.js";
import {
    resolvePreferredScopeParams,
    resolveNormalizedReportSpecDocumentContext,
    resolveSavedReportRecordContextBySource,
    resolveSavedReportRecordContextByReportId,
} from "./reportBuilderSavedRecordMetadataContext.js";
import {
    buildReportBuilderTemplateConflictState,
    resolveReportBuilderTemplateIdentity,
} from "./reportBuilderTemplateIdentity.js";
import {
    buildReportBuilderReopenSourceResolutionEntry,
    buildReportBuilderReopenSourceResolutionState,
} from "./reportBuilderReopenSourceResolution.js";

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

function normalizeDiagnosticSourceIdentity(value = null) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const source = value?.source && typeof value.source === "object" && !Array.isArray(value.source)
        ? value.source
        : value;
    const kind = normalizeString(source?.kind || value?.kind);
    const reportId = normalizeString(
        source?.reportId
        || value?.reportRef?.reportId
        || value?.reportId,
    );
    const sourceArtifactId = normalizeString(source?.sourceArtifactId || value?.sourceArtifactId || value?.id);
    if (!kind && !reportId && !sourceArtifactId) {
        return null;
    }
    return {
        ...(kind ? { kind } : {}),
        ...(reportId ? { reportId } : {}),
        ...(sourceArtifactId ? { sourceArtifactId } : {}),
    };
}

function matchesDiagnosticSourceIdentity(left = null, right = null) {
    if (!left || !right) {
        return false;
    }
    return normalizeString(left?.kind) === normalizeString(right?.kind)
        && normalizeString(left?.reportId) === normalizeString(right?.reportId)
        && normalizeString(left?.sourceArtifactId) === normalizeString(right?.sourceArtifactId);
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
            return "Prepare a valid reopen bundle before reopening this report.";
        case "missingEntry":
            return "Select a valid catalog entry before checking reopen compatibility.";
        case "invalidDocument":
        case "unsupportedDocumentVersion":
            return "Refresh the saved report artifact or reload a supported version before reopening.";
        case "incompatibleSource":
            return "Open this report from a compatible builder target or reload a matching report artifact.";
        default:
            return "Review the reopen diagnostic and reload a compatible report before retrying.";
    }
}

function resolveDiagnosticScopeSummary(scopeParams = []) {
    const summary = buildReportBuilderScopeSummaryFromParams(scopeParams);
    return Array.isArray(summary?.items) && summary.items.length > 0
        ? {
            scopeSummaryTitle: "Filters",
            scopeSummaryText: summary.text,
            scopeSummaryItems: summary.items,
        }
        : null;
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
    const responseContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec: getResponse?.reportSpec || null,
        document: getResponse?.document || null,
        title: getResponse?.document?.title || getResponse?.reportRef?.reportId || "",
    });
    const semanticBindingViewState = resolvePreferredReportBuilderSemanticBindingViewState({
        metadataContexts: [responseContext],
        candidates: [getResponse?.semanticBindingViewState],
    });
    const scopeSummary = resolveDiagnosticScopeSummary(
        resolvePreferredScopeParams(responseContext?.scopeParams),
    );
    const title = normalizeString(
        normalizeString(getResponse?.document?.title)
        || normalizeString(getResponse?.reportRef?.reportId)
        || reportId
        || "Report",
    );
    const subtitle = normalizeString(getResponse?.document?.subtitle);
    const description = normalizeString(getResponse?.document?.description);
    const templateIdentity = resolveReportBuilderTemplateIdentity(getResponse, getResponse?.document || null);
    const templateConflictState = buildReportBuilderTemplateConflictState(
        resolveReportBuilderTemplateIdentity(getResponse, null),
        resolveReportBuilderTemplateIdentity(null, getResponse?.document || null),
        {
            primaryRole: "Imported get response",
            secondaryRole: "embedded report document",
        },
    );
    const reopenSourceResolutionState = buildReportBuilderReopenSourceResolutionState({
        baseSource: hydrateResult?.savedViewOverlayBaseSource,
        publishedSnapshotSource: hydrateResult?.savedViewOverlayPublishedSnapshotSource,
    });
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
        ...(templateConflictState ? templateConflictState : {}),
        ...(templateIdentity ? templateIdentity : {}),
        ...(semanticBindingViewState ? {
            semanticBindingTitle: semanticBindingViewState.title,
            semanticBindingChips: semanticBindingViewState.chips,
            ...(Array.isArray(semanticBindingViewState.fieldGroups) && semanticBindingViewState.fieldGroups.length > 0
                ? { semanticBindingFieldGroups: semanticBindingViewState.fieldGroups }
                : {}),
        } : {}),
        ...(scopeSummary ? scopeSummary : {}),
        ...(reopenSourceResolutionState ? reopenSourceResolutionState : {}),
        ...(hydrateResult?.source && typeof hydrateResult.source === "object" && !Array.isArray(hydrateResult.source)
            ? { source: cloneValue(hydrateResult.source) }
            : {}),
    };
}

export function buildReportBuilderListReportDocumentsEntryDiagnostic(listResponse = null, {
    entryReportId = "",
    entrySelectionKey = "",
    detectedAt = Date.now(),
    builderIdentity = {},
    localSavedPayloads = [],
} = {}) {
    const targetReportId = normalizeString(entryReportId);
    const entry = resolveReportBuilderListReportDocumentsResponseEntry(listResponse, {
        selectedEntryKey: entrySelectionKey,
        selectedReportId: entryReportId,
    });
    if (!targetReportId && !entry) {
        return null;
    }
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
    const resolvedReportId = normalizeString(entry?.reportRef?.reportId || targetReportId);
    const selectedEntrySummary = buildReportBuilderListReportDocumentsEntrySummary(entry, {
        localSavedPayloads,
    });
    const companionContext = resolveSavedReportRecordContextBySource(
        entry?.source || null,
        localSavedPayloads,
    ) || resolveSavedReportRecordContextByReportId(
        resolvedReportId,
        localSavedPayloads,
    );
    const semanticBindingViewState = resolvePreferredReportBuilderSemanticBindingViewState({
        metadataContexts: [companionContext],
        candidates: [entry?.semanticBindingViewState],
    });
    const scopeSummary = resolveDiagnosticScopeSummary(
        resolvePreferredScopeParams(
            companionContext?.scopeParams,
        ),
    );
    const source = entry?.source && typeof entry.source === "object" && !Array.isArray(entry.source)
        ? cloneValue(entry.source)
        : {};
    const compatibility = resolveReportBuilderReopenCompatibility(source, builderIdentity);
    if (compatibility.compatible) {
        return null;
    }
    const title = normalizeString(entry?.title) || resolvedReportId || "Report";
    const subtitle = normalizeString(entry?.subtitle);
    const description = normalizeString(entry?.description);
    const templateIdentity = resolveReportBuilderTemplateIdentity(entry, entry?.document || null)
        || resolveReportBuilderTemplateIdentity(companionContext?.record, companionContext?.document || null);
    const templateConflictState = buildReportBuilderTemplateConflictState(
        resolveReportBuilderTemplateIdentity(entry, entry?.document || null),
        resolveReportBuilderTemplateIdentity(companionContext?.record, companionContext?.document || null),
        {
            primaryRole: "Catalog entry",
            secondaryRole: "local backing report file",
        },
    );
    return {
        version: 1,
        kind: "reportBuilder.reopenDiagnostic",
        code: compatibility.code,
        severity: "error",
        detectedAt: normalizeTimestamp(detectedAt),
        reportRef: resolvedReportId ? { reportId: resolvedReportId } : null,
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
        ...(templateConflictState ? templateConflictState : {}),
        ...(templateIdentity ? templateIdentity : {}),
        ...(normalizeString(selectedEntrySummary?.localBackingAvailability) ? {
            localBackingAvailability: normalizeString(selectedEntrySummary.localBackingAvailability),
        } : {}),
        ...(normalizeString(selectedEntrySummary?.localBackingLabel) ? {
            localBackingLabel: normalizeString(selectedEntrySummary.localBackingLabel),
        } : {}),
        ...(semanticBindingViewState ? {
            semanticBindingTitle: semanticBindingViewState.title,
            semanticBindingChips: semanticBindingViewState.chips,
            ...(Array.isArray(semanticBindingViewState.fieldGroups) && semanticBindingViewState.fieldGroups.length > 0
                ? { semanticBindingFieldGroups: semanticBindingViewState.fieldGroups }
                : {}),
        } : {}),
        ...(scopeSummary ? scopeSummary : {}),
        ...(Object.keys(source).length > 0 ? { source } : {}),
    };
}

export function mergeReportBuilderHydratedReportDocumentDiagnosticSharedArtifact(diagnostic = null, value = null) {
    if (!diagnostic || typeof diagnostic !== "object" || Array.isArray(diagnostic) || normalizeString(diagnostic?.kind) !== "reportBuilder.reopenDiagnostic") {
        return diagnostic;
    }
    const nextSourceIdentity = normalizeDiagnosticSourceIdentity(value);
    if (!nextSourceIdentity) {
        return cloneValue(diagnostic);
    }
    const diagnosticSourceIdentity = normalizeDiagnosticSourceIdentity(diagnostic?.source || diagnostic);
    const reportMatch = normalizeString(diagnostic?.reportRef?.reportId) && normalizeString(diagnostic?.reportRef?.reportId) === normalizeString(nextSourceIdentity?.reportId);
    if (!matchesDiagnosticSourceIdentity(diagnosticSourceIdentity, nextSourceIdentity) && !reportMatch) {
        return cloneValue(diagnostic);
    }
    const title = normalizeString(value?.title || diagnostic?.title);
    const documentVersion = normalizePositiveInteger(value?.documentVersion || diagnostic?.documentVersion);
    return {
        ...cloneValue(diagnostic),
        ...(nextSourceIdentity?.reportId ? { reportRef: { reportId: nextSourceIdentity.reportId } } : {}),
        ...(title ? { title } : {}),
        ...(documentVersion > 0 ? { documentVersion } : {}),
        source: nextSourceIdentity,
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
        ...(normalizeString(diagnostic?.templateId) ? { templateId: normalizeString(diagnostic.templateId) } : {}),
        ...(normalizeString(diagnostic?.templateLabel) ? { templateLabel: normalizeString(diagnostic.templateLabel) } : {}),
        ...(diagnostic?.templateConflict ? {
            templateConflict: true,
            templateConflictLabel: normalizeString(diagnostic?.templateConflictLabel),
            templateConflictMessage: normalizeString(diagnostic?.templateConflictMessage),
        } : {}),
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
        ...(normalizeString(diagnostic?.reopenSourceResolutionTitle)
            ? { reopenSourceResolutionTitle: normalizeString(diagnostic.reopenSourceResolutionTitle) }
            : {}),
        ...(normalizeString(diagnostic?.reopenSourceResolutionText)
            ? { reopenSourceResolutionText: normalizeString(diagnostic.reopenSourceResolutionText) }
            : {}),
        ...(Array.isArray(diagnostic?.reopenSourceResolutionChips) && diagnostic.reopenSourceResolutionChips.length > 0
            ? { reopenSourceResolutionChips: diagnostic.reopenSourceResolutionChips.filter(Boolean) }
            : {}),
        ...(Array.isArray(diagnostic?.reopenSourceResolutionSources) && diagnostic.reopenSourceResolutionSources.length > 0
            ? {
                reopenSourceResolutionSources: diagnostic.reopenSourceResolutionSources
                    .map((entry) => buildReportBuilderReopenSourceResolutionEntry(entry?.source || entry, {
                        id: entry?.id,
                        label: entry?.label,
                    }))
                    .filter(Boolean),
            }
            : {}),
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
        ...(Array.isArray(summary.semanticBindingFieldGroups) && summary.semanticBindingFieldGroups.length > 0
            ? { semanticBindingFieldGroups: summary.semanticBindingFieldGroups }
            : {}),
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

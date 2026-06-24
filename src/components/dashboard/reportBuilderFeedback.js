import { buildReportBuilderSemanticBindingViewStateFromReportSpec } from "./reportBuilderSemanticBindingViewState.js";
import { buildReportBuilderSemanticBindingViewState } from "./reportBuilderSemanticBindingViewState.js";
import { buildReportBuilderScopeSummaryFromParams } from "./reportBuilderDocumentBlocks.js";
import { resolveReportBuilderListReportDocumentsResponseEntry } from "./reportBuilderReportDocumentReadResponse.js";
import {
    resolveNormalizedReportSpecDocumentContext,
    resolveNormalizedSavedReportRecordContext,
    resolvePreferredScopeParams,
} from "./reportBuilderSavedRecordMetadataContext.js";
import {
    hasReportBuilderBindingContent as hasBindingContent,
    hasReportBuilderMetadataContextContent as hasCompanionMetadataContext,
    hasReportBuilderScopeParamsContent as hasScopeContent,
    hasReportBuilderSemanticSummaryContent as hasSemanticSummaryContent,
    isReportBuilderPlainObject as isPlainObject,
} from "./reportBuilderMetadataContent.js";
import {
    buildReportBuilderTemplateIdentityConflict,
    resolveReportBuilderTemplateIdentity,
} from "./reportBuilderTemplateIdentity.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function formatCountChip(count = 0, singular = "", plural = "") {
    const numeric = Number(count || 0) || 0;
    if (numeric <= 0) {
        return "";
    }
    return `${numeric} ${numeric === 1 ? singular : plural}`;
}

function resolveImportedListResponseEntry(imported = null) {
    return resolveReportBuilderListReportDocumentsResponseEntry(imported?.payload || null, {
        selectedEntryKey: imported?.selectedEntryKey || imported?.selectedReportId || "",
        selectedReportId: imported?.selectedReportId || "",
        fallbackToFirst: true,
    });
}

function resolveImportedDerivedGetResponse(imported = null) {
    const response = imported?.getReportDocumentResponse;
    return response && typeof response === "object" && !Array.isArray(response)
        ? response
        : null;
}

function hasReportSpecContext(value = null) {
    return isPlainObject(value) && Object.keys(value).length > 0;
}

function buildImportedInlineReportSpec(value = null) {
    if (isPlainObject(value?.reportSpec)) {
        return value.reportSpec;
    }
    if (
        !hasSemanticSummaryContent(value?.semanticSummary)
        && !hasBindingContent(value?.binding)
        && !hasScopeContent(value)
    ) {
        return null;
    }
    return {
        version: 1,
        kind: "reportSpec",
        title: normalizeString(value?.title || value?.reportRef?.reportId || ""),
        ...(hasBindingContent(value?.binding) ? { binding: value.binding } : {}),
        ...(hasSemanticSummaryContent(value?.semanticSummary) ? { semanticSummary: value.semanticSummary } : {}),
        ...(Array.isArray(value?.scope?.params) && hasScopeContent(value) ? { scope: value.scope } : {}),
    };
}

function resolveImportedReportSpecContext(imported = null) {
    const kind = normalizeString(imported?.kind);
    switch (kind) {
        case "reportBuilder.savedReportRecord":
            return resolveNormalizedSavedReportRecordContext(imported?.savedRecord || null)?.reportSpec || null;
        case "reportBuilder.explorationArtifact": {
            const payloadContext = resolveNormalizedReportSpecDocumentContext({
                reportSpec: imported?.payload?.reportSpec || imported?.savedReportPayload?.reportSpec || null,
                document: imported?.payload?.document || null,
                title: imported?.payload?.title || imported?.savedReportPayload?.title || "",
            });
            if (payloadContext?.reportSpec) {
                return payloadContext.reportSpec;
            }
            return resolveNormalizedSavedReportRecordContext({
                savedReportPayload: imported?.savedReportPayload || null,
                title: imported?.savedReportPayload?.title || "",
            })?.reportSpec || null;
        }
        case "reportBuilder.savedReportPayload":
            return resolveNormalizedSavedReportRecordContext({
                savedReportPayload: imported?.payload || null,
                title: imported?.payload?.title || "",
            })?.reportSpec || null;
        case "reportSpec":
            return resolveNormalizedReportSpecDocumentContext({
                reportSpec: imported?.payload || null,
                title: imported?.payload?.title || "",
            })?.reportSpec || null;
        case "reportExportRequest":
            return resolveNormalizedReportSpecDocumentContext({
                reportSpec: imported?.payload?.reportSpec || null,
                title: imported?.payload?.source?.title || imported?.payload?.reportSpec?.title || "",
            })?.reportSpec || null;
        case "getReportDocumentResponse":
            return resolveNormalizedReportSpecDocumentContext({
                reportSpec: imported?.payload?.reportSpec || null,
                document: imported?.payload?.document || null,
                title: imported?.payload?.document?.title || imported?.payload?.reportRef?.reportId || "",
            })?.reportSpec || null;
        case "listReportDocumentsResponse": {
            const entry = resolveImportedListResponseEntry(imported);
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
                return null;
            }
            const entryContext = resolveNormalizedReportSpecDocumentContext({
                reportSpec: buildImportedInlineReportSpec(entry),
                document: entry?.document || null,
                title: entry?.title || entry?.reportRef?.reportId || "",
            });
            if (hasReportSpecContext(entryContext?.reportSpec)) {
                return entryContext.reportSpec;
            }
            return null;
        }
        case "createReportDocumentPayload":
        case "updateReportDocumentPayload": {
            const payloadContext = resolveNormalizedReportSpecDocumentContext({
                reportSpec: imported?.payload?.reportSpec || null,
                document: imported?.payload?.document || null,
                title: imported?.payload?.title || imported?.payload?.reportRef?.reportId || "",
            });
            if (payloadContext?.reportSpec) {
                return payloadContext.reportSpec;
            }
            const derivedGetResponse = resolveImportedDerivedGetResponse(imported);
            return resolveNormalizedReportSpecDocumentContext({
                reportSpec: derivedGetResponse?.reportSpec || null,
                document: derivedGetResponse?.document || null,
                title: derivedGetResponse?.document?.title || derivedGetResponse?.reportRef?.reportId || "",
            })?.reportSpec || null;
        }
        default:
            return null;
    }
}

function resolveImportedMetadataContext(imported = null) {
    const kind = normalizeString(imported?.kind);
    switch (kind) {
        case "reportBuilder.savedReportRecord":
            return resolveNormalizedSavedReportRecordContext(imported?.savedRecord || null);
        case "reportBuilder.explorationArtifact": {
            const payloadContext = resolveNormalizedReportSpecDocumentContext({
                reportSpec: imported?.payload?.reportSpec || imported?.savedReportPayload?.reportSpec || null,
                document: imported?.payload?.document || null,
                title: imported?.payload?.title || imported?.savedReportPayload?.title || "",
            });
            if (hasCompanionMetadataContext(payloadContext)) {
                return payloadContext;
            }
            return resolveNormalizedSavedReportRecordContext({
                savedReportPayload: imported?.savedReportPayload || null,
                title: imported?.savedReportPayload?.title || "",
            });
        }
        case "reportBuilder.savedReportPayload":
            return resolveNormalizedSavedReportRecordContext({
                savedReportPayload: imported?.payload || null,
                title: imported?.payload?.title || "",
            });
        case "reportSpec":
            return resolveNormalizedReportSpecDocumentContext({
                reportSpec: imported?.payload || null,
                title: imported?.payload?.title || "",
            });
        case "reportExportRequest":
            return resolveNormalizedReportSpecDocumentContext({
                reportSpec: imported?.payload?.reportSpec || null,
                title: imported?.payload?.source?.title || imported?.payload?.reportSpec?.title || "",
            });
        case "getReportDocumentResponse": {
            return resolveNormalizedReportSpecDocumentContext({
                reportSpec: imported?.payload?.reportSpec || null,
                document: imported?.payload?.document || null,
                title: imported?.payload?.document?.title || imported?.payload?.reportRef?.reportId || "",
            });
        }
        case "listReportDocumentsResponse":
            {
                const entry = resolveImportedListResponseEntry(imported);
                if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
                    return null;
                }
                const entryContext = resolveNormalizedReportSpecDocumentContext({
                    reportSpec: buildImportedInlineReportSpec(entry),
                    document: entry?.document || null,
                    title: entry?.title || entry?.reportRef?.reportId || "",
                });
                return hasCompanionMetadataContext(entryContext) ? entryContext : null;
            }
        case "createReportDocumentPayload":
        case "updateReportDocumentPayload": {
            const payloadContext = resolveNormalizedReportSpecDocumentContext({
                reportSpec: imported?.payload?.reportSpec || null,
                document: imported?.payload?.document || null,
                title: imported?.payload?.title || imported?.payload?.reportRef?.reportId || "",
            });
            const derivedGetResponse = resolveImportedDerivedGetResponse(imported);
            const derivedContext = resolveNormalizedReportSpecDocumentContext({
                reportSpec: derivedGetResponse?.reportSpec || null,
                document: derivedGetResponse?.document || null,
                title: derivedGetResponse?.document?.title || derivedGetResponse?.reportRef?.reportId || "",
            });
            return (hasCompanionMetadataContext(payloadContext) ? payloadContext : null)
                || (hasCompanionMetadataContext(derivedContext) ? derivedContext : null)
                || payloadContext?.document
                || null;
        }
        default:
            return null;
    }
}

function buildImportedFeedbackMetaChips(imported = null, reportSpecContext = null) {
    const kind = normalizeString(imported?.kind);
    const specBlockCount = Array.isArray(reportSpecContext?.blocks) ? reportSpecContext.blocks.length : 0;
    const specDatasetCount = Array.isArray(reportSpecContext?.datasets) ? reportSpecContext.datasets.length : 0;
    const exportRequestDiagnostics = Array.isArray(imported?.payload?.__validationErrors)
        ? imported.payload.__validationErrors
        : [];
    const exportRequestInvalidContractCount = exportRequestDiagnostics.filter((entry) => normalizeString(entry?.code) === "invalidContract").length;
    const templateConflict = resolveImportedTemplateConflict(imported);
    switch (kind) {
        case "reportBuilder.savedReportRecord":
            return [
                Number(imported?.documentVersion || 0) > 0 ? `v${Number(imported.documentVersion)}` : "",
                imported?.exportable === true ? "export-ready" : "reopen-ready",
                templateConflict?.label || "",
                formatCountChip(specBlockCount, "block", "blocks"),
                formatCountChip(specDatasetCount, "dataset", "datasets"),
            ].filter(Boolean);
        case "reportBuilder.explorationArtifact":
        case "reportBuilder.savedReportPayload":
        case "reportSpec":
            return [
                formatCountChip(specBlockCount, "block", "blocks"),
                formatCountChip(specDatasetCount, "dataset", "datasets"),
            ].filter(Boolean);
        case "reportFill":
            return [
                formatCountChip(imported?.datasetCount, "dataset", "datasets"),
                formatCountChip(imported?.blockCount, "block", "blocks"),
                formatCountChip(imported?.rowCount, "row", "rows"),
            ].filter(Boolean);
        case "reportPrint":
            return [
                formatCountChip(imported?.pageCount, "page", "pages"),
                formatCountChip(imported?.bookmarkCount, "bookmark", "bookmarks"),
                Number(imported?.pageWidth || 0) > 0 && Number(imported?.pageHeight || 0) > 0
                    ? `${Number(imported.pageWidth)} x ${Number(imported.pageHeight)}`
                    : "",
            ].filter(Boolean);
        case "reportExportRequest":
            return [
                normalizeString(imported?.from),
                normalizeString(imported?.format),
                formatCountChip(exportRequestInvalidContractCount, "contract issue", "contract issues"),
            ].filter(Boolean);
        case "getReportDocumentResponse":
        case "reportDocument":
            return [
                Number(imported?.documentVersion || 0) > 0 ? `v${Number(imported.documentVersion)}` : "",
                templateConflict?.label || "",
            ].filter(Boolean);
        case "listReportDocumentsResponse":
            return [
                formatCountChip(imported?.entryCount, "entry", "entries"),
                imported?.payload?.hasMore === true ? "has-more" : "",
            ].filter(Boolean);
        case "createReportDocumentPayload":
            return [
                normalizeString(imported?.payload?.compileState?.status),
                formatCountChip(imported?.payload?.compileState?.blockCount, "block", "blocks"),
                formatCountChip(imported?.payload?.compileState?.datasetCount, "dataset", "datasets"),
            ].filter(Boolean);
        case "updateReportDocumentPayload":
            return [
                Number(imported?.expectedVersion || 0) > 0 ? `expected v${Number(imported.expectedVersion)}` : "",
                normalizeString(imported?.payload?.compileState?.status),
                formatCountChip(imported?.payload?.compileState?.blockCount, "block", "blocks"),
                formatCountChip(imported?.payload?.compileState?.datasetCount, "dataset", "datasets"),
            ].filter(Boolean);
        case "getReportDocumentRequest":
            return [
                normalizeString(imported?.payload?.reportRef?.reportId),
            ].filter(Boolean);
        default:
            return [];
    }
}

function resolveImportedTemplateConflict(imported = null) {
    const kind = normalizeString(imported?.kind);
    if (kind === "getReportDocumentResponse" || kind === "reportDocument") {
        const payload = isPlainObject(imported?.payload) ? imported.payload : null;
        const directTemplateIdentity = resolveReportBuilderTemplateIdentity(payload, null);
        const document = isPlainObject(payload?.document) ? payload.document : payload;
        const embeddedTemplateIdentity = resolveReportBuilderTemplateIdentity(null, document);
        return buildReportBuilderTemplateIdentityConflict(directTemplateIdentity, embeddedTemplateIdentity, {
            primaryRole: "Imported artifact",
            secondaryRole: "embedded report document",
        });
    }
    if (kind === "reportBuilder.savedReportRecord") {
        const savedRecord = isPlainObject(imported?.savedRecord) ? imported.savedRecord : null;
        const directTemplateIdentity = resolveReportBuilderTemplateIdentity(savedRecord, null);
        const document = isPlainObject(savedRecord?.document)
            ? savedRecord.document
            : (isPlainObject(savedRecord?.savedReportPayload?.reportDocument) ? savedRecord.savedReportPayload.reportDocument : null);
        const embeddedTemplateIdentity = resolveReportBuilderTemplateIdentity(null, document);
        return buildReportBuilderTemplateIdentityConflict(directTemplateIdentity, embeddedTemplateIdentity, {
            primaryRole: "Imported artifact",
            secondaryRole: "embedded report document",
        });
    }
    return null;
}

export function buildReportBuilderImportFeedback(imported = null) {
    if (!imported || typeof imported !== "object" || Array.isArray(imported) || imported.valid === false) {
        return null;
    }
    const reportSpecContext = resolveImportedReportSpecContext(imported);
    const metadataContext = resolveImportedMetadataContext(imported);
    const semanticBindingViewState = buildReportBuilderSemanticBindingViewState({
        semanticSummary: metadataContext?.semanticSummary || null,
        binding: metadataContext?.binding || null,
    }) || buildReportBuilderSemanticBindingViewStateFromReportSpec(reportSpecContext);
    const scopeSummary = buildReportBuilderScopeSummaryFromParams(
        resolvePreferredScopeParams(
            metadataContext?.scopeParams,
            metadataContext?.scope?.params,
        ),
    );
    const templateConflict = resolveImportedTemplateConflict(imported);
    const explicitLevel = normalizeString(imported?.feedbackLevel);
    const baseMessage = normalizeString(imported?.message || (normalizeString(imported?.kind) ? `Imported ${normalizeString(imported.kind)}.` : "Imported report file."));
    return {
        level: explicitLevel || (templateConflict ? "warning" : "success"),
        message: templateConflict && !explicitLevel
            ? `${baseMessage} ${templateConflict.message}`
            : baseMessage,
        metaChips: buildImportedFeedbackMetaChips(imported, reportSpecContext),
        ...(templateConflict ? {
            templateConflictLabel: templateConflict.label,
            templateConflictMessage: templateConflict.message,
        } : {}),
        ...(Array.isArray(imported?.payload?.__validationErrors) && imported.payload.__validationErrors.length > 0
            ? {
                validationDiagnostics: imported.payload.__validationErrors
                    .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
                    .map((entry, index) => ({
                        id: normalizeString(entry?.id || `${normalizeString(entry?.code || "diagnostic")}:${index}`),
                        code: normalizeString(entry?.code),
                        path: normalizeString(entry?.path),
                        message: normalizeString(entry?.message),
                    }))
                    .filter((entry) => entry.message),
            }
            : {}),
        ...(semanticBindingViewState ? {
            semanticBindingTitle: semanticBindingViewState.title,
            semanticBindingChips: semanticBindingViewState.chips,
            ...(Array.isArray(semanticBindingViewState.fieldGroups) && semanticBindingViewState.fieldGroups.length > 0
                ? { semanticBindingFieldGroups: semanticBindingViewState.fieldGroups }
                : {}),
        } : {}),
        ...(Array.isArray(scopeSummary?.items) && scopeSummary.items.length > 0 ? {
            scopeSummaryTitle: "Report Scope",
            scopeSummaryText: scopeSummary.text,
            scopeSummaryItems: scopeSummary.items,
        } : {}),
    };
}

export function buildReportBuilderSelectedGetResponseFeedback({
    response = null,
} = {}) {
    if (!response || typeof response !== "object" || Array.isArray(response)) {
        return null;
    }
    const title = normalizeString(response?.reportRef?.reportId || response?.document?.title || "Report") || "Report";
    const context = resolveNormalizedReportSpecDocumentContext({
        reportSpec: response?.reportSpec || null,
        document: response?.document || null,
        title,
    });
    const semanticBindingViewState = buildReportBuilderSemanticBindingViewState({
        semanticSummary: context?.semanticSummary || null,
        binding: context?.binding || null,
    });
    const scopeSummary = buildReportBuilderScopeSummaryFromParams(
        resolvePreferredScopeParams(context?.scopeParams, context?.scope?.params),
    );
    const compileDiagnostics = Array.isArray(response?.compileState?.diagnostics) ? response.compileState.diagnostics : [];
    const templateConflictDiagnostic = compileDiagnostics.find((entry) => normalizeString(entry?.code) === "selectedGetTemplateIdentityConflict") || null;
    const templateLabel = normalizeString(response?.templateLabel || response?.document?.templateLabel);
    return {
        level: templateConflictDiagnostic ? "warning" : "success",
        message: templateConflictDiagnostic
            ? `Prepared reopen bundle for ${title}. ${normalizeString(templateConflictDiagnostic.message)}`
            : `Prepared reopen bundle for ${title}. Review or download it when needed.`,
        metaChips: [
            Number(response?.documentVersion || 0) > 0 ? `v${Number(response.documentVersion)}` : "",
            templateLabel,
            templateConflictDiagnostic ? "template mismatch" : "",
        ].filter(Boolean),
        ...(semanticBindingViewState ? {
            semanticBindingTitle: semanticBindingViewState.title,
            semanticBindingChips: semanticBindingViewState.chips,
            ...(Array.isArray(semanticBindingViewState.fieldGroups) && semanticBindingViewState.fieldGroups.length > 0
                ? { semanticBindingFieldGroups: semanticBindingViewState.fieldGroups }
                : {}),
        } : {}),
        ...(Array.isArray(scopeSummary?.items) && scopeSummary.items.length > 0 ? {
            scopeSummaryTitle: "Report Scope",
            scopeSummaryText: scopeSummary.text,
            scopeSummaryItems: scopeSummary.items,
        } : {}),
    };
}

export function buildReportBuilderListEntryCompatibilityFeedback({
    selectedEntry = null,
    diagnostic = null,
} = {}) {
    if (diagnostic && typeof diagnostic === "object" && !Array.isArray(diagnostic)) {
        return {
            level: "warning",
            message: `Prepared reopen diagnostic for ${normalizeString(diagnostic?.title || diagnostic?.reportRef?.reportId || "Report") || "Report"}. Review or download it when needed.`,
            metaChips: [
                normalizeString(diagnostic?.reportRef?.reportId),
                normalizeString(diagnostic?.code),
                normalizeString(diagnostic?.severity),
            ].filter(Boolean),
        };
    }
    if (!selectedEntry || typeof selectedEntry !== "object" || Array.isArray(selectedEntry)) {
        return {
            level: "info",
            message: "The selected catalog entry is compatible with the current builder target.",
        };
    }
    if (selectedEntry.templateConflict) {
        return {
            level: "warning",
            message: `Selected catalog entry ${normalizeString(selectedEntry?.title || selectedEntry?.reportId || "Report") || "Report"} has a template mismatch with its local backing report file. ${normalizeString(selectedEntry?.templateConflictMessage)}`,
            metaChips: [
                normalizeString(selectedEntry?.templateLabel),
                normalizeString(selectedEntry?.templateConflictLabel),
                normalizeString(selectedEntry?.backingState),
                normalizeString(selectedEntry?.backingSource),
                normalizeString(selectedEntry?.backingArtifactKindLabel),
            ].filter(Boolean),
            ...(selectedEntry?.semanticBindingTitle ? { semanticBindingTitle: selectedEntry.semanticBindingTitle } : {}),
            ...(Array.isArray(selectedEntry?.semanticBindingChips) ? { semanticBindingChips: selectedEntry.semanticBindingChips } : {}),
            ...(Array.isArray(selectedEntry?.semanticBindingFieldGroups) ? { semanticBindingFieldGroups: selectedEntry.semanticBindingFieldGroups } : {}),
            ...(selectedEntry?.scopeSummaryTitle ? { scopeSummaryTitle: selectedEntry.scopeSummaryTitle } : {}),
            ...(selectedEntry?.scopeSummaryText ? { scopeSummaryText: selectedEntry.scopeSummaryText } : {}),
            ...(Array.isArray(selectedEntry?.scopeSummaryItems) ? { scopeSummaryItems: selectedEntry.scopeSummaryItems } : {}),
        };
    }
    return {
        level: "info",
        message: "The selected catalog entry is compatible with the current builder target.",
        metaChips: [
            normalizeString(selectedEntry?.templateLabel),
            normalizeString(selectedEntry?.backingState),
            normalizeString(selectedEntry?.backingSource),
            normalizeString(selectedEntry?.backingArtifactKindLabel),
        ].filter(Boolean),
    };
}

function describePreparedReadiness(preparedReadiness = {}, successPrefix = "Applied this preset.") {
    if (!preparedReadiness || preparedReadiness.canRun) {
        return successPrefix;
    }
    if (preparedReadiness.reason === "semantic") {
        const readinessMessage = normalizeString(preparedReadiness.message);
        if (readinessMessage) {
            return `${successPrefix} ${readinessMessage}`;
        }
    }
    return `${successPrefix} Resolve semantic field issues before refreshing results.`;
}

export function buildReportBuilderSemanticStatusFeedback({
    semanticStatus = null,
    readiness = {},
} = {}) {
    const level = normalizeString(semanticStatus?.level || "info") || "info";
    const title = normalizeString(semanticStatus?.title);
    const message = normalizeString(semanticStatus?.message);
    if (!message) {
        return null;
    }
    const action = normalizeString(readiness?.action);
    return {
        level,
        message: title ? `${title}: ${message}` : message,
        actionLabel: action === "retrySemanticModelLoad" ? "Retry model load" : "",
        action: action === "retrySemanticModelLoad" ? action : "",
    };
}

export function buildReportBuilderSemanticValidationFeedback({
    readiness = {},
    semanticStatusLevel = "",
    semanticSelectedIssueCount = 0,
    semanticSelectionValidationState = {},
} = {}) {
    if (
        Number(semanticSelectedIssueCount || 0) !== 0
        || normalizeString(readiness?.reason) !== "semantic"
        || !normalizeString(readiness?.message)
        || normalizeString(semanticStatusLevel).toLowerCase() !== "info"
    ) {
        return null;
    }
    const action = normalizeString(readiness?.action);
    const hasValidationError = !!normalizeString(semanticSelectionValidationState?.error)
        || semanticSelectionValidationState?.valid === false;
    return {
        level: hasValidationError ? "danger" : "info",
        message: `Semantic validation: ${normalizeString(readiness.message)}`,
        actionLabel: action === "retrySemanticValidation" ? "Retry validation" : "",
        action: action === "retrySemanticValidation" ? action : "",
    };
}

export function buildReportBuilderSemanticIssueFeedback({
    readiness = {},
    semanticFieldValidationMessage = "",
    semanticSelectedIssueCount = 0,
} = {}) {
    if (
        Number(semanticSelectedIssueCount || 0) <= 0
        || normalizeString(readiness?.reason) !== "semantic"
    ) {
        return null;
    }
    return {
        level: "danger",
        message: `Semantic selection issue: ${normalizeString(semanticFieldValidationMessage) || "Resolve semantic field issues before running the report."}`,
        actionLabel: "",
        action: "",
    };
}

export function buildReportBuilderSemanticInlineNotices({
    semanticStatus = null,
    readiness = {},
    semanticFieldValidationMessage = "",
    semanticSelectedIssueCount = 0,
    semanticSelectionValidationState = {},
} = {}) {
    return [
        buildReportBuilderSemanticStatusFeedback({
            semanticStatus,
            readiness,
        }),
        buildReportBuilderSemanticIssueFeedback({
            readiness,
            semanticFieldValidationMessage,
            semanticSelectedIssueCount,
        }),
        buildReportBuilderSemanticValidationFeedback({
            readiness,
            semanticStatusLevel: semanticStatus?.level,
            semanticSelectedIssueCount,
            semanticSelectionValidationState,
        }),
    ].filter(Boolean);
}

export function buildReportBuilderBulkImportFeedback({
    kind = "",
    count = 0,
    clearedCurrentGetResponse = false,
    clearedCurrentSavedRecord = false,
} = {}) {
    const normalizedKind = normalizeString(kind);
    if (!normalizedKind || Number(count || 0) <= 0) {
        return null;
    }
    if (normalizedKind === "reopenables") {
        return {
            level: "info",
            message: "Cleared imported reopen artifacts.",
            metaChips: [
                formatCountChip(count, "artifact", "artifacts"),
                clearedCurrentGetResponse ? "active reopen artifact cleared" : "",
            ].filter(Boolean),
        };
    }
    if (normalizedKind === "savedRecords") {
        return {
            level: "info",
            message: "Cleared imported report files.",
            metaChips: [
                formatCountChip(count, "record", "records"),
                clearedCurrentSavedRecord ? "active report file cleared" : "",
                clearedCurrentGetResponse ? "active get response cleared" : "",
            ].filter(Boolean),
        };
    }
    return null;
}

export function buildReportBuilderPresetApplyFeedback({
    kind = "chart",
    presetTitle = "",
    changedParts = [],
    selectionChanged = false,
    didFetchPreparedState = false,
    preparedReadiness = {},
    requiresManualRun = false,
} = {}) {
    const normalizedKind = normalizeString(kind).toLowerCase();
    const changedText = (Array.isArray(changedParts) ? changedParts : []).filter(Boolean).join(" and ");
    if (normalizedKind === "tablecalc") {
        const successPrefix = `Added ${normalizeString(presetTitle) || "this table calculation"}.`;
        if (!selectionChanged) {
            return {
                level: "info",
                message: successPrefix,
            };
        }
        return {
            level: "info",
            message: didFetchPreparedState
                ? `${successPrefix} Refreshing results.`
                : !preparedReadiness.canRun
                    ? describePreparedReadiness(preparedReadiness, successPrefix)
                    : requiresManualRun
                        ? `${successPrefix} Run to refresh results.`
                        : successPrefix,
            action: requiresManualRun && preparedReadiness.canRun ? "runReport" : "",
        };
    }
    if (normalizedKind === "table") {
        const successPrefix = `Applied ${normalizeString(presetTitle) || "this table preset"}.`;
        if (!selectionChanged) {
            return {
                level: "info",
                message: successPrefix,
            };
        }
        return {
            level: "info",
            message: didFetchPreparedState
                ? `${successPrefix} Refreshing results.`
                : !preparedReadiness.canRun
                    ? describePreparedReadiness(preparedReadiness, successPrefix)
                    : requiresManualRun
                        ? `${successPrefix} Run to refresh results.`
                        : successPrefix,
            action: requiresManualRun && preparedReadiness.canRun ? "runReport" : "",
        };
    }
    if (!selectionChanged) {
        return null;
    }
    const successPrefix = `Applied this preset's required ${changedText || "chart settings"}.`;
    return {
        level: "info",
        message: didFetchPreparedState
            ? `${successPrefix} Refreshing results.`
            : !preparedReadiness.canRun
                ? describePreparedReadiness(preparedReadiness, successPrefix)
                : requiresManualRun
                    ? `${successPrefix} Run to refresh results.`
                    : successPrefix,
        action: requiresManualRun && preparedReadiness.canRun ? "runReport" : "",
    };
}

export function resolveCompactChartSheetNotice({
    chartApplyFeedback = null,
    semanticSelectedIssueCount = 0,
    semanticFieldValidationMessage = "",
    readinessReason = "",
    readinessMessage = "",
    semanticStatusLevel = "",
    semanticSelectionValidationError = "",
    semanticSelectionValidationValid = null,
    showingChartView = false,
    activeTablePresetTitle = "",
    modifiedTablePresetTitle = "",
} = {}) {
    if (chartApplyFeedback?.message) {
        return {
            level: chartApplyFeedback.level || "warning",
            message: chartApplyFeedback.message,
        };
    }
    if (Number(semanticSelectedIssueCount || 0) > 0 && readinessReason === "semantic") {
        return {
            level: "danger",
            message: `Semantic selection issue: ${normalizeString(semanticFieldValidationMessage) || "Resolve semantic field issues before running the report."}`,
        };
    }
    if (
        Number(semanticSelectedIssueCount || 0) === 0
        && readinessReason === "semantic"
        && normalizeString(readinessMessage)
        && normalizeString(semanticStatusLevel).toLowerCase() === "info"
    ) {
        return {
            level: normalizeString(semanticSelectionValidationError) || semanticSelectionValidationValid === false ? "danger" : "info",
            message: `Semantic validation: ${normalizeString(readinessMessage)}`,
        };
    }
    if (!showingChartView) {
        if (normalizeString(activeTablePresetTitle)) {
            return {
                level: "info",
                message: `Active table preset: ${normalizeString(activeTablePresetTitle)}`,
            };
        }
        if (normalizeString(modifiedTablePresetTitle)) {
            return {
                level: "warning",
                message: `Modified from ${normalizeString(modifiedTablePresetTitle)}. Use Quick view to restore the named table preset.`,
            };
        }
    }
    return null;
}

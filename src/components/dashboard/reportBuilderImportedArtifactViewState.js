import { buildReportBuilderExportArtifactKindLabel } from "./reportBuilderExportRequest.js";
import {
    buildReportBuilderExportActionState,
    buildReportBuilderExportJobPanelState,
    buildReportBuilderExportRequestPanelState,
} from "./reportBuilderExportViewState.js";
import { buildReportBuilderExportFailureNotice as buildLifecycleExportFailureNotice } from "./reportBuilderExportLifecycle.js";
import { buildReportBuilderImportedArtifactSourceLabel } from "./reportBuilderImportedArtifactLabels.js";
import {
    buildReportBuilderSemanticBindingViewState,
} from "./reportBuilderSemanticBindingViewState.js";
import { buildReportBuilderScopeSummaryFromParams } from "./reportBuilderDocumentBlocks.js";
import {
    resolveNormalizedReportSpecDocumentContext,
    resolveNormalizedSavedReportRecordContext,
} from "./reportBuilderSavedRecordMetadataContext.js";
import {
    summarizeReportBuilderAuthoredBlocks,
    summarizeReportBuilderAuthoredDrillMetadata,
} from "./reportBuilderAuthoredBlockSummary.js";
import {
    hasReportBuilderBindingContent as hasBindingContent,
    hasReportBuilderMetadataContextContent as hasSemanticMetadataContext,
    hasReportBuilderSemanticSummaryContent as hasSemanticSummaryContent,
    isReportBuilderPlainObject as isPlainObject,
} from "./reportBuilderMetadataContent.js";
import {
    buildReportBuilderTemplateConflictState,
    buildReportBuilderTemplateIdentityConflict,
    resolveEmbeddedReportBuilderTemplateIdentity,
    resolveReportBuilderTemplateIdentity,
} from "./reportBuilderTemplateIdentity.js";
import { buildSavedViewOverlaySummary } from "../../reporting/views/savedViewOverlayModel.js";
import { resolveReportBuilderSavedViewOverlayReopenSourceResolution } from "./reportBuilderReopenSourceResolution.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value = null) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function formatCountChip(count = 0, singular = "", plural = "") {
    const numeric = Number(count || 0) || 0;
    if (numeric <= 0) {
        return "";
    }
    return `${numeric} ${numeric === 1 ? singular : plural}`;
}

function buildRawImportedEntryMetadataContext(entry = null) {
    if (!isPlainObject(entry)) {
        return null;
    }
    const scopeParams = Array.isArray(entry?.scopeParams) && entry.scopeParams.length > 0
        ? entry.scopeParams
        : (Array.isArray(entry?.scope?.params) ? entry.scope.params : []);
    const semanticSummary = hasSemanticSummaryContent(entry?.semanticSummary)
        ? entry.semanticSummary
        : null;
    const binding = hasBindingContent(entry?.binding)
        ? entry.binding
        : null;
    if (!semanticSummary && !binding && scopeParams.length === 0) {
        return null;
    }
    return {
        ...(semanticSummary ? { semanticSummary } : {}),
        ...(binding ? { binding } : {}),
        ...(scopeParams.length > 0 ? { scopeParams } : {}),
    };
}

function buildSemanticBindingViewStateFromMetadataContext(metadataContext = null) {
    if (!hasSemanticSummaryContent(metadataContext?.semanticSummary) && !hasBindingContent(metadataContext?.binding)) {
        return null;
    }
    return buildReportBuilderSemanticBindingViewState({
        semanticSummary: metadataContext?.semanticSummary || null,
        binding: metadataContext?.binding || null,
    });
}

function normalizeSemanticBindingViewState(value = null) {
    if (!isPlainObject(value)) {
        return null;
    }
    const title = normalizeString(value?.title);
    const chips = Array.isArray(value?.chips)
        ? value.chips.map((chip) => normalizeString(chip)).filter(Boolean)
        : [];
    const fieldGroups = Array.isArray(value?.fieldGroups)
        ? value.fieldGroups
            .filter((group) => isPlainObject(group))
            .map((group) => {
                const id = normalizeString(group?.id);
                const groupTitle = normalizeString(group?.title);
                const fields = Array.isArray(group?.fields)
                    ? group.fields
                        .filter((field) => isPlainObject(field)
                            && (
                                normalizeString(field?.id)
                                || normalizeString(field?.rawId)
                                || normalizeString(field?.label)
                                || normalizeString(field?.definitionRef)
                            ))
                        .map((field) => cloneValue(field))
                    : [];
                if (!id || !groupTitle || fields.length === 0) {
                    return null;
                }
                return {
                    id,
                    title: groupTitle,
                    fields,
                };
            })
            .filter(Boolean)
        : [];
    if (chips.length === 0 && fieldGroups.length === 0) {
        return null;
    }
    return {
        ...(title ? { title } : { title: "Semantic Binding" }),
        ...(chips.length > 0 ? { chips } : {}),
        ...(fieldGroups.length > 0 ? { fieldGroups } : {}),
    };
}

function resolveImportedSemanticBindingViewState({
    metadataContext = null,
    candidates = [],
} = {}) {
    for (const candidate of (Array.isArray(candidates) ? candidates : [candidates])) {
        const normalized = normalizeSemanticBindingViewState(candidate);
        if (normalized) {
            return normalized;
        }
    }
    return buildSemanticBindingViewStateFromMetadataContext(metadataContext);
}

function buildSemanticBindingViewSection(semanticBindingViewState = null) {
    if (!semanticBindingViewState) {
        return null;
    }
    return {
        semanticBindingTitle: normalizeString(semanticBindingViewState.title || "Semantic Binding") || "Semantic Binding",
        semanticBindingChips: Array.isArray(semanticBindingViewState.chips)
            ? semanticBindingViewState.chips.filter(Boolean)
            : [],
        ...(Array.isArray(semanticBindingViewState.fieldGroups) && semanticBindingViewState.fieldGroups.length > 0
            ? { semanticBindingFieldGroups: semanticBindingViewState.fieldGroups }
            : {}),
    };
}

function resolveImportedEntryMetadataContext(entry = null) {
    if (!isPlainObject(entry)) {
        return null;
    }
    const explicitContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec: entry?.reportSpec || null,
        document: entry?.document || null,
        title: entry?.title || entry?.reportId || "",
    });
    if (hasSemanticMetadataContext(explicitContext)) {
        return explicitContext;
    }
    const savedRecordContext = resolveNormalizedSavedReportRecordContext(entry);
    if (hasSemanticMetadataContext(savedRecordContext)) {
        return savedRecordContext;
    }
    return buildRawImportedEntryMetadataContext(entry);
}

function buildImportedScopeSummary(scopeParams = []) {
    const summary = buildReportBuilderScopeSummaryFromParams(scopeParams);
    return Array.isArray(summary?.items) && summary.items.length > 0
        ? {
            scopeSummaryTitle: "Report Scope",
            scopeSummaryText: summary.text,
            scopeSummaryItems: summary.items,
        }
        : null;
}

function buildImportedAuthoredSummary(metadataContext = null) {
    const documentBlocks = Array.isArray(metadataContext?.document?.blocks) ? metadataContext.document.blocks : [];
    const authoredBlocks = documentBlocks.filter((block) => normalizeString(block?.kind) !== "reportBuilderBlock");
    const authoredSummary = summarizeReportBuilderAuthoredBlocks(authoredBlocks);
    return authoredSummary?.totalCount > 0 ? authoredSummary : null;
}

function buildImportedDrillSummary(metadataContext = null, entry = null) {
    const candidates = [
        metadataContext?.reportSpec,
        ...(Array.isArray(entry?.reportSpecCandidates) ? entry.reportSpecCandidates : []),
        entry?.reportSpec,
        entry?.savedReportPayload?.reportSpec,
    ];
    for (const candidate of candidates) {
        const drillSummary = summarizeReportBuilderAuthoredDrillMetadata(candidate || {});
        if (
            Number(drillSummary?.hierarchyCount || 0) > 0
            || Number(drillSummary?.detailTargetCount || 0) > 0
            || Number(drillSummary?.fieldActionCount || 0) > 0
        ) {
            return drillSummary;
        }
    }
    return null;
}

function buildImportedCompanionReportSpecViewState({
    companionReportSpec = null,
    companionReportDocument = null,
    companionSemanticBindingViewState = null,
} = {}) {
    const companionContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec: companionReportSpec,
        document: companionReportDocument,
    });
    if (!companionContext?.reportSpec && !companionContext?.document) {
        return null;
    }
    const semanticBindingViewState = resolveImportedSemanticBindingViewState({
        metadataContext: companionContext,
        candidates: [
            companionSemanticBindingViewState,
            companionReportSpec?.semanticBindingViewState,
            companionReportDocument?.semanticBindingViewState,
        ],
    });
    const scopeSummary = buildImportedScopeSummary(companionContext?.scopeParams);
    const templateIdentity = resolveReportBuilderTemplateIdentity(
        companionContext?.document || null,
        companionContext?.document || null,
    );
    const templateConflict = buildReportBuilderTemplateConflictState(
        resolveReportBuilderTemplateIdentity(companionContext?.document || null, null),
        resolveEmbeddedReportBuilderTemplateIdentity(companionContext?.document || null),
        {
            primaryRole: "Imported artifact",
            secondaryRole: "embedded report document",
        },
    );
    if (!semanticBindingViewState && !scopeSummary && !templateIdentity && !templateConflict) {
        return null;
    }
    return {
        ...(templateIdentity ? templateIdentity : {}),
        ...(templateConflict ? templateConflict : {}),
        ...(buildSemanticBindingViewSection(semanticBindingViewState) || {}),
        ...(scopeSummary ? scopeSummary : {}),
    };
}

function buildImportedSummaryNoticeState(viewState = null) {
    if (!viewState || typeof viewState !== "object" || Array.isArray(viewState)) {
        return null;
    }
    const templateLabel = normalizeString(viewState?.templateLabel);
    const templateConflictLabel = normalizeString(viewState?.templateConflictLabel);
    const templateConflictMessage = normalizeString(viewState?.templateConflictMessage);
    if (!templateLabel && !templateConflictLabel && !templateConflictMessage) {
        return null;
    }
    return {
        tone: viewState?.templateConflict ? "warning" : "info",
        ...(templateLabel ? { templateLabel } : {}),
        ...(templateConflictLabel ? { templateConflictLabel } : {}),
        ...(templateConflictMessage ? { templateConflictMessage } : {}),
    };
}

function buildImportedSavedViewOverlayState(entry = null, metadataContext = null) {
    if (!isPlainObject(entry)) {
        return null;
    }
    const overlaySummary = buildSavedViewOverlaySummary(entry, {
        document: metadataContext?.document || entry?.document || null,
        reportSpec: metadataContext?.reportSpec || entry?.reportSpec || null,
    });
    return overlaySummary;
}

function buildImportedReopenSourceResolutionState(entry = null, localSavedPayloads = []) {
    if (!isPlainObject(entry?.savedViewOverlay)) {
        return null;
    }
    return resolveReportBuilderSavedViewOverlayReopenSourceResolution(
        entry.savedViewOverlay,
        localSavedPayloads,
    )?.state || null;
}

function buildImportedExecutionContext({
    executionSummary = null,
    requestSummary = null,
} = {}) {
    const executionFieldGroups = Array.isArray(executionSummary?.semanticBindingFieldGroups) && executionSummary.semanticBindingFieldGroups.length > 0
        ? executionSummary.semanticBindingFieldGroups
        : [];
    const requestFieldGroups = Array.isArray(requestSummary?.semanticBindingFieldGroups) && requestSummary.semanticBindingFieldGroups.length > 0
        ? requestSummary.semanticBindingFieldGroups
        : [];
    const executionScopeItems = Array.isArray(executionSummary?.scopeSummaryItems) && executionSummary.scopeSummaryItems.length > 0
        ? executionSummary.scopeSummaryItems
        : [];
    const requestScopeItems = Array.isArray(requestSummary?.scopeSummaryItems) && requestSummary.scopeSummaryItems.length > 0
        ? requestSummary.scopeSummaryItems
        : [];
    return {
        title: normalizeString(executionSummary?.title || requestSummary?.title),
        semanticBindingTitle: normalizeString(executionSummary?.semanticBindingTitle || requestSummary?.semanticBindingTitle),
        semanticBindingChips: Array.isArray(executionSummary?.semanticBindingChips)
            ? executionSummary.semanticBindingChips.filter(Boolean)
            : (Array.isArray(requestSummary?.semanticBindingChips)
                ? requestSummary.semanticBindingChips.filter(Boolean)
                : []),
        semanticBindingFieldGroups: executionFieldGroups.length > 0 ? executionFieldGroups : requestFieldGroups,
        scopeSummaryTitle: normalizeString(executionSummary?.scopeSummaryTitle || requestSummary?.scopeSummaryTitle),
        scopeSummaryText: normalizeString(executionSummary?.scopeSummaryText || requestSummary?.scopeSummaryText),
        scopeSummaryItems: executionScopeItems.length > 0 ? executionScopeItems : requestScopeItems,
    };
}

function buildImportedPipelineRequestMetaChips(runtimeFillSummary = null) {
    return [
        runtimeFillSummary
            ? (runtimeFillSummary.attached ? "Attached ReportFill" : "Preview Fill")
            : "",
        runtimeFillSummary
            ? `${runtimeFillSummary.rowCount} rows`
            : "",
    ].filter(Boolean);
}

export function buildImportedStandaloneExportExecutionConfig({
    request = null,
    localSavedPayloads = [],
    reportExportHandler = null,
    setFeedback = () => {},
} = {}) {
    return {
        request,
        sourceKind: "importedRequest",
        localSavedPayloads,
        reportExportHandler,
        setFeedback,
        missingRequestMessage: "No imported export request is available.",
        missingJobMessage: "No imported export job is available to refresh.",
        missingArtifactMessage: "No completed imported export artifact is available yet.",
    };
}

export function buildImportedPipelineExportExecutionConfig({
    request = null,
    localSavedPayloads = [],
    reportExportHandler = null,
    setFeedback = () => {},
} = {}) {
    return {
        request,
        sourceKind: "imported",
        localSavedPayloads,
        reportExportHandler,
        setFeedback,
        missingRequestMessage: "No imported report export request is available.",
        missingJobMessage: "No imported report export job is available to refresh.",
        missingArtifactMessage: "No completed imported report export artifact is available yet.",
    };
}

export function buildImportedStandaloneExportActionState({
    importedStandaloneExportRequestExecutionSummary = null,
    importedStandaloneExportRequestOpen = false,
    importedStandaloneExportSubmitting = false,
    reportExportHandlerAvailable = false,
} = {}) {
    return buildReportBuilderExportActionState({
        requestSummary: importedStandaloneExportRequestExecutionSummary,
        requestOpen: importedStandaloneExportRequestOpen,
        submitting: importedStandaloneExportSubmitting,
        reportExportHandlerAvailable,
        handlerLabel: "Export snapshot",
        reviewLabel: "Review export",
    });
}

export function buildImportedPipelineExportActionState({
    importedPipelineExportRequestSummary = null,
    importedPipelineExportRequestOpen = false,
    importedPipelineExportSubmitting = false,
    reportExportHandlerAvailable = false,
} = {}) {
    return buildReportBuilderExportActionState({
        requestSummary: importedPipelineExportRequestSummary,
        requestOpen: importedPipelineExportRequestOpen,
        submitting: importedPipelineExportSubmitting,
        reportExportHandlerAvailable,
        handlerLabel: "Export snapshot",
        reviewLabel: "Review export",
    });
}

function buildImportedEntryTemplateConflict(entry = null) {
    if (!isPlainObject(entry)) {
        return null;
    }
    const directTemplateIdentity = resolveReportBuilderTemplateIdentity(entry, null);
    const document = entry?.document && typeof entry.document === "object" && !Array.isArray(entry.document)
        ? entry.document
        : (entry?.savedReportPayload?.reportDocument && typeof entry.savedReportPayload.reportDocument === "object" && !Array.isArray(entry.savedReportPayload.reportDocument)
            ? entry.savedReportPayload.reportDocument
            : null);
    const embeddedTemplateIdentity = resolveEmbeddedReportBuilderTemplateIdentity(document)
        || resolveReportBuilderTemplateIdentity(null, document);
    const conflict = buildReportBuilderTemplateIdentityConflict(directTemplateIdentity, embeddedTemplateIdentity, {
        primaryRole: "Imported artifact",
        secondaryRole: "embedded report document",
    });
    if (!conflict) {
        return null;
    }
    return {
        templateConflict: true,
        templateConflictLabel: conflict.label,
        templateConflictMessage: conflict.message,
    };
}

export function buildImportedLocalReopenablePanelState({
    importedLocalGetReportDocumentResponses = [],
    activeResponseIdentity = "",
    localSavedPayloads = [],
} = {}) {
    const entries = (Array.isArray(importedLocalGetReportDocumentResponses) ? importedLocalGetReportDocumentResponses : [])
        .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
        .map((entry) => {
            const id = normalizeString(entry?.id);
            const title = normalizeString(entry?.title || entry?.reportId);
            const reportId = normalizeString(entry?.reportId);
            if (!id || !title || !reportId) {
                return null;
            }
            const metadataContext = resolveImportedEntryMetadataContext(entry);
            const semanticBindingViewState = resolveImportedSemanticBindingViewState({
                metadataContext,
                candidates: [
                    entry?.semanticBindingViewState,
                    entry?.savedReportPayload?.semanticBindingViewState,
                ],
            });
            const scopeSummary = buildImportedScopeSummary(metadataContext?.scopeParams);
            const authoredSummary = buildImportedAuthoredSummary(metadataContext);
            const drillSummary = buildImportedDrillSummary(metadataContext, entry);
            const templateConflict = buildImportedEntryTemplateConflict(entry);
            const overlaySummary = buildImportedSavedViewOverlayState(entry, metadataContext);
            const reopenSourceResolutionState = buildImportedReopenSourceResolutionState(entry, localSavedPayloads);
            return {
                id,
                title,
                reportId,
                importedArtifactKind: normalizeString(entry?.importedArtifactKind),
                active: normalizeString(activeResponseIdentity) === id,
                metaChips: [
                    reportId,
                    Number(entry?.documentVersion || 0) > 0 ? `v${Number(entry.documentVersion)}` : "local-only",
                    templateConflict?.templateConflictLabel || "",
                    buildReportBuilderExportArtifactKindLabel(entry?.importedArtifactKind),
                    ...(Array.isArray(reopenSourceResolutionState?.reopenSourceResolutionChips)
                        ? reopenSourceResolutionState.reopenSourceResolutionChips
                        : []),
                    ...(Array.isArray(overlaySummary?.chips) ? overlaySummary.chips : []),
                ].filter(Boolean),
                ...(templateConflict ? {
                    notice: {
                        level: "warning",
                        message: templateConflict.templateConflictMessage,
                    },
                } : (Array.isArray(overlaySummary?.diagnostics) && overlaySummary.diagnostics.length > 0
                    ? {
                        notice: {
                            level: "warning",
                            message: overlaySummary.diagnostics[0].message,
                        },
                    }
                    : {})),
                ...(buildSemanticBindingViewSection(semanticBindingViewState) || {}),
                ...(scopeSummary ? scopeSummary : {}),
                ...(authoredSummary ? {
                    authoredBlockCount: authoredSummary.totalCount,
                    authoredBlockSummaryText: authoredSummary.summary,
                } : {}),
                ...(drillSummary ? {
                    drillHierarchyCount: drillSummary.hierarchyCount,
                    detailTargetCount: drillSummary.detailTargetCount,
                    drillSummaryText: drillSummary.summary,
                } : {}),
                ...(overlaySummary ? {
                    savedViewOverlayTitle: overlaySummary.title,
                    savedViewOverlayText: overlaySummary.text,
                    savedViewOverlayChips: overlaySummary.chips,
                    ...(Array.isArray(overlaySummary.diagnostics) && overlaySummary.diagnostics.length > 0
                        ? { savedViewOverlayDiagnostics: overlaySummary.diagnostics }
                        : {}),
                } : {}),
                ...(reopenSourceResolutionState ? reopenSourceResolutionState : {}),
                ...(templateConflict ? templateConflict : {}),
                activateLabel: normalizeString(activeResponseIdentity) === id ? "" : `Use ${title}`,
                removeLabel: `Remove ${title}`,
            };
        })
        .filter(Boolean);
    if (entries.length === 0) {
        return null;
    }
    return {
        title: "Imported reopen artifacts",
        description: "These imported local report artifacts can back imported catalog entries and reopen flows without server persistence.",
        metaChips: [
            formatCountChip(entries.length, "artifact", "artifacts"),
            entries.some((entry) => entry.active) ? "current reopen artifact tracked" : "",
            entries.some((entry) => entry.templateConflict) ? "template mismatch" : "",
            entries.some((entry) => normalizeString(entry?.importedArtifactKind) === "reportBuilder.explorationArtifact")
                ? buildReportBuilderImportedArtifactSourceLabel("reportBuilder.explorationArtifact")
                : "",
        ].filter(Boolean),
        entries,
        clearAllLabel: "Clear imported reopen artifacts",
    };
}

export function buildImportedLocalSavedRecordPanelState({
    importedLocalSavedReportRecords = [],
    activeRecordIdentity = "",
    localSavedPayloads = [],
} = {}) {
    const entries = (Array.isArray(importedLocalSavedReportRecords) ? importedLocalSavedReportRecords : [])
        .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
        .map((entry) => {
            const id = normalizeString(entry?.id);
            const title = normalizeString(entry?.title || entry?.reportId);
            const reportId = normalizeString(entry?.reportId);
            if (!id || !title || !reportId) {
                return null;
            }
            const metadataContext = resolveImportedEntryMetadataContext(entry);
            const semanticBindingViewState = resolveImportedSemanticBindingViewState({
                metadataContext,
                candidates: [
                    entry?.semanticBindingViewState,
                    entry?.savedReportPayload?.semanticBindingViewState,
                ],
            });
            const scopeSummary = buildImportedScopeSummary(metadataContext?.scopeParams);
            const authoredSummary = buildImportedAuthoredSummary(metadataContext);
            const drillSummary = buildImportedDrillSummary(metadataContext, entry);
            const templateConflict = buildImportedEntryTemplateConflict(entry);
            const overlaySummary = buildImportedSavedViewOverlayState(entry, metadataContext);
            const reopenSourceResolutionState = buildImportedReopenSourceResolutionState(entry, localSavedPayloads);
            return {
                id,
                title,
                reportId,
                importedArtifactKind: normalizeString(entry?.importedArtifactKind),
                active: normalizeString(activeRecordIdentity) === id,
                metaChips: [
                    reportId,
                    Number(entry?.documentVersion || 0) > 0 ? `v${Number(entry.documentVersion)}` : "local-only",
                    entry?.exportable === true ? "export-ready" : "reopen-ready",
                    templateConflict?.templateConflictLabel || "",
                    buildReportBuilderExportArtifactKindLabel(entry?.importedArtifactKind),
                    ...(Array.isArray(reopenSourceResolutionState?.reopenSourceResolutionChips)
                        ? reopenSourceResolutionState.reopenSourceResolutionChips
                        : []),
                    ...(Array.isArray(overlaySummary?.chips) ? overlaySummary.chips : []),
                ].filter(Boolean),
                ...(templateConflict ? {
                    notice: {
                        level: "warning",
                        message: templateConflict.templateConflictMessage,
                    },
                } : (Array.isArray(overlaySummary?.diagnostics) && overlaySummary.diagnostics.length > 0
                    ? {
                        notice: {
                            level: "warning",
                            message: overlaySummary.diagnostics[0].message,
                        },
                    }
                    : {})),
                ...(buildSemanticBindingViewSection(semanticBindingViewState) || {}),
                ...(scopeSummary ? scopeSummary : {}),
                ...(authoredSummary ? {
                    authoredBlockCount: authoredSummary.totalCount,
                    authoredBlockSummaryText: authoredSummary.summary,
                } : {}),
                ...(drillSummary ? {
                    drillHierarchyCount: drillSummary.hierarchyCount,
                    detailTargetCount: drillSummary.detailTargetCount,
                    drillSummaryText: drillSummary.summary,
                } : {}),
                ...(overlaySummary ? {
                    savedViewOverlayTitle: overlaySummary.title,
                    savedViewOverlayText: overlaySummary.text,
                    savedViewOverlayChips: overlaySummary.chips,
                    ...(Array.isArray(overlaySummary.diagnostics) && overlaySummary.diagnostics.length > 0
                        ? { savedViewOverlayDiagnostics: overlaySummary.diagnostics }
                        : {}),
                } : {}),
                ...(reopenSourceResolutionState ? reopenSourceResolutionState : {}),
                ...(templateConflict ? templateConflict : {}),
                activateLabel: normalizeString(activeRecordIdentity) === id ? "" : `Use ${title}`,
                removeLabel: `Remove ${title}`,
            };
        })
        .filter(Boolean);
    if (entries.length === 0) {
        return null;
    }
    return {
        title: "Imported report files",
        description: "These imported local report files keep richer reopen and export context available without server persistence.",
        metaChips: [
            formatCountChip(entries.length, "record", "records"),
            entries.some((entry) => entry.active) ? "current report file tracked" : "",
            entries.some((entry) => entry.metaChips.includes("export-ready")) ? "export-ready available" : "",
            entries.some((entry) => entry.templateConflict) ? "template mismatch" : "",
            entries.some((entry) => normalizeString(entry?.importedArtifactKind) === "reportBuilder.explorationArtifact")
                ? buildReportBuilderImportedArtifactSourceLabel("reportBuilder.explorationArtifact")
                : "",
        ].filter(Boolean),
        entries,
        clearAllLabel: "Clear imported report files",
    };
}

export function buildImportedPipelinePreviewPanelState({
    importedPipelineSummary = null,
    importedPipelinePreview = null,
    importedPipelineRuntimeArtifact = null,
    importedPipelineRuntimeConfig = null,
    importedPipelineRuntimeFillSummary = null,
    importedPipelineCompanionFillCompatibility = null,
    importedPipelineInspectorSection = "",
} = {}) {
    if (!importedPipelineSummary || !importedPipelineRuntimeArtifact || !importedPipelineRuntimeConfig) {
        return null;
    }
    const activeSection = normalizeString(importedPipelineInspectorSection);
    const runtimePreviewContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec: importedPipelineRuntimeConfig?.reportSpec || importedPipelineRuntimeArtifact?.reportSpec || null,
        document: importedPipelineRuntimeArtifact?.document || null,
        title: importedPipelineSummary?.title || "",
    });
    const semanticBindingViewState = resolveImportedSemanticBindingViewState({
        metadataContext: runtimePreviewContext,
        candidates: [
            importedPipelineRuntimeConfig?.semanticBindingViewState,
            importedPipelineRuntimeArtifact?.runtimeBlock?.dashboard?.reportRuntime?.semanticBindingViewState,
            importedPipelineRuntimeArtifact?.semanticBindingViewState,
        ],
    });
    const scopeSummary = buildReportBuilderScopeSummaryFromParams(runtimePreviewContext?.scopeParams);
    const authoredSummary = buildImportedAuthoredSummary(runtimePreviewContext);
    const drillSummary = buildImportedDrillSummary(runtimePreviewContext, {
        reportSpecCandidates: [
            importedPipelineRuntimeArtifact?.reportSpec || null,
            importedPipelinePreview?.payload || null,
            importedPipelineRuntimeConfig?.reportSpec || null,
        ],
    });
    const companionViewState = buildImportedCompanionReportSpecViewState({
        companionReportSpec: importedPipelineRuntimeConfig?.reportSpec || importedPipelinePreview?.payload || null,
        companionReportDocument: importedPipelineRuntimeArtifact?.document || null,
        companionSemanticBindingViewState: semanticBindingViewState,
    });
    const metaChips = [
        formatCountChip(importedPipelineSummary.blockCount, "block", "blocks"),
        formatCountChip(importedPipelineSummary.datasetCount, "dataset", "datasets"),
        normalizeString(companionViewState?.templateLabel),
        normalizeString(companionViewState?.templateConflictLabel),
        formatCountChip(importedPipelineRuntimeFillSummary?.rowCount || 0, "filled row", "filled rows"),
        importedPipelineRuntimeFillSummary
            ? (importedPipelineRuntimeFillSummary.attached ? "Attached ReportFill" : "Preview Fill")
            : "",
        authoredSummary ? formatCountChip(authoredSummary.totalCount, "authored block", "authored blocks") : "",
        drillSummary ? formatCountChip(drillSummary.hierarchyCount, "drill hierarchy", "drill hierarchies") : "",
        drillSummary ? formatCountChip(drillSummary.detailTargetCount, "detail target", "detail targets") : "",
    ].filter(Boolean);
    const compatibility = importedPipelineCompanionFillCompatibility && typeof importedPipelineCompanionFillCompatibility === "object"
        ? importedPipelineCompanionFillCompatibility
        : null;
    const attachAction = compatibility?.available
        ? (
            compatibility.attached
                ? {
                    mode: "detach",
                    label: "Detach ReportFill",
                    disabled: false,
                }
                : {
                    mode: "attach",
                    label: "Attach ReportFill",
                    disabled: compatibility.compatible !== true,
                }
        )
        : null;
    return {
        eyebrow: "Imported Runtime",
        title: normalizeString(importedPipelineSummary.title || "Imported ReportSpec") || "Imported ReportSpec",
        description: normalizeString(
            importedPipelineRuntimeArtifact?.runtimeBlock?.subtitle
            || "Local runtime preview compiled directly from the imported ReportSpec file.",
        ) || "Local runtime preview compiled directly from the imported ReportSpec file.",
        summaryLabel: "Imported ReportSpec",
        summaryValue: normalizeString(importedPipelineSummary.title || "Report") || "Report",
        summaryTitle: `Imported ReportSpec: ${normalizeString(importedPipelineSummary.title || "Report") || "Report"}`,
        sourceFileLine: normalizeString(importedPipelineSummary.fileName)
            ? `Source file: ${normalizeString(importedPipelineSummary.fileName)}`
            : "",
        compatibilityMessage: normalizeString(compatibility?.message),
        ...(buildSemanticBindingViewSection(semanticBindingViewState) || {}),
        ...(Array.isArray(scopeSummary?.items) && scopeSummary.items.length > 0 ? {
            scopeSummaryTitle: "Report Scope",
            scopeSummaryText: scopeSummary.text,
            scopeSummaryItems: scopeSummary.items,
        } : {}),
        ...(authoredSummary ? {
            authoredBlockCount: authoredSummary.totalCount,
            authoredBlockSummaryText: authoredSummary.summary,
        } : {}),
        ...(drillSummary ? {
            drillHierarchyCount: drillSummary.hierarchyCount,
            detailTargetCount: drillSummary.detailTargetCount,
            drillSummaryText: drillSummary.summary,
        } : {}),
        ...(companionViewState ? companionViewState : {}),
        ...(buildImportedSummaryNoticeState(companionViewState) ? { summaryNotice: buildImportedSummaryNoticeState(companionViewState) } : {}),
        metaChips,
        attachAction,
        inspectActions: [
            {
                section: "reportSpec",
                label: activeSection === "reportSpec" ? "Hide ReportSpec" : "Inspect ReportSpec",
                active: activeSection === "reportSpec",
            },
            {
                section: "reportFill",
                label: activeSection === "reportFill" ? "Hide ReportFill" : "Inspect ReportFill",
                active: activeSection === "reportFill",
            },
            {
                section: "reportPrint",
                label: activeSection === "reportPrint" ? "Hide ReportPrint" : "Inspect ReportPrint",
                active: activeSection === "reportPrint",
            },
        ],
        hideLabel: "Hide imported runtime",
    };
}

export function buildImportedPipelineInspectorState({
    importedPipelineSummary = null,
    importedPipelinePreview = null,
    importedPipelineRuntimeArtifact = null,
    importedPipelineRuntimeConfig = null,
    importedPipelineInspectorSection = "",
} = {}) {
    if (!importedPipelineSummary || !importedPipelineRuntimeArtifact) {
        return null;
    }
    const activeSection = normalizeString(importedPipelineInspectorSection);
    if (!activeSection) {
        return null;
    }
    const reportSpecContext = importedPipelineRuntimeConfig?.reportSpec
        || importedPipelineRuntimeArtifact?.reportSpec
        || importedPipelinePreview?.payload
        || null;
    const inspectorContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec: reportSpecContext,
        document: importedPipelineRuntimeArtifact?.document || null,
        title: importedPipelineSummary?.title || "",
    });
    const semanticBindingViewState = resolveImportedSemanticBindingViewState({
        metadataContext: inspectorContext,
        candidates: [
            importedPipelineRuntimeConfig?.semanticBindingViewState,
            importedPipelineRuntimeArtifact?.runtimeBlock?.dashboard?.reportRuntime?.semanticBindingViewState,
            importedPipelineRuntimeArtifact?.semanticBindingViewState,
        ],
    });
    const scopeSummary = buildReportBuilderScopeSummaryFromParams(inspectorContext?.scopeParams);
    const authoredSummary = buildImportedAuthoredSummary(inspectorContext);
    const drillSummary = buildImportedDrillSummary(inspectorContext, {
        reportSpecCandidates: [
            importedPipelineRuntimeArtifact?.reportSpec || null,
            importedPipelinePreview?.payload || null,
            importedPipelineRuntimeConfig?.reportSpec || null,
        ],
    });
    const companionViewState = buildImportedCompanionReportSpecViewState({
        companionReportSpec: importedPipelineRuntimeConfig?.reportSpec || importedPipelinePreview?.payload || null,
        companionReportDocument: importedPipelineRuntimeArtifact?.document || null,
        companionSemanticBindingViewState: semanticBindingViewState,
    });
    const baseTitle = normalizeString(importedPipelineSummary?.title || "Report") || "Report";
    const baseState = {
        title: baseTitle,
        ...(companionViewState ? companionViewState : {}),
        ...(buildSemanticBindingViewSection(semanticBindingViewState) || {}),
        ...(Array.isArray(scopeSummary?.items) && scopeSummary.items.length > 0 ? {
            scopeSummaryTitle: "Report Scope",
            scopeSummaryText: scopeSummary.text,
            scopeSummaryItems: scopeSummary.items,
        } : {}),
        ...(authoredSummary ? {
            authoredBlockCount: authoredSummary.totalCount,
            authoredBlockSummaryText: authoredSummary.summary,
        } : {}),
        ...(drillSummary ? {
            drillHierarchyCount: drillSummary.hierarchyCount,
            detailTargetCount: drillSummary.detailTargetCount,
            drillSummaryText: drillSummary.summary,
        } : {}),
    };
    if (activeSection === "reportSpec") {
        return {
            ...baseState,
            section: "reportSpec",
            label: "ReportSpec",
            content: JSON.stringify(importedPipelinePreview?.payload || {}, null, 2),
        };
    }
    if (activeSection === "reportFill") {
        return {
            ...baseState,
            section: "reportFill",
            label: "ReportFill",
            content: JSON.stringify(importedPipelineRuntimeArtifact?.reportFill || {}, null, 2),
        };
    }
    if (activeSection === "reportPrint") {
        return {
            ...baseState,
            section: "reportPrint",
            label: "ReportPrint",
            content: JSON.stringify(importedPipelineRuntimeArtifact?.reportPrint || {}, null, 2),
        };
    }
    return null;
}

export function buildImportedStandaloneReportFillPanelState({
    importedStandaloneReportFillSummary = null,
    importedPipelineCompanionFillCompatibility = null,
    importedStandaloneReportFillOpen = false,
    companionReportSpec = null,
    companionReportDocument = null,
} = {}) {
    if (!importedStandaloneReportFillSummary) {
        return null;
    }
    const compatibility = importedPipelineCompanionFillCompatibility && typeof importedPipelineCompanionFillCompatibility === "object"
        ? importedPipelineCompanionFillCompatibility
        : null;
    const companionViewState = buildImportedCompanionReportSpecViewState({
        companionReportSpec,
        companionReportDocument,
    });
    const metaChips = [
        formatCountChip(importedStandaloneReportFillSummary.datasetCount, "dataset", "datasets"),
        formatCountChip(importedStandaloneReportFillSummary.blockCount, "block", "blocks"),
        formatCountChip(importedStandaloneReportFillSummary.rowCount, "row", "rows"),
        importedStandaloneReportFillSummary.specVersion > 0
            ? `spec v${importedStandaloneReportFillSummary.specVersion}`
            : "",
        normalizeString(companionViewState?.templateLabel),
        normalizeString(companionViewState?.templateConflictLabel),
        formatCountChip(importedStandaloneReportFillSummary.diagnosticCount, "diagnostic", "diagnostics"),
    ].filter(Boolean);
    const attachAction = compatibility?.available
        ? (
            compatibility.attached
                ? {
                    mode: "detach",
                    label: "Detach from ReportSpec",
                    disabled: false,
                }
                : {
                    mode: "attach",
                    label: "Attach to ReportSpec",
                    disabled: compatibility.compatible !== true,
                }
        )
        : null;
    return {
        summaryLabel: "Imported ReportFill",
        summaryValue: normalizeString(importedStandaloneReportFillSummary.title || "Report") || "Report",
        title: `Imported ReportFill: ${normalizeString(importedStandaloneReportFillSummary.title || "Report") || "Report"}`,
        description: "Canonical filled-data contract imported locally. Inspect or download the JSON artifact directly.",
        compatibilityMessage: normalizeString(compatibility?.message),
        metaChips,
        attachAction,
        ...(companionViewState ? companionViewState : {}),
        ...(buildImportedSummaryNoticeState(companionViewState) ? { summaryNotice: buildImportedSummaryNoticeState(companionViewState) } : {}),
        inspectLabel: importedStandaloneReportFillOpen ? "Hide ReportFill" : "Inspect ReportFill",
        downloadLabel: "Download ReportFill",
        hideLabel: "Hide imported fill",
    };
}

export function buildImportedStandaloneReportFillInspectorState({
    importedStandaloneReportFillSummary = null,
    importedStandaloneReportFillOpen = false,
    companionReportSpec = null,
    companionReportDocument = null,
} = {}) {
    if (!importedStandaloneReportFillSummary) {
        return null;
    }
    const companionViewState = buildImportedCompanionReportSpecViewState({
        companionReportSpec,
        companionReportDocument,
    });
    return {
        expandedMetaChips: [
            "ReportFill",
            normalizeString(importedStandaloneReportFillSummary.title || "Report") || "Report",
            formatCountChip(importedStandaloneReportFillSummary.rowCount, "row", "rows"),
            normalizeString(companionViewState?.templateLabel),
            normalizeString(companionViewState?.templateConflictLabel),
        ].filter(Boolean),
        ...(companionViewState ? companionViewState : {}),
        inspectLabel: importedStandaloneReportFillOpen ? "Hide ReportFill" : "Inspect ReportFill",
        downloadLabel: "Download ReportFill",
    };
}

export function buildImportedStandaloneReportPrintPanelState({
    importedStandaloneReportPrintSummary = null,
    importedStandaloneReportPrintOpen = false,
    companionReportSpec = null,
    companionReportDocument = null,
} = {}) {
    if (!importedStandaloneReportPrintSummary) {
        return null;
    }
    const companionViewState = buildImportedCompanionReportSpecViewState({
        companionReportSpec,
        companionReportDocument,
    });
    const metaChips = [
        formatCountChip(importedStandaloneReportPrintSummary.pageCount, "page", "pages"),
        formatCountChip(importedStandaloneReportPrintSummary.bookmarkCount, "bookmark", "bookmarks"),
        importedStandaloneReportPrintSummary.pageWidth > 0 && importedStandaloneReportPrintSummary.pageHeight > 0
            ? `${importedStandaloneReportPrintSummary.pageWidth} x ${importedStandaloneReportPrintSummary.pageHeight}`
            : "",
        normalizeString(companionViewState?.templateLabel),
        normalizeString(companionViewState?.templateConflictLabel),
        formatCountChip(importedStandaloneReportPrintSummary.diagnosticCount, "diagnostic", "diagnostics"),
    ].filter(Boolean);
    return {
        summaryLabel: "Imported ReportPrint",
        summaryValue: normalizeString(importedStandaloneReportPrintSummary.title || "Report") || "Report",
        description: "Canonical print-layout contract imported locally. Inspect or download the JSON artifact directly.",
        metaChips,
        ...(companionViewState ? companionViewState : {}),
        ...(buildImportedSummaryNoticeState(companionViewState) ? { summaryNotice: buildImportedSummaryNoticeState(companionViewState) } : {}),
        inspectLabel: importedStandaloneReportPrintOpen ? "Hide ReportPrint" : "Inspect ReportPrint",
        downloadLabel: "Download ReportPrint",
        hideLabel: "Hide imported print",
        expandedMetaChips: [
            "ReportPrint",
            normalizeString(importedStandaloneReportPrintSummary.title || "Report") || "Report",
            formatCountChip(importedStandaloneReportPrintSummary.pageCount, "page", "pages"),
        ].filter(Boolean),
    };
}

export function buildImportedStandaloneReportPrintInspectorState({
    importedStandaloneReportPrintSummary = null,
    importedStandaloneReportPrintOpen = false,
    companionReportSpec = null,
    companionReportDocument = null,
} = {}) {
    if (!importedStandaloneReportPrintSummary) {
        return null;
    }
    const companionViewState = buildImportedCompanionReportSpecViewState({
        companionReportSpec,
        companionReportDocument,
    });
    return {
        expandedMetaChips: [
            "ReportPrint",
            normalizeString(importedStandaloneReportPrintSummary.title || "Report") || "Report",
            formatCountChip(importedStandaloneReportPrintSummary.pageCount, "page", "pages"),
            normalizeString(companionViewState?.templateLabel),
            normalizeString(companionViewState?.templateConflictLabel),
        ].filter(Boolean),
        ...(companionViewState ? companionViewState : {}),
        inspectLabel: importedStandaloneReportPrintOpen ? "Hide ReportPrint" : "Inspect ReportPrint",
        downloadLabel: "Download ReportPrint",
    };
}

export function buildImportedStandaloneExportRequestPanelState({
    importedStandaloneExportRequestSummary = null,
} = {}) {
    if (!importedStandaloneExportRequestSummary) {
        return null;
    }
    const summaryNotice = buildImportedSummaryNoticeState(importedStandaloneExportRequestSummary);
    const metaChips = [
        normalizeString(importedStandaloneExportRequestSummary.artifactRef),
        importedStandaloneExportRequestSummary.documentVersion > 0
            ? `v${importedStandaloneExportRequestSummary.documentVersion}`
            : "",
        normalizeString(importedStandaloneExportRequestSummary.templateLabel),
        normalizeString(importedStandaloneExportRequestSummary.templateConflictLabel),
        ...(Array.isArray(importedStandaloneExportRequestSummary?.reopenSourceResolutionChips)
            ? importedStandaloneExportRequestSummary.reopenSourceResolutionChips
            : []),
        ...(Array.isArray(importedStandaloneExportRequestSummary?.semanticBindingChips)
            ? importedStandaloneExportRequestSummary.semanticBindingChips
            : []),
    ].filter(Boolean);
    return {
        summaryLabel: "Imported export request",
        summaryValue: normalizeString(importedStandaloneExportRequestSummary.title || "Report") || "Report",
        description: `Source: ${normalizeString(importedStandaloneExportRequestSummary.from)} • Format: ${normalizeString(importedStandaloneExportRequestSummary.format)}`,
        metaChips,
        ...(normalizeString(importedStandaloneExportRequestSummary?.semanticBindingTitle)
            ? { semanticBindingTitle: normalizeString(importedStandaloneExportRequestSummary.semanticBindingTitle) }
            : {}),
        ...(Array.isArray(importedStandaloneExportRequestSummary?.semanticBindingChips)
            ? { semanticBindingChips: importedStandaloneExportRequestSummary.semanticBindingChips.filter(Boolean) }
            : {}),
        ...(Array.isArray(importedStandaloneExportRequestSummary?.semanticBindingFieldGroups) && importedStandaloneExportRequestSummary.semanticBindingFieldGroups.length > 0
            ? { semanticBindingFieldGroups: importedStandaloneExportRequestSummary.semanticBindingFieldGroups }
            : {}),
        ...(normalizeString(importedStandaloneExportRequestSummary?.scopeSummaryTitle)
            ? { scopeSummaryTitle: normalizeString(importedStandaloneExportRequestSummary.scopeSummaryTitle) }
            : {}),
        ...(normalizeString(importedStandaloneExportRequestSummary?.scopeSummaryText)
            ? { scopeSummaryText: normalizeString(importedStandaloneExportRequestSummary.scopeSummaryText) }
            : {}),
        ...(Array.isArray(importedStandaloneExportRequestSummary?.scopeSummaryItems) && importedStandaloneExportRequestSummary.scopeSummaryItems.length > 0
            ? { scopeSummaryItems: importedStandaloneExportRequestSummary.scopeSummaryItems }
            : {}),
        ...(normalizeString(importedStandaloneExportRequestSummary?.reopenSourceResolutionTitle)
            ? { reopenSourceResolutionTitle: normalizeString(importedStandaloneExportRequestSummary.reopenSourceResolutionTitle) }
            : {}),
        ...(normalizeString(importedStandaloneExportRequestSummary?.reopenSourceResolutionText)
            ? { reopenSourceResolutionText: normalizeString(importedStandaloneExportRequestSummary.reopenSourceResolutionText) }
            : {}),
        ...(Array.isArray(importedStandaloneExportRequestSummary?.reopenSourceResolutionChips) && importedStandaloneExportRequestSummary.reopenSourceResolutionChips.length > 0
            ? { reopenSourceResolutionChips: importedStandaloneExportRequestSummary.reopenSourceResolutionChips.filter(Boolean) }
            : {}),
        ...(Array.isArray(importedStandaloneExportRequestSummary?.reopenSourceResolutionSources) && importedStandaloneExportRequestSummary.reopenSourceResolutionSources.length > 0
            ? { reopenSourceResolutionSources: importedStandaloneExportRequestSummary.reopenSourceResolutionSources }
            : {}),
        ...(normalizeString(importedStandaloneExportRequestSummary?.templateId)
            ? { templateId: normalizeString(importedStandaloneExportRequestSummary.templateId) }
            : {}),
        ...(normalizeString(importedStandaloneExportRequestSummary?.templateLabel)
            ? { templateLabel: normalizeString(importedStandaloneExportRequestSummary.templateLabel) }
            : {}),
        ...(importedStandaloneExportRequestSummary?.templateConflict ? {
            templateConflict: true,
            templateConflictLabel: normalizeString(importedStandaloneExportRequestSummary?.templateConflictLabel),
            templateConflictMessage: normalizeString(importedStandaloneExportRequestSummary?.templateConflictMessage),
        } : {}),
        ...(summaryNotice ? { summaryNotice } : {}),
        downloadLabel: "Download export request",
        hideLabel: "Hide imported request",
        expandedMetaChips: [
            normalizeString(importedStandaloneExportRequestSummary.from),
            normalizeString(importedStandaloneExportRequestSummary.format),
            normalizeString(importedStandaloneExportRequestSummary.artifactRef),
            normalizeString(importedStandaloneExportRequestSummary.templateLabel),
            normalizeString(importedStandaloneExportRequestSummary.templateConflictLabel),
            importedStandaloneExportRequestSummary.hasReportPrint ? "ReportPrint" : "",
            ...(Array.isArray(importedStandaloneExportRequestSummary?.reopenSourceResolutionChips)
                ? importedStandaloneExportRequestSummary.reopenSourceResolutionChips
                : []),
            ...(Array.isArray(importedStandaloneExportRequestSummary?.semanticBindingChips)
                ? importedStandaloneExportRequestSummary.semanticBindingChips
                : []),
        ].filter(Boolean),
    };
}

export function buildImportedStandaloneExportRequestInspectorState({
    importedStandaloneExportRequestSummary = null,
    importedStandaloneExportRequestOpen = false,
} = {}) {
    if (!importedStandaloneExportRequestSummary) {
        return null;
    }
    return {
        expandedMetaChips: [
            normalizeString(importedStandaloneExportRequestSummary.from),
            normalizeString(importedStandaloneExportRequestSummary.format),
            normalizeString(importedStandaloneExportRequestSummary.artifactRef),
            normalizeString(importedStandaloneExportRequestSummary.templateLabel),
            normalizeString(importedStandaloneExportRequestSummary.templateConflictLabel),
            importedStandaloneExportRequestSummary.hasReportPrint ? "ReportPrint" : "",
            ...(Array.isArray(importedStandaloneExportRequestSummary?.reopenSourceResolutionChips)
                ? importedStandaloneExportRequestSummary.reopenSourceResolutionChips
                : []),
            ...(Array.isArray(importedStandaloneExportRequestSummary?.semanticBindingChips)
                ? importedStandaloneExportRequestSummary.semanticBindingChips
                : []),
        ].filter(Boolean),
        ...(normalizeString(importedStandaloneExportRequestSummary?.reopenSourceResolutionTitle)
            ? { reopenSourceResolutionTitle: normalizeString(importedStandaloneExportRequestSummary.reopenSourceResolutionTitle) }
            : {}),
        ...(normalizeString(importedStandaloneExportRequestSummary?.reopenSourceResolutionText)
            ? { reopenSourceResolutionText: normalizeString(importedStandaloneExportRequestSummary.reopenSourceResolutionText) }
            : {}),
        ...(Array.isArray(importedStandaloneExportRequestSummary?.reopenSourceResolutionChips) && importedStandaloneExportRequestSummary.reopenSourceResolutionChips.length > 0
            ? { reopenSourceResolutionChips: importedStandaloneExportRequestSummary.reopenSourceResolutionChips.filter(Boolean) }
            : {}),
        ...(Array.isArray(importedStandaloneExportRequestSummary?.reopenSourceResolutionSources) && importedStandaloneExportRequestSummary.reopenSourceResolutionSources.length > 0
            ? { reopenSourceResolutionSources: importedStandaloneExportRequestSummary.reopenSourceResolutionSources }
            : {}),
        ...(normalizeString(importedStandaloneExportRequestSummary?.templateId)
            ? { templateId: normalizeString(importedStandaloneExportRequestSummary.templateId) }
            : {}),
        ...(normalizeString(importedStandaloneExportRequestSummary?.templateLabel)
            ? { templateLabel: normalizeString(importedStandaloneExportRequestSummary.templateLabel) }
            : {}),
        ...(importedStandaloneExportRequestSummary?.templateConflict ? {
            templateConflict: true,
            templateConflictLabel: normalizeString(importedStandaloneExportRequestSummary?.templateConflictLabel),
            templateConflictMessage: normalizeString(importedStandaloneExportRequestSummary?.templateConflictMessage),
        } : {}),
        ...(normalizeString(importedStandaloneExportRequestSummary?.semanticBindingTitle)
            ? { semanticBindingTitle: normalizeString(importedStandaloneExportRequestSummary.semanticBindingTitle) }
            : {}),
        ...(Array.isArray(importedStandaloneExportRequestSummary?.semanticBindingChips)
            ? { semanticBindingChips: importedStandaloneExportRequestSummary.semanticBindingChips.filter(Boolean) }
            : {}),
        ...(Array.isArray(importedStandaloneExportRequestSummary?.semanticBindingFieldGroups) && importedStandaloneExportRequestSummary.semanticBindingFieldGroups.length > 0
            ? { semanticBindingFieldGroups: importedStandaloneExportRequestSummary.semanticBindingFieldGroups }
            : {}),
        ...(normalizeString(importedStandaloneExportRequestSummary?.scopeSummaryTitle)
            ? { scopeSummaryTitle: normalizeString(importedStandaloneExportRequestSummary.scopeSummaryTitle) }
            : {}),
        ...(normalizeString(importedStandaloneExportRequestSummary?.scopeSummaryText)
            ? { scopeSummaryText: normalizeString(importedStandaloneExportRequestSummary.scopeSummaryText) }
            : {}),
        ...(Array.isArray(importedStandaloneExportRequestSummary?.scopeSummaryItems) && importedStandaloneExportRequestSummary.scopeSummaryItems.length > 0
            ? { scopeSummaryItems: importedStandaloneExportRequestSummary.scopeSummaryItems }
            : {}),
        inspectLabel: importedStandaloneExportRequestOpen ? "Hide export" : "Inspect export",
        downloadLabel: "Download export request",
    };
}

export function buildImportedStandaloneExportRequestDetailPanelState({
    importedStandaloneExportRequestInspector = null,
    importedStandaloneExportRequestOpen = false,
} = {}) {
    return buildReportBuilderExportRequestPanelState({
        requestInspector: importedStandaloneExportRequestInspector,
        requestOpen: importedStandaloneExportRequestOpen,
        includeReportPrintChip: true,
    });
}

export function buildImportedStandaloneExportStatusMetaChips({
    executionSummary = null,
    requestSummary = null,
} = {}) {
    return [
        normalizeString(executionSummary?.templateLabel || requestSummary?.templateLabel),
        normalizeString(executionSummary?.templateConflictLabel || requestSummary?.templateConflictLabel),
        ...(Array.isArray(executionSummary?.reopenSourceResolutionChips)
            ? executionSummary.reopenSourceResolutionChips
            : (Array.isArray(requestSummary?.reopenSourceResolutionChips)
                ? requestSummary.reopenSourceResolutionChips
                : [])),
    ].filter(Boolean);
}

export function buildImportedStandaloneExportJobPanelState({
    importedStandaloneExportJobSummary = null,
    importedStandaloneExportStatusLoading = false,
    importedStandaloneExportArtifactLoading = false,
    importedStandaloneExportRequestExecutionSummary = null,
    importedStandaloneExportRequestSummary = null,
} = {}) {
    const executionContext = buildImportedExecutionContext({
        executionSummary: importedStandaloneExportRequestExecutionSummary,
        requestSummary: importedStandaloneExportRequestSummary,
    });
    return buildReportBuilderExportJobPanelState({
        jobSummary: importedStandaloneExportJobSummary,
        label: "Imported export",
        title: executionContext.title || "Report",
        statusLoading: importedStandaloneExportStatusLoading,
        artifactLoading: importedStandaloneExportArtifactLoading,
        additionalMetaChips: buildImportedStandaloneExportStatusMetaChips({
            executionSummary: importedStandaloneExportRequestExecutionSummary,
            requestSummary: importedStandaloneExportRequestSummary,
        }),
        semanticBindingTitle: executionContext.semanticBindingTitle,
        semanticBindingChips: executionContext.semanticBindingChips,
        semanticBindingFieldGroups: executionContext.semanticBindingFieldGroups,
        scopeSummaryTitle: executionContext.scopeSummaryTitle,
        scopeSummaryText: executionContext.scopeSummaryText,
        scopeSummaryItems: executionContext.scopeSummaryItems,
    });
}

export function buildImportedStandaloneExportFailureNotice({
    importedStandaloneExportJob = null,
    importedStandaloneExportRequestExecutionSummary = null,
    importedStandaloneExportRequestSummary = null,
} = {}) {
    const executionContext = buildImportedExecutionContext({
        executionSummary: importedStandaloneExportRequestExecutionSummary,
        requestSummary: importedStandaloneExportRequestSummary,
    });
    return buildLifecycleExportFailureNotice(importedStandaloneExportJob, {
        label: "Imported export",
        additionalMetaChips: buildImportedStandaloneExportStatusMetaChips({
            executionSummary: importedStandaloneExportRequestExecutionSummary,
            requestSummary: importedStandaloneExportRequestSummary,
        }),
        semanticBindingTitle: executionContext.semanticBindingTitle,
        semanticBindingChips: executionContext.semanticBindingChips,
        semanticBindingFieldGroups: executionContext.semanticBindingFieldGroups,
        scopeSummaryTitle: executionContext.scopeSummaryTitle,
        scopeSummaryText: executionContext.scopeSummaryText,
        scopeSummaryItems: executionContext.scopeSummaryItems,
    });
}

export function buildImportedPipelineExportStatusMetaChips({
    requestSummary = null,
    runtimeFillSummary = null,
} = {}) {
    return [
        normalizeString(requestSummary?.templateLabel),
        normalizeString(requestSummary?.templateConflictLabel),
        runtimeFillSummary
            ? (runtimeFillSummary.attached ? "Attached ReportFill" : "Preview Fill")
            : "",
        runtimeFillSummary
            ? `${runtimeFillSummary.rowCount} rows`
            : "",
    ].filter(Boolean);
}

export function buildImportedPipelineExportRequestDetailPanelState({
    importedPipelineExportRequestInspector = null,
    importedPipelineExportRequestOpen = false,
    importedPipelineRuntimeFillSummary = null,
} = {}) {
    return buildReportBuilderExportRequestPanelState({
        requestInspector: importedPipelineExportRequestInspector,
        requestOpen: importedPipelineExportRequestOpen,
        includeReportPrintChip: true,
        additionalMetaChips: buildImportedPipelineRequestMetaChips(importedPipelineRuntimeFillSummary),
    });
}

export function buildImportedPipelineExportJobPanelState({
    importedPipelineExportJobSummary = null,
    importedPipelineExportStatusLoading = false,
    importedPipelineExportArtifactLoading = false,
    importedPipelineExportRequestSummary = null,
    importedPipelineRuntimeFillSummary = null,
    importedPipelineSummary = null,
} = {}) {
    const executionContext = buildImportedExecutionContext({
        requestSummary: importedPipelineExportRequestSummary,
    });
    return buildReportBuilderExportJobPanelState({
        jobSummary: importedPipelineExportJobSummary,
        label: "Imported export",
        title: normalizeString(importedPipelineSummary?.title) || "Report",
        statusLoading: importedPipelineExportStatusLoading,
        artifactLoading: importedPipelineExportArtifactLoading,
        additionalMetaChips: buildImportedPipelineExportStatusMetaChips({
            requestSummary: importedPipelineExportRequestSummary,
            runtimeFillSummary: importedPipelineRuntimeFillSummary,
        }),
        semanticBindingTitle: executionContext.semanticBindingTitle,
        semanticBindingChips: executionContext.semanticBindingChips,
        semanticBindingFieldGroups: executionContext.semanticBindingFieldGroups,
        scopeSummaryTitle: executionContext.scopeSummaryTitle,
        scopeSummaryText: executionContext.scopeSummaryText,
        scopeSummaryItems: executionContext.scopeSummaryItems,
    });
}

export function buildImportedPipelineExportFailureNotice({
    importedPipelineExportJob = null,
    importedPipelineExportRequestSummary = null,
    importedPipelineRuntimeFillSummary = null,
} = {}) {
    const executionContext = buildImportedExecutionContext({
        requestSummary: importedPipelineExportRequestSummary,
    });
    return buildLifecycleExportFailureNotice(importedPipelineExportJob, {
        label: "Imported export",
        additionalMetaChips: buildImportedPipelineExportStatusMetaChips({
            requestSummary: importedPipelineExportRequestSummary,
            runtimeFillSummary: importedPipelineRuntimeFillSummary,
        }),
        semanticBindingTitle: executionContext.semanticBindingTitle,
        semanticBindingChips: executionContext.semanticBindingChips,
        semanticBindingFieldGroups: executionContext.semanticBindingFieldGroups,
        scopeSummaryTitle: executionContext.scopeSummaryTitle,
        scopeSummaryText: executionContext.scopeSummaryText,
        scopeSummaryItems: executionContext.scopeSummaryItems,
    });
}

import {
    buildReportBuilderReportDocument,
    extractReportDocumentTemplateIdentity,
    lowerReportDocumentToReportSpec,
} from "../../reporting/reportDocumentModel.js";
import {
    buildPublishedSnapshotReportExportRequest,
    buildSavedReportExportRequest,
    buildSavedViewReportExportRequest,
} from "../../reporting/reportExportRequestModel.js";
import { buildReportDocumentCompileState } from "../../reporting/reportDocumentStore.js";
import {
    buildReportBuilderDocumentCompileDiagnostics,
    buildReportBuilderScopeSummaryFromParams,
} from "./reportBuilderDocumentBlocks.js";
import { buildReportBuilderSemanticRuntimeDiagnosticsFromState } from "./reportBuilderSemantic.js";
import { resolveReportBuilderSemanticRuntimeState } from "./useReportBuilderSemanticRuntimeState.js";
import { buildReportBuilderSemanticBindingViewState } from "./reportBuilderSemanticBindingViewState.js";
import { resolveNormalizedReportSpecDocumentContext } from "./reportBuilderSavedRecordMetadataContext.js";
import {
    summarizeReportBuilderAuthoredBlocks,
    summarizeReportBuilderAuthoredDrillMetadata,
} from "./reportBuilderAuthoredBlockSummary.js";
import {
    buildReportBuilderTemplateConflictState,
    resolveReportBuilderSourceSessionTemplateIdentity,
} from "./reportBuilderTemplateIdentity.js";
import { buildShareableArtifactSummary } from "../../reporting/sharing/shareableArtifactModel.js";
import {
    buildSavedViewOverlaySummary,
    extractSavedViewOverlayArtifactState,
} from "../../reporting/views/savedViewOverlayModel.js";
import { resolveReportBuilderSavedViewOverlayReopenSourceResolution } from "./reportBuilderReopenSourceResolution.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function sanitizeFilenameSegment(value = "") {
    return normalizeString(value).replace(/[\\/:*?"<>|]+/g, "-");
}

function normalizeSemanticBindingViewState(value = null) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const title = normalizeString(value?.title);
    const chips = (Array.isArray(value?.chips) ? value.chips : [])
        .map((entry) => normalizeString(entry))
        .filter(Boolean);
    const fieldGroups = (Array.isArray(value?.fieldGroups) ? value.fieldGroups : [])
        .map((group) => {
            const id = normalizeString(group?.id);
            const groupTitle = normalizeString(group?.title);
            const fields = (Array.isArray(group?.fields) ? group.fields : [])
                .filter((field) => field && typeof field === "object" && !Array.isArray(field))
                .filter((field) => (
                    normalizeString(field?.id)
                    || normalizeString(field?.rawId)
                    || normalizeString(field?.label)
                    || normalizeString(field?.definitionRef)
                ))
                .map((field) => cloneValue(field));
            if (!id || !groupTitle || fields.length === 0) {
                return null;
            }
            return {
                id,
                title: groupTitle,
                fields,
            };
        })
        .filter(Boolean);
    if (chips.length === 0 && fieldGroups.length === 0) {
        return null;
    }
    return {
        ...(title ? { title } : { title: "Semantic Binding" }),
        ...(chips.length > 0 ? { chips } : {}),
        ...(fieldGroups.length > 0 ? { fieldGroups } : {}),
    };
}

const REPORT_DOCUMENT_REOPEN_SESSION_KEY = "reportDocumentReopenSession";

function extractSavedReportPayloadTemplateIdentity(payload = null) {
    const explicitTemplateIdentity = extractReportDocumentTemplateIdentity(payload?.reportDocument || null);
    if (explicitTemplateIdentity) {
        return explicitTemplateIdentity;
    }
    const sourceTemplateId = normalizeString(payload?.sourceSession?.sourceRef?.templateId);
    const sourceTemplateLabel = normalizeString(payload?.sourceSession?.sourceRef?.templateLabel);
    if (sourceTemplateId || sourceTemplateLabel) {
        return {
            ...(sourceTemplateId ? { templateId: sourceTemplateId } : {}),
            ...(sourceTemplateLabel ? { templateLabel: sourceTemplateLabel } : {}),
        };
    }
    return null;
}

function buildSavedReportPayloadTemplateConflictState(payload = null) {
    return buildReportBuilderTemplateConflictState(
        extractReportDocumentTemplateIdentity(payload?.reportDocument || null),
        resolveReportBuilderSourceSessionTemplateIdentity(payload?.sourceSession || null),
        {
            primaryRole: "Saved report file",
            secondaryRole: "source-session seed",
        },
    );
}

function stripBuilderOnlyState(state = {}) {
    const next = cloneValue(state && typeof state === "object" && !Array.isArray(state) ? state : {});
    delete next.explorationSession;
    delete next[REPORT_DOCUMENT_REOPEN_SESSION_KEY];
    return next;
}

function applyReportDocumentIdentity(reportDocument = {}, reportSpec = {}, {
    reportId = "",
    title = "",
} = {}) {
    const normalizedReportId = normalizeString(reportId);
    const normalizedTitle = normalizeString(title || reportId || "Report") || "Report";
    const nextDocument = cloneValue(reportDocument || {});
    const nextSpec = cloneValue(reportSpec || {});
    if (normalizedReportId) {
        nextDocument.id = normalizedReportId;
    }
    nextDocument.title = normalizedTitle;
    if (Array.isArray(nextDocument.blocks)) {
        nextDocument.blocks = nextDocument.blocks.map((block) => (
            normalizeString(block?.kind) === "reportBuilderBlock"
                ? {
                    ...block,
                    title: normalizedTitle,
                }
                : block
        ));
    }
    nextSpec.title = normalizedTitle;
    return {
        reportDocument: nextDocument,
        reportSpec: nextSpec,
    };
}

function resolveReportBuilderSavedPayloadIdentityTitle(state = {}, seed = {}, document = null) {
    const explicitStateTitle = normalizeString(state?.reportDocumentTitle);
    if (explicitStateTitle) {
        return explicitStateTitle;
    }
    const seededTitle = normalizeString(seed?.title);
    if (seededTitle) {
        return seededTitle;
    }
    return normalizeString(document?.title || seed?.reportId || "Report") || "Report";
}

function buildSavedReportPayloadCompileState(payload = null) {
    const reportDocument = payload?.reportDocument && typeof payload.reportDocument === "object" && !Array.isArray(payload.reportDocument)
        ? payload.reportDocument
        : null;
    const reportSpec = payload?.reportSpec && typeof payload.reportSpec === "object" && !Array.isArray(payload.reportSpec)
        ? payload.reportSpec
        : null;
    const structuralDiagnostics = buildReportBuilderDocumentCompileDiagnostics({
        document: reportDocument,
    });
    const storedDiagnostics = Array.isArray(payload?.compileState?.diagnostics)
        ? cloneValue(payload.compileState.diagnostics)
        : [];
    const diagnostics = [...structuralDiagnostics, ...storedDiagnostics];
    const seen = new Set();
    return buildReportDocumentCompileState(reportSpec, {
        diagnostics: diagnostics.filter((diagnostic) => {
            const key = [
                normalizeString(diagnostic?.code),
                normalizeString(diagnostic?.severity),
                normalizeString(diagnostic?.path),
                normalizeString(diagnostic?.message),
            ].join("::");
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        }),
    });
}

function buildSavedReportPayloadCompileStateFromBuilderState(reportSpec = null, reportDocument = null, semanticRuntimeDiagnostics = []) {
    const diagnostics = [
        ...buildReportBuilderDocumentCompileDiagnostics({
            document: reportDocument,
        }),
        ...(Array.isArray(semanticRuntimeDiagnostics) ? semanticRuntimeDiagnostics : []),
    ];
    const seen = new Set();
    return buildReportDocumentCompileState(reportSpec, {
        diagnostics: diagnostics.filter((diagnostic) => {
            const key = [
                normalizeString(diagnostic?.code),
                normalizeString(diagnostic?.severity),
                normalizeString(diagnostic?.path),
                normalizeString(diagnostic?.message),
            ].join("::");
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        }),
    });
}

function resolveSavedReportPayloadSeed(seed = null) {
    if (!seed || typeof seed !== "object" || Array.isArray(seed)) {
        return null;
    }
    const source = seed?.source && typeof seed.source === "object" && !Array.isArray(seed.source)
        ? seed.source
        : {};
    const reportDocument = seed?.reportDocument && typeof seed.reportDocument === "object" && !Array.isArray(seed.reportDocument)
        ? seed.reportDocument
        : (seed?.document && typeof seed.document === "object" && !Array.isArray(seed.document) ? seed.document : null);
    const reportId = normalizeString(seed?.reportRef?.reportId || reportDocument?.id);
    const title = normalizeString(seed?.title || reportDocument?.title || reportId || "Report") || "Report";
    return {
        kind: "reportBuilder.savedReportPayload",
        payloadId: normalizeString(seed?.payloadId || source?.payloadId),
        sourceArtifactId: normalizeString(seed?.sourceArtifactId || source?.sourceArtifactId),
        sourceSession: seed?.sourceSession && typeof seed.sourceSession === "object" && !Array.isArray(seed.sourceSession)
            ? cloneValue(seed.sourceSession)
            : (source?.sourceSession && typeof source.sourceSession === "object" && !Array.isArray(source.sourceSession)
                ? cloneValue(source.sourceSession)
                : null),
        reportId,
        title,
        savedAt: Number(seed?.savedAt || 0) || 0,
    };
}

function buildSavedReportPayloadScopeSummary(payload = null) {
    const payloadContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec: payload?.reportSpec || null,
        document: payload?.reportDocument || null,
        title: payload?.title || "",
    });
    const summary = buildReportBuilderScopeSummaryFromParams(payloadContext?.scopeParams);
    return Array.isArray(summary?.items) && summary.items.length > 0 ? summary : null;
}

function buildSavedReportPayloadAuthoredSummary(payloadContext = null) {
    const documentBlocks = Array.isArray(payloadContext?.document?.blocks) ? payloadContext.document.blocks : [];
    const authoredBlocks = documentBlocks.filter((block) => normalizeString(block?.kind) !== "reportBuilderBlock");
    const authoredSummary = summarizeReportBuilderAuthoredBlocks(authoredBlocks);
    return authoredSummary?.totalCount > 0 ? authoredSummary : null;
}

function buildSavedReportPayloadDrillSummary(payloadContext = null) {
    const drillSummary = summarizeReportBuilderAuthoredDrillMetadata(payloadContext?.reportSpec || {});
    return Number(drillSummary?.hierarchyCount || 0) > 0
        || Number(drillSummary?.detailTargetCount || 0) > 0
        || Number(drillSummary?.fieldActionCount || 0) > 0
        ? drillSummary
        : null;
}

export function buildReportBuilderSavedReportPayload(explorationArtifact = null, {
    savedAt = Date.now(),
} = {}) {
    if (!explorationArtifact || typeof explorationArtifact !== "object" || Array.isArray(explorationArtifact)) {
        return null;
    }
    const artifactId = normalizeString(explorationArtifact?.artifactId);
    const reportDocument = explorationArtifact?.document && typeof explorationArtifact.document === "object" && !Array.isArray(explorationArtifact.document)
        ? cloneValue(explorationArtifact.document)
        : null;
    const reportSpec = explorationArtifact?.reportSpec && typeof explorationArtifact.reportSpec === "object" && !Array.isArray(explorationArtifact.reportSpec)
        ? cloneValue(explorationArtifact.reportSpec)
        : null;
    const compileState = explorationArtifact?.compileState && typeof explorationArtifact.compileState === "object" && !Array.isArray(explorationArtifact.compileState)
        ? cloneValue(explorationArtifact.compileState)
        : null;
    const semanticBindingViewState = normalizeSemanticBindingViewState(explorationArtifact?.semanticBindingViewState);
    if (!artifactId || !reportDocument || !reportSpec) {
        return null;
    }
    const savedTimestamp = Number(savedAt || Date.now()) || Date.now();
    return {
        version: 1,
        kind: "reportBuilder.savedReportPayload",
        payloadId: `rbreport_${artifactId}`,
        savedAt: savedTimestamp,
        title: normalizeString(explorationArtifact?.title || reportDocument?.title || "Report"),
        sourceArtifactId: artifactId,
        sourceSession: cloneValue(explorationArtifact?.sourceSession || null),
        reportDocument,
        reportSpec,
        ...(semanticBindingViewState ? { semanticBindingViewState } : {}),
        ...(compileState ? { compileState } : {}),
    };
}

export function buildReportBuilderSavedReportPayloadRecord(savedReportPayload = null, {
    runtimeArtifact = null,
    documentVersion = 0,
    savedAt = 0,
    format = "pdf",
} = {}) {
    const payload = savedReportPayload && typeof savedReportPayload === "object" && !Array.isArray(savedReportPayload)
        ? cloneValue(savedReportPayload)
        : null;
    if (!payload) {
        return null;
    }
    const reportFill = runtimeArtifact?.reportFill && typeof runtimeArtifact.reportFill === "object" && !Array.isArray(runtimeArtifact.reportFill)
        ? cloneValue(runtimeArtifact.reportFill)
        : null;
    const reportPrint = runtimeArtifact?.reportPrint && typeof runtimeArtifact.reportPrint === "object" && !Array.isArray(runtimeArtifact.reportPrint)
        ? cloneValue(runtimeArtifact.reportPrint)
        : null;
    const exportPayload = {
        ...payload,
        ...(runtimeArtifact?.document && typeof runtimeArtifact.document === "object" && !Array.isArray(runtimeArtifact.document)
            ? { reportDocument: cloneValue(runtimeArtifact.document) }
            : {}),
        ...(runtimeArtifact?.reportSpec && typeof runtimeArtifact.reportSpec === "object" && !Array.isArray(runtimeArtifact.reportSpec)
            ? { reportSpec: cloneValue(runtimeArtifact.reportSpec) }
            : {}),
    };
    const exportRequest = buildSavedReportExportRequest({
        savedReportPayload: exportPayload,
        reportFill,
        reportPrint,
        documentVersion: Number(documentVersion || 0) || 0,
        format,
    });
    if (!exportRequest) {
        return null;
    }
    return {
        documentVersion: Number(documentVersion || 0) || 0,
        savedAt: Number(savedAt || payload?.savedAt || Date.now()) || Date.now(),
        savedReportPayload: payload,
        exportRequest,
    };
}

export function buildReportBuilderSavedReportExportRequestFromBuilderState(savedReportPayload = null, {
    runtimeArtifact = null,
    documentVersion = 0,
    savedAt = Date.now(),
    format = "pdf",
    container = {},
    config = {},
    state = {},
    semanticSummary = null,
    semanticModel = null,
    semanticModelProviderAvailable = false,
    semanticModelLoading = false,
    semanticModelError = "",
    fallbackSemanticSummary = null,
    fallbackSemanticFingerprint = "",
    semanticRuntimeDiagnostics = [],
} = {}) {
    const rebuiltSavedReportPayload = buildReportBuilderSavedReportPayloadFromBuilderState(savedReportPayload, {
        container,
        config,
        state,
        savedAt,
        semanticSummary,
        semanticModel,
        semanticModelProviderAvailable,
        semanticModelLoading,
        semanticModelError,
        fallbackSemanticSummary,
        fallbackSemanticFingerprint,
        semanticRuntimeDiagnostics,
    });
    if (!rebuiltSavedReportPayload) {
        return null;
    }
    const runtimeReportDocument = runtimeArtifact?.document && typeof runtimeArtifact.document === "object" && !Array.isArray(runtimeArtifact.document)
        ? cloneValue(runtimeArtifact.document)
        : null;
    const runtimeReportSpec = runtimeArtifact?.reportSpec && typeof runtimeArtifact.reportSpec === "object" && !Array.isArray(runtimeArtifact.reportSpec)
        ? cloneValue(runtimeArtifact.reportSpec)
        : null;
    const runtimeReportPrint = runtimeArtifact?.reportPrint && typeof runtimeArtifact.reportPrint === "object" && !Array.isArray(runtimeArtifact.reportPrint)
        ? cloneValue(runtimeArtifact.reportPrint)
        : null;
    const normalizedRuntimeIdentity = runtimeReportDocument && runtimeReportSpec
        ? applyReportDocumentIdentity(runtimeReportDocument, runtimeReportSpec, {
            reportId: normalizeString(rebuiltSavedReportPayload?.reportDocument?.id),
            title: normalizeString(runtimeReportDocument?.title || rebuiltSavedReportPayload?.reportDocument?.title),
        })
        : null;
    if (runtimeReportPrint && normalizedRuntimeIdentity?.reportDocument?.title) {
        runtimeReportPrint.title = normalizeString(normalizedRuntimeIdentity.reportDocument.title);
    }
    const exportPayload = {
        ...rebuiltSavedReportPayload,
        ...(normalizedRuntimeIdentity?.reportDocument ? { reportDocument: normalizedRuntimeIdentity.reportDocument } : {}),
        ...(normalizedRuntimeIdentity?.reportSpec ? { reportSpec: normalizedRuntimeIdentity.reportSpec } : {}),
    };
    const sourceKind = normalizeString(
        savedReportPayload?.source?.kind
        || savedReportPayload?.savedReportPayload?.source?.kind
        || savedReportPayload?.kind,
    );
    if (sourceKind === "reportBuilder.savedView") {
        return buildSavedViewReportExportRequest({
            savedView: {
                kind: sourceKind,
                id: normalizeString(exportPayload?.sourceArtifactId),
                reportId: normalizeString(exportPayload?.reportDocument?.id),
                title: normalizeString(exportPayload?.title || exportPayload?.reportDocument?.title),
            },
            reportSpec: exportPayload.reportSpec,
            reportFill: runtimeArtifact?.reportFill || null,
            reportPrint: runtimeReportPrint,
            documentVersion,
            format,
        });
    }
    if (sourceKind === "reportBuilder.publishedSnapshot") {
        return buildPublishedSnapshotReportExportRequest({
            publishedSnapshot: {
                kind: sourceKind,
                id: normalizeString(exportPayload?.sourceArtifactId),
                reportId: normalizeString(exportPayload?.reportDocument?.id),
                title: normalizeString(exportPayload?.title || exportPayload?.reportDocument?.title),
            },
            reportSpec: exportPayload.reportSpec,
            reportFill: runtimeArtifact?.reportFill || null,
            reportPrint: runtimeReportPrint,
            documentVersion,
            format,
        });
    }
    return buildSavedReportExportRequest({
        savedReportPayload: exportPayload,
        reportFill: runtimeArtifact?.reportFill || null,
        reportPrint: runtimeReportPrint,
        documentVersion,
        format,
    });
}

export function buildReportBuilderSavedReportPayloadFromBuilderState(savedReportPayload = null, {
    container = {},
    config = {},
    state = {},
    savedAt = Date.now(),
    semanticSummary = null,
    semanticModel = null,
    semanticModelProviderAvailable = false,
    semanticModelLoading = false,
    semanticModelError = "",
    fallbackSemanticSummary = null,
    fallbackSemanticFingerprint = "",
    semanticRuntimeDiagnostics = [],
} = {}) {
    const seed = resolveSavedReportPayloadSeed(savedReportPayload);
    if (!seed) {
        return null;
    }
    const authoredState = stripBuilderOnlyState(state);
    const semanticRuntimeState = resolveReportBuilderSemanticRuntimeState({
        config,
        state: authoredState,
        binding: authoredState?.binding || config?.binding || null,
        model: semanticModel,
        providerAvailable: semanticModelProviderAvailable,
        modelLoading: semanticModelLoading,
        modelError: semanticModelError,
        fallbackSummary: fallbackSemanticSummary,
        fallbackFingerprint: fallbackSemanticFingerprint,
    });
    const implicitSemanticRuntimeDiagnostics = Array.isArray(semanticRuntimeDiagnostics) && semanticRuntimeDiagnostics.length > 0
        ? []
        : buildReportBuilderSemanticRuntimeDiagnosticsFromState({
            config,
            state: authoredState,
            binding: authoredState?.binding || config?.binding || null,
            model: semanticModel,
            providerAvailable: semanticModelProviderAvailable,
            modelLoading: semanticModelLoading,
            modelError: semanticModelError,
        });
    const nextDocument = buildReportBuilderReportDocument({
        container,
        config: semanticRuntimeState.semanticDisplayConfig,
        state: authoredState,
        semanticSummary: semanticSummary || semanticRuntimeState.resolvedSemanticSummary || semanticRuntimeState.semanticSummary,
    });
    const nextSpec = lowerReportDocumentToReportSpec(nextDocument);
    const withIdentity = applyReportDocumentIdentity(nextDocument, nextSpec, {
        reportId: seed.reportId || normalizeString(nextDocument?.id),
        title: resolveReportBuilderSavedPayloadIdentityTitle(authoredState, seed, nextDocument),
    });
    const sourceArtifactId = seed.sourceArtifactId || seed.reportId || "report";
    const payloadId = seed.payloadId || `rbreport_${sourceArtifactId}`;
    const persistedTitle = normalizeString(withIdentity.reportDocument?.title)
        || seed.title
        || normalizeString(seed.reportId || "Report");
    const compileState = buildSavedReportPayloadCompileStateFromBuilderState(
        withIdentity.reportSpec,
        withIdentity.reportDocument,
        [
            ...implicitSemanticRuntimeDiagnostics,
            ...(Array.isArray(semanticRuntimeDiagnostics) ? semanticRuntimeDiagnostics : []),
        ],
    );
    const semanticBindingViewState = buildReportBuilderSemanticBindingViewState({
        semanticSummary: semanticSummary || semanticRuntimeState.resolvedSemanticSummary || semanticRuntimeState.semanticSummary,
        binding: authoredState?.binding || config?.binding || null,
    });
    return {
        version: 1,
        kind: seed.kind,
        payloadId,
        savedAt: Number(savedAt || Date.now()) || Date.now(),
        title: persistedTitle,
        sourceArtifactId,
        sourceSession: seed.sourceSession,
        reportDocument: withIdentity.reportDocument,
        reportSpec: withIdentity.reportSpec,
        ...(semanticBindingViewState ? { semanticBindingViewState } : {}),
        ...(compileState ? { compileState } : {}),
    };
}

export function buildReportBuilderSavedReportPayloadSummary(payload = null, {
    localSavedPayloads = [],
} = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return null;
    }
    const compileState = buildSavedReportPayloadCompileState(payload);
    const storedCompileStatus = normalizeString(payload?.compileState?.status);
    const templateIdentity = extractSavedReportPayloadTemplateIdentity(payload);
    const templateConflictState = buildSavedReportPayloadTemplateConflictState(payload);
    const payloadContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec: payload?.reportSpec || null,
        document: payload?.reportDocument || null,
        title: payload?.title || "",
    });
    const semanticBindingViewState = normalizeSemanticBindingViewState(payload?.semanticBindingViewState)
        || buildReportBuilderSemanticBindingViewState({
            semanticSummary: payloadContext?.semanticSummary || null,
            binding: payloadContext?.binding || null,
        });
    const scopeSummary = buildSavedReportPayloadScopeSummary(payload);
    const authoredSummary = buildSavedReportPayloadAuthoredSummary(payloadContext);
    const drillSummary = buildSavedReportPayloadDrillSummary(payloadContext);
    const subtitle = normalizeString(payloadContext?.document?.subtitle || payload?.reportDocument?.subtitle);
    const description = normalizeString(payloadContext?.document?.description || payload?.reportDocument?.description);
    const blockCount = Array.isArray(payload?.reportSpec?.blocks) ? payload.reportSpec.blocks.length : 0;
    const datasetCount = Array.isArray(payload?.reportSpec?.datasets) ? payload.reportSpec.datasets.length : 0;
    const shareableSummary = buildShareableArtifactSummary(payload);
    const savedViewOverlay = extractSavedViewOverlayArtifactState(payload);
    const savedViewOverlaySummary = buildSavedViewOverlaySummary(payload, {
        document: payloadContext?.document || null,
        reportSpec: payloadContext?.reportSpec || null,
    });
    const reopenSourceResolutionState = savedViewOverlay
        ? resolveReportBuilderSavedViewOverlayReopenSourceResolution(savedViewOverlay, localSavedPayloads)?.state
        : null;
    return {
        title: normalizeString(payload?.title || payloadContext?.title || "Report"),
        ...(subtitle ? { subtitle } : {}),
        ...(description ? { description } : {}),
        payloadId: normalizeString(payload?.payloadId),
        kind: normalizeString(payload?.kind),
        sourceArtifactId: normalizeString(payload?.sourceArtifactId),
        sourceLabel: normalizeString(
            payload?.sourceSession?.sourceRef?.contextLabel
            || payload?.sourceSession?.sourceRef?.chartTitle
            || payload?.sourceSession?.sourceRef?.primaryMeasure,
        ),
        compileStatus: storedCompileStatus || normalizeString(compileState?.status),
        blockCount,
        datasetCount,
        ...(semanticBindingViewState ? {
            semanticBindingTitle: semanticBindingViewState.title,
            semanticBindingChips: semanticBindingViewState.chips,
            ...(Array.isArray(semanticBindingViewState.fieldGroups) && semanticBindingViewState.fieldGroups.length > 0
                ? { semanticBindingFieldGroups: semanticBindingViewState.fieldGroups }
                : {}),
        } : {}),
        ...(scopeSummary ? {
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
        ...(savedViewOverlaySummary ? {
            savedViewOverlayTitle: savedViewOverlaySummary.title,
            savedViewOverlayText: savedViewOverlaySummary.text,
            savedViewOverlayChips: savedViewOverlaySummary.chips,
            ...(Array.isArray(savedViewOverlaySummary.diagnostics) && savedViewOverlaySummary.diagnostics.length > 0
                ? { savedViewOverlayDiagnostics: savedViewOverlaySummary.diagnostics }
                : {}),
        } : {}),
        ...(reopenSourceResolutionState ? reopenSourceResolutionState : {}),
        ...(shareableSummary ? shareableSummary : {}),
        ...(templateConflictState ? templateConflictState : {}),
        ...(templateIdentity ? templateIdentity : {}),
    };
}

export function serializeReportBuilderSavedReportPayload(payload = null, {
    pretty = true,
} = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return "";
    }
    return pretty === false
        ? JSON.stringify(payload)
        : JSON.stringify(payload, null, 2);
}

export function buildReportBuilderSavedReportPayloadInspectorState(payload = null, {
    localSavedPayloads = [],
} = {}) {
    const summary = buildReportBuilderSavedReportPayloadSummary(payload, {
        localSavedPayloads,
    });
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
        content: serializeReportBuilderSavedReportPayload(payload),
    };
}

export function buildReportBuilderSavedReportPayloadDownload(payload = null) {
    const summary = buildReportBuilderSavedReportPayloadSummary(payload);
    if (!summary) {
        return null;
    }
    const content = serializeReportBuilderSavedReportPayload(payload);
    if (!content) {
        return null;
    }
    const normalizedName = sanitizeFilenameSegment(summary.title || summary.payloadId || "saved-report-payload")
        || "saved-report-payload";
    return {
        filename: `${normalizedName}-saved-report-payload.json`,
        mimeType: "application/json;charset=utf-8",
        payload: content,
    };
}

import {
    buildReportBuilderReportDocument,
    lowerReportDocumentToReportSpec,
} from "../../reporting/reportDocumentModel.js";
import { buildReportDocumentCompileState } from "../../reporting/reportDocumentStore.js";
import {
    buildReportBuilderDocumentCompileDiagnostics,
    buildReportBuilderScopeSummaryFromParams,
} from "./reportBuilderDocumentBlocks.js";
import { buildReportBuilderSemanticRuntimeDiagnosticsFromState } from "./reportBuilderSemantic.js";
import { normalizeReportBuilderExplorationSession } from "./reportBuilderExplorationSession.js";
import { buildReportBuilderSemanticBindingViewState } from "./reportBuilderSemanticBindingViewState.js";
import {
    resolvePreferredReportBuilderSemanticBindingViewState,
} from "./reportBuilderSemanticBindingViewPreference.js";
import { resolveNormalizedReportSpecDocumentContext } from "./reportBuilderSavedRecordMetadataContext.js";
import { resolveReportBuilderSemanticRuntimeState } from "./useReportBuilderSemanticRuntimeState.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function sanitizeFilenameSegment(value = "") {
    return normalizeString(value).replace(/[\\/:*?"<>|]+/g, "-");
}

function stripExplorationSession(state = {}) {
    const next = cloneValue(state && typeof state === "object" && !Array.isArray(state) ? state : {});
    delete next.explorationSession;
    return next;
}

export function buildReportBuilderExplorationArtifact({
    container = {},
    config = {},
    state = {},
    refinements = [],
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
    const session = normalizeReportBuilderExplorationSession(state?.explorationSession, {
        nowMs: Number(savedAt || Date.now()) || Date.now(),
    });
    if (!session) {
        return null;
    }
    const authoredState = stripExplorationSession(state);
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
    const document = buildReportBuilderReportDocument({
        container,
        config: semanticRuntimeState.semanticDisplayConfig,
        state: authoredState,
        refinements,
        semanticSummary: semanticSummary || semanticRuntimeState.resolvedSemanticSummary || semanticRuntimeState.semanticSummary,
    });
    const reportSpec = lowerReportDocumentToReportSpec(document);
    const diagnostics = [
        ...buildReportBuilderDocumentCompileDiagnostics({
            document,
        }),
        ...implicitSemanticRuntimeDiagnostics,
        ...(Array.isArray(semanticRuntimeDiagnostics) ? semanticRuntimeDiagnostics : []),
    ];
    const seen = new Set();
    const compileState = buildReportDocumentCompileState(reportSpec, {
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
    const semanticBindingViewState = buildReportBuilderSemanticBindingViewState({
        semanticSummary: semanticSummary || semanticRuntimeState.resolvedSemanticSummary || semanticRuntimeState.semanticSummary,
        binding: authoredState?.binding || config?.binding || null,
    });
    const savedTimestamp = Number(savedAt || Date.now()) || Date.now();
    return {
        version: 1,
        kind: "reportBuilder.explorationArtifact",
        artifactId: `rbexploration_${normalizeString(session.sessionId)}_${savedTimestamp}`,
        savedAt: savedTimestamp,
        title: normalizeString(document?.title || container?.title || "Report"),
        sourceSession: {
            sessionId: session.sessionId,
            sourceRef: cloneValue(session.sourceRef),
            dirty: session.dirty === true,
            historyIndex: Number(session.historyIndex || 0) || 0,
        },
        document,
        reportSpec,
        ...(semanticBindingViewState ? { semanticBindingViewState } : {}),
        ...(compileState ? { compileState } : {}),
    };
}

export function buildReportBuilderExplorationArtifactSummary(artifact = null) {
    if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
        return null;
    }
    const artifactContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec: artifact?.reportSpec || null,
        document: artifact?.document || null,
        title: artifact?.title || "",
    });
    const semanticBindingViewState = resolvePreferredReportBuilderSemanticBindingViewState({
        metadataContexts: [artifactContext],
        candidates: [artifact?.semanticBindingViewState],
    });
    const subtitle = normalizeString(artifactContext?.document?.subtitle || artifact?.document?.subtitle);
    const description = normalizeString(artifactContext?.document?.description || artifact?.document?.description);
    const blockCount = Array.isArray(artifact?.reportSpec?.blocks) ? artifact.reportSpec.blocks.length : 0;
    const datasetCount = Array.isArray(artifact?.reportSpec?.datasets) ? artifact.reportSpec.datasets.length : 0;
    const scopeSummary = buildReportBuilderScopeSummaryFromParams(artifactContext?.scopeParams);
    return {
        title: normalizeString(artifact?.title || artifactContext?.title || "Report"),
        ...(subtitle ? { subtitle } : {}),
        ...(description ? { description } : {}),
        artifactId: normalizeString(artifact?.artifactId),
        kind: normalizeString(artifact?.kind),
        sourceKind: normalizeString(artifact?.sourceSession?.sourceRef?.kind),
        sourceLabel: normalizeString(artifact?.sourceSession?.sourceRef?.contextLabel || artifact?.sourceSession?.sourceRef?.chartTitle || artifact?.sourceSession?.sourceRef?.primaryMeasure),
        blockCount,
        datasetCount,
        ...(semanticBindingViewState ? {
            semanticBindingTitle: semanticBindingViewState.title,
            semanticBindingChips: semanticBindingViewState.chips,
            ...(Array.isArray(semanticBindingViewState.fieldGroups) && semanticBindingViewState.fieldGroups.length > 0
                ? { semanticBindingFieldGroups: semanticBindingViewState.fieldGroups }
                : {}),
        } : {}),
        ...(Array.isArray(scopeSummary?.items) && scopeSummary.items.length > 0 ? {
            scopeSummaryTitle: "Filters",
            scopeSummaryText: scopeSummary.text,
            scopeSummaryItems: scopeSummary.items,
        } : {}),
    };
}

export function serializeReportBuilderExplorationArtifact(artifact = null, {
    pretty = true,
} = {}) {
    if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
        return "";
    }
    return pretty === false
        ? JSON.stringify(artifact)
        : JSON.stringify(artifact, null, 2);
}

export function buildReportBuilderExplorationArtifactInspectorState(artifact = null) {
    const summary = buildReportBuilderExplorationArtifactSummary(artifact);
    if (!summary) {
        return null;
    }
    return {
        ...summary,
        ...(summary.subtitle ? { headerSubtitle: summary.subtitle } : {}),
        ...(summary.description ? { headerDescription: summary.description } : {}),
        payload: serializeReportBuilderExplorationArtifact(artifact),
    };
}

export function buildReportBuilderExplorationArtifactDownload(artifact = null) {
    const summary = buildReportBuilderExplorationArtifactSummary(artifact);
    if (!summary) {
        return null;
    }
    const payload = serializeReportBuilderExplorationArtifact(artifact);
    if (!payload) {
        return null;
    }
    const normalizedName = sanitizeFilenameSegment(summary.title || summary.artifactId || "exploration-artifact")
        || "exploration-artifact";
    return {
        filename: `${normalizedName}-exploration-artifact.json`,
        mimeType: "application/json;charset=utf-8",
        payload,
    };
}

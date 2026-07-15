import {
    buildReportBuilderChartFields,
    mergeReportBuilderState,
    sanitizeReportBuilderState,
    validateReportBuilderChartSpec,
} from "./reportBuilderUtils.js";
import { resolveReportBuilderReopenCompatibility } from "./reportBuilderHydratedReportDocumentDiagnostic.js";
import {
    buildReportBuilderSemanticValidationRequest,
    normalizeReportBuilderSemanticSummary,
} from "./reportBuilderSemantic.js";
import {
    resolveReportDocumentBuilderContext,
    extractReportDocumentTemplateIdentity as extractReportDocumentTemplateIdentityFromModel,
    normalizeReportBuilderDocumentBlocks,
} from "../../reporting/reportDocumentModel.js";
import { resolveReportBuilderBlock } from "../../reporting/reportBuilderBlockModel.js";
import { resolveScopeBindingFilterId } from "../../reporting/scopeBindingModel.js";
import { mergeScopeParamValues } from "../../reporting/scopeStateModel.js";
import { resolveNormalizedReportSpecDocumentContext } from "./reportBuilderSavedRecordMetadataContext.js";
import { normalizeReportRuntimeInteractionState } from "./reportRuntimeInteractionStateModel.js";
import {
    applySavedViewOverlayScopeParams,
    applySavedViewOverlayToBuilderState,
    buildSavedViewOverlaySummary,
    extractSavedViewOverlayArtifactState,
} from "../../reporting/views/savedViewOverlayModel.js";
import { normalizeReportBuilderSavedReportRecords } from "./reportBuilderSavedReportRecords.js";
import {
    resolveReportBuilderSavedViewOverlayReferencedRecord as resolveSavedViewOverlayReferencedRecord,
} from "./reportBuilderReopenSourceResolution.js";
import { normalizeReportBuilderPublishedDataSources } from "../../reporting/reportBuilderPublishedDatasetModel.js";
import equal from "fast-deep-equal";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeSavedReportPayloadSource(source = null) {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
        return null;
    }
    const kind = normalizeString(source?.kind);
    const payloadId = normalizeString(source?.payloadId);
    const sourceArtifactId = normalizeString(source?.sourceArtifactId);
    const reportId = normalizeString(source?.reportId || source?.reportRef?.reportId);
    if (!kind && !payloadId && !sourceArtifactId && !reportId) {
        return null;
    }
    return {
        ...(kind ? { kind } : {}),
        ...(payloadId ? { payloadId } : {}),
        ...(sourceArtifactId ? { sourceArtifactId } : {}),
        ...(reportId ? { reportId } : {}),
    };
}

function normalizeSavedViewOverlayResolvedSource(source = null) {
    return normalizeSavedReportPayloadSource(source);
}

function normalizeHydratedSharedArtifactState(value = null, {
    fallbackKind = "",
} = {}) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const artifactId = normalizeString(value?.artifactId || value?.id);
    const artifactKind = normalizeString(value?.artifactKind || fallbackKind);
    const lifecycle = normalizeString(value?.lifecycle).toLowerCase();
    const ownerRef = normalizeString(value?.ownerRef);
    const policyRef = normalizeString(value?.policyRef);
    const artifactRef = normalizeString(value?.artifactRef);
    const shareableVersion = Number(value?.shareableVersion || 0) || 0;
    const badges = Array.isArray(value?.badges) ? cloneValue(value.badges) : [];
    const capabilities = isPlainObject(value?.capabilities) ? cloneValue(value.capabilities) : null;
    const grants = Array.isArray(value?.grants) ? cloneValue(value.grants) : [];
    if (!artifactId && !lifecycle && !ownerRef && !policyRef && !artifactRef && shareableVersion < 1 && badges.length === 0 && !capabilities && grants.length === 0) {
        return null;
    }
    return {
        ...(artifactId ? { artifactId } : {}),
        ...(artifactKind ? { artifactKind } : {}),
        ...(artifactRef ? { artifactRef } : {}),
        ...(lifecycle ? { lifecycle } : {}),
        ...(ownerRef ? { ownerRef } : {}),
        ...(policyRef ? { policyRef } : {}),
        ...(shareableVersion > 0 ? { shareableVersion } : {}),
        ...(badges.length > 0 ? { badges } : {}),
        ...(capabilities ? { capabilities } : {}),
        ...(grants.length > 0 ? { grants } : {}),
    };
}

function normalizeCompileDiagnostics(diagnostics = []) {
    return (Array.isArray(diagnostics) ? diagnostics : [])
        .filter((diagnostic) => diagnostic && typeof diagnostic === "object" && !Array.isArray(diagnostic))
        .map((diagnostic) => {
            const code = normalizeString(diagnostic?.code);
            const severity = normalizeString(diagnostic?.severity).toLowerCase() || "error";
            const message = normalizeString(diagnostic?.message);
            if (!code || !message) {
                return null;
            }
            return {
                code,
                severity,
                ...(normalizeString(diagnostic?.path) ? { path: normalizeString(diagnostic.path) } : {}),
                ...(normalizeString(diagnostic?.blockId) ? { blockId: normalizeString(diagnostic.blockId) } : {}),
                message,
                ...(normalizeString(diagnostic?.suggestedFix) ? { suggestedFix: normalizeString(diagnostic.suggestedFix) } : {}),
            };
        })
        .filter(Boolean);
}

function normalizeReportBuilderHydratedCompileState(compileState = null) {
    if (!compileState || typeof compileState !== "object" || Array.isArray(compileState)) {
        return null;
    }
    const status = normalizeString(compileState?.status).toLowerCase();
    const reportSpecVersion = Number(compileState?.reportSpecVersion || 0) || 0;
    const blockCount = Number(compileState?.blockCount || 0) || 0;
    const datasetCount = Number(compileState?.datasetCount || 0) || 0;
    const diagnostics = normalizeCompileDiagnostics(compileState?.diagnostics);
    if (!status && reportSpecVersion < 1 && blockCount < 1 && datasetCount < 1 && diagnostics.length === 0) {
        return null;
    }
    return {
        ...(status ? { status } : {}),
        ...(reportSpecVersion > 0 ? { reportSpecVersion } : {}),
        ...(blockCount > 0 ? { blockCount } : {}),
        ...(datasetCount > 0 ? { datasetCount } : {}),
        ...(diagnostics.length > 0 ? { diagnostics } : {}),
    };
}

function mergeHydratedCompileState(compileState = null, diagnostics = []) {
    const normalizedCompileState = normalizeReportBuilderHydratedCompileState(compileState);
    const normalizedDiagnostics = normalizeCompileDiagnostics(diagnostics);
    if (!normalizedCompileState && normalizedDiagnostics.length === 0) {
        return null;
    }
    const nextState = normalizedCompileState
        ? cloneValue(normalizedCompileState)
        : { status: "clean" };
    if (normalizedDiagnostics.length > 0) {
        nextState.diagnostics = [
            ...(Array.isArray(nextState?.diagnostics) ? nextState.diagnostics : []),
            ...normalizedDiagnostics,
        ];
        if (normalizedDiagnostics.some((diagnostic) => normalizeString(diagnostic?.severity).toLowerCase() === "error")) {
            nextState.status = "invalid";
        } else if (!normalizeString(nextState.status)) {
            nextState.status = "clean";
        }
    }
    return nextState;
}

function buildSavedViewOverlayApplicationDiagnostics(savedViewOverlay = null, state = {}, config = {}) {
    const diagnostics = [];
    const requestedOrderField = normalizeString(savedViewOverlay?.overlay?.order?.field);
    if (requestedOrderField && normalizeString(state?.orderField) !== requestedOrderField) {
        diagnostics.push({
            code: "savedViewOverlayOrderFieldIncompatible",
            severity: "warning",
            path: "$.savedViewOverlay.overlay.order.field",
            message: `Saved view overlay order field '${requestedOrderField}' is not compatible with the reopened builder state.`,
        });
    }
    const activePresetTitle = normalizeString(savedViewOverlay?.overlay?.presentation?.activeTablePreset);
    if (activePresetTitle && normalizeString(state?.activeTablePreset?.title) !== activePresetTitle) {
        diagnostics.push({
            code: "savedViewOverlayActiveTablePresetIncompatible",
            severity: "warning",
            path: "$.savedViewOverlay.overlay.presentation.activeTablePreset",
            message: `Saved view overlay active table preset '${activePresetTitle}' is not compatible with the reopened builder state.`,
        });
    }
    const lastPresetTitle = normalizeString(savedViewOverlay?.overlay?.presentation?.lastTablePreset);
    if (lastPresetTitle && normalizeString(state?.lastTablePreset?.title) !== lastPresetTitle) {
        diagnostics.push({
            code: "savedViewOverlayLastTablePresetIncompatible",
            severity: "warning",
            path: "$.savedViewOverlay.overlay.presentation.lastTablePreset",
            message: `Saved view overlay last table preset '${lastPresetTitle}' is not compatible with the reopened builder state.`,
        });
    }
    const requestedChartSpec = savedViewOverlay?.overlay?.presentation?.chartSpec
        && typeof savedViewOverlay.overlay.presentation.chartSpec === "object"
        && !Array.isArray(savedViewOverlay.overlay.presentation.chartSpec)
        ? savedViewOverlay.overlay.presentation.chartSpec
        : null;
    if (requestedChartSpec) {
        const chartFields = buildReportBuilderChartFields(config, state);
        const validation = validateReportBuilderChartSpec(config, requestedChartSpec, chartFields);
        if (!validation.valid) {
            diagnostics.push({
                code: "savedViewOverlayChartSpecIncompatible",
                severity: "warning",
                path: "$.savedViewOverlay.overlay.presentation.chartSpec",
                message: "Saved view overlay chartSpec is not compatible with the reopened builder state.",
            });
        }
    }
    return diagnostics;
}

function buildSavedViewOverlayReferenceDiagnostics(savedViewOverlay = null, {
    reportId = "",
} = {}) {
    const diagnostics = [];
    const normalizedReportId = normalizeString(reportId);
    const baseReportId = normalizeString(savedViewOverlay?.baseReportRef?.reportId);
    if (savedViewOverlay?.baseReportRef && !baseReportId) {
        diagnostics.push({
            code: "savedViewOverlayBaseReportUnresolved",
            severity: "warning",
            path: "$.savedViewOverlay.baseReportRef",
            message: "Saved view overlay base report identity cannot be verified against the reopened report.",
        });
    }
    if (baseReportId && normalizedReportId && baseReportId !== normalizedReportId) {
        diagnostics.push({
            code: "savedViewOverlayBaseReportMismatch",
            severity: "warning",
            path: "$.savedViewOverlay.baseReportRef.reportId",
            message: `Saved view overlay base report '${baseReportId}' does not match reopened report '${normalizedReportId}'.`,
        });
    }
    const snapshotReportId = normalizeString(savedViewOverlay?.publishedSnapshotRef?.reportId);
    if (savedViewOverlay?.publishedSnapshotRef && !snapshotReportId) {
        diagnostics.push({
            code: "savedViewOverlayPublishedSnapshotReportUnresolved",
            severity: "warning",
            path: "$.savedViewOverlay.publishedSnapshotRef",
            message: "Saved view overlay published snapshot identity cannot be verified against the reopened report.",
        });
    }
    if (snapshotReportId && normalizedReportId && snapshotReportId !== normalizedReportId) {
        diagnostics.push({
            code: "savedViewOverlayPublishedSnapshotReportMismatch",
            severity: "warning",
            path: "$.savedViewOverlay.publishedSnapshotRef.reportId",
            message: `Saved view overlay published snapshot report '${snapshotReportId}' does not match reopened report '${normalizedReportId}'.`,
        });
    }
    return diagnostics;
}

function buildSavedViewOverlayResolvedRecordDiagnostics({
    savedViewOverlay = null,
    baseRecord = null,
    baseResolution = null,
    snapshotRecord = null,
    snapshotResolution = null,
} = {}) {
    const diagnostics = [];
    if (savedViewOverlay?.baseReportRef && baseResolution?.reason === "notFound") {
        diagnostics.push({
            code: "savedViewOverlayBaseReportNotFound",
            severity: "warning",
            path: "$.savedViewOverlay.baseReportRef",
            message: "Saved view overlay base report could not be resolved locally.",
        });
    }
    if (savedViewOverlay?.baseReportRef && baseResolution?.reason === "versionMismatch") {
        diagnostics.push({
            code: "savedViewOverlayBaseReportVersionMismatch",
            severity: "warning",
            path: "$.savedViewOverlay.baseReportRef.documentVersion",
            message: `Saved view overlay base report version ${baseResolution.requestedVersion} could not be resolved locally; found version ${baseResolution.resolvedVersion} instead.`,
        });
    }
    if (savedViewOverlay?.publishedSnapshotRef && snapshotResolution?.reason === "notFound") {
        diagnostics.push({
            code: "savedViewOverlayPublishedSnapshotNotFound",
            severity: "warning",
            path: "$.savedViewOverlay.publishedSnapshotRef",
            message: "Saved view overlay published snapshot could not be resolved locally.",
        });
    }
    if (savedViewOverlay?.publishedSnapshotRef && snapshotResolution?.reason === "versionMismatch") {
        diagnostics.push({
            code: "savedViewOverlayPublishedSnapshotVersionMismatch",
            severity: "warning",
            path: "$.savedViewOverlay.publishedSnapshotRef.documentVersion",
            message: `Saved view overlay published snapshot version ${snapshotResolution.requestedVersion} could not be resolved locally; found version ${snapshotResolution.resolvedVersion} instead.`,
        });
    }
    if (baseRecord && snapshotRecord && normalizeString(baseRecord?.reportId) !== normalizeString(snapshotRecord?.reportId)) {
        diagnostics.push({
            code: "savedViewOverlayResolvedSnapshotBaseReportMismatch",
            severity: "warning",
            path: "$.savedViewOverlay.publishedSnapshotRef.reportId",
            message: `Resolved published snapshot report '${normalizeString(snapshotRecord?.reportId)}' does not match resolved base report '${normalizeString(baseRecord?.reportId)}'.`,
        });
    }
    return diagnostics;
}

function normalizeHydratedScopeParams(params = []) {
    return (Array.isArray(params) ? params : [])
        .filter((param) => param && typeof param === "object" && !Array.isArray(param))
        .map((param) => {
            const id = normalizeString(param?.id);
            const label = normalizeString(param?.label || param?.id);
            if (!id || !label) {
                return null;
            }
            const description = normalizeString(param?.description);
            return {
                id,
                label,
                ...(description ? { description } : {}),
            };
        })
        .filter(Boolean);
}

function mergeHydratedScopeParamsWithSemanticSummary(scopeParams = [], semanticSummary = null) {
    const normalizedScopeParams = normalizeHydratedScopeParams(scopeParams);
    const normalizedSemanticSummary = normalizeReportBuilderSemanticSummary(semanticSummary);
    const semanticParameterIndex = new Map(
        (Array.isArray(normalizedSemanticSummary?.selectedParameters) ? normalizedSemanticSummary.selectedParameters : [])
            .map((parameter) => [
                normalizeString(parameter?.rawId || parameter?.id),
                parameter,
            ])
            .filter(([id, parameter]) => !!id && !!parameter),
    );
    return normalizedScopeParams.map((param) => {
        const parameter = semanticParameterIndex.get(normalizeString(param?.id)) || null;
        if (!parameter) {
            return param;
        }
        const currentLabel = normalizeString(param?.label);
        const semanticLabel = normalizeString(parameter?.label);
        const currentDescription = normalizeString(param?.description);
        const semanticDescription = normalizeString(parameter?.description);
        return {
            ...param,
            label: currentLabel && currentLabel !== normalizeString(param?.id)
                ? currentLabel
                : (semanticLabel || currentLabel || normalizeString(param?.id)),
            ...(currentDescription
                ? { description: currentDescription }
                : (semanticDescription ? { description: semanticDescription } : {})),
        };
    });
}

const REPORT_DOCUMENT_REOPEN_SESSION_KEY = "reportDocumentReopenSession";
const BLOCKING_SAVED_VIEW_OVERLAY_DIAGNOSTIC_CODES = new Set([
    "savedViewOverlaySnapshotBaseReportMismatch",
    "savedViewOverlaySnapshotBaseVersionStale",
    "savedViewOverlayBaseReportUnresolved",
    "savedViewOverlayBaseReportMismatch",
    "savedViewOverlayBaseReportNotFound",
    "savedViewOverlayBaseReportVersionMismatch",
    "savedViewOverlayPublishedSnapshotReportUnresolved",
    "savedViewOverlayPublishedSnapshotReportMismatch",
    "savedViewOverlayPublishedSnapshotNotFound",
    "savedViewOverlayPublishedSnapshotVersionMismatch",
    "savedViewOverlayResolvedSnapshotBaseReportMismatch",
]);

function normalizePositiveInteger(value) {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : 0;
}

function stripExplorationSession(state = {}) {
    const next = cloneValue(state && typeof state === "object" && !Array.isArray(state) ? state : {});
    delete next.explorationSession;
    return next;
}

function buildHydratedDocumentSemanticFingerprint(config = {}, state = {}) {
    const request = buildReportBuilderSemanticValidationRequest(
        config,
        state,
        state?.binding || config?.binding,
    );
    return request ? JSON.stringify(request) : "";
}

function extractHydratedDocumentTemplateIdentity(hydratedDocument = null) {
    const documentTemplateIdentity = extractReportDocumentTemplateIdentityFromModel(hydratedDocument?.document);
    const templateId = normalizeString(
        documentTemplateIdentity?.templateId
        || hydratedDocument?.state?.reportDocumentTemplateId,
    );
    const templateLabel = normalizeString(
        documentTemplateIdentity?.templateLabel
        || hydratedDocument?.state?.reportDocumentTemplateLabel,
    );
    if (!templateId && !templateLabel) {
        return null;
    }
    return {
        ...(templateId ? { templateId } : {}),
        ...(templateLabel ? { templateLabel } : {}),
    };
}

function extractReportBuilderAdditionalBlocks(document = null) {
    const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
    return normalizeReportBuilderDocumentBlocks(
        blocks.filter((block) => normalizeString(block?.kind) !== "reportBuilderBlock"),
    );
}

function applyReportDocumentScopeBindings(document = {}, block = {}, scopeParams = []) {
    const documentScopeParams = Array.isArray(document?.scope?.params) ? document.scope.params : [];
    const params = new Map(
        ((documentScopeParams.length > 0 ? documentScopeParams : scopeParams))
            .map((entry) => [normalizeString(entry?.id), entry])
            .filter(([id]) => !!id),
    );
    const boundScopeValues = {};
    (Array.isArray(block?.scopeBindings) ? block.scopeBindings : []).forEach((binding) => {
        const paramId = normalizeString(binding?.paramId);
        const filterId = resolveScopeBindingFilterId(binding?.target);
        if (!paramId || !filterId) {
            return;
        }
        const param = params.get(paramId);
        if (!param || !Object.prototype.hasOwnProperty.call(param, "value")) {
            return;
        }
        boundScopeValues[filterId] = cloneValue(param.value);
    });
    return mergeScopeParamValues(stripExplorationSession(block?.state || {}), boundScopeValues);
}

export function buildHydratedReportBuilderDocument(getResponse = null, {
    container = {},
    builderIdentity = {},
    localSavedPayloads = [],
} = {}) {
    if (!getResponse || typeof getResponse !== "object" || Array.isArray(getResponse)) {
        return {
            valid: false,
            code: "missingResponse",
            message: "A reopen bundle is required to reopen the builder.",
        };
    }
    if (normalizeString(getResponse?.kind) !== "getReportDocumentResponse") {
        return {
            valid: false,
            code: "unsupportedResponse",
            message: "Only reopen bundles can be reopened into the builder.",
        };
    }
    if (normalizePositiveInteger(getResponse?.version) < 1) {
        return {
            valid: false,
            code: "unsupportedResponseVersion",
            message: "The saved reopen bundle version is not supported.",
        };
    }
    const hydratedContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec: getResponse?.reportSpec || null,
        document: getResponse?.document || null,
        title: getResponse?.title || getResponse?.reportRef?.reportId || "",
    });
    const document = hydratedContext?.document ? cloneValue(hydratedContext.document) : null;
    const reportSpec = hydratedContext?.reportSpec ? cloneValue(hydratedContext.reportSpec) : null;
    if (normalizeString(document?.kind) !== "reportDocument") {
        return {
            valid: false,
            code: "invalidDocument",
            message: "Only persisted ReportDocument artifacts can be reopened into the builder.",
        };
    }
    if (normalizePositiveInteger(document?.version) < 1) {
        return {
            valid: false,
            code: "unsupportedDocumentVersion",
            message: "The saved ReportDocument version is not supported for reopen.",
        };
    }
    const savedViewOverlay = extractSavedViewOverlayArtifactState(getResponse);
    const reportId = normalizeString(getResponse?.reportRef?.reportId || document?.id);
    const hasLocalSavedPayloadContext = Array.isArray(localSavedPayloads) && localSavedPayloads.length > 0;
    const baseResolution = savedViewOverlay?.baseReportRef && hasLocalSavedPayloadContext
        ? resolveSavedViewOverlayReferencedRecord(savedViewOverlay.baseReportRef, localSavedPayloads, {
            expectedSourceKind: "reportBuilder.savedReportPayload",
            requireExactVersion: true,
        })
        : { record: null, reason: "" };
    const snapshotResolution = savedViewOverlay?.publishedSnapshotRef && hasLocalSavedPayloadContext
        ? resolveSavedViewOverlayReferencedRecord(savedViewOverlay.publishedSnapshotRef, localSavedPayloads, {
            expectedSourceKind: "reportBuilder.publishedSnapshot",
            requireExactVersion: true,
        })
        : { record: null, reason: "" };
    const resolvedBaseRecord = baseResolution?.record || null;
    const resolvedSnapshotRecord = snapshotResolution?.record || null;
    const overlayReferenceDiagnostics = savedViewOverlay
        ? buildSavedViewOverlayReferenceDiagnostics(savedViewOverlay, {
            reportId,
        })
        : [];
    const overlayResolvedRecordDiagnostics = savedViewOverlay
        ? buildSavedViewOverlayResolvedRecordDiagnostics({
            savedViewOverlay,
            baseRecord: resolvedBaseRecord,
            baseResolution,
            snapshotRecord: resolvedSnapshotRecord,
            snapshotResolution,
        })
        : [];
    const sourceDocument = resolvedSnapshotRecord?.document || resolvedBaseRecord?.document || document;
    const sourceReportSpec = resolvedSnapshotRecord?.reportSpec || resolvedBaseRecord?.reportSpec || reportSpec;
    const sourceHydratedContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec: sourceReportSpec || null,
        document: sourceDocument || null,
        title: getResponse?.title || getResponse?.reportRef?.reportId || "",
    });
    const overlaySummary = savedViewOverlay
        ? buildSavedViewOverlaySummary(getResponse, {
            document: sourceDocument,
            reportSpec: sourceReportSpec,
        })
        : null;
    const sourceBlock = resolveReportBuilderBlock(sourceDocument);
    const baseConfig = sourceBlock?.config && typeof sourceBlock.config === "object" && !Array.isArray(sourceBlock.config)
        ? cloneValue(sourceBlock.config)
        : null;
    if (!sourceDocument || !sourceBlock || !baseConfig) {
        return {
            valid: false,
            code: "invalidDocument",
            message: "The saved ReportDocument does not contain a compatible reportBuilderBlock.",
        };
    }
    const builderContext = resolveReportDocumentBuilderContext(sourceDocument, baseConfig, sourceBlock?.state || {});
    const config = builderContext?.config || null;
    const source = sourceBlock?.source && typeof sourceBlock.source === "object" && !Array.isArray(sourceBlock.source)
        ? cloneValue(sourceBlock.source)
        : {};
    const compatibility = resolveReportBuilderReopenCompatibility(source, {
        containerId: normalizeString(builderIdentity?.containerId || container?.id),
        stateKey: normalizeString(builderIdentity?.stateKey || container?.stateKey || container?.id || "reportBuilder"),
        dataSourceRef: normalizeString(builderIdentity?.dataSourceRef || container?.dataSourceRef),
    });
    if (!compatibility.compatible) {
        return {
            valid: false,
            code: compatibility.code,
            message: compatibility.message,
            source,
            ...(savedViewOverlay ? { savedViewOverlay } : {}),
            ...(resolvedBaseRecord?.source ? { savedViewOverlayBaseSource: cloneValue(resolvedBaseRecord.source) } : {}),
            ...(resolvedSnapshotRecord?.source ? { savedViewOverlayPublishedSnapshotSource: cloneValue(resolvedSnapshotRecord.source) } : {}),
        };
    }
    const hasBlockingSavedViewOverlayDiagnostics = [
        ...(Array.isArray(overlaySummary?.diagnostics) ? overlaySummary.diagnostics : []),
        ...overlayReferenceDiagnostics,
        ...overlayResolvedRecordDiagnostics,
    ].some((diagnostic) => BLOCKING_SAVED_VIEW_OVERLAY_DIAGNOSTIC_CODES.has(normalizeString(diagnostic?.code)));
    const rawScopeParams = Array.isArray(sourceHydratedContext?.scopeParams)
        ? cloneValue(sourceHydratedContext.scopeParams)
        : (Array.isArray(hydratedContext?.scopeParams)
        ? cloneValue(hydratedContext.scopeParams)
        : []);
    const effectiveScopeParams = savedViewOverlay && !hasBlockingSavedViewOverlayDiagnostics
        ? applySavedViewOverlayScopeParams(getResponse, {
            scopeParams: rawScopeParams,
        })
        : rawScopeParams;
    const scopeBindingDocument = savedViewOverlay && !hasBlockingSavedViewOverlayDiagnostics
        ? {
            ...cloneValue(sourceDocument),
            scope: {
                ...(sourceDocument?.scope && typeof sourceDocument.scope === "object" && !Array.isArray(sourceDocument.scope)
                    ? cloneValue(sourceDocument.scope)
                    : {}),
                params: cloneValue(effectiveScopeParams),
            },
        }
        : sourceDocument;
    const resolvedBinding = builderContext?.binding || null;
    const effectiveConfig = config;
    const hydratedState = sanitizeReportBuilderState(
        effectiveConfig,
        applySavedViewOverlayToBuilderState(savedViewOverlay && !hasBlockingSavedViewOverlayDiagnostics ? getResponse : null, {
            document: sourceDocument,
            reportSpec: sourceReportSpec,
            state: applyReportDocumentScopeBindings(scopeBindingDocument, sourceBlock, effectiveScopeParams),
        }),
    );
    if (resolvedBinding) {
        hydratedState.binding = cloneValue(resolvedBinding);
    }
    const resolvedStaticDatasets = Array.isArray(builderContext?.staticDatasets) ? builderContext.staticDatasets : [];
    if (resolvedStaticDatasets.length > 0) {
        hydratedState.reportStaticDatasets = cloneValue(resolvedStaticDatasets);
    }
    const overlayApplicationDiagnostics = savedViewOverlay
        ? buildSavedViewOverlayApplicationDiagnostics(savedViewOverlay, hydratedState, config)
        : [];
    const templateIdentity = extractHydratedDocumentTemplateIdentity({
        document: sourceDocument,
        state: hydratedState,
    });
    const additionalBlocks = extractReportBuilderAdditionalBlocks(sourceDocument);
    if (additionalBlocks.length > 0 && (!isPlainObject(sourceDocument?.layout) || !Array.isArray(sourceDocument?.layout?.items))) {
        return {
            valid: false,
            code: "invalidDocumentLayout",
            message: "The saved ReportDocument contains authored blocks but does not define a compatible layout.",
        };
    }
    const title = normalizeString(document?.title || getResponse?.title || reportId || "Report");
    const documentVersion = Number(getResponse?.documentVersion || 0) || 0;
    const compileState = mergeHydratedCompileState(
        getResponse?.compileState,
        [
            ...(Array.isArray(overlaySummary?.diagnostics) ? overlaySummary.diagnostics : []),
            ...overlayReferenceDiagnostics,
            ...overlayResolvedRecordDiagnostics,
            ...overlayApplicationDiagnostics,
        ],
    );
    const savedSource = normalizeSavedReportPayloadSource(getResponse?.source);
    const runtimePreviewInteraction = normalizeReportRuntimeInteractionState(
        getResponse?.sourceSession?.runtimePreviewInteraction,
        { allowEmpty: false },
    );
    const sharedArtifactState = normalizeHydratedSharedArtifactState(getResponse, {
        fallbackKind: savedSource?.kind || "",
    });
    return {
        valid: true,
        reportId,
        title,
        documentVersion,
        source,
        ...(savedSource ? { savedSource } : {}),
        ...(sharedArtifactState ? sharedArtifactState : {}),
        config: effectiveConfig,
        ...(compileState ? { compileState } : {}),
        ...(runtimePreviewInteraction ? { runtimePreviewInteraction } : {}),
        ...(effectiveScopeParams.length > 0 ? { scopeParams: cloneValue(effectiveScopeParams) } : {}),
        ...(savedViewOverlay ? { savedViewOverlay } : {}),
        ...(resolvedBaseRecord?.source ? { savedViewOverlayBaseSource: cloneValue(resolvedBaseRecord.source) } : {}),
        ...(resolvedSnapshotRecord?.source ? { savedViewOverlayPublishedSnapshotSource: cloneValue(resolvedSnapshotRecord.source) } : {}),
        state: {
            ...hydratedState,
            ...(normalizeString(document?.title) ? { reportDocumentTitle: normalizeString(document.title) } : {}),
            ...(normalizeString(document?.subtitle) ? { reportDocumentSubtitle: normalizeString(document.subtitle) } : {}),
            ...(normalizeString(document?.description) ? { reportDocumentDescription: normalizeString(document.description) } : {}),
            ...(normalizeString(document?.theme?.accentTone) ? { reportDocumentThemeAccent: normalizeString(document.theme.accentTone) } : {}),
            ...(normalizeString(document?.theme?.badgePalette) ? { reportDocumentBadgePalette: normalizeString(document.theme.badgePalette) } : {}),
            ...(templateIdentity?.templateId ? { reportDocumentTemplateId: templateIdentity.templateId } : {}),
            ...(templateIdentity?.templateLabel ? { reportDocumentTemplateLabel: templateIdentity.templateLabel } : {}),
            ...(additionalBlocks.length > 0 ? { reportDocumentBlocks: additionalBlocks } : {}),
            ...(additionalBlocks.length > 0 && sourceDocument?.layout ? { reportDocumentLayout: cloneValue(sourceDocument.layout) } : {}),
        },
        document: sourceDocument,
        ...(sourceReportSpec ? { reportSpec: sourceReportSpec } : {}),
    };
}

export function normalizeReportBuilderHydratedDocumentSession(session = null) {
    if (!session || typeof session !== "object" || Array.isArray(session)) {
        return null;
    }
    const reopenedConfig = session?.reopenedConfig && typeof session.reopenedConfig === "object" && !Array.isArray(session.reopenedConfig)
        ? cloneValue(session.reopenedConfig)
        : null;
    const liveSnapshotConfig = session?.liveSnapshot?.config && typeof session.liveSnapshot.config === "object" && !Array.isArray(session.liveSnapshot.config)
        ? cloneValue(session.liveSnapshot.config)
        : null;
    const liveSnapshotState = session?.liveSnapshot?.state && typeof session.liveSnapshot.state === "object" && !Array.isArray(session.liveSnapshot.state)
        ? cloneValue(session.liveSnapshot.state)
        : null;
    if (!reopenedConfig || !liveSnapshotConfig || !liveSnapshotState) {
        return null;
    }
    const reopenedSemanticSummary = normalizeReportBuilderSemanticSummary(session?.reopenedSemanticSummary);
    const reopenedScopeParams = mergeHydratedScopeParamsWithSemanticSummary(
        session?.reopenedScopeParams,
        reopenedSemanticSummary,
    );
    const reopenedSemanticFingerprint = normalizeString(session?.reopenedSemanticFingerprint);
    const reopenedCompileState = normalizeReportBuilderHydratedCompileState(session?.reopenedCompileState);
    const savedSource = normalizeSavedReportPayloadSource(session?.savedSource);
    const sharedArtifactState = normalizeHydratedSharedArtifactState(session, {
        fallbackKind: savedSource?.kind || "",
    });
    const savedViewOverlay = session?.savedViewOverlay && typeof session.savedViewOverlay === "object" && !Array.isArray(session.savedViewOverlay)
        ? cloneValue(session.savedViewOverlay)
        : null;
    const savedViewOverlayBaseSource = normalizeSavedViewOverlayResolvedSource(session?.savedViewOverlayBaseSource);
    const savedViewOverlayPublishedSnapshotSource = normalizeSavedViewOverlayResolvedSource(session?.savedViewOverlayPublishedSnapshotSource);
    const runtimePreviewInteraction = normalizeReportRuntimeInteractionState(
        session?.runtimePreviewInteraction,
        { allowEmpty: false },
    );
    return {
        reportId: normalizeString(session?.reportId),
        title: normalizeString(session?.title || session?.reportId || "Report"),
        documentVersion: Number(session?.documentVersion || 0) || 0,
        ...(normalizeString(session?.templateId) ? { templateId: normalizeString(session.templateId) } : {}),
        ...(normalizeString(session?.templateLabel) ? { templateLabel: normalizeString(session.templateLabel) } : {}),
        source: session?.source && typeof session.source === "object" && !Array.isArray(session.source)
            ? cloneValue(session.source)
            : {},
        ...(savedSource ? { savedSource } : {}),
        ...(sharedArtifactState ? sharedArtifactState : {}),
        reopenedConfig,
        ...(reopenedSemanticSummary ? { reopenedSemanticSummary } : {}),
        ...(reopenedScopeParams.length > 0 ? { reopenedScopeParams } : {}),
        ...(reopenedSemanticFingerprint ? { reopenedSemanticFingerprint } : {}),
        ...(reopenedCompileState ? { reopenedCompileState } : {}),
        ...(runtimePreviewInteraction ? { runtimePreviewInteraction } : {}),
        ...(savedViewOverlay ? { savedViewOverlay } : {}),
        ...(savedViewOverlayBaseSource ? { savedViewOverlayBaseSource } : {}),
        ...(savedViewOverlayPublishedSnapshotSource ? { savedViewOverlayPublishedSnapshotSource } : {}),
        liveSnapshot: {
            config: liveSnapshotConfig,
            state: liveSnapshotState,
        },
    };
}

export function buildReportBuilderHydratedDocumentSession(hydratedDocument = null, {
    liveConfig = null,
    liveState = null,
    priorSession = null,
    runtimePreviewInteraction = null,
} = {}) {
    if (!hydratedDocument?.valid || !hydratedDocument?.config || !hydratedDocument?.state) {
        return null;
    }
    const normalizedPriorSession = normalizeReportBuilderHydratedDocumentSession(priorSession);
    const liveSnapshot = normalizedPriorSession?.liveSnapshot || (
        liveConfig && typeof liveConfig === "object" && !Array.isArray(liveConfig)
        && liveState && typeof liveState === "object" && !Array.isArray(liveState)
            ? {
                config: cloneValue(liveConfig),
                state: cloneValue(liveState),
            }
            : null
    );
    if (!liveSnapshot) {
        return null;
    }
    const hydratedContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec: hydratedDocument?.reportSpec || null,
        document: hydratedDocument?.document || null,
        title: hydratedDocument?.title || hydratedDocument?.reportId || "",
    });
    const reopenedSemanticSummary = normalizeReportBuilderSemanticSummary(hydratedContext?.semanticSummary);
    const reopenedScopeParams = mergeHydratedScopeParamsWithSemanticSummary(
        hydratedDocument?.scopeParams || hydratedContext?.scopeParams,
        reopenedSemanticSummary,
    );
    const reopenedSemanticFingerprint = buildHydratedDocumentSemanticFingerprint(
        hydratedDocument.config,
        hydratedDocument.state,
    );
    const reopenedCompileState = normalizeReportBuilderHydratedCompileState(hydratedDocument?.compileState);
    const templateIdentity = extractHydratedDocumentTemplateIdentity(hydratedDocument);
    const normalizedRuntimePreviewInteraction = normalizeReportRuntimeInteractionState(
        runtimePreviewInteraction,
        { allowEmpty: false },
    );
    const sharedArtifactState = normalizeHydratedSharedArtifactState(hydratedDocument, {
        fallbackKind: hydratedDocument?.savedSource?.kind || "",
    });
    return {
        reportId: normalizeString(hydratedDocument.reportId),
        title: normalizeString(hydratedDocument.title || hydratedDocument.reportId || "Report"),
        documentVersion: Number(hydratedDocument.documentVersion || 0) || 0,
        ...(templateIdentity ? templateIdentity : {}),
        source: cloneValue(hydratedDocument.source || {}),
        ...(normalizeSavedReportPayloadSource(hydratedDocument.savedSource) ? { savedSource: normalizeSavedReportPayloadSource(hydratedDocument.savedSource) } : {}),
        ...(sharedArtifactState ? sharedArtifactState : {}),
        reopenedConfig: cloneValue(hydratedDocument.config),
        ...(reopenedSemanticSummary ? { reopenedSemanticSummary } : {}),
        ...(reopenedScopeParams.length > 0 ? { reopenedScopeParams } : {}),
        ...(reopenedSemanticFingerprint ? { reopenedSemanticFingerprint } : {}),
        ...(reopenedCompileState ? { reopenedCompileState } : {}),
        ...(normalizedRuntimePreviewInteraction ? { runtimePreviewInteraction: normalizedRuntimePreviewInteraction } : {}),
        liveSnapshot,
        ...(hydratedDocument?.savedViewOverlay ? { savedViewOverlay: cloneValue(hydratedDocument.savedViewOverlay) } : {}),
        ...(normalizeSavedViewOverlayResolvedSource(hydratedDocument?.savedViewOverlayBaseSource)
            ? { savedViewOverlayBaseSource: normalizeSavedViewOverlayResolvedSource(hydratedDocument.savedViewOverlayBaseSource) }
            : {}),
        ...(normalizeSavedViewOverlayResolvedSource(hydratedDocument?.savedViewOverlayPublishedSnapshotSource)
            ? { savedViewOverlayPublishedSnapshotSource: normalizeSavedViewOverlayResolvedSource(hydratedDocument.savedViewOverlayPublishedSnapshotSource) }
            : {}),
    };
}

export function setReportBuilderHydratedDocumentSessionSharedArtifact(session = null, value = null) {
    const normalizedSession = normalizeReportBuilderHydratedDocumentSession(session);
    if (!normalizedSession) {
        return null;
    }
    const sharedArtifactState = normalizeHydratedSharedArtifactState(value, {
        fallbackKind: normalizedSession?.savedSource?.kind || "",
    });
    if (!sharedArtifactState) {
        return cloneValue(normalizedSession);
    }
    const nextSavedSource = normalizeSavedReportPayloadSource(value?.source || value);
    const nextDocumentVersion = Number(value?.documentVersion || 0) || 0;
    return {
        ...cloneValue(normalizedSession),
        ...sharedArtifactState,
        ...(nextSavedSource ? { savedSource: nextSavedSource } : {}),
        ...(nextDocumentVersion > 0 ? { documentVersion: nextDocumentVersion } : {}),
    };
}

export function setReportBuilderHydratedDocumentSessionRuntimePreviewInteraction(session = null, runtimePreviewInteraction = null) {
    const normalizedSession = normalizeReportBuilderHydratedDocumentSession(session);
    if (!normalizedSession) {
        return null;
    }
    const normalizedRuntimePreviewInteraction = normalizeReportRuntimeInteractionState(
        runtimePreviewInteraction,
        { allowEmpty: false },
    );
    if (!normalizedRuntimePreviewInteraction) {
        const nextSession = cloneValue(normalizedSession);
        delete nextSession.runtimePreviewInteraction;
        return nextSession;
    }
    return {
        ...cloneValue(normalizedSession),
        runtimePreviewInteraction: normalizedRuntimePreviewInteraction,
    };
}

export function setReportBuilderHydratedDocumentSessionReopenedDataset(session = null, datasetRef = "", patch = null) {
    const normalizedSession = normalizeReportBuilderHydratedDocumentSession(session);
    const normalizedDatasetRef = normalizeString(datasetRef);
    const normalizedPatch = patch && typeof patch === "object" && !Array.isArray(patch)
        ? cloneValue(patch)
        : null;
    if (!normalizedSession || !normalizedDatasetRef || !normalizedPatch) {
        return normalizedSession ? cloneValue(normalizedSession) : null;
    }
    const reopenedConfig = cloneValue(normalizedSession.reopenedConfig || {});
    const currentDatasets = normalizeReportBuilderPublishedDataSources(reopenedConfig);
    const nextDatasets = currentDatasets.map((entry) => (
        normalizeString(entry?.id) === normalizedDatasetRef || normalizeString(entry?.dataSourceRef) === normalizedDatasetRef
            ? {
                ...cloneValue(entry),
                ...normalizedPatch,
            }
            : cloneValue(entry)
    ));
    const didUpdate = nextDatasets.some((entry, index) => !equal(entry, currentDatasets[index]));
    if (!didUpdate) {
        return cloneValue(normalizedSession);
    }
    reopenedConfig.datasets = nextDatasets;
    delete reopenedConfig.dataSources;
    return {
        ...cloneValue(normalizedSession),
        reopenedConfig,
        liveSnapshot: {
            ...(normalizedSession.liveSnapshot ? cloneValue(normalizedSession.liveSnapshot) : {}),
            config: cloneValue(reopenedConfig),
            state: cloneValue(normalizedSession?.liveSnapshot?.state || {}),
        },
    };
}

export function applyReportBuilderHydratedDocumentSessionState(state = {}, session = null) {
    const normalizedSession = normalizeReportBuilderHydratedDocumentSession(session);
    if (!normalizedSession) {
        return stripReportBuilderHydratedDocumentSessionState(state);
    }
    return {
        ...stripReportBuilderHydratedDocumentSessionState(state),
        [REPORT_DOCUMENT_REOPEN_SESSION_KEY]: normalizedSession,
    };
}

export function stripReportBuilderHydratedDocumentSessionState(state = {}) {
    const next = cloneValue(state && typeof state === "object" && !Array.isArray(state) ? state : {});
    delete next[REPORT_DOCUMENT_REOPEN_SESSION_KEY];
    return next;
}

export function resolveReportBuilderHydratedDocumentSessionFromState(state = {}) {
    return normalizeReportBuilderHydratedDocumentSession(state?.[REPORT_DOCUMENT_REOPEN_SESSION_KEY]);
}

export function buildReportBuilderHydratedSessionRoundTrip({
    config = {},
    state = {},
    session = null,
} = {}) {
    const nextState = applyReportBuilderHydratedDocumentSessionState(state, session);
    return mergeReportBuilderState(config, sanitizeReportBuilderState(config, nextState));
}

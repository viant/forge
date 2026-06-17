import { mergeReportBuilderState, sanitizeReportBuilderState } from "./reportBuilderUtils.js";
import { resolveReportBuilderReopenCompatibility } from "./reportBuilderHydratedReportDocumentDiagnostic.js";
import {
    buildReportBuilderSemanticValidationRequest,
    normalizeReportBuilderSemanticSummary,
} from "./reportBuilderSemantic.js";
import { normalizeReportRuntimeInteractionState } from "./reportRuntimeInteractionStateModel.js";
import { normalizeReportBuilderDocumentBlocks } from "../../reporting/reportDocumentModel.js";

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

const REPORT_DOCUMENT_REOPEN_SESSION_KEY = "reportDocumentReopenSession";

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
    const templateId = normalizeString(
        hydratedDocument?.state?.reportDocumentTemplateId
        || hydratedDocument?.document?.blocks?.find?.((block) => normalizeString(block?.kind) === "reportBuilderBlock")?.state?.reportDocumentTemplateId,
    );
    const templateLabel = normalizeString(
        hydratedDocument?.state?.reportDocumentTemplateLabel
        || hydratedDocument?.document?.blocks?.find?.((block) => normalizeString(block?.kind) === "reportBuilderBlock")?.state?.reportDocumentTemplateLabel,
    );
    if (!templateId && !templateLabel) {
        return null;
    }
    return {
        ...(templateId ? { templateId } : {}),
        ...(templateLabel ? { templateLabel } : {}),
    };
}

function extractReportBuilderBlock(document = null) {
    const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
    return blocks.find((block) => normalizeString(block?.kind) === "reportBuilderBlock") || null;
}

function extractReportBuilderAdditionalBlocks(document = null) {
    const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
    return normalizeReportBuilderDocumentBlocks(
        blocks.filter((block) => normalizeString(block?.kind) !== "reportBuilderBlock"),
    );
}

function applyReportDocumentScopeBindings(document = {}, block = {}) {
    const params = new Map(
        (Array.isArray(document?.scope?.params) ? document.scope.params : [])
            .map((entry) => [normalizeString(entry?.id), entry])
            .filter(([id]) => !!id),
    );
    const nextState = stripExplorationSession(block?.state || {});
    const nextStaticFilters = {
        ...(nextState.staticFilters || {}),
    };
    (Array.isArray(block?.scopeBindings) ? block.scopeBindings : []).forEach((binding) => {
        const paramId = normalizeString(binding?.paramId);
        const target = normalizeString(binding?.target);
        if (!paramId || !target.startsWith("staticFilters.")) {
            return;
        }
        const param = params.get(paramId);
        if (!param || !Object.prototype.hasOwnProperty.call(param, "value")) {
            return;
        }
        const filterId = normalizeString(target.slice("staticFilters.".length));
        if (!filterId) {
            return;
        }
        nextStaticFilters[filterId] = cloneValue(param.value);
    });
    nextState.staticFilters = nextStaticFilters;
    return nextState;
}

function resolveHydratedSemanticSummary(document = null, reportSpec = null) {
    return normalizeReportBuilderSemanticSummary(reportSpec?.semanticSummary)
        || normalizeReportBuilderSemanticSummary(document?.semanticSummary);
}

export function buildHydratedReportBuilderDocument(getResponse = null, {
    container = {},
    builderIdentity = {},
} = {}) {
    if (!getResponse || typeof getResponse !== "object" || Array.isArray(getResponse)) {
        return {
            valid: false,
            code: "missingResponse",
            message: "A getReportDocument response is required to reopen the builder.",
        };
    }
    if (normalizeString(getResponse?.kind) !== "getReportDocumentResponse") {
        return {
            valid: false,
            code: "unsupportedResponse",
            message: "Only getReportDocument responses can be reopened into the builder.",
        };
    }
    if (normalizePositiveInteger(getResponse?.version) < 1) {
        return {
            valid: false,
            code: "unsupportedResponseVersion",
            message: "The saved getReportDocument response version is not supported for reopen.",
        };
    }
    const document = getResponse?.document && typeof getResponse.document === "object" && !Array.isArray(getResponse.document)
        ? cloneValue(getResponse.document)
        : null;
    const reportSpec = getResponse?.reportSpec && typeof getResponse.reportSpec === "object" && !Array.isArray(getResponse.reportSpec)
        ? cloneValue(getResponse.reportSpec)
        : null;
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
    const block = extractReportBuilderBlock(document);
    const config = block?.config && typeof block.config === "object" && !Array.isArray(block.config)
        ? cloneValue(block.config)
        : null;
    if (!document || !block || !config) {
        return {
            valid: false,
            code: "invalidDocument",
            message: "The saved ReportDocument does not contain a compatible reportBuilderBlock.",
        };
    }
    const source = block?.source && typeof block.source === "object" && !Array.isArray(block.source)
        ? cloneValue(block.source)
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
        };
    }
    const hydratedState = sanitizeReportBuilderState(
        config,
        applyReportDocumentScopeBindings(document, block),
    );
    const additionalBlocks = extractReportBuilderAdditionalBlocks(document);
    if (additionalBlocks.length > 0 && (!isPlainObject(document?.layout) || !Array.isArray(document?.layout?.items))) {
        return {
            valid: false,
            code: "invalidDocumentLayout",
            message: "The saved ReportDocument contains authored blocks but does not define a compatible layout.",
        };
    }
    const reportId = normalizeString(getResponse?.reportRef?.reportId || document?.id || block?.source?.stateKey);
    const title = normalizeString(document?.title || getResponse?.title || reportId || "Report");
    const documentVersion = Number(getResponse?.documentVersion || 0) || 0;
    const compileState = normalizeReportBuilderHydratedCompileState(getResponse?.compileState);
    const savedSource = normalizeSavedReportPayloadSource(getResponse?.source);
    return {
        valid: true,
        reportId,
        title,
        documentVersion,
        source,
        ...(savedSource ? { savedSource } : {}),
        config,
        ...(compileState ? { compileState } : {}),
        state: {
            ...hydratedState,
            ...(normalizeString(document?.title) ? { reportDocumentTitle: normalizeString(document.title) } : {}),
            ...(normalizeString(document?.subtitle) ? { reportDocumentSubtitle: normalizeString(document.subtitle) } : {}),
            ...(normalizeString(document?.description) ? { reportDocumentDescription: normalizeString(document.description) } : {}),
            ...(additionalBlocks.length > 0 ? { reportDocumentBlocks: additionalBlocks } : {}),
            ...(additionalBlocks.length > 0 && document?.layout ? { reportDocumentLayout: cloneValue(document.layout) } : {}),
        },
        document,
        ...(reportSpec ? { reportSpec } : {}),
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
    const reopenedSemanticFingerprint = normalizeString(session?.reopenedSemanticFingerprint);
    const reopenedCompileState = normalizeReportBuilderHydratedCompileState(session?.reopenedCompileState);
    const savedSource = normalizeSavedReportPayloadSource(session?.savedSource);
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
        reopenedConfig,
        ...(reopenedSemanticSummary ? { reopenedSemanticSummary } : {}),
        ...(reopenedSemanticFingerprint ? { reopenedSemanticFingerprint } : {}),
        ...(reopenedCompileState ? { reopenedCompileState } : {}),
        ...(runtimePreviewInteraction ? { runtimePreviewInteraction } : {}),
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
    const reopenedSemanticSummary = resolveHydratedSemanticSummary(
        hydratedDocument?.document,
        hydratedDocument?.reportSpec,
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
    return {
        reportId: normalizeString(hydratedDocument.reportId),
        title: normalizeString(hydratedDocument.title || hydratedDocument.reportId || "Report"),
        documentVersion: Number(hydratedDocument.documentVersion || 0) || 0,
        ...(templateIdentity ? templateIdentity : {}),
        source: cloneValue(hydratedDocument.source || {}),
        ...(normalizeSavedReportPayloadSource(hydratedDocument.savedSource) ? { savedSource: normalizeSavedReportPayloadSource(hydratedDocument.savedSource) } : {}),
        reopenedConfig: cloneValue(hydratedDocument.config),
        ...(reopenedSemanticSummary ? { reopenedSemanticSummary } : {}),
        ...(reopenedSemanticFingerprint ? { reopenedSemanticFingerprint } : {}),
        ...(reopenedCompileState ? { reopenedCompileState } : {}),
        ...(normalizedRuntimePreviewInteraction ? { runtimePreviewInteraction: normalizedRuntimePreviewInteraction } : {}),
        liveSnapshot,
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

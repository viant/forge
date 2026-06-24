import { buildUpdateReportDocumentPayload } from "../../reporting/reportDocumentStore.js";
import {
    buildReportBuilderDocumentCompileDiagnostics,
    buildReportBuilderScopeSummaryFromParams,
} from "./reportBuilderDocumentBlocks.js";
import { buildReportBuilderSavedReportPayloadFromBuilderState } from "./reportBuilderSavedReportPayload.js";
import { buildReportBuilderSemanticBindingViewState } from "./reportBuilderSemanticBindingViewState.js";
import { resolveNormalizedReportSpecDocumentContext } from "./reportBuilderSavedRecordMetadataContext.js";
import {
    normalizeReportBuilderSavedReportRecords,
    resolveReportBuilderSavedReportRecordBySource,
} from "./reportBuilderSavedReportRecords.js";
import { buildSavedViewOverlaySummary } from "../../reporting/views/savedViewOverlayModel.js";
import { resolveReportBuilderSavedViewOverlayReopenSourceResolution } from "./reportBuilderReopenSourceResolution.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function buildNormalizedSource(savedReportPayload = null) {
    const kind = normalizeString(savedReportPayload?.kind) || "reportBuilder.savedReportPayload";
    const source = {
        kind,
    };
    const payloadId = normalizeString(savedReportPayload?.payloadId);
    const sourceArtifactId = normalizeString(savedReportPayload?.sourceArtifactId);
    const sourceSession = savedReportPayload?.sourceSession && typeof savedReportPayload.sourceSession === "object" && !Array.isArray(savedReportPayload.sourceSession)
        ? cloneValue(savedReportPayload.sourceSession)
        : null;
    if (payloadId) {
        source.payloadId = payloadId;
    }
    if (sourceArtifactId) {
        source.sourceArtifactId = sourceArtifactId;
    }
    if (sourceSession) {
        source.sourceSession = sourceSession;
    }
    return source;
}

function resolveSavedReportPayloadCompileDiagnostics(savedReportPayload = null, document = null) {
    const structuralDiagnostics = buildReportBuilderDocumentCompileDiagnostics({
        document,
    });
    const storedDiagnostics = Array.isArray(savedReportPayload?.compileState?.diagnostics)
        ? cloneValue(savedReportPayload.compileState.diagnostics)
        : [];
    const diagnostics = [...structuralDiagnostics, ...storedDiagnostics];
    const seen = new Set();
    return diagnostics.filter((diagnostic) => {
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
    });
}

function sanitizeFilenameSegment(value = "") {
    return normalizeString(value).replace(/[\\/:*?"<>|]+/g, "-");
}

function normalizePositiveInteger(value = 0) {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : 0;
}

function resolveUniqueSavedReportRecordByReportId(records = [], reportId = "") {
    const normalizedReportId = normalizeString(reportId);
    if (!normalizedReportId) {
        return null;
    }
    const matches = normalizeReportBuilderSavedReportRecords(records)
        .filter((record) => normalizeString(record?.reportId) === normalizedReportId);
    return matches.length === 1 ? matches[0] : null;
}

function normalizeSourceIdentity(value = null) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const source = value?.source && typeof value.source === "object" && !Array.isArray(value.source)
        ? value.source
        : value;
    const kind = normalizeString(source?.kind || value?.kind);
    const payloadId = normalizeString(source?.payloadId || value?.payloadId);
    const sourceArtifactId = normalizeString(source?.sourceArtifactId || value?.sourceArtifactId || value?.id);
    const reportId = normalizeString(source?.reportId || value?.reportRef?.reportId || value?.reportId);
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

function matchesSourceIdentity(left = null, right = null) {
    if (!left || !right) {
        return false;
    }
    return normalizeString(left?.kind) === normalizeString(right?.kind)
        && normalizeString(left?.reportId) === normalizeString(right?.reportId)
        && normalizeString(left?.sourceArtifactId) === normalizeString(right?.sourceArtifactId)
        && (!normalizeString(left?.payloadId) || !normalizeString(right?.payloadId) || normalizeString(left?.payloadId) === normalizeString(right?.payloadId));
}

export function resolveReportBuilderUpdateReportDocumentExpectedVersion(value = "") {
    const normalized = normalizeString(value);
    if (!/^[1-9]\d*$/.test(normalized)) {
        return 0;
    }
    const parsed = Number(normalized);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function buildReportBuilderUpdateReportDocumentExpectedVersionState(draft = "") {
    const normalizedDraft = normalizeString(draft);
    const expectedVersion = resolveReportBuilderUpdateReportDocumentExpectedVersion(normalizedDraft);
    return {
        draft: normalizedDraft,
        expectedVersion,
        valid: expectedVersion > 0,
        helperText: expectedVersion > 0
            ? `Using expected version ${expectedVersion}.`
            : normalizedDraft
                ? "Expected version must be a positive integer."
                : "Enter the saved document version to prepare an update payload.",
    };
}

export function resolveReportBuilderUpdateReportDocumentPayloadSeed(savedReportPayload = null, {
    hydratedReportDocumentSession = null,
    getReportDocumentResponse = null,
} = {}) {
    if (hydratedReportDocumentSession && getReportDocumentResponse && typeof getReportDocumentResponse === "object" && !Array.isArray(getReportDocumentResponse)) {
        return cloneValue(getReportDocumentResponse);
    }
    const reportId = normalizeString(hydratedReportDocumentSession?.reportId);
    const title = normalizeString(hydratedReportDocumentSession?.title || reportId || "Report") || "Report";
    const documentVersion = normalizePositiveInteger(hydratedReportDocumentSession?.documentVersion);
    const savedSource = hydratedReportDocumentSession?.savedSource && typeof hydratedReportDocumentSession.savedSource === "object" && !Array.isArray(hydratedReportDocumentSession.savedSource)
        ? cloneValue(hydratedReportDocumentSession.savedSource)
        : (hydratedReportDocumentSession?.source && typeof hydratedReportDocumentSession.source === "object" && !Array.isArray(hydratedReportDocumentSession.source)
            ? cloneValue(hydratedReportDocumentSession.source)
            : null);
    if (reportId || savedSource) {
        return {
            version: 1,
            kind: "getReportDocumentResponse",
            ...(reportId ? { reportRef: { reportId } } : {}),
            ...(documentVersion > 0 ? { documentVersion } : {}),
            document: {
                version: 1,
                kind: "reportDocument",
                ...(reportId ? { id: reportId } : {}),
                title,
            },
            ...(savedSource ? { source: savedSource } : {}),
        };
    }
    return savedReportPayload;
}

export function buildReportBuilderUpdateReportDocumentPayload(savedReportPayload = null, {
    expectedVersion = 0,
    updatedAt = Date.now(),
} = {}) {
    if (!savedReportPayload || typeof savedReportPayload !== "object" || Array.isArray(savedReportPayload)) {
        return null;
    }
    const reportSpec = savedReportPayload?.reportSpec && typeof savedReportPayload.reportSpec === "object" && !Array.isArray(savedReportPayload.reportSpec)
        ? cloneValue(savedReportPayload.reportSpec)
        : null;
    const payloadContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec,
        document: savedReportPayload?.reportDocument || null,
        title: savedReportPayload?.title || "",
    });
    const document = payloadContext?.document ? cloneValue(payloadContext.document) : null;
    const versionState = buildReportBuilderUpdateReportDocumentExpectedVersionState(expectedVersion);
    if (!document || !reportSpec || !versionState.valid) {
        return null;
    }
    return buildUpdateReportDocumentPayload({
        document,
        reportSpec,
        compileDiagnostics: resolveSavedReportPayloadCompileDiagnostics(savedReportPayload, document),
        expectedVersion: versionState.expectedVersion,
        updatedAt,
        source: buildNormalizedSource(savedReportPayload),
    });
}

export function mergeReportBuilderUpdateReportDocumentPayloadSharedArtifact(payload = null, value = null) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || normalizeString(payload?.kind) !== "updateReportDocumentPayload") {
        return payload;
    }
    const nextSource = normalizeSourceIdentity(value?.source || value);
    if (!nextSource) {
        return cloneValue(payload);
    }
    const payloadSource = normalizeSourceIdentity(payload?.source || null);
    const sourceMatch = payloadSource && matchesSourceIdentity(payloadSource, nextSource);
    const reportMatch = !payloadSource
        && normalizeString(payload?.reportRef?.reportId)
        && normalizeString(payload?.reportRef?.reportId) === normalizeString(nextSource?.reportId);
    if (!sourceMatch && !reportMatch) {
        return cloneValue(payload);
    }
    const nextExpectedVersion = normalizePositiveInteger(value?.documentVersion);
    return {
        ...cloneValue(payload),
        ...(nextExpectedVersion > 0 ? { expectedVersion: nextExpectedVersion } : {}),
        source: cloneValue(value?.source || nextSource),
    };
}

export function buildReportBuilderUpdateReportDocumentPayloadFromBuilderState(savedReportPayload = null, {
    container = {},
    config = {},
    state = {},
    savedAt = Date.now(),
    semanticSummary = null,
    semanticModel = null,
    semanticRuntimeDiagnostics = [],
    expectedVersion = 0,
    updatedAt = Date.now(),
} = {}) {
    const rebuiltSavedReportPayload = buildReportBuilderSavedReportPayloadFromBuilderState(savedReportPayload, {
        container,
        config,
        state,
        savedAt,
        semanticSummary,
        semanticModel,
        semanticRuntimeDiagnostics,
    });
    if (!rebuiltSavedReportPayload) {
        return null;
    }
    return buildReportBuilderUpdateReportDocumentPayload(rebuiltSavedReportPayload, {
        expectedVersion,
        updatedAt,
    });
}

export function buildReportBuilderUpdateReportDocumentPayloadSummary(payload = null, {
    localSavedPayloads = [],
} = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return null;
    }
    const payloadContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec: payload?.reportSpec || null,
        document: payload?.document || null,
        title: payload?.title || "",
    });
    const semanticBindingViewState = buildReportBuilderSemanticBindingViewState({
        semanticSummary: payloadContext?.semanticSummary || null,
        binding: payloadContext?.binding || null,
    });
    const scopeSummary = buildReportBuilderScopeSummaryFromParams(payloadContext?.scopeParams);
    const normalizedTitle = normalizeString(payload?.title)
        || normalizeString(payloadContext?.title)
        || normalizeString(payload?.document?.title)
        || normalizeString(payload?.reportRef?.reportId)
        || "Report";
    const subtitle = normalizeString(payloadContext?.document?.subtitle || payload?.document?.subtitle);
    const description = normalizeString(payloadContext?.document?.description || payload?.document?.description);
    const companionRecord = resolveReportBuilderSavedReportRecordBySource(localSavedPayloads, payload?.source || payload)
        || resolveUniqueSavedReportRecordByReportId(
            localSavedPayloads,
            payload?.reportRef?.reportId || payload?.document?.id || "",
        );
    const savedViewOverlaySummary = companionRecord?.savedViewOverlay
        ? buildSavedViewOverlaySummary(
            { kind: "reportBuilder.savedView", savedViewOverlay: companionRecord.savedViewOverlay },
            {
                document: payloadContext?.document || null,
                reportSpec: payloadContext?.reportSpec || null,
            },
        )
        : null;
    const reopenSourceResolutionState = companionRecord?.savedViewOverlay
        ? resolveReportBuilderSavedViewOverlayReopenSourceResolution(
            companionRecord.savedViewOverlay,
            localSavedPayloads,
        )?.state
        : null;
    return {
        title: normalizedTitle,
        ...(subtitle ? { subtitle } : {}),
        ...(description ? { description } : {}),
        kind: normalizeString(payload?.kind),
        reportId: normalizeString(payload?.reportRef?.reportId),
        expectedVersion: Number(payload?.expectedVersion || 0) || 0,
        payloadId: normalizeString(payload?.source?.payloadId),
        sourceArtifactId: normalizeString(payload?.source?.sourceArtifactId),
        compileStatus: normalizeString(payload?.compileState?.status),
        blockCount: Number(payload?.compileState?.blockCount || 0) || 0,
        datasetCount: Number(payload?.compileState?.datasetCount || 0) || 0,
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
        ...(savedViewOverlaySummary ? {
            savedViewOverlayTitle: savedViewOverlaySummary.title,
            savedViewOverlayText: savedViewOverlaySummary.text,
            savedViewOverlayChips: savedViewOverlaySummary.chips,
            ...(Array.isArray(savedViewOverlaySummary.diagnostics) && savedViewOverlaySummary.diagnostics.length > 0
                ? { savedViewOverlayDiagnostics: savedViewOverlaySummary.diagnostics }
                : {}),
        } : {}),
        ...(reopenSourceResolutionState ? reopenSourceResolutionState : {}),
    };
}

export function serializeReportBuilderUpdateReportDocumentPayload(payload = null, {
    pretty = true,
} = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return "";
    }
    return pretty === false
        ? JSON.stringify(payload)
        : JSON.stringify(payload, null, 2);
}

export function buildReportBuilderUpdateReportDocumentPayloadInspectorState(payload = null, {
    localSavedPayloads = [],
} = {}) {
    const summary = buildReportBuilderUpdateReportDocumentPayloadSummary(payload, {
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
        content: serializeReportBuilderUpdateReportDocumentPayload(payload),
    };
}

export function buildReportBuilderUpdateReportDocumentPayloadDownload(payload = null) {
    const summary = buildReportBuilderUpdateReportDocumentPayloadSummary(payload);
    if (!summary) {
        return null;
    }
    const content = serializeReportBuilderUpdateReportDocumentPayload(payload);
    if (!content) {
        return null;
    }
    const normalizedReportId = sanitizeFilenameSegment(summary.title || summary.reportId || "report-document") || "report-document";
    return {
        filename: `${normalizedReportId}-update-report-document-v${summary.expectedVersion || 0}.json`,
        mimeType: "application/json;charset=utf-8",
        payload: content,
    };
}

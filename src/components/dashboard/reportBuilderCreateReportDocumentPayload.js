import { buildCreateReportDocumentPayload } from "../../reporting/reportDocumentStore.js";
import { buildReportBuilderDocumentCompileDiagnostics } from "./reportBuilderDocumentBlocks.js";
import { buildReportBuilderSavedReportPayloadFromBuilderState } from "./reportBuilderSavedReportPayload.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function buildNormalizedSource(savedReportPayload = null) {
    const source = {
        kind: normalizeString(savedReportPayload?.kind) || "reportBuilder.savedReportPayload",
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

export function resolveReportBuilderCreateReportDocumentPayloadSeed(savedReportPayload = null, {
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

export function buildReportBuilderCreateReportDocumentPayload(savedReportPayload = null, {
    createdAt = Date.now(),
} = {}) {
    if (!savedReportPayload || typeof savedReportPayload !== "object" || Array.isArray(savedReportPayload)) {
        return null;
    }
    const document = savedReportPayload?.reportDocument && typeof savedReportPayload.reportDocument === "object" && !Array.isArray(savedReportPayload.reportDocument)
        ? cloneValue(savedReportPayload.reportDocument)
        : null;
    const reportSpec = savedReportPayload?.reportSpec && typeof savedReportPayload.reportSpec === "object" && !Array.isArray(savedReportPayload.reportSpec)
        ? cloneValue(savedReportPayload.reportSpec)
        : null;
    if (!document || !reportSpec) {
        return null;
    }
    return buildCreateReportDocumentPayload({
        document,
        reportSpec,
        compileDiagnostics: resolveSavedReportPayloadCompileDiagnostics(savedReportPayload, document),
        createdAt,
        source: buildNormalizedSource(savedReportPayload),
    });
}

export function buildReportBuilderCreateReportDocumentPayloadFromBuilderState(savedReportPayload = null, {
    container = {},
    config = {},
    state = {},
    savedAt = Date.now(),
    semanticSummary = null,
    semanticModel = null,
    semanticRuntimeDiagnostics = [],
    createdAt = Date.now(),
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
    return buildReportBuilderCreateReportDocumentPayload(rebuiltSavedReportPayload, {
        createdAt,
    });
}

export function buildReportBuilderCreateReportDocumentPayloadSummary(payload = null) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return null;
    }
    const normalizedTitle = normalizeString(payload?.title)
        || normalizeString(payload?.document?.title)
        || normalizeString(payload?.reportRef?.reportId)
        || "Report";
    const subtitle = normalizeString(payload?.document?.subtitle);
    const description = normalizeString(payload?.document?.description);
    return {
        title: normalizedTitle,
        ...(subtitle ? { subtitle } : {}),
        ...(description ? { description } : {}),
        kind: normalizeString(payload?.kind),
        reportId: normalizeString(payload?.reportRef?.reportId),
        payloadId: normalizeString(payload?.source?.payloadId),
        sourceArtifactId: normalizeString(payload?.source?.sourceArtifactId),
        compileStatus: normalizeString(payload?.compileState?.status),
        blockCount: Number(payload?.compileState?.blockCount || 0) || 0,
        datasetCount: Number(payload?.compileState?.datasetCount || 0) || 0,
    };
}

export function serializeReportBuilderCreateReportDocumentPayload(payload = null, {
    pretty = true,
} = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return "";
    }
    return pretty === false
        ? JSON.stringify(payload)
        : JSON.stringify(payload, null, 2);
}

export function buildReportBuilderCreateReportDocumentPayloadInspectorState(payload = null) {
    const summary = buildReportBuilderCreateReportDocumentPayloadSummary(payload);
    if (!summary) {
        return null;
    }
    return {
        ...summary,
        ...(summary.subtitle ? { headerSubtitle: summary.subtitle } : {}),
        ...(summary.description ? { headerDescription: summary.description } : {}),
        content: serializeReportBuilderCreateReportDocumentPayload(payload),
    };
}

export function buildReportBuilderCreateReportDocumentPayloadDownload(payload = null) {
    const summary = buildReportBuilderCreateReportDocumentPayloadSummary(payload);
    if (!summary) {
        return null;
    }
    const content = serializeReportBuilderCreateReportDocumentPayload(payload);
    if (!content) {
        return null;
    }
    const normalizedReportId = sanitizeFilenameSegment(summary.title || summary.reportId || "report-document") || "report-document";
    return {
        filename: `${normalizedReportId}-create-report-document.json`,
        mimeType: "application/json;charset=utf-8",
        payload: content,
    };
}

import { buildUpdateReportDocumentPayload } from "../../reporting/reportDocumentStore.js";
import { buildReportBuilderDocumentCompileDiagnostics } from "./reportBuilderDocumentBlocks.js";
import { buildReportBuilderSavedReportPayloadFromBuilderState } from "./reportBuilderSavedReportPayload.js";

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

export function buildReportBuilderUpdateReportDocumentPayload(savedReportPayload = null, {
    expectedVersion = 0,
    updatedAt = Date.now(),
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

export function buildReportBuilderUpdateReportDocumentPayloadSummary(payload = null) {
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
        expectedVersion: Number(payload?.expectedVersion || 0) || 0,
        payloadId: normalizeString(payload?.source?.payloadId),
        sourceArtifactId: normalizeString(payload?.source?.sourceArtifactId),
        compileStatus: normalizeString(payload?.compileState?.status),
        blockCount: Number(payload?.compileState?.blockCount || 0) || 0,
        datasetCount: Number(payload?.compileState?.datasetCount || 0) || 0,
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

export function buildReportBuilderUpdateReportDocumentPayloadInspectorState(payload = null) {
    const summary = buildReportBuilderUpdateReportDocumentPayloadSummary(payload);
    if (!summary) {
        return null;
    }
    return {
        ...summary,
        ...(summary.subtitle ? { headerSubtitle: summary.subtitle } : {}),
        ...(summary.description ? { headerDescription: summary.description } : {}),
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

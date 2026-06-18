import {
    buildReportDocumentRef,
    buildGetReportDocumentResponse,
    buildListReportDocumentsResponse,
} from "../../reporting/reportDocumentStore.js";
import { buildReportBuilderSavedReportPayloadFromBuilderState } from "./reportBuilderSavedReportPayload.js";
import {
    normalizeReportBuilderSavedReportRecord,
    normalizeReportBuilderSavedReportRecords,
    resolveReportBuilderSavedReportRecordByReportId,
} from "./reportBuilderSavedReportRecords.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function sanitizeFilenameSegment(value = "") {
    return normalizeString(value).replace(/[\\/:*?"<>|]+/g, "-");
}

function normalizePositiveInteger(value = 0) {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : 0;
}

export function resolveReportBuilderReportDocumentResponseSeed(savedReportPayload = null, {
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

function extractReportDocumentTemplateIdentity(document = null) {
    const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
    const reportBuilderBlock = blocks.find((block) => normalizeString(block?.kind) === "reportBuilderBlock") || null;
    const templateId = normalizeString(reportBuilderBlock?.state?.reportDocumentTemplateId);
    const templateLabel = normalizeString(reportBuilderBlock?.state?.reportDocumentTemplateLabel);
    if (!templateId && !templateLabel) {
        return null;
    }
    return {
        ...(templateId ? { templateId } : {}),
        ...(templateLabel ? { templateLabel } : {}),
    };
}

function hasReportSpecSemanticSummary(reportSpec = null) {
    return !!reportSpec
        && typeof reportSpec === "object"
        && !Array.isArray(reportSpec)
        && !!reportSpec.semanticSummary
        && typeof reportSpec.semanticSummary === "object"
        && !Array.isArray(reportSpec.semanticSummary);
}

function buildListEntryFromSavedReportPayloadRecord(record = null) {
    if (!record || record.documentVersion < 1) {
        return null;
    }
    const subtitle = normalizeString(record?.document?.subtitle);
    const description = normalizeString(record?.document?.description);
    return {
        reportRef: {
            reportId: record.reportId,
        },
        documentVersion: record.documentVersion,
        title: record.title,
        ...(subtitle ? { subtitle } : {}),
        ...(description ? { description } : {}),
        savedAt: record.savedAt,
        ...(record.source ? { source: record.source } : {}),
        ...(record.compileState ? { compileState: record.compileState } : {}),
    };
}

export function resolveReportBuilderDocumentVersion(value = "") {
    const normalized = normalizeString(value);
    if (!/^[1-9]\d*$/.test(normalized)) {
        return 0;
    }
    const parsed = Number(normalized);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function buildReportBuilderDocumentVersionState(draft = "") {
    const normalizedDraft = normalizeString(draft);
    const documentVersion = resolveReportBuilderDocumentVersion(normalizedDraft);
    return {
        draft: normalizedDraft,
        documentVersion,
        valid: documentVersion > 0,
        helperText: documentVersion > 0
            ? `Using document version ${documentVersion}.`
            : normalizedDraft
                ? "Document version must be a positive integer."
                : "Enter a document version to prepare the read response.",
    };
}

export function buildReportBuilderGetReportDocumentResponse(savedReportPayload = null, {
    documentVersion = 0,
    savedAt = Date.now(),
} = {}) {
    const base = normalizeReportBuilderSavedReportRecord(savedReportPayload, {
        documentVersion,
        savedAt,
    });
    const normalizedVersion = resolveReportBuilderDocumentVersion(documentVersion);
    if (!base || normalizedVersion < 1) {
        return null;
    }
    const response = buildGetReportDocumentResponse({
        reportRef: { reportId: base.reportId },
        version: normalizedVersion,
        savedAt,
        document: base.document,
        ...(base.compileState ? { compileState: base.compileState } : {}),
        source: base.source,
    });
    if (!response) {
        return null;
    }
    return hasReportSpecSemanticSummary(base.reportSpec)
        ? {
            ...response,
            reportSpec: cloneValue(base.reportSpec),
        }
        : response;
}

export function buildReportBuilderGetReportDocumentResponseFromBuilderState(savedReportPayload = null, {
    container = {},
    config = {},
    state = {},
    savedAt = Date.now(),
    semanticSummary = null,
    semanticModel = null,
    semanticRuntimeDiagnostics = [],
    documentVersion = 0,
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
    return buildReportBuilderGetReportDocumentResponse(rebuiltSavedReportPayload, {
        documentVersion,
        savedAt,
    });
}

export function buildReportBuilderSelectedGetReportDocumentResponse(listResponse = null, savedReportPayload = null, {
    request = null,
    savedAt = Date.now(),
} = {}) {
    const targetReportId = normalizeString(request?.reportRef?.reportId);
    if (!targetReportId) {
        return null;
    }
    const base = resolveReportBuilderSavedReportRecordByReportId(savedReportPayload, targetReportId);
    if (!base) {
        return null;
    }
    const entries = Array.isArray(listResponse?.entries) ? listResponse.entries : [];
    const matchingEntries = entries.filter((candidate) => normalizeString(candidate?.reportRef?.reportId) === targetReportId);
    if (matchingEntries.length !== 1) {
        return null;
    }
    const entry = matchingEntries[0];
    if (normalizeString(entry?.source?.kind) !== normalizeString(base?.source?.kind)
        || normalizeString(entry?.source?.payloadId) !== normalizeString(base?.source?.payloadId)
        || normalizeString(entry?.source?.sourceArtifactId) !== normalizeString(base?.source?.sourceArtifactId)) {
        return null;
    }
    const normalizedVersion = resolveReportBuilderDocumentVersion(entry?.documentVersion);
    if (normalizedVersion < 1) {
        return null;
    }
    const response = buildGetReportDocumentResponse({
        reportRef: { reportId: base.reportId },
        version: normalizedVersion,
        savedAt: entry?.savedAt ?? savedAt,
        document: base.document,
        ...(base.compileState ? { compileState: base.compileState } : {}),
        source: base.source,
    });
    if (!response) {
        return null;
    }
    return hasReportSpecSemanticSummary(base.reportSpec)
        ? {
            ...response,
            reportSpec: cloneValue(base.reportSpec),
        }
        : response;
}

export function buildReportBuilderSelectedGetReportDocumentResponseFromBuilderState(listResponse = null, savedReportPayload = null, {
    request = null,
    container = {},
    config = {},
    state = {},
    savedAt = Date.now(),
    semanticSummary = null,
    semanticModel = null,
    semanticRuntimeDiagnostics = [],
} = {}) {
    const targetReportId = normalizeString(request?.reportRef?.reportId);
    if (!targetReportId) {
        return null;
    }
    const entries = Array.isArray(listResponse?.entries) ? listResponse.entries : [];
    const matchingEntries = entries.filter((candidate) => normalizeString(candidate?.reportRef?.reportId) === targetReportId);
    if (matchingEntries.length !== 1) {
        return null;
    }
    const entry = matchingEntries[0];
    const normalizedVersion = resolveReportBuilderDocumentVersion(entry?.documentVersion);
    if (normalizedVersion < 1) {
        return null;
    }
    const response = buildReportBuilderGetReportDocumentResponseFromBuilderState(savedReportPayload, {
        container,
        config,
        state,
        savedAt: entry?.savedAt ?? savedAt,
        semanticSummary,
        semanticModel,
        semanticRuntimeDiagnostics,
        documentVersion: normalizedVersion,
    });
    if (!response || normalizeString(response?.reportRef?.reportId) !== targetReportId) {
        return null;
    }
    if (normalizeString(entry?.source?.kind) !== normalizeString(response?.source?.kind)
        || normalizeString(entry?.source?.payloadId) !== normalizeString(response?.source?.payloadId)
        || normalizeString(entry?.source?.sourceArtifactId) !== normalizeString(response?.source?.sourceArtifactId)) {
        return null;
    }
    return response;
}

export function buildReportBuilderListReportDocumentsResponse(savedReportPayload = null, {
    documentVersion = 0,
    cursor = "",
    hasMore = false,
    localSavedPayloads = [],
    additionalEntries = [],
    savedAt = Date.now(),
} = {}) {
    const primaryRecord = normalizeReportBuilderSavedReportRecord(savedReportPayload, {
        documentVersion,
        savedAt,
    });
    const localRecords = normalizeReportBuilderSavedReportRecords(localSavedPayloads)
        .filter((record) => record.documentVersion > 0);
    const seenReportIds = new Set();
    const entries = [];
    [primaryRecord, ...localRecords].forEach((record) => {
        if (!record || seenReportIds.has(record.reportId)) {
            return;
        }
        const entry = buildListEntryFromSavedReportPayloadRecord(record);
        if (!entry) {
            return;
        }
        seenReportIds.add(record.reportId);
        entries.push(entry);
    });
    (Array.isArray(additionalEntries) ? additionalEntries : []).forEach((entry) => {
        const reportId = normalizeString(entry?.reportRef?.reportId || entry?.document?.id);
        if (!reportId || seenReportIds.has(reportId)) {
            return;
        }
        seenReportIds.add(reportId);
        entries.push(cloneValue(entry));
    });
    if (entries.length === 0) {
        return null;
    }
    return buildListReportDocumentsResponse({
        entries,
        cursor,
        hasMore,
    });
}

export function buildReportBuilderListReportDocumentsResponseFromBuilderState(savedReportPayload = null, {
    container = {},
    config = {},
    state = {},
    savedAt = Date.now(),
    semanticSummary = null,
    semanticModel = null,
    semanticRuntimeDiagnostics = [],
    documentVersion = 0,
    cursor = "",
    hasMore = false,
    localSavedPayloads = [],
    additionalEntries = [],
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
    return buildReportBuilderListReportDocumentsResponse(rebuiltSavedReportPayload, {
        documentVersion,
        cursor,
        hasMore,
        localSavedPayloads,
        additionalEntries,
        savedAt,
    });
}

function resolveSavedPayloadRecordTemplateIdentity(localSavedPayloads = [], reportId = "") {
    const matchingRecord = resolveReportBuilderSavedReportRecordByReportId(localSavedPayloads, reportId);
    if (!matchingRecord) {
        return null;
    }
    const templateId = normalizeString(matchingRecord?.templateId);
    const templateLabel = normalizeString(matchingRecord?.templateLabel);
    if (!templateId && !templateLabel) {
        return null;
    }
    return {
        ...(templateId ? { templateId } : {}),
        ...(templateLabel ? { templateLabel } : {}),
    };
}

export function buildReportBuilderGetReportDocumentResponseSummary(response = null) {
    if (!response || typeof response !== "object" || Array.isArray(response)) {
        return null;
    }
    const templateIdentity = extractReportDocumentTemplateIdentity(response?.document || null);
    const subtitle = normalizeString(response?.document?.subtitle);
    const description = normalizeString(response?.document?.description);
    return {
        title: normalizeString(response?.document?.title || response?.reportRef?.reportId || "Report"),
        ...(subtitle ? { subtitle } : {}),
        ...(description ? { description } : {}),
        kind: normalizeString(response?.kind),
        reportId: normalizeString(response?.reportRef?.reportId),
        documentVersion: Number(response?.documentVersion || 0) || 0,
        compileStatus: normalizeString(response?.compileState?.status),
        ...(templateIdentity ? templateIdentity : {}),
    };
}

export function buildReportBuilderListReportDocumentsEntrySummary(entry = null, {
    localSavedPayloads = [],
} = {}) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
    }
    const reportId = normalizeString(entry?.reportRef?.reportId);
    const title = normalizeString(entry?.title || reportId || "Report");
    if (!reportId || !title) {
        return null;
    }
    const subtitle = normalizeString(entry?.subtitle);
    const description = normalizeString(entry?.description);
    return {
        reportId,
        title,
        ...(subtitle ? { subtitle } : {}),
        ...(description ? { description } : {}),
        documentVersion: Number(entry?.documentVersion || 0) || 0,
        compileStatus: normalizeString(entry?.compileState?.status),
        ...(resolveReportBuilderSavedReportRecordByReportId(localSavedPayloads, reportId)?.exportable ? { exportable: true } : {}),
        ...(resolveSavedPayloadRecordTemplateIdentity(localSavedPayloads, reportId) || {}),
    };
}

export function buildReportBuilderListReportDocumentsResponseSummary(response = null) {
    if (!response || typeof response !== "object" || Array.isArray(response)) {
        return null;
    }
    return {
        kind: normalizeString(response?.kind),
        entryCount: Array.isArray(response?.entries) ? response.entries.length : 0,
        cursor: normalizeString(response?.cursor),
        hasMore: response?.hasMore === true,
    };
}

export function buildReportBuilderReportDocumentReadResponseInspectorState(payload = null, {
    selectedReportId = "",
    localSavedPayloads = [],
} = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return null;
    }
    const content = serializeReportBuilderReportDocumentReadResponse(payload);
    if (!content) {
        return null;
    }
    if (normalizeString(payload?.kind) === "getReportDocumentResponse") {
        const summary = buildReportBuilderGetReportDocumentResponseSummary(payload);
        return summary ? {
            ...summary,
            ...(summary.subtitle ? { headerSubtitle: summary.subtitle } : {}),
            ...(summary.description ? { headerDescription: summary.description } : {}),
            content,
        } : null;
    }
    if (normalizeString(payload?.kind) === "listReportDocumentsResponse") {
        const summary = buildReportBuilderListReportDocumentsResponseSummary(payload);
        if (!summary) {
            return null;
        }
        const entries = Array.isArray(payload?.entries) ? payload.entries : [];
        const normalizedSelectedReportId = normalizeString(selectedReportId);
        const selectedEntry = buildReportBuilderListReportDocumentsEntrySummary(
            entries.find((entry) => normalizeString(entry?.reportRef?.reportId) === normalizedSelectedReportId)
            || entries[0]
            || null,
            { localSavedPayloads },
        );
        return {
            ...summary,
            ...(selectedEntry ? { selectedEntry } : {}),
            ...(selectedEntry?.subtitle ? { headerSubtitle: selectedEntry.subtitle } : {}),
            ...(selectedEntry?.description ? { headerDescription: selectedEntry.description } : {}),
            ...(selectedEntry?.templateId ? { templateId: selectedEntry.templateId } : {}),
            ...(selectedEntry?.templateLabel ? { templateLabel: selectedEntry.templateLabel } : {}),
            content,
        };
    }
    return {
        kind: normalizeString(payload?.kind),
        content,
    };
}

export function serializeReportBuilderReportDocumentReadResponse(payload = null, {
    pretty = true,
} = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return "";
    }
    return pretty === false
        ? JSON.stringify(payload)
        : JSON.stringify(payload, null, 2);
}

export function buildReportBuilderReportDocumentReadResponseDownload(payload = null, {
    fallbackName = "report-document-read-response",
    selectedReportId = "",
} = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return null;
    }
    const content = serializeReportBuilderReportDocumentReadResponse(payload);
    if (!content) {
        return null;
    }
    const title = normalizeString(payload?.document?.title);
    const normalizedSelectedReportId = normalizeString(selectedReportId);
    const selectedEntry = normalizeString(payload?.kind) === "listReportDocumentsResponse" && normalizedSelectedReportId
        ? ((Array.isArray(payload?.entries) ? payload.entries : [])
            .find((entry) => normalizeString(entry?.reportRef?.reportId) === normalizedSelectedReportId) || null)
        : null;
    const selectedTitle = normalizeString(selectedEntry?.title);
    const reportId = normalizeString(payload?.reportRef?.reportId || payload?.entries?.[0]?.reportRef?.reportId || fallbackName);
    const normalizedName = sanitizeFilenameSegment(selectedTitle || title || reportId || fallbackName) || fallbackName;
    return {
        filename: `${normalizedName}-${normalizeString(payload?.kind || fallbackName)}.json`,
        mimeType: "application/json;charset=utf-8",
        payload: content,
    };
}

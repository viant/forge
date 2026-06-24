import {
    buildPublishedSnapshotReportExportRequest,
    buildSavedViewReportExportRequest,
} from "../../reporting/reportExportRequestModel.js";
import { extractSavedViewOverlayArtifactState } from "../../reporting/views/savedViewOverlayModel.js";
import { buildReportBuilderSavedReportPayloadSummary } from "./reportBuilderSavedReportPayload.js";
import {
    buildListEntryFromSavedReportPayloadRecord,
} from "./reportBuilderReportDocumentReadResponse.js";
import {
    matchesReportBuilderSavedPayloadSourceIdentity,
    normalizeReportBuilderSavedPayloadSourceIdentity,
    normalizeReportBuilderSavedReportRecord,
    normalizeReportBuilderSavedReportRecords,
} from "./reportBuilderSavedReportRecords.js";
import { validateReportExportRequest } from "../../reporting/schema/reportSchemas.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function normalizePositiveInteger(value = 0) {
    const numeric = Math.trunc(Number(value));
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : 0;
}

function isPlainObject(value = null) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function sanitizeFilenameSegment(value = "") {
    return normalizeString(value).replace(/[\\/:*?"<>|]+/g, "-");
}

function normalizeTimestamp(value = 0, fallbackValue = Date.now()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0
        ? Math.round(numeric)
        : Math.round(Number(fallbackValue || Date.now()) || Date.now());
}

function normalizeLifecycleResultArtifactKind(value = null) {
    return normalizeString(value?.kind || value?.source?.kind);
}

function isLifecycleSharedArtifactLike(value = null) {
    const normalizedKind = normalizeLifecycleResultArtifactKind(value);
    return normalizedKind === "reportBuilder.savedView"
        || normalizedKind === "reportBuilder.publishedSnapshot";
}

function collectLifecycleResultCandidates(value = null) {
    const source = isPlainObject(value) ? value : null;
    if (!source) {
        return [];
    }
    return [
        source,
        source.sharedArtifact,
        source.artifact,
        source.savedView,
        source.publishedSnapshot,
        source.savedRecord,
        source.result,
        source.payload,
        source.artifacts,
        source.responses,
        source.response,
    ].filter((entry, index, items) => isPlainObject(entry) && items.indexOf(entry) === index);
}

function resolveLifecycleSharedArtifactKind(value = null) {
    return normalizeString(value?.kind);
}

function resolveLifecycleSharedArtifactId(value = null) {
    const kind = resolveLifecycleSharedArtifactKind(value);
    if (kind === "reportBuilder.savedView") {
        return normalizeString(value?.viewId || value?.savedViewId || value?.sourceArtifactId || value?.artifactId || value?.id);
    }
    if (kind === "reportBuilder.publishedSnapshot") {
        return normalizeString(value?.snapshotId || value?.publishedSnapshotId || value?.sourceArtifactId || value?.artifactId || value?.id);
    }
    return "";
}

function buildLifecycleSharedArtifactSource(value = null) {
    const kind = resolveLifecycleSharedArtifactKind(value);
    const sourceArtifactId = resolveLifecycleSharedArtifactId(value);
    const reportId = normalizeString(value?.reportId || value?.reportRef?.reportId || value?.document?.id);
    if (!kind || !sourceArtifactId || !reportId) {
        return null;
    }
    return {
        kind,
        reportId,
        sourceArtifactId,
    };
}

function buildLifecycleSharedArtifactExportRequest(value = null, {
    format = "pdf",
} = {}) {
    const kind = resolveLifecycleSharedArtifactKind(value);
    const documentVersion = normalizePositiveInteger(value?.documentVersion);
    const reportSpec = isPlainObject(value?.reportSpec) ? cloneValue(value.reportSpec) : null;
    const reportFill = isPlainObject(value?.reportFill) ? cloneValue(value.reportFill) : null;
    const reportPrint = isPlainObject(value?.reportPrint) ? cloneValue(value.reportPrint) : null;
    if (!kind || !reportSpec || !reportFill || !reportPrint || documentVersion < 1) {
        return null;
    }
    if (kind === "reportBuilder.savedView") {
        return buildSavedViewReportExportRequest({
            savedView: value,
            reportSpec,
            reportFill,
            reportPrint,
            documentVersion,
            format,
        });
    }
    if (kind === "reportBuilder.publishedSnapshot") {
        return buildPublishedSnapshotReportExportRequest({
            publishedSnapshot: value,
            reportSpec,
            reportFill,
            reportPrint,
            documentVersion,
            format,
        });
    }
    return null;
}

function extractLifecycleEnvelopeSharedArtifact(value = null) {
    const directSavedRecord = normalizeReportBuilderSavedReportRecord(value);
    if (isLifecycleSharedArtifactLike(value) || isLifecycleSharedArtifactLike(directSavedRecord)) {
        return directSavedRecord || value;
    }
    for (const candidate of collectLifecycleResultCandidates(value)) {
        for (const nestedCandidate of collectLifecycleResultCandidates(candidate)) {
            const normalizedRecord = normalizeReportBuilderSavedReportRecord(nestedCandidate);
            if (isLifecycleSharedArtifactLike(nestedCandidate) || isLifecycleSharedArtifactLike(normalizedRecord)) {
                return normalizedRecord || nestedCandidate;
            }
        }
    }
    return null;
}

function normalizeLifecycleEnvelopeExportRequest(value = null) {
    if (!isPlainObject(value)) {
        return null;
    }
    const normalized = cloneValue(value);
    return validateReportExportRequest(normalized).valid ? normalized : null;
}

function extractLifecycleEnvelopeExportRequest(value = null) {
    const candidates = collectLifecycleResultCandidates(value)
        .flatMap((candidate) => [
            candidate,
            candidate.exportRequest,
            candidate.reportExportRequest,
        ]);
    for (const candidate of candidates) {
        const normalized = normalizeLifecycleEnvelopeExportRequest(candidate);
        if (normalized) {
            return normalized;
        }
    }
    return null;
}

function normalizeLifecycleEnvelopeGetReportDocumentResponse(value = null) {
    return isPlainObject(value) && normalizeString(value?.kind) === "getReportDocumentResponse"
        ? cloneValue(value)
        : null;
}

function extractLifecycleEnvelopeGetReportDocumentResponse(value = null) {
    const candidates = collectLifecycleResultCandidates(value)
        .flatMap((candidate) => [
            candidate,
            candidate.getReportDocumentResponse,
            candidate.reopenBundle,
            candidate.selectedGetReportDocumentResponse,
            candidate.response,
        ]);
    for (const candidate of candidates) {
        const normalized = normalizeLifecycleEnvelopeGetReportDocumentResponse(candidate);
        if (normalized) {
            return normalized;
        }
    }
    return null;
}

function normalizeLifecycleEnvelopeListReportDocumentsResponse(value = null) {
    if (!isPlainObject(value) || normalizeString(value?.kind) !== "listReportDocumentsResponse") {
        return null;
    }
    const entries = Array.isArray(value?.entries) ? value.entries : null;
    if (!entries) {
        return null;
    }
    return {
        ...cloneValue(value),
        entries: cloneValue(entries),
    };
}

function extractLifecycleEnvelopeListReportDocumentsResponse(value = null) {
    const candidates = collectLifecycleResultCandidates(value)
        .flatMap((candidate) => [
            candidate,
            candidate.listReportDocumentsResponse,
            candidate.catalogResponse,
        ]);
    for (const candidate of candidates) {
        const normalized = normalizeLifecycleEnvelopeListReportDocumentsResponse(candidate);
        if (normalized) {
            return normalized;
        }
    }
    return null;
}

function normalizeLifecycleEnvelopeGetReportDocumentRequest(value = null) {
    return isPlainObject(value) && normalizeString(value?.kind) === "getReportDocumentRequest"
        ? cloneValue(value)
        : null;
}

function extractLifecycleEnvelopeGetReportDocumentRequest(value = null) {
    const candidates = collectLifecycleResultCandidates(value)
        .flatMap((candidate) => [
            candidate,
            candidate.getReportDocumentRequest,
            candidate.request,
        ]);
    for (const candidate of candidates) {
        const normalized = normalizeLifecycleEnvelopeGetReportDocumentRequest(candidate);
        if (normalized) {
            return normalized;
        }
    }
    return null;
}

function normalizeLifecycleEnvelopeReopenDiagnostic(value = null) {
    return isPlainObject(value) && normalizeString(value?.kind) === "reportBuilder.reopenDiagnostic"
        ? cloneValue(value)
        : null;
}

function extractLifecycleEnvelopeReopenDiagnostic(value = null) {
    const candidates = collectLifecycleResultCandidates(value)
        .flatMap((candidate) => [
            candidate,
            candidate.reopenReportDocumentDiagnostic,
            candidate.reopenDiagnostic,
            candidate.diagnostic,
        ]);
    for (const candidate of candidates) {
        const normalized = normalizeLifecycleEnvelopeReopenDiagnostic(candidate);
        if (normalized) {
            return normalized;
        }
    }
    return null;
}

function normalizeLifecycleEnvelopeCreateReportDocumentPayload(value = null) {
    return isPlainObject(value) && normalizeString(value?.kind) === "createReportDocumentPayload"
        ? cloneValue(value)
        : null;
}

function extractLifecycleEnvelopeCreateReportDocumentPayload(value = null) {
    const candidates = collectLifecycleResultCandidates(value)
        .flatMap((candidate) => [
            candidate,
            candidate.createReportDocumentPayload,
            candidate.createPayload,
        ]);
    for (const candidate of candidates) {
        const normalized = normalizeLifecycleEnvelopeCreateReportDocumentPayload(candidate);
        if (normalized) {
            return normalized;
        }
    }
    return null;
}

function normalizeLifecycleEnvelopeUpdateReportDocumentPayload(value = null) {
    return isPlainObject(value) && normalizeString(value?.kind) === "updateReportDocumentPayload"
        ? cloneValue(value)
        : null;
}

function extractLifecycleEnvelopeUpdateReportDocumentPayload(value = null) {
    const candidates = collectLifecycleResultCandidates(value)
        .flatMap((candidate) => [
            candidate,
            candidate.updateReportDocumentPayload,
            candidate.updatePayload,
        ]);
    for (const candidate of candidates) {
        const normalized = normalizeLifecycleEnvelopeUpdateReportDocumentPayload(candidate);
        if (normalized) {
            return normalized;
        }
    }
    return null;
}

function normalizeLifecycleEnvelopeUpdateReportDocumentConflictDiagnostic(value = null) {
    return isPlainObject(value) && normalizeString(value?.kind) === "updateReportDocumentConflictDiagnostic"
        ? cloneValue(value)
        : null;
}

function extractLifecycleEnvelopeUpdateReportDocumentConflictDiagnostic(value = null) {
    const candidates = collectLifecycleResultCandidates(value)
        .flatMap((candidate) => [
            candidate,
            candidate.updateReportDocumentConflictDiagnostic,
            candidate.updateConflictDiagnostic,
            candidate.conflictDiagnostic,
        ]);
    for (const candidate of candidates) {
        const normalized = normalizeLifecycleEnvelopeUpdateReportDocumentConflictDiagnostic(candidate);
        if (normalized) {
            return normalized;
        }
    }
    return null;
}

function resolveLifecycleEnvelopeMessage(value = null) {
    const candidates = collectLifecycleResultCandidates(value);
    const directMessage = normalizeString(value?.message || value?.statusMessage);
    if (directMessage) {
        return directMessage;
    }
    for (const candidate of candidates) {
        const message = normalizeString(candidate?.message || candidate?.statusMessage);
        if (message) {
            return message;
        }
    }
    return "";
}

function mergeLifecycleEnvelopeSharedArtifactWithExportRequest(sharedArtifact = null, exportRequest = null) {
    if (!sharedArtifact || !exportRequest) {
        return sharedArtifact;
    }
    return {
        ...cloneValue(sharedArtifact),
        exportRequest: cloneValue(exportRequest),
    };
}

export function resolveReportBuilderLifecycleResultEnvelope(value = null) {
    const exportRequest = extractLifecycleEnvelopeExportRequest(value);
    const sharedArtifact = mergeLifecycleEnvelopeSharedArtifactWithExportRequest(
        extractLifecycleEnvelopeSharedArtifact(value),
        exportRequest,
    );
    return {
        sharedArtifact,
        getReportDocumentResponse: extractLifecycleEnvelopeGetReportDocumentResponse(value),
        listReportDocumentsResponse: extractLifecycleEnvelopeListReportDocumentsResponse(value),
        getReportDocumentRequest: extractLifecycleEnvelopeGetReportDocumentRequest(value),
        reopenReportDocumentDiagnostic: extractLifecycleEnvelopeReopenDiagnostic(value),
        createReportDocumentPayload: extractLifecycleEnvelopeCreateReportDocumentPayload(value),
        updateReportDocumentPayload: extractLifecycleEnvelopeUpdateReportDocumentPayload(value),
        updateReportDocumentConflictDiagnostic: extractLifecycleEnvelopeUpdateReportDocumentConflictDiagnostic(value),
        exportRequest,
        message: resolveLifecycleEnvelopeMessage(value),
    };
}

function buildLifecycleSharedArtifactSummaryPayload(value = null) {
    const normalizedRecord = normalizeReportBuilderLifecycleSharedArtifactRecord(value);
    if (!normalizedRecord?.document || !normalizedRecord?.source?.kind) {
        return null;
    }
    const sourceKind = normalizeString(normalizedRecord?.source?.kind || normalizedRecord?.kind);
    const sourceArtifactId = normalizeString(
        normalizedRecord?.source?.sourceArtifactId
        || normalizedRecord?.sourceIdentity?.sourceArtifactId
        || normalizedRecord?.id,
    );
    return {
        ...cloneValue(normalizedRecord),
        kind: sourceKind,
        title: normalizeString(
            normalizedRecord?.title
            || normalizedRecord?.document?.title
            || normalizedRecord?.reportId
            || "Report",
        ) || "Report",
        sourceArtifactId,
        reportDocument: cloneValue(normalizedRecord.document),
        ...(normalizedRecord?.reportSpec ? { reportSpec: cloneValue(normalizedRecord.reportSpec) } : {}),
    };
}

export function buildReportBuilderLifecycleSharedArtifactPayload(value = null) {
    const normalizedRecord = normalizeReportBuilderLifecycleSharedArtifactRecord(value);
    if (!normalizedRecord?.document || !normalizedRecord?.source?.kind) {
        return null;
    }
    const sourceKind = normalizeString(normalizedRecord?.source?.kind || normalizedRecord?.kind);
    const sourceArtifactId = normalizeString(
        normalizedRecord?.source?.sourceArtifactId
        || normalizedRecord?.sourceIdentity?.sourceArtifactId
        || normalizedRecord?.id,
    );
    const payload = {
        version: normalizePositiveInteger(normalizedRecord?.version) || 1,
        kind: sourceKind,
        id: normalizeString(normalizedRecord?.id || sourceArtifactId),
        title: normalizeString(
            normalizedRecord?.title
            || normalizedRecord?.document?.title
            || normalizedRecord?.reportId
            || "Report",
        ) || "Report",
        reportId: normalizeString(
            normalizedRecord?.reportId
            || normalizedRecord?.document?.id
            || normalizedRecord?.source?.reportId,
        ),
        documentVersion: normalizePositiveInteger(normalizedRecord?.documentVersion),
        savedAt: normalizeTimestamp(normalizedRecord?.savedAt),
        ...(sourceArtifactId ? { sourceArtifactId } : {}),
        document: cloneValue(normalizedRecord.document),
        ...(isPlainObject(normalizedRecord?.reportSpec) ? { reportSpec: cloneValue(normalizedRecord.reportSpec) } : {}),
        ...(isPlainObject(normalizedRecord?.reportFill) ? { reportFill: cloneValue(normalizedRecord.reportFill) } : {}),
        ...(isPlainObject(normalizedRecord?.reportPrint) ? { reportPrint: cloneValue(normalizedRecord.reportPrint) } : {}),
    };
    const savedViewOverlay = extractSavedViewOverlayArtifactState(normalizedRecord);
    if (savedViewOverlay) {
        payload.savedViewOverlay = savedViewOverlay;
    }
    [
        "lifecycle",
        "ownerRef",
        "policyRef",
        "shareableVersion",
        "shareable",
        "badges",
        "capabilities",
        "grants",
        "shareableBadges",
        "shareableCapabilities",
        "shareableGrants",
        "templateId",
        "templateLabel",
    ].forEach((key) => {
        if (normalizedRecord?.[key] !== undefined) {
            payload[key] = cloneValue(normalizedRecord[key]);
        }
    });
    return payload;
}

export function buildReportBuilderLifecycleSharedArtifactSummary(value = null, {
    localSavedPayloads = [],
} = {}) {
    const summaryPayload = buildLifecycleSharedArtifactSummaryPayload(value);
    if (!summaryPayload) {
        return null;
    }
    return buildReportBuilderSavedReportPayloadSummary(summaryPayload, {
        localSavedPayloads,
    });
}

export function serializeReportBuilderLifecycleSharedArtifact(value = null, {
    pretty = true,
} = {}) {
    const payload = buildReportBuilderLifecycleSharedArtifactPayload(value);
    if (!payload) {
        return "";
    }
    return pretty === false
        ? JSON.stringify(payload)
        : JSON.stringify(payload, null, 2);
}

export function buildReportBuilderLifecycleSharedArtifactInspectorState(value = null, {
    localSavedPayloads = [],
} = {}) {
    const summary = buildReportBuilderLifecycleSharedArtifactSummary(value, {
        localSavedPayloads,
    });
    const content = serializeReportBuilderLifecycleSharedArtifact(value);
    if (!summary || !content) {
        return null;
    }
    return {
        ...summary,
        ...(summary.subtitle ? { headerSubtitle: summary.subtitle } : {}),
        ...(summary.description ? { headerDescription: summary.description } : {}),
        ...(Array.isArray(summary.semanticBindingFieldGroups) && summary.semanticBindingFieldGroups.length > 0
            ? { semanticBindingFieldGroups: summary.semanticBindingFieldGroups }
            : {}),
        content,
    };
}

export function buildReportBuilderLifecycleSharedArtifactDownload(value = null) {
    const payload = buildReportBuilderLifecycleSharedArtifactPayload(value);
    const summary = buildReportBuilderLifecycleSharedArtifactSummary(value);
    if (!payload || !summary) {
        return null;
    }
    const suffix = normalizeString(payload?.kind) === "reportBuilder.publishedSnapshot"
        ? "published-snapshot"
        : "saved-view";
    const normalizedName = sanitizeFilenameSegment(summary.title || payload.id || suffix) || suffix;
    const serializedPayload = serializeReportBuilderLifecycleSharedArtifact(value);
    if (!serializedPayload) {
        return null;
    }
    return {
        filename: `${normalizedName}-${suffix}.json`,
        mimeType: "application/json;charset=utf-8",
        payload: serializedPayload,
    };
}

export function normalizeReportBuilderLifecycleSharedArtifactRecord(value = null, {
    format = "pdf",
} = {}) {
    const envelope = resolveReportBuilderLifecycleResultEnvelope(value);
    const sharedArtifact = envelope.sharedArtifact && typeof envelope.sharedArtifact === "object" && !Array.isArray(envelope.sharedArtifact)
        ? envelope.sharedArtifact
        : null;
    const source = buildLifecycleSharedArtifactSource(sharedArtifact);
    const document = isPlainObject(sharedArtifact?.document) ? cloneValue(sharedArtifact.document) : null;
    const reportId = normalizeString(source?.reportId);
    if (!source || !document || !reportId) {
        return null;
    }
    const reportSpec = isPlainObject(sharedArtifact?.reportSpec) ? cloneValue(sharedArtifact.reportSpec) : null;
    const documentVersion = normalizePositiveInteger(sharedArtifact?.documentVersion);
    const savedAt = normalizeTimestamp(sharedArtifact?.savedAt);
    const exportRequest = envelope.exportRequest || buildLifecycleSharedArtifactExportRequest(sharedArtifact, { format });
    const savedViewOverlay = extractSavedViewOverlayArtifactState(sharedArtifact);
    return normalizeReportBuilderSavedReportRecord({
        ...cloneValue(sharedArtifact),
        reportId,
        title: normalizeString(sharedArtifact?.title || document?.title || reportId || "Report") || "Report",
        documentVersion,
        savedAt,
        document,
        ...(reportSpec ? { reportSpec } : {}),
        source,
        ...(exportRequest ? { exportRequest } : {}),
        ...(savedViewOverlay ? { savedViewOverlay } : {}),
    }, {
        documentVersion,
        savedAt,
    });
}

export function upsertReportBuilderLifecycleSharedArtifactRecord(records = [], value = null) {
    const normalizedRecord = normalizeReportBuilderLifecycleSharedArtifactRecord(value);
    const currentRecords = normalizeReportBuilderSavedReportRecords(records);
    if (!normalizedRecord?.sourceIdentity) {
        return currentRecords;
    }
    return [
        normalizedRecord,
        ...currentRecords.filter((record) => !matchesReportBuilderSavedPayloadSourceIdentity(
            normalizedRecord.sourceIdentity,
            record?.sourceIdentity,
        )),
    ];
}

export function applyReportBuilderLifecycleSharedArtifactToListResponse(response = null, value = null, {
    targetSource = null,
} = {}) {
    if (!isPlainObject(response) || !Array.isArray(response?.entries)) {
        return response;
    }
    const normalizedRecord = normalizeReportBuilderLifecycleSharedArtifactRecord(value);
    const replacementEntry = buildListEntryFromSavedReportPayloadRecord(normalizedRecord);
    if (!normalizedRecord || !replacementEntry) {
        return response;
    }
    const normalizedTargetSourceIdentity = normalizeReportBuilderSavedPayloadSourceIdentity(targetSource);
    const targetReportId = normalizeString(
        targetSource?.reportId
        || targetSource?.reportRef?.reportId
        || normalizedRecord?.reportId,
    );
    let replaced = false;
    const nextEntries = response.entries.map((entry) => {
        if (replaced) {
            return entry;
        }
        const entrySourceIdentity = normalizeReportBuilderSavedPayloadSourceIdentity(entry?.source || entry);
        const sourceMatch = normalizedTargetSourceIdentity
            && entrySourceIdentity
            && matchesReportBuilderSavedPayloadSourceIdentity(normalizedTargetSourceIdentity, entrySourceIdentity);
        const reportMatch = !normalizedTargetSourceIdentity
            && targetReportId
            && normalizeString(entry?.reportRef?.reportId) === targetReportId;
        if (!sourceMatch && !reportMatch) {
            return entry;
        }
        replaced = true;
        return {
            ...entry,
            ...replacementEntry,
        };
    });
    return {
        ...response,
        entries: replaced
            ? nextEntries
            : [replacementEntry, ...response.entries],
    };
}

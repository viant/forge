import {
    normalizeReportBuilderSavedReportRecords,
    resolveReportBuilderSavedReportRecordByReportId,
    resolveReportBuilderSavedReportRecordBySource,
} from "./reportBuilderSavedReportRecords.js";
import {
    resolveEmbeddedReportDocumentCompileState,
} from "./reportBuilderImportedDocumentMetadata.js";
import { resolveNormalizedReportSpecDocumentContext } from "./reportBuilderSavedRecordMetadataContext.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
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

function buildSavedRecordFromGetReportDocumentResponse(response = null) {
    if (!response || typeof response !== "object" || Array.isArray(response)) {
        return null;
    }
    const kind = normalizeString(response?.kind);
    const reportId = normalizeString(response?.reportRef?.reportId || response?.document?.id);
    const context = resolveNormalizedReportSpecDocumentContext({
        reportSpec: response?.reportSpec || null,
        document: response?.document || null,
        title: response?.document?.title || response?.reportRef?.reportId || "",
    });
    const reportSpec = context?.reportSpec ? cloneValue(context.reportSpec) : null;
    const document = context?.document ? cloneValue(context.document) : null;
    const compileState = response?.compileState && typeof response.compileState === "object" && !Array.isArray(response.compileState)
        ? cloneValue(response.compileState)
        : resolveEmbeddedReportDocumentCompileState(document, reportSpec);
    const source = response?.source && typeof response.source === "object" && !Array.isArray(response.source)
        ? cloneValue(response.source)
        : null;
    if (kind !== "getReportDocumentResponse" || !reportId || !document || !source) {
        return null;
    }
    return {
        reportId,
        title: normalizeString(document?.title || reportId),
        documentVersion: Number(response?.documentVersion || 0) || 0,
        savedAt: Number(response?.savedAt || 0) || 0,
        document,
        ...(reportSpec ? { reportSpec } : {}),
        ...(compileState ? { compileState } : {}),
        source,
        ...(normalizeString(response?.importedArtifactKind) ? { importedArtifactKind: normalizeString(response.importedArtifactKind) } : {}),
    };
}

export function buildReportBuilderSavedReportState({
    savedReportPayload = null,
    currentSavedRecord = null,
    configuredSavedPayloads = [],
    configuredGetResponses = [],
    reopenedSource = null,
    reopenedReportId = "",
    selectedListEntry = null,
} = {}) {
    const configuredSavedRecords = (Array.isArray(configuredGetResponses) ? configuredGetResponses : [])
        .map((response) => buildSavedRecordFromGetReportDocumentResponse(response))
        .filter(Boolean);
    const rawLocalSavedPayloads = [
        ...(currentSavedRecord ? [currentSavedRecord] : []),
        ...(savedReportPayload ? [savedReportPayload] : []),
        ...configuredSavedRecords,
        ...(Array.isArray(configuredSavedPayloads) ? configuredSavedPayloads : []),
    ];
    const localSavedReportRecords = normalizeReportBuilderSavedReportRecords(rawLocalSavedPayloads);
    const normalizedReopenedReportId = normalizeString(reopenedReportId);
    const resolvedCurrentSavedRecord = resolveReportBuilderSavedReportRecordBySource(localSavedReportRecords, savedReportPayload)
        || null;
    const reopenedSavedRecord = resolveReportBuilderSavedReportRecordBySource(localSavedReportRecords, reopenedSource)
        || (normalizedReopenedReportId
            ? resolveReportBuilderSavedReportRecordByReportId(localSavedReportRecords, normalizedReopenedReportId)
            : null)
        || null;
    const selectedListEntrySavedRecord = resolveReportBuilderSavedReportRecordBySource(
        localSavedReportRecords,
        selectedListEntry?.source || selectedListEntry,
    ) || resolveUniqueSavedReportRecordByReportId(
        localSavedReportRecords,
        selectedListEntry?.reportRef?.reportId || selectedListEntry?.reportId || selectedListEntry?.document?.id || "",
    ) || null;
    return {
        rawLocalSavedPayloads: rawLocalSavedPayloads.map((entry) => cloneValue(entry)),
        localSavedReportRecords,
        currentSavedRecord: resolvedCurrentSavedRecord,
        reopenedSavedRecord,
        selectedListEntrySavedRecord,
        savedReportPayloadExportRequest: cloneValue(resolvedCurrentSavedRecord?.exportRequest || null),
        reopenedExportRequest: cloneValue(reopenedSavedRecord?.exportRequest || null),
        selectedListEntryExportRequest: cloneValue(selectedListEntrySavedRecord?.exportRequest || null),
    };
}

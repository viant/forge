import { normalizeReportBuilderSavedReportRecord } from "./reportBuilderSavedReportRecords.js";
import { buildReportBuilderGetReportDocumentResponse } from "./reportBuilderReportDocumentReadResponse.js";
import {
    matchesReportBuilderSavedPayloadSourceIdentity,
    normalizeReportBuilderSavedPayloadSourceIdentity,
} from "./reportBuilderSavedReportRecords.js";
import {
    resolveEmbeddedReportDocumentCompileState,
} from "./reportBuilderImportedDocumentMetadata.js";
import { resolveNormalizedReportSpecDocumentContext } from "./reportBuilderSavedRecordMetadataContext.js";

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeString(value = "") {
    return String(value || "").trim();
}

export function normalizeImportedLocalGetReportDocumentResponse(response = null) {
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
    const derivedReportSpec = context?.reportSpec ? cloneValue(context.reportSpec) : null;
    const document = context?.document ? cloneValue(context.document) : null;
    const derivedCompileState = response?.compileState && typeof response.compileState === "object" && !Array.isArray(response.compileState)
        ? cloneValue(response.compileState)
        : resolveEmbeddedReportDocumentCompileState(document, derivedReportSpec);
    const source = response?.source && typeof response.source === "object" && !Array.isArray(response.source)
        ? cloneValue(response.source)
        : null;
    if (kind !== "getReportDocumentResponse" || !reportId || !document) {
        return null;
    }
    return {
        ...cloneValue(response),
        reportRef: { reportId },
        document,
        ...(derivedCompileState ? { compileState: derivedCompileState } : {}),
        ...(derivedReportSpec ? { reportSpec: derivedReportSpec } : {}),
        ...(source ? { source } : {}),
    };
}

export function buildImportedLocalGetReportDocumentResponseIdentity(response = null) {
    const normalized = normalizeImportedLocalGetReportDocumentResponse(response);
    if (!normalized) {
        return "";
    }
    const reportId = normalizeString(normalized?.reportRef?.reportId || normalized?.document?.id);
    const sourceKind = normalizeString(normalized?.source?.kind);
    const payloadId = normalizeString(normalized?.source?.payloadId);
    const sourceArtifactId = normalizeString(normalized?.source?.sourceArtifactId);
    if (payloadId || sourceArtifactId) {
        return [sourceKind, payloadId, sourceArtifactId, reportId].join("::");
    }
    return reportId;
}

function resolveImportedLocalGetReportDocumentResponseFromImport(imported = null) {
    if (!imported || typeof imported !== "object" || Array.isArray(imported)) {
        return null;
    }
    const explicit = normalizeImportedLocalGetReportDocumentResponse(imported?.getReportDocumentResponse);
    if (explicit) {
        return explicit;
    }
    if (normalizeString(imported?.kind) === "getReportDocumentResponse") {
        return normalizeImportedLocalGetReportDocumentResponse(imported?.payload);
    }
    return null;
}

export function normalizeReportBuilderImportedLocalGetResponses(responses = []) {
    const seen = new Set();
    return (Array.isArray(responses) ? responses : [])
        .map((response) => normalizeImportedLocalGetReportDocumentResponse(response))
        .filter((response) => {
            if (!response) {
                return false;
            }
            const identity = buildImportedLocalGetReportDocumentResponseIdentity(response);
            if (!identity || seen.has(identity)) {
                return false;
            }
            seen.add(identity);
            return true;
        });
}

export function resolveReportBuilderImportedLocalGetResponsesAfterImport(currentResponses = [], imported = null) {
    const current = normalizeReportBuilderImportedLocalGetResponses(currentResponses);
    const importedResponse = resolveImportedLocalGetReportDocumentResponseFromImport(imported);
    if (!importedResponse) {
        return current;
    }
    const importedIdentity = buildImportedLocalGetReportDocumentResponseIdentity(importedResponse);
    return [
        ...current.filter((response) => buildImportedLocalGetReportDocumentResponseIdentity(response) !== importedIdentity),
        importedResponse,
    ];
}

export function resolveReportBuilderImportedLocalGetResponsesAfterRemoval(currentResponses = [], targetIdentity = "") {
    const current = normalizeReportBuilderImportedLocalGetResponses(currentResponses);
    const normalizedTargetIdentity = normalizeString(targetIdentity);
    if (!normalizedTargetIdentity) {
        return current;
    }
    return current.filter((response) => buildImportedLocalGetReportDocumentResponseIdentity(response) !== normalizedTargetIdentity);
}

export function resolveReportBuilderImportedLocalGetResponseByIdentity(currentResponses = [], targetIdentity = "") {
    const normalizedTargetIdentity = normalizeString(targetIdentity);
    if (!normalizedTargetIdentity) {
        return null;
    }
    return normalizeReportBuilderImportedLocalGetResponses(currentResponses)
        .find((response) => buildImportedLocalGetReportDocumentResponseIdentity(response) === normalizedTargetIdentity)
        || null;
}

export function buildImportedLocalSavedReportRecordIdentity(record = null) {
    const normalized = normalizeReportBuilderSavedReportRecord(record);
    if (!normalized) {
        return "";
    }
    const sourceKind = normalizeString(normalized?.source?.kind);
    const payloadId = normalizeString(normalized?.source?.payloadId);
    const sourceArtifactId = normalizeString(normalized?.source?.sourceArtifactId);
    const reportId = normalizeString(normalized?.reportId);
    if (payloadId || sourceArtifactId) {
        return [sourceKind, payloadId, sourceArtifactId, reportId].join("::");
    }
    return reportId;
}

export function normalizeImportedLocalSavedReportRecords(records = []) {
    const seen = new Set();
    return (Array.isArray(records) ? records : [])
        .map((record) => normalizeReportBuilderSavedReportRecord(record))
        .filter((record) => {
            if (!record) {
                return false;
            }
            const identity = buildImportedLocalSavedReportRecordIdentity(record);
            if (!identity || seen.has(identity)) {
                return false;
            }
            seen.add(identity);
            return true;
        });
}

export function resolveReportBuilderImportedLocalSavedReportRecordsAfterImport(currentRecords = [], imported = null) {
    const current = normalizeImportedLocalSavedReportRecords(currentRecords);
    if (!imported || typeof imported !== "object" || Array.isArray(imported)) {
        return current;
    }
    const kind = normalizeString(imported?.kind);
    const normalizedImportedRecord = kind === "reportBuilder.savedReportRecord"
        ? normalizeReportBuilderSavedReportRecord(imported?.savedRecord || imported?.payload)
        : ((kind === "reportBuilder.savedView" || kind === "reportBuilder.publishedSnapshot")
            ? normalizeReportBuilderSavedReportRecord(imported?.savedRecord || imported?.payload)
        : (kind === "reportBuilder.savedReportPayload"
            ? normalizeReportBuilderSavedReportRecord(imported?.payload)
            : (kind === "reportBuilder.explorationArtifact"
                ? normalizeReportBuilderSavedReportRecord(imported?.savedReportPayload)
                : null)));
    const importedRecord = normalizedImportedRecord
        ? {
            ...normalizedImportedRecord,
            importedArtifactKind: kind,
        }
        : null;
    if (!importedRecord) {
        return current;
    }
    const importedIdentity = buildImportedLocalSavedReportRecordIdentity(importedRecord);
    return [
        ...current.filter((record) => buildImportedLocalSavedReportRecordIdentity(record) !== importedIdentity),
        importedRecord,
    ];
}

export function resolveReportBuilderImportedLocalSavedReportRecordByIdentity(currentRecords = [], targetIdentity = "") {
    const normalizedTargetIdentity = normalizeString(targetIdentity);
    if (!normalizedTargetIdentity) {
        return null;
    }
    return normalizeImportedLocalSavedReportRecords(currentRecords)
        .find((record) => buildImportedLocalSavedReportRecordIdentity(record) === normalizedTargetIdentity)
        || null;
}

export function resolveReportBuilderImportedLocalSavedReportRecordsAfterRemoval(currentRecords = [], targetIdentity = "") {
    const normalizedTargetIdentity = normalizeString(targetIdentity);
    if (!normalizedTargetIdentity) {
        return normalizeImportedLocalSavedReportRecords(currentRecords);
    }
    return normalizeImportedLocalSavedReportRecords(currentRecords)
        .filter((record) => buildImportedLocalSavedReportRecordIdentity(record) !== normalizedTargetIdentity);
}

export function resolveReportBuilderImportedLocalGetResponseForSavedRecord(currentResponses = [], savedRecord = null) {
    const targetIdentity = normalizeReportBuilderSavedPayloadSourceIdentity(savedRecord?.source || savedRecord);
    if (!targetIdentity) {
        return null;
    }
    return normalizeReportBuilderImportedLocalGetResponses(currentResponses)
        .find((response) => matchesReportBuilderSavedPayloadSourceIdentity(
            targetIdentity,
            normalizeReportBuilderSavedPayloadSourceIdentity(response?.source || response),
        ))
        || null;
}

export function resolveReportBuilderImportedLocalSavedRecordForGetResponse(currentRecords = [], response = null) {
    const targetIdentity = normalizeReportBuilderSavedPayloadSourceIdentity(response?.source || response);
    if (!targetIdentity) {
        return null;
    }
    return normalizeImportedLocalSavedReportRecords(currentRecords)
        .find((record) => matchesReportBuilderSavedPayloadSourceIdentity(
            targetIdentity,
            normalizeReportBuilderSavedPayloadSourceIdentity(record?.source || record),
        ))
        || null;
}

export function resolveImportedLocalSavedRecordActivationResponse({
    importedLocalGetReportDocumentResponses = [],
    savedRecord = null,
} = {}) {
    const matchingImportedGetResponse = resolveReportBuilderImportedLocalGetResponseForSavedRecord(
        importedLocalGetReportDocumentResponses,
        savedRecord,
    );
    if (matchingImportedGetResponse) {
        return matchingImportedGetResponse;
    }
    const normalizedRecord = normalizeReportBuilderSavedReportRecord(savedRecord);
    const documentVersion = Number(normalizedRecord?.documentVersion || 0) || 0;
    if (normalizedRecord?.savedReportPayload && documentVersion > 0) {
        return buildReportBuilderGetReportDocumentResponse(normalizedRecord.savedReportPayload, {
            documentVersion,
            savedAt: normalizedRecord?.savedAt,
        });
    }
    return null;
}

export function resolveImportedLocalSavedRecordRemovalEffect({
    currentGetReportDocumentResponse = null,
    importedLocalGetReportDocumentResponses = [],
    removedSavedRecord = null,
} = {}) {
    const currentBackedResponse = currentGetReportDocumentResponse
        ? resolveReportBuilderImportedLocalGetResponseForSavedRecord([currentGetReportDocumentResponse], removedSavedRecord)
        : null;
    const independentlyTrackedResponse = resolveReportBuilderImportedLocalGetResponseForSavedRecord(
        importedLocalGetReportDocumentResponses,
        removedSavedRecord,
    );
    return {
        clearCurrentGetResponse: !!currentBackedResponse && !independentlyTrackedResponse,
    };
}

export function normalizeReportBuilderImportedArtifactState(state = {}) {
    const source = state && typeof state === "object" && !Array.isArray(state) ? state : {};
    return {
        importedStandaloneReportFill: source.importedStandaloneReportFill && typeof source.importedStandaloneReportFill === "object" && !Array.isArray(source.importedStandaloneReportFill)
            ? cloneValue(source.importedStandaloneReportFill)
            : null,
        importedStandaloneReportFillOpen: source.importedStandaloneReportFillOpen === true,
        importedPipelineCompanionFillAttached: source.importedPipelineCompanionFillAttached === true,
        importedStandaloneReportPrint: source.importedStandaloneReportPrint && typeof source.importedStandaloneReportPrint === "object" && !Array.isArray(source.importedStandaloneReportPrint)
            ? cloneValue(source.importedStandaloneReportPrint)
            : null,
        importedStandaloneReportPrintOpen: source.importedStandaloneReportPrintOpen === true,
        importedStandaloneExportRequest: source.importedStandaloneExportRequest && typeof source.importedStandaloneExportRequest === "object" && !Array.isArray(source.importedStandaloneExportRequest)
            ? cloneValue(source.importedStandaloneExportRequest)
            : null,
        importedPipelinePreview: source.importedPipelinePreview && typeof source.importedPipelinePreview === "object" && !Array.isArray(source.importedPipelinePreview)
            ? cloneValue(source.importedPipelinePreview)
            : null,
        importedPipelineInspectorSection: normalizeString(source.importedPipelineInspectorSection),
        localSavedReportPayloadPresent: source.localSavedReportPayloadPresent === true,
        localSavedReportRecordPresent: source.localSavedReportRecordPresent === true,
        localGetReportDocumentResponsePresent: source.localGetReportDocumentResponsePresent === true,
    };
}

export function resolveReportBuilderImportedArtifactImportPreservation(imported = null, currentState = {}) {
    const current = normalizeReportBuilderImportedArtifactState(currentState);
    const kind = normalizeString(imported?.kind);
    return {
        preserveStandaloneReportFill: kind === "reportSpec" && !!current.importedStandaloneReportFill,
        preservePipelinePreview: kind === "reportFill" && !!current.importedPipelinePreview,
        preserveSavedReportPayload: kind === "listReportDocumentsResponse" && current.localSavedReportPayloadPresent === true,
        preserveSavedReportRecord: kind === "listReportDocumentsResponse" && current.localSavedReportRecordPresent === true,
        preserveGetReportDocumentResponse: kind === "listReportDocumentsResponse" && current.localGetReportDocumentResponsePresent === true,
    };
}

export function resolveReportBuilderImportedArtifactStateAfterImport(currentState = {}, imported = null) {
    const current = normalizeReportBuilderImportedArtifactState(currentState);
    const kind = normalizeString(imported?.kind);
    const preservation = resolveReportBuilderImportedArtifactImportPreservation(imported, current);
    const nextState = {
        importedStandaloneReportFill: preservation.preserveStandaloneReportFill
            ? cloneValue(current.importedStandaloneReportFill)
            : null,
        importedStandaloneReportFillOpen: false,
        importedPipelineCompanionFillAttached: false,
        importedStandaloneReportPrint: null,
        importedStandaloneReportPrintOpen: false,
        importedStandaloneExportRequest: null,
        importedPipelinePreview: preservation.preservePipelinePreview
            ? cloneValue(current.importedPipelinePreview)
            : null,
        importedPipelineInspectorSection: "",
    };
    if (!imported || typeof imported !== "object" || Array.isArray(imported) || !kind) {
        return nextState;
    }
    if (kind === "reportFill") {
        nextState.importedStandaloneReportFill = cloneValue(imported.payload || null);
    } else if (kind === "reportPrint") {
        nextState.importedStandaloneReportPrint = cloneValue(imported.payload || null);
    } else if (kind === "reportExportRequest") {
        nextState.importedStandaloneExportRequest = cloneValue(imported.payload || null);
    } else if (kind === "reportSpec") {
        nextState.importedPipelinePreview = cloneValue(imported);
    }
    return nextState;
}

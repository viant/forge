import {
    buildReportDocumentCompileState,
    buildReportDocumentRef,
} from "../../reporting/reportDocumentStore.js";
import { extractReportDocumentTemplateIdentity } from "../../reporting/reportDocumentModel.js";
import { buildReportBuilderDocumentCompileDiagnostics } from "./reportBuilderDocumentBlocks.js";
import {
    resolveEmbeddedReportDocumentCompileState,
} from "./reportBuilderImportedDocumentMetadata.js";
import { resolveNormalizedReportSpecDocumentContext } from "./reportBuilderSavedRecordMetadataContext.js";
import { extractSavedViewOverlayArtifactState } from "../../reporting/views/savedViewOverlayModel.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function extractSavedPayloadTemplateIdentity(payload = null) {
    const explicitTemplateIdentity = extractReportDocumentTemplateIdentity(payload?.reportDocument || payload?.document || null);
    if (explicitTemplateIdentity) {
        return explicitTemplateIdentity;
    }
    const sourceTemplateId = normalizeString(payload?.sourceSession?.sourceRef?.templateId);
    const sourceTemplateLabel = normalizeString(payload?.sourceSession?.sourceRef?.templateLabel);
    if (sourceTemplateId || sourceTemplateLabel) {
        return {
            ...(sourceTemplateId ? { templateId: sourceTemplateId } : {}),
            ...(sourceTemplateLabel ? { templateLabel: sourceTemplateLabel } : {}),
        };
    }
    return null;
}

function normalizeTimestamp(value, fallback = Date.now()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

export function normalizeReportBuilderSavedPayloadSourceIdentity(value = null) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const source = value?.source && typeof value.source === "object" && !Array.isArray(value.source)
        ? value.source
        : value;
    const payloadId = normalizeString(source?.payloadId || value?.payloadId);
    const sourceArtifactId = normalizeString(source?.sourceArtifactId || value?.sourceArtifactId);
    const kind = normalizeString(source?.kind || source?.artifactKind || value?.kind || value?.artifactKind);
    const reportId = normalizeString(
        source?.reportId
        || value?.reportRef?.reportId
        || value?.reportDocument?.id
        || value?.document?.id
        || value?.reportId,
    );
    if (!payloadId && !sourceArtifactId && !reportId && !kind) {
        return null;
    }
    return {
        ...(kind ? { kind } : {}),
        payloadId,
        sourceArtifactId,
        reportId,
    };
}

export function matchesReportBuilderSavedPayloadSourceIdentity(expected = null, actual = null) {
    if (!expected || !actual) {
        return false;
    }
    const expectedPayloadId = normalizeString(expected?.payloadId);
    const actualPayloadId = normalizeString(actual?.payloadId);
    const expectedKind = normalizeString(expected?.kind || expected?.artifactKind);
    const actualKind = normalizeString(actual?.kind || actual?.artifactKind);
    if (expectedPayloadId || actualPayloadId) {
        return expectedPayloadId
            && actualPayloadId
            && expectedPayloadId === actualPayloadId
            && (!expectedKind || !actualKind || expectedKind === actualKind);
    }
    return normalizeString(expected?.sourceArtifactId) === normalizeString(actual?.sourceArtifactId)
        && (!expectedKind || !actualKind || expectedKind === actualKind)
        && normalizeString(expected?.reportId) === normalizeString(actual?.reportId);
}

function buildSavedReportPayloadSource(savedReportPayload = null) {
    if (!savedReportPayload || typeof savedReportPayload !== "object" || Array.isArray(savedReportPayload)) {
        return null;
    }
    const source = {
        kind: normalizeString(savedReportPayload?.kind) || "reportBuilder.savedReportPayload",
    };
    const payloadId = normalizeString(savedReportPayload?.payloadId);
    const sourceArtifactId = normalizeString(savedReportPayload?.sourceArtifactId);
    if (payloadId) {
        source.payloadId = payloadId;
    }
    if (sourceArtifactId) {
        source.sourceArtifactId = sourceArtifactId;
    }
    return source;
}

export function normalizeReportBuilderSavedReportRecord(record = null, {
    documentVersion = 0,
    savedAt = Date.now(),
} = {}) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
        return null;
    }
    if (
        normalizeString(record?.reportId)
        && record?.document && typeof record.document === "object" && !Array.isArray(record.document)
        && record?.source && typeof record.source === "object" && !Array.isArray(record.source)
    ) {
        const sourceIdentity = normalizeReportBuilderSavedPayloadSourceIdentity(record?.source || record);
        const savedViewOverlay = extractSavedViewOverlayArtifactState(
            normalizeString(record?.source?.kind) === "reportBuilder.savedView"
                ? record
                : null,
        );
        return {
            ...cloneValue(record),
            sourceIdentity,
            exportable: !!record?.exportRequest,
            ...(savedViewOverlay ? { savedViewOverlay } : {}),
        };
    }
    const savedReportPayload = record?.savedReportPayload && typeof record.savedReportPayload === "object" && !Array.isArray(record.savedReportPayload)
        ? record.savedReportPayload
        : (normalizeString(record?.kind) === "reportBuilder.savedReportPayload" ? record : null);
    if (!savedReportPayload) {
        return null;
    }
    const context = resolveNormalizedReportSpecDocumentContext({
        reportSpec: savedReportPayload?.reportSpec || null,
        document: savedReportPayload?.reportDocument || null,
        title: savedReportPayload?.title || "",
    });
    const reportSpec = context?.reportSpec ? cloneValue(context.reportSpec) : null;
    const document = context?.document ? cloneValue(context.document) : null;
    const reportRef = buildReportDocumentRef(document);
    if (!document || !reportRef) {
        return null;
    }
    const compileState = savedReportPayload?.compileState && typeof savedReportPayload.compileState === "object" && !Array.isArray(savedReportPayload.compileState)
        ? cloneValue(savedReportPayload.compileState)
        : (
            resolveEmbeddedReportDocumentCompileState(document, reportSpec)
            || buildReportDocumentCompileState(reportSpec, {
                diagnostics: buildReportBuilderDocumentCompileDiagnostics({
                    document,
                }),
            })
        );
    const normalizedVersion = Number(record?.documentVersion ?? savedReportPayload?.documentVersion ?? documentVersion) || 0;
    const source = buildSavedReportPayloadSource(savedReportPayload);
    const sourceIdentity = normalizeReportBuilderSavedPayloadSourceIdentity(savedReportPayload);
    const importedArtifactKind = normalizeString(record?.importedArtifactKind);
    return {
        reportId: reportRef.reportId,
        title: normalizeString(document?.title || reportRef.reportId),
        documentVersion: normalizedVersion,
        savedAt: normalizeTimestamp(record?.savedAt ?? savedReportPayload?.savedAt, savedAt),
        document,
        reportSpec,
        compileState,
        source,
        sourceIdentity,
        savedReportPayload: cloneValue(savedReportPayload),
        ...(record?.exportRequest && typeof record.exportRequest === "object" && !Array.isArray(record.exportRequest)
            ? { exportRequest: cloneValue(record.exportRequest) }
            : {}),
        exportable: !!record?.exportRequest,
        ...(importedArtifactKind ? { importedArtifactKind } : {}),
        ...(extractSavedPayloadTemplateIdentity(savedReportPayload) || {}),
    };
}

export function normalizeReportBuilderSavedReportRecords(records = null, options = {}) {
    return (Array.isArray(records) ? records : [records])
        .map((record) => normalizeReportBuilderSavedReportRecord(record, options))
        .filter(Boolean);
}

export function resolveReportBuilderSavedReportRecordByReportId(records = null, reportId = "") {
    const normalizedReportId = normalizeString(reportId);
    if (!normalizedReportId) {
        return null;
    }
    return normalizeReportBuilderSavedReportRecords(records)
        .filter((record) => normalizeString(record?.reportId) === normalizedReportId)
        .sort((left, right) => Number(right?.exportable === true) - Number(left?.exportable === true))[0]
        || null;
}

export function resolveReportBuilderSavedReportRecordBySource(records = null, source = null) {
    const targetIdentity = normalizeReportBuilderSavedPayloadSourceIdentity(source);
    if (!targetIdentity) {
        return null;
    }
    return normalizeReportBuilderSavedReportRecords(records)
        .filter((record) => matchesReportBuilderSavedPayloadSourceIdentity(targetIdentity, record?.sourceIdentity))
        .sort((left, right) => Number(right?.exportable === true) - Number(left?.exportable === true))[0]
        || null;
}

export function matchesReportBuilderSavedReportRecordSource(left = null, right = null) {
    const leftIdentity = normalizeReportBuilderSavedPayloadSourceIdentity(left?.source || left);
    const rightIdentity = normalizeReportBuilderSavedPayloadSourceIdentity(right?.source || right);
    if (!leftIdentity || !rightIdentity) {
        return false;
    }
    if (!matchesReportBuilderSavedPayloadSourceIdentity(leftIdentity, rightIdentity)) {
        return false;
    }
    const leftReportId = normalizeString(
        left?.reportId
        || leftIdentity?.reportId
        || left?.reportRef?.reportId
        || left?.document?.id
        || left?.reportDocument?.id,
    );
    const rightReportId = normalizeString(
        right?.reportId
        || rightIdentity?.reportId
        || right?.reportRef?.reportId
        || right?.document?.id
        || right?.reportDocument?.id,
    );
    if (leftReportId && rightReportId && leftReportId !== rightReportId) {
        return false;
    }
    return true;
}

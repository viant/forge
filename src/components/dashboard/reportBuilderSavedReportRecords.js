import {
    buildReportDocumentCompileState,
    buildReportDocumentRef,
} from "../../reporting/reportDocumentStore.js";
import { buildReportBuilderDocumentCompileDiagnostics } from "./reportBuilderDocumentBlocks.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
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

function extractSavedPayloadTemplateIdentity(payload = null) {
    const sourceTemplateId = normalizeString(payload?.sourceSession?.sourceRef?.templateId);
    const sourceTemplateLabel = normalizeString(payload?.sourceSession?.sourceRef?.templateLabel);
    if (sourceTemplateId || sourceTemplateLabel) {
        return {
            ...(sourceTemplateId ? { templateId: sourceTemplateId } : {}),
            ...(sourceTemplateLabel ? { templateLabel: sourceTemplateLabel } : {}),
        };
    }
    return extractReportDocumentTemplateIdentity(payload?.reportDocument || payload?.document || null);
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
    const reportId = normalizeString(
        source?.reportId
        || value?.reportRef?.reportId
        || value?.reportDocument?.id
        || value?.document?.id
        || value?.reportId,
    );
    if (!payloadId && !sourceArtifactId && !reportId) {
        return null;
    }
    return {
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
    if (expectedPayloadId || actualPayloadId) {
        return expectedPayloadId && actualPayloadId && expectedPayloadId === actualPayloadId;
    }
    return normalizeString(expected?.sourceArtifactId) === normalizeString(actual?.sourceArtifactId)
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
        return {
            ...cloneValue(record),
            sourceIdentity,
            exportable: !!record?.exportRequest,
        };
    }
    const savedReportPayload = record?.savedReportPayload && typeof record.savedReportPayload === "object" && !Array.isArray(record.savedReportPayload)
        ? record.savedReportPayload
        : (normalizeString(record?.kind) === "reportBuilder.savedReportPayload" ? record : null);
    if (!savedReportPayload) {
        return null;
    }
    const document = savedReportPayload?.reportDocument && typeof savedReportPayload.reportDocument === "object" && !Array.isArray(savedReportPayload.reportDocument)
        ? cloneValue(savedReportPayload.reportDocument)
        : null;
    const reportSpec = savedReportPayload?.reportSpec && typeof savedReportPayload.reportSpec === "object" && !Array.isArray(savedReportPayload.reportSpec)
        ? cloneValue(savedReportPayload.reportSpec)
        : null;
    const reportRef = buildReportDocumentRef(document);
    if (!document || !reportRef) {
        return null;
    }
    const compileState = savedReportPayload?.compileState && typeof savedReportPayload.compileState === "object" && !Array.isArray(savedReportPayload.compileState)
        ? cloneValue(savedReportPayload.compileState)
        : buildReportDocumentCompileState(reportSpec, {
            diagnostics: buildReportBuilderDocumentCompileDiagnostics({
                document,
            }),
        });
    const normalizedVersion = Number(record?.documentVersion ?? savedReportPayload?.documentVersion ?? documentVersion) || 0;
    const source = buildSavedReportPayloadSource(savedReportPayload);
    const sourceIdentity = normalizeReportBuilderSavedPayloadSourceIdentity(savedReportPayload);
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

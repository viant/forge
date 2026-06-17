import {
    resolveReportBuilderSavedReportRecordBySource,
    normalizeReportBuilderSavedReportRecord,
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

export function resolveReportBuilderExportHandler(builderContext = {}) {
    const candidate = builderContext?.handlers?.reportExport || null;
    return typeof candidate?.submitRequest === "function" ? candidate : null;
}

export function resolveReportBuilderSavedPayloadExportRequest(savedReportPayload = null, localSavedPayloads = []) {
    const directRecord = normalizeReportBuilderSavedReportRecord(savedReportPayload);
    if (directRecord?.exportRequest) {
        return cloneValue(directRecord.exportRequest);
    }
    const matchingRecord = resolveReportBuilderSavedReportRecordBySource(localSavedPayloads, savedReportPayload);
    return matchingRecord?.exportRequest ? cloneValue(matchingRecord.exportRequest) : null;
}

export function resolveReportBuilderSavedPayloadExportRequestBySource(source = null, localSavedPayloads = []) {
    const matchingRecord = resolveReportBuilderSavedReportRecordBySource(localSavedPayloads, source);
    return matchingRecord?.exportRequest ? cloneValue(matchingRecord.exportRequest) : null;
}

export function buildReportBuilderExportRequestSummary(request = null) {
    if (!request || typeof request !== "object" || Array.isArray(request)) {
        return null;
    }
    const format = normalizeString(request?.target?.format).toUpperCase();
    const title = normalizeString(request?.source?.title || request?.reportSpec?.title || "Report");
    const artifactRef = normalizeString(request?.source?.artifactRef);
    const from = normalizeString(request?.source?.from);
    if (!format || !title || !artifactRef || !from) {
        return null;
    }
    return {
        title,
        format,
        from,
        artifactRef,
        payloadId: normalizeString(request?.source?.payloadId),
        reportId: normalizeString(request?.source?.reportId),
        documentVersion: Number(request?.source?.documentVersion || 0) || 0,
        hasReportPrint: !!request?.reportPrint,
    };
}

export function serializeReportBuilderExportRequest(request = null, {
    pretty = true,
} = {}) {
    if (!request || typeof request !== "object" || Array.isArray(request)) {
        return "";
    }
    return pretty === false
        ? JSON.stringify(request)
        : JSON.stringify(request, null, 2);
}

export function buildReportBuilderExportRequestInspectorState(request = null) {
    const summary = buildReportBuilderExportRequestSummary(request);
    if (!summary) {
        return null;
    }
    return {
        ...summary,
        content: serializeReportBuilderExportRequest(request),
    };
}

export function buildReportBuilderExportRequestDownload(request = null) {
    const summary = buildReportBuilderExportRequestSummary(request);
    if (!summary) {
        return null;
    }
    const baseTitle = sanitizeFilenameSegment(summary.title || "report");
    const from = sanitizeFilenameSegment(summary.from || "export");
    const format = sanitizeFilenameSegment(String(summary.format || "").toLowerCase() || "export");
    return {
        filename: `${baseTitle}-${from}-${format}-export-request.json`,
        mimeType: "application/json;charset=utf-8",
        payload: serializeReportBuilderExportRequest(request),
    };
}

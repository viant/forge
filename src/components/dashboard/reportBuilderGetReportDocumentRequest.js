import { buildGetReportDocumentRequest } from "../../reporting/reportDocumentStore.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function sanitizeFilenameSegment(value = "") {
    return normalizeString(value).replace(/[\\/:*?"<>|]+/g, "-");
}

export function buildReportBuilderGetReportDocumentRequest(listResponse = null, {
    entryReportId = "",
} = {}) {
    const targetReportId = normalizeString(entryReportId);
    if (!targetReportId) {
        return null;
    }
    const entries = Array.isArray(listResponse?.entries) ? listResponse.entries : [];
    const entry = entries.find((candidate) => normalizeString(candidate?.reportRef?.reportId) === targetReportId) || null;
    if (!entry) {
        return null;
    }
    return buildGetReportDocumentRequest({
        reportId: targetReportId,
    });
}

function normalizeMetadataContext(context = null) {
    if (!context || typeof context !== "object" || Array.isArray(context)) {
        return null;
    }
    const title = normalizeString(context?.title);
    const subtitle = normalizeString(context?.subtitle);
    const description = normalizeString(context?.description);
    if (!title && !subtitle && !description) {
        return null;
    }
    return {
        ...(title ? { title } : {}),
        ...(subtitle ? { subtitle } : {}),
        ...(description ? { description } : {}),
    };
}

export function buildReportBuilderGetReportDocumentRequestSummary(request = null, {
    metadata = null,
} = {}) {
    if (!request || typeof request !== "object" || Array.isArray(request)) {
        return null;
    }
    const normalizedMetadata = normalizeMetadataContext(metadata);
    return {
        kind: normalizeString(request?.kind),
        reportId: normalizeString(request?.reportRef?.reportId),
        ...(normalizedMetadata?.title ? { title: normalizedMetadata.title } : {}),
        ...(normalizedMetadata?.subtitle ? { subtitle: normalizedMetadata.subtitle } : {}),
        ...(normalizedMetadata?.description ? { description: normalizedMetadata.description } : {}),
    };
}

export function serializeReportBuilderGetReportDocumentRequest(request = null, {
    pretty = true,
} = {}) {
    if (!request || typeof request !== "object" || Array.isArray(request)) {
        return "";
    }
    return pretty === false
        ? JSON.stringify(request)
        : JSON.stringify(request, null, 2);
}

export function buildReportBuilderGetReportDocumentRequestInspectorState(request = null, {
    metadata = null,
} = {}) {
    const summary = buildReportBuilderGetReportDocumentRequestSummary(request, { metadata });
    if (!summary) {
        return null;
    }
    return {
        ...summary,
        ...(summary.subtitle ? { headerSubtitle: summary.subtitle } : {}),
        ...(summary.description ? { headerDescription: summary.description } : {}),
        content: serializeReportBuilderGetReportDocumentRequest(request),
    };
}

export function buildReportBuilderGetReportDocumentRequestDownload(request = null, {
    metadata = null,
} = {}) {
    const summary = buildReportBuilderGetReportDocumentRequestSummary(request, { metadata });
    if (!summary) {
        return null;
    }
    const content = serializeReportBuilderGetReportDocumentRequest(request);
    if (!content) {
        return null;
    }
    const normalizedReportId = sanitizeFilenameSegment(summary.title || summary.reportId || "report-document") || "report-document";
    return {
        filename: `${normalizedReportId}-get-report-document-request.json`,
        mimeType: "application/json;charset=utf-8",
        payload: content,
    };
}

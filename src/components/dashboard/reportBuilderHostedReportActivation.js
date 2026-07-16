import { buildReportBuilderGetReportDocumentResponse } from "./reportBuilderReportDocumentReadResponse.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function normalizeVersion(value = 0) {
    const version = Math.trunc(Number(value));
    return Number.isSafeInteger(version) && version > 0 ? version : 1;
}

function normalizeTimestamp(value = "") {
    const timestamp = Date.parse(String(value || ""));
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
}

export function resolveHostedReportId(container = null) {
    return normalizeString(container?.parameters?.reportId);
}

export function buildHostedReportActivationRequest(reportId = "") {
    const normalizedReportId = normalizeString(reportId);
    return normalizedReportId ? { reportId: normalizedReportId } : null;
}

export function buildHostedReportActivationResponse(result = null) {
    if (!result || typeof result !== "object" || Array.isArray(result)) {
        return null;
    }
    return buildReportBuilderGetReportDocumentResponse(result, {
        documentVersion: normalizeVersion(result?.version || result?.documentVersion),
        savedAt: normalizeTimestamp(result?.updatedAt || result?.createdAt),
    });
}

import { buildReportBuilderGetReportDocumentResponse } from "./reportBuilderReportDocumentReadResponse.js";
import { compileInlineReportDefinition } from "../../reporting/inlineReportCompiler.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeVersion(value = 0) {
    const version = Math.trunc(Number(value));
    return Number.isSafeInteger(version) && version > 0 ? version : 1;
}

function normalizeTimestamp(value = "") {
    const timestamp = Date.parse(String(value || ""));
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
}

export function normalizeHostedReportSourceKind(value = "") {
    const normalized = normalizeString(value).toLowerCase();
    if (["preset", "starter"].includes(normalized)) {
        return "preset";
    }
    if (["report", "saved", "savedreport"].includes(normalized)) {
        return "report";
    }
    if (["inline", "draft", "materialized"].includes(normalized)) {
        return "inline";
    }
    return "";
}

export function resolveHostedReportSource(container = null) {
    const parameters = container?.parameters || {};
    const canonicalKindValue = normalizeString(parameters.sourceKind);
    const canonicalKind = normalizeHostedReportSourceKind(parameters.sourceKind);
    const canonicalId = normalizeString(parameters.sourceId);
    if (canonicalKind) {
        return { kind: canonicalKind, id: canonicalId };
    }
    if (canonicalKindValue) {
        return { kind: "", id: "" };
    }

    const reportId = normalizeString(parameters.reportId);
    if (reportId) {
        return { kind: "report", id: reportId };
    }
    const reportStarterId = normalizeString(parameters.reportStarterId);
    if (reportStarterId) {
        return { kind: "preset", id: reportStarterId };
    }
    if (parameters.reportDefinition && typeof parameters.reportDefinition === "object") {
        return {
            kind: "inline",
            id: normalizeString(parameters.reportDefinition.id),
        };
    }
    return { kind: "", id: "" };
}

export function resolveHostedReportId(container = null) {
    const source = resolveHostedReportSource(container);
    return source.kind === "report" ? source.id : "";
}

export function resolveHostedReportStarterId(container = null) {
    const source = resolveHostedReportSource(container);
    return source.kind === "preset" ? source.id : "";
}

export function resolveHostedReportWorkspaceMode(container = null) {
    const canonicalMode = normalizeString(container?.parameters?.mode).toLowerCase();
    if (canonicalMode === "result") {
        return "report";
    }
    if (canonicalMode === "design") {
        return "design";
    }
    return normalizeString(container?.parameters?.workspaceMode);
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

export function buildHostedInlineReportActivation(container = null, builderTarget = null) {
    const source = resolveHostedReportSource(container);
    if (source.kind !== "inline") {
        return { key: "", response: null, message: "" };
    }
    const definition = container?.parameters?.reportDefinition;
    const key = JSON.stringify({
        id: source.id,
        definition: definition || null,
    });
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
        return {
            key,
            response: null,
            message: "Inline reportDefinition is required to open this report in the builder.",
        };
    }
    try {
        const compiled = compileInlineReportDefinition(definition, {
            fallbackReportId: source.id || "inlineReport",
            builderTarget: builderTarget || {
                containerId: normalizeString(container?.id),
                stateKey: normalizeString(container?.stateKey || container?.id || "reportBuilder") || "reportBuilder",
                dataSourceRef: normalizeString(container?.dataSourceRef),
            },
        });
        const reportId = normalizeString(compiled?.reportDocument?.id || source.id || "inlineReport") || "inlineReport";
        const response = buildHostedReportActivationResponse({
            kind: "reportBuilder.savedReportPayload",
            reportId,
            title: normalizeString(compiled?.reportDocument?.title || reportId) || reportId,
            version: 1,
            documentVersion: 1,
            createdAt: new Date().toISOString(),
            reportDocument: compiled.reportDocument,
            reportSpec: compiled.reportSpec,
            compileState: {
                status: "clean",
                source: "inline",
                diagnostics: Array.isArray(compiled?.diagnostics) ? cloneValue(compiled.diagnostics) : [],
            },
            source: {
                kind: "inline",
                sourceArtifactId: source.id || reportId,
            },
        });
        return {
            key,
            response: response ? { ...response, reportSpec: cloneValue(compiled.reportSpec) } : null,
            message: response ? "" : "Inline reportDefinition could not be normalized for the builder.",
        };
    } catch (error) {
        return {
            key,
            response: null,
            message: normalizeString(error?.message || error) || "Inline reportDefinition could not be compiled.",
        };
    }
}

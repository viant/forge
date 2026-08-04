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
    const inlineDefinition = parameters.reportDefinition
        && typeof parameters.reportDefinition === "object"
        && !Array.isArray(parameters.reportDefinition)
        ? parameters.reportDefinition
        : null;
    const inlineDefinitionId = normalizeString(
        inlineDefinition?.id
        || inlineDefinition?.source?.id,
    );
    const canonicalKindValue = normalizeString(parameters.sourceKind);
    const canonicalKind = normalizeHostedReportSourceKind(parameters.sourceKind);
    const canonicalId = normalizeString(parameters.sourceId);
    if (canonicalKind) {
        return {
            kind: canonicalKind,
            id: canonicalId || (canonicalKind === "inline" ? inlineDefinitionId : ""),
        };
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
    if (inlineDefinition) {
        return {
            kind: "inline",
            id: inlineDefinitionId,
        };
    }
    return { kind: "", id: "" };
}

export function resolveHostedReportExecutionIdentity(container = null, state = null) {
    const sourceId = resolveHostedReportSource(container).id;
    if (sourceId) {
        return sourceId;
    }
    const parameters = container?.parameters || {};
    const hasDeclaredSource = !!normalizeString(parameters.sourceKind)
        || !!normalizeString(parameters.reportId)
        || !!normalizeString(parameters.reportStarterId)
        || (!!parameters.reportDefinition
            && typeof parameters.reportDefinition === "object"
            && !Array.isArray(parameters.reportDefinition));
    return hasDeclaredSource
        ? ""
        : normalizeString(state?.reportDocumentTemplateId);
}

export function resolveHostedReportId(container = null) {
    const source = resolveHostedReportSource(container);
    return source.kind === "report" ? source.id : "";
}

export function resolveHostedReportArtifactId(container = null) {
    const source = resolveHostedReportSource(container);
    if (source.kind !== "report") {
        return "";
    }
    return normalizeString(container?.parameters?.artifactId);
}

export function resolveHostedReportStarterId(container = null) {
    const source = resolveHostedReportSource(container);
    return source.kind === "preset" ? source.id : "";
}

export function resolveHostedReportActivationIdentity(container = null) {
    const source = resolveHostedReportSource(container);
    if (source.kind === "report") {
        const request = buildHostedReportActivationRequest(
            source.id,
            resolveHostedReportArtifactId(container),
        );
        return normalizeString(request?.artifactId || request?.reportId);
    }
    return source.kind === "inline" ? source.id : "";
}

export function matchesHostedReportActivationCurrent({
    activationRequired = false,
    activationIdentity = "",
    activationState = null,
} = {}) {
    if (activationRequired !== true) {
        return true;
    }
    const requiredIdentity = normalizeString(activationIdentity);
    return !!requiredIdentity
        && normalizeString(activationState?.reportId) === requiredIdentity
        && normalizeString(activationState?.status).toLowerCase() === "ready";
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

export function buildHostedReportActivationRequest(reportId = "", artifactId = "") {
    const normalizedArtifactId = normalizeString(artifactId);
    if (normalizedArtifactId) {
        return { artifactId: normalizedArtifactId };
    }
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

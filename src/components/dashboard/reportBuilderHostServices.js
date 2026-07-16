function normalizeString(value = "") {
    return String(value || "").trim();
}

function isPlainObject(value = null) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function resolveBearerToken(auth = {}) {
    const authProvider = normalizeString(auth?.defaultAuthProvider);
    if (!authProvider) {
        return "";
    }
    const token = auth?.authStates?.[authProvider]?.jwtToken?.id_token;
    return normalizeString(token);
}

function resolveEndpointBaseURL(endpoints = {}, endpointName = "") {
    const normalizedName = normalizeString(endpointName);
    if (normalizedName && normalizeString(endpoints?.[normalizedName]?.baseURL)) {
        return normalizeString(endpoints[normalizedName].baseURL).replace(/\/+$/, "");
    }
    const fallback = Object.values(endpoints || {}).find((entry) => normalizeString(entry?.baseURL));
    return normalizeString(fallback?.baseURL).replace(/\/+$/, "");
}

async function parseToolResponse(response) {
    const raw = await response.text();
    if (!raw) {
        return null;
    }
    try {
        const payload = JSON.parse(raw);
        // Agently's HTTP tool endpoint returns a result envelope. Reporting
        // handlers expose the tool result itself to the Report Builder domain.
        if (isPlainObject(payload) && Object.prototype.hasOwnProperty.call(payload, "result")) {
            if (typeof payload.result !== "string") {
                return payload.result;
            }
            try {
                return JSON.parse(payload.result);
            } catch (_) {
                return payload.result;
            }
        }
        return payload;
    } catch (_) {
        return raw;
    }
}

async function makeToolRequestError(response) {
    const payload = await parseToolResponse(response);
    const detail = normalizeString(
        payload?.error
        || payload?.message
        || payload?.detail
        || (typeof payload === "string" ? payload : ""),
    );
    const message = detail
        ? `${response.status} ${response.statusText}: ${detail}`
        : `${response.status} ${response.statusText}`;
    const error = new Error(message);
    error.status = response.status;
    error.statusText = response.statusText;
    error.payload = payload;
    // Keep failed HTTP tool calls on the same result contract as successful
    // calls so lifecycle handlers can recognize a terminal export job.
    error.responseEnvelope = payload;
    if (isPlainObject(payload)) {
        error.toolResult = payload;
    }
    return error;
}

async function executeTool({
    baseURL = "",
    toolName = "",
    args = {},
    conversationId = "",
    auth = {},
    prepareRequest,
    endpointName = "",
} = {}) {
    const normalizedBaseURL = normalizeString(baseURL).replace(/\/+$/, "");
    const normalizedToolName = normalizeString(toolName);
    if (!normalizedBaseURL || !normalizedToolName) {
        throw new Error("Tool endpoint and tool name are required.");
    }
    const headers = {};
    const bearer = resolveBearerToken(auth);
    if (bearer) {
        headers.Authorization = `Bearer ${bearer}`;
    }
    const queryParams = new URLSearchParams();
    const normalizedConversationId = normalizeString(conversationId);
    if (normalizedConversationId) {
        queryParams.set("conversationId", normalizedConversationId);
    }
    let url = `${normalizedBaseURL}/tools/${encodeURIComponent(normalizedToolName)}/execute`;
    let method = "POST";
    let body = isPlainObject(args) ? cloneValue(args) : {};
    if (typeof prepareRequest === "function") {
        const prepared = prepareRequest({
            dataSource: null,
            url,
            method,
            headers,
            queryParams,
            body,
            endpoints: endpointName ? { [endpointName]: { baseURL: normalizedBaseURL } } : {},
            targetContext: {},
            auth,
        }) || {};
        url = typeof prepared.url === "string" && prepared.url.trim() ? prepared.url : url;
        method = typeof prepared.method === "string" && prepared.method.trim() ? prepared.method : method;
        body = Object.prototype.hasOwnProperty.call(prepared, "body") ? prepared.body : body;
        if (prepared.headers && typeof prepared.headers === "object") {
            Object.assign(headers, prepared.headers);
        }
    }
    const finalUrl = queryParams.toString() ? `${url}?${queryParams.toString()}` : url;
    const response = await fetch(finalUrl, {
        method: String(method || "POST").toUpperCase(),
        headers: {
            ...headers,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body || {}),
        credentials: "include",
    });
    if (!response.ok) {
        throw await makeToolRequestError(response);
    }
    return parseToolResponse(response);
}

function createReportingHandlers({
    baseURL = "",
    auth = {},
    conversationId = "",
    prepareRequest,
    endpointName = "",
} = {}) {
    if (!normalizeString(baseURL)) {
        return {};
    }
    const call = (toolName, args = {}) => executeTool({
        baseURL,
        toolName,
        args,
        conversationId,
        auth,
        prepareRequest,
        endpointName,
    });
    return {
        reportExport: {
            async submitRequest({ request } = {}) {
                return call("reporting:submit_export", {
                    reportExportRequest: cloneValue(request),
                });
            },
            async getStatus({ jobId } = {}) {
                return call("reporting:get_export_status", { jobId: normalizeString(jobId) });
            },
            async getArtifact({ artifactId } = {}) {
                return call("reporting:get_artifact", { artifactId: normalizeString(artifactId) });
            },
            async listJobs({ artifactRef = "", limit = 0 } = {}) {
                return call("reporting:list_export_jobs", {
                    ...(normalizeString(artifactRef) ? { artifactRef: normalizeString(artifactRef) } : {}),
                    ...(Number(limit || 0) > 0 ? { limit: Number(limit) } : {}),
                });
            },
            async listArtifacts({ artifactRef = "", limit = 0 } = {}) {
                return call("reporting:list_export_artifacts", {
                    ...(normalizeString(artifactRef) ? { artifactRef: normalizeString(artifactRef) } : {}),
                    ...(Number(limit || 0) > 0 ? { limit: Number(limit) } : {}),
                });
            },
        },
        reportStore: {
            async saveReport(request = {}) {
                return call("reporting:save_report", cloneValue(request));
            },
            async getReport(request = {}) {
                return call("reporting:get_report", cloneValue(request));
            },
            async listReports(request = {}) {
                return call("reporting:list_reports", cloneValue(request));
            },
            async updateReport(request = {}) {
                return call("reporting:update_report", cloneValue(request));
            },
        },
        reportLifecycle: {
            async shareArtifact(request = {}) {
                return call("reporting:share_artifact", cloneValue(request));
            },
            async transitionArtifact(request = {}) {
                return call("reporting:transition_artifact", cloneValue(request));
            },
        },
        reportSharedArtifacts: {
            async listArtifacts(request = {}) {
                return call("reporting:list_shared_artifacts", cloneValue(request));
            },
            async getArtifact({ artifactId } = {}) {
                return call("reporting:get_shared_artifact", { artifactId: normalizeString(artifactId) });
            },
        },
    };
}

function mergeServiceGroup(synthesizedGroup = null, existingGroup = null) {
    const synthesized = isPlainObject(synthesizedGroup) ? synthesizedGroup : null;
    const existing = isPlainObject(existingGroup) ? existingGroup : null;
    if (!synthesized && !existing) {
        return undefined;
    }
    return {
        ...(synthesized || {}),
        ...(existing || {}),
    };
}

function hasFunctions(group = null, methodNames = []) {
    if (!isPlainObject(group)) {
        return false;
    }
    return methodNames.every((methodName) => typeof group?.[methodName] === "function");
}

function isCompleteReportExportGroup(group = null) {
    return hasFunctions(group, [
        "submitRequest",
        "getStatus",
        "getArtifact",
        "listJobs",
        "listArtifacts",
    ]);
}

function isCompleteReportStoreGroup(group = null) {
    return hasFunctions(group, [
        "saveReport",
        "getReport",
        "listReports",
        "updateReport",
    ]);
}

function isCompleteReportLifecycleGroup(group = null) {
    return hasFunctions(group, ["shareArtifact", "transitionArtifact"])
        || hasFunctions(group, ["runAction"]);
}

function isCompleteReportSharedArtifactsGroup(group = null) {
    return hasFunctions(group, ["listArtifacts", "getArtifact"]);
}

export function buildReportBuilderHostServices({
    services = {},
    endpoints = {},
    auth = {},
    endpointName = "",
    conversationId = "",
    prepareRequest,
} = {}) {
    const existing = isPlainObject(services) ? services : {};
    const hasCompleteReportingBundle = isCompleteReportExportGroup(existing.reportExport)
        && isCompleteReportStoreGroup(existing.reportStore)
        && isCompleteReportLifecycleGroup(existing.reportLifecycle)
        && isCompleteReportSharedArtifactsGroup(existing.reportSharedArtifacts);
    if (hasCompleteReportingBundle) {
        return existing;
    }
    const baseURL = resolveEndpointBaseURL(endpoints, endpointName);
    if (!baseURL) {
        return existing;
    }
    const synthesized = createReportingHandlers({
        baseURL,
        auth,
        conversationId,
        prepareRequest,
        endpointName,
    });
    return {
        ...existing,
        ...(mergeServiceGroup(synthesized.reportExport, existing.reportExport) ? { reportExport: mergeServiceGroup(synthesized.reportExport, existing.reportExport) } : {}),
        ...(mergeServiceGroup(synthesized.reportStore, existing.reportStore) ? { reportStore: mergeServiceGroup(synthesized.reportStore, existing.reportStore) } : {}),
        ...(mergeServiceGroup(synthesized.reportLifecycle, existing.reportLifecycle) ? { reportLifecycle: mergeServiceGroup(synthesized.reportLifecycle, existing.reportLifecycle) } : {}),
        ...(mergeServiceGroup(synthesized.reportSharedArtifacts, existing.reportSharedArtifacts) ? { reportSharedArtifacts: mergeServiceGroup(synthesized.reportSharedArtifacts, existing.reportSharedArtifacts) } : {}),
    };
}

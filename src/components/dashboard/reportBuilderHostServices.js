function normalizeString(value = "") {
    return String(value || "").trim();
}

function isPlainObject(value = null) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

export const REPORT_STORE_CHANGED_EVENT = "forge:report-store-changed";

function notifyReportStoreChanged(detail = {}) {
    if (typeof globalThis?.dispatchEvent !== "function" || typeof globalThis?.CustomEvent !== "function") {
        return;
    }
    globalThis.dispatchEvent(new globalThis.CustomEvent(REPORT_STORE_CHANGED_EVENT, { detail }));
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

const REPORT_RUN_BEGIN_FIELDS = [
    "conversationId",
    "origin",
    "builderRef",
    "presetId",
    "sourceKind",
    "sourceId",
    "requestedParams",
    "effectiveParams",
    "uiRunRequestId",
];
const REPORT_RUN_COMPLETE_FIELDS = [
    "reportRunId",
    "conversationId",
    "expectedRevision",
    "reportSpec",
    "reportFill",
    "reportPrint",
];
const REPORT_RUN_FAIL_FIELDS = [
    "reportRunId",
    "conversationId",
    "expectedRevision",
    "failureCode",
    "failureText",
];
const REPORT_RUN_ACTIVATE_FIELDS = [
    "reportRunId",
    "conversationId",
    "expectedRunRevision",
    "expectedContextRevision",
    "source",
];

function selectRequestFields(input = {}, fields = [], reportRunId = "") {
    const source = isPlainObject(input) ? input : {};
    const result = {};
    fields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(source, field) && source[field] !== undefined) {
            result[field] = cloneValue(source[field]);
        }
    });
    if (normalizeString(reportRunId)) {
        result.reportRunId = normalizeString(reportRunId);
    }
    return result;
}

async function parseJSONResponse(response) {
    const raw = await response.text();
    if (!normalizeString(raw)) {
        return null;
    }
    try {
        return JSON.parse(raw);
    } catch (_) {
        return raw;
    }
}

async function makeReportRunRequestError(response) {
    const payload = await parseJSONResponse(response);
    const message = typeof payload?.error === "string"
        ? payload.error
        : (typeof payload === "string" && normalizeString(payload)
            ? normalizeString(payload)
            : `report run request failed (${response.status})`);
    const error = new Error(message);
    error.status = response.status;
    error.statusText = response.statusText;
    error.payload = payload;
    return error;
}

async function executeReportRunRequest({
    baseURL = "",
    path = "",
    method = "POST",
    body = {},
    auth = {},
    prepareRequest,
    endpointName = "",
} = {}) {
    const normalizedBaseURL = normalizeString(baseURL).replace(/\/+$/, "");
    if (!normalizedBaseURL) {
        throw new Error("Report-run endpoint is required.");
    }
    const headers = { Accept: "application/json" };
    const bearer = resolveBearerToken(auth);
    if (bearer) {
        headers.Authorization = `Bearer ${bearer}`;
    }
    let requestMethod = normalizeString(method).toUpperCase() || "POST";
    const queryParams = new URLSearchParams();
    let url = `${normalizedBaseURL}/api/report-runs${path}`;
    let requestBody = isPlainObject(body) ? cloneValue(body) : {};
    if (typeof prepareRequest === "function") {
        const prepared = prepareRequest({
            dataSource: null,
            url,
            method: requestMethod,
            headers,
            queryParams,
            body: requestBody,
            endpoints: endpointName ? { [endpointName]: { baseURL: normalizedBaseURL } } : {},
            targetContext: {},
            auth,
        }) || {};
        url = typeof prepared.url === "string" && prepared.url.trim() ? prepared.url : url;
        requestMethod = typeof prepared.method === "string" && prepared.method.trim()
            ? prepared.method.trim().toUpperCase()
            : requestMethod;
        requestBody = Object.prototype.hasOwnProperty.call(prepared, "body") ? prepared.body : requestBody;
        if (prepared.headers && typeof prepared.headers === "object") {
            Object.assign(headers, prepared.headers);
        }
    }
    const finalURL = queryParams.toString() ? `${url}?${queryParams.toString()}` : url;
    const response = await fetch(finalURL, {
        method: requestMethod,
        credentials: "include",
        headers: {
            ...headers,
            ...(requestMethod === "GET" ? {} : { "Content-Type": "application/json" }),
        },
        ...(requestMethod === "GET" ? {} : { body: JSON.stringify(requestBody || {}) }),
    });
    if (!response.ok) {
        throw await makeReportRunRequestError(response);
    }
    return parseJSONResponse(response);
}

function requirePositiveRevision(value, message) {
    const revision = Number(value);
    if (!Number.isInteger(revision) || revision <= 0) {
        throw new Error(message);
    }
    return revision;
}

function requireRunResult(result, { reportRunId = "", status = "" } = {}) {
    const actualId = normalizeString(result?.reportRunId);
    const expectedId = normalizeString(reportRunId);
    const actualStatus = normalizeString(result?.status).toLowerCase();
    if (!isPlainObject(result)
        || !actualId
        || (expectedId && actualId !== expectedId)
        || (normalizeString(status) && actualStatus !== normalizeString(status).toLowerCase())) {
        throw new Error("The report-run service returned an invalid run identity or status.");
    }
    requirePositiveRevision(result.revision, "The report-run service returned an invalid run revision.");
    return result;
}

function requireContextResult(result, { reportRunId = "", conversationId = "" } = {}) {
    const expectedRunId = normalizeString(reportRunId);
    const expectedConversationId = normalizeString(conversationId);
    if (!isPlainObject(result)
        || !normalizeString(result.activeReportRunId)
        || (expectedRunId && normalizeString(result.activeReportRunId) !== expectedRunId)
        || (expectedConversationId && normalizeString(result.conversationId) !== expectedConversationId)) {
        throw new Error("The report-run service returned an invalid active context.");
    }
    requirePositiveRevision(result.revision, "The report-run service returned an invalid context revision.");
    return result;
}

function isUnmountedRouteError(error) {
    return error?.status === 404 && typeof error?.payload === "string";
}

function createReportRunHandlers({
    baseURL = "",
    auth = {},
    prepareRequest,
    endpointName = "",
} = {}) {
    if (!normalizeString(baseURL)) {
        return undefined;
    }
    const request = (path, body, options = {}) => executeReportRunRequest({
        baseURL,
        path,
        body,
        auth,
        prepareRequest,
        endpointName,
        ...options,
    });
    const transition = async (input, suffix, fields, expectedStatus) => {
        const reportRunId = normalizeString(input?.reportRunId);
        if (!reportRunId) {
            throw new Error("reportRunId is required.");
        }
        const result = await request(
            `/${encodeURIComponent(reportRunId)}/${suffix}`,
            selectRequestFields(input, fields, reportRunId),
        );
        return requireRunResult(result, { reportRunId, status: expectedStatus });
    };
    return {
        async begin(input = {}) {
            try {
                const result = await request("/begin", selectRequestFields(input, REPORT_RUN_BEGIN_FIELDS));
                if (!isPlainObject(result)) {
                    throw new Error("The report-run service returned an invalid Begin response.");
                }
                const run = requireRunResult(result?.run, { status: "running" });
                if (result.context != null) {
                    requireContextResult(result.context, {
                        conversationId: normalizeString(input?.conversationId),
                    });
                }
                return { ...result, enabled: true, run };
            } catch (error) {
                if (isUnmountedRouteError(error)) {
                    return { enabled: false };
                }
                throw error;
            }
        },
        complete(input = {}) {
            return transition(input, "complete", REPORT_RUN_COMPLETE_FIELDS, "completed");
        },
        fail(input = {}) {
            return transition(input, "fail", REPORT_RUN_FAIL_FIELDS, "failed");
        },
        async activate(input = {}) {
            const reportRunId = normalizeString(input?.reportRunId);
            const conversationId = normalizeString(input?.conversationId);
            if (!reportRunId || !conversationId) {
                throw new Error("reportRunId and conversationId are required.");
            }
            const result = await request(
                `/${encodeURIComponent(reportRunId)}/activate`,
                selectRequestFields(input, REPORT_RUN_ACTIVATE_FIELDS, reportRunId),
            );
            return requireContextResult(result, { reportRunId, conversationId });
        },
        async getContext(input = {}) {
            const conversationId = normalizeString(input?.conversationId);
            if (!conversationId) {
                throw new Error("conversationId is required.");
            }
            try {
                const context = await request(
                    `/context/${encodeURIComponent(conversationId)}`,
                    undefined,
                    { method: "GET" },
                );
                return {
                    enabled: true,
                    context: requireContextResult(context, { conversationId }),
                };
            } catch (error) {
                if (isUnmountedRouteError(error)) {
                    return { enabled: false, context: null };
                }
                if (error?.status === 404 && isPlainObject(error?.payload)) {
                    return { enabled: true, context: null };
                }
                throw error;
            }
        },
        async adopt(input = {}) {
            const reportRunId = normalizeString(input?.reportRunId);
            const conversationId = normalizeString(input?.conversationId);
            if (!reportRunId || !conversationId) {
                throw new Error("reportRunId and conversationId are required.");
            }
            try {
                const result = await request(
                    `/${encodeURIComponent(reportRunId)}/adopt`,
                    selectRequestFields(input, REPORT_RUN_ACTIVATE_FIELDS, reportRunId),
                );
                const run = requireRunResult(result?.run, { reportRunId, status: "completed" });
                const context = requireContextResult(result?.context, { reportRunId, conversationId });
                if (normalizeString(run.conversationId) !== conversationId
                    || normalizeString(run.origin).toLowerCase() !== "manual") {
                    throw new Error("The report-run service returned an invalid adopted run.");
                }
                return { ...result, run, context };
            } catch (error) {
                if (isUnmountedRouteError(error)) {
                    return { enabled: false };
                }
                throw error;
            }
        },
    };
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
            async submitSource({ source, format = "pdf", conversationId: requestedConversationId = "", workspaceId = "" } = {}) {
                return call("reporting:submit_export", {
                    source: cloneValue(source),
                    format: normalizeString(format || "pdf").toLowerCase(),
                    ...(normalizeString(requestedConversationId) ? { conversationId: normalizeString(requestedConversationId) } : {}),
                    ...(normalizeString(workspaceId) ? { workspaceId: normalizeString(workspaceId) } : {}),
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
                const result = await call("reporting:save_report", cloneValue(request));
                notifyReportStoreChanged({ action: "saved", report: result });
                return result;
            },
            async getReport(request = {}) {
                return call("reporting:get_report", cloneValue(request));
            },
            async listReports(request = {}) {
                return call("reporting:list_reports", cloneValue(request));
            },
            async updateReport(request = {}) {
                const result = await call("reporting:update_report", cloneValue(request));
                notifyReportStoreChanged({ action: "updated", report: result });
                return result;
            },
            async duplicateReport(request = {}) {
                const result = await call("reporting:duplicate_report", cloneValue(request));
                notifyReportStoreChanged({ action: "duplicated", report: result });
                return result;
            },
            async deleteReport(request = {}) {
                const result = await call("reporting:delete_report", cloneValue(request));
                notifyReportStoreChanged({ action: "deleted", ...result });
                return result;
            },
            async recordReportRun(request = {}) {
                const result = await call("reporting:record_report_run", cloneValue(request));
                notifyReportStoreChanged({ action: "ran", report: result });
                return result;
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
        "submitSource",
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
        "duplicateReport",
        "deleteReport",
        "recordReportRun",
    ]);
}

function isCompleteReportLifecycleGroup(group = null) {
    return hasFunctions(group, ["shareArtifact", "transitionArtifact"])
        || hasFunctions(group, ["runAction"]);
}

function isCompleteReportSharedArtifactsGroup(group = null) {
    return hasFunctions(group, ["listArtifacts", "getArtifact"]);
}

function isCompleteReportRunsGroup(group = null) {
    return hasFunctions(group, ["begin", "complete", "fail", "activate", "getContext", "adopt"]);
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
        && isCompleteReportSharedArtifactsGroup(existing.reportSharedArtifacts)
        && isCompleteReportRunsGroup(existing.reportRuns);
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
    const synthesizedReportRuns = createReportRunHandlers({
        baseURL,
        auth,
        prepareRequest,
        endpointName,
    });
    return {
        ...existing,
        ...(mergeServiceGroup(synthesized.reportExport, existing.reportExport) ? { reportExport: mergeServiceGroup(synthesized.reportExport, existing.reportExport) } : {}),
        ...(mergeServiceGroup(synthesized.reportStore, existing.reportStore) ? { reportStore: mergeServiceGroup(synthesized.reportStore, existing.reportStore) } : {}),
        ...(mergeServiceGroup(synthesized.reportLifecycle, existing.reportLifecycle) ? { reportLifecycle: mergeServiceGroup(synthesized.reportLifecycle, existing.reportLifecycle) } : {}),
        ...(mergeServiceGroup(synthesized.reportSharedArtifacts, existing.reportSharedArtifacts) ? { reportSharedArtifacts: mergeServiceGroup(synthesized.reportSharedArtifacts, existing.reportSharedArtifacts) } : {}),
        ...(mergeServiceGroup(synthesizedReportRuns, existing.reportRuns) ? { reportRuns: mergeServiceGroup(synthesizedReportRuns, existing.reportRuns) } : {}),
    };
}

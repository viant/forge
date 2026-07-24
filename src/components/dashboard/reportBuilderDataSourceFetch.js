import {
    isReportDatasetMCPSource,
    normalizeReportDatasetSource,
    resolveReportDatasetSourceToolName,
} from "../../reporting/reportDatasetSourceModel.js";
import { resolveReportDatasetFetchResult } from "../../reporting/reportDatasetResultContract.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeStringList(values = []) {
    return (Array.isArray(values) ? values : []).map((entry) => normalizeString(entry)).filter(Boolean);
}

function parseJSONSafe(value = "") {
    const text = normalizeString(value);
    if (!text) {
        return null;
    }
    if (!(text.startsWith("{") && text.endsWith("}")) && !(text.startsWith("[") && text.endsWith("]"))) {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch (_) {
        return null;
    }
}

function isMissingDataSourceContextError(error = null, dataSourceRef = "") {
    if (!error || typeof error !== "object") {
        return false;
    }
    const normalizedDataSourceRef = normalizeString(dataSourceRef);
    if (normalizeString(error?.code) === "DataSourceNotFound") {
        return !normalizedDataSourceRef || normalizeString(error?.dataSourceRef) === normalizedDataSourceRef;
    }
    const message = normalizeString(error?.message);
    return !!normalizedDataSourceRef && message === `DataSource not found: ${normalizedDataSourceRef}`;
}

export function resolveReportBuilderDataSourceContext(builderContext = null, dataSourceRef = "") {
    if (typeof builderContext?.Context !== "function") {
        return null;
    }
    const normalizedDataSourceRef = normalizeString(dataSourceRef);
    if (!normalizedDataSourceRef) {
        return null;
    }
    try {
        return builderContext.Context(normalizedDataSourceRef);
    } catch (error) {
        if (isMissingDataSourceContextError(error, normalizedDataSourceRef)) {
            return null;
        }
        throw error;
    }
}

export function resolveReportBuilderDataSourceFetcher(dataSourceContext = null) {
    const fetchRecords = dataSourceContext?.handlers?.dataSource?.fetchRecords;
    if (typeof fetchRecords === "function") {
        return fetchRecords;
    }
    const connectorGet = dataSourceContext?.connector?.get;
    if (typeof connectorGet !== "function") {
        return null;
    }
    return async ({
        parameters = {},
        filter = {},
        page = null,
    } = {}) => connectorGet({
        filter: filter && typeof filter === "object" && !Array.isArray(filter) ? filter : {},
        page,
        inputParameters: parameters && typeof parameters === "object" && !Array.isArray(parameters) ? parameters : {},
    });
}

function normalizeDatasetSource(source = null) {
    return normalizeReportDatasetSource(isPlainObject(source) ? cloneValue(source) : null);
}

function resolvePreviewFetchResult(body = null, {
    extractConfig = null,
    resultContract = null,
    useDataSourcePagingFallback = false,
} = {}) {
    const resolved = resolveReportDatasetFetchResult({
        body,
        extractConfig,
        resultContract,
    });
    const hasExplicitHasMorePath = !!normalizeString(resultContract?.hasMorePath);
    if (!useDataSourcePagingFallback || hasExplicitHasMorePath || resolved?.hasMore === true) {
        return resolved;
    }
    return {
        ...resolved,
        hasMore: body?.dataInfo?.hasMore === true
            || body?.info?.hasMore === true,
    };
}

function resolveReportBuilderMCPToolExecutionPayload(result = null) {
    if (isPlainObject(result?.structuredContent) || Array.isArray(result?.structuredContent)) {
        return cloneValue(result.structuredContent);
    }
    const parsedResult = parseJSONSafe(result?.result);
    if (parsedResult != null) {
        return parsedResult;
    }
    return isPlainObject(result) ? cloneValue(result) : result;
}

export function resolveReportBuilderMCPExecutionContext(
    builderContext = null,
    dataset = null,
    {
        requestKind = "",
        toolName = "",
    } = {},
) {
    const normalizedDataset = isPlainObject(dataset) ? dataset : null;
    const datasetLabel = normalizeString(normalizedDataset?.label || normalizedDataset?.id || normalizedDataset?.dataSourceRef || toolName);
    const fallbackConversationId = normalizeString(
        builderContext?.conversationId
        || builderContext?.windowState?.conversationId,
    );
    const fallbackAssistantText = normalizeString(`Fetch report dataset ${datasetLabel || toolName}`);
    const fallbackContext = {
        conversationId: fallbackConversationId,
        assistantText: fallbackAssistantText,
        toolBundles: [],
    };
    const resolveExecution = builderContext?.handlers?.mcpTool?.resolveExecution;
    if (typeof resolveExecution !== "function") {
        return fallbackContext;
    }
    const resolved = resolveExecution({
        requestKind: normalizeString(requestKind),
        toolName: normalizeString(toolName),
        dataset: normalizedDataset ? cloneValue(normalizedDataset) : null,
        datasetLabel,
        conversationId: fallbackConversationId,
        defaultAssistantText: fallbackAssistantText,
        defaultToolBundles: [],
    });
    const normalizedResolved = isPlainObject(resolved) ? resolved : {};
    return {
        conversationId: normalizeString(normalizedResolved?.conversationId || fallbackConversationId),
        assistantText: normalizeString(normalizedResolved?.assistantText || fallbackAssistantText),
        toolBundles: normalizeStringList(normalizedResolved?.toolBundles),
    };
}

export function resolveReportBuilderDatasetPreviewFetcher(builderContext = null, dataset = null, {
    preferDataSourceRoute = false,
    omitConversationId = false,
} = {}) {
    const normalizedDataset = isPlainObject(dataset) ? dataset : null;
    const source = normalizeDatasetSource(normalizedDataset?.source);
    const toolName = resolveReportDatasetSourceToolName(source);
    const executeRequest = builderContext?.handlers?.mcpTool?.executeRequest;
    const fetchDataSourceByRef = builderContext?.handlers?.reportBuilderPreview?.fetchByRef;
    const dataSourceContext = resolveReportBuilderDataSourceContext(builderContext, normalizedDataset?.dataSourceRef);
    const dataSourceFetcher = resolveReportBuilderDataSourceFetcher(dataSourceContext);
    if (normalizeString(normalizedDataset?.dataSourceRef) && typeof fetchDataSourceByRef === "function" && preferDataSourceRoute) {
        return {
            source: "dataSourceRoute",
            dataSourceContext,
            resolveResult(body = null) {
                return resolvePreviewFetchResult(body, {
                    extractConfig: dataSourceContext?.dataSource,
                    resultContract: normalizedDataset?.resultContract,
                    useDataSourcePagingFallback: true,
                });
            },
            fetcher: async ({
                parameters = {},
            } = {}) => fetchDataSourceByRef({
                dataSourceRef: normalizedDataset?.dataSourceRef,
                parameters,
                builderContext,
                ...(omitConversationId ? { omitConversationId: true } : {}),
            }),
        };
    }
    if (dataSourceFetcher) {
        return {
            source: "dataSource",
            dataSourceContext,
            resolveResult(body = null) {
                return resolvePreviewFetchResult(body, {
                    extractConfig: dataSourceContext?.dataSource,
                    resultContract: normalizedDataset?.resultContract,
                    useDataSourcePagingFallback: true,
                });
            },
            fetcher: dataSourceFetcher,
        };
    }
    if (normalizeString(normalizedDataset?.dataSourceRef) && typeof fetchDataSourceByRef === "function") {
        return {
            source: "dataSourceRoute",
            dataSourceContext,
            resolveResult(body = null) {
                return resolvePreviewFetchResult(body, {
                    extractConfig: dataSourceContext?.dataSource,
                    resultContract: normalizedDataset?.resultContract,
                    useDataSourcePagingFallback: true,
                });
            },
            fetcher: async ({
                parameters = {},
            } = {}) => fetchDataSourceByRef({
                dataSourceRef: normalizedDataset?.dataSourceRef,
                parameters,
                builderContext,
                ...(omitConversationId ? { omitConversationId: true } : {}),
            }),
        };
    }
    if (isReportDatasetMCPSource(source) && toolName && typeof executeRequest === "function") {
        const executionContext = resolveReportBuilderMCPExecutionContext(builderContext, normalizedDataset, {
            requestKind: "runtimePreviewDataset",
            toolName,
        });
        return {
            source: "mcpTool",
            dataSourceContext,
            resolveResult(body = null) {
                return resolvePreviewFetchResult(body, {
                    resultContract: normalizedDataset?.resultContract,
                });
            },
            fetcher: async ({
                parameters = {},
            } = {}) => resolveReportBuilderMCPToolExecutionPayload(await executeRequest({
                conversationId: executionContext.conversationId,
                toolName,
                arguments: parameters && typeof parameters === "object" && !Array.isArray(parameters) ? parameters : {},
                assistantText: executionContext.assistantText,
                toolBundles: executionContext.toolBundles,
            })),
        };
    }
    return {
        source: "",
        dataSourceContext,
        fetcher: null,
    };
}

export function describeReportBuilderDataSourceFetchAvailability(dataSourceContext = null, dataSourceRef = "") {
    const normalizedDataSourceRef = normalizeString(dataSourceRef);
    const hasContext = !!dataSourceContext;
    const hasFetchRecords = typeof dataSourceContext?.handlers?.dataSource?.fetchRecords === "function";
    const hasConnectorGet = typeof dataSourceContext?.connector?.get === "function";
    return {
        dataSourceRef: normalizedDataSourceRef,
        hasContext,
        hasFetchRecords,
        hasConnectorGet,
        available: hasFetchRecords || hasConnectorGet,
    };
}

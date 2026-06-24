import {useSetting} from "../core/index.js";
import { getLogger } from "../utils/logger.js";
import { appendTargetContextQuery } from "../runtime/targetContext.js";
import { resolvePagingValues, withPagingInputs } from "./paging.js";
import { buildDatasourceFetchInputs } from "./datasourceRequest.js";

const inFlightGetRequests = new Map();


// Toggle with env var or config if you don't always want noisy logs.
// Guard `process` access because standalone browser previews may execute
// outside a Node-style global.
const STACK_DEBUG =
    typeof process !== 'undefined' &&
    process?.env?.STACK_DEBUG === '1';

function logCallerStack(name , maxFrames = 5) {
    const err = new Error();

    // Normalize and trim the stack
    const lines = (err.stack || '')
        .split('\n')
        // remove the first line: "Error"
        .slice(1)
        // remove this helper frame and the get() frame if present
        .filter(l => !/logCallerStack|^\s*at\s*get\s*\(/.test(l))
        .map(l => l.trim().replace(/^at\s+/, ''));

    const callers = lines.slice(0, maxFrames);
    if (callers.length) {
        console.log(`[${name}] (up to ${maxFrames}):\n${callers.join('\n')}`);
    } else {
        console.log('[${name}] (no caller frames available)');
    }
}

export function createDataConnector(dataSource, runtime = {}) {
    const {
        endpoints = {},
        targetContext = {},
        auth = {},
        prepareRequest,
    } = runtime || {};
    const {authStates, defaultAuthProvider} = auth;
    const {paging, parameters = []} = dataSource;

    function notifyUnauthorized(error) {
        if (!error || (error.status !== 401 && error.status !== 403)) {
            return;
        }
        for (const handlerName of ['handleUnauthorized', 'onUnauthorized', 'promptLogin', 'beginLogin']) {
            const fn = auth?.[handlerName];
            if (typeof fn === 'function') {
                try {
                    fn(error);
                    return;
                } catch (e) {
                    console.error(`Unauthorized handler ${handlerName} failed`, e);
                }
            }
        }
    }

    function applyRequestPreparation({url, method, headers, queryParams, body}) {
        if (typeof prepareRequest !== 'function') {
            return {url, method, headers, queryParams, body};
        }
        const overrides = prepareRequest({
            dataSource,
            url,
            method,
            headers,
            queryParams,
            body,
            endpoints,
            targetContext,
            auth,
        }) || {};
        return {
            url: typeof overrides.url === 'string' && overrides.url.trim() ? overrides.url : url,
            method: typeof overrides.method === 'string' && overrides.method.trim() ? overrides.method : method,
            headers: overrides.headers && typeof overrides.headers === 'object' ? overrides.headers : headers,
            queryParams: overrides.queryParams instanceof URLSearchParams ? overrides.queryParams : queryParams,
            body: Object.prototype.hasOwnProperty.call(overrides, 'body') ? overrides.body : body,
        };
    }

    function appendServiceTargetContext(queryParams) {
        if (dataSource?.service?.includeTargetContext) {
            appendTargetContextQuery(queryParams, targetContext);
        }
    }

    function summarizeErrorPayload(raw) {
        const text = String(raw || '').trim();
        if (!text) {
            return '';
        }
        try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === 'object') {
                for (const key of ['message', 'error', 'detail']) {
                    const value = String(parsed?.[key] || '').trim();
                    if (value) {
                        return value;
                    }
                }
            }
        } catch (_) {
            // Fall back to the raw response text when the payload is not JSON.
        }
        return text;
    }

    async function makeRequestError(resp, prefix = 'Request error') {
        let detail = '';
        try {
            detail = summarizeErrorPayload(await resp.clone().text());
        } catch (_) {
            // Best-effort only; preserve the status-based error when the body
            // cannot be read.
        }
        const message = detail
            ? `${prefix}: ${resp.status} ${resp.statusText}: ${detail}`
            : `${prefix}: ${resp.status} ${resp.statusText}`;
        const error = new Error(message);
        error.status = resp.status;
        error.statusText = resp.statusText;
        error.isUnauthorized = resp.status === 401 || resp.status === 403;
        if (detail) {
            error.detail = detail;
        }
        return error;
    }


    /**
     * Replaces path placeholders, adds query inputParameters, or sets headers
     */
    function applyParameters({url, headers, queryParams, body}, inputParameters) {
        const log = getLogger('connector');
        let finalUrl = url;
        try { log.debug('[applyParameters]', { url, inputParameters, parameters }); } catch(_) {}
        if (!parameters || parameters.length === 0) {
            for(const k in inputParameters) {
                const value = inputParameters[k];
                finalUrl = finalUrl.replace(`{${k}}`, value);
            }
            return finalUrl;
        }

        for (const paramDef of parameters) {
            const {name, kind} = paramDef;
            const value = inputParameters[name];
            if (value == null) continue;

            switch (kind) {
                case "path":
                    // Replace {name} in the url
                    finalUrl = finalUrl.replace(`{${name}}`, value);
                    break;
                case "query":
                    queryParams.append(name, value);
                    break;
                case "header":
                    headers[name] = value;
                    break;
                case "body":
                    body[name] = value;
                    break;
                default:
                    // no-op
                    break;
            }
            for(const k in inputParameters) {
                const value = inputParameters[k];
                finalUrl = finalUrl.replace(`{${k}}`, value);
            }
        }
        try { log.debug('[resolvedUrl]', finalUrl); } catch(_) {}
        return finalUrl;
    }

    function getUrlAndHeaders(requestMethod) {
        const {service = {}} = dataSource;
        let url = service.URL || "";
        const method = requestMethod || service.method || "GET";
        if (service.uri && service.endpoint) {
            const baseEndpoint = endpoints[service.endpoint];
            if (!baseEndpoint) {
                throw new Error(`Endpoint config not found for: ${service.endpoint}`);
            }

            // Remove trailing slash from baseURL and leading slash from uri to avoid '//'
            const base = (baseEndpoint.baseURL || '').replace(/\/+$/, '');
            let uri = (service.uri || '')
            const methoSetting = service[method.toLowerCase()]
            if(methoSetting && methoSetting.uri) {
                uri = methoSetting.uri
            }
            uri = uri.replace(/^\/+/, '');
            url = base + '/' + uri;
        }


        // Auth header if token
        const headers = {};

        // Get auth provider from dataSource or use default
        const authProvider = dataSource.authProvider || defaultAuthProvider;

        const providerState = authStates?.[authProvider];
        if (providerState && providerState.jwtToken?.id_token) {
            headers["Authorization"] = `Bearer ${providerState.jwtToken.id_token}`;
        }

        return {method, url, headers};
    }


    /**
     * GET method
     * @param {Object} options - Query parameters and input parameters.
     * @param {Object} options.query - Query parameters.
     * @param {Array} options.inputParameters - Parameters to apply to the request.
     * @returns {Promise<Object>} - The JSON response.
     */
    async function request({query = {}, inputParameters = []}) {
        try {
            let {method, url, headers} = getUrlAndHeaders();
            let queryParams = new URLSearchParams();

            // Append query parameters
            Object.entries(query).forEach(([key, val]) => {
                if (val != null) queryParams.append(key, val);
            });

            // Prepare the request body
            let body = {};
            url = applyParameters({url, headers, queryParams, body}, inputParameters);
            appendServiceTargetContext(queryParams);
            ({url, method, headers, queryParams, body} = applyRequestPreparation({url, method, headers, queryParams, body}));
            const finalUrl = queryParams.toString() ? `${url}?${queryParams}` : url;

            const request = {method, headers};
            if (Object.keys(body).length > 0) {
                request.body = JSON.stringify(body);
            }

            // Execute fetch request
            const resp = await fetch(finalUrl, request);
            if (!resp.ok) {
                const err = await makeRequestError(resp, 'GET request failed');
                notifyUnauthorized(err);
                throw err;
            }
            const data = await resp.text();
            // Return parsed JSON response
            return data;
        } catch (err) {
            console.error("Failed to fetch data", err);
            throw err;
        }
    }



    /**
     * GET method
     */
    async function get({filter = {}, page, inputParameters = {}}) {
        try {
            let {method, url, headers} = getUrlAndHeaders();
            let queryParams = new URLSearchParams();
            const requestMethod = String(method || 'GET').toUpperCase();
            const isDatasourceFetchRoute = /\/v1\/api\/datasources\/[^/]+\/fetch$/.test(url);
            const pagingValues = resolvePagingValues(page, paging);
            const effectiveInputParameters = requestMethod === 'GET'
                ? { ...(inputParameters || {}) }
                : withPagingInputs(inputParameters, pagingValues);
            // Merge filter into query string
            if (requestMethod === 'GET') {
                Object.entries(filter).forEach(([key, val]) => {
                    if (val != null) queryParams.append(key, val);
                });
            }

            // Handle paging
            if (requestMethod === 'GET' && pagingValues) {
                const { pageParamName, sizeParamName, pageValue, sizeValue } = pagingValues;
                queryParams.append(pageParamName, pageValue);
                if (sizeValue != null) {
                    queryParams.append(sizeParamName, sizeValue);
                }
            }

            const body = {};
            url = applyParameters({url, headers, queryParams, body}, effectiveInputParameters);
            appendServiceTargetContext(queryParams);
            let payload = requestMethod !== 'GET' && isDatasourceFetchRoute
                ? {
                    inputs: buildDatasourceFetchInputs({
                        inputParameters: effectiveInputParameters,
                        filter,
                        pagingValues,
                    }),
                }
                : body;
            ({url, method, headers, queryParams, body: payload} = applyRequestPreparation({
                url,
                method: requestMethod,
                headers,
                queryParams,
                body: payload,
            }));

            const finalUrl = queryParams.toString() ? `${url}?${queryParams}` : url;
            const request = {method: String(method || requestMethod).toUpperCase(), headers};

            if (requestMethod !== 'GET' && isDatasourceFetchRoute) {
                request["body"] = JSON.stringify(payload);
                request.headers = {
                    ...headers,
                    "Content-Type": "application/json",
                };
            } else if (Object.keys(body).length > 0) {
                request["body"] = JSON.stringify(body);
            }
            const log = getLogger('connector');
            try { log.debug('[request]', { method, url: finalUrl, request }); } catch(_) {}
            const requestKey = requestMethod === 'GET'
                ? JSON.stringify({ url: finalUrl, headers: request.headers || {} })
                : '';
            if (requestKey && inFlightGetRequests.has(requestKey)) {
                return inFlightGetRequests.get(requestKey);
            }
            const performRequest = (async () => {
                const resp = await fetch(finalUrl, request);
                if (!resp.ok) {
                    const err = await makeRequestError(resp, 'GET error');
                    notifyUnauthorized(err);
                    throw err;
                }
                const json = await resp.json();
                try { log.debug('[response]', { url: finalUrl, status: resp.status }); } catch(_) {}
                return json;
            })();
            if (requestKey) {
                inFlightGetRequests.set(requestKey, performRequest);
            }
            try {
                return await performRequest;
            } finally {
                if (requestKey) {
                    inFlightGetRequests.delete(requestKey);
                }
            }
        } catch (err) {
            console.error("Failed to fetch data", err);
            throw err;

        }
    }


    /**
     * POST
     */
    async function post({body = {}, inputParameters = {}}) {
        try {
            let {method, url, headers} = getUrlAndHeaders('POST');
            let queryParams = new URLSearchParams();

            // apply path/query/header/body parameters
            url = applyParameters({url, headers, queryParams, body}, inputParameters);
            appendServiceTargetContext(queryParams);
            ({url, method, headers, queryParams, body} = applyRequestPreparation({
                url,
                method: String(method || 'POST').toUpperCase(),
                headers,
                queryParams,
                body,
            }));
            const finalUrl = queryParams.toString() ? `${url}?${queryParams}` : url;
            const log = getLogger('connector');
            try { log.debug('[request][POST]', { url: finalUrl, body }); } catch(_) {}
            const resp = await fetch(finalUrl, {
                method: String(method || 'POST').toUpperCase(),
                headers: {...headers, "Content-Type": "application/json"},
                body: JSON.stringify(body),
            });
            if (!resp.ok) {
                const err = await makeRequestError(resp, 'POST error');
                notifyUnauthorized(err);
                throw err;
            }
            const json = await resp.json();
            try { log.debug('[response][POST]', { url: finalUrl, status: resp.status }); } catch(_) {}
            return json;
        } catch (err) {
            console.error("Failed to fetch data", err);
            throw err;

        }
    }


    /**
     * Patch
     */
    async function patch({body = {}, inputParameters = {}}) {
        try {
            let {method, url, headers} = getUrlAndHeaders('PATCH');
            let queryParams = new URLSearchParams();
            url = applyParameters({url, headers, queryParams, body}, inputParameters);
            appendServiceTargetContext(queryParams);
            ({url, method, headers, queryParams, body} = applyRequestPreparation({
                url,
                method: String(method || 'PATCH').toUpperCase(),
                headers,
                queryParams,
                body,
            }));
            const finalUrl = queryParams.toString() ? `${url}?${queryParams}` : url;
            const resp = await fetch(finalUrl, {
                method: String(method || 'PATCH').toUpperCase(),
                headers: {...headers, "Content-Type": "application/json"},
                body: JSON.stringify(body),
            });
            if (!resp.ok) {
                const err = await makeRequestError(resp, 'PATCH error');
                notifyUnauthorized(err);
                throw err;
            }
            return await resp.json();
        } catch (err) {
            console.error("Failed to fetch data", err);
            throw err;

        }
    }

    /**
     * Put
     */
    async function put({body = {}, inputParameters={}}) {
        try {
            let {method, url, headers} = getUrlAndHeaders('PUT');
            let queryParams = new URLSearchParams();
            url = applyParameters({url, headers, queryParams, body}, inputParameters);
            appendServiceTargetContext(queryParams);
            ({url, method, headers, queryParams, body} = applyRequestPreparation({
                url,
                method: String(method || 'PUT').toUpperCase(),
                headers,
                queryParams,
                body,
            }));
            const finalUrl = queryParams.toString() ? `${url}?${queryParams}` : url;
            const resp = await fetch(finalUrl, {
                method: String(method || 'PUT').toUpperCase(),
                headers: {...headers, "Content-Type": "application/json"},
                body: JSON.stringify(body),
            });
            if (!resp.ok) {
                throw new Error(`PUT error: ${resp.statusText}`);
            }
            return await resp.json();
        } catch (err) {
            console.error('PUT failed', err);
            throw err;
        }
    }

    /**
     * DELETE
     */
    async function del({id}) {
        if (!id) {
            throw new Error("DELETE requires 'id'");
        }
        try {
            let {method, url, headers} = getUrlAndHeaders('DELETE');
            let queryParams = new URLSearchParams();
            url = `${url}/${id}`;
            appendServiceTargetContext(queryParams);
            ({url, method, headers, queryParams} = applyRequestPreparation({
                url,
                method: String(method || 'DELETE').toUpperCase(),
                headers,
                queryParams,
                body: undefined,
            }));
            const finalUrl = queryParams.toString() ? `${url}?${queryParams}` : url;
            const resp = await fetch(finalUrl, {method: String(method || 'DELETE').toUpperCase(), headers});
            if (!resp.ok) {
                throw new Error(`DELETE error: ${resp.statusText}`);
            }
            return await resp.json();
        } catch (err) {
            console.error('DELETE failed', err);
            throw err;
        }
    }

    return {
        request,
        get,
        patch,
        post,
        put,
        del,
        // you can add post/update/delete if needed...
    };
}

function useDataConnector(dataSource) {
    const {endpoints = {}, useAuth = () => ({}), targetContext = {}, services = {}} = useSetting();
    const auth = useAuth();
    return createDataConnector(dataSource, {
        endpoints,
        targetContext,
        auth,
        prepareRequest: typeof services?.prepareDataConnectorRequest === 'function'
            ? services.prepareDataConnectorRequest
            : undefined,
    });
}

export default useDataConnector;

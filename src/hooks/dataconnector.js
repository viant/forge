import {useSetting} from "../core";
import { getLogger } from "../utils/logger.js";
import { appendTargetContextQuery } from "../runtime/targetContext.js";


// Toggle with env var or config if you don't always want noisy logs
const STACK_DEBUG = process.env.STACK_DEBUG === '1';

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

function pagingConfig(paging) {
    if (!paging || paging.enabled === false) {
        return null;
    }
    return paging;
}

function resolvePagingValues(page, paging) {
    const config = pagingConfig(paging);
    if (page == null || !config) {
        return null;
    }

    const pageParameters = config.parameters || {};
    const pageParamName = pageParameters.page || "page";
    const sizeParamName = pageParameters.size || "size";
    const sizeValue = config.size && config.size > 0 ? config.size : undefined;
    let pageValue = page;
    if (pageParamName === 'offset') {
        const pageNumber = Number(page) || 1;
        const pageSize = Number(sizeValue) || 0;
        pageValue = Math.max(0, pageNumber - 1) * pageSize;
    }
    return { pageParamName, sizeParamName, pageValue, sizeValue };
}

function useDataConnector(dataSource) {
    const {endpoints, useAuth} = useSetting();
    const auth = useAuth();
    const {authStates, defaultAuthProvider} = auth;
    const {paging, parameters = []} = dataSource;
    const {targetContext = {}} = useSetting();

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

    function makeRequestError(resp, prefix = 'Request error') {
        const error = new Error(`${prefix}: ${resp.status} ${resp.statusText}`);
        error.status = resp.status;
        error.statusText = resp.statusText;
        error.isUnauthorized = resp.status === 401 || resp.status === 403;
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
            const queryParams = new URLSearchParams();

            // Append query parameters
            Object.entries(query).forEach(([key, val]) => {
                if (val != null) queryParams.append(key, val);
            });

            // Prepare the request body
            let body = {};
            url = applyParameters({url, headers, queryParams, body}, inputParameters);
            if (dataSource?.service?.includeTargetContext) {
                appendTargetContextQuery(queryParams, targetContext);
            }
            const finalUrl = queryParams.toString() ? `${url}?${queryParams}` : url;

            const request = {method, headers};
            if (Object.keys(body).length > 0) {
                request.body = JSON.stringify(body);
            }

            // Execute fetch request
            const resp = await fetch(finalUrl, request);
            if (!resp.ok) {
                const err = makeRequestError(resp, 'GET request failed');
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
            const queryParams = new URLSearchParams();
            const requestMethod = String(method || 'GET').toUpperCase();
            const isDatasourceFetchRoute = /\/v1\/api\/datasources\/[^/]+\/fetch$/.test(url);
            // Merge filter into query string
            if (requestMethod === 'GET') {
                Object.entries(filter).forEach(([key, val]) => {
                    if (val != null) queryParams.append(key, val);
                });
            }

            // Handle paging
            const pagingValues = resolvePagingValues(page, paging);
            if (requestMethod === 'GET' && pagingValues) {
                const { pageParamName, sizeParamName, pageValue, sizeValue } = pagingValues;
                queryParams.append(pageParamName, pageValue);
                if (sizeValue != null) {
                    queryParams.append(sizeParamName, sizeValue);
                }
            }

            const body = {};
            url = applyParameters({url, headers, queryParams, body}, inputParameters);
            if (dataSource?.service?.includeTargetContext) {
                appendTargetContextQuery(queryParams, targetContext);
            }

            const finalUrl = queryParams.toString() ? `${url}?${queryParams}` : url;
            const request = {method: requestMethod, headers};

            if (requestMethod !== 'GET' && isDatasourceFetchRoute) {
                const inputs = {
                    ...(inputParameters || {}),
                    ...(filter || {}),
                };
                const pagingValues = resolvePagingValues(page, paging);
                if (pagingValues) {
                    const { pageParamName, sizeParamName, pageValue, sizeValue } = pagingValues;
                    inputs[pageParamName] = pageValue;
                    if (sizeValue != null) {
                        inputs[sizeParamName] = sizeValue;
                    }
                }
                request["body"] = JSON.stringify({ inputs });
                request.headers = {
                    ...headers,
                    "Content-Type": "application/json",
                };
            } else if (Object.keys(body).length > 0) {
                request["body"] = JSON.stringify(body);
            }
            const log = getLogger('connector');
            try { log.debug('[request]', { method, url: finalUrl, request }); } catch(_) {}
            const resp = await fetch(finalUrl, request);
            if (!resp.ok) {
                const err = makeRequestError(resp, 'GET error');
                notifyUnauthorized(err);
                throw err;
            }
            const json = await resp.json();
            try { log.debug('[response]', { url: finalUrl, status: resp.status }); } catch(_) {}
            return json;
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
            let {url, headers} = getUrlAndHeaders('POST');
            const queryParams = new URLSearchParams();

            // apply path/query/header/body parameters
            url = applyParameters({url, headers, queryParams, body}, inputParameters);
            const log = getLogger('connector');
            try { log.debug('[request][POST]', { url, body }); } catch(_) {}
            const resp = await fetch(url, {
                method: "POST",
                headers: {...headers, "Content-Type": "application/json"},
                body: JSON.stringify(body),
            });
            if (!resp.ok) {
                const err = makeRequestError(resp, 'POST error');
                notifyUnauthorized(err);
                throw err;
            }
            const json = await resp.json();
            try { log.debug('[response][POST]', { url, status: resp.status }); } catch(_) {}
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
            let {url, headers} = getUrlAndHeaders('PATCH');
            const queryParams = new URLSearchParams();
            url = applyParameters({url, headers, queryParams, body}, inputParameters);
            const resp = await fetch(url, {
                method: "PATCH",
                headers: {...headers, "Content-Type": "application/json"},
                body: JSON.stringify(body),
            });
            if (!resp.ok) {
                const err = makeRequestError(resp, 'PATCH error');
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
            let {url, headers} = getUrlAndHeaders('PUT');
            const queryParams = new URLSearchParams();


            url = applyParameters({url, headers,  body}, inputParameters);
            const resp = await fetch(url, {
                method: "PUT",
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
            const {url, headers} = getUrlAndHeaders('DELETE');
            const finalUrl = `${url}/${id}`;
            const resp = await fetch(finalUrl, {method: "DELETE", headers});
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

export default useDataConnector;

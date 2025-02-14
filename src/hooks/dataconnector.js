import {useSetting} from "../core";

function useDataConnector(dataSource) {
    const {endpoints, useAuth} = useSetting();
    const {authStates, defaultAuthProvider} = useAuth();
    const {paging = {}, parameters = []} = dataSource;

    /**
     * Replaces path placeholders, adds query inputParameters, or sets headers
     */
    function applyParameters({url, headers, queryParams, body}, inputParameters) {
        let finalUrl = url;
        if (!parameters || parameters.length === 0) {
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
        }
        return finalUrl;
    }

    function getUrlAndHeaders() {
        const {service = {}} = dataSource;
        let url = service.URL || "";

        if (service.uri && service.endpoint) {
            const baseEndpoint = endpoints[service.endpoint];
            if (!baseEndpoint) {
                throw new Error(`Endpoint config not found for: ${service.endpoint}`);
            }
            url = baseEndpoint.baseURL + service.uri;
        }

        const method = service.method || "GET";

        // Auth header if token
        const headers = {};

        // Get auth provider from dataSource or use default
        const authProvider = dataSource.authProvider || defaultAuthProvider;

        const providerState = authStates[authProvider];
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
            const finalUrl = queryParams.toString() ? `${url}?${queryParams}` : url;

            const request = {method, headers};
            if (Object.keys(body).length > 0) {
                request.body = JSON.stringify(body);
            }

            // Execute fetch request
            const resp = await fetch(finalUrl, request);
            if (!resp.ok) {
                throw new Error(`GET request failed: ${resp.status} ${resp.statusText}`);
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
            // Merge filter into query string
            Object.entries(filter).forEach(([key, val]) => {
                if (val != null) queryParams.append(key, val);
            });

            // Handle paging
            if (page != null && paging) {
                const pageParameters = paging.parameters || {};
                const pageParamName = pageParameters.page || "page";
                queryParams.append(pageParamName, page);
            }

            const body = {};
            url = applyParameters({url, headers, queryParams, body}, inputParameters);
            const finalUrl = queryParams.toString() ? `${url}?${queryParams}` : url;
            const request = {method, headers};
            if (Object.keys(body).length > 0) {
                request["body"] = JSON.stringify(body);
            }
            const resp = await fetch(finalUrl, request);
            if (!resp.ok) {
                throw new Error(`GET error: ${resp.statusText}`);
            }
            return await resp.json();
        } catch (err) {
            console.error("Failed to get error", err);
            throw err;
        }
    }


    /**
     * POST
     */
    async function post({body = {}}) {
        try {
            const {url, headers} = getUrlAndHeaders();
            const resp = await fetch(url, {
                method: "POST",
                headers: {...headers, "Content-Type": "application/json"},
                body: JSON.stringify(body),
            });
            if (!resp.ok) {
                throw new Error(`POST error: ${resp.statusText}`);
            }
            return await resp.json();
        } catch (err) {
            setError && setError(err);
            throw err;
        }
    }


    /**
     * Patch
     */
    async function patch({body = {}}) {
        try {
            const {url, headers} = getUrlAndHeaders();
            const resp = await fetch(url, {
                method: "PATCH",
                headers: {...headers, "Content-Type": "application/json"},
                body: JSON.stringify(body),
            });
            if (!resp.ok) {
                throw new Error(`POST error: ${resp.statusText}`);
            }
            return await resp.json();
        } catch (err) {
            setError && setError(err);
            throw err;
        }
    }

    /**
     * Put
     */
    async function put({id, body = {}}) {
        if (!id) {
            throw new Error("PUT requires 'id'");
        }
        try {
            const {url, headers} = getUrlAndHeaders();
            const finalUrl = `${url}/${id}`;
            const resp = await fetch(finalUrl, {
                method: "PUT",
                headers: {...headers, "Content-Type": "application/json"},
                body: JSON.stringify(body),
            });
            if (!resp.ok) {
                throw new Error(`PUT error: ${resp.statusText}`);
            }
            return await resp.json();
        } catch (err) {
            setError && setError(err);
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
            const {url, headers} = getUrlAndHeaders();
            const finalUrl = `${url}/${id}`;
            const resp = await fetch(finalUrl, {method: "DELETE", headers});
            if (!resp.ok) {
                throw new Error(`DELETE error: ${resp.statusText}`);
            }
            return await resp.json();
        } catch (err) {
            setError && setError(err);
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
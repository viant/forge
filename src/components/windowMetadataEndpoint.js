// Window keys are one endpoint argument even when their identity contains
// slashes (legacy aliases, nested paths, or canonical resource URIs).
export function windowMetadataEndpoint(uri, windowKey, options = {}) {
    const endpoint = `${String(uri || '').replace(/\/+$/, '')}/${encodeURIComponent(windowKey)}`;
    const query = new URLSearchParams();
    if (options.resourceRef?.uri) query.set("resourceRef", JSON.stringify(options.resourceRef));
    if (options.providerIdentity) query.set("providerIdentity", options.providerIdentity);
    return query.size ? `${endpoint}?${query}` : endpoint;
}

// Window keys are one endpoint argument even when their identity contains
// slashes (legacy aliases, nested paths, or canonical resource URIs).
export function windowMetadataEndpoint(uri, windowKey) {
    return `${String(uri || '').replace(/\/+$/, '')}/${encodeURIComponent(windowKey)}`;
}

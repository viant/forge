function normalizeString(value = "") {
    return String(value || "").trim();
}

function normalizeRows(value) {
    return Array.isArray(value) ? value : [];
}

export function matchesReportBuilderRuntimePreviewDispatch(dispatchFingerprint = "", requestFingerprint = "") {
    const normalizedDispatchFingerprint = normalizeString(dispatchFingerprint);
    const normalizedRequestFingerprint = normalizeString(requestFingerprint);
    if (!normalizedDispatchFingerprint || !normalizedRequestFingerprint) {
        return false;
    }
    return normalizedDispatchFingerprint.startsWith(`${normalizedRequestFingerprint}::`);
}

export function resolveReportBuilderRuntimePreviewRowsSource({
    currentRequestFingerprint = "",
    requestDispatchFingerprint = "",
    currentRequestShouldFetch = false,
    runtimePreviewFingerprint = "",
    hasCompletedCurrentRun = false,
    collection = [],
    collectionInfo = {},
    loading = false,
    error = null,
    fetchedRows = [],
    fetchedHasMore = false,
    fetchedError = null,
    fetchedLoading = false,
} = {}) {
    const normalizedCurrentRequestFingerprint = normalizeString(currentRequestFingerprint);
    const normalizedRuntimePreviewFingerprint = normalizeString(runtimePreviewFingerprint);
    const requestMatches = normalizedCurrentRequestFingerprint
        && normalizedCurrentRequestFingerprint === normalizedRuntimePreviewFingerprint;
    const requestDispatched = matchesReportBuilderRuntimePreviewDispatch(
        requestDispatchFingerprint,
        normalizedCurrentRequestFingerprint,
    );
    const canUseCollection = requestMatches
        && requestDispatched
        && (
            currentRequestShouldFetch
                ? !loading && !error
                : hasCompletedCurrentRun
        );
    if (canUseCollection) {
        return {
            source: "collection",
            rows: normalizeRows(collection),
            hasMore: collectionInfo?.hasMore === true,
            error: null,
            loading: false,
        };
    }
    return {
        source: "runtimePreview",
        rows: normalizeRows(fetchedRows),
        hasMore: fetchedHasMore === true,
        error: fetchedError || null,
        loading: fetchedLoading === true,
    };
}

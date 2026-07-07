function normalizeString(value = "") {
    return String(value || "").trim();
}

export function buildReportBuilderSurfaceAutoRunKey({
    workspaceMode = "design",
    requestFingerprint = "",
} = {}) {
    const normalizedMode = normalizeString(workspaceMode);
    const normalizedFingerprint = normalizeString(requestFingerprint);
    if (!normalizedMode || !normalizedFingerprint) {
        return "";
    }
    return `${normalizedMode}::${normalizedFingerprint}`;
}

export function shouldAutoRunReportBuilderSurface({
    workspaceMode = "design",
    requestFingerprint = "",
    deferForPrefill = false,
    canRunReport = false,
    currentRequestShouldFetch = false,
    loading = false,
    error = null,
    hasRows = false,
    hasCompletedCurrentRun = false,
} = {}) {
    const normalizedMode = normalizeString(workspaceMode).toLowerCase();
    const normalizedFingerprint = normalizeString(requestFingerprint);
    if (!normalizedFingerprint) {
        return false;
    }
    if (normalizedMode !== "preview" && normalizedMode !== "report") {
        return false;
    }
    if (deferForPrefill) {
        return false;
    }
    if (!canRunReport || !currentRequestShouldFetch) {
        return false;
    }
    if (loading || error) {
        return false;
    }
    if (hasRows || hasCompletedCurrentRun) {
        return false;
    }
    return true;
}

export function resolveReportBuilderSurfaceAutoRunAction({
    workspaceMode = "design",
    requestFingerprint = "",
    deferForPrefill = false,
    canRunReport = false,
    currentRequestShouldFetch = false,
    loading = false,
    error = null,
    hasRows = false,
    hasCompletedCurrentRun = false,
    autoRunKey = "",
    consumedAutoRunKey = "",
    currentRequestDispatchFingerprint = "",
    requestDispatchFingerprint = "",
} = {}) {
    const shouldAutoRun = shouldAutoRunReportBuilderSurface({
        workspaceMode,
        requestFingerprint,
        deferForPrefill,
        canRunReport,
        currentRequestShouldFetch,
        loading,
        error,
        hasRows,
        hasCompletedCurrentRun,
    });
    if (!shouldAutoRun) {
        return { type: "skip" };
    }
    const normalizedAutoRunKey = normalizeString(autoRunKey);
    if (!normalizedAutoRunKey || normalizedAutoRunKey === normalizeString(consumedAutoRunKey)) {
        return { type: "skip" };
    }
    if (normalizeString(requestDispatchFingerprint) !== normalizeString(currentRequestDispatchFingerprint)) {
        return {
            type: "dispatch",
            autoRunKey: normalizedAutoRunKey,
        };
    }
    return {
        type: "promote",
        autoRunKey: normalizedAutoRunKey,
    };
}

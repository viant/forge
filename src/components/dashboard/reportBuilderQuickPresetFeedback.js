function normalizeString(value = "") {
    return String(value || "").trim();
}

export function beginQuickPresetActivation({
    title = "",
    kind = "chart",
    awaitingFetch = false,
    loading = false,
    targetDispatchFingerprint = "",
    nowMs = Date.now(),
    minVisibleMs = 1200,
    maxVisibleMs = 15000,
} = {}) {
    if (!awaitingFetch) {
        return null;
    }
    return {
        title: normalizeString(title) || "Preset",
        kind: normalizeString(kind) || "chart",
        awaitingFetch: true,
        observedLoading: !!loading,
        targetDispatchFingerprint: normalizeString(targetDispatchFingerprint),
        minVisibleUntil: Number(nowMs || 0) + Math.max(0, Number(minVisibleMs || 0) || 0),
        expiresAt: Number(nowMs || 0) + Math.max(1000, Number(maxVisibleMs || 0) || 0),
    };
}

export function updateQuickPresetActivationForLoading(current = null, {
    loading = false,
    currentDispatchFingerprint = "",
    error = null,
    nowMs = Date.now(),
} = {}) {
    if (!current?.awaitingFetch) {
        return current;
    }
    if (error || Number(current.expiresAt || 0) <= Number(nowMs || 0)) {
        return null;
    }
    if (!current.observedLoading && loading) {
        return {
            ...current,
            observedLoading: true,
        };
    }
    const targetDispatchFingerprint = normalizeString(current?.targetDispatchFingerprint);
    const normalizedCurrentDispatchFingerprint = normalizeString(currentDispatchFingerprint);
    const requestSettledWithoutObservedLoading = !current.observedLoading
        && !loading
        && targetDispatchFingerprint !== ""
        && targetDispatchFingerprint === normalizedCurrentDispatchFingerprint;
    if (current.observedLoading && !loading && Number(current.minVisibleUntil || 0) <= Number(nowMs || 0)) {
        return null;
    }
    if (requestSettledWithoutObservedLoading && Number(current.minVisibleUntil || 0) <= Number(nowMs || 0)) {
        return null;
    }
    return current;
}

export function shouldScheduleQuickPresetActivationRelease(current = null, {
    loading = false,
    currentDispatchFingerprint = "",
    nowMs = Date.now(),
} = {}) {
    if (!current?.awaitingFetch || loading) {
        return 0;
    }
    const targetDispatchFingerprint = normalizeString(current?.targetDispatchFingerprint);
    const normalizedCurrentDispatchFingerprint = normalizeString(currentDispatchFingerprint);
    const requestSettledWithoutObservedLoading = !current.observedLoading
        && targetDispatchFingerprint !== ""
        && targetDispatchFingerprint === normalizedCurrentDispatchFingerprint;
    if (!current?.observedLoading && !requestSettledWithoutObservedLoading) {
        return Math.max(0, Number(current.expiresAt || 0) - Number(nowMs || 0));
    }
    return Math.max(0, Number(current.minVisibleUntil || 0) - Number(nowMs || 0));
}

export function buildQuickPresetActionState(current = null) {
    if (!current?.awaitingFetch) {
        return {
            busy: false,
            buttonLabel: "",
            statusMessage: "",
        };
    }
    const presetTitle = normalizeString(current.title) || "Preset";
    const kindLabel = normalizeString(current.kind).toLowerCase() === "table"
        ? "table preview"
        : "report preview";
    return {
        busy: true,
        buttonLabel: "Applying...",
        statusMessage: `Applying ${presetTitle}. Updating the live ${kindLabel}.`,
    };
}

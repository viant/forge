function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function resolveSavedReportRunScope(prefill = null, override = null) {
    const isScope = (value) => value && typeof value === "object" && !Array.isArray(value);
    if (!isScope(prefill) && !isScope(override)) return null;
    // A run may override dates while the selected entity is supplied by the
    // window's prefill. They describe one scope, not alternative scopes.
    return cloneValue({
        ...(isScope(prefill) ? prefill : {}),
        ...(isScope(override) ? override : {}),
    });
}

export function applySavedReportRunOverride(response = null, override = null) {
    if (!response || typeof response !== "object" || Array.isArray(response)) return response;
    if (!override || typeof override !== "object" || Array.isArray(override)) return response;
    const next = cloneValue(response);
    const from = normalizeString(override.from);
    const to = normalizeString(override.to);
    const applyScope = (artifact) => {
        if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) return;
        const params = Array.isArray(artifact.scope?.params) ? artifact.scope.params : [];
        artifact.scope = {
            ...(artifact.scope || {}),
            params: params.map((param) => {
                const id = normalizeString(param?.id);
                if (id === "dateRange" && from && to) {
                    return { ...param, value: { start: from, end: to } };
                }
                if (id && Object.prototype.hasOwnProperty.call(override, id) && override[id] !== undefined) {
                    const value = override[id];
                    if (Array.isArray(value) && value.length === 0) return param;
                    return { ...param, value: cloneValue(value) };
                }
                return param;
            }),
        };
    };
    // Reopen prefers ReportSpec scope when present. Keep both representations
    // aligned, and only replace parameters already declared by the artifact.
    applyScope(next.document);
    applyScope(next.reportSpec);
    return next;
}

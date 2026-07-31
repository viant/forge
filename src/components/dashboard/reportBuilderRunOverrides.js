function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function applySavedReportRunOverride(response = null, override = null) {
    if (!response || typeof response !== "object" || Array.isArray(response)) return response;
    if (!override || typeof override !== "object" || Array.isArray(override)) return response;
    const next = cloneValue(response);
    const params = Array.isArray(next?.document?.scope?.params) ? next.document.scope.params : [];
    const from = normalizeString(override.from);
    const to = normalizeString(override.to);
    const orderIds = Array.isArray(override.orderIds) ? override.orderIds : [];
    next.document.scope = {
        ...(next.document.scope || {}),
        params: params.map((param) => {
            const id = normalizeString(param?.id);
            if (id === "dateRange" && from && to) {
                return { ...param, value: { start: from, end: to } };
            }
            if (id === "orderIds" && orderIds.length > 0) {
                return { ...param, value: cloneValue(orderIds) };
            }
            return param;
        }),
    };
    return next;
}

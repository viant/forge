import { resolveSelector } from "../utils/selector.js";

export function normalizeSelectorLookupKey(value) {
    if (Array.isArray(value)) {
        return normalizeSelectorLookupKey(value[0]);
    }
    if (value == null) {
        return null;
    }
    if (typeof value === "object") {
        if (value.value != null) return normalizeSelectorLookupKey(value.value);
        if (value.id != null) return normalizeSelectorLookupKey(value.id);
        if (value.key != null) return normalizeSelectorLookupKey(value.key);
        return null;
    }
    return String(value);
}

export function resolveChartDataSourceRef(baseContext, chart = {}) {
    const defaultRef = String(baseContext?.identity?.dataSourceRef || "").trim() || null;
    if (!chart || typeof chart !== "object" || Array.isArray(chart)) {
        return defaultRef;
    }
    const refs = chart.dataSourceRefs || {};
    const selector = String(chart.dataSourceRefSelector || chart.dataSourceSelector || "").trim();
    const source = String(chart.dataSourceRefSource || "windowForm").trim().toLowerCase();
    const explicitRef = String(chart.dataSourceRef || "").trim();
    if (explicitRef) {
        return explicitRef;
    }
    if (!selector || !refs || typeof refs !== "object" || Array.isArray(refs)) {
        return defaultRef;
    }
    let scope = {};
    switch (source) {
        case "form":
            scope = baseContext?.signals?.form?.value || baseContext?.signals?.form?.peek?.() || {};
            break;
        case "filter":
        case "filters":
            scope = baseContext?.handlers?.dataSource?.peekFilter?.() || {};
            break;
        case "input":
            scope = baseContext?.signals?.input?.value || baseContext?.signals?.input?.peek?.() || {};
            break;
        case "windowform":
        default:
            scope = baseContext?.signals?.windowForm?.value || baseContext?.signals?.windowForm?.peek?.() || {};
            break;
    }
    const key = normalizeSelectorLookupKey(resolveSelector(scope, selector));
    if (key == null) {
        return defaultRef;
    }
    const mapped = String(refs[key] || "").trim();
    return mapped || defaultRef;
}

import { resolveKey } from "../../utils/selector.js";

function hasPresentDashboardTableValue(value) {
    return value !== undefined && value !== null && value !== '';
}

function resolveDisplayValueMapValue(column = {}, value = undefined) {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    const displayValueMap = column?.displayValueMap && typeof column.displayValueMap === 'object' && !Array.isArray(column.displayValueMap)
        ? column.displayValueMap
        : null;
    if (!displayValueMap) {
        return undefined;
    }
    const key = String(value);
    return Object.prototype.hasOwnProperty.call(displayValueMap, key)
        ? displayValueMap[key]
        : undefined;
}

export function resolveDashboardTableColumnValue(row = {}, column = {}, {preferDisplay = true} = {}) {
    const sourceKey = String(column?.sourceKey || column?.key || column?.field || column?.id || '').trim();
    const displayKey = String(column?.displayKey || '').trim();
    const canResolveDisplayPath = !!displayKey && displayKey !== sourceKey;
    if (preferDisplay && canResolveDisplayPath) {
        const displayValue = resolveKey(row, displayKey);
        if (hasPresentDashboardTableValue(displayValue)) {
            return displayValue;
        }
    }
    const sourceValue = sourceKey ? resolveKey(row, sourceKey) : undefined;
    const mappedDisplayValue = resolveDisplayValueMapValue(column, sourceValue);
    if (preferDisplay && hasPresentDashboardTableValue(mappedDisplayValue)) {
        return mappedDisplayValue;
    }
    if (hasPresentDashboardTableValue(sourceValue)) {
        return sourceValue;
    }
    if (!preferDisplay && canResolveDisplayPath) {
        const displayValue = resolveKey(row, displayKey);
        if (hasPresentDashboardTableValue(displayValue)) {
            return displayValue;
        }
    }
    if (!preferDisplay && hasPresentDashboardTableValue(mappedDisplayValue)) {
        return mappedDisplayValue;
    }
    return sourceValue;
}

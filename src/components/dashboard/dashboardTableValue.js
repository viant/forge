import { resolveKey } from "../../utils/selector.js";

function hasPresentDashboardTableValue(value) {
    return value !== undefined && value !== null && value !== '';
}

export function resolveDashboardTableColumnValue(row = {}, column = {}, {preferDisplay = true} = {}) {
    const sourceKey = String(column?.sourceKey || column?.key || column?.field || column?.id || '').trim();
    const displayKey = String(column?.displayKey || '').trim();
    if (preferDisplay && displayKey) {
        const displayValue = resolveKey(row, displayKey);
        if (hasPresentDashboardTableValue(displayValue)) {
            return displayValue;
        }
    }
    const sourceValue = sourceKey ? resolveKey(row, sourceKey) : undefined;
    if (hasPresentDashboardTableValue(sourceValue)) {
        return sourceValue;
    }
    if (!preferDisplay && displayKey) {
        const displayValue = resolveKey(row, displayKey);
        if (hasPresentDashboardTableValue(displayValue)) {
            return displayValue;
        }
    }
    return sourceValue;
}

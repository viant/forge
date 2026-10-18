function safeUniqueKey(getUniqueKeyValue, value) {
    try {
        const resolved = getUniqueKeyValue(value);
        return resolved == null ? '' : String(resolved);
    } catch (_) {
        return '';
    }
}

export function reconcileMultiSelection(currentSelection = {}, records = [], getUniqueKeyValue, options = {}) {
    const rowsByKey = new Map();
    for (const row of Array.isArray(records) ? records : []) {
        const key = safeUniqueKey(getUniqueKeyValue, row);
        if (key) rowsByKey.set(key, row);
    }
    const previousKeys = new Set((options.previousRecords || []).map(row => safeUniqueKey(getUniqueKeyValue,row)));
    const selected = [];
    for (const row of Array.isArray(currentSelection?.selection) ? currentSelection.selection : []) {
        const key = safeUniqueKey(getUniqueKeyValue, row);
        if (key && rowsByKey.has(key)) selected.push(rowsByKey.get(key));
        else if (key && options.preserveOffPage && (options.pageChanged || !previousKeys.has(key))) selected.push(row);
    }
    return {selection: selected};
}

export function reconcileSingleSelection(currentSelection = {}, records = [], getUniqueKeyValue) {
    const selectedKey = safeUniqueKey(getUniqueKeyValue, currentSelection?.selected);
    if (!selectedKey) return {selected: null, rowIndex: -1};
    const rows = Array.isArray(records) ? records : [];
    const rowIndex = rows.findIndex((row) => safeUniqueKey(getUniqueKeyValue, row) === selectedKey);
    if (rowIndex < 0) return {selected: null, rowIndex: -1};
    return {selected: rows[rowIndex], rowIndex};
}

function normalizeKeys(keys = []) {
    return Array.isArray(keys)
        ? keys
            .map((key) => String(key ?? "").trim())
            .filter((key, index, values) => key && values.indexOf(key) === index)
        : [];
}

export function reconcileSelectedDataKeys(selectedDataKeys = [], availableDataKeys = [], options = {}) {
    const available = normalizeKeys(availableDataKeys);
    const selected = normalizeKeys(selectedDataKeys);
    const initialized = options.initialized === true;
    const touched = options.touched === true;

    if (!initialized) {
        if (available.length === 0) {
            return {
                selectedDataKeys: selected,
                initialized: false,
            };
        }
        return {
            selectedDataKeys: available,
            initialized: true,
        };
    }

    const filtered = selected.filter((key) => available.includes(key));
    if (!touched) {
        const missing = available.filter((key) => !filtered.includes(key));
        if (missing.length > 0) {
            return {
                selectedDataKeys: [...filtered, ...missing],
                initialized: true,
            };
        }
    }

    return {
        selectedDataKeys: filtered,
        initialized: true,
    };
}

export function toggleSelectedDataKey(selectedDataKeys = [], dataKey = "") {
    const normalizedKey = String(dataKey ?? "").trim();
    if (!normalizedKey) {
        return normalizeKeys(selectedDataKeys);
    }
    const selected = normalizeKeys(selectedDataKeys);
    if (selected.includes(normalizedKey)) {
        return selected.filter((key) => key !== normalizedKey);
    }
    return [...selected, normalizedKey];
}

function normalizeString(value = "") {
    return String(value || "").trim();
}

export function placeReportBuilderTableColumnKeyRelative(columnKeys = [], columnKey = "", targetKey = "", placement = "before") {
    const normalizedColumnKeys = Array.isArray(columnKeys)
        ? columnKeys.map((entry) => normalizeString(entry)).filter(Boolean)
        : [];
    const normalizedColumnKey = normalizeString(columnKey);
    const normalizedTargetKey = normalizeString(targetKey);
    const normalizedPlacement = normalizeString(placement).toLowerCase() === "after"
        ? "after"
        : "before";
    if (!normalizedColumnKey) {
        return normalizedColumnKeys;
    }
    const nextColumnKeys = normalizedColumnKeys.filter((key) => key !== normalizedColumnKey);
    if (!normalizedTargetKey || !nextColumnKeys.includes(normalizedTargetKey)) {
        nextColumnKeys.push(normalizedColumnKey);
        return nextColumnKeys;
    }
    const targetIndex = nextColumnKeys.indexOf(normalizedTargetKey);
    const insertionIndex = normalizedPlacement === "after"
        ? targetIndex + 1
        : targetIndex;
    nextColumnKeys.splice(insertionIndex, 0, normalizedColumnKey);
    return nextColumnKeys;
}

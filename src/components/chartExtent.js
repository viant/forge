// Go metadata serializes chart extents as strings. React needs numeric values
// for implicit pixel dimensions; CSS strings must retain their explicit units.
export function normalizeChartExtent(value, fallback) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (typeof value !== 'string') return fallback;
    const normalized = value.trim();
    if (!normalized) return fallback;
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) {
        const numeric = Number(normalized);
        return Number.isFinite(numeric) ? numeric : fallback;
    }
    return normalized;
}

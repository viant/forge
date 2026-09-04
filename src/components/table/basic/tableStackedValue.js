export function resolveTableStackedValue(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return {
            meta: String(value.meta ?? ''),
            title: String(value.title ?? ''),
            body: String(value.body ?? ''),
            expandLabel: String(value.expandLabel || 'Expand'),
        };
    }
    return {meta: '', title: '', body: String(value ?? ''), expandLabel: 'Expand'};
}

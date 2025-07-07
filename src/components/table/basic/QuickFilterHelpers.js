// Helper functions shared by quick filter toolbar components.

export function resolveQuickFilterSet(context) {
    const { dataSource } = context || {};
    if (!dataSource) return null;

    const qfRef = dataSource.quickFilterSet;
    const sets = dataSource.filterSet || [];
    let set = null;
    if (typeof qfRef === 'number') {
        set = sets[qfRef];
    } else if (typeof qfRef === 'string') {
        set = sets.find((s) => s.name === qfRef);
    }
    return set;
}

export function isQuickFiltersActive(context, filters) {
    const current = context?.handlers?.dataSource?.peekFilter?.() || {};
    return filters.some((f) => {
        const v = current[f.field];
        return v !== undefined && v !== '' && v !== null;
    });
}

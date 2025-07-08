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

    if (!set) return null;

    // If no explicit `filters` array is provided, fall back to `template` so that
    // metadata authors don't have to duplicate essentially the same list twice.
    if ((!set.filters || set.filters.length === 0) && Array.isArray(set.template)) {
        set = {
            ...set,
            filters: set.template.map((tpl) => ({
                field: tpl.id,
                placeholder: tpl.label || tpl.id,
                // default icon/width can be overridden later if needed.
            })),
        };
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

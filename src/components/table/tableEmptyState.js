export function shouldRenderTableEmptyState({emptyState, collection, loading, error} = {}) {
    return !!emptyState && !loading && !error && Array.isArray(collection) && collection.length === 0;
}

export function filterEmptyStateToolbarItems(items = [], emptyState = {}, visible = false) {
    if (!visible) return Array.isArray(items) ? items : [];
    const hidden = new Set(Array.isArray(emptyState?.hideToolbarItems) ? emptyState.hideToolbarItems : []);
    return (Array.isArray(items) ? items : []).filter((item) => !hidden.has(item?.id));
}

export function resolveTableEmptyState(emptyState = {}, filter = {}) {
    const hasFilter = Object.values(filter || {}).some((value) => (
        value !== undefined && value !== null && String(value).trim() !== ''
    ));
    if (!hasFilter || !emptyState?.filtered) return emptyState;
    return {...emptyState, ...emptyState.filtered, filtered: emptyState.filtered};
}

export function shouldRenderTableEmptyState({emptyState, collection, loading, error} = {}) {
    return !!emptyState && !loading && !error && Array.isArray(collection) && collection.length === 0;
}

export function filterEmptyStateToolbarItems(items = [], emptyState = {}, visible = false) {
    if (!visible) return Array.isArray(items) ? items : [];
    const hidden = new Set(Array.isArray(emptyState?.hideToolbarItems) ? emptyState.hideToolbarItems : []);
    return (Array.isArray(items) ? items : []).filter((item) => !hidden.has(item?.id));
}

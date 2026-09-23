export function reportLoadingProgress(datasets = [], state = {}, loading = false) {
    const ids = [...new Set(datasets.map(item => item.id).filter(Boolean))];
    const settled = new Set(state.freshDatasetIds || []);
    const completed = new Set(state.settledDatasetIds || state.freshDatasetIds || []);
    const failed = ids.filter(id => completed.has(id) && (state.payloads?.[id]?.diagnostics || []).some(item => item.severity === 'error'));
    const pending = loading ? ids.filter(id => !settled.has(id) && !failed.includes(id)) : [];
    return {total: ids.length, ready: ids.filter(id => settled.has(id) && !failed.includes(id)).length,
        failed: failed.length, pending};
}

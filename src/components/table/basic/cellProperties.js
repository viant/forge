export const applyDynamicCellProperties = (properties = {}, stateEvents = {}) => {
    const result = {...properties};
    if (typeof stateEvents.onProperties !== 'function') return result;
    try {
        const dynamic = stateEvents.onProperties();
        if (dynamic && typeof dynamic === 'object' && !Array.isArray(dynamic)) {
            Object.assign(result, dynamic);
        }
    } catch (_) {
        // State-property handlers are presentation helpers and must not break a table row.
    }
    return result;
};

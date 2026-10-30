export function requestServerTableSort({dataSource = {}, handlers = {}, columnId = '', direction = 'asc'} = {}) {
    const serverSort = String(dataSource?.sortMode || '').toLowerCase() === 'server';
    const remoteSource = !!dataSource?.service || !!dataSource?.backend;
    if (!serverSort || !remoteSource) return false;
    const mapping = dataSource?.sortMapping;
    if (mapping && typeof mapping === 'object') {
        const parameter = String(mapping.parameter || '').trim();
        const template = String(mapping.template || '').trim();
        const mappedField = String(mapping.fields?.[columnId] || '').trim();
        if (!parameter || !template || !mappedField) return false;
        const normalizedDirection = String(direction || '').toLowerCase() === 'desc' ? 'desc' : 'asc';
        const mappedValues = serverTableSortValues({template, thenBy: mapping.thenBy}, mappedField, normalizedDirection);
        handlers?.dataSource?.setSort?.({
            columnId,
            direction: normalizedDirection,
            fetch: true,
            parameter,
            value: mappedValues,
        });
        return true;
    }
    handlers?.dataSource?.setSort?.({columnId, direction, fetch: true});
    return true;
}

// Shared value normalization for mapped producer ordering and stable tie-breakers.
export function serverTableSortValues(mapping, field, direction) {
    const render = value => String(value || '').trim().split('{{field}}').join(field).split('{{direction}}').join(direction);
    return [...new Set([render(mapping.template), ...(Array.isArray(mapping.thenBy) ? mapping.thenBy : []).map(render)].filter(Boolean))];
}

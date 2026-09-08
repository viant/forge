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
        const mappedValue = template
            .split('{{field}}').join(mappedField)
            .split('{{direction}}').join(normalizedDirection);
        handlers?.dataSource?.setSort?.({
            columnId,
            direction: normalizedDirection,
            fetch: true,
            parameter,
            value: [mappedValue],
        });
        return true;
    }
    handlers?.dataSource?.setSort?.({columnId, direction, fetch: true});
    return true;
}

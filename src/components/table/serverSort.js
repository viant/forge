export function requestServerTableSort({dataSource = {}, handlers = {}, columnId = '', direction = 'asc'} = {}) {
    const serverSort = String(dataSource?.sortMode || '').toLowerCase() === 'server';
    const remoteSource = !!dataSource?.service || !!dataSource?.backend;
    if (!serverSort || !remoteSource) return false;
    handlers?.dataSource?.setSort?.({columnId, direction, fetch: true});
    return true;
}

export function shouldRefreshDialogDataSourceOnOpen(dataSource = {}) {
    return dataSource?.preserveDialogStateOnReopen !== true;
}

export function inlineDialogSeedRows(dataSource = {}) {
    if (String(dataSource?.backend?.kind || '').trim().toLowerCase() !== 'inline') return [];
    const rows = Array.isArray(dataSource?.backend?.rows) ? dataSource.backend.rows : [];
    return rows.map((row) => ({...(row || {})}));
}

export function dialogFreshFormSeed(dataSource = {}, currentCollection = []) {
    const configured = inlineDialogSeedRows(dataSource);
    const source = configured.length > 0
        ? configured[0]
        : (Array.isArray(currentCollection) ? currentCollection[0] : null);
    return source && typeof source === 'object' ? {...source} : {};
}

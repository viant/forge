export function shouldRefreshDialogDataSourceOnOpen(dataSource = {}) {
    return dataSource?.preserveDialogStateOnReopen !== true;
}

export function shouldRefreshDialogDataSourceForMount(dataSource = {}, focusRequest = 0, lastHandledFocusRequest = null) {
    if (dataSource?.preserveDialogStateOnReopen !== true) return true;
    const revision = Number(focusRequest || 0);
    return !(revision > 0 && revision === Number(lastHandledFocusRequest || 0));
}

const dialogFocusRevisionByOwner = new WeakMap();

export function consumeDialogFocusRevision(owner, dialogId, focusRequest = 0) {
    if (!owner || (typeof owner !== 'object' && typeof owner !== 'function')) return null;
    let revisions = dialogFocusRevisionByOwner.get(owner);
    if (!revisions) {
        revisions = new Map();
        dialogFocusRevisionByOwner.set(owner, revisions);
    }
    const key = String(dialogId || '');
    const previous = revisions.has(key) ? revisions.get(key) : null;
    revisions.set(key, Number(focusRequest || 0));
    return previous;
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

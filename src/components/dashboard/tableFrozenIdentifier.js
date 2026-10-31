function columnKey(column = {}) {
    return String(column?.key || column?.field || column?.id || '').trim();
}

function hasIdentifierKey(column = {}) {
    // Preserve camelCase boundaries before case folding: "fluid" has no ID token.
    const tokens = columnKey(column)
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .split(/[^a-zA-Z0-9]+/);
    return /^id$/i.test(tokens.at(-1) || '');
}

function isIdentifierColumn(column = {}) {
    const label = String(column?.label || '');
    return hasIdentifierKey(column) || /(?:^|[^a-zA-Z0-9])id(?:$|[^a-zA-Z0-9])/i.test(label)
        || `${columnKey(column)} ${label}`.toLowerCase().includes('code');
}

export function compactTableColumnWidth(column = {}) {
    const explicit = Number(column?.width);
    if (Number.isFinite(explicit) && explicit > 0) return Math.max(76, Math.min(280, explicit));
    const key = columnKey(column).toLowerCase();
    const semantic = `${key} ${String(column?.label || '').toLowerCase()}`;
    if (isIdentifierColumn(column)) return 96;
    if (semantic.includes('rationale') || semantic.includes('reason') || semantic.includes('description')) return 260;
    if (semantic.includes('publisher') || semantic.includes('audience') || semantic.includes('metropolitan') || semantic.includes('deal') || semantic.includes('site') || key === 'name') return 220;
    if (semantic.includes('impression') || semantic.includes('budget') || semantic.includes('cost') || semantic.includes('reach')) return 124;
    if (semantic.includes('percent') || semantic.includes('mix') || semantic.includes('ecpm') || semantic.includes('cpm') || semantic.includes('count') || semantic.includes('interval')) return 104;
    if (semantic.includes('media') || semantic.includes('channel') || semantic.includes('provider') || semantic.includes('type') || semantic.includes('days') || semantic.includes('hours') || semantic.includes('frequency')) return 128;
    return 148;
}

export function frozenIdentifierColumn(columns = []) {
    const list = Array.isArray(columns) ? columns : [];
    const explicit = list.find((column) => column?.frozen === true);
    if (explicit) return explicit;
    const named = list.find((column) => {
        const key = columnKey(column).toLowerCase();
        const semantic = `${key} ${String(column?.label || '').toLowerCase()}`;
        return !hasIdentifierKey(column) && (key === 'name' || semantic.includes(' name') || semantic.includes('audience') || semantic.includes('publisher') || semantic.includes('metropolitan') || semantic.includes('deal'));
    });
    if (named) return named;
    return list.find(isIdentifierColumn) || list[0] || null;
}

export function withFrozenIdentifierColumn(columns = []) {
    const list = Array.isArray(columns) ? columns : [];
    const frozen = frozenIdentifierColumn(list);
    if (!frozen) return [];
    const decorate = (column, isFrozen) => ({
        ...column,
        frozen: isFrozen,
        resolvedCompactWidth: compactTableColumnWidth(column),
    });
    return [decorate(frozen, true), ...list.filter((column) => column !== frozen).map((column) => decorate(column, false))];
}

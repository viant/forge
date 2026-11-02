export function compactTableColumnWidth(column = {}) {
    const explicit = Number(column?.width);
    if (Number.isFinite(explicit) && explicit > 0) return Math.max(76, Math.min(280, explicit));
    return 148;
}

export function frozenIdentifierColumn(columns = []) {
    const list = Array.isArray(columns) ? columns : [];
    // Source order is authoritative. Only explicit presentation metadata may
    // move another column into the leading frozen position.
    return list.find((column) => column?.frozen === true) || list[0] || null;
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

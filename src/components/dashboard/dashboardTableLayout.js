function numericWidth(value) {
    const numeric = Number.parseFloat(String(value ?? ""));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

export function resolveDashboardTableColumnMinWidth(column = {}, index = 0) {
    const authored = numericWidth(column?.width);
    if (authored > 0) {
        // Report columns admit authored widths from 48px; inferred compact
        // widths and legacy out-of-contract values keep their existing floor.
        return Math.max(authored >= 48 ? 48 : 112, Math.min(320, Math.round(authored)));
    }
    const compact = numericWidth(column?.resolvedCompactWidth);
    if (compact > 0) {
        return Math.max(112, Math.min(320, Math.round(compact)));
    }
    if (column?.frozen === true || index === 0) {
        return 148;
    }
    return 128;
}

export function buildDashboardTableLayout(columns = [], {
    multiSelect = false,
    hasRowActions = false,
} = {}) {
    const normalizedColumns = Array.isArray(columns) ? columns : [];
    const columnWidths = normalizedColumns.map(resolveDashboardTableColumnMinWidth);
    const selectionWidth = multiSelect ? 42 : 0;
    const actionsWidth = hasRowActions ? 300 : 0;
    return {
        columnWidths,
        selectionWidth,
        actionsWidth,
        minWidth: Math.max(240, selectionWidth + actionsWidth + columnWidths.reduce((sum, width) => sum + width, 0)),
        horizontallyScrollable: normalizedColumns.length >= 3 || hasRowActions,
    };
}

// Opt-in document tables keep authored order and let one long-text column grow.
// Numeric widths are layout metadata, never workspace colors or typography.
export function documentTableLayout(columns = [], {hasRowActions = false, multiSelect = false} = {}) {
    const flexible = columns.some(column => column.flex === true);
    const textIndex = columns.findIndex(column => column.kind === 'dimension'
        && !/id$/i.test(column.key) && !/date/i.test(column.format || column.key));
    const defaultFlexibleIndex = textIndex < 0 ? 0 : textIndex;
    const columnWidths = columns.map((column, index) => column.flex === true || (!flexible && index === defaultFlexibleIndex)
        ? null : Math.max(48, Number(column.width) || 112));
    const actionsWidth = hasRowActions ? 56 : 0;
    const selectionWidth = multiSelect ? 42 : 0;
    return {columnWidths, actionsWidth, selectionWidth, horizontallyScrollable: true,
        minWidth: actionsWidth + selectionWidth + columns.reduce((sum, column, index) => sum +
            (columnWidths[index] || Math.max(160, Number(column.minWidth) || 240)), 0)};
}

export function documentTableColumns(columns = [], presentation) {
    if (presentation?.variant && presentation.variant !== 'document') throw new Error(`Unsupported table variant: ${presentation.variant}`);
    if (presentation?.variant !== 'document') return columns;
    const field = presentation.rowDetails?.field;
    if (field) {
        const detail = columns.find(column => column.key === field);
        if (!detail || detail.editor !== false) throw new Error('Document row details require an existing read-only column');
    }
    return columns.filter(column => column.key !== field).map(column => ({...column, frozen: false}));
}

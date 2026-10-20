const DEFAULT_WIDTH = 120;

export function preserveDeclaredColumnWidths(columns = []) {
    return (Array.isArray(columns) ? columns : []).map((column) => {
        const width = Number.parseFloat(column?.minWidth || column?.width) || DEFAULT_WIDTH;
        return {...column, minWidth: `${Math.max(42, width)}px`};
    });
}

export function scrollableTableWidth(columns = [], viewportWidth = 0) {
    const declared = (Array.isArray(columns) ? columns : []).reduce((total, column) => {
        const width = Number.parseFloat(column?.minWidth) || Number(column?.width) || DEFAULT_WIDTH;
        return total + Math.max(42, width);
    }, 0);
    return Math.max(Number(viewportWidth) || 0, declared);
}

export function withStickyColumnOffsets(columns = [], viewportWidth = 0) {
    const source = Array.isArray(columns) ? columns : [];
    let left = 0;
    const sized = source.map((column, index) => {
        const stickyLeft = String(column?.sticky || '').trim().toLowerCase() === 'left';
        if (!stickyLeft) return {...column, stickyOffset: undefined, stickyEdge: false};
        const width = Math.max(42, Number.parseFloat(column?.minWidth) || Number(column?.width) || DEFAULT_WIDTH);
        // Leave at least half the viewport available for scrolling data.
        if (viewportWidth > 0 && left + width > viewportWidth / 2) return {...column, sticky: false, stickyOffset: undefined, stickyEdge: false};
        const nextSticky = String(source[index + 1]?.sticky || '').trim().toLowerCase() === 'left';
        const result = {...column, stickyOffset: left, stickyEdge: !nextSticky};
        left += width;
        return result;
    });
    return sized.map((column,index)=>({...column, stickyEdge: column.stickyOffset != null && sized[index+1]?.stickyOffset == null}));
}

export function tableBackfillCount(pagingSize = 0, rowCount = 0, loading = false) {
    const size = Math.max(0, Number(pagingSize) || 0);
    const count = Math.max(0, Number(rowCount) || 0);
    if (loading && size > count) return size - count;
    return count === 0 ? 1 : 0;
}

export function tableRowSlots(table = {}, rowCount = 0) {
    const minRows = Math.max(0, Math.min(100, Math.floor(Number(table.minRows) || 0)));
    const fixed = minRows > 0 || Number(table.rowHeight) > 0;
    return {minRows, rowHeight: fixed ? Math.max(24, Math.min(96, Number(table.rowHeight) || 32)) : 0,
        blanks: Math.max(0, minRows - Math.max(0, rowCount))};
}

// Base width comes from declared visible columns, never the ResizeObserver's
// current viewport measurement; this avoids self-expanding feedback loops.
export function tableSurfaceWidth(table = {}, columns = [], availableWidth = 0) {
    if (table.width != null && table.width !== '') return table.width;
    const naturalWidth = scrollableTableWidth(columns);
    if (table.fillRemainingWidth === true || table.fullWidth === true || (table.fullWidth !== false && availableWidth > 0 && naturalWidth >= availableWidth * 0.5)) return '100%';
    return `min(100%, ${naturalWidth + 2}px)`;
}

export function tableTrailingSpace(columns = [], viewportWidth = 0) {
    const widths = columns.map(column => Math.max(42, Number.parseFloat(column.minWidth) || Number.parseFloat(column.width) || 120));
    const naturalWidth = widths.reduce((sum,width)=>sum+width,0);
    return {widths, naturalWidth, fillerWidth: Math.max(0,(Number(viewportWidth)||0)-naturalWidth)};
}

// Nested tables must fit the scrollport that contains them, including dialog
// bodies whose footer sits above the browser's bottom edge.
export function tableAvailableHeight(element, viewportBottom, readStyle = getComputedStyle) {
    let bottom = viewportBottom - 16;
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const style = readStyle(ancestor);
        if (!['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowY) || ancestor.clientHeight <= 0) continue;
        const box = ancestor.getBoundingClientRect();
        const padding = Number.parseFloat(style.paddingBottom) || 0;
        // A max-height body is content-sized until rows arrive. Measuring its
        // current height would feed the table's previous cap back into itself.
        const maximum = /px$/.test(style.maxHeight) ? Number.parseFloat(style.maxHeight) : NaN;
        const borders = (Number.parseFloat(style.borderTopWidth) || 0) + (Number.parseFloat(style.borderBottomWidth) || 0);
        const paddingTop = Number.parseFloat(style.paddingTop) || 0;
        const height = Number.isFinite(maximum)
            ? style.boxSizing === 'border-box' ? maximum - borders : maximum + paddingTop + padding
            : ancestor.clientHeight;
        bottom = Math.min(bottom, box.top + (ancestor.clientTop || 0) + height - padding);
    }
    return Math.max(160, bottom - element.getBoundingClientRect().top);
}

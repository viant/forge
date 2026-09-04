const DEFAULT_WIDTH = 120;

export function preserveDeclaredColumnWidths(columns = []) {
    return (Array.isArray(columns) ? columns : []).map((column) => {
        const width = Number(column?.minWidth || column?.width || DEFAULT_WIDTH);
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

export function withStickyColumnOffsets(columns = []) {
    const source = Array.isArray(columns) ? columns : [];
    let left = 0;
    return source.map((column, index) => {
        const stickyLeft = String(column?.sticky || '').trim().toLowerCase() === 'left';
        if (!stickyLeft) return {...column, stickyOffset: undefined, stickyEdge: false};
        const width = Math.max(42, Number.parseFloat(column?.minWidth) || Number(column?.width) || DEFAULT_WIDTH);
        const nextSticky = String(source[index + 1]?.sticky || '').trim().toLowerCase() === 'left';
        const result = {...column, stickyOffset: left, stickyEdge: !nextSticky};
        left += width;
        return result;
    });
}

export function tableBackfillCount(pagingSize = 0, rowCount = 0, loading = false) {
    const size = Math.max(0, Number(pagingSize) || 0);
    const count = Math.max(0, Number(rowCount) || 0);
    if (loading && size > count) return size - count;
    return count === 0 ? 1 : 0;
}

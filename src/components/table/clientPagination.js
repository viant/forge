export function resolveClientPagination(collection = [], requestedPage = 1, pageSize = 0, enabled = false) {
    const rows = Array.isArray(collection) ? collection : [];
    const size = Math.max(0, Number(pageSize) || 0);
    if (!enabled || size === 0) {
        return {rows, page: 1, pageCount: rows.length ? 1 : 0, recordCount: rows.length};
    }
    const pageCount = Math.max(1, Math.ceil(rows.length / size));
    const page = Math.min(Math.max(1, Number(requestedPage) || 1), pageCount);
    const start = (page - 1) * size;
    return {rows: rows.slice(start, start + size), page, pageCount, recordCount: rows.length};
}

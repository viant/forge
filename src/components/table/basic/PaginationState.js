function normalizePositiveInteger(value = 0) {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : 0;
}

function normalizeNonNegativeInteger(value) {
    if (value == null || value === '') return null;
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null;
}

export function resolvePaginationState({
    info = {},
    inputPage = 0,
    fallbackPage = 1,
    inactive = false,
    loading = false,
    loadedRowCount = 0,
} = {}) {
    const initialLoading = loading === true && normalizeNonNegativeInteger(loadedRowCount) === 0;
    const pageCount = normalizePositiveInteger(info?.pageCount || info?.totalPages);
    const requestedPage = normalizePositiveInteger(inputPage)
        || normalizePositiveInteger(info?.currentPage || info?.page)
        || normalizePositiveInteger(fallbackPage)
        || 1;
    const currentPage = inactive
        ? 1
        : (pageCount > 0 ? Math.min(requestedPage, pageCount) : requestedPage);
    const pageSize = normalizePositiveInteger(info?.pageSize);
    const returnedCount = normalizeNonNegativeInteger(info?.returnedCount);
    const hasMore = typeof info?.hasMore === 'boolean'
        ? info.hasMore
        : (pageCount === 0 && pageSize > 0 && returnedCount != null ? returnedCount >= pageSize : null);
    return {
        currentPage,
        totalPages: initialLoading ? null : (pageCount > 0 ? pageCount : null),
        recordCount: initialLoading ? null : normalizeNonNegativeInteger(info?.totalCount ?? info?.recordCount),
        hasMore: initialLoading ? null : hasMore,
        initialLoading,
    };
}

export function paginationStatusLabel({initialLoading = false, currentPage = 1, totalPages = null, recordCount = null} = {}) {
    if (initialLoading) return 'Loading records…';
    const pageLabel = totalPages != null ? `Page ${currentPage} of ${totalPages}` : `Page ${currentPage}`;
    const countLabel = recordCount != null
        ? ` (${recordCount} ${recordCount === 1 ? 'record' : 'records'})`
        : '';
    return `${pageLabel}${countLabel}`;
}

export function compactPaginationStatusLabel({initialLoading = false, currentPage = 1, totalPages = null, recordCount = null} = {}) {
    if (initialLoading) return 'Loading…';
    const pageLabel = totalPages != null ? `${currentPage} / ${totalPages}` : `Page ${currentPage}`;
    return recordCount != null ? `${pageLabel} · ${Number(recordCount).toLocaleString('en-US')}` : pageLabel;
}

export function canNavigateNext({inactive = false, initialLoading = false, currentPage = 1, totalPages = null, recordCount = null, hasMore = null} = {}) {
    if (inactive || initialLoading || recordCount === 0) return false;
    if (totalPages != null) return currentPage < totalPages;
    return hasMore === true;
}

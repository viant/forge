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
} = {}) {
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
        totalPages: pageCount > 0 ? pageCount : null,
        recordCount: normalizeNonNegativeInteger(info?.totalCount ?? info?.recordCount),
        hasMore,
    };
}

export function canNavigateNext({inactive = false, currentPage = 1, totalPages = null, recordCount = null, hasMore = null} = {}) {
    if (inactive || recordCount === 0) return false;
    if (totalPages != null) return currentPage < totalPages;
    return hasMore === true;
}

function normalizePositiveInteger(value = 0) {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : 0;
}

function normalizeNonNegativeInteger(value = null) {
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
    return {
        currentPage,
        totalPages: pageCount > 0 ? pageCount : null,
        recordCount: normalizeNonNegativeInteger(info?.totalCount ?? info?.recordCount),
    };
}

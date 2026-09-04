function isPlainObject(value = null) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizePositiveInteger(value = 0) {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : 0;
}

function normalizeNonNegativeInteger(value) {
    if (value == null || value === '') return null;
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null;
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function buildStableSnapshot(value = null) {
    if (Array.isArray(value)) {
        return value.map((entry) => buildStableSnapshot(entry));
    }
    if (!isPlainObject(value)) {
        return value ?? null;
    }
    return Object.keys(value)
        .sort()
        .reduce((accumulator, key) => {
            accumulator[key] = buildStableSnapshot(value[key]);
            return accumulator;
        }, {});
}

function snapshotSignature(value = null) {
    try {
        return JSON.stringify(buildStableSnapshot(value));
    } catch (_) {
        return "";
    }
}

export function snapshotFilter(filter = {}) {
    return buildStableSnapshot(filter);
}

export function resolveFetchPage({
    page = 1,
    filter = {},
    previousFilter = {},
    pagingEnabled = false,
} = {}) {
    if (!pagingEnabled) {
        return page;
    }
    const normalizedPage = normalizePositiveInteger(page) || 1;
    return snapshotSignature(filter) === snapshotSignature(previousFilter)
        ? normalizedPage
        : 1;
}

export function withFetchedPageInfo(info = {}, page = 1, pagingEnabled = false, pageResult = {}) {
    const base = isPlainObject(info) ? cloneValue(info) : {};
    if (!pagingEnabled) {
        return base;
    }
    const returnedCount = normalizeNonNegativeInteger(pageResult?.returnedCount);
    const pageSize = normalizePositiveInteger(pageResult?.pageSize);
    const inconsistentEmptySummary = returnedCount > 0
        && normalizeNonNegativeInteger(base.totalCount ?? base.recordCount) === 0;
    if (inconsistentEmptySummary) {
        delete base.pageCount;
        delete base.totalPages;
        delete base.totalCount;
        delete base.recordCount;
    }
    const pageCount = inconsistentEmptySummary
        ? 0
        : normalizePositiveInteger(base.pageCount || base.totalPages);
    const totalCount = inconsistentEmptySummary
        ? null
        : normalizeNonNegativeInteger(base.totalCount ?? base.recordCount);
    const requestedPage = normalizePositiveInteger(page)
        || normalizePositiveInteger(base.currentPage || base.page)
        || 1;
    const currentPage = pageCount > 0
        ? Math.min(requestedPage, pageCount)
        : requestedPage;
    const hasPrevious = currentPage > 1;
    const hasNext = pageCount > 0
        ? currentPage < pageCount
        : (returnedCount != null && pageSize > 0
            ? returnedCount >= pageSize
            : base.hasNext === true);
    const hasMore = base.hasMore === true || hasNext;
    return {
        ...base,
        currentPage,
        page: currentPage,
        ...(pageCount > 0 ? { pageCount, totalPages: pageCount } : {}),
        ...(totalCount != null ? { totalCount, recordCount: totalCount } : {}),
        ...(returnedCount != null ? { returnedCount } : {}),
        ...(pageSize > 0 ? { pageSize } : {}),
        hasPrevious,
        hasNext,
        hasMore,
    };
}

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

export function shouldReplayPendingFetchOnMount(dataSource = {}, fetch = false) {
    return !fetch || dataSource?.replayPendingFetchOnRestore !== false;
}

export const RESTORED_PENDING_FETCH = "__forgeRestoredPendingFetch";

export function resolveRestoredPendingFetch(dataSource = {}, input = {}) {
    if (input?.[RESTORED_PENDING_FETCH] !== true) return null;
    const {[RESTORED_PENDING_FETCH]: _restored, ...nextInput} = input || {};
    return {
        ...nextInput,
        fetch: dataSource?.replayPendingFetchOnRestore !== false && nextInput.fetch === true,
        refresh: false,
    };
}

export function reconcileRestoredPendingFetch(dataSource = {}, input = {}, control = {}) {
    const nextInput = resolveRestoredPendingFetch(dataSource, input);
    if (!nextInput) return null;
    return {
        input: nextInput,
        control: control?.loading === true
            ? {...(control || {}), loading: false, stale: nextInput.fetch === true}
            : control,
    };
}

export function beginDataSourceFetch(control = {}) {
    return {...(control || {}), loading: true, loaded: false, error: null, stale: false};
}

export function recoverInterruptedFetchOnMount(dataSource = {}, input = {}, control = {}, initialObservation = false) {
    // A loading flag is owned by the DataSource instance that started the
    // request. If a new instance observes it on mount, the owner was
    // unmounted and can no longer settle the flag (even when older rows had
    // already set `loaded`). Clear and optionally replay the read.
    if (!initialObservation || control?.loading !== true) return null;
    const restoredPendingFetch = input?.[RESTORED_PENDING_FETCH] === true;
    const replay = restoredPendingFetch
        ? dataSource?.replayPendingFetchOnRestore !== false
        : input?.fetch === true || dataSource?.replayPendingFetchOnRestore !== false;
    const {[RESTORED_PENDING_FETCH]: _restored, ...nextInput} = input || {};
    return {
        input: {...nextInput, fetch: replay, refresh: false},
        control: {...(control || {}), loading: false, stale: replay},
    };
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
    const openEnded = pageResult?.openEnded === true;
    if (openEnded) {
        delete base.pageCount;
        delete base.totalPages;
        delete base.totalCount;
        delete base.recordCount;
    }
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

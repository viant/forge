import {reportDatasetReadContextIdentity} from './reportBuilderConcurrentRead.js';
import {cursorPagingAssociation, matchesCompletedCursorAssociation} from "../../hooks/paging.js";

export function isReportBuilderCursorPaging(paging) {
    return paging?.enabled === true && String(paging.mode || "").toLowerCase() === "cursor";
}

function cursorQuery(request, paging, {keepSize = false} = {}) {
    const parameters = {...request};
    delete parameters.offset;
    delete parameters[paging?.parameters?.page || "page"];
    if (!keepSize) {
        delete parameters.limit;
        delete parameters[paging?.parameters?.size || "size"];
    }
    return parameters;
}

// A rendered authored graph is the read owner only for the exact current host
// context/source/query. This receipt never grants access or reuses a result.
export function reportBuilderDatasetOwnsRequest(context, request, ownership) {
    if (!ownership?.enabled || ownership.context !== context || !ownership.scope
        || isReportBuilderCursorPaging(context?.dataSource?.paging)
        || ownership.contextIdentity !== JSON.stringify(reportDatasetReadContextIdentity(context))) return false;
    const source = context?.identity?.dataSourceRef;
    const input = context?.signals?.input?.peek?.() || {};
    if (!source || input.filter && Object.keys(input.filter).length) return false;
    return ownership.datasets?.some(dataset => dataset.dataSourceRef === source
        && JSON.stringify(dataset.request) === JSON.stringify(request)) === true;
}

export function dispatchReportBuilderDatasourceRequest(context, request, shouldFetch, requestedPage = 1, ownership = null) {
    const fetch = shouldFetch && !reportBuilderDatasetOwnsRequest(context, request, ownership);
    const paging = context?.dataSource?.paging;
    const cursor = isReportBuilderCursorPaging(paging);
    const page = cursor ? Math.max(1, Math.floor(Number(requestedPage) || 1)) : undefined;
    const parameters = cursor ? cursorQuery(request, paging) : request;
    const input = context?.signals?.input;
    if (input) {
        input.value = {...(input.peek?.() || {}), parameters, ...(cursor ? {page} : {}), fetch};
    } else {
        context?.handlers?.dataSource?.setInputParameters?.(parameters);
        if (fetch) {
            if (cursor) context?.handlers?.dataSource?.fetchCollection?.({page});
            else context?.handlers?.dataSource?.fetchCollection?.();
        }
    }
}

export function reportBuilderRequestMatchesExecutedScope(request, executedFingerprint, paging) {
    if (!executedFingerprint) return false;
    if (!isReportBuilderCursorPaging(paging)) return JSON.stringify(request) === executedFingerprint;
    try {
        // Page coordinates do not create a new report scope. A size or query
        // change still requires another explicit Run when auto-fetch is off.
        return JSON.stringify(cursorQuery(request, paging, {keepSize: true}))
            === JSON.stringify(cursorQuery(JSON.parse(executedFingerprint), paging, {keepSize: true}));
    } catch (_) {
        return false;
    }
}

export function reportBuilderCursorNavigationFingerprint({paging, request, executedFingerprint, blocked = false}) {
    return !blocked && isReportBuilderCursorPaging(paging)
        && reportBuilderRequestMatchesExecutedScope(request, executedFingerprint, paging)
        ? JSON.stringify(request) : "";
}

export function shouldFetchReportBuilderRequest({autoFetch, canRun, blocked, fingerprint, navigationFingerprint}) {
    return !blocked && canRun && (autoFetch !== false
        || !!navigationFingerprint && navigationFingerprint === fingerprint);
}

export function reportBuilderDispatchFingerprint(requestFingerprint, shouldFetch) {
    return `${requestFingerprint}::${shouldFetch ? "fetch" : "hold"}`;
}

export function matchesReportBuilderDatasourceDispatch({fingerprint, previousFingerprint, paging, page, previousPage}) {
    return fingerprint === previousFingerprint && (!isReportBuilderCursorPaging(paging)
        || Number(page || 1) === Number(previousPage || 1));
}

export function resolveReportBuilderCompletedCursorPage({context, info, request, loading, error, frozen, pendingRun}) {
    const paging = context?.dataSource?.paging;
    if (!isReportBuilderCursorPaging(paging) || loading || error || frozen || pendingRun) return null;
    const page = Number(info?.currentPage);
    const input = context?.signals?.input?.peek?.() || {};
    if (!Number.isSafeInteger(page) || page < 1 || Number(input.page || 1) !== page) return null;
    if (!matchesCompletedCursorAssociation(info, cursorPagingAssociation(context, input))) return null;
    const query = cursorQuery(request, paging);
    const currentQuery = cursorQuery(input.parameters || {}, paging);
    if (JSON.stringify(query) !== JSON.stringify(currentQuery)) return null;
    return page;
}

export function resolveReportBuilderInitialCursorPage(options) {
    if (!isReportBuilderCursorPaging(options.context?.dataSource?.paging) || options.frozen || options.pendingRun) return null;
    return resolveReportBuilderCompletedCursorPage(options) || 1;
}

export function applyReportBuilderResolvedCursorPage({context, state, request, info, loading, error, frozen,
    pendingRun, initial, shouldFetch, buildRequest, markDispatch, markPage, persist}) {
    const options = {context, request, info, loading, error, frozen, pendingRun};
    const page = initial ? resolveReportBuilderInitialCursorPage(options) : resolveReportBuilderCompletedCursorPage(options);
    if (page == null) return null;
    if (Number(state.page || 1) !== page) {
        const nextState = {...state, page};
        const nextRequest = buildRequest(nextState);
        markDispatch(reportBuilderDispatchFingerprint(JSON.stringify(nextRequest), shouldFetch,
            context?.dataSource?.paging, page));
        markPage?.(page);
        persist(nextState);
    }
    return page;
}

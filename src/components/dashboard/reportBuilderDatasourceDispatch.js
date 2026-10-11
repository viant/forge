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

export function dispatchReportBuilderDatasourceRequest(context, request, shouldFetch, requestedPage = 1) {
    const paging = context?.dataSource?.paging;
    const cursor = isReportBuilderCursorPaging(paging);
    const page = cursor ? Math.max(1, Math.floor(Number(requestedPage) || 1)) : undefined;
    const parameters = cursor ? cursorQuery(request, paging) : request;
    const input = context?.signals?.input;
    if (input) {
        input.value = {...(input.peek?.() || {}), parameters, ...(cursor ? {page} : {}), fetch: shouldFetch};
    } else {
        context?.handlers?.dataSource?.setInputParameters?.(parameters);
        if (shouldFetch) {
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

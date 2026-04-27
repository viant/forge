function pagingConfig(paging) {
    if (!paging || paging.enabled === false) {
        return null;
    }
    return paging;
}

export function resolvePagingValues(page, paging) {
    const config = pagingConfig(paging);
    if (page == null || !config) {
        return null;
    }

    const pageParameters = config.parameters || {};
    const pageParamName = pageParameters.page || "page";
    const sizeParamName = pageParameters.size || "size";
    const sizeValue = config.size && config.size > 0 ? config.size : undefined;
    let pageValue = page;
    if (pageParamName === 'offset') {
        const pageNumber = Number(page) || 1;
        const pageSize = Number(sizeValue) || 0;
        pageValue = Math.max(0, pageNumber - 1) * pageSize;
    }
    return { pageParamName, sizeParamName, pageValue, sizeValue };
}

export function withPagingInputs(inputParameters, pagingValues) {
    const next = { ...(inputParameters || {}) };
    if (!pagingValues) {
        return next;
    }
    const { pageParamName, sizeParamName, pageValue, sizeValue } = pagingValues;
    next[pageParamName] = pageValue;
    if (sizeValue != null) {
        next[sizeParamName] = sizeValue;
    }
    return next;
}

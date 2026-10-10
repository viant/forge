function pagingConfig(paging) {
    if (!paging || paging.enabled === false) {
        return null;
    }
    return paging;
}

export function resolvePagingValues(page, paging, cursor) {
    const config = pagingConfig(paging);
    if (page == null || !config) {
        return null;
    }

    const pageParameters = config.parameters || {};
    const pageParamName = pageParameters.page || "page";
    const sizeParamName = pageParameters.size || "size";
    const sizeValue = config.size && config.size > 0 ? config.size : undefined;
    let pageValue = page;
    const mode = String(config.mode || '').trim().toLowerCase();
    if (mode === 'cursor') {
        if (!pageParameters.page) throw new Error('Cursor paging requires an authored token parameter');
        return {pageParamName: pageParameters.page, sizeParamName: pageParameters.size,
            pageValue: cursor, sizeValue: pageParameters.size ? sizeValue : undefined, cursor: true};
    }
    if (mode && mode !== 'page' && mode !== 'offset') {
        throw new Error(`Unsupported paging mode: ${mode}`);
    }
    if (mode === 'offset' || (!mode && String(pageParamName).toLowerCase() === 'offset')) {
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
    if (pagingValues.cursor && pageValue === undefined) delete next[pageParamName];
    else next[pageParamName] = pageValue;
    if (sizeValue != null) {
        next[sizeParamName] = sizeValue;
    }
    return next;
}


// A session belongs to one mounted datasource. Its association includes every
// input and selected window/target; continuation tokens never cross that key.
export function createCursorPagingSession() {
    let signature = null, tokens = [undefined], version = 0;
    const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
    return {
        begin(page, association) {
            const next = stable(association);
            if (next !== signature) {signature = next; tokens = [undefined]; page = 1;}
            page = Number(page || 1);
            if (!Number.isSafeInteger(page) || page < 1 || page > tokens.length) throw new Error('Cursor page has no admitted continuation');
            return {page, cursor: tokens[page-1], signature, version: ++version};
        },
        finish(request, info) {
            if (request.signature !== signature || request.version !== version) return null;
            if (typeof info?.hasMore !== 'boolean') throw new Error('Cursor result requires an explicit boolean hasMore');
            if (info.hasMore) {
                const token = info.nextCursor;
                if (token == null || token === '') throw new Error('Cursor result is missing nextCursor');
                const validate = value => {
                    if (typeof value === 'number') throw new Error('Cursor numeric token requires a lossless transport; browser Number is unsupported');
                    if (value && typeof value === 'object') Object.values(value).forEach(validate);
                };
                validate(token);
                const key = stable(token);
                if (tokens.slice(1, request.page).some(previous => stable(previous) === key)) throw new Error('Cursor result repeated a continuation token');
                tokens = [...tokens.slice(0, request.page), JSON.parse(key)];
            } else tokens = tokens.slice(0, request.page);
            return {...info, page:request.page, currentPage:request.page, hasPrevious:request.page>1,
                hasNext:info.hasMore, hasMore:info.hasMore};
        },
    };
}

export const resolveKey = (holder, name) => {
    if (holder == null) return undefined;
    if (!name) return holder;
    const keys = name.split(".");
    if (keys.length === 1) {
        return holder[name];
    }
    let result = holder;
    for (const key of keys) {
        if (!key) {
            continue;
        }
        if (result == null || typeof result !== "object" || typeof result[key] === "undefined") {
            return undefined;
        }
        result = result[key];
    }
    return result;
};

function extractEnvelopeRecords(data) {
    if (data == null || typeof data !== "object") {
        return undefined;
    }
    if (Array.isArray(data.data)) {
        return data.data;
    }
    if (Array.isArray(data.Rows)) {
        return data.Rows;
    }
    if (Array.isArray(data.rows)) {
        return data.rows;
    }
    return undefined;
}

function extractEnvelopeInfo(data) {
    if (data == null || typeof data !== "object") {
        return {};
    }
    return resolveKey(data, "info") || resolveKey(data, "Info") || {};
}

export function extractData(selectors = {}, paging, data) {
    let records = [];
    let info = {};
    let stats = {};
    const dataSelector = selectors.data;
    let respData;
    if (!dataSelector) {
        respData = extractEnvelopeRecords(data);
        if (typeof respData === "undefined") {
            respData = data;
        }
    } else {
        respData = resolveKey(data, dataSelector);
        if (typeof respData === "undefined") {
            respData = extractEnvelopeRecords(data);
        }
        if (typeof respData === "undefined") {
            respData = data;
        }
    }

    if (Array.isArray(respData)) {
        records = respData;
    } else if (respData) {
        records = [respData];
    }

    if (paging?.enabled) {
        const { dataInfoSelectors = {} } = paging;
        const dataInfoSelector = selectors.dataInfo;
        const summary = dataInfoSelector
            ? (resolveKey(data, dataInfoSelector) || extractEnvelopeInfo(data))
            : extractEnvelopeInfo(data);
        info = {
            pageCount: resolveKey(summary, dataInfoSelectors.pageCount || "pageCount")
                ?? resolveKey(data, dataInfoSelectors.pageCount || "pageCount")
                ?? 0,
            totalCount: resolveKey(summary, dataInfoSelectors.totalCount || "totalCount")
                ?? resolveKey(data, dataInfoSelectors.totalCount || "totalCount")
                ?? resolveKey(summary, "recordCount")
                ?? resolveKey(data, "recordCount")
                ?? 0
        };
        info.value = info || {};
    }

    const metricsSelector = selectors.metrics;
    if (metricsSelector) {
        stats = resolveKey(data, metricsSelector) || [];
    }
    return { records, info, stats };
}

export async function collectPagedCollection({pageSize, maxPages, fetchPage, extractPage, keyForRow, shouldContinue = () => true}) {
    if (!Number.isSafeInteger(pageSize) || pageSize <= 0) throw new Error('Aggregated paging requires a positive page size.');
    if (!Number.isSafeInteger(maxPages) || maxPages <= 0) throw new Error('Aggregated paging requires a positive maxPages bound.');
    if (typeof fetchPage !== 'function' || typeof extractPage !== 'function') throw new Error('Aggregated paging requires page fetch and extraction.');
    const rows = [], keys = new Set();
    let firstPayload = null, lastInfo = {}, lastStats = null;
    for (let page = 1; page <= maxPages; page++) {
        if (!shouldContinue()) throw new Error('Aggregated paging was interrupted.');
        const payload = await fetchPage(page);
        if (!shouldContinue()) throw new Error('Aggregated paging was interrupted.');
        if (firstPayload == null) firstPayload = payload;
        const extracted = extractPage(payload);
        const current = extracted?.records;
        if (!Array.isArray(current) || current.length > pageSize) throw new Error('Producer returned an invalid aggregate page.');
        if (current.length && typeof keyForRow === 'function') {
            for (const row of current) {
                const key = keyForRow(row);
                if (key == null || key === '' || keys.has(String(key))) throw new Error('Producer returned duplicate or missing aggregate identity.');
                keys.add(String(key));
            }
        }
        rows.push(...current);
        lastInfo = extracted.info || {};
        lastStats = extracted.stats || null;
        if (current.length < pageSize) {
            return {records: rows, info: {...lastInfo, totalCount: rows.length, pageCount: 1, currentPage: 1, hasNext: false}, stats: lastStats,
                payload: {...(firstPayload || {}), data: rows, aggregatedData: rows}, pages: page};
        }
    }
    throw new Error(`Aggregated paging exceeded its ${maxPages}-page bound; no partial collection was published.`);
}

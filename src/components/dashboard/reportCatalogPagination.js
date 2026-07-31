const DEFAULT_PAGE_SIZE = 20;

function positiveInteger(value, fallback) {
    const normalized = Number(value);
    return Number.isInteger(normalized) && normalized > 0 ? normalized : fallback;
}

export function normalizeReportCatalogPageSize(value, options = [20, 50, 100]) {
    const normalizedOptions = (Array.isArray(options) ? options : [])
        .map((entry) => positiveInteger(entry, 0))
        .filter((entry, index, source) => entry > 0 && source.indexOf(entry) === index)
        .sort((left, right) => left - right);
    const fallback = normalizedOptions[0] || DEFAULT_PAGE_SIZE;
    const normalized = positiveInteger(value, fallback);
    return normalizedOptions.includes(normalized) ? normalized : fallback;
}

export function paginateReportCatalogEntries(entries = [], page = 1, pageSize = DEFAULT_PAGE_SIZE) {
    const source = Array.isArray(entries) ? entries : [];
    const normalizedPageSize = positiveInteger(pageSize, DEFAULT_PAGE_SIZE);
    const totalItems = source.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / normalizedPageSize));
    const currentPage = Math.min(totalPages, positiveInteger(page, 1));
    const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * normalizedPageSize;
    const endIndex = Math.min(totalItems, startIndex + normalizedPageSize);
    return {
        currentPage,
        endIndex,
        entries: source.slice(startIndex, endIndex),
        pageSize: normalizedPageSize,
        startIndex,
        totalItems,
        totalPages,
    };
}

export function buildReportCatalogPageItems(currentPage = 1, totalPages = 1, maxVisible = 7) {
    const normalizedTotal = Math.max(1, positiveInteger(totalPages, 1));
    const normalizedCurrent = Math.min(normalizedTotal, positiveInteger(currentPage, 1));
    const visible = Math.max(5, positiveInteger(maxVisible, 7));
    if (normalizedTotal <= visible) {
        return Array.from({ length: normalizedTotal }, (_, index) => index + 1);
    }

    const interiorSlots = visible - 2;
    let start = Math.max(2, normalizedCurrent - Math.floor(interiorSlots / 2));
    let end = Math.min(normalizedTotal - 1, start + interiorSlots - 1);
    start = Math.max(2, end - interiorSlots + 1);

    const items = [1];
    if (start > 2) items.push("ellipsis-start");
    for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
        items.push(pageNumber);
    }
    if (end < normalizedTotal - 1) items.push("ellipsis-end");
    items.push(normalizedTotal);
    return items;
}

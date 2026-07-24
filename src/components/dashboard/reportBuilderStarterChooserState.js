function normalizeString(value = "") {
    return String(value || "").trim();
}

export function isBlankReportBuilderStarterId(value = "") {
    return normalizeString(value) === "__blank__";
}

export function isReportBuilderStarterReady({
    requestedStarterId = "",
    currentTemplateId = "",
} = {}) {
    const requested = normalizeString(requestedStarterId);
    return !requested
        || isBlankReportBuilderStarterId(requested)
        || normalizeString(currentTemplateId) === requested;
}

export function shouldShowReportBuilderStarterChooser({
    authoredBlockCount = 0,
} = {}) {
    return Math.max(0, Number(authoredBlockCount || 0) || 0) === 0;
}

function normalizeString(value = "") {
    return String(value || "").trim();
}

export function resolveReportBuilderVisibleSemanticInlineNotices(notices = [], {
    reportWorkspaceMode = false,
    showAuthoredReportSurface = false,
} = {}) {
    const normalizedNotices = (Array.isArray(notices) ? notices : [])
        .filter((notice) => notice && typeof notice === "object" && !Array.isArray(notice));
    if (!reportWorkspaceMode || !showAuthoredReportSurface) {
        return normalizedNotices;
    }
    return normalizedNotices.filter((notice) => {
        const level = normalizeString(notice?.level).toLowerCase();
        const message = normalizeString(notice?.message);
        if (level !== "info") {
            return true;
        }
        if (!message.startsWith("Semantic binding:")) {
            return true;
        }
        return true;
    });
}

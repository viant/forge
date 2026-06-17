export function getReportBuilderChartDataPolicy(config = {}) {
    const mode = String(config?.result?.chartDataMode || "").trim();
    const rowLimit = Math.max(
        1,
        Number(config?.result?.chartRowLimit || config?.result?.chartDataLimit || 1000) || 1000,
    );
    return {
        mode: mode === "fullQuery" ? "fullQuery" : "currentPage",
        rowLimit,
    };
}

export function buildReportBuilderChartQueryRequest(request = {}, policy = {}) {
    if (String(policy?.mode || "").trim() !== "fullQuery") {
        return null;
    }
    const next = JSON.parse(JSON.stringify(request || {}));
    next.limit = Math.max(1, Number(policy?.rowLimit || 1000) || 1000);
    next.offset = 0;
    return next;
}

export function resolveReportBuilderChartCollection({
    computedCollection = [],
    chartCollection = [],
    policy = {},
    chartQueryLoading = false,
} = {}) {
    if (String(policy?.mode || "").trim() === "fullQuery") {
        if (Array.isArray(chartCollection) && chartCollection.length > 0) {
            return chartCollection;
        }
        if (chartQueryLoading === true) {
            return Array.isArray(computedCollection) ? computedCollection : [];
        }
        return Array.isArray(chartCollection) ? chartCollection : [];
    }
    return Array.isArray(computedCollection) ? computedCollection : [];
}

export function resolveReportBuilderExportCollection({
    computedCollection = [],
    chartCollection = [],
    policy = {},
    showingChartView = false,
} = {}) {
    if (
        showingChartView
        && String(policy?.mode || "").trim() === "fullQuery"
        && Array.isArray(chartCollection)
        && chartCollection.length > 0
    ) {
        return chartCollection;
    }
    return Array.isArray(computedCollection) ? computedCollection : [];
}

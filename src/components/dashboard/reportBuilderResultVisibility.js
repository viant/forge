export function resolveReportBuilderResultVisibility({
    activeResultLoading = false,
    activeResultError = null,
    canShowResults = false,
    explicitChartMode = false,
    hasValidChartSpec = false,
    hasStaleChartSpec = false,
    viewMode = "",
} = {}) {
    const showChartResult = !activeResultLoading
        && !activeResultError
        && canShowResults
        && (
            (explicitChartMode && hasValidChartSpec && viewMode === "chart")
            || (!explicitChartMode && viewMode !== "table")
        );
    const showTableResult = !activeResultLoading
        && !activeResultError
        && canShowResults
        && (
            !explicitChartMode
                ? viewMode === "table"
                : (!hasValidChartSpec || hasStaleChartSpec || viewMode === "table")
        );
    const showChartPlaceholder = !activeResultLoading
        && !activeResultError
        && canShowResults
        && explicitChartMode
        && (!hasValidChartSpec || hasStaleChartSpec);
    return {
        showChartResult,
        showTableResult,
        showChartPlaceholder,
        showPagination: !showChartResult,
    };
}

export function buildReportBuilderChartPlaceholderState({
    hasStaleChartSpec = false,
    compactMode = false,
    canCreateChart = false,
    staleDescription = "",
} = {}) {
    return {
        tone: hasStaleChartSpec ? "warning" : "neutral",
        icon: hasStaleChartSpec ? "warning-sign" : "timeline-line-chart",
        eyebrow: hasStaleChartSpec ? "Chart needs attention" : "Chart not configured",
        title: hasStaleChartSpec ? "The current chart no longer matches this table" : "Build a chart from the current table",
        description: hasStaleChartSpec
            ? staleDescription
            : (compactMode
                ? "Use Chart in the bottom bar to build a chart from the current table."
                : "Use the result header actions to create or apply a curated chart from the current table."),
        actionLabel: !compactMode && canCreateChart ? (hasStaleChartSpec ? "Edit chart" : "Create chart") : "",
    };
}

function normalizeString(value = "") {
    return String(value || "").trim();
}

export function resolveTablePresetTransitionText({
    canShowResults = false,
    readinessReason = "",
    readinessMessage = "",
    activeTablePresetTitle = "",
    modifiedTablePresetTitle = "",
} = {}) {
    if (readinessReason === "semantic" && readinessMessage) {
        return readinessMessage;
    }
    if (canShowResults && activeTablePresetTitle) {
        return `Showing ${activeTablePresetTitle}.`;
    }
    if (modifiedTablePresetTitle) {
        return `Modified from ${modifiedTablePresetTitle}.`;
    }
    return "";
}

export function resolveResultIdentityChip({
    showingChartView = false,
    activeTablePresetTitle = "",
    modifiedTablePresetTitle = "",
} = {}) {
    if (showingChartView) {
        return "";
    }
    if (activeTablePresetTitle) {
        return activeTablePresetTitle;
    }
    if (modifiedTablePresetTitle) {
        return `Modified from ${modifiedTablePresetTitle}`;
    }
    return "";
}

export function resolveReportBuilderActiveFilterSummary({
    totalActiveFilterCount = 0,
} = {}) {
    const count = Number(totalActiveFilterCount) || 0;
    if (count <= 0) {
        return "";
    }
    return `${count} active filter${count === 1 ? "" : "s"}`;
}

export function resolveReportBuilderResultTitle({
    showingChartView = false,
    chartTitle = "",
    fallbackChartTitle = "Chart results",
    canShowResults = false,
    activeTablePresetTitle = "",
    modifiedTablePresetTitle = "",
} = {}) {
    if (showingChartView) {
        return normalizeString(chartTitle) || normalizeString(fallbackChartTitle) || "Chart results";
    }
    if (canShowResults) {
        return normalizeString(activeTablePresetTitle) || "Table results";
    }
    if (modifiedTablePresetTitle) {
        return "Table results";
    }
    return "Report results";
}

export function resolveReportBuilderResultDescription({
    loading = false,
    error = null,
    canShowResults = false,
    canRunReport = false,
    readinessReason = "",
    readinessMessage = "",
    modifiedTablePresetTitle = "",
} = {}) {
    if (loading) {
        return "Refreshing the current scope and preparing the latest results.";
    }
    if (error) {
        return "The current result payload could not be rendered. Adjust the inputs or run again.";
    }
    if (canShowResults) {
        return "";
    }
    if (readinessReason === "semantic" && readinessMessage) {
        return readinessMessage;
    }
    if (modifiedTablePresetTitle) {
        return `Modified from ${modifiedTablePresetTitle}. Run to preview the changes.`;
    }
    if (canRunReport) {
        return "";
    }
    if (readinessReason === "scope") {
        return "Choose the required scope before running the report.";
    }
    return "Complete the required filters before running the report.";
}

export function buildReportBuilderDesktopResultState({
    showingChartView = false,
    chartTitle = "",
    fallbackChartTitle = "Chart results",
    canShowResults = false,
    canRunReport = false,
    loading = false,
    error = null,
    readinessReason = "",
    readinessMessage = "",
    activeTablePresetTitle = "",
    modifiedTablePresetTitle = "",
    totalActiveFilterCount = 0,
} = {}) {
    return {
        title: resolveReportBuilderResultTitle({
            showingChartView,
            chartTitle,
            fallbackChartTitle,
            canShowResults,
            activeTablePresetTitle,
            modifiedTablePresetTitle,
        }),
        description: resolveReportBuilderResultDescription({
            loading,
            error,
            canShowResults,
            canRunReport,
            readinessReason,
            readinessMessage,
            modifiedTablePresetTitle,
        }),
        activeFilterSummary: resolveReportBuilderActiveFilterSummary({ totalActiveFilterCount }),
    };
}

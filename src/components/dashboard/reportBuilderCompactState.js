import {
    resolveResultIdentityChip,
    resolveTablePresetTransitionText,
} from "./reportBuilderResultIdentity.js";

export function formatCompactDateRangeSummary(value = {}) {
    const start = String(value?.start || "").trim();
    const end = String(value?.end || "").trim();
    if (!start && !end) {
        return "";
    }
    if (start && end) {
        return `${start} to ${end}`;
    }
    return start || end;
}

function pluralizedCount(count = 0, label = "") {
    const numeric = Number(count || 0);
    return `${numeric} ${label}${numeric === 1 ? "" : "s"}`;
}

export {
    resolveResultIdentityChip,
    resolveTablePresetTransitionText,
};

export function resolveCompactStatusText({
    loading = false,
    error = null,
    canShowResults = false,
    explicitChartMode = false,
    hasValidChartSpec = false,
    viewMode = "",
    chartTitle = "",
    rowCount = 0,
    canRunReport = false,
    readinessReason = "",
    readinessMessage = "",
    activeTablePresetTitle = "",
    modifiedTablePresetTitle = "",
} = {}) {
    const presetTransitionText = resolveTablePresetTransitionText({
        canShowResults,
        readinessReason,
        readinessMessage,
        activeTablePresetTitle,
        modifiedTablePresetTitle,
    });
    if (loading) {
        return "Refreshing report data.";
    }
    if (error) {
        return "Report refresh failed.";
    }
    if (canShowResults) {
        if (explicitChartMode && hasValidChartSpec && viewMode === "chart") {
            return chartTitle
                ? `Showing ${chartTitle}.`
                : "Showing chart results.";
        }
        if (presetTransitionText) {
            return presetTransitionText;
        }
        return `Showing ${pluralizedCount(rowCount, "row")}.`;
    }
    if (canRunReport) {
        if (presetTransitionText) {
            return presetTransitionText;
        }
        return "Ready to run the report.";
    }
    if (presetTransitionText) {
        return presetTransitionText;
    }
    if (readinessReason === "scope") {
        return "Choose a scope to continue.";
    }
    return "Set the required filters to continue.";
}

export function resolveCompactSummaryItems({
    requiredStaticFilters = [],
    staticFilters = {},
    selectedMeasures = [],
    selectedDimensions = [],
    totalActiveFilterCount = 0,
    hasValidChartSpec = false,
    canShowResults = false,
    viewMode = "",
    activeTablePresetTitle = "",
    modifiedTablePresetTitle = "",
    limit = 5,
} = {}) {
    const items = [];
    const identityChip = resolveResultIdentityChip({
        showingChartView: hasValidChartSpec && viewMode === "chart",
        canShowResults,
        activeTablePresetTitle,
        modifiedTablePresetTitle,
    });
    const dateRangeFilter = requiredStaticFilters.find((filter) => String(filter?.type || "").trim() === "dateRange");
    const dateRangeKey = String(dateRangeFilter?.id || dateRangeFilter?.field || "").trim();
    if (dateRangeKey) {
        const summary = formatCompactDateRangeSummary(staticFilters?.[dateRangeKey]);
        if (summary) {
            items.push(summary);
        }
    }
    if (selectedMeasures.length > 0) {
        items.push(pluralizedCount(selectedMeasures.length, "measure"));
    }
    if (selectedDimensions.length > 0) {
        items.push(pluralizedCount(selectedDimensions.length, "breakdown"));
    }
    if (totalActiveFilterCount > 0) {
        items.push(pluralizedCount(totalActiveFilterCount, "filter"));
    }
    if (identityChip) {
        items.unshift(identityChip);
    }
    return items.slice(0, limit);
}

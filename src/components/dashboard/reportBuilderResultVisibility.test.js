import assert from "node:assert/strict";

import {
    buildReportBuilderChartPlaceholderState,
    resolveReportBuilderResultVisibility,
} from "./reportBuilderResultVisibility.js";

assert.deepEqual(resolveReportBuilderResultVisibility({
    activeResultLoading: false,
    activeResultError: null,
    canShowResults: true,
    explicitChartMode: true,
    hasValidChartSpec: true,
    hasStaleChartSpec: false,
    viewMode: "chart",
}), {
    showChartResult: true,
    showTableResult: false,
    showChartPlaceholder: false,
    showPagination: false,
});

assert.deepEqual(resolveReportBuilderResultVisibility({
    activeResultLoading: false,
    activeResultError: null,
    canShowResults: true,
    explicitChartMode: true,
    hasValidChartSpec: false,
    hasStaleChartSpec: false,
    viewMode: "table",
}), {
    showChartResult: false,
    showTableResult: true,
    showChartPlaceholder: true,
    showPagination: true,
});

assert.deepEqual(resolveReportBuilderResultVisibility({
    activeResultLoading: true,
    activeResultError: null,
    canShowResults: true,
    explicitChartMode: false,
    hasValidChartSpec: false,
    hasStaleChartSpec: false,
    viewMode: "table",
}), {
    showChartResult: false,
    showTableResult: false,
    showChartPlaceholder: false,
    showPagination: true,
});

assert.deepEqual(buildReportBuilderChartPlaceholderState({
    hasStaleChartSpec: false,
    compactMode: false,
    canCreateChart: true,
}), {
    tone: "neutral",
    icon: "timeline-line-chart",
    eyebrow: "Chart not configured",
    title: "Build a chart from the current table",
    description: "Use the result header actions to create or apply a curated chart from the current table.",
    actionLabel: "Create chart",
});

assert.deepEqual(buildReportBuilderChartPlaceholderState({
    hasStaleChartSpec: true,
    compactMode: false,
    canCreateChart: true,
    staleDescription: "X field is no longer selected.",
}), {
    tone: "warning",
    icon: "warning-sign",
    eyebrow: "Chart needs attention",
    title: "The current chart no longer matches this table",
    description: "X field is no longer selected.",
    actionLabel: "Edit chart",
});

console.log("reportBuilderResultVisibility ✓ result frame visibility and placeholder state");

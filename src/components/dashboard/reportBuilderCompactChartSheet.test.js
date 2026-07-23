import assert from "node:assert/strict";

import { buildReportBuilderCompactChartSheetState } from "./reportBuilderCompactChartSheet.js";

assert.deepEqual(buildReportBuilderCompactChartSheetState({
    hasValidChartSpec: false,
    chartTitle: "",
    notice: { level: "info", message: "Applied Delivery Grid." },
    canCreateChart: true,
    hasTableQuickPresets: true,
    quickChartOptions: [{ value: "table:0" }],
    showQuickChartActions: true,
    showEditChart: false,
    showRemoveChart: false,
    showViewToggle: false,
    showExport: false,
    showEmptyState: true,
    activeTablePresetTitle: "Delivery Grid",
    activeTablePresetEyebrow: "Metrics Panel",
    activeTablePresetAccentTone: "delivery",
    activeTablePresetHighlights: ["Selected Dates", "Market Context", "Export Ready"],
}), {
    title: "Create or apply a chart",
    notice: {
        level: "info",
        message: "Applied Delivery Grid.",
    },
    quickActions: {
        enabled: true,
        canCreateChart: true,
        showCreateButton: true,
        quickOptions: [{ value: "table:0" }],
        buttonLabel: "Quick views",
        buttonIcon: "panel-table",
    },
    presetIdentity: {
        title: "Delivery Grid",
        eyebrow: "Metrics Panel",
        accentTone: "delivery",
        highlights: ["Selected Dates", "Market Context", "Export Ready"],
    },
    editChartEnabled: false,
    removeChartEnabled: false,
    viewToggleEnabled: false,
    exportEnabled: false,
    emptyStateEnabled: true,
});

assert.deepEqual(buildReportBuilderCompactChartSheetState({
    hasValidChartSpec: true,
    chartTitle: "Delivery Trend",
    notice: null,
    canCreateChart: true,
    hasTableQuickPresets: false,
    quickChartOptions: [],
    showQuickChartActions: false,
    showEditChart: true,
    showRemoveChart: true,
    showViewToggle: true,
    showExport: true,
    showEmptyState: false,
}), {
    title: "Delivery Trend",
    notice: null,
    quickActions: {
        enabled: false,
        canCreateChart: true,
        showCreateButton: false,
        quickOptions: [],
        buttonLabel: "Quick chart",
        buttonIcon: "timeline-line-chart",
    },
    presetIdentity: null,
    editChartEnabled: true,
    removeChartEnabled: true,
    viewToggleEnabled: true,
    exportEnabled: true,
    emptyStateEnabled: false,
});

assert.deepEqual(buildReportBuilderCompactChartSheetState({
    hasValidChartSpec: true,
    chartTitle: "Spend by Date",
    notice: null,
    canCreateChart: true,
    hasTableQuickPresets: true,
    quickChartOptions: [],
    showQuickChartActions: true,
    showEditChart: true,
    showRemoveChart: false,
    showViewToggle: true,
    showExport: false,
    showEmptyState: false,
    activeTablePresetTitle: "Delivery Grid",
    activeChartPresetTitle: "Spend by Date",
    activeChartPresetEyebrow: "Visual Story",
    activeChartPresetAccentTone: "delivery",
    activeChartPresetHighlights: ["Split by Site Type", "Trend View", "Full Query"],
}).presetIdentity, {
    title: "Spend by Date",
    eyebrow: "Visual Story",
    accentTone: "delivery",
    highlights: ["Split by Site Type", "Trend View", "Full Query"],
});

console.log("reportBuilderCompactChartSheet ✓ chart sheet view-model");

import assert from "node:assert/strict";

import { buildReportBuilderDesktopResultHeaderState } from "./reportBuilderResultHeader.js";

assert.deepEqual(buildReportBuilderDesktopResultHeaderState({
    desktopActionModel: {
        showQuickChartActions: true,
        showEditChart: true,
    },
    resultViewModes: ["table", "chart"],
    currentViewMode: "table",
    explicitChartMode: true,
    hasValidChartSpec: true,
    canCreateChart: true,
    hasTableQuickPresets: true,
    quickChartOptions: [{ value: "table:0" }],
    overflowActionCount: 1,
}), {
    quickActions: {
        enabled: true,
        canCreate: true,
        showCreateButton: false,
        quickOptions: [{ value: "table:0" }],
        buttonLabel: "Quick view",
        buttonIcon: "panel-table",
    },
    editChartEnabled: true,
    viewToggleModes: [
        { mode: "table", icon: "th", active: true, disabled: false },
        { mode: "chart", icon: "timeline-line-chart", active: false, disabled: false },
    ],
    overflowEnabled: true,
});

assert.deepEqual(buildReportBuilderDesktopResultHeaderState({
    desktopActionModel: {
        showQuickChartActions: true,
        showEditChart: false,
    },
    resultViewModes: ["table", "chart"],
    currentViewMode: "table",
    explicitChartMode: true,
    hasValidChartSpec: false,
    canCreateChart: false,
    hasTableQuickPresets: false,
    quickChartOptions: [],
    overflowActionCount: 0,
}), {
    quickActions: {
        enabled: true,
        canCreate: false,
        showCreateButton: true,
        quickOptions: [],
        buttonLabel: "Quick chart",
        buttonIcon: "timeline-line-chart",
    },
    editChartEnabled: false,
    viewToggleModes: [
        { mode: "table", icon: "th", active: true, disabled: false },
        { mode: "chart", icon: "timeline-line-chart", active: false, disabled: true },
    ],
    overflowEnabled: false,
});

console.log("reportBuilderResultHeader ✓ desktop result-header action state");

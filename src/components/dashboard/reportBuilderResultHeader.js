function normalizeMode(value = "") {
    return String(value || "").trim();
}

function iconForMode(mode = "") {
    return normalizeMode(mode) === "table" ? "th" : "timeline-line-chart";
}

export function buildReportBuilderDesktopResultHeaderState({
    desktopActionModel = {},
    resultViewModes = [],
    currentViewMode = "",
    explicitChartMode = false,
    hasValidChartSpec = false,
    canCreateChart = false,
    hasTableQuickPresets = false,
    quickChartOptions = [],
    overflowActionCount = 0,
} = {}) {
    const normalizedModes = Array.isArray(resultViewModes) ? resultViewModes : [];
    return {
        quickActions: {
            enabled: desktopActionModel.showQuickChartActions === true,
            canCreate: canCreateChart,
            showCreateButton: !hasValidChartSpec,
            quickOptions: Array.isArray(quickChartOptions) ? quickChartOptions : [],
            buttonLabel: hasTableQuickPresets ? "Quick view" : "Quick chart",
            buttonIcon: hasTableQuickPresets ? "panel-table" : "timeline-line-chart",
        },
        editChartEnabled: desktopActionModel.showEditChart === true,
        viewToggleModes: normalizedModes.map((mode) => ({
            mode,
            icon: iconForMode(mode),
            active: normalizeMode(currentViewMode) === normalizeMode(mode),
            disabled: explicitChartMode && normalizeMode(mode) === "chart" && !hasValidChartSpec,
        })),
        overflowEnabled: Number(overflowActionCount || 0) > 0,
    };
}

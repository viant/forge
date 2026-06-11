function normalizeViewModes(viewModes = []) {
    const values = Array.isArray(viewModes) && viewModes.length > 0 ? viewModes : ["chart", "table"];
    return values
        .map((entry) => String(entry || "").trim())
        .filter(Boolean);
}

export function resolveReportBuilderResultModes({
    viewModes = [],
    explicitChartMode = false,
} = {}) {
    const normalized = normalizeViewModes(viewModes);
    if (!explicitChartMode) {
        return normalized;
    }
    return normalized.filter((mode) => mode === "table" || mode === "chart");
}

export function buildReportBuilderActionModel({
    viewModes = [],
    explicitChartMode = false,
    hasValidChartSpec = false,
    canShowResults = false,
    canRunReport = false,
    loading = false,
} = {}) {
    const resultModes = resolveReportBuilderResultModes({ viewModes, explicitChartMode });
    return {
        resultModes,
        desktop: {
            showQuickChartActions: explicitChartMode,
            showEditChart: explicitChartMode && hasValidChartSpec,
            overflowActionIds: hasValidChartSpec ? ["removeChart"] : [],
        },
        compact: {
            showHeaderViewToggle: canShowResults && resultModes.length > 0,
            chartSheet: {
                showQuickChartActions: explicitChartMode,
                showEditChart: explicitChartMode && hasValidChartSpec,
                showRemoveChart: hasValidChartSpec,
                showViewToggle: canShowResults && resultModes.length > 0,
                showExport: canShowResults,
                showEmptyState: !canShowResults,
            },
            bottomBar: [
                {
                    id: "setup",
                    label: "Setup",
                    icon: "panel-table",
                    disabled: false,
                    tone: "secondary",
                },
                {
                    id: "chart",
                    label: "Chart",
                    icon: "timeline-line-chart",
                    disabled: false,
                    tone: "secondary",
                },
                {
                    id: "run",
                    label: loading ? "Running" : "Run",
                    icon: "play",
                    disabled: !canRunReport || loading,
                    tone: "primary",
                },
            ],
        },
    };
}

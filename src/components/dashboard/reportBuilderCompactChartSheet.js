function normalizeString(value = "") {
    return String(value || "").trim();
}

function normalizeStringArray(values = []) {
    return Array.isArray(values)
        ? values.map((entry) => normalizeString(entry)).filter(Boolean)
        : [];
}

export function buildReportBuilderCompactChartSheetState({
    hasValidChartSpec = false,
    chartTitle = "",
    notice = null,
    canCreateChart = false,
    hasTableQuickPresets = false,
    quickChartOptions = [],
    showQuickChartActions = false,
    showEditChart = false,
    showRemoveChart = false,
    showViewToggle = false,
    showExport = false,
    showEmptyState = false,
    activeTablePresetTitle = "",
    activeTablePresetEyebrow = "",
    activeTablePresetAccentTone = "",
    activeTablePresetHighlights = [],
    activeChartPresetTitle = "",
    activeChartPresetEyebrow = "",
    activeChartPresetAccentTone = "",
    activeChartPresetHighlights = [],
} = {}) {
    return {
        title: hasValidChartSpec
            ? (normalizeString(chartTitle) || "Chart")
            : "Create or apply a chart",
        notice: notice && typeof notice === "object" ? {
            level: notice.level || "info",
            message: normalizeString(notice.message),
        } : null,
        quickActions: {
            enabled: showQuickChartActions,
            canCreateChart,
            showCreateButton: !hasValidChartSpec,
            quickOptions: quickChartOptions,
            buttonLabel: hasTableQuickPresets ? "Quick view" : "Quick chart",
            buttonIcon: hasTableQuickPresets ? "panel-table" : "timeline-line-chart",
        },
        presetIdentity: normalizeString(activeChartPresetEyebrow)
            || normalizeString(activeChartPresetAccentTone)
            || normalizeStringArray(activeChartPresetHighlights).length > 0
            ? {
                title: normalizeString(activeChartPresetTitle || chartTitle),
                eyebrow: normalizeString(activeChartPresetEyebrow),
                accentTone: normalizeString(activeChartPresetAccentTone),
                highlights: normalizeStringArray(activeChartPresetHighlights),
            }
            : (normalizeString(activeTablePresetTitle)
                ? {
                    title: normalizeString(activeTablePresetTitle),
                    eyebrow: normalizeString(activeTablePresetEyebrow),
                    accentTone: normalizeString(activeTablePresetAccentTone),
                    highlights: normalizeStringArray(activeTablePresetHighlights),
                }
                : null),
        editChartEnabled: showEditChart,
        removeChartEnabled: showRemoveChart,
        viewToggleEnabled: showViewToggle,
        exportEnabled: showExport,
        emptyStateEnabled: showEmptyState,
    };
}

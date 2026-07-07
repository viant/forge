function normalizeString(value = "") {
    return String(value || "").trim();
}

function normalizeStringArray(values = []) {
    return Array.isArray(values)
        ? values.map((entry) => normalizeString(entry)).filter(Boolean)
        : [];
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
    canShowResults = false,
    activeTablePresetTitle = "",
    modifiedTablePresetTitle = "",
} = {}) {
    if (showingChartView) {
        return "Chart view";
    }
    if (activeTablePresetTitle) {
        return activeTablePresetTitle;
    }
    if (modifiedTablePresetTitle) {
        return `Modified from ${modifiedTablePresetTitle}`;
    }
    if (canShowResults) {
        return "Table view";
    }
    return "";
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
    showingChartView = false,
    chartUsesFullQuery = false,
    canShowResults = false,
    canRunReport = false,
    readinessReason = "",
    readinessMessage = "",
    activeTablePresetTitle = "",
    activeTablePresetDescription = "",
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
        return "Refreshing the current scope and preparing the latest results.";
    }
    if (error) {
        return "The current result payload could not be rendered. Adjust the inputs or run again.";
    }
    if (showingChartView) {
        return chartUsesFullQuery
            ? "Chart-first view for the active scope using the full query result set. Switch to the table when you need to inspect individual rows."
            : "Chart-first view for the active scope. Switch to the table when you need to inspect individual rows.";
    }
    if (canShowResults) {
        const presetDescription = normalizeString(activeTablePresetDescription);
        return presetDescription
            ? `${presetTransitionText || "Table view."} ${presetDescription} Use Presets to switch to a curated table and chart view for this scope.`
            : "Table view for the active scope. Use Presets to switch to a curated table and chart view for this scope.";
    }
    if (presetTransitionText) {
        if (readinessReason === "semantic") {
            return presetTransitionText;
        }
        if (modifiedTablePresetTitle) {
            return `${presetTransitionText} Run this custom table to preview results and unlock chart actions.`;
        }
    }
    if (canRunReport) {
        return activeTablePresetTitle
            ? `Run ${activeTablePresetTitle} to preview results and unlock chart actions.`
            : "Run the current scope to preview results and unlock chart actions.";
    }
    if (readinessReason === "scope") {
        return "Choose the required scope before running the report.";
    }
    return "Complete the required filters before running the report.";
}

export function resolveReportBuilderResultMetaItems({
    showingChartView = false,
    canShowResults = false,
    activeTablePresetTitle = "",
    modifiedTablePresetTitle = "",
    chartIdentityLabel = "",
    selectedMeasuresCount = 0,
    selectedDimensionsCount = 0,
    totalActiveFilterCount = 0,
    pageRowCount = 0,
} = {}) {
    const items = [];
    const identityChip = !showingChartView ? resolveResultIdentityChip({
        showingChartView,
        canShowResults,
        activeTablePresetTitle,
        modifiedTablePresetTitle,
    }) : "";
    if (selectedMeasuresCount > 0) {
        items.push(`${selectedMeasuresCount} measure${selectedMeasuresCount === 1 ? "" : "s"}`);
    }
    if (selectedDimensionsCount > 0) {
        items.push(`${selectedDimensionsCount} breakdown${selectedDimensionsCount === 1 ? "" : "s"}`);
    }
    if (totalActiveFilterCount > 0) {
        items.push(`${totalActiveFilterCount} filter${totalActiveFilterCount === 1 ? "" : "s"}`);
    }
    if (!showingChartView && canShowResults && pageRowCount > 0) {
        items.push(`${pageRowCount} page row${pageRowCount === 1 ? "" : "s"}`);
    }
    if (identityChip) {
        items.unshift(identityChip);
    }
    return items;
}

export function buildReportBuilderDesktopResultState({
    showingChartView = false,
    chartTitle = "",
    fallbackChartTitle = "Chart results",
    chartUsesFullQuery = false,
    canShowResults = false,
    canRunReport = false,
    loading = false,
    error = null,
    readinessReason = "",
    readinessMessage = "",
    activeTablePresetTitle = "",
    activeTablePresetDescription = "",
    activeTablePresetEyebrow = "",
    activeTablePresetAccentTone = "",
    activeTablePresetHighlights = [],
    activeChartPresetTitle = "",
    activeChartPresetEyebrow = "",
    activeChartPresetAccentTone = "",
    activeChartPresetHighlights = [],
    modifiedTablePresetTitle = "",
    chartIdentityLabel = "",
    selectedMeasuresCount = 0,
    selectedDimensionsCount = 0,
    totalActiveFilterCount = 0,
    pageRowCount = 0,
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
            showingChartView,
            chartUsesFullQuery,
            canShowResults,
            canRunReport,
            readinessReason,
            readinessMessage,
            activeTablePresetTitle,
            activeTablePresetDescription,
            modifiedTablePresetTitle,
        }),
        presetIdentity: showingChartView && (
            normalizeString(activeChartPresetEyebrow)
            || normalizeString(activeChartPresetAccentTone)
            || normalizeStringArray(activeChartPresetHighlights).length > 0
        )
            ? {
                eyebrow: normalizeString(activeChartPresetEyebrow),
                title: normalizeString(activeChartPresetTitle || chartTitle || fallbackChartTitle),
                accentTone: normalizeString(activeChartPresetAccentTone),
                highlights: normalizeStringArray(activeChartPresetHighlights),
            }
            : (canShowResults && normalizeString(activeTablePresetTitle)
                ? {
                    eyebrow: normalizeString(activeTablePresetEyebrow),
                    title: normalizeString(activeTablePresetTitle),
                    accentTone: normalizeString(activeTablePresetAccentTone),
                    highlights: normalizeStringArray(activeTablePresetHighlights),
                }
                : null),
        metaItems: resolveReportBuilderResultMetaItems({
            showingChartView,
            canShowResults,
            activeTablePresetTitle,
            modifiedTablePresetTitle,
            chartIdentityLabel,
            selectedMeasuresCount,
            selectedDimensionsCount,
            totalActiveFilterCount,
            pageRowCount,
        }),
    };
}

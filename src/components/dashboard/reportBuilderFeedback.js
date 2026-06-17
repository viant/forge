function normalizeString(value = "") {
    return String(value || "").trim();
}

function describePreparedReadiness(preparedReadiness = {}, successPrefix = "Applied this preset.") {
    if (!preparedReadiness || preparedReadiness.canRun) {
        return successPrefix;
    }
    if (preparedReadiness.reason === "semantic") {
        const readinessMessage = normalizeString(preparedReadiness.message);
        if (readinessMessage) {
            return `${successPrefix} ${readinessMessage}`;
        }
    }
    return `${successPrefix} Resolve semantic field issues before refreshing results.`;
}

export function buildReportBuilderPresetApplyFeedback({
    kind = "chart",
    presetTitle = "",
    changedParts = [],
    selectionChanged = false,
    didFetchPreparedState = false,
    preparedReadiness = {},
    requiresManualRun = false,
} = {}) {
    const normalizedKind = normalizeString(kind).toLowerCase();
    const changedText = (Array.isArray(changedParts) ? changedParts : []).filter(Boolean).join(" and ");
    if (normalizedKind === "tablecalc") {
        const successPrefix = `Added ${normalizeString(presetTitle) || "this table calculation"}.`;
        if (!selectionChanged) {
            return {
                level: "info",
                message: successPrefix,
            };
        }
        return {
            level: "info",
            message: didFetchPreparedState
                ? `${successPrefix} Refreshing results.`
                : !preparedReadiness.canRun
                    ? describePreparedReadiness(preparedReadiness, successPrefix)
                    : requiresManualRun
                        ? `${successPrefix} Run to refresh results.`
                        : successPrefix,
            action: requiresManualRun && preparedReadiness.canRun ? "runReport" : "",
        };
    }
    if (normalizedKind === "table") {
        const successPrefix = `Applied ${normalizeString(presetTitle) || "this table preset"}.`;
        if (!selectionChanged) {
            return {
                level: "info",
                message: successPrefix,
            };
        }
        return {
            level: "info",
            message: didFetchPreparedState
                ? `${successPrefix} Refreshing results.`
                : !preparedReadiness.canRun
                    ? describePreparedReadiness(preparedReadiness, successPrefix)
                    : requiresManualRun
                        ? `${successPrefix} Run to refresh results.`
                        : successPrefix,
            action: requiresManualRun && preparedReadiness.canRun ? "runReport" : "",
        };
    }
    if (!selectionChanged) {
        return null;
    }
    const successPrefix = `Applied this preset's required ${changedText || "chart settings"}.`;
    return {
        level: "info",
        message: didFetchPreparedState
            ? `${successPrefix} Refreshing results.`
            : !preparedReadiness.canRun
                ? describePreparedReadiness(preparedReadiness, successPrefix)
                : requiresManualRun
                    ? `${successPrefix} Run to refresh results.`
                    : successPrefix,
        action: requiresManualRun && preparedReadiness.canRun ? "runReport" : "",
    };
}

export function resolveCompactChartSheetNotice({
    chartApplyFeedback = null,
    semanticSelectedIssueCount = 0,
    semanticFieldValidationMessage = "",
    readinessReason = "",
    readinessMessage = "",
    semanticStatusLevel = "",
    semanticSelectionValidationError = "",
    semanticSelectionValidationValid = null,
    showingChartView = false,
    activeTablePresetTitle = "",
    modifiedTablePresetTitle = "",
} = {}) {
    if (chartApplyFeedback?.message) {
        return {
            level: chartApplyFeedback.level || "warning",
            message: chartApplyFeedback.message,
        };
    }
    if (Number(semanticSelectedIssueCount || 0) > 0 && readinessReason === "semantic") {
        return {
            level: "danger",
            message: `Semantic selection issue: ${normalizeString(semanticFieldValidationMessage) || "Resolve semantic field issues before running the report."}`,
        };
    }
    if (
        Number(semanticSelectedIssueCount || 0) === 0
        && readinessReason === "semantic"
        && normalizeString(readinessMessage)
        && normalizeString(semanticStatusLevel).toLowerCase() === "info"
    ) {
        return {
            level: normalizeString(semanticSelectionValidationError) || semanticSelectionValidationValid === false ? "danger" : "info",
            message: `Semantic validation: ${normalizeString(readinessMessage)}`,
        };
    }
    if (!showingChartView) {
        if (normalizeString(activeTablePresetTitle)) {
            return {
                level: "info",
                message: `Active table preset: ${normalizeString(activeTablePresetTitle)}`,
            };
        }
        if (normalizeString(modifiedTablePresetTitle)) {
            return {
                level: "warning",
                message: `Modified from ${normalizeString(modifiedTablePresetTitle)}. Use Quick view to restore the named table preset.`,
            };
        }
    }
    return null;
}

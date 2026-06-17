export function resolveReportBuilderActiveResultState({
    loading = false,
    error = null,
    chartDataMode = "",
    showingChartView = false,
    chartQueryLoading = false,
    chartRenderRowCount = 0,
    chartQueryError = null,
    resolvedResultRowCount = 0,
    retainResultsWhileLoading = false,
    canRunReport = false,
    canShowResults = false,
} = {}) {
    const keepVisibleResults = !!retainResultsWhileLoading && Number(resolvedResultRowCount || 0) > 0;
    const activeResultLoading = (!!loading && !keepVisibleResults)
        || (!keepVisibleResults
            && String(chartDataMode || "").trim() === "fullQuery"
            && !!showingChartView
            && !!chartQueryLoading
            && Number(chartRenderRowCount || 0) === 0);
    const activeResultError = error
        || (String(chartDataMode || "").trim() === "fullQuery" && !!showingChartView ? chartQueryError : null);
    const reportBuilderStateMarker = activeResultLoading
        ? "loading"
        : (activeResultError
            ? "error"
            : (!canShowResults ? (canRunReport ? "ready" : "needs-input") : (showingChartView ? "chart" : "table")));
    return {
        activeResultLoading,
        activeResultError,
        reportBuilderStateMarker,
    };
}

export function buildReportBuilderEmptyResultState({
    canRunReport = false,
    hasCompletedCurrentRun = false,
    readinessReason = "",
    readinessMessage = "",
    readinessAction = "",
} = {}) {
    if (canRunReport) {
        return {
            icon: hasCompletedCurrentRun ? "search-around" : "play",
            eyebrow: hasCompletedCurrentRun ? "No rows returned" : "Ready to run",
            title: hasCompletedCurrentRun ? "No rows matched the current scope" : "Run the report to preview results",
            description: hasCompletedCurrentRun
                ? "Try widening the date range or adjusting the selected scope and filters."
                : "Run the current setup to unlock table and chart analysis.",
            actionLabel: !hasCompletedCurrentRun ? "Run report" : "",
            action: "",
        };
    }
    if (String(readinessReason || "").trim() === "semantic") {
        return {
            icon: "filter-list",
            eyebrow: "Semantic issue",
            title: "Resolve semantic selection issues",
            description: readinessMessage || "Remove unmapped fields or add valid semantic mappings before running the report.",
            actionLabel: String(readinessAction || "").trim() === "retrySemanticValidation" ? "Retry validation" : "",
            action: String(readinessAction || "").trim(),
        };
    }
    if (String(readinessReason || "").trim() === "scope") {
        return {
            icon: "filter-list",
            eyebrow: "Scope required",
            title: "Choose the required scope",
            description: "Select an advertiser, campaign, ad order, or audience before running the report.",
            actionLabel: "",
            action: "",
        };
    }
    return {
        icon: "filter-list",
        eyebrow: "Scope required",
        title: "Complete the required filters",
        description: "Set the remaining required filters before running the report.",
        actionLabel: "",
        action: "",
    };
}

function normalizeRuntimePreviewDiagnostics(diagnostics = []) {
    return (Array.isArray(diagnostics) ? diagnostics : [])
        .filter((diagnostic) => diagnostic && typeof diagnostic === "object" && !Array.isArray(diagnostic))
        .map((diagnostic, index) => ({
            id: String(diagnostic.id || `${diagnostic.code || "diagnostic"}_${index + 1}`),
            severity: String(diagnostic.severity || "error").trim().toLowerCase() || "error",
            code: String(diagnostic.code || "").trim(),
            path: String(diagnostic.path || "").trim(),
            message: String(diagnostic.message || "").trim(),
            suggestedFix: String(diagnostic.suggestedFix || "").trim(),
        }))
        .filter((diagnostic) => !!diagnostic.message);
}

function normalizeCompileDiagnosticsNoticeEntries(diagnostics = []) {
    return (Array.isArray(diagnostics) ? diagnostics : [])
        .filter((diagnostic) => diagnostic && typeof diagnostic === "object" && !Array.isArray(diagnostic))
        .map((diagnostic, index) => ({
            id: String(diagnostic.id || `${diagnostic.code || "diagnostic"}_${index + 1}`),
            severity: String(diagnostic.severity || "error").trim().toLowerCase() || "error",
            code: String(diagnostic.code || "").trim(),
            path: String(diagnostic.path || "").trim(),
            blockId: String(diagnostic.blockId || "").trim(),
            message: String(diagnostic.message || "").trim(),
            suggestedFix: String(diagnostic.suggestedFix || "").trim(),
        }))
        .filter((diagnostic) => !!diagnostic.message);
}

function toneFromSemanticDiagnosticsLevel(level = "") {
    const normalized = String(level || "").trim().toLowerCase();
    if (normalized === "danger") {
        return "error";
    }
    if (normalized === "warning") {
        return "warning";
    }
    return "neutral";
}

export function buildReportBuilderRuntimePreviewBlockedState({
    canRunReport = false,
    readinessReason = "",
    readinessMessage = "",
    readinessAction = "",
    semanticDiagnosticsNotice = null,
} = {}) {
    if (canRunReport) {
        return null;
    }
    const emptyState = buildReportBuilderEmptyResultState({
        canRunReport,
        readinessReason,
        readinessMessage,
        readinessAction,
    });
    const diagnostics = normalizeRuntimePreviewDiagnostics(semanticDiagnosticsNotice?.diagnostics);
    return {
        ...emptyState,
        tone: String(readinessReason || "").trim() === "semantic"
            ? toneFromSemanticDiagnosticsLevel(semanticDiagnosticsNotice?.level)
            : "neutral",
        diagnostics,
        diagnosticsTitle: String(semanticDiagnosticsNotice?.title || "").trim(),
        diagnosticsDescription: String(semanticDiagnosticsNotice?.description || "").trim(),
    };
}

export function buildReportBuilderCompileDiagnosticsNotice({
    compileValidation = {},
    title = "Compile diagnostics",
    description = "",
} = {}) {
    const diagnostics = normalizeCompileDiagnosticsNoticeEntries(compileValidation?.diagnostics);
    if (diagnostics.length === 0) {
        return null;
    }
    const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === "error");
    const hasWarnings = diagnostics.some((diagnostic) => diagnostic.severity === "warning");
    return {
        level: hasErrors ? "danger" : (hasWarnings ? "warning" : "info"),
        title: String(title || "Compile diagnostics").trim() || "Compile diagnostics",
        description: String(description || "").trim()
            || (hasErrors
                ? String(compileValidation?.message || "Resolve compile/runtime issues before using this artifact.").trim()
                : (diagnostics.length === 1
                    ? "This artifact carries 1 compile/runtime diagnostic."
                    : `This artifact carries ${diagnostics.length} compile/runtime diagnostics.`)),
        diagnostics,
    };
}

import { buildReportBuilderSemanticBindingViewState } from "./reportBuilderSemanticBindingViewState.js";
import { buildReportBuilderScopeSummaryFromParams } from "./reportBuilderDocumentBlocks.js";
import { resolveNormalizedReportSpecDocumentContext } from "./reportBuilderSavedRecordMetadataContext.js";

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
        if (String(readinessAction || "").trim() === "retrySemanticModelLoad") {
            return {
                icon: "database",
                eyebrow: "Semantic model",
                title: "Reload semantic model metadata",
                description: readinessMessage || "The semantic model could not be loaded for this report.",
                actionLabel: "Retry model load",
                action: "retrySemanticModelLoad",
            };
        }
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
            description: "Select the required scope before running the report.",
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
            ? (
                String(readinessAction || "").trim() === "retrySemanticModelLoad"
                    ? "error"
                    : toneFromSemanticDiagnosticsLevel(semanticDiagnosticsNotice?.level)
            )
            : "neutral",
        diagnostics,
        diagnosticsTitle: String(semanticDiagnosticsNotice?.title || "").trim(),
        diagnosticsDescription: String(semanticDiagnosticsNotice?.description || "").trim(),
    };
}

function resolvePrimaryRuntimeDataset(runtimeConfig = null) {
    const datasets = Array.isArray(runtimeConfig?.reportFill?.datasets)
        ? runtimeConfig.reportFill.datasets
        : [];
    return datasets.find((dataset) => String(dataset?.id || "").trim() === "primary")
        || datasets[0]
        || null;
}

export function buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled = false,
    runtimePreviewArtifact = null,
    runtimePreviewRowsSource = {},
    canRunReport = false,
    readinessReason = "",
    runtimePreviewArtifactDiagnostics = [],
    runtimePreviewBlockedState = null,
    runtimePreviewErrorDescription = "",
} = {}) {
    if (!runtimePreviewEnabled) {
        return null;
    }
    const runtimeConfig = runtimePreviewArtifact?.runtimeBlock?.dashboard?.reportRuntime || null;
    const runtimePrimaryDataset = resolvePrimaryRuntimeDataset(runtimeConfig);
    const hasRuntimeRows = Array.isArray(runtimePrimaryDataset?.rows)
        && runtimePrimaryDataset.rows.length > 0;
    const loading = !!runtimePreviewRowsSource?.loading;
    const error = runtimePreviewRowsSource?.error || null;
    const diagnostics = Array.isArray(runtimePreviewArtifactDiagnostics)
        ? runtimePreviewArtifactDiagnostics
        : [];
    const runtimePreviewContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec: runtimeConfig?.reportSpec || runtimePreviewArtifact?.reportSpec || null,
        document: runtimePreviewArtifact?.document || null,
        title: runtimePreviewArtifact?.document?.title || "",
    });
    const scopeSummary = buildReportBuilderScopeSummaryFromParams(runtimePreviewContext?.scopeParams);
    const semanticBindingViewState = runtimeConfig?.semanticBindingViewState && typeof runtimeConfig.semanticBindingViewState === "object" && !Array.isArray(runtimeConfig.semanticBindingViewState)
        ? runtimeConfig.semanticBindingViewState
        : buildReportBuilderSemanticBindingViewState({
            semanticSummary: runtimePreviewContext?.semanticSummary || null,
            binding: runtimePreviewContext?.binding || null,
        });
    return {
        eyebrow: "Authored Runtime",
        title: runtimePreviewArtifact?.document?.title || runtimePreviewContext?.title || "Compiled Runtime Preview",
        subtitle: String(runtimePreviewContext?.document?.subtitle || runtimePreviewArtifact?.document?.subtitle || "").trim(),
        description: runtimePreviewContext?.document?.description
            || runtimePreviewArtifact?.document?.description
            || "Refine the current builder result through the compiled ReportDocument, ReportSpec, and ReportFill flow.",
        ...(semanticBindingViewState ? {
            semanticBindingTitle: semanticBindingViewState.title,
            semanticBindingChips: semanticBindingViewState.chips,
            ...(Array.isArray(semanticBindingViewState.fieldGroups) && semanticBindingViewState.fieldGroups.length > 0
                ? { semanticBindingFieldGroups: semanticBindingViewState.fieldGroups }
                : {}),
        } : {}),
        ...(Array.isArray(scopeSummary?.items) && scopeSummary.items.length > 0 ? {
            scopeSummaryTitle: "Report Scope",
            scopeSummaryText: scopeSummary.text,
            scopeSummaryItems: scopeSummary.items,
        } : {}),
        runtimeConfig,
        hasRuntimeRows,
        loadingState: loading && !hasRuntimeRows
            ? {
                icon: "refresh",
                eyebrow: "Runtime preview",
                title: "Refreshing authored runtime",
                description: "Executing the compiled runtime request for the current builder state.",
                animated: true,
            }
            : null,
        blockedState: !canRunReport && !loading ? runtimePreviewBlockedState : null,
        errorState: !loading && error && !hasRuntimeRows
            ? {
                tone: "error",
                icon: "warning-sign",
                eyebrow: "Runtime preview",
                title: "We couldn't compile these runtime results",
                description: String(runtimePreviewErrorDescription || "").trim(),
            }
            : null,
        canRenderRuntime: !!runtimeConfig
            && (canRunReport || (String(readinessReason || "").trim() === "semantic" && diagnostics.length > 0)),
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

import { resolvePreferredReportBuilderSemanticBindingViewState } from "./reportBuilderSemanticBindingViewPreference.js";
import { buildReportBuilderScopeSummaryFromParams } from "./reportBuilderDocumentBlocks.js";
import { resolveNormalizedReportSpecDocumentContext } from "./reportBuilderSavedRecordMetadataContext.js";
import { hasReportBuilderSemanticModelResolutionDiagnostics } from "./reportBuilderSemantic.js";

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

export function buildReportBuilderActiveResultErrorDiagnosticsState(error = null) {
    return buildReportBuilderErrorDiagnosticsState({
        error,
        title: "Result diagnostics",
        singularDescription: "This result returned 1 diagnostic.",
        pluralDescriptionPrefix: "This result returned",
        semanticModelDescription: "The semantic model could not be resolved for the current result.",
    });
}

export function buildReportBuilderEmptyResultState({
    canRunReport = false,
    hasCompletedCurrentRun = false,
    readinessReason = "",
    readinessMessage = "",
    readinessAction = "",
    readinessIssueKind = "",
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
        if (
            String(readinessAction || "").trim() === "retrySemanticValidation"
            && String(readinessIssueKind || "").trim() === "semanticModelResolution"
        ) {
            return {
                icon: "database",
                eyebrow: "Semantic model",
                title: "Retry semantic validation",
                description: readinessMessage || "The semantic model could not be resolved for this report.",
                actionLabel: "Retry validation",
                action: "retrySemanticValidation",
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

export function buildReportBuilderErrorDiagnosticsState({
    error = null,
    title = "Result diagnostics",
    singularDescription = "This result returned 1 diagnostic.",
    pluralDescriptionPrefix = "This result returned",
    semanticModelDescription = "The semantic model could not be resolved for the current result.",
} = {}) {
    const normalizedDiagnostics = normalizeRuntimePreviewDiagnostics(
        Array.isArray(error?.diagnostics) ? error.diagnostics : [],
    );
    if (normalizedDiagnostics.length === 0) {
        return null;
    }
    if (hasReportBuilderSemanticModelResolutionDiagnostics(normalizedDiagnostics)) {
        return {
            diagnosticsTitle: "Semantic model diagnostics",
            diagnosticsDescription: String(semanticModelDescription || "").trim() || "The semantic model could not be resolved for the current result.",
            diagnostics: normalizedDiagnostics,
        };
    }
    return {
        diagnosticsTitle: String(title || "").trim() || "Result diagnostics",
        diagnosticsDescription: normalizedDiagnostics.length === 1
            ? (String(singularDescription || "").trim() || "This result returned 1 diagnostic.")
            : `${String(pluralDescriptionPrefix || "").trim() || "This result returned"} ${normalizedDiagnostics.length} diagnostics.`,
        diagnostics: normalizedDiagnostics,
    };
}

function buildRuntimePreviewErrorDiagnosticsState(diagnostics = []) {
    return buildReportBuilderErrorDiagnosticsState({
        error: { diagnostics },
        title: "Runtime preview diagnostics",
        singularDescription: "This runtime preview returned 1 diagnostic.",
        pluralDescriptionPrefix: "This runtime preview returned",
        semanticModelDescription: "The semantic model could not be resolved for this runtime preview.",
    });
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
    readinessIssueKind = "",
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
        readinessIssueKind,
    });
    const diagnostics = normalizeRuntimePreviewDiagnostics(semanticDiagnosticsNotice?.diagnostics);
    return {
        ...(
            String(readinessAction || "").trim() === "retrySemanticValidation"
            && (
                String(readinessIssueKind || "").trim() === "semanticModelResolution"
                || hasReportBuilderSemanticModelResolutionDiagnostics(diagnostics)
            )
                ? {
                    icon: "database",
                    eyebrow: "Semantic model",
                    title: "Retry semantic validation",
                    description: readinessMessage || "The semantic model could not be resolved for this report.",
                    actionLabel: "Retry validation",
                    action: "retrySemanticValidation",
                }
                : emptyState
        ),
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

function resolveRuntimeDatasets(runtimeConfig = null) {
    const datasets = Array.isArray(runtimeConfig?.reportFill?.datasets)
        ? runtimeConfig.reportFill.datasets
        : [];
    return datasets;
}

function resolveRuntimeHasRows(runtimeConfig = null) {
    return resolveRuntimeDatasets(runtimeConfig).some((dataset) => (
        Array.isArray(dataset?.rows) && dataset.rows.length > 0
    ));
}

function buildReportBuilderAuthoredRuntimePreviewSemanticSections({
    runtimeConfig = null,
    runtimePreviewArtifact = null,
} = {}) {
    const runtimePreviewContext = resolveNormalizedReportSpecDocumentContext({
        reportSpec: runtimeConfig?.reportSpec || runtimePreviewArtifact?.reportSpec || null,
        document: runtimePreviewArtifact?.document || null,
        title: runtimePreviewArtifact?.document?.title || "",
    });
    const scopeSummary = buildReportBuilderScopeSummaryFromParams(runtimePreviewContext?.scopeParams);
    const semanticBindingViewState = resolvePreferredReportBuilderSemanticBindingViewState({
        metadataContexts: [runtimePreviewContext],
        candidates: [
            runtimeConfig?.semanticBindingViewState,
            runtimePreviewArtifact?.semanticBindingViewState,
        ],
    });
    return {
        runtimePreviewContext,
        ...(semanticBindingViewState ? {
            semanticBindingTitle: semanticBindingViewState.title,
            semanticBindingChips: semanticBindingViewState.chips,
            ...(Array.isArray(semanticBindingViewState.fieldGroups) && semanticBindingViewState.fieldGroups.length > 0
                ? { semanticBindingFieldGroups: semanticBindingViewState.fieldGroups }
                : {}),
        } : {}),
        ...(Array.isArray(scopeSummary?.items) && scopeSummary.items.length > 0 ? {
            scopeSummaryTitle: "Filters",
            scopeSummaryText: scopeSummary.text,
            scopeSummaryItems: scopeSummary.items,
        } : {}),
    };
}

export function buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled = false,
    runtimePreviewArtifact = null,
    runtimePreviewRowsSource = {},
    canRunReport = false,
    readinessReason = "",
    readinessAction = "",
    readinessIssueKind = "",
    runtimePreviewArtifactDiagnostics = [],
    runtimePreviewBlockedState = null,
    runtimePreviewErrorDescription = "",
    presentationMode = "preview",
} = {}) {
    if (!runtimePreviewEnabled) {
        return null;
    }
    const normalizedPresentationMode = String(presentationMode || "").trim().toLowerCase() === "report"
        ? "report"
        : "preview";
    const reportPresentation = normalizedPresentationMode === "report";
    const runtimeConfig = runtimePreviewArtifact?.runtimeBlock?.dashboard?.reportRuntime || null;
    const hasRuntimeRows = resolveRuntimeHasRows(runtimeConfig);
    const loading = !!runtimePreviewRowsSource?.loading;
    const error = runtimePreviewRowsSource?.error || null;
    const diagnostics = Array.isArray(runtimePreviewArtifactDiagnostics)
        ? runtimePreviewArtifactDiagnostics
        : [];
    const runtimePreviewErrorDiagnostics = buildRuntimePreviewErrorDiagnosticsState(diagnostics);
    const authoredRuntimeSemanticSections = buildReportBuilderAuthoredRuntimePreviewSemanticSections({
        runtimeConfig,
        runtimePreviewArtifact,
    });
    const runtimePreviewContext = authoredRuntimeSemanticSections.runtimePreviewContext || null;
    const isLoadingWithoutRuntimeRows = loading && !hasRuntimeRows;
    const isLoadingWithRetainedRuntimeRows = loading && hasRuntimeRows;
    return {
        eyebrow: reportPresentation ? "Report" : "Preview",
        title: runtimePreviewArtifact?.document?.title
            || runtimePreviewContext?.title
            || (reportPresentation ? "Report" : "Preview"),
        subtitle: String(runtimePreviewContext?.document?.subtitle || runtimePreviewArtifact?.document?.subtitle || "").trim(),
        description: runtimePreviewContext?.document?.description
            || runtimePreviewArtifact?.document?.description
            || (
                reportPresentation
                    ? "Review the live report built from the current report definition."
                    : "Review the live preview built from the current report definition."
            ),
        ...Object.fromEntries(
            Object.entries(authoredRuntimeSemanticSections)
                .filter(([key]) => key !== "runtimePreviewContext"),
        ),
        runtimeConfig,
        hasRuntimeRows,
        loadingState: isLoadingWithoutRuntimeRows
            ? {
                icon: "refresh",
                eyebrow: reportPresentation ? "Report" : "Runtime preview",
                title: reportPresentation ? "Preparing report" : "Refreshing preview",
                description: reportPresentation
                    ? "Running the current report definition."
                    : "Running the current preview definition.",
                animated: true,
            }
            : null,
        updatingNotice: isLoadingWithRetainedRuntimeRows
            ? {
                level: "info",
                message: reportPresentation
                    ? "Updating this report with the latest results…"
                    : "Updating results…",
            }
            : null,
        blockedState: !hasRuntimeRows && !canRunReport && !loading ? runtimePreviewBlockedState : null,
        errorState: !loading && error && !hasRuntimeRows
            ? {
                tone: "error",
                icon: "warning-sign",
                eyebrow: reportPresentation ? "Report" : "Runtime preview",
                title: reportPresentation ? "We couldn't prepare this report" : "We couldn't compile these runtime results",
                description: String(runtimePreviewErrorDescription || "").trim(),
                ...(
                    String(readinessAction || "").trim() === "retrySemanticModelLoad"
                        ? {
                            actionLabel: "Retry model load",
                            action: "retrySemanticModelLoad",
                        }
                        : (
                            String(readinessAction || "").trim() === "retrySemanticValidation"
                            && (
                                String(readinessIssueKind || "").trim() === "semanticModelResolution"
                                || hasReportBuilderSemanticModelResolutionDiagnostics(diagnostics)
                            )
                        )
                            ? {
                                actionLabel: "Retry validation",
                                action: "retrySemanticValidation",
                            }
                            : {}
                ),
                ...(runtimePreviewErrorDiagnostics || {}),
            }
            : null,
        canRenderRuntime: !!runtimeConfig
            && !isLoadingWithoutRuntimeRows
            && (
                hasRuntimeRows
                || canRunReport
                || (String(readinessReason || "").trim() === "semantic" && diagnostics.length > 0)
            ),
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

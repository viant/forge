import assert from "node:assert/strict";

import {
    buildReportBuilderCompileDiagnosticsNotice,
    buildReportBuilderEmptyResultState,
    buildReportBuilderRuntimePreviewBlockedState,
    resolveReportBuilderActiveResultState,
} from "./reportBuilderResultFrame.js";

assert.deepEqual(resolveReportBuilderActiveResultState({
    loading: true,
    canRunReport: true,
    canShowResults: false,
}), {
    activeResultLoading: true,
    activeResultError: null,
    reportBuilderStateMarker: "loading",
});

const chartError = new Error("chart failed");
assert.deepEqual(resolveReportBuilderActiveResultState({
    loading: false,
    error: null,
    chartDataMode: "fullQuery",
    showingChartView: true,
    chartQueryLoading: false,
    chartRenderRowCount: 0,
    chartQueryError: chartError,
    canRunReport: true,
    canShowResults: true,
}), {
    activeResultLoading: false,
    activeResultError: chartError,
    reportBuilderStateMarker: "error",
});

assert.deepEqual(resolveReportBuilderActiveResultState({
    loading: false,
    error: null,
    chartDataMode: "fullQuery",
    showingChartView: true,
    chartQueryLoading: true,
    chartRenderRowCount: 0,
    chartQueryError: null,
    canRunReport: true,
    canShowResults: true,
}), {
    activeResultLoading: true,
    activeResultError: null,
    reportBuilderStateMarker: "loading",
});

assert.deepEqual(resolveReportBuilderActiveResultState({
    loading: false,
    error: null,
    chartDataMode: "fullQuery",
    showingChartView: true,
    chartQueryLoading: true,
    chartRenderRowCount: 3,
    chartQueryError: null,
    canRunReport: true,
    canShowResults: true,
}), {
    activeResultLoading: false,
    activeResultError: null,
    reportBuilderStateMarker: "chart",
});

assert.deepEqual(resolveReportBuilderActiveResultState({
    loading: true,
    error: null,
    resolvedResultRowCount: 4,
    retainResultsWhileLoading: true,
    canRunReport: true,
    canShowResults: true,
    showingChartView: true,
}), {
    activeResultLoading: false,
    activeResultError: null,
    reportBuilderStateMarker: "chart",
});

assert.deepEqual(resolveReportBuilderActiveResultState({
    loading: true,
    error: null,
    chartDataMode: "fullQuery",
    showingChartView: true,
    chartQueryLoading: true,
    chartRenderRowCount: 0,
    resolvedResultRowCount: 4,
    retainResultsWhileLoading: true,
    canRunReport: true,
    canShowResults: true,
}), {
    activeResultLoading: false,
    activeResultError: null,
    reportBuilderStateMarker: "chart",
});

assert.deepEqual(resolveReportBuilderActiveResultState({
    canRunReport: true,
    canShowResults: true,
    showingChartView: false,
}), {
    activeResultLoading: false,
    activeResultError: null,
    reportBuilderStateMarker: "table",
});

assert.deepEqual(resolveReportBuilderActiveResultState({
    canRunReport: true,
    canShowResults: false,
    showingChartView: false,
}), {
    activeResultLoading: false,
    activeResultError: null,
    reportBuilderStateMarker: "ready",
});

assert.deepEqual(resolveReportBuilderActiveResultState({
    canRunReport: false,
    canShowResults: false,
    showingChartView: false,
}), {
    activeResultLoading: false,
    activeResultError: null,
    reportBuilderStateMarker: "needs-input",
});

assert.deepEqual(resolveReportBuilderActiveResultState({
    canRunReport: true,
    canShowResults: true,
    showingChartView: true,
}), {
    activeResultLoading: false,
    activeResultError: null,
    reportBuilderStateMarker: "chart",
});

const primaryError = new Error("primary failed");
assert.deepEqual(resolveReportBuilderActiveResultState({
    loading: false,
    error: primaryError,
    chartDataMode: "fullQuery",
    showingChartView: true,
    chartQueryLoading: false,
    chartRenderRowCount: 0,
    chartQueryError: chartError,
    canRunReport: true,
    canShowResults: true,
}), {
    activeResultLoading: false,
    activeResultError: primaryError,
    reportBuilderStateMarker: "error",
});

assert.deepEqual(buildReportBuilderEmptyResultState({
    canRunReport: true,
    hasCompletedCurrentRun: false,
}), {
    icon: "play",
    eyebrow: "Ready to run",
    title: "Run the report to preview results",
    description: "Run the current setup to unlock table and chart analysis.",
    actionLabel: "Run report",
    action: "",
});

assert.deepEqual(buildReportBuilderEmptyResultState({
    canRunReport: true,
    hasCompletedCurrentRun: true,
}), {
    icon: "search-around",
    eyebrow: "No rows returned",
    title: "No rows matched the current scope",
    description: "Try widening the date range or adjusting the selected scope and filters.",
    actionLabel: "",
    action: "",
});

assert.deepEqual(buildReportBuilderEmptyResultState({
    canRunReport: false,
    readinessReason: "semantic",
    readinessMessage: "Validating the semantic selection against the provider.",
}), {
    icon: "filter-list",
    eyebrow: "Semantic issue",
    title: "Resolve semantic selection issues",
    description: "Validating the semantic selection against the provider.",
    actionLabel: "",
    action: "",
});

assert.deepEqual(buildReportBuilderEmptyResultState({
    canRunReport: false,
    readinessReason: "semantic",
    readinessMessage: "Semantic provider unavailable.",
    readinessAction: "retrySemanticValidation",
}), {
    icon: "filter-list",
    eyebrow: "Semantic issue",
    title: "Resolve semantic selection issues",
    description: "Semantic provider unavailable.",
    actionLabel: "Retry validation",
    action: "retrySemanticValidation",
});

assert.deepEqual(buildReportBuilderEmptyResultState({
    canRunReport: false,
    readinessReason: "scope",
}), {
    icon: "filter-list",
    eyebrow: "Scope required",
    title: "Choose the required scope",
    description: "Select an advertiser, campaign, ad order, or audience before running the report.",
    actionLabel: "",
    action: "",
});

assert.equal(buildReportBuilderRuntimePreviewBlockedState({
    canRunReport: true,
}), null);

assert.deepEqual(buildReportBuilderRuntimePreviewBlockedState({
    canRunReport: false,
    readinessReason: "semantic",
    readinessMessage: "Semantic provider unavailable.",
    readinessAction: "retrySemanticValidation",
    semanticDiagnosticsNotice: {
        level: "danger",
        title: "Semantic validation error",
        description: "The semantic provider returned 2 diagnostics for the current selection.",
        diagnostics: [
            {
                code: "selection.measureMissing",
                severity: "error",
                path: "selection.measures[0]",
                message: "Measure is not valid for the selected entity.",
                suggestedFix: "Select an approved measure.",
            },
        ],
    },
}), {
    icon: "filter-list",
    eyebrow: "Semantic issue",
    title: "Resolve semantic selection issues",
    description: "Semantic provider unavailable.",
    actionLabel: "Retry validation",
    action: "retrySemanticValidation",
    tone: "error",
    diagnosticsTitle: "Semantic validation error",
    diagnosticsDescription: "The semantic provider returned 2 diagnostics for the current selection.",
    diagnostics: [
        {
            id: "selection.measureMissing_1",
            severity: "error",
            code: "selection.measureMissing",
            path: "selection.measures[0]",
            message: "Measure is not valid for the selected entity.",
            suggestedFix: "Select an approved measure.",
        },
    ],
});

assert.deepEqual(buildReportBuilderRuntimePreviewBlockedState({
    canRunReport: false,
    readinessReason: "scope",
    readinessMessage: "Select a required scope first.",
}), {
    icon: "filter-list",
    eyebrow: "Scope required",
    title: "Choose the required scope",
    description: "Select an advertiser, campaign, ad order, or audience before running the report.",
    actionLabel: "",
    action: "",
    tone: "neutral",
    diagnosticsTitle: "",
    diagnosticsDescription: "",
    diagnostics: [],
});

assert.deepEqual(buildReportBuilderCompileDiagnosticsNotice({
    compileValidation: {
        valid: false,
        message: "Resolve authored block validation issues before preparing writable ReportDocument payloads.",
        diagnostics: [
            {
                code: "missingSemanticRef",
                severity: "error",
                path: "siteType",
                blockId: "primaryBuilder",
                message: "siteType is not mapped to the current semantic model.",
                suggestedFix: "Remove it or add a valid semantic mapping before running the report.",
            },
        ],
    },
    title: "Reopened compile diagnostics",
}), {
    level: "danger",
    title: "Reopened compile diagnostics",
    description: "Resolve authored block validation issues before preparing writable ReportDocument payloads.",
    diagnostics: [
        {
            id: "missingSemanticRef_1",
            severity: "error",
            code: "missingSemanticRef",
            path: "siteType",
            blockId: "primaryBuilder",
            message: "siteType is not mapped to the current semantic model.",
            suggestedFix: "Remove it or add a valid semantic mapping before running the report.",
        },
    ],
});

assert.deepEqual(buildReportBuilderCompileDiagnosticsNotice({
    compileValidation: {
        diagnostics: [
            {
                code: "semanticGovernance",
                severity: "info",
                message: "Audience Age Group • Draft",
            },
        ],
    },
    title: "Saved payload diagnostics",
}), {
    level: "info",
    title: "Saved payload diagnostics",
    description: "This artifact carries 1 compile/runtime diagnostic.",
    diagnostics: [
        {
            id: "semanticGovernance_1",
            severity: "info",
            code: "semanticGovernance",
            path: "",
            blockId: "",
            message: "Audience Age Group • Draft",
            suggestedFix: "",
        },
    ],
});

assert.deepEqual(buildReportBuilderCompileDiagnosticsNotice({
    compileValidation: {
        diagnostics: [
            {
                code: "semanticGovernance",
                severity: "warning",
                message: "Audience Age Group • Draft",
            },
            {
                code: "semanticProviderDiagnostics",
                severity: "warning",
                message: "The semantic provider returned 1 diagnostic for the current selection.",
            },
        ],
    },
    title: "Saved payload diagnostics",
}), {
    level: "warning",
    title: "Saved payload diagnostics",
    description: "This artifact carries 2 compile/runtime diagnostics.",
    diagnostics: [
        {
            id: "semanticGovernance_1",
            severity: "warning",
            code: "semanticGovernance",
            path: "",
            blockId: "",
            message: "Audience Age Group • Draft",
            suggestedFix: "",
        },
        {
            id: "semanticProviderDiagnostics_2",
            severity: "warning",
            code: "semanticProviderDiagnostics",
            path: "",
            blockId: "",
            message: "The semantic provider returned 1 diagnostic for the current selection.",
            suggestedFix: "",
        },
    ],
});

console.log("reportBuilderResultFrame ✓ active result and empty-state helpers");

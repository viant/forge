import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    buildReportBuilderAuthoredRuntimePreviewState,
    buildReportBuilderCompileDiagnosticsNotice,
    buildReportBuilderEmptyResultState,
    buildReportBuilderRuntimePreviewBlockedState,
    resolveReportBuilderActiveResultState,
} from "./reportBuilderResultFrame.js";

const audienceArtifactFixture = JSON.parse(
    readFileSync(
        new URL("../../reporting/fixtures/capacity-audience-artifact-fixture.v1.json", import.meta.url),
        "utf8",
    ),
);
const reportBuilderSource = readFileSync(
    new URL("./ReportBuilder.jsx", import.meta.url),
    "utf8",
);

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
    readinessReason: "semantic",
    readinessMessage: "Semantic model provider unavailable.",
    readinessAction: "retrySemanticModelLoad",
}), {
    icon: "database",
    eyebrow: "Semantic model",
    title: "Reload semantic model metadata",
    description: "Semantic model provider unavailable.",
    actionLabel: "Retry model load",
    action: "retrySemanticModelLoad",
});

assert.deepEqual(buildReportBuilderEmptyResultState({
    canRunReport: false,
    readinessReason: "scope",
}), {
    icon: "filter-list",
    eyebrow: "Scope required",
    title: "Choose the required scope",
    description: "Select the required scope before running the report.",
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
    readinessReason: "semantic",
    readinessMessage: "Semantic model provider unavailable.",
    readinessAction: "retrySemanticModelLoad",
}), {
    icon: "database",
    eyebrow: "Semantic model",
    title: "Reload semantic model metadata",
    description: "Semantic model provider unavailable.",
    actionLabel: "Retry model load",
    action: "retrySemanticModelLoad",
    tone: "error",
    diagnosticsTitle: "",
    diagnosticsDescription: "",
    diagnostics: [],
});

assert.deepEqual(buildReportBuilderRuntimePreviewBlockedState({
    canRunReport: false,
    readinessReason: "scope",
    readinessMessage: "Select a required scope first.",
}), {
    icon: "filter-list",
    eyebrow: "Scope required",
    title: "Choose the required scope",
    description: "Select the required scope before running the report.",
    actionLabel: "",
    action: "",
    tone: "neutral",
    diagnosticsTitle: "",
    diagnosticsDescription: "",
    diagnostics: [],
});

assert.equal(buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: false,
}), null);

assert.deepEqual(buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: {
        document: {
            title: "Capacity Trend Q3",
            subtitle: "Preview subtitle",
            description: "Preview description",
        },
        runtimeBlock: {
            dashboard: {
                reportRuntime: {
                    reportSpec: {
                        scope: {
                            params: [
                                {
                                    id: "dateRange",
                                    label: "Reporting Window",
                                    description: "Approved reporting window for runtime preview.",
                                },
                            ],
                        },
                    },
                    reportFill: {
                        datasets: [
                            {
                                id: "primary",
                                rows: [],
                            },
                        ],
                    },
                },
            },
        },
    },
    runtimePreviewRowsSource: {
        loading: true,
    },
    canRunReport: true,
}), {
    eyebrow: "Authored Runtime",
    title: "Capacity Trend Q3",
    subtitle: "Preview subtitle",
    description: "Preview description",
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for runtime preview.",
        },
    ],
    runtimeConfig: {
        reportSpec: {
            scope: {
                params: [
                    {
                        id: "dateRange",
                        label: "Reporting Window",
                        description: "Approved reporting window for runtime preview.",
                    },
                ],
            },
        },
        reportFill: {
            datasets: [
                {
                    id: "primary",
                    rows: [],
                },
            ],
        },
    },
    hasRuntimeRows: false,
    loadingState: {
        icon: "refresh",
        eyebrow: "Runtime preview",
        title: "Refreshing authored runtime",
        description: "Executing the compiled runtime request for the current builder state.",
        animated: true,
    },
    blockedState: null,
    errorState: null,
    canRenderRuntime: true,
});

const audienceRuntimePreviewState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: {
        document: audienceArtifactFixture.savedReportPayload.reportDocument,
        runtimeBlock: {
            dashboard: {
                reportRuntime: {
                    reportSpec: audienceArtifactFixture.reportExportRequest.reportSpec,
                    reportFill: audienceArtifactFixture.reportExportRequest.reportFill,
                },
            },
        },
    },
    runtimePreviewRowsSource: {
        loading: false,
    },
    canRunReport: true,
});
assert.equal(audienceRuntimePreviewState.title, "Capacity Audience Segment Index Q3");
assert.equal(audienceRuntimePreviewState.semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(audienceRuntimePreviewState.semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(audienceRuntimePreviewState.scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(
    audienceRuntimePreviewState.semanticBindingFieldGroups[1].fields[0].definitionRef,
    "harmonizer://feature/user.segment.index",
);
assert.equal(
    audienceRuntimePreviewState.semanticBindingFieldGroups[2].fields[1].definitionRef,
    "harmonizer://feature/user.segment",
);
assert.equal(audienceRuntimePreviewState.hasRuntimeRows, true);

const audienceRuntimePreviewStateWithEmptySpec = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: {
        document: audienceArtifactFixture.savedReportPayload.reportDocument,
        runtimeBlock: {
            dashboard: {
                reportRuntime: {
                    reportSpec: {
                        version: 1,
                        kind: "reportSpec",
                        scope: {
                            params: [],
                        },
                    },
                    reportFill: audienceArtifactFixture.reportExportRequest.reportFill,
                },
            },
        },
    },
    runtimePreviewRowsSource: {
        loading: false,
    },
    canRunReport: true,
});
assert.equal(audienceRuntimePreviewStateWithEmptySpec.semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(audienceRuntimePreviewStateWithEmptySpec.semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(audienceRuntimePreviewStateWithEmptySpec.scopeSummaryText, "Date Range • Channels • Audience Segment");

const runtimePreviewStateFromCarriedSemanticBinding = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: {
        document: {
            title: "Carried Semantic Runtime",
        },
        runtimeBlock: {
            dashboard: {
                reportRuntime: {
                    semanticBindingViewState: {
                        title: "Semantic Binding",
                        chips: [
                            "Model Ad Delivery",
                            "Entity Line Delivery",
                            "Measures Available Impressions",
                        ],
                        fieldGroups: [
                            {
                                id: "measures",
                                title: "Selected measures (1)",
                                fields: [
                                    { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
                                ],
                            },
                        ],
                    },
                    reportSpec: {
                        version: 1,
                        kind: "reportSpec",
                        scope: {
                            params: [],
                        },
                    },
                    reportFill: {
                        datasets: [
                            {
                                id: "primary",
                                rows: [],
                            },
                        ],
                    },
                },
            },
        },
    },
    runtimePreviewRowsSource: {
        loading: false,
    },
    canRunReport: true,
});
assert.equal(runtimePreviewStateFromCarriedSemanticBinding.semanticBindingChips.includes("Measures Available Impressions"), true);
assert.equal(runtimePreviewStateFromCarriedSemanticBinding.semanticBindingFieldGroups[0].fields[0].label, "Available Impressions");
assert.equal(reportBuilderSource.includes("ReportBuilderAuthoredRuntimePreviewHeader"), true);

assert.deepEqual(buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: {
        document: {
            title: "Semantic Capacity Trend Q3",
        },
        runtimeBlock: {
            dashboard: {
                reportRuntime: {
                    reportSpec: {
                        scope: {
                            params: [
                                {
                                    id: "dateRange",
                                    label: "Reporting Window",
                                    description: "Approved reporting window for runtime preview.",
                                },
                            ],
                        },
                        binding: {
                            mode: "semantic",
                            modelRef: "model://example/performance/delivery@v1",
                            entity: "line_delivery",
                        },
                        semanticSummary: {
                            kind: "semantic",
                            modelRef: "model://example/performance/delivery@v1",
                            modelLabel: "Ad Delivery",
                            entity: "line_delivery",
                            entityLabel: "Line Delivery",
                            selectedDimensions: [
                                { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                                { id: "channel", rawId: "channelV2", label: "Channel" },
                            ],
                            selectedMeasures: [
                                { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
                            ],
                        },
                    },
                    reportFill: {
                        datasets: [
                            {
                                id: "primary",
                                rows: [],
                            },
                        ],
                    },
                },
            },
        },
    },
    runtimePreviewRowsSource: {
        loading: false,
    },
    canRunReport: true,
}), {
    eyebrow: "Authored Runtime",
    title: "Semantic Capacity Trend Q3",
    subtitle: "",
    description: "Refine the current builder result through the compiled ReportDocument, ReportSpec, and ReportFill flow.",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for runtime preview.",
        },
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (2)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                { id: "channel", rawId: "channelV2", label: "Channel" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
            ],
        },
    ],
    runtimeConfig: {
        reportSpec: {
            scope: {
                params: [
                    {
                        id: "dateRange",
                        label: "Reporting Window",
                        description: "Approved reporting window for runtime preview.",
                    },
                ],
            },
            binding: {
                mode: "semantic",
                modelRef: "model://example/performance/delivery@v1",
                entity: "line_delivery",
            },
            semanticSummary: {
                kind: "semantic",
                modelRef: "model://example/performance/delivery@v1",
                modelLabel: "Ad Delivery",
                entity: "line_delivery",
                entityLabel: "Line Delivery",
                selectedDimensions: [
                    { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                    { id: "channel", rawId: "channelV2", label: "Channel" },
                ],
                selectedMeasures: [
                    { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
                ],
            },
        },
        reportFill: {
            datasets: [
                {
                    id: "primary",
                    rows: [],
                },
            ],
        },
    },
    hasRuntimeRows: false,
    loadingState: null,
    blockedState: null,
    errorState: null,
    canRenderRuntime: true,
});

assert.deepEqual(buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: {
        runtimeBlock: {
            dashboard: {
                reportRuntime: {
                    reportFill: {
                        datasets: [
                            {
                                id: "primary",
                                rows: [],
                            },
                        ],
                    },
                },
            },
        },
    },
    runtimePreviewRowsSource: {
        loading: false,
        error: new Error("runtime failed"),
    },
    canRunReport: false,
    readinessReason: "semantic",
    runtimePreviewArtifactDiagnostics: [{ code: "semantic.providerUnavailable" }],
    runtimePreviewBlockedState: {
        title: "Blocked",
    },
    runtimePreviewErrorDescription: "Runtime provider failed.",
}), {
    eyebrow: "Authored Runtime",
    title: "Compiled Runtime Preview",
    subtitle: "",
    description: "Refine the current builder result through the compiled ReportDocument, ReportSpec, and ReportFill flow.",
    runtimeConfig: {
        reportFill: {
            datasets: [
                {
                    id: "primary",
                    rows: [],
                },
            ],
        },
    },
    hasRuntimeRows: false,
    loadingState: null,
    blockedState: {
        title: "Blocked",
    },
    errorState: {
        tone: "error",
        icon: "warning-sign",
        eyebrow: "Runtime preview",
        title: "We couldn't compile these runtime results",
        description: "Runtime provider failed.",
    },
    canRenderRuntime: true,
});

assert.deepEqual(buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: {
        runtimeBlock: {
            dashboard: {
                reportRuntime: {
                    reportFill: {
                        datasets: [
                            {
                                id: "primary",
                                rows: [
                                    { value: 1 },
                                ],
                            },
                        ],
                    },
                },
            },
        },
    },
    runtimePreviewRowsSource: {
        loading: true,
        error: new Error("ignored when rows exist"),
    },
    canRunReport: false,
    readinessReason: "scope",
    runtimePreviewArtifactDiagnostics: [],
    runtimePreviewBlockedState: {
        title: "Blocked",
    },
    runtimePreviewErrorDescription: "Ignored.",
}), {
    eyebrow: "Authored Runtime",
    title: "Compiled Runtime Preview",
    subtitle: "",
    description: "Refine the current builder result through the compiled ReportDocument, ReportSpec, and ReportFill flow.",
    runtimeConfig: {
        reportFill: {
            datasets: [
                {
                    id: "primary",
                    rows: [
                        { value: 1 },
                    ],
                },
            ],
        },
    },
    hasRuntimeRows: true,
    loadingState: null,
    blockedState: null,
    errorState: null,
    canRenderRuntime: false,
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

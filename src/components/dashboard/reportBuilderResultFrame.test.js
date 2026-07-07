import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    buildReportBuilderAuthoredRuntimePreviewState,
    buildReportBuilderActiveResultErrorDiagnosticsState,
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

function pickAuthoredRuntimeSemanticSurface(state = {}) {
    return {
        semanticBindingTitle: state?.semanticBindingTitle || "",
        semanticBindingChips: Array.isArray(state?.semanticBindingChips) ? state.semanticBindingChips : [],
        semanticBindingFieldGroups: Array.isArray(state?.semanticBindingFieldGroups) ? state.semanticBindingFieldGroups : [],
        scopeSummaryTitle: state?.scopeSummaryTitle || "",
        scopeSummaryText: state?.scopeSummaryText || "",
        scopeSummaryItems: Array.isArray(state?.scopeSummaryItems) ? state.scopeSummaryItems : [],
    };
}

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

const semanticResultError = new Error("Semantic model metadata failed. Retry loading the semantic model or choose a different semantic binding.");
semanticResultError.diagnostics = [
    {
        code: "semanticModelError",
        severity: "error",
        path: "selection.modelRef",
        message: "Semantic model metadata failed.",
        suggestedFix: "Retry loading the semantic model or choose a different semantic binding.",
    },
];
assert.deepEqual(buildReportBuilderActiveResultErrorDiagnosticsState(semanticResultError), {
    diagnosticsTitle: "Semantic model diagnostics",
    diagnosticsDescription: "The semantic model could not be resolved for the current result.",
    diagnostics: [
        {
            id: "semanticModelError_1",
            severity: "error",
            code: "semanticModelError",
            path: "selection.modelRef",
            message: "Semantic model metadata failed.",
            suggestedFix: "Retry loading the semantic model or choose a different semantic binding.",
        },
    ],
});

const genericResultError = new Error("Runtime preview fetch failed.");
genericResultError.diagnostics = [
    {
        code: "runtimePreviewError",
        severity: "error",
        path: "",
        message: "Runtime preview fetch failed.",
    },
];
assert.deepEqual(buildReportBuilderActiveResultErrorDiagnosticsState(genericResultError), {
    diagnosticsTitle: "Result diagnostics",
    diagnosticsDescription: "This result returned 1 diagnostic.",
    diagnostics: [
        {
            id: "runtimePreviewError_1",
            severity: "error",
            code: "runtimePreviewError",
            path: "",
            message: "Runtime preview fetch failed.",
            suggestedFix: "",
        },
    ],
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
    readinessMessage: "Semantic model metadata failed. Retry loading the semantic model or choose a different semantic binding.",
    readinessAction: "retrySemanticValidation",
    readinessIssueKind: "semanticModelResolution",
}), {
    icon: "database",
    eyebrow: "Semantic model",
    title: "Retry semantic validation",
    description: "Semantic model metadata failed. Retry loading the semantic model or choose a different semantic binding.",
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
    readinessReason: "semantic",
    readinessMessage: "Semantic model metadata failed. Retry loading the semantic model or choose a different semantic binding.",
    readinessAction: "retrySemanticValidation",
    readinessIssueKind: "semanticModelResolution",
    semanticDiagnosticsNotice: {
        level: "danger",
        title: "Semantic validation error",
        description: "The semantic provider returned a model resolution diagnostic.",
        diagnostics: [
            {
                code: "semanticModelError",
                severity: "error",
                path: "selection.modelRef",
                message: "Semantic model metadata failed.",
                suggestedFix: "Retry loading the semantic model or choose a different semantic binding.",
            },
        ],
    },
}), {
    icon: "database",
    eyebrow: "Semantic model",
    title: "Retry semantic validation",
    description: "Semantic model metadata failed. Retry loading the semantic model or choose a different semantic binding.",
    actionLabel: "Retry validation",
    action: "retrySemanticValidation",
    tone: "error",
    diagnosticsTitle: "Semantic validation error",
    diagnosticsDescription: "The semantic provider returned a model resolution diagnostic.",
    diagnostics: [
        {
            id: "semanticModelError_1",
            severity: "error",
            code: "semanticModelError",
            path: "selection.modelRef",
            message: "Semantic model metadata failed.",
            suggestedFix: "Retry loading the semantic model or choose a different semantic binding.",
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
    eyebrow: "Preview",
    title: "Capacity Trend Q3",
    subtitle: "Preview subtitle",
    description: "Preview description",
    scopeSummaryTitle: "Filters",
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
        title: "Refreshing preview",
        description: "Running the current preview definition.",
        animated: true,
    },
    updatingNotice: null,
    blockedState: null,
    errorState: null,
    canRenderRuntime: false,
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

const runtimePreviewStateFromStaleCarriedSemanticBinding = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: {
        document: {
            title: "Canonical Semantic Runtime",
            semanticSummary: {
                kind: "semantic",
                modelRef: "model://example/performance/delivery@v1",
                modelLabel: "Canonical Ad Delivery",
                entity: "line_delivery",
                entityLabel: "Canonical Line Delivery",
                selectedDimensions: [
                    { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date", category: "Time" },
                ],
                selectedMeasures: [
                    { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions", format: "compactNumber" },
                ],
            },
            scope: {
                params: [
                    {
                        id: "dateRange",
                        label: "Canonical Reporting Window",
                    },
                ],
            },
        },
        runtimeBlock: {
            dashboard: {
                reportRuntime: {
                    semanticBindingViewState: {
                        title: "Semantic Binding",
                        chips: [
                            "Model model://example/performance/delivery@v1",
                            "Measures available_impressions",
                        ],
                        fieldGroups: [
                            {
                                id: "measures",
                                title: "Selected measures (1)",
                                fields: [
                                    { id: "available_impressions", rawId: "available_impressions", label: "available_impressions" },
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
                        semanticSummary: {
                            kind: "semantic",
                            modelRef: "model://example/performance/delivery@v1",
                            entity: "line_delivery",
                            selectedDimensions: ["event_date"],
                            selectedMeasures: ["available_impressions"],
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
assert.deepEqual(runtimePreviewStateFromStaleCarriedSemanticBinding.semanticBindingChips, [
    "Model Canonical Ad Delivery",
    "Entity Canonical Line Delivery",
    "Dimensions Canonical Delivery Date",
    "Measures Canonical Available Impressions",
    "Categories Time",
]);
assert.equal(runtimePreviewStateFromStaleCarriedSemanticBinding.scopeSummaryText, "Canonical Reporting Window");
assert.equal(runtimePreviewStateFromStaleCarriedSemanticBinding.semanticBindingFieldGroups[0].fields[0].label, "Canonical Delivery Date");

const carriedSemanticValidationRetryRecoveryArtifact = {
    document: {
        title: "Carried Semantic Runtime",
        subtitle: "Weekly Rollup",
        description: "Carried runtime semantic binding state.",
    },
    runtimeBlock: {
        dashboard: {
            reportRuntime: {
                semanticBindingViewState: {
                    title: "Semantic Binding",
                    chips: [
                        "Model Ad Delivery",
                        "Entity Line Delivery",
                        "Dimensions Delivery Date, Channel",
                        "Measures Available Impressions",
                    ],
                    fieldGroups: [
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
                },
                reportSpec: {
                    version: 1,
                    kind: "reportSpec",
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
};

const carriedSemanticValidationRetryErroredPreviewState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: carriedSemanticValidationRetryRecoveryArtifact,
    runtimePreviewRowsSource: {
        loading: false,
        error: new Error("Semantic provider unavailable."),
    },
    canRunReport: false,
    readinessReason: "semantic",
    readinessAction: "retrySemanticValidation",
    runtimePreviewArtifactDiagnostics: [
        {
            code: "semantic.providerUnavailable",
            severity: "error",
            path: "selection.dimensions",
            message: "Semantic provider unavailable.",
            suggestedFix: "Retry validation.",
        },
    ],
    runtimePreviewBlockedState: {
        title: "Blocked",
    },
    runtimePreviewErrorDescription: "Semantic provider unavailable.",
});

const carriedSemanticValidationRetryRecoveredPreviewState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: carriedSemanticValidationRetryRecoveryArtifact,
    runtimePreviewRowsSource: {
        loading: false,
    },
    canRunReport: true,
    readinessReason: "",
    readinessAction: "",
    runtimePreviewArtifactDiagnostics: [],
    runtimePreviewBlockedState: null,
    runtimePreviewErrorDescription: "",
});

assert.equal(carriedSemanticValidationRetryErroredPreviewState.semanticBindingTitle, "Semantic Binding");
assert.deepEqual(
    carriedSemanticValidationRetryErroredPreviewState.semanticBindingChips,
    carriedSemanticValidationRetryRecoveredPreviewState.semanticBindingChips,
);
assert.deepEqual(
    carriedSemanticValidationRetryErroredPreviewState.semanticBindingFieldGroups,
    carriedSemanticValidationRetryRecoveredPreviewState.semanticBindingFieldGroups,
);
assert.equal(carriedSemanticValidationRetryErroredPreviewState.scopeSummaryTitle, "Filters");
assert.equal(carriedSemanticValidationRetryErroredPreviewState.scopeSummaryText, "Reporting Window");
assert.deepEqual(
    carriedSemanticValidationRetryErroredPreviewState.scopeSummaryItems,
    carriedSemanticValidationRetryRecoveredPreviewState.scopeSummaryItems,
);
assert.equal(carriedSemanticValidationRetryErroredPreviewState.errorState?.action, "retrySemanticValidation");
assert.equal(carriedSemanticValidationRetryRecoveredPreviewState.errorState, null);
assert.equal(carriedSemanticValidationRetryErroredPreviewState.canRenderRuntime, true);
assert.equal(carriedSemanticValidationRetryRecoveredPreviewState.canRenderRuntime, true);

const carriedSemanticLocationRetryRecoveryArtifact = {
    document: {
        title: "Capacity Locations Top Markets Q3",
        subtitle: "Markets",
        description: "Carried runtime location semantic binding state.",
    },
    runtimeBlock: {
        dashboard: {
            reportRuntime: {
                semanticBindingViewState: {
                    title: "Semantic Binding",
                    chips: [
                        "Model Ad Delivery",
                        "Entity Line Delivery",
                        "Dimensions Market",
                        "Measures Available Impressions",
                    ],
                    fieldGroups: [
                        {
                            id: "dimensions",
                            title: "Selected dimensions (1)",
                            fields: [
                                { id: "country_code", rawId: "country", label: "Market" },
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
                },
                reportSpec: {
                    version: 1,
                    kind: "reportSpec",
                    scope: {
                        params: [
                            {
                                id: "dateRange",
                                label: "Date Range",
                                description: "Approved runtime location window.",
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
};

const carriedSemanticLocationRetryErroredPreviewState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: carriedSemanticLocationRetryRecoveryArtifact,
    runtimePreviewRowsSource: {
        loading: false,
        error: new Error("Semantic provider unavailable."),
    },
    canRunReport: false,
    readinessReason: "semantic",
    readinessAction: "retrySemanticValidation",
    runtimePreviewArtifactDiagnostics: [
        {
            code: "semantic.providerUnavailable",
            severity: "error",
            path: "selection.dimensions",
            message: "Semantic provider unavailable.",
            suggestedFix: "Retry validation.",
        },
    ],
    runtimePreviewBlockedState: {
        title: "Blocked",
    },
    runtimePreviewErrorDescription: "Semantic provider unavailable.",
});

const carriedSemanticLocationRetryRecoveredPreviewState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: carriedSemanticLocationRetryRecoveryArtifact,
    runtimePreviewRowsSource: {
        loading: false,
    },
    canRunReport: true,
    readinessReason: "",
    readinessAction: "",
    runtimePreviewArtifactDiagnostics: [],
    runtimePreviewBlockedState: null,
    runtimePreviewErrorDescription: "",
});

assert.equal(carriedSemanticLocationRetryErroredPreviewState.semanticBindingTitle, "Semantic Binding");
assert.equal(carriedSemanticLocationRetryErroredPreviewState.semanticBindingChips.includes("Dimensions Market"), true);
assert.deepEqual(
    carriedSemanticLocationRetryErroredPreviewState.semanticBindingChips,
    carriedSemanticLocationRetryRecoveredPreviewState.semanticBindingChips,
);
assert.deepEqual(
    carriedSemanticLocationRetryErroredPreviewState.semanticBindingFieldGroups,
    carriedSemanticLocationRetryRecoveredPreviewState.semanticBindingFieldGroups,
);
assert.equal(carriedSemanticLocationRetryErroredPreviewState.scopeSummaryTitle, "Filters");
assert.deepEqual(
    carriedSemanticLocationRetryErroredPreviewState.scopeSummaryItems,
    carriedSemanticLocationRetryRecoveredPreviewState.scopeSummaryItems,
);
assert.equal(carriedSemanticLocationRetryErroredPreviewState.errorState?.action, "retrySemanticValidation");
assert.equal(carriedSemanticLocationRetryRecoveredPreviewState.errorState, null);
assert.equal(carriedSemanticLocationRetryErroredPreviewState.canRenderRuntime, true);
assert.equal(carriedSemanticLocationRetryRecoveredPreviewState.canRenderRuntime, true);

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
    eyebrow: "Preview",
    title: "Semantic Capacity Trend Q3",
    subtitle: "",
    description: "Review the live preview built from the current report definition.",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
    ],
    scopeSummaryTitle: "Filters",
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
    updatingNotice: null,
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
    readinessAction: "retrySemanticValidation",
    runtimePreviewArtifactDiagnostics: [{
        code: "semantic.providerUnavailable",
        severity: "error",
        message: "Semantic provider unavailable for the runtime preview.",
    }],
    runtimePreviewBlockedState: {
        title: "Blocked",
    },
    runtimePreviewErrorDescription: "Runtime provider failed.",
}), {
    eyebrow: "Preview",
    title: "Preview",
    subtitle: "",
    description: "Review the live preview built from the current report definition.",
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
    updatingNotice: null,
    blockedState: {
        title: "Blocked",
    },
    errorState: {
        tone: "error",
        icon: "warning-sign",
        eyebrow: "Runtime preview",
        title: "We couldn't compile these runtime results",
        description: "Runtime provider failed.",
        actionLabel: "Retry validation",
        action: "retrySemanticValidation",
        diagnosticsTitle: "Semantic model diagnostics",
        diagnosticsDescription: "The semantic model could not be resolved for this runtime preview.",
        diagnostics: [
            {
                id: "semantic.providerUnavailable_1",
                severity: "error",
                code: "semantic.providerUnavailable",
                path: "",
                message: "Semantic provider unavailable for the runtime preview.",
                suggestedFix: "",
            },
        ],
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
        error: new Error("Semantic model metadata failed. Retry loading the semantic model or choose a different semantic binding."),
    },
    canRunReport: false,
    readinessReason: "semantic",
    readinessAction: "retrySemanticValidation",
    readinessIssueKind: "semanticModelResolution",
    runtimePreviewArtifactDiagnostics: [
        {
            code: "semanticModelError",
            severity: "error",
            path: "selection.modelRef",
            message: "Semantic model metadata failed.",
            suggestedFix: "Retry loading the semantic model or choose a different semantic binding.",
        },
    ],
    runtimePreviewBlockedState: {
        title: "Blocked",
    },
    runtimePreviewErrorDescription: "Semantic model metadata failed. Retry loading the semantic model or choose a different semantic binding.",
}), {
    eyebrow: "Preview",
    title: "Preview",
    subtitle: "",
    description: "Review the live preview built from the current report definition.",
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
    updatingNotice: null,
    blockedState: {
        title: "Blocked",
    },
    errorState: {
        tone: "error",
        icon: "warning-sign",
        eyebrow: "Runtime preview",
        title: "We couldn't compile these runtime results",
        description: "Semantic model metadata failed. Retry loading the semantic model or choose a different semantic binding.",
        actionLabel: "Retry validation",
        action: "retrySemanticValidation",
        diagnosticsTitle: "Semantic model diagnostics",
        diagnosticsDescription: "The semantic model could not be resolved for this runtime preview.",
        diagnostics: [
            {
                id: "semanticModelError_1",
                severity: "error",
                code: "semanticModelError",
                path: "selection.modelRef",
                message: "Semantic model metadata failed.",
                suggestedFix: "Retry loading the semantic model or choose a different semantic binding.",
            },
        ],
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
        error: new Error("Semantic model provider unavailable."),
    },
    canRunReport: false,
    readinessReason: "semantic",
    readinessAction: "retrySemanticModelLoad",
    runtimePreviewArtifactDiagnostics: [],
    runtimePreviewBlockedState: {
        title: "Blocked",
    },
    runtimePreviewErrorDescription: "Semantic model provider unavailable.",
}), {
    eyebrow: "Preview",
    title: "Preview",
    subtitle: "",
    description: "Review the live preview built from the current report definition.",
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
    updatingNotice: null,
    blockedState: {
        title: "Blocked",
    },
    errorState: {
        tone: "error",
        icon: "warning-sign",
        eyebrow: "Runtime preview",
        title: "We couldn't compile these runtime results",
        description: "Semantic model provider unavailable.",
        actionLabel: "Retry model load",
        action: "retrySemanticModelLoad",
    },
    canRenderRuntime: false,
});

const semanticValidationRetryRecoveryArtifact = {
    document: {
        title: "Capacity Trend Q3",
        subtitle: "Weekly Rollup",
        description: "Provider-backed chart runtime.",
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
};

const semanticValidationRetryErroredPreviewState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: semanticValidationRetryRecoveryArtifact,
    runtimePreviewRowsSource: {
        loading: false,
        error: new Error("Semantic provider unavailable."),
    },
    canRunReport: false,
    readinessReason: "semantic",
    readinessAction: "retrySemanticValidation",
    runtimePreviewArtifactDiagnostics: [
        {
            code: "semantic.providerUnavailable",
            severity: "error",
            path: "selection.dimensions",
            message: "Semantic provider unavailable.",
            suggestedFix: "Retry validation.",
        },
    ],
    runtimePreviewBlockedState: {
        title: "Blocked",
    },
    runtimePreviewErrorDescription: "Semantic provider unavailable.",
});

const semanticValidationRetryRecoveredPreviewState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: semanticValidationRetryRecoveryArtifact,
    runtimePreviewRowsSource: {
        loading: false,
    },
    canRunReport: true,
    readinessReason: "",
    readinessAction: "",
    runtimePreviewArtifactDiagnostics: [],
    runtimePreviewBlockedState: null,
    runtimePreviewErrorDescription: "",
});

assert.equal(semanticValidationRetryErroredPreviewState.semanticBindingTitle, "Semantic Binding");
assert.deepEqual(
    semanticValidationRetryErroredPreviewState.semanticBindingChips,
    semanticValidationRetryRecoveredPreviewState.semanticBindingChips,
);
assert.deepEqual(
    semanticValidationRetryErroredPreviewState.semanticBindingFieldGroups,
    semanticValidationRetryRecoveredPreviewState.semanticBindingFieldGroups,
);
assert.equal(semanticValidationRetryErroredPreviewState.scopeSummaryTitle, "Filters");
assert.equal(semanticValidationRetryErroredPreviewState.scopeSummaryText, "Reporting Window");
assert.deepEqual(
    semanticValidationRetryErroredPreviewState.scopeSummaryItems,
    semanticValidationRetryRecoveredPreviewState.scopeSummaryItems,
);
assert.equal(semanticValidationRetryErroredPreviewState.errorState?.action, "retrySemanticValidation");
assert.equal(semanticValidationRetryRecoveredPreviewState.errorState, null);
assert.equal(semanticValidationRetryErroredPreviewState.canRenderRuntime, true);
assert.equal(semanticValidationRetryRecoveredPreviewState.canRenderRuntime, true);

const semanticLocationRetryRecoveryArtifact = {
    document: {
        title: "Capacity Locations Top Markets Q3",
        subtitle: "Markets",
        description: "Provider-backed location chart runtime.",
    },
    runtimeBlock: {
        dashboard: {
            reportRuntime: {
                reportSpec: {
                    scope: {
                        params: [
                            {
                                id: "dateRange",
                                label: "Date Range",
                                description: "Approved runtime location window.",
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
                            { id: "country_code", rawId: "country", label: "Market" },
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
};

const semanticLocationRetryErroredPreviewState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: semanticLocationRetryRecoveryArtifact,
    runtimePreviewRowsSource: {
        loading: false,
        error: new Error("Semantic provider unavailable."),
    },
    canRunReport: false,
    readinessReason: "semantic",
    readinessAction: "retrySemanticValidation",
    runtimePreviewArtifactDiagnostics: [
        {
            code: "semantic.providerUnavailable",
            severity: "error",
            path: "selection.dimensions",
            message: "Semantic provider unavailable.",
            suggestedFix: "Retry validation.",
        },
    ],
    runtimePreviewBlockedState: {
        title: "Blocked",
    },
    runtimePreviewErrorDescription: "Semantic provider unavailable.",
});

const semanticLocationRetryRecoveredPreviewState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: semanticLocationRetryRecoveryArtifact,
    runtimePreviewRowsSource: {
        loading: false,
    },
    canRunReport: true,
    readinessReason: "",
    readinessAction: "",
    runtimePreviewArtifactDiagnostics: [],
    runtimePreviewBlockedState: null,
    runtimePreviewErrorDescription: "",
});

assert.equal(semanticLocationRetryErroredPreviewState.semanticBindingTitle, "Semantic Binding");
assert.equal(semanticLocationRetryErroredPreviewState.semanticBindingChips.includes("Dimensions Market"), true);
assert.deepEqual(
    semanticLocationRetryErroredPreviewState.semanticBindingChips,
    semanticLocationRetryRecoveredPreviewState.semanticBindingChips,
);
assert.deepEqual(
    semanticLocationRetryErroredPreviewState.semanticBindingFieldGroups,
    semanticLocationRetryRecoveredPreviewState.semanticBindingFieldGroups,
);
assert.equal(semanticLocationRetryErroredPreviewState.scopeSummaryTitle, "Filters");
assert.deepEqual(
    semanticLocationRetryErroredPreviewState.scopeSummaryItems,
    semanticLocationRetryRecoveredPreviewState.scopeSummaryItems,
);
assert.equal(semanticLocationRetryErroredPreviewState.errorState?.action, "retrySemanticValidation");
assert.equal(semanticLocationRetryRecoveredPreviewState.errorState, null);

const semanticFetchTransitionLoadingPreviewState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: semanticValidationRetryRecoveryArtifact,
    runtimePreviewRowsSource: {
        loading: true,
        error: new Error("Ignored while refresh is in flight."),
    },
    canRunReport: true,
    runtimePreviewArtifactDiagnostics: [],
    runtimePreviewBlockedState: null,
    runtimePreviewErrorDescription: "",
});

const semanticFetchTransitionErroredPreviewState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: semanticValidationRetryRecoveryArtifact,
    runtimePreviewRowsSource: {
        loading: false,
        error: new Error("Semantic runtime preview fetch failed."),
    },
    canRunReport: false,
    readinessReason: "semantic",
    readinessAction: "retrySemanticValidation",
    runtimePreviewArtifactDiagnostics: [
        {
            code: "semantic.providerUnavailable",
            severity: "error",
            path: "selection.dimensions",
            message: "Semantic provider unavailable.",
            suggestedFix: "Retry validation.",
        },
    ],
    runtimePreviewBlockedState: {
        title: "Blocked",
    },
    runtimePreviewErrorDescription: "Semantic runtime preview fetch failed.",
});

const semanticFetchTransitionRecoveredPreviewState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: semanticValidationRetryRecoveryArtifact,
    runtimePreviewRowsSource: {
        loading: false,
        error: null,
    },
    canRunReport: true,
    runtimePreviewArtifactDiagnostics: [],
    runtimePreviewBlockedState: null,
    runtimePreviewErrorDescription: "",
});

assert.deepEqual(
    pickAuthoredRuntimeSemanticSurface(semanticFetchTransitionLoadingPreviewState),
    pickAuthoredRuntimeSemanticSurface(semanticFetchTransitionErroredPreviewState),
);
assert.deepEqual(
    pickAuthoredRuntimeSemanticSurface(semanticFetchTransitionErroredPreviewState),
    pickAuthoredRuntimeSemanticSurface(semanticFetchTransitionRecoveredPreviewState),
);
assert.notEqual(semanticFetchTransitionLoadingPreviewState.loadingState, null);
assert.equal(semanticFetchTransitionLoadingPreviewState.errorState, null);
assert.equal(semanticFetchTransitionErroredPreviewState.loadingState, null);
assert.equal(semanticFetchTransitionErroredPreviewState.errorState?.action, "retrySemanticValidation");
assert.equal(semanticFetchTransitionRecoveredPreviewState.loadingState, null);
assert.equal(semanticFetchTransitionRecoveredPreviewState.errorState, null);

const carriedSemanticFetchTransitionLoadingPreviewState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: carriedSemanticValidationRetryRecoveryArtifact,
    runtimePreviewRowsSource: {
        loading: true,
        error: new Error("Ignored while refresh is in flight."),
    },
    canRunReport: true,
    runtimePreviewArtifactDiagnostics: [],
    runtimePreviewBlockedState: null,
    runtimePreviewErrorDescription: "",
});

const carriedSemanticFetchTransitionErroredPreviewState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: carriedSemanticValidationRetryRecoveryArtifact,
    runtimePreviewRowsSource: {
        loading: false,
        error: new Error("Semantic runtime preview fetch failed."),
    },
    canRunReport: false,
    readinessReason: "semantic",
    readinessAction: "retrySemanticValidation",
    runtimePreviewArtifactDiagnostics: [
        {
            code: "semantic.providerUnavailable",
            severity: "error",
            path: "selection.dimensions",
            message: "Semantic provider unavailable.",
            suggestedFix: "Retry validation.",
        },
    ],
    runtimePreviewBlockedState: {
        title: "Blocked",
    },
    runtimePreviewErrorDescription: "Semantic runtime preview fetch failed.",
});

const carriedSemanticFetchTransitionRecoveredPreviewState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: carriedSemanticValidationRetryRecoveryArtifact,
    runtimePreviewRowsSource: {
        loading: false,
        error: null,
    },
    canRunReport: true,
    runtimePreviewArtifactDiagnostics: [],
    runtimePreviewBlockedState: null,
    runtimePreviewErrorDescription: "",
});

assert.deepEqual(
    pickAuthoredRuntimeSemanticSurface(carriedSemanticFetchTransitionLoadingPreviewState),
    pickAuthoredRuntimeSemanticSurface(carriedSemanticFetchTransitionErroredPreviewState),
);
assert.deepEqual(
    pickAuthoredRuntimeSemanticSurface(carriedSemanticFetchTransitionErroredPreviewState),
    pickAuthoredRuntimeSemanticSurface(carriedSemanticFetchTransitionRecoveredPreviewState),
);
assert.notEqual(carriedSemanticFetchTransitionLoadingPreviewState.loadingState, null);
assert.equal(carriedSemanticFetchTransitionLoadingPreviewState.errorState, null);
assert.equal(carriedSemanticFetchTransitionErroredPreviewState.loadingState, null);
assert.equal(carriedSemanticFetchTransitionErroredPreviewState.errorState?.action, "retrySemanticValidation");
assert.equal(carriedSemanticFetchTransitionRecoveredPreviewState.loadingState, null);
assert.equal(carriedSemanticFetchTransitionRecoveredPreviewState.errorState, null);

const semanticDiagnosticsVariantNoDiagnosticsState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: semanticValidationRetryRecoveryArtifact,
    runtimePreviewRowsSource: {
        loading: false,
        error: new Error("Semantic runtime preview fetch failed."),
    },
    canRunReport: false,
    readinessReason: "semantic",
    readinessAction: "retrySemanticValidation",
    runtimePreviewArtifactDiagnostics: [],
    runtimePreviewBlockedState: {
        title: "Blocked",
    },
    runtimePreviewErrorDescription: "Semantic runtime preview fetch failed.",
});

const semanticDiagnosticsVariantProviderState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: semanticValidationRetryRecoveryArtifact,
    runtimePreviewRowsSource: {
        loading: false,
        error: new Error("Semantic runtime preview fetch failed."),
    },
    canRunReport: false,
    readinessReason: "semantic",
    readinessAction: "retrySemanticValidation",
    runtimePreviewArtifactDiagnostics: [
        {
            code: "semantic.providerUnavailable",
            severity: "error",
            path: "selection.dimensions",
            message: "Semantic provider unavailable.",
            suggestedFix: "Retry validation.",
        },
    ],
    runtimePreviewBlockedState: {
        title: "Blocked",
    },
    runtimePreviewErrorDescription: "Semantic runtime preview fetch failed.",
});

const semanticDiagnosticsVariantWarningState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: semanticValidationRetryRecoveryArtifact,
    runtimePreviewRowsSource: {
        loading: false,
        error: new Error("Semantic runtime preview fetch failed."),
    },
    canRunReport: false,
    readinessReason: "semantic",
    readinessAction: "retrySemanticValidation",
    runtimePreviewArtifactDiagnostics: [
        {
            code: "unsupportedDetailTarget",
            severity: "warning",
            path: "reportDocument.blocks.primaryChart.targetRef",
            message: "The current detail target is unavailable for this runtime preview.",
            suggestedFix: "Update the detail target mapping.",
        },
    ],
    runtimePreviewBlockedState: {
        title: "Blocked",
    },
    runtimePreviewErrorDescription: "Semantic runtime preview fetch failed.",
});

assert.deepEqual(
    pickAuthoredRuntimeSemanticSurface(semanticDiagnosticsVariantNoDiagnosticsState),
    pickAuthoredRuntimeSemanticSurface(semanticDiagnosticsVariantProviderState),
);
assert.deepEqual(
    pickAuthoredRuntimeSemanticSurface(semanticDiagnosticsVariantProviderState),
    pickAuthoredRuntimeSemanticSurface(semanticDiagnosticsVariantWarningState),
);
assert.equal(semanticDiagnosticsVariantNoDiagnosticsState.errorState?.action, undefined);
assert.equal(semanticDiagnosticsVariantNoDiagnosticsState.errorState?.diagnosticsTitle, undefined);
assert.equal(semanticDiagnosticsVariantProviderState.errorState?.action, "retrySemanticValidation");
assert.equal(semanticDiagnosticsVariantProviderState.errorState?.diagnosticsTitle, "Semantic model diagnostics");
assert.equal(semanticDiagnosticsVariantWarningState.errorState?.action, undefined);
assert.equal(semanticDiagnosticsVariantWarningState.errorState?.diagnosticsTitle, "Runtime preview diagnostics");

const carriedSemanticDiagnosticsVariantNoDiagnosticsState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: carriedSemanticValidationRetryRecoveryArtifact,
    runtimePreviewRowsSource: {
        loading: false,
        error: new Error("Semantic runtime preview fetch failed."),
    },
    canRunReport: false,
    readinessReason: "semantic",
    readinessAction: "retrySemanticValidation",
    runtimePreviewArtifactDiagnostics: [],
    runtimePreviewBlockedState: {
        title: "Blocked",
    },
    runtimePreviewErrorDescription: "Semantic runtime preview fetch failed.",
});

const carriedSemanticDiagnosticsVariantProviderState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: carriedSemanticValidationRetryRecoveryArtifact,
    runtimePreviewRowsSource: {
        loading: false,
        error: new Error("Semantic runtime preview fetch failed."),
    },
    canRunReport: false,
    readinessReason: "semantic",
    readinessAction: "retrySemanticValidation",
    runtimePreviewArtifactDiagnostics: [
        {
            code: "semantic.providerUnavailable",
            severity: "error",
            path: "selection.dimensions",
            message: "Semantic provider unavailable.",
            suggestedFix: "Retry validation.",
        },
    ],
    runtimePreviewBlockedState: {
        title: "Blocked",
    },
    runtimePreviewErrorDescription: "Semantic runtime preview fetch failed.",
});

const carriedSemanticDiagnosticsVariantWarningState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: carriedSemanticValidationRetryRecoveryArtifact,
    runtimePreviewRowsSource: {
        loading: false,
        error: new Error("Semantic runtime preview fetch failed."),
    },
    canRunReport: false,
    readinessReason: "semantic",
    readinessAction: "retrySemanticValidation",
    runtimePreviewArtifactDiagnostics: [
        {
            code: "unsupportedDetailTarget",
            severity: "warning",
            path: "reportDocument.blocks.primaryChart.targetRef",
            message: "The current detail target is unavailable for this runtime preview.",
            suggestedFix: "Update the detail target mapping.",
        },
    ],
    runtimePreviewBlockedState: {
        title: "Blocked",
    },
    runtimePreviewErrorDescription: "Semantic runtime preview fetch failed.",
});

assert.deepEqual(
    pickAuthoredRuntimeSemanticSurface(carriedSemanticDiagnosticsVariantNoDiagnosticsState),
    pickAuthoredRuntimeSemanticSurface(carriedSemanticDiagnosticsVariantProviderState),
);
assert.deepEqual(
    pickAuthoredRuntimeSemanticSurface(carriedSemanticDiagnosticsVariantProviderState),
    pickAuthoredRuntimeSemanticSurface(carriedSemanticDiagnosticsVariantWarningState),
);
assert.equal(carriedSemanticDiagnosticsVariantNoDiagnosticsState.errorState?.action, undefined);
assert.equal(carriedSemanticDiagnosticsVariantNoDiagnosticsState.errorState?.diagnosticsTitle, undefined);
assert.equal(carriedSemanticDiagnosticsVariantProviderState.errorState?.action, "retrySemanticValidation");
assert.equal(carriedSemanticDiagnosticsVariantProviderState.errorState?.diagnosticsTitle, "Semantic model diagnostics");
assert.equal(carriedSemanticDiagnosticsVariantWarningState.errorState?.action, undefined);
assert.equal(carriedSemanticDiagnosticsVariantWarningState.errorState?.diagnosticsTitle, "Runtime preview diagnostics");

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
    eyebrow: "Preview",
    title: "Preview",
    subtitle: "",
    description: "Review the live preview built from the current report definition.",
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
    updatingNotice: {
        level: "info",
        message: "Updating results\u2026",
    },
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
                            {
                                id: "regional_mix_csv",
                                rows: [
                                    { region: "North", revenue: 1200 },
                                ],
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
    canRunReport: false,
    readinessReason: "scope",
    runtimePreviewArtifactDiagnostics: [],
    runtimePreviewBlockedState: {
        title: "Blocked",
    },
    runtimePreviewErrorDescription: "Ignored.",
}), {
    eyebrow: "Preview",
    title: "Preview",
    subtitle: "",
    description: "Review the live preview built from the current report definition.",
    runtimeConfig: {
        reportFill: {
            datasets: [
                {
                    id: "primary",
                    rows: [],
                },
                {
                    id: "regional_mix_csv",
                    rows: [
                        { region: "North", revenue: 1200 },
                    ],
                },
            ],
        },
    },
    hasRuntimeRows: true,
    loadingState: null,
    updatingNotice: null,
    blockedState: null,
    errorState: null,
    canRenderRuntime: true,
});

const drillRefreshLoadingWithoutRowsPreviewState = buildReportBuilderAuthoredRuntimePreviewState({
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
        loading: true,
    },
    canRunReport: true,
});
assert.notEqual(drillRefreshLoadingWithoutRowsPreviewState.loadingState, null);
assert.equal(drillRefreshLoadingWithoutRowsPreviewState.canRenderRuntime, false);
assert.equal(drillRefreshLoadingWithoutRowsPreviewState.updatingNotice, null);

const drillRefreshRetainedRowsDatasets = {
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
};

const drillRefreshLoadingWithRetainedRowsPreviewState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: drillRefreshRetainedRowsDatasets,
    runtimePreviewRowsSource: {
        loading: true,
    },
    canRunReport: true,
});
assert.equal(drillRefreshLoadingWithRetainedRowsPreviewState.loadingState, null);
assert.equal(drillRefreshLoadingWithRetainedRowsPreviewState.canRenderRuntime, true);
assert.deepEqual(drillRefreshLoadingWithRetainedRowsPreviewState.updatingNotice, {
    level: "info",
    message: "Updating results…",
});

const drillRefreshLoadingWithRetainedRowsReportPreviewState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: drillRefreshRetainedRowsDatasets,
    runtimePreviewRowsSource: {
        loading: true,
    },
    canRunReport: true,
    presentationMode: "report",
});
assert.equal(drillRefreshLoadingWithRetainedRowsReportPreviewState.loadingState, null);
assert.equal(drillRefreshLoadingWithRetainedRowsReportPreviewState.canRenderRuntime, true);
assert.deepEqual(drillRefreshLoadingWithRetainedRowsReportPreviewState.updatingNotice, {
    level: "info",
    message: "Updating this report with the latest results…",
});

const drillRefreshSettledWithRetainedRowsPreviewState = buildReportBuilderAuthoredRuntimePreviewState({
    runtimePreviewEnabled: true,
    runtimePreviewArtifact: drillRefreshRetainedRowsDatasets,
    runtimePreviewRowsSource: {
        loading: false,
    },
    canRunReport: true,
});
assert.equal(drillRefreshSettledWithRetainedRowsPreviewState.loadingState, null);
assert.equal(drillRefreshSettledWithRetainedRowsPreviewState.canRenderRuntime, true);
assert.equal(drillRefreshSettledWithRetainedRowsPreviewState.updatingNotice, null);

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

assert.equal(reportBuilderSource.includes("buildReportBuilderActiveResultErrorDiagnosticsState("), true);
assert.equal(reportBuilderSource.includes("activeResultErrorDiagnostics?.diagnostics"), true);

console.log("reportBuilderResultFrame ✓ active result and empty-state helpers");

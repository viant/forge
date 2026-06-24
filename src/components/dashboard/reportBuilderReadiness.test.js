import assert from "node:assert/strict";

import { resolveReportBuilderStateReadiness } from "./reportBuilderReadiness.js";

const semanticConfig = {
    measures: [
        { id: "totalSpend", paramPath: "measures.totalSpend", default: true, semanticRef: "spend" },
        { id: "hhUniqs", paramPath: "measures.hhUniqs", default: true, semanticRef: "household_uniques" },
    ],
    dimensions: [
        { id: "eventDate", paramPath: "dimensions.eventDate", default: true, chartAxis: true, semanticRef: "event_date" },
        { id: "channelId", paramPath: "dimensions.channelId", default: true, semanticRef: "channel" },
        { id: "agegroupId", paramPath: "dimensions.agegroupId", semanticRef: "age_group" },
    ],
    groupBy: {
        options: [
            { value: "channelId", label: "Channel", dimensionId: "channelId" },
            { value: "agegroupId", label: "Audience Age Group", dimensionId: "agegroupId" },
        ],
    },
    staticFilters: [
        {
            id: "dateRange",
            type: "dateRange",
            required: true,
            startParamPath: "filters.from",
            endParamPath: "filters.to",
            default: { start: "2026-05-01", end: "2026-05-04" },
        },
    ],
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        selectedDimensions: ["event_date", "channel"],
        selectedMeasures: ["spend", "household_uniques"],
    },
};

const semanticModel = {
    modelRef: "model://example/performance/delivery@v1",
    version: 1,
    label: "Ad Delivery",
    entities: [
        {
            id: "line_delivery",
            label: "Line Delivery",
            dimensions: [
                { id: "event_date", label: "Delivery Date", dataType: "date" },
                { id: "channel", label: "Channel", dataType: "string" },
                { id: "age_group", label: "Audience Age Group", dataType: "string" },
            ],
            measures: [
                { id: "spend", label: "Spend", dataType: "number", aggregation: "sum" },
                { id: "household_uniques", label: "Household Uniques", dataType: "number", aggregation: "sum" },
            ],
        },
    ],
};

const semanticState = {
    selectedMeasures: ["totalSpend", "hhUniqs"],
    selectedDimensions: ["eventDate", "channelId"],
    groupBy: "agegroupId",
    staticFilters: {
        dateRange: {
            start: "2026-05-01",
            end: "2026-05-04",
        },
    },
    binding: semanticConfig.binding,
};

const semanticValidationFingerprint = JSON.stringify({
    modelRef: "model://example/performance/delivery@v1",
    selection: {
        entity: "line_delivery",
        dimensions: ["event_date", "channel", "age_group"],
        measures: ["spend", "household_uniques"],
        parameters: {},
    },
});

assert.deepEqual(resolveReportBuilderStateReadiness({
    config: semanticConfig,
    state: {
        ...semanticState,
        staticFilters: {
            dateRange: {
                start: "",
                end: "",
            },
        },
    },
    semanticModelProvider: { validateSelection() {} },
    semanticModelState: {
        loading: false,
        error: "",
        model: semanticModel,
    },
    semanticSelectionValidationState: {
        fingerprint: semanticValidationFingerprint,
        requestKey: `${semanticValidationFingerprint}::0`,
        loading: false,
        error: "",
        valid: true,
        diagnostics: [],
    },
    semanticRetryAvailable: false,
}), {
    canRun: false,
    reason: "requiredFilter",
    message: "",
});

assert.deepEqual(resolveReportBuilderStateReadiness({
    config: semanticConfig,
    state: semanticState,
    semanticModelProvider: { validateSelection() {} },
    semanticModelState: {
        loading: true,
        error: "",
        model: semanticModel,
    },
    semanticSelectionValidationState: {},
    semanticRetryAvailable: false,
}), {
    canRun: false,
    reason: "semantic",
    message: "Loading semantic model metadata…",
});

assert.deepEqual(resolveReportBuilderStateReadiness({
    config: semanticConfig,
    state: semanticState,
    semanticModelProvider: { validateSelection() {}, getModel() {} },
    semanticModelState: {
        loading: false,
        error: "Semantic model provider unavailable.",
        model: null,
    },
    semanticSelectionValidationState: {},
    semanticModelRetryAvailable: true,
    semanticRetryAvailable: false,
}), {
    canRun: false,
    reason: "semantic",
    message: "Semantic model provider unavailable.",
    action: "retrySemanticModelLoad",
});

assert.deepEqual(resolveReportBuilderStateReadiness({
    config: semanticConfig,
    state: semanticState,
    semanticModelProvider: { validateSelection() {} },
    semanticModelState: {
        loading: false,
        error: "",
        model: semanticModel,
    },
    semanticSelectionValidationState: {
        fingerprint: "",
        requestKey: "",
        loading: false,
        error: "",
        valid: null,
        diagnostics: [],
    },
    semanticRetryAvailable: false,
}), {
    canRun: false,
    reason: "semantic",
    message: "Validating the semantic selection against the provider.",
});

assert.deepEqual(resolveReportBuilderStateReadiness({
    config: semanticConfig,
    state: semanticState,
    semanticModelProvider: { validateSelection() {} },
    semanticModelState: {
        loading: false,
        error: "",
        model: semanticModel,
    },
    semanticSelectionValidationState: {
        fingerprint: semanticValidationFingerprint,
        requestKey: `${semanticValidationFingerprint}::0`,
        loading: false,
        error: "Semantic provider unavailable.",
        valid: null,
        diagnostics: [],
    },
    semanticRetryAvailable: true,
}), {
    canRun: false,
    reason: "semantic",
    message: "Semantic provider unavailable.",
    action: "retrySemanticValidation",
});

assert.deepEqual(resolveReportBuilderStateReadiness({
    config: semanticConfig,
    state: semanticState,
    semanticModelProvider: { validateSelection() {} },
    semanticModelState: {
        loading: false,
        error: "",
        model: semanticModel,
    },
    semanticSelectionValidationState: {
        fingerprint: semanticValidationFingerprint,
        requestKey: `${semanticValidationFingerprint}::0`,
        loading: false,
        error: "",
        valid: false,
        diagnostics: [
            {
                code: "unsupportedBreakdown",
                severity: "error",
                path: "selection.dimensions[2]",
                message: "Audience Age Group is not supported for this semantic selection in the demo provider.",
                suggestedFix: "Remove Audience Age Group or choose a different breakdown to continue.",
            },
            {
                code: "unsupportedMeasure",
                severity: "error",
                path: "selection.measures[1]",
                message: "Household Uniques cannot be combined with Audience Age Group in this demo semantic provider.",
                suggestedFix: "Remove Household Uniques or switch to Spend to continue.",
            },
        ],
    },
    semanticRetryAvailable: false,
}), {
    canRun: false,
    reason: "semantic",
    message: "Audience Age Group is not supported for this semantic selection in the demo provider. Remove Audience Age Group or choose a different breakdown to continue.",
});

assert.deepEqual(resolveReportBuilderStateReadiness({
    config: semanticConfig,
    state: semanticState,
    semanticModelProvider: { validateSelection() {} },
    semanticModelState: {
        loading: false,
        error: "",
        model: semanticModel,
    },
    semanticSelectionValidationState: {
        fingerprint: semanticValidationFingerprint,
        requestKey: `${semanticValidationFingerprint}::0`,
        loading: false,
        error: "",
        valid: true,
        diagnostics: [],
    },
    semanticRetryAvailable: false,
}), {
    canRun: true,
    reason: "",
    message: "",
});

const semanticParameterConfig = {
    ...semanticConfig,
    staticFilters: [
        {
            ...semanticConfig.staticFilters[0],
            semanticRef: "reporting_window",
            label: "Date Range",
        },
    ],
};

const semanticParameterModel = {
    ...semanticModel,
    entities: [
        {
            ...semanticModel.entities[0],
            parameters: [
                { id: "reporting_window", label: "Date Range", dataType: "date" },
            ],
        },
    ],
};

const semanticParameterState = {
    ...semanticState,
    binding: semanticParameterConfig.binding,
};

const semanticParameterValidationFingerprint = JSON.stringify({
    modelRef: "model://example/performance/delivery@v1",
    selection: {
        entity: "line_delivery",
        dimensions: ["event_date", "channel", "age_group"],
        measures: ["spend", "household_uniques"],
        parameters: {
            reporting_window: {
                start: "2026-05-01",
                end: "2026-05-04",
            },
        },
    },
});

assert.deepEqual(resolveReportBuilderStateReadiness({
    config: semanticParameterConfig,
    state: semanticParameterState,
    semanticModelProvider: { validateSelection() {} },
    semanticModelState: {
        loading: false,
        error: "",
        model: semanticParameterModel,
    },
    semanticSelectionValidationState: {
        fingerprint: semanticParameterValidationFingerprint,
        requestKey: `${semanticParameterValidationFingerprint}::0`,
        loading: false,
        error: "",
        valid: false,
        diagnostics: [
            {
                code: "invalidParameterRange",
                severity: "error",
                path: "selection.parameters.reporting_window",
                message: "Date Range start date must be on or before the end date.",
                suggestedFix: "Adjust the date range so the start date is not after the end date.",
            },
        ],
    },
    semanticRetryAvailable: false,
}), {
    canRun: false,
    reason: "semantic",
    message: "Date Range start date must be on or before the end date. Adjust the date range so the start date is not after the end date.",
});

console.log("reportBuilderReadiness ✓ semantic provider gating and recovery");

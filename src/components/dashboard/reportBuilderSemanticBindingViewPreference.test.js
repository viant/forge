import assert from "node:assert/strict";

import {
    buildReportBuilderSemanticBindingViewStateFromMetadataContext,
    normalizeReportBuilderSemanticBindingViewState,
    resolvePreferredReportBuilderSemanticBindingViewState,
    scoreReportBuilderSemanticBindingViewState,
} from "./reportBuilderSemanticBindingViewPreference.js";

const metadataContext = {
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
        selectedParameters: [
            { id: "reporting_window", rawId: "dateRange", label: "Canonical Reporting Window" },
        ],
    },
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        selectedDimensions: ["event_date"],
        selectedMeasures: ["available_impressions"],
    },
};

const carriedRawViewState = {
    title: "Semantic Binding",
    chips: [
        "Model model://example/performance/delivery@v1",
        "Entity line_delivery",
        "Dimensions event_date",
        "Measures available_impressions",
    ],
    fieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                { id: "event_date", rawId: "event_date", label: "event_date" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "available_impressions", label: "available_impressions" },
            ],
        },
    ],
};

const carriedRichViewState = {
    title: "Semantic Binding",
    modelLabel: "Carried Ad Delivery",
    entityLabel: "Carried Line Delivery",
    chips: [
        "Model Carried Ad Delivery",
        "Entity Carried Line Delivery",
        "Dimensions Carried Delivery Date",
        "Measures Carried Available Impressions",
    ],
    fieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Carried Delivery Date", category: "Time", definitionRef: "semantic://example/event_date" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Carried Available Impressions", format: "compactNumber", definitionRef: "semantic://example/available_impressions" },
            ],
        },
        {
            id: "parameters",
            title: "Selected parameters (1)",
            fields: [
                { id: "reporting_window", rawId: "dateRange", label: "Carried Reporting Window", category: "Scope", definitionRef: "semantic://example/reporting_window", description: "Carried reporting window" },
            ],
        },
    ],
};

assert.equal(normalizeReportBuilderSemanticBindingViewState({}), null);
assert.equal(normalizeReportBuilderSemanticBindingViewState({ chips: [""] }), null);

const metadataViewState = buildReportBuilderSemanticBindingViewStateFromMetadataContext(metadataContext);
assert.equal(metadataViewState.modelLabel, "Canonical Ad Delivery");
assert.equal(metadataViewState.entityLabel, "Canonical Line Delivery");
assert.equal(metadataViewState.chips.includes("Parameters Canonical Reporting Window"), true);

assert.equal(
    scoreReportBuilderSemanticBindingViewState(metadataViewState) > scoreReportBuilderSemanticBindingViewState(carriedRawViewState),
    true,
);
assert.equal(
    scoreReportBuilderSemanticBindingViewState(carriedRichViewState) > scoreReportBuilderSemanticBindingViewState(metadataViewState),
    true,
);

assert.deepEqual(
    resolvePreferredReportBuilderSemanticBindingViewState({
        metadataContexts: [metadataContext],
        candidates: [carriedRawViewState],
    }),
    metadataViewState,
);

assert.deepEqual(
    resolvePreferredReportBuilderSemanticBindingViewState({
        metadataContexts: [metadataContext],
        candidates: [carriedRichViewState],
    }),
    carriedRichViewState,
);

assert.deepEqual(
    resolvePreferredReportBuilderSemanticBindingViewState({
        metadataContexts: [metadataContext],
        candidates: [{}],
    }),
    metadataViewState,
);

console.log("reportBuilderSemanticBindingViewPreference ✓ prefers richer metadata-derived or carried semantic binding state deterministically");

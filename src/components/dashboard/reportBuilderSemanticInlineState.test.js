import assert from "node:assert/strict";

import { resolveReportBuilderInlineSemanticBindingViewState } from "./reportBuilderSemanticInlineState.js";

const currentBinding = {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date"],
    selectedMeasures: ["available_impressions"],
};

const reopenedBinding = {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date"],
    selectedMeasures: ["available_impressions"],
};

const rawCurrentSummary = {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date"],
    selectedMeasures: ["available_impressions"],
};

const canonicalReopenedSummary = {
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
};

assert.deepEqual(resolveReportBuilderInlineSemanticBindingViewState(), null);

const canonicalPreferredViewState = resolveReportBuilderInlineSemanticBindingViewState({
    currentSemanticSummary: rawCurrentSummary,
    currentBinding,
    reopenedSemanticSummary: canonicalReopenedSummary,
    reopenedBinding,
});
assert.deepEqual(canonicalPreferredViewState.chips, [
    "Model Canonical Ad Delivery",
    "Entity Canonical Line Delivery",
    "Dimensions Canonical Delivery Date",
    "Measures Canonical Available Impressions",
    "Categories Time",
]);

const currentPreferredViewState = resolveReportBuilderInlineSemanticBindingViewState({
    currentSemanticSummary: {
        kind: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        modelLabel: "Current Ad Delivery",
        entity: "line_delivery",
        entityLabel: "Current Line Delivery",
        selectedDimensions: [
            { id: "event_date", rawId: "eventDate", label: "Current Delivery Date", category: "Time", definitionRef: "semantic://example/event_date" },
        ],
        selectedMeasures: [
            { id: "available_impressions", rawId: "avails", label: "Current Available Impressions", format: "compactNumber", definitionRef: "semantic://example/available_impressions" },
        ],
    },
    currentBinding,
    reopenedSemanticSummary: canonicalReopenedSummary,
    reopenedBinding,
});
assert.deepEqual(currentPreferredViewState.chips, [
    "Model Current Ad Delivery",
    "Entity Current Line Delivery",
    "Dimensions Current Delivery Date",
    "Measures Current Available Impressions",
    "Categories Time",
    "Lineage semantic://example/event_date +1",
]);

console.log("reportBuilderSemanticInlineState ✓ prefers richer current or reopened semantic binding state for inline builder notices");

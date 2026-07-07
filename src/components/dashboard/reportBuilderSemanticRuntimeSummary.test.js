import assert from "node:assert/strict";

import { resolveReportBuilderSemanticRuntimeSummary } from "./reportBuilderSemanticRuntimeSummary.js";

const rawResolvedSummary = {
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

const binding = {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date"],
    selectedMeasures: ["available_impressions"],
};

assert.equal(
    resolveReportBuilderSemanticRuntimeSummary({
        resolvedSemanticSummary: null,
        reopenedSemanticSummary: canonicalReopenedSummary,
    })?.modelLabel,
    "Canonical Ad Delivery",
);

assert.equal(
    resolveReportBuilderSemanticRuntimeSummary({
        resolvedSemanticSummary: rawResolvedSummary,
        currentBinding: binding,
        reopenedSemanticSummary: canonicalReopenedSummary,
        reopenedBinding: binding,
        semanticStatusTitle: "Semantic model",
        semanticStatusMessage: "Loading semantic model metadata…",
    })?.modelLabel,
    "Canonical Ad Delivery",
);

const richResolvedSummary = {
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
};

assert.equal(
    resolveReportBuilderSemanticRuntimeSummary({
        resolvedSemanticSummary: richResolvedSummary,
        currentBinding: binding,
        reopenedSemanticSummary: canonicalReopenedSummary,
        reopenedBinding: binding,
        semanticStatusTitle: "Semantic model",
        semanticStatusMessage: "Loading semantic model metadata…",
    })?.modelLabel,
    "Current Ad Delivery",
);

assert.equal(
    resolveReportBuilderSemanticRuntimeSummary({
        resolvedSemanticSummary: richResolvedSummary,
        currentBinding: binding,
        reopenedSemanticSummary: canonicalReopenedSummary,
        reopenedBinding: binding,
        semanticStatusTitle: "Semantic binding",
        semanticStatusMessage: "Ready.",
    })?.modelLabel,
    "Current Ad Delivery",
);

console.log("reportBuilderSemanticRuntimeSummary ✓ prefers richer reopened semantic metadata only when the current runtime summary is still thin");

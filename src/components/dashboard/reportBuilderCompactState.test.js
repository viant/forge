import assert from "node:assert/strict";

import {
    formatCompactDateRangeSummary,
    resolveCompactSemanticActionLabel,
    resolveCompactSemanticHintText,
    resolveResultIdentityChip,
    resolveCompactSemanticSummaryItems,
    resolveCompactStatusText,
    resolveCompactSummaryItems,
    resolveTablePresetTransitionText,
} from "./reportBuilderCompactState.js";

assert.equal(formatCompactDateRangeSummary({}), "");
assert.equal(formatCompactDateRangeSummary({ start: "2026-06-01" }), "2026-06-01");
assert.equal(
    formatCompactDateRangeSummary({ start: "2026-06-01", end: "2026-06-07" }),
    "2026-06-01 to 2026-06-07",
);

assert.equal(resolveCompactStatusText({ loading: true }), "Refreshing report data.");
assert.equal(resolveCompactStatusText({ error: "boom" }), "Report refresh failed.");
assert.equal(
    resolveTablePresetTransitionText({
        canShowResults: true,
        activeTablePresetTitle: "Delivery Grid",
    }),
    "Showing Delivery Grid.",
);
assert.equal(
    resolveTablePresetTransitionText({
        modifiedTablePresetTitle: "Delivery Grid",
    }),
    "Modified from Delivery Grid.",
);
assert.equal(
    resolveTablePresetTransitionText({
        readinessReason: "semantic",
        readinessMessage: "Validating the semantic selection against the provider.",
        activeTablePresetTitle: "Delivery Grid",
    }),
    "Validating the semantic selection against the provider.",
);
assert.equal(
    resolveResultIdentityChip({
        showingChartView: true,
        canShowResults: true,
    }),
    "Chart view",
);
assert.equal(
    resolveResultIdentityChip({
        canShowResults: true,
        activeTablePresetTitle: "Delivery Grid",
    }),
    "Delivery Grid",
);
assert.equal(
    resolveResultIdentityChip({
        modifiedTablePresetTitle: "Delivery Grid",
    }),
    "Modified from Delivery Grid",
);
assert.equal(
    resolveResultIdentityChip({
        canShowResults: true,
    }),
    "Table view",
);

assert.equal(
    resolveCompactStatusText({
        canShowResults: true,
        explicitChartMode: true,
        hasValidChartSpec: true,
        viewMode: "chart",
        chartTitle: "Overview · Avails by Date",
    }),
    "Showing Overview · Avails by Date.",
);
assert.equal(
    resolveCompactStatusText({
        canShowResults: true,
        rowCount: 2,
    }),
    "Showing 2 rows.",
);
assert.equal(
    resolveCompactStatusText({
        canShowResults: true,
        activeTablePresetTitle: "Delivery Grid",
    }),
    "Showing Delivery Grid.",
);
assert.equal(
    resolveCompactStatusText({
        canRunReport: true,
        modifiedTablePresetTitle: "Delivery Grid",
    }),
    "Modified from Delivery Grid.",
);
assert.equal(resolveCompactStatusText({ canRunReport: true }), "Ready to run the report.");
assert.equal(
    resolveCompactStatusText({
        readinessReason: "semantic",
        readinessMessage: "Mapped measures are required before this semantic report can run.",
    }),
    "Mapped measures are required before this semantic report can run.",
);
assert.equal(resolveCompactStatusText({ readinessReason: "scope" }), "Choose a scope to continue.");
assert.equal(resolveCompactStatusText({}), "Set the required filters to continue.");

assert.deepEqual(
    resolveCompactSummaryItems({
        requiredStaticFilters: [{ id: "dateRange", type: "dateRange" }],
        scopeParamValues: { dateRange: { start: "2026-06-01", end: "2026-06-07" } },
        selectedMeasures: ["avails", "hhUniqs"],
        selectedDimensions: ["eventDate"],
        totalActiveFilterCount: 3,
        hasValidChartSpec: true,
        viewMode: "chart",
    }),
    [
        "Chart view",
        "2026-06-01 to 2026-06-07",
        "2 measures",
        "1 breakdown",
        "3 filters",
    ],
);

assert.deepEqual(
    resolveCompactSummaryItems({
        activeTablePresetTitle: "Delivery Grid",
        selectedMeasures: ["avails"],
        selectedDimensions: ["eventDate"],
        canShowResults: true,
        viewMode: "table",
    }),
    [
        "Delivery Grid",
        "1 measure",
        "1 breakdown",
    ],
);

assert.deepEqual(
    resolveCompactSummaryItems({
        modifiedTablePresetTitle: "Delivery Grid",
        selectedMeasures: ["avails"],
        selectedDimensions: ["eventDate"],
    }),
    [
        "Modified from Delivery Grid",
        "1 measure",
        "1 breakdown",
    ],
);

assert.deepEqual(
    resolveCompactSemanticSummaryItems({
        semanticBindingChips: [
            "Model Performance Model",
            "Entity Line Delivery",
            "Measures Spend",
        ],
    }),
    [
        "Model Performance Model",
        "Entity Line Delivery",
    ],
);

assert.deepEqual(
    resolveCompactSemanticSummaryItems({
        semanticMetaChips: [
            "Raw mode",
            "Provider unavailable",
        ],
    }),
    [
        "Raw mode",
        "Provider unavailable",
    ],
);

assert.equal(
    resolveCompactSemanticActionLabel({
        semanticTitle: "Semantic modeling inactive",
        tone: "info",
        activationCount: 0,
    }),
    "Semantic setup",
);

assert.equal(
    resolveCompactSemanticActionLabel({
        semanticTitle: "Semantic diagnostics",
        tone: "warning",
        diagnosticsCount: 2,
    }),
    "Model issues",
);

assert.equal(
    resolveCompactSemanticActionLabel({
        semanticTitle: "Semantic Binding",
        tone: "info",
    }),
    "Model",
);

assert.equal(
    resolveCompactSemanticActionLabel({
        semanticTitle: "Semantic modeling inactive",
        activationCount: 1,
    }),
    "Activate semantic",
);

assert.equal(
    resolveCompactSemanticHintText({
        semanticTitle: "Semantic modeling inactive",
        activationCount: 0,
    }),
    "Load a semantic report file to switch this builder from raw mode to model-backed mappings.",
);

assert.equal(
    resolveCompactSemanticHintText({
        semanticTitle: "Semantic modeling inactive",
        activationCount: 1,
    }),
    "A semantic report is ready to activate from this workspace.",
);

console.log("reportBuilderCompactState ✓");

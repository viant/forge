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
        activeTablePresetTitle: "Delivery Grid",
    }),
    "",
);
assert.equal(
    resolveResultIdentityChip({
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
assert.equal(resolveResultIdentityChip({}), "");

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
            "No data model",
            "Data model source unavailable",
        ],
    }),
    [
        "No data model",
        "Data model source unavailable",
    ],
);

assert.equal(
    resolveCompactSemanticActionLabel({
        semanticTitle: "No data model configured",
        tone: "info",
        activationCount: 0,
    }),
    "Data model setup",
);

assert.equal(
    resolveCompactSemanticActionLabel({
        semanticTitle: "Semantic diagnostics",
        tone: "warning",
        diagnosticsCount: 2,
    }),
    "Data model issues",
);

assert.equal(
    resolveCompactSemanticActionLabel({
        semanticTitle: "Semantic Binding",
        tone: "info",
    }),
    "Data model",
);

assert.equal(
    resolveCompactSemanticActionLabel({
        semanticTitle: "No data model configured",
        activationCount: 1,
    }),
    "Activate data model",
);

assert.equal(
    resolveCompactSemanticHintText({
        semanticTitle: "No data model configured",
        activationCount: 0,
    }),
    "Load a report file to switch this builder from raw mode to data-model mappings.",
);

assert.equal(
    resolveCompactSemanticHintText({
        semanticTitle: "No data model configured",
        activationCount: 1,
    }),
    "A data-model report is ready to activate from this workspace.",
);

console.log("reportBuilderCompactState ✓");

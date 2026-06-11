import assert from "node:assert/strict";

import {
    formatCompactDateRangeSummary,
    resolveCompactStatusText,
    resolveCompactSummaryItems,
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
assert.equal(resolveCompactStatusText({ canRunReport: true }), "Ready to run the report.");
assert.equal(resolveCompactStatusText({ readinessReason: "scope" }), "Choose a scope to continue.");
assert.equal(resolveCompactStatusText({}), "Set the required filters to continue.");

assert.deepEqual(
    resolveCompactSummaryItems({
        requiredStaticFilters: [{ id: "dateRange", type: "dateRange" }],
        staticFilters: { dateRange: { start: "2026-06-01", end: "2026-06-07" } },
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
        "Chart view",
    ],
);

assert.deepEqual(
    resolveCompactSummaryItems({
        selectedMeasures: ["avails"],
        selectedDimensions: ["eventDate"],
        canShowResults: true,
        viewMode: "table",
    }),
    [
        "1 measure",
        "1 breakdown",
        "Table view",
    ],
);

console.log("reportBuilderCompactState ✓");

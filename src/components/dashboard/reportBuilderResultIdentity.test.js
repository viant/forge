import assert from "node:assert/strict";

import {
    buildReportBuilderDesktopResultState,
    resolveReportBuilderActiveFilterSummary,
    resolveReportBuilderResultDescription,
    resolveReportBuilderResultTitle,
    resolveResultIdentityChip,
    resolveTablePresetTransitionText,
} from "./reportBuilderResultIdentity.js";

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

assert.equal(resolveReportBuilderActiveFilterSummary({}), "");
assert.equal(resolveReportBuilderActiveFilterSummary({ totalActiveFilterCount: 1 }), "1 active filter");
assert.equal(resolveReportBuilderActiveFilterSummary({ totalActiveFilterCount: 3 }), "3 active filters");

assert.equal(
    resolveReportBuilderResultTitle({
        showingChartView: false,
        canShowResults: true,
        activeTablePresetTitle: "Delivery Grid",
    }),
    "Delivery Grid",
);

assert.equal(
    resolveReportBuilderResultTitle({
        showingChartView: true,
        chartTitle: "",
        fallbackChartTitle: "Line chart",
    }),
    "Line chart",
);

assert.equal(
    resolveReportBuilderResultDescription({
        canShowResults: true,
        activeTablePresetTitle: "Delivery Grid",
    }),
    "",
);

assert.equal(
    resolveReportBuilderResultDescription({
        canShowResults: false,
        canRunReport: false,
        readinessReason: "semantic",
        readinessMessage: "Validating the semantic selection against the provider.",
        modifiedTablePresetTitle: "Delivery Grid",
    }),
    "Validating the semantic selection against the provider.",
);

assert.equal(
    resolveReportBuilderResultDescription({
        canRunReport: true,
        activeTablePresetTitle: "Delivery Grid",
    }),
    "",
);

assert.deepEqual(
    buildReportBuilderDesktopResultState({
        showingChartView: false,
        canShowResults: true,
        activeTablePresetTitle: "Delivery Grid",
        totalActiveFilterCount: 2,
    }),
    {
        title: "Delivery Grid",
        description: "",
        activeFilterSummary: "2 active filters",
    },
);

assert.equal(
    buildReportBuilderDesktopResultState({
        showingChartView: true,
        chartTitle: "Spend by Date",
        canShowResults: true,
        activeTablePresetTitle: "Delivery Grid",
    }).description,
    "",
);

console.log("reportBuilderResultIdentity ✓ shared result copy and identity helpers");

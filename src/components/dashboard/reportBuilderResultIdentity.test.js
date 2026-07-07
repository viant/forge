import assert from "node:assert/strict";

import {
    buildReportBuilderDesktopResultState,
    resolveReportBuilderResultDescription,
    resolveReportBuilderResultMetaItems,
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
        canShowResults: true,
    }),
    "Chart view",
);

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
        activeTablePresetDescription: "Table-first delivery preset.",
    }),
    "Showing Delivery Grid. Table-first delivery preset. Use Presets to switch to a curated table and chart view for this scope.",
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

assert.deepEqual(
    resolveReportBuilderResultMetaItems({
        showingChartView: false,
        canShowResults: true,
        activeTablePresetTitle: "Delivery Grid",
        selectedMeasuresCount: 2,
        selectedDimensionsCount: 3,
        totalActiveFilterCount: 1,
        pageRowCount: 8,
    }),
    [
        "Delivery Grid",
        "2 measures",
        "3 breakdowns",
        "1 filter",
        "8 page rows",
    ],
);

assert.deepEqual(
    resolveReportBuilderResultMetaItems({
        showingChartView: true,
        canShowResults: true,
        chartIdentityLabel: "Line chart",
        selectedMeasuresCount: 1,
        selectedDimensionsCount: 1,
    }),
    [
        "1 measure",
        "1 breakdown",
    ],
);

assert.deepEqual(
    buildReportBuilderDesktopResultState({
        showingChartView: false,
        canShowResults: true,
        activeTablePresetTitle: "Delivery Grid",
        activeTablePresetDescription: "Table-first delivery preset.",
        activeTablePresetEyebrow: "Metrics Panel",
        activeTablePresetAccentTone: "delivery",
        activeTablePresetHighlights: ["Selected Dates", "Market Context", "Export Ready"],
        selectedMeasuresCount: 2,
        selectedDimensionsCount: 3,
        totalActiveFilterCount: 1,
        pageRowCount: 8,
    }),
    {
        title: "Delivery Grid",
        description: "Showing Delivery Grid. Table-first delivery preset. Use Presets to switch to a curated table and chart view for this scope.",
        presetIdentity: {
            eyebrow: "Metrics Panel",
            title: "Delivery Grid",
            accentTone: "delivery",
            highlights: ["Selected Dates", "Market Context", "Export Ready"],
        },
        metaItems: [
            "Delivery Grid",
            "2 measures",
            "3 breakdowns",
            "1 filter",
            "8 page rows",
        ],
    },
);

assert.deepEqual(
    buildReportBuilderDesktopResultState({
        showingChartView: true,
        chartTitle: "Spend by Date",
        canShowResults: true,
        activeTablePresetTitle: "Delivery Grid",
        activeChartPresetTitle: "Spend by Date",
        activeChartPresetEyebrow: "Visual Story",
        activeChartPresetAccentTone: "delivery",
        activeChartPresetHighlights: ["Split by Site Type", "Trend View", "Full Query"],
        chartIdentityLabel: "Line",
        selectedMeasuresCount: 1,
        selectedDimensionsCount: 2,
    }).presetIdentity,
    {
        eyebrow: "Visual Story",
        title: "Spend by Date",
        accentTone: "delivery",
        highlights: ["Split by Site Type", "Trend View", "Full Query"],
    },
);

console.log("reportBuilderResultIdentity ✓ shared result copy and identity helpers");

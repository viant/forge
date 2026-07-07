import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/reportBuilderComponents.jsx"),
  "utf8",
);

assert.equal(
  source.includes("Starter projection"),
  true,
  "ReportBuilderChartDialog should frame the shared builder result as a starter projection for authored chart blocks.",
);

assert.equal(
  source.includes("dataViewLabel"),
  true,
  "ReportBuilderChartDialog should accept shared data-view context for authored chart blocks.",
);

assert.equal(
  source.includes("semanticBindingState"),
  true,
  "ReportBuilderChartDialog should accept semantic binding context for authored chart blocks.",
);

assert.equal(
  source.includes("datasetOptions"),
  true,
  "ReportBuilderChartDialog should accept dataset options so authored charts can bind to non-primary sources such as imported CSV data.",
);

assert.equal(
  source.includes("onDatasetRefChange"),
  true,
  "ReportBuilderChartDialog should propagate authored chart data-source changes back to the parent draft state.",
);

assert.equal(
  source.includes("Missing source ("),
  true,
  "ReportBuilderChartDialog should keep a missing dataset visible so authors can rebind the chart instead of silently falling back.",
);

assert.equal(
  source.includes("Search fields"),
  true,
  "ReportBuilderChartDialog should let authors filter large field inventories while shaping chart projections.",
);

assert.equal(
  source.includes("Filter dimensions and measures"),
  true,
  "ReportBuilderChartDialog should provide a field-search placeholder that covers both dimensions and measures.",
);

assert.equal(
  source.includes("selectedMeasureEntries"),
  true,
  "ReportBuilderChartDialog should surface the currently selected measures above the picker so chart authoring stays oriented.",
);

console.log("reportBuilderChartDialogCoverage ✓ chart dialog exposes block-level data-view context");

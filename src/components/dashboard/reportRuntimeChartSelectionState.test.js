import assert from "node:assert/strict";

import {
  clearReportRuntimeChartSelection,
  setReportRuntimeChartSelection,
} from "./reportRuntimeChartSelectionState.js";

const selected = setReportRuntimeChartSelection({}, "primaryChart", {
  source: "pie",
  xValue: "Display",
});

assert.deepEqual(selected, {
  primaryChart: {
    source: "pie",
    xValue: "Display",
  },
});

assert.deepEqual(clearReportRuntimeChartSelection(selected, "primaryChart"), {
  primaryChart: null,
});

console.log("reportRuntimeChartSelectionState ✓ updates and clears selected chart values by runtime block");

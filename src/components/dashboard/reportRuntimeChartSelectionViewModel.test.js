import assert from "node:assert/strict";

import { buildReportRuntimeChartSelectionViewModel } from "./reportRuntimeChartSelectionViewModel.js";

assert.deepEqual(buildReportRuntimeChartSelectionViewModel({
  interactionSupport: {
    enabled: false,
    message: "Chart actions are unavailable because this chart does not declare a type.",
  },
}), {
  kind: "unsupported",
  message: "Chart actions are unavailable because this chart does not declare a type.",
});

assert.deepEqual(buildReportRuntimeChartSelectionViewModel({
  interactionSupport: {
    enabled: true,
    legendEnabled: false,
  },
}), {
  kind: "idle",
  message: "Click a chart mark to apply authored runtime actions.",
});

assert.deepEqual(buildReportRuntimeChartSelectionViewModel({
  interactionSupport: {
    enabled: true,
    legendEnabled: true,
  },
}), {
  kind: "idle",
  message: "Click a chart mark or series legend to apply authored runtime actions.",
});

assert.deepEqual(buildReportRuntimeChartSelectionViewModel({
  blockTitle: "Avails by Date and Channel",
  selection: {
    source: "cartesian",
    xValue: "2026-05-01",
    seriesKey: "Display",
  },
  actions: [
    { id: "detail_channel", label: "Show channel details" },
  ],
  canClearSelection: true,
}), {
  kind: "selected",
  summary: "2026-05-01 • Display",
  actions: [
    { id: "detail_channel", label: "Show channel details" },
  ],
  canClearSelection: true,
});

console.log("reportRuntimeChartSelectionViewModel ✓ summarizes the supported chart selection UI states");

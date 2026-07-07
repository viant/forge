import assert from "node:assert/strict";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ChartSelectionPanel } from "./ReportRuntime.jsx";

const html = renderToStaticMarkup(
  React.createElement(ChartSelectionPanel, {
    viewModel: {
      kind: "selected",
      summary: "Display",
      canClearSelection: true,
      actions: [
        { id: "exclude:primaryChart:channelV2", label: "Exclude", kind: "exclude" },
        { id: "drill_publisher", label: "Drill to Publisher", kind: "drill" },
        { id: "detail_channel", label: "Show channel details", kind: "detail" },
      ],
    },
    onAction: () => {},
    onClearSelection: () => {},
  }),
);

assert.ok(html.includes("Selected value:"));
assert.ok(html.includes("Display"));
assert.ok(html.includes('data-testid="report-runtime-chart-action"'));
assert.ok(html.includes('data-action-id="exclude:primaryChart:channelV2"'));
assert.ok(html.includes('data-action-id="drill_publisher"'));
assert.ok(html.includes('data-action-id="detail_channel"'));
assert.ok(html.includes('data-action-kind="exclude"'));
assert.ok(html.includes('data-action-kind="drill"'));
assert.ok(html.includes('data-action-kind="detail"'));
assert.ok(html.includes("Clear selection"));

console.log("reportRuntimeChartSelectionPanel ✓ renders stable chart runtime action hooks for selected chart values");

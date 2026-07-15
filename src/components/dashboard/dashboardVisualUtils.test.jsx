import assert from "node:assert/strict";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  renderDashboardTableCell,
  renderExplicitReportTableCellVisual,
} from "./dashboardVisualUtils.jsx";

const badgeHtml = renderToStaticMarkup(
  renderExplicitReportTableCellVisual(
    "Display",
    { channelV2: "Display" },
    {
      key: "channelV2",
      label: "Channel",
      cellVisual: {
        kind: "badge",
        rules: [
          { value: "Display", tone: "info", label: "Display" },
        ],
      },
    },
    "en-US",
  ),
);

assert.ok(badgeHtml.includes("forge-dashboard-table-cell-visual"));
assert.ok(badgeHtml.includes("forge-dashboard-table-cell-visual--badge"));
assert.ok(badgeHtml.includes("forge-dashboard-table-cell-visual--info"));
assert.ok(badgeHtml.includes("data-visual-kind=\"badge\""));
assert.ok(badgeHtml.includes("data-visual-tone=\"info\""));
assert.ok(badgeHtml.includes("Display"));

const toneHtml = renderToStaticMarkup(
  renderExplicitReportTableCellVisual(
    "watch",
    { pacing: "watch" },
    {
      key: "pacing",
      label: "Pacing",
      cellVisual: {
        kind: "tone",
        rules: [
          { value: "watch", tone: "warning", label: "Watch" },
        ],
      },
    },
    "en-US",
  ),
);

assert.ok(toneHtml.includes("forge-dashboard-table-cell-visual--tone"));
assert.ok(toneHtml.includes("forge-dashboard-table-cell-visual--warning"));
assert.ok(toneHtml.includes("data-visual-kind=\"tone\""));
assert.ok(toneHtml.includes("Watch"));

const customBadgeHtml = renderToStaticMarkup(
  renderExplicitReportTableCellVisual(
    "healthy",
    { status: "healthy" },
    {
      key: "status",
      label: "Status",
      cellVisual: {
        kind: "badge",
        rules: [
          { value: "healthy", tone: "success", label: "Healthy", color: "#0f4c81", background: "#d9f2ff" },
        ],
      },
    },
    "en-US",
  ),
);

assert.ok(customBadgeHtml.includes("#d9f2ff"));
assert.ok(customBadgeHtml.includes("#0f4c81"));

const dataBarHtml = renderToStaticMarkup(
  renderExplicitReportTableCellVisual(
    240,
    { spend: 240 },
    {
      key: "spend",
      label: "Spend",
      cellVisual: {
        kind: "dataBar",
        valueField: "spend",
        palette: ["#dbeafe", "#2563eb"],
      },
      cellVisualRuntime: {
        range: { min: 120, max: 240 },
      },
    },
    "en-US",
  ),
);

assert.ok(dataBarHtml.includes("forge-dashboard-table-cell-visual--data-bar"));
assert.ok(dataBarHtml.includes("data-visual-kind=\"dataBar\""));
assert.ok(dataBarHtml.includes("240"));

const plainTextHtml = renderToStaticMarkup(
  React.createElement("div", null, renderDashboardTableCell("Plain", {}, { key: "label", label: "Label" }, "en-US")),
);

assert.ok(plainTextHtml.includes("forge-dashboard-table-cell-text"));
assert.ok(plainTextHtml.includes("Plain"));

console.log("dashboardVisualUtils ✓ exposes stable classes for explicit table visuals while preserving plain-text fallback rendering");

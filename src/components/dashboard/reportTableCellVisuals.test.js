import assert from "node:assert/strict";

import {
  buildReportTableRuntimeColumns,
  resolveReportTableCellVisualState,
} from "./reportTableCellVisuals.js";

const rows = [
  { spend: 120, status: "healthy", trend: "up" },
  { spend: 240, status: "critical", trend: "down" },
];

const runtimeColumns = buildReportTableRuntimeColumns([
  {
    key: "spend",
    label: "Spend",
    cellVisual: {
      kind: "dataBar",
      valueField: "spend",
      range: { mode: "columnMax" },
      palette: ["#dbeafe", "#2563eb"],
    },
  },
  {
    key: "status",
    label: "Status",
    cellVisual: {
      kind: "badge",
      rules: [
        { value: "healthy", tone: "success", label: "Healthy" },
        { value: "critical", tone: "danger" },
      ],
    },
  },
  {
    key: "trend",
    label: "Trend",
    cellVisual: {
      kind: "tone",
      rules: [
        { value: "up", tone: "success", label: "Pacing Up" },
        { value: "down", tone: "warning", label: "Pacing Down" },
      ],
    },
  },
], rows);

assert.deepEqual(runtimeColumns[0].cellVisualRuntime, {
  range: { min: 120, max: 240 },
});

assert.deepEqual(resolveReportTableCellVisualState(rows[0], runtimeColumns[0]), {
  kind: "dataBar",
  value: 120,
  percent: 0,
  palette: ["#dbeafe", "#2563eb"],
});

assert.deepEqual(resolveReportTableCellVisualState(rows[1], runtimeColumns[0]), {
  kind: "dataBar",
  value: 240,
  percent: 1,
  palette: ["#dbeafe", "#2563eb"],
});

assert.deepEqual(resolveReportTableCellVisualState(rows[0], runtimeColumns[1]), {
  kind: "badge",
  tone: "success",
  label: "Healthy",
});

assert.deepEqual(resolveReportTableCellVisualState(rows[1], runtimeColumns[2]), {
  kind: "tone",
  tone: "warning",
  label: "Pacing Down",
});

assert.equal(resolveReportTableCellVisualState({ status: "unknown" }, runtimeColumns[1]), null);

console.log("reportTableCellVisuals ✓ resolves authored table visuals for runtime rendering");

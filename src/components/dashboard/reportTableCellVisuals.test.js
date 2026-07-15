import assert from "node:assert/strict";

import {
  buildReportTableRuntimeColumns,
  resolveReportTableCellVisualState,
} from "./reportTableCellVisuals.js";

const rows = [
  { spend: 120, status: "healthy", trend: "up", wowDelta: 0.12, churnDelta: -0.08, spendRank: 120, progress: 30, sparkValue: 30, ctvShare: 0.6, displayShare: 0.4 },
  { spend: 240, status: "critical", trend: "down", wowDelta: -0.05, churnDelta: 0.03, spendRank: 240, progress: 90, sparkValue: 90, ctvShare: 0.35, displayShare: 0.65 },
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
        { value: "healthy", tone: "success", label: "Healthy", color: "#0f4c81", background: "#d9f2ff" },
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
  {
    key: "wowDelta",
    label: "WoW Delta",
    format: "percentFraction",
    cellVisual: {
      kind: "delta",
      valueField: "wowDelta",
    },
  },
  {
    key: "progress",
    label: "Progress",
    cellVisual: {
      kind: "progressBar",
      valueField: "progress",
      range: { mode: "columnMax" },
      palette: ["#e5edf5", "#2f6de1"],
    },
  },
  {
    key: "sparkValue",
    label: "Spark",
    cellVisual: {
      kind: "sparkBar",
      valueField: "sparkValue",
      range: { mode: "columnMax" },
      palette: ["#eef2f6", "#4c6fff"],
    },
  },
  {
    key: "shareMix",
    label: "Share Mix",
    cellVisual: {
      kind: "shareBar",
      segments: [
        { valueField: "ctvShare", label: "CTV", color: "#137cbd" },
        { valueField: "displayShare", label: "Display", color: "#0f9960" },
      ],
    },
  },
  {
    key: "churnDelta",
    label: "Churn Delta",
    format: "percentFraction",
    cellVisual: {
      kind: "delta",
      valueField: "churnDelta",
      positiveIsGood: false,
    },
  },
  {
    key: "spendRank",
    label: "Rank",
    cellVisual: {
      kind: "rank",
      valueField: "spendRank",
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
  textColor: "#0f4c81",
  borderColor: "#0f4c81",
  backgroundColor: "#d9f2ff",
});

assert.deepEqual(resolveReportTableCellVisualState(rows[1], runtimeColumns[2]), {
  kind: "tone",
  tone: "warning",
  label: "Pacing Down",
});

assert.deepEqual(resolveReportTableCellVisualState(rows[0], runtimeColumns[3]), {
  kind: "delta",
  value: 0.12,
  tone: "success",
});

assert.deepEqual(resolveReportTableCellVisualState(rows[1], runtimeColumns[4]), {
  kind: "progressBar",
  value: 90,
  percent: 1,
  palette: ["#e5edf5", "#2f6de1"],
});

assert.deepEqual(resolveReportTableCellVisualState(rows[1], runtimeColumns[5]), {
  kind: "sparkBar",
  value: 90,
  percent: 1,
  palette: ["#eef2f6", "#4c6fff"],
});

assert.deepEqual(resolveReportTableCellVisualState(rows[1], runtimeColumns[6]), {
  kind: "shareBar",
  segments: [
    { label: "CTV", color: "#137cbd", value: 0.35, percent: 0.35 },
    { label: "Display", color: "#0f9960", value: 0.65, percent: 0.65 },
  ],
});

assert.deepEqual(resolveReportTableCellVisualState(rows[1], runtimeColumns[7]), {
  kind: "delta",
  value: 0.03,
  tone: "danger",
});

assert.deepEqual(resolveReportTableCellVisualState(rows[1], runtimeColumns[8]), {
  kind: "rank",
  value: 1,
  tone: "info",
  label: "#1",
});

assert.equal(resolveReportTableCellVisualState({ status: "unknown" }, runtimeColumns[1]), null);

console.log("reportTableCellVisuals ✓ resolves authored table visuals for runtime rendering");

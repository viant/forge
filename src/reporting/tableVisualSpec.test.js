import assert from "node:assert/strict";

import {
  normalizeReportDocumentTableBlock,
  normalizeReportTableBlockColumn,
  normalizeReportTableCellVisual,
} from "./tableVisualSpec.js";

assert.equal(normalizeReportTableCellVisual(null), null);
assert.equal(normalizeReportTableCellVisual({ kind: "unknown" }), null);

assert.deepEqual(normalizeReportTableCellVisual({
  kind: "dataBar",
  valueField: " spend ",
  range: { mode: "columnMax", min: "0", max: 200 },
  palette: ["#dbeafe", " #2563eb "],
  nullBehavior: "hide",
}), {
  kind: "dataBar",
  valueField: "spend",
  range: { mode: "columnMax", min: 0, max: 200 },
  palette: ["#dbeafe", "#2563eb"],
  nullBehavior: "hide",
});

assert.deepEqual(normalizeReportTableCellVisual({
  kind: "tone",
  rules: [
    { value: "healthy", tone: "success" },
    { value: "critical", tone: "danger", label: "Critical", color: "#7a271a", background: "#fdecea" },
  ],
}), {
  kind: "tone",
  rules: [
    { value: "healthy", tone: "success" },
    { value: "critical", tone: "danger", label: "Critical", color: "#7a271a", background: "#fdecea" },
  ],
});

assert.deepEqual(normalizeReportTableCellVisual({
  kind: "progressBar",
  valueField: " progress ",
  range: { mode: "columnMax" },
  palette: ["#e5edf5", "#2f6de1"],
}), {
  kind: "progressBar",
  valueField: "progress",
  range: { mode: "columnMax" },
  palette: ["#e5edf5", "#2f6de1"],
});

assert.deepEqual(normalizeReportTableCellVisual({
  kind: "sparkBar",
  valueField: " sparkValue ",
  range: { mode: "columnMax" },
  palette: ["#eef2f6", "#4c6fff"],
}), {
  kind: "sparkBar",
  valueField: "sparkValue",
  range: { mode: "columnMax" },
  palette: ["#eef2f6", "#4c6fff"],
});

assert.deepEqual(normalizeReportTableCellVisual({
  kind: "shareBar",
  segments: [
    { valueField: "ctvShare", label: "CTV", color: "#137cbd" },
    { valueField: "displayShare", label: "Display", color: "#0f9960" },
  ],
}), {
  kind: "shareBar",
  segments: [
    { valueField: "ctvShare", label: "CTV", color: "#137cbd" },
    { valueField: "displayShare", label: "Display", color: "#0f9960" },
  ],
});

assert.deepEqual(normalizeReportTableCellVisual({
  kind: "delta",
  valueField: " wowDelta ",
  positiveIsGood: false,
}), {
  kind: "delta",
  valueField: "wowDelta",
  positiveIsGood: false,
});

assert.deepEqual(normalizeReportTableCellVisual({
  kind: "rank",
  valueField: " spendRank ",
}), {
  kind: "rank",
  valueField: "spendRank",
});

assert.deepEqual(normalizeReportTableBlockColumn({
  key: "status",
  sourceKey: "status",
  displayKey: "statusLabel",
  displayIconMap: {
    healthy: "endorsed",
  },
  kind: "dimension",
  label: "Status",
  runtimeFilterable: true,
  cellVisual: {
    kind: "badge",
    rules: [
      { value: "watch", tone: "warning" },
    ],
  },
}), {
  key: "status",
  sourceKey: "status",
  displayKey: "statusLabel",
  displayIconMap: {
    healthy: "endorsed",
  },
  kind: "dimension",
  label: "Status",
  runtimeFilterable: true,
  cellVisual: {
    kind: "badge",
    rules: [
      { value: "watch", tone: "warning" },
    ],
  },
});

assert.deepEqual(normalizeReportDocumentTableBlock({
  id: "comparisonTable",
  title: "Comparison Table",
  datasetRef: "primary",
  columns: [
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
        kind: "tone",
        rules: [
          { value: "healthy", tone: "success" },
          { value: "critical", tone: "danger" },
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
      key: "spendRank",
      label: "Rank",
      cellVisual: {
        kind: "rank",
        valueField: "spendRank",
      },
    },
  ],
}), {
  id: "comparisonTable",
  kind: "tableBlock",
  title: "Comparison Table",
  datasetRef: "primary",
  columns: [
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
        kind: "tone",
        rules: [
          { value: "healthy", tone: "success" },
          { value: "critical", tone: "danger" },
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
      key: "spendRank",
      label: "Rank",
      cellVisual: {
        kind: "rank",
        valueField: "spendRank",
      },
    },
  ],
});

assert.deepEqual(normalizeReportDocumentTableBlock({
  id: "legacyTable",
  title: "Legacy Table",
  datasetRef: "primary",
  columnKeys: ["eventDate", "channelId", "totalSpend"],
}), {
  id: "legacyTable",
  kind: "tableBlock",
  title: "Legacy Table",
  datasetRef: "primary",
  columns: [
    { key: "eventDate" },
    { key: "channelId" },
    { key: "totalSpend" },
  ],
});

assert.equal(normalizeReportTableBlockColumn({
  key: "[MaxDepth]",
  label: "[MaxDepth]",
}), null);

assert.equal(normalizeReportDocumentTableBlock({
  id: "truncatedTable",
  title: "Truncated Table",
  datasetRef: "primary",
  columns: [
    { key: "[MaxDepth]" },
  ],
}), null);

assert.equal(normalizeReportDocumentTableBlock({
  id: "truncatedLegacyTable",
  title: "Truncated Legacy Table",
  datasetRef: "primary",
  columnKeys: ["[MaxDepth]"],
}), null);

console.log("tableVisualSpec ✓ normalizes authored table visual contracts");

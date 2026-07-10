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
    { value: "critical", tone: "danger", label: "Critical" },
  ],
}), {
  kind: "tone",
  rules: [
    { value: "healthy", tone: "success" },
    { value: "critical", tone: "danger", label: "Critical" },
  ],
});

assert.deepEqual(normalizeReportTableBlockColumn({
  key: "status",
  sourceKey: "status",
  displayKey: "statusLabel",
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

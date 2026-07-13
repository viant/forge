import assert from "node:assert/strict";

import {
  buildReportDocumentFilterBarBlock,
  normalizeReportBuilderDocumentBlocks,
} from "./reportDocumentModel.js";
import { normalizeReportDocumentTableBlock } from "./tableVisualSpec.js";

assert.equal(buildReportDocumentFilterBarBlock({
  id: "scopeFilters",
  title: "Scope",
  paramIds: ["[MaxDepth]"],
}), null);

assert.deepEqual(buildReportDocumentFilterBarBlock({
  id: "scopeFilters",
  title: "Scope",
  paramIds: ["dateRange", "[MaxDepth]", "channelIds"],
}), {
  id: "scopeFilters",
  kind: "filterBarBlock",
  title: "Filters",
  datasetRef: "primary",
  paramIds: ["dateRange", "channelIds"],
});

assert.equal(normalizeReportDocumentTableBlock({
  id: "comparisonTable",
  title: "Channel Comparison",
  datasetRef: "primary",
  columns: [{ key: "[MaxDepth]" }],
}), null);

assert.deepEqual(normalizeReportDocumentTableBlock({
  id: "comparisonTable",
  title: "Channel Comparison",
  datasetRef: "primary",
  columns: [{ key: "channelV2", label: "Channel" }, { key: "[MaxDepth]" }],
}), {
  id: "comparisonTable",
  kind: "tableBlock",
  title: "Channel Comparison",
  datasetRef: "primary",
  columns: [{ key: "channelV2", label: "Channel" }],
});

assert.deepEqual(normalizeReportBuilderDocumentBlocks([
  {
    id: "scopeFilters",
    kind: "filterBarBlock",
    title: "Filters",
    paramIds: ["[MaxDepth]"],
  },
  {
    id: "comparisonTable",
    kind: "tableBlock",
    title: "Channel Comparison",
    columns: [{ key: "[MaxDepth]" }],
  },
  {
    id: "headlineKpi",
    kind: "kpiBlock",
    title: "Headline",
    valueField: "totalSpend",
  },
]), [
  {
    id: "headlineKpi",
    kind: "kpiBlock",
    title: "Headline",
    datasetRef: "primary",
    valueField: "totalSpend",
    valueLabel: "totalSpend",
  },
]);

console.log("reportDocumentTruncationNormalization ✓ strips truncated placeholders from authored document blocks");

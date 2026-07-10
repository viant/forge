import assert from "node:assert/strict";

import { resolveCurrentReportBuilderRuntimeBlock } from "./reportBuilderRuntimeSelectionModel.js";

const blocks = [
  { id: "sharedFilters", kind: "filterBarBlock" },
  { id: "detailTable", kind: "tableBlock" },
  { id: "trendChart", kind: "chartBlock" },
];

assert.deepEqual(
  resolveCurrentReportBuilderRuntimeBlock(blocks, {
    preferredId: "detailTable",
    kind: "tableBlock",
  }),
  { id: "detailTable", kind: "tableBlock" },
);

assert.deepEqual(
  resolveCurrentReportBuilderRuntimeBlock(blocks, {
    preferredId: "missingPreferred",
    kind: "chartBlock",
  }),
  { id: "trendChart", kind: "chartBlock" },
);

assert.equal(
  resolveCurrentReportBuilderRuntimeBlock(blocks, {
    preferredId: "missingPreferred",
    kind: "geoMapBlock",
  }),
  null,
);

console.log("reportBuilderRuntimeSelectionModel ✓ resolves the current runtime table/chart block by explicit id before falling back by kind");

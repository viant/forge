import assert from "node:assert/strict";

import {
  buildReportRuntimeRefinement,
  clearReportRuntimeRefinements,
  removeReportRuntimeRefinement,
  upsertReportRuntimeRefinement,
} from "./reportRuntimeRefinements.js";

const keepDisplay = buildReportRuntimeRefinement({
  op: "keep",
  field: "channelV2",
  value: "Display",
  sourceBlockId: "comparisonTable",
  label: "Keep Channel = Display",
});

assert.deepEqual(keepDisplay, {
  id: "keep:channelV2:comparisonTable",
  op: "keep",
  field: "channelV2",
  values: ["Display"],
  sourceBlockId: "comparisonTable",
  label: "Keep Channel = Display",
});

assert.deepEqual(
  upsertReportRuntimeRefinement([], keepDisplay),
  [keepDisplay],
);

assert.deepEqual(
  upsertReportRuntimeRefinement([keepDisplay], {
    op: "keep",
    field: "channelV2",
    value: "CTV",
    sourceBlockId: "comparisonTable",
    label: "Keep Channel = CTV",
  }),
  [{
    id: "keep:channelV2:comparisonTable",
    op: "keep",
    field: "channelV2",
    values: ["CTV"],
    sourceBlockId: "comparisonTable",
    label: "Keep Channel = CTV",
  }],
);

assert.deepEqual(
  removeReportRuntimeRefinement([keepDisplay], keepDisplay.id),
  [],
);

assert.deepEqual(clearReportRuntimeRefinements(), []);

console.log("reportRuntimeRefinements ✓ builds and updates generic runtime refinement state");

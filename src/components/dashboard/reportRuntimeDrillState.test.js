import assert from "node:assert/strict";

import {
  applyReportRuntimeDrillTransitions,
  clearReportRuntimeDrillTransitions,
  normalizeReportRuntimeDrillTransition,
  removeReportRuntimeDrillTransition,
  upsertReportRuntimeDrillTransition,
} from "./reportRuntimeDrillState.js";

assert.deepEqual(normalizeReportRuntimeDrillTransition({
  refinementId: "drill:channelV2:comparisonTable",
  sourceField: "channelV2",
  nextFieldRef: "country",
  sourceBlockId: "comparisonTable",
}), {
  refinementId: "drill:channelV2:comparisonTable",
  sourceField: "channelV2",
  nextFieldRef: "country",
  sourceBlockId: "comparisonTable",
});

const drilled = upsertReportRuntimeDrillTransition([], {
  refinementId: "drill:channelV2:comparisonTable",
  sourceField: "channelV2",
  nextFieldRef: "country",
  sourceBlockId: "comparisonTable",
});
assert.deepEqual(drilled, [{
  refinementId: "drill:channelV2:comparisonTable",
  sourceField: "channelV2",
  nextFieldRef: "country",
  sourceBlockId: "comparisonTable",
}]);

assert.deepEqual(
  applyReportRuntimeDrillTransitions({
    selectedDimensions: ["eventDate", "channelV2"],
    groupBy: "channelV2",
  }, drilled),
  {
    selectedDimensions: ["eventDate", "country"],
    groupBy: "country",
  },
);

const chained = upsertReportRuntimeDrillTransition(drilled, {
  refinementId: "drill:publisher:comparisonTable",
  sourceField: "country",
  nextFieldRef: "metrocode",
  sourceBlockId: "comparisonTable",
});

assert.deepEqual(
  applyReportRuntimeDrillTransitions({
    selectedDimensions: ["eventDate", "channelV2"],
    groupBy: "channelV2",
  }, chained),
  {
    selectedDimensions: ["eventDate", "metrocode"],
    groupBy: "metrocode",
  },
);

assert.deepEqual(
  removeReportRuntimeDrillTransition(drilled, "drill:channelV2:comparisonTable"),
  [],
);
assert.deepEqual(clearReportRuntimeDrillTransitions(), []);

console.log("reportRuntimeDrillState ✓ stores and applies drill transition state for runtime previews");

import assert from "node:assert/strict";

import {
  buildReportRuntimeRefinementBarClearExecution,
  buildReportRuntimeRefinementBarRedoExecution,
  buildReportRuntimeRefinementBarRemoveExecution,
  buildReportRuntimeRefinementBarUndoExecution,
} from "./reportRuntimeRefinementBarExecutionModel.js";

assert.deepEqual(buildReportRuntimeRefinementBarRemoveExecution({
  blockId: "activeDrillPath",
  refinement: {
    id: "drill:country:reachRateTrend",
    sourceBlockId: "reachRateTrend",
  },
}), {
  id: "removeRefinement:activeDrillPath:drill:country:reachRateTrend",
  label: "Remove refinement",
  kind: "removeRefinement",
  refinementId: "drill:country:reachRateTrend",
  sourceBlockId: "activeDrillPath",
});

assert.deepEqual(buildReportRuntimeRefinementBarRemoveExecution({
  refinement: {
    id: "keep:channelV2:reachRateTable",
    sourceBlockId: "reachRateTable",
  },
}), {
  id: "removeRefinement:reachRateTable:keep:channelV2:reachRateTable",
  label: "Remove refinement",
  kind: "removeRefinement",
  refinementId: "keep:channelV2:reachRateTable",
  sourceBlockId: "reachRateTable",
});

assert.equal(buildReportRuntimeRefinementBarRemoveExecution({
  blockId: "activeDrillPath",
  refinement: {
    sourceBlockId: "reachRateTrend",
  },
}), null);

assert.deepEqual(buildReportRuntimeRefinementBarClearExecution({
  blockId: "activeDrillPath",
}), {
  id: "clearRefinements:activeDrillPath",
  label: "Clear all refinements",
  kind: "clearRefinements",
  sourceBlockId: "activeDrillPath",
});

assert.deepEqual(buildReportRuntimeRefinementBarClearExecution(), {
  id: "clearRefinements:refinementBar",
  label: "Clear all refinements",
  kind: "clearRefinements",
  sourceBlockId: "refinementBar",
});

assert.deepEqual(buildReportRuntimeRefinementBarUndoExecution({
  blockId: "activeDrillPath",
}), {
  id: "undoRefinements:activeDrillPath",
  label: "Undo refinement changes",
  kind: "undoRefinements",
  sourceBlockId: "activeDrillPath",
});

assert.deepEqual(buildReportRuntimeRefinementBarRedoExecution({
  blockId: "activeDrillPath",
}), {
  id: "redoRefinements:activeDrillPath",
  label: "Redo refinement changes",
  kind: "redoRefinements",
  sourceBlockId: "activeDrillPath",
});

console.log("reportRuntimeRefinementBarExecutionModel ✓ builds deterministic remove and clear executions for authored refinement bars");

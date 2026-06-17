import assert from "node:assert/strict";

import { executeReportRuntimeAction } from "./reportRuntimeActionExecutor.js";

const refinementCalls = [];
const drillCalls = [];
const detailCalls = [];
const removeCalls = [];
let clearCalls = 0;
let undoCalls = 0;
let redoCalls = 0;

assert.deepEqual(executeReportRuntimeAction({
  kind: "keep",
  refinement: {
    op: "keep",
    field: "channelV2",
    value: "Display",
    sourceBlockId: "comparisonTable",
    label: "Keep only = Display",
  },
}, {
  applyRefinement(refinement) {
    refinementCalls.push(refinement);
  },
}), {
  executed: true,
  branch: "refinement",
  result: undefined,
});

assert.deepEqual(refinementCalls, [{
  id: "keep:channelV2:comparisonTable",
  op: "keep",
  field: "channelV2",
  values: ["Display"],
  sourceBlockId: "comparisonTable",
  label: "Keep only = Display",
}]);

assert.deepEqual(executeReportRuntimeAction({
  kind: "exclude",
  refinement: {
    op: "exclude",
    field: "channelV2",
    value: "CTV",
    sourceBlockId: "comparisonTable",
    label: "Exclude = CTV",
  },
}, {
  applyRefinement(refinement) {
    refinementCalls.push(refinement);
  },
}), {
  executed: true,
  branch: "refinement",
  result: undefined,
});

assert.deepEqual(refinementCalls[1], {
  id: "exclude:channelV2:comparisonTable",
  op: "exclude",
  field: "channelV2",
  values: ["CTV"],
  sourceBlockId: "comparisonTable",
  label: "Exclude = CTV",
});

assert.deepEqual(executeReportRuntimeAction({
  kind: "drill",
  refinement: {
    op: "drill",
    field: "channelV2",
    value: "Display",
    sourceBlockId: "comparisonTable",
    label: "Drill to Market = Display",
  },
  transition: {
    sourceField: "channelV2",
    nextFieldRef: "country",
    sourceBlockId: "comparisonTable",
  },
}, {
  applyDrillTransition(payload) {
    drillCalls.push(payload);
  },
}), {
  executed: true,
  branch: "drill",
  result: undefined,
});

assert.deepEqual(drillCalls, [{
  refinement: {
    op: "drill",
    field: "channelV2",
    value: "Display",
    sourceBlockId: "comparisonTable",
    label: "Drill to Market = Display",
  },
  sourceField: "channelV2",
  nextFieldRef: "country",
  sourceBlockId: "comparisonTable",
}]);

assert.deepEqual(executeReportRuntimeAction({
  kind: "detail",
  detailRequest: {
    action: {
      id: "detail_channel",
      kind: "detail",
      label: "Show channel details",
      targetRef: "target://steward/performance/channel-detail",
    },
    item: {
      channelV2: "Display",
    },
    value: "Display",
    sourceBlockId: "comparisonTable",
  },
}, {
  openDetailTarget(request) {
    detailCalls.push(request);
  },
}), {
  executed: true,
  branch: "detail",
  result: undefined,
});

assert.deepEqual(detailCalls, [{
  action: {
    id: "detail_channel",
    kind: "detail",
    label: "Show channel details",
    targetRef: "target://steward/performance/channel-detail",
  },
  item: {
    channelV2: "Display",
  },
  value: "Display",
  sourceBlockId: "comparisonTable",
}]);

assert.deepEqual(executeReportRuntimeAction(null, {}), {
  executed: false,
  reason: "invalidExecution",
});

assert.deepEqual(executeReportRuntimeAction([], {}), {
  executed: false,
  reason: "invalidExecution",
});

assert.deepEqual(executeReportRuntimeAction({
  kind: "detail",
  detailRequest: {},
}, {}), {
  executed: false,
  reason: "unsupportedExecution",
});

assert.deepEqual(executeReportRuntimeAction({
  kind: "removeRefinement",
  refinementId: "drill:channelV2:comparisonTable",
}, {
  removeRefinement(refinementId) {
    removeCalls.push(refinementId);
  },
}), {
  executed: true,
  branch: "removeRefinement",
  result: undefined,
});

assert.deepEqual(removeCalls, ["drill:channelV2:comparisonTable"]);

assert.deepEqual(executeReportRuntimeAction({
  kind: "clearRefinements",
}, {
  clearRefinements() {
    clearCalls += 1;
  },
}), {
  executed: true,
  branch: "clearRefinements",
  result: undefined,
});

assert.equal(clearCalls, 1);

assert.deepEqual(executeReportRuntimeAction({
  kind: "undoRefinements",
}, {
  undoRefinements() {
    undoCalls += 1;
  },
}), {
  executed: true,
  branch: "undoRefinements",
  result: undefined,
});

assert.equal(undoCalls, 1);

assert.deepEqual(executeReportRuntimeAction({
  kind: "redoRefinements",
}, {
  redoRefinements() {
    redoCalls += 1;
  },
}), {
  executed: true,
  branch: "redoRefinements",
  result: undefined,
});

assert.equal(redoCalls, 1);

assert.deepEqual(executeReportRuntimeAction({
  kind: "removeRefinement",
  refinementId: "drill:channelV2:comparisonTable",
}, {}), {
  executed: false,
  reason: "unsupportedExecution",
});

assert.deepEqual(executeReportRuntimeAction({
  kind: "removeRefinement",
  refinementId: "   ",
}, {
  removeRefinement() {},
}), {
  executed: false,
  reason: "invalidExecution",
});

assert.deepEqual(executeReportRuntimeAction({
  kind: "removeRefinement",
  refinementId: "   ",
}, {}), {
  executed: false,
  reason: "invalidExecution",
});

assert.deepEqual(executeReportRuntimeAction({
  kind: "clearRefinements",
}, {}), {
  executed: false,
  reason: "unsupportedExecution",
});

assert.deepEqual(executeReportRuntimeAction({
  kind: "undoRefinements",
}, {}), {
  executed: false,
  reason: "unsupportedExecution",
});

assert.deepEqual(executeReportRuntimeAction({
  kind: "redoRefinements",
}, {}), {
  executed: false,
  reason: "unsupportedExecution",
});

console.log("reportRuntimeActionExecutor ✓ dispatches shared runtime action executions through runtime handlers");

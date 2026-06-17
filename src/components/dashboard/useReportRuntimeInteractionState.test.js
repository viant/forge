import assert from "node:assert/strict";

import {
  createReportRuntimeInteractionHistoryState,
  recordReportRuntimeInteractionHistory,
  redoReportRuntimeInteractionHistory,
  resolveReportRuntimeInteractionResetBehavior,
  summarizeReportRuntimeInteractionHistoryState,
  undoReportRuntimeInteractionHistory,
} from "./useReportRuntimeInteractionState.js";

assert.deepEqual(resolveReportRuntimeInteractionResetBehavior({
  hasSeenInitialReset: false,
  previousResetKey: undefined,
  nextResetKey: undefined,
  pendingSeededState: false,
}), {
  shouldReset: false,
  nextHasSeenInitialReset: false,
  nextPreviousResetKey: undefined,
  nextPendingSeededState: false,
  reason: "missingResetKey",
});

assert.deepEqual(resolveReportRuntimeInteractionResetBehavior({
  hasSeenInitialReset: false,
  previousResetKey: undefined,
  nextResetKey: "request::1",
  pendingSeededState: false,
}), {
  shouldReset: false,
  nextHasSeenInitialReset: true,
  nextPreviousResetKey: "request::1",
  nextPendingSeededState: false,
  reason: "initialMount",
});

assert.deepEqual(resolveReportRuntimeInteractionResetBehavior({
  hasSeenInitialReset: true,
  previousResetKey: "request::1",
  nextResetKey: "request::1",
  pendingSeededState: true,
}), {
  shouldReset: false,
  nextHasSeenInitialReset: true,
  nextPreviousResetKey: "request::1",
  nextPendingSeededState: false,
  reason: "seededState",
});

assert.deepEqual(resolveReportRuntimeInteractionResetBehavior({
  hasSeenInitialReset: true,
  previousResetKey: "request::1",
  nextResetKey: "request::2",
  pendingSeededState: true,
}), {
  shouldReset: true,
  nextHasSeenInitialReset: true,
  nextPreviousResetKey: "request::2",
  nextPendingSeededState: false,
  reason: "resetChanged",
});

assert.deepEqual(resolveReportRuntimeInteractionResetBehavior({
  hasSeenInitialReset: true,
  previousResetKey: "request::1",
  nextResetKey: "request::2",
  pendingSeededState: false,
}), {
  shouldReset: true,
  nextHasSeenInitialReset: true,
  nextPreviousResetKey: "request::2",
  nextPendingSeededState: false,
  reason: "resetChanged",
});

assert.deepEqual(resolveReportRuntimeInteractionResetBehavior({
  hasSeenInitialReset: true,
  previousResetKey: "request::2",
  nextResetKey: "request::2",
  pendingSeededState: false,
}), {
  shouldReset: false,
  nextHasSeenInitialReset: true,
  nextPreviousResetKey: "request::2",
  nextPendingSeededState: false,
  reason: "unchangedResetKey",
});

assert.deepEqual(createReportRuntimeInteractionHistoryState(), {
  past: [],
  future: [],
});

assert.deepEqual(summarizeReportRuntimeInteractionHistoryState({
  past: [],
  future: [],
}), {
  canUndo: false,
  canRedo: false,
});

const keepOnlyState = {
  refinements: [
    {
      id: "keep:country:primaryChart",
      op: "keep",
      field: "country",
      values: ["US"],
      sourceBlockId: "primaryChart",
      label: "Keep only = US",
    },
  ],
  drillTransitions: [],
  hostIntent: {
    intentKind: "detailTarget",
    targetRef: "target://steward/performance/market-detail",
    navigationMode: "hostRoute",
    parameters: {
      country: "US",
    },
  },
  detailDiagnostic: {
    code: "detailTargetPartial",
    severity: "warning",
    message: "Missing parameter campaign.",
  },
};

const drillAndKeepState = {
  refinements: [
    {
      id: "keep:country:primaryChart",
      op: "keep",
      field: "country",
      values: ["US"],
      sourceBlockId: "primaryChart",
      label: "Keep only = US",
    },
    {
      id: "drill:region:primaryTable",
      op: "drill",
      field: "region",
      values: ["US/West"],
      sourceBlockId: "primaryTable",
      label: "Drill to Metro = West",
    },
  ],
  drillTransitions: [
    {
      refinementId: "drill:region:primaryTable",
      sourceField: "region",
      nextFieldRef: "metrocode",
      sourceBlockId: "primaryTable",
    },
  ],
  hostIntent: null,
  detailDiagnostic: null,
};

const recordedHistory = recordReportRuntimeInteractionHistory(
  createReportRuntimeInteractionHistoryState(),
  keepOnlyState,
  drillAndKeepState,
);
assert.equal(recordedHistory.changed, true);
assert.deepEqual(recordedHistory.historyState, {
  past: [
    {
      refinements: keepOnlyState.refinements,
      drillTransitions: [],
    },
  ],
  future: [],
});
assert.deepEqual(summarizeReportRuntimeInteractionHistoryState(recordedHistory.historyState), {
  canUndo: true,
  canRedo: false,
});

const unchangedHistory = recordReportRuntimeInteractionHistory(
  createReportRuntimeInteractionHistoryState(),
  keepOnlyState,
  {
    ...keepOnlyState,
    hostIntent: null,
    detailDiagnostic: null,
  },
);
assert.equal(unchangedHistory.changed, false);
assert.deepEqual(unchangedHistory.historyState, {
  past: [],
  future: [],
});

const undoneHistory = undoReportRuntimeInteractionHistory(
  recordedHistory.historyState,
  drillAndKeepState,
);
assert.equal(undoneHistory.changed, true);
assert.deepEqual(undoneHistory.historyState, {
  past: [],
  future: [
    {
      refinements: drillAndKeepState.refinements,
      drillTransitions: drillAndKeepState.drillTransitions,
    },
  ],
});
assert.deepEqual(undoneHistory.nextState, {
  refinements: keepOnlyState.refinements,
  drillTransitions: [],
  hostIntent: null,
  detailDiagnostic: null,
});

const redoneHistory = redoReportRuntimeInteractionHistory(
  undoneHistory.historyState,
  undoneHistory.nextState,
);
assert.equal(redoneHistory.changed, true);
assert.deepEqual(redoneHistory.historyState, {
  past: [
    {
      refinements: keepOnlyState.refinements,
      drillTransitions: [],
    },
  ],
  future: [],
});
assert.deepEqual(redoneHistory.nextState, {
  refinements: drillAndKeepState.refinements,
  drillTransitions: drillAndKeepState.drillTransitions,
  hostIntent: null,
  detailDiagnostic: null,
});

console.log("useReportRuntimeInteractionState ✓ resolves seeded reset behavior deterministically");

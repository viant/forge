import assert from "node:assert/strict";

import {
  applyReportRuntimeInteractionDrillTransition,
  applyReportRuntimeInteractionRefinement,
  clearReportRuntimeInteractionDetailDiagnostic,
  clearReportRuntimeInteractionDetailState,
  clearReportRuntimeInteractionHostIntent,
  clearReportRuntimeInteractionRefinements,
  clearReportRuntimeInteractionState,
  createReportRuntimeInteractionState,
  normalizeReportRuntimeInteractionState,
  replaceReportRuntimeInteractionState,
  reduceReportRuntimeInteractionState,
  removeReportRuntimeInteractionRefinement,
  setReportRuntimeInteractionDetailDiagnostic,
  setReportRuntimeInteractionHostIntent,
} from "./reportRuntimeInteractionStateModel.js";

const initial = createReportRuntimeInteractionState();
assert.deepEqual(initial, {
  refinements: [],
  drillTransitions: [],
  hostIntent: null,
  detailDiagnostic: null,
});

const keepState = applyReportRuntimeInteractionRefinement(initial, {
  op: "keep",
  field: "channelV2",
  value: "Display",
  sourceBlockId: "primaryChart",
  label: "Keep only = Display",
});
assert.deepEqual(keepState, {
  refinements: [
    {
      id: "keep:channelV2:primaryChart",
      op: "keep",
      field: "channelV2",
      values: ["Display"],
      sourceBlockId: "primaryChart",
      label: "Keep only = Display",
    },
  ],
  drillTransitions: [],
  hostIntent: null,
  detailDiagnostic: null,
});

const drilledState = applyReportRuntimeInteractionDrillTransition(initial, {
  refinement: {
    op: "drill",
    field: "channelV2",
    value: "Display",
    sourceBlockId: "primaryChart",
    label: "Drill to Market = Display",
  },
  sourceField: "channelV2",
  nextFieldRef: "country",
  sourceBlockId: "primaryChart",
});
assert.deepEqual(drilledState, {
  refinements: [
    {
      id: "drill:channelV2:primaryChart",
      op: "drill",
      field: "channelV2",
      values: ["Display"],
      sourceBlockId: "primaryChart",
      label: "Drill to Market = Display",
    },
  ],
  drillTransitions: [
    {
      refinementId: "drill:channelV2:primaryChart",
      sourceField: "channelV2",
      nextFieldRef: "country",
      sourceBlockId: "primaryChart",
    },
  ],
  hostIntent: null,
  detailDiagnostic: null,
});

assert.deepEqual(removeReportRuntimeInteractionRefinement(drilledState, "drill:channelV2:primaryChart"), {
  refinements: [],
  drillTransitions: [],
  hostIntent: null,
  detailDiagnostic: null,
});

const withHostIntent = setReportRuntimeInteractionHostIntent(initial, {
  intentKind: "detailTarget",
  targetRef: "target://example/performance/channel-detail",
  navigationMode: "hostRoute",
  parameters: {
    channel: "Display",
  },
});
assert.deepEqual(withHostIntent, {
  refinements: [],
  drillTransitions: [],
  hostIntent: {
    intentKind: "detailTarget",
    targetRef: "target://example/performance/channel-detail",
    navigationMode: "hostRoute",
    parameters: {
      channel: "Display",
    },
  },
  detailDiagnostic: null,
});

assert.deepEqual(clearReportRuntimeInteractionHostIntent(withHostIntent), {
  refinements: [],
  drillTransitions: [],
  hostIntent: null,
  detailDiagnostic: null,
});

assert.deepEqual(setReportRuntimeInteractionDetailDiagnostic(initial, {
  code: "detailTargetPartial",
  severity: "warning",
  message: "Detail target resolved with omitted parameters: campaign.",
}), {
  refinements: [],
  drillTransitions: [],
  hostIntent: null,
  detailDiagnostic: {
    code: "detailTargetPartial",
    severity: "warning",
    message: "Detail target resolved with omitted parameters: campaign.",
  },
});

assert.deepEqual(clearReportRuntimeInteractionDetailDiagnostic({
  refinements: keepState.refinements,
  drillTransitions: [],
  hostIntent: withHostIntent.hostIntent,
  detailDiagnostic: {
    code: "detailTargetPartial",
    severity: "warning",
    message: "Detail target resolved with omitted parameters: campaign.",
  },
}), {
  refinements: keepState.refinements,
  drillTransitions: [],
  hostIntent: withHostIntent.hostIntent,
  detailDiagnostic: null,
});

assert.deepEqual(clearReportRuntimeInteractionDetailState({
  refinements: keepState.refinements,
  drillTransitions: drilledState.drillTransitions,
  hostIntent: withHostIntent.hostIntent,
  detailDiagnostic: {
    code: "detailTargetPartial",
    severity: "warning",
    message: "Detail target resolved with omitted parameters: campaign.",
  },
}), {
  refinements: keepState.refinements,
  drillTransitions: drilledState.drillTransitions,
  hostIntent: null,
  detailDiagnostic: null,
});

assert.deepEqual(clearReportRuntimeInteractionRefinements({
  refinements: keepState.refinements,
  drillTransitions: drilledState.drillTransitions,
  hostIntent: withHostIntent.hostIntent,
  detailDiagnostic: {
    code: "detailTargetPartial",
    severity: "warning",
    message: "Detail target resolved with omitted parameters: campaign.",
  },
}), {
  refinements: [],
  drillTransitions: [],
  hostIntent: withHostIntent.hostIntent,
  detailDiagnostic: {
    code: "detailTargetPartial",
    severity: "warning",
    message: "Detail target resolved with omitted parameters: campaign.",
  },
});

assert.deepEqual(reduceReportRuntimeInteractionState(initial, {
  type: "applyRefinement",
  refinement: {
    op: "exclude",
    field: "channelV2",
    value: "CTV",
    sourceBlockId: "primaryChart",
    label: "Exclude = CTV",
  },
}), {
  refinements: [
    {
      id: "exclude:channelV2:primaryChart",
      op: "exclude",
      field: "channelV2",
      values: ["CTV"],
      sourceBlockId: "primaryChart",
      label: "Exclude = CTV",
    },
  ],
  drillTransitions: [],
  hostIntent: null,
  detailDiagnostic: null,
});

assert.deepEqual(clearReportRuntimeInteractionState(), initial);

assert.deepEqual(reduceReportRuntimeInteractionState({
  refinements: keepState.refinements,
  drillTransitions: drilledState.drillTransitions,
  hostIntent: withHostIntent.hostIntent,
  detailDiagnostic: {
    code: "detailTargetPartial",
    severity: "warning",
    message: "Detail target resolved with omitted parameters: campaign.",
  },
}, {
  type: "clearDetailState",
}), {
  refinements: keepState.refinements,
  drillTransitions: drilledState.drillTransitions,
  hostIntent: null,
  detailDiagnostic: null,
});

assert.deepEqual(reduceReportRuntimeInteractionState({
  refinements: keepState.refinements,
  drillTransitions: drilledState.drillTransitions,
  hostIntent: withHostIntent.hostIntent,
  detailDiagnostic: {
    code: "detailTargetPartial",
    severity: "warning",
    message: "Detail target resolved with omitted parameters: campaign.",
  },
}, {
  type: "clearRefinements",
}), {
  refinements: [],
  drillTransitions: [],
  hostIntent: withHostIntent.hostIntent,
  detailDiagnostic: {
    code: "detailTargetPartial",
    severity: "warning",
    message: "Detail target resolved with omitted parameters: campaign.",
  },
});

assert.deepEqual(normalizeReportRuntimeInteractionState({
  refinements: [
    {
      op: "keep",
      field: "channelV2",
      values: ["Display"],
      sourceBlockId: "primaryChart",
      label: "Keep only = Display",
    },
  ],
  drillTransitions: [
    {
      refinementId: "keep:channelV2:primaryChart",
      sourceField: "channelV2",
      nextFieldRef: "country",
      sourceBlockId: "primaryChart",
    },
  ],
  hostIntent: {
    intentKind: "detailTarget",
    targetRef: "target://example/performance/channel-detail",
    navigationMode: "hostRoute",
    parameters: {
      channel: "Display",
    },
  },
  detailDiagnostic: {
    code: "detailTargetPartial",
    severity: "warning",
    message: "Detail target resolved with omitted parameters: campaign.",
  },
}), {
  refinements: [
    {
      id: "keep:channelV2:primaryChart",
      op: "keep",
      field: "channelV2",
      values: ["Display"],
      sourceBlockId: "primaryChart",
      label: "Keep only = Display",
    },
  ],
  drillTransitions: [
    {
      refinementId: "keep:channelV2:primaryChart",
      sourceField: "channelV2",
      nextFieldRef: "country",
      sourceBlockId: "primaryChart",
    },
  ],
  hostIntent: {
    intentKind: "detailTarget",
    targetRef: "target://example/performance/channel-detail",
    navigationMode: "hostRoute",
    parameters: {
      channel: "Display",
    },
  },
  detailDiagnostic: {
    code: "detailTargetPartial",
    severity: "warning",
    message: "Detail target resolved with omitted parameters: campaign.",
  },
});

assert.equal(normalizeReportRuntimeInteractionState({
  refinements: [],
  drillTransitions: [],
  hostIntent: null,
  detailDiagnostic: null,
}, {
  allowEmpty: false,
}), null);

assert.deepEqual(replaceReportRuntimeInteractionState(null), initial);

console.log("reportRuntimeInteractionStateModel ✓ reduces authored runtime interaction state deterministically");

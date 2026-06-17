import assert from "node:assert/strict";

import {
  buildReportRuntimeHandlers,
  createReportRuntimeDetailTargetOpener,
  resetReportRuntimeDetailState,
  resolveReportRuntimePreviewDetailProvider,
} from "./reportRuntimePreviewHandlers.js";

const semanticModelHandler = {
  async getDrillHierarchy() {
    return {
      drillHierarchy: {
        fieldRef: "channelV2",
        levels: [
          { id: "channel", field: "channelV2", label: "Channel" },
          { id: "country", field: "country", label: "Market" },
        ],
      },
    };
  },
  async getDetailTarget(targetRef = "") {
    if (targetRef !== "target://steward/performance/channel-detail") {
      return null;
    }
    return {
      detailTarget: {
        targetRef: "target://steward/performance/channel-detail",
        navigationMode: "hostRoute",
        parameters: {
          channel: "$value",
          scope: "$row.scopeFilter",
        },
      },
    };
  },
  async listAvailableRefinements() {
    return {
      actions: [
        { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://steward/performance/channel-detail" },
      ],
    };
  },
};

const fallbackOnlyProvider = resolveReportRuntimePreviewDetailProvider({
  semanticModelHandler: null,
  reportSpec: {
    kind: "reportSpec",
    drillMetadata: {
      detailTargets: [
        {
          targetRef: "target://steward/performance/channel-detail",
          navigationMode: "modal",
          parameters: {
            channel: "$value",
          },
        },
        {
          targetRef: "target://steward/performance/fallback-channel-detail",
          navigationMode: "modal",
          parameters: {
            channel: "$value",
          },
        },
      ],
    },
  },
});
assert.equal(typeof fallbackOnlyProvider?.getDetailTarget, "function");
assert.deepEqual(
  await fallbackOnlyProvider.getDetailTarget("target://steward/performance/channel-detail"),
  {
    targetRef: "target://steward/performance/channel-detail",
    navigationMode: "modal",
    parameters: {
      channel: "$value",
    },
  },
);

const provider = resolveReportRuntimePreviewDetailProvider({
  semanticModelHandler,
  reportSpec: {
    kind: "reportSpec",
    drillMetadata: {
      detailTargets: [
        {
          targetRef: "target://steward/performance/channel-detail",
          navigationMode: "modal",
          parameters: {
            channel: "$value",
          },
        },
        {
          targetRef: "target://steward/performance/fallback-channel-detail",
          navigationMode: "modal",
          parameters: {
            channel: "$value",
          },
        },
      ],
    },
  },
});
assert.equal(typeof provider?.getDetailTarget, "function");
assert.deepEqual(
  await provider.getDetailTarget("target://steward/performance/channel-detail"),
  {
    targetRef: "target://steward/performance/channel-detail",
    navigationMode: "hostRoute",
    parameters: {
      channel: "$value",
      scope: "$row.scopeFilter",
    },
  },
);
assert.deepEqual(
  await provider.getDetailTarget("target://steward/performance/fallback-channel-detail"),
  {
    targetRef: "target://steward/performance/fallback-channel-detail",
    navigationMode: "modal",
    parameters: {
      channel: "$value",
    },
  },
);
assert.deepEqual(
  await provider.listAvailableRefinements("chartBlock", "channelV2"),
  [
    {
      id: "detail_channel",
      label: "Show channel details",
      kind: "detail",
      targetRef: "target://steward/performance/channel-detail",
    },
    {
      id: "keep:channelV2",
      label: "Keep only",
      kind: "keep",
    },
    {
      id: "exclude:channelV2",
      label: "Exclude",
      kind: "exclude",
    },
  ],
);
assert.equal(resolveReportRuntimePreviewDetailProvider({
  semanticModelHandler: null,
  reportSpec: {},
}), null);

let resetHostIntent = "sentinel";
let resetDetailDiagnostic = "sentinel";
resetReportRuntimeDetailState({
  setHostIntent(next) {
    resetHostIntent = next;
  },
  setDetailDiagnostic(next) {
    resetDetailDiagnostic = next;
  },
});
assert.equal(resetHostIntent, null);
assert.equal(resetDetailDiagnostic, null);

let hostIntent = null;
let detailDiagnostic = undefined;
const openDetailTarget = createReportRuntimeDetailTargetOpener({
  drillMetadataProvider: provider,
  setHostIntent(next) {
    hostIntent = next;
  },
  setDetailDiagnostic(next) {
    detailDiagnostic = next;
  },
});

const resolved = await openDetailTarget({
  action: {
    id: "detail_channel",
    kind: "detail",
    label: "Show channel details",
    targetRef: "target://steward/performance/channel-detail",
  },
  item: {
    selectionRows: [
      { scopeFilter: "national" },
      { scopeFilter: "national" },
    ],
  },
  value: "Display",
});

assert.deepEqual(resolved, {
  targetRef: "target://steward/performance/channel-detail",
  navigationMode: "hostRoute",
  parameters: {
    channel: "Display",
    scope: "national",
  },
  unresolvedParameters: [],
});

assert.deepEqual(hostIntent, {
  intentKind: "detailTarget",
  title: "Resolved detail target",
  description: "Ready for host routing from the authored runtime preview.",
  targetRef: "target://steward/performance/channel-detail",
  navigationMode: "hostRoute",
  parameters: {
    channel: "Display",
    scope: "national",
  },
});
assert.equal(detailDiagnostic, null);

let missingHostIntent = "sentinel";
let missingDetailDiagnostic = undefined;
const openMissingDetailTarget = createReportRuntimeDetailTargetOpener({
  drillMetadataProvider: {
    async getDetailTarget() {
      return null;
    },
  },
  setHostIntent(next) {
    missingHostIntent = next;
  },
  setDetailDiagnostic(next) {
    missingDetailDiagnostic = next;
  },
});

const missingResolved = await openMissingDetailTarget({
  action: {
    id: "detail_missing",
    kind: "detail",
    label: "Show missing details",
    targetRef: "target://steward/performance/missing-channel-detail",
  },
  item: {},
  value: "Display",
});

assert.equal(missingResolved, null);
assert.equal(missingHostIntent, null);
assert.deepEqual(missingDetailDiagnostic, {
  code: "detailTargetError",
  severity: "warning",
  message: "No detail target resolved for target://steward/performance/missing-channel-detail.",
});

let failedHostIntent = "sentinel";
let failedDetailDiagnostic = undefined;
const openFailedDetailTarget = createReportRuntimeDetailTargetOpener({
  drillMetadataProvider: {
    async getDetailTarget() {
      throw new Error("Detail target resolution failed.");
    },
  },
  setHostIntent(next) {
    failedHostIntent = next;
  },
  setDetailDiagnostic(next) {
    failedDetailDiagnostic = next;
  },
});

const failedResolved = await openFailedDetailTarget({
  action: {
    id: "detail_failed",
    kind: "detail",
    label: "Show failed details",
    targetRef: "target://steward/performance/failed-channel-detail",
  },
  item: {},
  value: "Display",
});

assert.equal(failedResolved, null);
assert.equal(failedHostIntent, null);
assert.deepEqual(failedDetailDiagnostic, {
  code: "detailTargetError",
  severity: "warning",
  message: "Failed to resolve detail target target://steward/performance/failed-channel-detail. Detail target resolution failed.",
});

let recoveryHostIntent = "sentinel";
let recoveryDetailDiagnostic = undefined;
let recoveryCallCount = 0;
const openRecoveredDetailTarget = createReportRuntimeDetailTargetOpener({
  drillMetadataProvider: {
    async getDetailTarget() {
      recoveryCallCount += 1;
      if (recoveryCallCount === 1) {
        throw new Error("Detail target resolution failed.");
      }
      return {
        targetRef: "target://steward/performance/channel-detail",
        navigationMode: "hostRoute",
        parameters: {
          channel: "$value",
          scope: "$row.scopeFilter",
        },
      };
    },
  },
  setHostIntent(next) {
    recoveryHostIntent = next;
  },
  setDetailDiagnostic(next) {
    recoveryDetailDiagnostic = next;
  },
});

const recoveredAfterError = await openRecoveredDetailTarget({
  action: {
    id: "detail_recovered",
    kind: "detail",
    label: "Show recovered details",
    targetRef: "target://steward/performance/channel-detail",
  },
  item: {
    scopeFilter: "regional",
  },
  value: "Display",
});

assert.equal(recoveredAfterError, null);
assert.equal(recoveryHostIntent, null);
assert.deepEqual(recoveryDetailDiagnostic, {
  code: "detailTargetError",
  severity: "warning",
  message: "Failed to resolve detail target target://steward/performance/channel-detail. Detail target resolution failed.",
});

const recoveredSuccess = await openRecoveredDetailTarget({
  action: {
    id: "detail_recovered",
    kind: "detail",
    label: "Show recovered details",
    targetRef: "target://steward/performance/channel-detail",
  },
  item: {
    scopeFilter: "regional",
    selectionRows: [{ scopeFilter: "regional" }],
  },
  value: "CTV",
});

assert.deepEqual(recoveredSuccess, {
  targetRef: "target://steward/performance/channel-detail",
  navigationMode: "hostRoute",
  parameters: {
    channel: "CTV",
    scope: "regional",
  },
  unresolvedParameters: [],
});
assert.deepEqual(recoveryHostIntent, {
  intentKind: "detailTarget",
  title: "Resolved detail target",
  description: "Ready for host routing from the authored runtime preview.",
  targetRef: "target://steward/performance/channel-detail",
  navigationMode: "hostRoute",
  parameters: {
    channel: "CTV",
    scope: "regional",
  },
});
assert.equal(recoveryDetailDiagnostic, null);

let failedAfterSuccessHostIntent = "sentinel";
let failedAfterSuccessDetailDiagnostic = undefined;
let failedAfterSuccessCallCount = 0;
const openFailedAfterSuccessDetailTarget = createReportRuntimeDetailTargetOpener({
  drillMetadataProvider: {
    async getDetailTarget() {
      failedAfterSuccessCallCount += 1;
      if (failedAfterSuccessCallCount === 1) {
        return {
          targetRef: "target://steward/performance/channel-detail",
          navigationMode: "hostRoute",
          parameters: {
            channel: "$value",
          },
        };
      }
      throw new Error("Detail target resolution failed.");
    },
  },
  setHostIntent(next) {
    failedAfterSuccessHostIntent = next;
  },
  setDetailDiagnostic(next) {
    failedAfterSuccessDetailDiagnostic = next;
  },
});

const successBeforeFailure = await openFailedAfterSuccessDetailTarget({
  action: {
    id: "detail_flip",
    kind: "detail",
    label: "Show flapping details",
    targetRef: "target://steward/performance/channel-detail",
  },
  item: {},
  value: "Display",
});

assert.deepEqual(successBeforeFailure, {
  targetRef: "target://steward/performance/channel-detail",
  navigationMode: "hostRoute",
  parameters: {
    channel: "Display",
  },
  unresolvedParameters: [],
});
assert.deepEqual(failedAfterSuccessHostIntent, {
  intentKind: "detailTarget",
  title: "Resolved detail target",
  description: "Ready for host routing from the authored runtime preview.",
  targetRef: "target://steward/performance/channel-detail",
  navigationMode: "hostRoute",
  parameters: {
    channel: "Display",
  },
});
assert.equal(failedAfterSuccessDetailDiagnostic, null);

const failedAfterSuccess = await openFailedAfterSuccessDetailTarget({
  action: {
    id: "detail_flip",
    kind: "detail",
    label: "Show flapping details",
    targetRef: "target://steward/performance/channel-detail",
  },
  item: {},
  value: "CTV",
});

assert.equal(failedAfterSuccess, null);
assert.equal(failedAfterSuccessHostIntent, null);
assert.deepEqual(failedAfterSuccessDetailDiagnostic, {
  code: "detailTargetError",
  severity: "warning",
  message: "Failed to resolve detail target target://steward/performance/channel-detail. Detail target resolution failed.",
});

const handlers = buildReportRuntimeHandlers({
  applyRefinement() {},
  applyDrillTransition() {},
  removeRefinement() {},
  clearRefinements() {},
  undoRefinements() {},
  redoRefinements() {},
  canUndoRefinements: true,
  canRedoRefinements: false,
  clearHostIntent() {},
  clearDetailDiagnostic() {},
  clearDetailState() {},
  openDetailTarget() {},
  drillMetadataProvider: provider,
});
assert.deepEqual(Object.keys(handlers).sort(), [
  "applyDrillTransition",
  "applyRefinement",
  "canRedoRefinements",
  "canUndoRefinements",
  "clearDetailDiagnostic",
  "clearDetailState",
  "clearHostIntent",
  "clearRefinements",
  "drillMetadataProvider",
  "openDetailTarget",
  "redoRefinements",
  "removeRefinement",
  "undoRefinements",
]);
assert.equal(typeof handlers.openDetailTarget, "function");
assert.equal(handlers.drillMetadataProvider, provider);
assert.equal(handlers.canUndoRefinements, true);
assert.equal(handlers.canRedoRefinements, false);

console.log("reportRuntimePreviewHandlers ✓ shares detail-target provider and runtime handler wiring across authored preview surfaces");

import assert from "node:assert/strict";

import {
  buildReportRuntimeHandlers,
  createReportRuntimeDetailTargetOpener,
  resetReportRuntimeDetailState,
  resolveReportRuntimePreviewDetailProvider,
} from "./reportRuntimePreviewHandlers.js";
import { buildReportRuntimeTableActionExecutions } from "./reportRuntimeTableExecutionModel.js";
import { buildReportRuntimeChartActionExecutions } from "./reportRuntimeChartExecutionModel.js";

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
    if (targetRef !== "target://example/performance/channel-detail") {
      return null;
    }
    return {
      detailTarget: {
        targetRef: "target://example/performance/channel-detail",
        navigationMode: "hostRoute",
        title: "Channel detail",
        description: "Open the selected channel detail route.",
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
        { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://example/performance/channel-detail" },
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
          targetRef: "target://example/performance/channel-detail",
          navigationMode: "modal",
          parameters: {
            channel: "$value",
          },
        },
        {
          targetRef: "target://example/performance/fallback-channel-detail",
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
  await fallbackOnlyProvider.getDetailTarget("target://example/performance/channel-detail"),
  {
    targetRef: "target://example/performance/channel-detail",
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
          targetRef: "target://example/performance/channel-detail",
          navigationMode: "modal",
          parameters: {
            channel: "$value",
          },
        },
        {
          targetRef: "target://example/performance/fallback-channel-detail",
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
  await provider.getDetailTarget("target://example/performance/channel-detail"),
  {
    targetRef: "target://example/performance/channel-detail",
    navigationMode: "hostRoute",
    title: "Channel detail",
    description: "Open the selected channel detail route.",
    parameters: {
      channel: "$value",
      scope: "$row.scopeFilter",
    },
  },
);
assert.deepEqual(
  await provider.getDetailTarget("target://example/performance/fallback-channel-detail"),
  {
    targetRef: "target://example/performance/fallback-channel-detail",
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
      targetRef: "target://example/performance/channel-detail",
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

const partialSemanticProvider = resolveReportRuntimePreviewDetailProvider({
  semanticModelHandler: {
    async getDetailTarget(targetRef = "") {
      if (targetRef !== "target://example/performance/fallback-channel-detail") {
        return null;
      }
      return {
        detailTarget: {
          targetRef,
          navigationMode: "hostRoute",
          parameters: {
            channel: "$value",
          },
        },
      };
    },
  },
  reportSpec: {
    kind: "reportSpec",
    drillMetadata: {
      hierarchies: [
        {
          id: "inventory",
          levels: [
            { field: "channelV2", label: "Channel" },
            { field: "country", label: "Market" },
          ],
        },
      ],
      detailTargets: [
        {
          targetRef: "target://example/performance/fallback-channel-detail",
          navigationMode: "modal",
          title: "Fallback channel detail",
          description: "Fallback metadata for the channel detail route.",
          parameters: {
            scope: "$row.scopeFilter",
          },
        },
      ],
      fieldActions: [
        {
          fieldRef: "channelV2",
          actions: [
            { id: "keep:channelV2", label: "Keep only", kind: "keep" },
          ],
        },
      ],
    },
  },
});

assert.equal(typeof partialSemanticProvider?.getDrillHierarchy, "function");
assert.equal(typeof partialSemanticProvider?.getDetailTarget, "function");
assert.equal(typeof partialSemanticProvider?.listAvailableRefinements, "function");
assert.deepEqual(
  await partialSemanticProvider.getDrillHierarchy("channelV2"),
  {
    fieldRef: "channelV2",
    levels: [
      { id: "channelV2", field: "channelV2", label: "Channel" },
      { id: "country", field: "country", label: "Market" },
    ],
  },
);
assert.deepEqual(
  await partialSemanticProvider.getDetailTarget("target://example/performance/fallback-channel-detail"),
  {
    targetRef: "target://example/performance/fallback-channel-detail",
    navigationMode: "hostRoute",
    title: "Fallback channel detail",
    description: "Fallback metadata for the channel detail route.",
    parameters: {
      scope: "$row.scopeFilter",
      channel: "$value",
    },
  },
);
assert.deepEqual(
  await partialSemanticProvider.listAvailableRefinements("chartBlock", "channelV2"),
  [
    { id: "keep:channelV2", label: "Keep only", kind: "keep" },
    { id: "exclude:channelV2", label: "Exclude", kind: "exclude" },
    { id: "drill:channelV2:country", label: "Drill to Market", kind: "drill", nextFieldRef: "country" },
  ],
);

let parityHostIntent = null;
let parityDetailDiagnostic = undefined;
const openParityDetailTarget = createReportRuntimeDetailTargetOpener({
  drillMetadataProvider: {
    async getDetailTarget(targetRef = "") {
      if (targetRef !== "target://example/performance/date-detail") {
        return null;
      }
      return {
        targetRef,
        navigationMode: "hostRoute",
        parameters: {
          eventDate: "$value",
          country: "$row.country",
        },
      };
    },
  },
  setHostIntent(next) {
    parityHostIntent = next;
  },
  setDetailDiagnostic(next) {
    parityDetailDiagnostic = next;
  },
});

const tableDetailExecution = buildReportRuntimeTableActionExecutions({
  blockId: "comparisonTable",
  descriptors: [
    {
      id: "detail_date",
      kind: "detail",
      fieldValueKey: "eventDate",
      label: "Show date details",
      targetRef: "target://example/performance/date-detail",
    },
  ],
  field: {
    valueKey: "eventDate",
    displayValueKey: "eventDate",
    label: "Date",
  },
  item: {
    eventDate: "2026-05-01",
    country: "US",
    channelV2: "Display",
  },
})[0];

const chartDetailExecution = buildReportRuntimeChartActionExecutions({
  blockId: "primaryChart",
  descriptors: [
    {
      id: "detail_date",
      kind: "detail",
      fieldValueKey: "eventDate",
      label: "Show date details",
      value: "2026-05-01",
      displayValue: "2026-05-01",
      targetRef: "target://example/performance/date-detail",
    },
  ],
  fields: [
    { valueKey: "eventDate", displayValueKey: "eventDate", label: "Date", selectionSource: "xValue" },
  ],
  selection: {
    xValue: "2026-05-01",
    row: {
      eventDate: "2026-05-01",
      avails: 40000,
    },
    selectionRows: [
      { country: "US" },
      { country: "US" },
    ],
  },
})[0];

const resolvedTableParity = await openParityDetailTarget(tableDetailExecution.detailRequest);
assert.deepEqual(resolvedTableParity, {
  targetRef: "target://example/performance/date-detail",
  navigationMode: "hostRoute",
  parameters: {
    eventDate: "2026-05-01",
    country: "US",
  },
  unresolvedParameters: [],
});
assert.deepEqual(parityHostIntent, {
  intentKind: "detailTarget",
  title: "Resolved detail target",
  description: "Ready for host routing from the authored runtime preview.",
  targetRef: "target://example/performance/date-detail",
  navigationMode: "hostRoute",
  parameters: {
    eventDate: "2026-05-01",
    country: "US",
  },
});
assert.equal(parityDetailDiagnostic, null);

parityHostIntent = null;
parityDetailDiagnostic = undefined;
const resolvedChartParity = await openParityDetailTarget(chartDetailExecution.detailRequest);
assert.deepEqual(resolvedChartParity, resolvedTableParity);
assert.deepEqual(parityHostIntent, {
  intentKind: "detailTarget",
  title: "Resolved detail target",
  description: "Ready for host routing from the authored runtime preview.",
  targetRef: "target://example/performance/date-detail",
  navigationMode: "hostRoute",
  parameters: {
    eventDate: "2026-05-01",
    country: "US",
  },
});
assert.equal(parityDetailDiagnostic, null);

assert.equal(resolveReportRuntimePreviewDetailProvider({
  semanticModelHandler: {
    async getDetailTarget() {
      return null;
    },
  },
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
    targetRef: "target://example/performance/channel-detail",
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
  targetRef: "target://example/performance/channel-detail",
  navigationMode: "hostRoute",
  title: "Channel detail",
  description: "Open the selected channel detail route.",
  parameters: {
    channel: "Display",
    scope: "national",
  },
  unresolvedParameters: [],
});

assert.deepEqual(hostIntent, {
  intentKind: "detailTarget",
  title: "Channel detail",
  description: "Open the selected channel detail route.",
  targetRef: "target://example/performance/channel-detail",
  navigationMode: "hostRoute",
  parameters: {
    channel: "Display",
    scope: "national",
  },
});
assert.equal(detailDiagnostic, null);

const mergedProvider = resolveReportRuntimePreviewDetailProvider({
  semanticModelHandler: {
    async getDrillHierarchy() {
      return null;
    },
    async getDetailTarget(targetRef = "") {
      if (targetRef !== "target://example/performance/fallback-channel-detail") {
        return null;
      }
      return {
        detailTarget: {
          targetRef,
          navigationMode: "hostRoute",
          parameters: {
            channel: "$value",
          },
        },
      };
    },
    async listAvailableRefinements() {
      return { actions: [] };
    },
  },
  reportSpec: {
    kind: "reportSpec",
    drillMetadata: {
      detailTargets: [
        {
          targetRef: "target://example/performance/fallback-channel-detail",
          navigationMode: "modal",
          title: "Fallback channel detail",
          description: "Fallback metadata for the channel detail route.",
          parameters: {
            scope: "$row.scopeFilter",
          },
        },
      ],
    },
  },
});

assert.deepEqual(
  await mergedProvider.getDetailTarget("target://example/performance/fallback-channel-detail"),
  {
    targetRef: "target://example/performance/fallback-channel-detail",
    navigationMode: "hostRoute",
    title: "Fallback channel detail",
    description: "Fallback metadata for the channel detail route.",
    parameters: {
      scope: "$row.scopeFilter",
      channel: "$value",
    },
  },
);

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
    targetRef: "target://example/performance/missing-channel-detail",
  },
  item: {},
  value: "Display",
});

assert.equal(missingResolved, null);
assert.equal(missingHostIntent, null);
assert.deepEqual(missingDetailDiagnostic, {
  code: "detailTargetError",
  severity: "warning",
  message: "No detail target resolved for target://example/performance/missing-channel-detail.",
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
    targetRef: "target://example/performance/failed-channel-detail",
  },
  item: {},
  value: "Display",
});

assert.equal(failedResolved, null);
assert.equal(failedHostIntent, null);
assert.deepEqual(failedDetailDiagnostic, {
  code: "detailTargetError",
  severity: "warning",
  message: "Failed to resolve detail target target://example/performance/failed-channel-detail. Detail target resolution failed.",
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
        targetRef: "target://example/performance/channel-detail",
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
    targetRef: "target://example/performance/channel-detail",
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
  message: "Failed to resolve detail target target://example/performance/channel-detail. Detail target resolution failed.",
});

const recoveredSuccess = await openRecoveredDetailTarget({
  action: {
    id: "detail_recovered",
    kind: "detail",
    label: "Show recovered details",
    targetRef: "target://example/performance/channel-detail",
  },
  item: {
    scopeFilter: "regional",
    selectionRows: [{ scopeFilter: "regional" }],
  },
  value: "CTV",
});

assert.deepEqual(recoveredSuccess, {
  targetRef: "target://example/performance/channel-detail",
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
  targetRef: "target://example/performance/channel-detail",
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
          targetRef: "target://example/performance/channel-detail",
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
    targetRef: "target://example/performance/channel-detail",
  },
  item: {},
  value: "Display",
});

assert.deepEqual(successBeforeFailure, {
  targetRef: "target://example/performance/channel-detail",
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
  targetRef: "target://example/performance/channel-detail",
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
    targetRef: "target://example/performance/channel-detail",
  },
  item: {},
  value: "CTV",
});

assert.equal(failedAfterSuccess, null);
assert.equal(failedAfterSuccessHostIntent, null);
assert.deepEqual(failedAfterSuccessDetailDiagnostic, {
  code: "detailTargetError",
  severity: "warning",
  message: "Failed to resolve detail target target://example/performance/channel-detail. Detail target resolution failed.",
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

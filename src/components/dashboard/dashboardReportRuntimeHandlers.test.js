import assert from "node:assert/strict";

import { resolveDashboardReportRuntimeHandlers } from "./dashboardReportRuntimeHandlers.js";

const semanticModelHandler = {
  async getDrillHierarchy(fieldRef = "") {
    if (fieldRef !== "channelV2") {
      return null;
    }
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
  async listAvailableRefinements(_blockKind = "", fieldRef = "") {
    if (fieldRef !== "channelV2") {
      return { actions: [] };
    }
    return {
      actions: [
        { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://steward/performance/channel-detail" },
      ],
    };
  },
};

const reportSpec = {
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
};

const explicitProvider = {
  async getDrillHierarchy() {
    return {
      fieldRef: "channelV2",
      levels: [{ id: "channel", field: "channelV2", label: "Channel" }],
    };
  },
  async getDetailTarget() {
    return {
      targetRef: "target://demo/explicit",
      navigationMode: "modal",
      parameters: {},
    };
  },
  async listAvailableRefinements() {
    return [
      { id: "keep:channelV2", label: "Keep only", kind: "keep" },
    ];
  },
};

const explicitRuntimeHandlers = {
  applyRefinement() {},
  drillMetadataProvider: explicitProvider,
};

const explicitHandlers = resolveDashboardReportRuntimeHandlers({
  context: {
    handlers: {
      reportRuntime: explicitRuntimeHandlers,
      semanticModel: semanticModelHandler,
    },
  },
  reportSpec,
});
assert.equal(explicitHandlers, explicitRuntimeHandlers);
assert.equal(explicitHandlers.drillMetadataProvider, explicitProvider);

const handlers = resolveDashboardReportRuntimeHandlers({
  context: {
    handlers: {
      reportRuntime: {
        applyRefinement() {},
      },
      semanticModel: semanticModelHandler,
    },
  },
  reportSpec,
});

assert.equal(typeof handlers.applyRefinement, "function");
assert.equal(typeof handlers.drillMetadataProvider?.getDetailTarget, "function");
assert.deepEqual(
  await handlers.drillMetadataProvider.getDetailTarget("target://steward/performance/channel-detail"),
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
  await handlers.drillMetadataProvider.getDetailTarget("target://steward/performance/fallback-channel-detail"),
  {
    targetRef: "target://steward/performance/fallback-channel-detail",
    navigationMode: "modal",
    parameters: {
      channel: "$value",
    },
  },
);
assert.deepEqual(
  await handlers.drillMetadataProvider.listAvailableRefinements("chartBlock", "channelV2"),
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

assert.equal(resolveDashboardReportRuntimeHandlers({
  context: { handlers: {} },
  reportSpec: {},
}), null);

console.log("dashboardReportRuntimeHandlers ✓ wires semantic and authored drill metadata into generic dashboard report runtime handlers");

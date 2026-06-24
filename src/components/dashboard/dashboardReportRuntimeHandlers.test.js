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
    if (targetRef !== "target://example/performance/channel-detail") {
      return null;
    }
    return {
      detailTarget: {
        targetRef: "target://example/performance/channel-detail",
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
        { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://example/performance/channel-detail" },
      ],
    };
  },
};

const reportSpec = {
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

const partialRuntimeHandlers = {
  applyRefinement() {},
  drillMetadataProvider: {
    async listAvailableRefinements() {
      return [
        { id: "keep:channelV2", label: "Keep only", kind: "keep" },
      ];
    },
  },
};

const partialHandlers = resolveDashboardReportRuntimeHandlers({
  context: {
    handlers: {
      reportRuntime: partialRuntimeHandlers,
      semanticModel: semanticModelHandler,
    },
  },
  reportSpec,
});

assert.equal(typeof partialHandlers.applyRefinement, "function");
assert.notEqual(partialHandlers.drillMetadataProvider, partialRuntimeHandlers.drillMetadataProvider);
assert.equal(typeof partialHandlers.drillMetadataProvider?.getDetailTarget, "function");
assert.deepEqual(
  await partialHandlers.drillMetadataProvider.getDetailTarget("target://example/performance/channel-detail"),
  {
    targetRef: "target://example/performance/channel-detail",
    navigationMode: "hostRoute",
    parameters: {
      channel: "$value",
      scope: "$row.scopeFilter",
    },
  },
);

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
  await handlers.drillMetadataProvider.getDetailTarget("target://example/performance/channel-detail"),
  {
    targetRef: "target://example/performance/channel-detail",
    navigationMode: "hostRoute",
    parameters: {
      channel: "$value",
      scope: "$row.scopeFilter",
    },
  },
);
assert.deepEqual(
  await handlers.drillMetadataProvider.getDetailTarget("target://example/performance/fallback-channel-detail"),
  {
    targetRef: "target://example/performance/fallback-channel-detail",
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

assert.equal(resolveDashboardReportRuntimeHandlers({
  context: { handlers: {} },
  reportSpec: {},
}), null);

assert.deepEqual(resolveDashboardReportRuntimeHandlers({
  context: {
    handlers: {
      reportRuntime: partialRuntimeHandlers,
    },
  },
  reportSpec: {},
}), {
  applyRefinement: partialRuntimeHandlers.applyRefinement,
  drillMetadataProvider: undefined,
});

console.log("dashboardReportRuntimeHandlers ✓ wires semantic and authored drill metadata into generic dashboard report runtime handlers");

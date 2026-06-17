import assert from "node:assert/strict";

import { resolveReportBuilderSemanticRuntimeState } from "./useReportBuilderSemanticRuntimeState.js";

const baseConfig = {
  measures: [
    { id: "avails", key: "avails", label: "Avails" },
  ],
  dimensions: [
    { id: "channelV2", key: "channelV2", label: "Channel" },
  ],
};

assert.deepEqual(resolveReportBuilderSemanticRuntimeState({
  config: baseConfig,
  state: {
    selectedMeasures: ["avails"],
    selectedDimensions: ["channelV2"],
  },
  binding: { mode: "raw" },
}), {
  semanticDisplayConfig: baseConfig,
  semanticSummary: null,
  semanticValidationRequest: null,
  semanticValidationFingerprint: "",
  resolvedSemanticSummary: null,
});

const semanticBinding = {
  mode: "semantic",
  modelRef: "model://steward/performance/ad_delivery@v1",
  entity: "line_delivery",
  selectedDimensions: ["channelV2"],
  selectedMeasures: ["avails"],
};

const semanticModel = {
  modelRef: "model://steward/performance/ad_delivery@v1",
  version: 1,
  label: "Ad Delivery",
  description: "Governed semantic projection for runtime preview.",
  entities: [
    {
      id: "line_delivery",
      label: "Line Delivery",
      description: "Delivery grain.",
      dimensions: [
        {
          id: "channelV2",
          label: "Channel",
          description: "Approved channel label",
          governance: {
            status: "approved",
            certification: "reviewed",
          },
        },
      ],
      measures: [
        {
          id: "avails",
          label: "Available Impressions",
          description: "Approved avails metric",
          format: "compactNumber",
          governance: {
            status: "approved",
            certification: "certified",
          },
        },
      ],
    },
  ],
};

const semanticRuntimeState = resolveReportBuilderSemanticRuntimeState({
  config: baseConfig,
  state: {
    selectedMeasures: ["avails"],
    selectedDimensions: ["channelV2"],
    binding: semanticBinding,
  },
  binding: semanticBinding,
  model: semanticModel,
});

assert.equal(semanticRuntimeState.semanticDisplayConfig.measures[0].label, "Available Impressions");
assert.equal(semanticRuntimeState.semanticDisplayConfig.measures[0].semanticRef, "avails");
assert.equal(semanticRuntimeState.semanticDisplayConfig.dimensions[0].label, "Channel");
assert.equal(semanticRuntimeState.semanticDisplayConfig.dimensions[0].semanticRef, "channelV2");
assert.deepEqual(semanticRuntimeState.semanticValidationRequest, {
  modelRef: "model://steward/performance/ad_delivery@v1",
  selection: {
    entity: "line_delivery",
    dimensions: ["channelV2"],
    measures: ["avails"],
    parameters: {},
  },
});
assert.equal(semanticRuntimeState.semanticValidationFingerprint, JSON.stringify({
  modelRef: "model://steward/performance/ad_delivery@v1",
  selection: {
    entity: "line_delivery",
    dimensions: ["channelV2"],
    measures: ["avails"],
    parameters: {},
  },
}));
assert.deepEqual(semanticRuntimeState.semanticSummary, {
  kind: "semantic",
  modelRef: "model://steward/performance/ad_delivery@v1",
  modelLabel: "Ad Delivery",
  modelDescription: "Governed semantic projection for runtime preview.",
  entity: "line_delivery",
  entityLabel: "Line Delivery",
  entityDescription: "Delivery grain.",
  selectedDimensions: [
    {
      id: "channelV2",
      rawId: "channelV2",
      label: "Channel",
      description: "Approved channel label",
      governance: {
        status: "approved",
        certification: "reviewed",
      },
    },
  ],
  selectedMeasures: [
    {
      id: "avails",
      rawId: "avails",
      label: "Available Impressions",
      description: "Approved avails metric",
      format: "compactNumber",
      governance: {
        status: "approved",
        certification: "certified",
      },
    },
  ],
});
assert.deepEqual(semanticRuntimeState.resolvedSemanticSummary, semanticRuntimeState.semanticSummary);

const fallbackAwareRuntimeState = resolveReportBuilderSemanticRuntimeState({
  config: {
    measures: [
      { id: "avails", key: "avails", semanticRef: "avails", label: "Avails" },
    ],
    dimensions: [
      { id: "channelV2", key: "channelV2", semanticRef: "channelV2", label: "Channel" },
    ],
  },
  state: {
    selectedMeasures: ["avails"],
    selectedDimensions: ["channelV2"],
    binding: semanticBinding,
  },
  binding: semanticBinding,
  model: null,
  fallbackSummary: {
    kind: "semantic",
    modelRef: "model://steward/performance/ad_delivery@v1",
    modelLabel: "Fallback Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Fallback Line Delivery",
    selectedDimensions: [
      { id: "channelV2", rawId: "channelV2", label: "Fallback Channel" },
    ],
    selectedMeasures: [
      { id: "avails", rawId: "avails", label: "Fallback Available Impressions", format: "compactNumber" },
    ],
  },
  fallbackFingerprint: JSON.stringify({
    modelRef: "model://steward/performance/ad_delivery@v1",
    selection: {
      entity: "line_delivery",
      dimensions: ["channelV2"],
      measures: ["avails"],
      parameters: {},
    },
  }),
});

assert.equal(fallbackAwareRuntimeState.resolvedSemanticSummary.modelLabel, "Fallback Ad Delivery");
assert.equal(fallbackAwareRuntimeState.resolvedSemanticSummary.entityLabel, "Fallback Line Delivery");
assert.equal(fallbackAwareRuntimeState.resolvedSemanticSummary.selectedMeasures[0].label, "Fallback Available Impressions");

console.log("useReportBuilderSemanticRuntimeState ✓ resolves provider-backed semantic display config and runtime summary state");

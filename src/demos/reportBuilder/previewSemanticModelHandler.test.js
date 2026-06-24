import assert from "node:assert/strict";

import { createReportBuilderPreviewMetrics } from "./previewMetrics.js";
import {
  createDemoSemanticModelHandler,
  validateDemoSemanticRequest,
} from "./previewSemanticModelHandler.js";

const modelRef = "model://example/performance/delivery@v1";

const defaultSemanticModel = {
  modelRef,
  version: 1,
  label: "Ad Delivery",
  entities: [
    {
      id: "line_delivery",
      label: "Line Delivery",
      dimensions: [
        { id: "event_date", label: "Date", dataType: "date" },
      ],
      measures: [
        { id: "available_impressions", label: "Available Impressions", dataType: "number", aggregation: "sum" },
      ],
      parameters: [
        { id: "reporting_window", label: "Reporting Window", dataType: "date" },
      ],
    },
  ],
};

const flatOverrideSemanticModel = {
  modelRef,
  version: 2,
  label: "Audience Delivery",
  entities: [
    {
      id: "line_delivery",
      label: "Audience Line Delivery",
      fields: [
        { id: "publisher", label: "Publisher", featureType: "dimension", dataType: "string" },
        { id: "audience_index", label: "Audience Index", featureType: "measure", dataType: "number", aggregation: "avg" },
        { id: "audience_segment", label: "Audience Segment", featureType: "parameter", dataType: "string" },
      ],
    },
  ],
};

const staticFilters = [
  {
    id: "dateRange",
    semanticRef: "reporting_window",
    label: "Reporting Window",
    type: "dateRange",
  },
  {
    id: "audienceSegmentFilter",
    semanticRef: "audience_segment",
    label: "Audience Segment",
    multiple: true,
    options: [
      { label: "Young Adults", value: "Young Adults" },
      { label: "Established Adults", value: "Established Adults" },
    ],
  },
];

const metrics = createReportBuilderPreviewMetrics();
metrics.queueSemanticModelBehavior({
  match: { modelRef },
  result: flatOverrideSemanticModel,
});

const handler = createDemoSemanticModelHandler({
  semanticModel: defaultSemanticModel,
  staticFilters,
  getMetrics: () => metrics,
});

assert.deepEqual(await handler.getModel(modelRef), flatOverrideSemanticModel);
assert.equal(metrics.getModelCount, 1);

const cachedMetrics = createReportBuilderPreviewMetrics();
cachedMetrics.queueSemanticModelBehavior({
  match: { modelRef },
  result: flatOverrideSemanticModel,
});

const cachedHandler = createDemoSemanticModelHandler({
  semanticModel: defaultSemanticModel,
  staticFilters,
  getMetrics: () => cachedMetrics,
});

assert.deepEqual(await cachedHandler.getModel(modelRef), flatOverrideSemanticModel);
assert.equal(cachedMetrics.getModelCount, 1);
assert.deepEqual(await cachedHandler.validateSelection(modelRef, {
  entity: "line_delivery",
  dimensions: ["publisher"],
  measures: ["audience_index"],
  parameters: {
    audience_segment: ["Young Adults"],
  },
}), {
  valid: true,
  normalizedSelection: {
    entity: "line_delivery",
    dimensions: ["publisher"],
    measures: ["audience_index"],
    parameters: {
      audience_segment: ["Young Adults"],
    },
  },
  diagnostics: [],
});
assert.equal(cachedMetrics.getModelCount, 1);
cachedMetrics.queueSemanticModelBehavior({
  match: { modelRef },
  result: defaultSemanticModel,
});
assert.deepEqual(await cachedHandler.getModel(modelRef), defaultSemanticModel);
assert.equal(cachedMetrics.getModelCount, 2);
assert.equal(cachedHandler.invalidateModelCache(modelRef), 1);
assert.deepEqual(await cachedHandler.getModel(modelRef), defaultSemanticModel);
assert.equal(cachedMetrics.getModelCount, 3);

const transientFailureMetrics = createReportBuilderPreviewMetrics();
transientFailureMetrics.queueSemanticModelBehavior({
  match: { modelRef },
  error: "Semantic model metadata failed.",
});

const transientFailureHandler = createDemoSemanticModelHandler({
  semanticModel: defaultSemanticModel,
  staticFilters,
  getMetrics: () => transientFailureMetrics,
});

await assert.rejects(
  transientFailureHandler.getModel(modelRef),
  /Semantic model metadata failed\./,
);
assert.equal(transientFailureMetrics.getModelCount, 1);
assert.deepEqual(await transientFailureHandler.getModel(modelRef), defaultSemanticModel);
assert.equal(transientFailureMetrics.getModelCount, 2);

const validationFailureMetrics = createReportBuilderPreviewMetrics();
validationFailureMetrics.queueSemanticModelBehavior({
  match: { modelRef },
  error: "Semantic model metadata failed.",
});

const validationFailureHandler = createDemoSemanticModelHandler({
  semanticModel: defaultSemanticModel,
  staticFilters,
  getMetrics: () => validationFailureMetrics,
});

const invalidSelectionFromModelError = await validationFailureHandler.validateSelection(modelRef, {
  entity: "line_delivery",
  dimensions: ["publisher"],
  measures: ["audience_index"],
  parameters: {
    audience_segment: ["Young Adults"],
  },
});
assert.deepEqual(invalidSelectionFromModelError, {
  valid: false,
  normalizedSelection: null,
  diagnostics: [
    {
      code: "semanticModelError",
      severity: "error",
      path: "selection.modelRef",
      message: "Semantic model metadata failed.",
      suggestedFix: "Retry loading the semantic model or choose a different semantic binding.",
    },
  ],
});
assert.equal(validationFailureMetrics.getModelCount, 1);
assert.equal(validationFailureMetrics.validateSelectionCount, 1);

const validAudienceSelection = await handler.validateSelection(modelRef, {
  entity: "line_delivery",
  dimensions: ["publisher"],
  measures: ["audience_index"],
  parameters: {
    audience_segment: ["Young Adults"],
  },
});
assert.equal(validAudienceSelection.valid, true);
assert.deepEqual(validAudienceSelection.normalizedSelection, {
  entity: "line_delivery",
  dimensions: ["publisher"],
  measures: ["audience_index"],
  parameters: {
    audience_segment: ["Young Adults"],
  },
});
assert.deepEqual(validAudienceSelection.diagnostics, []);
assert.equal(metrics.validateSelectionCount, 1);

const metricsMismatch = createReportBuilderPreviewMetrics();
metricsMismatch.queueSemanticModelBehavior({
  match: { modelRef },
  result: flatOverrideSemanticModel,
});

const mismatchHandler = createDemoSemanticModelHandler({
  semanticModel: defaultSemanticModel,
  staticFilters,
  getMetrics: () => metricsMismatch,
});

const invalidDefaultSelection = await mismatchHandler.validateSelection(modelRef, {
  entity: "line_delivery",
  dimensions: ["event_date"],
  measures: ["available_impressions"],
  parameters: {
    reporting_window: {
      start: "2026-05-01",
      end: "2026-05-07",
    },
  },
});
assert.equal(invalidDefaultSelection.valid, false);
assert.deepEqual(
  invalidDefaultSelection.diagnostics.map((entry) => entry.code),
  ["unknownDimension", "unknownMeasure"],
);

const metricsParameter = createReportBuilderPreviewMetrics();
metricsParameter.queueSemanticModelBehavior({
  match: { modelRef },
  result: flatOverrideSemanticModel,
});

const parameterHandler = createDemoSemanticModelHandler({
  semanticModel: defaultSemanticModel,
  staticFilters,
  getMetrics: () => metricsParameter,
});

const providerDrillMetadata = {
  hierarchies: [
    {
      id: "inventory",
      levels: [
        { field: "channelV2", label: "Channel" },
        { field: "country", label: "Market" },
      ],
    },
  ],
  fieldActions: [
    {
      fieldRef: "channelV2",
      actions: [
        { id: "drill_market", label: "Drill to Market", kind: "drill", nextFieldRef: "country" },
        { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://example/performance/channel-detail" },
      ],
    },
    {
      fieldRef: "country",
      actions: [
        { id: "detail_market", label: "Show market details", kind: "detail", targetRef: "target://example/performance/market-detail" },
      ],
    },
    {
      fieldRef: "eventDate",
      actions: [
        { id: "detail_date", label: "Show date details", kind: "detail", targetRef: "target://example/performance/date-detail" },
      ],
    },
  ],
  detailTargets: [
    {
      targetRef: "target://example/performance/channel-detail",
      navigationMode: "hostRoute",
      parameters: {
        channel: "$value",
        campaign: "$row.campaign",
      },
    },
    {
      targetRef: "target://example/performance/market-detail",
      navigationMode: "hostRoute",
      parameters: {
        country: "$value",
      },
    },
    {
      targetRef: "target://example/performance/date-detail",
      navigationMode: "hostRoute",
      parameters: {
        eventDate: "$value",
      },
    },
  ],
};

const providerHandler = createDemoSemanticModelHandler({
  semanticModel: defaultSemanticModel,
  drillMetadata: providerDrillMetadata,
  staticFilters,
  getMetrics: () => createReportBuilderPreviewMetrics(),
});

const invalidParameterSelection = await parameterHandler.validateSelection(modelRef, {
  entity: "line_delivery",
  dimensions: ["publisher"],
  measures: ["audience_index"],
  parameters: {
    reporting_window: {
      start: "2026-05-01",
      end: "2026-05-07",
    },
  },
});
assert.equal(invalidParameterSelection.valid, false);
assert.deepEqual(invalidParameterSelection.diagnostics, [
  {
    code: "unknownParameter",
    severity: "error",
    path: "selection.parameters.reporting_window",
    message: "Reporting Window is not available in the current semantic entity.",
    suggestedFix: "Remove the unsupported semantic scope parameter or choose a supported filter.",
  },
]);

await assert.rejects(
  validateDemoSemanticRequest({
    semanticSelection: {
      modelRef,
      entity: "line_delivery",
      selection: {
        dimensions: ["publisher"],
        measures: ["audience_index"],
      },
      parameters: {
        audience_segment: ["Unknown Audience"],
      },
    },
  }, parameterHandler),
  /Audience Segment contains unsupported values: Unknown Audience\./,
);

await assert.rejects(
  validateDemoSemanticRequest({
    semanticSelection: {
      modelRef,
      entity: "line_delivery",
      selection: {
        dimensions: ["publisher"],
        measures: ["audience_index"],
      },
      parameters: {
        audience_segment: ["Young Adults"],
      },
    },
  }, null),
  /Semantic model provider unavailable\./,
);

const providerDetailTarget = await providerHandler.getDetailTarget("target://example/performance/channel-detail");
assert.deepEqual(providerDetailTarget, {
  detailTarget: {
    targetRef: "target://example/performance/channel-detail",
    navigationMode: "hostRoute",
    parameters: {
      channel: "$value",
      campaign: "$row.campaign",
    },
  },
});

const providerDetailActions = await providerHandler.listAvailableRefinements("tableBlock", "channelV2");
assert.deepEqual(providerDetailActions, {
  actions: [
    { id: "keep:channelV2", label: "Keep only", kind: "keep" },
    { id: "exclude:channelV2", label: "Exclude", kind: "exclude" },
    { id: "drill:channelV2:country", label: "Drill to Market", kind: "drill", nextFieldRef: "country" },
    { id: "drill_market", label: "Drill to Market", kind: "drill", nextFieldRef: "country" },
    { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://example/performance/channel-detail" },
  ],
});

const providerMarketDetailTarget = await providerHandler.getDetailTarget("target://example/performance/market-detail");
assert.deepEqual(providerMarketDetailTarget, {
  detailTarget: {
    targetRef: "target://example/performance/market-detail",
    navigationMode: "hostRoute",
    parameters: {
      country: "$value",
    },
  },
});

const providerMarketActions = await providerHandler.listAvailableRefinements("tableBlock", "country");
assert.deepEqual(providerMarketActions, {
  actions: [
    { id: "keep:country", label: "Keep only", kind: "keep" },
    { id: "exclude:country", label: "Exclude", kind: "exclude" },
    { id: "detail_market", label: "Show market details", kind: "detail", targetRef: "target://example/performance/market-detail" },
  ],
});

const providerDateDetailTarget = await providerHandler.getDetailTarget("target://example/performance/date-detail");
assert.deepEqual(providerDateDetailTarget, {
  detailTarget: {
    targetRef: "target://example/performance/date-detail",
    navigationMode: "hostRoute",
    parameters: {
      eventDate: "$value",
    },
  },
});

const providerDateActions = await providerHandler.listAvailableRefinements("tableBlock", "eventDate");
assert.deepEqual(providerDateActions, {
  actions: [
    { id: "keep:eventDate", label: "Keep only", kind: "keep" },
    { id: "exclude:eventDate", label: "Exclude", kind: "exclude" },
    { id: "detail_date", label: "Show date details", kind: "detail", targetRef: "target://example/performance/date-detail" },
  ],
});

console.log("previewSemanticModelHandler ✓ shares the resolved semantic model across fetch and validation, including flat field overrides");

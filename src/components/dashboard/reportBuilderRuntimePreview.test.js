import assert from "node:assert/strict";

import {
  buildReportBuilderRuntimePreviewArtifacts,
  buildReportBuilderRuntimePreview,
  buildReportBuilderRuntimePreviewModel,
  resolveReportBuilderRuntimeChartCapability,
  resolveReportBuilderRuntimeGeoCapability,
  resolveReportBuilderRuntimeRefinementCapability,
  resolveReportBuilderRuntimeTableCapability,
} from "./reportBuilderRuntimePreview.js";
import { resolveReportRuntimeDrillMetadataProvider } from "./reportRuntimeDrillProvider.js";
import { executeReportRuntimeAction } from "./reportRuntimeActionExecutor.js";
import {
  applyReportRuntimeInteractionDrillTransition,
  applyReportRuntimeInteractionRefinement,
  createReportRuntimeInteractionState,
} from "./reportRuntimeInteractionStateModel.js";
import { resolveReportRuntimeRefinementFields } from "./reportRuntimeModel.js";
import { buildReportRuntimeTableInteractionState } from "./reportRuntimeTableInteractionState.js";
import { validateReportExportRequest, validateReportPrint } from "../../reporting/schema/reportSchemas.js";

const container = {
  id: "forecastBuilder",
  stateKey: "forecastBuilder",
  title: "Forecast Builder",
  dataSourceRef: "forecasting_cube_report",
};

const config = {
  dataSourceRef: "forecasting_cube_report",
  staticFilters: [
    { id: "dateRange", field: "dateRange", label: "Date Range", type: "dateRange" },
  ],
  measures: [
    { id: "avails", key: "avails", label: "Avails", default: true, format: "compactNumber" },
  ],
  dimensions: [
    {
      id: "channelV2",
      key: "channelV2",
      label: "Channel",
      runtimeFilter: {
        includeParamPath: "filters.includeChannelV2",
        excludeParamPath: "filters.excludeChannelV2",
      },
    },
    { id: "publisherId", key: "publisherId", label: "Publisher" },
    { id: "siteType", key: "siteType", label: "Site Type" },
  ],
  drillMetadata: {
    hierarchies: [
      {
        id: "forecast_inventory",
        label: "Forecast Inventory",
        levels: [
          { field: "channelV2", label: "Channel" },
          { field: "publisherId", label: "Publisher" },
          { field: "siteType", label: "Site Type" },
        ],
      },
    ],
  },
};

const state = {
  selectedMeasures: ["avails"],
  selectedDimensions: ["channelV2"],
  primaryMeasure: "avails",
  reportDocumentTitle: "Executive Snapshot",
  reportDocumentSubtitle: "Weekly Rollup",
  reportDocumentDescription: "Authored runtime metadata summary.",
  staticFilters: {
    dateRange: {
      start: "2025-05-01",
      end: "2025-05-22",
    },
  },
  pageSize: 50,
  page: 1,
  orderField: "avails",
  orderDir: "desc",
  viewMode: "table",
};

const refinements = [{
  id: "drill:channelV2:publisherId",
  op: "drill",
  field: "channelV2",
  values: ["Display"],
  sourceBlockId: "primaryTable",
  label: "Drill to Publisher = Display",
}];

const drillTransitions = [{
  refinementId: "drill:channelV2:publisherId",
  sourceField: "channelV2",
  nextFieldRef: "publisherId",
  sourceBlockId: "primaryTable",
}];

const semanticSummary = {
  kind: "semantic",
  modelRef: "model://steward/performance/ad_delivery@v1",
  modelLabel: "Ad Delivery",
  entity: "line_delivery",
  entityLabel: "Line Delivery",
  selectedDimensions: [
    { id: "channel", rawId: "channelV2", label: "Channel" },
  ],
  selectedMeasures: [
    { id: "available_impressions", rawId: "avails", label: "Available Impressions", format: "compactNumber" },
  ],
};

const model = buildReportBuilderRuntimePreviewModel({
  container,
  config,
  state,
  refinements,
  drillTransitions,
  semanticSummary,
  requestTransform: ({ request }) => ({
    ...request,
    orderBy: ["publisherId desc"],
  }),
});

assert.ok(model?.document);
assert.ok(model?.reportSpec);
assert.deepEqual(
  model.document.layout.items.map((item) => item.blockId),
  ["sharedFilters", "activeRefinements", "primaryBuilder"],
);
assert.equal(model.reportSpec.scope.params[0].id, "dateRange");
assert.equal(model.reportSpec.semanticSummary.modelLabel, "Ad Delivery");
assert.equal(model.reportSpec.datasets[0].request.dimensions.publisherId, true);
assert.equal(model.reportSpec.datasets[0].request.dimensions.channelV2, true);
assert.deepEqual(model.reportSpec.datasets[0].request.filters.includeChannelV2, ["Display"]);
assert.deepEqual(model.reportSpec.datasets[0].request.orderBy, ["publisherId desc"]);
assert.deepEqual(model.reportSpec.refinements, refinements);
assert.deepEqual(model.refinementCapability, {
  supported: true,
  hasFieldSupport: false,
  hasActiveRuntimeRefinements: true,
  hasActiveDrillTransitions: true,
});
assert.deepEqual(model.scopeCapability, {
  supported: true,
  paramIds: ["dateRange"],
});
assert.deepEqual(model.tableCapability, {
  supported: true,
  columnKeys: ["channelV2", "publisherId", "siteType", "avails"],
});
assert.deepEqual(model.chartCapability, {
  supported: true,
  chartSpec: {
    title: "Chart",
    type: "line",
    xField: "channelV2",
    yFields: ["avails"],
    seriesField: "publisherId",
  },
});
assert.deepEqual(model.geoCapability, {
  supported: true,
  geoKey: "publisherId",
  metricKey: "avails",
});
assert.deepEqual(resolveReportBuilderRuntimeChartCapability({
  config,
  state,
}), {
  supported: true,
  chartSpec: {
    title: "Chart",
    type: "line",
    xField: "channelV2",
    yFields: ["avails"],
    seriesField: "publisherId",
  },
});
assert.deepEqual(resolveReportBuilderRuntimeGeoCapability({
  config,
  state,
}), {
  supported: true,
  geoKey: "channelV2",
  metricKey: "avails",
});
assert.deepEqual(resolveReportBuilderRuntimeTableCapability({
  config,
  state,
}), {
  supported: true,
  columnKeys: ["channelV2", "publisherId", "siteType", "avails"],
});
assert.deepEqual(resolveReportBuilderRuntimeRefinementCapability({
  reportSpec: model.reportSpec,
  refinements,
  drillTransitions,
}), {
  supported: true,
  hasFieldSupport: false,
  hasActiveRuntimeRefinements: true,
  hasActiveDrillTransitions: true,
});

const runtimeRefinementReadyModel = buildReportBuilderRuntimePreviewModel({
  container,
  config,
  state,
  refinements: [],
  drillTransitions: [],
});
assert.deepEqual(
  runtimeRefinementReadyModel.document.layout.items.map((item) => item.blockId),
  ["sharedFilters", "activeRefinements", "primaryBuilder"],
);
assert.equal(
  runtimeRefinementReadyModel.reportSpec.blocks.some((block) => block.kind === "refinementBarBlock" && block.id === "activeRefinements"),
  true,
);
assert.deepEqual(runtimeRefinementReadyModel.refinementCapability, {
  supported: true,
  hasFieldSupport: true,
  hasActiveRuntimeRefinements: false,
  hasActiveDrillTransitions: false,
});
assert.deepEqual(runtimeRefinementReadyModel.scopeCapability, {
  supported: true,
  paramIds: ["dateRange"],
});
assert.deepEqual(runtimeRefinementReadyModel.tableCapability, {
  supported: true,
  columnKeys: ["channelV2", "publisherId", "siteType", "avails"],
});
assert.deepEqual(runtimeRefinementReadyModel.chartCapability, {
  supported: true,
  chartSpec: {
    title: "Chart",
    type: "line",
    xField: "channelV2",
    yFields: ["avails"],
    seriesField: "publisherId",
  },
});
assert.deepEqual(runtimeRefinementReadyModel.geoCapability, {
  supported: true,
  geoKey: "channelV2",
  metricKey: "avails",
});
assert.deepEqual(resolveReportBuilderRuntimeRefinementCapability({
  reportSpec: runtimeRefinementReadyModel.reportSpec,
  refinements: [],
  drillTransitions: [],
}), {
  supported: true,
  hasFieldSupport: true,
  hasActiveRuntimeRefinements: false,
  hasActiveDrillTransitions: false,
});

const nonRefinableConfig = {
  ...config,
  dimensions: [
    { id: "publisherId", key: "publisherId", label: "Publisher" },
    { id: "siteType", key: "siteType", label: "Site Type" },
  ],
  drillMetadata: {
    hierarchies: [
      {
        id: "publisher_path",
        label: "Publisher Path",
        levels: [
          { field: "publisherId", label: "Publisher" },
          { field: "siteType", label: "Site Type" },
        ],
      },
    ],
  },
};
const nonRefinableModel = buildReportBuilderRuntimePreviewModel({
  container,
  config: nonRefinableConfig,
  state: {
    ...state,
    selectedDimensions: ["publisherId"],
  },
  refinements: [],
  drillTransitions: [],
});
assert.deepEqual(
  nonRefinableModel.document.layout.items.map((item) => item.blockId),
  ["sharedFilters", "primaryBuilder"],
);
assert.deepEqual(nonRefinableModel.scopeCapability, {
  supported: true,
  paramIds: ["dateRange"],
});
assert.deepEqual(nonRefinableModel.tableCapability, {
  supported: true,
  columnKeys: ["publisherId", "siteType", "avails"],
});
assert.deepEqual(nonRefinableModel.chartCapability, {
  supported: true,
  chartSpec: {
    title: "Chart",
    type: "line",
    xField: "publisherId",
    yFields: ["avails"],
    seriesField: "siteType",
  },
});
assert.deepEqual(nonRefinableModel.geoCapability, {
  supported: true,
  geoKey: "publisherId",
  metricKey: "avails",
});
assert.equal(
  nonRefinableModel.reportSpec.blocks.some((block) => block.kind === "refinementBarBlock"),
  false,
);
assert.deepEqual(nonRefinableModel.refinementCapability, {
  supported: false,
  hasFieldSupport: false,
  hasActiveRuntimeRefinements: false,
  hasActiveDrillTransitions: false,
});
assert.deepEqual(resolveReportBuilderRuntimeRefinementCapability({
  reportSpec: nonRefinableModel.reportSpec,
  refinements: [],
  drillTransitions: [],
}), {
  supported: false,
  hasFieldSupport: false,
  hasActiveRuntimeRefinements: false,
  hasActiveDrillTransitions: false,
});

const noScopeModel = buildReportBuilderRuntimePreviewModel({
  container,
  config: {
    ...config,
    staticFilters: [],
  },
  state,
  refinements: [],
  drillTransitions: [],
});
assert.deepEqual(
  noScopeModel.document.layout.items.map((item) => item.blockId),
  ["activeRefinements", "primaryBuilder"],
);
assert.deepEqual(noScopeModel.scopeCapability, {
  supported: false,
  paramIds: [],
});

const noGeoMetricModel = buildReportBuilderRuntimePreviewModel({
  container,
  config: {
    ...config,
    measures: [],
  },
  state: {
    ...state,
    selectedMeasures: [],
    primaryMeasure: "",
  },
  refinements: [],
  drillTransitions: [],
});
assert.deepEqual(noGeoMetricModel.geoCapability, {
  supported: false,
  geoKey: "channelV2",
  metricKey: "",
});
assert.deepEqual(noGeoMetricModel.chartCapability, {
  supported: false,
  chartSpec: null,
});
assert.deepEqual(resolveReportBuilderRuntimeChartCapability({
  config: {
    ...config,
    measures: [],
  },
  state: {
    ...state,
    selectedMeasures: [],
    primaryMeasure: "",
  },
}), {
  supported: false,
  chartSpec: null,
});
assert.deepEqual(resolveReportBuilderRuntimeGeoCapability({
  config: {
    ...config,
    measures: [],
  },
  state: {
    ...state,
    selectedMeasures: [],
    primaryMeasure: "",
  },
}), {
  supported: false,
  geoKey: "channelV2",
  metricKey: "",
});
assert.deepEqual(resolveReportBuilderRuntimeGeoCapability({
  config: {
    ...config,
    dimensions: [],
  },
  state: {
    ...state,
    selectedDimensions: [],
  },
}), {
  supported: false,
  geoKey: "",
  metricKey: "avails",
});
assert.deepEqual(resolveReportBuilderRuntimeChartCapability({
  config: {
    ...config,
    dimensions: [],
  },
  state: {
    ...state,
    selectedDimensions: [],
  },
}), {
  supported: false,
  chartSpec: null,
});
const noTableFieldsModel = buildReportBuilderRuntimePreviewModel({
  container,
  config: {
    ...config,
    measures: [],
    dimensions: [],
  },
  state: {
    ...state,
    selectedMeasures: [],
    selectedDimensions: [],
    primaryMeasure: "",
  },
  refinements: [],
  drillTransitions: [],
});
assert.deepEqual(noTableFieldsModel.tableCapability, {
  supported: false,
  columnKeys: [],
});
assert.deepEqual(resolveReportBuilderRuntimeTableCapability({
  config: {
    ...config,
    measures: [],
    dimensions: [],
  },
  state: {
    ...state,
    selectedMeasures: [],
    selectedDimensions: [],
    primaryMeasure: "",
  },
}), {
  supported: false,
  columnKeys: [],
});

const preview = buildReportBuilderRuntimePreview({
  model,
  rows: [
    { channelV2: "Display", publisherId: "Acme Media", avails: 1250000 },
    { channelV2: "CTV", publisherId: "North Star Media", avails: 980000 },
  ],
  hasMore: true,
  error: null,
  pageGeometry: {
    width: 792,
    height: 612,
    marginTop: 36,
    marginRight: 36,
    marginBottom: 36,
    marginLeft: 36,
    headerHeight: 36,
    footerHeight: 24,
  },
});
const previewWithHostIntent = buildReportBuilderRuntimePreview({
  model,
  rows: [
    { channelV2: "Display", publisherId: "Acme Media", avails: 1250000 },
    { channelV2: "CTV", publisherId: "North Star Media", avails: 980000 },
  ],
  hasMore: true,
  error: null,
  additionalDiagnostics: [],
  hostIntent: {
    intentKind: "detailTarget",
    targetRef: "target://steward/performance/publisher-detail",
    navigationMode: "hostRoute",
    parameters: {
      publisher: "Acme Media",
    },
  },
  pageGeometry: {
    width: 792,
    height: 612,
    marginTop: 36,
    marginRight: 36,
    marginBottom: 36,
    marginLeft: 36,
    headerHeight: 36,
    footerHeight: 24,
  },
});
const previewArtifacts = buildReportBuilderRuntimePreviewArtifacts({
  model,
  rows: [
    { channelV2: "Display", publisherId: "Acme Media", avails: 1250000 },
    { channelV2: "CTV", publisherId: "North Star Media", avails: 980000 },
  ],
  hasMore: true,
  error: null,
  additionalDiagnostics: [],
  pageGeometry: {
    width: 792,
    height: 612,
    marginTop: 36,
    marginRight: 36,
    marginBottom: 36,
    marginLeft: 36,
    headerHeight: 36,
    footerHeight: 24,
  },
});

assert.ok(preview?.reportFill);
assert.ok(previewArtifacts?.reportFill);
assert.equal(preview?.reportPrint?.kind, "reportPrint");
assert.equal(validateReportPrint(preview.reportPrint).valid, true);
assert.equal(preview.reportPrint.pageGeometry.width, 792);
assert.equal(preview.reportPrint.pageGeometry.height, 612);
assert.equal(preview.exportRequest.kind, "reportExportRequest");
assert.equal(preview.exportRequest.source.from, "draft");
assert.equal(preview.exportRequest.source.artifactRef, "dashboard.reportBuilder://forecastBuilder");
assert.equal(validateReportExportRequest(preview.exportRequest).valid, true);
assert.equal(preview.exportRequest.reportPrint.pageGeometry.width, 792);
assert.equal(preview.exportRequest.reportPrint.pageGeometry.height, 612);
assert.equal(preview.reportFill.datasets[0].rows[0].publisherId, "Acme Media");
assert.equal(preview.reportFill.datasets[0].provenance.hasMore, true);
assert.equal(preview.runtimeBlock.kind, "dashboard.reportRuntime");
assert.equal(preview.runtimeBlock.dashboard.reportRuntime.reportPrint.kind, "reportPrint");
assert.equal(preview.runtimeBlock.title, "Executive Snapshot");
assert.equal(preview.runtimeBlock.subtitle, "Weekly Rollup");
assert.equal(preview.runtimeBlock.dashboard.reportRuntime.reportSpec.semanticSummary.entityLabel, "Line Delivery");
assert.equal(preview.runtimeBlock.dashboard.reportRuntime.reportSpec.datasets[0].request.dimensions.publisherId, true);
assert.deepEqual(previewWithHostIntent.exportRequest, preview.exportRequest);
assert.deepEqual(previewWithHostIntent.reportPrint, preview.reportPrint);
assert.deepEqual(previewWithHostIntent.runtimeBlock.dashboard.reportRuntime.hostIntent, {
  intentKind: "detailTarget",
  targetRef: "target://steward/performance/publisher-detail",
  navigationMode: "hostRoute",
  parameters: {
    publisher: "Acme Media",
  },
});
assert.deepEqual(previewArtifacts.document, preview.document);
assert.deepEqual(previewArtifacts.reportSpec, preview.reportSpec);
assert.deepEqual(previewArtifacts.reportFill, preview.reportFill);
assert.deepEqual(previewArtifacts.reportPrint, preview.reportPrint);
assert.deepEqual(previewArtifacts.exportRequest, preview.exportRequest);
assert.equal(
  Object.prototype.hasOwnProperty.call(previewWithHostIntent.exportRequest, "hostIntent"),
  false,
);
assert.equal(
  Object.prototype.hasOwnProperty.call(previewWithHostIntent.reportPrint, "hostIntent"),
  false,
);

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
      dimensions: [
        {
          id: "channelV2",
          label: "Channel",
          description: "Approved channel label",
        },
      ],
      measures: [
        {
          id: "avails",
          label: "Available Impressions",
          format: "compactNumber",
        },
      ],
    },
  ],
};

const providerResolvedModel = buildReportBuilderRuntimePreviewModel({
  container,
  config,
  state: {
    ...state,
    binding: semanticBinding,
  },
  binding: semanticBinding,
  semanticModel,
});

assert.equal(providerResolvedModel.reportSpec.binding.modelRef, "model://steward/performance/ad_delivery@v1");
assert.equal(providerResolvedModel.reportSpec.semanticSummary.modelLabel, "Ad Delivery");
assert.equal(providerResolvedModel.reportSpec.semanticSummary.entityLabel, "Line Delivery");
assert.equal(providerResolvedModel.reportSpec.semanticSummary.selectedMeasures[0].label, "Available Impressions");

const keepModel = buildReportBuilderRuntimePreviewModel({
  container,
  config,
  state,
  refinements: [{
    id: "keep:channelV2:primaryChart",
    op: "keep",
    field: "channelV2",
    values: ["Display"],
    sourceBlockId: "primaryChart",
    label: "Keep only = Display",
  }],
});

const keepPreview = buildReportBuilderRuntimePreview({
  model: keepModel,
  rows: [
    { channelV2: "Display", avails: 1200000 },
    { channelV2: "CTV", avails: 980000 },
  ],
  hasMore: false,
});

assert.deepEqual(keepPreview.reportFill.datasets[0].rows, [
  { channelV2: "Display", avails: 1200000 },
]);

const authoredBlocksModel = buildReportBuilderRuntimePreviewModel({
  container,
  config,
  state: {
    ...state,
    reportDocumentBlocks: [
      {
        id: "narrativeIntro",
        kind: "markdownBlock",
        title: "Narrative",
        markdown: "## Narrative\nAuthor-provided context.",
      },
      {
        id: "headlineKpi",
        kind: "kpiBlock",
        title: "Headline KPI",
        datasetRef: "primary",
        valueField: "avails",
        valueLabel: "Avails",
      },
    ],
    reportDocumentLayout: {
      type: "stack",
      items: [
        { blockId: "narrativeIntro" },
        { blockId: "primaryBuilder" },
        { blockId: "headlineKpi" },
      ],
    },
  },
});
assert.deepEqual(
  authoredBlocksModel.document.layout.items.map((item) => item.blockId),
  ["sharedFilters", "activeRefinements", "narrativeIntro", "primaryBuilder", "headlineKpi"],
);
const authoredBlocksPreview = buildReportBuilderRuntimePreview({
  model: authoredBlocksModel,
  rows: [
    { channelV2: "Display", avails: 1200000 },
  ],
  hasMore: false,
});
assert.equal(authoredBlocksPreview.reportFill.blocks.some((block) => block.kind === "markdownBlock" && block.id === "narrativeIntro"), true);
assert.equal(authoredBlocksPreview.reportFill.blocks.some((block) => block.kind === "kpiBlock" && block.id === "headlineKpi" && block.content?.value === 1200000), true);

const authoredSizedBlocksModel = buildReportBuilderRuntimePreviewModel({
  container,
  config,
  state: {
    ...state,
    reportDocumentBlocks: [
      {
        id: "narrativeIntro",
        kind: "markdownBlock",
        title: "Narrative",
        markdown: "## Narrative\nAuthor-provided context.",
      },
      {
        id: "headlineKpi",
        kind: "kpiBlock",
        title: "Headline KPI",
        datasetRef: "primary",
        valueField: "avails",
        valueLabel: "Avails",
      },
    ],
    reportDocumentLayout: {
      type: "stack",
      items: [
        { blockId: "narrativeIntro", size: "half" },
        { blockId: "primaryBuilder" },
        { blockId: "headlineKpi", size: "half" },
      ],
    },
  },
});
assert.deepEqual(authoredSizedBlocksModel.document.layout.items, [
  { blockId: "sharedFilters" },
  { blockId: "activeRefinements" },
  { blockId: "narrativeIntro", size: "half" },
  { blockId: "primaryBuilder" },
  { blockId: "headlineKpi", size: "half" },
]);
assert.deepEqual(authoredSizedBlocksModel.reportSpec.layoutIntent.items, [
  { blockId: "sharedFilters" },
  { blockId: "activeRefinements" },
  { blockId: "narrativeIntro", size: "half" },
  { blockId: "primaryTable" },
  { blockId: "headlineKpi", size: "half" },
]);

const authoredChartModel = buildReportBuilderRuntimePreviewModel({
  container,
  config,
  state: {
    ...state,
    reportDocumentBlocks: [
      {
        id: "trendChart",
        kind: "chartBlock",
        title: "Trend Chart",
        datasetRef: "primary",
        chartSpec: {
          title: "Trend Chart",
          type: "line",
          xField: "channelV2",
          yFields: ["avails"],
        },
      },
    ],
    reportDocumentLayout: {
      type: "stack",
      items: [
        { blockId: "primaryBuilder" },
        { blockId: "trendChart" },
      ],
    },
  },
});
assert.deepEqual(
  authoredChartModel.document.layout.items.map((item) => item.blockId),
  ["sharedFilters", "activeRefinements", "primaryBuilder", "trendChart"],
);
const authoredChartPreview = buildReportBuilderRuntimePreview({
  model: authoredChartModel,
  rows: [
    { channelV2: "Display", avails: 1200000 },
    { channelV2: "CTV", avails: 980000 },
  ],
  hasMore: false,
});
assert.equal(authoredChartPreview.reportFill.blocks.some((block) => block.kind === "chartBlock" && block.id === "trendChart" && block.content?.chartSpec?.title === "Trend Chart" && block.content?.chartModel?.type === "line"), true);
assert.equal(authoredChartPreview.reportPrint.pages[0].elements.some((element) => element.kind === "svg" && element.id.includes("trendChart")), true);

const authoredComputedChartModel = buildReportBuilderRuntimePreviewModel({
  container,
  config: {
    ...config,
    measures: [
      ...config.measures,
      { id: "hhUniqs", key: "hhUniqs", label: "HH Uniques", format: "compactNumber" },
    ],
    computedMeasures: [
      {
        id: "reachRate",
        key: "reachRate",
        label: "Reach Rate",
        format: "percent",
        compute: {
          type: "ratio",
          numerator: "hhUniqs",
          denominator: "avails",
          scale: 100,
          decimals: 2,
        },
      },
    ],
  },
  state: {
    ...state,
    selectedMeasures: ["avails"],
    primaryMeasure: "avails",
    selectedDimensions: ["channelV2"],
    chartSpec: null,
    reportDocumentBlocks: [
      {
        id: "reachRateChart",
        kind: "chartBlock",
        title: "Reach Rate by Channel",
        datasetRef: "primary",
        chartSpec: {
          title: "Reach Rate by Channel",
          type: "line",
          xField: "channelV2",
          yFields: ["reachRate"],
        },
      },
    ],
    reportDocumentLayout: {
      type: "stack",
      items: [
        { blockId: "primaryBuilder" },
        { blockId: "reachRateChart" },
      ],
    },
  },
});
assert.deepEqual(authoredComputedChartModel.reportSpec.calculatedFields, [
  {
    id: "reachRate",
    key: "reachRate",
    kind: "rowCalc",
    label: "Reach Rate",
    dataType: "number",
    format: "percent",
    datasetRef: "primary",
    dependencies: ["hhUniqs", "avails"],
    compute: {
      type: "ratio",
      numerator: "hhUniqs",
      denominator: "avails",
      scale: 100,
      decimals: 2,
    },
  },
]);
assert.equal(authoredComputedChartModel.reportSpec.datasets[0].request.measures.avails, true);
assert.equal(authoredComputedChartModel.reportSpec.datasets[0].request.measures.hhUniqs, true);
assert.equal(authoredComputedChartModel.reportSpec.datasets[0].request.measures.reachRate, undefined);
const authoredComputedChartPreview = buildReportBuilderRuntimePreview({
  model: authoredComputedChartModel,
  rows: [
    { channelV2: "Display", avails: 12000, hhUniqs: 3000 },
    { channelV2: "CTV", avails: 16000, hhUniqs: 6400 },
  ],
  hasMore: false,
});
assert.equal(authoredComputedChartPreview.reportFill.datasets[0].rows[0].reachRate, 25);
assert.equal(authoredComputedChartPreview.reportFill.datasets[0].rows[1].reachRate, 40);
assert.equal(authoredComputedChartPreview.reportFill.blocks.some((block) => block.kind === "chartBlock" && block.id === "reachRateChart" && block.content?.chartModel?.series?.values?.[0]?.value === "reachRate"), true);
assert.equal(authoredComputedChartPreview.reportPrint.pages[0].elements.some((element) => element.kind === "svg" && element.id.includes("reachRateChart")), true);

const authoredGeoModel = buildReportBuilderRuntimePreviewModel({
  container,
  config,
  state: {
    ...state,
    reportDocumentBlocks: [
      {
        id: "stateGeo",
        kind: "geoMapBlock",
        title: "State Geo",
        datasetRef: "primary",
        geo: {
          shape: "us-states",
          key: "country",
          metric: {
            key: "avails",
            label: "Avails",
            format: "compact",
          },
          aggregate: "sum",
        },
      },
    ],
    reportDocumentLayout: {
      type: "stack",
      items: [
        { blockId: "primaryBuilder" },
        { blockId: "stateGeo" },
      ],
    },
  },
});
assert.deepEqual(
  authoredGeoModel.document.layout.items.map((item) => item.blockId),
  ["sharedFilters", "activeRefinements", "primaryBuilder", "stateGeo"],
);
const authoredGeoPreview = buildReportBuilderRuntimePreview({
  model: authoredGeoModel,
  rows: [
    { country: "CA", avails: 1200000 },
    { country: "WA", avails: 980000 },
  ],
  hasMore: false,
});
assert.equal(authoredGeoPreview.reportFill.blocks.some((block) => block.kind === "geoMapBlock" && block.id === "stateGeo" && block.content?.resolvedGeo?.summary?.regionCount === 2), true);
assert.equal(authoredGeoPreview.reportPrint.pages[0].elements.some((element) => element.kind === "svg" && element.id.includes("stateGeo")), true);
assert.equal(validateReportExportRequest(authoredGeoPreview.exportRequest).valid, true);
const authoredGeoSvg = authoredGeoPreview.reportPrint.pages
  .flatMap((page) => page.elements || [])
  .find((element) => element.kind === "svg" && element.id.includes("stateGeo"))?.svg || "";
assert.equal(authoredGeoSvg.includes("2 Regions"), true);
assert.equal(authoredGeoSvg.includes("Total Avails: 2,180,000"), true);
assert.equal(authoredGeoSvg.includes("Top Regions"), true);
assert.equal(authoredGeoSvg.includes("CA"), true);
assert.equal(authoredGeoSvg.includes("WA"), true);

const semanticDiagnosticsPreview = buildReportBuilderRuntimePreview({
  model,
  rows: [
    { channelV2: "Display", publisherId: "Acme Media", avails: 1250000 },
  ],
  hasMore: false,
  additionalDiagnostics: [
    {
      code: "semanticProviderDiagnostics",
      severity: "warning",
      message: "The semantic provider returned 1 diagnostic for the current selection.",
    },
    {
      code: "semanticGovernance",
      severity: "info",
      message: "Audience Age Group • Draft",
    },
  ],
});
assert.deepEqual(semanticDiagnosticsPreview.reportFill.diagnostics, [
  {
    code: "semanticProviderDiagnostics",
    severity: "warning",
    message: "The semantic provider returned 1 diagnostic for the current selection.",
  },
  {
    code: "semanticGovernance",
    severity: "info",
    message: "Audience Age Group • Draft",
  },
]);
assert.equal(semanticDiagnosticsPreview.runtimeBlock.dashboard.reportRuntime.reportFill.diagnostics.length, 2);

const dedupedSemanticDiagnosticsPreview = buildReportBuilderRuntimePreview({
  model,
  rows: [
    { channelV2: "Display", publisherId: "Acme Media", avails: 1250000 },
  ],
  hasMore: false,
  additionalDiagnostics: [
    {
      code: "semanticProviderDiagnostics",
      severity: "warning",
      message: "The semantic provider returned 1 diagnostic for the current selection.",
    },
    {
      code: "semanticProviderDiagnostics",
      severity: "warning",
      message: "The semantic provider returned 1 diagnostic for the current selection.",
    },
    {
      code: "semanticGovernance",
      severity: "info",
      message: "Audience Age Group • Draft",
    },
  ],
});
assert.deepEqual(dedupedSemanticDiagnosticsPreview.reportFill.diagnostics, [
  {
    code: "semanticProviderDiagnostics",
    severity: "warning",
    message: "The semantic provider returned 1 diagnostic for the current selection.",
  },
  {
    code: "semanticGovernance",
    severity: "info",
    message: "Audience Age Group • Draft",
  },
]);

const authoredBarsModel = buildReportBuilderRuntimePreviewModel({
  container,
  config,
  state: {
    ...state,
    reportDocumentBlocks: [
      {
        id: "scopeFilters",
        kind: "filterBarBlock",
        title: "Inventory Scope",
        paramIds: ["dateRange"],
      },
      {
        id: "trail",
        kind: "refinementBarBlock",
        title: "Inventory Trail",
        actionKinds: ["remove", "clearAll"],
        emptyLabel: "No drill path selected",
      },
    ],
    reportDocumentLayout: {
      type: "stack",
      items: [
        { blockId: "scopeFilters" },
        { blockId: "primaryBuilder" },
        { blockId: "trail" },
      ],
    },
  },
});
assert.deepEqual(
  authoredBarsModel.document.layout.items.map((item) => item.blockId),
  ["scopeFilters", "primaryBuilder", "trail"],
);
const authoredBarsPreview = buildReportBuilderRuntimePreview({
  model: authoredBarsModel,
  rows: [
    { channelV2: "Display", avails: 1200000 },
  ],
  hasMore: false,
});
assert.equal(authoredBarsPreview.reportFill.blocks[0].kind, "filterBarBlock");
assert.equal(authoredBarsPreview.reportFill.blocks.some((block) => block.kind === "refinementBarBlock" && block.id === "trail"), true);
assert.equal(authoredBarsPreview.reportFill.blocks.filter((block) => block.kind === "filterBarBlock").length, 1);
assert.equal(authoredBarsPreview.reportFill.blocks.filter((block) => block.kind === "refinementBarBlock").length, 1);
assert.equal(authoredBarsPreview.reportPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.scopeFilters"), true);

const localCalculatedModel = buildReportBuilderRuntimePreviewModel({
  container,
  config: {
    ...config,
    measures: [
      ...config.measures,
      { id: "hhUniqs", key: "hhUniqs", label: "HH Uniques", format: "compactNumber" },
    ],
  },
  state: {
    ...state,
    selectedMeasures: ["reachRate"],
    primaryMeasure: "reachRate",
    chartSpec: {
      title: "Reach Rate by Date",
      type: "line",
      xField: "eventDate",
      yFields: ["reachRate"],
    },
    localCalculatedFields: [
      {
        id: "reachRate",
        key: "reachRate",
        kind: "rowCalc",
        label: "Reach Rate",
        dataType: "number",
        format: "percent",
        datasetRef: "primary",
        dependencies: ["hhUniqs", "avails"],
        expr: "if(avails = 0, null, round((hhUniqs / avails) * 100, 2))",
      },
    ],
  },
});
assert.equal(localCalculatedModel.reportSpec.calculatedFields[0].id, "reachRate");
assert.equal(localCalculatedModel.reportSpec.calculatedFields[0].kind, "rowCalc");
assert.equal(
  localCalculatedModel.reportSpec.blocks.find((block) => block.kind === "tableBlock")?.columns?.some((column) => column.key === "reachRate"),
  true,
);

const localCalculatedPreview = buildReportBuilderRuntimePreview({
  model: localCalculatedModel,
  rows: [
    { eventDate: "2025-05-01", channelV2: "Display", avails: 12000, hhUniqs: 3000 },
    { eventDate: "2025-05-02", channelV2: "CTV", avails: 16000, hhUniqs: 6400 },
  ],
  hasMore: false,
});
assert.equal(localCalculatedPreview.reportFill.datasets[0].rows[0].reachRate, 25);
assert.equal(localCalculatedPreview.reportFill.datasets[0].rows[1].reachRate, 40);
assert.equal(
  localCalculatedPreview.reportFill.blocks.find((block) => block.kind === "tableBlock")?.content?.columns?.some((column) => column.key === "reachRate"),
  true,
);

const localTableCalcModel = buildReportBuilderRuntimePreviewModel({
  container,
  config,
  state: {
    ...state,
    selectedDimensions: ["channelV2"],
    selectedMeasures: ["reachShare"],
    primaryMeasure: "reachShare",
    viewMode: "table",
    chartSpec: null,
    localTableCalculations: [
      {
        id: "reachShare",
        key: "reachShare",
        kind: "tableCalc",
        label: "Reach Share",
        dataType: "number",
        format: "percent",
        datasetRef: "primary",
        dependencies: ["avails"],
        compute: {
          type: "percentOfTotal",
          sourceField: "avails",
          scale: 100,
          decimals: 2,
        },
      },
    ],
  },
});
assert.equal(localTableCalcModel.reportSpec.calculatedFields[0].id, "reachShare");
assert.equal(localTableCalcModel.reportSpec.calculatedFields[0].kind, "tableCalc");
assert.equal(
  localTableCalcModel.reportSpec.blocks.find((block) => block.kind === "tableBlock")?.columns?.some((column) => column.key === "reachShare"),
  true,
);

const localTableCalcPreview = buildReportBuilderRuntimePreview({
  model: localTableCalcModel,
  rows: [
    { channelV2: "Display", avails: 100 },
    { channelV2: "CTV", avails: 300 },
  ],
  hasMore: false,
});
assert.equal(localTableCalcPreview.reportFill.datasets[0].rows[0].reachShare, 25);
assert.equal(localTableCalcPreview.reportFill.datasets[0].rows[1].reachShare, 75);
assert.equal(
  localTableCalcPreview.reportFill.blocks.find((block) => block.kind === "tableBlock")?.content?.columns?.some((column) => column.key === "reachShare"),
  true,
);

const authoredDerivedTableModel = buildReportBuilderRuntimePreviewModel({
  container,
  config: {
    ...config,
    measures: [
      ...config.measures,
      { id: "hhUniqs", key: "hhUniqs", label: "HH Uniques", format: "compactNumber" },
    ],
  },
  state: {
    ...state,
    selectedMeasures: ["avails"],
    primaryMeasure: "avails",
    selectedDimensions: ["eventDate"],
    viewMode: "table",
    chartSpec: null,
    localCalculatedFields: [
      {
        id: "reachRate",
        key: "reachRate",
        kind: "rowCalc",
        label: "Reach Rate",
        dataType: "number",
        format: "percent",
        datasetRef: "primary",
        dependencies: ["hhUniqs", "avails"],
        expr: "if(avails = 0, null, round((hhUniqs / avails) * 100, 2))",
      },
    ],
    reportDocumentBlocks: [
      {
        id: "reachRateTable",
        kind: "tableBlock",
        title: "Reach Rate Table",
        datasetRef: "primary",
        columns: [
          { key: "channelV2", label: "Channel" },
          { key: "reachRate", label: "Reach Rate", format: "percent" },
        ],
      },
    ],
    reportDocumentLayout: {
      type: "stack",
      items: [
        { blockId: "primaryBuilder" },
        { blockId: "reachRateTable" },
      ],
    },
  },
});
const authoredReachRateTableSpec = authoredDerivedTableModel.reportSpec.blocks.find((block) => block.id === "reachRateTable");
assert.deepEqual(authoredReachRateTableSpec?.columns, [
  {
    key: "channelV2",
    sourceKey: "channelV2",
    displayKey: "channelV2",
    label: "Channel",
    runtimeFilterable: true,
  },
  {
    key: "reachRate",
    sourceKey: "reachRate",
    displayKey: "reachRate",
    label: "Reach Rate",
    format: "percent",
  },
]);

const authoredDerivedTablePreview = buildReportBuilderRuntimePreview({
  model: authoredDerivedTableModel,
  rows: [
    { eventDate: "2025-05-01", channelV2: "Display", avails: 12000, hhUniqs: 3000 },
    { eventDate: "2025-05-02", channelV2: "CTV", avails: 16000, hhUniqs: 6400 },
  ],
  hasMore: false,
});
assert.equal(authoredDerivedTablePreview.reportFill.datasets[0].rows[0].reachRate, 25);
assert.equal(authoredDerivedTablePreview.reportFill.datasets[0].rows[1].reachRate, 40);
const authoredReachRateTableBlock = authoredDerivedTablePreview.reportFill.blocks.find((block) => block.id === "reachRateTable");
const authoredReachRateTableFields = resolveReportRuntimeRefinementFields(
  authoredDerivedTableModel.reportSpec,
  authoredReachRateTableBlock,
);
assert.deepEqual(authoredReachRateTableFields, [
  {
    key: "channelV2",
    valueKey: "channelV2",
    displayValueKey: "channelV2",
    label: "Channel",
    runtimeFilterable: true,
  },
]);
const authoredReachRateTableProvider = resolveReportRuntimeDrillMetadataProvider({
  reportSpec: authoredDerivedTableModel.reportSpec,
  runtimeHandlers: {},
});
const authoredReachRateTableProviderActions = await authoredReachRateTableProvider.listAvailableRefinements(
  authoredReachRateTableBlock.kind,
  "channelV2",
  {
    reportSpec: authoredDerivedTableModel.reportSpec,
    block: authoredReachRateTableBlock,
  },
);
const authoredReachRateTableActionsByField = new Map([
  ["reachRateTable:channelV2", Array.isArray(authoredReachRateTableProviderActions) ? authoredReachRateTableProviderActions : []],
]);
const authoredReachRateTableInteraction = buildReportRuntimeTableInteractionState({
  blockId: "reachRateTable",
  fields: authoredReachRateTableFields,
  providerActionsByField: authoredReachRateTableActionsByField,
});
assert.deepEqual(authoredReachRateTableInteraction.actions.map((action) => ({
  id: action.id,
  label: action.label,
  kind: action.kind,
})), [
  { id: "keep:channelV2", label: "Keep only", kind: "keep" },
  { id: "exclude:channelV2", label: "Exclude", kind: "exclude" },
  { id: "drill:channelV2:publisherId", label: "Drill to Publisher", kind: "drill" },
]);
const authoredReachRateTableDrillExecution = authoredReachRateTableInteraction.actions.find((action) => action.kind === "drill")?.resolveExecution({
  channelV2: "Display",
}) || null;
assert.deepEqual(authoredReachRateTableDrillExecution, {
  id: "drill:channelV2:publisherId",
  label: "Drill to Publisher",
  kind: "drill",
  transition: {
    sourceField: "channelV2",
    nextFieldRef: "publisherId",
    sourceBlockId: "reachRateTable",
  },
  refinement: {
    op: "drill",
    field: "channelV2",
    value: "Display",
    sourceBlockId: "reachRateTable",
    fieldLabel: "Channel",
    label: "Drill to Publisher = Display",
  },
});
let authoredReachRateTableInteractionState = createReportRuntimeInteractionState();
const authoredReachRateTableExecutionResult = executeReportRuntimeAction(authoredReachRateTableDrillExecution, {
  applyRefinement(refinement) {
    authoredReachRateTableInteractionState = applyReportRuntimeInteractionRefinement(authoredReachRateTableInteractionState, refinement);
    return authoredReachRateTableInteractionState;
  },
  applyDrillTransition(payload) {
    authoredReachRateTableInteractionState = applyReportRuntimeInteractionDrillTransition(authoredReachRateTableInteractionState, payload);
    return authoredReachRateTableInteractionState;
  },
});
assert.equal(authoredReachRateTableExecutionResult.executed, true);
assert.deepEqual(authoredReachRateTableInteractionState.drillTransitions, [
  {
    refinementId: "drill:channelV2:reachRateTable",
    sourceField: "channelV2",
    nextFieldRef: "publisherId",
    sourceBlockId: "reachRateTable",
  },
]);
const authoredReachRateTableDrilledModel = buildReportBuilderRuntimePreviewModel({
  container,
  config: {
    ...config,
    measures: [
      ...config.measures,
      { id: "hhUniqs", key: "hhUniqs", label: "HH Uniques", format: "compactNumber" },
    ],
  },
  state: {
    ...state,
    selectedMeasures: ["avails"],
    primaryMeasure: "avails",
    selectedDimensions: ["eventDate"],
    viewMode: "table",
    chartSpec: null,
    localCalculatedFields: [
      {
        id: "reachRate",
        key: "reachRate",
        kind: "rowCalc",
        label: "Reach Rate",
        dataType: "number",
        format: "percent",
        datasetRef: "primary",
        dependencies: ["hhUniqs", "avails"],
        expr: "if(avails = 0, null, round((hhUniqs / avails) * 100, 2))",
      },
    ],
    reportDocumentBlocks: [
      {
        id: "reachRateTable",
        kind: "tableBlock",
        title: "Reach Rate Table",
        datasetRef: "primary",
        columns: [
          { key: "channelV2", label: "Channel" },
          { key: "reachRate", label: "Reach Rate", format: "percent" },
        ],
      },
    ],
    reportDocumentLayout: {
      type: "stack",
      items: [
        { blockId: "primaryBuilder" },
        { blockId: "reachRateTable" },
      ],
    },
  },
  refinements: authoredReachRateTableInteractionState.refinements,
  drillTransitions: authoredReachRateTableInteractionState.drillTransitions,
});
assert.deepEqual(authoredReachRateTableDrilledModel.reportSpec.datasets[0].request.filters.includeChannelV2, ["Display"]);
assert.equal(authoredReachRateTableDrilledModel.reportSpec.datasets[0].request.dimensions.publisherId, true);
assert.equal(authoredReachRateTableDrilledModel.reportSpec.blocks.find((block) => block.id === "reachRateTable")?.columns?.some((column) => column.key === "reachRate"), true);

console.log("reportBuilderRuntimePreview ✓ compiles builder state into authored runtime report contracts");

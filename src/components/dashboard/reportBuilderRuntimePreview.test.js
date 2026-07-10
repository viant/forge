import assert from "node:assert/strict";

import {
  buildReportBuilderRuntimePreviewArtifacts,
  buildReportBuilderRuntimePreview,
  buildReportBuilderRuntimePreviewModel,
  resolveReportBuilderRuntimeChartCapability,
  resolveReportBuilderRuntimeGeoCapability,
  resolveReportBuilderRuntimeRefinementCapability,
  resolveReportBuilderRuntimeScopeCapability,
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
  id: "capacityBuilder",
  stateKey: "capacityBuilder",
  title: "Capacity Builder",
  dataSourceRef: "capacity_cube_report",
};

const config = {
  dataSourceRef: "capacity_cube_report",
  staticFilters: [
    { id: "dateRange", field: "dateRange", label: "Date Range", type: "dateRange", semanticRef: "reporting_window" },
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
        id: "capacity_inventory",
        label: "Capacity Inventory",
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
  scopeParams: {
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
  label: "Channel = Display",
}];

const drillTransitions = [{
  refinementId: "drill:channelV2:publisherId",
  sourceField: "channelV2",
  nextFieldRef: "publisherId",
  sourceBlockId: "primaryTable",
}];

const semanticSummary = {
  kind: "semantic",
  modelRef: "model://example/performance/delivery@v1",
  modelLabel: "Ad Delivery",
  entity: "line_delivery",
  entityLabel: "Line Delivery",
  selectedDimensions: [
    { id: "channel", rawId: "channelV2", label: "Channel" },
  ],
  selectedMeasures: [
    { id: "available_impressions", rawId: "avails", label: "Available Impressions", format: "compactNumber" },
  ],
  selectedParameters: [
    { id: "reporting_window", rawId: "dateRange", label: "Reporting Window" },
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
assert.equal(model.semanticBindingViewState.title, "Semantic Binding");
assert.equal(model.semanticBindingViewState.chips.includes("Measures Available Impressions"), true);
assert.equal(model.semanticBindingViewState.fieldGroups[0].fields[0].label, "Channel");
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
  columnKeys: ["channelV2", "avails"],
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
  columnKeys: ["channelV2", "avails"],
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

const stateBackedDrillModel = buildReportBuilderRuntimePreviewModel({
  container,
  config: {
    ...config,
    drillMetadata: undefined,
  },
  state: {
    ...state,
    drillMetadata: {
      hierarchies: [
        {
          id: "hierarchy:channelV2::publisherId::siteType",
          label: "Channel Drill",
          levels: [
            { field: "channelV2", label: "Channel" },
            { field: "publisherId", label: "Publisher" },
            { field: "siteType", label: "Site Type" },
          ],
        },
      ],
      detailTargets: [
        {
          targetRef: "target://example/publisher-detail",
          navigationMode: "hostRoute",
          title: "Publisher detail",
          parameters: {
            publisher: "$value",
          },
        },
      ],
      fieldActions: [
        {
          fieldRef: "publisherId",
          actions: [
            {
              id: "detail:publisherId:target:_example_publisher-detail",
              label: "Show Publisher details",
              kind: "detail",
              targetRef: "target://example/publisher-detail",
            },
          ],
        },
      ],
    },
  },
  refinements: [],
  drillTransitions: [],
});

assert.deepEqual(stateBackedDrillModel.reportSpec.drillMetadata, {
  hierarchies: [
    {
      id: "hierarchy:channelV2::publisherId::siteType",
      label: "Channel Drill",
      levels: [
        { id: "channelV2", field: "channelV2", label: "Channel" },
        { id: "publisherId", field: "publisherId", label: "Publisher" },
        { id: "siteType", field: "siteType", label: "Site Type" },
      ],
    },
  ],
  detailTargets: [
    {
      targetRef: "target://example/publisher-detail",
      navigationMode: "hostRoute",
      title: "Publisher detail",
      parameters: {
        publisher: "$value",
      },
    },
  ],
  fieldActions: [
    {
      fieldRef: "publisherId",
      actions: [
        {
          id: "detail:publisherId:target:_example_publisher-detail",
          label: "Show Publisher details",
          kind: "detail",
          targetRef: "target://example/publisher-detail",
        },
      ],
    },
  ],
});

const stateBackedDrillProvider = resolveReportRuntimeDrillMetadataProvider({
  reportSpec: stateBackedDrillModel.reportSpec,
  runtimeHandlers: {},
});

assert.deepEqual(await stateBackedDrillProvider.listAvailableRefinements("tableBlock", "channelV2"), [
  { id: "keep:channelV2", label: "Keep only", kind: "keep" },
  { id: "exclude:channelV2", label: "Exclude", kind: "exclude" },
  { id: "drill:channelV2:publisherId", label: "Drill to Publisher", kind: "drill", nextFieldRef: "publisherId" },
]);
assert.deepEqual(await stateBackedDrillProvider.listAvailableRefinements("tableBlock", "publisherId"), [
  { id: "keep:publisherId", label: "Keep only", kind: "keep" },
  { id: "exclude:publisherId", label: "Exclude", kind: "exclude" },
  { id: "drill:publisherId:siteType", label: "Drill to Site Type", kind: "drill", nextFieldRef: "siteType" },
  { id: "detail:publisherId:target:_example_publisher-detail", label: "Show Publisher details", kind: "detail", targetRef: "target://example/publisher-detail" },
]);
assert.deepEqual(await stateBackedDrillProvider.getDetailTarget("target://example/publisher-detail"), {
  targetRef: "target://example/publisher-detail",
  navigationMode: "hostRoute",
  title: "Publisher detail",
  parameters: {
    publisher: "$value",
  },
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
  columnKeys: ["channelV2", "avails"],
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
  columnKeys: ["publisherId", "avails"],
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

assert.deepEqual(resolveReportBuilderRuntimeScopeCapability({
  reportSpec: {
    title: "Thin Runtime Scope",
    scope: {
      params: [],
    },
  },
  reportDocument: {
    title: "Document Backed Runtime Scope",
    scope: {
      params: [
        {
          id: "dateRange",
          label: "Reporting Window",
        },
      ],
    },
  },
}), {
  supported: true,
  paramIds: ["dateRange"],
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
    targetRef: "target://example/performance/publisher-detail",
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
assert.equal(preview.exportRequest.source.artifactRef, "dashboard.reportBuilder://capacityBuilder");
assert.equal(validateReportExportRequest(preview.exportRequest).valid, true);
assert.equal(preview.exportRequest.reportPrint.pageGeometry.width, 792);
assert.equal(preview.exportRequest.reportPrint.pageGeometry.height, 612);
assert.equal(preview.reportFill.datasets[0].rows[0].publisherId, "Acme Media");
assert.equal(preview.reportFill.datasets[0].provenance.hasMore, true);
assert.equal(preview.runtimeBlock.kind, "dashboard.reportRuntime");
assert.equal(preview.semanticBindingViewState.title, "Semantic Binding");
assert.equal(previewArtifacts.semanticBindingViewState.title, "Semantic Binding");
assert.equal(preview.runtimeBlock.dashboard.reportRuntime.semanticBindingViewState.title, "Semantic Binding");
assert.equal(preview.runtimeBlock.dashboard.reportRuntime.semanticBindingViewState.chips.includes("Measures Available Impressions"), true);
assert.equal(preview.runtimeBlock.dashboard.reportRuntime.reportPrint.kind, "reportPrint");
assert.equal(preview.runtimeBlock.title, "Executive Snapshot");
assert.equal(preview.runtimeBlock.subtitle, "Weekly Rollup");
assert.equal(preview.runtimeBlock.dashboard.reportRuntime.reportSpec.semanticSummary.entityLabel, "Line Delivery");
assert.equal(preview.runtimeBlock.dashboard.reportRuntime.reportSpec.semanticSummary.selectedParameters[0].label, "Reporting Window");
assert.equal(preview.runtimeBlock.dashboard.reportRuntime.reportSpec.datasets[0].request.dimensions.publisherId, true);
assert.deepEqual(previewWithHostIntent.exportRequest, preview.exportRequest);
assert.deepEqual(previewWithHostIntent.reportPrint, preview.reportPrint);
assert.deepEqual(previewWithHostIntent.runtimeBlock.dashboard.reportRuntime.hostIntent, {
  intentKind: "detailTarget",
  targetRef: "target://example/performance/publisher-detail",
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

const canonicalDocumentPreviewModel = {
  ...model,
  semanticBindingViewState: null,
  document: {
    ...model.document,
    semanticSummary: {
      kind: "semantic",
      modelRef: "model://example/performance/delivery@v1",
      modelLabel: "Canonical Ad Delivery",
      entity: "line_delivery",
      entityLabel: "Canonical Line Delivery",
      selectedDimensions: [
        { id: "channel", rawId: "channelV2", label: "Canonical Channel", category: "Delivery" },
      ],
      selectedMeasures: [
        { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions", format: "compactNumber" },
      ],
      selectedParameters: [
        { id: "reporting_window", rawId: "dateRange", label: "Canonical Reporting Window" },
      ],
    },
  },
  reportSpec: {
    ...model.reportSpec,
    semanticSummary: {
      kind: "semantic",
      modelRef: "model://example/performance/delivery@v1",
      entity: "line_delivery",
      selectedDimensions: ["channel"],
      selectedMeasures: ["available_impressions"],
      selectedParameters: ["reporting_window"],
    },
  },
};

const canonicalDocumentPreviewArtifacts = buildReportBuilderRuntimePreviewArtifacts({
  model: canonicalDocumentPreviewModel,
  rows: [
    { channelV2: "Display", publisherId: "Acme Media", avails: 1250000 },
  ],
  hasMore: false,
});

const canonicalDocumentPreview = buildReportBuilderRuntimePreview({
  model: canonicalDocumentPreviewModel,
  rows: [
    { channelV2: "Display", publisherId: "Acme Media", avails: 1250000 },
  ],
  hasMore: false,
});

assert.equal(canonicalDocumentPreviewArtifacts.reportSpec.semanticSummary.modelLabel, "Canonical Ad Delivery");
assert.equal(canonicalDocumentPreviewArtifacts.reportSpec.semanticSummary.entityLabel, "Canonical Line Delivery");
assert.equal(canonicalDocumentPreviewArtifacts.reportSpec.semanticSummary.selectedDimensions[0].label, "Canonical Channel");
assert.equal(canonicalDocumentPreviewArtifacts.reportSpec.semanticSummary.selectedMeasures[0].label, "Canonical Available Impressions");
assert.equal(canonicalDocumentPreviewArtifacts.reportSpec.semanticSummary.selectedParameters[0].label, "Canonical Reporting Window");
assert.equal(canonicalDocumentPreviewArtifacts.semanticBindingViewState.chips.includes("Model Canonical Ad Delivery"), true);
assert.equal(canonicalDocumentPreviewArtifacts.semanticBindingViewState.chips.includes("Entity Canonical Line Delivery"), true);
assert.equal(canonicalDocumentPreviewArtifacts.semanticBindingViewState.chips.includes("Dimensions Canonical Channel"), true);
assert.equal(canonicalDocumentPreviewArtifacts.semanticBindingViewState.chips.includes("Measures Canonical Available Impressions"), true);
assert.equal(canonicalDocumentPreview.exportRequest.reportSpec.semanticSummary.modelLabel, "Canonical Ad Delivery");
assert.equal(canonicalDocumentPreview.runtimeBlock.dashboard.reportRuntime.reportSpec.semanticSummary.selectedMeasures[0].label, "Canonical Available Impressions");

const richerCarriedPreviewModel = {
  ...canonicalDocumentPreviewModel,
  semanticBindingViewState: {
    title: "Semantic Binding",
    modelLabel: "Carried Ad Delivery",
    entityLabel: "Carried Line Delivery",
    chips: [
      "Model Carried Ad Delivery",
      "Entity Carried Line Delivery",
      "Dimensions Carried Delivery Date",
      "Measures Carried Available Impressions",
    ],
    fieldGroups: [
      {
        id: "dimensions",
        title: "Selected dimensions (1)",
        fields: [
          {
            id: "event_date",
            rawId: "eventDate",
            label: "Carried Delivery Date",
            category: "Time",
            definitionRef: "semantic://example/event_date",
          },
        ],
      },
      {
        id: "measures",
        title: "Selected measures (1)",
        fields: [
          {
            id: "available_impressions",
            rawId: "avails",
            label: "Carried Available Impressions",
            format: "compactNumber",
            definitionRef: "semantic://example/available_impressions",
          },
        ],
      },
    ],
  },
};

const richerCarriedPreviewArtifacts = buildReportBuilderRuntimePreviewArtifacts({
  model: richerCarriedPreviewModel,
  rows: [
    { channelV2: "Display", publisherId: "Acme Media", avails: 1250000 },
  ],
  hasMore: false,
});

const richerCarriedPreview = buildReportBuilderRuntimePreview({
  model: richerCarriedPreviewModel,
  rows: [
    { channelV2: "Display", publisherId: "Acme Media", avails: 1250000 },
  ],
  hasMore: false,
});

assert.deepEqual(richerCarriedPreviewArtifacts.semanticBindingViewState.chips, [
  "Model Carried Ad Delivery",
  "Entity Carried Line Delivery",
  "Dimensions Carried Delivery Date",
  "Measures Carried Available Impressions",
]);
assert.equal(richerCarriedPreview.runtimeBlock.dashboard.reportRuntime.semanticBindingViewState.chips.includes("Model Carried Ad Delivery"), true);
assert.equal(richerCarriedPreview.exportRequest.reportSpec.semanticSummary.modelLabel, "Canonical Ad Delivery");

const semanticBinding = {
  mode: "semantic",
  modelRef: "model://example/performance/delivery@v1",
  entity: "line_delivery",
  selectedDimensions: ["channelV2"],
  selectedMeasures: ["avails"],
};

const semanticModel = {
  modelRef: "model://example/performance/delivery@v1",
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
      parameters: [
        {
          id: "reporting_window",
          label: "Reporting Window",
          description: "Approved reporting window",
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

assert.equal(providerResolvedModel.reportSpec.binding.modelRef, "model://example/performance/delivery@v1");
assert.equal(providerResolvedModel.reportSpec.semanticSummary.modelLabel, "Ad Delivery");
assert.equal(providerResolvedModel.reportSpec.semanticSummary.entityLabel, "Line Delivery");
assert.equal(providerResolvedModel.reportSpec.semanticSummary.selectedMeasures[0].label, "Available Impressions");
assert.equal(providerResolvedModel.reportSpec.semanticSummary.selectedParameters[0].label, "Reporting Window");
assert.equal(providerResolvedModel.reportSpec.scope.params[0].label, "Reporting Window");
assert.equal(providerResolvedModel.reportSpec.scope.params[0].description, "Approved reporting window");
assert.deepEqual(providerResolvedModel.reportSpec.datasets[0].request.semanticSelection.parameters, {
  reporting_window: {
    start: "2025-05-01",
    end: "2025-05-22",
  },
});

const lineageResolvedModel = buildReportBuilderRuntimePreviewModel({
  container,
  config: {
    ...config,
    measures: [
      { id: "avails", key: "avails", semanticRef: "available_impressions", label: "Avails", default: true, format: "compactNumber" },
    ],
    dimensions: [
      {
        id: "publisherId",
        key: "publisherId",
        semanticRef: "publisher",
        label: "Publisher",
      },
    ],
  },
  state: {
    ...state,
    selectedDimensions: ["publisherId"],
    binding: {
      mode: "semantic",
      modelRef: "model://example/performance/delivery@v1",
      entity: "line_delivery",
      selectedDimensions: ["publisher"],
      selectedMeasures: ["available_impressions"],
    },
  },
  binding: {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["publisher"],
    selectedMeasures: ["available_impressions"],
  },
  semanticModel: {
    modelRef: "model://example/performance/delivery@v1",
    version: 1,
    label: "Ad Delivery",
    description: "Governed semantic projection for runtime preview.",
    entities: [
      {
        id: "line_delivery",
        label: "Line Delivery",
        dimensions: [
          {
            id: "publisher",
            label: "Publisher",
            category: "Inventory",
            definitionRef: "harmonizer://feature/publisher",
            governance: {
              status: "approved",
              certification: "reviewed",
              classification: "harmonizer.audience",
            },
          },
        ],
        measures: [
          {
            id: "available_impressions",
            label: "Available Impressions",
            category: "Metrics",
            format: "compactNumber",
          },
        ],
      },
    ],
  },
});

assert.equal(lineageResolvedModel.reportSpec.semanticSummary.selectedDimensions[0].category, "Inventory");
assert.equal(lineageResolvedModel.reportSpec.semanticSummary.selectedDimensions[0].definitionRef, "harmonizer://feature/publisher");
assert.deepEqual(lineageResolvedModel.reportSpec.semanticSummary.selectedDimensions[0].governance, {
  status: "approved",
  certification: "reviewed",
  classification: "harmonizer.audience",
});

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

const authoredOnlyBlocksModel = buildReportBuilderRuntimePreviewModel({
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
  includePrimaryBlocks: false,
});
assert.deepEqual(
  authoredOnlyBlocksModel.document.layout.items.map((item) => item.blockId),
  ["sharedFilters", "narrativeIntro", "headlineKpi"],
);
assert.deepEqual(
  authoredOnlyBlocksModel.reportSpec.blocks.map((block) => block.id),
  ["sharedFilters", "narrativeIntro", "headlineKpi"],
);
assert.equal(
  authoredOnlyBlocksModel.reportSpec.blocks.some((block) => block.id === "primaryTable" || block.id === "primaryChart"),
  false,
);
assert.equal(authoredOnlyBlocksModel.reportSpec.datasets.some((dataset) => dataset.id === "primary"), true);
assert.equal(authoredOnlyBlocksModel.reportSpec.datasets[0].request.dimensions.channelV2, true);
const authoredOnlyBlocksPreview = buildReportBuilderRuntimePreview({
  model: authoredOnlyBlocksModel,
  rows: [
    { channelV2: "Display", avails: 1200000 },
  ],
  hasMore: false,
});
assert.deepEqual(
  authoredOnlyBlocksPreview.document.layout.items.map((item) => item.blockId),
  ["sharedFilters", "narrativeIntro", "headlineKpi"],
);
assert.equal(authoredOnlyBlocksPreview.reportFill.blocks.some((block) => block.id === "primaryTable" || block.id === "primaryChart"), false);
assert.equal(authoredOnlyBlocksPreview.reportFill.blocks.some((block) => block.kind === "markdownBlock" && block.id === "narrativeIntro"), true);
assert.equal(authoredOnlyBlocksPreview.reportFill.blocks.some((block) => block.kind === "kpiBlock" && block.id === "headlineKpi" && block.content?.value === 1200000), true);

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

const semanticRequestError = new Error("Semantic model metadata failed. Retry loading the semantic model or choose a different semantic binding.");
semanticRequestError.diagnostics = [
  {
    code: "semanticModelError",
    severity: "error",
    path: "selection.modelRef",
    message: "Semantic model metadata failed.",
    suggestedFix: "Retry loading the semantic model or choose a different semantic binding.",
  },
];
const semanticRequestErrorPreview = buildReportBuilderRuntimePreview({
  model,
  rows: [],
  hasMore: false,
  error: semanticRequestError,
});
assert.deepEqual(semanticRequestErrorPreview.reportFill.diagnostics, [
  {
    code: "semanticModelError",
    severity: "error",
    path: "selection.modelRef",
    message: "Semantic model metadata failed.",
    suggestedFix: "Retry loading the semantic model or choose a different semantic binding.",
  },
]);

const transportTimeoutError = new Error('GET error: 500 Internal Server Error: code: -32603, message: code: -32603, message: failed to send request: Post "http://steward.viantinc.com:5000/mcp": dial tcp 10.55.130.249:5000: i/o timeout, data: [123]');
const transportTimeoutPreview = buildReportBuilderRuntimePreview({
  model,
  rows: [],
  hasMore: false,
  error: transportTimeoutError,
});
assert.deepEqual(transportTimeoutPreview.reportFill.diagnostics, [
  {
    code: "runtimePreviewError",
    severity: "error",
    message: "The reporting service at http://steward.viantinc.com:5000/mcp did not respond in time. Try again after the service is available.",
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
const authoredBarsFilterBlock = authoredBarsPreview.reportFill.blocks.find((block) => block.id === "scopeFilters") || null;
assert.equal(authoredBarsFilterBlock?.kind, "filterBarBlock");
assert.equal(authoredBarsPreview.reportFill.blocks.some((block) => block.kind === "refinementBarBlock" && block.id === "trail"), true);
assert.equal(authoredBarsPreview.reportFill.blocks.filter((block) => block.kind === "filterBarBlock").length, 1);
assert.equal(authoredBarsPreview.reportFill.blocks.filter((block) => block.kind === "refinementBarBlock").length, 1);
assert.equal(authoredBarsPreview.reportPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.scopeFilters"), true);
assert.equal(authoredBarsFilterBlock?.content?.params?.[0]?.type, "dateRange");

const interactiveFilterModel = buildReportBuilderRuntimePreviewModel({
  container,
  config: {
    ...config,
    staticFilters: [
      ...config.staticFilters,
      {
        id: "channelIds",
        label: "Channels",
        multiple: true,
        presentation: "compactIconRow",
        options: [
          { value: "Display", label: "Display", icon: "media" },
          { value: "CTV", label: "CTV", icon: "video" },
        ],
      },
    ],
  },
  state: {
    ...state,
    scopeParams: {
      ...state.scopeParams,
      channelIds: ["Display"],
    },
    reportDocumentBlocks: [
      {
        id: "scopeFilters",
        kind: "filterBarBlock",
        title: "Filters",
        paramIds: ["dateRange", "channelIds"],
      },
    ],
    reportDocumentLayout: {
      type: "stack",
      items: [{ blockId: "scopeFilters" }, { blockId: "primaryBuilder" }],
    },
  },
});
const interactiveFilterPreview = buildReportBuilderRuntimePreview({
  model: interactiveFilterModel,
  rows: [
    { channelV2: "Display", avails: 1200000 },
  ],
  hasMore: false,
});
const interactiveScopeFilters = interactiveFilterPreview.reportFill.blocks.find((block) => block.id === "scopeFilters") || null;
assert.equal(interactiveScopeFilters?.content?.params?.[1]?.label, "Channels");
assert.equal(interactiveScopeFilters?.content?.params?.[1]?.multiple, true);
assert.equal(interactiveScopeFilters?.content?.params?.[1]?.presentation, "compactIconRow");
assert.deepEqual(interactiveScopeFilters?.content?.params?.[1]?.options, [
  { value: "Display", label: "Display", icon: "media" },
  { value: "CTV", label: "CTV", icon: "video" },
]);

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
  { id: "keep:channelV2", label: "Keep Channel", kind: "keep" },
  { id: "exclude:channelV2", label: "Exclude Channel", kind: "exclude" },
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
    label: "Channel = Display",
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
    dimensions: config.dimensions.map((dimension) => (
      dimension?.id === "publisherId"
        ? { ...dimension, displayKey: "publisherName" }
        : dimension
    )),
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
assert.deepEqual(
  authoredReachRateTableDrilledModel.reportSpec.blocks.find((block) => block.id === "reachRateTable")?.columns?.[0],
  {
    key: "publisherId",
    sourceKey: "publisherId",
    displayKey: "publisherName",
    label: "Publisher",
  },
);
const authoredReachRateTableDrilledPreview = buildReportBuilderRuntimePreview({
  model: authoredReachRateTableDrilledModel,
  rows: [
    { eventDate: "2025-05-01", channelV2: "Display", publisherId: 506, publisherName: "Acme Media", avails: 12000, hhUniqs: 3000 },
    { eventDate: "2025-05-02", channelV2: "Display", publisherId: 612, publisherName: "North Star Media", avails: 16000, hhUniqs: 6400 },
  ],
  hasMore: false,
});
const authoredReachRateTableDrilledBlock = authoredReachRateTableDrilledPreview.reportFill.blocks.find((block) => block.id === "reachRateTable");
assert.equal(authoredReachRateTableDrilledBlock?.content?.columns?.[0]?.label, "Publisher");
assert.equal(authoredReachRateTableDrilledBlock?.content?.resolvedRows?.[0]?.cells?.[0]?.value, 506);
assert.equal(authoredReachRateTableDrilledBlock?.content?.resolvedRows?.[0]?.cells?.[0]?.displayValue, "Acme Media");

// Regression: drilling into a dimension that has no dedicated runtime filter
// binding (the common case — most drill hierarchy levels are not also wired
// up as quick-filter chips) must still request the drill's source field so
// the client-side "drill" refinement has something to match against. Before
// the fix, only fields with a `runtimeFilter` binding (or the drill target
// field itself) were added to request.dimensions, so the source field was
// silently dropped from the request once its column was replaced by the
// drill target column — producing "No data" instead of a filtered table.
const unboundDrillRefinements = [{
  id: "drill:publisherId:siteType",
  op: "drill",
  field: "publisherId",
  values: ["Acme Media"],
  sourceBlockId: "publisherTable",
  label: "Publisher = Acme Media",
}];
const unboundDrillTransitions = [{
  refinementId: "drill:publisherId:siteType",
  sourceField: "publisherId",
  nextFieldRef: "siteType",
  sourceBlockId: "publisherTable",
}];
const unboundDrillModel = buildReportBuilderRuntimePreviewModel({
  container,
  config,
  state: {
    ...state,
    selectedDimensions: ["publisherId"],
    reportDocumentBlocks: [
      {
        id: "publisherTable",
        kind: "tableBlock",
        title: "Publisher Table",
        datasetRef: "primary",
        columns: [
          { key: "publisherId", label: "Publisher" },
          { key: "avails", label: "Avails" },
        ],
      },
    ],
    reportDocumentLayout: {
      type: "stack",
      items: [
        { blockId: "primaryBuilder" },
        { blockId: "publisherTable" },
      ],
    },
  },
  refinements: unboundDrillRefinements,
  drillTransitions: unboundDrillTransitions,
});
assert.equal(unboundDrillModel.reportSpec.datasets[0].request.dimensions.publisherId, true);
assert.equal(unboundDrillModel.reportSpec.datasets[0].request.dimensions.siteType, true);
assert.equal(unboundDrillModel.reportSpec.datasets[0].request.filters?.includePublisherId, undefined);
const unboundDrillPreview = buildReportBuilderRuntimePreview({
  model: unboundDrillModel,
  rows: [
    { publisherId: "Acme Media", siteType: "App", avails: 12000 },
    { publisherId: "North Star Media", siteType: "Web", avails: 16000 },
  ],
  hasMore: false,
});
const unboundDrillBlock = unboundDrillPreview.reportFill.blocks.find((block) => block.id === "publisherTable");
assert.equal(unboundDrillBlock?.content?.resolvedRows?.length, 1);
assert.equal(unboundDrillBlock?.content?.resolvedRows?.[0]?.cells?.[0]?.value, "App");

console.log("reportBuilderRuntimePreview ✓ compiles builder state into authored runtime report contracts");

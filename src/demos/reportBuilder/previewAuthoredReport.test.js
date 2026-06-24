import assert from "node:assert/strict";

import { validateReportExportRequest, validateReportPrint } from "../../reporting/schema/reportSchemas.js";
import { buildPreviewAuthoredReport } from "./previewAuthoredReport.js";

const container = {
  id: "previewBuilder",
  stateKey: "previewBuilder",
  title: "Preview Report",
  dataSourceRef: "demoReportSource",
};

const config = {
  title: "Preview Report",
  measures: [
    { id: "avails", key: "avails", label: "Avails", default: true, format: "compactNumber" },
  ],
  dimensions: [
    { id: "eventDate", key: "eventDate", label: "Event Date", default: true, chartAxis: true, format: "date" },
    {
      id: "channelV2",
      key: "channelV2",
      label: "Channel",
      runtimeFilter: {
        includeParamPath: "filters.includeChannelV2",
        excludeParamPath: "filters.excludeChannelV2",
      },
    },
    {
      id: "country",
      key: "country",
      label: "Country",
      runtimeFilter: {
        includeParamPath: "filters.includeCountry",
        excludeParamPath: "filters.excludeCountry",
      },
    },
  ],
  staticFilters: [
    {
      id: "dateRange",
      type: "dateRange",
      required: true,
      startParamPath: "filters.From",
      endParamPath: "filters.To",
    },
  ],
  result: {
    chartCreationMode: "explicit",
    defaultMode: "chart",
    pageSize: 50,
    orderFields: [
      { value: "eventDate", field: "eventDate", default: true, defaultDirection: "asc" },
    ],
  },
  binding: {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date", "channel"],
    selectedMeasures: ["available_impressions"],
  },
};

const state = {
  selectedMeasures: ["avails"],
  primaryMeasure: "avails",
  selectedDimensions: ["eventDate", "channelV2"],
  viewMode: "chart",
  chartSpec: {
    title: "Avails by Date",
    type: "line",
    xField: "eventDate",
    yFields: ["avails"],
  },
  orderField: "eventDate",
  orderDir: "asc",
  pageSize: 25,
  staticFilters: {
    dateRange: {
      start: "2026-05-01",
      end: "2026-05-04",
    },
  },
  binding: config.binding,
};

const rows = [
  { eventDate: "2026-05-01", channelV2: "Display", country: "US", avails: 12000 },
  { eventDate: "2026-05-02", channelV2: "CTV", country: "US", avails: 16000 },
];

const semanticSummary = {
  kind: "semantic",
  modelRef: "model://example/performance/delivery@v1",
  modelLabel: "Ad Delivery",
  entity: "line_delivery",
  entityLabel: "Line Delivery",
  selectedDimensions: [
    { id: "event_date", rawId: "eventDate", label: "Event Date" },
    { id: "channel", rawId: "channelV2", label: "Channel" },
  ],
  selectedMeasures: [
    { id: "available_impressions", rawId: "avails", label: "Available Impressions", format: "compactNumber" },
  ],
};

const semanticModel = {
  modelRef: "model://example/performance/delivery@v1",
  version: 1,
  label: "Canonical Ad Delivery",
  entities: [
    {
      id: "line_delivery",
      label: "Canonical Line Delivery",
      dimensions: [
        { id: "event_date", label: "Canonical Delivery Date" },
        { id: "channel", label: "Canonical Channel" },
      ],
      measures: [
        { id: "available_impressions", label: "Canonical Available Impressions", format: "compactNumber" },
      ],
    },
  ],
};

const authored = buildPreviewAuthoredReport({
  container,
  config,
  state,
  rows,
  semanticSummary,
  hasMore: true,
  error: new Error("Semantic validation prevented one preview refresh."),
});

assert.deepEqual(authored.document.layout.items, [
  { blockId: "sharedFilters" },
  { blockId: "activeRefinements" },
  { blockId: "primaryBuilder" },
  { blockId: "headlineKpi" },
  { blockId: "comparisonTable" },
]);
assert.deepEqual(authored.reportSpec.layoutIntent.blockOrder, [
  "sharedFilters",
  "activeRefinements",
  "primaryTable",
  "primaryChart",
  "headlineKpi",
  "comparisonTable",
]);
assert.deepEqual(authored.reportSpec.binding, config.binding);
assert.equal(authored.reportSpec.semanticSummary.modelLabel, "Ad Delivery");
assert.equal(authored.reportFill.datasets[0].provenance.hasMore, true);
assert.deepEqual(authored.reportFill.diagnostics, [
  {
    code: "runtimePreviewError",
    severity: "error",
    message: "Semantic validation prevented one preview refresh.",
  },
]);
assert.deepEqual(authored.reportFill.blocks[0].content.params, [
  {
    id: "dateRange",
    value: {
      start: "2026-05-01",
      end: "2026-05-04",
    },
  },
]);
assert.deepEqual(authored.reportFill.blocks[4].content, {
  title: "Headline KPI",
  description: "Generic KPI block resolved from the first authored runtime row.",
  valueField: "avails",
  valueLabel: "Available Impressions",
  value: 12000,
  rowCount: 2,
  secondaryField: "channelV2",
  secondaryLabel: "Channel",
  secondaryValue: "Display",
  emptyLabel: "No headline KPI value available.",
});
assert.deepEqual(authored.reportFill.blocks[5].content.columns[1].cellVisual, {
  kind: "badge",
  rules: [
    { value: "Display", tone: "info", label: "Display" },
    { value: "CTV", tone: "success", label: "CTV" },
  ],
});
const authoredPrintElements = authored.reportPrint.pages.flatMap((page) => page.elements || []);
assert.equal(authored.reportPrint.kind, "reportPrint");
assert.equal(validateReportPrint(authored.reportPrint).valid, true);
assert.equal(authored.exportRequest.kind, "reportExportRequest");
assert.equal(authored.exportRequest.source.from, "draft");
assert.equal(authored.exportRequest.source.title, "Preview Report");
assert.equal(validateReportExportRequest(authored.exportRequest).valid, true);
assert.equal(authoredPrintElements.some((element) => element.kind === "tableCellBadge" && element.columnKey === "channelV2"), true);
assert.equal(authoredPrintElements.some((element) => element.kind === "tableCellDataBar" && element.columnKey === "avails"), true);
assert.equal(authored.reportPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.comparisonTable"), true);
assert.equal(authored.runtimeBlock.kind, "dashboard.reportRuntime");
assert.equal(authored.runtimeBlock.dashboard.reportRuntime.reportPrint.kind, "reportPrint");
assert.equal(authored.runtimeBlock.dashboard.reportRuntime.reportSpec.title, "Preview Report");
assert.equal(authored.runtimeBlock.dashboard.reportRuntime.reportSpec.semanticSummary.entityLabel, "Line Delivery");
assert.equal(authored.semanticBindingViewState.title, "Semantic Binding");
assert.equal(authored.runtimeBlock.dashboard.reportRuntime.semanticBindingViewState.title, "Semantic Binding");
assert.equal(authored.runtimeBlock.dashboard.reportRuntime.semanticBindingViewState.chips.includes("Measures Available Impressions"), true);
assert.equal(authored.runtimeBlock.dashboard.reportRuntime.reportFill.blocks[0].kind, "filterBarBlock");
assert.equal(authored.runtimeBlock.dashboard.reportRuntime.reportFill.blocks[4].kind, "kpiBlock");

const authoredFromSemanticModel = buildPreviewAuthoredReport({
  container,
  config,
  state,
  rows,
  binding: config.binding,
  semanticModel,
});
assert.equal(authoredFromSemanticModel.reportSpec.semanticSummary.modelLabel, "Canonical Ad Delivery");
assert.equal(authoredFromSemanticModel.reportSpec.semanticSummary.entityLabel, "Canonical Line Delivery");
assert.deepEqual(authoredFromSemanticModel.reportSpec.semanticSummary.selectedDimensions, []);
assert.deepEqual(authoredFromSemanticModel.reportSpec.semanticSummary.selectedMeasures, []);
assert.equal(authoredFromSemanticModel.runtimeBlock.dashboard.reportRuntime.reportSpec.semanticSummary.modelLabel, "Canonical Ad Delivery");

const refinedAuthored = buildPreviewAuthoredReport({
  container,
  config,
  state,
  rows,
  refinements: [
    {
      op: "keep",
      field: "channelV2",
      values: ["Display"],
      sourceBlockId: "comparisonTable",
      label: "Keep Channel = Display",
    },
  ],
});
assert.deepEqual(refinedAuthored.reportSpec.refinements, [
  {
    id: "keep:channelV2:comparisonTable",
    op: "keep",
    field: "channelV2",
    values: ["Display"],
    sourceBlockId: "comparisonTable",
    label: "Keep Channel = Display",
  },
]);
assert.deepEqual(refinedAuthored.reportSpec.datasets[0].request.refinements, [
  {
    id: "keep:channelV2:comparisonTable",
    op: "keep",
    field: "channelV2",
    values: ["Display"],
    sourceBlockId: "comparisonTable",
    label: "Keep Channel = Display",
  },
]);
assert.deepEqual(refinedAuthored.reportSpec.datasets[0].request.semanticSelection.refinements, [
  {
    id: "keep:channelV2:comparisonTable",
    op: "keep",
    field: "channelV2",
    values: ["Display"],
    sourceBlockId: "comparisonTable",
    label: "Keep Channel = Display",
  },
]);
assert.equal(refinedAuthored.reportFill.datasets[0].rows.length, 1);
assert.equal(refinedAuthored.reportFill.datasets[0].rows[0].channelV2, "Display");

const drilledAuthored = buildPreviewAuthoredReport({
  container,
  config,
  state,
  rows,
  refinements: [
    {
      op: "drill",
      field: "channelV2",
      values: ["Display"],
      sourceBlockId: "comparisonTable",
      label: "Drill Channel = Display",
    },
  ],
  drillTransitions: [
    {
      refinementId: "drill:channelV2:comparisonTable",
      sourceField: "channelV2",
      nextFieldRef: "country",
      sourceBlockId: "comparisonTable",
    },
  ],
  additionalDiagnostics: [
    {
      code: "detailTargetResolved",
      severity: "info",
      message: "Detail target resolved.",
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
});
const drilledAuthoredWithoutHostIntent = buildPreviewAuthoredReport({
  container,
  config,
  state,
  rows,
  refinements: [
    {
      op: "drill",
      field: "channelV2",
      values: ["Display"],
      sourceBlockId: "comparisonTable",
      label: "Drill Channel = Display",
    },
  ],
  drillTransitions: [
    {
      refinementId: "drill:channelV2:comparisonTable",
      sourceField: "channelV2",
      nextFieldRef: "country",
      sourceBlockId: "comparisonTable",
    },
  ],
  additionalDiagnostics: [
    {
      code: "detailTargetResolved",
      severity: "info",
      message: "Detail target resolved.",
    },
  ],
});
assert.equal(drilledAuthored.reportSpec.datasets[0].request.dimensions.country, true);
assert.equal(drilledAuthored.reportSpec.datasets[0].request.dimensions.channelV2, true);
assert.equal(drilledAuthored.reportFill.datasets[0].rows.length, 1);
assert.equal(drilledAuthored.reportFill.datasets[0].rows[0].country, "US");
assert.deepEqual(drilledAuthored.reportFill.diagnostics, [
  {
    code: "detailTargetResolved",
    severity: "info",
    message: "Detail target resolved.",
  },
]);
assert.deepEqual(drilledAuthored.runtimeBlock.dashboard.reportRuntime.hostIntent, {
  intentKind: "detailTarget",
  targetRef: "target://example/performance/channel-detail",
  navigationMode: "hostRoute",
  parameters: {
    channel: "Display",
  },
});
assert.equal(
  Object.prototype.hasOwnProperty.call(drilledAuthoredWithoutHostIntent.runtimeBlock.dashboard.reportRuntime, "hostIntent"),
  false,
);
assert.deepEqual(drilledAuthored.exportRequest, drilledAuthoredWithoutHostIntent.exportRequest);
assert.deepEqual(drilledAuthored.reportPrint, drilledAuthoredWithoutHostIntent.reportPrint);
assert.equal(
  Object.prototype.hasOwnProperty.call(drilledAuthored.exportRequest, "hostIntent"),
  false,
);
assert.equal(
  Object.prototype.hasOwnProperty.call(drilledAuthored.reportPrint, "hostIntent"),
  false,
);

const pieAuthored = buildPreviewAuthoredReport({
  container,
  config,
  state: {
    ...state,
    chartSpec: {
      title: "Avails by Channel",
      type: "pie",
      xField: "channelV2",
      yFields: ["avails"],
    },
  },
  rows,
});
assert.equal(pieAuthored.reportSpec.blocks[3].chartSpec.type, "pie");
assert.equal(pieAuthored.runtimeBlock.dashboard.reportRuntime.reportSpec.blocks[3].chartSpec.type, "pie");

const seriesAuthored = buildPreviewAuthoredReport({
  container,
  config,
  state: {
    ...state,
    chartSpec: {
      title: "Avails by Date and Channel",
      type: "line",
      xField: "eventDate",
      yFields: ["avails"],
      seriesField: "channelV2",
    },
  },
  rows,
});
assert.equal(seriesAuthored.reportSpec.blocks[3].chartSpec.seriesField, "channelV2");
assert.equal(seriesAuthored.runtimeBlock.dashboard.reportRuntime.reportSpec.blocks[3].chartSpec.seriesField, "channelV2");

const computedAuthored = buildPreviewAuthoredReport({
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
    selectedMeasures: ["reachRate"],
    primaryMeasure: "reachRate",
    chartSpec: {
      title: "Reach Rate by Date",
      type: "line",
      xField: "eventDate",
      yFields: ["reachRate"],
    },
  },
  rows: [
    { eventDate: "2026-05-01", channelV2: "Display", country: "US", avails: 12000, hhUniqs: 3000 },
    { eventDate: "2026-05-02", channelV2: "CTV", country: "US", avails: 16000, hhUniqs: 6400 },
  ],
});
assert.deepEqual(computedAuthored.reportSpec.calculatedFields, [
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
assert.equal(computedAuthored.reportFill.datasets[0].rows[0].reachRate, 25);
assert.equal(computedAuthored.reportFill.datasets[0].rows[1].reachRate, 40);
assert.equal(computedAuthored.reportFill.blocks[2].content.columns[2].key, "reachRate");
assert.equal(computedAuthored.runtimeBlock.dashboard.reportRuntime.reportSpec.blocks[3].chartSpec.yFields[0], "reachRate");
assert.equal(computedAuthored.reportPrint.pages[0].elements.some((element) => element.kind === "tableCellText" && element.columnKey === "reachRate"), true);

const resolvedRowsAuthored = buildPreviewAuthoredReport({
  container,
  config,
  state: {
    ...state,
    selectedDimensions: ["eventDate"],
    chartSpec: {
      title: "Avails by Date",
      type: "line",
      xField: "eventDate",
      yFields: ["avails"],
    },
  },
  rowsResolved: true,
  rows: [
    { eventDate: "2026-05-01", channelV2: "Display", country: "US", avails: 12000 },
    { eventDate: "2026-05-01", channelV2: "CTV", country: "US", avails: 16000 },
  ],
});
assert.equal(resolvedRowsAuthored.reportFill.datasets[0].rows.length, 2);
assert.equal(resolvedRowsAuthored.reportFill.datasets[0].rows[0].channelV2, "Display");
assert.equal(resolvedRowsAuthored.reportFill.datasets[0].rows[1].channelV2, "CTV");

assert.equal(buildPreviewAuthoredReport({ state: null }), null);

console.log("previewAuthoredReport ✓ compiles live builder state into an authored runtime preview");

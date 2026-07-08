import assert from "node:assert/strict";

import {
  buildReportBuilderReportDocument,
  buildReportDocumentBadgesBlock,
  buildReportBuilderBlockScopeBindings,
  buildReportDocumentChartBlock,
  extractReportDocumentTemplateIdentity,
  buildReportDocumentScopeParams,
  buildReportDocumentFilterBarBlock,
  buildReportDocumentGeoMapBlock,
  buildReportDocumentKpiBlock,
  buildReportDocumentMarkdownBlock,
  buildReportDocumentRefinementBarBlock,
  buildReportDocumentTableBlock,
  lowerReportDocumentToReportSpec,
} from "./reportDocumentModel.js";
import { buildReportBuilderReportSpec } from "./reportSpecModel.js";
import { lowerReportBuilderPredicates } from "../components/dashboard/reportBuilderPredicates.js";

const config = {
  title: "Performance Report",
  measures: [
    { id: "totalSpend", key: "totalSpend", label: "Spend", paramPath: "measures.totalSpend", default: true, format: "currency" },
    { id: "impressions", key: "impressions", label: "Impressions", paramPath: "measures.impressions", format: "compactNumber" },
  ],
  dimensions: [
    { id: "eventDate", key: "eventDate", label: "Date", paramPath: "dimensions.eventDate", default: true, chartAxis: true, format: "date" },
    { id: "channelId", key: "channelId", label: "Channel", paramPath: "dimensions.channelId" },
  ],
  staticFilters: [
    {
      id: "dateRange",
      description: "Approved reporting window for shared runtime scope.",
      type: "dateRange",
      required: true,
      startParamPath: "filters.From",
      endParamPath: "filters.To",
      default: { start: "2026-05-01", end: "2026-05-04" },
    },
  ],
  result: {
    chartCreationMode: "explicit",
    resultPanePosition: "left",
    defaultChartSpecs: [
      {
        title: "Spend by Date",
        type: "line",
        xField: "eventDate",
        yFields: ["totalSpend"],
      },
    ],
    orderFields: [
      { value: "eventDate", field: "eventDate", default: true, defaultDirection: "asc" },
      { value: "totalSpend", field: "totalSpend", defaultDirection: "desc" },
    ],
    pageSize: 50,
  },
};

const state = {
  selectedMeasures: ["totalSpend", "impressions"],
  primaryMeasure: "totalSpend",
  selectedDimensions: ["eventDate", "channelId"],
  viewMode: "chart",
  chartSpec: {
    title: "Manual Spend Trend",
    type: "line",
    xField: "eventDate",
    yFields: ["totalSpend"],
    seriesField: "channelId",
  },
  groupBy: "channelId",
  pageSize: 25,
  orderField: "totalSpend",
  orderDir: "desc",
  scopeParams: {
    dateRange: { start: "2026-05-01", end: "2026-05-04" },
  },
};

const container = {
  id: "performanceBuilder",
  stateKey: "performanceBuilder",
  title: "Performance Report",
  dataSourceRef: "demoReportSource",
};

const markdownBlock = buildReportDocumentMarkdownBlock({
  id: "narrativeIntro",
  title: "Executive Summary",
  markdown: "## Executive Summary\nThe report opens with a short narrative block.",
});
const filterBarBlock = buildReportDocumentFilterBarBlock({
  id: "sharedFilters",
  title: "Shared Filters",
  paramIds: ["dateRange"],
});
assert.deepEqual(buildReportDocumentFilterBarBlock({
  id: "legacyScopeFilters",
  title: "Scope",
  paramIds: ["dateRange"],
}), {
  id: "legacyScopeFilters",
  kind: "filterBarBlock",
  title: "Filters",
  datasetRef: "primary",
  paramIds: ["dateRange"],
});
const refinementBarBlock = buildReportDocumentRefinementBarBlock({
  id: "activeRefinements",
  title: "Applied Refinements",
  actionKinds: ["remove", "clearAll", "undo", "ignore-me", "clearAll"],
  emptyLabel: "No drill path selected",
});
assert.deepEqual(buildReportDocumentRefinementBarBlock(), {
  id: "refinementTrail",
  kind: "refinementBarBlock",
  title: "Refinements",
  actionKinds: ["remove", "clearAll"],
  emptyLabel: "No active refinements",
});
assert.deepEqual(buildReportDocumentRefinementBarBlock({
  title: "",
  actionKinds: [],
  emptyLabel: "",
}), {
  id: "refinementTrail",
  kind: "refinementBarBlock",
  title: "",
  actionKinds: [],
  emptyLabel: "",
});
const headlineKpiBlock = buildReportDocumentKpiBlock({
  id: "headlineKpi",
  title: "Headline KPI",
  datasetRef: "primary",
  valueField: "totalSpend",
  valueLabel: "Spend",
  secondaryField: "channelId",
  secondaryLabel: "Channel",
  description: "Summarizes the first authored runtime row.",
  emptyLabel: "No headline KPI value available.",
});
const statusPillsBlock = buildReportDocumentBadgesBlock({
  id: "statusPills",
  title: "Status Pills",
  datasetRef: "primary",
  items: [
    {
      id: "setup",
      label: "Setup",
      valueField: "channelId",
      tone: "info",
      rules: [
        { value: "Display", label: "Display media", tone: "success" },
      ],
    },
    { id: "pace", label: "Pacing", value: "Behind", tone: "warning" },
  ],
});
assert.deepEqual(buildReportDocumentKpiBlock(), {
  id: "kpiBlock",
  kind: "kpiBlock",
  title: "KPI",
  datasetRef: "primary",
  valueField: "value",
  valueLabel: "value",
});
assert.deepEqual(buildReportDocumentBadgesBlock(), {
  id: "badgesBlock",
  kind: "badgesBlock",
  title: "Status Pills",
  datasetRef: "primary",
  items: [],
});
const authoredChartBlock = buildReportDocumentChartBlock({
  id: "channelTrend",
  title: "Channel Trend",
  datasetRef: "primary",
  chartSpec: {
    type: "line",
    xField: "eventDate",
    yFields: ["impressions"],
    seriesField: "channelId",
  },
});
assert.deepEqual(authoredChartBlock, {
  id: "channelTrend",
  kind: "chartBlock",
  title: "Channel Trend",
  datasetRef: "primary",
  chartSpec: {
    title: "Channel Trend",
    type: "line",
    xField: "eventDate",
    yFields: ["impressions"],
    seriesField: "channelId",
  },
});
const comparisonTableBlock = buildReportDocumentTableBlock({
  id: "comparisonTable",
  title: "Comparison Table",
  datasetRef: "primary",
  columns: [
    {
      key: "spend",
      label: "Spend",
      cellVisual: {
        kind: "dataBar",
        valueField: "spend",
        range: { mode: "columnMax" },
        palette: ["#dbeafe", "#2563eb"],
      },
    },
    {
      key: "status",
      label: "Status",
      cellVisual: {
        kind: "tone",
        rules: [
          { value: "healthy", tone: "success" },
          { value: "critical", tone: "danger" },
        ],
      },
    },
  ],
});
const geoMapBlock = buildReportDocumentGeoMapBlock({
  id: "stateGeo",
  title: "State Performance",
  datasetRef: "primary",
  geo: {
    key: "stateCode",
    labelKey: "stateName",
    metric: {
      key: "spend",
      label: "Spend",
      format: "currency",
    },
    aggregate: "sum",
    color: {
      field: "status",
      rules: [
        { value: "critical", label: "Critical", color: "#db3737" },
      ],
    },
  },
});

const document = buildReportBuilderReportDocument({
  container,
  config,
  state,
  additionalBlocks: [filterBarBlock, refinementBarBlock, headlineKpiBlock, statusPillsBlock, authoredChartBlock, comparisonTableBlock, geoMapBlock, markdownBlock],
  semanticSummary: {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    selectedDimensions: [
      { id: "event_date", rawId: "eventDate", label: "Date" },
      { id: "channel", rawId: "channelId", label: "Channel" },
    ],
    selectedMeasures: [
      { id: "spend", rawId: "totalSpend", label: "Spend", format: "currency" },
      { id: "impressions", rawId: "impressions", label: "Impressions", format: "compactNumber" },
    ],
  },
  refinements: [
    {
      op: "keep",
      field: "region",
      values: ["EMEA"],
      sourceBlockId: "summaryChart",
    },
  ],
});

assert.equal(document.kind, "reportDocument");
assert.equal(document.version, 1);
assert.equal(document.id, "performanceBuilder");
assert.equal(document.title, "Performance Report");
assert.equal(document.semanticSummary.modelLabel, "Ad Delivery");
assert.deepEqual(document.refinements, [
  {
    id: "keep:region:summaryChart",
    op: "keep",
    field: "region",
    values: ["EMEA"],
    sourceBlockId: "summaryChart",
  },
]);
assert.deepEqual(document.scope, {
  params: [
    {
      id: "dateRange",
      kind: "dateRange",
      label: "dateRange",
      description: "Approved reporting window for shared runtime scope.",
      required: true,
      value: {
        start: "2026-05-01",
        end: "2026-05-04",
      },
    },
  ],
  dataSourceRef: "demoReportSource",
});
assert.deepEqual(document.layout, {
  type: "stack",
  items: [
    {
      blockId: "primaryBuilder",
    },
    {
      blockId: "sharedFilters",
    },
    {
      blockId: "activeRefinements",
    },
    {
      blockId: "headlineKpi",
    },
    {
      blockId: "statusPills",
    },
    {
      blockId: "channelTrend",
    },
    {
      blockId: "comparisonTable",
    },
    {
      blockId: "stateGeo",
    },
    {
      blockId: "narrativeIntro",
    },
  ],
});
assert.equal(document.blocks.length, 9);
assert.deepEqual(document.blocks[0].source, {
  kind: "dashboard.reportBuilder",
  containerId: "performanceBuilder",
  stateKey: "performanceBuilder",
  dataSourceRef: "demoReportSource",
});
assert.deepEqual(document.blocks[0].config, config);
assert.deepEqual(document.blocks[0].state, state);
assert.deepEqual(document.blocks[0].scopeBindings, [
  {
    paramId: "dateRange",
    target: "staticFilters.dateRange",
  },
]);
assert.deepEqual(document.blocks[1], filterBarBlock);
assert.deepEqual(document.blocks[2], refinementBarBlock);
assert.deepEqual(document.blocks[3], headlineKpiBlock);
assert.deepEqual(document.blocks[4], statusPillsBlock);
assert.deepEqual(document.blocks[5], authoredChartBlock);
assert.deepEqual(document.blocks[6], comparisonTableBlock);
assert.deepEqual(document.blocks[7], geoMapBlock);
assert.deepEqual(document.blocks[8], markdownBlock);

const hostedWindowFallbackDocument = buildReportBuilderReportDocument({
  container: {
    windowKey: "forecastingCubeBuilder",
    windowId: "mcpui:forecastingCubeBuilder",
    title: "Forecasting",
    dataSourceRef: "forecasting_cube_report",
  },
  config,
  state,
});

assert.equal(hostedWindowFallbackDocument.id, "forecastingCubeBuilder");
assert.deepEqual(hostedWindowFallbackDocument.blocks[0].source, {
  kind: "dashboard.reportBuilder",
  containerId: "forecastingCubeBuilder",
  stateKey: "forecastingCubeBuilder",
  dataSourceRef: "forecasting_cube_report",
});

assert.deepEqual(buildReportDocumentScopeParams(config, state), document.scope.params);
assert.deepEqual(buildReportBuilderBlockScopeBindings(config), document.blocks[0].scopeBindings);

const sourceScopedConfig = {
  ...config,
  dataSources: [
    {
      id: "forecast_cube",
      dataSourceRef: "forecastCubeSource",
      scopeParamOptions: [
        {
          value: "forecastRegion",
          label: "Forecast Region",
          kind: "multiSelect",
          description: "Region filter for forecast source.",
        },
      ],
    },
  ],
};
const sourceScopedState = {
  ...state,
  scopeParams: {
    ...state.scopeParams,
    forecastRegion: ["US/NY"],
  },
};
assert.deepEqual(buildReportDocumentScopeParams(sourceScopedConfig, sourceScopedState).find((param) => param.id === "forecastRegion"), {
  id: "forecastRegion",
  kind: "multiSelect",
  label: "Forecast Region",
  description: "Region filter for forecast source.",
  required: false,
  datasetRef: "forecast_cube",
  value: ["US/NY"],
});
assert.equal(
  buildReportBuilderBlockScopeBindings(sourceScopedConfig).some((binding) => binding.paramId === "forecastRegion" && binding.target === "scopeParams.forecastRegion"),
  true,
);

const lowered = lowerReportDocumentToReportSpec(document);
const baseSpec = buildReportBuilderReportSpec({
  container,
  config,
  state,
  refinements: document.refinements,
});
assert.deepEqual(lowered.refinements, [
  {
    id: "keep:region:summaryChart",
    op: "keep",
    field: "region",
    values: ["EMEA"],
    sourceBlockId: "summaryChart",
  },
]);
assert.equal(lowered.semanticSummary.entityLabel, "Line Delivery");
assert.deepEqual(lowered.blocks[0], baseSpec.blocks[0]);
assert.deepEqual(lowered.blocks[1], baseSpec.blocks[1]);
assert.deepEqual(lowered.blocks[2], {
  id: "sharedFilters",
  kind: "filterBarBlock",
  title: "Shared Filters",
  datasetRef: "primary",
  paramIds: ["dateRange"],
});
assert.deepEqual(lowered.blocks[3], {
  id: "activeRefinements",
  kind: "refinementBarBlock",
  title: "Applied Refinements",
  actionKinds: ["remove", "clearAll", "undo"],
  emptyLabel: "No drill path selected",
});
assert.deepEqual(lowered.blocks[4], headlineKpiBlock);
assert.deepEqual(lowered.blocks[5], statusPillsBlock);
assert.deepEqual(lowered.blocks[6], {
  id: "channelTrend",
  kind: "chartBlock",
  datasetRef: "primary",
  chartSpec: {
    title: "Channel Trend",
    type: "line",
    xField: "eventDate",
    yFields: ["impressions"],
    seriesField: "channelId",
  },
  chartModel: {
    type: "line",
    xAxis: {
      dataKey: "eventDate",
    },
    yAxis: {
      format: "compactNumber",
    },
    series: {
      nameKey: "channelId",
      valueKey: "impressions",
      values: [{
        value: "impressions",
        label: "Impressions",
        color: "#1f77b4",
        format: "compactNumber",
        type: "line",
      }],
      palette: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"],
    },
  },
});
assert.deepEqual(lowered.blocks[7], comparisonTableBlock);
assert.deepEqual(lowered.blocks[8], geoMapBlock);
assert.deepEqual(lowered.blocks[9], {
  id: "narrativeIntro",
  kind: "markdownBlock",
  title: "Executive Summary",
  markdown: "## Executive Summary\nThe report opens with a short narrative block.",
});
assert.deepEqual(lowered.layoutIntent.blockOrder, [
  "primaryTable",
  "primaryChart",
  "sharedFilters",
  "activeRefinements",
  "headlineKpi",
  "statusPills",
  "channelTrend",
  "comparisonTable",
  "stateGeo",
  "narrativeIntro",
]);

const badgeDependencyDocument = buildReportBuilderReportDocument({
  container,
  config: {
    ...config,
    dimensions: [
      ...config.dimensions,
      { id: "region", key: "region", label: "Region", paramPath: "dimensions.region" },
    ],
  },
  state: {
    ...state,
    selectedDimensions: ["eventDate"],
    selectedMeasures: ["totalSpend"],
    primaryMeasure: "totalSpend",
  },
  additionalBlocks: [
    buildReportDocumentBadgesBlock({
      id: "regionFlags",
      title: "Region Flags",
      datasetRef: "primary",
      items: [
        { id: "regionBadge", label: "Region", valueField: "region", tone: "info" },
      ],
    }),
  ],
});
const loweredBadgeDependencyDocument = lowerReportDocumentToReportSpec(badgeDependencyDocument);
assert.equal(loweredBadgeDependencyDocument.datasets[0].request.dimensions.region, true);

const staticBadgeDocument = buildReportBuilderReportDocument({
  container,
  config,
  state: {
    ...state,
    selectedDimensions: ["eventDate"],
    selectedMeasures: ["totalSpend"],
    primaryMeasure: "totalSpend",
    reportStaticDatasets: [
      {
        id: "regional_csv",
        label: "Regional CSV",
        rows: [{ region: "West", revenue: 10 }],
        columns: [
          { key: "region", label: "Region", kind: "dimension" },
          { key: "revenue", label: "Revenue", kind: "measure", format: "currency" },
        ],
      },
    ],
  },
  additionalBlocks: [
    buildReportDocumentBadgesBlock({
      id: "staticRegionPill",
      title: "Static Region Pill",
      datasetRef: "regional_csv",
      items: [
        { id: "regionBadge", label: "Region", valueField: "region", tone: "info" },
      ],
    }),
  ],
});
const loweredStaticBadgeDocument = lowerReportDocumentToReportSpec(staticBadgeDocument, {
  includePrimaryBlocks: false,
});
assert.equal(Object.prototype.hasOwnProperty.call(loweredStaticBadgeDocument.datasets[0].request.dimensions || {}, "region"), false);

const loweredMinimalRefinementBar = lowerReportDocumentToReportSpec({
  ...document,
  blocks: [
    document.blocks[0],
    {
      id: "minimalRefinements",
      kind: "refinementBarBlock",
    },
  ],
});
assert.deepEqual(loweredMinimalRefinementBar.blocks[2], {
  id: "minimalRefinements",
  kind: "refinementBarBlock",
});

const loweredWithCustomLayout = lowerReportDocumentToReportSpec({
  ...document,
  layout: {
    ...document.layout,
    items: [
      { blockId: "sharedFilters" },
      { blockId: "activeRefinements" },
      { blockId: "primaryBuilder" },
      { blockId: "headlineKpi" },
      { blockId: "comparisonTable" },
      { blockId: "stateGeo" },
      { blockId: "narrativeIntro" },
    ],
  },
});
assert.deepEqual(loweredWithCustomLayout.layoutIntent.blockOrder, [
  "sharedFilters",
  "activeRefinements",
  "primaryTable",
  "primaryChart",
  "headlineKpi",
  "comparisonTable",
  "stateGeo",
  "narrativeIntro",
  "statusPills",
  "channelTrend",
]);
assert.deepEqual(loweredWithCustomLayout.layoutIntent.items, [
  { blockId: "sharedFilters" },
  { blockId: "activeRefinements" },
  { blockId: "primaryTable" },
  { blockId: "primaryChart" },
  { blockId: "headlineKpi" },
  { blockId: "comparisonTable" },
  { blockId: "stateGeo" },
  { blockId: "narrativeIntro" },
  { blockId: "statusPills" },
  { blockId: "channelTrend" },
]);

const loweredWithSizedLayout = lowerReportDocumentToReportSpec({
  ...document,
  layout: {
    ...document.layout,
    items: [
      { blockId: "sharedFilters" },
      { blockId: "headlineKpi", size: "half" },
      { blockId: "primaryBuilder" },
      { blockId: "comparisonTable", size: "half" },
      { blockId: "stateGeo" },
      { blockId: "narrativeIntro" },
    ],
  },
});
assert.deepEqual(loweredWithSizedLayout.layoutIntent.items, [
  { blockId: "sharedFilters" },
  { blockId: "headlineKpi", size: "half" },
  { blockId: "primaryTable" },
  { blockId: "primaryChart" },
  { blockId: "comparisonTable", size: "half" },
  { blockId: "stateGeo" },
  { blockId: "narrativeIntro" },
  { blockId: "activeRefinements" },
  { blockId: "statusPills" },
  { blockId: "channelTrend" },
]);

const loweredWithoutPrimaryPresentation = lowerReportDocumentToReportSpec({
  ...document,
  layout: {
    ...document.layout,
    items: [
      { blockId: "sharedFilters" },
      { blockId: "activeRefinements" },
      { blockId: "primaryBuilder" },
      { blockId: "headlineKpi" },
      { blockId: "comparisonTable" },
      { blockId: "stateGeo" },
      { blockId: "narrativeIntro" },
    ],
  },
}, {
  includePrimaryBlocks: false,
});
assert.deepEqual(loweredWithoutPrimaryPresentation.layoutIntent.blockOrder, [
  "sharedFilters",
  "activeRefinements",
  "headlineKpi",
  "comparisonTable",
  "stateGeo",
  "narrativeIntro",
  "statusPills",
  "channelTrend",
]);
assert.equal(
  loweredWithoutPrimaryPresentation.blocks.some((block) => block.id === "primaryTable" || block.id === "primaryChart"),
  false,
);

const stateBackedDocument = buildReportBuilderReportDocument({
  container,
  config,
  state: {
    ...state,
    reportDocumentTitle: "Executive Snapshot",
    reportDocumentSubtitle: "Weekly Rollup",
    reportDocumentDescription: "Authored document metadata from builder state.",
    reportDocumentTemplateId: "market_brief",
    reportDocumentTemplateLabel: "Market Brief",
    reportDocumentBlocks: [headlineKpiBlock, markdownBlock],
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
assert.equal(stateBackedDocument.title, "Executive Snapshot");
assert.equal(stateBackedDocument.subtitle, "Weekly Rollup");
assert.equal(stateBackedDocument.description, "Authored document metadata from builder state.");
assert.equal(stateBackedDocument.templateId, "market_brief");
assert.equal(stateBackedDocument.templateLabel, "Market Brief");
assert.deepEqual(stateBackedDocument.layout, {
  type: "stack",
  items: [
    { blockId: "narrativeIntro", size: "half" },
    { blockId: "primaryBuilder" },
    { blockId: "headlineKpi", size: "half" },
  ],
});
assert.deepEqual(stateBackedDocument.blocks.slice(1), [
  headlineKpiBlock,
  markdownBlock,
]);
assert.equal(Object.prototype.hasOwnProperty.call(stateBackedDocument.blocks[0].state, "reportDocumentBlocks"), false);
assert.equal(Object.prototype.hasOwnProperty.call(stateBackedDocument.blocks[0].state, "reportDocumentLayout"), false);

assert.deepEqual(extractReportDocumentTemplateIdentity({
  templateId: "market_brief",
  templateLabel: "Market Brief",
  blocks: [
    {
      id: "primaryBuilder",
      kind: "reportBuilderBlock",
      state: {
        reportDocumentTemplateId: "capacity_inventory_brief",
        reportDocumentTemplateLabel: "Capacity Inventory Brief",
      },
    },
  ],
}), {
  templateId: "market_brief",
  templateLabel: "Market Brief",
});

assert.deepEqual(extractReportDocumentTemplateIdentity({
  blocks: [
    {
      id: "primaryBuilder",
      kind: "reportBuilderBlock",
      state: {
        reportDocumentTemplateId: "capacity_inventory_brief",
        reportDocumentTemplateLabel: "Capacity Inventory Brief",
      },
    },
  ],
}), {
  templateId: "capacity_inventory_brief",
  templateLabel: "Capacity Inventory Brief",
});

assert.equal(extractReportDocumentTemplateIdentity({
  blocks: [
    {
      id: "primaryBuilder",
      kind: "reportBuilderBlock",
      state: {},
    },
  ],
}), null);

const overriddenScopeDocument = {
  ...document,
  scope: {
    ...document.scope,
    params: [
      {
        id: "dateRange",
        kind: "dateRange",
        label: "dateRange",
        description: "Approved reporting window for shared runtime scope.",
        required: true,
        value: {
          start: "2026-06-01",
          end: "2026-06-07",
        },
      },
    ],
  },
};
const loweredWithScopeOverride = lowerReportDocumentToReportSpec(overriddenScopeDocument);
assert.equal(loweredWithScopeOverride.datasets[0].request.filters.From, "2026-06-01");
assert.equal(loweredWithScopeOverride.datasets[0].request.filters.To, "2026-06-07");

const authoredDependencyConfig = {
  title: "Dependency Coverage Report",
  measures: [
    { id: "totalSpend", key: "totalSpend", label: "Spend", paramPath: "measures.totalSpend", default: true, format: "currency" },
    { id: "impressions", key: "impressions", label: "Impressions", paramPath: "measures.impressions", format: "compactNumber" },
    { id: "spend", key: "spend", label: "State Spend", paramPath: "measures.spend", format: "currency" },
  ],
  dimensions: [
    { id: "eventDate", key: "eventDate", label: "Date", paramPath: "dimensions.eventDate", default: true, chartAxis: true, format: "date" },
    { id: "channelId", key: "channelId", label: "Channel", paramPath: "dimensions.channelId", default: true },
    { id: "stateCode", key: "stateCode", label: "State", paramPath: "dimensions.stateCode" },
    { id: "stateName", key: "stateName", label: "State Name", paramPath: "dimensions.stateName" },
    { id: "status", key: "status", label: "Status", paramPath: "dimensions.status" },
  ],
  staticFilters: [
    {
      id: "dateRange",
      type: "dateRange",
      required: true,
      startParamPath: "filters.From",
      endParamPath: "filters.To",
      default: { start: "2026-05-01", end: "2026-05-04" },
    },
  ],
  result: {
    chartCreationMode: "explicit",
    resultPanePosition: "left",
    defaultChartSpecs: [
      {
        title: "Spend by Date",
        type: "line",
        xField: "eventDate",
        yFields: ["totalSpend"],
      },
    ],
    orderFields: [
      { value: "eventDate", field: "eventDate", default: true, defaultDirection: "asc" },
      { value: "totalSpend", field: "totalSpend", defaultDirection: "desc" },
    ],
    pageSize: 50,
  },
};

const authoredDependencyState = {
  selectedMeasures: ["totalSpend", "impressions"],
  primaryMeasure: "totalSpend",
  selectedDimensions: ["eventDate", "channelId"],
  viewMode: "table",
  pageSize: 25,
  orderField: "eventDate",
  orderDir: "asc",
  scopeParams: {
    dateRange: { start: "2026-05-01", end: "2026-05-04" },
  },
};

const authoredDependencyDocument = buildReportBuilderReportDocument({
  container,
  config: authoredDependencyConfig,
  state: authoredDependencyState,
  additionalBlocks: [
    buildReportDocumentKpiBlock({
      id: "headlineKpi",
      title: "Headline KPI",
      datasetRef: "primary",
      valueField: "totalSpend",
      valueLabel: "Spend",
      secondaryField: "channelId",
      secondaryLabel: "Channel",
    }),
    buildReportDocumentTableBlock({
      id: "comparisonTable",
      title: "Comparison Table",
      datasetRef: "primary",
      columns: [
        {
          key: "spend",
          label: "State Spend",
          cellVisual: {
            kind: "dataBar",
            valueField: "spend",
            range: { mode: "columnMax" },
            palette: ["#dbeafe", "#2563eb"],
          },
        },
        {
          key: "status",
          label: "Status",
          cellVisual: {
            kind: "tone",
            rules: [
              { value: "healthy", tone: "success" },
              { value: "critical", tone: "danger" },
            ],
          },
        },
      ],
    }),
    buildReportDocumentGeoMapBlock({
      id: "stateGeo",
      title: "State Performance",
      datasetRef: "primary",
      geo: {
        key: "stateCode",
        labelKey: "stateName",
        metric: {
          key: "spend",
          label: "State Spend",
          format: "currency",
        },
        aggregate: "sum",
        color: {
          field: "status",
          rules: [
            { value: "critical", label: "Critical", color: "#db3737" },
            { value: "healthy", label: "Healthy", color: "#d9f0ea" },
          ],
        },
      },
    }),
  ],
});

const loweredWithAuthoredDependencies = lowerReportDocumentToReportSpec(authoredDependencyDocument);
const dependencyRequest = loweredWithAuthoredDependencies.datasets[0].request;
assert.equal(dependencyRequest.measures.totalSpend, true);
assert.equal(dependencyRequest.measures.impressions, true);
assert.equal(dependencyRequest.measures.spend, true);
assert.equal(dependencyRequest.dimensions.eventDate, true);
assert.equal(dependencyRequest.dimensions.channelId, true);
assert.equal(dependencyRequest.dimensions.stateCode, true);
assert.equal(dependencyRequest.dimensions.stateName, true);
assert.equal(dependencyRequest.dimensions.status, true);

const displayMappedDocument = buildReportBuilderReportDocument({
  container,
  config: {
    ...config,
    dimensions: [
      config.dimensions[0],
      {
        ...config.dimensions[1],
        displayKey: "channelName",
        displayValueMap: {
          "1": "Display",
          "2": "CTV",
        },
      },
    ],
  },
  state: authoredDependencyState,
  additionalBlocks: [
    buildReportDocumentTableBlock({
      id: "mappedTable",
      title: "Mapped Table",
      datasetRef: "primary",
      columns: [
        { key: "channelId", label: "Channel" },
        { key: "totalSpend", label: "Spend" },
      ],
    }),
  ],
});
const mappedTableSpec = lowerReportDocumentToReportSpec(displayMappedDocument);
const mappedTableBlock = mappedTableSpec.blocks.find((block) => block?.id === "mappedTable");
assert.deepEqual(mappedTableBlock?.columns?.[0], {
  key: "channelId",
  sourceKey: "channelId",
  displayKey: "channelName",
  displayValueMap: {
    "1": "Display",
    "2": "CTV",
  },
  label: "Channel",
});

const displayMappedKpiDocument = buildReportBuilderReportDocument({
  container,
  config: {
    ...config,
    dimensions: [
      config.dimensions[0],
      {
        ...config.dimensions[1],
        displayKey: "channelName",
        displayValueMap: {
          "1": "Display",
          "2": "CTV",
        },
      },
    ],
  },
  state: authoredDependencyState,
  additionalBlocks: [
    buildReportDocumentKpiBlock({
      id: "mappedKpi",
      title: "Mapped KPI",
      datasetRef: "primary",
      valueField: "totalSpend",
      valueLabel: "Spend",
      secondaryField: "channelId",
      secondaryLabel: "Channel",
    }),
  ],
});
const displayMappedKpiSpec = lowerReportDocumentToReportSpec(displayMappedKpiDocument);
const mappedKpiBlock = displayMappedKpiSpec.blocks.find((block) => block?.id === "mappedKpi");
assert.deepEqual(
  {
    secondaryField: mappedKpiBlock?.secondaryField,
    secondaryLabel: mappedKpiBlock?.secondaryLabel,
    secondaryDisplayKey: mappedKpiBlock?.secondaryDisplayKey,
    secondaryDisplayValueMap: mappedKpiBlock?.secondaryDisplayValueMap,
  },
  {
    secondaryField: "channelId",
    secondaryLabel: "Channel",
    secondaryDisplayKey: "channelName",
    secondaryDisplayValueMap: {
      "1": "Display",
      "2": "CTV",
    },
  },
);

const displayMappedBadgesDocument = buildReportBuilderReportDocument({
  container,
  config: {
    ...config,
    dimensions: [
      config.dimensions[0],
      {
        ...config.dimensions[1],
        displayKey: "channelName",
        displayValueMap: {
          "1": "Display",
          "2": "CTV",
        },
      },
    ],
  },
  state: authoredDependencyState,
  additionalBlocks: [
    buildReportDocumentBadgesBlock({
      id: "statusPills",
      title: "Status Pills",
      datasetRef: "primary",
      items: [
        {
          id: "channel",
          label: "Channel",
          valueField: "channelId",
          tone: "info",
        },
      ],
    }),
  ],
});
const displayMappedBadgesSpec = lowerReportDocumentToReportSpec(displayMappedBadgesDocument);
const mappedBadgesBlock = displayMappedBadgesSpec.blocks.find((block) => block?.id === "statusPills");
assert.deepEqual(mappedBadgesBlock?.items?.[0], {
  id: "channel",
  label: "Channel",
  valueField: "channelId",
  displayKey: "channelName",
  displayValueMap: {
    "1": "Display",
    "2": "CTV",
  },
  tone: "info",
});

const displayMappedChartDocument = buildReportBuilderReportDocument({
  container,
  config: {
    ...config,
    dimensions: [
      config.dimensions[0],
      {
        ...config.dimensions[1],
        displayKey: "channelName",
        displayValueMap: {
          "1": "Display",
          "2": "CTV",
        },
      },
    ],
  },
  state: authoredDependencyState,
  additionalBlocks: [
    buildReportDocumentChartBlock({
      id: "mappedChart",
      title: "Mapped Chart",
      datasetRef: "primary",
      chartSpec: {
        title: "Mapped Chart",
        type: "line",
        xField: "eventDate",
        yFields: ["impressions"],
        seriesField: "channelId",
      },
    }),
  ],
});
const displayMappedChartSpec = lowerReportDocumentToReportSpec(displayMappedChartDocument);
const mappedChartBlock = displayMappedChartSpec.blocks.find((block) => block?.id === "mappedChart");
assert.deepEqual(mappedChartBlock?.chartModel?.series, {
  nameKey: "channelName",
  sourceNameKey: "channelId",
  displayValueMap: {
    "1": "Display",
    "2": "CTV",
  },
  valueKey: "impressions",
  values: [{
    value: "impressions",
    label: "Impressions",
    color: "#1f77b4",
    format: "compactNumber",
    type: "line",
  }],
  palette: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"],
});

const authoredComputedChartDocument = buildReportBuilderReportDocument({
  container,
  config: {
    ...config,
    computedMeasures: [
      {
        id: "ctr",
        key: "ctr",
        label: "CTR",
        format: "percent",
        dependencies: ["totalSpend", "impressions"],
        compute: {
          type: "ratio",
          numerator: "totalSpend",
          denominator: "impressions",
          scale: 100,
          decimals: 2,
        },
      },
    ],
  },
  state: {
    ...state,
    selectedMeasures: ["totalSpend"],
    primaryMeasure: "totalSpend",
    selectedDimensions: ["eventDate"],
    viewMode: "table",
    chartSpec: null,
  },
  additionalBlocks: [
    buildReportDocumentChartBlock({
      id: "ctrTrend",
      title: "CTR by Date",
      datasetRef: "primary",
      chartSpec: {
        type: "line",
        xField: "eventDate",
        yFields: ["ctr"],
      },
    }),
  ],
});

const loweredAuthoredComputedChartDocument = lowerReportDocumentToReportSpec(authoredComputedChartDocument);
assert.deepEqual(loweredAuthoredComputedChartDocument.calculatedFields, [
  {
    id: "ctr",
    key: "ctr",
    kind: "rowCalc",
    label: "CTR",
    dataType: "number",
    format: "percent",
    datasetRef: "primary",
    dependencies: ["totalSpend", "impressions"],
    compute: {
      type: "ratio",
      numerator: "totalSpend",
      denominator: "impressions",
      scale: 100,
      decimals: 2,
    },
  },
]);
assert.equal(loweredAuthoredComputedChartDocument.datasets[0].request.measures.totalSpend, true);
assert.equal(loweredAuthoredComputedChartDocument.datasets[0].request.measures.impressions, true);
assert.equal(loweredAuthoredComputedChartDocument.datasets[0].request.measures.ctr, undefined);
assert.equal(loweredAuthoredComputedChartDocument.blocks[1].id, "ctrTrend");
assert.equal(loweredAuthoredComputedChartDocument.blocks[1].chartModel?.type, "line");
assert.equal(loweredAuthoredComputedChartDocument.blocks[1].chartModel?.series?.values?.[0]?.value, "ctr");
assert.equal(loweredAuthoredComputedChartDocument.blocks[1].chartModel?.yAxis?.format, "percent");

const authoredLocalTableCalculationDocument = buildReportBuilderReportDocument({
  container,
  config,
  state: {
    ...state,
    selectedMeasures: ["totalSpend"],
    primaryMeasure: "totalSpend",
    selectedDimensions: ["eventDate"],
    viewMode: "table",
    chartSpec: null,
    localTableCalculations: [
      {
        id: "reachShare",
        key: "reachShare",
        label: "Reach Share",
        format: "percent",
        compute: {
          type: "percentOfTotal",
          sourceField: "impressions",
          partitionBy: ["channelId"],
          scale: 100,
          decimals: 1,
        },
      },
    ],
  },
  additionalBlocks: [
    buildReportDocumentChartBlock({
      id: "reachShareTrend",
      title: "Reach Share by Date",
      datasetRef: "primary",
      chartSpec: {
        type: "line",
        xField: "eventDate",
        yFields: ["reachShare"],
      },
    }),
  ],
});

const loweredAuthoredLocalTableCalculationDocument = lowerReportDocumentToReportSpec(authoredLocalTableCalculationDocument);
assert.deepEqual(loweredAuthoredLocalTableCalculationDocument.calculatedFields, [
  {
    id: "reachShare",
    key: "reachShare",
    kind: "tableCalc",
    label: "Reach Share",
    dataType: "number",
    format: "percent",
    datasetRef: "primary",
    dependencies: ["impressions", "channelId"],
    compute: {
      type: "percentOfTotal",
      sourceField: "impressions",
      partitionBy: ["channelId"],
      scale: 100,
      decimals: 1,
    },
  },
]);
assert.equal(loweredAuthoredLocalTableCalculationDocument.datasets[0].request.measures.totalSpend, true);
assert.equal(loweredAuthoredLocalTableCalculationDocument.datasets[0].request.measures.impressions, true);
assert.equal(loweredAuthoredLocalTableCalculationDocument.datasets[0].request.measures.reachShare, undefined);
assert.equal(loweredAuthoredLocalTableCalculationDocument.datasets[0].request.dimensions.eventDate, true);
assert.equal(loweredAuthoredLocalTableCalculationDocument.datasets[0].request.dimensions.channelId, true);
assert.equal(loweredAuthoredLocalTableCalculationDocument.blocks[1].chartSpec.yFields[0], "reachShare");
assert.equal(loweredAuthoredLocalTableCalculationDocument.blocks[1].chartModel?.series?.values?.[0]?.value, "reachShare");
assert.equal(loweredAuthoredLocalTableCalculationDocument.blocks[1].chartModel?.yAxis?.format, "percent");

const computedDocument = buildReportBuilderReportDocument({
  container,
  config: {
    ...config,
    computedMeasures: [
      {
        id: "ctr",
        key: "ctr",
        label: "CTR",
        format: "percent",
        dependencies: ["totalSpend", "impressions"],
        compute: {
          type: "ratio",
          numerator: "totalSpend",
          denominator: "impressions",
          scale: 100,
          decimals: 2,
        },
      },
    ],
  },
  state: {
    ...state,
    selectedMeasures: ["ctr"],
    primaryMeasure: "ctr",
    chartSpec: {
      title: "CTR by Date",
      type: "line",
      xField: "eventDate",
      yFields: ["ctr"],
    },
  },
});

const loweredComputedDocument = lowerReportDocumentToReportSpec(computedDocument);
assert.deepEqual(loweredComputedDocument.calculatedFields, [
  {
    id: "ctr",
    key: "ctr",
    kind: "rowCalc",
    label: "CTR",
    dataType: "number",
    format: "percent",
    datasetRef: "primary",
    dependencies: ["totalSpend", "impressions"],
    compute: {
      type: "ratio",
      numerator: "totalSpend",
      denominator: "impressions",
      scale: 100,
      decimals: 2,
    },
  },
]);

assert.throws(
  () => lowerReportDocumentToReportSpec({ blocks: [] }),
  /reportBuilderBlock/,
);

// --- predicate-backed configs bind scope through scopeParams.<id> -----------------

const predicateConfig = lowerReportBuilderPredicates({
  title: "Forecast Report",
  dataSourceRef: "forecastSource",
  measures: [
    { id: "reach", key: "reach", label: "Reach", paramPath: "measures.reach", default: true },
  ],
  dimensions: [
    { id: "eventDate", key: "eventDate", label: "Date", paramPath: "dimensions.eventDate", default: true },
  ],
  staticFilters: [
    { id: "region", label: "Region", paramPath: "filters.region" },
  ],
  predicates: [
    {
      id: "dateRange",
      label: "Date Range",
      kind: "dateRange",
      required: true,
      description: "Forecast window.",
      startParamPath: "filters.from",
      endParamPath: "filters.to",
    },
    {
      id: "channelIds",
      label: "Channels",
      pinned: true,
      multiple: true,
      paramPath: "filters.channelIds",
    },
    {
      id: "audienceIds",
      label: "Audience",
      bucket: "scope",
      paramPath: "filters.audienceIds",
    },
  ],
});

const predicateState = {
  selectedMeasures: ["reach"],
  selectedDimensions: ["eventDate"],
  primaryMeasure: "reach",
  scopeParams: {
    dateRange: { start: "2026-06-01", end: "2026-06-07" },
    channelIds: [1, 2],
    region: "EMEA",
  },
};

assert.deepEqual(buildReportDocumentScopeParams(predicateConfig, predicateState), [
  {
    id: "dateRange",
    kind: "dateRange",
    label: "Date Range",
    description: "Forecast window.",
    required: true,
    value: { start: "2026-06-01", end: "2026-06-07" },
  },
  {
    id: "channelIds",
    kind: "multiSelect",
    label: "Channels",
    required: false,
    multiple: true,
    value: [1, 2],
  },
  {
    id: "region",
    kind: "value",
    label: "Region",
    required: false,
    value: "EMEA",
  },
]);
assert.deepEqual(buildReportBuilderBlockScopeBindings(predicateConfig), [
  { paramId: "dateRange", target: "scopeParams.dateRange" },
  { paramId: "channelIds", target: "scopeParams.channelIds" },
  { paramId: "region", target: "staticFilters.region" },
]);

const predicateDocument = buildReportBuilderReportDocument({
  container: {
    id: "forecastBuilder",
    stateKey: "forecastBuilder",
    title: "Forecast Report",
    dataSourceRef: "forecastSource",
  },
  config: predicateConfig,
  state: predicateState,
});
assert.deepEqual(predicateDocument.scope.params, buildReportDocumentScopeParams(predicateConfig, predicateState));
assert.deepEqual(predicateDocument.blocks[0].scopeBindings, buildReportBuilderBlockScopeBindings(predicateConfig));

// shared filter edits flow through scopeParams.* bindings when the document lowers
const editedPredicateDocument = JSON.parse(JSON.stringify(predicateDocument));
editedPredicateDocument.scope.params.find((param) => param.id === "dateRange").value = {
  start: "2026-07-01",
  end: "2026-07-05",
};
editedPredicateDocument.scope.params.find((param) => param.id === "channelIds").value = [9];
editedPredicateDocument.scope.params.find((param) => param.id === "region").value = "APAC";
const loweredPredicateSpec = lowerReportDocumentToReportSpec(editedPredicateDocument);
const predicateRequest = loweredPredicateSpec.datasets.find((dataset) => dataset.id === "primary").request;
assert.equal(predicateRequest.filters.from, "2026-07-01");
assert.equal(predicateRequest.filters.to, "2026-07-05");
assert.deepEqual(predicateRequest.filters.channelIds, [9]);
assert.equal(predicateRequest.filters.region, "APAC");

console.log("reportDocumentModel ✓ wraps current report builder state as ReportDocument and lowers to ReportSpec");

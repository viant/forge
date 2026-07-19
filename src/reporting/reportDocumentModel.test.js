import assert from "node:assert/strict";

import {
  applyReportDocumentDatasetCatalogToConfig,
  buildReportBuilderReportDocument,
  buildReportDocumentBadgesBlock,
  buildReportBuilderBlockScopeBindings,
  buildReportDocumentChartBlock,
  buildReportDocumentCollectionBlock,
  buildReportDocumentSectionBlock,
  buildReportDocumentCompositeBlock,
  buildReportDocumentStepperBlock,
  buildReportDocumentInfoPanelBlock,
  buildReportDocumentCalloutBlock,
  buildReportDocumentKanbanBlock,
  buildReportDocumentTimelineBlock,
  extractReportDocumentTemplateIdentity,
  buildReportDocumentScopeParams,
  buildReportDocumentFilterBarBlock,
  buildReportDocumentGeoMapBlock,
  buildReportDocumentKpiBlock,
  buildReportDocumentMarkdownBlock,
  buildReportDocumentRefinementBarBlock,
  buildReportDocumentTableBlock,
  lowerReportDocumentToReportSpec,
  normalizeReportDocumentBuilderConfig,
  resolveReportDocumentBinding,
  resolveReportDocumentBuilderContext,
} from "./reportDocumentModel.js";
import { buildReportBuilderReportSpec } from "./reportSpecModel.js";
import { lowerReportBuilderPredicates } from "../components/dashboard/reportBuilderPredicates.js";

function resolveBuilderBlock(document = null) {
  return Array.isArray(document?.blocks)
    ? (document.blocks.find((block) => block?.kind === "reportBuilderBlock") || null)
    : null;
}

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
      semanticRef: "reporting_window",
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

const semanticBinding = {
  mode: "semantic",
  modelRef: "model://example/performance/delivery@v1",
  entity: "line_delivery",
  selectedDimensions: ["event_date", "channel"],
  selectedMeasures: ["available_impressions"],
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
assert.equal(buildReportDocumentFilterBarBlock({
  id: "truncatedScopeFilters",
  title: "Scope",
  paramIds: ["[MaxDepth]"],
}), null);
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
  valueFormat: "currency",
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
assert.deepEqual(buildReportDocumentKpiBlock({
  id: "hybridKpi",
  valueField: "totalSpend",
  valueLabel: "Spend",
  presentationMode: "both",
  bodyTemplate: "**${valueLabel}:** ${value}",
}), {
  id: "hybridKpi",
  kind: "kpiBlock",
  title: "KPI",
  datasetRef: "primary",
  valueField: "totalSpend",
  valueLabel: "Spend",
  presentationMode: "both",
  bodyFormat: "markdown",
  bodyTemplate: "**${valueLabel}:** ${value}",
});
assert.deepEqual(buildReportDocumentCollectionBlock({
  id: "topChannels",
  itemTitleField: "channelId",
  itemTitleLabel: "Channel",
  valueField: "totalSpend",
  valueLabel: "Spend",
  rowLimit: 4,
  columns: 3,
  bodyTemplate: "**Channel:** ${row.channelId}",
}), {
  id: "topChannels",
  kind: "collectionBlock",
  title: "Collection",
  datasetRef: "primary",
  itemTitleField: "channelId",
  itemTitleLabel: "Channel",
  valueField: "totalSpend",
  valueLabel: "Spend",
  layout: "grid",
  columns: 3,
  rowLimit: 4,
  bodyFormat: "markdown",
  bodyTemplate: "**Channel:** ${row.channelId}",
});
assert.deepEqual(buildReportDocumentSectionBlock({
  id: "overviewSection",
  title: "Overview",
  subtitle: "Supply outlook",
  description: "Starts with the high-level executive view.",
}), {
  id: "overviewSection",
  kind: "sectionBlock",
  title: "Overview",
  subtitle: "Supply outlook",
  description: "Starts with the high-level executive view.",
  navigationLabel: "Overview",
});
assert.deepEqual(buildReportDocumentCompositeBlock({
  id: "summaryPanel",
  title: "Summary panel",
  description: "Groups the opening narrative and KPI.",
  childBlockIds: ["narrativeIntro", "headlineKpi", "headlineKpi"],
}), {
  id: "summaryPanel",
  kind: "compositeBlock",
  title: "Summary panel",
  description: "Groups the opening narrative and KPI.",
  childBlockIds: ["narrativeIntro", "headlineKpi"],
});
assert.deepEqual(buildReportDocumentStepperBlock({
  id: "integrationFlow",
  title: "Direct Integration Path",
  description: "Three stages to define a direct path.",
  steps: [
    { id: "step_1", title: "Bid directly", body: "Connect bidding directly to the publisher ad server." },
    { id: "step_2", title: "Uncap QPS", body: "Enable access to the full inventory set." },
  ],
}), {
  id: "integrationFlow",
  kind: "stepperBlock",
  title: "Direct Integration Path",
  description: "Three stages to define a direct path.",
  steps: [
    { id: "step_1", title: "Bid directly", body: "Connect bidding directly to the publisher ad server." },
    { id: "step_2", title: "Uncap QPS", body: "Enable access to the full inventory set." },
  ],
});
assert.deepEqual(buildReportDocumentInfoPanelBlock({
  id: "directIntro",
  title: "What is a Direct Integration Path?",
  eyebrow: "What is it?",
  description: "Explains the direct path concept.",
  tone: "info",
  body: "A direct integration connects bidding directly into the publisher ad server.",
}), {
  id: "directIntro",
  kind: "infoPanelBlock",
  title: "What is a Direct Integration Path?",
  eyebrow: "What is it?",
  description: "Explains the direct path concept.",
  tone: "info",
  bodyFormat: "markdown",
  body: "A direct integration connects bidding directly into the publisher ad server.",
});
assert.deepEqual(buildReportDocumentCalloutBlock({
  id: "launchCallout",
  title: "Launch update",
  icon: "warning-sign",
  description: "Important rollout note.",
  tone: "warning",
  badgesText: "Executive, Launch Ready",
  body: "Publisher activation is staged for Friday.",
}), {
  id: "launchCallout",
  kind: "calloutBlock",
  title: "Launch update",
  icon: "warning-sign",
  description: "Important rollout note.",
  tone: "warning",
  badges: ["Executive", "Launch Ready"],
  bodyFormat: "markdown",
  body: "Publisher activation is staged for Friday.",
});
assert.deepEqual(buildReportDocumentKanbanBlock({
  id: "publisherPipeline",
  title: "Publisher Pipeline",
  description: "Track publisher activations by stage.",
  columns: [
    {
      id: "signed",
      title: "Signed",
      cards: [
        { id: "tubi", title: "Tubi", body: "SpringServe integration live.", badge: "Live" },
      ],
    },
  ],
}), {
  id: "publisherPipeline",
  kind: "kanbanBlock",
  title: "Publisher Pipeline",
  description: "Track publisher activations by stage.",
  columns: [
    {
      id: "signed",
      title: "Signed",
      cards: [
        { id: "tubi", title: "Tubi", body: "SpringServe integration live.", badge: "Live" },
      ],
    },
  ],
});
assert.deepEqual(buildReportDocumentTimelineBlock({
  id: "integrationTimeline",
  title: "Integration Timeline",
  description: "Track the rollout milestones.",
  events: [
    { id: "event_1", date: "2026-07-15", badge: "Target", title: "Roku signed", body: "Expected signature date." },
  ],
}), {
  id: "integrationTimeline",
  kind: "timelineBlock",
  title: "Integration Timeline",
  description: "Track the rollout milestones.",
  events: [
    { id: "event_1", date: "2026-07-15", title: "Roku signed", body: "Expected signature date.", badge: "Target" },
  ],
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
assert.equal(Array.isArray(document.datasets), true);
assert.equal(document.datasets.length, 1);
assert.deepEqual(document.presentation, {
  orderFields: [
    { value: "eventDate", field: "eventDate", default: true, defaultDirection: "asc" },
    { value: "totalSpend", field: "totalSpend", defaultDirection: "desc" },
  ],
  pageSize: 50,
  chartCreationMode: "explicit",
  resultPanePosition: "left",
  defaultChartSpecs: config.result.defaultChartSpecs,
});
assert.deepEqual(document.datasets[0], {
  id: "primary",
  dataSourceRef: "demoReportSource",
  label: "Performance Report",
  description: "Primary report dataset",
  kindLabel: "primary",
  request: {
    measures: { totalSpend: true, impressions: true },
    dimensions: { eventDate: true, channelId: true },
    filters: {
      From: "2026-05-01",
      To: "2026-05-04",
    },
    limit: 25,
    offset: 0,
    orderBy: ["totalSpend desc"],
  },
  columnOptions: [
    {
      key: "eventDate",
      label: "Date",
      kind: "dimension",
      sourceKey: "eventDate",
      format: "date",
      default: true,
      chartAxis: true,
      paramPath: "dimensions.eventDate",
    },
    {
      key: "channelId",
      label: "Channel",
      kind: "dimension",
      sourceKey: "channelId",
      paramPath: "dimensions.channelId",
    },
    {
      key: "totalSpend",
      label: "Spend",
      kind: "measure",
      sourceKey: "totalSpend",
      format: "currency",
      default: true,
      paramPath: "measures.totalSpend",
    },
    {
      key: "impressions",
      label: "Impressions",
      kind: "measure",
      sourceKey: "impressions",
      format: "compactNumber",
      paramPath: "measures.impressions",
    },
  ],
  valueFieldOptions: [
    { value: "totalSpend", label: "Spend", format: "currency", default: true },
    { value: "impressions", label: "Impressions", format: "compactNumber" },
  ],
  secondaryFieldOptions: [
    { value: "eventDate", label: "Date", format: "date", default: true },
    { value: "channelId", label: "Channel" },
  ],
  chartFieldOptions: [
    { key: "eventDate", aliases: ["eventDate"], label: "Date", kind: "dimension", format: "date", default: true, chartAxis: true },
    { key: "channelId", aliases: ["channelId"], label: "Channel", kind: "dimension" },
    { key: "totalSpend", aliases: ["totalSpend"], label: "Spend", kind: "measure", format: "currency", default: true, align: "right" },
    { key: "impressions", aliases: ["impressions"], label: "Impressions", kind: "measure", format: "compactNumber", align: "right" },
  ],
  dimensions: config.dimensions,
  measures: config.measures,
  scopeParamOptions: [
    {
      value: "dateRange",
      label: "dateRange",
      description: "Approved reporting window for shared runtime scope.",
      kind: "dateRange",
      required: true,
      semanticRef: "reporting_window",
      startParamPath: "filters.From",
      endParamPath: "filters.To",
    },
  ],
});
assert.deepEqual(document.layout, {
  type: "stack",
  items: [
    {
      blockId: "sharedFilters",
    },
    {
      blockId: "activeRefinements",
    },
    {
      blockId: "primaryBuilder",
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
assert.deepEqual(resolveBuilderBlock(document).source, {
  kind: "dashboard.reportBuilder",
  containerId: "performanceBuilder",
  stateKey: "performanceBuilder",
  dataSourceRef: "demoReportSource",
});
// Presentation metadata (orderFields, pageSize, chart creation mode, default
// chart specs, result pane position) moved to document.presentation and is
// stripped from the embedded builder config.
assert.deepEqual(resolveBuilderBlock(document).config, {
  title: "Performance Report",
});
assert.equal(Object.prototype.hasOwnProperty.call(resolveBuilderBlock(document).config, "measures"), false);
assert.equal(Object.prototype.hasOwnProperty.call(resolveBuilderBlock(document).config, "dimensions"), false);
assert.equal(Object.prototype.hasOwnProperty.call(resolveBuilderBlock(document).config, "calculatedFields"), false);
assert.equal(Object.prototype.hasOwnProperty.call(resolveBuilderBlock(document).config, "computedMeasures"), false);
assert.equal(Object.prototype.hasOwnProperty.call(resolveBuilderBlock(document).config, "tableCalculations"), false);
assert.equal(Object.prototype.hasOwnProperty.call(resolveBuilderBlock(document).config, "staticFilters"), false);
assert.deepEqual(resolveBuilderBlock(document).state, state);
assert.deepEqual(resolveBuilderBlock(document).scopeBindings, [
  {
    paramId: "dateRange",
    target: "staticFilters.dateRange",
  },
]);
assert.deepEqual(document.blocks.find((block) => block.id === "sharedFilters"), filterBarBlock);
assert.deepEqual(document.blocks.find((block) => block.id === "activeRefinements"), refinementBarBlock);
assert.deepEqual(document.blocks.find((block) => block.id === "headlineKpi"), headlineKpiBlock);
assert.deepEqual(document.blocks.find((block) => block.id === "statusPills"), statusPillsBlock);
assert.deepEqual(document.blocks.find((block) => block.id === "channelTrend"), authoredChartBlock);
assert.deepEqual(document.blocks.find((block) => block.id === "comparisonTable"), comparisonTableBlock);
assert.deepEqual(document.blocks.find((block) => block.id === "stateGeo"), geoMapBlock);
assert.deepEqual(document.blocks.find((block) => block.id === "narrativeIntro"), markdownBlock);

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
assert.deepEqual(resolveBuilderBlock(hostedWindowFallbackDocument).source, {
  kind: "dashboard.reportBuilder",
  containerId: "forecastingCubeBuilder",
  stateKey: "forecastingCubeBuilder",
  dataSourceRef: "forecasting_cube_report",
});

assert.deepEqual(buildReportDocumentScopeParams(config, state), document.scope.params);
assert.deepEqual(buildReportBuilderBlockScopeBindings(config), resolveBuilderBlock(document).scopeBindings);

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
assert.deepEqual(buildReportDocumentScopeParams({
  ...sourceScopedConfig,
  datasets: sourceScopedConfig.dataSources,
  dataSources: [],
}, sourceScopedState).find((param) => param.id === "forecastRegion"), {
  id: "forecastRegion",
  kind: "multiSelect",
  label: "Forecast Region",
  description: "Region filter for forecast source.",
  required: false,
  datasetRef: "forecast_cube",
  value: ["US/NY"],
});
assert.equal(
  buildReportBuilderBlockScopeBindings({
    ...sourceScopedConfig,
    datasets: sourceScopedConfig.dataSources,
    dataSources: [],
  }).some((binding) => binding.paramId === "forecastRegion" && binding.target === "scopeParams.forecastRegion"),
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
// the canonical primary catalog entry lowers to exactly one primary dataset and
// is never re-read as a secondary published dataset
assert.equal(lowered.datasets.filter((dataset) => dataset.id === "primary").length, 1);
assert.deepEqual(lowered.datasets.map((dataset) => dataset.id), baseSpec.datasets.map((dataset) => dataset.id));
assert.deepEqual(applyReportDocumentDatasetCatalogToConfig(config, document), config);
const themedDocument = buildReportBuilderReportDocument({
  container,
  config,
  state: {
    ...state,
    reportDocumentThemeAccent: "green",
    reportDocumentBadgePalette: "bold",
  },
});
assert.deepEqual(themedDocument.theme, {
  accentTone: "green",
  badgePalette: "bold",
});
assert.deepEqual(lowerReportDocumentToReportSpec(themedDocument).theme, {
  accentTone: "green",
  badgePalette: "bold",
});
// older documents without a primary catalog entry but with the legacy embedded
// config still lower identically
assert.deepEqual(lowerReportDocumentToReportSpec({
  ...document,
  datasets: [],
  blocks: document.blocks.map((block) => (
    block?.kind === "reportBuilderBlock"
      ? { ...block, config: JSON.parse(JSON.stringify(config)) }
      : block
  )),
}), lowered);
const minimalPrimaryDatasetDocument = buildReportBuilderReportDocument({
  container,
  config,
  state,
});
const loweredPrimaryDatasetFallbackSpec = lowerReportDocumentToReportSpec({
  ...minimalPrimaryDatasetDocument,
  blocks: minimalPrimaryDatasetDocument.blocks.map((block) => (
    block?.kind === "reportBuilderBlock"
      ? {
        ...block,
        config: {
          title: block?.config?.title,
        },
      }
      : block
  )),
});
assert.equal(loweredPrimaryDatasetFallbackSpec.datasets.find((dataset) => dataset.id === "primary")?.dataSourceRef, "demoReportSource");
assert.deepEqual(
  loweredPrimaryDatasetFallbackSpec.datasets.find((dataset) => dataset.id === "primary")?.request,
  minimalPrimaryDatasetDocument.datasets.find((dataset) => dataset.id === "primary")?.request,
);
const loweredPrimaryFieldCatalogFallbackSpec = lowerReportDocumentToReportSpec({
  ...document,
  blocks: document.blocks.map((block) => (
    block?.kind === "reportBuilderBlock"
      ? {
        ...block,
        config: {
          title: block?.config?.title,
        },
      }
      : block
  )),
});
assert.deepEqual(
  loweredPrimaryFieldCatalogFallbackSpec.blocks.find((block) => block.id === "headlineKpi"),
  {
    id: "headlineKpi",
    kind: "kpiBlock",
    title: "Headline KPI",
    datasetRef: "primary",
    valueField: "totalSpend",
    valueLabel: "Spend",
    valueFormat: "currency",
    secondaryField: "channelId",
    secondaryLabel: "Channel",
    description: "Summarizes the first authored runtime row.",
    emptyLabel: "No headline KPI value available.",
  },
);
assert.deepEqual(
  loweredPrimaryFieldCatalogFallbackSpec.blocks.find((block) => block.id === "channelTrend")?.chartSpec,
  {
    title: "Channel Trend",
    type: "line",
    xField: "eventDate",
    yFields: ["impressions"],
    seriesField: "channelId",
  },
);
assert.deepEqual(
  lowered.blocks.find((block) => block.id === baseSpec.blocks[0].id),
  baseSpec.blocks[0],
);
assert.deepEqual(
  lowered.blocks.find((block) => block.id === baseSpec.blocks[1].id),
  baseSpec.blocks[1],
);
assert.deepEqual(lowered.blocks.find((block) => block.id === "sharedFilters"), {
  id: "sharedFilters",
  kind: "filterBarBlock",
  title: "Shared Filters",
  datasetRef: "primary",
  paramIds: ["dateRange"],
});
assert.deepEqual(lowered.blocks.find((block) => block.id === "activeRefinements"), {
  id: "activeRefinements",
  kind: "refinementBarBlock",
  title: "Applied Refinements",
  actionKinds: ["remove", "clearAll", "undo"],
  emptyLabel: "No drill path selected",
});
assert.deepEqual(lowered.blocks.find((block) => block.id === "headlineKpi"), headlineKpiBlock);
assert.deepEqual(lowered.blocks.find((block) => block.id === "statusPills"), statusPillsBlock);
assert.deepEqual(lowered.blocks.find((block) => block.id === "channelTrend"), {
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
assert.deepEqual(lowered.blocks.find((block) => block.id === "comparisonTable"), comparisonTableBlock);
assert.deepEqual(lowered.blocks.find((block) => block.id === "stateGeo"), geoMapBlock);
assert.deepEqual(lowered.blocks.find((block) => block.id === "narrativeIntro"), {
  id: "narrativeIntro",
  kind: "markdownBlock",
  title: "Executive Summary",
  markdown: "## Executive Summary\nThe report opens with a short narrative block.",
});
assert.deepEqual(lowered.layoutIntent.blockOrder, [
  "sharedFilters",
  "activeRefinements",
  "primaryTable",
  "primaryChart",
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
assert.equal(Object.prototype.hasOwnProperty.call(resolveBuilderBlock(staticBadgeDocument).state, "reportStaticDatasets"), false);
assert.equal(staticBadgeDocument.datasets.some((dataset) => dataset.id === "regional_csv" && Array.isArray(dataset.rows)), true);
const loweredStaticBadgeDocument = lowerReportDocumentToReportSpec(staticBadgeDocument, {
  includePrimaryBlocks: false,
});
assert.equal(Object.prototype.hasOwnProperty.call(loweredStaticBadgeDocument.datasets[0].request.dimensions || {}, "region"), false);
const loweredStaticDatasetDeclaration = loweredStaticBadgeDocument.datasets.find((dataset) => dataset.id === "regional_csv");
assert.equal(loweredStaticDatasetDeclaration?.dataSourceRef, "static_csv_regional_csv");
assert.equal(loweredStaticDatasetDeclaration?.request?.kind, "staticCsv");
assert.deepEqual(loweredStaticDatasetDeclaration?.request?.columnKeys, ["region", "revenue"]);

const loweredLegacyStaticBadgeDocument = lowerReportDocumentToReportSpec({
  ...staticBadgeDocument,
  datasets: [],
  blocks: staticBadgeDocument.blocks.map((block) => (
    block?.kind === "reportBuilderBlock"
      ? {
        ...block,
        state: {
          ...block.state,
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
      }
      : block
  )),
}, {
  includePrimaryBlocks: false,
});
assert.equal(Object.prototype.hasOwnProperty.call(loweredLegacyStaticBadgeDocument.datasets[0].request.dimensions || {}, "region"), false);
const loweredLegacyStaticDatasetDeclaration = loweredLegacyStaticBadgeDocument.datasets.find((dataset) => dataset.id === "regional_csv");
assert.equal(loweredLegacyStaticDatasetDeclaration?.request?.kind, "staticCsv");
assert.deepEqual(loweredLegacyStaticDatasetDeclaration?.request?.columnKeys, ["region", "revenue"]);

const loweredMinimalRefinementBar = lowerReportDocumentToReportSpec({
  ...document,
  blocks: [
    resolveBuilderBlock(document),
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
assert.deepEqual(stateBackedDocument.blocks.filter((block) => block.kind !== "reportBuilderBlock"), [
  headlineKpiBlock,
  markdownBlock,
]);
assert.equal(Object.prototype.hasOwnProperty.call(resolveBuilderBlock(stateBackedDocument).state, "reportDocumentBlocks"), false);
assert.equal(Object.prototype.hasOwnProperty.call(resolveBuilderBlock(stateBackedDocument).state, "reportDocumentLayout"), false);
assert.equal(Object.prototype.hasOwnProperty.call(resolveBuilderBlock(stateBackedDocument).state, "reportStaticDatasets"), false);

const bindingBackedDocument = buildReportBuilderReportDocument({
  container,
  config: {
    ...config,
    binding: semanticBinding,
  },
  state,
});
assert.deepEqual(bindingBackedDocument.binding, semanticBinding);
assert.equal(Object.prototype.hasOwnProperty.call(resolveBuilderBlock(bindingBackedDocument).config, "binding"), false);
assert.equal(Object.prototype.hasOwnProperty.call(resolveBuilderBlock(bindingBackedDocument).state, "binding"), false);
assert.equal(Object.prototype.hasOwnProperty.call(resolveBuilderBlock(bindingBackedDocument).config, "measures"), false);
assert.equal(Object.prototype.hasOwnProperty.call(resolveBuilderBlock(bindingBackedDocument).config, "dimensions"), false);
assert.deepEqual(resolveReportDocumentBinding(bindingBackedDocument), semanticBinding);
assert.deepEqual(lowerReportDocumentToReportSpec(bindingBackedDocument).binding, semanticBinding);
assert.deepEqual(resolveReportDocumentBinding(null, null, { binding: semanticBinding }), semanticBinding);

const loweredLegacyBindingDocumentSpec = lowerReportDocumentToReportSpec({
  ...bindingBackedDocument,
  binding: undefined,
  blocks: bindingBackedDocument.blocks.map((block) => (
    block?.kind === "reportBuilderBlock"
      ? {
        ...block,
        config: {
          ...block.config,
          binding: semanticBinding,
        },
      }
      : block
  )),
});
assert.deepEqual(loweredLegacyBindingDocumentSpec.binding, semanticBinding);

const explicitDatasetDocument = buildReportBuilderReportDocument({
  container,
  config: {
    ...config,
    datasets: [
      {
        id: "reach_summary",
        dataSourceRef: "reachSummarySource",
        label: "Reach Summary",
        scope: {
          inheritContext: true,
          filters: {
            grain: "day",
          },
        },
        source: {
          kind: "mcp",
          server: "steward",
          tool: "reach.summary",
          contractRef: "steward://reach/summary",
        },
        resultContract: {
          shape: "rowSet",
          rowPath: "rows",
        },
        capabilities: {
          fieldCatalog: true,
          scopeParams: true,
          datly: {
            unifiedCube: true,
          },
        },
        request: {
          measures: { hhUniqs: true },
          dimensions: { country: true },
          filters: {},
          limit: 12,
          offset: 0,
        },
        scopeParamOptions: [
          { value: "reachCountry", label: "Reach Country" },
        ],
      },
    ],
  },
  state,
});
assert.equal(explicitDatasetDocument.datasets.some((dataset) => dataset.id === "reach_summary"), true);
assert.equal(explicitDatasetDocument.datasets.some((dataset) => dataset.id === "primary"), true);
assert.equal(Array.isArray(resolveBuilderBlock(explicitDatasetDocument).config?.datasets), false);
assert.equal(Array.isArray(resolveBuilderBlock(explicitDatasetDocument).config?.dataSources), false);

const deduplicatedDatasetDocument = buildReportBuilderReportDocument({
  container,
  config: {
    ...config,
    staticFilters: [{
      id: "channelId",
      field: "channelId",
      label: "Channel",
      type: "multiSelect",
      multiple: true,
      options: [{ label: "CTV", value: 1 }],
    }],
    dataSources: [
      { id: "primary", dataSourceRef: "duplicatePrimary" },
      { id: "adapter_rows", dataSourceRef: "adapter_rows" },
    ],
  },
  state: {
    ...state,
    reportStaticDatasets: [{
      id: "adapter_rows",
      dataSourceRef: "static_json_adapter_rows",
      label: "Adapter rows",
      rows: [{ channelId: 1 }],
      columnOptions: [{ key: "channelId", label: "Channel", kind: "dimension" }],
    }],
  },
});
assert.equal(deduplicatedDatasetDocument.datasets.filter((dataset) => dataset.id === "primary").length, 1);
assert.equal(deduplicatedDatasetDocument.datasets.filter((dataset) => dataset.id === "adapter_rows").length, 1);
assert.equal(deduplicatedDatasetDocument.datasets.find((dataset) => dataset.id === "adapter_rows")?.rows?.length, 1);
assert.equal(
  deduplicatedDatasetDocument.datasets.find((dataset) => dataset.id === "primary")?.scopeParamOptions?.some((option) => option.value === "channelId"),
  true,
);
assert.deepEqual(
  explicitDatasetDocument.datasets.find((dataset) => dataset.id === "reach_summary"),
  {
    id: "reach_summary",
    dataSourceRef: "reachSummarySource",
    label: "Reach Summary",
    description: "",
    kindLabel: "published",
    scope: {
      inheritContext: true,
      filters: {
        grain: "day",
      },
    },
    source: {
      kind: "mcp",
      server: "steward",
      tool: "reach.summary",
      contractRef: "steward://reach/summary",
    },
    resultContract: {
      shape: "rowSet",
      rowPath: "rows",
    },
    capabilities: {
      fieldCatalog: true,
      scopeParams: true,
      datly: {
        unifiedCube: true,
      },
    },
    request: {
      measures: { hhUniqs: true },
      dimensions: { country: true },
      filters: {},
      limit: 12,
      offset: 0,
    },
    columnOptions: [],
    valueFieldOptions: [],
    secondaryFieldOptions: [],
    chartFieldOptions: [],
    scopeParamOptions: [
      { value: "reachCountry", label: "Reach Country" },
    ],
  },
);
assert.deepEqual(
  applyReportDocumentDatasetCatalogToConfig(config, explicitDatasetDocument).datasets,
  [
    {
      id: "reach_summary",
      dataSourceRef: "reachSummarySource",
      label: "Reach Summary",
      description: "",
      kindLabel: "published",
      scope: {
        inheritContext: true,
        filters: {
          grain: "day",
        },
      },
      source: {
        kind: "mcp",
        server: "steward",
        tool: "reach.summary",
        contractRef: "steward://reach/summary",
      },
      resultContract: {
        shape: "rowSet",
        rowPath: "rows",
      },
      capabilities: {
        fieldCatalog: true,
        scopeParams: true,
        datly: {
          unifiedCube: true,
        },
      },
      request: {
        measures: { hhUniqs: true },
        dimensions: { country: true },
        filters: {},
        limit: 12,
        offset: 0,
      },
      columnOptions: [],
      valueFieldOptions: [],
      secondaryFieldOptions: [],
      chartFieldOptions: [],
      scopeParamOptions: [
        { value: "reachCountry", label: "Reach Country" },
      ],
    },
  ],
);
assert.deepEqual(
  normalizeReportDocumentBuilderConfig({
    ...document,
    blocks: document.blocks.map((block) => (
      block?.kind === "reportBuilderBlock"
        ? {
          ...block,
          config: {
            title: block?.config?.title,
          },
        }
        : block
    )),
  }, { title: "Performance Report" }, state).result,
  {
    orderFields: [
      { value: "eventDate", field: "eventDate", default: true, defaultDirection: "asc" },
      { value: "totalSpend", field: "totalSpend", defaultDirection: "desc" },
    ],
    pageSize: 50,
    chartCreationMode: "explicit",
    resultPanePosition: "left",
    defaultChartSpecs: config.result.defaultChartSpecs,
  },
);

// Canonical path: building a document strips every presentation field the
// document-level presentation carries (groupBy options, order fields, table
// presets, default mode, page size, chart creation mode, result pane position,
// default chart specs) from the embedded builder config, and
// normalizeReportDocumentBuilderConfig restores them from document.presentation.
const presentationRichConfig = {
  ...config,
  groupBy: {
    options: [
      { value: "channelId", label: "Channel" },
      { value: "eventDate", label: "Date" },
    ],
  },
  result: {
    ...config.result,
    defaultTablePresets: [
      { id: "topSpend", label: "Top Spend", orderField: "totalSpend", orderDir: "desc" },
    ],
    defaultMode: "table",
  },
};
const presentationRichDocument = buildReportBuilderReportDocument({
  container,
  config: presentationRichConfig,
  state,
});
assert.deepEqual(presentationRichDocument.presentation, {
  groupByOptions: presentationRichConfig.groupBy.options,
  orderFields: config.result.orderFields,
  defaultTablePresets: presentationRichConfig.result.defaultTablePresets,
  defaultMode: "table",
  pageSize: 50,
  chartCreationMode: "explicit",
  resultPanePosition: "left",
  defaultChartSpecs: config.result.defaultChartSpecs,
});
const presentationRichEmbeddedConfig = resolveBuilderBlock(presentationRichDocument).config;
assert.equal("groupBy" in presentationRichEmbeddedConfig, false);
assert.equal("result" in presentationRichEmbeddedConfig, false);
const presentationRichRestoredConfig = normalizeReportDocumentBuilderConfig(
  presentationRichDocument,
  presentationRichEmbeddedConfig,
  resolveBuilderBlock(presentationRichDocument).state,
);
assert.deepEqual(presentationRichRestoredConfig.groupBy.options, presentationRichConfig.groupBy.options);
assert.deepEqual(presentationRichRestoredConfig.result.orderFields, config.result.orderFields);
assert.deepEqual(presentationRichRestoredConfig.result.defaultTablePresets, presentationRichConfig.result.defaultTablePresets);
assert.equal(presentationRichRestoredConfig.result.defaultMode, "table");
assert.equal(presentationRichRestoredConfig.result.pageSize, 50);
assert.equal(presentationRichRestoredConfig.result.chartCreationMode, "explicit");
assert.equal(presentationRichRestoredConfig.result.resultPanePosition, "left");
assert.deepEqual(presentationRichRestoredConfig.result.defaultChartSpecs, config.result.defaultChartSpecs);

// Fallback path: older documents carry the presentation metadata only on the
// embedded builder config; without document.presentation the config-side
// fields pass through reconstruction untouched.
const legacyPresentationDocument = {
  ...presentationRichDocument,
  blocks: presentationRichDocument.blocks.map((block) => (
    block?.kind === "reportBuilderBlock"
      ? { ...block, config: JSON.parse(JSON.stringify(presentationRichConfig)) }
      : block
  )),
};
delete legacyPresentationDocument.presentation;
const legacyRestoredConfig = normalizeReportDocumentBuilderConfig(
  legacyPresentationDocument,
  resolveBuilderBlock(legacyPresentationDocument).config,
  state,
);
assert.deepEqual(legacyRestoredConfig.groupBy.options, presentationRichConfig.groupBy.options);
assert.deepEqual(legacyRestoredConfig.result.orderFields, config.result.orderFields);
assert.deepEqual(legacyRestoredConfig.result.defaultTablePresets, presentationRichConfig.result.defaultTablePresets);
assert.equal(legacyRestoredConfig.result.defaultMode, "table");
assert.equal(legacyRestoredConfig.result.pageSize, 50);
assert.equal(legacyRestoredConfig.result.chartCreationMode, "explicit");
assert.equal(legacyRestoredConfig.result.resultPanePosition, "left");
assert.deepEqual(legacyRestoredConfig.result.defaultChartSpecs, config.result.defaultChartSpecs);

const loweredExplicitDatasetSpec = lowerReportDocumentToReportSpec({
  ...explicitDatasetDocument,
  blocks: [
    ...explicitDatasetDocument.blocks,
    buildReportDocumentTableBlock({
      id: "reachSummaryTable",
      title: "Reach Summary",
      datasetRef: "reach_summary",
      columns: [
        { key: "country", label: "Country" },
        { key: "hhUniqs", label: "HH Uniques" },
      ],
    }),
  ],
  layout: {
    ...explicitDatasetDocument.layout,
    items: [
      ...explicitDatasetDocument.layout.items,
      { blockId: "reachSummaryTable" },
    ],
  },
});
assert.equal(loweredExplicitDatasetSpec.datasets.some((dataset) => dataset.id === "reach_summary"), true);
assert.equal(loweredExplicitDatasetSpec.datasets.filter((dataset) => dataset.id === "primary").length, 1);
assert.deepEqual(
  loweredExplicitDatasetSpec.datasets.find((dataset) => dataset.id === "reach_summary")?.request,
  {
    measures: { hhUniqs: true },
    dimensions: { country: true },
    filters: { grain: "day" },
    limit: 12,
    offset: 0,
  },
);

const inheritedSameSourceDocument = buildReportBuilderReportDocument({
  container,
  config: {
    ...config,
    staticFilters: [
      ...config.staticFilters,
      {
        id: "orderIds",
        type: "multiSelect",
        paramPath: "filters.orderIds",
      },
    ],
    datasets: [
      {
        id: "delivery_today",
        dataSourceRef: container.dataSourceRef,
        scope: {
          mode: "override",
          local: {
            filters: {
              From: "2026-07-16",
              To: "2026-07-16",
            },
          },
        },
        request: {
          measures: { totalSpend: true },
          dimensions: { eventDate: true },
          filters: {},
        },
      },
    ],
  },
  state: {
    ...state,
    scopeParams: {
      ...state.scopeParams,
      orderIds: [2659519],
    },
  },
});
const loweredInheritedSameSourceSpec = lowerReportDocumentToReportSpec({
  ...inheritedSameSourceDocument,
  blocks: [
    ...inheritedSameSourceDocument.blocks,
    buildReportDocumentTableBlock({
      id: "todayTable",
      title: "Today",
      datasetRef: "delivery_today",
      columns: [
        { key: "eventDate", label: "Date" },
        { key: "totalSpend", label: "Spend" },
      ],
    }),
  ],
});
assert.deepEqual(
  loweredInheritedSameSourceSpec.datasets.find((dataset) => dataset.id === "delivery_today")?.request?.filters,
  {
    From: "2026-07-16",
    To: "2026-07-16",
    orderIds: [2659519],
  },
);

const sharedEndpointWindows = {
  delivery_today: { From: "2026-07-17", To: "2026-07-17" },
  delivery_yesterday: { From: "2026-07-16", To: "2026-07-16" },
  delivery_last_7_days: { From: "2026-07-11", To: "2026-07-17" },
};
const sharedEndpointDocument = buildReportBuilderReportDocument({
  container,
  config: {
    ...config,
    datasets: Object.entries(sharedEndpointWindows).map(([id, window]) => ({
      id,
      dataSourceRef: container.dataSourceRef,
      scope: { mode: "override", local: { filters: window } },
      scopeParamOptions: [{ value: "orderIds", kind: "multiSelect", paramPath: "filters.orderIds" }],
      request: { measures: { totalSpend: true }, dimensions: { eventDate: true }, filters: {} },
    })),
  },
  state,
});
assert.deepEqual(
  sharedEndpointDocument.datasets
    .filter((dataset) => dataset.id !== "primary")
    .map((dataset) => dataset.id),
  Object.keys(sharedEndpointWindows),
  "saving must persist every logical dataset sharing one endpoint",
);
const loweredSharedEndpointSpec = lowerReportDocumentToReportSpec({
  ...sharedEndpointDocument,
  blocks: [
    ...sharedEndpointDocument.blocks,
    ...Object.keys(sharedEndpointWindows).map((datasetRef) => buildReportDocumentTableBlock({
      id: `${datasetRef}Table`,
      title: datasetRef,
      datasetRef,
      columns: [
        { key: "eventDate", label: "Date" },
        { key: "totalSpend", label: "Spend" },
      ],
    })),
  ],
}, {
  runtimeDatasetScopeParams: {
    delivery_today: { orderIds: [111] },
    [container.dataSourceRef]: { orderIds: [999] },
  },
});
const loweredSharedEndpointIds = loweredSharedEndpointSpec.datasets.map((dataset) => dataset.id);
assert.equal(
  new Set(loweredSharedEndpointIds).size,
  loweredSharedEndpointIds.length,
  "reopened dataset ids must stay unique",
);
assert.equal(
  loweredSharedEndpointIds.includes(container.dataSourceRef),
  false,
  "reopening must not synthesize a dataset named after the shared endpoint",
);
Object.entries(sharedEndpointWindows).forEach(([id, window]) => {
  const dataset = loweredSharedEndpointSpec.datasets.find((entry) => entry.id === id);
  assert.equal(dataset?.dataSourceRef, container.dataSourceRef);
  assert.equal(dataset?.request?.filters?.From, window.From, `${id} must keep its own window after reopen`);
  assert.equal(dataset?.request?.filters?.To, window.To, `${id} must keep its own window after reopen`);
  assert.deepEqual(
    dataset?.request?.filters?.orderIds,
    id === "delivery_today" ? [111] : undefined,
    `${id} runtime scope values must stay dataset-specific after reopen`,
  );
});

const loweredLegacyExplicitDatasetSpec = lowerReportDocumentToReportSpec({
  ...explicitDatasetDocument,
  datasets: explicitDatasetDocument.datasets.filter((dataset) => dataset.id !== "primary"),
  blocks: [
    ...explicitDatasetDocument.blocks.map((block) => (
    block?.kind === "reportBuilderBlock"
      ? {
        ...block,
        config: {
          ...block.config,
          dataSources: [
            {
              id: "reach_summary",
              dataSourceRef: "reachSummarySource",
              label: "Reach Summary",
              request: {
                measures: { hhUniqs: true },
                dimensions: { country: true },
                filters: {},
                limit: 12,
                offset: 0,
              },
              scopeParamOptions: [
                { value: "reachCountry", label: "Reach Country" },
              ],
            },
          ],
        },
      }
      : block
    )),
    buildReportDocumentTableBlock({
      id: "reachSummaryTable",
      title: "Reach Summary",
      datasetRef: "reach_summary",
      columns: [
        { key: "country", label: "Country" },
        { key: "hhUniqs", label: "HH Uniques" },
      ],
    }),
  ],
  layout: {
    ...explicitDatasetDocument.layout,
    items: [
      ...explicitDatasetDocument.layout.items,
      { blockId: "reachSummaryTable" },
    ],
  },
});
assert.equal(loweredLegacyExplicitDatasetSpec.datasets.some((dataset) => dataset.id === "reach_summary"), true);

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

// older documents may persist thin scope params (id/value only); lowering
// re-enriches them from the embedded builder config so the spec carries the
// filter metadata itself, while the document-authored value still wins
const staleScopeParamsDocument = {
  ...document,
  scope: {
    ...document.scope,
    params: [
      { id: "dateRange", value: { start: "2026-06-01", end: "2026-06-07" } },
    ],
  },
};
const loweredWithStaleScopeParams = lowerReportDocumentToReportSpec(staleScopeParamsDocument);
assert.deepEqual(loweredWithStaleScopeParams.scope.params, [
  {
    id: "dateRange",
    kind: "dateRange",
    label: "dateRange",
    description: "Approved reporting window for shared runtime scope.",
    required: true,
    value: { start: "2026-06-01", end: "2026-06-07" },
  },
]);
assert.equal(loweredWithStaleScopeParams.datasets[0].request.filters.From, "2026-06-01");
assert.equal(loweredWithStaleScopeParams.datasets[0].request.filters.To, "2026-06-07");

// documents without any scope slice regenerate the canonical params outright
const loweredWithoutDocumentScope = lowerReportDocumentToReportSpec({ ...document, scope: undefined });
assert.deepEqual(loweredWithoutDocumentScope.scope.params, buildReportDocumentScopeParams(config, state));
assert.equal(loweredWithoutDocumentScope.scope.dataSourceRef, "demoReportSource");

const contextPresetConfig = {
  ...config,
  contextPresets: [
    {
      id: "performance_order",
      label: "Performance order",
      paramIds: ["dateRange", "orderIds"],
    },
  ],
};
const contextPresetState = {
  ...state,
  contextPreset: {
    id: "performance_order",
    paramIds: ["dateRange", "orderIds"],
  },
};
const contextPresetDocument = buildReportBuilderReportDocument({
  container,
  config: contextPresetConfig,
  state: contextPresetState,
});
assert.deepEqual(contextPresetDocument.scope.contextPreset, {
  id: "performance_order",
  paramIds: ["dateRange"],
});
assert.deepEqual(lowerReportDocumentToReportSpec(contextPresetDocument).scope.contextPreset, {
  id: "performance_order",
  paramIds: ["dateRange"],
});
assert.deepEqual(buildReportBuilderReportSpec({
  container,
  config: contextPresetConfig,
  state: contextPresetState,
}).scope.contextPreset, {
  id: "performance_order",
  paramIds: ["dateRange"],
});
const clearedContextPresetDocument = buildReportBuilderReportDocument({
  container,
  config: contextPresetConfig,
  state: {
    ...contextPresetState,
    contextPreset: {
      id: "performance_order",
      paramIds: ["orderIds"],
    },
    scopeParams: {},
  },
});
assert.equal("contextPreset" in clearedContextPresetDocument.scope, false);

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
assert.equal(loweredAuthoredComputedChartDocument.blocks.find((block) => block.id === "ctrTrend")?.id, "ctrTrend");
assert.equal(loweredAuthoredComputedChartDocument.blocks.find((block) => block.id === "ctrTrend")?.chartModel?.type, "line");
assert.equal(loweredAuthoredComputedChartDocument.blocks.find((block) => block.id === "ctrTrend")?.chartModel?.series?.values?.[0]?.value, "ctr");
assert.equal(loweredAuthoredComputedChartDocument.blocks.find((block) => block.id === "ctrTrend")?.chartModel?.yAxis?.format, "percent");

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
assert.equal(loweredAuthoredLocalTableCalculationDocument.blocks.find((block) => block.id === "reachShareTrend")?.chartSpec.yFields[0], "reachShare");
assert.equal(loweredAuthoredLocalTableCalculationDocument.blocks.find((block) => block.id === "reachShareTrend")?.chartModel?.series?.values?.[0]?.value, "reachShare");
assert.equal(loweredAuthoredLocalTableCalculationDocument.blocks.find((block) => block.id === "reachShareTrend")?.chartModel?.yAxis?.format, "percent");

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
assert.deepEqual(computedDocument.datasets[0].computedMeasures, [
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
]);
assert.equal(Object.prototype.hasOwnProperty.call(resolveBuilderBlock(computedDocument).config, "staticFilters"), false);

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
assert.deepEqual(resolveBuilderBlock(predicateDocument).scopeBindings, buildReportBuilderBlockScopeBindings(predicateConfig));

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

// datasets.primary persists the richer source-contract field metadata
// (runtime-filter wiring, semantic/governance descriptors, display mapping)
// and normalizeReportDocumentBuilderConfig restores it onto a reconstructed
// builder config when the embedded config was stripped.
const contractRichConfig = {
  ...config,
  scope: {
    inheritContext: true,
  },
  source: {
    kind: "mcp",
    server: "steward",
    tool: "performance.summary",
  },
  resultContract: {
    shape: "rowSet",
    rowPath: "payload.records",
  },
  capabilities: {
    fieldCatalog: true,
    backendRefetch: true,
    datly: {
      unifiedCube: true,
    },
  },
  measures: [
    {
      ...config.measures[0],
      description: "Total spend across delivery.",
      category: "delivery",
      definitionRef: "def://measures/total_spend",
      semanticRef: "semantic://measure/total_spend",
      rawId: "total_spend",
      governance: { status: "approved", certification: "gold", ownerRef: "team://reporting" },
    },
    config.measures[1],
  ],
  dimensions: [
    config.dimensions[0],
    {
      ...config.dimensions[1],
      displayKey: "channelName",
      displayValueMap: { "1": "Display", "2": "CTV" },
      runtimeFilter: { paramPath: "filters.channelId", format: "int" },
      semanticRef: "semantic://dimension/channel",
      rawId: "channel_id",
    },
  ],
};
const contractRichDocument = buildReportBuilderReportDocument({
  container,
  config: contractRichConfig,
  state,
});
const contractRichPrimary = contractRichDocument.datasets.find((dataset) => dataset.id === "primary");
assert.deepEqual(contractRichPrimary.columnOptions, [
  {
    key: "eventDate",
    label: "Date",
    kind: "dimension",
    sourceKey: "eventDate",
    format: "date",
    default: true,
    chartAxis: true,
    paramPath: "dimensions.eventDate",
  },
  {
    key: "channelId",
    label: "Channel",
    kind: "dimension",
    sourceKey: "channelId",
    displayKey: "channelName",
    displayValueMap: { "1": "Display", "2": "CTV" },
    rawId: "channel_id",
    semanticRef: "semantic://dimension/channel",
    paramPath: "dimensions.channelId",
    runtimeFilter: { paramPath: "filters.channelId", format: "int" },
  },
  {
    key: "totalSpend",
    label: "Spend",
    kind: "measure",
    sourceKey: "totalSpend",
    format: "currency",
    rawId: "total_spend",
    description: "Total spend across delivery.",
    category: "delivery",
    definitionRef: "def://measures/total_spend",
    semanticRef: "semantic://measure/total_spend",
    governance: { status: "approved", certification: "gold", ownerRef: "team://reporting" },
    default: true,
    paramPath: "measures.totalSpend",
  },
  {
    key: "impressions",
    label: "Impressions",
    kind: "measure",
    sourceKey: "impressions",
    format: "compactNumber",
    paramPath: "measures.impressions",
  },
]);
const contractRestoredConfig = normalizeReportDocumentBuilderConfig({
  ...contractRichDocument,
  blocks: contractRichDocument.blocks.map((block) => (
    block?.kind === "reportBuilderBlock"
      ? { ...block, config: { title: block?.config?.title } }
      : block
  )),
}, { title: "Performance Report" }, state);
assert.deepEqual(contractRestoredConfig.dimensions, [
  {
    id: "eventDate",
    key: "eventDate",
    label: "Date",
    format: "date",
    paramPath: "dimensions.eventDate",
    default: true,
    chartAxis: true,
  },
  {
    id: "channelId",
    key: "channelId",
    label: "Channel",
    displayKey: "channelName",
    displayValueMap: { "1": "Display", "2": "CTV" },
    paramPath: "dimensions.channelId",
    runtimeFilter: { paramPath: "filters.channelId", format: "int" },
    rawId: "channel_id",
    semanticRef: "semantic://dimension/channel",
  },
]);
assert.deepEqual(contractRestoredConfig.measures, [
  {
    id: "totalSpend",
    key: "totalSpend",
    label: "Spend",
    format: "currency",
    paramPath: "measures.totalSpend",
    default: true,
    rawId: "total_spend",
    semanticRef: "semantic://measure/total_spend",
    description: "Total spend across delivery.",
    category: "delivery",
    definitionRef: "def://measures/total_spend",
    governance: { status: "approved", certification: "gold", ownerRef: "team://reporting" },
  },
  {
    id: "impressions",
    key: "impressions",
    label: "Impressions",
    format: "compactNumber",
    paramPath: "measures.impressions",
  },
]);
assert.deepEqual(contractRestoredConfig.scope, {
  inheritContext: true,
});
assert.deepEqual(contractRestoredConfig.source, {
  kind: "mcp",
  server: "steward",
  tool: "performance.summary",
});
assert.deepEqual(contractRestoredConfig.resultContract, {
  shape: "rowSet",
  rowPath: "payload.records",
});
assert.deepEqual(contractRestoredConfig.capabilities, {
  fieldCatalog: true,
  backendRefetch: true,
  datly: {
    unifiedCube: true,
  },
});

console.log("reportDocumentModel ✓ wraps current report builder state as ReportDocument and lowers to ReportSpec");

// resolveReportDocumentBuilderContext yields the same normalized config as the
// layered per-consumer reconstruction it replaces, and folds resolved binding
// and static datasets into the normalized state.
const builderContextBinding = { semanticModelRef: "sales.model" };
const builderContextDocument = {
  kind: "reportDocument",
  id: "builderContextDoc",
  version: 1,
  binding: builderContextBinding,
  datasets: [
    {
      id: "static_notes",
      label: "Notes",
      rows: [{ note: "n1" }, { note: "n2" }],
    },
  ],
  blocks: [
    {
      kind: "reportBuilderBlock",
      id: "primaryBuilder",
      config: JSON.parse(JSON.stringify(config)),
      state: { selectedMeasures: ["totalSpend"] },
    },
  ],
};
const builderContextBaseState = { selectedMeasures: ["totalSpend"] };
const builderContext = resolveReportDocumentBuilderContext(
  builderContextDocument,
  resolveBuilderBlock(builderContextDocument).config,
  builderContextBaseState,
);
assert.deepEqual(
  builderContext.config,
  normalizeReportDocumentBuilderConfig(
    builderContextDocument,
    resolveBuilderBlock(builderContextDocument).config,
    builderContext.state,
  ),
);
assert.deepEqual(builderContext.binding, builderContextBinding);
assert.deepEqual(builderContext.state.binding, builderContextBinding);
assert.deepEqual(builderContext.state.selectedMeasures, ["totalSpend"]);
assert.equal(builderContext.staticDatasets.length, 1);
assert.equal(builderContext.staticDatasets[0].id, "static_notes");
assert.deepEqual(builderContext.state.reportStaticDatasets, builderContext.staticDatasets);
// the caller-provided state is cloned, never mutated
assert.deepEqual(builderContextBaseState, { selectedMeasures: ["totalSpend"] });

// no config content resolves to a null config and an empty normalized state
const emptyBuilderContext = resolveReportDocumentBuilderContext(null, null, null);
assert.equal(emptyBuilderContext.config, null);
assert.deepEqual(emptyBuilderContext.state, {});
assert.equal("binding" in emptyBuilderContext, false);
assert.equal("staticDatasets" in emptyBuilderContext, false);

console.log("reportDocumentModel ✓ resolveReportDocumentBuilderContext normalizes builder config, state, binding, and static datasets");

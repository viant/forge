import assert from "node:assert/strict";

import {
  buildReportBuilderRuntimePreviewArtifacts,
  buildReportBuilderRuntimePreviewModel,
} from "./reportBuilderRuntimePreview.js";

const container = {
  id: "publishedDatasetBuilder",
  stateKey: "publishedDatasetBuilder",
  title: "Published Dataset Builder",
  dataSourceRef: "demoReportSource",
};

const config = {
  title: "Published Dataset Builder",
  measures: [
    { id: "totalSpend", key: "totalSpend", label: "Spend", default: true, format: "currency" },
  ],
  dimensions: [
    { id: "channelId", key: "channelId", label: "Channel", default: true },
  ],
  result: {
    defaultMode: "table",
  },
  dataSources: [
    {
      id: "forecast_cube",
      dataSourceRef: "forecastCubeSource",
      label: "Forecast Cube",
      kindLabel: "published",
      request: {
        measures: { forecastRevenue: true },
        dimensions: { region: true },
        filters: {},
        limit: 25,
        offset: 0,
      },
      columnOptions: [
        { key: "region", label: "Region", kind: "dimension" },
        { key: "forecastRevenue", label: "Forecast Revenue", kind: "measure", format: "currency" },
      ],
      valueFieldOptions: [
        { value: "forecastRevenue", label: "Forecast Revenue" },
      ],
      secondaryFieldOptions: [
        { value: "region", label: "Region" },
      ],
      chartFieldOptions: [
        { key: "region", label: "Region", kind: "dimension" },
        { key: "forecastRevenue", label: "Forecast Revenue", kind: "measure", format: "currency" },
      ],
      scopeParamOptions: [
        {
          value: "forecastRegion",
          label: "Forecast Region",
          kind: "multiSelect",
          paramPath: "filters.region",
        },
      ],
    },
    {
      id: "forecast_chart_only",
      dataSourceRef: "forecastCubeSource",
      label: "Forecast Chart Only",
      kindLabel: "published",
      request: {
        measures: { forecastRevenue: true },
        dimensions: { region: true },
        filters: {},
        limit: 25,
        offset: 0,
      },
      columnOptions: [],
      chartFieldOptions: [
        { key: "region", label: "Region", kind: "dimension" },
        { key: "forecastRevenue", label: "Forecast Revenue", kind: "measure", format: "currency" },
      ],
      valueFieldOptions: [
        { value: "forecastRevenue", label: "Forecast Revenue" },
      ],
      secondaryFieldOptions: [
        { value: "region", label: "Region" },
      ],
    },
  ],
};

const state = {
  selectedMeasures: ["totalSpend"],
  primaryMeasure: "totalSpend",
  selectedDimensions: ["channelId"],
  viewMode: "table",
  scopeParams: {
    forecastRegion: ["US/NY"],
  },
  reportDocumentBlocks: [
    {
      id: "forecastTable",
      kind: "tableBlock",
      title: "Forecast Regions",
      datasetRef: "forecast_cube",
      columns: [
        { key: "region", label: "Region" },
        { key: "forecastRevenue", label: "Forecast Revenue", format: "currency" },
      ],
    },
    {
      id: "forecastChart",
      kind: "chartBlock",
      title: "Forecast Revenue",
      datasetRef: "forecast_cube",
      chartSpec: {
        title: "Forecast Revenue",
        type: "bar",
        xField: "region",
        yFields: ["forecastRevenue"],
      },
    },
    {
      id: "forecastKpi",
      kind: "kpiBlock",
      title: "Forecast KPI",
      datasetRef: "forecast_cube",
      valueField: "forecastRevenue",
      valueLabel: "Forecast Revenue",
      secondaryField: "region",
      secondaryLabel: "Region",
    },
    {
      id: "forecastChartOnly",
      kind: "chartBlock",
      title: "Forecast Chart Only",
      datasetRef: "forecast_chart_only",
      chartSpec: {
        title: "Forecast Chart Only",
        type: "bar",
        xField: "region",
        yFields: ["forecastRevenue"],
      },
    },
    {
      id: "forecastFilters",
      kind: "filterBarBlock",
      title: "Forecast Filters",
      datasetRef: "forecast_cube",
      paramIds: ["forecastRegion"],
    },
  ],
  reportDocumentLayout: {
    type: "stack",
    items: [
      { blockId: "primaryBuilder" },
      { blockId: "forecastFilters" },
      { blockId: "forecastTable" },
      { blockId: "forecastChart" },
      { blockId: "forecastKpi" },
      { blockId: "forecastChartOnly" },
    ],
  },
};

const model = buildReportBuilderRuntimePreviewModel({
  container,
  config,
  state,
  includePrimaryBlocks: false,
});

assert.ok(model);
assert.equal(model.reportSpec.datasets.some((dataset) => dataset.id === "forecast_cube"), true);
assert.equal(model.reportSpec.datasets.some((dataset) => dataset.id === "forecast_chart_only"), true);
assert.deepEqual(
  model.reportSpec.datasets.find((dataset) => dataset.id === "forecast_cube")?.request,
  {
    measures: { forecastRevenue: true },
    dimensions: { region: true },
    filters: { region: ["US/NY"] },
    limit: 25,
    offset: 0,
  },
);

const artifacts = buildReportBuilderRuntimePreviewArtifacts({
  model,
  rows: [],
  hasMore: false,
  datasetPayloads: {
    forecast_cube: {
      rows: [
        { region: "US/NY", forecastRevenue: 1200 },
        { region: "US/NJ", forecastRevenue: 950 },
      ],
      hasMore: false,
      diagnostics: [],
    },
    forecast_chart_only: {
      rows: [
        { region: "US/NY", forecastRevenue: 1200 },
        { region: "US/NJ", forecastRevenue: 950 },
      ],
      hasMore: false,
      diagnostics: [],
    },
  },
});

assert.ok(artifacts);
const forecastDataset = artifacts.reportFill.datasets.find((dataset) => dataset.id === "forecast_cube");
assert.ok(forecastDataset);
assert.equal(forecastDataset.rows.length, 2);

const filterBlock = artifacts.reportFill.blocks.find((block) => block.id === "forecastFilters");
assert.ok(filterBlock);
assert.equal(filterBlock.content.params[0].datasetRef, "forecast_cube");
assert.deepEqual(filterBlock.content.params[0].value, ["US/NY"]);

const tableBlock = artifacts.reportFill.blocks.find((block) => block.id === "forecastTable");
assert.ok(tableBlock);
assert.equal(tableBlock.content.rowCount, 2);
assert.equal(tableBlock.content.resolvedRows[0].cells[0].value, "US/NY");
assert.equal(tableBlock.content.resolvedRows[0].cells[1].value, 1200);

const chartBlock = artifacts.reportFill.blocks.find((block) => block.id === "forecastChart");
assert.ok(chartBlock);
assert.equal(chartBlock.content.rowCount, 2);
assert.equal(chartBlock.content.chartSpec.xField, "region");
assert.equal(chartBlock.content.chartSpec.yFields[0], "forecastRevenue");
assert.equal(chartBlock.content.chartModel?.type, "bar");
assert.ok(chartBlock.content.resolvedChart);

const chartOnlyBlock = artifacts.reportFill.blocks.find((block) => block.id === "forecastChartOnly");
assert.ok(chartOnlyBlock);
assert.equal(chartOnlyBlock.content.rowCount, 2);
assert.equal(chartOnlyBlock.content.chartSpec.xField, "region");
assert.equal(chartOnlyBlock.content.chartSpec.yFields[0], "forecastRevenue");
assert.equal(chartOnlyBlock.content.chartModel?.type, "bar");
assert.ok(chartOnlyBlock.content.resolvedChart);

const kpiBlock = artifacts.reportFill.blocks.find((block) => block.id === "forecastKpi");
assert.ok(kpiBlock);
assert.equal(kpiBlock.content.value, 1200);
assert.equal(kpiBlock.content.secondaryValue, "US/NY");

const scopedRuntimeModel = buildReportBuilderRuntimePreviewModel({
  container,
  config,
  state: {
    ...state,
    scopeParams: {},
  },
  runtimeDatasetScopeParams: {
    forecast_cube: {
      forecastRegion: ["US/CA"],
    },
  },
  includePrimaryBlocks: false,
});

assert.deepEqual(
  scopedRuntimeModel.reportSpec.datasets.find((dataset) => dataset.id === "forecast_cube")?.request,
  {
    measures: { forecastRevenue: true },
    dimensions: { region: true },
    filters: { region: ["US/CA"] },
    limit: 25,
    offset: 0,
  },
);
assert.deepEqual(
  scopedRuntimeModel.reportSpec.scope.params.find((param) => param.id === "forecastRegion")?.kind,
  "multiSelect",
);
assert.equal(
  scopedRuntimeModel.reportSpec.scope.params.find((param) => param.id === "forecastRegion")?.label,
  "Forecast Region",
);
assert.equal(
  scopedRuntimeModel.reportSpec.scope.params.find((param) => param.id === "forecastRegion")?.datasetRef,
  "forecast_cube",
);
assert.deepEqual(
  scopedRuntimeModel.reportSpec.scope.params.find((param) => param.id === "forecastRegion")?.value,
  ["US/CA"],
);

console.log("reportBuilderPublishedDatasetRuntime ✓ carries configured published datasets through report spec and runtime fill");

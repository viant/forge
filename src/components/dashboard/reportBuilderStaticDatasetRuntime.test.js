import assert from "node:assert/strict";

import {
  buildReportBuilderRuntimePreviewArtifacts,
  buildReportBuilderRuntimePreviewModel,
} from "./reportBuilderRuntimePreview.js";

const container = {
  id: "staticDatasetBuilder",
  stateKey: "staticDatasetBuilder",
  title: "Static Dataset Builder",
  dataSourceRef: "demoReportSource",
};

const config = {
  title: "Static Dataset Builder",
  measures: [
    { id: "totalSpend", key: "totalSpend", label: "Spend", default: true, format: "currency" },
  ],
  dimensions: [
    { id: "channelId", key: "channelId", label: "Channel", default: true },
  ],
  result: {
    defaultMode: "table",
  },
};

const state = {
  selectedMeasures: ["totalSpend"],
  primaryMeasure: "totalSpend",
  selectedDimensions: ["channelId"],
  viewMode: "table",
  reportStaticDatasets: [
    {
      id: "regional_mix_csv",
      label: "regional_mix",
      dataSourceRef: "static_csv_regional_mix_csv",
      rows: [
        { region: "North", revenue: 1200, orders: 12, status: "healthy" },
        { region: "South", revenue: 980, orders: 9, status: "watch" },
      ],
      columns: [
        { key: "region", label: "Region", kind: "dimension" },
        { key: "revenue", label: "Revenue", kind: "measure" },
        { key: "orders", label: "Orders", kind: "measure" },
        { key: "status", label: "Status", kind: "dimension" },
      ],
    },
  ],
  reportDocumentBlocks: [
    {
      id: "regionalMixTable",
      kind: "tableBlock",
      title: "Regional Mix",
      datasetRef: "regional_mix_csv",
      columns: [
        { key: "region", label: "Region" },
        { key: "revenue", label: "Revenue" },
      ],
    },
    {
      id: "regionalMixChart",
      kind: "chartBlock",
      title: "Regional Mix Chart",
      datasetRef: "regional_mix_csv",
      chartSpec: {
        title: "Regional Revenue",
        type: "bar",
        xField: "region",
        yFields: ["revenue"],
      },
    },
    {
      id: "regionalMixKpi",
      kind: "kpiBlock",
      title: "Headline KPI",
      datasetRef: "regional_mix_csv",
      valueField: "revenue",
      valueLabel: "Revenue",
      secondaryField: "region",
      secondaryLabel: "Region",
    },
    {
      id: "regionalMixPills",
      kind: "badgesBlock",
      title: "Status Pills",
      datasetRef: "regional_mix_csv",
      items: [
        {
          id: "statusPill",
          label: "Status",
          valueField: "status",
          tone: "info",
          rules: [
            { value: "healthy", label: "Healthy", tone: "success" },
            { value: "watch", label: "Watch", tone: "warning" },
            { value: "risk", label: "Risk", tone: "danger" },
          ],
        },
      ],
    },
  ],
  reportDocumentLayout: {
    type: "stack",
    items: [
      { blockId: "primaryBuilder" },
      { blockId: "regionalMixTable" },
      { blockId: "regionalMixChart" },
      { blockId: "regionalMixKpi" },
      { blockId: "regionalMixPills" },
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
assert.equal(model.reportSpec.datasets.some((dataset) => dataset.id === "regional_mix_csv"), true);
assert.equal(model.staticDatasetPayloads.regional_mix_csv.rows.length, 2);

const artifacts = buildReportBuilderRuntimePreviewArtifacts({
  model,
  rows: [],
  hasMore: false,
});

assert.ok(artifacts);
const staticDataset = artifacts.reportFill.datasets.find((dataset) => dataset.id === "regional_mix_csv");
assert.ok(staticDataset);
assert.equal(staticDataset.rows.length, 2);

const chartSpecBlock = model.reportSpec.blocks.find((block) => block.id === "regionalMixChart");
assert.ok(chartSpecBlock);
assert.equal(chartSpecBlock.chartModel?.type, "bar");

const tableBlock = artifacts.reportFill.blocks.find((block) => block.id === "regionalMixTable");
assert.ok(tableBlock);
assert.equal(tableBlock.content.rowCount, 2);
assert.equal(tableBlock.content.resolvedRows[0].cells[0].value, "North");
assert.equal(tableBlock.content.resolvedRows[0].cells[1].value, 1200);

const chartBlock = artifacts.reportFill.blocks.find((block) => block.id === "regionalMixChart");
assert.ok(chartBlock);
assert.equal(chartBlock.content.rowCount, 2);
assert.equal(chartBlock.content.chartSpec.xField, "region");
assert.equal(chartBlock.content.chartSpec.yFields[0], "revenue");
assert.equal(chartBlock.content.chartModel?.type, "bar");
assert.ok(chartBlock.content.resolvedChart);

const kpiBlock = artifacts.reportFill.blocks.find((block) => block.id === "regionalMixKpi");
assert.ok(kpiBlock);
assert.equal(kpiBlock.content.valueField, "revenue");
assert.equal(kpiBlock.content.value, 1200);
assert.equal(kpiBlock.content.secondaryField, "region");
assert.equal(kpiBlock.content.secondaryValue, "North");

const badgesBlock = artifacts.reportFill.blocks.find((block) => block.id === "regionalMixPills");
assert.ok(badgesBlock);
assert.equal(badgesBlock.content.rowCount, 2);
assert.equal(badgesBlock.content.items.length, 1);
assert.equal(badgesBlock.content.items[0].label, "Status");
assert.equal(badgesBlock.content.items[0].valueField, "status");
assert.equal(badgesBlock.content.items[0].value, "healthy");
assert.equal(badgesBlock.content.items[0].displayValue, "Healthy");
assert.equal(badgesBlock.content.items[0].tone, "success");

console.log("reportBuilderStaticDatasetRuntime ✓ carries CSV-backed static datasets through report spec and runtime fill");

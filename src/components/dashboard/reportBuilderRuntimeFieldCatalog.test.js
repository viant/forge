import assert from "node:assert/strict";

import { applyReportBuilderRuntimeFieldCatalog } from "./reportBuilderRuntimeFieldCatalog.js";
import {
  buildReportBuilderRuntimePreview,
  buildReportBuilderRuntimePreviewModel,
} from "./reportBuilderRuntimePreview.js";

const config = applyReportBuilderRuntimeFieldCatalog({
  runtimeFieldCatalog: { enabled: true },
  result: { defaultMode: "table", viewModes: ["table", "chart"] },
}, {
  reportDefinition: {
    fieldCatalog: {
      columns: [
        { name: "advertiserDate", type: "date", role: "dimension" },
        { name: "campaignName", type: "string", role: "dimension" },
        { name: "totalSpend", type: "number", role: "measure" },
      ],
      defaultDimensions: ["advertiserDate"],
      defaultMeasures: ["totalSpend"],
      allowedFilters: ["from", "to", "campaignIds"],
      allowedSorts: ["advertiserDate", "totalSpend"],
      defaultDatePreset: "last7Days",
      tablePresentation: { collapsible: true, labelClamp: { lines: 2, maxCharacters: 36 } },
    },
  },
});

assert.deepEqual(config.dimensions.map(({ id, default: selected }) => [id, !!selected]), [
  ["advertiserDate", true],
  ["campaignName", false],
]);
assert.equal(config.measures[0].format, "currency");
assert.deepEqual(config.result.orderFields.map((entry) => entry.value), ["advertiserDate", "totalSpend"]);
assert.deepEqual(config.predicates.map((entry) => entry.id), ["dateRange", "campaignIds"]);
assert.deepEqual(config.predicates[0].default, { preset: "last7Days" });
assert.deepEqual(config.result.viewModes, ["table", "chart"]);
assert.deepEqual(config.tablePresentation, { collapsible: true, labelClamp: { lines: 2, maxCharacters: 36 } });

console.log("reportBuilderRuntimeFieldCatalog ✓ derives authorized report controls from a runtime definition");

const flatConfig = applyReportBuilderRuntimeFieldCatalog({
  runtimeFieldCatalog: { enabled: true },
}, {
  Columns: [
    { name: "channel", type: "string", role: "dimension" },
    { name: "impressions", type: "integer", role: "measure" },
  ],
  DefaultDimensions: ["channel"],
  DefaultMeasures: ["impressions"],
  AllowedSorts: ["impressions"],
});
assert.equal(flatConfig.dimensions[0].default, true);
assert.equal(flatConfig.measures[0].default, true);
assert.equal(flatConfig.primaryMeasure, "impressions");

const parameterizedConfig = applyReportBuilderRuntimeFieldCatalog({
  runtimeFieldCatalog: { enabled: true },
}, {
  FieldCatalog: {
    columns: [
      { name: "conversionDate", type: "date", role: "dimension" },
      { name: "campaignId", type: "integer", role: "dimension" },
      { name: "channel", type: "string", role: "dimension" },
      { name: "eventType", type: "string", role: "dimension" },
      { name: "conversions", type: "number", role: "measure" },
      { name: "lastTouchConversions", type: "number", role: "measure" },
    ],
    defaultDimensions: "campaignId channel conversionDate eventType",
    defaultMeasures: "conversions,lastTouchConversions",
    allowedFilters: "from to campaignIds",
    allowedSorts: "conversionDate conversions",
  },
});
assert.deepEqual(
  parameterizedConfig.dimensions.map(({ id, default: selected }) => [id, !!selected]),
  [["conversionDate", true], ["campaignId", true], ["channel", true], ["eventType", true]],
);
assert.deepEqual(
  parameterizedConfig.measures.map(({ id, default: selected }) => [id, !!selected]),
  [["conversions", true], ["lastTouchConversions", true]],
);
assert.deepEqual(parameterizedConfig.predicates.map((entry) => entry.id), ["dateRange", "campaignIds"]);

const runtimeState = {
  selectedDimensions: ["advertiserDate"],
  selectedMeasures: ["totalSpend"],
  primaryMeasure: "totalSpend",
  scopeParams: { dateRange: { start: "2026-08-30", end: "2026-09-05" } },
  pageSize: 50,
  page: 1,
  orderField: "totalSpend",
  orderDir: "desc",
  viewMode: "table",
  reportDocumentTitle: "Advanced Reporting",
  reportDocumentBlocks: [{
    id: "advancedReportingTable",
    kind: "tableBlock",
    title: "Advanced Reporting",
    datasetRef: "primary",
    columns: [
      { key: "advertiserDate", label: "Advertiser Date" },
      { key: "totalSpend", label: "Total Spend", format: "currency" },
    ],
  }],
  reportDocumentLayout: { type: "stack", items: [{ blockId: "advancedReportingTable" }] },
};
const runtimeModel = buildReportBuilderRuntimePreviewModel({
  container: {
    id: "advancedReportingBuilder",
    stateKey: "advancedReportingBuilder",
    title: "Advanced Reporting",
    dataSourceRef: "advanced_reporting_run",
  },
  config: {
    ...config,
    dataSourceRef: "advanced_reporting_run",
  },
  state: runtimeState,
  includePrimaryBlocks: false,
});
const runtimePreview = buildReportBuilderRuntimePreview({
  model: runtimeModel,
  rows: [{ advertiserDate: "2026-09-05", totalSpend: 42.5 }],
  hasMore: false,
});
assert.ok(runtimePreview?.reportSpec);
assert.ok(runtimePreview?.reportFill);
assert.ok(runtimePreview?.reportPrint);
assert.ok(runtimePreview?.exportRequest, "a populated runtime-catalog report must produce an export request");
assert.deepEqual(
  runtimePreview.reportSpec.blocks.find((block) => block.id === "advancedReportingTable"),
  {
    ...runtimePreview.reportSpec.blocks.find((block) => block.id === "advancedReportingTable"),
    collapsible: true,
    labelClamp: { lines: 2, maxCharacters: 36 },
  },
);

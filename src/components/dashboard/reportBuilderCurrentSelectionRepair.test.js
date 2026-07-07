import assert from "node:assert/strict";

import {
  buildRepairableReportBuilderDocumentBlockDraft,
  repairReportBuilderDocumentBlockWithCurrentSelection,
} from "./reportBuilderCurrentSelectionRepair.js";
import { buildReportBuilderReportDocument, lowerReportDocumentToReportSpec } from "../../reporting/reportDocumentModel.js";
import { buildReportFillFromReportSpec } from "../../reporting/reportFillModel.js";

const config = {
  title: "Performance Report",
  measures: [
    {
      id: "totalSpend",
      key: "totalSpend",
      label: "Spend",
      paramPath: "measures.totalSpend",
      default: true,
      format: "currency",
      displayKey: "totalSpend",
    },
  ],
  dimensions: [
    {
      id: "eventDate",
      key: "eventDate",
      label: "Date",
      paramPath: "dimensions.eventDate",
      default: true,
      chartAxis: true,
      format: "date",
      displayKey: "eventDate",
    },
    {
      id: "channelId",
      key: "channelId",
      label: "Channel",
      paramPath: "dimensions.channelId",
      default: true,
      runtimeFilter: {
        includeParamPath: "filters.includeChannelId",
        excludeParamPath: "filters.excludeChannelId",
      },
      displayKey: "channel.channel",
      displayValueMap: {
        display: "Display",
        ctv: "CTV",
      },
    },
  ],
  result: {
    chartCreationMode: "explicit",
    defaultMode: "chart",
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

const container = {
  id: "currentSelectionRepair",
  stateKey: "currentSelectionRepair",
  title: "Current Selection Repair",
  dataSourceRef: "demoReportSource",
};

const tableColumnOptions = [
  {
    key: "eventDate",
    sourceKey: "eventDate",
    displayKey: "eventDate",
    label: "Date",
    kind: "dimension",
    format: "date",
    selected: true,
  },
  {
    key: "channelId",
    sourceKey: "channelId",
    displayKey: "channel.channel",
    displayValueMap: { display: "Display", ctv: "CTV" },
    label: "Channel",
    kind: "dimension",
    selected: true,
  },
  {
    key: "totalSpend",
    sourceKey: "totalSpend",
    displayKey: "totalSpend",
    label: "Spend",
    kind: "measure",
    format: "currency",
    selected: true,
  },
];

const baseState = {
  selectedMeasures: ["totalSpend"],
  primaryMeasure: "totalSpend",
  selectedDimensions: ["eventDate", "channelId"],
  viewMode: "chart",
  chartSpec: {
    title: "Overview · Spend by Date",
    type: "line",
    xField: "eventDate",
    yFields: ["totalSpend"],
  },
  reportDocumentTitle: "Performance Overview",
  reportDocumentBlocks: [
    {
      id: "detailTable",
      kind: "tableBlock",
      title: "Detail Table",
      columns: [],
    },
  ],
  reportDocumentLayout: {
    type: "stack",
    items: [
      { blockId: "primaryBuilder" },
      { blockId: "detailTable" },
    ],
  },
};

const repairableDraft = buildRepairableReportBuilderDocumentBlockDraft(baseState.reportDocumentBlocks[0], {
  existingBlocks: baseState.reportDocumentBlocks,
  tableColumnOptions,
});

assert.deepEqual(repairableDraft, {
  kind: "tableBlock",
  id: "detailTable",
  title: "Detail Table",
  datasetRef: "primary",
  columnKeys: ["eventDate", "channelId", "totalSpend"],
  columns: [
    {
      key: "eventDate",
      sourceKey: "eventDate",
      displayKey: "eventDate",
      label: "Date",
      format: "date",
    },
    {
      key: "channelId",
      sourceKey: "channelId",
      displayKey: "channel.channel",
      displayValueMap: { display: "Display", ctv: "CTV" },
      label: "Channel",
    },
    {
      key: "totalSpend",
      sourceKey: "totalSpend",
      displayKey: "totalSpend",
      label: "Spend",
      format: "currency",
    },
  ],
  columnVisualKinds: {},
  columnVisualRuleTexts: {},
});

const repairResult = repairReportBuilderDocumentBlockWithCurrentSelection({
  state: baseState,
  block: baseState.reportDocumentBlocks[0],
  existingBlocks: baseState.reportDocumentBlocks,
  tableColumnOptions,
  resolveStateReadiness: () => ({ canRun: true }),
});

assert.equal(repairResult.applied, true);
assert.equal(repairResult.didRefreshResults, true);
assert.equal(repairResult.feedbackMessage, "Detail Table now uses the current fields. Refreshing results.");
assert.deepEqual(repairResult.block.columns, repairableDraft.columns);
assert.deepEqual(repairResult.nextState.reportDocumentBlocks[0].columns, repairableDraft.columns);

const repairedDocument = buildReportBuilderReportDocument({
  container,
  config,
  state: repairResult.nextState,
});
const repairedSpec = lowerReportDocumentToReportSpec(repairedDocument);
const repairedFill = buildReportFillFromReportSpec(repairedSpec, {
  primary: {
    rows: [
      {
        eventDate: "2026-05-01",
        channelId: "display",
        channel: { channel: "Display" },
        totalSpend: 120000,
      },
    ],
  },
});

assert.deepEqual(
  repairedFill.blocks.find((block) => block.id === "detailTable")?.content?.resolvedRows?.[0]?.cells,
  [
    {
      key: "eventDate",
      sourceKey: "eventDate",
      displayKey: "eventDate",
      value: "2026-05-01",
      displayValue: "2026-05-01",
      visualState: null,
    },
    {
      key: "channelId",
      sourceKey: "channelId",
      displayKey: "channel.channel",
      value: "display",
      displayValue: "Display",
      visualState: null,
    },
    {
      key: "totalSpend",
      sourceKey: "totalSpend",
      displayKey: "totalSpend",
      value: 120000,
      displayValue: 120000,
      visualState: null,
    },
  ],
);

const notRepairable = repairReportBuilderDocumentBlockWithCurrentSelection({
  state: {
    ...baseState,
    reportDocumentBlocks: [
      {
        id: "detailTable",
        kind: "tableBlock",
        title: "Detail Table",
        columns: [{ key: "eventDate", label: "Date" }],
      },
    ],
  },
  block: {
    id: "detailTable",
    kind: "tableBlock",
    title: "Detail Table",
    columns: [{ key: "eventDate", label: "Date" }],
  },
  existingBlocks: [
    {
      id: "detailTable",
      kind: "tableBlock",
      title: "Detail Table",
      columns: [{ key: "eventDate", label: "Date" }],
    },
  ],
  tableColumnOptions,
});

assert.equal(notRepairable.applied, false);

console.log("reportBuilderCurrentSelectionRepair ✓ repairs empty authored tables from the active builder fields and preserves runtime display metadata");

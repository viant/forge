import assert from "node:assert/strict";

import {
  formatReportRuntimeRefinement,
  formatReportRuntimeScopeValue,
  buildReportRuntimeUnsupportedRefinementDiagnostics,
  resolveReportRuntimeChartActionFields,
  resolveReportRuntimeBindingSummary,
  resolveReportRuntimeBlocks,
  resolveReportRuntimeDatasetRequest,
  resolveReportRuntimeRefinementFields,
  resolveReportRuntimePrimaryBlocks,
} from "./reportRuntimeModel.js";

const reportSpec = {
  layoutIntent: {
    blockOrder: ["sharedFilters", "activeRefinements", "primaryTable", "primaryChart", "narrativeIntro"],
    items: [
      { blockId: "sharedFilters" },
      { blockId: "activeRefinements" },
      { blockId: "primaryTable" },
      { blockId: "primaryChart" },
      { blockId: "narrativeIntro", size: "half" },
    ],
  },
  parameters: {
    viewMode: "chart",
  },
  binding: {
    mode: "semantic",
    modelRef: "model://steward/performance/ad_delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date", "channel"],
    selectedMeasures: ["available_impressions", "household_uniques"],
  },
  semanticSummary: {
    kind: "semantic",
    modelRef: "model://steward/performance/ad_delivery@v1",
    modelLabel: "Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    selectedDimensions: [
      { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
      {
        id: "channel",
        rawId: "channelV2",
        label: "Channel",
        governance: {
          status: "draft",
        },
      },
    ],
    selectedMeasures: [
      {
        id: "available_impressions",
        rawId: "avails",
        label: "Available Impressions",
        governance: {
          status: "approved",
          certification: "certified",
        },
      },
      {
        id: "household_uniques",
        rawId: "hhUniqs",
        label: "Household Uniques",
        governance: {
          status: "deprecated",
          certification: "reviewed",
        },
      },
    ],
  },
  datasets: [
    {
      id: "primary",
      request: {
        dimensions: {
          eventDate: true,
          channelV2: true,
        },
      },
    },
  ],
};

const reportFill = {
  blocks: [
    { id: "primaryTable", kind: "tableBlock" },
    { id: "narrativeIntro", kind: "markdownBlock" },
    { id: "activeRefinements", kind: "refinementBarBlock" },
    { id: "sharedFilters", kind: "filterBarBlock" },
    { id: "primaryChart", kind: "chartBlock" },
  ],
};

assert.deepEqual(
  resolveReportRuntimeBlocks(reportSpec, reportFill).map((block) => block.id),
  ["sharedFilters", "activeRefinements", "primaryTable", "primaryChart", "narrativeIntro"],
);
assert.deepEqual(
  resolveReportRuntimeBlocks(reportSpec, reportFill).find((block) => block.id === "narrativeIntro")?.layoutItem,
  { blockId: "narrativeIntro", size: "half" },
);

assert.deepEqual(
  resolveReportRuntimePrimaryBlocks(reportSpec, reportFill).primary.map((block) => block.id),
  ["primaryChart", "primaryTable"],
);
assert.deepEqual(
  resolveReportRuntimePrimaryBlocks(reportSpec, reportFill).beforePrimary.map((block) => block.id),
  ["sharedFilters", "activeRefinements"],
);
assert.deepEqual(
  resolveReportRuntimePrimaryBlocks(reportSpec, {
    blocks: [
      ...reportFill.blocks,
      { id: "narrativeAfter", kind: "markdownBlock" },
    ],
  }).afterPrimary.map((block) => block.id),
  ["narrativeIntro", "narrativeAfter"],
);

assert.deepEqual(resolveReportRuntimeBindingSummary(reportSpec), {
  kind: "semantic",
  title: "Semantic Binding",
  modelRef: "model://steward/performance/ad_delivery@v1",
  modelLabel: "Ad Delivery",
  entity: "line_delivery",
  entityLabel: "Line Delivery",
  dimensionCount: 2,
  measureCount: 2,
  selectedDimensions: [
    { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
    { id: "channel", rawId: "channelV2", label: "Channel", governance: { status: "draft" } },
  ],
  selectedMeasures: [
    {
      id: "available_impressions",
      rawId: "avails",
      label: "Available Impressions",
      governance: {
        status: "approved",
        certification: "certified",
      },
    },
    {
      id: "household_uniques",
      rawId: "hhUniqs",
      label: "Household Uniques",
      governance: {
        status: "deprecated",
        certification: "reviewed",
      },
    },
  ],
  governanceCounts: {
    draft: 1,
    deprecated: 1,
  },
});

assert.deepEqual(resolveReportRuntimeDatasetRequest(reportSpec, "primary"), {
  dimensions: {
    eventDate: true,
    channelV2: true,
  },
});
assert.deepEqual(resolveReportRuntimeRefinementFields(reportSpec, {
  datasetRef: "primary",
  content: {
    columns: [
      { key: "eventDate", label: "Date" },
      { key: "channelV2", sourceKey: "channelV2", displayKey: "channel.channel", label: "Channel" },
      { key: "avails", label: "Avails" },
    ],
  },
}), [
  { key: "eventDate", valueKey: "eventDate", displayValueKey: "eventDate", label: "Date", runtimeFilterable: false },
  { key: "channelV2", valueKey: "channelV2", displayValueKey: "channel.channel", label: "Channel", runtimeFilterable: false },
]);
assert.deepEqual(resolveReportRuntimeRefinementFields(reportSpec, {
  datasetRef: "primary",
  content: {
    columns: [
      {
        key: "channelV2",
        sourceKey: "channelV2",
        displayKey: "channel.channel",
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
    ],
  },
}), [
  { key: "channelV2", valueKey: "channelV2", displayValueKey: "channel.channel", label: "Channel", runtimeFilterable: true },
]);
assert.deepEqual(resolveReportRuntimeChartActionFields({
  ...reportSpec,
  blocks: [
    {
      id: "primaryTable",
      kind: "tableBlock",
      datasetRef: "primary",
      columns: [
        { key: "eventDate", label: "Date" },
        { key: "channelV2", sourceKey: "channelV2", displayKey: "channel.channel", label: "Channel" },
      ],
    },
  ],
}, {
  datasetRef: "primary",
  content: {
    chartSpec: {
      xField: "eventDate",
      seriesField: "channelV2",
    },
  },
}), [
  { kind: "xField", valueKey: "eventDate", displayValueKey: "eventDate", label: "Date", selectionSource: "xValue", runtimeFilterable: false },
  { kind: "seriesField", valueKey: "channelV2", displayValueKey: "channel.channel", label: "Channel", selectionSource: "seriesKey", runtimeFilterable: false },
]);

const authoredDerivedReportSpec = {
  datasets: [
    {
      id: "primary",
      request: {
        dimensions: {
          country: true,
          channelV2: true,
          region: true,
        },
      },
    },
  ],
  blocks: [
    {
      id: "reachRateTable",
      kind: "tableBlock",
      datasetRef: "primary",
      columns: [
        {
          key: "country",
          sourceKey: "country",
          displayKey: "country",
          label: "Market",
          runtimeFilterable: true,
        },
        {
          key: "channelV2",
          sourceKey: "channelV2",
          displayKey: "channel.channel",
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
      ],
    },
    {
      id: "reachRateTrend",
      kind: "chartBlock",
      datasetRef: "primary",
      chartSpec: {
        xField: "country",
        yFields: ["reachRate"],
        seriesField: "channelV2",
      },
    },
  ],
};

assert.deepEqual(resolveReportRuntimeRefinementFields(authoredDerivedReportSpec, {
  id: "reachRateTable",
  kind: "tableBlock",
  datasetRef: "primary",
  columns: authoredDerivedReportSpec.blocks[0].columns,
}), [
  { key: "country", valueKey: "country", displayValueKey: "country", label: "Market", runtimeFilterable: true },
  { key: "channelV2", valueKey: "channelV2", displayValueKey: "channel.channel", label: "Channel", runtimeFilterable: true },
]);

assert.deepEqual(resolveReportRuntimeChartActionFields(authoredDerivedReportSpec, {
  id: "reachRateTrend",
  kind: "chartBlock",
  datasetRef: "primary",
  chartSpec: {
    xField: "country",
    yFields: ["reachRate"],
    seriesField: "channelV2",
  },
}), [
  { kind: "xField", valueKey: "country", displayValueKey: "country", label: "Market", selectionSource: "xValue", runtimeFilterable: true },
  { kind: "seriesField", valueKey: "channelV2", displayValueKey: "channel.channel", label: "Channel", selectionSource: "seriesKey", runtimeFilterable: true },
]);

assert.equal(
  formatReportRuntimeScopeValue({
    value: { start: "2026-05-01", end: "2026-05-04" },
  }),
  "2026-05-01 to 2026-05-04",
);
assert.equal(
  formatReportRuntimeScopeValue({
    value: ["Display", "CTV"],
  }),
  "Display, CTV",
);
assert.equal(
  formatReportRuntimeRefinement({
    op: "drill",
    field: "channel",
    fieldLabel: "Channel",
    values: ["Display"],
  }),
  "Drill: Channel = Display",
);

assert.deepEqual(
  buildReportRuntimeUnsupportedRefinementDiagnostics({
    block: { id: "primaryChart", kind: "chartBlock" },
    fields: [
      { valueKey: "eventDate", label: "Date", runtimeFilterable: false },
      { valueKey: "channelV2", label: "Channel", runtimeFilterable: true },
    ],
    providerActionsByField: new Map([
      ["primaryChart:eventDate", [
        { kind: "keep", label: "Keep only" },
        { kind: "exclude", label: "Exclude" },
      ]],
      ["primaryChart:channelV2", [
        { kind: "drill", label: "Drill to Publisher", nextFieldRef: "publisherId" },
      ]],
    ]),
  }),
  [{
    code: "runtimeRefinementUnsupported",
    severity: "warning",
    message: "Runtime refinement actions are unavailable for Date because no backend runtime filter mapping is declared.",
  }],
);

console.log("reportRuntimeModel ✓ orders runtime blocks and summarizes scope and semantic binding");

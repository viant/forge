import assert from "node:assert/strict";

import {
  formatReportRuntimeRefinement,
  formatReportRuntimeScopeValue,
  buildReportRuntimeUnsupportedRefinementDiagnostics,
  resolveReportRuntimeActiveScopeSummary,
  resolveReportRuntimeChartActionFields,
  resolveReportRuntimeBindingSummaryChips,
  resolveReportRuntimeCompactBindingSummaryChips,
  resolveReportRuntimeBindingSummary,
  resolveReportRuntimeBlocks,
  resolveReportRuntimeDatasetRequest,
  resolveReportRuntimeRefinementFields,
  resolveReportRuntimeScopeSummary,
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
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date", "channel"],
    selectedMeasures: ["available_impressions", "household_uniques"],
  },
  semanticSummary: {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    selectedDimensions: [
      { id: "event_date", rawId: "eventDate", label: "Delivery Date", category: "Time" },
      {
        id: "channel",
        rawId: "channelV2",
        label: "Channel",
        category: "Delivery",
        definitionRef: "semantic://example/channel",
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
        category: "Metrics",
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
    selectedParameters: [
      {
        id: "reporting_window",
        rawId: "dateRange",
        label: "Reporting Window",
        category: "Scope",
        governance: {
          status: "approved",
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
  scope: {
    params: [
      {
        id: "dateRange",
        label: "Reporting Window",
        description: "Approved reporting window for semantic preview.",
        value: {
          start: "2026-05-01",
          end: "2026-05-07",
        },
      },
    ],
  },
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
  resolveReportRuntimeBlocks({
    ...reportSpec,
    layoutIntent: {
      ...reportSpec.layoutIntent,
      items: [
        { blockId: "sharedFilters" },
        { blockId: "activeRefinements" },
        { blockId: "primaryTable" },
        { blockId: "primaryChart" },
        { blockId: "narrativeIntro", span: 8 },
      ],
    },
  }, reportFill).find((block) => block.id === "narrativeIntro")?.layoutItem,
  { blockId: "narrativeIntro", span: 8 },
);

assert.deepEqual(resolveReportRuntimeBindingSummary(reportSpec), {
  kind: "semantic",
  title: "Semantic Binding",
  modelRef: "model://example/performance/delivery@v1",
  modelLabel: "Ad Delivery",
  entity: "line_delivery",
  entityLabel: "Line Delivery",
  dimensionCount: 2,
  measureCount: 2,
  parameterCount: 1,
  selectedDimensions: [
    { id: "event_date", rawId: "eventDate", label: "Delivery Date", category: "Time" },
    {
      id: "channel",
      rawId: "channelV2",
      label: "Channel",
      category: "Delivery",
      definitionRef: "semantic://example/channel",
      governance: { status: "draft" },
    },
  ],
  selectedMeasures: [
    {
      id: "available_impressions",
      rawId: "avails",
      label: "Available Impressions",
      category: "Metrics",
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
  selectedParameters: [
    {
      id: "reporting_window",
      rawId: "dateRange",
      label: "Reporting Window",
      category: "Scope",
      governance: { status: "approved" },
    },
  ],
  governanceCounts: {
    draft: 1,
    deprecated: 1,
  },
});

assert.deepEqual(resolveReportRuntimeBindingSummary({
  binding: {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date", "channel"],
    selectedMeasures: ["available_impressions", "household_uniques"],
  },
}), {
  kind: "semantic",
  title: "Semantic Binding",
  modelRef: "model://example/performance/delivery@v1",
  entity: "line_delivery",
  dimensionCount: 2,
  measureCount: 2,
  selectedDimensions: [
    { id: "event_date", rawId: "event_date", label: "event_date" },
    { id: "channel", rawId: "channel", label: "channel" },
  ],
  selectedMeasures: [
    { id: "available_impressions", rawId: "available_impressions", label: "available_impressions" },
    { id: "household_uniques", rawId: "household_uniques", label: "household_uniques" },
  ],
  governanceCounts: {
    draft: 0,
    deprecated: 0,
  },
});

assert.deepEqual(resolveReportRuntimeBindingSummary({
  semanticSummary: {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    selectedDimensions: [
      {
        id: "event_date",
        rawId: "eventDate",
        label: "Delivery Date",
      },
      {
        id: "channel",
        rawId: "channelV2",
        label: "Channel",
        governance: {
          status: "deprecated",
        },
      },
      {
        id: "country_code",
        rawId: "country",
        label: "Market",
        governance: {
          status: "deprecated",
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
      },
      {
        id: "reach_rate",
        rawId: "reachRate",
        label: "Reach Rate",
        governance: {
          status: "draft",
        },
      },
    ],
    selectedParameters: [
      {
        id: "reporting_window",
        rawId: "dateRange",
        label: "Reporting Window",
        category: "Scope",
      },
    ],
  },
}), {
  kind: "semantic",
  title: "Semantic Binding",
  modelRef: "model://example/performance/delivery@v1",
  modelLabel: "Ad Delivery",
  entity: "line_delivery",
  entityLabel: "Line Delivery",
  dimensionCount: 3,
  measureCount: 3,
  selectedDimensions: [
    { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
    { id: "channel", rawId: "channelV2", label: "Channel", governance: { status: "deprecated" } },
    { id: "country_code", rawId: "country", label: "Market", governance: { status: "deprecated" } },
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
    { id: "household_uniques", rawId: "hhUniqs", label: "Household Uniques" },
    { id: "reach_rate", rawId: "reachRate", label: "Reach Rate", governance: { status: "draft" } },
  ],
  parameterCount: 1,
  selectedParameters: [
    { id: "reporting_window", rawId: "dateRange", label: "Reporting Window", category: "Scope" },
  ],
  governanceCounts: {
    draft: 1,
    deprecated: 2,
  },
});

assert.deepEqual(resolveReportRuntimeBindingSummaryChips({
  kind: "semantic",
  modelRef: "model://example/performance/delivery@v1",
  modelLabel: "Ad Delivery",
  entity: "line_delivery",
  entityLabel: "Line Delivery",
  dimensionCount: 4,
  measureCount: 4,
  selectedDimensions: [
    { id: "event_date", rawId: "eventDate", label: "Delivery Date", category: "Time" },
    { id: "channel", rawId: "channelV2", label: "Channel", category: "Delivery", definitionRef: "semantic://example/channel", governance: { status: "deprecated", ownerRef: "team://example/performance" } },
    { id: "country_code", rawId: "country", label: "Market", category: "Location", definitionRef: "harmonizer://feature/location", governance: { status: "deprecated", ownerRef: "team://example/performance" } },
    { id: "region", rawId: "region", label: "Region", category: "Location", definitionRef: "harmonizer://feature/location" },
  ],
  selectedMeasures: [
    { id: "available_impressions", rawId: "avails", label: "Available Impressions", category: "Metrics", governance: { ownerRef: "team://example/performance" } },
    { id: "household_uniques", rawId: "hhUniqs", label: "Household Uniques", category: "Metrics" },
    { id: "reach_rate", rawId: "reachRate", label: "Reach Rate", category: "Metrics", governance: { status: "draft" } },
    { id: "reach_share", rawId: "reachShare", label: "Reach Share", category: "Metrics" },
  ],
  parameterCount: 1,
  selectedParameters: [
    { id: "reporting_window", rawId: "dateRange", label: "Reporting Window", category: "Scope", definitionRef: "semantic://example/reporting_window", governance: { ownerRef: "team://example/performance" } },
  ],
  governanceCounts: {
    draft: 1,
    deprecated: 2,
  },
}), [
  "Model Ad Delivery",
  "Entity Line Delivery",
  "Dimensions Delivery Date, Channel +2",
  "Measures Available Impressions, Household Uniques +2",
  "Parameters Reporting Window",
  "Categories Time, Delivery +3",
  "Owner team://example/performance",
  "Lineage semantic://example/channel +2",
  "2 deprecated",
  "1 draft",
]);

assert.deepEqual(resolveReportRuntimeCompactBindingSummaryChips({
  kind: "semantic",
  modelRef: "model://example/performance/delivery@v1",
  modelLabel: "Ad Delivery",
  entity: "line_delivery",
  entityLabel: "Line Delivery",
  dimensionCount: 4,
  measureCount: 4,
  selectedDimensions: [
    { id: "event_date", rawId: "eventDate", label: "Delivery Date", category: "Time" },
    { id: "channel", rawId: "channelV2", label: "Channel", category: "Delivery" },
    { id: "country_code", rawId: "country", label: "Market", category: "Location" },
    { id: "region", rawId: "region", label: "Region", category: "Location" },
  ],
  selectedMeasures: [
    { id: "available_impressions", rawId: "avails", label: "Available Impressions", category: "Metrics" },
    { id: "household_uniques", rawId: "hhUniqs", label: "Household Uniques", category: "Metrics" },
    { id: "reach_rate", rawId: "reachRate", label: "Reach Rate", category: "Metrics" },
    { id: "reach_share", rawId: "reachShare", label: "Reach Share", category: "Metrics" },
  ],
  parameterCount: 1,
  selectedParameters: [
    { id: "reporting_window", rawId: "dateRange", label: "Reporting Window", category: "Scope" },
  ],
  governanceCounts: {
    draft: 1,
    deprecated: 2,
  },
}), [
  "Model Ad Delivery",
  "Entity Line Delivery",
  "Dimensions Delivery Date, Channel +2",
  "Measures Available Impressions, Household Uniques +2",
  "Parameters Reporting Window",
]);

assert.deepEqual(resolveReportRuntimeScopeSummary(reportSpec), {
  title: "Filters",
  paramCount: 1,
  params: [
    {
      id: "dateRange",
      label: "Reporting Window",
      description: "Approved reporting window for semantic preview.",
      value: {
        start: "2026-05-01",
        end: "2026-05-07",
      },
    },
  ],
});

assert.deepEqual(resolveReportRuntimeBindingSummaryChips({
  kind: "semantic",
  modelRef: "model://example/performance/delivery@v1",
  entity: "line_delivery",
  dimensionCount: 0,
  measureCount: 0,
  selectedDimensions: [],
  selectedMeasures: [],
  governanceCounts: {
    draft: 0,
    deprecated: 0,
  },
}), [
  "Model model://example/performance/delivery@v1",
  "Entity line_delivery",
  "0 dimensions",
  "0 measures",
]);

assert.deepEqual(resolveReportRuntimeBindingSummary({
  semanticSummary: {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    selectedDimensions: [
      {
        id: "event_date",
        rawId: "eventDate",
        label: "Delivery Date",
      },
      {
        id: "channel",
        rawId: "channelV2",
        label: "Channel",
        governance: {
          status: "deprecated",
        },
      },
      {
        id: "country_code",
        rawId: "country",
        label: "Market",
        governance: {
          status: "deprecated",
        },
      },
      {
        id: "region",
        rawId: "region",
        label: "Region",
      },
    ],
    selectedMeasures: [
      {
        id: "available_impressions",
        rawId: "avails",
        label: "Available Impressions",
      },
      {
        id: "household_uniques",
        rawId: "hhUniqs",
        label: "Household Uniques",
      },
      {
        id: "reach_rate",
        rawId: "reachRate",
        label: "Reach Rate",
        governance: {
          status: "draft",
        },
      },
      {
        id: "reach_share",
        rawId: "reachShare",
        label: "Reach Share",
      },
    ],
  },
}), {
  kind: "semantic",
  title: "Semantic Binding",
  modelRef: "model://example/performance/delivery@v1",
  modelLabel: "Ad Delivery",
  entity: "line_delivery",
  entityLabel: "Line Delivery",
  dimensionCount: 4,
  measureCount: 4,
  selectedDimensions: [
    { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
    { id: "channel", rawId: "channelV2", label: "Channel", governance: { status: "deprecated" } },
    { id: "country_code", rawId: "country", label: "Market", governance: { status: "deprecated" } },
    { id: "region", rawId: "region", label: "Region" },
  ],
  selectedMeasures: [
    { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
    { id: "household_uniques", rawId: "hhUniqs", label: "Household Uniques" },
    { id: "reach_rate", rawId: "reachRate", label: "Reach Rate", governance: { status: "draft" } },
    { id: "reach_share", rawId: "reachShare", label: "Reach Share" },
  ],
  governanceCounts: {
    draft: 1,
    deprecated: 2,
  },
});

assert.deepEqual(resolveReportRuntimeBindingSummary({
  binding: {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date", "channel"],
    selectedMeasures: ["available_impressions", "household_uniques"],
  },
  semanticSummary: {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    selectedDimensions: [
      {
        id: "channel",
        rawId: "channelV2",
        label: "Channel",
        governance: {
          status: "deprecated",
        },
      },
    ],
    selectedMeasures: [],
  },
}), {
  kind: "semantic",
  title: "Semantic Binding",
  modelRef: "model://example/performance/delivery@v1",
  modelLabel: "Ad Delivery",
  entity: "line_delivery",
  entityLabel: "Line Delivery",
  dimensionCount: 1,
  measureCount: 2,
  selectedDimensions: [
    {
      id: "channel",
      rawId: "channelV2",
      label: "Channel",
      governance: {
        status: "deprecated",
      },
    },
  ],
  selectedMeasures: [
    { id: "available_impressions", rawId: "available_impressions", label: "available_impressions" },
    { id: "household_uniques", rawId: "household_uniques", label: "household_uniques" },
  ],
  governanceCounts: {
    draft: 0,
    deprecated: 1,
  },
});

assert.deepEqual(resolveReportRuntimeBindingSummary({
  binding: {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date", "channel"],
    selectedMeasures: ["available_impressions", "household_uniques"],
  },
  semanticSummary: {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    selectedDimensions: [],
    selectedMeasures: [
      {
        id: "available_impressions",
        rawId: "avails",
        label: "Available Impressions",
        governance: {
          status: "draft",
        },
      },
    ],
  },
}), {
  kind: "semantic",
  title: "Semantic Binding",
  modelRef: "model://example/performance/delivery@v1",
  modelLabel: "Ad Delivery",
  entity: "line_delivery",
  entityLabel: "Line Delivery",
  dimensionCount: 2,
  measureCount: 1,
  selectedDimensions: [
    { id: "event_date", rawId: "event_date", label: "event_date" },
    { id: "channel", rawId: "channel", label: "channel" },
  ],
  selectedMeasures: [
    {
      id: "available_impressions",
      rawId: "avails",
      label: "Available Impressions",
      governance: {
        status: "draft",
      },
    },
  ],
  governanceCounts: {
    draft: 1,
    deprecated: 0,
  },
});

assert.deepEqual(resolveReportRuntimeBindingSummary({
  binding: {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date", "channel"],
    selectedMeasures: ["available_impressions", "household_uniques"],
  },
  semanticSummary: {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    selectedDimensions: [],
    selectedMeasures: [],
  },
}), {
  kind: "semantic",
  title: "Semantic Binding",
  modelRef: "model://example/performance/delivery@v1",
  modelLabel: "Ad Delivery",
  entity: "line_delivery",
  entityLabel: "Line Delivery",
  dimensionCount: 2,
  measureCount: 2,
  selectedDimensions: [
    { id: "event_date", rawId: "event_date", label: "event_date" },
    { id: "channel", rawId: "channel", label: "channel" },
  ],
  selectedMeasures: [
    { id: "available_impressions", rawId: "available_impressions", label: "available_impressions" },
    { id: "household_uniques", rawId: "household_uniques", label: "household_uniques" },
  ],
  governanceCounts: {
    draft: 0,
    deprecated: 0,
  },
});

assert.deepEqual(resolveReportRuntimeBindingSummary({
  semanticSummary: {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Ad Delivery",
    modelDescription: "Governed reporting model for the report builder preview.",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    entityDescription: "Daily delivery grain approved for reporting.",
    selectedDimensions: [
      {
        id: "event_date",
        rawId: "eventDate",
        label: "Delivery Date",
      },
    ],
    selectedMeasures: [
      {
        id: "available_impressions",
        rawId: "avails",
        label: "Available Impressions",
      },
    ],
  },
}), {
  kind: "semantic",
  title: "Semantic Binding",
  modelRef: "model://example/performance/delivery@v1",
  modelLabel: "Ad Delivery",
  modelDescription: "Governed reporting model for the report builder preview.",
  entity: "line_delivery",
  entityLabel: "Line Delivery",
  entityDescription: "Daily delivery grain approved for reporting.",
  dimensionCount: 1,
  measureCount: 1,
  selectedDimensions: [
    { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
  ],
  selectedMeasures: [
    { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
  ],
  governanceCounts: {
    draft: 0,
    deprecated: 0,
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

assert.deepEqual(resolveReportRuntimeBindingSummary({
  reportSpec: {
    title: "Thin Runtime Spec",
    semanticSummary: {
      kind: "semantic",
      selectedDimensions: [],
      selectedMeasures: [],
    },
  },
  reportDocument: {
    title: "Document Backed Runtime",
    semanticSummary: {
      kind: "semantic",
      modelRef: "model://example/audience/performance@v1",
      modelLabel: "Audience Performance",
      entity: "audience_segment",
      entityLabel: "Audience Segment",
      selectedDimensions: [
        {
          id: "audience_segment",
          rawId: "audienceSegment",
          label: "Audience Segment",
        },
      ],
      selectedMeasures: [
        {
          id: "audience_index",
          rawId: "audienceIndex",
          label: "Audience Index",
        },
      ],
    },
  },
}), {
  kind: "semantic",
  title: "Semantic Binding",
  modelRef: "model://example/audience/performance@v1",
  modelLabel: "Audience Performance",
  entity: "audience_segment",
  entityLabel: "Audience Segment",
  dimensionCount: 1,
  measureCount: 1,
  selectedDimensions: [
    {
      id: "audience_segment",
      rawId: "audienceSegment",
      label: "Audience Segment",
    },
  ],
  selectedMeasures: [
    {
      id: "audience_index",
      rawId: "audienceIndex",
      label: "Audience Index",
    },
  ],
  governanceCounts: {
    draft: 0,
    deprecated: 0,
  },
});

assert.deepEqual(resolveReportRuntimeScopeSummary({
  reportSpec: {
    title: "Thin Runtime Scope",
    scope: {
      params: [],
    },
  },
  reportDocument: {
    scope: {
      params: [
        {
          id: "dateRange",
          label: "Reporting Window",
          description: "Recovered from the embedded runtime document.",
          value: {
            start: "2026-06-01",
            end: "2026-06-07",
          },
        },
      ],
    },
  },
}), {
  title: "Filters",
  paramCount: 1,
  params: [
    {
      id: "dateRange",
      label: "Reporting Window",
      description: "Recovered from the embedded runtime document.",
      value: {
        start: "2026-06-01",
        end: "2026-06-07",
      },
    },
  ],
});

assert.equal(resolveReportRuntimeActiveScopeSummary([]), null);
assert.equal(resolveReportRuntimeActiveScopeSummary(), null);
assert.deepEqual(
  resolveReportRuntimeActiveScopeSummary([
    {
      id: "drill:channel",
      op: "drill",
      field: "channel",
      fieldLabel: "Channel",
      values: ["Audio"],
    },
  ]),
  {
    title: "Active Refinements",
    description: "Keep, exclude, and drill actions applied on top of the baseline scope above, for this session only.",
    count: 1,
    items: [
      { id: "drill:channel", label: "Drill: Channel = Audio" },
    ],
  },
);

console.log("reportRuntimeModel ✓ orders runtime blocks and summarizes scope and semantic binding");

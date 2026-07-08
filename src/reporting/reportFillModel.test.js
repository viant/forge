import assert from "node:assert/strict";

import {
  buildReportBuilderReportFill,
  buildReportFillFromReportSpec,
  buildReportSpecHash,
} from "./reportFillModel.js";
import {
  buildReportBuilderReportDocument,
  buildReportDocumentBadgesBlock,
  buildReportDocumentChartBlock,
  buildReportDocumentFilterBarBlock,
  buildReportDocumentGeoMapBlock,
  buildReportDocumentKpiBlock,
  buildReportDocumentMarkdownBlock,
  buildReportDocumentRefinementBarBlock,
  buildReportDocumentTableBlock,
  lowerReportDocumentToReportSpec,
} from "./reportDocumentModel.js";
import { buildReportBuilderReportSpec } from "./reportSpecModel.js";
import { applyReportBuilderSemanticConfig } from "../components/dashboard/reportBuilderSemantic.js";
import {
  buildReportBuilderDocumentBlockDraft,
  buildReportBuilderDocumentBlockFieldOptions,
} from "../components/dashboard/reportBuilderDocumentBlocks.js";

const rawConfig = {
  title: "Performance Report",
  measures: [
    { id: "totalSpend", key: "totalSpend", label: "Spend", paramPath: "measures.totalSpend", default: true, format: "currency" },
    { id: "impressions", key: "impressions", label: "Impressions", paramPath: "measures.impressions", format: "compactNumber" },
  ],
  dimensions: [
    { id: "eventDate", key: "eventDate", label: "Date", paramPath: "dimensions.eventDate", default: true, chartAxis: true, format: "date" },
    {
      id: "channelId",
      key: "channelId",
      label: "Channel",
      paramPath: "dimensions.channelId",
      runtimeFilter: {
        includeParamPath: "filters.includeChannelId",
        excludeParamPath: "filters.excludeChannelId",
      },
    },
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

const rawState = {
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

const rawContainer = {
  id: "performanceBuilder",
  stateKey: "performanceBuilder",
  title: "Performance Report",
  dataSourceRef: "demoReportSource",
};

const rawRows = [
  { eventDate: "2026-05-01", channelId: "Display", totalSpend: 40400, impressions: 16500 },
  { eventDate: "2026-05-01", channelId: "CTV", totalSpend: 34300, impressions: 14700 },
];

const rawFill = buildReportBuilderReportFill({
  container: rawContainer,
  config: rawConfig,
  state: rawState,
  primaryRows: rawRows,
});

assert.equal(rawFill.kind, "reportFill");
assert.equal(rawFill.version, 1);
assert.equal(rawFill.specVersion, 1);
assert.equal(typeof rawFill.specHash, "string");
assert.equal(rawFill.specHash.length > 0, true);
assert.deepEqual(rawFill.source, {
  kind: "dashboard.reportBuilder",
  containerId: "performanceBuilder",
  stateKey: "performanceBuilder",
  dataSourceRef: "demoReportSource",
});
assert.deepEqual(rawFill.parameters, {
  viewMode: "chart",
  groupBy: "channelId",
  pageSize: 25,
  orderField: "totalSpend",
  orderDir: "desc",
});
assert.deepEqual(rawFill.refinements, []);
assert.equal(rawFill.datasets[0].provenance.rowCount, 2);
assert.equal(rawFill.datasets[0].provenance.truncated, false);
assert.equal(typeof rawFill.datasets[0].provenance.requestHash, "string");
const requestHashOrderOne = buildReportFillFromReportSpec({
  version: 1,
  kind: "reportSpec",
  source: {
    kind: "dashboard.reportBuilder",
    containerId: "hashBuilder",
    stateKey: "hashBuilder",
    dataSourceRef: "demoReportSource",
  },
  title: "Hash Builder",
  parameters: {
    viewMode: "table",
    groupBy: "",
    pageSize: 25,
    orderField: "",
    orderDir: "asc",
  },
  layoutIntent: {
    kind: "single",
    resultPanePosition: "right",
    blockOrder: ["primaryTable"],
  },
  refinements: [],
  calculatedFields: [],
  datasets: [
    {
      id: "primary",
      dataSourceRef: "demoReportSource",
      request: {
        dimensions: { channelId: true },
        filters: { date: "2026-07-08" },
        limit: 25,
        measures: { totalSpend: true },
        offset: 0,
        orderBy: ["totalSpend desc"],
      },
    },
  ],
  blocks: [
    {
      id: "primaryTable",
      kind: "tableBlock",
      datasetRef: "primary",
      columns: [{ key: "channelId", label: "Channel" }],
    },
  ],
}, {
  primary: { rows: [{ channelId: "Display", totalSpend: 1 }] },
}).datasets[0].provenance.requestHash;
const requestHashOrderTwo = buildReportFillFromReportSpec({
  version: 1,
  kind: "reportSpec",
  source: {
    kind: "dashboard.reportBuilder",
    containerId: "hashBuilder",
    stateKey: "hashBuilder",
    dataSourceRef: "demoReportSource",
  },
  title: "Hash Builder",
  parameters: {
    viewMode: "table",
    groupBy: "",
    pageSize: 25,
    orderField: "",
    orderDir: "asc",
  },
  layoutIntent: {
    kind: "single",
    resultPanePosition: "right",
    blockOrder: ["primaryTable"],
  },
  refinements: [],
  calculatedFields: [],
  datasets: [
    {
      id: "primary",
      dataSourceRef: "demoReportSource",
      request: {
        orderBy: ["totalSpend desc"],
        offset: 0,
        measures: { totalSpend: true },
        limit: 25,
        filters: { date: "2026-07-08" },
        dimensions: { channelId: true },
      },
    },
  ],
  blocks: [
    {
      id: "primaryTable",
      kind: "tableBlock",
      datasetRef: "primary",
      columns: [{ key: "channelId", label: "Channel" }],
    },
  ],
}, {
  primary: { rows: [{ channelId: "Display", totalSpend: 1 }] },
}).datasets[0].provenance.requestHash;
assert.equal(requestHashOrderOne, requestHashOrderTwo);
assert.deepEqual(rawFill.blocks[0].content.columns.map((column) => column.key), [
  "eventDate",
  "channelId",
  "totalSpend",
  "impressions",
]);
assert.equal(rawFill.blocks[0].content.columns[1].runtimeFilterable, true);
assert.equal(rawFill.blocks[0].content.rowCount, 2);
assert.equal(rawFill.blocks[1].content.chartSpec.title, "Manual Spend Trend");
assert.equal(rawFill.blocks[1].content.chartModel.type, "line");
assert.equal(rawFill.blocks[1].content.rowCount, 2);
assert.deepEqual(rawFill.blocks[1].content.resolvedChart, {
  kind: "groupedSeries",
  type: "line",
  xAxisKey: "eventDate",
  nameKey: "channelId",
  valueKey: "totalSpend",
  rows: [
    {
      eventDate: "2026-05-01",
      Display: 40400,
      CTV: 34300,
    },
  ],
  seriesKeys: ["Display", "CTV"],
});
assert.deepEqual(rawFill.diagnostics, []);

const semanticModel = {
  modelRef: "model://example/performance/delivery@v1",
  version: 1,
  label: "Ad Delivery",
  entities: [
    {
      id: "line_delivery",
      label: "Line Delivery",
      dimensions: [
        { id: "event_date", label: "Delivery Date", dataType: "date", format: "date" },
        { id: "channel", label: "Channel", dataType: "string" },
      ],
      measures: [
        { id: "spend", label: "Available Impressions", dataType: "number", aggregation: "sum", format: "compactNumber" },
        { id: "impressions", label: "Impressions", dataType: "number", aggregation: "sum", format: "compactNumber" },
      ],
    },
  ],
};

const semanticConfig = applyReportBuilderSemanticConfig({
  ...rawConfig,
  measures: rawConfig.measures.map((measure) => (
    measure.id === "totalSpend"
      ? { ...measure, semanticRef: "spend" }
      : (measure.id === "impressions" ? { ...measure, semanticRef: "impressions" } : measure)
  )),
  dimensions: rawConfig.dimensions.map((dimension) => (
    dimension.id === "eventDate"
      ? { ...dimension, semanticRef: "event_date" }
      : (dimension.id === "channelId" ? { ...dimension, semanticRef: "channel" } : dimension)
  )),
  binding: {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date", "channel"],
    selectedMeasures: ["spend", "impressions"],
  },
}, {
  mode: "semantic",
  modelRef: "model://example/performance/delivery@v1",
  entity: "line_delivery",
  selectedDimensions: ["event_date", "channel"],
  selectedMeasures: ["spend", "impressions"],
}, semanticModel);

const semanticState = {
  selectedMeasures: ["totalSpend", "impressions"],
  primaryMeasure: "totalSpend",
  selectedDimensions: ["eventDate", "channelId"],
  viewMode: "chart",
  chartSpec: {
    title: "Semantic Spend by Date",
    type: "line",
    xField: "eventDate",
    yFields: ["totalSpend"],
  },
  groupBy: "",
  pageSize: 50,
  orderField: "eventDate",
  orderDir: "asc",
  scopeParams: {
    dateRange: { start: "2026-05-01", end: "2026-05-04" },
  },
  binding: semanticConfig.binding,
};

const semanticSpec = buildReportBuilderReportSpec({
  container: {
    id: "semanticPerformanceBuilder",
    stateKey: "semanticPerformanceBuilder",
    title: "Semantic Performance Report",
    dataSourceRef: "demoReportSource",
  },
  config: semanticConfig,
  state: semanticState,
});

const semanticFill = buildReportFillFromReportSpec(semanticSpec, {
  primary: {
    rows: rawRows,
    hasMore: true,
    diagnostics: [
      {
        code: "truncated",
        severity: "warning",
        message: "Results truncated to preview row limit.",
      },
    ],
  },
});

assert.equal(semanticFill.specHash, buildReportSpecHash(semanticSpec));
assert.equal(semanticFill.datasets[0].provenance.truncated, true);
assert.equal(semanticFill.datasets[0].provenance.hasMore, true);
assert.equal(semanticFill.datasets[0].provenance.diagnostics.length, 1);
assert.deepEqual(semanticFill.diagnostics, [
  {
    code: "truncated",
    severity: "warning",
    message: "Results truncated to preview row limit.",
  },
]);
assert.deepEqual(semanticFill.blocks[0].content.columns.map((column) => column.label), [
  "Delivery Date",
  "Channel",
  "Available Impressions",
  "Impressions",
]);
assert.equal(semanticFill.blocks[1].content.chartSpec.title, "Semantic Spend by Date");
assert.deepEqual(semanticFill.blocks[1].content.resolvedChart, {
  kind: "directSeries",
  type: "line",
  xAxisKey: "eventDate",
  seriesKeys: ["totalSpend"],
  rows: [
    {
      eventDate: "2026-05-01",
      totalSpend: 74700,
    },
  ],
});

const documentWithNarrative = buildReportBuilderReportDocument({
  container: rawContainer,
  config: rawConfig,
  state: rawState,
  additionalBlocks: [
    buildReportDocumentFilterBarBlock({
      id: "sharedFilters",
      title: "Shared Filters",
      paramIds: ["dateRange"],
    }),
    buildReportDocumentRefinementBarBlock({
      id: "activeRefinements",
      title: "Applied Refinements",
      actionKinds: ["remove", "clearAll", "redo", "invalid"],
      emptyLabel: "No drill path selected",
    }),
    buildReportDocumentKpiBlock({
      id: "headlineKpi",
      title: "Headline KPI",
      datasetRef: "primary",
      valueField: "totalSpend",
      valueLabel: "Spend",
      secondaryField: "channelId",
      secondaryLabel: "Channel",
      description: "Summarizes the first authored runtime row.",
      emptyLabel: "No headline KPI value available.",
    }),
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
          rules: [
            { value: "Display", label: "Display media", tone: "success" },
          ],
        },
        { id: "spend", label: "Spend", valueField: "totalSpend", format: "currency", tone: "success" },
      ],
    }),
    buildReportDocumentTableBlock({
      id: "comparisonTable",
      title: "Comparison Table",
      datasetRef: "primary",
      columns: [
        {
          key: "totalSpend",
          label: "Spend",
          cellVisual: {
            kind: "dataBar",
            valueField: "totalSpend",
            range: { mode: "columnMax" },
            palette: ["#dbeafe", "#2563eb"],
          },
        },
        {
          key: "status",
          label: "Status",
          cellVisual: {
            kind: "badge",
            rules: [
              { value: "healthy", tone: "success" },
            ],
          },
        },
      ],
    }),
    buildReportDocumentMarkdownBlock({
      id: "narrativeIntro",
      title: "Executive Summary",
      markdown: "## Executive Summary\nThe report opens with a short narrative block.",
    }),
  ],
  refinements: [
    {
      op: "drill",
      field: "channel",
      values: ["Display"],
      sourceBlockId: "comparisonTable",
      label: "Drill Display",
    },
  ],
});

const documentFill = buildReportFillFromReportSpec(
  lowerReportDocumentToReportSpec(documentWithNarrative),
  {
    primary: {
      rows: rawRows,
    },
  },
);
assert.deepEqual(documentFill.refinements, [
  {
    id: "drill:channel:comparisonTable",
    op: "drill",
    field: "channel",
    values: ["Display"],
    sourceBlockId: "comparisonTable",
    label: "Drill Display",
  },
]);
assert.deepEqual(documentFill.blocks[2].content, {
  title: "Shared Filters",
  params: [
    {
      id: "dateRange",
      label: "dateRange",
      type: "dateRange",
      required: true,
      description: "Approved reporting window for shared runtime scope.",
      value: {
        start: "2026-05-01",
        end: "2026-05-04",
      },
    },
  ],
});

const interactiveFilterConfig = {
  ...rawConfig,
  staticFilters: [
    ...rawConfig.staticFilters,
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
};
const interactiveFilterState = {
  ...rawState,
  scopeParams: {
    ...rawState.scopeParams,
    channelIds: ["Display"],
  },
};
const interactiveFilterDocument = buildReportBuilderReportDocument({
  container: rawContainer,
  config: interactiveFilterConfig,
  state: interactiveFilterState,
  additionalBlocks: [
    buildReportDocumentFilterBarBlock({
      id: "sharedFilters",
      title: "Filters",
      paramIds: ["dateRange", "channelIds"],
    }),
  ],
});
const interactiveFilterSpec = lowerReportDocumentToReportSpec(interactiveFilterDocument);
const interactiveFilterFill = buildReportFillFromReportSpec(
  interactiveFilterSpec,
  {
    primary: {
      rows: rawRows,
    },
  },
);
const interactiveFilterBlock = interactiveFilterFill.blocks.find((block) => block.id === "sharedFilters");
assert.deepEqual(interactiveFilterBlock.content.params[1], {
  id: "channelIds",
  label: "Channels",
  type: "multiSelect",
  multiple: true,
  presentation: "compactIconRow",
  options: [
    { value: "Display", label: "Display", icon: "media" },
    { value: "CTV", label: "CTV", icon: "video" },
  ],
  value: ["Display"],
});
assert.deepEqual(documentFill.blocks[3].content, {
  title: "Applied Refinements",
  actionKinds: ["remove", "clearAll", "redo"],
  emptyLabel: "No drill path selected",
  refinements: [
    {
      id: "drill:channel:comparisonTable",
      op: "drill",
      field: "channel",
      values: ["Display"],
      sourceBlockId: "comparisonTable",
      label: "Drill Display",
    },
  ],
});
assert.deepEqual(documentFill.blocks[4].content, {
  title: "Headline KPI",
  description: "Summarizes the first authored runtime row.",
  valueField: "totalSpend",
  valueLabel: "Spend",
  value: 40400,
  rowCount: 2,
  secondaryField: "channelId",
  secondaryLabel: "Channel",
  secondaryValue: "Display",
  emptyLabel: "No headline KPI value available.",
});
assert.deepEqual(documentFill.blocks[5].content, {
  title: "Status Pills",
  rowCount: 2,
  items: [
    { id: "channel", label: "Channel", value: "Display", displayValue: "Display media", valueField: "channelId", tone: "success" },
    { id: "spend", label: "Spend", value: 40400, valueField: "totalSpend", format: "currency", displayValue: "$40,400", tone: "success" },
  ],
});
assert.deepEqual(documentFill.blocks[6].content.columns[0].cellVisual, {
  kind: "dataBar",
  valueField: "totalSpend",
  range: { mode: "columnMax" },
  palette: ["#dbeafe", "#2563eb"],
});
assert.deepEqual(documentFill.blocks[6].content.columns[1].cellVisual, {
  kind: "badge",
  rules: [
    {
      value: "healthy",
      tone: "success",
    },
  ],
});
assert.equal(documentFill.blocks[6].content.rowCount, 2);
assert.deepEqual(documentFill.blocks[6].content.resolvedRows[0].cells[0], {
  key: "totalSpend",
  sourceKey: "totalSpend",
  displayKey: "totalSpend",
  value: 40400,
  displayValue: 40400,
  visualState: {
    kind: "dataBar",
    value: 40400,
    percent: 1,
    palette: ["#dbeafe", "#2563eb"],
  },
});
assert.deepEqual(documentFill.blocks[6].content.resolvedRows[0].cells[1], {
  key: "status",
  sourceKey: "status",
  displayKey: "status",
  value: null,
  displayValue: null,
  visualState: null,
});
assert.deepEqual(documentFill.blocks[7].content, {
  title: "Executive Summary",
  markdown: "## Executive Summary\nThe report opens with a short narrative block.",
});

const emptyRefinementFill = buildReportFillFromReportSpec({
  version: 1,
  kind: "reportSpec",
  refinements: [],
  datasets: [],
  blocks: [
    {
      id: "emptyRefinements",
      kind: "refinementBarBlock",
      title: "",
      actionKinds: [],
      emptyLabel: "",
    },
  ],
}, {});
assert.deepEqual(emptyRefinementFill.blocks[0].content, {
  title: "",
  actionKinds: [],
  emptyLabel: "",
  refinements: [],
});
const minimalRefinementFill = buildReportFillFromReportSpec({
  version: 1,
  kind: "reportSpec",
  refinements: [],
  datasets: [],
  blocks: [
    {
      id: "minimalRefinements",
      kind: "refinementBarBlock",
    },
  ],
}, {});
assert.deepEqual(minimalRefinementFill.blocks[0].content, {
  refinements: [],
});

const computedSpec = buildReportBuilderReportSpec({
  container: rawContainer,
  config: {
    ...rawConfig,
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
    ...rawState,
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

const computedFill = buildReportFillFromReportSpec(computedSpec, {
  primary: {
    rows: rawRows,
  },
});

assert.deepEqual(computedFill.calculatedFields, [
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
assert.equal(computedFill.datasets[0].rows[0].ctr, 244.85);
assert.equal(computedFill.datasets[0].rows[1].ctr, 233.33);
assert.equal(computedFill.blocks[0].content.columns[2].key, "ctr");

const expressionSpec = buildReportBuilderReportSpec({
  container: rawContainer,
  config: {
    ...rawConfig,
    calculatedFields: [
      {
        id: "projectedLift",
        key: "projectedLift",
        label: "Projected Lift",
        dataType: "number",
        format: "currency",
        expr: "if(channelId = 'CTV', totalSpend, null)",
      },
    ],
  },
  state: {
    ...rawState,
    selectedMeasures: ["projectedLift"],
    primaryMeasure: "projectedLift",
    chartSpec: {
      title: "Projected Lift by Date",
      type: "line",
      xField: "eventDate",
      yFields: ["projectedLift"],
    },
  },
});

const expressionFill = buildReportFillFromReportSpec(expressionSpec, {
  primary: {
    rows: rawRows,
  },
});

assert.deepEqual(expressionFill.calculatedFields, [
  {
    id: "projectedLift",
    key: "projectedLift",
    kind: "rowCalc",
    label: "Projected Lift",
    dataType: "number",
    format: "currency",
    datasetRef: "primary",
    dependencies: ["channelId", "totalSpend"],
    expr: "if(channelId = 'CTV', totalSpend, null)",
  },
]);
assert.equal(expressionFill.datasets[0].rows[0].projectedLift, null);
assert.equal(expressionFill.datasets[0].rows[1].projectedLift, 34300);
assert.equal(expressionFill.blocks[0].content.columns[2].key, "projectedLift");

const stateOwnedExpressionFill = buildReportBuilderReportFill({
  container: rawContainer,
  config: rawConfig,
  state: {
    ...rawState,
    localCalculatedFields: [
      {
        id: "projectedLift",
        key: "projectedLift",
        label: "Projected Lift",
        dataType: "number",
        format: "currency",
        expr: "if(channelId = 'CTV', totalSpend, null)",
      },
    ],
    selectedMeasures: ["projectedLift"],
    primaryMeasure: "projectedLift",
    chartSpec: {
      title: "Projected Lift by Date",
      type: "line",
      xField: "eventDate",
      yFields: ["projectedLift"],
    },
  },
  primaryRows: rawRows,
});

assert.deepEqual(stateOwnedExpressionFill.calculatedFields, [
  {
    id: "projectedLift",
    key: "projectedLift",
    kind: "rowCalc",
    label: "Projected Lift",
    dataType: "number",
    format: "currency",
    datasetRef: "primary",
    dependencies: ["channelId", "totalSpend"],
    expr: "if(channelId = 'CTV', totalSpend, null)",
  },
]);
assert.equal(stateOwnedExpressionFill.datasets[0].rows[0].projectedLift, null);
assert.equal(stateOwnedExpressionFill.datasets[0].rows[1].projectedLift, 34300);
assert.equal(stateOwnedExpressionFill.blocks[0].content.columns[2].key, "projectedLift");

const dependentTableCalcFill = buildReportBuilderReportFill({
  container: rawContainer,
  config: rawConfig,
  state: {
    ...rawState,
    localCalculatedFields: [
      {
        id: "projectedLift",
        key: "projectedLift",
        label: "Projected Lift",
        dataType: "number",
        format: "currency",
        expr: "if(channelId = 'CTV', totalSpend, null)",
      },
    ],
    localTableCalculations: [
      {
        id: "runningProjectedLift",
        key: "runningProjectedLift",
        label: "Running Projected Lift",
        format: "currency",
        compute: {
          type: "runningTotal",
          sourceField: "projectedLift",
          partitionBy: ["channelId"],
          orderBy: [
            { field: "eventDate", direction: "asc" },
          ],
        },
      },
    ],
    selectedMeasures: ["runningProjectedLift"],
    primaryMeasure: "runningProjectedLift",
    selectedDimensions: ["eventDate", "channelId"],
    chartSpec: {
      title: "Running Projected Lift by Date",
      type: "line",
      xField: "eventDate",
      yFields: ["runningProjectedLift"],
    },
  },
  primaryRows: rawRows,
});

assert.deepEqual(dependentTableCalcFill.calculatedFields, [
  {
    id: "projectedLift",
    key: "projectedLift",
    kind: "rowCalc",
    label: "Projected Lift",
    dataType: "number",
    format: "currency",
    datasetRef: "primary",
    dependencies: ["channelId", "totalSpend"],
    expr: "if(channelId = 'CTV', totalSpend, null)",
  },
  {
    id: "runningProjectedLift",
    key: "runningProjectedLift",
    kind: "tableCalc",
    label: "Running Projected Lift",
    dataType: "number",
    format: "currency",
    datasetRef: "primary",
    dependencies: ["projectedLift", "eventDate", "channelId"],
    compute: {
      type: "runningTotal",
      sourceField: "projectedLift",
      partitionBy: ["channelId"],
      orderBy: [
        { field: "eventDate", direction: "asc" },
      ],
    },
  },
]);
assert.equal(dependentTableCalcFill.datasets[0].rows[0].projectedLift, null);
assert.equal(dependentTableCalcFill.datasets[0].rows[1].projectedLift, 34300);
assert.equal(dependentTableCalcFill.datasets[0].rows[0].runningProjectedLift, 0);
assert.equal(dependentTableCalcFill.datasets[0].rows[1].runningProjectedLift, 34300);
assert.equal(dependentTableCalcFill.blocks[0].content.columns[2].key, "runningProjectedLift");

const stateOwnedTableCalcFill = buildReportBuilderReportFill({
  container: rawContainer,
  config: rawConfig,
  state: {
    ...rawState,
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
    selectedMeasures: ["reachShare"],
    primaryMeasure: "reachShare",
    selectedDimensions: ["eventDate"],
    chartSpec: {
      title: "Reach Share by Date",
      type: "line",
      xField: "eventDate",
      yFields: ["reachShare"],
    },
  },
  primaryRows: [
    { eventDate: "2026-05-01", channelId: "Display", impressions: 100 },
    { eventDate: "2026-05-02", channelId: "Display", impressions: 300 },
    { eventDate: "2026-05-01", channelId: "CTV", impressions: 80 },
    { eventDate: "2026-05-02", channelId: "CTV", impressions: 120 },
  ],
});

assert.deepEqual(stateOwnedTableCalcFill.calculatedFields, [
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
assert.equal(stateOwnedTableCalcFill.datasets[0].rows[0].reachShare, 25);
assert.equal(stateOwnedTableCalcFill.datasets[0].rows[1].reachShare, 75);
assert.equal(stateOwnedTableCalcFill.blocks[0].content.columns[1].key, "reachShare");

const tableCalcSpec = buildReportBuilderReportSpec({
  container: rawContainer,
  config: {
    ...rawConfig,
    tableCalculations: [
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
  state: {
    ...rawState,
    selectedMeasures: ["reachShare"],
    primaryMeasure: "reachShare",
    selectedDimensions: ["eventDate"],
    chartSpec: {
      title: "Reach Share by Date",
      type: "line",
      xField: "eventDate",
      yFields: ["reachShare"],
    },
  },
});

const tableCalcFill = buildReportFillFromReportSpec(tableCalcSpec, {
  primary: {
    rows: [
      { eventDate: "2026-05-01", channelId: "Display", impressions: 100 },
      { eventDate: "2026-05-02", channelId: "Display", impressions: 300 },
      { eventDate: "2026-05-01", channelId: "CTV", impressions: 80 },
      { eventDate: "2026-05-02", channelId: "CTV", impressions: 120 },
    ],
  },
});

assert.equal(tableCalcFill.datasets[0].rows[0].reachShare, 25);
assert.equal(tableCalcFill.datasets[0].rows[1].reachShare, 75);
assert.equal(tableCalcFill.datasets[0].rows[2].reachShare, 40);
assert.equal(tableCalcFill.datasets[0].rows[3].reachShare, 60);
assert.deepEqual(tableCalcFill.blocks[0].content.columns.map((column) => column.key), [
  "eventDate",
  "reachShare",
]);

const deltaTableCalcSpec = buildReportBuilderReportSpec({
  container: rawContainer,
  config: {
    ...rawConfig,
    tableCalculations: [
      {
        id: "spendDelta",
        key: "spendDelta",
        label: "Spend Delta",
        format: "number",
        compute: {
          type: "deltaFromPrevious",
          sourceField: "totalSpend",
          partitionBy: ["channelId"],
          orderBy: [
            { field: "eventDate", direction: "asc" },
          ],
        },
      },
    ],
  },
  state: {
    ...rawState,
    selectedMeasures: ["spendDelta"],
    primaryMeasure: "spendDelta",
    selectedDimensions: ["eventDate"],
    chartSpec: {
      title: "Spend Delta by Date",
      type: "line",
      xField: "eventDate",
      yFields: ["spendDelta"],
    },
  },
});

const deltaTableCalcFill = buildReportFillFromReportSpec(deltaTableCalcSpec, {
  primary: {
    rows: [
      { eventDate: "2026-05-01", channelId: "Display", totalSpend: 100 },
      { eventDate: "2026-05-02", channelId: "Display", totalSpend: 140 },
      { eventDate: "2026-05-01", channelId: "CTV", totalSpend: 80 },
      { eventDate: "2026-05-02", channelId: "CTV", totalSpend: 90 },
    ],
  },
});

assert.equal(deltaTableCalcFill.datasets[0].rows[0].spendDelta, 0);
assert.equal(deltaTableCalcFill.datasets[0].rows[1].spendDelta, 40);
assert.equal(deltaTableCalcFill.datasets[0].rows[2].spendDelta, 0);
assert.equal(deltaTableCalcFill.datasets[0].rows[3].spendDelta, 10);
assert.deepEqual(deltaTableCalcFill.blocks[0].content.columns.map((column) => column.key), [
  "eventDate",
  "spendDelta",
]);

const runningTableCalcSpec = buildReportBuilderReportSpec({
  container: rawContainer,
  config: {
    ...rawConfig,
    tableCalculations: [
      {
        id: "runningSpend",
        key: "runningSpend",
        label: "Running Spend",
        format: "number",
        compute: {
          type: "runningTotal",
          sourceField: "totalSpend",
          partitionBy: ["channelId"],
          orderBy: [
            { field: "eventDate", direction: "asc" },
          ],
        },
      },
    ],
  },
  state: {
    ...rawState,
    selectedMeasures: ["runningSpend"],
    primaryMeasure: "runningSpend",
    selectedDimensions: ["eventDate"],
    chartSpec: {
      title: "Running Spend by Date",
      type: "line",
      xField: "eventDate",
      yFields: ["runningSpend"],
    },
  },
});

const runningTableCalcFill = buildReportFillFromReportSpec(runningTableCalcSpec, {
  primary: {
    rows: [
      { eventDate: "2026-05-01", channelId: "Display", totalSpend: 100 },
      { eventDate: "2026-05-02", channelId: "Display", totalSpend: 140 },
      { eventDate: "2026-05-01", channelId: "CTV", totalSpend: 80 },
      { eventDate: "2026-05-02", channelId: "CTV", totalSpend: 90 },
    ],
  },
});

assert.equal(runningTableCalcFill.datasets[0].rows[0].runningSpend, 100);
assert.equal(runningTableCalcFill.datasets[0].rows[1].runningSpend, 240);
assert.equal(runningTableCalcFill.datasets[0].rows[2].runningSpend, 80);
assert.equal(runningTableCalcFill.datasets[0].rows[3].runningSpend, 170);
assert.deepEqual(runningTableCalcFill.blocks[0].content.columns.map((column) => column.key), [
  "eventDate",
  "runningSpend",
]);

const movingAverageTableCalcSpec = buildReportBuilderReportSpec({
  container: rawContainer,
  config: {
    ...rawConfig,
    tableCalculations: [
      {
        id: "avgSpend",
        key: "avgSpend",
        label: "Avg Spend",
        format: "number",
        compute: {
          type: "movingAverage",
          sourceField: "totalSpend",
          partitionBy: ["channelId"],
          orderBy: [
            { field: "eventDate", direction: "asc" },
          ],
          windowSize: 2,
          decimals: 1,
        },
      },
    ],
  },
  state: {
    ...rawState,
    selectedMeasures: ["avgSpend"],
    primaryMeasure: "avgSpend",
    selectedDimensions: ["eventDate"],
    chartSpec: {
      title: "Average Spend by Date",
      type: "line",
      xField: "eventDate",
      yFields: ["avgSpend"],
    },
  },
});

const movingAverageTableCalcFill = buildReportFillFromReportSpec(movingAverageTableCalcSpec, {
  primary: {
    rows: [
      { eventDate: "2026-05-01", channelId: "Display", totalSpend: 100 },
      { eventDate: "2026-05-02", channelId: "Display", totalSpend: 140 },
      { eventDate: "2026-05-01", channelId: "CTV", totalSpend: 80 },
      { eventDate: "2026-05-02", channelId: "CTV", totalSpend: 90 },
    ],
  },
});

assert.equal(movingAverageTableCalcFill.datasets[0].rows[0].avgSpend, 100);
assert.equal(movingAverageTableCalcFill.datasets[0].rows[1].avgSpend, 120);
assert.equal(movingAverageTableCalcFill.datasets[0].rows[2].avgSpend, 80);
assert.equal(movingAverageTableCalcFill.datasets[0].rows[3].avgSpend, 85);
assert.deepEqual(movingAverageTableCalcFill.blocks[0].content.columns.map((column) => column.key), [
  "eventDate",
  "avgSpend",
]);

const rankTableCalcSpec = buildReportBuilderReportSpec({
  container: rawContainer,
  config: {
    ...rawConfig,
    tableCalculations: [
      {
        id: "spendRank",
        key: "spendRank",
        label: "Spend Rank",
        format: "number",
        compute: {
          type: "rank",
          sourceField: "totalSpend",
          partitionBy: ["channelId"],
          orderBy: [
            { field: "totalSpend", direction: "desc" },
            { field: "eventDate", direction: "asc" },
          ],
        },
      },
    ],
  },
  state: {
    ...rawState,
    selectedMeasures: ["spendRank"],
    primaryMeasure: "spendRank",
    selectedDimensions: ["eventDate"],
    chartSpec: {
      title: "Spend Rank by Date",
      type: "line",
      xField: "eventDate",
      yFields: ["spendRank"],
    },
  },
});

const rankTableCalcFill = buildReportFillFromReportSpec(rankTableCalcSpec, {
  primary: {
    rows: [
      { eventDate: "2026-05-01", channelId: "Display", totalSpend: 100 },
      { eventDate: "2026-05-02", channelId: "Display", totalSpend: 140 },
      { eventDate: "2026-05-03", channelId: "Display", totalSpend: 140 },
      { eventDate: "2026-05-04", channelId: "Display", totalSpend: null },
      { eventDate: "2026-05-01", channelId: "CTV", totalSpend: 80 },
      { eventDate: "2026-05-02", channelId: "CTV", totalSpend: 90 },
    ],
  },
});

assert.equal(rankTableCalcFill.datasets[0].rows[0].spendRank, 2);
assert.equal(rankTableCalcFill.datasets[0].rows[1].spendRank, 1);
assert.equal(rankTableCalcFill.datasets[0].rows[2].spendRank, 1);
assert.equal(rankTableCalcFill.datasets[0].rows[3].spendRank, null);
assert.equal(rankTableCalcFill.datasets[0].rows[4].spendRank, 2);
assert.equal(rankTableCalcFill.datasets[0].rows[5].spendRank, 1);
assert.deepEqual(rankTableCalcFill.blocks[0].content.columns.map((column) => column.key), [
  "eventDate",
  "spendRank",
]);

const styledRankPresetSpec = buildReportBuilderReportSpec({
  container: rawContainer,
  config: {
    ...rawConfig,
    tableCalculations: [
      {
        id: "reachRank",
        key: "reachRank",
        label: "Reach Rank",
        format: "number",
        compute: {
          type: "rank",
          sourceField: "impressions",
          orderBy: [
            { field: "impressions", direction: "desc" },
            { field: "channelId", direction: "asc" },
            { field: "eventDate", direction: "asc" },
          ],
        },
      },
    ],
  },
  state: {
    ...rawState,
    viewMode: "table",
    chartSpec: null,
    groupBy: "",
    selectedMeasures: ["reachRank", "impressions"],
    primaryMeasure: "impressions",
    selectedDimensions: ["channelId", "eventDate"],
    orderField: "eventDate",
    orderDir: "asc",
    activeTablePreset: {
      id: "tablePreset_reachStyled",
      title: "Reach Grid",
      dimensions: ["channelId", "eventDate"],
      measures: ["reachRank", "impressions"],
      primaryMeasure: "impressions",
      orderField: "eventDate",
      orderDir: "asc",
      pageSize: 25,
      columns: [
        {
          key: "channelId",
          label: "Channel",
          cellVisual: {
            kind: "badge",
            rules: [
              { value: "Display", tone: "info", label: "Display" },
            ],
          },
        },
        {
          key: "impressions",
          label: "Reach",
          format: "compactNumber",
          cellVisual: {
            kind: "dataBar",
            range: { mode: "columnMax" },
            palette: ["#dcfce7", "#16a34a"],
          },
        },
      ],
    },
  },
});

const styledRankPresetFill = buildReportFillFromReportSpec(styledRankPresetSpec, {
  primary: {
    rows: [
      { eventDate: "2026-05-01", channelId: "Display", impressions: 100 },
      { eventDate: "2026-05-02", channelId: "Display", impressions: 140 },
      { eventDate: "2026-05-03", channelId: "CTV", impressions: 140 },
      { eventDate: "2026-05-04", channelId: "CTV", impressions: 90 },
    ],
  },
});

assert.equal(styledRankPresetFill.datasets[0].rows[0].reachRank, 2);
assert.equal(styledRankPresetFill.datasets[0].rows[1].reachRank, 1);
assert.equal(styledRankPresetFill.datasets[0].rows[2].reachRank, 1);
assert.equal(styledRankPresetFill.datasets[0].rows[3].reachRank, 3);
assert.deepEqual(styledRankPresetFill.blocks[0].content.columns[0].cellVisual, {
  kind: "badge",
  rules: [
    {
      value: "Display",
      tone: "info",
      label: "Display",
    },
  ],
});
assert.deepEqual(styledRankPresetFill.blocks[0].content.columns[3].cellVisual, {
  kind: "dataBar",
  range: { mode: "columnMax" },
  palette: ["#dcfce7", "#16a34a"],
});
assert.deepEqual(styledRankPresetFill.blocks[0].content.resolvedRows[0].cells[0], {
  key: "channelId",
  sourceKey: "channelId",
  displayKey: "channelId",
  value: "Display",
  displayValue: "Display",
  visualState: {
    kind: "badge",
    tone: "info",
    label: "Display",
  },
});
assert.deepEqual(styledRankPresetFill.blocks[0].content.resolvedRows[0].cells[3], {
  key: "impressions",
  sourceKey: "impressions",
  displayKey: "impressions",
  value: 100,
  displayValue: 100,
  visualState: {
    kind: "dataBar",
    value: 100,
    percent: 0.2,
    palette: ["#dcfce7", "#16a34a"],
  },
});

const mappedDisplayFill = buildReportFillFromReportSpec({
  version: 1,
  source: {
    containerId: "mappedDisplayRuntime",
    stateKey: "mappedDisplayRuntime",
    dataSourceRef: "demoReportSource",
  },
  datasets: [
    {
      id: "primary",
      dataSourceRef: "demoReportSource",
      request: {},
    },
  ],
  blocks: [
    {
      id: "mappedTable",
      kind: "tableBlock",
      title: "Mapped Table",
      datasetRef: "primary",
      columns: [
        {
          key: "channelId",
          sourceKey: "channelId",
          displayKey: "channelId",
          displayValueMap: {
            "1": "Display",
            "2": "CTV",
          },
          label: "Channel",
        },
      ],
    },
  ],
}, {
  primary: {
    rows: [
      { channelId: 1 },
    ],
  },
});
assert.deepEqual(mappedDisplayFill.blocks[0].content.resolvedRows[0].cells[0], {
  key: "channelId",
  sourceKey: "channelId",
  displayKey: "channelId",
  value: 1,
  displayValue: "Display",
  visualState: null,
});

const mappedKpiFill = buildReportFillFromReportSpec({
  version: 1,
  source: {
    containerId: "mappedKpiRuntime",
    stateKey: "mappedKpiRuntime",
    dataSourceRef: "demoReportSource",
  },
  datasets: [
    {
      id: "primary",
      dataSourceRef: "demoReportSource",
      request: {},
    },
  ],
  blocks: [
    {
      id: "mappedKpi",
      kind: "kpiBlock",
      title: "Mapped KPI",
      datasetRef: "primary",
      valueField: "totalSpend",
      valueLabel: "Spend",
      secondaryField: "channelId",
      secondaryLabel: "Channel",
      secondaryDisplayKey: "channelName",
      secondaryDisplayValueMap: {
        "1": "Display",
        "2": "CTV",
      },
    },
  ],
}, {
  primary: {
    rows: [
      { totalSpend: 12, channelId: 1 },
    ],
  },
});
assert.equal(mappedKpiFill.blocks[0].content.value, 12);
assert.equal(mappedKpiFill.blocks[0].content.secondaryValue, "Display");

const mappedBadgesFill = buildReportFillFromReportSpec({
  version: 1,
  source: {
    containerId: "mappedBadgesRuntime",
    stateKey: "mappedBadgesRuntime",
    dataSourceRef: "demoReportSource",
  },
  datasets: [
    {
      id: "primary",
      dataSourceRef: "demoReportSource",
      request: {},
    },
  ],
  blocks: [
    {
      id: "mappedBadges",
      kind: "badgesBlock",
      title: "Status Pills",
      datasetRef: "primary",
      items: [
        {
          id: "channel",
          label: "Channel",
          valueField: "channelId",
          displayKey: "channelName",
          displayValueMap: {
            "1": "Display",
            "2": "CTV",
          },
          tone: "info",
        },
      ],
    },
  ],
}, {
  primary: {
    rows: [
      { channelId: 1 },
    ],
  },
});
assert.equal(mappedBadgesFill.blocks[0].content.items[0].value, 1);
assert.equal(mappedBadgesFill.blocks[0].content.items[0].displayValue, "Display");

const mappedChartFill = buildReportFillFromReportSpec({
  version: 1,
  source: {
    containerId: "mappedChartRuntime",
    stateKey: "mappedChartRuntime",
    dataSourceRef: "demoReportSource",
  },
  datasets: [
    {
      id: "primary",
      dataSourceRef: "demoReportSource",
      request: {},
    },
  ],
  blocks: [
    {
      id: "mappedChart",
      kind: "chartBlock",
      title: "Mapped Chart",
      datasetRef: "primary",
      chartSpec: {
        title: "Mapped Chart",
        type: "line",
        xField: "eventDate",
        yFields: ["totalSpend"],
        seriesField: "channelId",
      },
      chartModel: {
        type: "line",
        xAxis: {
          dataKey: "eventDate",
        },
        yAxis: {
          format: "currency",
        },
        series: {
          nameKey: "channelName",
          sourceNameKey: "channelId",
          displayValueMap: {
            "1": "Display",
            "2": "CTV",
          },
          valueKey: "totalSpend",
          values: [{
            value: "totalSpend",
            label: "Spend",
            color: "#1f77b4",
            format: "currency",
            type: "line",
          }],
          palette: ["#1f77b4", "#ff7f0e"],
        },
      },
    },
  ],
}, {
  primary: {
    rows: [
      { eventDate: "2026-05-01", channelId: 1, totalSpend: 100 },
      { eventDate: "2026-05-01", channelId: 2, totalSpend: 80 },
    ],
  },
});
assert.deepEqual(mappedChartFill.blocks[0].content.resolvedChart, {
  kind: "groupedSeries",
  type: "line",
  xAxisKey: "eventDate",
  nameKey: "channelName",
  valueKey: "totalSpend",
  rows: [
    {
      eventDate: "2026-05-01",
      Display: 100,
      CTV: 80,
    },
  ],
  seriesKeys: ["Display", "CTV"],
});

const authoredDerivedDocument = buildReportBuilderReportDocument({
  container: rawContainer,
  config: {
    ...rawConfig,
    measures: [
      ...rawConfig.measures,
      { id: "hhUniqs", key: "hhUniqs", label: "HH Uniques", format: "compactNumber" },
    ],
  },
  state: {
    ...rawState,
    selectedMeasures: ["avails"],
    primaryMeasure: "avails",
    selectedDimensions: ["country"],
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
      buildReportDocumentChartBlock({
        id: "reachRateTrend",
        title: "Reach Rate by Market",
        datasetRef: "primary",
        chartSpec: {
          type: "line",
          xField: "country",
          yFields: ["reachRate"],
          seriesField: "channelV2",
        },
      }),
      buildReportDocumentTableBlock({
        id: "reachRateTable",
        title: "Reach Rate Table",
        datasetRef: "primary",
        columns: [
          { key: "country", label: "Market" },
          { key: "channelV2", label: "Channel" },
          { key: "reachRate", label: "Reach Rate", format: "percent" },
        ],
      }),
    ],
    reportDocumentLayout: {
      type: "stack",
      items: [
        { blockId: "primaryBuilder" },
        { blockId: "reachRateTrend" },
        { blockId: "reachRateTable" },
      ],
    },
  },
});
const authoredDerivedSpec = lowerReportDocumentToReportSpec(authoredDerivedDocument);
const authoredDerivedFill = buildReportFillFromReportSpec(authoredDerivedSpec, {
  primary: {
    rows: [
      { country: "US", channelV2: "Display", avails: 82800, hhUniqs: 33800 },
      { country: "US", channelV2: "CTV", avails: 70300, hhUniqs: 30100 },
      { country: "CA", channelV2: "Display", avails: 75800, hhUniqs: 31100 },
      { country: "CA", channelV2: "CTV", avails: 67700, hhUniqs: 28300 },
    ],
  },
});

assert.equal(authoredDerivedFill.calculatedFields.some((field) => field.id === "reachRate" && field.kind === "rowCalc"), true);
assert.equal(authoredDerivedFill.datasets[0].rows[0].reachRate, 40.82);
assert.equal(authoredDerivedFill.datasets[0].rows[1].reachRate, 42.82);
assert.equal(authoredDerivedFill.blocks.find((block) => block.id === "reachRateTable")?.content?.columns?.some((column) => column.key === "reachRate"), true);
assert.equal(authoredDerivedFill.blocks.find((block) => block.id === "reachRateTable")?.content?.resolvedRows?.[0]?.cells?.some((cell) => cell.key === "reachRate" && cell.value === 40.82), true);

const currentSelectionConfig = {
  ...rawConfig,
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
    {
      id: "impressions",
      key: "impressions",
      label: "Impressions",
      paramPath: "measures.impressions",
      format: "compactNumber",
      displayKey: "impressions",
    },
  ],
};

const currentSelectionFieldOptions = buildReportBuilderDocumentBlockFieldOptions({
  config: currentSelectionConfig,
  state: {
    ...rawState,
    selectedDimensions: ["eventDate", "channelId"],
    selectedMeasures: ["totalSpend"],
    primaryMeasure: "totalSpend",
  },
});

const currentSelectionDraft = buildReportBuilderDocumentBlockDraft("tableBlock", {
  id: "currentSelectionTable",
  title: "Current Selection Table",
}, {
  tableColumnOptions: currentSelectionFieldOptions.tableColumnOptions,
});

assert.deepEqual(currentSelectionDraft.columns, [
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
    displayValueMap: {
      display: "Display",
      ctv: "CTV",
    },
    label: "Channel",
  },
  {
    key: "totalSpend",
    sourceKey: "totalSpend",
    displayKey: "totalSpend",
    label: "Spend",
    format: "currency",
  },
]);

const currentSelectionDocument = buildReportBuilderReportDocument({
  container: rawContainer,
  config: currentSelectionConfig,
  state: {
    ...rawState,
    selectedDimensions: ["eventDate", "channelId"],
    selectedMeasures: ["totalSpend"],
    primaryMeasure: "totalSpend",
    reportDocumentBlocks: [currentSelectionDraft],
    reportDocumentLayout: {
      type: "stack",
      items: [
        { blockId: "primaryBuilder" },
        { blockId: "currentSelectionTable" },
      ],
    },
  },
});

const currentSelectionSpec = lowerReportDocumentToReportSpec(currentSelectionDocument);
assert.deepEqual(currentSelectionSpec.blocks.find((block) => block.id === "currentSelectionTable"), {
  id: "currentSelectionTable",
  kind: "tableBlock",
  title: "Current Selection Table",
  datasetRef: "primary",
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
      displayValueMap: {
        display: "Display",
        ctv: "CTV",
      },
      label: "Channel",
      runtimeFilterable: true,
    },
    {
      key: "totalSpend",
      sourceKey: "totalSpend",
      displayKey: "totalSpend",
      label: "Spend",
      format: "currency",
    },
  ],
});

const currentSelectionFill = buildReportFillFromReportSpec(currentSelectionSpec, {
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
  currentSelectionFill.blocks.find((block) => block.id === "currentSelectionTable")?.content?.resolvedRows?.[0]?.cells,
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

const geoDocument = buildReportBuilderReportDocument({
  container: rawContainer,
  config: rawConfig,
  state: rawState,
  additionalBlocks: [
    buildReportDocumentGeoMapBlock({
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
    }),
  ],
});

const geoFill = buildReportFillFromReportSpec(lowerReportDocumentToReportSpec(geoDocument), {
  primary: {
    rows: [
      { stateCode: "CA", stateName: "California", spend: 100, status: "critical" },
      { stateCode: "CA", stateName: "California", spend: 40, status: "critical" },
      { stateCode: "WA", stateName: "Washington", spend: 80, status: "healthy" },
    ],
  },
});

assert.deepEqual(geoFill.blocks[2].content.geo, {
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
});
assert.equal(geoFill.blocks[2].content.rowCount, 3);
assert.deepEqual(geoFill.blocks[2].content.resolvedGeo.summary, {
  regionCount: 2,
  totalValue: "$220",
  topKey: "CA",
});
assert.deepEqual(geoFill.blocks[2].content.resolvedGeo.regions[0], {
  key: "CA",
  label: "California",
  rawValue: 140,
  displayValue: "$140",
  color: "#db3737",
  statusColor: "#db3737",
  statusLabel: "Critical",
  rowCount: 2,
});
assert.deepEqual(geoFill.blocks[2].content.resolvedGeo.regions[1], {
  key: "WA",
  label: "Washington",
  rawValue: 80,
  displayValue: "$80",
  color: "#d9f0ea",
  statusColor: "",
  statusLabel: "",
  rowCount: 1,
});

console.log("reportFillModel ✓ projects ReportSpec and builder state into deterministic ReportFill");

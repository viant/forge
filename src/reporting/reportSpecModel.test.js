import assert from "node:assert/strict";

import { buildReportBuilderReportSpec } from "./reportSpecModel.js";
import { applyReportBuilderSemanticConfig } from "../components/dashboard/reportBuilderSemantic.js";

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
  groupBy: {
    options: [
      { value: "channelId", label: "Channel", dimensionId: "channelId" },
    ],
  },
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
    defaultMode: "table",
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
  request: {
    timeoutMs: 120000,
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
  staticFilters: {
    dateRange: { start: "2026-05-01", end: "2026-05-04" },
  },
};

const rawSpec = buildReportBuilderReportSpec({
  container: {
    id: "performanceBuilder",
    stateKey: "performanceBuilder",
    title: "Performance Report",
    dataSourceRef: "demoReportSource",
  },
  config: rawConfig,
  state: rawState,
});

assert.equal(rawSpec.kind, "reportSpec");
assert.equal(rawSpec.version, 1);
assert.equal(rawSpec.title, "Performance Report");
assert.deepEqual(rawSpec.source, {
  kind: "dashboard.reportBuilder",
  containerId: "performanceBuilder",
  stateKey: "performanceBuilder",
  dataSourceRef: "demoReportSource",
});
assert.deepEqual(rawSpec.parameters, {
  viewMode: "chart",
  groupBy: "channelId",
  pageSize: 25,
  orderField: "totalSpend",
  orderDir: "desc",
});
assert.deepEqual(rawSpec.layoutIntent, {
  kind: "single",
  resultPanePosition: "left",
  blockOrder: ["primaryTable", "primaryChart"],
});
assert.equal(rawSpec.datasets[0].request.measures.totalSpend, true);
assert.equal(rawSpec.datasets[0].request.measures.impressions, true);
assert.equal(rawSpec.datasets[0].request.dimensions.eventDate, true);
assert.equal(rawSpec.datasets[0].request.dimensions.channelId, true);
assert.equal(rawSpec.datasets[0].request.limit, 25);
assert.deepEqual(rawSpec.datasets[0].request.orderBy, ["totalSpend desc"]);
assert.deepEqual(rawSpec.blocks[0].columns.map((column) => column.key), [
  "eventDate",
  "channelId",
  "totalSpend",
  "impressions",
]);
assert.equal(rawSpec.blocks[0].columns[1].runtimeFilterable, true);
assert.equal(rawSpec.blocks[1].chartSpec.title, "Manual Spend Trend");
assert.equal(rawSpec.blocks[1].chartModel.type, "line");
assert.equal(rawSpec.blocks[1].chartModel.series.nameKey, "channelId");
assert.equal(rawSpec.blocks[1].chartModel.series.valueKey, "totalSpend");
assert.equal(rawSpec.drillMetadata, undefined);

const tableOnlySpec = buildReportBuilderReportSpec({
  container: {
    id: "performanceBuilderTable",
    stateKey: "performanceBuilderTable",
    title: "Performance Report",
    dataSourceRef: "demoReportSource",
  },
  config: rawConfig,
  state: {
    ...rawState,
    viewMode: "table",
    chartSpec: null,
  },
});

assert.deepEqual(tableOnlySpec.layoutIntent, {
  kind: "single",
  resultPanePosition: "left",
  blockOrder: ["primaryTable"],
});
assert.deepEqual(
  tableOnlySpec.blocks.map((block) => block.id),
  ["primaryTable"],
);

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
  staticFilters: {
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
  semanticSummary: {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    selectedDimensions: [
      { id: "event_date", rawId: "eventDate", label: "Delivery Date", description: "Daily delivery grain" },
      { id: "channel", rawId: "channelId", label: "Channel" },
    ],
    selectedMeasures: [
      { id: "spend", rawId: "totalSpend", label: "Available Impressions", format: "compactNumber" },
      { id: "impressions", rawId: "impressions", label: "Impressions", format: "compactNumber" },
    ],
    selectedParameters: [
      { id: "reporting_window", rawId: "dateRange", label: "Reporting Window", description: "Approved reporting window" },
    ],
  },
});

assert.deepEqual(semanticSpec.binding, {
  mode: "semantic",
  modelRef: "model://example/performance/delivery@v1",
  entity: "line_delivery",
  selectedDimensions: ["event_date", "channel"],
  selectedMeasures: ["spend", "impressions"],
});
assert.deepEqual(semanticSpec.semanticSummary, {
  kind: "semantic",
  modelRef: "model://example/performance/delivery@v1",
  modelLabel: "Ad Delivery",
  entity: "line_delivery",
  entityLabel: "Line Delivery",
  selectedDimensions: [
    { id: "event_date", rawId: "eventDate", label: "Delivery Date", description: "Daily delivery grain" },
    { id: "channel", rawId: "channelId", label: "Channel" },
  ],
  selectedMeasures: [
    { id: "spend", rawId: "totalSpend", label: "Available Impressions", format: "compactNumber" },
    { id: "impressions", rawId: "impressions", label: "Impressions", format: "compactNumber" },
  ],
  selectedParameters: [
    { id: "reporting_window", rawId: "dateRange", label: "Reporting Window", description: "Approved reporting window" },
  ],
});
assert.deepEqual(semanticSpec.datasets[0].request.semanticSelection, {
  modelRef: "model://example/performance/delivery@v1",
  entity: "line_delivery",
  selection: {
    dimensions: ["event_date", "channel"],
    measures: ["spend", "impressions"],
  },
  refinements: [],
  parameters: {},
});
assert.deepEqual(semanticSpec.blocks[0].columns.map((column) => column.label), [
  "Delivery Date",
  "Channel",
  "Available Impressions",
  "Impressions",
]);
assert.equal(semanticSpec.blocks[1].chartSpec.title, "Semantic Spend by Date");
assert.equal(semanticSpec.blocks[1].chartModel.type, "line");

const drillMetadataSpec = buildReportBuilderReportSpec({
  container: {
    id: "drillMetadataBuilder",
    stateKey: "drillMetadataBuilder",
    title: "Capacity Drill Report",
    dataSourceRef: "demoReportSource",
  },
  config: {
    ...rawConfig,
    drillMetadata: {
      hierarchies: [
        {
          id: "inventory",
          levels: [
            { field: "channelId", label: "Channel" },
            { field: "siteType", label: "Site Type" },
          ],
        },
      ],
      fieldActions: [
        {
          fieldRef: "eventDate",
          actions: [
            { id: "detail_date", label: "Show date details", kind: "detail", targetRef: "target://demo/date-detail" },
          ],
        },
      ],
      detailTargets: [
        {
          targetRef: "target://demo/date-detail",
          navigationMode: "hostRoute",
          parameters: {
            eventDate: "$value",
          },
        },
      ],
    },
  },
  state: rawState,
});

assert.deepEqual(drillMetadataSpec.drillMetadata, {
  hierarchies: [
    {
      id: "inventory",
      levels: [
        { id: "channelId", field: "channelId", label: "Channel" },
        { id: "siteType", field: "siteType", label: "Site Type" },
      ],
    },
  ],
  detailTargets: [
    {
      targetRef: "target://demo/date-detail",
      navigationMode: "hostRoute",
      parameters: {
        eventDate: "$value",
      },
    },
  ],
  fieldActions: [
    {
      fieldRef: "eventDate",
      actions: [
        { id: "detail_date", label: "Show date details", kind: "detail", targetRef: "target://demo/date-detail" },
      ],
    },
  ],
});

const stateBackedDrillMetadataSpec = buildReportBuilderReportSpec({
  container: {
    id: "stateBackedDrillMetadataBuilder",
    stateKey: "stateBackedDrillMetadataBuilder",
    title: "State-backed Drill Report",
    dataSourceRef: "demoReportSource",
  },
  config: {
    ...rawConfig,
    drillMetadata: {
      hierarchies: [
        {
          id: "seeded_inventory",
          levels: [
            { field: "channelId", label: "Channel" },
            { field: "siteType", label: "Site Type" },
          ],
        },
      ],
      detailTargets: [
        {
          targetRef: "target://demo/date-detail",
          navigationMode: "hostRoute",
          parameters: {
            eventDate: "$value",
          },
        },
      ],
    },
  },
  state: {
    ...rawState,
    drillMetadata: {
      hierarchies: [
        {
          id: "hierarchy:eventDate::country",
          label: "Date Drill",
          levels: [
            { field: "eventDate", label: "Date" },
            { field: "country", label: "Market" },
          ],
        },
      ],
      detailTargets: [
        {
          targetRef: "target://demo/state-date-detail",
          navigationMode: "hostRoute",
          parameters: {
            eventDate: "$value",
          },
          title: "Date detail",
        },
      ],
      fieldActions: [
        {
          fieldRef: "eventDate",
          actions: [
            {
              id: "detail:eventDate:target:_demo_state-date-detail",
              label: "Show date details",
              kind: "detail",
              targetRef: "target://demo/state-date-detail",
            },
          ],
        },
      ],
    },
  },
});

assert.deepEqual(stateBackedDrillMetadataSpec.drillMetadata, {
  hierarchies: [
    {
      id: "hierarchy:eventDate::country",
      label: "Date Drill",
      levels: [
        { id: "eventDate", field: "eventDate", label: "Date" },
        { id: "country", field: "country", label: "Market" },
      ],
    },
  ],
  detailTargets: [
    {
      targetRef: "target://demo/state-date-detail",
      navigationMode: "hostRoute",
      title: "Date detail",
      parameters: {
        eventDate: "$value",
      },
    },
  ],
  fieldActions: [
    {
      fieldRef: "eventDate",
      actions: [
        {
          id: "detail:eventDate:target:_demo_state-date-detail",
          label: "Show date details",
          kind: "detail",
          targetRef: "target://demo/state-date-detail",
        },
      ],
    },
  ],
});

const refinedSpec = buildReportBuilderReportSpec({
  container: {
    id: "refinedPerformanceBuilder",
    stateKey: "refinedPerformanceBuilder",
    title: "Refined Performance Report",
    dataSourceRef: "demoReportSource",
  },
  config: rawConfig,
  state: rawState,
  refinements: [
    {
      op: "keep",
      field: "channelId",
      values: ["Display"],
      sourceBlockId: "primaryTable",
    },
  ],
});

assert.deepEqual(refinedSpec.datasets[0].request.refinements, [
  {
    id: "keep:channelId:primaryTable",
    op: "keep",
    field: "channelId",
    values: ["Display"],
    sourceBlockId: "primaryTable",
  },
]);

const computedConfig = {
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
};

const computedState = {
  ...rawState,
  selectedMeasures: ["ctr"],
  primaryMeasure: "ctr",
  chartSpec: {
    title: "CTR by Date",
    type: "line",
    xField: "eventDate",
    yFields: ["ctr"],
  },
};

const computedSpec = buildReportBuilderReportSpec({
  container: {
    id: "computedPerformanceBuilder",
    stateKey: "computedPerformanceBuilder",
    title: "Computed Performance Report",
    dataSourceRef: "demoReportSource",
  },
  config: computedConfig,
  state: computedState,
});

assert.deepEqual(computedSpec.calculatedFields, [
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
assert.equal(computedSpec.datasets[0].request.measures.totalSpend, true);
assert.equal(computedSpec.datasets[0].request.measures.impressions, true);
assert.equal(computedSpec.datasets[0].request.measures.ctr, undefined);
assert.deepEqual(computedSpec.blocks[0].columns.map((column) => column.key), [
  "eventDate",
  "channelId",
  "ctr",
]);
assert.equal(computedSpec.blocks[1].chartSpec.yFields[0], "ctr");

const expressionSpec = buildReportBuilderReportSpec({
  container: {
    id: "expressionBuilder",
    stateKey: "expressionBuilder",
    title: "Expression Performance Report",
    dataSourceRef: "demoReportSource",
  },
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

assert.deepEqual(expressionSpec.calculatedFields, [
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
assert.equal(expressionSpec.datasets[0].request.measures.totalSpend, true);
assert.equal(expressionSpec.datasets[0].request.dimensions.channelId, true);
assert.equal(expressionSpec.datasets[0].request.measures.projectedLift, undefined);
assert.deepEqual(expressionSpec.blocks[0].columns.map((column) => column.key), [
  "eventDate",
  "channelId",
  "projectedLift",
]);
assert.equal(expressionSpec.blocks[1].chartSpec.yFields[0], "projectedLift");

const stateOwnedExpressionSpec = buildReportBuilderReportSpec({
  container: {
    id: "stateOwnedExpressionBuilder",
    stateKey: "stateOwnedExpressionBuilder",
    title: "State Owned Expression Report",
    dataSourceRef: "demoReportSource",
  },
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
});

assert.deepEqual(stateOwnedExpressionSpec.calculatedFields, [
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
assert.equal(stateOwnedExpressionSpec.datasets[0].request.measures.totalSpend, true);
assert.equal(stateOwnedExpressionSpec.datasets[0].request.dimensions.channelId, true);
assert.equal(stateOwnedExpressionSpec.datasets[0].request.measures.projectedLift, undefined);
assert.equal(stateOwnedExpressionSpec.blocks[1].chartSpec.yFields[0], "projectedLift");

const stateOwnedDependentTableCalcSpec = buildReportBuilderReportSpec({
  container: {
    id: "stateOwnedDependentTableCalcBuilder",
    stateKey: "stateOwnedDependentTableCalcBuilder",
    title: "State Owned Dependent Table Calc Report",
    dataSourceRef: "demoReportSource",
  },
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
});

assert.deepEqual(stateOwnedDependentTableCalcSpec.calculatedFields, [
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
assert.equal(stateOwnedDependentTableCalcSpec.datasets[0].request.measures.totalSpend, true);
assert.equal(stateOwnedDependentTableCalcSpec.datasets[0].request.dimensions.channelId, true);
assert.equal(stateOwnedDependentTableCalcSpec.datasets[0].request.measures.projectedLift, undefined);
assert.equal(stateOwnedDependentTableCalcSpec.datasets[0].request.measures.runningProjectedLift, undefined);
assert.deepEqual(stateOwnedDependentTableCalcSpec.blocks[0].columns.map((column) => column.key), [
  "eventDate",
  "channelId",
  "runningProjectedLift",
]);

const stateOwnedTableCalcSpec = buildReportBuilderReportSpec({
  container: {
    id: "stateOwnedTableCalcBuilder",
    stateKey: "stateOwnedTableCalcBuilder",
    title: "State Owned Table Calc Report",
    dataSourceRef: "demoReportSource",
  },
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
});

assert.deepEqual(stateOwnedTableCalcSpec.calculatedFields, [
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
assert.equal(stateOwnedTableCalcSpec.datasets[0].request.measures.impressions, true);
assert.equal(stateOwnedTableCalcSpec.datasets[0].request.dimensions.channelId, true);
assert.equal(stateOwnedTableCalcSpec.datasets[0].request.measures.reachShare, undefined);
assert.equal(stateOwnedTableCalcSpec.blocks[1].chartSpec.yFields[0], "reachShare");

const tableCalcSpec = buildReportBuilderReportSpec({
  container: {
    id: "tableCalcBuilder",
    stateKey: "tableCalcBuilder",
    title: "Reach Share Report",
    dataSourceRef: "demoReportSource",
  },
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

assert.deepEqual(tableCalcSpec.calculatedFields, [
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
assert.equal(tableCalcSpec.datasets[0].request.measures.impressions, true);
assert.equal(tableCalcSpec.datasets[0].request.dimensions.channelId, true);
assert.deepEqual(tableCalcSpec.blocks[0].columns.map((column) => column.key), [
  "eventDate",
  "reachShare",
]);

const deltaTableCalcSpec = buildReportBuilderReportSpec({
  container: {
    id: "deltaTableCalcBuilder",
    stateKey: "deltaTableCalcBuilder",
    title: "Spend Delta Report",
    dataSourceRef: "demoReportSource",
  },
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

assert.deepEqual(deltaTableCalcSpec.calculatedFields, [
  {
    id: "spendDelta",
    key: "spendDelta",
    kind: "tableCalc",
    label: "Spend Delta",
    dataType: "number",
    format: "number",
    datasetRef: "primary",
    dependencies: ["totalSpend", "eventDate", "channelId"],
    compute: {
      type: "deltaFromPrevious",
      sourceField: "totalSpend",
      partitionBy: ["channelId"],
      orderBy: [
        { field: "eventDate", direction: "asc" },
      ],
    },
  },
]);
assert.equal(deltaTableCalcSpec.datasets[0].request.measures.totalSpend, true);
assert.equal(deltaTableCalcSpec.datasets[0].request.dimensions.channelId, true);
assert.deepEqual(deltaTableCalcSpec.blocks[0].columns.map((column) => column.key), [
  "eventDate",
  "spendDelta",
]);

const runningTableCalcSpec = buildReportBuilderReportSpec({
  container: {
    id: "runningTableCalcBuilder",
    stateKey: "runningTableCalcBuilder",
    title: "Running Spend Report",
    dataSourceRef: "demoReportSource",
  },
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

assert.deepEqual(runningTableCalcSpec.calculatedFields, [
  {
    id: "runningSpend",
    key: "runningSpend",
    kind: "tableCalc",
    label: "Running Spend",
    dataType: "number",
    format: "number",
    datasetRef: "primary",
    dependencies: ["totalSpend", "eventDate", "channelId"],
    compute: {
      type: "runningTotal",
      sourceField: "totalSpend",
      partitionBy: ["channelId"],
      orderBy: [
        { field: "eventDate", direction: "asc" },
      ],
    },
  },
]);
assert.equal(runningTableCalcSpec.datasets[0].request.measures.totalSpend, true);
assert.equal(runningTableCalcSpec.datasets[0].request.dimensions.channelId, true);
assert.deepEqual(runningTableCalcSpec.blocks[0].columns.map((column) => column.key), [
  "eventDate",
  "runningSpend",
]);

const movingAverageTableCalcSpec = buildReportBuilderReportSpec({
  container: {
    id: "movingAverageTableCalcBuilder",
    stateKey: "movingAverageTableCalcBuilder",
    title: "Average Spend Report",
    dataSourceRef: "demoReportSource",
  },
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

assert.deepEqual(movingAverageTableCalcSpec.calculatedFields, [
  {
    id: "avgSpend",
    key: "avgSpend",
    kind: "tableCalc",
    label: "Avg Spend",
    dataType: "number",
    format: "number",
    datasetRef: "primary",
    dependencies: ["totalSpend", "eventDate", "channelId"],
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
]);
assert.equal(movingAverageTableCalcSpec.datasets[0].request.measures.totalSpend, true);
assert.equal(movingAverageTableCalcSpec.datasets[0].request.dimensions.channelId, true);
assert.deepEqual(movingAverageTableCalcSpec.blocks[0].columns.map((column) => column.key), [
  "eventDate",
  "avgSpend",
]);

const rankTableCalcSpec = buildReportBuilderReportSpec({
  container: {
    id: "rankTableCalcBuilder",
    stateKey: "rankTableCalcBuilder",
    title: "Spend Rank Report",
    dataSourceRef: "demoReportSource",
  },
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

assert.deepEqual(rankTableCalcSpec.calculatedFields, [
  {
    id: "spendRank",
    key: "spendRank",
    kind: "tableCalc",
    label: "Spend Rank",
    dataType: "number",
    format: "number",
    datasetRef: "primary",
    dependencies: ["totalSpend", "eventDate", "channelId"],
    compute: {
      type: "rank",
      sourceField: "totalSpend",
      partitionBy: ["channelId"],
      orderBy: [
        { field: "totalSpend", direction: "desc" },
        { field: "eventDate", direction: "asc" },
      ],
      tieMode: "dense",
    },
  },
]);
assert.equal(rankTableCalcSpec.datasets[0].request.measures.totalSpend, true);
assert.equal(rankTableCalcSpec.datasets[0].request.dimensions.channelId, true);
assert.deepEqual(rankTableCalcSpec.blocks[0].columns.map((column) => column.key), [
  "eventDate",
  "spendRank",
]);

const styledRankPresetSpec = buildReportBuilderReportSpec({
  container: {
    id: "styledRankPresetBuilder",
    stateKey: "styledRankPresetBuilder",
    title: "Styled Reach Grid",
    dataSourceRef: "demoReportSource",
  },
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

assert.deepEqual(styledRankPresetSpec.blocks[0].columns, [
  {
    key: "channelId",
    sourceKey: "channelId",
    displayKey: "channelId",
    label: "Channel",
    kind: "dimension",
    runtimeFilterable: true,
    cellVisual: {
      kind: "badge",
      rules: [
        { value: "Display", tone: "info", label: "Display" },
      ],
    },
  },
  {
    key: "eventDate",
    sourceKey: "eventDate",
    displayKey: "eventDate",
    label: "Date",
    kind: "dimension",
    format: "date",
  },
  {
    key: "reachRank",
    sourceKey: "reachRank",
    displayKey: "reachRank",
    label: "Reach Rank",
    kind: "measure",
    format: "number",
    align: "right",
  },
  {
    key: "impressions",
    sourceKey: "impressions",
    displayKey: "impressions",
    label: "Reach",
    kind: "measure",
    format: "compactNumber",
    align: "right",
    cellVisual: {
      kind: "dataBar",
      range: { mode: "columnMax" },
      palette: ["#dcfce7", "#16a34a"],
    },
  },
]);
assert.deepEqual(styledRankPresetSpec.calculatedFields, [
  {
    id: "reachRank",
    key: "reachRank",
    kind: "tableCalc",
    label: "Reach Rank",
    dataType: "number",
    format: "number",
    datasetRef: "primary",
    dependencies: ["impressions", "channelId", "eventDate"],
    compute: {
      type: "rank",
      sourceField: "impressions",
      orderBy: [
        { field: "impressions", direction: "desc" },
        { field: "channelId", direction: "asc" },
        { field: "eventDate", direction: "asc" },
      ],
      tieMode: "dense",
    },
  },
]);

console.log("reportSpecModel ✓ projects raw and semantic report builder state into ReportSpec");

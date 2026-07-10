import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildDraftReportExportRequest,
  buildPublishedSnapshotReportExportRequest,
  buildSavedReportExportRequest,
  buildSavedViewReportExportRequest,
} from "../reportExportRequestModel.js";
import { buildReportBuilderReportSpec } from "../reportSpecModel.js";
import { buildReportFillFromReportSpec } from "../reportFillModel.js";
import { buildReportPrintFromReportFill } from "../reportPrintModel.js";
import { validateReportExportRequest, validateReportFill, validateReportPrint, validateReportSpec } from "./reportSchemas.js";
import { buildAuthoredDerivedCompactArtifacts } from "../fixtures/authoredDerivedCompactArtifactBuilder.js";

const fixtureUrl = new URL("../fixtures/performance-report-fixtures.v1.json", import.meta.url);
const fixtures = JSON.parse(readFileSync(fixtureUrl, "utf8"));
const printFixtureUrl = new URL("../fixtures/performance-report-print-fixtures.v1.json", import.meta.url);
const printFixtures = JSON.parse(readFileSync(printFixtureUrl, "utf8"));

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
      type: "dateRange",
      required: true,
      startParamPath: "filters.From",
      endParamPath: "filters.To",
      default: { start: "2026-05-01", end: "2026-05-04" },
    },
  ],
  result: {
    defaultMode: "chart",
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

const reportSpec = buildReportBuilderReportSpec({
  container: {
    id: "performanceBuilder",
    stateKey: "performanceBuilder",
    title: "Performance Report",
    dataSourceRef: "demoReportSource",
  },
  config,
  state,
});

const reportFill = buildReportFillFromReportSpec(reportSpec, {
  primary: {
    rows: [
      { eventDate: "2026-05-01", channelId: "Display", totalSpend: 40400, impressions: 16500 },
      { eventDate: "2026-05-01", channelId: "CTV", totalSpend: 34300, impressions: 14700 },
    ],
  },
});
const reportPrint = buildReportPrintFromReportFill({
  reportSpec,
  reportFill,
});

assert.deepEqual(validateReportSpec(reportSpec), {
  valid: true,
  errors: [],
});
assert.deepEqual(validateReportSpec({
  ...reportSpec,
  scope: {
    ...reportSpec.scope,
    contextPreset: {
      id: "performance_order",
      paramIds: ["dateRange"],
    },
  },
}), {
  valid: true,
  errors: [],
});
assert.deepEqual(validateReportSpec({
  ...reportSpec,
  datasets: reportSpec.datasets.map((dataset) => (
    dataset.id === "primary"
      ? {
        ...dataset,
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
      }
      : dataset
  )),
}), {
  valid: true,
  errors: [],
});
assert.deepEqual(validateReportSpec({
  ...reportSpec,
  datasets: reportSpec.datasets.map((dataset) => (
    dataset.id === "primary"
      ? {
        ...dataset,
        scope: {
          mode: "exclude",
          local: {
            grain: "day",
          },
          exclude: ["audienceIds"],
        },
      }
      : dataset
  )),
}), {
  valid: true,
  errors: [],
});

const semanticSummarySpec = {
  ...reportSpec,
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
        label: "Event Date",
        category: "Time",
        definitionRef: "semantic://example/event_date",
      },
    ],
    selectedMeasures: [
      {
        id: "total_spend",
        rawId: "totalSpend",
        label: "Total Spend",
        format: "currency",
        category: "Metrics",
        definitionRef: "semantic://example/total_spend",
        governance: {
          status: "approved",
          certification: "certified",
        },
      },
    ],
    selectedParameters: [
      {
        id: "reporting_window",
        rawId: "dateRange",
        label: "Reporting Window",
        category: "Scope",
        definitionRef: "semantic://example/reporting_window",
      },
    ],
  },
};
assert.deepEqual(validateReportSpec(semanticSummarySpec), {
  valid: true,
  errors: [],
});

const invalidCalculatedFieldKindSpec = {
  ...reportSpec,
  calculatedFields: [
    {
      id: "rankSpend",
      key: "rankSpend",
      kind: "rowCalc",
      label: "Rank Spend",
      dataType: "number",
      dependencies: ["totalSpend"],
      compute: {
        type: "rank",
        sourceField: "totalSpend",
        orderBy: [
          { field: "totalSpend", direction: "desc" },
        ],
        tieMode: "dense",
      },
    },
  ],
};
assert.deepEqual(validateReportSpec(invalidCalculatedFieldKindSpec), {
  valid: false,
  errors: [
    {
      path: "$.calculatedFields[0].kind",
      code: "invalid",
      message: "Calculated field kind 'rowCalc' does not match normalized kind 'tableCalc'.",
    },
  ],
});

const invalidCalculatedFieldDatasetRefSpec = {
  ...reportSpec,
  calculatedFields: [
    {
      id: "projectedLift",
      key: "projectedLift",
      kind: "rowCalc",
      label: "Projected Lift",
      dataType: "number",
      datasetRef: "secondary",
      dependencies: ["totalSpend"],
      expr: "totalSpend + 1",
    },
  ],
};
assert.deepEqual(validateReportSpec(invalidCalculatedFieldDatasetRefSpec), {
  valid: false,
  errors: [
    {
      path: "$.calculatedFields[0].datasetRef",
      code: "unknownDatasetRef",
      message: "Unknown datasetRef 'secondary'.",
    },
  ],
});

const invalidCalculatedFieldExpressionSpec = {
  ...reportSpec,
  calculatedFields: [
    {
      id: "badExpression",
      key: "badExpression",
      kind: "rowCalc",
      label: "Bad Expression",
      dataType: "number",
      dependencies: [],
      expr: "foo(totalSpend)",
    },
  ],
};
assert.deepEqual(validateReportSpec(invalidCalculatedFieldExpressionSpec), {
  valid: false,
  errors: [
    {
      path: "$.calculatedFields[0].expr",
      code: "invalidSyntax",
      message: "Invalid calculated field expression at 0: unsupported function \"foo\"",
    },
  ],
});

const invalidTableCalculationComputeSpec = {
  ...reportSpec,
  calculatedFields: [
    {
      id: "badRank",
      key: "badRank",
      kind: "tableCalc",
      label: "Bad Rank",
      dataType: "number",
      dependencies: [],
      compute: {
        type: "rank",
        sourceField: "totalSpend",
        orderBy: [
          { field: "otherField", direction: "desc" },
        ],
        tieMode: "dense",
      },
    },
  ],
};
assert.deepEqual(validateReportSpec(invalidTableCalculationComputeSpec), {
  valid: false,
  errors: [
    {
      path: "$.calculatedFields[0].compute.orderBy[0].field",
      code: "invalid",
      message: "Rank table calculations must order first by their sourceField.",
    },
  ],
});

const invalidTableCalculationTieModeSpec = {
  ...reportSpec,
  calculatedFields: [
    {
      id: "badTieMode",
      key: "badTieMode",
      kind: "tableCalc",
      label: "Bad Tie Mode",
      dataType: "number",
      dependencies: [],
      compute: {
        type: "rank",
        sourceField: "totalSpend",
        orderBy: [
          { field: "totalSpend", direction: "desc" },
        ],
        tieMode: "sparse",
      },
    },
  ],
};
assert.deepEqual(validateReportSpec(invalidTableCalculationTieModeSpec), {
  valid: false,
  errors: [
    {
      path: "$.calculatedFields[0].compute.tieMode",
      code: "invalid",
      message: "Unsupported rank tieMode 'sparse'.",
    },
  ],
});

const invalidMovingAverageWindowSpec = {
  ...reportSpec,
  calculatedFields: [
    {
      id: "badMovingAverage",
      key: "badMovingAverage",
      kind: "tableCalc",
      label: "Bad Moving Average",
      dataType: "number",
      dependencies: [],
      compute: {
        type: "movingAverage",
        sourceField: "totalSpend",
        orderBy: [
          { field: "eventDate", direction: "asc" },
        ],
        windowSize: 0,
      },
    },
  ],
};
assert.deepEqual(validateReportSpec(invalidMovingAverageWindowSpec), {
  valid: false,
  errors: [
    {
      path: "$.calculatedFields[0].compute.windowSize",
      code: "invalid",
      message: "Moving average windowSize must be a positive integer.",
    },
  ],
});

const invalidRunningTotalOrderSpec = {
  ...reportSpec,
  calculatedFields: [
    {
      id: "badRunningTotal",
      key: "badRunningTotal",
      kind: "tableCalc",
      label: "Bad Running Total",
      dataType: "number",
      dependencies: [],
      compute: {
        type: "runningTotal",
        sourceField: "totalSpend",
        orderBy: [],
      },
    },
  ],
};
assert.deepEqual(validateReportSpec(invalidRunningTotalOrderSpec), {
  valid: false,
  errors: [
    {
      path: "$.calculatedFields[0].compute.orderBy",
      code: "required",
      message: "runningTotal table calculations require at least one orderBy entry.",
    },
  ],
});

const invalidMovingAverageOrderSpec = {
  ...reportSpec,
  calculatedFields: [
    {
      id: "badMovingAverageOrder",
      key: "badMovingAverageOrder",
      kind: "tableCalc",
      label: "Bad Moving Average Order",
      dataType: "number",
      dependencies: [],
      compute: {
        type: "movingAverage",
        sourceField: "totalSpend",
        orderBy: [],
        windowSize: 3,
      },
    },
  ],
};
assert.deepEqual(validateReportSpec(invalidMovingAverageOrderSpec), {
  valid: false,
  errors: [
    {
      path: "$.calculatedFields[0].compute.orderBy",
      code: "required",
      message: "movingAverage table calculations require at least one orderBy entry.",
    },
  ],
});

const invalidPercentOfTotalSourceSpec = {
  ...reportSpec,
  calculatedFields: [
    {
      id: "badPercentOfTotal",
      key: "badPercentOfTotal",
      kind: "tableCalc",
      label: "Bad Percent Of Total",
      dataType: "number",
      dependencies: [],
      compute: {
        type: "percentOfTotal",
      },
    },
  ],
};
assert.deepEqual(validateReportSpec(invalidPercentOfTotalSourceSpec), {
  valid: false,
  errors: [
    {
      path: "$.calculatedFields[0].compute.sourceField",
      code: "required",
      message: "Percent-of-total table calculations require a sourceField.",
    },
  ],
});

assert.deepEqual(validateReportFill(reportFill), {
  valid: true,
  errors: [],
});
assert.deepEqual(validateReportFill({
  ...reportFill,
  datasets: reportFill.datasets.map((dataset, index) => (
    index === 0
      ? {
        ...dataset,
        scope: {
          inheritContext: true,
        },
        source: {
          kind: "mcp",
          toolName: "demo:forecast_summary",
        },
        resultContract: {
          shape: "rowSet",
          rowPath: "payload.records",
        },
        capabilities: {
          backendRefetch: true,
          datly: {
            unifiedCube: true,
          },
        },
      }
      : dataset
  )),
}), {
  valid: true,
  errors: [],
});
assert.deepEqual(validateReportPrint(printFixtures.raw.reportPrint), {
  valid: true,
  errors: [],
});
assert.deepEqual(validateReportPrint(printFixtures.authored.reportPrint), {
  valid: true,
  errors: [],
});

const exportRequest = buildDraftReportExportRequest({
  reportDocument: {
    id: "performanceReport",
    title: "Performance Report",
  },
  reportSpec,
  reportFill,
  reportPrint,
  format: "pdf",
});
assert.deepEqual(validateReportExportRequest(exportRequest), {
  valid: true,
  errors: [],
});

const savedPayloadExportRequest = buildSavedReportExportRequest({
  savedReportPayload: {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_performance_snapshot",
    sourceArtifactId: "performance_snapshot",
    title: "Performance Snapshot",
    reportDocument: {
      version: 1,
      kind: "reportDocument",
      id: "performanceSnapshot",
      title: "Performance Snapshot",
    },
    reportSpec,
  },
  reportFill,
  reportPrint,
  documentVersion: 7,
  format: "pdf",
});
assert.deepEqual(validateReportExportRequest(savedPayloadExportRequest), {
  valid: true,
  errors: [],
});

const savedViewExportRequest = buildSavedViewReportExportRequest({
  savedView: {
    id: "saved_view_capacity_q3",
    kind: "reportBuilder.savedView",
    title: "Capacity Q3 Saved View",
    reportId: "capacityQ3",
  },
  reportSpec,
  reportFill,
  reportPrint,
  documentVersion: 8,
  format: "pdf",
});
assert.deepEqual(validateReportExportRequest(savedViewExportRequest), {
  valid: true,
  errors: [],
});

const publishedSnapshotExportRequest = buildPublishedSnapshotReportExportRequest({
  publishedSnapshot: {
    id: "published_snapshot_capacity_q3",
    kind: "reportBuilder.publishedSnapshot",
    title: "Capacity Q3 Published Snapshot",
    reportId: "capacityQ3",
  },
  reportSpec,
  reportFill,
  reportPrint,
  documentVersion: 9,
  format: "pdf",
});
assert.deepEqual(validateReportExportRequest(publishedSnapshotExportRequest), {
  valid: true,
  errors: [],
});

const invalidSavedViewSourceContract = JSON.parse(JSON.stringify(savedViewExportRequest));
delete invalidSavedViewSourceContract.source.sourceArtifactId;
delete invalidSavedViewSourceContract.source.documentVersion;
invalidSavedViewSourceContract.source.artifactKind = "reportBuilder.savedReportPayload";
assert.deepEqual(validateReportExportRequest(invalidSavedViewSourceContract), {
  valid: false,
  errors: [
    {
      path: "$.source.artifactKind",
      code: "invalidContract",
      message: "Export source 'savedView' must use artifactKind 'reportBuilder.savedView'.",
    },
    {
      path: "$.source.sourceArtifactId",
      code: "required",
      message: "Saved view export sources require a sourceArtifactId.",
    },
    {
      path: "$.source.documentVersion",
      code: "required",
      message: "Saved view export sources require a documentVersion.",
    },
  ],
});

const invalidPublishedSnapshotSourceContract = JSON.parse(JSON.stringify(publishedSnapshotExportRequest));
delete invalidPublishedSnapshotSourceContract.source.reportId;
invalidPublishedSnapshotSourceContract.source.artifactKind = "reportBuilder.savedView";
assert.deepEqual(validateReportExportRequest(invalidPublishedSnapshotSourceContract), {
  valid: false,
  errors: [
    {
      path: "$.source.artifactKind",
      code: "invalidContract",
      message: "Export source 'publishedSnapshot' must use artifactKind 'reportBuilder.publishedSnapshot'.",
    },
    {
      path: "$.source.reportId",
      code: "required",
      message: "Published snapshot export sources require a reportId.",
    },
  ],
});

const invalidExportRequestFillConformance = JSON.parse(JSON.stringify(exportRequest));
invalidExportRequestFillConformance.reportFill.specVersion = 99;
invalidExportRequestFillConformance.reportFill.specHash = "fnv1a:deadbeef";
invalidExportRequestFillConformance.reportFill.source.stateKey = "otherBuilder";
assert.deepEqual(validateReportExportRequest(invalidExportRequestFillConformance), {
  valid: false,
  errors: [
    {
      path: "$.reportFill.specVersion",
      code: "invalidContract",
      message: "ReportFill specVersion must match reportSpec.version.",
    },
    {
      path: "$.reportFill.specHash",
      code: "invalidContract",
      message: "ReportFill specHash must match reportSpec.",
    },
    {
      path: "$.reportFill.source",
      code: "invalidContract",
      message: "ReportFill source must match reportSpec.source.",
    },
    {
      path: "$.reportPrint.fillHash",
      code: "invalidContract",
      message: "ReportPrint fillHash must match reportFill.",
    },
  ],
});

const invalidExportRequestPrintConformance = JSON.parse(JSON.stringify(exportRequest));
invalidExportRequestPrintConformance.reportPrint.specVersion = 2;
invalidExportRequestPrintConformance.reportPrint.specHash = "fnv1a:deadbeef";
invalidExportRequestPrintConformance.reportPrint.fillVersion = 2;
invalidExportRequestPrintConformance.reportPrint.fillHash = "fnv1a:feedface";
invalidExportRequestPrintConformance.reportPrint.source.stateKey = "otherBuilder";
assert.deepEqual(validateReportExportRequest(invalidExportRequestPrintConformance), {
  valid: false,
  errors: [
    {
      path: "$.reportPrint.specVersion",
      code: "invalidContract",
      message: "ReportPrint specVersion must match reportSpec.version.",
    },
    {
      path: "$.reportPrint.specHash",
      code: "invalidContract",
      message: "ReportPrint specHash must match reportSpec.",
    },
    {
      path: "$.reportPrint.fillVersion",
      code: "invalidContract",
      message: "ReportPrint fillVersion must match reportFill.version.",
    },
    {
      path: "$.reportPrint.fillHash",
      code: "invalidContract",
      message: "ReportPrint fillHash must match reportFill.",
    },
    {
      path: "$.reportPrint.source",
      code: "invalidContract",
      message: "ReportPrint source must match reportSpec.source.",
    },
  ],
});

const kpiSpec = {
  ...reportSpec,
  layoutIntent: {
    ...reportSpec.layoutIntent,
    blockOrder: [...reportSpec.layoutIntent.blockOrder, "headlineKpi"],
  },
  blocks: [
    ...reportSpec.blocks,
    {
      id: "headlineKpi",
      kind: "kpiBlock",
      title: "Headline KPI",
      datasetRef: "primary",
      valueField: "totalSpend",
      valueLabel: "Spend",
      secondaryField: "channelId",
      secondaryLabel: "Channel",
      description: "Summarizes the first authored runtime row.",
      emptyLabel: "No headline KPI value available.",
    },
  ],
};
assert.deepEqual(validateReportSpec(kpiSpec), {
  valid: true,
  errors: [],
});

const authoredLayoutSpec = {
  ...kpiSpec,
  layoutIntent: {
    ...kpiSpec.layoutIntent,
    items: [
      { blockId: "primaryTable" },
      { blockId: "primaryChart" },
      { blockId: "headlineKpi", size: "half" },
    ],
  },
};
assert.deepEqual(validateReportSpec(authoredLayoutSpec), {
  valid: true,
  errors: [],
});

const spanAuthoredLayoutSpec = {
  ...kpiSpec,
  layoutIntent: {
    ...kpiSpec.layoutIntent,
    items: [
      { blockId: "primaryTable" },
      { blockId: "primaryChart" },
      { blockId: "headlineKpi", span: 8 },
    ],
  },
};
assert.deepEqual(validateReportSpec(spanAuthoredLayoutSpec), {
  valid: true,
  errors: [],
});

const authoredDetailTargetSpec = {
  ...authoredLayoutSpec,
  drillMetadata: {
    hierarchies: [],
    detailTargets: [
      {
        targetRef: "target://demo/date-detail-modal",
        navigationMode: "modal",
        title: "Date detail",
        description: "Open the selected date detail in a modal.",
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
            id: "detail:eventDate:target:_demo_date-detail-modal",
            label: "Show date details",
            kind: "detail",
            targetRef: "target://demo/date-detail-modal",
          },
        ],
      },
    ],
  },
};
assert.deepEqual(validateReportSpec(authoredDetailTargetSpec), {
  valid: true,
  errors: [],
});

const kpiFill = buildReportFillFromReportSpec(kpiSpec, {
  primary: {
    rows: [
      { eventDate: "2026-05-01", channelId: "Display", totalSpend: 40400, impressions: 16500 },
    ],
  },
});
assert.deepEqual(validateReportFill(kpiFill), {
  valid: true,
  errors: [],
});

const {
  reportSpec: authoredDerivedSpec,
  reportFill: authoredDerivedFill,
  reportPrint: authoredDerivedPrint,
} = buildAuthoredDerivedCompactArtifacts({
  title: "Derived Performance Report",
  container: {
    id: "derivedPerformanceBuilder",
    stateKey: "derivedPerformanceBuilder",
    title: "Derived Performance Report",
    dataSourceRef: "demoReportSource",
  },
  xDimension: {
    id: "channelId",
    label: "Channel",
    paramPath: "dimensions.channelId",
  },
  seriesDimension: null,
  chart: {
    title: "Reach Rate by Channel",
  },
  rows: [
    { channelId: "Display", totalSpend: 100, hhUniqs: 25 },
    { channelId: "CTV", totalSpend: 200, hhUniqs: 90 },
  ],
});

assert.deepEqual(validateReportSpec(authoredDerivedSpec), {
  valid: true,
  errors: [],
});
assert.deepEqual(validateReportFill(authoredDerivedFill), {
  valid: true,
  errors: [],
});
assert.deepEqual(validateReportPrint(authoredDerivedPrint), {
  valid: true,
  errors: [],
});
assert.deepEqual(validateReportExportRequest(buildDraftReportExportRequest({
  reportDocument: {
    id: "derivedPerformanceReport",
    title: "Derived Performance Report",
  },
  reportSpec: authoredDerivedSpec,
  reportFill: authoredDerivedFill,
  reportPrint: authoredDerivedPrint,
  format: "pdf",
})), {
  valid: true,
  errors: [],
});

const invalidSpec = {
  ...reportSpec,
  unexpected: true,
};
const invalidSpecValidation = validateReportSpec(invalidSpec);
assert.equal(invalidSpecValidation.valid, false);
assert.deepEqual(invalidSpecValidation.errors, [
  {
    path: "$.unexpected",
    code: "additionalProperties",
    message: "Unexpected property.",
  },
]);

const invalidSpecRequest = {
  ...reportSpec,
  datasets: [
    {
      ...reportSpec.datasets[0],
      request: {
        ...reportSpec.datasets[0].request,
        rogue: true,
      },
    },
  ],
};
const invalidSpecRequestValidation = validateReportSpec(invalidSpecRequest);
assert.equal(invalidSpecRequestValidation.valid, false);
assert.deepEqual(invalidSpecRequestValidation.errors, [
  {
    path: "$.datasets[0].request.rogue",
    code: "additionalProperties",
    message: "Unexpected property.",
  },
]);

const invalidSpecRequestFilterValue = {
  ...reportSpec,
  datasets: [
    {
      ...reportSpec.datasets[0],
      request: {
        ...reportSpec.datasets[0].request,
        filters: {
          ...reportSpec.datasets[0].request.filters,
          unsupported: () => "nope",
        },
      },
    },
  ],
};
const invalidSpecRequestFilterValueValidation = validateReportSpec(invalidSpecRequestFilterValue);
assert.equal(invalidSpecRequestFilterValueValidation.valid, false);
assert.deepEqual(invalidSpecRequestFilterValueValidation.errors, [
  {
    path: "$.datasets[0].request.filters.unsupported",
    code: "type",
    message: "Expected string.",
  },
]);

const invalidSpecRefinementValue = {
  ...reportSpec,
  refinements: [
    {
      id: "keep:channelId:primaryTable",
      op: "keep",
      field: "channelId",
      values: [() => "nope"],
    },
  ],
};
const invalidSpecRefinementValueValidation = validateReportSpec(invalidSpecRefinementValue);
assert.equal(invalidSpecRefinementValueValidation.valid, false);
assert.deepEqual(invalidSpecRefinementValueValidation.errors, [
  {
    path: "$.refinements[0].values[0]",
    code: "type",
    message: "Expected string.",
  },
]);

const invalidSpecCellVisual = {
  ...reportSpec,
  blocks: [
    {
      ...reportSpec.blocks[0],
      columns: [
        {
          ...reportSpec.blocks[0].columns[0],
          cellVisual: {
            kind: "dataBar",
            rogue: true,
          },
        },
        ...reportSpec.blocks[0].columns.slice(1),
      ],
    },
    reportSpec.blocks[1],
  ],
};
const invalidSpecCellVisualValidation = validateReportSpec(invalidSpecCellVisual);
assert.equal(invalidSpecCellVisualValidation.valid, false);
assert.deepEqual(invalidSpecCellVisualValidation.errors, [
  {
    path: "$.blocks[0].columns[0].cellVisual.rogue",
    code: "additionalProperties",
    message: "Unexpected property.",
  },
]);

const invalidFill = {
  ...reportFill,
  datasets: [
    {
      ...reportFill.datasets[0],
      provenance: {
        ...reportFill.datasets[0].provenance,
        rogue: "bad",
      },
    },
  ],
};
const invalidFillValidation = validateReportFill(invalidFill);
assert.equal(invalidFillValidation.valid, false);
assert.deepEqual(invalidFillValidation.errors, [
  {
    path: "$.datasets[0].provenance.rogue",
    code: "additionalProperties",
    message: "Unexpected property.",
  },
]);

const invalidFillDatasetRowValue = {
  ...reportFill,
  datasets: [
    {
      ...reportFill.datasets[0],
      rows: [
        {
          ...reportFill.datasets[0].rows[0],
          rogue: () => "nope",
        },
        ...reportFill.datasets[0].rows.slice(1),
      ],
    },
  ],
};
const invalidFillDatasetRowValueValidation = validateReportFill(invalidFillDatasetRowValue);
assert.equal(invalidFillDatasetRowValueValidation.valid, false);
assert.deepEqual(invalidFillDatasetRowValueValidation.errors, [
  {
    path: "$.datasets[0].rows[0].rogue",
    code: "type",
    message: "Expected string.",
  },
]);

const invalidFillCellVisual = {
  ...reportFill,
  blocks: [
    {
      ...reportFill.blocks[0],
      content: {
        ...reportFill.blocks[0].content,
        columns: [
          {
            ...reportFill.blocks[0].content.columns[0],
            cellVisual: {
              kind: "badge",
              rogue: true,
            },
          },
          ...reportFill.blocks[0].content.columns.slice(1),
        ],
      },
    },
    reportFill.blocks[1],
  ],
};
const invalidFillCellVisualValidation = validateReportFill(invalidFillCellVisual);
assert.equal(invalidFillCellVisualValidation.valid, false);
assert.deepEqual(invalidFillCellVisualValidation.errors, [
  {
    path: "$.blocks[0].content.columns[0].cellVisual.rogue",
    code: "additionalProperties",
    message: "Unexpected property.",
  },
]);

const invalidFillChartModel = {
  ...reportFill,
  blocks: [
    reportFill.blocks[0],
    {
      ...reportFill.blocks[1],
      content: {
        ...reportFill.blocks[1].content,
        chartModel: {
          ...reportFill.blocks[1].content.chartModel,
          rogueSeriesFlag: true,
        },
      },
    },
  ],
};
const invalidFillChartModelValidation = validateReportFill(invalidFillChartModel);
assert.equal(invalidFillChartModelValidation.valid, false);
assert.deepEqual(invalidFillChartModelValidation.errors, [
  {
    path: "$.blocks[1].content.chartModel.rogueSeriesFlag",
    code: "additionalProperties",
    message: "Unexpected property.",
  },
]);

const invalidFillResolvedChartRowValue = {
  ...reportFill,
  blocks: [
    reportFill.blocks[0],
    {
      ...reportFill.blocks[1],
      content: {
        ...reportFill.blocks[1].content,
        resolvedChart: {
          ...reportFill.blocks[1].content.resolvedChart,
          rows: [
            {
              ...reportFill.blocks[1].content.resolvedChart.rows[0],
              rogue: () => "nope",
            },
          ],
        },
      },
    },
  ],
};
const invalidFillResolvedChartRowValueValidation = validateReportFill(invalidFillResolvedChartRowValue);
assert.equal(invalidFillResolvedChartRowValueValidation.valid, false);
assert.deepEqual(invalidFillResolvedChartRowValueValidation.errors, [
  {
    path: "$.blocks[1].content.resolvedChart.rows[0].rogue",
    code: "type",
    message: "Expected string.",
  },
]);

const invalidGeoFill = {
  ...fixtures.geo.reportFill,
  blocks: [
    fixtures.geo.reportFill.blocks[0],
    fixtures.geo.reportFill.blocks[1],
    {
      ...fixtures.geo.reportFill.blocks[2],
      content: {
        ...fixtures.geo.reportFill.blocks[2].content,
        geo: {
          ...fixtures.geo.reportFill.blocks[2].content.geo,
          color: {
            ...fixtures.geo.reportFill.blocks[2].content.geo.color,
            rogue: true,
          },
        },
      },
    },
  ],
};
const invalidGeoFillValidation = validateReportFill(invalidGeoFill);
assert.equal(invalidGeoFillValidation.valid, false);
assert.deepEqual(invalidGeoFillValidation.errors, [
  {
    path: "$.blocks[2].content.geo.color.rogue",
    code: "additionalProperties",
    message: "Unexpected property.",
  },
]);

const invalidGeoRuleValueFill = {
  ...fixtures.geo.reportFill,
  blocks: [
    fixtures.geo.reportFill.blocks[0],
    fixtures.geo.reportFill.blocks[1],
    {
      ...fixtures.geo.reportFill.blocks[2],
      content: {
        ...fixtures.geo.reportFill.blocks[2].content,
        geo: {
          ...fixtures.geo.reportFill.blocks[2].content.geo,
          color: {
            ...fixtures.geo.reportFill.blocks[2].content.geo.color,
            rules: [
              {
                ...fixtures.geo.reportFill.blocks[2].content.geo.color.rules[0],
                value: () => "nope",
              },
            ],
          },
        },
      },
    },
  ],
};
const invalidGeoRuleValueFillValidation = validateReportFill(invalidGeoRuleValueFill);
assert.equal(invalidGeoRuleValueFillValidation.valid, false);
assert.deepEqual(invalidGeoRuleValueFillValidation.errors, [
  {
    path: "$.blocks[2].content.geo.color.rules[0].value",
    code: "type",
    message: "Expected string.",
  },
]);

const generatedPrint = buildReportPrintFromReportFill({
  reportSpec,
  reportFill,
});
assert.deepEqual(validateReportPrint(generatedPrint), {
  valid: true,
  errors: [],
});

const invalidPrint = {
  ...printFixtures.raw.reportPrint,
  pageGeometry: {
    ...printFixtures.raw.reportPrint.pageGeometry,
    rogue: true,
  },
};
const invalidPrintValidation = validateReportPrint(invalidPrint);
assert.equal(invalidPrintValidation.valid, false);
assert.deepEqual(invalidPrintValidation.errors, [
  {
    path: "$.pageGeometry.rogue",
    code: "additionalProperties",
    message: "Unexpected property.",
  },
]);

const compactNumberKpiReportSpec = {
  version: 1,
  kind: "reportSpec",
  source: {
    kind: "dashboard.reportBuilder",
    containerId: "forecastingCubeBuilder",
    stateKey: "forecastingCubeBuilder",
    dataSourceRef: "forecasting_cube_report",
  },
  title: "Forecast Inventory Brief",
  parameters: {
    viewMode: "table",
    groupBy: "",
    pageSize: 25,
    orderField: "avails",
    orderDir: "desc",
  },
  layoutIntent: {
    kind: "single",
    resultPanePosition: "right",
    blockOrder: ["headlineKpi"],
  },
  refinements: [],
  calculatedFields: [],
  datasets: [
    {
      id: "primary",
      dataSourceRef: "forecasting_cube_report",
      request: {
        measures: { avails: true },
        dimensions: { channelV2: true },
        filters: {},
        limit: 25,
        offset: 0,
      },
    },
  ],
  blocks: [
    {
      id: "headlineKpi",
      kind: "kpiBlock",
      title: "Top Channel Inventory",
      datasetRef: "primary",
      valueField: "avails",
      valueLabel: "Avails",
      valueFormat: "compactNumber",
      secondaryField: "channelV2",
      secondaryLabel: "Channel",
      description: "Highlights the leading inventory channel before drilling deeper.",
      emptyLabel: "No forecast KPI value available.",
    },
  ],
};
assert.deepEqual(validateReportSpec(compactNumberKpiReportSpec), {
  valid: true,
  errors: [],
});

const compactNumberKpiReportFill = {
  version: 1,
  kind: "reportFill",
  specVersion: 1,
  specHash: "fnv1a:test",
  source: compactNumberKpiReportSpec.source,
  parameters: compactNumberKpiReportSpec.parameters,
  refinements: [],
  calculatedFields: [],
  datasets: [
    {
      id: "primary",
      dataSourceRef: "forecasting_cube_report",
      request: compactNumberKpiReportSpec.datasets[0].request,
      provenance: {
        requestHash: "fnv1a:test",
        rowCount: 1,
        truncated: false,
        hasMore: false,
        diagnostics: [],
      },
      rows: [
        {
          avails: 5900000000,
          channelV2: "CTV",
        },
      ],
    },
  ],
  blocks: [
    {
      id: "headlineKpi",
      kind: "kpiBlock",
      title: "Top Channel Inventory",
      datasetRef: "primary",
      valueField: "avails",
      valueLabel: "Avails",
      valueFormat: "compactNumber",
      secondaryField: "channelV2",
      secondaryLabel: "Channel",
      description: "Highlights the leading inventory channel before drilling deeper.",
      emptyLabel: "No forecast KPI value available.",
      content: {
        title: "Top Channel Inventory",
        description: "Highlights the leading inventory channel before drilling deeper.",
        valueField: "avails",
        valueLabel: "Avails",
        valueFormat: "compactNumber",
        value: 5900000000,
        rowCount: 1,
        secondaryField: "channelV2",
        secondaryLabel: "Channel",
        secondaryValue: "CTV",
        emptyLabel: "No forecast KPI value available.",
      },
    },
  ],
  diagnostics: [],
};
assert.deepEqual(validateReportFill(compactNumberKpiReportFill), {
  valid: true,
  errors: [],
});

console.log("reportSchemas ✓ validates current ReportSpec/ReportFill/ReportPrint artifacts and rejects unknown fields");

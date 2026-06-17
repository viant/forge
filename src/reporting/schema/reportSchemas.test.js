import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildDraftReportExportRequest } from "../reportExportRequestModel.js";
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
  staticFilters: {
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

assert.deepEqual(validateReportSpec(reportSpec), {
  valid: true,
  errors: [],
});

const semanticSummarySpec = {
  ...reportSpec,
  semanticSummary: {
    kind: "semantic",
    modelRef: "model://steward/performance/ad_delivery@v1",
    modelLabel: "Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    selectedDimensions: [
      { id: "event_date", rawId: "eventDate", label: "Event Date" },
    ],
    selectedMeasures: [
      {
        id: "total_spend",
        rawId: "totalSpend",
        label: "Total Spend",
        format: "currency",
        governance: {
          status: "approved",
          certification: "certified",
        },
      },
    ],
  },
};
assert.deepEqual(validateReportSpec(semanticSummarySpec), {
  valid: true,
  errors: [],
});

assert.deepEqual(validateReportFill(reportFill), {
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
  reportPrint: printFixtures.raw.reportPrint,
  format: "pdf",
});
assert.deepEqual(validateReportExportRequest(exportRequest), {
  valid: true,
  errors: [],
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

console.log("reportSchemas ✓ validates current ReportSpec/ReportFill/ReportPrint artifacts and rejects unknown fields");

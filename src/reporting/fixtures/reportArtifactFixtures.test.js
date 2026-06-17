import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildReportBuilderReportDocument,
  buildReportDocumentChartBlock,
  buildReportDocumentFilterBarBlock,
  buildReportDocumentGeoMapBlock,
  buildReportDocumentKpiBlock,
  buildReportDocumentMarkdownBlock,
  buildReportDocumentRefinementBarBlock,
  buildReportDocumentTableBlock,
  lowerReportDocumentToReportSpec,
} from "../reportDocumentModel.js";
import { buildReportBuilderReportSpec } from "../reportSpecModel.js";
import { buildReportFillFromReportSpec } from "../reportFillModel.js";
import { buildReportPrintFromReportFill } from "../reportPrintModel.js";
import { validateReportFill, validateReportPrint, validateReportSpec } from "../schema/reportSchemas.js";
import { applyReportBuilderSemanticConfig } from "../../components/dashboard/reportBuilderSemantic.js";

const fixtureUrl = new URL("./performance-report-fixtures.v1.json", import.meta.url);
const fixtures = JSON.parse(readFileSync(fixtureUrl, "utf8"));
const printFixtureUrl = new URL("./performance-report-print-fixtures.v1.json", import.meta.url);
const printFixtures = JSON.parse(readFileSync(printFixtureUrl, "utf8"));

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
    options: [{ value: "channelId", label: "Channel", dimensionId: "channelId" }],
  },
  staticFilters: [
    { id: "dateRange", type: "dateRange", required: true, startParamPath: "filters.From", endParamPath: "filters.To", default: { start: "2026-05-01", end: "2026-05-04" } },
  ],
  result: {
    defaultMode: "table",
    chartCreationMode: "explicit",
    resultPanePosition: "left",
    defaultChartSpecs: [{ title: "Spend by Date", type: "line", xField: "eventDate", yFields: ["totalSpend"] }],
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

const rawFill = buildReportFillFromReportSpec(rawSpec, {
  primary: {
    rows: [
      { eventDate: "2026-05-01", channelId: "Display", totalSpend: 40400, impressions: 16500 },
      { eventDate: "2026-05-01", channelId: "CTV", totalSpend: 34300, impressions: 14700 },
    ],
  },
});
const rawPrint = buildReportPrintFromReportFill({
  reportSpec: rawSpec,
  reportFill: rawFill,
});

const semanticModel = {
  modelRef: "model://steward/performance/ad_delivery@v1",
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
    modelRef: "model://steward/performance/ad_delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date", "channel"],
    selectedMeasures: ["spend", "impressions"],
  },
}, {
  mode: "semantic",
  modelRef: "model://steward/performance/ad_delivery@v1",
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
});

const semanticFill = buildReportFillFromReportSpec(semanticSpec, {
  primary: {
    rows: [
      { eventDate: "2026-05-01", channelId: "Display", totalSpend: 40400, impressions: 16500 },
      { eventDate: "2026-05-01", channelId: "CTV", totalSpend: 34300, impressions: 14700 },
    ],
    hasMore: true,
    diagnostics: [
      { code: "truncated", severity: "warning", message: "Results truncated to preview row limit." },
    ],
  },
});
const semanticPrint = buildReportPrintFromReportFill({
  reportSpec: semanticSpec,
  reportFill: semanticFill,
});

const geoDocument = buildReportBuilderReportDocument({
  container: {
    id: "performanceBuilder",
    stateKey: "performanceBuilder",
    title: "Performance Report",
    dataSourceRef: "demoReportSource",
  },
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

const geoSpec = lowerReportDocumentToReportSpec(geoDocument);
const geoFill = buildReportFillFromReportSpec(geoSpec, {
  primary: {
    rows: [
      { eventDate: "2026-05-01", channelId: "Display", totalSpend: 100, impressions: 50, stateCode: "CA", stateName: "California", spend: 100, status: "critical" },
      { eventDate: "2026-05-02", channelId: "Display", totalSpend: 40, impressions: 20, stateCode: "CA", stateName: "California", spend: 40, status: "critical" },
      { eventDate: "2026-05-01", channelId: "CTV", totalSpend: 80, impressions: 30, stateCode: "WA", stateName: "Washington", spend: 80, status: "healthy" },
    ],
  },
});
const geoPrint = buildReportPrintFromReportFill({
  reportSpec: geoSpec,
  reportFill: geoFill,
});

const authoredRows = Array.from({ length: 36 }, (_, index) => ({
  eventDate: `2026-05-${String((index % 9) + 1).padStart(2, "0")}`,
  channelId: index % 2 === 0 ? "Display" : "CTV",
  totalSpend: 20000 + (index * 1750),
  impressions: 10000 + (index * 840),
  status: index % 3 === 0 ? "healthy" : "critical",
  stateCode: index % 2 === 0 ? "CA" : "WA",
  stateName: index % 2 === 0 ? "California" : "Washington",
  spend: 20000 + (index * 1750),
}));

const authoredDocument = buildReportBuilderReportDocument({
  container: {
    id: "authoredPerformanceBuilder",
    stateKey: "authoredPerformanceBuilder",
    title: "Authored Performance Report",
    dataSourceRef: "demoReportSource",
  },
  config: rawConfig,
  state: {
    selectedMeasures: ["totalSpend", "impressions"],
    primaryMeasure: "totalSpend",
    selectedDimensions: ["eventDate", "channelId"],
    viewMode: "table",
    pageSize: 25,
    orderField: "eventDate",
    orderDir: "asc",
    staticFilters: {
      dateRange: { start: "2026-05-01", end: "2026-05-04" },
    },
    reportDocumentLayout: {
      items: [
        { blockId: "primaryBuilder" },
        { blockId: "headlineKpi", size: "half" },
        { blockId: "comparisonTable" },
        { blockId: "channelTrend" },
        { blockId: "stateGeo" },
        { blockId: "narrativeIntro" },
      ],
    },
  },
  additionalBlocks: [
    buildReportDocumentFilterBarBlock({
      id: "sharedFilters",
      title: "Shared Filters",
      paramIds: ["dateRange"],
    }),
    buildReportDocumentRefinementBarBlock({
      id: "activeRefinements",
      title: "Applied Refinements",
      actionKinds: ["remove", "clearAll", "redo"],
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
    }),
    buildReportDocumentTableBlock({
      id: "comparisonTable",
      title: "Comparison Table",
      datasetRef: "primary",
      columns: [
        {
          key: "eventDate",
          label: "Date",
        },
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
              { value: "healthy", label: "Healthy", tone: "success" },
              { value: "critical", label: "Critical", tone: "danger" },
            ],
          },
        },
      ],
    }),
    buildReportDocumentChartBlock({
      id: "channelTrend",
      title: "Channel Trend",
      datasetRef: "primary",
      chartSpec: {
        type: "line",
        xField: "eventDate",
        yFields: ["totalSpend"],
        seriesField: "channelId",
      },
    }),
    buildReportDocumentGeoMapBlock({
      id: "stateGeo",
      title: "State Performance",
      datasetRef: "primary",
      geo: {
        shape: "us-states",
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

const authoredSpec = lowerReportDocumentToReportSpec(authoredDocument);
const authoredFill = buildReportFillFromReportSpec(authoredSpec, {
  primary: {
    rows: authoredRows,
  },
});
const authoredPrint = buildReportPrintFromReportFill({
  reportSpec: authoredSpec,
  reportFill: authoredFill,
});

assert.deepEqual(validateReportSpec(fixtures.raw.reportSpec), { valid: true, errors: [] });
assert.deepEqual(validateReportFill(fixtures.raw.reportFill), { valid: true, errors: [] });
assert.deepEqual(validateReportPrint(printFixtures.raw.reportPrint), { valid: true, errors: [] });
assert.deepEqual(validateReportSpec(fixtures.semantic.reportSpec), { valid: true, errors: [] });
assert.deepEqual(validateReportFill(fixtures.semantic.reportFill), { valid: true, errors: [] });
assert.deepEqual(validateReportPrint(printFixtures.semantic.reportPrint), { valid: true, errors: [] });
assert.deepEqual(validateReportSpec(fixtures.geo.reportSpec), { valid: true, errors: [] });
assert.deepEqual(validateReportFill(fixtures.geo.reportFill), { valid: true, errors: [] });
assert.deepEqual(validateReportPrint(printFixtures.geo.reportPrint), { valid: true, errors: [] });
assert.deepEqual(validateReportPrint(printFixtures.authored.reportPrint), { valid: true, errors: [] });

assert.deepEqual(rawSpec, fixtures.raw.reportSpec);
assert.deepEqual(rawFill, fixtures.raw.reportFill);
assert.deepEqual(rawPrint, printFixtures.raw.reportPrint);
assert.deepEqual(semanticSpec, fixtures.semantic.reportSpec);
assert.deepEqual(semanticFill, fixtures.semantic.reportFill);
assert.deepEqual(semanticPrint, printFixtures.semantic.reportPrint);
assert.deepEqual(geoSpec, fixtures.geo.reportSpec);
assert.deepEqual(geoFill, fixtures.geo.reportFill);
assert.deepEqual(geoPrint, printFixtures.geo.reportPrint);
assert.deepEqual(authoredPrint, printFixtures.authored.reportPrint);

console.log("reportArtifactFixtures ✓ current generated artifacts stay aligned with the seeded fixture corpus");

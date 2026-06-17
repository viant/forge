import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildReportBuilderReportDocument,
  buildReportDocumentChartBlock,
  lowerReportDocumentToReportSpec,
} from "../reportDocumentModel.js";
import { buildReportFillFromReportSpec } from "../reportFillModel.js";
import { buildReportPrintFromReportFill } from "../reportPrintModel.js";
import { validateReportPrint } from "../schema/reportSchemas.js";

const fixtureUrl = new URL("./authored-landscape-report-print-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const container = {
  id: "authoredLandscapeBuilder",
  stateKey: "authoredLandscapeBuilder",
  title: "Authored Landscape Report",
  dataSourceRef: "demoReportSource",
};

const config = {
  title: "Authored Landscape Report",
  measures: [
    { id: "totalSpend", key: "totalSpend", label: "Spend", default: true, format: "currency" },
    { id: "impressions", key: "impressions", label: "Impressions", format: "compactNumber" },
  ],
  dimensions: [
    { id: "eventDate", key: "eventDate", label: "Date", default: true, chartAxis: true, format: "date" },
    { id: "channelId", key: "channelId", label: "Channel", default: true },
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
    defaultMode: "table",
    pageSize: 50,
  },
};

const state = {
  selectedMeasures: ["totalSpend", "impressions"],
  primaryMeasure: "totalSpend",
  selectedDimensions: ["eventDate", "channelId"],
  viewMode: "table",
  orderField: "eventDate",
  orderDir: "asc",
  staticFilters: {
    dateRange: { start: "2026-05-01", end: "2026-05-04" },
  },
  reportDocumentLayout: {
    items: [
      { blockId: "primaryBuilder" },
      { blockId: "channelTrend" },
    ],
  },
};

const document = buildReportBuilderReportDocument({
  container,
  config,
  state,
  additionalBlocks: [
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
  ],
});

const reportSpec = lowerReportDocumentToReportSpec(document);
const reportFill = buildReportFillFromReportSpec(reportSpec, {
  primary: {
    rows: [
      { eventDate: "2026-05-01", channelId: "Display", totalSpend: 40400, impressions: 16500 },
      { eventDate: "2026-05-02", channelId: "CTV", totalSpend: 34300, impressions: 14700 },
      { eventDate: "2026-05-03", channelId: "Display", totalSpend: 55200, impressions: 23100 },
      { eventDate: "2026-05-04", channelId: "CTV", totalSpend: 48800, impressions: 20800 },
    ],
  },
});

const reportPrint = buildReportPrintFromReportFill({
  reportSpec,
  reportFill,
  pageGeometry: {
    width: 792,
    height: 612,
    marginTop: 36,
    marginRight: 36,
    marginBottom: 36,
    marginLeft: 36,
    headerHeight: 36,
    footerHeight: 24,
  },
});

assert.deepEqual(validateReportPrint(reportPrint), { valid: true, errors: [] });
assert.deepEqual(reportPrint, fixture);

console.log("authoredLandscapeReportPrintFixture ✓ authored landscape print fixture stays aligned with generated runtime output");

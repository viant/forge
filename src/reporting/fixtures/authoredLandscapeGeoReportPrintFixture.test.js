import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildReportBuilderReportDocument,
  buildReportDocumentGeoMapBlock,
  lowerReportDocumentToReportSpec,
} from "../reportDocumentModel.js";
import { buildReportFillFromReportSpec } from "../reportFillModel.js";
import { buildReportPrintFromReportFill } from "../reportPrintModel.js";
import { validateReportPrint } from "../schema/reportSchemas.js";

const fixtureUrl = new URL("./authored-landscape-geo-report-print-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const container = {
  id: "authoredLandscapeGeoBuilder",
  stateKey: "authoredLandscapeGeoBuilder",
  title: "Authored Landscape Geo Report",
  dataSourceRef: "demoReportSource",
};

const config = {
  title: "Authored Landscape Geo Report",
  measures: [
    { id: "spend", key: "spend", label: "Spend", default: true, format: "currency" },
  ],
  dimensions: [
    { id: "stateCode", key: "stateCode", label: "State", default: true },
    { id: "stateName", key: "stateName", label: "State Name" },
    { id: "status", key: "status", label: "Status" },
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
  selectedMeasures: ["spend"],
  primaryMeasure: "spend",
  selectedDimensions: ["stateCode"],
  viewMode: "table",
  orderField: "stateCode",
  orderDir: "asc",
  staticFilters: {
    dateRange: { start: "2026-05-01", end: "2026-05-04" },
  },
  reportDocumentLayout: {
    items: [
      { blockId: "primaryBuilder" },
      { blockId: "stateGeo" },
    ],
  },
};

const document = buildReportBuilderReportDocument({
  container,
  config,
  state,
  additionalBlocks: [
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
  ],
});

const reportSpec = lowerReportDocumentToReportSpec(document);
const reportFill = buildReportFillFromReportSpec(reportSpec, {
  primary: {
    rows: [
      { stateCode: "CA", stateName: "California", spend: 1200000, status: "critical" },
      { stateCode: "WA", stateName: "Washington", spend: 980000, status: "healthy" },
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

console.log("authoredLandscapeGeoReportPrintFixture ✓ authored landscape geo print fixture stays aligned with generated runtime output");

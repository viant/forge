import assert from "node:assert/strict";

import { buildReportBuilderReportSpec } from "./reportSpecModel.js";
import { buildReportFillFromReportSpec } from "./reportFillModel.js";
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
} from "./reportDocumentModel.js";
import {
  buildReportPrintArtifact,
  buildReportPrintFromReportFill,
  buildReportPrintLineElement,
  buildReportPrintPage,
  buildReportPrintTableCellBadgeElement,
  buildReportPrintTableCellTextElement,
  buildReportPrintTextElement,
  DEFAULT_REPORT_PRINT_PAGE_GEOMETRY,
} from "./reportPrintModel.js";
import { validateReportFill, validateReportPrint, validateReportSpec } from "./schema/reportSchemas.js";
import { buildAuthoredDerivedCompactArtifacts } from "./fixtures/authoredDerivedCompactArtifactBuilder.js";

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
    defaultMode: "table",
    chartCreationMode: "explicit",
    resultPanePosition: "left",
    pageSize: 50,
  },
};

const state = {
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
};

const container = {
  id: "performanceBuilder",
  stateKey: "performanceBuilder",
  title: "Performance Report",
  dataSourceRef: "demoReportSource",
};

const reportSpec = buildReportBuilderReportSpec({
  container,
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

const page = buildReportPrintPage({
  number: 1,
  headerElements: [
    buildReportPrintTextElement({
      id: "headerTitle",
      kind: "text",
      box: { x: 36, y: 18, width: 540, height: 18 },
      text: "Performance Report",
      fontSize: 18,
      fontWeight: "700",
      align: "left",
    }),
  ],
  elements: [
    buildReportPrintLineElement({
      id: "headerDivider",
      kind: "line",
      box: { x: 36, y: 54, width: 540, height: 0 },
      strokeColor: "#d8dee4",
      strokeWidth: 1,
    }),
    buildReportPrintTableCellTextElement({
      id: "row_0_eventDate",
      kind: "tableCellText",
      box: { x: 36, y: 84, width: 120, height: 20 },
      rowKey: "row_0",
      columnKey: "eventDate",
      text: "2026-05-01",
    }),
    buildReportPrintTableCellTextElement({
      id: "row_0_channelId",
      kind: "tableCellText",
      box: { x: 168, y: 84, width: 140, height: 20 },
      rowKey: "row_0",
      columnKey: "channelId",
      text: "Display",
    }),
    buildReportPrintTableCellTextElement({
      id: "row_0_totalSpend",
      kind: "tableCellText",
      box: { x: 320, y: 84, width: 120, height: 20 },
      rowKey: "row_0",
      columnKey: "totalSpend",
      text: "$40,400",
      format: "currency",
      align: "right",
    }),
    buildReportPrintTableCellBadgeElement({
      id: "row_0_status",
      kind: "tableCellBadge",
      box: { x: 452, y: 82, width: 84, height: 24 },
      rowKey: "row_0",
      columnKey: "status",
      label: "Reviewed",
      tone: "reviewed",
      backgroundColor: "#d9f2ff",
      borderColor: "#0f4c81",
      textColor: "#0f4c81",
    }),
  ],
  footerElements: [
    buildReportPrintTextElement({
      id: "footerPageNumber",
      kind: "text",
      box: { x: 500, y: 756, width: 76, height: 18 },
      text: "Page 1",
      fontSize: 12,
      align: "right",
    }),
  ],
});

assert.deepEqual(page, {
  number: 1,
  headerElements: [
    {
      id: "headerTitle",
      kind: "text",
      box: { x: 36, y: 18, width: 540, height: 18 },
      text: "Performance Report",
      fontSize: 18,
      fontWeight: "700",
      align: "left",
    },
  ],
  elements: [
    {
      id: "headerDivider",
      kind: "line",
      box: { x: 36, y: 54, width: 540, height: 0 },
      strokeColor: "#d8dee4",
      strokeWidth: 1,
    },
    {
      id: "row_0_eventDate",
      kind: "tableCellText",
      box: { x: 36, y: 84, width: 120, height: 20 },
      rowKey: "row_0",
      columnKey: "eventDate",
      text: "2026-05-01",
    },
    {
      id: "row_0_channelId",
      kind: "tableCellText",
      box: { x: 168, y: 84, width: 140, height: 20 },
      rowKey: "row_0",
      columnKey: "channelId",
      text: "Display",
    },
    {
      id: "row_0_totalSpend",
      kind: "tableCellText",
      box: { x: 320, y: 84, width: 120, height: 20 },
      rowKey: "row_0",
      columnKey: "totalSpend",
      text: "$40,400",
      format: "currency",
      align: "right",
    },
    {
      id: "row_0_status",
      kind: "tableCellBadge",
      box: { x: 452, y: 82, width: 84, height: 24 },
      rowKey: "row_0",
      columnKey: "status",
      label: "Reviewed",
      tone: "reviewed",
      backgroundColor: "#d9f2ff",
      borderColor: "#0f4c81",
      textColor: "#0f4c81",
    },
  ],
  footerElements: [
    {
      id: "footerPageNumber",
      kind: "text",
      box: { x: 500, y: 756, width: 76, height: 18 },
      text: "Page 1",
      fontSize: 12,
      align: "right",
    },
  ],
});

const reportPrint = buildReportPrintArtifact({
  reportSpec,
  reportFill,
  title: "Performance Report",
  pageGeometry: DEFAULT_REPORT_PRINT_PAGE_GEOMETRY,
  pages: [page],
  bookmarks: [
    {
      id: "bookmark.primaryTable",
      title: "Primary Table",
      pageNumber: 1,
      elementId: "row_0_eventDate",
      level: 1,
      y: 84,
    },
  ],
  diagnostics: [],
});

assert.equal(reportPrint.kind, "reportPrint");
assert.equal(reportPrint.version, 1);
assert.equal(reportPrint.specVersion, reportSpec.version);
assert.equal(reportPrint.fillVersion, reportFill.version);
assert.equal(typeof reportPrint.specHash, "string");
assert.equal(typeof reportPrint.fillHash, "string");
assert.deepEqual(reportPrint.source, reportFill.source);
assert.deepEqual(reportPrint.pageGeometry, DEFAULT_REPORT_PRINT_PAGE_GEOMETRY);
assert.equal(reportPrint.pages.length, 1);
assert.equal(reportPrint.bookmarks[0].elementId, "row_0_eventDate");

assert.deepEqual(validateReportPrint(reportPrint), {
  valid: true,
  errors: [],
});

const {
  reportSpec: compactDerivedSpec,
  reportFill: compactDerivedFill,
  reportPrint: compactDerivedPrint,
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

assert.deepEqual(validateReportSpec(compactDerivedSpec), { valid: true, errors: [] });
assert.deepEqual(validateReportFill(compactDerivedFill), { valid: true, errors: [] });
assert.deepEqual(validateReportPrint(compactDerivedPrint), { valid: true, errors: [] });
assert.equal(compactDerivedPrint.diagnostics.some((diagnostic) => diagnostic.code === "unsupportedReportPrintBlock"), false);
assert.ok(compactDerivedPrint.pages.length > 0);
assert.equal(
  compactDerivedPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "svg" && element.id.includes("reachRateTrend")),
  true,
);
assert.equal(compactDerivedPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "tableCellText" && element.columnKey === "reachRate"), true);

const invalidReportPrint = {
  ...reportPrint,
  pages: [
    {
      ...reportPrint.pages[0],
      rogue: true,
    },
  ],
};

const invalidValidation = validateReportPrint(invalidReportPrint);
assert.equal(invalidValidation.valid, false);
assert.deepEqual(invalidValidation.errors, [
  {
    path: "$.pages[0].rogue",
    code: "additionalProperties",
    message: "Unexpected property.",
  },
]);

assert.equal(buildReportPrintArtifact({
  reportSpec,
  reportFill: {
    ...reportFill,
    specHash: "fnv1a:mismatch",
  },
  title: "Performance Report",
  pageGeometry: DEFAULT_REPORT_PRINT_PAGE_GEOMETRY,
  pages: [page],
}), null);

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
  container,
  config,
  state: {
    ...state,
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
const loweredPrint = buildReportPrintFromReportFill({
  reportSpec: authoredSpec,
  reportFill: authoredFill,
});

assert.deepEqual(validateReportPrint(loweredPrint), {
  valid: true,
  errors: [],
});
assert.ok(loweredPrint.pages.length >= 2);
assert.ok(loweredPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.headlineKpi"));
assert.ok(loweredPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.narrativeIntro"));
assert.ok(loweredPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.stateGeo"));
assert.equal(loweredPrint.diagnostics.some((diagnostic) => diagnostic.code === "unsupportedReportPrintLayoutSize"), false);
assert.equal(loweredPrint.diagnostics.some((diagnostic) => diagnostic.code === "unsupportedReportPrintChartPayload"), false);
assert.equal(loweredPrint.diagnostics.some((diagnostic) => diagnostic.code === "unsupportedReportPrintBlock" && /chartBlock/.test(diagnostic.message)), false);
assert.equal(loweredPrint.diagnostics.some((diagnostic) => diagnostic.code === "unsupportedReportPrintBlock" && /geoMapBlock/.test(diagnostic.message)), false);

const printElements = loweredPrint.pages.flatMap((entry) => entry.elements);
assert.ok(printElements.some((element) => element.kind === "tableCellDataBar"));
assert.ok(printElements.some((element) => element.kind === "tableCellBadge"));
assert.ok(printElements.some((element) => (
  element.kind === "rect"
  && element.id.endsWith("__bar_track")
  && element.radius === 8
)));
assert.ok(printElements.some((element) => (
  element.kind === "tableCellBadge"
  && element.borderColor
)));
assert.ok(printElements.some((element) => (
  element.kind === "svg"
  && /<svg/.test(element.svg)
  && /Display/.test(element.svg)
  && /CTV/.test(element.svg)
)));
assert.ok(printElements.some((element) => (
  element.kind === "svg"
  && /Top Regions/.test(element.svg)
  && /Total Spend:/.test(element.svg)
  && />CA</.test(element.svg)
  && />WA</.test(element.svg)
)));
assert.ok(printElements.some((element) => (
  element.kind === "text"
  && /dateRange: 2026-05-01 to 2026-05-04/.test(element.text)
)));
assert.ok(printElements.some((element) => (
  element.kind === "text"
  && /Drill Display/.test(element.text)
)));
assert.ok(printElements.some((element) => (
  element.kind === "text"
  && /Spend: 20000/.test(element.text)
)));
const headlineKpiTitle = loweredPrint.pages
  .flatMap((page) => (page.elements || []).map((element) => ({ page: page.number, element })))
  .find((entry) => entry.element?.id === "headlineKpi__title_0");
assert.equal(headlineKpiTitle?.page, 2);
assert.deepEqual(headlineKpiTitle?.element?.box, {
  x: 36,
  y: 412,
  width: 258,
  height: 20,
});

console.log("reportPrintModel ✓ builds the canonical ReportPrint contract and lowers authored ReportFill blocks into paginated print output");

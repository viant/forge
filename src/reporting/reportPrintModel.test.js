import assert from "node:assert/strict";

import { buildReportBuilderReportSpec } from "./reportSpecModel.js";
import { buildReportFillFromReportSpec } from "./reportFillModel.js";
import {
  buildReportBuilderReportDocument,
  buildReportDocumentChartBlock,
  buildReportDocumentCollectionBlock,
  buildReportDocumentSectionBlock,
  buildReportDocumentCompositeBlock,
  buildReportDocumentTabGroupBlock,
  buildReportDocumentStepperBlock,
  buildReportDocumentInfoPanelBlock,
  buildReportDocumentCalloutBlock,
  buildReportDocumentKanbanBlock,
  buildReportDocumentTimelineBlock,
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
      description: "Approved reporting window for shared runtime scope.",
      type: "dateRange",
      required: true,
      startParamPath: "filters.From",
      endParamPath: "filters.To",
      default: { start: "2026-05-01", end: "2026-05-04" },
    },
    {
      id: "channel",
      label: "Channel",
      type: "multiSelect",
      multiple: true,
      options: [
        { label: "CTV", value: 1 },
        { label: "Display", value: 2 },
      ],
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
  scopeParams: {
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

const snappedCompactDerivedSpec = {
  ...compactDerivedSpec,
  layoutIntent: {
    ...compactDerivedSpec.layoutIntent,
    items: (Array.isArray(compactDerivedSpec.layoutIntent?.items) ? compactDerivedSpec.layoutIntent.items : []).map((item, index) => (
      index === 0
        ? { ...item, span: 5 }
        : (index === 1 ? { ...item, span: 7 } : item)
    )),
  },
};
const snappedCompactDerivedFill = buildReportFillFromReportSpec(
  snappedCompactDerivedSpec,
  Object.fromEntries(
    (Array.isArray(compactDerivedFill.datasets) ? compactDerivedFill.datasets : []).map((dataset) => [
      dataset.id,
      { rows: dataset.rows || [] },
    ]),
  ),
);
const snappedCompactDerivedPrint = buildReportPrintFromReportFill({
  reportSpec: snappedCompactDerivedSpec,
  reportFill: snappedCompactDerivedFill,
});
assert.deepEqual(validateReportPrint(snappedCompactDerivedPrint), { valid: true, errors: [] });
const snappedPageOne = snappedCompactDerivedPrint.pages[0];
const snappedPageOneTitles = (snappedPageOne.elements || []).filter((element) => element.kind === "text" && /__title_0$/.test(String(element.id || "")));
assert.ok(snappedPageOneTitles.length >= 2);
assert.equal(snappedPageOneTitles[0].box.x, 36);
assert.ok(snappedPageOneTitles[1].box.x > snappedPageOneTitles[0].box.x);

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
        { blockId: "overviewSection" },
        { blockId: "integrationFlow" },
        { blockId: "directIntro" },
        { blockId: "publisherPipeline" },
        { blockId: "integrationTimeline" },
        { blockId: "channelTrend" },
        { blockId: "topChannels" },
        { blockId: "stateGeo" },
        { blockId: "narrativeIntro" },
      ],
    },
  },
  additionalBlocks: [
    buildReportDocumentFilterBarBlock({
      id: "sharedFilters",
      title: "Shared Filters",
      paramIds: ["dateRange", "channel"],
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
      presentationMode: "both",
      bodyTemplate: "Print note ${format(row.totalSpend,currency)} for ${secondaryValue}.",
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
    buildReportDocumentSectionBlock({
      id: "overviewSection",
      title: "Overview",
      subtitle: "Supply outlook",
      description: "Section summary for print.",
    }),
    buildReportDocumentStepperBlock({
      id: "integrationFlow",
      title: "Direct Integration Path",
      description: "Three stages to define a direct path.",
      steps: [
        { id: "step_1", title: "Bid directly", body: "Connect bidding directly to the publisher ad server." },
        { id: "step_2", title: "Uncap QPS", body: "Enable access to the full inventory set." },
      ],
    }),
    buildReportDocumentInfoPanelBlock({
      id: "directIntro",
      title: "What is a Direct Integration Path?",
      eyebrow: "What is it?",
      description: "Explains the direct path concept.",
      tone: "info",
      body: "A direct integration connects bidding directly into the publisher ad server.",
    }),
    buildReportDocumentKanbanBlock({
      id: "publisherPipeline",
      title: "Publisher Pipeline",
      description: "Track publisher activations by stage.",
      columns: [
        {
          id: "signed",
          title: "Signed",
          cards: [
            { id: "tubi", title: "Tubi", body: "SpringServe integration live.", badge: "Live" },
          ],
        },
      ],
    }),
    buildReportDocumentTimelineBlock({
      id: "integrationTimeline",
      title: "Integration Timeline",
      description: "Track the rollout milestones.",
      events: [
        { id: "event_1", date: "2026-07-15", badge: "Target", title: "Roku signed", body: "Expected signature date." },
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
    buildReportDocumentCollectionBlock({
      id: "topChannels",
      title: "Top Channels",
      datasetRef: "primary",
      itemTitleField: "channelId",
      valueField: "totalSpend",
      valueLabel: "Spend",
      secondaryField: "eventDate",
      secondaryLabel: "Date",
      rowLimit: 2,
      toneField: "status",
      toneRules: [
        { value: "healthy", label: "High priority", tone: "danger", color: "#b42318", background: "#fff1f0" },
      ],
      bodyTemplate: "Print note ${format(row.totalSpend,currency)} for ${row.channelId}.",
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
assert.ok(loweredPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.overviewSection"));
assert.ok(loweredPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.integrationFlow"));
assert.ok(loweredPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.directIntro"));
assert.ok(loweredPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.publisherPipeline"));
assert.ok(loweredPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.integrationTimeline"));
assert.ok(loweredPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.topChannels"));
assert.ok(loweredPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.narrativeIntro"));
assert.ok(loweredPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.stateGeo"));
assert.equal(loweredPrint.diagnostics.some((diagnostic) => diagnostic.code === "unsupportedReportPrintLayoutSize"), false);
assert.equal(loweredPrint.diagnostics.some((diagnostic) => diagnostic.code === "unsupportedReportPrintChartPayload"), false);
assert.equal(loweredPrint.diagnostics.some((diagnostic) => diagnostic.code === "unsupportedReportPrintBlock" && /collectionBlock/.test(diagnostic.message)), false);
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
  && /Channel: All \(CTV, Display\)/.test(element.text)
)));
assert.ok(printElements.some((element) => (
  element.kind === "text"
  && /Approved reporting window for shared runtime scope\./.test(element.text)
)));
assert.ok(printElements.some((element) => (
  element.kind === "text"
  && /Drill Display/.test(element.text)
)));
assert.ok(printElements.some((element) => (
  element.kind === "text"
  && element.id.startsWith("headlineKpi__value_")
  && /20/.test(element.text)
)));
assert.ok(printElements.some((element) => (
  element.kind === "text"
  && /Print note \$20,000 for Display\./.test(element.text)
)));
assert.ok(printElements.some((element) => (
  element.kind === "text"
  && element.text === "HIGH PRIORITY"
  && element.color === "#b42318"
)));
assert.ok(printElements.some((element) => (
  element.kind === "rect"
  && element.fillColor === "#fff1f0"
)));
const headlineKpiTitle = loweredPrint.pages
  .flatMap((page) => (page.elements || []).map((element) => ({ page: page.number, element })))
  .find((entry) => entry.element?.id === "headlineKpi__title_0");
assert.equal(headlineKpiTitle?.page, 2);
assert.ok(headlineKpiTitle?.element?.box?.x >= 36);
assert.ok(headlineKpiTitle?.element?.box?.width >= 200);
assert.equal(headlineKpiTitle?.element?.box?.height, 16);

const compositeDocument = buildReportBuilderReportDocument({
  container,
  config,
  state: {
    ...state,
    reportDocumentBlocks: [
      buildReportDocumentCompositeBlock({
        id: "summaryPanel",
        title: "Summary panel",
        description: "Groups the opening narrative and KPI.",
        childBlockIds: ["narrativeIntro", "headlineKpi"],
      }),
      buildReportDocumentMarkdownBlock({
        id: "narrativeIntro",
        title: "Narrative child",
        markdown: "## Narrative child\nOverview context.",
      }),
      buildReportDocumentKpiBlock({
        id: "headlineKpi",
        title: "Headline child KPI",
        valueField: "totalSpend",
        valueLabel: "Spend",
      }),
    ],
    reportDocumentLayout: {
      type: "stack",
      items: [
        { blockId: "summaryPanel" },
        { blockId: "narrativeIntro", span: 6 },
        { blockId: "headlineKpi", span: 6 },
      ],
    },
  },
});
const compositeSpec = lowerReportDocumentToReportSpec(compositeDocument);
const compositeFill = buildReportFillFromReportSpec(compositeSpec, {
  primary: {
    rows: [{ totalSpend: 40400 }],
  },
});
const compositePrint = buildReportPrintFromReportFill({
  reportSpec: compositeSpec,
  reportFill: compositeFill,
});
assert.deepEqual(validateReportPrint(compositePrint), {
  valid: true,
  errors: [],
});
assert.ok(compositePrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.summaryPanel"));
assert.ok(compositePrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.narrativeIntro"));
assert.ok(compositePrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.headlineKpi"));
assert.equal(compositePrint.diagnostics.some((diagnostic) => diagnostic.code === "unsupportedReportPrintBlock" && /compositeBlock/.test(diagnostic.message)), false);
assert.equal(
  compositePrint.pages.flatMap((page) => page.elements).some((element) => element.kind === "text" && element.text === "Summary panel"),
  true,
);

const tabGroupDocument = buildReportBuilderReportDocument({
  container,
  config,
  state: {
    ...state,
    reportDocumentBlocks: [
      buildReportDocumentTabGroupBlock({
        id: "sectionTabs",
        title: "Report Sections",
        sectionIds: ["overviewSection", "executionSection"],
        defaultSectionId: "overviewSection",
      }),
      buildReportDocumentSectionBlock({
        id: "overviewSection",
        title: "Overview",
        navigationLabel: "Overview",
        description: "Opening summary section.",
      }),
      buildReportDocumentSectionBlock({
        id: "executionSection",
        title: "Execution",
        navigationLabel: "Execution",
        description: "Execution section.",
      }),
    ],
    reportDocumentLayout: {
      type: "stack",
      items: [
        { blockId: "sectionTabs" },
        { blockId: "overviewSection" },
        { blockId: "executionSection" },
      ],
    },
  },
});
const tabGroupSpec = lowerReportDocumentToReportSpec(tabGroupDocument);
const tabGroupFill = buildReportFillFromReportSpec(tabGroupSpec, {
  primary: {
    rows: [],
  },
});
const tabGroupPrint = buildReportPrintFromReportFill({
  reportSpec: tabGroupSpec,
  reportFill: tabGroupFill,
});
assert.deepEqual(validateReportPrint(tabGroupPrint), {
  valid: true,
  errors: [],
});
assert.ok(tabGroupPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.sectionTabs"));
assert.equal(tabGroupPrint.diagnostics.some((diagnostic) => diagnostic.code === "unsupportedReportPrintBlock" && /tabGroupBlock/.test(diagnostic.message)), false);
assert.equal(
  tabGroupPrint.pages.flatMap((page) => page.elements).some((element) => element.kind === "text" && /Tabs: Overview • Execution/.test(element.text)),
  false,
);
assert.equal(
  tabGroupPrint.pages.flatMap((page) => page.elements).some((element) => element.kind === "text" && element.text === "Opening summary section."),
  true,
);

const calloutDocument = buildReportBuilderReportDocument({
  container,
  config,
  state: {
    ...state,
    reportDocumentBlocks: [
      buildReportDocumentCalloutBlock({
        id: "launchCallout",
        title: "Launch update",
        icon: "warning-sign",
        description: "Important rollout note.",
        tone: "warning",
        badges: ["Executive", "Launch Ready"],
        body: "Publisher activation is staged for Friday.",
      }),
    ],
    reportDocumentLayout: {
      type: "stack",
      items: [
        { blockId: "launchCallout" },
      ],
    },
  },
});
const calloutSpec = lowerReportDocumentToReportSpec(calloutDocument);
const calloutFill = buildReportFillFromReportSpec(calloutSpec, {
  primary: {
    rows: [],
  },
});
const calloutPrint = buildReportPrintFromReportFill({
  reportSpec: calloutSpec,
  reportFill: calloutFill,
});
assert.deepEqual(validateReportPrint(calloutPrint), {
  valid: true,
  errors: [],
});
assert.ok(calloutPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.launchCallout"));
assert.equal(calloutPrint.diagnostics.some((diagnostic) => diagnostic.code === "unsupportedReportPrintBlock" && /calloutBlock/.test(diagnostic.message)), false);
assert.equal(
  calloutPrint.pages.flatMap((page) => page.elements).some((element) => element.kind === "text" && /Badges: Executive, Launch Ready/.test(element.text)),
  true,
);

const deltaTableSpec = {
  version: 1,
  kind: "reportSpec",
  source: {
    kind: "dashboard.reportBuilder",
    containerId: "deltaPrintBuilder",
    stateKey: "deltaPrintBuilder",
    dataSourceRef: "demoReportSource",
  },
  title: "Delta Table",
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
    blockOrder: ["deltaTable"],
    items: [{ blockId: "deltaTable" }],
  },
  refinements: [],
  calculatedFields: [],
  datasets: [{ id: "primary", dataSourceRef: "demoReportSource", request: {} }],
  blocks: [
    {
      id: "deltaTable",
      kind: "tableBlock",
      datasetRef: "primary",
      columns: [
        {
          key: "wowDelta",
          label: "WoW Delta",
          format: "percentFraction",
          cellVisual: {
            kind: "delta",
            valueField: "wowDelta",
          },
        },
      ],
    },
  ],
};
const deltaTableFill = buildReportFillFromReportSpec(deltaTableSpec, {
  primary: {
    rows: [{ wowDelta: 0.12 }],
  },
});
const deltaTablePrint = buildReportPrintFromReportFill({
  reportSpec: deltaTableSpec,
  reportFill: deltaTableFill,
});
assert.deepEqual(validateReportPrint(deltaTablePrint), {
  valid: true,
  errors: [],
});
assert.equal(deltaTablePrint.pages.flatMap((page) => page.elements).some((element) => element.kind === "tableCellTone" && element.label === "+12.0%"), true);

const sparkTableSpec = {
  version: 1,
  kind: "reportSpec",
  source: {
    kind: "dashboard.reportBuilder",
    containerId: "sparkPrintBuilder",
    stateKey: "sparkPrintBuilder",
    dataSourceRef: "demoReportSource",
  },
  title: "Spark Table",
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
    blockOrder: ["sparkTable"],
    items: [{ blockId: "sparkTable" }],
  },
  refinements: [],
  calculatedFields: [],
  datasets: [{ id: "primary", dataSourceRef: "demoReportSource", request: {} }],
  blocks: [
    {
      id: "sparkTable",
      kind: "tableBlock",
      datasetRef: "primary",
      columns: [
        {
          key: "sparkValue",
          label: "Spark",
          cellVisual: {
            kind: "sparkBar",
            valueField: "sparkValue",
            range: { mode: "columnMax" },
            palette: ["#eef2f6", "#4c6fff"],
          },
        },
      ],
    },
  ],
};
const sparkTableFill = buildReportFillFromReportSpec(sparkTableSpec, {
  primary: {
    rows: [{ sparkValue: 30 }, { sparkValue: 90 }],
  },
});
const sparkTablePrint = buildReportPrintFromReportFill({
  reportSpec: sparkTableSpec,
  reportFill: sparkTableFill,
});
assert.deepEqual(validateReportPrint(sparkTablePrint), {
  valid: true,
  errors: [],
});
assert.equal(sparkTablePrint.pages.flatMap((page) => page.elements).some((element) => element.kind === "tableCellDataBar" && /__spark$/.test(element.id)), true);

const rankTableSpec = {
  version: 1,
  kind: "reportSpec",
  source: {
    kind: "dashboard.reportBuilder",
    containerId: "rankPrintBuilder",
    stateKey: "rankPrintBuilder",
    dataSourceRef: "demoReportSource",
  },
  title: "Rank Table",
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
    blockOrder: ["rankTable"],
    items: [{ blockId: "rankTable" }],
  },
  refinements: [],
  calculatedFields: [],
  datasets: [{ id: "primary", dataSourceRef: "demoReportSource", request: {} }],
  blocks: [
    {
      id: "rankTable",
      kind: "tableBlock",
      datasetRef: "primary",
      columns: [
        {
          key: "spend",
          label: "Spend Rank",
          cellVisual: {
            kind: "rank",
            valueField: "spend",
          },
        },
      ],
    },
  ],
};
const rankTableFill = buildReportFillFromReportSpec(rankTableSpec, {
  primary: {
    rows: [{ spend: 120 }, { spend: 240 }],
  },
});
const rankTablePrint = buildReportPrintFromReportFill({
  reportSpec: rankTableSpec,
  reportFill: rankTableFill,
});
assert.deepEqual(validateReportPrint(rankTablePrint), {
  valid: true,
  errors: [],
});
assert.equal(rankTablePrint.pages.flatMap((page) => page.elements).some((element) => element.kind === "tableCellTone" && element.label === "#1"), true);

const shareBarTableSpec = {
  version: 1,
  kind: "reportSpec",
  source: {
    kind: "dashboard.reportBuilder",
    containerId: "shareBarPrintBuilder",
    stateKey: "shareBarPrintBuilder",
    dataSourceRef: "demoReportSource",
  },
  title: "Share Bar Table",
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
    blockOrder: ["shareTable"],
    items: [{ blockId: "shareTable" }],
  },
  refinements: [],
  calculatedFields: [],
  datasets: [{ id: "primary", dataSourceRef: "demoReportSource", request: {} }],
  blocks: [
    {
      id: "shareTable",
      kind: "tableBlock",
      datasetRef: "primary",
      columns: [
        {
          key: "shareMix",
          label: "Share Mix",
          cellVisual: {
            kind: "shareBar",
            segments: [
              { valueField: "ctvShare", label: "CTV", color: "#137cbd" },
              { valueField: "displayShare", label: "Display", color: "#0f9960" },
            ],
          },
        },
      ],
    },
  ],
};
const shareBarTableFill = buildReportFillFromReportSpec(shareBarTableSpec, {
  primary: {
    rows: [{ ctvShare: 0.6, displayShare: 0.4 }],
  },
});
const shareBarTablePrint = buildReportPrintFromReportFill({
  reportSpec: shareBarTableSpec,
  reportFill: shareBarTableFill,
});
assert.deepEqual(validateReportPrint(shareBarTablePrint), {
  valid: true,
  errors: [],
});
assert.equal(shareBarTablePrint.pages.flatMap((page) => page.elements).some((element) => element.kind === "tableCellText" && /CTV 60.0% · Display 40.0%/.test(element.text)), true);

const customBadgeTableSpec = {
  version: 1,
  kind: "reportSpec",
  source: {
    kind: "dashboard.reportBuilder",
    containerId: "customBadgePrintBuilder",
    stateKey: "customBadgePrintBuilder",
    dataSourceRef: "demoReportSource",
  },
  title: "Custom Badge Table",
  theme: {
    accentTone: "green",
    badgePalette: "bold",
  },
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
    blockOrder: ["badgeTable"],
    items: [{ blockId: "badgeTable" }],
  },
  refinements: [],
  calculatedFields: [],
  datasets: [{ id: "primary", dataSourceRef: "demoReportSource", request: {} }],
  blocks: [
    {
      id: "badgeTable",
      kind: "tableBlock",
      datasetRef: "primary",
      columns: [
        {
          key: "status",
          label: "Status",
          cellVisual: {
            kind: "badge",
            rules: [
              { value: "healthy", tone: "info", label: "Healthy" },
            ],
          },
        },
      ],
    },
  ],
};
const customBadgeTableFill = buildReportFillFromReportSpec(customBadgeTableSpec, {
  primary: {
    rows: [{ status: "healthy" }],
  },
});
const customBadgeTablePrint = buildReportPrintFromReportFill({
  reportSpec: customBadgeTableSpec,
  reportFill: customBadgeTableFill,
});
assert.deepEqual(validateReportPrint(customBadgeTablePrint), {
  valid: true,
  errors: [],
});
assert.equal(customBadgeTablePrint.pages.flatMap((page) => page.elements).some((element) => element.kind === "tableCellBadge" && element.backgroundColor === "#eef8f0" && element.borderColor === "#16a34a"), true);

const mappedIconTableSpec = {
  ...customBadgeTableSpec,
  title: "Mapped Icon Table",
  blocks: [{
    id: "mappedIconTable",
    kind: "tableBlock",
    datasetRef: "primary",
    columns: [{
      key: "channelId",
      sourceKey: "channelId",
      displayKey: "channelName",
      displayValueMap: { "1": "Display" },
      displayIconMap: { "1": "media" },
      label: "Channel",
    }],
  }],
};
const mappedIconTableFill = buildReportFillFromReportSpec(mappedIconTableSpec, {
  primary: { rows: [{ channelId: 1 }] },
});
const mappedIconTablePrint = buildReportPrintFromReportFill({
  reportSpec: mappedIconTableSpec,
  reportFill: mappedIconTableFill,
});
assert.deepEqual(validateReportPrint(mappedIconTablePrint), { valid: true, errors: [] });
assert.equal(mappedIconTablePrint.pages.flatMap((page) => page.elements).some((element) => element.kind === "svg" && element.id.includes("channelId__icon") && element.zIndex === 3 && element.svg.includes('fill="#425a70"')), true);
assert.equal(mappedIconTablePrint.pages.flatMap((page) => page.elements).some((element) => element.kind === "tableCellText" && element.text === "Display"), true);

const customToneTableSpec = {
  version: 1,
  kind: "reportSpec",
  source: {
    kind: "dashboard.reportBuilder",
    containerId: "customTonePrintBuilder",
    stateKey: "customTonePrintBuilder",
    dataSourceRef: "demoReportSource",
  },
  title: "Custom Tone Table",
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
    blockOrder: ["toneTable"],
    items: [{ blockId: "toneTable" }],
  },
  refinements: [],
  calculatedFields: [],
  datasets: [{ id: "primary", dataSourceRef: "demoReportSource", request: {} }],
  blocks: [
    {
      id: "toneTable",
      kind: "tableBlock",
      datasetRef: "primary",
      columns: [
        {
          key: "status",
          label: "Status",
          cellVisual: {
            kind: "tone",
            rules: [
              { value: "watch", tone: "warning", label: "Watch", color: "#7a271a", background: "#fdecea" },
            ],
          },
        },
      ],
    },
  ],
};
const customToneTableFill = buildReportFillFromReportSpec(customToneTableSpec, {
  primary: {
    rows: [{ status: "watch" }],
  },
});
const customToneTablePrint = buildReportPrintFromReportFill({
  reportSpec: customToneTableSpec,
  reportFill: customToneTableFill,
});
assert.deepEqual(validateReportPrint(customToneTablePrint), {
  valid: true,
  errors: [],
});
assert.equal(customToneTablePrint.pages.flatMap((page) => page.elements).some((element) => element.kind === "tableCellTone" && element.backgroundColor === "#fdecea" && element.textColor === "#7a271a"), true);

console.log("reportPrintModel ✓ builds the canonical ReportPrint contract and lowers authored ReportFill blocks into paginated print output");

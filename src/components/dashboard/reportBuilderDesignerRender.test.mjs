import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { signal } from "@preact/signals-react";

import ReportBuilder from "./ReportBuilder.jsx";

const container = {
  id: "designerRender",
  stateKey: "designerRender",
  title: "Designer Render",
  dataSourceRef: "demoReportSource",
  reportBuilder: {
    primaryMeasure: "totalSpend",
    measures: [
      { id: "totalSpend", key: "totalSpend", label: "Spend", default: true, format: "currency" },
      { id: "impressions", key: "impressions", label: "Impressions", default: true, format: "compactNumber" },
    ],
    dimensions: [
      { id: "eventDate", key: "eventDate", label: "Date", default: true, chartAxis: true },
      { id: "channelId", key: "channelId", label: "Channel", default: true },
    ],
    staticFilters: [
      {
        id: "dateRange",
        label: "Date Range",
        type: "dateRange",
        required: true,
      },
    ],
    result: {
      chartCreationMode: "explicit",
      defaultMode: "chart",
      viewModes: ["table", "chart"],
    },
    reportDocumentTemplates: [
      {
        id: "performance_overview",
        label: "Performance Overview",
        description: "Date-first performance starter.",
        statePatch: {
          selectedDimensions: ["eventDate"],
          selectedMeasures: ["totalSpend", "impressions"],
          primaryMeasure: "totalSpend",
          viewMode: "chart",
          chartSpec: {
            title: "Overview · Spend by Date",
            type: "line",
            xField: "eventDate",
            yFields: ["totalSpend"],
          },
        },
        documentPatch: {
          title: "Performance Overview",
          blocks: [
            {
              id: "narrativeIntro",
              kind: "markdownBlock",
              title: "Narrative",
              markdown: "## Narrative\nStarter text.",
            },
          ],
          layout: {
            type: "stack",
            items: [
              { blockId: "primaryBuilder" },
              { blockId: "narrativeIntro" },
            ],
          },
        },
      },
      {
        id: "channel_mix",
        label: "Channel Mix",
        description: "Channel-first mixed starter.",
        statePatch: {
          selectedDimensions: ["channelId"],
          selectedMeasures: ["totalSpend"],
          primaryMeasure: "totalSpend",
          viewMode: "chart",
          chartSpec: {
            title: "Channel · Spend Mix",
            type: "donut",
            xField: "channelId",
            yFields: ["totalSpend"],
          },
        },
        documentPatch: {
          title: "Channel Mix",
          blocks: [
            {
              id: "detailTable",
              kind: "tableBlock",
              title: "Detail Table",
              columns: [
                { key: "channelId", label: "Channel" },
                { key: "totalSpend", label: "Spend", format: "currency" },
              ],
            },
            {
              id: "forecastHeadline",
              kind: "kpiBlock",
              title: "Forecast Headline",
              datasetRef: "forecast_cube",
              valueField: "totalSpend",
              valueLabel: "Spend",
            },
          ],
          layout: {
            type: "stack",
            items: [
              { blockId: "primaryBuilder" },
              { blockId: "detailTable" },
              { blockId: "forecastHeadline" },
            ],
          },
        },
      },
    ],
    dataSources: [
      {
        id: "performance_cube",
        dataSourceRef: "demoReportSource",
        label: "Performance Cube",
        description: "Published performance source.",
        kind: "cube",
      },
      {
        id: "forecast_cube",
        dataSourceRef: "forecastCubeSource",
        label: "Forecast Cube",
        description: "Published forecast source.",
        kind: "cube",
      },
    ],
  },
};

const state = {
  binding: {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date", "channel"],
    selectedMeasures: ["available_impressions"],
  },
  selectedMeasures: ["totalSpend", "impressions"],
  selectedDimensions: ["eventDate", "channelId"],
  primaryMeasure: "totalSpend",
  selectedBuilderChartSelection: {
    kind: "legend",
    field: "channelId",
    value: "Display",
    label: "Display",
  },
  viewMode: "chart",
  chartSpec: {
    title: "Overview · Spend by Date and Channel",
    type: "area",
    xField: "eventDate",
    yFields: ["totalSpend"],
    seriesField: "channelId",
  },
  reportDocumentTitle: "Performance Overview",
  reportDocumentBlocks: [
    {
      id: "detailTable",
      kind: "tableBlock",
      title: "Detail Table",
      columns: [
        { key: "eventDate", label: "Date" },
        { key: "channelId", label: "Channel" },
        { key: "totalSpend", label: "Spend", format: "currency" },
      ],
    },
  ],
  reportDocumentLayout: {
    type: "stack",
    items: [
      { blockId: "primaryBuilder" },
      { blockId: "detailTable" },
    ],
  },
  reportStaticDatasets: [
    {
      id: "regional_mix_csv",
      label: "Regional Mix CSV",
      description: "CSV • 2 rows • 3 columns",
      dataSourceRef: "static_csv_regional_mix_csv",
      rows: [
        { region: "North", revenue: 1200, orders: 12 },
        { region: "South", revenue: 980, orders: 9 },
      ],
      columns: [
        { key: "region", label: "Region", kind: "dimension" },
        { key: "revenue", label: "Revenue", kind: "measure" },
        { key: "orders", label: "Orders", kind: "measure" },
      ],
    },
  ],
  scopeParams: {
    dateRange: {
      start: "2026-06-19",
      end: "2026-06-25",
    },
  },
  drillMetadata: {
    hierarchies: [],
    detailTargets: [],
    fieldActions: [],
  },
};

const workspaceModeKey = "reportBuilder.workspaceMode.desktop.designerRender";
const storage = new Map([
  [workspaceModeKey, JSON.stringify("design")],
]);

globalThis.window = {
  innerWidth: 1280,
  localStorage: {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    },
  },
};

function buildContext(windowFormState) {
  const nextContext = {
    locale: "en-US",
    identity: {
      dataSourceRef: "demoReportSource",
      dataSourceId: "demoReportSource",
      windowId: "designerRenderWindow",
    },
    metadata: {
      namespace: "Designer Render",
      dialogs: [],
    },
    signals: {
      collection: signal([]),
      control: signal({ loading: false, error: null }),
      windowForm: signal({ designerRender: windowFormState }),
      collectionInfo: signal({ hasMore: false }),
      input: signal({ parameters: {} }),
      form: signal({}),
      metrics: signal({}),
      selection: signal({ selected: null, rowIndex: -1 }),
      message: signal(null),
    },
    handlers: {
      dataSource: {
        setWindowFormData({ values = {}, replace = false } = {}) {
          nextContext.signals.windowForm.value = replace ? values : { ...nextContext.signals.windowForm.peek(), ...values };
        },
        setInputParameters(request = {}) {
          nextContext.signals.input.value = { ...nextContext.signals.input.peek(), parameters: request };
        },
        async fetchRecords() {
          return { rows: [], hasMore: false };
        },
        getFormData() {
          return nextContext.signals.form.peek() || {};
        },
      },
    },
    lookupHandler(name) {
      const normalized = String(name || "").trim();
      if (normalized.endsWith(".initializeState")) {
        return ({ state: nextState = {} } = {}) => nextState;
      }
      if (normalized.endsWith(".buildRequest")) {
        return ({ request = {} } = {}) => request;
      }
      if (normalized.endsWith(".resolveLookup")) {
        return () => null;
      }
      throw new Error(`missing hook ${normalized}`);
    },
    Context() {
      return nextContext;
    },
  };
  return nextContext;
}

function renderBuilder(windowFormState, mode = "design") {
  storage.set(workspaceModeKey, JSON.stringify(mode));
  return renderToStaticMarkup(
    React.createElement(ReportBuilder, {
      container,
      context: buildContext(windowFormState),
    }),
  );
}

function extractAuthoredValidationSection(html) {
  const start = html.indexOf("Authored Block Validation");
  const end = html.indexOf("forge-report-builder__body", start);
  if (start < 0 || end < 0) {
    return "";
  }
  return html.slice(start, end);
}

const html = renderBuilder(state);

assert.ok(!html.includes("Report Starters"));
assert.ok(!html.includes("Choose what to build"));
assert.ok(html.includes("Data Sources"));
assert.ok(html.includes("Edit data"));
assert.ok(!html.includes("Load report file"));
assert.ok(html.includes("Performance Cube"));
assert.ok(html.includes("Forecast Cube"));
assert.ok(html.includes("Regional Mix CSV"));
assert.ok(html.includes("Current source"));
assert.ok(html.includes("Cube"));
assert.ok(html.includes("View details for"));
assert.ok(html.includes("Overview · Spend by Date and Channel"));
assert.ok(html.includes("Report blocks"));
assert.ok(!html.includes("After Detail Table"));
assert.ok(html.includes("forge-report-builder__design-outline-node is-selected"));
assert.ok(html.includes("forge-report-builder__design-outline-toolbar"));
assert.ok(html.includes("Selected Fields"));
assert.ok(html.includes(">Add block<"));
assert.ok(html.includes("forge-report-builder__settings-anchor--metadata"));
assert.ok(html.includes("aria-label=\"Edit report metadata\""));
assert.ok(!html.includes("aria-label=\"Report document metadata\""));
assert.ok(!html.includes(">Edit metadata<"));
assert.ok(!html.includes("Shared report data"));
assert.ok(!html.includes("NEXT INSERT AFTER SHARED DATA"));
assert.ok(!html.includes("Edit data view"));
assert.ok(!html.includes("Preview report"));
assert.ok(!html.includes("Insert before"));
assert.ok(!html.includes("Insert after"));
assert.ok(!html.includes("Uses Current data selection."));
assert.ok(!html.includes("Open data view"));
assert.ok(!html.includes("Add drill branch"));
assert.ok(html.includes("Edit Detail Table"));
assert.ok(html.includes("More actions for Detail Table"));
assert.ok(!html.includes("Block Composer"));
assert.ok(!html.includes("Selected Item"));
assert.ok(html.includes("Detail Table"));
assert.ok(html.includes("Use the block toolbar above to add the first block.") || !html.includes("No blocks yet."));
assert.ok(html.includes("Report actions"));
assert.ok(html.includes('aria-label="Designer Render settings"'));
assert.ok(!html.includes('aria-label="Performance metrics settings"'));
assert.ok(html.includes("aria-pressed=\"true\""));
assert.ok(html.includes("Performance Overview"));
assert.ok(!html.includes(">Select<"));
assert.equal((html.match(/Open data editor/g) || []).length, 0);
assert.ok(!html.includes(">Data<"));
assert.ok(!html.includes(">Drill Downs<"));
assert.ok(!html.includes("Change report"));
assert.ok(!html.includes("Reset report"));
assert.ok(!html.includes("Pick another starter or a new report."));

const filterBarSelectionHtml = renderBuilder({
  ...state,
  reportDocumentBlocks: [
    {
      id: "scopeFilters",
      kind: "filterBarBlock",
      title: "Filters",
      paramIds: ["dateRange"],
    },
  ],
  reportDocumentLayout: {
    type: "stack",
    items: [
      { blockId: "primaryBuilder" },
      { blockId: "scopeFilters" },
    ],
  },
});

assert.ok(filterBarSelectionHtml.includes("Report blocks"));
assert.ok(filterBarSelectionHtml.includes("Filters"));
assert.ok(!filterBarSelectionHtml.includes("Semantic Context"));

const refinementBarSelectionHtml = renderBuilder({
  ...state,
  reportDocumentBlocks: [
    {
      id: "activeRefinements",
      kind: "refinementBarBlock",
      title: "Active Refinements",
      actionKinds: ["remove", "clearAll"],
      emptyLabel: "No active refinements",
    },
  ],
  reportDocumentLayout: {
    type: "stack",
    items: [
      { blockId: "primaryBuilder" },
      { blockId: "activeRefinements" },
    ],
  },
});

assert.ok(refinementBarSelectionHtml.includes("Report blocks"));
assert.ok(refinementBarSelectionHtml.includes("Active Refinements"));
assert.ok(!refinementBarSelectionHtml.includes("Semantic Context"));

const emptyTableHtml = renderBuilder({
  ...state,
  reportDocumentBlocks: [
    {
      id: "detailTable",
      kind: "tableBlock",
      title: "Detail Table",
      columns: [],
    },
  ],
  reportDocumentLayout: {
    type: "stack",
    items: [
      { blockId: "primaryBuilder" },
      { blockId: "detailTable" },
    ],
  },
});

assert.ok(emptyTableHtml.includes("Apply current fields for Detail Table"));
assert.ok(emptyTableHtml.includes("Empty Table does not define any table fields.") || emptyTableHtml.includes("Detail Table does not define any table fields."));

const emptyState = {
  binding: state.binding,
  selectedMeasures: ["totalSpend", "impressions"],
  selectedDimensions: ["eventDate", "channelId"],
  primaryMeasure: "totalSpend",
  viewMode: "chart",
  chartSpec: {
    title: "Overview · Spend by Date and Channel",
    type: "area",
    xField: "eventDate",
    yFields: ["totalSpend"],
    seriesField: "channelId",
  },
  reportDocumentTitle: "Performance Overview",
  reportDocumentBlocks: [],
  reportDocumentLayout: {
    type: "stack",
    items: [{ blockId: "primaryBuilder" }],
  },
  reportStaticDatasets: [
    {
      id: "regional_mix_csv",
      label: "Regional Mix CSV",
      description: "CSV • 2 rows • 3 columns",
      dataSourceRef: "static_csv_regional_mix_csv",
      rows: [
        { region: "North", revenue: 1200, orders: 12 },
        { region: "South", revenue: 980, orders: 9 },
      ],
      columns: [
        { key: "region", label: "Region", kind: "dimension" },
        { key: "revenue", label: "Revenue", kind: "measure" },
        { key: "orders", label: "Orders", kind: "measure" },
      ],
    },
  ],
  scopeParams: {
    dateRange: {
      start: "2026-06-19",
      end: "2026-06-25",
    },
  },
  drillMetadata: {
    hierarchies: [],
    detailTargets: [],
    fieldActions: [],
  },
};

const emptyHtml = renderBuilder(emptyState);

assert.ok(emptyHtml.includes("Data Sources"));
assert.ok(emptyHtml.includes("Start from"));
assert.ok(emptyHtml.includes("Report"));
assert.ok(!emptyHtml.includes("Compose report"));
assert.ok(emptyHtml.includes("Performance Cube"));
assert.ok(emptyHtml.includes("Forecast Cube"));
assert.ok(emptyHtml.includes("Regional Mix CSV"));
assert.ok(emptyHtml.includes("Current source"));
assert.ok(emptyHtml.includes("View details for"));
assert.ok(emptyHtml.includes("New report"));
assert.ok(emptyHtml.includes("Current"));
assert.ok(emptyHtml.includes("2 datasets"));
assert.ok(emptyHtml.includes("1 block"));
assert.ok(emptyHtml.includes("2 blocks"));
assert.ok(!emptyHtml.includes("Report actions"));
assert.ok(!emptyHtml.includes("Reset report"));
assert.ok(!emptyHtml.includes("Change report"));
assert.ok(!emptyHtml.includes("id=\"report-builder-design-group-document\""));
assert.ok(!emptyHtml.includes("Current data selection semantic context"));
assert.ok(!emptyHtml.includes("Scoped semantic fields for the currently selected report outline item."));
assert.ok(emptyHtml.includes("No blocks yet."));
assert.ok(!emptyHtml.includes("Use the toolbar above to add the first authored block."));
assert.ok(!emptyHtml.includes("Continue blank report"));
assert.ok(!emptyHtml.includes("Current starter"));
assert.ok(!emptyHtml.includes('aria-label="Choose starter"'));

const collapsedInvalidPreviewHtml = renderBuilder({
  ...state,
  reportDocumentBlocks: [
    {
      id: "invalidChart",
      kind: "chartBlock",
      title: "Chart",
      datasetRef: "static_missing",
      chartSpec: {
        title: "Broken chart",
        type: "bar",
        xField: "region",
        yFields: ["revenue"],
      },
    },
    {
      id: "invalidKpi",
      kind: "kpiBlock",
      title: "Headline KPI",
      datasetRef: "static_missing",
      valueField: "revenue",
    },
  ],
  reportDocumentLayout: {
    type: "stack",
    items: [
      { blockId: "invalidChart" },
      { blockId: "invalidKpi" },
    ],
  },
}, "preview");
const collapsedInvalidPreviewValidationHtml = extractAuthoredValidationSection(collapsedInvalidPreviewHtml);

assert.ok(collapsedInvalidPreviewValidationHtml.includes("Authored Block Validation"));
assert.ok(collapsedInvalidPreviewValidationHtml.includes("Show details"));
assert.ok(collapsedInvalidPreviewValidationHtml.includes("5 issues"));
assert.ok(collapsedInvalidPreviewValidationHtml.includes("2 blocks"));
assert.ok(collapsedInvalidPreviewValidationHtml.includes("+4 more issues"));
assert.equal(collapsedInvalidPreviewValidationHtml.split('<span class="bp6-button-text">Edit block</span>').length - 1, 1);

const singleIssuePreviewHtml = renderBuilder({
  ...state,
  reportDocumentBlocks: [
    {
      id: "invalidKpi",
      kind: "kpiBlock",
      title: "Headline KPI",
      datasetRef: "primary",
      valueField: "missingRevenue",
    },
  ],
  reportDocumentLayout: {
    type: "stack",
    items: [{ blockId: "invalidKpi" }],
  },
}, "preview");
const singleIssuePreviewValidationHtml = extractAuthoredValidationSection(singleIssuePreviewHtml);

assert.ok(singleIssuePreviewValidationHtml.includes("Authored Block Validation"));
assert.ok(!singleIssuePreviewValidationHtml.includes("Show details"));
assert.equal(singleIssuePreviewValidationHtml.split('<span class="bp6-button-text">Edit block</span>').length - 1, 1);

console.log("reportBuilderDesignerRender ✓ keeps authored design trees block-first while preserving primary-result authoring for empty documents");

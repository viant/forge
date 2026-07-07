import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { signal } from "@preact/signals-react";

import ReportBuilder from "./ReportBuilder.jsx";
import { applyReportBuilderPersistedRuntimePreviewInteraction } from "./reportBuilderRuntimePreviewInteractionPersistence.js";

const container = {
  id: "previewAuthoredRender",
  stateKey: "previewAuthoredRender",
  title: "Preview Authored Render",
  dataSourceRef: "demoReportSource",
  reportBuilder: {
    filterPresentation: "rail-left",
    semanticModel: {
      modelRef: "model://example/performance/delivery@v1",
      version: 1,
      label: "Ad Delivery",
      entities: [
        {
          id: "line_delivery",
          label: "Line Delivery",
          dimensions: [
            { id: "event_date", label: "Date", dataType: "date" },
            { id: "channel", label: "Channel", dataType: "string" },
          ],
          measures: [
            { id: "spend", label: "Spend", dataType: "number", aggregation: "sum", format: "currency" },
            { id: "impressions", label: "Impressions", dataType: "number", aggregation: "sum", format: "compactNumber" },
          ],
        },
      ],
    },
    primaryMeasure: "totalSpend",
    measures: [
      { id: "totalSpend", key: "totalSpend", semanticRef: "spend", label: "Spend", default: true, format: "currency" },
      { id: "impressions", key: "impressions", semanticRef: "impressions", label: "Impressions", default: true, format: "compactNumber" },
    ],
    dimensions: [
      { id: "eventDate", key: "eventDate", semanticRef: "event_date", label: "Date", default: true, chartAxis: true },
      { id: "channelId", key: "channelId", semanticRef: "channel", label: "Channel", default: true },
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
      runtimePreview: {
        enabled: true,
      },
    },
  },
};

const state = {
  binding: {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date", "channel"],
    selectedMeasures: ["spend", "impressions"],
  },
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
  reportDocumentBlocks: [
    {
      id: "narrativeIntro",
      kind: "markdownBlock",
      title: "Narrative",
      markdown: "## Narrative\nReader-facing context.",
    },
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
      { blockId: "narrativeIntro" },
    ],
  },
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

const storage = new Map([
  ["reportBuilder.workspaceMode.desktop.previewAuthoredRender", JSON.stringify("preview")],
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

const context = {
  locale: "en-US",
  identity: {
    dataSourceRef: "demoReportSource",
    dataSourceId: "demoReportSource",
    windowId: "previewAuthoredRenderWindow",
  },
  metadata: {
    namespace: "Preview Authored Render",
    dialogs: [],
  },
  signals: {
    collection: signal([]),
    control: signal({ loading: false, error: null }),
    windowForm: signal({ previewAuthoredRender: state }),
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
        context.signals.windowForm.value = replace ? values : { ...context.signals.windowForm.peek(), ...values };
      },
      setInputParameters(request = {}) {
        context.signals.input.value = { ...context.signals.input.peek(), parameters: request };
      },
      async fetchRecords() {
        return { rows: [], hasMore: false };
      },
      getFormData() {
        return context.signals.form.peek() || {};
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
    return context;
  },
};

const html = renderToStaticMarkup(
  React.createElement(ReportBuilder, {
    container,
    context,
  }),
);

// Legacy persisted "preview" mode now folds into the primary Report surface.
assert.ok(html.includes('aria-label="Authored report"'));
assert.ok(!html.includes('aria-label="Authored runtime preview"'));
assert.ok(html.includes("Narrative"));
assert.ok(html.includes("Detail Table"));
assert.ok(html.includes("Semantic binding: Ad Delivery • Entity: Line Delivery"));
assert.ok(html.includes("Filters"));
assert.ok(html.includes("Date Range"));
assert.ok(html.includes("Date Range"));
assert.ok(!html.includes("Change these report filters here."));
assert.ok(!html.includes("forge-report-builder__toolbar-group--scope"));
assert.ok(!html.includes('class="forge-report-builder__result-header"'));
assert.ok(!html.includes("Current result summary"));
assert.ok(!html.includes("Primary result"));
assert.ok(!html.includes('aria-label="Semantic context summary"'));
assert.ok(!html.includes("forge-report-builder__runtime-preview-header"));

storage.set("reportBuilder.workspaceMode.desktop.previewAuthoredRender", JSON.stringify("report"));
const reportContext = {
  ...context,
};
const reportHtml = renderToStaticMarkup(
  React.createElement(ReportBuilder, {
    container,
    context: reportContext,
  }),
);

assert.ok(reportHtml.includes('aria-label="Authored report"'));
assert.ok(reportHtml.includes("Detail Table"));
assert.ok(reportHtml.includes("Narrative"));
assert.ok(reportHtml.includes("Semantic binding: Ad Delivery • Entity: Line Delivery"));
assert.ok(reportHtml.includes("report-builder-filters-panel-heading"));
assert.ok(reportHtml.includes("Refine scope and targeting for this report."));
assert.ok(!reportHtml.includes("Change these report filters here."));
assert.ok(!reportHtml.includes("forge-report-builder__toolbar-group--scope"));
assert.ok(!reportHtml.includes('aria-label="Semantic context summary"'));
assert.ok(!reportHtml.includes("Compiled from the current builder state using the generic Forge runtime contract."));
assert.ok(!reportHtml.includes("forge-report-builder__runtime-preview-header"));

const reportWithDetailStateContext = {
  ...context,
  signals: {
    ...context.signals,
    windowForm: signal({
      previewAuthoredRender: applyReportBuilderPersistedRuntimePreviewInteraction(state, {
        refinements: [],
        drillTransitions: [],
        hostIntent: {
          intentKind: "detailTarget",
          title: "Channel detail",
          description: "Resolved channel detail route from the authored report surface.",
          navigationMode: "hostRoute",
          targetRef: "target://example/channel-detail",
          parameters: {
            channel: "Display",
          },
        },
        detailDiagnostic: null,
      }),
    }),
  },
};
reportWithDetailStateContext.Context = () => reportWithDetailStateContext;

const reportWithDetailStateHtml = renderToStaticMarkup(
  React.createElement(ReportBuilder, {
    container,
    context: reportWithDetailStateContext,
  }),
);

assert.ok(reportWithDetailStateHtml.includes("Channel detail"));
assert.ok(reportWithDetailStateHtml.includes("target://example/channel-detail"));
assert.ok(reportWithDetailStateHtml.includes("channel"));
assert.ok(reportWithDetailStateHtml.includes("Display"));

const providerBackedContainer = {
  ...container,
  id: "previewAuthoredRenderProviderBacked",
  stateKey: "previewAuthoredRenderProviderBacked",
  reportBuilder: {
    ...container.reportBuilder,
  },
};
delete providerBackedContainer.reportBuilder.semanticModel;

const providerBackedState = {
  ...state,
  reportDocumentReopenSession: {
    reportId: "previewAuthoredRenderProviderBacked",
    title: "Performance Overview",
    documentVersion: 7,
    reopenedConfig: {
      binding: state.binding,
    },
    reopenedSemanticSummary: {
      kind: "semantic",
      modelRef: "model://example/performance/delivery@v1",
      modelLabel: "Canonical Ad Delivery",
      entity: "line_delivery",
      entityLabel: "Canonical Line Delivery",
      selectedDimensions: [
        { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date" },
        { id: "channel", rawId: "channelId", label: "Canonical Channel" },
      ],
      selectedMeasures: [
        { id: "spend", rawId: "totalSpend", label: "Canonical Spend", format: "currency" },
        { id: "impressions", rawId: "impressions", label: "Canonical Impressions", format: "compactNumber" },
      ],
      selectedParameters: [
        { id: "reporting_window", rawId: "dateRange", label: "Canonical Reporting Window" },
      ],
    },
    reopenedSemanticFingerprint: JSON.stringify({
      modelRef: "model://example/performance/delivery@v1",
      selection: {
        entity: "line_delivery",
        dimensions: ["event_date", "channel"],
        measures: ["spend", "impressions"],
        parameters: {
          reporting_window: {
            start: "2026-06-19",
            end: "2026-06-25",
          },
        },
      },
    }),
    liveSnapshot: {
      config: {
        title: "Preview Authored Render",
      },
      state: {
        selectedMeasures: ["totalSpend", "impressions"],
        selectedDimensions: ["eventDate", "channelId"],
      },
    },
  },
};

const providerBackedContext = {
  ...context,
  identity: {
    ...context.identity,
    windowId: "previewAuthoredRenderProviderBackedWindow",
  },
  signals: {
    ...context.signals,
    windowForm: signal({ previewAuthoredRenderProviderBacked: providerBackedState }),
  },
  handlers: {
    ...context.handlers,
    semanticModel: {
      async listModels() {
        return { rows: [], nextCursor: "" };
      },
      async getModel() {
        return container.reportBuilder.semanticModel;
      },
      async validateSelection() {
        return {
          valid: true,
          normalizedSelection: {
            entity: "line_delivery",
            dimensions: ["event_date", "channel"],
            measures: ["spend", "impressions"],
          },
          diagnostics: [],
        };
      },
    },
  },
  Context() {
    return providerBackedContext;
  },
};

const providerBackedPreviewHtml = renderToStaticMarkup(
  React.createElement(ReportBuilder, {
    container: providerBackedContainer,
    context: providerBackedContext,
  }),
);

// Without a persisted mode the builder now defaults to the primary Report surface.
assert.ok(providerBackedPreviewHtml.includes("Semantic binding: Canonical Ad Delivery • Entity: Canonical Line Delivery"));
assert.ok(providerBackedPreviewHtml.includes("Semantic validation: Loading semantic model metadata…"));
assert.ok(!providerBackedPreviewHtml.includes('aria-label="Semantic context summary"'));

storage.set("reportBuilder.workspaceMode.desktop.previewAuthoredRenderProviderBacked", JSON.stringify("design"));
const providerBackedDesignHtml = renderToStaticMarkup(
  React.createElement(ReportBuilder, {
    container: providerBackedContainer,
    context: providerBackedContext,
  }),
);

assert.ok(providerBackedDesignHtml.includes("Model Canonical Ad Delivery"));
assert.ok(providerBackedDesignHtml.includes("Entity Canonical Line Delivery"));
assert.ok(providerBackedDesignHtml.includes("Canonical Ad Delivery"));
assert.ok(providerBackedDesignHtml.includes("Canonical Line Delivery"));

storage.set("reportBuilder.workspaceMode.desktop.previewAuthoredRenderProviderBacked", JSON.stringify("report"));
const providerBackedReportHtml = renderToStaticMarkup(
  React.createElement(ReportBuilder, {
    container: providerBackedContainer,
    context: providerBackedContext,
  }),
);

assert.ok(providerBackedReportHtml.includes("Semantic binding: Canonical Ad Delivery • Entity: Canonical Line Delivery"));
assert.ok(providerBackedReportHtml.includes("Semantic validation: Loading semantic model metadata…"));
assert.ok(!providerBackedReportHtml.includes('aria-label="Semantic context summary"'));

console.log("reportBuilderPreviewAuthoredRender ✓ the report surface renders the authored output without extra semantic or explanatory chrome, including legacy preview persistence");

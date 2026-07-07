import assert from "node:assert/strict";

import {
  buildReportBuilderSavedReportExportRequestFromBuilderState,
} from "./reportBuilderSavedReportPayload.js";
import {
  buildReportBuilderRuntimePreview,
  buildReportBuilderRuntimePreviewModel,
} from "./reportBuilderRuntimePreview.js";

const container = {
  id: "demoReportBuilder",
  stateKey: "demoReportBuilder",
  title: "Report Builder Demo",
  dataSourceRef: "demoReportSource",
};

const config = {
  result: {
    defaultMode: "chart",
    chartCreationMode: "explicit",
  },
  binding: {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date", "channel"],
    selectedMeasures: ["available_impressions"],
  },
  measures: [
    { id: "avails", key: "avails", semanticRef: "available_impressions", label: "Avails", format: "compactNumber" },
  ],
  dimensions: [
    { id: "eventDate", key: "eventDate", semanticRef: "event_date", label: "Date", chartAxis: true },
    { id: "channelV2", key: "channelV2", semanticRef: "channel", label: "Channel" },
  ],
  staticFilters: [
    { id: "dateRange", type: "dateRange", label: "Date Range", semanticRef: "reporting_window" },
  ],
};

const semanticSummary = {
  kind: "semantic",
  modelRef: "model://example/performance/delivery@v1",
  modelLabel: "Ad Delivery",
  entity: "line_delivery",
  entityLabel: "Line Delivery",
  selectedDimensions: [
    { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
    { id: "channel", rawId: "channelV2", label: "Channel" },
  ],
  selectedMeasures: [
    { id: "available_impressions", rawId: "avails", label: "Available Impressions", format: "compactNumber" },
  ],
};

const semanticModel = {
  modelRef: "model://example/performance/delivery@v1",
  version: 1,
  label: "Ad Delivery",
  entities: [
    {
      id: "line_delivery",
      label: "Line Delivery",
      dimensions: [
        { id: "event_date", label: "Delivery Date" },
        { id: "channel", label: "Channel" },
      ],
      measures: [
        { id: "available_impressions", label: "Available Impressions", format: "compactNumber" },
      ],
    },
  ],
};

const state = {
  selectedMeasures: ["avails"],
  primaryMeasure: "avails",
  selectedDimensions: ["eventDate", "channelV2"],
  viewMode: "table",
  chartSpec: null,
  scopeParams: {
    dateRange: {
      start: "2026-05-01",
      end: "2026-05-04",
    },
  },
  binding: {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date", "channel"],
    selectedMeasures: ["available_impressions"],
  },
  reportDocumentBlocks: [
    {
      id: "inventoryNote",
      kind: "markdownBlock",
      title: "Inventory Note",
      markdown: "## Inventory Note\nLive note from reopened state.",
    },
  ],
  reportDocumentLayout: {
    type: "stack",
    items: [
      { blockId: "primaryBuilder" },
      { blockId: "inventoryNote" },
    ],
  },
};

const runtimeModel = buildReportBuilderRuntimePreviewModel({
  container,
  config,
  state,
  semanticSummary,
  binding: state.binding,
  semanticModel,
});

const runtimeArtifact = buildReportBuilderRuntimePreview({
  model: runtimeModel,
  rows: [
    { eventDate: "2026-05-01", channelV2: "Display", avails: 101 },
    { eventDate: "2026-05-02", channelV2: "CTV", avails: 202 },
  ],
  rowsResolved: true,
  hasMore: false,
  runtimeTitle: "Capacity Trend Q3",
});

const reopenedSavedRecordPayload = {
  version: 1,
  kind: "reportBuilder.savedReportPayload",
  payloadId: "rbreport_capacity_q3_channel_trend",
  sourceArtifactId: "capacity_q3_channel_trend",
  savedAt: 9500,
  title: "Capacity Trend Q3",
  sourceSession: {
    sourceRef: {
      kind: "dashboard.reportBuilder",
      containerId: "demoReportBuilder",
      stateKey: "demoReportBuilder",
    },
  },
  reportDocument: {
    version: 1,
    kind: "reportDocument",
    id: "capacityTrendQ3",
    title: "Capacity Trend Q3",
    blocks: [
      {
        id: "primaryBuilder",
        kind: "reportBuilderBlock",
        title: "Capacity Trend Q3",
      },
    ],
  },
  reportSpec: {
    version: 1,
    kind: "reportSpec",
    title: "Capacity Trend Q3",
    blocks: [
      { id: "primaryTable", kind: "tableBlock", title: "Capacity Trend Q3" },
    ],
    datasets: [
      {
        id: "primary",
        request: {
          dimensions: { eventDate: true },
          measures: { avails: true },
        },
      },
    ],
  },
};

const exportRequest = buildReportBuilderSavedReportExportRequestFromBuilderState(
  reopenedSavedRecordPayload,
  {
    runtimeArtifact,
    documentVersion: 11,
    savedAt: 9900,
    format: "pdf",
    container,
    config,
    state,
    semanticSummary,
    semanticModel,
  },
);

assert.equal(exportRequest?.source?.from, "savedPayload");
assert.equal(exportRequest?.source?.payloadId, "rbreport_capacity_q3_channel_trend");
assert.equal(exportRequest?.source?.reportId, "capacityTrendQ3");
assert.equal(exportRequest?.source?.documentVersion, 11);
assert.equal(exportRequest?.reportSpec?.semanticSummary?.modelLabel, "Ad Delivery");
assert.equal(exportRequest?.reportSpec?.semanticSummary?.entityLabel, "Line Delivery");
assert.equal(exportRequest?.reportPrint?.title, "Report Builder Demo");
assert.equal(JSON.stringify(exportRequest).includes("Inventory Note"), true);
assert.equal(JSON.stringify(exportRequest).includes("Live note from reopened state."), true);

const canonicalSemanticSummary = {
  kind: "semantic",
  modelRef: "model://example/performance/delivery@v1",
  modelLabel: "Canonical Ad Delivery",
  entity: "line_delivery",
  entityLabel: "Canonical Line Delivery",
  selectedDimensions: [
    { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date" },
    { id: "channel", rawId: "channelV2", label: "Canonical Channel" },
  ],
  selectedMeasures: [
    { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions", format: "compactNumber" },
  ],
  selectedParameters: [
    { id: "reporting_window", rawId: "dateRange", label: "Canonical Reporting Window" },
  ],
};

const canonicalExportRequest = buildReportBuilderSavedReportExportRequestFromBuilderState(
  reopenedSavedRecordPayload,
  {
    runtimeArtifact,
    documentVersion: 11,
    savedAt: 9900,
    format: "pdf",
    container,
    config,
    state,
    semanticSummary: canonicalSemanticSummary,
    semanticModel: null,
  },
);

assert.equal(canonicalExportRequest?.reportSpec?.semanticSummary?.modelLabel, "Canonical Ad Delivery");
assert.equal(canonicalExportRequest?.reportSpec?.semanticSummary?.entityLabel, "Canonical Line Delivery");
assert.equal(canonicalExportRequest?.reportSpec?.semanticSummary?.selectedDimensions?.[0]?.label, "Canonical Delivery Date");
assert.equal(canonicalExportRequest?.reportSpec?.semanticSummary?.selectedMeasures?.[0]?.label, "Canonical Available Impressions");
assert.equal(canonicalExportRequest?.reportSpec?.semanticSummary?.selectedParameters?.[0]?.label, "Canonical Reporting Window");

const reopenedSavedViewRecord = {
  reportId: "capacityTrendQ3",
  title: "Capacity Trend Q3 Saved View",
  documentVersion: 11,
  savedAt: 9800,
  document: {
    version: 1,
    kind: "reportDocument",
    id: "capacityTrendQ3",
    title: "Capacity Trend Q3 Saved View",
  },
  reportSpec: reopenedSavedRecordPayload.reportSpec,
  source: {
    kind: "reportBuilder.savedView",
    reportId: "capacityTrendQ3",
    sourceArtifactId: "saved_view_capacityTrendQ3",
  },
  exportRequest: {
    version: 1,
    kind: "reportExportRequest",
    target: { format: "pdf" },
    source: {
      from: "savedView",
      artifactKind: "reportBuilder.savedView",
      artifactRef: "reportBuilder.savedView://saved_view_capacityTrendQ3",
      sourceArtifactId: "saved_view_capacityTrendQ3",
      reportId: "capacityTrendQ3",
      documentVersion: 11,
      title: "Capacity Trend Q3 Saved View",
    },
    reportSpec: reopenedSavedRecordPayload.reportSpec,
    reportFill: runtimeArtifact.reportFill,
    reportPrint: runtimeArtifact.reportPrint,
  },
};

const savedViewExportRequest = buildReportBuilderSavedReportExportRequestFromBuilderState(
  reopenedSavedViewRecord,
  {
    runtimeArtifact,
    documentVersion: 11,
    savedAt: 9901,
    format: "pdf",
    container,
    config,
    state,
    semanticSummary,
    semanticModel,
  },
);

assert.equal(savedViewExportRequest?.source?.from, "savedView");
assert.equal(savedViewExportRequest?.source?.sourceArtifactId, "saved_view_capacityTrendQ3");
assert.equal(savedViewExportRequest?.source?.reportId, "capacityTrendQ3");
assert.equal(savedViewExportRequest?.reportPrint?.title, "Report Builder Demo");
assert.equal(JSON.stringify(savedViewExportRequest).includes("Inventory Note"), true);

const reopenedPublishedSnapshotRecord = {
  reportId: "capacityTrendQ3",
  title: "Capacity Trend Q3 Published Snapshot",
  documentVersion: 11,
  savedAt: 9850,
  document: {
    version: 1,
    kind: "reportDocument",
    id: "capacityTrendQ3",
    title: "Capacity Trend Q3 Published Snapshot",
  },
  reportSpec: reopenedSavedRecordPayload.reportSpec,
  source: {
    kind: "reportBuilder.publishedSnapshot",
    reportId: "capacityTrendQ3",
    sourceArtifactId: "published_snapshot_capacityTrendQ3",
  },
  exportRequest: {
    version: 1,
    kind: "reportExportRequest",
    target: { format: "pdf" },
    source: {
      from: "publishedSnapshot",
      artifactKind: "reportBuilder.publishedSnapshot",
      artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3",
      sourceArtifactId: "published_snapshot_capacityTrendQ3",
      reportId: "capacityTrendQ3",
      documentVersion: 11,
      title: "Capacity Trend Q3 Published Snapshot",
    },
    reportSpec: reopenedSavedRecordPayload.reportSpec,
    reportFill: runtimeArtifact.reportFill,
    reportPrint: runtimeArtifact.reportPrint,
  },
};

const publishedSnapshotExportRequest = buildReportBuilderSavedReportExportRequestFromBuilderState(
  reopenedPublishedSnapshotRecord,
  {
    runtimeArtifact,
    documentVersion: 11,
    savedAt: 9902,
    format: "pdf",
    container,
    config,
    state,
    semanticSummary,
    semanticModel,
  },
);

assert.equal(publishedSnapshotExportRequest?.source?.from, "publishedSnapshot");
assert.equal(publishedSnapshotExportRequest?.source?.sourceArtifactId, "published_snapshot_capacityTrendQ3");
assert.equal(publishedSnapshotExportRequest?.source?.reportId, "capacityTrendQ3");
assert.equal(publishedSnapshotExportRequest?.reportPrint?.title, "Report Builder Demo");
assert.equal(JSON.stringify(publishedSnapshotExportRequest).includes("Inventory Note"), true);

console.log("reportBuilderSavedReportExportRequest ✓ rebuilds reopened export requests from the live builder/runtime state");

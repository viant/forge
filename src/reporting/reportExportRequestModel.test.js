import assert from "node:assert/strict";

import { buildReportBuilderReportSpec } from "./reportSpecModel.js";
import { buildReportFillFromReportSpec } from "./reportFillModel.js";
import { buildReportPrintFromReportFill } from "./reportPrintModel.js";
import {
  buildDraftReportExportRequest,
  buildReportExportRequest,
  buildReportExportArtifactRef,
  buildPublishedSnapshotReportExportRequest,
  buildSavedReportExportRequest,
  buildSavedViewReportExportRequest,
} from "./reportExportRequestModel.js";
import { validateReportExportRequest } from "./schema/reportSchemas.js";
import { buildAuthoredDerivedCompactArtifacts } from "./fixtures/authoredDerivedCompactArtifactBuilder.js";

const container = {
  id: "performanceBuilder",
  stateKey: "performanceBuilder",
  title: "Performance Report",
  dataSourceRef: "demoReportSource",
};

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

const reportPrint = buildReportPrintFromReportFill({
  reportSpec,
  reportFill,
});

assert.equal(
  buildReportExportArtifactRef({
    artifactKind: "dashboard.reportBuilder",
    containerId: "performanceBuilder",
  }),
  "dashboard.reportBuilder://performanceBuilder",
);

const draftExportRequest = buildDraftReportExportRequest({
  reportDocument: {
    id: "performanceReport",
    title: "Performance Report",
  },
  reportSpec,
  reportFill,
  reportPrint,
  format: "pdf",
  metadata: {
    conversationId: "conv-123",
    workspaceId: "steward",
    renderHints: {
      theme: "print",
    },
  },
});

assert.equal(draftExportRequest.kind, "reportExportRequest");
assert.equal(draftExportRequest.target.format, "pdf");
assert.equal(draftExportRequest.source.from, "draft");
assert.equal(draftExportRequest.source.artifactKind, "dashboard.reportBuilder");
assert.equal(draftExportRequest.source.artifactRef, "dashboard.reportBuilder://performanceBuilder");
assert.equal(draftExportRequest.source.reportId, "performanceReport");
assert.equal(draftExportRequest.source.title, "Performance Report");
assert.deepEqual(draftExportRequest.metadata, {
  conversationId: "conv-123",
  workspaceId: "steward",
  renderHints: {
    theme: "print",
  },
});
assert.equal(validateReportExportRequest(draftExportRequest).valid, true);

const hostedWindowDraftSpec = buildReportBuilderReportSpec({
  container: {
    windowKey: "forecastingCubeBuilder",
    windowId: "mcpui:forecastingCubeBuilder",
    title: "Forecasting",
    dataSourceRef: "forecasting_cube_report",
  },
  config,
  state,
});

const hostedWindowDraftFill = buildReportFillFromReportSpec(hostedWindowDraftSpec, {
  primary: {
    rows: [
      { eventDate: "2026-05-01", channelId: "DOOH", totalSpend: 1, impressions: 2 },
    ],
  },
});

const hostedWindowDraftPrint = buildReportPrintFromReportFill({
  reportSpec: hostedWindowDraftSpec,
  reportFill: hostedWindowDraftFill,
});

const hostedWindowDraftExportRequest = buildDraftReportExportRequest({
  reportDocument: {
    title: "Forecasting",
  },
  reportSpec: hostedWindowDraftSpec,
  reportFill: hostedWindowDraftFill,
  reportPrint: hostedWindowDraftPrint,
  format: "pdf",
});

const displayMappedSpec = JSON.parse(JSON.stringify(reportSpec));
displayMappedSpec.blocks.push({
  id: "channelNarrative",
  kind: "markdownBlock",
  title: "Channel readout",
  datasetRef: "primary",
  markdown: "Leader: **${row.channelId}**.",
  templateFieldDisplayMap: {
    channelId: {
      sourceKey: "channelId",
      displayKey: "channel.label",
      displayValueMap: { "2": "CTV" },
    },
  },
});
displayMappedSpec.layoutIntent.blockOrder.push("channelNarrative");
const displayMappedFill = buildReportFillFromReportSpec(displayMappedSpec, {
  primary: {
    rows: [{ eventDate: "2026-05-01", channelId: 2, totalSpend: 40400, impressions: 16500 }],
  },
});
const displayMappedPrint = buildReportPrintFromReportFill({
  reportSpec: displayMappedSpec,
  reportFill: displayMappedFill,
});
const displayMappedDraftExportRequest = buildDraftReportExportRequest({
  reportDocument: { id: "displayMappedReport", title: "Display Mapped Report" },
  reportSpec: displayMappedSpec,
  reportFill: displayMappedFill,
  reportPrint: displayMappedPrint,
  format: "pdf",
});
assert.ok(displayMappedDraftExportRequest);
assert.equal(displayMappedDraftExportRequest.reportFill.blocks.find((block) => block.id === "channelNarrative")?.templateFieldDisplayMap, undefined);

assert.ok(hostedWindowDraftExportRequest);
assert.equal(hostedWindowDraftExportRequest.source.artifactRef, "dashboard.reportBuilder://forecastingCubeBuilder");

const presetDraftExportRequest = buildDraftReportExportRequest({
  reportDocument: {
    id: "forecastInventoryBrief",
    title: "Forecast Inventory Brief",
    templateId: "forecast_inventory_brief",
    templateLabel: "Forecast Inventory Brief",
  },
  reportSpec: hostedWindowDraftSpec,
  reportFill: hostedWindowDraftFill,
  reportPrint: hostedWindowDraftPrint,
  format: "pdf",
});

assert.ok(presetDraftExportRequest);
assert.equal(presetDraftExportRequest.source.from, "preset");
assert.equal(presetDraftExportRequest.source.artifactKind, "reportBuilder.reportTemplate");
assert.equal(presetDraftExportRequest.source.artifactRef, "reportBuilder.reportTemplate://forecastingCubeBuilder:forecast_inventory_brief");
assert.equal(presetDraftExportRequest.source.sourceArtifactId, "forecast_inventory_brief");
assert.equal(presetDraftExportRequest.source.windowKey, "forecastingCubeBuilder");
assert.equal(presetDraftExportRequest.source.templateLabel, "Forecast Inventory Brief");
assert.equal(validateReportExportRequest(presetDraftExportRequest).valid, true);

const staleDraftExportRequest = JSON.parse(JSON.stringify(draftExportRequest));
staleDraftExportRequest.reportPrint.fillHash = "fnv1a:deadbeef";
assert.equal(validateReportExportRequest(staleDraftExportRequest).valid, false);

const savedReportPayload = {
  version: 1,
  kind: "reportBuilder.savedReportPayload",
  payloadId: "rbreport_performance_snapshot",
  savedAt: 9100,
  title: "Performance Snapshot",
  sourceArtifactId: "performance_snapshot",
  reportDocument: {
    version: 1,
    kind: "reportDocument",
    id: "performanceSnapshot",
    title: "Performance Snapshot",
  },
  reportSpec,
};

const savedExportRequest = buildSavedReportExportRequest({
  savedReportPayload,
  reportFill,
  reportPrint,
  documentVersion: 7,
  format: "pdf",
});

assert.equal(savedExportRequest.source.from, "savedPayload");
assert.equal(savedExportRequest.source.artifactKind, "reportBuilder.savedReportPayload");
assert.equal(savedExportRequest.source.artifactRef, "reportBuilder.savedReportPayload://rbreport_performance_snapshot");
assert.equal(savedExportRequest.source.payloadId, "rbreport_performance_snapshot");
assert.equal(savedExportRequest.source.documentVersion, 7);
assert.equal(savedExportRequest.source.title, "Performance Snapshot");
assert.equal(savedExportRequest.reportPrint.title, "Performance Report");
assert.equal(validateReportExportRequest(savedExportRequest).valid, true);

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

assert.ok(savedViewExportRequest);
assert.equal(savedViewExportRequest.source.from, "savedView");
assert.equal(savedViewExportRequest.source.artifactKind, "reportBuilder.savedView");
assert.equal(savedViewExportRequest.source.artifactRef, "reportBuilder.savedView://saved_view_capacity_q3");
assert.equal(savedViewExportRequest.source.sourceArtifactId, "saved_view_capacity_q3");
assert.equal(savedViewExportRequest.source.reportId, "capacityQ3");
assert.equal(savedViewExportRequest.source.documentVersion, 8);
assert.equal(savedViewExportRequest.source.title, "Capacity Q3 Saved View");
assert.equal(validateReportExportRequest(savedViewExportRequest).valid, true);

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

assert.ok(publishedSnapshotExportRequest);
assert.equal(publishedSnapshotExportRequest.source.from, "publishedSnapshot");
assert.equal(publishedSnapshotExportRequest.source.artifactKind, "reportBuilder.publishedSnapshot");
assert.equal(publishedSnapshotExportRequest.source.artifactRef, "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3");
assert.equal(publishedSnapshotExportRequest.source.sourceArtifactId, "published_snapshot_capacity_q3");
assert.equal(publishedSnapshotExportRequest.source.reportId, "capacityQ3");
assert.equal(publishedSnapshotExportRequest.source.documentVersion, 9);
assert.equal(publishedSnapshotExportRequest.source.title, "Capacity Q3 Published Snapshot");
assert.equal(validateReportExportRequest(publishedSnapshotExportRequest).valid, true);

const explicitPresetExportRequest = buildReportExportRequest({
  format: "pdf",
  source: {
    from: "preset",
    artifactKind: "reportBuilder.reportTemplate",
    artifactRef: "reportBuilder.reportTemplate://metricReportBuilder:performance_inventory_brief",
    sourceArtifactId: "performance_inventory_brief",
    windowKey: "metricReportBuilder",
    templateLabel: "Performance Inventory Brief",
    title: "Performance Inventory Brief",
  },
  reportSpec,
  reportFill,
  reportPrint,
});

assert.ok(explicitPresetExportRequest);
assert.equal(validateReportExportRequest(explicitPresetExportRequest).valid, true);

assert.equal(buildSavedReportExportRequest({
  savedReportPayload: {
    ...savedReportPayload,
    payloadId: "",
  },
  reportFill,
  reportPrint,
  documentVersion: 7,
  format: "pdf",
}), null);

assert.equal(buildSavedViewReportExportRequest({
  savedView: {
    id: "",
    kind: "reportBuilder.savedView",
  },
  reportSpec,
  reportFill,
  reportPrint,
}), null);

assert.equal(buildPublishedSnapshotReportExportRequest({
  publishedSnapshot: {
    id: "",
    kind: "reportBuilder.publishedSnapshot",
  },
  reportSpec,
  reportFill,
  reportPrint,
}), null);

const sourceLessReportSpec = buildReportBuilderReportSpec({
  container: { title: "Performance Report" },
  config,
  state,
});
const sourceLessReportFill = buildReportFillFromReportSpec(sourceLessReportSpec, {
  primary: { rows: [] },
});
const sourceLessReportPrint = buildReportPrintFromReportFill({
  reportSpec: sourceLessReportSpec,
  reportFill: sourceLessReportFill,
});
const sourceLessDraftExportRequest = buildDraftReportExportRequest({
  reportDocument: { id: "performanceReport", title: "Performance Report" },
  reportSpec: sourceLessReportSpec,
  reportFill: sourceLessReportFill,
  reportPrint: sourceLessReportPrint,
  format: "pdf",
});
assert.equal(sourceLessDraftExportRequest, null);
assert.equal(buildReportExportArtifactRef({
  artifactKind: "dashboard.reportBuilder",
  reportId: "performanceReport",
}), "dashboard.reportBuilder://performanceReport");

const {
  reportSpec: authoredDerivedSpec,
  reportFill: authoredDerivedFill,
  reportPrint: authoredDerivedPrint,
} = buildAuthoredDerivedCompactArtifacts({
  title: "Derived Export Report",
  container: {
    id: "derivedExportBuilder",
    stateKey: "derivedExportBuilder",
    title: "Derived Export Report",
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

const authoredDerivedDraftExport = buildDraftReportExportRequest({
  reportDocument: {
    id: "derivedExportReport",
    title: "Derived Export Report",
  },
  reportSpec: authoredDerivedSpec,
  reportFill: authoredDerivedFill,
  reportPrint: authoredDerivedPrint,
  format: "pdf",
});

assert.ok(authoredDerivedDraftExport);
assert.equal(authoredDerivedDraftExport.source.from, "draft");
assert.equal(authoredDerivedDraftExport.reportSpec.calculatedFields.some((field) => field.id === "reachRate" && field.kind === "rowCalc"), true);
assert.equal(authoredDerivedDraftExport.reportFill.blocks.find((block) => block.id === "reachRateTrend")?.content?.chartModel?.series?.values?.[0]?.value, "reachRate");
assert.equal(authoredDerivedDraftExport.reportFill.blocks.find((block) => block.id === "reachRateTable")?.content?.columns?.some((column) => column.key === "reachRate"), true);
assert.equal(
  authoredDerivedDraftExport.reportFill.blocks.find((block) => block.id === "reachRateTable")?.content?.resolvedRows?.some((row) => (
    row?.cells?.some((cell) => cell.key === "reachRate" && cell.value === 25)
  )),
  true,
);
assert.equal(authoredDerivedDraftExport.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "svg" && element.id.includes("reachRateTrend")), true);
assert.equal(authoredDerivedDraftExport.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "tableCellText" && element.columnKey === "reachRate"), true);
assert.equal(validateReportExportRequest(authoredDerivedDraftExport).valid, true);

const authoredDerivedSavedExport = buildSavedReportExportRequest({
  savedReportPayload: {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_derived_export_snapshot",
    savedAt: 9200,
    title: "Derived Export Snapshot",
    sourceArtifactId: "derived_export_snapshot",
    reportDocument: {
      version: 1,
      kind: "reportDocument",
      id: "derivedExportSnapshot",
      title: "Derived Export Snapshot",
    },
    reportSpec: authoredDerivedSpec,
  },
  reportFill: authoredDerivedFill,
  reportPrint: authoredDerivedPrint,
  documentVersion: 9,
  format: "pdf",
});

assert.ok(authoredDerivedSavedExport);
assert.equal(authoredDerivedSavedExport.source.from, "savedPayload");
assert.equal(authoredDerivedSavedExport.source.documentVersion, 9);
assert.equal(authoredDerivedSavedExport.reportSpec.calculatedFields.some((field) => field.id === "reachRate"), true);
assert.equal(authoredDerivedSavedExport.reportFill.blocks.find((block) => block.id === "reachRateTrend")?.content?.chartSpec?.yFields?.[0], "reachRate");
assert.equal(
  authoredDerivedSavedExport.reportFill.blocks.find((block) => block.id === "reachRateTable")?.content?.resolvedRows?.some((row) => (
    row?.cells?.some((cell) => cell.key === "reachRate" && cell.value === 25)
  )),
  true,
);
assert.equal(authoredDerivedSavedExport.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "tableCellText" && element.columnKey === "reachRate"), true);
assert.equal(validateReportExportRequest(authoredDerivedSavedExport).valid, true);

console.log("reportExportRequestModel ✓ builds a canonical Forge export handoff contract from draft and saved reporting artifacts");

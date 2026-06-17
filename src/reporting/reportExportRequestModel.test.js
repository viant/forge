import assert from "node:assert/strict";

import { buildReportBuilderReportSpec } from "./reportSpecModel.js";
import { buildReportFillFromReportSpec } from "./reportFillModel.js";
import { buildReportPrintFromReportFill } from "./reportPrintModel.js";
import {
  buildDraftReportExportRequest,
  buildReportExportArtifactRef,
  buildSavedReportExportRequest,
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
  staticFilters: {
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
});

assert.equal(draftExportRequest.kind, "reportExportRequest");
assert.equal(draftExportRequest.target.format, "pdf");
assert.equal(draftExportRequest.source.from, "draft");
assert.equal(draftExportRequest.source.artifactKind, "dashboard.reportBuilder");
assert.equal(draftExportRequest.source.artifactRef, "dashboard.reportBuilder://performanceBuilder");
assert.equal(draftExportRequest.source.reportId, "performanceReport");
assert.equal(draftExportRequest.source.title, "Performance Report");
assert.equal(validateReportExportRequest(draftExportRequest).valid, true);

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

assert.equal(buildDraftReportExportRequest({
  reportDocument: { id: "performanceReport", title: "Performance Report" },
  reportSpec,
  reportFill,
  reportPrint: null,
  format: "pdf",
}), null);

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

import assert from "node:assert/strict";

import { buildCapacityDirectSeriesFixtureState } from "./capacityDirectSeriesFixtureState.js";
import { buildReportBuilderGetReportDocumentResponse } from "../../components/dashboard/reportBuilderReportDocumentReadResponse.js";
import { buildHydratedReportBuilderDocument } from "../../components/dashboard/reportBuilderHydratedReportDocument.js";
import { resolveReportBuilderReopenCompatibility } from "../../components/dashboard/reportBuilderHydratedReportDocumentDiagnostic.js";
import {
  buildReportBuilderRuntimePreview,
  buildReportBuilderRuntimePreviewModel,
} from "../../components/dashboard/reportBuilderRuntimePreview.js";
import { validateReportExportRequest } from "../schema/reportSchemas.js";

const {
  record,
  exportRequest,
  reportFill,
  primaryBuilderBlock,
  savedReportPayload,
} = buildCapacityDirectSeriesFixtureState();

assert.equal(savedReportPayload.reportDocument.id, "capacityKpiBlendByDateQ3");
assert.equal(savedReportPayload.reportDocument.title, "Capacity KPI Blend Q3");
assert.ok(primaryBuilderBlock);
assert.equal(primaryBuilderBlock.source.containerId, "demoReportBuilder");
assert.equal(primaryBuilderBlock.source.stateKey, "demoReportBuilder");
assert.equal(primaryBuilderBlock.state?.chartSpec?.title, "Avails + HH Uniques by Date");
assert.equal(primaryBuilderBlock.state?.chartSpec?.type, "bar");
assert.deepEqual(primaryBuilderBlock.state?.selectedMeasures, ["avails", "hhUniqs"]);
assert.deepEqual(primaryBuilderBlock.state?.selectedDimensions, ["eventDate"]);
assert.equal(Array.isArray(reportFill?.datasets?.[0]?.rows), true);
assert.equal(reportFill.datasets[0].rows.length, 8);
assert.equal(reportFill.datasets[0].rows[0].channelV2, "Display");
assert.equal(reportFill.datasets[0].rows[0].avails, 40000);
assert.equal(reportFill.datasets[0].rows[1].channelV2, "CTV");
assert.equal(reportFill.datasets[0].rows[1].avails, 34700);
assert.equal(validateReportExportRequest(exportRequest).valid, true);
assert.equal(exportRequest.reportPrint.title, "Capacity KPI Blend Q3");
assert.equal(exportRequest.source.reportId, "capacityKpiBlendByDateQ3");
assert.equal(exportRequest.source.documentVersion, 9);
assert.equal(exportRequest.source.sourceArtifactId, "capacity_q3_kpi_blend_by_date");
assert.equal(exportRequest.reportPrint.pageGeometry.width, 792);
assert.equal(exportRequest.reportPrint.pageGeometry.height, 612);
assert.deepEqual(exportRequest.reportPrint.pages.map((page) => page.number), [1, 2, 3]);
assert.deepEqual(exportRequest.reportPrint.bookmarks.find((bookmark) => bookmark.id === "bookmark.primaryChart"), {
  id: "bookmark.primaryChart",
  title: "Avails + HH Uniques by Date",
  pageNumber: 2,
  level: 1,
  elementId: "primaryChart__title_0",
  y: 84,
});
assert.equal(
  exportRequest.reportPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.comparisonTable" && bookmark.pageNumber === 2),
  true,
);
const primaryChartTitle = exportRequest.reportPrint.pages
  .flatMap((page) => page.elements || [])
  .find((element) => element?.id === "primaryChart__title_0");
const headlineKpiTitle = exportRequest.reportPrint.pages
  .flatMap((page) => page.elements || [])
  .find((element) => element?.id === "headlineKpi__title_0");
const comparisonTableTitle = exportRequest.reportPrint.pages
  .flatMap((page) => page.elements || [])
  .find((element) => element?.id === "comparisonTable__title_0");
assert.deepEqual(primaryChartTitle?.box, {
  x: 36,
  y: 84,
  width: 720,
  height: 20,
});
assert.equal(primaryChartTitle?.text, "Avails + HH Uniques by Date");
assert.deepEqual(headlineKpiTitle?.box, {
  x: 36,
  y: 388,
  width: 720,
  height: 20,
});
assert.equal(headlineKpiTitle?.text, "Headline KPI");
assert.deepEqual(comparisonTableTitle?.box, {
  x: 36,
  y: 484,
  width: 720,
  height: 20,
});
assert.equal(comparisonTableTitle?.text, "Delivery Comparison");
assert.equal(resolveReportBuilderReopenCompatibility(
  primaryBuilderBlock.source,
  {
    containerId: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    dataSourceRef: "demoReportSource",
  },
).compatible, true);

const getResponse = buildReportBuilderGetReportDocumentResponse(record.savedReportPayload, {
  documentVersion: 9,
  savedAt: 9600,
});
const hydrated = buildHydratedReportBuilderDocument(getResponse, {
  container: {
    id: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    dataSourceRef: "demoReportSource",
  },
  builderIdentity: {
    containerId: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    dataSourceRef: "demoReportSource",
  },
});
assert.equal(hydrated.valid, true);
assert.equal(hydrated.state.chartSpec?.title, "Avails + HH Uniques by Date");
assert.equal(hydrated.state.chartSpec?.type, "bar");
assert.deepEqual(hydrated.state.selectedMeasures, ["avails", "hhUniqs"]);
assert.deepEqual(hydrated.state.selectedDimensions, ["eventDate"]);

const reopenedModel = buildReportBuilderRuntimePreviewModel({
  container: {
    id: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    title: "Capacity KPI Blend Q3",
    dataSourceRef: "demoReportSource",
  },
  config: hydrated.config,
  state: hydrated.state,
  semanticSummary: record.savedReportPayload.reportSpec?.semanticSummary || null,
});
const reopenedPreview = buildReportBuilderRuntimePreview({
  model: reopenedModel,
  rows: reportFill.datasets[0].rows,
  hasMore: false,
  pageGeometry: exportRequest.reportPrint.pageGeometry,
});
assert.deepEqual(reopenedModel.reportSpec, exportRequest.reportSpec);
assert.deepEqual(reopenedPreview.reportFill, exportRequest.reportFill);
assert.deepEqual(reopenedPreview.reportPrint, exportRequest.reportPrint);

console.log("capacityDirectSeriesPreviewSavedReportRecordFixture ✓ direct-series saved record preserves KPI blend print layout and reopen print parity");

import assert from "node:assert/strict";

import { buildCapacityInventoryFixtureState } from "./capacityInventoryFixtureState.js";
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
} = buildCapacityInventoryFixtureState();

assert.equal(savedReportPayload.reportDocument.id, "capacityInventoryTopChannelsQ3");
assert.equal(savedReportPayload.reportDocument.title, "Capacity Inventory Top Channels Q3");
assert.ok(primaryBuilderBlock);
assert.equal(primaryBuilderBlock.source.containerId, "demoReportBuilder");
assert.equal(primaryBuilderBlock.source.stateKey, "demoReportBuilder");
assert.equal(primaryBuilderBlock.state?.chartSpec?.title, "Inventory · Top Channels");
assert.equal(primaryBuilderBlock.state?.chartSpec?.type, "horizontal_bar");
assert.deepEqual(primaryBuilderBlock.state?.selectedMeasures, ["avails"]);
assert.deepEqual(primaryBuilderBlock.state?.selectedDimensions, ["channelV2"]);
assert.deepEqual(primaryBuilderBlock.state?.scopeParams?.dateRange, {
  start: "2026-05-01",
  end: "2026-05-04",
});
assert.deepEqual(primaryBuilderBlock.state?.scopeParams?.channelsFilter, []);
assert.equal(Array.isArray(reportFill?.datasets?.[0]?.rows), true);
assert.equal(reportFill.datasets[0].rows.length, 2);
assert.equal(reportFill.datasets[0].rows[0].channelV2, "Display");
assert.equal(reportFill.datasets[0].rows[0].avails, 158400);
assert.equal(reportFill.datasets[0].rows[1].channelV2, "CTV");
assert.equal(reportFill.datasets[0].rows[1].avails, 138200);
assert.equal(validateReportExportRequest(exportRequest).valid, true);
assert.equal(exportRequest.reportPrint.title, "Capacity Inventory Top Channels Q3");
assert.equal(exportRequest.source.reportId, "capacityInventoryTopChannelsQ3");
assert.equal(exportRequest.source.documentVersion, 7);
assert.equal(exportRequest.source.sourceArtifactId, "capacity_q3_inventory_top_channels");
assert.equal(exportRequest.reportPrint.pageGeometry.width, 792);
assert.equal(exportRequest.reportPrint.pageGeometry.height, 612);
assert.deepEqual(exportRequest.reportPrint.pages.map((page) => page.number), [1, 2]);
assert.deepEqual(exportRequest.reportPrint.bookmarks.find((bookmark) => bookmark.id === "bookmark.primaryChart"), {
  id: "bookmark.primaryChart",
  title: "Inventory · Top Channels",
  pageNumber: 1,
  level: 1,
  elementId: "primaryChart__title_0",
  y: 268,
});
assert.equal(
  exportRequest.reportPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.headlineKpi" && bookmark.pageNumber === 1),
  true,
);
const primaryChartTitle = exportRequest.reportPrint.pages
  .flatMap((page) => page.elements || [])
  .find((element) => element?.id === "primaryChart__title_0");
const headlineKpiTitle = exportRequest.reportPrint.pages
  .flatMap((page) => page.elements || [])
  .find((element) => element?.id === "headlineKpi__title_0");
assert.deepEqual(primaryChartTitle?.box, {
  x: 36,
  y: 268,
  width: 720,
  height: 20,
});
assert.equal(primaryChartTitle?.text, "Inventory · Top Channels");
assert.deepEqual(headlineKpiTitle?.box, {
  x: 408,
  y: 472,
  width: 348,
  height: 20,
});
assert.equal(headlineKpiTitle?.text, "Top Channel KPI");
assert.equal(resolveReportBuilderReopenCompatibility(
  primaryBuilderBlock.source,
  {
    containerId: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    dataSourceRef: "demoReportSource",
  },
).compatible, true);

const getResponse = buildReportBuilderGetReportDocumentResponse(record.savedReportPayload, {
  documentVersion: 7,
  savedAt: 9400,
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
assert.equal(hydrated.state.chartSpec?.title, "Inventory · Top Channels");
assert.equal(hydrated.state.chartSpec?.type, "horizontal_bar");
assert.deepEqual(hydrated.state.selectedMeasures, ["avails"]);
assert.deepEqual(hydrated.state.selectedDimensions, ["channelV2"]);
assert.deepEqual(hydrated.state.scopeParams?.dateRange, {
  start: "2026-05-01",
  end: "2026-05-04",
});

const reopenedModel = buildReportBuilderRuntimePreviewModel({
  container: {
    id: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    title: "Capacity Inventory Top Channels Q3",
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

console.log("capacityInventoryPreviewSavedReportRecordFixture ✓ capacity inventory saved record preserves print layout and reopen print parity");

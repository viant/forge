import assert from "node:assert/strict";

import { buildCapacityLocationFixtureState } from "./capacityLocationFixtureState.js";
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
} = buildCapacityLocationFixtureState();

assert.equal(savedReportPayload.reportDocument.id, "capacityLocationsTopMarketsQ3");
assert.equal(savedReportPayload.reportDocument.title, "Capacity Locations Top Markets Q3");
assert.ok(primaryBuilderBlock);
assert.equal(primaryBuilderBlock.source.containerId, "demoReportBuilder");
assert.equal(primaryBuilderBlock.source.stateKey, "demoReportBuilder");
assert.equal(primaryBuilderBlock.state?.chartSpec?.title, "Locations · Top Markets");
assert.equal(primaryBuilderBlock.state?.chartSpec?.type, "horizontal_bar");
assert.deepEqual(primaryBuilderBlock.state?.selectedMeasures, ["avails"]);
assert.deepEqual(primaryBuilderBlock.state?.selectedDimensions, ["country"]);
assert.equal(Array.isArray(reportFill?.datasets?.[0]?.rows), true);
assert.equal(reportFill.datasets[0].rows.length, 2);
assert.equal(reportFill.datasets[0].rows[0].country, "US");
assert.equal(reportFill.datasets[0].rows[0].avails, 153100);
assert.equal(reportFill.datasets[0].rows[1].country, "CA");
assert.equal(reportFill.datasets[0].rows[1].avails, 143500);
assert.equal(validateReportExportRequest(exportRequest).valid, true);
assert.equal(exportRequest.reportPrint.title, "Capacity Locations Top Markets Q3");
assert.equal(exportRequest.source.reportId, "capacityLocationsTopMarketsQ3");
assert.equal(exportRequest.source.documentVersion, 8);
assert.equal(exportRequest.source.sourceArtifactId, "capacity_q3_locations_top_markets");
assert.equal(exportRequest.reportPrint.pageGeometry.width, 792);
assert.equal(exportRequest.reportPrint.pageGeometry.height, 612);
assert.deepEqual(exportRequest.reportPrint.pages.map((page) => page.number), [1, 2]);
assert.deepEqual(exportRequest.reportPrint.bookmarks.find((bookmark) => bookmark.id === "bookmark.primaryChart"), {
  id: "bookmark.primaryChart",
  title: "Locations · Top Markets",
  pageNumber: 1,
  level: 1,
  elementId: "primaryChart__title_0",
  y: 252,
});
assert.equal(
  exportRequest.reportPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.headlineKpi" && bookmark.pageNumber === 1),
  true,
);
assert.equal(resolveReportBuilderReopenCompatibility(
  primaryBuilderBlock.source,
  {
    containerId: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    dataSourceRef: "demoReportSource",
  },
).compatible, true);

const getResponse = buildReportBuilderGetReportDocumentResponse(record.savedReportPayload, {
  documentVersion: 8,
  savedAt: 9500,
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
assert.equal(hydrated.state.chartSpec?.title, "Locations · Top Markets");
assert.equal(hydrated.state.chartSpec?.type, "horizontal_bar");
assert.deepEqual(hydrated.state.selectedMeasures, ["avails"]);
assert.deepEqual(hydrated.state.selectedDimensions, ["country"]);

const reopenedModel = buildReportBuilderRuntimePreviewModel({
  container: {
    id: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    title: "Capacity Locations Top Markets Q3",
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

console.log("capacityLocationPreviewSavedReportRecordFixture ✓ capacity location saved record preserves print layout and reopen print parity");

import assert from "node:assert/strict";

import { buildCapacityAudienceLandscapeFixtureState } from "./capacityAudienceLandscapeFixtureState.js";
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
} = buildCapacityAudienceLandscapeFixtureState();

assert.equal(savedReportPayload.reportDocument.id, "capacityAudienceSegmentIndexQ3");
assert.equal(savedReportPayload.reportDocument.title, "Capacity Audience Segment Index Q3");
assert.ok(primaryBuilderBlock);
assert.equal(primaryBuilderBlock.source.containerId, "demoReportBuilder");
assert.equal(primaryBuilderBlock.source.stateKey, "demoReportBuilder");
assert.equal(primaryBuilderBlock.state?.viewMode, "table");
assert.deepEqual(primaryBuilderBlock.state?.selectedMeasures, ["audienceIndex"]);
assert.deepEqual(primaryBuilderBlock.state?.selectedDimensions, ["country"]);
assert.deepEqual(primaryBuilderBlock.state?.scopeParams?.audienceSegmentFilter, ["Young Adults"]);
assert.equal(Array.isArray(reportFill?.datasets?.[0]?.rows), true);
assert.equal(reportFill.datasets[0].rows.length, 8);
assert.equal(reportFill.datasets[0].rows[0].country, "US");
assert.equal(reportFill.datasets[0].rows[0].audienceIndex, 0);
assert.equal(validateReportExportRequest(exportRequest).valid, true);
assert.equal(exportRequest.reportPrint.title, "Capacity Audience Segment Index Q3");
assert.equal(exportRequest.source.reportId, "capacityAudienceSegmentIndexQ3");
assert.equal(exportRequest.source.documentVersion, 13);
assert.equal(exportRequest.source.sourceArtifactId, "capacity_audience_segment_index_q3");
assert.equal(exportRequest.reportPrint.pageGeometry.width, 792);
assert.equal(exportRequest.reportPrint.pageGeometry.height, 612);
assert.deepEqual(exportRequest.reportPrint.pages.map((page) => page.number), [1, 2]);
assert.deepEqual(exportRequest.reportPrint.bookmarks.find((bookmark) => bookmark.id === "bookmark.comparisonTable"), {
  id: "bookmark.comparisonTable",
  title: "Delivery Comparison",
  pageNumber: 1,
  level: 1,
  elementId: "comparisonTable__title_0",
  y: 524,
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
  documentVersion: 13,
  savedAt: 9375,
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
assert.equal(hydrated.state.viewMode, "table");
assert.deepEqual(hydrated.state.selectedMeasures, ["audienceIndex"]);
assert.deepEqual(hydrated.state.selectedDimensions, ["country"]);
assert.deepEqual(hydrated.state.scopeParams?.audienceSegmentFilter, ["Young Adults"]);

const reopenedModel = buildReportBuilderRuntimePreviewModel({
  container: {
    id: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    title: "Capacity Audience Segment Index Q3",
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

console.log("capacityAudiencePreviewSavedReportRecordFixture ✓ audience saved record preserves landscape print layout and reopen print parity");

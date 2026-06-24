import assert from "node:assert/strict";

import { buildCapacityLocationArtifactFixtureState } from "./capacityLocationArtifactFixtureState.js";

const fixtureState = buildCapacityLocationArtifactFixtureState();

assert.equal(fixtureState.savedReportPayload.kind, "reportBuilder.savedReportPayload");
assert.equal(fixtureState.savedReportPayload.reportSpec.semanticSummary.selectedDimensions[0].id, "country_code");
assert.equal(fixtureState.savedReportRecord.kind, "reportBuilder.savedReportRecord");
assert.equal(fixtureState.getReportDocumentResponse.kind, "getReportDocumentResponse");
assert.equal(fixtureState.listReportDocumentsResponse.kind, "listReportDocumentsResponse");
assert.equal(fixtureState.createReportDocumentPayload.kind, "createReportDocumentPayload");
assert.equal(fixtureState.updateReportDocumentPayload.kind, "updateReportDocumentPayload");
assert.equal(fixtureState.reportExportRequest.kind, "reportExportRequest");
assert.equal(fixtureState.reportExportRequest.target.format, "csv");
assert.equal(fixtureState.pdfReportExportRequest.kind, "reportExportRequest");
assert.equal(fixtureState.pdfReportExportRequest.target.format, "pdf");
assert.equal(fixtureState.pdfReportExportRequest.reportPrint.kind, "reportPrint");
assert.equal(fixtureState.pdfReportPrint.kind, "reportPrint");
assert.equal(fixtureState.pdfReportPrint.title, "Capacity Locations Top Markets Q3");
assert.equal(fixtureState.getReportDocumentRequest.kind, "getReportDocumentRequest");
assert.equal(fixtureState.legacySavedReportPayload.reportDocument.semanticSummary, undefined);
assert.equal(fixtureState.legacySavedReportPayload.reportDocument.scope, undefined);
assert.equal(fixtureState.legacyGetReportDocumentResponse.document.semanticSummary, undefined);
assert.equal(fixtureState.legacyGetReportDocumentResponse.document.scope, undefined);
assert.equal(fixtureState.legacyCreateReportDocumentPayload.document.semanticSummary, undefined);
assert.equal(fixtureState.legacyUpdateReportDocumentPayload.document.scope, undefined);

console.log("capacityLocationArtifactFixtureState ✓ builds current and legacy location reporting artifacts for import/export coverage");

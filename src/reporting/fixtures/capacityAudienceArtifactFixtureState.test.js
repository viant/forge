import assert from "node:assert/strict";

import { buildCapacityAudienceArtifactFixtureState } from "./capacityAudienceArtifactFixtureState.js";

const fixtureState = buildCapacityAudienceArtifactFixtureState();

assert.equal(fixtureState.savedReportPayload.kind, "reportBuilder.savedReportPayload");
assert.equal(fixtureState.savedReportPayload.reportSpec.semanticSummary.selectedMeasures[0].definitionRef, "harmonizer://feature/user.segment.index");
assert.equal(fixtureState.savedReportPayload.reportSpec.semanticSummary.selectedParameters[1].definitionRef, "harmonizer://feature/user.segment");
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
assert.equal(fixtureState.pdfReportPrint.title, "Capacity Audience Segment Index Q3");
assert.equal(fixtureState.getReportDocumentRequest.kind, "getReportDocumentRequest");
assert.equal(fixtureState.legacySavedReportPayload.reportDocument.semanticSummary, undefined);
assert.equal(fixtureState.legacySavedReportPayload.reportDocument.scope, undefined);
assert.equal(fixtureState.legacyGetReportDocumentResponse.document.semanticSummary, undefined);
assert.equal(fixtureState.legacyGetReportDocumentResponse.document.scope, undefined);
assert.equal(fixtureState.legacyCreateReportDocumentPayload.document.semanticSummary, undefined);
assert.equal(fixtureState.legacyUpdateReportDocumentPayload.document.scope, undefined);

console.log("capacityAudienceArtifactFixtureState ✓ builds current and legacy audience reporting artifacts for import/export coverage");

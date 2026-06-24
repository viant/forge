import assert from "node:assert/strict";

import { buildAuthoredLandscapeFixtureState } from "./authoredLandscapeFixtureState.js";

const fixtureState = buildAuthoredLandscapeFixtureState();

assert.equal(fixtureState.record.savedReportPayload.reportDocument.id, "authoredLandscapeBuilder");
assert.equal(fixtureState.savedReportRecord.savedReportPayload.reportDocument.id, "authoredLandscapeBuilder");
assert.equal(fixtureState.reportPrint.kind, "reportPrint");
assert.equal(fixtureState.pdfReportPrint.kind, "reportPrint");
assert.equal(fixtureState.reportPrint.title, "Authored Landscape Report");
assert.equal(fixtureState.reportPrint.pages.length, 1);
assert.equal(fixtureState.reportPrint.bookmarks.length, 2);
assert.equal(fixtureState.exportRequest.target.format, "pdf");
assert.equal(fixtureState.pdfExportRequest.target.format, "pdf");
assert.equal(fixtureState.exportRequest.reportPrint.kind, "reportPrint");
assert.equal(fixtureState.getReportDocumentResponse.kind, "getReportDocumentResponse");
assert.equal(fixtureState.getReportDocumentResponse.reportRef.reportId, "authoredLandscapeBuilder");
assert.equal(fixtureState.getReportDocumentResponse.documentVersion, 12);
assert.equal(fixtureState.listReportDocumentsResponse.kind, "listReportDocumentsResponse");
assert.equal(fixtureState.listReportDocumentsResponse.entries[0].reportRef.reportId, "authoredLandscapeBuilder");
assert.equal(fixtureState.createReportDocumentPayload.kind, "createReportDocumentPayload");
assert.equal(fixtureState.createReportDocumentPayload.reportRef.reportId, "authoredLandscapeBuilder");
assert.equal(fixtureState.getReportDocumentRequest.kind, "getReportDocumentRequest");
assert.equal(fixtureState.getReportDocumentRequest.reportRef.reportId, "authoredLandscapeBuilder");
assert.equal(fixtureState.updateReportDocumentPayload.kind, "updateReportDocumentPayload");
assert.equal(fixtureState.updateReportDocumentPayload.expectedVersion, 12);
assert.equal(fixtureState.reportFill.kind, "reportFill");
assert.equal(fixtureState.primaryBuilderBlock.kind, "reportBuilderBlock");

console.log("authoredLandscapeFixtureState ✓ exposes the canonical authored landscape runtime/export fixture set");

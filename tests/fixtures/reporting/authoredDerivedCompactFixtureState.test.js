import assert from "node:assert/strict";

import { buildAuthoredDerivedCompactFixtureState } from "../../../src/reporting/fixtures/authoredDerivedCompactFixtureState.js";

const fixtureState = buildAuthoredDerivedCompactFixtureState();

assert.equal(fixtureState.record.savedReportPayload.reportDocument.id, "authoredDerivedCompactBuilder");
assert.equal(fixtureState.savedReportRecord.savedReportPayload.reportDocument.id, "authoredDerivedCompactBuilder");
assert.equal(fixtureState.reportPrint.kind, "reportPrint");
assert.equal(fixtureState.pdfReportPrint.kind, "reportPrint");
assert.equal(fixtureState.reportPrint.title, "Authored Derived Compact Report");
assert.equal(fixtureState.reportPrint.pages.length, 2);
assert.equal(fixtureState.reportPrint.bookmarks.length, 3);
assert.equal(fixtureState.exportRequest.target.format, "pdf");
assert.equal(fixtureState.pdfExportRequest.target.format, "pdf");
assert.equal(fixtureState.exportRequest.reportPrint.kind, "reportPrint");
assert.equal(fixtureState.getReportDocumentResponse.kind, "getReportDocumentResponse");
assert.equal(fixtureState.getReportDocumentResponse.reportRef.reportId, "authoredDerivedCompactBuilder");
assert.equal(fixtureState.getReportDocumentResponse.documentVersion, 14);
assert.equal(fixtureState.listReportDocumentsResponse.kind, "listReportDocumentsResponse");
assert.equal(fixtureState.listReportDocumentsResponse.entries[0].reportRef.reportId, "authoredDerivedCompactBuilder");
assert.equal(fixtureState.createReportDocumentPayload.kind, "createReportDocumentPayload");
assert.equal(fixtureState.createReportDocumentPayload.reportRef.reportId, "authoredDerivedCompactBuilder");
assert.equal(fixtureState.getReportDocumentRequest.kind, "getReportDocumentRequest");
assert.equal(fixtureState.getReportDocumentRequest.reportRef.reportId, "authoredDerivedCompactBuilder");
assert.equal(fixtureState.updateReportDocumentPayload.kind, "updateReportDocumentPayload");
assert.equal(fixtureState.updateReportDocumentPayload.expectedVersion, 14);
assert.equal(fixtureState.reportFill.kind, "reportFill");
assert.equal(fixtureState.primaryBuilderBlock.kind, "reportBuilderBlock");

console.log("authoredDerivedCompactFixtureState ✓ exposes the canonical authored-derived compact runtime/export fixture set");

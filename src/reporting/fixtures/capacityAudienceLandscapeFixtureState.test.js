import assert from "node:assert/strict";

import { buildCapacityAudienceLandscapeFixtureState } from "./capacityAudienceLandscapeFixtureState.js";

const fixtureState = buildCapacityAudienceLandscapeFixtureState();

assert.equal(fixtureState.record.savedReportPayload.reportDocument.id, "capacityAudienceSegmentIndexQ3");
assert.equal(fixtureState.savedReportRecord.savedReportPayload.reportDocument.id, "capacityAudienceSegmentIndexQ3");
assert.equal(fixtureState.reportPrint.kind, "reportPrint");
assert.equal(fixtureState.pdfReportPrint.kind, "reportPrint");
assert.equal(fixtureState.reportPrint.title, "Capacity Audience Segment Index Q3");
assert.equal(fixtureState.reportPrint.pages.length, 2);
assert.equal(fixtureState.reportPrint.bookmarks.length, 4);
assert.equal(fixtureState.exportRequest.target.format, "pdf");
assert.equal(fixtureState.pdfExportRequest.target.format, "pdf");
assert.equal(fixtureState.exportRequest.reportPrint.kind, "reportPrint");
assert.equal(fixtureState.getReportDocumentResponse.kind, "getReportDocumentResponse");
assert.equal(fixtureState.getReportDocumentResponse.reportRef.reportId, "capacityAudienceSegmentIndexQ3");
assert.equal(fixtureState.getReportDocumentResponse.documentVersion, 13);
assert.equal(fixtureState.listReportDocumentsResponse.kind, "listReportDocumentsResponse");
assert.equal(fixtureState.listReportDocumentsResponse.entries[0].reportRef.reportId, "capacityAudienceSegmentIndexQ3");
assert.equal(fixtureState.createReportDocumentPayload.kind, "createReportDocumentPayload");
assert.equal(fixtureState.createReportDocumentPayload.reportRef.reportId, "capacityAudienceSegmentIndexQ3");
assert.equal(fixtureState.getReportDocumentRequest.kind, "getReportDocumentRequest");
assert.equal(fixtureState.getReportDocumentRequest.reportRef.reportId, "capacityAudienceSegmentIndexQ3");
assert.equal(fixtureState.updateReportDocumentPayload.kind, "updateReportDocumentPayload");
assert.equal(fixtureState.updateReportDocumentPayload.expectedVersion, 13);
assert.equal(fixtureState.reportFill.kind, "reportFill");
assert.equal(fixtureState.primaryBuilderBlock.kind, "reportBuilderBlock");

console.log("capacityAudienceLandscapeFixtureState ✓ exposes the canonical audience landscape runtime/export fixture set");

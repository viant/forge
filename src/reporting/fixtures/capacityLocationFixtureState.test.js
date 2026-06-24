import assert from "node:assert/strict";

import { buildCapacityLocationFixtureState } from "./capacityLocationFixtureState.js";

const fixtureState = buildCapacityLocationFixtureState();

assert.equal(fixtureState.record.savedReportPayload.reportDocument.id, "capacityLocationsTopMarketsQ3");
assert.equal(fixtureState.savedReportRecord.savedReportPayload.reportDocument.id, "capacityLocationsTopMarketsQ3");
assert.equal(fixtureState.reportPrint.kind, "reportPrint");
assert.equal(fixtureState.pdfReportPrint.kind, "reportPrint");
assert.equal(fixtureState.reportPrint.title, "Capacity Locations Top Markets Q3");
assert.equal(fixtureState.reportPrint.pages.length, 2);
assert.equal(fixtureState.reportPrint.bookmarks.length, 5);
assert.equal(fixtureState.exportRequest.target.format, "pdf");
assert.equal(fixtureState.pdfExportRequest.target.format, "pdf");
assert.equal(fixtureState.exportRequest.reportPrint.kind, "reportPrint");
assert.equal(fixtureState.getReportDocumentResponse.kind, "getReportDocumentResponse");
assert.equal(fixtureState.getReportDocumentResponse.reportRef.reportId, "capacityLocationsTopMarketsQ3");
assert.equal(fixtureState.getReportDocumentResponse.documentVersion, 8);
assert.equal(fixtureState.listReportDocumentsResponse.kind, "listReportDocumentsResponse");
assert.equal(fixtureState.listReportDocumentsResponse.entries[0].reportRef.reportId, "capacityLocationsTopMarketsQ3");
assert.equal(fixtureState.createReportDocumentPayload.kind, "createReportDocumentPayload");
assert.equal(fixtureState.createReportDocumentPayload.reportRef.reportId, "capacityLocationsTopMarketsQ3");
assert.equal(fixtureState.getReportDocumentRequest.kind, "getReportDocumentRequest");
assert.equal(fixtureState.getReportDocumentRequest.reportRef.reportId, "capacityLocationsTopMarketsQ3");
assert.equal(fixtureState.updateReportDocumentPayload.kind, "updateReportDocumentPayload");
assert.equal(fixtureState.updateReportDocumentPayload.expectedVersion, 8);
assert.equal(fixtureState.reportFill.kind, "reportFill");
assert.equal(fixtureState.primaryBuilderBlock.kind, "reportBuilderBlock");

console.log("capacityLocationFixtureState ✓ exposes the canonical location runtime/export fixture set");

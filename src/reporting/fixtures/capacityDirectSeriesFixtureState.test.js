import assert from "node:assert/strict";

import { buildCapacityDirectSeriesFixtureState } from "./capacityDirectSeriesFixtureState.js";

const fixtureState = buildCapacityDirectSeriesFixtureState();

assert.equal(fixtureState.record.savedReportPayload.reportDocument.id, "capacityKpiBlendByDateQ3");
assert.equal(fixtureState.savedReportRecord.savedReportPayload.reportDocument.id, "capacityKpiBlendByDateQ3");
assert.equal(fixtureState.reportPrint.kind, "reportPrint");
assert.equal(fixtureState.pdfReportPrint.kind, "reportPrint");
assert.equal(fixtureState.reportPrint.title, "Capacity KPI Blend Q3");
assert.equal(fixtureState.reportPrint.pages.length, 3);
assert.equal(fixtureState.reportPrint.bookmarks.length, 5);
assert.equal(fixtureState.exportRequest.target.format, "pdf");
assert.equal(fixtureState.pdfExportRequest.target.format, "pdf");
assert.equal(fixtureState.exportRequest.reportPrint.kind, "reportPrint");
assert.equal(fixtureState.getReportDocumentResponse.kind, "getReportDocumentResponse");
assert.equal(fixtureState.getReportDocumentResponse.reportRef.reportId, "capacityKpiBlendByDateQ3");
assert.equal(fixtureState.getReportDocumentResponse.documentVersion, 9);
assert.equal(fixtureState.listReportDocumentsResponse.kind, "listReportDocumentsResponse");
assert.equal(fixtureState.listReportDocumentsResponse.entries[0].reportRef.reportId, "capacityKpiBlendByDateQ3");
assert.equal(fixtureState.createReportDocumentPayload.kind, "createReportDocumentPayload");
assert.equal(fixtureState.createReportDocumentPayload.reportRef.reportId, "capacityKpiBlendByDateQ3");
assert.equal(fixtureState.getReportDocumentRequest.kind, "getReportDocumentRequest");
assert.equal(fixtureState.getReportDocumentRequest.reportRef.reportId, "capacityKpiBlendByDateQ3");
assert.equal(fixtureState.updateReportDocumentPayload.kind, "updateReportDocumentPayload");
assert.equal(fixtureState.updateReportDocumentPayload.expectedVersion, 9);
assert.equal(fixtureState.reportFill.kind, "reportFill");
assert.equal(fixtureState.primaryBuilderBlock.kind, "reportBuilderBlock");

console.log("capacityDirectSeriesFixtureState ✓ exposes the canonical direct-series runtime/export fixture set");

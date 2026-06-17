import assert from "node:assert/strict";

import { buildAuthoredLandscapeSavedReportRecord } from "./authoredLandscapeSavedReportRecordBuilder.js";
import { resolveReportBuilderReopenCompatibility } from "../../components/dashboard/reportBuilderHydratedReportDocumentDiagnostic.js";

const record = buildAuthoredLandscapeSavedReportRecord({
  containerId: "demoReportBuilder",
  stateKey: "demoReportBuilder",
  reportId: "authoredLandscapePreview",
  payloadId: "rbreport_authored_landscape_preview",
  sourceArtifactId: "authored_landscape_preview",
  savedAt: 9800,
  documentVersion: 12,
});
const primaryBuilderBlock = record.savedReportPayload.reportDocument.blocks
  .find((block) => block?.id === "primaryBuilder" && block?.kind === "reportBuilderBlock");

assert.equal(record.savedReportPayload.reportDocument.id, "authoredLandscapePreview");
assert.ok(primaryBuilderBlock);
assert.equal(primaryBuilderBlock.source.containerId, "demoReportBuilder");
assert.equal(primaryBuilderBlock.source.stateKey, "demoReportBuilder");
assert.equal(record.exportRequest.reportPrint.pageGeometry.width, 792);
assert.equal(record.exportRequest.reportPrint.pageGeometry.height, 612);
assert.equal(record.exportRequest.source.reportId, "authoredLandscapePreview");
assert.equal(resolveReportBuilderReopenCompatibility(
  primaryBuilderBlock.source,
  {
    containerId: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    dataSourceRef: "demoReportSource",
  },
).compatible, true);

console.log("authoredLandscapePreviewSavedReportRecordFixture ✓ preview-compatible authored landscape saved record reopens against the demo builder and preserves landscape export geometry");

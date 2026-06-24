import assert from "node:assert/strict";

import { buildReportBuilderImportedArtifactSourceLabel } from "./reportBuilderImportedArtifactLabels.js";

assert.equal(buildReportBuilderImportedArtifactSourceLabel("reportBuilder.savedReportRecord"), "imported report record");
assert.equal(buildReportBuilderImportedArtifactSourceLabel("reportBuilder.savedReportPayload"), "imported report file");
assert.equal(buildReportBuilderImportedArtifactSourceLabel("reportBuilder.savedView"), "imported saved-view");
assert.equal(buildReportBuilderImportedArtifactSourceLabel("reportBuilder.publishedSnapshot"), "imported published-snapshot");
assert.equal(buildReportBuilderImportedArtifactSourceLabel("reportBuilder.explorationArtifact"), "imported draft-snapshot");
assert.equal(buildReportBuilderImportedArtifactSourceLabel("getReportDocumentResponse"), "imported reopen bundle");
assert.equal(buildReportBuilderImportedArtifactSourceLabel("createReportDocumentPayload"), "imported create request");
assert.equal(buildReportBuilderImportedArtifactSourceLabel("updateReportDocumentPayload"), "imported update request");
assert.equal(buildReportBuilderImportedArtifactSourceLabel("reportDocument"), "imported report document");
assert.equal(buildReportBuilderImportedArtifactSourceLabel(""), "");

console.log("reportBuilderImportedArtifactLabels ✓ maps imported artifact kinds to reader-facing provenance labels");

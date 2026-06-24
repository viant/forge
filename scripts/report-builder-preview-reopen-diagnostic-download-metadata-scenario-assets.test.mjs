import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-diagnostic-download-metadata.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 20);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("__artifactDownloadCapture")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Archive")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopen diagnostic: Capacity Archive")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("reportBuilder.reopenDiagnostic")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Historical Snapshot")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Archived report entry used for reopen compatibility diagnostics.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === 'Capacity Archive-reopen-diagnostic.json'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.mimeType.includes('application/json')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.payload.includes('\"kind\": \"reportBuilder.reopenDiagnostic\"')") && expression.includes("\"code\": \"incompatibleSource\"") && expression.includes("\"responseKind\": \"listReportDocumentsResponse\"") && expression.includes("\"builderTarget\": {") && expression.includes("\"documentVersion\": 7")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("reopen-diagnostic-download-metadata")),
  true,
);

const selectedArchiveIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Archive"));
const checkCompatibilityIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Check reopen compatibility");
const diagnosticReadyIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Reopen diagnostic: Capacity Archive"));
const hiddenPayloadIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step?.text || "").includes("reportBuilder.reopenDiagnostic"));
const historicalSnapshotIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Historical Snapshot"));
const archiveDescriptionIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Archived report entry used for reopen compatibility diagnostics."));
const downloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Download reopen diagnostic");
const filenameIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Capacity Archive-reopen-diagnostic.json"));
const payloadKindIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("reportBuilder.reopenDiagnostic"));

assert.notEqual(selectedArchiveIndex, -1);
assert.notEqual(checkCompatibilityIndex, -1);
assert.notEqual(diagnosticReadyIndex, -1);
assert.notEqual(hiddenPayloadIndex, -1);
assert.notEqual(historicalSnapshotIndex, -1);
assert.notEqual(archiveDescriptionIndex, -1);
assert.notEqual(downloadIndex, -1);
assert.notEqual(filenameIndex, -1);
assert.notEqual(payloadKindIndex, -1);

assert.equal(selectedArchiveIndex < checkCompatibilityIndex, true);
assert.equal(checkCompatibilityIndex < diagnosticReadyIndex, true);
assert.equal(diagnosticReadyIndex < hiddenPayloadIndex, true);
assert.equal(hiddenPayloadIndex < historicalSnapshotIndex, true);
assert.equal(historicalSnapshotIndex < archiveDescriptionIndex, true);
assert.equal(archiveDescriptionIndex < downloadIndex, true);
assert.equal(downloadIndex < filenameIndex, true);
assert.equal(filenameIndex < payloadKindIndex, true);

console.log("report-builder-preview-reopen-diagnostic-download-metadata-scenario-assets ✓ reopen diagnostic download stays structured and emits the expected diagnostic artifact metadata");

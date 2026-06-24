import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-update-report-document-conflict-diagnostic.scenario.mjs";

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
  expressions.some((expression) => expression.includes("Saved report payload: Executive Snapshot") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Update ReportDocument payload: Executive Snapshot") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Update conflict diagnostic: Executive Snapshot") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Prepare update payload"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Prepare conflict diagnostic"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Hide conflict diagnostic"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"updateReportDocumentConflictDiagnostic\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"expectedVersion\": 7")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"currentVersion\": 9")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Conflict diagnostic metadata visibility.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("update-report-document-conflict-diagnostic")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Save report file"),
  false,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Prepare update request"),
  false,
);

const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const savedPayloadMetadataIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Saved report payload: Executive Snapshot") && String(step.expression || "").includes("Semantic Binding"));
const prepareUpdateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare update payload");
const updateMetadataIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Update ReportDocument payload: Executive Snapshot") && String(step.expression || "").includes("Semantic Binding"));
const prepareConflictIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare conflict diagnostic");
const conflictMetadataIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Update conflict diagnostic: Executive Snapshot") && String(step.expression || "").includes("Semantic Binding"));
const hideConflictIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Hide conflict diagnostic");
const hiddenAfterHideIndex = findStepIndex((step, index) => index > hideConflictIndex && step?.type === "assertDomNotContains" && String(step.text || "").includes("\"currentVersion\": 9"));

assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(savedPayloadMetadataIndex, -1);
assert.notEqual(prepareUpdateIndex, -1);
assert.notEqual(updateMetadataIndex, -1);
assert.notEqual(prepareConflictIndex, -1);
assert.notEqual(conflictMetadataIndex, -1);
assert.notEqual(hideConflictIndex, -1);
assert.notEqual(hiddenAfterHideIndex, -1);

assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < savedPayloadMetadataIndex, true);
assert.equal(savedPayloadMetadataIndex < prepareUpdateIndex, true);
assert.equal(prepareUpdateIndex < updateMetadataIndex, true);
assert.equal(updateMetadataIndex < prepareConflictIndex, true);
assert.equal(prepareConflictIndex < conflictMetadataIndex, true);
assert.equal(conflictMetadataIndex < hideConflictIndex, true);
assert.equal(hideConflictIndex < hiddenAfterHideIndex, true);

console.log("report-builder-preview-update-report-document-conflict-diagnostic-scenario-assets ✓ conflict diagnostic uses the current saved payload API-artifact flow and preserves semantic metadata");

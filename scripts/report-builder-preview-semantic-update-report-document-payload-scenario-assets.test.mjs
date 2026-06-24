import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-update-report-document-payload.scenario.mjs";

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
  expressions.some((expression) => expression.includes("Saved report payload: Report Builder Demo") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Update ReportDocument payload: Report Builder Demo") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Prepare update payload"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect update payload"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Hide update payload"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"updateReportDocumentPayload\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"expectedVersion\": 7")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"document\": {")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"semanticSummary\": {")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("update-report-document-payload")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Prepare update request"),
  false,
);

const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const savedPayloadMetadataIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Saved report payload: Report Builder Demo") && String(step.expression || "").includes("Semantic Binding"));
const expectedVersionIndex = findStepIndex((step) => step?.type === "fillSelector" && String(step.selector || "").includes("Expected version") && String(step.value || "") === "7");
const prepareUpdateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare update payload");
const updateMetadataIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Update ReportDocument payload: Report Builder Demo") && String(step.expression || "").includes("Semantic Binding"));
const hiddenBeforeInspectIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"kind\": \"updateReportDocumentPayload\""));
const inspectUpdateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect update payload");
const hideUpdateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Hide update payload");
const hiddenAfterHideIndex = findStepIndex((step, index) => index > hideUpdateIndex && step?.type === "assertDomNotContains" && String(step.text || "").includes("\"expectedVersion\": 7"));

assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(savedPayloadMetadataIndex, -1);
assert.notEqual(expectedVersionIndex, -1);
assert.notEqual(prepareUpdateIndex, -1);
assert.notEqual(updateMetadataIndex, -1);
assert.notEqual(hiddenBeforeInspectIndex, -1);
assert.notEqual(inspectUpdateIndex, -1);
assert.notEqual(hideUpdateIndex, -1);
assert.notEqual(hiddenAfterHideIndex, -1);

assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < savedPayloadMetadataIndex, true);
assert.equal(savedPayloadMetadataIndex < expectedVersionIndex, true);
assert.equal(expectedVersionIndex < prepareUpdateIndex, true);
assert.equal(prepareUpdateIndex < updateMetadataIndex, true);
assert.equal(updateMetadataIndex < hiddenBeforeInspectIndex, true);
assert.equal(hiddenBeforeInspectIndex < inspectUpdateIndex, true);
assert.equal(inspectUpdateIndex < hideUpdateIndex, true);
assert.equal(hideUpdateIndex < hiddenAfterHideIndex, true);

console.log("report-builder-preview-semantic-update-report-document-payload-scenario-assets ✓ update payload uses the current saved payload API-artifact flow and preserves semantic request metadata");

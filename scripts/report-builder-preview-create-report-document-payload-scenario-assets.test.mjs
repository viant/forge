import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-create-report-document-payload.scenario.mjs";

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
  expressions.some((expression) => expression.includes("Create ReportDocument payload: Report Builder Demo") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Prepare create payload"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect create payload"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Hide create payload"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"createReportDocumentPayload\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"reportId\": \"demoReportBuilder\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"compileState\": {")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("create-report-document-payload")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Save report file"),
  false,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Show report JSON"),
  false,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Prepare create request"),
  false,
);

const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const savedPayloadMetadataIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Saved report payload: Report Builder Demo") && String(step.expression || "").includes("Semantic Binding"));
const prepareCreateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare create payload");
const createPayloadMetadataIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Create ReportDocument payload: Report Builder Demo") && String(step.expression || "").includes("Semantic Binding"));
const inspectCreateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect create payload");
const hiddenBeforeInspectIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"kind\": \"createReportDocumentPayload\""));
const hideCreateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Hide create payload");
const hiddenAfterHideIndex = findStepIndex((step, index) => index > hideCreateIndex && step?.type === "assertDomNotContains" && String(step.text || "").includes("\"compileState\": {"));

assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(savedPayloadMetadataIndex, -1);
assert.notEqual(prepareCreateIndex, -1);
assert.notEqual(createPayloadMetadataIndex, -1);
assert.notEqual(inspectCreateIndex, -1);
assert.notEqual(hiddenBeforeInspectIndex, -1);
assert.notEqual(hideCreateIndex, -1);
assert.notEqual(hiddenAfterHideIndex, -1);

assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < savedPayloadMetadataIndex, true);
assert.equal(savedPayloadMetadataIndex < prepareCreateIndex, true);
assert.equal(prepareCreateIndex < createPayloadMetadataIndex, true);
assert.equal(createPayloadMetadataIndex < hiddenBeforeInspectIndex, true);
assert.equal(hiddenBeforeInspectIndex < inspectCreateIndex, true);
assert.equal(inspectCreateIndex < hideCreateIndex, true);
assert.equal(hideCreateIndex < hiddenAfterHideIndex, true);

console.log("report-builder-preview-create-report-document-payload-scenario-assets ✓ create payload uses the current saved payload API-artifact flow and preserves semantic request metadata");

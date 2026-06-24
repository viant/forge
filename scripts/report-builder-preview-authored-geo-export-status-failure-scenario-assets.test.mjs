import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-authored-geo-export-status-failure.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 22);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("Preview patchBuilderState API not available.") && expression.includes("selectedDimensions: ['country']") && expression.includes("selectedMeasures: ['avails']")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("applyAuthoredDocumentBlock API not available.") && expression.includes("geoMapBlock") && expression.includes("Market Geo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Report Builder Demo.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Renderer rejected reportPrint for Report Builder Demo.") && expression.includes("error: 'Renderer rejected reportPrint for Report Builder Demo.'")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Renderer rejected reportPrint for Report Builder Demo.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Unsupported chart primitive in current renderer.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Use a print-safe chart preset.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("demo-export-job-1") && expression.includes("failed") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Available Impressions")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("authored-geo-export-status-failure")),
  true,
);

const pivotIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Preview patchBuilderState API not available."));
const addGeoIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("applyAuthoredDocumentBlock API not available."));
const replaceRowsIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Preview replaceCollectionRows API not available."));
const draftIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("beginStandaloneDraft API not available."));
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const submitExportIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Export snapshot button not found for saved report payload."));
const acceptedExportIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Report Builder Demo."));
const injectFailureIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceExportBehaviors") && String(step.expression || "").includes("Renderer rejected reportPrint for Report Builder Demo."));
const refreshIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Refresh status");
const failureVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Renderer rejected reportPrint for Report Builder Demo."));
const diagnosticIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Unsupported chart primitive in current renderer."));

assert.notEqual(pivotIndex, -1);
assert.notEqual(addGeoIndex, -1);
assert.notEqual(replaceRowsIndex, -1);
assert.notEqual(draftIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(submitExportIndex, -1);
assert.notEqual(acceptedExportIndex, -1);
assert.notEqual(injectFailureIndex, -1);
assert.notEqual(refreshIndex, -1);
assert.notEqual(failureVisibleIndex, -1);
assert.notEqual(diagnosticIndex, -1);

assert.equal(pivotIndex < addGeoIndex, true);
assert.equal(addGeoIndex < replaceRowsIndex, true);
assert.equal(replaceRowsIndex < draftIndex, true);
assert.equal(draftIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < submitExportIndex, true);
assert.equal(submitExportIndex < acceptedExportIndex, true);
assert.equal(acceptedExportIndex < injectFailureIndex, true);
assert.equal(injectFailureIndex < refreshIndex, true);
assert.equal(refreshIndex < failureVisibleIndex, true);
assert.equal(failureVisibleIndex < diagnosticIndex, true);

console.log("report-builder-preview-authored-geo-export-status-failure-scenario-assets ✓ semantic saved-payload export status failures stay explicit while semantic context remains visible");

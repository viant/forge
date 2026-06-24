import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-import-saved-view-export-submit-failure.scenario.mjs";

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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Capacity Trend Q3 Saved View is now the active saved report record.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Saved export request summary") && expression.includes('"from": "savedView"') && expression.includes('"artifactKind": "reportBuilder.savedView"') && expression.includes('"sourceArtifactId": "saved_view_capacityTrendQ3"')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Preview export submit was rejected for Capacity Trend Q3 Saved View.") && expression.includes("demo-export-job-submit-failed-import-saved-view")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Preview export submit was rejected for Capacity Trend Q3 Saved View.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("savedView") && expression.includes("reportBuilder.savedView://saved_view_capacityTrendQ3") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("demo-export-job-submit-failed-import-saved-view") && expression.includes("!text.includes('demo-export-job-1')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === ''") && expression.includes("payloadReady === false")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-saved-view-export-submit-failure")),
  true,
);

const inspectExportIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Saved export request summary"));
const injectFailureIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceExportBehaviors") && String(step.expression || "").includes("Preview export submit was rejected for Capacity Trend Q3 Saved View."));
const submitIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("saved-view export button not found"));
const failureVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Preview export submit was rejected for Capacity Trend Q3 Saved View."));
const failedJobIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("demo-export-job-submit-failed-import-saved-view") && String(step.expression || "").includes("!text.includes('demo-export-job-1')"));
const noDownloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("window.__artifactDownloadCapture.filename === ''"));

assert.notEqual(inspectExportIndex, -1);
assert.notEqual(injectFailureIndex, -1);
assert.notEqual(submitIndex, -1);
assert.notEqual(failureVisibleIndex, -1);
assert.notEqual(failedJobIndex, -1);
assert.notEqual(noDownloadIndex, -1);

assert.equal(inspectExportIndex < injectFailureIndex, true);
assert.equal(injectFailureIndex < submitIndex, true);
assert.equal(submitIndex < failureVisibleIndex, true);
assert.equal(failureVisibleIndex < failedJobIndex, true);
assert.equal(failedJobIndex < noDownloadIndex, true);

console.log("report-builder-preview-import-saved-view-export-submit-failure-scenario-assets ✓ imported saved-view artifact export submit failures stay explicit while semantic context remains visible");

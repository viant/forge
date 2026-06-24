import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-import-report-export-submit-failure.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 14);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Preview export submit was rejected for Capacity Trend Q3.") && expression.includes("demo-export-job-submit-failed-import-request")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Preview export submit was rejected for Capacity Trend Q3.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Available Impressions") && expression.includes("demo-export-job-submit-failed-import-request") && expression.includes("!text.includes('demo-export-job-1')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Imported export: Capacity Trend Q3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === ''") && expression.includes("payloadReady === false")),
  true,
);

const captureIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("__artifactDownloadCapturePatched"));
const injectFailureIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceExportBehaviors") && String(step.expression || "").includes("Preview export submit was rejected for Capacity Trend Q3."));
const submitIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("imported export submit button not found"));
const failureVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Preview export submit was rejected for Capacity Trend Q3."));
const failedJobIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("demo-export-job-submit-failed-import-request") && String(step.expression || "").includes("!text.includes('demo-export-job-1')"));
const failedSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Imported export: Capacity Trend Q3"));
const noDownloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("window.__artifactDownloadCapture.filename === ''"));

assert.notEqual(captureIndex, -1);
assert.notEqual(injectFailureIndex, -1);
assert.notEqual(submitIndex, -1);
assert.notEqual(failureVisibleIndex, -1);
assert.notEqual(failedJobIndex, -1);
assert.notEqual(failedSummaryIndex, -1);
assert.notEqual(noDownloadIndex, -1);

assert.equal(captureIndex < injectFailureIndex, true);
assert.equal(injectFailureIndex < submitIndex, true);
assert.equal(submitIndex < failureVisibleIndex, true);
assert.equal(failureVisibleIndex < failedJobIndex, true);
assert.equal(failedJobIndex < failedSummaryIndex, true);
assert.equal(failedSummaryIndex < noDownloadIndex, true);

console.log("report-builder-preview-import-report-export-submit-failure-scenario-assets ✓ imported raw export-request submit failures stay explicit while semantic context remains visible");

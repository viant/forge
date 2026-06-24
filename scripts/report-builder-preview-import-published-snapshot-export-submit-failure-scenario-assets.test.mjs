import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-import-published-snapshot-export-submit-failure.scenario.mjs";

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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Capacity Trend Q3 Published Snapshot is now the active saved report record.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Saved export request summary") && expression.includes('"from": "publishedSnapshot"') && expression.includes('"artifactKind": "reportBuilder.publishedSnapshot"') && expression.includes('"sourceArtifactId": "published_snapshot_capacityTrendQ3"')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Preview export submit was rejected for Capacity Trend Q3 Published Snapshot.") && expression.includes("demo-export-job-submit-failed-import-published-snapshot")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Preview export submit was rejected for Capacity Trend Q3 Published Snapshot.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("publishedSnapshot") && expression.includes("reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("demo-export-job-submit-failed-import-published-snapshot") && expression.includes("!text.includes('demo-export-job-1')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === ''") && expression.includes("payloadReady === false")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-published-snapshot-export-submit-failure")),
  true,
);

const inspectExportIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Saved export request summary"));
const injectFailureIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceExportBehaviors") && String(step.expression || "").includes("Preview export submit was rejected for Capacity Trend Q3 Published Snapshot."));
const submitIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("published-snapshot export button not found"));
const failureVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Preview export submit was rejected for Capacity Trend Q3 Published Snapshot."));
const failedJobIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("demo-export-job-submit-failed-import-published-snapshot") && String(step.expression || "").includes("!text.includes('demo-export-job-1')"));
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

console.log("report-builder-preview-import-published-snapshot-export-submit-failure-scenario-assets ✓ imported published-snapshot artifact export submit failures stay explicit while semantic context remains visible");

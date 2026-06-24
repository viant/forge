import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-list-entry-published-snapshot-export-artifact-failure.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 24);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Trend Q3 Published Snapshot")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Selected list entry export request summary") && expression.includes('"from": "publishedSnapshot"') && expression.includes('"artifactKind": "reportBuilder.publishedSnapshot"') && expression.includes('"artifactRef": "reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3"')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Capacity Trend Q3 Published Snapshot.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is succeeded.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Could not load the preview export artifact for Capacity Trend Q3 Published Snapshot.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Could not load the preview export artifact for Capacity Trend Q3 Published Snapshot.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("demo-export-artifact-1") && expression.includes("succeeded") && expression.includes("imported published-snapshot") && expression.includes("published-snapshot artifact") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === ''") && expression.includes("payloadReady === false")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("list-entry-published-snapshot-export-artifact-failure")),
  true,
);

const inspectExportIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Selected list entry export request summary"));
const submitIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Selected list entry export submit button not found"));
const acceptedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Capacity Trend Q3 Published Snapshot."));
const firstRefreshIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Refresh status");
const queuedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is queued."));
const secondRefreshIndex = findStepIndex((step, index) => index > firstRefreshIndex && step?.type === "clickRole" && step?.name === "Refresh status");
const succeededIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is succeeded."));
const injectFailureIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceExportBehaviors") && String(step.expression || "").includes("Could not load the preview export artifact for Capacity Trend Q3 Published Snapshot."));
const downloadArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Download artifact");
const failureVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Could not load the preview export artifact for Capacity Trend Q3 Published Snapshot."));
const noDownloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("window.__artifactDownloadCapture.filename === ''"));

assert.notEqual(inspectExportIndex, -1);
assert.notEqual(submitIndex, -1);
assert.notEqual(acceptedIndex, -1);
assert.notEqual(firstRefreshIndex, -1);
assert.notEqual(queuedIndex, -1);
assert.notEqual(secondRefreshIndex, -1);
assert.notEqual(succeededIndex, -1);
assert.notEqual(injectFailureIndex, -1);
assert.notEqual(downloadArtifactIndex, -1);
assert.notEqual(failureVisibleIndex, -1);
assert.notEqual(noDownloadIndex, -1);

assert.equal(inspectExportIndex < submitIndex, true);
assert.equal(submitIndex < acceptedIndex, true);
assert.equal(acceptedIndex < firstRefreshIndex, true);
assert.equal(firstRefreshIndex < queuedIndex, true);
assert.equal(queuedIndex < secondRefreshIndex, true);
assert.equal(secondRefreshIndex < succeededIndex, true);
assert.equal(succeededIndex < injectFailureIndex, true);
assert.equal(injectFailureIndex < downloadArtifactIndex, true);
assert.equal(downloadArtifactIndex < failureVisibleIndex, true);
assert.equal(failureVisibleIndex < noDownloadIndex, true);

console.log("report-builder-preview-list-entry-published-snapshot-export-artifact-failure-scenario-assets ✓ selected published-snapshot list-entry export artifact failures stay explicit while shared-artifact semantic context remains visible");

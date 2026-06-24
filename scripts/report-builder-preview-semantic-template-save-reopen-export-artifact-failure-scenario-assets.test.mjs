import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-template-save-reopen-export-artifact-failure.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 26);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Market Brief for editing.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Market Brief.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is succeeded.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Could not load the preview export artifact for Market Brief.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Could not load the preview export artifact for Market Brief.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("demo-export-artifact-1") && expression.includes("succeeded") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Available Impressions") && expression.includes("Household Uniques")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === ''") && expression.includes("payloadReady === false")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("template-save-reopen-export-artifact-failure")),
  true,
);

const reopenIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument: Market Brief"));
const submitIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Export snapshot button not found in reopened Market Brief section."));
const acceptedExportIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Market Brief."));
const firstRefreshIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Refresh status");
const queuedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is queued."));
const secondRefreshIndex = findStepIndex((step, index) => index > firstRefreshIndex && step?.type === "clickRole" && step?.name === "Refresh status");
const succeededIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is succeeded."));
const injectFailureIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceExportBehaviors") && String(step.expression || "").includes("Could not load the preview export artifact for Market Brief."));
const downloadArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Download artifact");
const failureVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Could not load the preview export artifact for Market Brief."));
const noDownloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("window.__artifactDownloadCapture.filename === ''"));

assert.notEqual(reopenIndex, -1);
assert.notEqual(submitIndex, -1);
assert.notEqual(acceptedExportIndex, -1);
assert.notEqual(firstRefreshIndex, -1);
assert.notEqual(queuedIndex, -1);
assert.notEqual(secondRefreshIndex, -1);
assert.notEqual(succeededIndex, -1);
assert.notEqual(injectFailureIndex, -1);
assert.notEqual(downloadArtifactIndex, -1);
assert.notEqual(failureVisibleIndex, -1);
assert.notEqual(noDownloadIndex, -1);

assert.equal(reopenIndex < submitIndex, true);
assert.equal(submitIndex < acceptedExportIndex, true);
assert.equal(acceptedExportIndex < firstRefreshIndex, true);
assert.equal(firstRefreshIndex < queuedIndex, true);
assert.equal(queuedIndex < secondRefreshIndex, true);
assert.equal(secondRefreshIndex < succeededIndex, true);
assert.equal(succeededIndex < injectFailureIndex, true);
assert.equal(injectFailureIndex < downloadArtifactIndex, true);
assert.equal(downloadArtifactIndex < failureVisibleIndex, true);
assert.equal(failureVisibleIndex < noDownloadIndex, true);

console.log("report-builder-preview-semantic-template-save-reopen-export-artifact-failure-scenario-assets ✓ Market Brief reopened export artifact failures stay explicit while semantic context remains visible");

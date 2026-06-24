import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-template-save-reopen-export-submit-failure.scenario.mjs";

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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Market Brief for editing.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Preview export submit was rejected for Market Brief.") && expression.includes("demo-export-job-submit-failed-reopened")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Preview export submit was rejected for Market Brief.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Available Impressions") && expression.includes("Household Uniques") && expression.includes("demo-export-job-submit-failed-reopened") && expression.includes("!text.includes('demo-export-job-1')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Reopened export: Market Brief")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === ''") && expression.includes("payloadReady === false")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("template-save-reopen-export-submit-failure")),
  true,
);

const reopenIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument: Market Brief"));
const injectFailureIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceExportBehaviors") && String(step.expression || "").includes("Preview export submit was rejected for Market Brief."));
const submitIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Export snapshot button not found in reopened Market Brief section."));
const failureVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Preview export submit was rejected for Market Brief."));
const failedJobIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("demo-export-job-submit-failed-reopened") && String(step.expression || "").includes("!text.includes('demo-export-job-1')"));
const failedSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Reopened export: Market Brief"));
const noDownloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("window.__artifactDownloadCapture.filename === ''"));

assert.notEqual(reopenIndex, -1);
assert.notEqual(injectFailureIndex, -1);
assert.notEqual(submitIndex, -1);
assert.notEqual(failureVisibleIndex, -1);
assert.notEqual(failedJobIndex, -1);
assert.notEqual(failedSummaryIndex, -1);
assert.notEqual(noDownloadIndex, -1);

assert.equal(reopenIndex < injectFailureIndex, true);
assert.equal(injectFailureIndex < submitIndex, true);
assert.equal(submitIndex < failureVisibleIndex, true);
assert.equal(failureVisibleIndex < failedJobIndex, true);
assert.equal(failedJobIndex < failedSummaryIndex, true);
assert.equal(failedSummaryIndex < noDownloadIndex, true);

console.log("report-builder-preview-semantic-template-save-reopen-export-submit-failure-scenario-assets ✓ Market Brief reopened export submit failures stay explicit while semantic context remains visible");

import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-import-report-export-execution.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 16);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported export request:")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Available Impressions")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Capacity Trend Q3.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("demo-export-job-1") && expression.includes("queued") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is queued.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is succeeded.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === 'Capacity Trend Q3.pdf'") && expression.includes("payloadReady === true")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.mimeType === 'application/pdf'") && expression.includes("%PDF-demo Capacity Trend Q3")),
  true,
);

const inspectExportIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("inspect export button not found"));
const captureIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("__artifactDownloadCapturePatched"));
const submitIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("imported export submit button not found"));
const acceptedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Capacity Trend Q3."));
const firstRefreshIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Refresh status");
const queuedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is queued."));
const secondRefreshIndex = findStepIndex((step, index) => index > firstRefreshIndex && step?.type === "clickRole" && step?.name === "Refresh status");
const succeededIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is succeeded."));
const downloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Download artifact");
const downloadedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("window.__artifactDownloadCapture.filename === 'Capacity Trend Q3.pdf'"));

assert.notEqual(inspectExportIndex, -1);
assert.notEqual(captureIndex, -1);
assert.notEqual(submitIndex, -1);
assert.notEqual(acceptedIndex, -1);
assert.notEqual(firstRefreshIndex, -1);
assert.notEqual(queuedIndex, -1);
assert.notEqual(secondRefreshIndex, -1);
assert.notEqual(succeededIndex, -1);
assert.notEqual(downloadIndex, -1);
assert.notEqual(downloadedIndex, -1);

assert.equal(inspectExportIndex < captureIndex, true);
assert.equal(captureIndex < submitIndex, true);
assert.equal(submitIndex < acceptedIndex, true);
assert.equal(acceptedIndex < firstRefreshIndex, true);
assert.equal(firstRefreshIndex < queuedIndex, true);
assert.equal(queuedIndex < secondRefreshIndex, true);
assert.equal(secondRefreshIndex < succeededIndex, true);
assert.equal(succeededIndex < downloadIndex, true);
assert.equal(downloadIndex < downloadedIndex, true);

console.log("report-builder-preview-import-report-export-execution-scenario-assets ✓ imported raw export-request execution preserves request, status, and artifact behavior end to end");

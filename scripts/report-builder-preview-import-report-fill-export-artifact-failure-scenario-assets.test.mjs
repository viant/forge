import assert from "node:assert/strict";

import attachScenario from "../tests/report-builder-preview-semantic-import-report-fill-attach-report-spec-export-artifact-failure.scenario.mjs";
import detachScenario from "../tests/report-builder-preview-semantic-import-report-fill-detach-report-spec-export-artifact-failure.scenario.mjs";

for (const scenario of [attachScenario, detachScenario]) {
  assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
  assert.deepEqual(scenario.viewport, {
    width: 1280,
    height: 960,
  });
  assert.equal(Array.isArray(scenario.steps), true);
  assert.ok(scenario.steps.length > 20);
}

function expressionsFor(scenario) {
  return scenario.steps
    .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
    .map((step) => String(step.expression || ""));
}

function findStepIndex(scenario, predicate) {
  return scenario.steps.findIndex(predicate);
}

const attachExpressions = expressionsFor(attachScenario);
assert.equal(
  attachScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Capacity Trend Q3.")),
  true,
);
assert.equal(
  attachScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is succeeded.")),
  true,
);
assert.equal(
  attachExpressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Could not load the preview export artifact for Capacity Trend Q3.")),
  true,
);
assert.equal(
  attachScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Could not load the preview export artifact for Capacity Trend Q3.")),
  true,
);
assert.equal(
  attachExpressions.some((expression) => expression.includes("demo-export-artifact-1") && expression.includes("succeeded") && expression.includes("ATTACHED REPORTFILL") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  attachExpressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === ''") && expression.includes("payloadReady === false")),
  true,
);

const attachInspectIndex = findStepIndex(attachScenario, (step) => step?.type === "waitForEval" && String(step.expression || "").includes("Imported export request summary"));
const attachSubmitIndex = findStepIndex(attachScenario, (step) => step?.type === "eval" && String(step.expression || "").includes("imported pipeline export button not found"));
const attachAcceptedIndex = findStepIndex(attachScenario, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Capacity Trend Q3."));
const attachFirstRefreshIndex = findStepIndex(attachScenario, (step) => step?.type === "clickRole" && step?.name === "Refresh status");
const attachQueuedIndex = findStepIndex(attachScenario, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is queued."));
const attachSecondRefreshIndex = findStepIndex(attachScenario, (step, index) => index > attachFirstRefreshIndex && step?.type === "clickRole" && step?.name === "Refresh status");
const attachSucceededIndex = findStepIndex(attachScenario, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is succeeded."));
const attachInjectFailureIndex = findStepIndex(attachScenario, (step) => step?.type === "eval" && String(step.expression || "").includes("replaceExportBehaviors") && String(step.expression || "").includes("Could not load the preview export artifact for Capacity Trend Q3."));
const attachDownloadIndex = findStepIndex(attachScenario, (step) => step?.type === "clickRole" && step?.name === "Download artifact");
const attachFailureVisibleIndex = findStepIndex(attachScenario, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Could not load the preview export artifact for Capacity Trend Q3."));
const attachNoDownloadIndex = findStepIndex(attachScenario, (step) => step?.type === "waitForEval" && String(step.expression || "").includes("window.__artifactDownloadCapture.filename === ''"));

assert.notEqual(attachInspectIndex, -1);
assert.notEqual(attachSubmitIndex, -1);
assert.notEqual(attachAcceptedIndex, -1);
assert.notEqual(attachFirstRefreshIndex, -1);
assert.notEqual(attachQueuedIndex, -1);
assert.notEqual(attachSecondRefreshIndex, -1);
assert.notEqual(attachSucceededIndex, -1);
assert.notEqual(attachInjectFailureIndex, -1);
assert.notEqual(attachDownloadIndex, -1);
assert.notEqual(attachFailureVisibleIndex, -1);
assert.notEqual(attachNoDownloadIndex, -1);

assert.equal(attachInspectIndex < attachSubmitIndex, true);
assert.equal(attachSubmitIndex < attachAcceptedIndex, true);
assert.equal(attachAcceptedIndex < attachFirstRefreshIndex, true);
assert.equal(attachFirstRefreshIndex < attachQueuedIndex, true);
assert.equal(attachQueuedIndex < attachSecondRefreshIndex, true);
assert.equal(attachSecondRefreshIndex < attachSucceededIndex, true);
assert.equal(attachSucceededIndex < attachInjectFailureIndex, true);
assert.equal(attachInjectFailureIndex < attachDownloadIndex, true);
assert.equal(attachDownloadIndex < attachFailureVisibleIndex, true);
assert.equal(attachFailureVisibleIndex < attachNoDownloadIndex, true);

const detachExpressions = expressionsFor(detachScenario);
assert.equal(
  detachScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Capacity Trend Q3.")),
  true,
);
assert.equal(
  detachScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is succeeded.")),
  true,
);
assert.equal(
  detachExpressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Could not load the preview export artifact for Capacity Trend Q3.")),
  true,
);
assert.equal(
  detachScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Could not load the preview export artifact for Capacity Trend Q3.")),
  true,
);
assert.equal(
  detachExpressions.some((expression) => expression.includes("demo-export-artifact-1") && expression.includes("succeeded") && expression.includes("PREVIEW FILL") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  detachExpressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === ''") && expression.includes("payloadReady === false")),
  true,
);

const detachInspectIndex = findStepIndex(detachScenario, (step) => step?.type === "waitForEval" && String(step.expression || "").includes("Imported export request summary"));
const detachSubmitIndex = findStepIndex(detachScenario, (step) => step?.type === "eval" && String(step.expression || "").includes("imported pipeline export button not found"));
const detachAcceptedIndex = findStepIndex(detachScenario, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Capacity Trend Q3."));
const detachFirstRefreshIndex = findStepIndex(detachScenario, (step) => step?.type === "clickRole" && step?.name === "Refresh status");
const detachQueuedIndex = findStepIndex(detachScenario, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is queued."));
const detachSecondRefreshIndex = findStepIndex(detachScenario, (step, index) => index > detachFirstRefreshIndex && step?.type === "clickRole" && step?.name === "Refresh status");
const detachSucceededIndex = findStepIndex(detachScenario, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is succeeded."));
const detachInjectFailureIndex = findStepIndex(detachScenario, (step) => step?.type === "eval" && String(step.expression || "").includes("replaceExportBehaviors") && String(step.expression || "").includes("Could not load the preview export artifact for Capacity Trend Q3."));
const detachDownloadIndex = findStepIndex(detachScenario, (step) => step?.type === "clickRole" && step?.name === "Download artifact");
const detachFailureVisibleIndex = findStepIndex(detachScenario, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Could not load the preview export artifact for Capacity Trend Q3."));
const detachNoDownloadIndex = findStepIndex(detachScenario, (step) => step?.type === "waitForEval" && String(step.expression || "").includes("window.__artifactDownloadCapture.filename === ''"));

assert.notEqual(detachInspectIndex, -1);
assert.notEqual(detachSubmitIndex, -1);
assert.notEqual(detachAcceptedIndex, -1);
assert.notEqual(detachFirstRefreshIndex, -1);
assert.notEqual(detachQueuedIndex, -1);
assert.notEqual(detachSecondRefreshIndex, -1);
assert.notEqual(detachSucceededIndex, -1);
assert.notEqual(detachInjectFailureIndex, -1);
assert.notEqual(detachDownloadIndex, -1);
assert.notEqual(detachFailureVisibleIndex, -1);
assert.notEqual(detachNoDownloadIndex, -1);

assert.equal(detachInspectIndex < detachSubmitIndex, true);
assert.equal(detachSubmitIndex < detachAcceptedIndex, true);
assert.equal(detachAcceptedIndex < detachFirstRefreshIndex, true);
assert.equal(detachFirstRefreshIndex < detachQueuedIndex, true);
assert.equal(detachQueuedIndex < detachSecondRefreshIndex, true);
assert.equal(detachSecondRefreshIndex < detachSucceededIndex, true);
assert.equal(detachSucceededIndex < detachInjectFailureIndex, true);
assert.equal(detachInjectFailureIndex < detachDownloadIndex, true);
assert.equal(detachDownloadIndex < detachFailureVisibleIndex, true);
assert.equal(detachFailureVisibleIndex < detachNoDownloadIndex, true);

console.log("report-builder-preview-import-report-fill-export-artifact-failure-scenario-assets ✓ imported ReportFill pipeline attach/detach export artifact failures stay explicit while runtime semantic context remains visible");

import assert from "node:assert/strict";

import attachScenario from "../tests/report-builder-preview-semantic-import-report-fill-attach-report-spec-export-submit-failure.scenario.mjs";
import detachScenario from "../tests/report-builder-preview-semantic-import-report-fill-detach-report-spec-export-submit-failure.scenario.mjs";

for (const scenario of [attachScenario, detachScenario]) {
  assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
  assert.deepEqual(scenario.viewport, {
    width: 1280,
    height: 960,
  });
  assert.equal(Array.isArray(scenario.steps), true);
  assert.ok(scenario.steps.length > 16);
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
  attachExpressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Preview export submit was rejected for Capacity Trend Q3.") && expression.includes("demo-export-job-submit-failed-fill-attach")),
  true,
);
assert.equal(
  attachScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Preview export submit was rejected for Capacity Trend Q3.")),
  true,
);
assert.equal(
  attachExpressions.some((expression) => expression.includes("ATTACHED REPORTFILL") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("demo-export-job-submit-failed-fill-attach") && expression.includes("!text.includes('demo-export-job-1')")),
  true,
);
assert.equal(
  attachExpressions.some((expression) => expression.includes("Imported export: Capacity Trend Q3")),
  true,
);
assert.equal(
  attachExpressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === ''") && expression.includes("payloadReady === false")),
  true,
);

const attachInspectIndex = findStepIndex(attachScenario, (step) => step?.type === "waitForEval" && String(step.expression || "").includes("Imported export request summary"));
const attachInjectFailureIndex = findStepIndex(attachScenario, (step) => step?.type === "eval" && String(step.expression || "").includes("replaceExportBehaviors") && String(step.expression || "").includes("Preview export submit was rejected for Capacity Trend Q3."));
const attachSubmitIndex = findStepIndex(attachScenario, (step) => step?.type === "eval" && String(step.expression || "").includes("imported pipeline export button not found"));
const attachFailureVisibleIndex = findStepIndex(attachScenario, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Preview export submit was rejected for Capacity Trend Q3."));
const attachFailedJobIndex = findStepIndex(attachScenario, (step) => step?.type === "waitForEval" && String(step.expression || "").includes("demo-export-job-submit-failed-fill-attach") && String(step.expression || "").includes("!text.includes('demo-export-job-1')"));
const attachFailedSummaryIndex = findStepIndex(attachScenario, (step) => step?.type === "waitForEval" && String(step.expression || "").includes("Imported export: Capacity Trend Q3"));
const attachNoDownloadIndex = findStepIndex(attachScenario, (step) => step?.type === "waitForEval" && String(step.expression || "").includes("window.__artifactDownloadCapture.filename === ''"));

assert.notEqual(attachInspectIndex, -1);
assert.notEqual(attachInjectFailureIndex, -1);
assert.notEqual(attachSubmitIndex, -1);
assert.notEqual(attachFailureVisibleIndex, -1);
assert.notEqual(attachFailedJobIndex, -1);
assert.notEqual(attachFailedSummaryIndex, -1);
assert.notEqual(attachNoDownloadIndex, -1);

assert.equal(attachInspectIndex < attachInjectFailureIndex, true);
assert.equal(attachInjectFailureIndex < attachSubmitIndex, true);
assert.equal(attachSubmitIndex < attachFailureVisibleIndex, true);
assert.equal(attachFailureVisibleIndex < attachFailedJobIndex, true);
assert.equal(attachFailedJobIndex < attachFailedSummaryIndex, true);
assert.equal(attachFailedSummaryIndex < attachNoDownloadIndex, true);

const detachExpressions = expressionsFor(detachScenario);
assert.equal(
  detachExpressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Preview export submit was rejected for Capacity Trend Q3.") && expression.includes("demo-export-job-submit-failed-fill-detach")),
  true,
);
assert.equal(
  detachScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Preview export submit was rejected for Capacity Trend Q3.")),
  true,
);
assert.equal(
  detachExpressions.some((expression) => expression.includes("PREVIEW FILL") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("demo-export-job-submit-failed-fill-detach") && expression.includes("!text.includes('demo-export-job-1')")),
  true,
);
assert.equal(
  detachExpressions.some((expression) => expression.includes("Imported export: Capacity Trend Q3")),
  true,
);
assert.equal(
  detachExpressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === ''") && expression.includes("payloadReady === false")),
  true,
);

const detachInspectIndex = findStepIndex(detachScenario, (step) => step?.type === "waitForEval" && String(step.expression || "").includes("Imported export request summary"));
const detachInjectFailureIndex = findStepIndex(detachScenario, (step) => step?.type === "eval" && String(step.expression || "").includes("replaceExportBehaviors") && String(step.expression || "").includes("Preview export submit was rejected for Capacity Trend Q3."));
const detachSubmitIndex = findStepIndex(detachScenario, (step) => step?.type === "eval" && String(step.expression || "").includes("imported pipeline export button not found"));
const detachFailureVisibleIndex = findStepIndex(detachScenario, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Preview export submit was rejected for Capacity Trend Q3."));
const detachFailedJobIndex = findStepIndex(detachScenario, (step) => step?.type === "waitForEval" && String(step.expression || "").includes("demo-export-job-submit-failed-fill-detach") && String(step.expression || "").includes("!text.includes('demo-export-job-1')"));
const detachFailedSummaryIndex = findStepIndex(detachScenario, (step) => step?.type === "waitForEval" && String(step.expression || "").includes("Imported export: Capacity Trend Q3"));
const detachNoDownloadIndex = findStepIndex(detachScenario, (step) => step?.type === "waitForEval" && String(step.expression || "").includes("window.__artifactDownloadCapture.filename === ''"));

assert.notEqual(detachInspectIndex, -1);
assert.notEqual(detachInjectFailureIndex, -1);
assert.notEqual(detachSubmitIndex, -1);
assert.notEqual(detachFailureVisibleIndex, -1);
assert.notEqual(detachFailedJobIndex, -1);
assert.notEqual(detachFailedSummaryIndex, -1);
assert.notEqual(detachNoDownloadIndex, -1);

assert.equal(detachInspectIndex < detachInjectFailureIndex, true);
assert.equal(detachInjectFailureIndex < detachSubmitIndex, true);
assert.equal(detachSubmitIndex < detachFailureVisibleIndex, true);
assert.equal(detachFailureVisibleIndex < detachFailedJobIndex, true);
assert.equal(detachFailedJobIndex < detachFailedSummaryIndex, true);
assert.equal(detachFailedSummaryIndex < detachNoDownloadIndex, true);

console.log("report-builder-preview-import-report-fill-export-submit-failure-scenario-assets ✓ imported ReportFill pipeline attach/detach export submit failures stay explicit while runtime semantic context remains visible");

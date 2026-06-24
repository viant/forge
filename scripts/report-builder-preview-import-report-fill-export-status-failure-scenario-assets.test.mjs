import assert from "node:assert/strict";

import attachScenario from "../tests/report-builder-preview-semantic-import-report-fill-attach-report-spec-export-status-failure.scenario.mjs";
import detachScenario from "../tests/report-builder-preview-semantic-import-report-fill-detach-report-spec-export-status-failure.scenario.mjs";

for (const scenario of [attachScenario, detachScenario]) {
  assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
  assert.deepEqual(scenario.viewport, {
    width: 1280,
    height: 960,
  });
  assert.equal(Array.isArray(scenario.steps), true);
  assert.ok(scenario.steps.length > 18);
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
  attachExpressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Renderer rejected reportPrint for Capacity Trend Q3.") && expression.includes("error: 'Renderer rejected reportPrint for Capacity Trend Q3.'")),
  true,
);
assert.equal(
  attachScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Renderer rejected reportPrint for Capacity Trend Q3.")),
  true,
);
assert.equal(
  attachScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Unsupported chart primitive in current renderer.")),
  true,
);
assert.equal(
  attachScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Use a print-safe chart preset.")),
  true,
);
assert.equal(
  attachExpressions.some((expression) => expression.includes("demo-export-job-1") && expression.includes("failed") && expression.includes("ATTACHED REPORTFILL") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);

const attachInspectIndex = findStepIndex(attachScenario, (step) => step?.type === "waitForEval" && String(step.expression || "").includes("Imported export request summary"));
const attachSubmitIndex = findStepIndex(attachScenario, (step) => step?.type === "eval" && String(step.expression || "").includes("imported pipeline export button not found"));
const attachAcceptedIndex = findStepIndex(attachScenario, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Capacity Trend Q3."));
const attachInjectFailureIndex = findStepIndex(attachScenario, (step) => step?.type === "eval" && String(step.expression || "").includes("replaceExportBehaviors") && String(step.expression || "").includes("Renderer rejected reportPrint for Capacity Trend Q3."));
const attachRefreshIndex = findStepIndex(attachScenario, (step) => step?.type === "clickRole" && step?.name === "Refresh status");
const attachFailureVisibleIndex = findStepIndex(attachScenario, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Renderer rejected reportPrint for Capacity Trend Q3."));
const attachDiagnosticIndex = findStepIndex(attachScenario, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Unsupported chart primitive in current renderer."));

assert.notEqual(attachInspectIndex, -1);
assert.notEqual(attachSubmitIndex, -1);
assert.notEqual(attachAcceptedIndex, -1);
assert.notEqual(attachInjectFailureIndex, -1);
assert.notEqual(attachRefreshIndex, -1);
assert.notEqual(attachFailureVisibleIndex, -1);
assert.notEqual(attachDiagnosticIndex, -1);

assert.equal(attachInspectIndex < attachSubmitIndex, true);
assert.equal(attachSubmitIndex < attachAcceptedIndex, true);
assert.equal(attachAcceptedIndex < attachInjectFailureIndex, true);
assert.equal(attachInjectFailureIndex < attachRefreshIndex, true);
assert.equal(attachRefreshIndex < attachFailureVisibleIndex, true);
assert.equal(attachFailureVisibleIndex < attachDiagnosticIndex, true);

const detachExpressions = expressionsFor(detachScenario);
assert.equal(
  detachScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Capacity Trend Q3.")),
  true,
);
assert.equal(
  detachExpressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Renderer rejected reportPrint for Capacity Trend Q3.") && expression.includes("error: 'Renderer rejected reportPrint for Capacity Trend Q3.'")),
  true,
);
assert.equal(
  detachScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Renderer rejected reportPrint for Capacity Trend Q3.")),
  true,
);
assert.equal(
  detachScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Unsupported chart primitive in current renderer.")),
  true,
);
assert.equal(
  detachScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Use a print-safe chart preset.")),
  true,
);
assert.equal(
  detachExpressions.some((expression) => expression.includes("demo-export-job-1") && expression.includes("failed") && expression.includes("PREVIEW FILL") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);

const detachInspectIndex = findStepIndex(detachScenario, (step) => step?.type === "waitForEval" && String(step.expression || "").includes("Imported export request summary"));
const detachSubmitIndex = findStepIndex(detachScenario, (step) => step?.type === "eval" && String(step.expression || "").includes("imported pipeline export button not found"));
const detachAcceptedIndex = findStepIndex(detachScenario, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Capacity Trend Q3."));
const detachInjectFailureIndex = findStepIndex(detachScenario, (step) => step?.type === "eval" && String(step.expression || "").includes("replaceExportBehaviors") && String(step.expression || "").includes("Renderer rejected reportPrint for Capacity Trend Q3."));
const detachRefreshIndex = findStepIndex(detachScenario, (step) => step?.type === "clickRole" && step?.name === "Refresh status");
const detachFailureVisibleIndex = findStepIndex(detachScenario, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Renderer rejected reportPrint for Capacity Trend Q3."));
const detachDiagnosticIndex = findStepIndex(detachScenario, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Unsupported chart primitive in current renderer."));

assert.notEqual(detachInspectIndex, -1);
assert.notEqual(detachSubmitIndex, -1);
assert.notEqual(detachAcceptedIndex, -1);
assert.notEqual(detachInjectFailureIndex, -1);
assert.notEqual(detachRefreshIndex, -1);
assert.notEqual(detachFailureVisibleIndex, -1);
assert.notEqual(detachDiagnosticIndex, -1);

assert.equal(detachInspectIndex < detachSubmitIndex, true);
assert.equal(detachSubmitIndex < detachAcceptedIndex, true);
assert.equal(detachAcceptedIndex < detachInjectFailureIndex, true);
assert.equal(detachInjectFailureIndex < detachRefreshIndex, true);
assert.equal(detachRefreshIndex < detachFailureVisibleIndex, true);
assert.equal(detachFailureVisibleIndex < detachDiagnosticIndex, true);

console.log("report-builder-preview-import-report-fill-export-status-failure-scenario-assets ✓ imported ReportFill pipeline attach/detach export status failures stay explicit while runtime semantic context remains visible");

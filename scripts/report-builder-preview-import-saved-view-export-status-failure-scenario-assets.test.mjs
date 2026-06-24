import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-import-saved-view-export-status-failure.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 22);

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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Capacity Trend Q3 Saved View.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Renderer rejected reportPrint for Capacity Trend Q3 Saved View.") && expression.includes("error: 'Renderer rejected reportPrint for Capacity Trend Q3 Saved View.'")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Renderer rejected reportPrint for Capacity Trend Q3 Saved View.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Unsupported chart primitive in current renderer.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Use a print-safe chart preset.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("demo-export-job-1") && expression.includes("failed") && expression.includes("savedView") && expression.includes("reportBuilder.savedView://saved_view_capacityTrendQ3") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-saved-view-export-status-failure")),
  true,
);

const inspectExportIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Saved export request summary"));
const submitIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("saved-view export button not found"));
const acceptedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Capacity Trend Q3 Saved View."));
const injectFailureIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceExportBehaviors") && String(step.expression || "").includes("Renderer rejected reportPrint for Capacity Trend Q3 Saved View."));
const refreshIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Refresh status");
const failureVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Renderer rejected reportPrint for Capacity Trend Q3 Saved View."));
const diagnosticIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Unsupported chart primitive in current renderer."));

assert.notEqual(inspectExportIndex, -1);
assert.notEqual(submitIndex, -1);
assert.notEqual(acceptedIndex, -1);
assert.notEqual(injectFailureIndex, -1);
assert.notEqual(refreshIndex, -1);
assert.notEqual(failureVisibleIndex, -1);
assert.notEqual(diagnosticIndex, -1);

assert.equal(inspectExportIndex < submitIndex, true);
assert.equal(submitIndex < acceptedIndex, true);
assert.equal(acceptedIndex < injectFailureIndex, true);
assert.equal(injectFailureIndex < refreshIndex, true);
assert.equal(refreshIndex < failureVisibleIndex, true);
assert.equal(failureVisibleIndex < diagnosticIndex, true);

console.log("report-builder-preview-import-saved-view-export-status-failure-scenario-assets ✓ imported saved-view artifact export status failures stay explicit while semantic context remains visible");

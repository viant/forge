import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-import-published-snapshot-export-status-failure.scenario.mjs";

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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Capacity Trend Q3 Published Snapshot is now the active saved report record.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Saved export request summary") && expression.includes('"from": "publishedSnapshot"') && expression.includes('"artifactKind": "reportBuilder.publishedSnapshot"') && expression.includes('"sourceArtifactId": "published_snapshot_capacityTrendQ3"')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Capacity Trend Q3 Published Snapshot.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Renderer rejected reportPrint for Capacity Trend Q3 Published Snapshot.") && expression.includes("error: 'Renderer rejected reportPrint for Capacity Trend Q3 Published Snapshot.'")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Renderer rejected reportPrint for Capacity Trend Q3 Published Snapshot.")),
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
  expressions.some((expression) => expression.includes("demo-export-job-1") && expression.includes("failed") && expression.includes("publishedSnapshot") && expression.includes("reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-published-snapshot-export-status-failure")),
  true,
);

const inspectExportIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Saved export request summary"));
const submitIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("published-snapshot export button not found"));
const acceptedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Capacity Trend Q3 Published Snapshot."));
const injectFailureIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceExportBehaviors") && String(step.expression || "").includes("Renderer rejected reportPrint for Capacity Trend Q3 Published Snapshot."));
const refreshIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Refresh status");
const failureVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Renderer rejected reportPrint for Capacity Trend Q3 Published Snapshot."));
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

console.log("report-builder-preview-import-published-snapshot-export-status-failure-scenario-assets ✓ imported published-snapshot artifact export status failures stay explicit while semantic context remains visible");

import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-table-unsupported-warning.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 9);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("replaceRuntimeActionBehaviors") && expression.includes("blockKind: 'tableBlock'") && expression.includes("fieldRef: 'eventDate'") && expression.includes("Show date details")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes(".forge-report-runtime-table-panel .forge-dashboard-row-action")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomContains" && String(step.text || "").includes("Runtime Diagnostics")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomContains" && String(step.text || "").includes("Runtime refinement actions are unavailable for Date because no backend runtime filter mapping is declared.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomContains" && String(step.text || "").includes("Show date details")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("Keep only")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("Exclude")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("Drill to Time Detail")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("runtime-table-unsupported-warning-proof")),
  true,
);

const injectActionsIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("replaceRuntimeActionBehaviors"));
const tableReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes(".forge-report-runtime-table-panel .forge-dashboard-row-action"));
const diagnosticsIndex = findStepIndex((step) => step?.type === "assertDomContains" && String(step?.text || "").includes("Runtime Diagnostics"));
const warningIndex = findStepIndex((step) => step?.type === "assertDomContains" && String(step?.text || "").includes("Runtime refinement actions are unavailable for Date"));
const detailIndex = findStepIndex((step) => step?.type === "assertDomContains" && String(step?.text || "").includes("Show date details"));
const noKeepIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step?.text || "").includes("Keep only"));
const noExcludeIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step?.text || "").includes("Exclude"));
const noDrillIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step?.text || "").includes("Drill to Time Detail"));

assert.notEqual(injectActionsIndex, -1);
assert.notEqual(tableReadyIndex, -1);
assert.notEqual(diagnosticsIndex, -1);
assert.notEqual(warningIndex, -1);
assert.notEqual(detailIndex, -1);
assert.notEqual(noKeepIndex, -1);
assert.notEqual(noExcludeIndex, -1);
assert.notEqual(noDrillIndex, -1);

assert.equal(injectActionsIndex < tableReadyIndex, true);
assert.equal(tableReadyIndex < diagnosticsIndex, true);
assert.equal(diagnosticsIndex < warningIndex, true);
assert.equal(warningIndex < detailIndex, true);
assert.equal(detailIndex < noKeepIndex, true);
assert.equal(noKeepIndex < noExcludeIndex, true);
assert.equal(noExcludeIndex < noDrillIndex, true);

console.log("report-builder-preview-runtime-table-unsupported-warning-scenario-assets ✓ unsupported table refinement actions surface diagnostics while keeping valid detail actions");

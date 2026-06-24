import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-table-keep.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 6);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes(".forge-report-runtime-table-panel .forge-dashboard-row-action")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Keep only = Display")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Keep only = Display")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("delivery comparison") && expression.includes("text.includes('display')") && expression.includes("!text.includes('ctv')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("runtime-table-keep-proof")),
  true,
);

const actionsReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes(".forge-report-runtime-table-panel .forge-dashboard-row-action"));
const clickKeepIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Keep only" && step?.index === 1);
const chipIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Keep only = Display"));
const filteredTableIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("delivery comparison") && String(step?.expression || "").includes("!text.includes('ctv')"));

assert.notEqual(actionsReadyIndex, -1);
assert.notEqual(clickKeepIndex, -1);
assert.notEqual(chipIndex, -1);
assert.notEqual(filteredTableIndex, -1);

assert.equal(actionsReadyIndex < clickKeepIndex, true);
assert.equal(clickKeepIndex < chipIndex, true);
assert.equal(chipIndex < filteredTableIndex, true);

console.log("report-builder-preview-runtime-table-keep-scenario-assets ✓ semantic runtime table keep-only adds refinement chips and filters the runtime table");

import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-table-drill.scenario.mjs";

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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Drill to Market = Display")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Drill to Market = Display")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("labels.includes('Market')") && expression.includes("!labels.includes('Channel')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("runtime-table-drill-proof")),
  true,
);

const actionsReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes(".forge-report-runtime-table-panel .forge-dashboard-row-action"));
const clickDrillIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Drill to Market");
const chipIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Drill to Market = Display"));
const headerIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("labels.includes('Market')") && String(step?.expression || "").includes("!labels.includes('Channel')"));

assert.notEqual(actionsReadyIndex, -1);
assert.notEqual(clickDrillIndex, -1);
assert.notEqual(chipIndex, -1);
assert.notEqual(headerIndex, -1);

assert.equal(actionsReadyIndex < clickDrillIndex, true);
assert.equal(clickDrillIndex < chipIndex, true);
assert.equal(chipIndex < headerIndex, true);

console.log("report-builder-preview-runtime-table-drill-scenario-assets ✓ semantic runtime table drill adds refinement chips and pivots the table hierarchy");

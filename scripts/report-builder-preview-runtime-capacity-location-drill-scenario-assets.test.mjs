import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-capacity-location-drill.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 10);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Locations · Top Markets" && step?.index === 0),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes(".forge-report-runtime-table-panel .forge-dashboard-row-action")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Drill to Region = US")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("labels.includes('Region')") && expression.includes("!labels.includes('Market')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Drill to Metro Area = West")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("labels.includes('Metro Area')") && expression.includes("!labels.includes('Region')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("capacity-location-drill")),
  true,
);

const selectPresetIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Locations · Top Markets");
const actionsReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes(".forge-report-runtime-table-panel .forge-dashboard-row-action"));
const clickRegionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Drill to Region");
const regionChipIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Drill to Region = US"));
const regionHeaderIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("labels.includes('Region')"));
const clickMetroIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Drill to Metro Area");
const metroChipIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Drill to Metro Area = West"));
const metroHeaderIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("labels.includes('Metro Area')"));

assert.notEqual(selectPresetIndex, -1);
assert.notEqual(actionsReadyIndex, -1);
assert.notEqual(clickRegionIndex, -1);
assert.notEqual(regionChipIndex, -1);
assert.notEqual(regionHeaderIndex, -1);
assert.notEqual(clickMetroIndex, -1);
assert.notEqual(metroChipIndex, -1);
assert.notEqual(metroHeaderIndex, -1);

assert.equal(selectPresetIndex < actionsReadyIndex, true);
assert.equal(actionsReadyIndex < clickRegionIndex, true);
assert.equal(clickRegionIndex < regionChipIndex, true);
assert.equal(regionChipIndex < regionHeaderIndex, true);
assert.equal(regionHeaderIndex < clickMetroIndex, true);
assert.equal(clickMetroIndex < metroChipIndex, true);
assert.equal(metroChipIndex < metroHeaderIndex, true);

console.log("report-builder-preview-runtime-capacity-location-drill-scenario-assets ✓ runtime location drill pivots market to region and then metro area");

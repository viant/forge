import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-multiseries-drill.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 390,
  height: 844,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 11);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__compact-action" && step?.text === "Chart" && step?.index === 0),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails by Date and Channel" && step?.index === 0),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("document.querySelectorAll('.forge-chart-legend-action').length >= 2")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelector" && step?.selector === ".forge-chart-legend-action"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected value: Display")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-chart-action" && step?.text === "Drill to Market" && step?.index === 0),
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
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("runtime-multiseries-drill-proof")),
  true,
);

const openChartModeIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__compact-action" && step?.text === "Chart");
const selectPresetIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails by Date and Channel");
const legendReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("document.querySelectorAll('.forge-chart-legend-action').length >= 2"));
const clickLegendIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-chart-legend-action");
const selectedValueIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected value: Display"));
const clickDrillIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-chart-action" && step?.text === "Drill to Market");
const chipIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Drill to Market = Display"));
const pivotedHeaderIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("labels.includes('Market')") && String(step?.expression || "").includes("!labels.includes('Channel')"));

assert.notEqual(openChartModeIndex, -1);
assert.notEqual(selectPresetIndex, -1);
assert.notEqual(legendReadyIndex, -1);
assert.notEqual(clickLegendIndex, -1);
assert.notEqual(selectedValueIndex, -1);
assert.notEqual(clickDrillIndex, -1);
assert.notEqual(chipIndex, -1);
assert.notEqual(pivotedHeaderIndex, -1);

assert.equal(openChartModeIndex < selectPresetIndex, true);
assert.equal(selectPresetIndex < legendReadyIndex, true);
assert.equal(legendReadyIndex < clickLegendIndex, true);
assert.equal(clickLegendIndex < selectedValueIndex, true);
assert.equal(selectedValueIndex < clickDrillIndex, true);
assert.equal(clickDrillIndex < chipIndex, true);
assert.equal(chipIndex < pivotedHeaderIndex, true);

console.log("report-builder-preview-runtime-multiseries-drill-scenario-assets ✓ compact grouped chart legend selection drills to the semantic market level");

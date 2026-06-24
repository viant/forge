import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-multiseries.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 390,
  height: 844,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 12);

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
  scenario.steps.some((step) => step?.type === "assertDomContains" && String(step.text || "").includes("Click a chart mark or series legend to apply authored runtime actions.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes("document.querySelectorAll('.forge-chart-legend-action').length >= 2")),
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
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-chart-action" && step?.text === "Show channel details" && step?.index === 0),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Resolved detail target")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes(".forge-report-runtime-host-intent") && String(step.expression || "").includes("target://example/performance/channel-detail") && String(step.expression || "").includes("channel") && String(step.expression || "").includes("Display")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("runtime-multiseries-proof")),
  true,
);

const openChartModeIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__compact-action" && step?.text === "Chart");
const selectPresetIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails by Date and Channel");
const legendReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("document.querySelectorAll('.forge-chart-legend-action').length >= 2"));
const clickLegendIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-chart-legend-action");
const selectedValueIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected value: Display"));
const clickDetailIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-chart-action" && step?.text === "Show channel details");
const resolvedTargetIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Resolved detail target"));
const hostIntentIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes(".forge-report-runtime-host-intent")
  && String(step?.expression || "").includes("target://example/performance/channel-detail")
  && String(step?.expression || "").includes("channel")
  && String(step?.expression || "").includes("Display"));

assert.notEqual(openChartModeIndex, -1);
assert.notEqual(selectPresetIndex, -1);
assert.notEqual(legendReadyIndex, -1);
assert.notEqual(clickLegendIndex, -1);
assert.notEqual(selectedValueIndex, -1);
assert.notEqual(clickDetailIndex, -1);
assert.notEqual(resolvedTargetIndex, -1);
assert.notEqual(hostIntentIndex, -1);

assert.equal(openChartModeIndex < selectPresetIndex, true);
assert.equal(selectPresetIndex < legendReadyIndex, true);
assert.equal(legendReadyIndex < clickLegendIndex, true);
assert.equal(clickLegendIndex < selectedValueIndex, true);
assert.equal(selectedValueIndex < clickDetailIndex, true);
assert.equal(clickDetailIndex < resolvedTargetIndex, true);
assert.equal(resolvedTargetIndex < hostIntentIndex, true);

console.log("report-builder-preview-runtime-multiseries-scenario-assets ✓ compact grouped chart legend selection resolves the semantic channel detail target");

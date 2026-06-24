import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-exploration-chart-selection.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 12);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-builder__chart-action-button--quick"),
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
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-chart-legend-action" && step?.text === "Display" && step?.index === 0),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected value: Display")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Start draft"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Discard draft"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("parsed?.explorationSession?.sourceRef?.kind === 'reportBuilder.chartSelection'") && expression.includes("parsed?.explorationSession?.sourceRef?.contextLabel === 'Display'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("keys.every((key)") && expression.includes("return !parsed?.explorationSession")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("Selected value: Display")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("exploration-chart-selection")),
  true,
);

const openQuickChartIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-builder__chart-action-button--quick");
const selectPresetIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails by Date and Channel");
const legendReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("document.querySelectorAll('.forge-chart-legend-action').length >= 2"));
const selectLegendIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-chart-legend-action" && step?.text === "Display");
const selectedValueIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected value: Display"));
const startDraftIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Start draft");
const persistedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("reportBuilder.chartSelection") && String(step.expression || "").includes("contextLabel === 'Display'"));
const discardDraftIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Discard draft");
const clearedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("keys.every((key)") && String(step.expression || "").includes("return !parsed?.explorationSession"));
const selectionClearedIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("Selected value: Display"));

assert.notEqual(openQuickChartIndex, -1);
assert.notEqual(selectPresetIndex, -1);
assert.notEqual(legendReadyIndex, -1);
assert.notEqual(selectLegendIndex, -1);
assert.notEqual(selectedValueIndex, -1);
assert.notEqual(startDraftIndex, -1);
assert.notEqual(persistedSessionIndex, -1);
assert.notEqual(discardDraftIndex, -1);
assert.notEqual(clearedSessionIndex, -1);
assert.notEqual(selectionClearedIndex, -1);

assert.equal(openQuickChartIndex < selectPresetIndex, true);
assert.equal(selectPresetIndex < legendReadyIndex, true);
assert.equal(legendReadyIndex < selectLegendIndex, true);
assert.equal(selectLegendIndex < selectedValueIndex, true);
assert.equal(selectedValueIndex < startDraftIndex, true);
assert.equal(startDraftIndex < persistedSessionIndex, true);
assert.equal(persistedSessionIndex < discardDraftIndex, true);
assert.equal(discardDraftIndex < clearedSessionIndex, true);
assert.equal(clearedSessionIndex < selectionClearedIndex, true);

console.log("report-builder-preview-exploration-chart-selection-scenario-assets ✓ chart legend selection starts and clears a chart-selection exploration draft without leaking session state");

import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-pie-selection-clear.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 390,
  height: 844,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 11);

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__compact-action" && step?.text === "Chart" && step?.index === 0),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails by Channel" && step?.index === 0),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForChartRender" && step?.selector === ".forge-report-runtime-chart-panel .recharts-wrapper" && step?.minSectors === 2 && step?.minVisibleSectors === 2),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-runtime-chart-panel .recharts-sector"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected value: Display")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-runtime-chart-selection__clear"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Click a chart mark to apply authored runtime actions.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("Selected value: Display")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("runtime-pie-selection-clear-proof")),
  true,
);

const openChartModeIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__compact-action" && step?.text === "Chart");
const selectPiePresetIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails by Channel");
const renderPieIndex = findStepIndex((step) => step?.type === "waitForChartRender" && step?.selector === ".forge-report-runtime-chart-panel .recharts-wrapper");
const clickSectorIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-runtime-chart-panel .recharts-sector");
const selectedValueIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected value: Display"));
const clearSelectionIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-runtime-chart-selection__clear");
const resetPromptIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Click a chart mark to apply authored runtime actions."));
const clearedSelectionIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step?.text || "").includes("Selected value: Display"));

assert.notEqual(openChartModeIndex, -1);
assert.notEqual(selectPiePresetIndex, -1);
assert.notEqual(renderPieIndex, -1);
assert.notEqual(clickSectorIndex, -1);
assert.notEqual(selectedValueIndex, -1);
assert.notEqual(clearSelectionIndex, -1);
assert.notEqual(resetPromptIndex, -1);
assert.notEqual(clearedSelectionIndex, -1);

assert.equal(openChartModeIndex < selectPiePresetIndex, true);
assert.equal(selectPiePresetIndex < renderPieIndex, true);
assert.equal(renderPieIndex < clickSectorIndex, true);
assert.equal(clickSectorIndex < selectedValueIndex, true);
assert.equal(selectedValueIndex < clearSelectionIndex, true);
assert.equal(clearSelectionIndex < resetPromptIndex, true);
assert.equal(resetPromptIndex < clearedSelectionIndex, true);

console.log("report-builder-preview-runtime-pie-selection-clear-scenario-assets ✓ compact pie chart selection can be cleared back to the authored runtime prompt");

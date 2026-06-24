import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-pie-detail.scenario.mjs";

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
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails by Channel"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForChartRender" && step?.selector === ".forge-report-runtime-chart-panel .recharts-wrapper" && step?.minSectors === 2 && step?.minVisibleSectors === 2),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomContains" && String(step.text || "").includes("Click a chart mark to apply authored runtime actions.")),
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
  scenario.steps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes(".forge-report-runtime-host-intent") && String(step.expression || "").includes("target://example/performance/channel-detail") && String(step.expression || "").includes("Display")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("runtime-pie-detail-proof")),
  true,
);

const openChartModeIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__compact-action" && step?.text === "Chart");
const selectPiePresetIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails by Channel");
const renderPieIndex = findStepIndex((step) => step?.type === "waitForChartRender" && step?.selector === ".forge-report-runtime-chart-panel .recharts-wrapper");
const clickSectorIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-runtime-chart-panel .recharts-sector");
const selectedValueIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected value: Display"));
const clickDetailIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-chart-action" && step?.text === "Show channel details");
const resolvedTargetIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Resolved detail target"));
const targetRefIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes(".forge-report-runtime-host-intent")
  && String(step?.expression || "").includes("target://example/performance/channel-detail")
  && String(step?.expression || "").includes("Display"));

assert.notEqual(openChartModeIndex, -1);
assert.notEqual(selectPiePresetIndex, -1);
assert.notEqual(renderPieIndex, -1);
assert.notEqual(clickSectorIndex, -1);
assert.notEqual(selectedValueIndex, -1);
assert.notEqual(clickDetailIndex, -1);
assert.notEqual(resolvedTargetIndex, -1);
assert.notEqual(targetRefIndex, -1);

assert.equal(openChartModeIndex < selectPiePresetIndex, true);
assert.equal(selectPiePresetIndex < renderPieIndex, true);
assert.equal(renderPieIndex < clickSectorIndex, true);
assert.equal(clickSectorIndex < selectedValueIndex, true);
assert.equal(selectedValueIndex < clickDetailIndex, true);
assert.equal(clickDetailIndex < resolvedTargetIndex, true);
assert.equal(resolvedTargetIndex < targetRefIndex, true);

console.log("report-builder-preview-runtime-pie-detail-scenario-assets ✓ compact pie chart selection resolves the semantic channel detail target");

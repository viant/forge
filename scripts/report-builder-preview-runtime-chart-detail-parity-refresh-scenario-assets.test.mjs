import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-chart-detail-parity-refresh.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 15);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.filter((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-builder__chart-action-button--quick").length >= 2,
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails by Date and Channel"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails by Date"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes(".forge-report-builder__runtime-preview .forge-report-runtime-chart-panel") && expression.includes("Selected value:") && expression.includes("Display")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!entry.closest('.forge-report-builder__runtime-preview')") && expression.includes("Selected value:") && expression.includes("Display")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes(".forge-report-runtime-host-intent") && expression.includes("hasPreviewIntent") && expression.includes("hasStandaloneIntent") && expression.includes("target://example/performance/channel-detail") && expression.includes("Display")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("document.querySelectorAll('.forge-report-runtime-host-intent').length === 0")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("runtime-chart-detail-parity-refresh")),
  true,
);

const firstQuickChartIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-builder__chart-action-button--quick");
const selectGroupedChartIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails by Date and Channel");
const previewSelectedValueIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes(".forge-report-builder__runtime-preview .forge-report-runtime-chart-panel")
  && String(step?.expression || "").includes("Selected value:")
  && String(step?.expression || "").includes("Display"));
const standaloneSelectedValueIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes("!entry.closest('.forge-report-builder__runtime-preview')")
  && String(step?.expression || "").includes("Selected value:")
  && String(step?.expression || "").includes("Display"));
const bothIntentsVisibleIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes(".forge-report-runtime-host-intent")
  && String(step?.expression || "").includes("hasPreviewIntent")
  && String(step?.expression || "").includes("hasStandaloneIntent")
  && String(step?.expression || "").includes("target://example/performance/channel-detail")
  && String(step?.expression || "").includes("Display"));
const secondQuickChartIndex = scenario.steps.findIndex((step, index) => index > bothIntentsVisibleIndex && step?.type === "clickSelector" && step?.selector === ".forge-report-builder__chart-action-button--quick");
const selectRefreshChartIndex = scenario.steps.findIndex((step, index) => index > secondQuickChartIndex && step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails by Date");
const clearedIntentsIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes("document.querySelectorAll('.forge-report-runtime-host-intent').length === 0"));

assert.notEqual(firstQuickChartIndex, -1);
assert.notEqual(selectGroupedChartIndex, -1);
assert.notEqual(previewSelectedValueIndex, -1);
assert.notEqual(standaloneSelectedValueIndex, -1);
assert.notEqual(bothIntentsVisibleIndex, -1);
assert.notEqual(secondQuickChartIndex, -1);
assert.notEqual(selectRefreshChartIndex, -1);
assert.notEqual(clearedIntentsIndex, -1);

assert.equal(firstQuickChartIndex < selectGroupedChartIndex, true);
assert.equal(selectGroupedChartIndex < previewSelectedValueIndex, true);
assert.equal(previewSelectedValueIndex < standaloneSelectedValueIndex, true);
assert.equal(standaloneSelectedValueIndex < bothIntentsVisibleIndex, true);
assert.equal(bothIntentsVisibleIndex < secondQuickChartIndex, true);
assert.equal(secondQuickChartIndex < selectRefreshChartIndex, true);
assert.equal(selectRefreshChartIndex < clearedIntentsIndex, true);

console.log("report-builder-preview-runtime-chart-detail-parity-refresh-scenario-assets ✓ refreshing the chart preset clears stale preview and standalone host intents");

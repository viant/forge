import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-exploration-chart-toggle-response.scenario.mjs";

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
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Inventory Ladder" && step?.index === 0),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails by Date and Channel" && step?.index === 0),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("root?.getAttribute('data-report-builder-view-mode') === 'table'") && expression.includes("text.includes('1 BREAKDOWN')") && expression.includes("text.includes('Local Draft.')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("preview.resetCounters()") && expression.includes("replaceFetchBehaviors([{ match: { type: 'chartquery' }, delayMs: 1500 }])")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("preview.fetchBehaviors.length === 1") && expression.includes("match?.type === 'chartquery'") && expression.includes("delayMs === 1500")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("root?.getAttribute('data-report-builder-view-mode') === 'chart'") && expression.includes("root?.getAttribute('data-report-builder-state') !== 'loading'") && expression.includes("!text.includes('Refreshing report data')") && expression.includes("Applied this preset's required measures and breakdowns.") && expression.includes("Display") && expression.includes("CTV")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__explorationChartToggleResponseBaseline") && expression.includes("entry.type === \"chartQuery\"")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("root?.getAttribute('data-report-builder-view-mode') === 'table'") && expression.includes("forge-report-builder__table-wrap") && expression.includes("Local Draft.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Click a chart mark or series legend to apply authored runtime actions.") && expression.includes("Display") && expression.includes("CTV")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("preview?.[\"__explorationChartToggleResponseBaseline\"]") && expression.includes("requestCount === baseline.requestCount")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("preview.replaceFetchBehaviors([])")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("preview.fetchBehaviors.length === 0")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("exploration-chart-toggle-response")),
  true,
);

const firstQuickChartIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-builder__chart-action-button--quick");
const selectInventoryIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Inventory Ladder");
const draftTableIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("text.includes('1 BREAKDOWN')") && String(step.expression || "").includes("text.includes('Local Draft.')"));
const installDelayIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceFetchBehaviors([{ match: { type: 'chartquery' }, delayMs: 1500 }])"));
const delayReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("preview.fetchBehaviors.length === 1") && String(step.expression || "").includes("delayMs === 1500"));
const secondQuickChartIndex = scenario.steps.findIndex((step, index) => index > delayReadyIndex && step?.type === "clickSelector" && step?.selector === ".forge-report-builder__chart-action-button--quick");
const selectGroupedChartIndex = scenario.steps.findIndex((step, index) => index > secondQuickChartIndex && step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails by Date and Channel");
const chartRecoveredIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("root?.getAttribute('data-report-builder-view-mode') === 'chart'") && String(step.expression || "").includes("Applied this preset's required measures and breakdowns."));
const resetBaselineIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("__explorationChartToggleResponseBaseline"));
const switchToTableIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__result-header .forge-report-builder__view-toggle button" && step?.text === "table");
const stableTableIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("forge-report-builder__table-wrap"));
const switchBackToChartIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__result-header .forge-report-builder__view-toggle button" && step?.text === "chart");
const stableChartIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Click a chart mark or series legend to apply authored runtime actions."));
const baselineStableIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("preview?.[\"__explorationChartToggleResponseBaseline\"]"));
const clearDelayIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("preview.replaceFetchBehaviors([])"));
const delayClearedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("preview.fetchBehaviors.length === 0"));

assert.notEqual(firstQuickChartIndex, -1);
assert.notEqual(selectInventoryIndex, -1);
assert.notEqual(draftTableIndex, -1);
assert.notEqual(installDelayIndex, -1);
assert.notEqual(delayReadyIndex, -1);
assert.notEqual(secondQuickChartIndex, -1);
assert.notEqual(selectGroupedChartIndex, -1);
assert.notEqual(chartRecoveredIndex, -1);
assert.notEqual(resetBaselineIndex, -1);
assert.notEqual(switchToTableIndex, -1);
assert.notEqual(stableTableIndex, -1);
assert.notEqual(switchBackToChartIndex, -1);
assert.notEqual(stableChartIndex, -1);
assert.notEqual(baselineStableIndex, -1);
assert.notEqual(clearDelayIndex, -1);
assert.notEqual(delayClearedIndex, -1);

assert.equal(firstQuickChartIndex < selectInventoryIndex, true);
assert.equal(selectInventoryIndex < draftTableIndex, true);
assert.equal(draftTableIndex < installDelayIndex, true);
assert.equal(installDelayIndex < delayReadyIndex, true);
assert.equal(delayReadyIndex < secondQuickChartIndex, true);
assert.equal(secondQuickChartIndex < selectGroupedChartIndex, true);
assert.equal(selectGroupedChartIndex < chartRecoveredIndex, true);
assert.equal(chartRecoveredIndex < resetBaselineIndex, true);
assert.equal(resetBaselineIndex < switchToTableIndex, true);
assert.equal(switchToTableIndex < stableTableIndex, true);
assert.equal(stableTableIndex < switchBackToChartIndex, true);
assert.equal(switchBackToChartIndex < stableChartIndex, true);
assert.equal(stableChartIndex < baselineStableIndex, true);
assert.equal(baselineStableIndex < clearDelayIndex, true);
assert.equal(clearDelayIndex < delayClearedIndex, true);

console.log("report-builder-preview-exploration-chart-toggle-response-scenario-assets ✓ delayed chart-query preset swaps recover cleanly and keep chart/table toggles stable in local exploration mode");

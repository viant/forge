import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-chart-query-toggle-cache.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 720,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 20);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("preview.resetCounters()") && expression.includes("selectedMeasures: ['avails']") && expression.includes("chartSpec: null")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderState({ selectedMeasures: ['avails']") && expression.includes("viewMode: 'table'") && expression.includes("chartSpec: null")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getBuilderState()?.viewMode === 'table'") && expression.includes("chartSpec == null")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Table view for the active scope.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartToggleCacheBaseline") && expression.includes("replaceFetchBehaviors([{ match: { type: 'chartQuery' }, delayMs: 1500 }])")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("baseline.startCount === 0") && expression.includes("baseline.successCount === 0")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("preview.fetchBehaviors.length === 1") && expression.includes("delayMs === 1500")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("\"selectedMeasures\":[\"avails\"]") && expression.includes("Visual Story") && expression.includes("Full Query")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("startCount === baseline.startCount + 1")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.text === "table"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getBuilderState()?.viewMode === 'table'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("startCount === baseline.startCount + 1") && expression.includes("successCount === baseline.successCount")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.text === "chart"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getBuilderState()?.viewMode === 'chart'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("startCount === baseline.startCount + 1") && expression.includes("successCount === baseline.successCount + 1") && expression.includes("requestCount === baseline.requestCount + 1")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartToggleSettledCounts") && expression.includes("Date.now() - settled.lastChangedAt >= 1200")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("document.querySelector('.forge-report-builder')?.getAttribute('data-report-builder-state') === 'chart'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("document.querySelectorAll('.forge-chart-legend-action').length >= 2")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-query-toggle-cache")),
  true,
);

const seedTableIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("chartSpec: null"));
const tableReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("getBuilderState()?.viewMode === 'table'") && String(step.expression || "").includes("chartSpec == null"));
const installDelayIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("__chartToggleCacheBaseline"));
const baselineReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("baseline.startCount === 0"));
const delayReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("preview.fetchBehaviors.length === 1") && String(step.expression || "").includes("delayMs === 1500"));
const chartPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"avails\"]") && String(step.expression || "").includes("Visual Story"));
const startIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("startCount === baseline.startCount + 1"));
const switchTableIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.text === "table");
const cachedTableIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("successCount === baseline.successCount"));
const switchChartIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.text === "chart");
const cacheReusedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("successCount === baseline.successCount + 1") && String(step.expression || "").includes("requestCount === baseline.requestCount + 1"));
const settledCountsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("__chartToggleSettledCounts"));
const finalChartIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("document.querySelector('.forge-report-builder')?.getAttribute('data-report-builder-state') === 'chart'"));
const legendReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("document.querySelectorAll('.forge-chart-legend-action').length >= 2"));

assert.notEqual(seedTableIndex, -1);
assert.notEqual(tableReadyIndex, -1);
assert.notEqual(installDelayIndex, -1);
assert.notEqual(baselineReadyIndex, -1);
assert.notEqual(delayReadyIndex, -1);
assert.notEqual(chartPatchIndex, -1);
assert.notEqual(startIndex, -1);
assert.notEqual(switchTableIndex, -1);
assert.notEqual(cachedTableIndex, -1);
assert.notEqual(switchChartIndex, -1);
assert.notEqual(cacheReusedIndex, -1);
assert.notEqual(settledCountsIndex, -1);
assert.notEqual(finalChartIndex, -1);
assert.notEqual(legendReadyIndex, -1);

assert.equal(seedTableIndex < tableReadyIndex, true);
assert.equal(tableReadyIndex < installDelayIndex, true);
assert.equal(installDelayIndex < baselineReadyIndex, true);
assert.equal(baselineReadyIndex < delayReadyIndex, true);
assert.equal(delayReadyIndex < chartPatchIndex, true);
assert.equal(chartPatchIndex < startIndex, true);
assert.equal(startIndex < switchTableIndex, true);
assert.equal(switchTableIndex < cachedTableIndex, true);
assert.equal(cachedTableIndex < switchChartIndex, true);
assert.equal(switchChartIndex < cacheReusedIndex, true);
assert.equal(cacheReusedIndex < settledCountsIndex, true);
assert.equal(settledCountsIndex < finalChartIndex, true);
assert.equal(finalChartIndex < legendReadyIndex, true);

console.log("report-builder-preview-chart-query-toggle-cache-scenario-assets ✓ chart/table toggles reuse the in-flight chart query result cache instead of dispatching a second fetch for the same request fingerprint");
